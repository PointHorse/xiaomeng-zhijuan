/**
 * 生成中加载状态机（docs/design-language.md §3.7、组件文档 §5）。
 * skeleton = 生成开始、首字符未到：显示模糊占位 + 扫光；
 * resolving = 流式字符已到：占位层 300ms 渐清晰+淡出，与真实文字短暂共存；
 * idle = 非生成态。
 */
export type GenLoadingPhase = 'idle' | 'skeleton' | 'resolving';

export function genLoadingPhase(generating: boolean, streamText: string): GenLoadingPhase {
  if (!generating) return 'idle';
  return streamText === '' ? 'skeleton' : 'resolving';
}
