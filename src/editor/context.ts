/**
 * 上下文拼接：取时间线正文末尾至多 maxChars 字作为 prompt 前文。
 * UTF-16 代码单元裁剪，避免拆散代理对（中文 BMP 字符不受影响）。
 */

export interface StitchResult {
  /** 拼接后的上下文文本 */
  context: string;
  /** 是否发生了截断 */
  truncated: boolean;
  /** 实际使用的字符数 */
  usedChars: number;
}

/** 深灰标题等 emoji/符号安全裁剪：从 code point 层面回退，不拆代理对 */
function safeSlice(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  let start = text.length - maxChars;
  // 如果落在低代理位上，回退一位
  const code = text.charCodeAt(start);
  if (code >= 0xdc00 && code <= 0xdfff) start -= 1;
  return text.slice(start);
}

export function stitchContext(fullText: string, maxChars: number): StitchResult {
  const limit = Math.max(1, Math.floor(maxChars));
  if (fullText.length <= limit) {
    return { context: fullText, truncated: false, usedChars: fullText.length };
  }
  const context = safeSlice(fullText, limit);
  return { context, truncated: true, usedChars: context.length };
}
