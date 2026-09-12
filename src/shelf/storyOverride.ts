/** DCR⑦ · 每本书的模型配置覆盖层 */

export interface StoryModelOverride {
  baseUrl?: string;
  apiKey?: string; // DPAPI 密文或明文（内存态）
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  styleId?: string;
}

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

const cache = new Map<string, StoryModelOverride>();

export async function loadOverride(storyId: string): Promise<StoryModelOverride | null> {
  if (cache.has(storyId)) return cache.get(storyId) ?? null;
  if (!IS_TAURI) return null;
  const db = await getClient();
  await db.execute(
    'CREATE TABLE IF NOT EXISTS story_model_overrides (story_id TEXT PRIMARY KEY, override_json TEXT NOT NULL)',
  );
  const result = await db.select<{ override_json: string }>(
    'SELECT override_json FROM story_model_overrides WHERE story_id = $1',
    [storyId],
  );
  if (!Array.isArray(result) || result.length === 0) return null;
  const parsed = JSON.parse(result[0].override_json) as StoryModelOverride;
  if (parsed.apiKey?.startsWith('enc:v1:')) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      parsed.apiKey = await invoke<string>('dpapi_reveal', {
        blobB64: parsed.apiKey.slice('enc:v1:'.length),
      });
    } catch {
      parsed.apiKey = '';
    }
  }
  cache.set(storyId, parsed);
  return parsed;
}

export async function saveOverride(storyId: string, override: StoryModelOverride): Promise<void> {
  cache.set(storyId, override);
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute(
    'CREATE TABLE IF NOT EXISTS story_model_overrides (story_id TEXT PRIMARY KEY, override_json TEXT NOT NULL)',
  );
  let apiKey = override.apiKey ?? '';
  if (apiKey && !apiKey.startsWith('enc:v1:')) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      apiKey = 'enc:v1:' + (await invoke<string>('dpapi_protect', { plain: apiKey }));
    } catch {
      /* 加密失败则存明文（同目录 appdata，仍优于丢失） */
    }
  }
  await db.execute(
    'INSERT OR REPLACE INTO story_model_overrides (story_id, override_json) VALUES ($1, $2)',
    [storyId, JSON.stringify({ ...override, apiKey })],
  );
}

export function cachedOverride(storyId: string): StoryModelOverride | undefined {
  return cache.get(storyId);
}
