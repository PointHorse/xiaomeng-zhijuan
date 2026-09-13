/** 轻提示 toast（全局单例，桌面/移动共用） */

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** 轻提示（替代系统弹窗） */
export function showToast(message: string): void {
  let el = document.getElementById('xm-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'xm-toast';
    el.className = 'hint-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (el) el.style.display = 'none';
  }, 5000);
}
