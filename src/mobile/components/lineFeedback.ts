/**
 * 点击线条反馈（阶段 3.5 §6）：委托监听全局 click，
 * 命中 [data-line-fx] 的元素在其 ::after 上播放「底部线条展开+淡出」。
 * 纯 CSS 动画（transform/opacity），animationend 自动清理类名。
 */
export function installLineFeedback(root: Document | HTMLElement = document): void {
  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const el = target.closest<HTMLElement>('[data-line-fx]');
    if (!el) return;
    el.classList.remove('line-fx-run');
    void el.offsetWidth; // 强制 reflow 以重启动画
    el.classList.add('line-fx-run');
  });
}

/** 清理监听（测试/卸载用） */
export function uninstallLineFeedback(root: Document | HTMLElement, fn: EventListener): void {
  root.removeEventListener('click', fn);
}
