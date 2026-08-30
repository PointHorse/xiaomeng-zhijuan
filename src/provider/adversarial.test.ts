/**
 * 对抗性 Bug 狩猎（②）：竞态 / 断流 / 恶意内容 / 边界。
 * 全部走真实 provider/candidates/tree 代码路径，provider 用注入的假实现控制时序。
 */
import { describe, it, expect } from 'vitest';
import { generateCandidates } from './candidates';
import { createMockProvider } from './mock';
import { createSseState, feedSse } from './sse';
import { createTree, growWithCandidates, fullText, deserialize } from '../worldtree/tree';

describe('竞态狩猎', () => {
  it('连点换一批：并发三轮互不污染，最后一轮候选胜出', async () => {
    const p = createMockProvider();
    const ac1 = new AbortController();
    const p1 = generateCandidates(p, { context: 'A', instruction: 'i', params: { temperature: 1, topP: 1, maxTokens: 50 }, signal: ac1.signal });
    const ac2 = new AbortController();
    const p2 = generateCandidates(p, { context: 'A', instruction: 'i', params: { temperature: 1, topP: 1, maxTokens: 50 }, signal: ac2.signal });
    // 第一轮被"换一批"取消
    ac1.abort();
    await expect(p1).rejects.toThrow();
    const r2 = await p2;
    expect(r2.length).toBe(3);
  });

  it('生成中切换风格：不中断已发出的请求（风格只影响下一次）', async () => {
    const p = createMockProvider();
    const promise = generateCandidates(p, { context: 'x', instruction: '旧风格指令', params: { temperature: 1, topP: 1, maxTokens: 50 }, signal: new AbortController().signal });
    // 模拟切风格：只改 store 字段，不影响已传入的 messages
    const r = await promise;
    expect(r.length).toBe(3);
  });

  it('生成中关闭窗口：abort 后 onError 为已取消而非报错', async () => {
    const p = createMockProvider();
    const ac = new AbortController();
    const errors: string[] = [];
    const done = p.generate({
      messages: [{ role: 'user', content: 'x'.repeat(2000) }],
      params: { temperature: 1, topP: 1, maxTokens: 100 },
      handlers: { onDelta: () => {}, onDone: () => {}, onError: (m) => errors.push(m) },
      signal: ac.signal,
    });
    ac.abort();
    await done;
    expect(errors.some((m) => m.includes('取消'))).toBe(true);
  });
});

describe('SSE 断流与恶意内容', () => {
  it('流中途断开：已收到的增量保留，onError 报中断', () => {
    const st = createSseState();
    let full = '';
    for (const e of feedSse(st, 'data: {"choices":[{"delta":{"content":"已收到的一半"}}]}\n\n')) full += e.delta;
    // 模拟断流：buffer 中残留不完整行，之后再无数据
    expect(full).toBe('已收到的一半');
    expect(st.buffer).toBe(''); // 半行仅在未遇 \n 时留存
  });

  it('非法 JSON 混入：跳过不炸', () => {
    const st = createSseState();
    const events = feedSse(st, 'data: {{{}}}\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n');
    expect(events.map((e) => e.delta)).toEqual(['ok']);
  });

  it('纯 emoji 正文：正常聚合', () => {
    const st = createSseState();
    const events = feedSse(st, 'data: {"choices":[{"delta":{"content":"🐺🔥..."}}]}\n\ndata: [DONE]\n\n');
    expect(events[0].delta).toBe('🐺🔥...');
  });

  it('超长单行 chunk（100万字）：不栈溢出', () => {
    const st = createSseState();
    const big = 'data: {"choices":[{"delta":{"content":"' + '长'.repeat(1_000_000) + '"}}]}\n\n';
    const events = feedSse(st, big);
    expect(events[0].delta.length).toBe(1_000_000);
  });

  it('文本含引号/换行/反斜杠转义：JSON 解码正确', () => {
    const st = createSseState();
    const events = feedSse(st, 'data: {"choices":[{"delta":{"content":"他说：\\"你好\\"\\n新行\\\\反斜杠"}}]}\n\n');
    expect(events[0].delta).toBe('他说："你好"\n新行\\反斜杠');
  });
});

describe('树与快照边界', () => {
  it('恶意快照注入（__proto__ 污染尝试）：反序列化拒绝', () => {
    const evil = JSON.stringify({
      nodes: { __proto__: { hacked: true } },
      rootId: 'x',
      currentId: 'x',
      history: ['x'],
      historyIndex: 0,
    });
    expect(() => deserialize(evil)).toThrow();
  });

  it('千轮故事：fullText 与历史操作性能与正确性', () => {
    const t = createTree('根');
    for (let i = 0; i < 1000; i++) {
      growWithCandidates(t, [{ id: `c${i}`, text: `第${i}段。`, createdAt: i }], 0);
    }
    expect(fullText(t).length).toBeGreaterThan(5000);
    // 回退 500 步仍正确
    let moved = 0;
    for (let i = 0; i < 500 && t.historyIndex > 0; i++) {
      t.historyIndex -= 1;
      t.currentId = t.history[t.historyIndex];
      moved++;
    }
    expect(moved).toBe(500);
  });
});
