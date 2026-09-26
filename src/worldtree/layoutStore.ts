/**
 * tree_layout 表读写（世界树画布视图层，阶段 3 §5）。
 * 坐标与故事内容完全解耦：删除整张表不影响任何故事。
 * 非 Tauri 环境（单测）自动降级为空操作。
 */
const IS_TAURI = typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

export interface NodePos {
  x: number;
  y: number;
}

export type LayoutMap = Record<string, NodePos>;

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

/** 读取某故事的全部节点坐标 */
export async function loadTreeLayout(storyId: string): Promise<LayoutMap> {
  if (!IS_TAURI) return {};
  const db = await getClient();
  const rows = await db.select<{ node_id: string; x: number; y: number }>(
    'SELECT node_id, x, y FROM tree_layout WHERE story_id = $1',
    [storyId],
  );
  const map: LayoutMap = {};
  for (const r of rows) map[r.node_id] = { x: r.x, y: r.y };
  return map;
}

/** 保存（upsert）单个节点坐标；用户拖动过即记住 */
export async function saveNodePos(storyId: string, nodeId: string, pos: NodePos): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute(
    'INSERT OR REPLACE INTO tree_layout (story_id, node_id, x, y) VALUES ($1, $2, $3, $4)',
    [storyId, nodeId, pos.x, pos.y],
  );
}

/** 一键整理：清空该故事的自定义坐标，恢复自动布局 */
export async function clearTreeLayout(storyId: string): Promise<void> {
  if (!IS_TAURI) return;
  const db = await getClient();
  await db.execute('DELETE FROM tree_layout WHERE story_id = $1', [storyId]);
}
