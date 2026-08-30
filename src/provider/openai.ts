/**
 * OpenAI 兼容 Provider（纯 TypeScript 实现）。
 *
 * 传输层优先级：
 * 1. Tauri 环境 → @tauri-apps/plugin-http 的 fetch（经 Rust 薄代理转发，
 *    绕过 WebView 对本地端点的 CORS 限制；本插件为官方基础设施插件，
 *    不含业务逻辑）
 * 2. 浏览器/降级 → 原生 fetch
 *
 * 流式协议解析复用 sse.ts（含单元测试）。
 */
import { createSseState, feedSse } from './sse';
import type { GenRequest, Provider, ProviderConfig } from './types';

const IS_TAURI = typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

/** 归一化 baseUrl：去尾斜杠，仅允许 http/https */
export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`无效的 Base URL（仅允许 http/https）: ${baseUrl}`);
  }
  return trimmed;
}

/** 可注入的 fetch（测试时替换） */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function resolveFetch(): Promise<FetchLike> {
  if (!IS_TAURI) return fetch.bind(globalThis);
  try {
    const mod = (await import('@tauri-apps/plugin-http')) as {
      fetch: FetchLike;
    };
    return mod.fetch as FetchLike;
  } catch {
    return fetch.bind(globalThis);
  }
}

/** HTTP 状态码 → 可读中文提示 */
export function friendlyHttpError(status: number, body: string): string {
  const brief = body ? ` · ${body.slice(0, 200)}` : '';
  switch (status) {
    case 401:
      return `API Key 无效或未填写（401）。请到设置页检查 Key 是否正确${brief}`;
    case 403:
      return `无权访问该模型（403）。请确认账号已开通此模型、Key 权限充足${brief}`;
    case 404:
      return `端点或模型不存在（404）。请检查 Base URL 是否以 /v1 结尾、模型名是否正确${brief}`;
    case 429:
      return `请求过于频繁，已被限流（429）。稍等片刻再试，或降低生成频率${brief}`;
    case 500:
    case 502:
    case 503:
    case 504:
      return `模型服务暂时不可用（${status}）。请稍后重试${brief}`;
    default:
      return `模型服务返回错误：${status}${brief}`;
  }
}

export function createOpenAIProvider(cfg: ProviderConfig): Provider {
  return {
    kind: 'openai',
    async generate(req: GenRequest): Promise<void> {
      let base: string;
      try {
        base = normalizeBaseUrl(cfg.baseUrl);
      } catch (e) {
        req.handlers.onError(e instanceof Error ? e.message : String(e));
        return;
      }

      const doFetch = await resolveFetch();
      let res: Response;
      try {
        res = await doFetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: req.messages,
            stream: true,
            temperature: req.params.temperature,
            top_p: req.params.topP,
            max_tokens: req.params.maxTokens,
          }),
          signal: req.signal,
        });
      } catch (e) {
        if (req.signal.aborted) {
          req.handlers.onError('已取消');
        } else if (e instanceof DOMException && e.name === 'AbortError') {
          req.handlers.onError('已取消');
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          req.handlers.onError(
            /timeout|timed?\s?out/i.test(msg)
              ? `连接模型服务超时：请确认服务已启动、地址正确（${msg}）`
              : `无法连接模型服务：${msg}`,
          );
        }
        return;
      }

      if (!res.ok) {
        let detail = '';
        try {
          detail = (await res.text()).slice(0, 300);
        } catch {
          /* 忽略 */
        }
        req.handlers.onError(friendlyHttpError(res.status, detail));
        return;
      }

      // 流式读取（body 不可用时退化为整段文本）
      const sseState = createSseState();
      let full = '';

      const consumeChunk = (text: string): boolean => {
        // 返回 false = 收到 [DONE]
        let doneSeen = false;
        for (const ev of feedSse(sseState, text)) {
          if (ev.delta) {
            full += ev.delta;
            req.handlers.onDelta(ev.delta);
          }
          if (ev.done) doneSeen = true;
        }
        return !doneSeen;
      };

      try {
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder('utf-8');
          let keep = true;
          while (keep) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            keep = consumeChunk(text);
          }
        } else {
          const text = await res.text();
          consumeChunk(text);
        }
        req.handlers.onDone(full);
      } catch (e) {
        if (req.signal.aborted) {
          req.handlers.onError('已取消');
        } else {
          req.handlers.onError(`流式读取中断：${e instanceof Error ? e.message : String(e)}`);
        }
      }
    },
  };
}

/** 默认 Provider 工厂 */
export function createProvider(cfg: ProviderConfig): Provider {
  return createOpenAIProvider(cfg);
}
