/**
 * 移动端壳层根组件（§0）：与桌面壳共享 store/provider/worldtree 全部业务逻辑，
 * 仅重写布局与交互层。页面为简单页面栈：编辑页 ↔ 书架页 / 世界树 / 仪表盘 / 设置。
 */
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { MobileTopBar } from './MobileTopBar';
import { MobileEditor } from './MobileEditor';
import { CandidateSheet } from './CandidateSheet';
import { BookshelfPage } from './BookshelfPage';
import { WorldTreeView } from '../worldtree/WorldTreeView';
import { DashboardView } from '../dashboard/DashboardView';
import { SettingsView } from '../settings/SettingsView';
import './tokens.css';
import './mobile.css';

export type MobilePage = 'editor' | 'shelf' | 'worldtree' | 'dashboard' | 'settings';

export function MobileShell() {
  const [page, setPage] = useState<MobilePage>('editor');
  const storyId = useStore((s) => s.storyId);
  const loadStoryAction = useStore((s) => s.loadStory);

  async function openStory(id: string, t: string, treeJson: string): Promise<void> {
    try {
      const parsed = JSON.parse(treeJson) as never;
      loadStoryAction(id, t, parsed);
      const { loadOverride } = await import('../shelf/storyOverride');
      const ov = await loadOverride(id);
      useStore.getState().setStoryOverride(ov);
      setPage('editor');
    } catch {
      const { showToast } = await import('../components/toast');
      showToast('故事数据损坏');
    }
  }

  if (page === 'shelf') {
    return (
      <div className="mshell">
        <BookshelfPage
          onBack={() => setPage('editor')}
          onOpen={openStory}
          currentId={storyId}
          onNew={() => {
            useStore.getState().newStory('未命名故事', '');
            setPage('editor');
          }}
        />
      </div>
    );
  }

  if (page === 'worldtree' || page === 'dashboard' || page === 'settings') {
    const titleMap = { worldtree: '平行世界树', dashboard: '仪表盘', settings: '设置' } as const;
    return (
      <div className="mshell">
        <div className="msubpage-head">
          <button className="micon-btn" onClick={() => setPage('editor')} aria-label="返回">
            ←
          </button>
          <div className="msub-title">{titleMap[page]}</div>
        </div>
        <div className="msubpage-body">
          {page === 'worldtree' && <WorldTreeView />}
          {page === 'dashboard' && <DashboardView />}
          {page === 'settings' && <SettingsView />}
        </div>
      </div>
    );
  }

  return (
    <div className="mshell">
      <MobileTopBar
        onNew={() => useStore.getState().newStory('未命名故事', '')}
        onOpenShelf={() => setPage('shelf')}
        onOpenPage={(p) => setPage(p)}
      />
      <MobileEditor />
      <CandidateSheet />
    </div>
  );
}
