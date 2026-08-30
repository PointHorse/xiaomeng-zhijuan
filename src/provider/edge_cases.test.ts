/**
 * 边界场景契约测试：空 content / length 截断 / 缺 usage / 非 [DONE] 终止 / 多余字段。
 * 全部走真实 openai.ts + sse.ts 代码路径。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const fetchMock = vi.fn();

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (url: string, init?: RequestInit) => fetchMock(url, init),
}));

(globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};

const { createOpenAIProvider } = await import('./openai');

function sse(chunks: string[]): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const k of chunks) c.enqueue(enc.encode(k));
        c.close();
      },
    }),
    { status: 200 },
  );
}

function collected() {
  const acc = { deltas: '', done: '', errors: [] as string[] };
  return {
    handlers: {
      onDelta: (d: string) => {
        acc.deltas += d;
      },
      onDone: (full: string) => {
        acc.done = full;
      },
      onError: (m: string) => {
        acc.errors.push(m);
      },
    },
    get deltas() {
      return acc.deltas;
    },
    get done() {
      return acc.done;
    },
    get errors() {
      return acc.errors;
    },
  };
}

function makeProvider() {
  return createOpenAIProvider({ baseUrl: 'http://127.0.0.1:8080/v1', apiKey: '', model: 'm' });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe('边界场景：空 content 与截断', () => {
  it('全程空 content：onDone 为空串（上层空正文防护负责重试）', async () => {
    fetchMock.mockResolvedValueOnce(
      sse(['data: {"choices":[{"delta":{"content":""}}]}\n\n', 'data: [DONE]\n\n']),
    );
    const c = collected();
    await makeProvider().generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.errors).toHaveLength(0);
    expect(c.done).toBe('');
  });

  it('length 截断：正常返回已有正文（截断语义由上层处理）', async () => {
    fetchMock.mockResolvedValueOnce(
      sse([
        'data: {"choices":[{"delta":{"content":"写到一半"}}],"usage":{"completion_tokens":300},"extra_field":123}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const c = collected();
    await makeProvider().generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.done).toBe('写到一半');
    expect(c.errors).toHaveLength(0);
  });
});

describe('边界场景：缺失与多余字段', () => {
  it('缺 usage 块：不影响解析', async () => {
    fetchMock.mockResolvedValueOnce(
      sse(['data: {"choices":[{"delta":{"content":"无usage"}}]}\n\n', 'data: [DONE]\n\n']),
    );
    const c = collected();
    await makeProvider().generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.done).toBe('无usage');
  });

  it('非标准 [DONE]：流直接结束（无 [DONE] 行）也能 onDone', async () => {
    fetchMock.mockResolvedValueOnce(
      sse(['data: {"choices":[{"delta":{"content":"直接断流"}}]}\n\n']),
    );
    const c = collected();
    await makeProvider().generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.done).toBe('直接断流');
    expect(c.errors).toHaveLength(0);
  });

  it('多余字段容错：reasoning_content / thinking / 自定义字段不混入正文', async () => {
    fetchMock.mockResolvedValueOnce(
      sse([
        'data: {"choices":[{"delta":{"content":"正文","reasoning_content":"思考不该出现"}}],"reasoning":"也不该"}\n\n',
        'data: {"message":{"content":"ollama式","thinking":"思考"},"model":"m"}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const c = collected();
    await makeProvider().generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.done).toBe('正文ollama式');
    expect(c.done).not.toContain('思考');
    expect(c.done).not.toContain('不该出现');
  });

  it('delta 中仅 role 无 content（首块）：跳过不产生空增量', async () => {
    fetchMock.mockResolvedValueOnce(
      sse([
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"正文"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const c = collected();
    await makeProvider().generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.deltas).toBe('正文');
  });

  it(' finish_reason: length 出现在同一块：正文照收', async () => {
    fetchMock.mockResolvedValueOnce(
      sse(['data: {"choices":[{"delta":{"content":"截断正文"},"finish_reason":"length"}]}\n\n', 'data: [DONE]\n\n']),
    );
    const c = collected();
    await makeProvider().generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.done).toBe('截断正文');
  });
});
