/** 应用根组件：视图路由 + 主题/排版/自动保存/快捷键/首启探测 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/TopBar';
import { EditorPane } from './editor/EditorPane';
import { CandidateBar } from './editor/CandidateBar';
import { WorldTreeView } from './worldtree/WorldTreeView';
import { DashboardView } from './dashboard/DashboardView';
import { BookshelfPanel } from './shelf/BookshelfPanel';
import { initShelfSchema, saveToShelf, listShelfStories, nextUntitledNumber } from './shelf/shelf';
import { SettingsView, autoDetectLocal } from './settings/SettingsView';
import { applyTheme, applyTypography, watchSystemTheme } from './settings/theme';
import { initSchema, scheduleSave, loadStoryTree, listStories, writeExportFile, saveSettingsJson, loadSettingsJson } from './store/persist';
import { buildJsonExport, buildTxtExport } from './export/exporters';
import { buildMdExport, renderAndSaveShareImage } from './export/shareImage';
import { useGenerate } from './editor/useGenerate';
import { invoke } from '@tauri-apps/api/core';

export function App() {
  const hydratedRef = useRef(false);
  const view = useStore((s) => s.view);
  const title = useStore((s) => s.title);
  const tree = useStore((s) => s.tree);
  const storyId = useStore((s) => s.storyId);
  const settings = useStore((s) => s.settings);
  const newStory = useStore((s) => s.newStory);
  const loadStory = useStore((s) => s.loadStory);
  const setView = useStore((s) => s.setView);
  const openDashboard = () => setView('dashboard');
  const setSettings = useStore((s) => s.setSettings);
  const { run, cancel } = useGenerate();
  const [shelfCollapsed, setShelfCollapsed] = useState(false);

  async function saveNow(): Promise<void> {
    const s = useStore.getState();
    if (!s.storyId) return;
    const existing = await listShelfStories().catch(() => []);
    let finalTitle = s.title.trim();
    if (!finalTitle || finalTitle === '未命名故事') {
      finalTitle = `未命名${nextUntitledNumber(existing.map((x) => x.title))}`;
    }
    await saveToShelf(s.storyId, finalTitle, JSON.stringify(s.tree), existing.find((x) => x.id === s.storyId)?.folderId ?? null);
    s.setTitle(finalTitle);
    s.markSaved();
    showToast(`已保存「${finalTitle}」`);
    window.dispatchEvent(new CustomEvent('shelf-refresh'));
  }

  // 初始化：建库、恢复设置（Key 为 DPAPI 密文则解密）与最近故事、首启探测
  useEffect(() => {
    void (async () => {
      await initSchema();
      await initShelfSchema();
      const rawSettings = await loadSettingsJson();
      if (rawSettings) {
        try {
          const parsed = JSON.parse(rawSettings) as {
            baseUrl?: string;
            apiKey?: string;
            model?: string;
            temperature?: number;
            topP?: number;
            maxTokens?: number;
            contextWindow?: number;
            theme?: 'light' | 'dark' | 'system';
            fontSize?: number;
            lineHeight?: number;
            fontFamily?: string;
            activeStyleId?: string;
            styleSystemPrompt?: string;
          };
          let apiKey = parsed.apiKey ?? '';
          if (apiKey.startsWith('enc:v1:')) {
            apiKey = await invoke<string>('dpapi_reveal', { blobB64: apiKey.slice('enc:v1:'.length) }).catch(() => '');
          }
          setSettings({
            baseUrl: parsed.baseUrl ?? 'http://127.0.0.1:8080/v1',
            apiKey,
            model: parsed.model ?? '',
            temperature: parsed.temperature ?? 0.9,
            topP: parsed.topP ?? 0.92,
            maxTokens: parsed.maxTokens ?? 1000,
            contextWindow: parsed.contextWindow ?? 8000,
            theme: parsed.theme ?? 'system',
            fontSize: parsed.fontSize ?? 18,
            lineHeight: parsed.lineHeight ?? 1.9,
            fontFamily: parsed.fontFamily ?? '"Microsoft YaHei", "PingFang SC", serif',
            activeStyleId: parsed.activeStyleId ?? 'style_builtin_default',
            styleSystemPrompt: parsed.styleSystemPrompt ?? '',
          });
          useStore.setState({ settings: { ...useStore.getState().settings, apiKey } });
        } catch {
          /* 设置损坏则走默认值 */
        }
      }
      const rows = await listStories();
      if (rows.length > 0) {
        const raw = await loadStoryTree(rows[0].id);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { title?: string; tree?: unknown };
            if (parsed.tree) {
              loadStory(rows[0].id, parsed.title ?? rows[0].title, parsed.tree as never);
            }
          } catch {
            /* 损坏则忽略，走新建 */
          }
        }
      }
      applyTheme(useStore.getState().settings.theme);
      applyTypography(useStore.getState().settings);
      const s = useStore.getState().settings;
      if (!s.model) {
        const found = await autoDetectLocal();
        if (found) {
          useStore.getState().setSettings({ baseUrl: found.url, model: found.model });
          showToast(`检测到本地模型服务：${found.url}（模型：${found.model}）`);
        }
      }
      // DCR⑦：水合完成后才允许设置持久化（防止挂载时默认值覆盖存储）
      hydratedRef.current = true;
    })();
    return watchSystemTheme(() => applyTheme(useStore.getState().settings.theme));
  }, []);

  // 设置变化：水合完成后才持久化；API Key 经 DPAPI 加密
  useEffect(() => {
    if (!hydratedRef.current) return;
    void (async () => {
      let storedKey = settings.apiKey;
      if (storedKey && !storedKey.startsWith('enc:v1:')) {
        try {
          storedKey = 'enc:v1:' + (await invoke<string>('dpapi_protect', { plain: storedKey }));
        } catch {
          /* 加密失败则原样存本机库（仅当前用户可读的 appdata 目录） */
        }
      }
      await saveSettingsJson(
        JSON.stringify({ ...settings, apiKey: storedKey }, null, 0),
      );
    })();
  }, [settings]);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    applyTypography(settings);
  }, [settings.fontSize, settings.lineHeight, settings.fontFamily]);

  // 5 秒防抖自动保存
  useEffect(() => {
    if (!storyId) return;
    const timer = setTimeout(() => {
      scheduleSave(
        { id: storyId, title, treeJson: JSON.stringify(tree) },
        () => useStore.getState().markSaved(),
      );
    }, 5000);
    return () => clearTimeout(timer);
  }, [storyId, title, tree]);

  // 全局快捷键
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!(e.ctrlKey || e.metaKey)) return;
      const s = useStore.getState();
      if (e.key === 'Enter') {
        e.preventDefault();
        if (s.view !== 'editor' || s.gen.phase === 'generating') return;
        const input = document.querySelector<HTMLTextAreaElement>('.user-input');
        if (input && input.value.trim()) {
          s.confirmEditedText(input.value.trim());
          input.value = '';
        }
        void run();
      } else if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault();
        s.redo();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [run]);

  async function doExport(kind: 'json' | 'txt' | 'md'): Promise<void> {
    const s = useStore.getState();
    const content =
      kind === 'json' ? buildJsonExport(s.title, s.tree)
      : kind === 'md' ? buildMdExport(s.title, s.tree)
      : buildTxtExport(s.title, s.tree);
    const fallbackName = `${s.title || '未命名故事'}.${kind}`;
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: fallbackName,
        filters: [{ name: kind.toUpperCase(), extensions: [kind] }],
      });
      if (!path) return;
      await writeExportFile(path, content);
    } catch {
      await writeExportFile(fallbackName, content);
    }
    showToast(`已导出 .${kind}`);
  }

  const [pngPreview, setPngPreview] = useState<{ path: string; dataUrl: string } | null>(null);

  async function doExportPng(): Promise<void> {
    try {
      const r = await renderAndSaveShareImage({ title, tree });
      if (r.path) setPngPreview({ path: r.path, dataUrl: r.dataUrl });
      else showToast('已取消保存');
    } catch (e) {
      showToast(`长图保存失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        onOpenWorldTree={() => setView('worldtree')}
        onOpenDashboard={openDashboard}
        onOpenSettings={() => setView('settings')}
        onExportJson={() => void doExport('json')}
        onExportTxt={() => void doExport('txt')}
        onExportMd={() => void doExport('md')}
        onExportPng={() => void doExportPng()}
        onNewStory={() => newStory('未命名故事', '')}
        onSave={() => void saveNow()}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <BookshelfPanel
        collapsed={shelfCollapsed}
        onToggle={() => setShelfCollapsed((v) => !v)}
        onOpen={async (id, t, treeJson) => {
          try {
            const parsed = JSON.parse(treeJson) as never;
            loadStory(id, t, parsed);
            const { loadOverride } = await import('./shelf/storyOverride');
            const ov = await loadOverride(id);
            useStore.getState().setStoryOverride(ov);
            setView('editor');
          } catch { showToast('故事数据损坏'); }
        }}
        currentId={storyId}
      />
      <main className="workspace">
        {view === 'editor' && (
          <>
            <EditorPane />
            <div className="editor-divider" />
            <CandidateBar />
          </>
        )}
        {view === 'worldtree' && <WorldTreeView />}
        {view === 'dashboard' && <DashboardView />}
        {view === 'settings' && <SettingsView />}
      </main>
      </div>
      {pngPreview && (
        <div className="style-dialog-mask" onClick={() => setPngPreview(null)}>
          <div className="style-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>分享长图已生成</h3>
            <img src={pngPreview.dataUrl} alt="分享长图预览" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
            <div style={{ fontSize: 12, color: 'var(--sub)', margin: '12px 0', wordBreak: 'break-all' }}>
              保存路径：{pngPreview.path}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="pill-btn" onClick={() => { void navigator.clipboard.writeText(pngPreview.path); showToast('路径已复制'); }}>
                复制路径
              </button>
              <button className="pill-btn" style={{ background: 'var(--text)' }} onClick={async () => {
                try {
                  await invoke('copy_image_to_clipboard', { path: pngPreview.path });
                  showToast('图片已复制到剪贴板');
                } catch { showToast('复制失败（可用「打开所在文件夹」后手动复制）'); }
              }}>
                复制图片
              </button>
              <button className="pill-btn" style={{ background: 'var(--text)' }} onClick={async () => {
                try { await invoke('open_containing_folder', { path: pngPreview.path }); } catch { showToast('打开文件夹失败'); }
              }}>
                打开所在文件夹
              </button>
            </div>
          </div>
        </div>
      )}
      {useStore.getState().gen.phase === 'generating' && (
        <button
          className="hint-toast"
          style={{ cursor: 'pointer' }}
          onClick={() => cancel()}
          title="点击取消生成"
        >
          生成中… 点击取消
        </button>
      )}
    </div>
  );
}
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
