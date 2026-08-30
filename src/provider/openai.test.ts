/**
 * OpenAI Provider 单测：通过 vi.mock 模拟 plugin-http 传输层，
 * 覆盖 流式解析 / 错误映射 / 取消 / URL 校验。
 */
import { describe, it, expect, vi } from 'vitest';

const fetchMock = vi.fn();

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (url: string, init?: RequestInit) => fetchMock(url, init),
}));

// openai.ts 在模块加载时判定 Tauri 环境：测试中置位后动态导入
(globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};

const { createOpenAIProvider, normalizeBaseUrl } = await import('./openai');

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function errorResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

interface Collected {
  handlers: {
    onDelta: (d: string) => void;
    onDone: (full: string) => void;
    onError: (m: string) => void;
  };
  readonly deltas: string;
  readonly done: string;
  readonly errors: string[];
}

function collected(): Collected {
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

function makeProvider(): ReturnType<typeof createOpenAIProvider> {
  return createOpenAIProvider({ baseUrl: 'http://127.0.0.1:8080/v1', apiKey: '', model: 'test' });
}

describe('normalizeBaseUrl', () => {
  it('去尾斜杠', () => {
    expect(normalizeBaseUrl('http://x:1/v1/')).toBe('http://x:1/v1');
  });
  it('拒绝非 http(s) 协议', () => {
    expect(() => normalizeBaseUrl('ftp://x')).toThrow(/http\/https/);
    expect(() => normalizeBaseUrl('file:///c')).toThrow();
  });
});

describe('createOpenAIProvider', () => {
  it('流式：增量回调拼出全文并 onDone', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"夜风"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"掠过"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const c = collected();
    const p = makeProvider();
    await p.generate({
      messages: [{ role: 'user', content: '上文' }],
      params: { temperature: 0.9, topP: 0.92, maxTokens: 100 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.deltas).toBe('夜风掠过');
    expect(c.done).toBe('夜风掠过');
    expect(c.errors).toHaveLength(0);
  });

  it('非 200：onError 携带状态码与响应体', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'server boom'));
    const c = collected();
    const p = makeProvider();
    await p.generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.errors[0]).toContain('500');
    expect(c.errors[0]).toContain('server boom');
  });

  it('401/403/429 映射为可读中文提示', async () => {
    const cases: Array<[number, string]> = [
      [401, 'API Key'],
      [403, '无权访问'],
      [429, '限流'],
    ];
    for (const [status, expectText] of cases) {
      fetchMock.mockResolvedValueOnce(errorResponse(status, 'body'));
      const c = collected();
      const p = makeProvider();
      await p.generate({
        messages: [{ role: 'user', content: 'x' }],
        params: { temperature: 1, topP: 1, maxTokens: 10 },
        handlers: c.handlers,
        signal: new AbortController().signal,
      });
      expect(c.errors[0]).toContain(expectText);
    }
  });

  it('取消：onError 为已取消', { timeout: 10000 }, async () => {
    const ac = new AbortController();
    // mock 流跟随 abort 信号报错（模拟真实网络流的中止行为）
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        ac.signal.addEventListener(
          'abort',
          () => controller.error(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true },
        );
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(stream, { status: 200 }));
    const c = collected();
    const p = makeProvider();
    const done = p.generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: ac.signal,
    });
    ac.abort();
    await done;
    expect(c.errors.some((m) => m.includes('取消'))).toBe(true);
  });

  it('网络异常：onError 携带原因', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const c = collected();
    const p = makeProvider();
    await p.generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.errors[0]).toContain('ECONNREFUSED');
  });

  it('baseUrl 非法：不发起请求直接报错', async () => {
    const callsBefore = fetchMock.mock.calls.length;
    const c = collected();
    const bad = createOpenAIProvider({ baseUrl: 'not-a-url', apiKey: '', model: 'm' });
    await bad.generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: c.handlers,
      signal: new AbortController().signal,
    });
    expect(c.errors[0]).toContain('无效的 Base URL');
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
