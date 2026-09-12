/**
 * DCR⑤ · 书架数据层
 * stories 表扩展 folder_id；folders 表存文件夹。
 * 兼容旧库：启动时 PRAGMA 检测并 ALTER。
 * 安全：全部查询使用 $N 参数绑定；本模块无任何命令执行。
 */

const IS_TAURI = typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

interface SqlClient {
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T[]>;
  execute: (query: string, bindValues?: unknown[]) => Promise<unknown>;
}

let client: SqlClient | null = null;

async function getClient(): Promise<SqlClient> {
  if (client) return client;
  const mod = await import('@tauri-apps/plugin-sql');
  const instance = await mod.default.load('sqlite:xiaomeng.db');
  client = instance as unknown as SqlClient;
  return client;
}

export interface ShelfFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface ShelfStory {
  id: string;
  title: string;
  updatedAt: number;
  folderId: string | null;
  treeJson: string;
}

export async function initShelfSchema(): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS folders (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       created_at INTEGER NOT NULL
     )`,
  );
  // 兼容旧库：检测 folder_id 列是否存在
  const cols = await db.select<{ name: string }>('PRAGMA table_info(stories)');
  const hasFolder = Array.isArray(cols) && cols.some((c) => c.name === 'folder_id');
  if (!hasFolder) {
    await db.execute('ALTER TABLE stories ADD COLUMN folder_id TEXT');
  }
}

export async function listFolders(): Promise<ShelfFolder[]> {
  if (!IS_TAURI) return [];
  const db = await getClient();
  const rows = await db.select<{
    id: string;
    name: string;
    created_at: number;
  }>('SELECT id, name, created_at FROM folders ORDER BY created_at ASC');
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

export async function createFolder(id: string, name: string): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute('INSERT INTO folders (id, name, created_at) VALUES ($1, $2, $3)', [
    id,
    name,
    Date.now(),
  ]);
}

export async function renameFolder(id: string, name: string): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute('UPDATE folders SET name = $1 WHERE id = $2', [name, id]);
}

/** 拆散：书籍回到根层级，文件夹删除，不删任何内容 */
export async function dissolveFolder(id: string): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute('UPDATE stories SET folder_id = NULL WHERE folder_id = $1', [id]);
  await db.execute('DELETE FROM folders WHERE id = $1', [id]);
}

export interface ShelfStory {
  id: string;
  title: string;
  updatedAt: number;
  folderId: string | null;
  treeJson: string;
}

export async function listShelfStories(): Promise<ShelfStory[]> {
  if (!IS_TAURI) return [];
  const db = await getClient();
  const rows = await db.select<{
    id: string;
    title: string;
    updated_at: number;
    folder_id: string | null;
    tree_json: string;
  }>('SELECT id, title, updated_at, folder_id, tree_json FROM stories ORDER BY updated_at DESC');
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at,
    folderId: r.folder_id,
    treeJson: r.tree_json,
  }));
}

export async function setStoryFolder(storyId: string, folderId: string | null): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute('UPDATE stories SET folder_id = $1 WHERE id = $2', [folderId, storyId]);
}

export async function renameStoryRow(storyId: string, title: string): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute('UPDATE stories SET title = $1 WHERE id = $2', [title, storyId]);
}

/** 下一个「未命名N」序号（纯字符串解析，无任何命令执行） */
export function nextUntitledNumber(titles: string[]): number {
  const prefix = '未命名';
  let max = 0;
  for (const t of titles) {
    const trimmed = t.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const numPart = trimmed.slice(prefix.length);
    if (/^\d+$/.test(numPart)) max = Math.max(max, Number(numPart));
  }
  return max + 1;
}

/** 保存故事到书架（upsert） */
export async function saveToShelf(
  storyId: string,
  title: string,
  treeJson: string,
  folderId: string | null,
): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute(
    'INSERT OR REPLACE INTO stories (id, title, tree_json, updated_at, folder_id) VALUES ($1, $2, $3, $4, $5)',
    [storyId, title, treeJson, Date.now(), folderId],
  );
}
