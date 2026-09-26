/**
 * 世界树画布纯函数测试（阶段 3 §5）：
 * flow 映射（状态/折叠/高亮路径）、手势判定（双击/长按）、dagre 布局。
 */
import { describe, it, expect } from 'vitest';
import {
  buildStates,
  buildOrdering,
  buildFlow,
  visibility,
  dagreLayout,
} from './flow';
import { isDoubleTap, isLongPress, makeStressTree } from './WorldTreeCanvas';
import { growWithCandidates, createTree, moveTo, type Candidate } from './tree';

function cand(text: string, id: string): Candidate {
  return { id, text, createdAt: Date.now() };
}

/** 构造一棵 3 层测试树：根 → 采纳A → 采纳B；A 有 1 个未采纳兄弟，B 下有淘汰轮 */
function sampleTree() {
  const t = createTree('根：夜深了。');
  const a = growWithCandidates(t, [cand('A 被采纳', 'ca1'), cand('A 未采纳', 'ca2')], 0);
  // 旁支：沿 A 写过一段后又回退（历史主干 → discarded 态）
  const side = growWithCandidates(t, [cand('S 旁支', 'cs1')], 0);
  moveTo(t, a.id);
  const b = growWithCandidates(t, [cand('B 被采纳', 'cb1')], 0);
  const w = growWithCandidates(t, [cand('W1', 'cw1'), cand('W2', 'cw2')], 0);
  void side; void b; void w;
  return t;
}

describe('buildStates 状态映射', () => {
  it('主干（根→当前）= 已采纳；历史主干/旁支真实节点 = 已淘汰', () => {
    const t = sampleTree();
    const states = buildStates(t);
    expect(states[t.rootId]).toBe('adopted');
    expect(states[t.currentId]).toBe('adopted');
    // 非主干的真实节点 = discarded（曾有采纳后代，现被弃用）
    for (const n of Object.values(t.nodes)) {
      if (states[n.id] !== 'adopted') expect(states[n.id]).toBe('discarded');
    }
  });

  it('未采纳候选 → 虚拟画布节点（浅粉；非主干节点的候选 = 淘汰灰）', () => {
    const t = sampleTree();
    const states = buildStates(t);
    const ordering = buildOrdering(t);
    const flow = buildFlow(t, { positions: {}, layout: {}, collapsed: new Set(), states, ordering });
    const vids = flow.nodes.filter((n) => n.id.startsWith('v-'));
    expect(vids.length).toBeGreaterThan(0);
    for (const v of vids) {
      const state = (v.data as { state: string }).state;
      expect(['cand', 'discarded']).toContain(state);
    }
  });
});

describe('visibility 折叠', () => {
  it('折叠节点隐藏全部后代并产出 +N 角标', () => {
    const t = sampleTree();
    const a = Object.values(t.nodes).find((n) => n.text === 'A 被采纳')!;
    const { visible, badge } = visibility(t, new Set([a.id]));
    const child = Object.values(t.nodes).find((n) => n.parentId === a.id)!;
    expect(visible.has(a.id)).toBe(true);        // 自身可见
    expect(visible.has(child.id)).toBe(false);   // 后代隐藏
    expect(badge[a.id]).toBeGreaterThan(0);      // +N
  });
});

describe('buildFlow', () => {
  it('连线高亮：主干边 animated，旁支边灰色', () => {
    const t = sampleTree();
    const states = buildStates(t);
    const flow = buildFlow(t, { positions: {}, layout: {}, collapsed: new Set(), states, ordering: buildOrdering(t) });
    const hot = flow.edges.filter((e) => e.animated);
    expect(hot.length).toBe(3);                  // 根→A→B→W 主干
    const norm = flow.edges.filter((e) => !e.animated);
    expect(norm.length).toBeGreaterThan(0);      // S 旁支 + 未采纳候选虚线边
  });

  it('折叠后：隐藏节点不出现在 flow 中，边随之裁剪', () => {
    const t = sampleTree();
    const a = Object.values(t.nodes).find((n) => n.text === 'A 被采纳')!;
    const states = buildStates(t);
    const flow = buildFlow(t, { positions: {}, layout: {}, collapsed: new Set([a.id]), states, ordering: buildOrdering(t) });
    const ids = new Set(flow.nodes.map((n) => n.id));
    expect(ids.has(a.id)).toBe(true);
    const child = Object.values(t.nodes).find((n) => n.parentId === a.id)!;
    expect(ids.has(child.id)).toBe(false);
    expect(flow.edges.some((e) => e.source === a.id)).toBe(false);
  });
});

describe('dagreLayout', () => {
  it('根在上，子代 y 递增；坐标合法', () => {
    const t = sampleTree();
    const map = dagreLayout(t, { w: 170, h: 78 });
    const rootY = map[t.rootId].y;
    for (const n of Object.values(t.nodes)) {
      if (n.parentId === t.rootId) expect(map[n.id].y).toBeGreaterThan(rootY);
    }
  });
});

describe('手势纯函数', () => {
  it('双击判定：300ms 内且位移小', () => {
    expect(isDoubleTap(200, { t: 100, x: 5, y: 5 }, 8, 8)).toBe(true);
    expect(isDoubleTap(400, { t: 100, x: 5, y: 5 }, 8, 8)).toBe(false);
    expect(isDoubleTap(200, { t: 100, x: 5, y: 5 }, 500, 500)).toBe(false);
    expect(isDoubleTap(200, null, 8, 8)).toBe(false);
  });
  it('长按判定：≥300ms 且未移动', () => {
    expect(isLongPress(300, 0)).toBe(true);
    expect(isLongPress(500, 3)).toBe(true);
    expect(isLongPress(299, 0)).toBe(false);
    expect(isLongPress(500, 10)).toBe(false);
  });
});

describe('makeStressTree 压测树', () => {
  it('500 节点结构完整（parentId 指向存在节点）', () => {
    const t = makeStressTree(500);
    expect(Object.keys(t.nodes).length).toBe(501);
    for (const n of Object.values(t.nodes)) {
      if (n.parentId) expect(t.nodes[n.parentId]).toBeDefined();
    }
    expect(t.currentId).toBe('s500');
  });

  it('500 节点 flow 构建（含候选虚拟节点）在可接受时间内（性能护栏）', () => {
    const t = makeStressTree(500);
    const states = buildStates(t);
    // 期望节点 = 真实节点 + 每个节点的未采纳候选（adopted 节点排除其 chosen 候选）
    let virtual = 0;
    for (const n of Object.values(t.nodes)) {
      virtual += n.candidates.filter((c) => !(c.id === n.chosenCandidateId && states[n.id] === 'adopted')).length;
    }
    const t0 = performance.now();
    const flow = buildFlow(t, { positions: {}, layout: {}, collapsed: new Set(), states, ordering: buildOrdering(t) });
    const ms = performance.now() - t0;
    expect(flow.nodes.length).toBe(501 + virtual);
    expect(flow.edges.length).toBe(500 + virtual);
    expect(ms).toBeLessThan(500); // 纯映射应在毫秒级，500ms 为护栏上限
  });
});

describe('moveTo 回溯语义', () => {
  it('回溯到祖先节点不破坏树结构', () => {
    const t = sampleTree();
    const a = Object.values(t.nodes).find((n) => n.text === 'A 被采纳')!;
    const before = Object.keys(t.nodes).length;
    moveTo(t, a.id);
    expect(Object.keys(t.nodes).length).toBe(before); // 节点不删
    expect(t.currentId).toBe(a.id);
  });
});
