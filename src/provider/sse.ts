/**
 * SSE / chunked 文本流解析器（纯函数，可独立测试）。
 * 兼容 OpenAI chat/completions 的 "data: {...}" 行协议与
 * llama.cpp / Ollama 的各种兼容变体（均遵循 SSE 分帧）。
 */

export interface SseEvent {
  /** 解析出的增量文本；无法解析 JSON 时退化为原始行 */
  delta: string;
  /** 是否为流结束标记（data: [DONE]） */
  done: boolean;
  /** 推理模型：reasoning_content 增量（诊断与"思考中"UI 用） */
  reasoningDelta?: string;
  /** 上游给出的 finish_reason（出现于最后一个 chunk） */
  finishReason?: string | null;
}

export interface SseState {
  buffer: string;
}

export function createSseState(): SseState {
  return { buffer: '' };
}

/** 从 OpenAI chunk JSON 中提取增量文本，容忍不同后端的字段差异 */
function extractDelta(json: string): string {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    // OpenAI: choices[0].delta.content
    const choices = obj.choices as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(choices) && choices.length > 0) {
      const c0 = choices[0] as Record<string, unknown>;
      const delta = c0.delta as Record<string, unknown> | undefined;
      if (delta && typeof delta.content === 'string') return delta.content;
      // 有些后端流式也用 message.content
      const msg = c0.message as Record<string, unknown> | undefined;
      if (msg && typeof msg.content === 'string') return msg.content;
      // llama.cpp 风格: content 直接在 choice 上
      if (typeof c0.text === 'string') return c0.text;
      if (typeof c0.content === 'string') return c0.content;
    }
    // Ollama 兼容: { message: { content }, done: bool }
    const message = obj.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === 'string') return message.content;
    return '';
  } catch {
    return '';
  }
}

/** 提取推理模型 reasoning_content 增量（DeepSeek / glm 等思考阶段） */
function extractReasoningDelta(json: string): string {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const choices = obj.choices as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(choices) && choices.length > 0) {
      const delta = choices[0].delta as Record<string, unknown> | undefined;
      if (delta && typeof delta.reasoning_content === 'string') return delta.reasoning_content;
    }
    return '';
  } catch {
    return '';
  }
}

/** 提取 finish_reason（最后一个非空 chunk 携带） */
function extractFinishReason(json: string): string | null {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const choices = obj.choices as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(choices) && choices.length > 0) {
      const fr = choices[0].finish_reason;
      if (typeof fr === 'string') return fr;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 喂入新到达的文本块，返回解析出的 SSE 事件序列。
 * 不完整的行会留在 buffer 中等待下一次喂入。
 */
export function feedSse(state: SseState, chunk: string): SseEvent[] {
  state.buffer += chunk;
  const events: SseEvent[] = [];
  // SSE 以空行分隔事件；但 OpenAI 风格是每个 "data: {...}" 一行。
  // 逐行处理即可，最后一段可能不完整。
  let idx: number;
  // 规范 \r\n
  let work = state.buffer;
  const lines: string[] = [];
  while ((idx = work.indexOf('\n')) >= 0) {
    lines.push(work.slice(0, idx).replace(/\r$/, ''));
    work = work.slice(idx + 1);
  }
  state.buffer = work;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') {
      events.push({ delta: '', done: true });
      continue;
    }
    const delta = extractDelta(payload);
    const reasoningDelta = extractReasoningDelta(payload);
    const finishReason = extractFinishReason(payload);
    if (delta || reasoningDelta || finishReason !== null) {
      events.push({ delta, done: false, reasoningDelta: reasoningDelta || undefined, finishReason });
    }
  }
  return events;
}
