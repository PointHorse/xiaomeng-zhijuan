/** DCR⑤ · 书架面板（可折叠、右键菜单、多选、文件夹、zip 导出） */
import { useEffect, useRef, useState } from 'react';
import {
  listShelfStories,
  listFolders,
  createFolder,
  renameFolder,
  dissolveFolder,
  renameStoryRow,
  setStoryFolder,
  nextUntitledNumber,
  zipFiles,
  type ShelfFolder,
  type ShelfStory,
} from './shelf';
import { deserialize } from '../worldtree/tree';
import { buildTxtExport, buildJsonExport, buildMdExport } from '../export/exporters';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  /** 双击打开故事 */
  onOpen: (id: string, title: string, treeJson: string) => void;
  currentId: string;
}

type MenuState =
  | { kind: 'none' }
  | { kind: 'story'; id: string; x: number; y: number }
  | { kind: 'folder'; id: string; name: string; x: number; y: number };

type MultiAction = 'none' | 'selecting';

export function BookshelfPanel({ collapsed, onToggle, onOpen, currentId }: Props) {
  const [stories, setStories] = useState<ShelfStory[]>([]);
  const [folders, setFolders] = useState<ShelfFolder[]>([]);
  const [menu, setMenu] = useState<MenuState>({ kind: 'none' });
  const [multi, setMulti] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ id: string; kind: 'story' | 'folder'; value: string } | null>(null);
  const [zipDialog, setZipDialog] = useState<{ folderId: string; name: string } | null>(null);
  const [zipFormats, setZipFormats] = useState<Set<'txt' | 'html' | 'json'>>(new Set(['txt']));
  const [message, setMessage] = useState('');
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  async function refresh(): Promise<void> {
    setStories(await listShelfStories());
    setFolders(await listFolders());
  }

  useEffect(() => {
    void refresh();
  }, [collapsed]);

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as HTMLElement)) {
        setMenu({ kind: 'none' });
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  /** 保存：未命名自动编号 */
  async function saveCurrent(currentId: string, currentTitle: string, treeJson: string, existingTitles: string[]): Promise<string> {
    let finalTitle = currentTitle.trim();
    if (!finalTitle || /^未命名$/.test(finalTitle)) {
      finalTitle = `未命名${nextUntitledNumber(existingTitles)}`;
    }
    await import('./shelf').then((m) => m.saveToShelf(currentId, finalTitle, treeJson, null));
    await refresh();
    return finalTitle;
  }

  async function doRename(): Promise<void> {
    if (!renaming || !renaming.value.trim()) {
      setRenaming(null);
      return;
    }
    if (renaming.kind === 'story') {
      await renameStoryRow(renaming.id, renaming.value.trim());
    } else {
      await renameFolder(renaming.id, renaming.value.trim());
    }
    setRenaming(null);
    await refresh();
  }

  async function doDeleteStory(id: string): Promise<void> {
    if (!IS_TAURI()) return;
    const { default: sql } = await import('@tauri-apps/plugin-sql');
    await sql.execute('DELETE FROM stories WHERE id = $1', [id]);
    await refresh();
  }

  async function makeFolder(): Promise<void> {
    const id = `folder_${Date.now().toString(36)}`;
    await createFolder(id, `未命名文件夹${folders.length + 1}`);
    // 勾选项收入文件夹
    for (const sid of checked) {
      await setStoryFolder(sid, id);
    }
    setChecked(new Set());
    setMulti(false);
    await refresh();
  }

  async function exportFolderZip(folderId: string, folderName: string): Promise<void> {
    const formats = [...zipFormats];
    if (formats.length === 0) return;
    const { default: sql } = await import('@tauri-apps/plugin-sql');
    const rows = await sql.execute(
      'UPDATE stories SET folder_id = folder_id WHERE folder_id = $1',
      [folderId],
    );
    void rows;
    const all = await listShelfStories();
    const inFolder = all.filter((s) => s.folderId === folderId);
    if (inFolder.length === 0) {
      setMessage('文件夹内没有故事');
      return;
    }
    const files: Record<string, Uint8Array> = {};
    const enc = new TextEncoder();
    for (const s of inFolder) {
      try {
        const tree = deserialize(s.treeJson);
        if (formats.includes('txt')) {
          files[`${folderName}/${s.title}.txt`] = enc.encode(buildTxtExport(s.title, tree));
        }
        if (formats.includes('html')) {
          const body = (tree ? fullTextOf(tree) : '').split('\n\n').map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('\n');
          const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(s.title)}</title><style>body{max-width:720px;margin:40px auto;font:18px/1.9 "Microsoft YaHei",serif;color:#303133;background:#fff}h1{font-size:24px}</style></head><body><h1>${escapeHtml(s.title)}</h1>${body}</body></html>`;
          files[`${folderName}/${s.title}.html`] = enc.encode(html);
        }
        if (formats.includes('json')) {
          files[`${folderName}/${s.title}.json`] = enc.encode(s.treeJson);
        }
      } catch {
        /* 单本损坏跳过 */
      }
    }
    const zipped = await zipFiles(files);
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: `${folderName}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (!path) return;
    const { invoke } = await import('@tauri-apps/api/core');
    const b64 = uint8ToB64(zipped);
    await invoke('export_base64_file', { path, contentsB64: b64 });
    setMessage(`已导出 ${inFolder.length} 本 → ${path}`);
  }

  if (collapsed) {
    return (
      <button className="shelf-toggle-collapsed" onClick={onToggle} title="书架">
        📚
      </button>
    );
  }

  const rootStories = stories.filter((s) => !s.folderId);

  return (
    <div className="shelf-panel" ref={rootRef}>
      <div className="shelf-head">
        <span style={{ fontWeight: 600, fontSize: 14 }}>书架</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {multi ? (
            <>
              <button className="shelf-mini-btn" onClick={() => void makeFolder()} disabled={checked.size === 0}>
                新建文件夹
              </button>
              <button
                className="shelf-mini-btn"
                onClick={() => {
                  setMulti(false);
                  setChecked(new Set());
                }}
              >
                取消
              </button>
            </>
          ) : (
            <button
              className="shelf-mini-btn"
              onContextMenu={(e) => {
                e.preventDefault();
                // 长按右键 ≥600ms 进入多选
                pressTimer.current = setTimeout(() => {
                  setMulti(true);
                }, 600);
              }}
              onContextMenuCapture={() => undefined}
              onMouseDown={() => undefined}
              onClick={() => setMulti(true)}
              title="多选（或长按右键）"
            >
              多选
            </button>
          )}
          <button className="shelf-mini-btn" onClick={onToggle} title="折叠">
            ◀
          </button>
        </div>
      </div>

      {message && <div className="shelf-msg">{message}</div>}

      {/* 文件夹 */}
      {folders.map((f) => {
        const inFolder = stories.filter((s) => s.folderId === f.id);
        return (
          <div key={f.id}>
            <div
              className="shelf-folder"
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ kind: 'folder', id: f.id, name: f.name, x: e.clientX, y: e.clientY });
              }}
            >
              📁 {f.name}（{inFolder.length}）
            </div>
            {inFolder.map((s) => renderStoryRow(s, true))}
          </div>
        );
      })}

      {/* 根层级故事 */}
      {rootStories.map((s) => renderStoryRow(s, false))}

      {stories.length === 0 && (
        <div style={{ color: 'var(--sub)', fontSize: 12.5, padding: '8px 12px' }}>
          书架空空。保存故事后出现在这里。
        </div>
      )}

      {/* 右键菜单 */}
      {menu.kind === 'story' && (
        <div className="dropdown" style={{ left: menu.x, top: menu.y, position: 'fixed', zIndex: 400 }}>
          <button className="dropdown-item" onClick={() => { setRenaming({ id: menu.id, kind: 'story', value: stories.find((s) => s.id === menu.id)?.title ?? '' }); setMenu({ kind: 'none' }); }}>
            重命名
          </button>
          <button
            className="dropdown-item"
            onClick={async () => {
              if (confirm('删除这本故事？（平行世界树一并删除，不可恢复）')) {
                const { default: sql } = await import('@tauri-apps/plugin-sql');
                await sql.execute('DELETE FROM stories WHERE id = $1', [menu.id]);
                await refresh();
              }
              setMenu({ kind: 'none' });
            }}
          >
            删除
          </button>
        </div>
      )}
      {menu.kind === 'folder' && (
        <div className="dropdown" style={{ left: menu.x, top: menu.y, position: 'fixed', zIndex: 400 }}>
          <button className="dropdown-item" onClick={() => { setRenaming({ id: menu.id, kind: 'folder', value: menu.name }); setMenu({ kind: 'none' }); }}>
            重命名
          </button>
          <button className="dropdown-item" onClick={async () => { await dissolveFolder(menu.id); await refresh(); setMenu({ kind: 'none' }); }}>
            拆散
          </button>
          <button className="dropdown-item" onClick={() => { setZipDialog({ folderId: menu.id, name: menu.name }); setMenu({ kind: 'none' }); }}>
            导出为 zip
          </button>
        </div>
      )}

      {/* 重命名输入 */}
      {renaming && (
        <div className="style-dialog-mask" onClick={() => setRenaming(null)}>
          <div className="style-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="field-row">
              <label>新名称</label>
              <input
                type="text"
                autoFocus
                value={renaming.value}
                onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void doRename();
                }}
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="pill-btn" onClick={() => void doRename()}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* zip 导出格式勾选 */}
      {zipDialog && (
        <div className="style-dialog-mask" onClick={() => setZipDialog(null)}>
          <div className="style-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>导出「{zipDialog.name}」为 zip</h3>
            {(['txt', 'html', 'json'] as const).map((f) => (
              <label key={f} style={{ display: 'block', fontSize: 14, margin: '8px 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={zipFormats.has(f)}
                  onChange={(e) => {
                    const next = new Set(zipFormats);
                    if (e.target.checked) next.add(f);
                    else next.delete(f);
                    setZipFormats(next);
                  }}
                />{' '}
                {f.toUpperCase()}
              </label>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="pill-btn" style={{ background: 'var(--text)' }} onClick={() => setZipDialog(null)}>
                取消
              </button>
              <button
                className="pill-btn"
                disabled={zipFormats.size === 0}
                onClick={async () => {
                  await exportFolderZip(zipDialog.folderId, zipDialog.name);
                  setZipDialog(null);
                }}
              >
                导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderStoryRow(s: ShelfStory, inFolder: boolean): JSX.Element {
    const isCurrent = s.id === currentId;
    return (
      <div
        key={s.id}
        className={`shelf-story ${isCurrent ? 'current' : ''} ${inFolder ? 'in-folder' : ''}`}
        onClick={() => {
          if (multi) {
            setChecked((prev) => {
              const n = new Set(prev);
              if (n.has(s.id)) n.delete(s.id);
              else n.add(s.id);
              return n;
            });
          } else {
            onOpen(s.id, s.title, s.treeJson);
          }
        }}
        onDoubleClick={() => {
          if (!multi) setRenaming({ id: s.id, kind: 'story', value: s.title });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ kind: 'story', id: s.id, x: e.clientX, y: e.clientY });
        }}
        onMouseDown={(e) => {
          if (e.button === 2) {
            pressTimer.current = setTimeout(() => setMulti(true), 600);
          }
        }}
        onMouseUp={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
      >
        {multi && (
          <input
            type="checkbox"
            checked={checked.has(s.id)}
            onChange={() => {
              setChecked((prev) => {
                const n = new Set(prev);
                if (n.has(s.id)) n.delete(s.id);
                else n.add(s.id);
                return n;
              });
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <span className="shelf-story-title">
          {isCurrent ? '▸ ' : ''}
          {s.title}
        </span>
        <span className="shelf-story-time">{new Date(s.updatedAt).toLocaleDateString('zh-CN')}</span>
      </div>
    );
  }
}

function IS_TAURI(): boolean {
  return typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;
}

function fullTextOf(tree: ReturnType<typeof deserialize>): string {
  return Object.values(tree.nodes)
    .filter((n) => n.source === 'user' || n.chosenCandidateId !== null)
    .sort((a, b) => a.createdAt - b.createdAt)
    .reduce((acc, n) => acc + n.text, '');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function uint8ToB64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
