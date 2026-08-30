import { describe, it, expect } from 'vitest';
import {
  createTree,
  timeline,
  fullText,
  growWithCandidates,
  appendUserText,
  switchCandidate,
  moveTo,
  undo,
  redo,
  currentNode,
  serialize,
  deserialize,
  textAt,
  type Candidate,
} from './tree';

function cand(text: string, id?: string): Candidate {
  return { id: id ?? `c_${text.slice(0, 6)}`, text, createdAt: Date.now() };
}

describe('故事树（平行世界）', () => {
  it('createTree: 根节点为用户输入，指针指向根', () => {
    const t = createTree('从前有座山。');
    expect(t.rootId).toBe(t.currentId);
    expect(fullText(t)).toBe('从前有座山。');
    expect(timeline(t)).toHaveLength(1);
  });

  it('growWithCandidates: 采纳第一条并保留全部候选', () => {
    const t = createTree('开头。');
    const node = growWithCandidates(t, [cand('候选甲', 'c1'), cand('候选乙', 'c2'), cand('候选丙', 'c3')], 0);
    expect(node.text).toBe('候选甲');
    expect(node.candidates).toHaveLength(3);
    expect(node.chosenCandidateId).toBe('c1');
    expect(t.currentId).toBe(node.id);
    expect(fullText(t)).toBe('开头。候选甲');
  });

  it('switchCandidate: 当前节点换选另一候选，正文随之替换', () => {
    const t = createTree('开头。');
    growWithCandidates(t, [cand('甲', 'c1'), cand('乙', 'c2')], 0);
    switchCandidate(t, 'c2');
    expect(currentNode(t)?.text).toBe('乙');
    expect(fullText(t)).toBe('开头。乙');
  });

  it('switchCandidate: 换不存在的候选要抛错', () => {
    const t = createTree('开头。');
    growWithCandidates(t, [cand('甲', 'c1')], 0);
    expect(() => switchCandidate(t, 'nope')).toThrow();
  });

  it('平行世界：从更早节点长出新分支，原分支完整保留', () => {
    const t = createTree('根');
    growWithCandidates(t, [cand('第一轮')], 0); // 节点 A
    const firstBranchLeaf = t.currentId;
    growWithCandidates(t, [cand('第二轮-主线')], 0); // 节点 B

    // 穿越回第一轮，长出另一个世界
    moveTo(t, firstBranchLeaf);
    growWithCandidates(t, [cand('第二轮-平行世界')], 0); // 节点 C

    expect(fullText(t)).toBe('根第一轮第二轮-平行世界');
    // 主线分支仍在树里
    expect(t.nodes[firstBranchLeaf].candidates[0].text).toBe('第一轮');
    const mainLeaf = t.nodes[firstBranchLeaf].candidates; // 保证结构存在
    expect(mainLeaf.length).toBeGreaterThan(0);
    // 节点 B 依旧存在且文本不变
    const nodeB = Object.values(t.nodes).find((n) => n.text === '第二轮-主线');
    expect(nodeB).toBeDefined();
  });

  it('moveTo: 穿越后时间线正确', () => {
    const t = createTree('A');
    growWithCandidates(t, [cand('B')], 0);
    const nodeB = t.currentId;
    growWithCandidates(t, [cand('C')], 0);
    moveTo(t, nodeB);
    expect(fullText(t)).toBe('AB');
  });

  it('undo/redo: 基于指针历史，永不与树结构冲突', () => {
    const t = createTree('A');
    growWithCandidates(t, [cand('B')], 0);
    growWithCandidates(t, [cand('C')], 0);
    expect(fullText(t)).toBe('ABC');
    expect(undo(t)).toBe(true);
    expect(fullText(t)).toBe('AB');
    expect(undo(t)).toBe(true);
    expect(fullText(t)).toBe('A');
    expect(undo(t)).toBe(false); // 已到根
    expect(redo(t)).toBe(true);
    expect(fullText(t)).toBe('AB');
    expect(redo(t)).toBe(true);
    expect(fullText(t)).toBe('ABC');
    expect(redo(t)).toBe(false);
  });

  it('undo 后走新分支：历史"未来"被截断', () => {
    const t = createTree('A');
    growWithCandidates(t, [cand('B')], 0);
    undo(t); // 回到 A
    appendUserText(t, '新方向');
    expect(fullText(t)).toBe('A新方向');
    expect(redo(t)).toBe(false); // 旧未来已截断
  });

  it('appendUserText: 用户手写内容成为新节点', () => {
    const t = createTree('A');
    const n = appendUserText(t, '手写的一段');
    expect(n.source).toBe('user');
    expect(fullText(t)).toBe('A手写的一段');
  });

  it('serialize/deserialize: 往返一致', () => {
    const t = createTree('A');
    growWithCandidates(t, [cand('B1', 'cb1'), cand('B2', 'cb2')], 1);
    const raw = serialize(t);
    const t2 = deserialize(raw);
    expect(fullText(t2)).toBe(fullText(t));
    expect(t2.currentId).toBe(t.currentId);
    expect(currentNode(t2)?.candidates).toHaveLength(2);
  });

  it('deserialize: 拒绝非法结构', () => {
    expect(() => deserialize('null')).toThrow();
    expect(() => deserialize('{"nodes":{}}')).toThrow();
  });

  it('textAt: 任意节点的完整文本，不影响当前指针', () => {
    const t = createTree('A');
    growWithCandidates(t, [cand('B')], 0);
    const nodeC = growWithCandidates(t, [cand('C')], 0);
    const before = t.currentId; // 指针此刻在 C
    expect(textAt(t, nodeC.id)).toBe('ABC');
    expect(t.currentId).toBe(before); // textAt 不移动指针
  });
});
