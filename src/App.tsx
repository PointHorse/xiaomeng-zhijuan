/** 应用根组件：视图路由 + 主题/排版/自动保存/快捷键/首启探测 */
import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/TopBar';
import { EditorPane } from './editor/EditorPane';
import { CandidateBar } from './editor/CandidateBar';
import { WorldTreeView } from './worldtree/WorldTreeView';
import { SettingsView, autoDetectLocal } from './settings/SettingsView';
import { applyTheme, applyTypography, watchSystemTheme } from './settings/theme';
import { initSchema, scheduleSave, loadStoryTree, listStories, writeExportFile, saveSettingsJson, loadSettingsJson } from './store/persist';
import { buildJsonExport, buildTxtExport } from './export/exporters';
import { buildMdExport, downloadShareImage } from './export/shareImage';
import { useGenerate } from './editor/useGenerate';
import { invoke } from '@tauri-apps/api/core';

export function App() {
  const view = useStore((s) => s.view);
  const title = useStore((s) => s.title);
  const tree = useStore((s) => s.tree);
  const storyId = useStore((s) => s.storyId);
  const settings = useStore((s) => s.settings);
  const newStory = useStore((s) => s.newStory);
  const loadStory = useStore((s) => s.loadStory);
  const setView = useStore((s) => s.setView);
  const setSettings = useStore((s) => s.setSettings);
  const { run, cancel } = useGenerate();

  // 初始化：建库、恢复设置（Key 为 DPAPI 密文则解密）与最近故事、首启探测
  useEffect(() => {
    void (async () => {
      await initSchema();
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
    })();
    return watchSystemTheme(() => applyTheme(useStore.getState().settings.theme));
  }, []);

  // 设置变化：API Key 经 DPAPI 加密后持久化
  useEffect(() => {
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
        scheduleSave(
          { id: s.storyId, title: s.title, treeJson: JSON.stringify(s.tree) },
          () => useStore.getState().markSaved(),
        );
        showToast('已保存');
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        onOpenWorldTree={() => setView('worldtree')}
        onOpenSettings={() => setView('settings')}
        onExportJson={() => void doExport('json')}
        onExportTxt={() => void doExport('txt')}
        onExportMd={() => void doExport('md')}
        onExportPng={() => downloadShareImage({ title, tree })}
        onNewStory={() => newStory('未命名故事', '')}
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
        {view === 'settings' && <SettingsView />}
      </main>
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
