/**
 * 触感反馈（Tauri 官方 haptics 插件，仅 Android 注册）。
 * 桌面/浏览器/插件不可用：全部静默降级（设计规范 §A）。
 */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

/** 分发到插件 API（纯函数，便于单测） */
export function dispatchHaptic(
  m: {
    selectionFeedback?: () => Promise<unknown>;
    impactFeedback?: (style: 'light' | 'medium' | 'heavy') => Promise<unknown>;
    notificationFeedback?: (type: 'success' | 'warning' | 'error') => Promise<unknown>;
  },
  kind: HapticKind,
): void {
  if (kind === 'selection') {
    if (m.selectionFeedback) void m.selectionFeedback();
    return;
  }
  if (kind === 'success' || kind === 'warning' || kind === 'error') {
    if (m.notificationFeedback) void m.notificationFeedback(kind);
    return;
  }
  if (m.impactFeedback) void m.impactFeedback(kind);
}

/* istanbul ignore next — 插件动态导入，单测中以 vi.mock 或 dispatchHaptic 覆盖 */
export async function haptic(kind: HapticKind = 'light'): Promise<void> {
  if (typeof globalThis === 'undefined' || !('__TAURI_INTERNALS__' in globalThis)) return;
  // 用户开关（设置页「触感反馈」），缺省开启
  let enabled = true;
  try {
    const { useStore } = await import('../../store/useStore');
    enabled = useStore.getState().settings.hapticsEnabled ?? true;
  } catch {
    /* store 不可用时按开启处理 */
  }
  if (!enabled) return;
  try {
    const m = (await import('@tauri-apps/plugin-haptics')) as Parameters<typeof dispatchHaptic>[0];
    dispatchHaptic(m, kind);
  } catch {
    /* 静默降级 */
  }
}
