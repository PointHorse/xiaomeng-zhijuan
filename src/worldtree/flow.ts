/**
 * 世界树 → xyflow 数据映射（纯函数，阶段 3 §5）。
 * 画布只是世界树数据之上的视图层：本模块不修改 tree 不变量。
 */
import type { Edge, Node } from '@xyflow/react';
import dagre from 'dagre';
import { timeline, type StoryTree } from './tree';
import type { LayoutMap } from './layoutStore';

export type NodeState = 'adopted' | 'cand' | 'discarded';

export interface WcNodeData extends Record<string, unknown> {
  no: number;
  text: string;
  chars: number;
  state: NodeState;
  isCurrent: boolean;
  childCount: number;
  /** 该节点是否处于折叠态（显示 +N 角标） */
  folded: boolean;
  /** 折叠隐藏的后代数 */
  hiddenCount: number;
}

/**
 * 真实节点状态：根→当前主干 = 已采纳；不在主干 = 已淘汰（历史主干/旁支，
 * 它们曾有采纳后代，现被换一批/回退弃用）。「未采纳候选」由 buildFlow 生成的
 * 虚拟画布节点承载（来自 node.candidates，不改树数据模型）。
 */
export function buildStates(tree: StoryTree): Record<string, NodeState> {
  const states: Record<string, NodeState> = {};
  for (const n of timeline(tree)) states[n.id] = 'adopted';
  for (const n of Object.values(tree.nodes)) {
    if (!states[n.id]) states[n.id] = 'discarded';
  }
  return states;
}

/** 序号映射（#1 根，按创建顺序） */
export function buildOrdering(tree: StoryTree): Record<string, number> {
  const ids = Object.keys(tree.nodes).sort(
    (a, b) => tree.nodes[a].createdAt - tree.nodes[b].createdAt,
  );
  const order: Record<string, number> = {};
  ids.forEach((id, i) => (order[id] = i + 1));
  return order;
}

export interface BuildFlowOptions {
  layout: LayoutMap;
  collapsed: Set<string>;
  states?: Record<string, NodeState>;
  ordering?: Record<string, number>;
}

/** 折叠：被折叠节点的全部后代（不含自身） */
export function hiddenByCollapse(tree: StoryTree, collapsed: Set<string>): Set<string> {
  const hidden = new Set<string>();
  const walk = (id: string): void => {
    for (const cid of descendantsOf(tree, id)) {
      hidden.add(cid);
      walk(cid);
    }
  };
  for (const id of collapsed) walk(id);
  return hidden;
}

function childrenOf(tree: StoryTree, id: string): string[] {
  return Object.values(tree.nodes)
    .filter((n) => n.parentId === id)
    .map((n) => n.id);
}

function descendantsOf(tree: StoryTree, id: string): string[] {
  const out: string[] = [];
  for (const cid of childrenOf(tree, id)) {
    out.push(cid);
    out.push(...descendantsOf(tree, cid));
  }
  return out;
}

/** 可见节点集合（排除折叠后代）与折叠角标计数 */
export function visibility(tree: StoryTree, collapsed: Set<string>): { visible: Set<string>; badge: Record<string, number> } {
  const visible = new Set<string>();
  const badge: Record<string, number> = {};
  const walk = (id: string): void => {
    visible.add(id);
    if (collapsed.has(id)) {
      badge[id] = descendantsOf(tree, id).length;
      return; // 折叠者不再向下展开
    }
    for (const cid of childrenOf(tree, id)) walk(cid);
  };
  walk(tree.rootId);
  return { visible, badge };
}

/** tree → xyflow nodes/edges；坐标：layout 优先，缺省由 dagre 分层（调用方传入已算好的坐标） */
export function buildFlow(
  tree: StoryTree,
  opts: BuildFlowOptions & { positions: LayoutMap },
): { nodes: Node<WcNodeData>[]; edges: Edge[] } {
  const states = opts.states ?? buildStates(tree);
  const ordering = opts.ordering ?? buildOrdering(tree);
  const { visible, badge } = visibility(tree, opts.collapsed);

  const nodes: Node<WcNodeData>[] = [];
  for (const n of Object.values(tree.nodes)) {
    if (!visible.has(n.id)) continue;
    const pos = opts.positions[n.id] ?? opts.layout[n.id] ?? { x: 0, y: 0 };
    nodes.push({
      id: n.id,
      type: 'wc',
      position: { x: pos.x, y: pos.y },
      data: {
        no: ordering[n.id] ?? 0,
        text: n.text,
        chars: n.text.length,
        state: states[n.id] ?? 'discarded',
        isCurrent: n.id === tree.currentId,
        childCount: childrenOf(tree, n.id).length,
        folded: opts.collapsed.has(n.id),
        hiddenCount: badge[n.id] ?? 0,
      },
    });
    // 未采纳候选 → 虚拟画布节点（浅粉/淘汰灰），挂在产生它的节点右侧
    for (const c of n.candidates) {
      if (c.id === n.chosenCandidateId && states[n.id] === 'adopted') continue;
      const vid = `v-${n.id}-${c.id}`;
      const vstate: NodeState = states[n.id] === 'adopted' ? 'cand' : 'discarded';
      nodes.push({
        id: vid,
        type: 'wc',
        position: { x: pos.x + 210, y: pos.y + 10 },
        data: {
          no: ordering[n.id] ?? 0,
          text: c.text,
          chars: c.text.length,
          state: vstate,
          isCurrent: false,
          childCount: 0,
          folded: false,
          hiddenCount: 0,
        },
      });
    }
  }

  const edges: Edge[] = [];
  for (const n of Object.values(tree.nodes)) {
    if (!n.parentId || !visible.has(n.id) || !visible.has(n.parentId)) continue;
    const hot = states[n.id] === 'adopted' && states[n.parentId] === 'adopted' && visible.has(tree.currentId);
    // 主干高亮：父与子都为主干（adopted）——但历史采纳过的旁支也会是 adopted？
    // buildStates 只把"根→当前"标 adopted，历史旁支在 states 中为 cand/discarded，正确。
    edges.push({
      id: `e-${n.parentId}-${n.id}`,
      source: n.parentId,
      target: n.id,
      type: 'default',
      animated: hot,
      style: hot ? { stroke: 'var(--brand)', strokeWidth: 2.5 } : { stroke: 'var(--gray-2)', strokeWidth: 2 },
    });
  }
  return { nodes, edges };
}

/** dagre 自动布局：根在上，分支向下展开（仅对无自定义坐标的节点生效） */
export function dagreLayout(tree: StoryTree, nodeSize: { w: number; h: number }): LayoutMap {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 130, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of Object.values(tree.nodes)) g.setNode(n.id, { width: nodeSize.w, height: nodeSize.h });
  for (const n of Object.values(tree.nodes)) {
    if (n.parentId) g.setEdge(n.parentId, n.id);
  }
  dagre.layout(g);
  const map: LayoutMap = {};
  for (const n of Object.values(tree.nodes)) {
    const pos = g.node(n.id);
    if (pos) map[n.id] = { x: pos.x - nodeSize.w / 2, y: pos.y - nodeSize.h / 2 };
  }
  return map;
}
