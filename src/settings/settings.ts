/** 设置项与预设（持久化由 store 层负责，经 DPAPI 加密的 API Key 除外） */

export interface AppSettings {
  /** 模型服务 */
  baseUrl: string;
  /** DPAPI 加密后存储；内存中为明文 */
  apiKey: string;
  model: string;
  /** 生成参数 */
  temperature: number;
  topP: number;
  maxTokens: number;
  /** 上下文窗口（字符） */
  contextWindow: number;
  /** 外观 */
  theme: 'light' | 'dark' | 'system';
  /** 排版 */
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  baseUrl: 'http://127.0.0.1:8080/v1',
  apiKey: '',
  model: '',
  // 默认拉高生成长度：推理型模型（如 deepseek-v4-flash）会把预算先花在思考上
  temperature: 0.9,
  topP: 0.92,
  maxTokens: 1000,
  contextWindow: 8000,
  theme: 'system',
  fontSize: 18,
  lineHeight: 1.9,
  fontFamily: '"Microsoft YaHei", "PingFang SC", serif',
};

export const GEN_PRESETS: Record<'conservative' | 'balanced' | 'wild', Pick<AppSettings, 'temperature' | 'topP' | 'maxTokens'>> = {
  conservative: { temperature: 0.6, topP: 0.9, maxTokens: 800 },
  balanced: { temperature: 0.9, topP: 0.92, maxTokens: 1500 },
  wild: { temperature: 1.1, topP: 0.95, maxTokens: 2500 },
};

export const GEN_PRESET_LABELS: Record<keyof typeof GEN_PRESETS, string> = {
  conservative: '保守',
  balanced: '平衡',
  wild: '脑洞',
};

/** 深浅主题应用（CSS 变量切换 + 跟随系统） */
export function resolveTheme(pref: AppSettings['theme']): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

/** 首次启动：静默探测本地常见推理端口（11434 Ollama / 1234 LM Studio / 8080 llama.cpp） */
export const AUTO_DETECT_PORTS = [11434, 1234, 8080];

export function autoDetectUrls(): string[] {
  return AUTO_DETECT_PORTS.map((p) => `http://127.0.0.1:${p}/v1`);
}
