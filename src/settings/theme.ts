/** 主题与排版的应用辅助 */
import type { AppSettings } from './settings';
import { resolveTheme } from './settings';

export function applyTheme(pref: AppSettings['theme']): void {
  const resolved = resolveTheme(pref);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function applyTypography(s: Pick<AppSettings, 'fontSize' | 'lineHeight' | 'fontFamily'>): void {
  const root = document.documentElement;
  root.style.setProperty('--editor-font-size', `${s.fontSize}px`);
  root.style.setProperty('--editor-line-height', String(s.lineHeight));
  root.style.setProperty('--editor-font-family', s.fontFamily);
}

/** 系统主题变化监听（theme === system 时跟随） */
export function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
