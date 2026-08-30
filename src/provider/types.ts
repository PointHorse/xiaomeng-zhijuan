/**
 * Provider 层公共类型。所有模型接入（Ollama / LM Studio / llama.cpp / 云端 / Mock）
 * 统一收敛为 OpenAI 兼容 chat/completions 契约（见 docs/provider-contract.md）。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenParams {
  temperature: number;
  topP: number;
  maxTokens: number;
}

export interface ProviderConfig {
  /** 例如 http://127.0.0.1:8080/v1 */
  baseUrl: string;
  /** 可留空；经 DPAPI 加密后落盘 */
  apiKey: string;
  model: string;
}

export interface StreamHandlers {
  /** 流式增量文本（已经过 rAF 合帧的回调由 UI 层自行节流） */
  onDelta: (delta: string) => void;
  /** 正常结束（拿到完整文本） */
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

export interface GenRequest {
  messages: ChatMessage[];
  params: GenParams;
  handlers: StreamHandlers;
  /** 取消信号 */
  signal: AbortSignal;
}

export interface Provider {
  readonly kind: 'mock' | 'openai';
  /** 单次流式生成（一条候选） */
  generate(req: GenRequest): Promise<void>;
}

/** 拉取 /v1/models 的模型名列表 */
export interface ModelListResult {
  ok: boolean;
  models: string[];
  latencyMs: number;
  error?: string;
}

export const PRESETS = {
  conservative: { temperature: 0.6, topP: 0.9, maxTokens: 300 },
  balanced: { temperature: 0.9, topP: 0.92, maxTokens: 400 },
  wild: { temperature: 1.1, topP: 0.95, maxTokens: 600 },
} as const;

export type PresetName = keyof typeof PRESETS;

export function presetParams(name: PresetName): GenParams {
  return { ...PRESETS[name] };
}
