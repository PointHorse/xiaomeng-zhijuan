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
 * 阶段 3.5：诊断日志埋点、首字/总双超时、推理模型 reasoning_content 处理。
 */
import { createSseState, feedSse } from './sse';
import type { GenRequest, Provider, ProviderConfig } from './types';
import { diagPush } from '../diagnostics/diagLog';

const IS_TAURI = typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

/** 首字超时：fetch 建立后等待首个正文增量的上限（§1②） */
export const FIRST_BYTE_TIMEOUT_MS = 45000;
/** 总超时：单次生成全程上限 */
export const TOTAL_TIMEOUT_MS = 180000;

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
      return `模型名不存在，请在模型列表中重新选择（404）。也请检查 Base URL 是否以 /v1 结尾${brief}`;
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
      const startedAt = Date.now();
      let firstByteAt: number | null = null;
      let finishReason: string | null = null;
      let sawReasoning = false;
      let reasoningChars = 0;
      let httpStatus = 0;
      let verdict = '';

      // 总超时：独立 AbortController 与用户取消信号组合
      const aborter = new AbortController();
      const onUserAbort = (): void => aborter.abort();
      req.signal.addEventListener('abort', onUserAbort);
      const totalTimer = setTimeout(() => aborter.abort(), TOTAL_TIMEOUT_MS);
      const finish = (): void => {
        clearTimeout(totalTimer);
        req.signal.removeEventListener('abort', onUserAbort);
      };
      const abortedByTimeout = (): boolean => aborter.signal.aborted && !req.signal.aborted;

      let res: Response;
      try {
        res = await doFetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
            // 空 Origin：插件（需 unsafe-headers feature）会在 Rust 侧移除该头。
            // 否则 tauri-plugin-http 自动注入 Origin: http://tauri.localhost，
            // 部分中转站的 CSRF 校验会对带陌生 Origin 的 POST 返回 403。
            Origin: '',
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: req.messages,
            stream: true,
            temperature: req.params.temperature,
            top_p: req.params.topP,
            max_tokens: req.params.maxTokens,
          }),
          signal: aborter.signal,
        });
        httpStatus = res.status;
      } catch (e) {
        finish();
        const totalMs = Date.now() - startedAt;
        let msg: string;
        if (req.signal.aborted) {
          msg = '已取消';
        } else if (abortedByTimeout()) {
          msg = `连接超时（总时长超过 ${Math.round(TOTAL_TIMEOUT_MS / 1000)} 秒）。请检查网络后重试。`;
        } else if (e instanceof DOMException && e.name === 'AbortError') {
          msg = '已取消';
        } else {
          const raw = e instanceof Error ? e.message : String(e);
          msg = /timeout|timed?\s?out/i.test(raw)
            ? `连接模型服务超时：请确认服务已启动、地址正确（${raw}）`
            : `无法连接模型服务：${raw}`;
        }
        verdict = msg;
        diagPush({
          t: Date.now(), url: `${base}/chat/completions`, model: cfg.model,
          status: httpStatus, verdict, errBody: (e instanceof Error ? e.message : String(e)).slice(0, 500),
          firstByteMs: null, totalMs, finishReason: null, reasoning: sawReasoning,
        });
        req.handlers.onError(msg);
        return;
      }

      if (!res.ok) {
        let detail = '';
        try {
          detail = (await res.text()).slice(0, 500);
        } catch {
          /* 忽略 */
        }
        finish();
        verdict = friendlyHttpError(res.status, detail);
        diagPush({
          t: Date.now(), url: `${base}/chat/completions`, model: cfg.model,
          status: res.status, verdict, errBody: detail,
          firstByteMs: null, totalMs: Date.now() - startedAt, finishReason: null, reasoning: false,
        });
        req.handlers.onError(verdict);
        return;
      }

      // 流式读取（body 不可用时退化为整段文本）
      const sseState = createSseState();
      let full = '';

      const consumeChunk = (text: string): boolean => {
        // 返回 false = 收到 [DONE]
        let doneSeen = false;
        for (const ev of feedSse(sseState, text)) {
          if (ev.finishReason) finishReason = ev.finishReason;
          if (ev.reasoningDelta) {
            sawReasoning = true;
            reasoningChars += ev.reasoningDelta.length;
            req.handlers.onReasoningDelta?.(reasoningChars);
          }
          if (ev.delta) {
            if (firstByteAt === null) firstByteAt = Date.now();
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
          let sawFirstDelta = false;
          while (keep) {
            // 首字超时：收到第一个正文增量前，read 受首字超时约束
            let read: { done: boolean; value?: Uint8Array };
            if (sawFirstDelta) {
              read = await reader.read();
            } else {
              let fired = false;
              const timer = new Promise<never>((_, rej) => {
                setTimeout(() => {
                  fired = true;
                  rej(new Error('first-byte-timeout'));
                }, FIRST_BYTE_TIMEOUT_MS);
              });
              const raced = (await Promise.race([reader.read(), timer])) as { done: boolean; value?: Uint8Array };
              if (fired) {
                verdict = `等待首字超时（${Math.round(FIRST_BYTE_TIMEOUT_MS / 1000)} 秒）`;
                diagPush({
                  t: Date.now(), url: `${base}/chat/completions`, model: cfg.model,
                  status: res.status, verdict,
                  firstByteMs: null, totalMs: Date.now() - startedAt, finishReason: null, reasoning: sawReasoning,
                });
                finish();
                try { reader.cancel(); } catch { /* ignore */ }
                req.handlers.onError(
                  `${verdict}。推理模型思考较慢属正常；若持续出现请检查服务状态或更换模型，然后重试。`,
                );
                return;
              }
              read = raced;
            }
            if (read.done) break;
            const text = decoder.decode(read.value, { stream: true });
            if (text) sawFirstDelta = true;
            keep = consumeChunk(text);
          }
        } else {
          const text = await res.text();
          consumeChunk(text);
        }
        finish();
        verdict = `成功（${full.length} 字）`;
        diagPush({
          t: Date.now(), url: `${base}/chat/completions`, model: cfg.model,
          status: res.status, verdict,
          firstByteMs: firstByteAt ? firstByteAt - startedAt : null,
          totalMs: Date.now() - startedAt, finishReason, reasoning: sawReasoning,
        });
        // 推理模型正文为空：给出明确原因
        if (!full.trim()) {
          const reason =
            finishReason === 'length'
              ? '推理模型把生成长度全部用于思考，正文为空。请在设置中调大「最大生成长度」后重试。'
              : `模型未返回正文（finish_reason: ${finishReason ?? '未知'}）。请重试或更换模型。`;
          req.handlers.onError(reason);
          return;
        }
        req.handlers.onDone(full);
      } catch (e) {
        finish();
        const totalMs = Date.now() - startedAt;
        if (req.signal.aborted) {
          req.handlers.onError('已取消');
          return;
        }
        if (abortedByTimeout()) {
          verdict = `生成超时（总时长超过 ${Math.round(TOTAL_TIMEOUT_MS / 1000)} 秒）`;
          diagPush({
            t: Date.now(), url: `${base}/chat/completions`, model: cfg.model,
            status: res.status, verdict,
            firstByteMs: firstByteAt ? firstByteAt - startedAt : null,
            totalMs, finishReason, reasoning: sawReasoning,
          });
          req.handlers.onError(`${verdict}。已自动停止，请重试。`);
          return;
        }
        verdict = `流式读取中断：${e instanceof Error ? e.message : String(e)}`;
        diagPush({
          t: Date.now(), url: `${base}/chat/completions`, model: cfg.model,
          status: res.status, verdict, errBody: verdict,
          firstByteMs: firstByteAt ? firstByteAt - startedAt : null,
          totalMs, finishReason, reasoning: sawReasoning,
        });
        req.handlers.onError(`${verdict}。连接可能已断开，请重试。`);
      }
    },
  };
}

/** 默认 Provider 工厂 */
export function createProvider(cfg: ProviderConfig): Provider {
  return createOpenAIProvider(cfg);
}
