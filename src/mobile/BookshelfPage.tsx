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
import { buildTxtExport, buildJsonExport } from '../export/exporters';
import { buildMdExport } from '../export/shareImage';
import { writeExportFile } from '../store/persist';
import { showToast } from '../components/toast';
import { BottomSheet, SheetRow, SheetSep } from './components/BottomSheet';
import { Button } from './components/Button';
import { Icon } from '../components/Icon';
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
  const suppressClick = useRef(false);

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
      // 长按进入多选后，吞掉紧随而来的 click（其闭包里 multi 仍为旧值，会误开操作 Sheet）
      suppressClick.current = true;
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

  async function doExport(story: ShelfStory, kind: 'txt' | 'json' | 'md'): Promise<void> {
    try {
      const tree = JSON.parse(story.treeJson) as never;
      const content =
        kind === 'json' ? buildJsonExport(story.title, tree)
        : kind === 'md' ? buildMdExport(story.title, tree)
        : buildTxtExport(story.title, tree);
      await writeExportFile(`${story.title || '未命名故事'}.${kind}`, content);
      showToast(`已导出「${story.title}」.${kind}`);
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
          <Icon name="undo-2" size={20} />
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
              <Icon name="check" size={20} />
            </button>
            <button className="micon-btn" aria-label="新建" onClick={onNew}>
              <Icon name="plus" size={20} />
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
              // Android 长按会派发 contextmenu：与长按手势一致，进入多选（§5 惯例）
              e.preventDefault();
              suppressClick.current = true;
              setMulti(true);
              setChecked(new Set([s.id]));
            }}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
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
                  <span>{folders.find((f) => f.id === s.folderId)?.name ?? mobileCopy.noFolder}</span>
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
                <Icon name="ellipsis" size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 多选模式底部操作条 */}
      {multi && (
        <div className="mshelf-actions">
          <Button
            variant="danger"
            disabled={checked.size === 0}
            disabledReason={checked.size === 0 ? '请先勾选要删除的故事' : undefined}
            onClick={() => setConfirmDelete(true)}
          >
            <Icon name="trash-2" size={16} /> 删除
          </Button>
          <Button
            variant="secondary"
            disabled={checked.size === 0}
            disabledReason={checked.size === 0 ? '请先勾选故事' : undefined}
            onClick={() => {
              const first = stories.find((s) => checked.has(s.id));
              setMovingTarget(first ?? null);
            }}
          >
            <Icon name="folder-down" size={16} /> {mobileCopy.moveToFolder}
          </Button>
        </div>
      )}

      {/* 单条操作 Sheet（§5：重命名、删除、模型设置、导出） */}
      <BottomSheet open={actionTarget !== null} onClose={() => setActionTarget(null)} title={actionTarget?.title}>
        {actionTarget && (
          <>
            <SheetRow
              icon="✎"
              onClick={() => {
                setRenaming({ id: actionTarget.id, value: actionTarget.title });
                setActionTarget(null);
              }}
            >
              {mobileCopy.rename}
            </SheetRow>
            <SheetRow
              icon="☑"
              onClick={() => {
                setMulti(true);
                setChecked(new Set([actionTarget.id]));
                setActionTarget(null);
              }}
            >
              {mobileCopy.multiSelect}
            </SheetRow>
            <SheetRow
              icon="download"
              onClick={() => {
                void doExport(actionTarget, 'txt');
                setActionTarget(null);
              }}
            >
              {mobileCopy.export} TXT
            </SheetRow>
            <SheetRow
              icon="download"
              onClick={() => {
                void doExport(actionTarget, 'json');
                setActionTarget(null);
              }}
            >
              {mobileCopy.export} JSON
            </SheetRow>
            <SheetRow
              icon="download"
              onClick={() => {
                void doExport(actionTarget, 'md');
                setActionTarget(null);
              }}
            >
              {mobileCopy.export} MD
            </SheetRow>
            <SheetRow
              icon="zap"
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
              {mobileCopy.modelSettings}
            </SheetRow>
            <SheetSep />
            <SheetRow
              icon="folder-down"
              onClick={() => {
                setMovingTarget(actionTarget);
                setActionTarget(null);
              }}
            >
              {mobileCopy.moveToFolder}
            </SheetRow>
            <SheetRow
              icon="trash-2"
              onClick={() => {
                setChecked(new Set([actionTarget.id]));
                setActionTarget(null);
                setMulti(true);
              }}
            >
              {mobileCopy.delete}
            </SheetRow>
          </>
        )}
      </BottomSheet>

      {/* 重命名 Sheet */}
      <BottomSheet open={renaming !== null} onClose={() => setRenaming(null)} title={mobileCopy.renamePromptTitle}>
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
            <Button variant="primary" onClick={() => void doRename()}>
              {mobileCopy.done}
            </Button>
          </>
        )}
      </BottomSheet>

      {/* 删除确认 Sheet（§5 删除需二次确认） */}
      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={mobileCopy.delete}>
        <p style={{ margin: '8px 0 14px', fontSize: 15, lineHeight: 1.8, color: 'var(--text)' }}>
          {mobileCopy.deleteConfirm.replace('{n}', String(checked.size))}
        </p>
        <Button
          variant="danger"
          onClick={() => {
            setConfirmDelete(false);
            void doDelete();
          }}
        >
          确认删除
        </Button>
      </BottomSheet>

      {/* 移入文件夹 Sheet */}
      <BottomSheet open={movingTarget !== null} onClose={() => setMovingTarget(null)} title={mobileCopy.moveToFolder}>
        <SheetRow
          icon="📄"
          onClick={() => {
            if (movingTarget) {
              const ids = multi ? [...checked] : [movingTarget.id];
              void Promise.all(ids.map((id) => setStoryFolder(id, null))).then(() => refresh());
            }
            setMovingTarget(null);
          }}
        >
          {mobileCopy.noFolder}
        </SheetRow>
        {folders.map((f) => (
          <SheetRow
            key={f.id}
            icon="folder-down"
            onClick={() => {
              const ids = multi ? [...checked] : movingTarget ? [movingTarget.id] : [];
              void Promise.all(ids.map((id) => setStoryFolder(id, f.id))).then(() => refresh());
              setMovingTarget(null);
            }}
          >
            {f.name}
          </SheetRow>
        ))}
        <SheetSep />
        <div className="mfield">
          <input
            type="text"
            placeholder="新文件夹名称"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          disabled={!folderName.trim()}
          disabledReason={!folderName.trim() ? '请先输入文件夹名称' : undefined}
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
        </Button>
      </BottomSheet>

      {/* 模型设置 Sheet（每书覆盖，与桌面 storyOverride 一致） */}
      <BottomSheet open={modelDialog !== null} onClose={() => setModelDialog(null)} title={`${mobileCopy.modelSettings} · ${modelDialog?.title ?? ''}`}>
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
            <Button variant="primary" onClick={() => void saveModelDialog()}>
              {mobileCopy.done}
            </Button>
          </>
        )}
      </BottomSheet>
    </>
  );
}
