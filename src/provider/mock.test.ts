import { describe, it, expect } from 'vitest';
import { createMockProvider, mockContinuation } from './mock';

describe('Mock Provider', () => {
  it('同一输入产生确定性的续写', () => {
    expect(mockContinuation('从前有座山', 0)).toBe(mockContinuation('从前有座山', 0));
    // 不同 salt（温度抖动）产生不同候选
    expect(mockContinuation('从前有座山', 0)).not.toBe(mockContinuation('从前有座山', 1));
  });

  it('流式回调拼出完整文本后 onDone', async () => {
    const p = createMockProvider();
    let deltas = '';
    let done = '';
    let err: string | undefined;
    const ac = new AbortController();
    await p.generate({
      messages: [{ role: 'user', content: '测试上下文' }],
      params: { temperature: 1, topP: 1, maxTokens: 100 },
      handlers: {
        onDelta: (d) => (deltas += d),
        onDone: (full) => (done = full),
        onError: (m) => (err = m),
      },
      signal: ac.signal,
    });
    expect(err).toBeUndefined();
    expect(done.length).toBeGreaterThan(0);
    expect(deltas).toBe(done);
  });

  it('abort: 触发 onError（已取消）', async () => {
    const p = createMockProvider();
    const ac = new AbortController();
    const promise = p.generate({
      messages: [{ role: 'user', content: 'x'.repeat(500) }],
      params: { temperature: 1, topP: 1, maxTokens: 100 },
      handlers: { onDelta: () => {}, onDone: () => {}, onError: (m) => { ac.abort(); expect(m).toContain('取消'); } },
      signal: ac.signal,
    });
    ac.abort(); // 立即取消
    await promise;
  });
});
