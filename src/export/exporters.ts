/**
 * 导出：JSON（整棵故事树，备份/迁移）与 TXT（仅当前时间线正文）。
 * 纯函数，文件写入由 Tauri 侧完成。
 */
import type { StoryTree } from '../worldtree/tree';
import { fullText, timeline, serialize } from '../worldtree/tree';

export interface StoryExport {
  app: 'xiaomeng-zhijuan';
  version: 1;
  exportedAt: string;
  title: string;
  tree: StoryTree;
}

export function buildJsonExport(title: string, tree: StoryTree): string {
  const payload: StoryExport = {
    app: 'xiaomeng-zhijuan',
    version: 1,
    exportedAt: new Date().toISOString(),
    title,
    tree,
  };
  return JSON.stringify(payload, null, 2);
}

export function buildTxtExport(title: string, tree: StoryTree): string {
  const nodes = timeline(tree);
  const body = fullText(tree);
  const head = `${title}\n${'='.repeat(Math.max(4, title.length * 2))}\n\n`;
  const meta = `\n\n—— ${nodes.length} 个节点 · 导出于 ${new Date().toLocaleString('zh-CN')} ——\n`;
  return head + body + meta;
}

/** 导入 JSON（容错校验） */
export function parseJsonExport(raw: string): { title: string; tree: StoryTree } {
  const obj = JSON.parse(raw) as Partial<StoryExport> & { tree?: StoryTree };
  if (!obj || obj.app !== 'xiaomeng-zhijuan' || !obj.tree || typeof obj.title !== 'string') {
    throw new Error('不是有效的小梦织卷导出文件');
  }
  // 反序列化做二次校验
  serializeRoundtrip(obj.tree);
  return { title: obj.title, tree: obj.tree };
}

function serializeRoundtrip(tree: StoryTree): StoryTree {
  return JSON.parse(serialize(tree)) as StoryTree;
}
