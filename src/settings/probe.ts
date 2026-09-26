/**
 * 模型端点探测（桌面设置页与移动设置页共用）。
 * 先 GET /models；失败降级为一条 max_tokens:1 的 chat 请求。
 * 返回可读错误（401 密钥无效 / 404 端点不存在 / 超时等）。
 */

export interface ProbeResult {
  ok: boolean;
  models: string[];
  latencyMs: number;
  error?: string;
}

export async function probeModels(baseUrl: string, apiKey: string): Promise<ProbeResult> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  async function doFetch(url: string, init?: RequestInit): Promise<Response> {
    if (typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis) {
      const mod = (await import('@tauri-apps/plugin-http')) as { fetch: typeof fetch };
      return mod.fetch(url, init);
    }
    return fetch(url, init);
  }

  const t0 = performance.now();
  // 路径 1：GET /models
  try {
    const res = await doFetch(`${base}/models`, { headers, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const latency = Math.round(performance.now() - t0);
      try {
        const j = (await res.json()) as { data?: Array<{ id?: string }> };
        const models = (j.data ?? []).map((m) => m.id ?? '').filter(Boolean);
        return { ok: true, models, latencyMs: latency };
      } catch {
        return { ok: true, models: [], latencyMs: latency };
      }
    }
    if (res.status !== 404 && res.status !== 405) {
      const body = (await res.text()).slice(0, 200);
      return { ok: false, models: [], latencyMs: Math.round(performance.now() - t0), error: friendlyStatus(res.status, body) };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/abort|timeout/i.test(msg)) {
      return { ok: false, models: [], latencyMs: 0, error: '连接超时（8 秒）——请确认服务已启动、地址与端口正确' };
    }
    return { ok: false, models: [], latencyMs: 0, error: msg };
  }

  // 路径 2：降级 max_tokens:1 chat 探测（部分服务无 /models）
  try {
    const t1 = performance.now();
    const res = await doFetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'default', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, stream: false }),
      signal: AbortSignal.timeout(8000),
    });
    const latency = Math.round(performance.now() - t1);
    if (res.ok || res.status === 400) {
      // 400 通常 = 模型名不对但端点活着
      const note = res.ok ? '' : '（端点可用，模型名可能不对——请手填模型名）';
      return { ok: true, models: [], latencyMs: latency, error: note || undefined };
    }
    const body = (await res.text()).slice(0, 200);
    return { ok: false, models: [], latencyMs: Math.round(performance.now() - t1), error: friendlyStatus(res.status, body) };
  } catch (e) {
    return { ok: false, models: [], latencyMs: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export function friendlyStatus(status: number, body: string): string {
  const brief = body ? ` · ${body}` : '';
  switch (status) {
    case 401: return `密钥无效或未填写（401）${brief}`;
    case 403: return `无权访问（403）${brief}`;
    case 404: return `端点不存在（404）。请检查 Base URL 是否以 /v1 结尾${brief}`;
    case 429: return `已被限流（429）${brief}`;
    case 500: case 502: case 503: case 504: return `模型服务暂时不可用（${status}）${brief}`;
    default: return `HTTP ${status}${brief}`;
  }
}
