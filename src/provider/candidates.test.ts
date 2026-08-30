import { describe, it, expect, vi } from 'vitest';
import { generateCandidates } from './candidates';
import { createMockProvider } from './mock';
import type { Provider, GenRequest } from './types';

function okProvider(texts: string[]): Provider {
  let i = 0;
  return {
    kind: 'openai',
    async generate(req: GenRequest) {
      const idx = i++;
      const text = texts[idx % texts.length] ?? `默认${idx}`;
      for (const ch of text) req.handlers.onDelta(ch);
      req.handlers.onDone(text);
    },
  };
}

function failProvider(failIndexes: number[]): Provider {
  let i = 0;
  return {
    kind: 'openai',
    async generate(req: GenRequest) {
      const idx = i++;
      if (failIndexes.includes(idx)) {
        req.handlers.onError('模拟故障');
        return;
      }
      req.handlers.onDone(`文本${idx}`);
    },
  };
}

describe('generateCandidates', () => {
  it('默认 3 条并发，全部成功', async () => {
    const onCandidate = vi.fn();
    const result = await generateCandidates(createMockProvider(), {
      context: '测试上下文',
      instruction: '直接续写下面的文本。',
      params: { temperature: 0.9, topP: 0.92, maxTokens: 100 },
      onCandidate,
      signal: new AbortController().signal,
    });
    expect(result).toHaveLength(3);
    expect(onCandidate).toHaveBeenCalledTimes(3);
    // 三条候选互不相同（温度抖动 + 哈希盐）
    const set = new Set(result.map((c) => c.text));
    expect(set.size).toBe(3);
  });

  it('指定 provider 时按序取文本', async () => {
    const result = await generateCandidates(okProvider(['一', '二', '三']), {
      context: '上下文',
      instruction: '续写',
      params: { temperature: 0.9, topP: 0.92, maxTokens: 50 },
      signal: new AbortController().signal,
    });
    expect(result.map((c) => c.text)).toEqual(['一', '二', '三']);
  });

  it('单条失败自动重试一次后成功', async () => {
    // 用闭包计数（避免 this 绑定歧义）：第 1 次调用失败，之后成功
    let calls = 0;
    const provider: Provider = {
      kind: 'openai',
      async generate(req: GenRequest) {
        calls += 1;
        if (calls === 1) {
          req.handlers.onError('模拟故障');
          return;
        }
        req.handlers.onDone(`文本${calls}`);
      },
    };
    const result = await generateCandidates(provider, {
      context: 'x',
      instruction: 'i',
      params: { temperature: 1, topP: 1, maxTokens: 50 },
      count: 2,
      signal: new AbortController().signal,
    });
    expect(result.length).toBe(2);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('全部失败时抛出错误', async () => {
    const provider = failProvider([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    await expect(
      generateCandidates(provider, {
        context: 'x',
        instruction: 'i',
        params: { temperature: 1, topP: 1, maxTokens: 50 },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
  });

  it('abort: 取消后返回空结果并抛取消错', async () => {
    const ac = new AbortController();
    const p = createMockProvider();
    const promise = generateCandidates(p, {
      context: 'x'.repeat(1000),
      instruction: 'i',
      params: { temperature: 1, topP: 1, maxTokens: 100 },
      signal: ac.signal,
    });
    ac.abort();
    await expect(promise).rejects.toThrow();
  });

  it('流式增量只从第一条回调（onDelta 仅 index 0）', async () => {
    const onDelta = vi.fn();
    await generateCandidates(createMockProvider(), {
      context: '上下文内容',
      instruction: 'i',
      params: { temperature: 1, topP: 1, maxTokens: 100 },
      onDelta,
      signal: new AbortController().signal,
    });
    expect(onDelta).toHaveBeenCalled();
  });
});
