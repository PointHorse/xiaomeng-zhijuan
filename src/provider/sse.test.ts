import { describe, it, expect } from 'vitest';
import { createSseState, feedSse } from './sse';

describe('SSE 解析器', () => {
  it('解析标准 OpenAI 流式 chunk', () => {
    const st = createSseState();
    const events = feedSse(st, 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].delta).toBe('你好');
    expect(events[0].done).toBe(false);
  });

  it('识别 [DONE] 结束标记', () => {
    const st = createSseState();
    const events = feedSse(st, 'data: [DONE]\n\n');
    expect(events).toHaveLength(1);
    expect(events[0].done).toBe(true);
  });

  it('不完整 chunk：缓冲等待下次喂入', () => {
    const st = createSseState();
    const half = 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: {"choices":[{"delta":{"con';
    const e1 = feedSse(st, half);
    expect(e1).toHaveLength(1);
    expect(st.buffer).toContain('data:');
    const e2 = feedSse(st, 'tent":"世界"}}]}\n\n');
    expect(e2).toHaveLength(1);
    expect(e2[0].delta).toBe('世界');
  });

  it('忽略注释行与非 data 行', () => {
    const st = createSseState();
    const events = feedSse(st, ': keep-alive\n\nevent: ping\ndata: {"choices":[]}\n\n');
    expect(events.filter((e) => e.delta)).toHaveLength(0);
  });

  it('兼容 llama.cpp content 直挂 choice 的风格', () => {
    const st = createSseState();
    const events = feedSse(st, 'data: {"choices":[{"content":"正文"}]}\n\n');
    expect(events[0].delta).toBe('正文');
  });

  it('兼容 Ollama message.content 风格', () => {
    const st = createSseState();
    const events = feedSse(st, 'data: {"message":{"content":"olly"}}\n\n');
    expect(events[0].delta).toBe('olly');
  });

  it('坏 JSON 不炸，静默跳过', () => {
    const st = createSseState();
    const events = feedSse(st, 'data: {oops}\n\ndata: {"choices":[{"delta":{"content":"好"}}]}\n\n');
    expect(events.filter((e) => e.delta)).toHaveLength(1);
  });

  it('跨多个 chunk 逐字拼出完整句子', () => {
    const st = createSseState();
    const chunks = ['data: {"choices":[{"delta":{"content":" ABC"}}]}\n', 'data: {"choices":[{"delta":{"content":"DEF"}}]}\n'];
    let all = '';
    for (const c of chunks) {
      for (const e of feedSse(st, c)) all += e.delta;
    }
    expect(all).toBe(' ABCDEF');
  });
});
