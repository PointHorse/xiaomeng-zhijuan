/**
 * 风格持久化（SQLite，经 tauri-plugin-sql）。
 * 内置风格不入库（代码常量）；仅自定义风格入库。
 * 非浏览器环境下导出 no-op 版本，保证单测/降级可用。
 */
import type { StylePreset } from './model';

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

export async function initStyleSchema(): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS styles (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       system_prompt TEXT NOT NULL,
       source_article TEXT NOT NULL,
       created_at INTEGER NOT NULL
     )`,
  );
}

export async function listCustomStyles(): Promise<StylePreset[]> {
  if (!IS_TAURI) return [];
  const db = await getClient();
  const rows = await db.select<{
    id: string; name: string; system_prompt: string; source_article: string; created_at: number;
  }>('SELECT id, name, system_prompt, source_article, created_at FROM styles ORDER BY created_at ASC');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    systemPrompt: r.system_prompt,
    sourceArticle: r.source_article,
    builtin: false,
    createdAt: r.created_at,
  }));
}

export async function upsertCustomStyle(s: StylePreset): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute(
    'INSERT OR REPLACE INTO styles (id, name, system_prompt, source_article, created_at) VALUES ($1, $2, $3, $4, $5)',
    [s.id, s.name, s.systemPrompt, s.sourceArticle, s.createdAt],
  );
}

export async function deleteCustomStyle(id: string): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute('DELETE FROM styles WHERE id = $1', [id]);
}
