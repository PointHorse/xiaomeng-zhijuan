/**
 * 移动端顶栏（§2，单行 56dp）：
 * ＋新建 → 书架 → 居中应用名/风格名 → 珊瑚红胶囊(模型/风格 ▾) → ··· 更多菜单
 */
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { SheetPortal } from './SheetPortal';
import type { MobilePage } from './MobileShell';
import { showToast } from '../components/toast';

interface Props {
  onNew: () => void;
  onOpenShelf: () => void;
  onOpenPage: (p: MobilePage) => void;
}

export function MobileTopBar({ onNew, onOpenShelf, onOpenPage }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const styles = (settings as { styles?: Array<{ id: string; name: string }> }).styles ?? [];
  const activeStyleId = (settings as { activeStyleId?: string }).activeStyleId;
  const activeStyle = styles.find((s) => s.id === activeStyleId);

  return (
    <header className="mtopbar">
      <button className="micon-btn" aria-label="新建故事" onClick={onNew}>
        ＋
      </button>
      <button className="micon-btn" aria-label="书架" onClick={onOpenShelf}>
        📚
      </button>
      <div className="mtopbar-center">{activeStyle ? activeStyle.name : 'DreamCore'}</div>
      <button className="mtopbar-capsule" onClick={() => setModelOpen(true)}>
        <span className="cap-label">⚡ {settings.model || 'mock'}</span>
        <span className="cap-caret">▾</span>
      </button>
      <button className="micon-btn" aria-label="更多" onClick={() => setMoreOpen(true)}>
        ···
      </button>

      {/* 模型/风格选择 Sheet（§2） */}
      <SheetPortal open={modelOpen} onClose={() => setModelOpen(false)} title="模型与风格">
        <button className="msheet-row" onClick={() => { setModelOpen(false); onOpenPage('settings'); }}>
          ⚡ 当前模型：{settings.model || 'mock'}（轻点修改）
        </button>
        <div className="msheet-sep" />
        {styles.length === 0 && (
          <button className="msheet-row" onClick={() => { setModelOpen(false); onOpenPage('settings'); }}>
            ◐ 风格：默认（在设置中添加风格）
          </button>
        )}
        {styles.map((s) => (
          <button
            key={s.id}
            className="msheet-row"
            onClick={() => {
              setSettings({ activeStyleId: s.id } as never);
              setModelOpen(false);
            }}
          >
            ◐ {s.name} {s.id === activeStyleId ? '✓' : ''}
          </button>
        ))}
      </SheetPortal>

      {/* 更多菜单 Sheet（§2）：保存、字号与排版、明暗主题、平行世界树、仪表盘、模型设置、导出长图、设置 */}
      <SheetPortal open={moreOpen} onClose={() => setMoreOpen(false)} title="更多">
        <MoreMenu onClose={() => setMoreOpen(false)} onOpenPage={onOpenPage} onModel={() => setModelOpen(true)} />
      </SheetPortal>
    </header>
  );
}

function MoreMenu({
  onClose,
  onOpenPage,
  onModel,
}: {
  onClose: () => void;
  onOpenPage: (p: MobilePage) => void;
  onModel: () => void;
}): JSX.Element {
  const isDark = document.documentElement.classList.contains('dark');
  return (
    <>
      <button
        className="msheet-row"
        onClick={() => { void import('../shelf/saveNow').then((m) => m.saveNowToShelf()); onClose(); }}
      >
        💾 保存
      </button>
      <button className="msheet-row" onClick={() => { onOpenPage('settings'); onClose(); }}>
        🅰 字号与排版
      </button>
      <button
        className="msheet-row"
        onClick={() => {
          const next = isDark ? 'light' : 'dark';
          void import('../settings/theme').then((m) => m.applyTheme(next));
          useStore.getState().setSettings({ theme: next });
          showToast(isDark ? '已切换为浅色' : '已切换为深色');
        }}
      >
        {isDark ? '☀ 明暗主题（当前深色）' : '🌙 明暗主题（当前浅色）'}
      </button>
      <div className="msheet-sep" />
      <button className="msheet-row" onClick={() => { onOpenPage('worldtree'); onClose(); }}>
        🌳 平行世界树
      </button>
      <button className="msheet-row" onClick={() => { onOpenPage('dashboard'); onClose(); }}>
        📊 仪表盘
      </button>
      <button className="msheet-row" onClick={() => { onModel(); onClose(); }}>
        ⚡ 模型设置
      </button>
      <button
        className="msheet-row"
        onClick={() => {
          void import('../export/shareImage').then(async (m) => {
            const s = useStore.getState();
            try {
              const r = await m.renderAndSaveShareImage({ title: s.title, tree: s.tree });
              showToast(r.path ? `长图已保存：${r.path}` : '已取消保存');
            } catch (e) {
              showToast(`长图保存失败：${e instanceof Error ? e.message : String(e)}`);
            }
          });
          onClose();
        }}
      >
        🖼 导出长图
      </button>
      <div className="msheet-sep" />
      <button className="msheet-row" onClick={() => { onOpenPage('settings'); onClose(); }}>
        ⚙ 设置
      </button>
    </>
  );
}
