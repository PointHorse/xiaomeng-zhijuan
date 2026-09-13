/**
 * 书架独立页（§5）：全屏页面栈切换，专属顶栏（← 返回 / 书架 / ＋新建 / 多选）。
 * 条目卡片（书名、更新时间、字数）；长按进入多选（Android 惯例）；
 * 操作经底部 Sheet：重命名、删除、模型设置、导出；文件夹逻辑与桌面一致（新建/移入）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  createFolder,
  deleteStories,
  listFolders,
  listShelfStories,
  renameStoryRow,
  setStoryFolder,
  type ShelfFolder,
  type ShelfStory,
} from '../shelf/shelf';
import { buildTxtExport } from '../export/exporters';
import { writeExportFile } from '../store/persist';
import { showToast } from '../components/toast';
import { SheetPortal } from './SheetPortal';
import { mobileCopy } from './copy';

interface Props {
  onBack: () => void;
  onOpen: (id: string, title: string, treeJson: string) => void;
  onNew: () => void;
  currentId: string | null;
}

interface ModelDialogState {
  storyId: string;
  title: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: string;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function charCountOf(treeJson: string): number {
  try {
    const tree = JSON.parse(treeJson) as { nodes: Record<string, { text: string }> };
    return Object.values(tree.nodes).reduce((n, node) => n + node.text.length, 0);
  } catch {
    return 0;
  }
}

export function BookshelfPage({ onBack, onOpen, onNew, currentId }: Props) {
  const [stories, setStories] = useState<ShelfStory[]>([]);
  const [folders, setFolders] = useState<ShelfFolder[]>([]);
  const [multi, setMulti] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [actionTarget, setActionTarget] = useState<ShelfStory | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [folderName, setFolderName] = useState('');
  const [movingTarget, setMovingTarget] = useState<ShelfStory | null>(null);
  const [modelDialog, setModelDialog] = useState<ModelDialogState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setStories(await listShelfStories());
    setFolders(await listFolders());
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = (): void => void refresh();
    window.addEventListener('shelf-refresh', onRefresh);
    return () => window.removeEventListener('shelf-refresh', onRefresh);
  }, [refresh]);

  function toggleChecked(id: string): void {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startPress(story: ShelfStory): void {
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      setMulti(true);
      setChecked(new Set([story.id]));
    }, 500);
  }
  function cancelPress(): void {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  async function doRename(): Promise<void> {
    if (!renaming) return;
    const v = renaming.value.trim();
    if (v) {
      await renameStoryRow(renaming.id, v);
      if (renaming.id === currentId) useStore.getState().setTitle(v);
      await refresh();
    }
    setRenaming(null);
  }

  async function doDelete(): Promise<void> {
    const ids = [...checked];
    if (ids.length === 0) return;
    await deleteStories(ids);
    setChecked(new Set());
    setMulti(false);
    await refresh();
    showToast(`已删除 ${ids.length} 个故事`);
  }

  async function doExport(story: ShelfStory): Promise<void> {
    try {
      const tree = JSON.parse(story.treeJson) as never;
      const content = buildTxtExport(story.title, tree);
      await writeExportFile(`${story.title || '未命名故事'}.txt`, content);
      showToast(`已导出「${story.title}」.txt`);
    } catch (e) {
      showToast(`导出失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function saveModelDialog(): Promise<void> {
    if (!modelDialog) return;
    const { saveOverride } = await import('../shelf/storyOverride');
    await saveOverride(modelDialog.storyId, {
      baseUrl: modelDialog.baseUrl.trim(),
      model: modelDialog.model.trim(),
      apiKey: modelDialog.apiKey,
      temperature: modelDialog.temperature ? Number(modelDialog.temperature) : undefined,
    });
    setModelDialog(null);
    showToast('模型设置已保存');
  }

  return (
    <>
      {/* 书架专属顶栏（§5） */}
      <header className="mtopbar">
        <button className="micon-btn" aria-label="返回" onClick={onBack}>
          ←
        </button>
        {multi ? (
          <>
            <div className="mtopbar-center">已选 {checked.size} 项</div>
            <button
              className="micon-btn"
              onClick={() => {
                setMulti(false);
                setChecked(new Set());
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <div className="mtopbar-center">{mobileCopy.shelfTitle}</div>
            <button className="micon-btn" aria-label="多选" onClick={() => setMulti(true)}>
              ☑
            </button>
            <button className="micon-btn" aria-label="新建" onClick={onNew}>
              ＋
            </button>
          </>
        )}
      </header>

      <div className="mshelf-list">
        {stories.length === 0 && (
          <div className="mshelf-empty">
            书架空空。
            <br />
            轻点上方「＋」开始写新故事。
          </div>
        )}
        {stories.map((s) => (
          <div
            key={s.id}
            className={`mshelf-row ${multi && checked.has(s.id) ? 'checked' : ''}`}
            onPointerDown={() => !multi && startPress(s)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onContextMenu={(e) => {
              // 桌面浏览器调试：右键等价长按
              e.preventDefault();
              setActionTarget(s);
            }}
            onClick={() => {
              if (multi) toggleChecked(s.id);
              else onOpen(s.id, s.title, s.treeJson);
            }}
          >
            {multi && <input type="checkbox" readOnly checked={checked.has(s.id)} />}
            <div className="mrow-main">
              <div className="mrow-title">{s.title}</div>
              <div className="mrow-sub">
                <span>{formatDate(s.updatedAt)}</span>
                <span>{mobileCopy.charCount.replace('{n}', String(charCountOf(s.treeJson)))}</span>
                {s.folderId && (
                  <span>📁 {folders.find((f) => f.id === s.folderId)?.name ?? mobileCopy.noFolder}</span>
                )}
              </div>
            </div>
            {!multi && (
              <button
                className="micon-btn"
                aria-label="操作"
                onClick={(e) => {
                  e.stopPropagation();
                  setActionTarget(s);
                }}
              >
                ⋯
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 多选模式底部操作条 */}
      {multi && (
        <div className="mshelf-actions">
          <button
            className="danger"
            disabled={checked.size === 0}
            onClick={() => setConfirmDelete(true)}
          >
            🗑 删除
          </button>
          <button
            disabled={checked.size === 0}
            onClick={() => {
              const first = stories.find((s) => checked.has(s.id));
              setMovingTarget(first ?? null);
            }}
          >
            📁 {mobileCopy.moveToFolder}
          </button>
        </div>
      )}

      {/* 单条操作 Sheet（§5：重命名、删除、模型设置、导出） */}
      <SheetPortal open={actionTarget !== null} onClose={() => setActionTarget(null)} title={actionTarget?.title}>
        {actionTarget && (
          <>
            <button
              className="msheet-row"
              onClick={() => {
                setRenaming({ id: actionTarget.id, value: actionTarget.title });
                setActionTarget(null);
              }}
            >
              ✎ {mobileCopy.rename}
            </button>
            <button
              className="msheet-row"
              onClick={() => {
                setMulti(true);
                setChecked(new Set([actionTarget.id]));
                setActionTarget(null);
              }}
            >
              ☑ {mobileCopy.multiSelect}
            </button>
            <button
              className="msheet-row"
              onClick={() => {
                void doExport(actionTarget);
                setActionTarget(null);
              }}
            >
              ⬇ {mobileCopy.export} TXT
            </button>
            <button
              className="msheet-row"
              onClick={() => {
                void import('../shelf/storyOverride').then(async (m) => {
                  const ov = await m.loadOverride(actionTarget.id);
                  setModelDialog({
                    storyId: actionTarget.id,
                    title: actionTarget.title,
                    baseUrl: ov?.baseUrl ?? '',
                    model: ov?.model ?? '',
                    apiKey: ov?.apiKey ?? '',
                    temperature: ov?.temperature != null ? String(ov.temperature) : '',
                  });
                });
                setActionTarget(null);
              }}
            >
              ⚡ {mobileCopy.modelSettings}
            </button>
            <div className="msheet-sep" />
            <button
              className="msheet-row"
              onClick={() => {
                setMovingTarget(actionTarget);
                setActionTarget(null);
              }}
            >
              📁 {mobileCopy.moveToFolder}
            </button>
            <button
              className="msheet-row danger"
              onClick={() => {
                setChecked(new Set([actionTarget.id]));
                setActionTarget(null);
                setMulti(true);
              }}
            >
              🗑 {mobileCopy.delete}
            </button>
          </>
        )}
      </SheetPortal>

      {/* 重命名 Sheet */}
      <SheetPortal open={renaming !== null} onClose={() => setRenaming(null)} title={mobileCopy.renamePromptTitle}>
        {renaming && (
          <>
            <div className="mfield">
              <input
                type="text"
                value={renaming.value}
                onChange={(e) => setRenaming({ id: renaming.id, value: e.target.value })}
                autoFocus
              />
            </div>
            <button className="mprimary-btn" onClick={() => void doRename()}>
              {mobileCopy.done}
            </button>
          </>
        )}
      </SheetPortal>

      {/* 删除确认 Sheet（§5 删除需二次确认） */}
      <SheetPortal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={mobileCopy.delete}>
        <p style={{ margin: '8px 0 14px', fontSize: 15, lineHeight: 1.8, color: 'var(--text)' }}>
          {mobileCopy.deleteConfirm.replace('{n}', String(checked.size))}
        </p>
        <button
          className="mprimary-btn"
          style={{ background: 'var(--accent)' }}
          onClick={() => {
            setConfirmDelete(false);
            void doDelete();
          }}
        >
          {mobileCopy.delete}
        </button>
      </SheetPortal>

      {/* 移入文件夹 Sheet */}
      <SheetPortal open={movingTarget !== null} onClose={() => setMovingTarget(null)} title={mobileCopy.moveToFolder}>
        <button
          className="msheet-row"
          onClick={() => {
            if (movingTarget) {
              const ids = multi ? [...checked] : [movingTarget.id];
              void Promise.all(ids.map((id) => setStoryFolder(id, null))).then(() => refresh());
            }
            setMovingTarget(null);
          }}
        >
          📄 {mobileCopy.noFolder}
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            className="msheet-row"
            onClick={() => {
              const ids = multi ? [...checked] : movingTarget ? [movingTarget.id] : [];
              void Promise.all(ids.map((id) => setStoryFolder(id, f.id))).then(() => refresh());
              setMovingTarget(null);
            }}
          >
            📁 {f.name}
          </button>
        ))}
        <div className="msheet-sep" />
        <div className="mfield">
          <input
            type="text"
            placeholder="新文件夹名称"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
          />
        </div>
        <button
          className="mprimary-btn"
          disabled={!folderName.trim()}
          onClick={() => {
            const name = folderName.trim();
            const ids = multi ? [...checked] : movingTarget ? [movingTarget.id] : [];
            void (async () => {
              const fid = `folder_${Date.now().toString(36)}`;
              await createFolder(fid, name);
              await Promise.all(ids.map((id) => setStoryFolder(id, fid)));
              setFolderName('');
              setMovingTarget(null);
              await refresh();
            })();
          }}
        >
          ＋ {mobileCopy.newFolder}
        </button>
      </SheetPortal>

      {/* 模型设置 Sheet（每书覆盖，与桌面 storyOverride 一致） */}
      <SheetPortal open={modelDialog !== null} onClose={() => setModelDialog(null)} title={`${mobileCopy.modelSettings} · ${modelDialog?.title ?? ''}`}>
        {modelDialog && (
          <>
            <div className="mfield">
              <label>Base URL</label>
              <input
                type="text"
                value={modelDialog.baseUrl}
                onChange={(e) => setModelDialog({ ...modelDialog, baseUrl: e.target.value })}
                placeholder="https://api.example.com/v1"
              />
            </div>
            <div className="mfield">
              <label>模型名称</label>
              <input
                type="text"
                value={modelDialog.model}
                onChange={(e) => setModelDialog({ ...modelDialog, model: e.target.value })}
                placeholder="deepseek-chat"
              />
            </div>
            <div className="mfield">
              <label>API Key（留空沿用全局）</label>
              <input
                type="password"
                value={modelDialog.apiKey}
                onChange={(e) => setModelDialog({ ...modelDialog, apiKey: e.target.value })}
              />
            </div>
            <div className="mfield">
              <label>温度（留空沿用全局）</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={modelDialog.temperature}
                onChange={(e) => setModelDialog({ ...modelDialog, temperature: e.target.value })}
              />
            </div>
            <button className="mprimary-btn" onClick={() => void saveModelDialog()}>
              {mobileCopy.done}
            </button>
          </>
        )}
      </SheetPortal>
    </>
  );
}
