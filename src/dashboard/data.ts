/**
 * 功能 B · 仪表盘数据层（复用平行世界树，只读 + 轻操作）。
 * 输出历史 = 每次生成轮次的全部候选快照（含被换一批淘汰的）。
 * 注意：历史记录只来自"本次会话内存 + SQLite 树快照回放"，不建第二套持久日志——
 *      从当前故事树上每个 AI 节点的 candidates 回放即可还原全部历史。
 */

import type { StoryTree } from '../worldtree/tree';
import type { Candidate } from '../worldtree/tree';

export interface HistoryEntry {
  /** 对应树节点 id（回退定位用） */
  nodeId: string;
  /** 该轮全部候选（按生成顺序） */
  candidates: Candidate[];
  /** 被采纳的候选 id（可能为 null） */
  chosenId: string | null;
  createdAt: number;
}

/** 从树回放全部 AI 轮次（按时间正序） */
export function replayHistory(tree: StoryTree): HistoryEntry[] {
  return Object.values(tree.nodes)
    .filter((n) => n.source === 'ai' && n.candidates.length > 0)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((n) => ({
      nodeId: n.id,
      candidates: [...n.candidates],
      chosenId: n.chosenCandidateId,
      createdAt: n.createdAt,
    }));
}

/** 统计：当前故事 */
export function storyStats(tree: StoryTree): { chars: number; genRounds: number } {
  let chars = 0;
  let genRounds = 0;
  for (const n of Object.values(tree.nodes)) {
    chars += n.text.length;
    if (n.source === 'ai') genRounds += 1;
  }
  return { chars, genRounds };
}

/** 统计：全部故事汇总（传入各故事的树） */
export function aggregateStats(trees: StoryTree[]): { totalChars: number; totalRounds: number; totalStories: number } {
  let totalChars = 0;
  let totalRounds = 0;
  for (const t of trees) {
    const s = storyStats(t);
    totalChars += s.chars;
    totalRounds += s.genRounds;
  }
  return { totalChars, totalRounds, totalStories: trees.length };
}
