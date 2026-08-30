/**
 * 平行世界故事树。
 *
 * 结构：每个节点保存一段被采纳的正文 + 当次生成的全部候选（含未选中的）。
 * 采纳 = 从当前节点生长出新节点；撤回 = 指针回移（节点不删除）。
 * 撤销/重做 = 指针历史栈移动，与平行世界树共用同一数据源。
 */

export type NodeSource = 'user' | 'ai';

export interface Candidate {
  id: string;
  text: string;
  createdAt: number;
}

export interface StoryNode {
  id: string;
  parentId: string | null;
  /** 该节点被采纳的正文段 */
  text: string;
  /** 当次生成的全部候选（含未选中的） */
  candidates: Candidate[];
  chosenCandidateId: string | null;
  source: NodeSource;
  createdAt: number;
}

export interface StoryTree {
  nodes: Record<string, StoryNode>;
  rootId: string;
  /** 当前指针：新内容将生长在这个节点之后 */
  currentId: string;
  /** 指针历史（用于撤销/重做），记录的是每一次"当前指针"的落点 */
  history: string[];
  historyIndex: number;
}

let idCounter = 0;

export function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** 创建一棵故事树，根节点为用户输入的故事开头 */
export function createTree(rootText: string): StoryTree {
  const rootId = genId('n');
  const node: StoryNode = {
    id: rootId,
    parentId: null,
    text: rootText,
    candidates: [],
    chosenCandidateId: null,
    source: 'user',
    createdAt: Date.now(),
  };
  return {
    nodes: { [rootId]: node },
    rootId,
    currentId: rootId,
    history: [rootId],
    historyIndex: 0,
  };
}

/** 从根到当前指针的节点序列 */
export function timeline(tree: StoryTree): StoryNode[] {
  const path: StoryNode[] = [];
  let cur: string | null = tree.currentId;
  while (cur) {
    const node: StoryNode | undefined = tree.nodes[cur];
    if (!node) break;
    path.unshift(node);
    cur = node.parentId;
  }
  return path;
}

/** 当前时间线正文（root 到 current 的全部 text 拼接） */
export function fullText(tree: StoryTree): string {
  return timeline(tree)
    .map((n) => n.text)
    .join('');
}

/** 在当前指针后生长一个 AI 节点（含全部候选与被选中者） */
export function growWithCandidates(
  tree: StoryTree,
  candidates: Candidate[],
  chosenIndex: number,
): StoryNode {
  if (candidates.length === 0) throw new Error('growWithCandidates: 候选为空');
  const chosen = candidates[Math.min(Math.max(chosenIndex, 0), candidates.length - 1)];
  const id = genId('n');
  const node: StoryNode = {
    id,
    parentId: tree.currentId,
    text: chosen.text,
    candidates,
    chosenCandidateId: chosen.id,
    source: 'ai',
    createdAt: Date.now(),
  };
  tree.nodes[id] = node;
  moveTo(tree, id);
  return node;
}

/** 用户手写内容追加为新的 user 节点 */
export function appendUserText(tree: StoryTree, text: string): StoryNode {
  const id = genId('n');
  const node: StoryNode = {
    id,
    parentId: tree.currentId,
    text,
    candidates: [],
    chosenCandidateId: null,
    source: 'user',
    createdAt: Date.now(),
  };
  tree.nodes[id] = node;
  moveTo(tree, id);
  return node;
}

/** 在当前节点上切换被采纳的候选（不改树结构，仅改该节点的采纳） */
export function switchCandidate(tree: StoryTree, candidateId: string): StoryNode {
  const node = tree.nodes[tree.currentId];
  if (!node) throw new Error('switchCandidate: 当前节点不存在');
  const c = node.candidates.find((x) => x.id === candidateId);
  if (!c) throw new Error(`switchCandidate: 候选 ${candidateId} 不在当前节点上`);
  node.chosenCandidateId = candidateId;
  node.text = c.text;
  return node;
}

/** 平行世界"穿越"：把当前指针移动到树上任意节点 */
export function moveTo(tree: StoryTree, nodeId: string): void {
  if (!tree.nodes[nodeId]) throw new Error(`moveTo: 节点 ${nodeId} 不存在`);
  tree.currentId = nodeId;
  // 截断"未来"历史并追加新落点
  tree.history = tree.history.slice(0, tree.historyIndex + 1);
  if (tree.history[tree.history.length - 1] !== nodeId) {
    tree.history.push(nodeId);
    tree.historyIndex = tree.history.length - 1;
  }
}

/** 撤销：指针沿历史回退一步。返回是否发生了移动 */
export function undo(tree: StoryTree): boolean {
  if (tree.historyIndex <= 0) return false;
  tree.historyIndex -= 1;
  tree.currentId = tree.history[tree.historyIndex];
  return true;
}

/** 重做：指针沿历史前进一步。返回是否发生了移动 */
export function redo(tree: StoryTree): boolean {
  if (tree.historyIndex >= tree.history.length - 1) return false;
  tree.historyIndex += 1;
  tree.currentId = tree.history[tree.historyIndex];
  return true;
}

/** 当前节点信息（供候选卡片渲染） */
export function currentNode(tree: StoryTree): StoryNode | undefined {
  return tree.nodes[tree.currentId];
}

/** 序列化（持久化 / 导出 JSON） */
export function serialize(tree: StoryTree): string {
  return JSON.stringify(tree);
}

/** 反序列化（含最小结构校验 + 原型污染防护） */
export function deserialize(raw: string): StoryTree {
  const t = JSON.parse(raw) as StoryTree;
  if (!t || typeof t !== 'object' || !t.nodes || !t.rootId || !t.currentId) {
    throw new Error('deserialize: 结构不合法');
  }
  if (typeof t.nodes !== 'object' || Array.isArray(t.nodes)) {
    throw new Error('deserialize: nodes 不合法');
  }
  // 原型污染防护：nodes 的键必须是自有可枚举属性，且拒绝危险键名
  for (const key of Object.keys(t.nodes)) {
    if (!Object.prototype.hasOwnProperty.call(t.nodes, key)) {
      throw new Error('deserialize: nodes 含非自有属性');
    }
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error('deserialize: 危险节点键名');
    }
  }
  if (!t.nodes[t.rootId] || !t.nodes[t.currentId]) {
    throw new Error('deserialize: rootId/currentId 指向不存在的节点');
  }
  return t;
}

/** 从任意节点重建子树完整文本（平行世界视图预览用） */
export function textAt(tree: StoryTree, nodeId: string): string {
  const saved = tree.currentId;
  try {
    // 临时借用 timeline 的父链回溯逻辑
    const path: StoryNode[] = [];
    let cur: string | null = nodeId;
    while (cur) {
      const node: StoryNode | undefined = tree.nodes[cur];
      if (!node) break;
      path.unshift(node);
      cur = node.parentId;
    }
    return path.map((n) => n.text).join('');
  } finally {
    tree.currentId = saved;
  }
}
