/** DCR④ · 顶栏风格下拉胶囊：显示当前风格名，点击弹出选择列表；管理仍在设置页 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { builtinStyles } from '../styles_ext/model';
import { listCustomStyles } from '../styles_ext/persist';
import type { StylePreset } from '../styles_ext/model';
import { useI18n } from '../i18n/useI18n';

export function StyleDropdown() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const lang = useI18n((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [styles, setStyles] = useState<StylePreset[]>(builtinStyles());
  const [nonce, setNonce] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => setStyles([...builtinStyles(), ...(await listCustomStyles())]))();
  }, [nonce]);

  // 设置页改动风格后返回时刷新（视图切换/窗口聚焦时对账）
  useEffect(() => {
    const el = document.querySelector('.workspace');
    if (!el) return;
    const obs = new MutationObserver(() => setNonce((n) => n + 1));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      if (open && ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const active = styles.find((s) => s.id === settings.activeStyleId) ?? styles[0];

  function pick(id: string): void {
    const s = styles.find((x) => x.id === id);
    setSettings({ activeStyleId: id, styleSystemPrompt: s?.systemPrompt ?? '' });
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="style-pill"
        title={lang === 'zh' ? '风格' : 'Style'}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ color: 'var(--accent)' }}>◐</span>
        <span className="style-pill-name">{active?.name ?? '默认'}</span>
      </button>
      {open && (
        <div className="dropdown" style={{ right: 0, top: 'calc(100% + 6px)', minWidth: 220 }}>
          {styles.map((s) => (
            <button
              key={s.id}
              className="dropdown-item"
              style={s.id === active?.id ? { color: 'var(--accent)', fontWeight: 600 } : undefined}
              onClick={() => pick(s.id)}
            >
              {s.id === active?.id ? '● ' : '○ '}
              {s.name}
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <button
            className="dropdown-item"
            style={{ color: 'var(--sub)', fontSize: 12.5 }}
            onClick={() => {
              setOpen(false);
              // 打开设置页（管理：编辑/删除/重新生成）
              const ev = new CustomEvent('xm-open-settings');
              document.dispatchEvent(ev);
            }}
          >
            {lang === 'zh' ? '管理风格…（设置页）' : 'Manage styles… (Settings)'}
          </button>
        </div>
      )}
    </div>
  );
}
