import { describe, it, expect } from 'vitest';
import { createTree, growWithCandidates, moveTo } from '../worldtree/tree';
import { replayHistory, storyStats, aggregateStats } from './data';

function buildTree() {
  const t = createTree('开头一段。');
  growWithCandidates(t, [
    { id: 'r1a', text: '主线一', createdAt: 100 },
    { id: 'r1b', text: '淘汰一', createdAt: 100 },
  ], 0);
  growWithCandidates(t, [
    { id: 'r2a', text: '主线二', createdAt: 200 },
  ], 0);
  // 从第一轮回溯再开分支（换一批的淘汰场景）
  moveTo(t, t.nodes[t.currentId].parentId ?? t.rootId);
  growWithCandidates(t, [{ id: 'r1c', text: '换一批后的新主线', createdAt: 300 }], 0);
  return t;
}

describe('仪表盘数据层（复用树回放）', () => {
  it('replayHistory: 回放全部 AI 轮次（含被淘汰的候选）', () => {
    const t = buildTree();
    const hist = replayHistory(t);
    // 三个 AI 节点：主线一、主线二、换一批后的新主线
    expect(hist).toHaveLength(3);
    expect(hist[0].candidates.map((c) => c.text)).toEqual(['主线一', '淘汰一']);
    expect(hist[0].chosenId).toBe('r1a');
    expect(hist[2].candidates.map((c) => c.text)).toEqual(['换一批后的新主线']);
  });

  it('replayHistory: 按时间倒序需求由 UI 层 reverse，数据层保持正序', () => {
    const hist = replayHistory(buildTree());
    const times = hist.map((h) => h.createdAt);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('storyStats: 字数与轮次', () => {
    const s = storyStats(buildTree());
    expect(s.genRounds).toBe(3);
    expect(s.chars).toBeGreaterThan(0);
  });

  it('aggregateStats: 多故事汇总', () => {
    const a = createTree('甲');
    growWithCandidates(a, [{ id: 'x', text: '甲续', createdAt: 1 }], 0);
    const b = createTree('乙乙');
    const agg = aggregateStats([a, b]);
    expect(agg.totalStories).toBe(2);
    expect(agg.totalChars).toBe(5); // 甲(1) + 甲续(2) + 乙乙(2)
    expect(agg.totalRounds).toBe(1);
  });

  it('空树：零值安全', () => {
    expect(storyStats(createTree('')).genRounds).toBe(0);
    expect(replayHistory(createTree('only-root'))).toHaveLength(0);
  });
});
