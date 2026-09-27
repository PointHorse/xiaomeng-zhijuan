/**
 * 诊断日志（阶段 3.5 §1①）：记录最近 50 次模型请求的关键信息，
 * 帮助用户把失败原因带回给开发者。密钥永不记录（Authorization 在 header，不落日志）。
 * 存储收敛在内存 + localStorage（键 dcr_diag_log），上限 50 条。
 */

export interface DiagEntry {
  /** 完成时间（epoch ms） */
  t: number;
  /** 完整请求地址（不含密钥） */
  url: string;
  /** 模型名 */
  model: string;
  /** HTTP 状态码；网络层失败时为 0 */
  status: number | 0;
  /** 可读结论（成功/失败原因） */
  verdict: string;
  /** 错误响应正文前 500 字（仅失败时） */
  errBody?: string;
  /** 首字耗时 ms（未收到任何字节时为 null） */
  firstByteMs: number | null;
  /** 总耗时 ms */
  totalMs: number;
  /** finish_reason（流式结束时上游给出；未到达为 null） */
  finishReason: string | null;
  /** 是否收到 reasoning_content（推理模型） */
  reasoning: boolean;
}

const KEY = 'dcr_diag_log';
const MAX = 50;
const mem: DiagEntry[] = [];

function load(): DiagEntry[] {
  if (mem.length) return mem;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DiagEntry[];
      if (Array.isArray(parsed)) mem.push(...parsed.slice(0, MAX));
    }
  } catch {
    /* 损坏则忽略 */
  }
  return mem;
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(mem.slice(0, MAX)));
  } catch {
    /* 存储满则忽略 */
  }
}

/** 追加一条（新条目在前，上限 50） */
export function diagPush(entry: DiagEntry): void {
  const list = load();
  list.unshift(entry);
  if (list.length > MAX) list.length = MAX;
  persist();
}

/** 全部日志（新在前） */
export function diagAll(): DiagEntry[] {
  return [...load()];
}

/** 清空 */
export function diagClear(): void {
  mem.length = 0;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  persist();
}

/** 格式化为可复制文本（隐藏密钥：URL 中 query 形式的 key 参数一律打码） */
export function diagCopyText(entries: DiagEntry[] = diagAll()): string {
  return entries
    .map((e) => {
      const time = new Date(e.t).toLocaleString('zh-CN');
      const safeUrl = e.url.replace(/([?&](?:key|api[_-]?key|token)=)[^&]+/gi, '$1***');
      const lines = [
        `[${time}] ${safeUrl}`,
        `模型: ${e.model} | HTTP ${e.status} | ${e.verdict}`,
        `首字: ${e.firstByteMs ?? '—'}ms | 总耗时: ${e.totalMs}ms | finish_reason: ${e.finishReason ?? '—'} | reasoning: ${e.reasoning ? '是' : '否'}`,
      ];
      if (e.errBody) lines.push(`错误正文: ${e.errBody.slice(0, 500)}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

/** 首字超时判定（纯函数，便于测试）：等待首字节超过阈值 */
export function isFirstByteTimeout(elapsedMs: number, thresholdMs: number): boolean {
  return elapsedMs > thresholdMs;
}
