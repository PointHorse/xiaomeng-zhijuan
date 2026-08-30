/**
 * 持久化层：SQLite（tauri-plugin-sql）。
 * 每 5 秒防抖自动保存；启动时加载最近故事列表。
 * Tauri 环境外（单测）自动降级为 no-op。
 */

const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const DEBOUNCE_MS = 5000;

interface SqlClient {
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T[]>;
  execute: (query: string, bindValues?: unknown[]) => Promise<unknown>;
}

let client: SqlClient | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastPayload = '';

async function getClient(): Promise<SqlClient> {
  if (client) return client;
  const mod = await import('@tauri-apps/plugin-sql');
  const instance = await mod.default.load('sqlite:xiaomeng.db');
  client = instance as unknown as SqlClient;
  return client;
}

export interface StoryRow {
  id: string;
  title: string;
  updated_at: number;
}

export async function initSchema(): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS stories (
       id TEXT PRIMARY KEY,
       title TEXT NOT NULL,
       tree_json TEXT NOT NULL,
       updated_at INTEGER NOT NULL
     )`,
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL
     )`,
  );
}

export interface PersistSettings {
  /** 已脱敏的对象（apiKey 已加密或空） */
  json: string;
}

/** 设置持久化：API Key 由调用方先经 DPAPI 加密后再传入 */
export async function saveSettingsJson(json: string): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute(
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  );
  await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', [
    'app_settings',
    json,
  ]);
}

export async function loadSettingsJson(): Promise<string | null> {
  if (!IS_TAURI) return null;
  const db = await getClient();
  const rows = await db.select<{ value: string }>(
    'SELECT value FROM settings WHERE key = $1',
    ['app_settings'],
  );
  return rows.length > 0 ? rows[0].value : null;
}

export interface PersistPayload {
  id: string;
  title: string;
  treeJson: string;
}

/** 防抖保存（5 秒）；内容未变化时跳过 */
export function scheduleSave(payload: PersistPayload, onSaved: () => void): void {
  if (!IS_TAURI) return;
  const signature = `${payload.id}|${payload.title}|${payload.treeJson}`;
  if (signature === lastPayload) return;
  lastPayload = signature;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const db = await getClient();
      await db.execute(
        'INSERT OR REPLACE INTO stories (id, title, tree_json, updated_at) VALUES ($1, $2, $3, $4)',
        [payload.id, payload.title, payload.treeJson, Date.now()],
      );
      onSaved();
    } catch (e) {
      console.error('自动保存失败', e);
    }
  }, DEBOUNCE_MS);
}

export async function listStories(): Promise<StoryRow[]> {
  if (!IS_TAURI) return [];
  const db = await getClient();
  return db.select<StoryRow>(
    'SELECT id, title, updated_at FROM stories ORDER BY updated_at DESC LIMIT 50',
  );
}

export async function loadStoryTree(id: string): Promise<string | null> {
  if (!IS_TAURI) return null;
  const db = await getClient();
  const rows = await db.select<{ tree_json: string }>(
    'SELECT tree_json FROM stories WHERE id = $1',
    [id],
  );
  return rows.length > 0 ? rows[0].tree_json : null;
}

export async function deleteStory(id: string): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute('DELETE FROM stories WHERE id = $1', [id]);
}

/** 写文件（导出用）：Tauri 环境经 Rust 命令落盘；浏览器降级为下载 */
export async function writeExportFile(path: string, content: string): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('export_text_file', { path, contents: content });
    return;
  }
  // 浏览器降级：Blob 下载
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split(/[\\/]/).pop() ?? 'export.txt';
  a.click();
  URL.revokeObjectURL(url);
}
