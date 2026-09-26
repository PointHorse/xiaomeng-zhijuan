/**
 * 世界树节点画布（阶段 3 §5 正式版）——ComfyUI 式视觉，@xyflow/react 视图层。
 * 只读于 worldtree 数据模型（不改树不变量）；用户拖动的坐标存 tree_layout（可删表）。
 * 性能：onlyRenderVisibleElements；节点与连线零 blur/backdrop-filter。
 * 手势：xyflow 平移/缩放（0.2–2）/节点拖动；轻点=预览、长按(contextmenu)=操作层、
 *       双击空白=自适应、按住 300ms=触感反馈（isLongPress 纯函数可测）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../store/useStore';
import { timeline, moveTo, type StoryTree, type StoryNode } from './tree';
import { buildFlow, buildOrdering, buildStates, dagreLayout, WcNodeData } from './flow';
import { clearTreeLayout, loadTreeLayout, saveNodePos } from './layoutStore';
import { BottomSheet } from '../mobile/components/BottomSheet';
import { Button } from '../mobile/components/Button';
import { haptic } from '../mobile/components/useHaptics';
import { useT } from '../i18n/useI18n';

/** 按住 300ms 触感反馈（isLongPress 判定；由节点卡片自身 mouse 事件驱动） */
function usePressHaptic(): { onMouseDown: () => void; onMouseUp: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = (): void => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onMouseDown: () => {
      stop();
      timer.current = setTimeout(() => {
        timer.current = null;
        void haptic('light');
      }, 300);
    },
    onMouseUp: stop,
  };
}

const NODE_W = 170;
const NODE_H = 78;

/* ---------- 节点卡片 ---------- */
function WcNodeCard({ data }: NodeProps<Node<WcNodeData>>): JSX.Element {
  const { no, text, chars, state, isCurrent, childCount, folded, hiddenCount } = data;
  const press = usePressHaptic();
  const stateLabel = state === 'adopted' ? '已采纳' : state === 'cand' ? '未采纳候选' : '已淘汰';
  return (
    <div
      className={`wcnode wcnode--${state} ${isCurrent ? 'wcnode--current' : ''} ${folded ? 'wcnode--folded' : ''}`}
      onMouseDown={press.onMouseDown}
      onMouseUp={press.onMouseUp}
      onMouseLeave={press.onMouseUp}
    >
      <button type="button" className="wcnode-fold" aria-label={folded ? '展开子树' : '折叠子树'} data-fold="1">
        {folded ? '+' : '−'}
      </button>
      {folded && hiddenCount > 0 && <span className="wcnode-badge">+{hiddenCount}</span>}
      <span className="wcnode-no">#{no}</span>
      {isCurrent && <span className="wcnode-cur">● 当前</span>}
      <span className="wcnode-txt">
        {text.slice(0, 14)}
        {text.length > 14 ? '…' : ''}
      </span>
      <span className="wcnode-meta">
        {chars} 字 · {stateLabel}
        {childCount > 0 ? ` · ${childCount} 分支` : ''}
      </span>
    </div>
  );
}
const nodeTypes = { wc: WcNodeCard };

/* ---------- 手势纯函数（测试覆盖） ---------- */
/** 双击判定：300ms 内、位移 <20px */
export function isDoubleTap(now: number, last: { t: number; x: number; y: number } | null, x: number, y: number): boolean {
  return last !== null && now - last.t < 300 && Math.hypot(x - last.x, y - last.y) < 20;
}
/** 长按判定：按住 ≥300ms 且位移 <4px */
export function isLongPress(elapsedMs: number, movedPx: number): boolean {
  return elapsedMs >= 300 && movedPx < 4;
}

/* ---------- 压测树（500+ 节点，纯内存不影响真实故事） ---------- */
export function makeStressTree(count: number): StoryTree {
  const nodes: StoryTree['nodes'] = {};
  nodes['s0'] = { id: 's0', parentId: null, text: '压测根节点', candidates: [], chosenCandidateId: null, source: 'user', createdAt: 0 };
  for (let i = 1; i <= count; i++) {
    nodes[`s${i}`] = {
      id: `s${i}`,
      parentId: `s${Math.max(0, Math.floor((i - 1) * 0.985))}`,
      text: `压测节点 ${i}：夜风掠过高粱地，叶子沙沙作响，像谁在暗处数着拍子。`,
      candidates: [],
      chosenCandidateId: null,
      source: 'ai',
      createdAt: i,
    };
  }
  return { nodes, rootId: 's0', currentId: `s${count}`, history: ['s0'], historyIndex: 0 };
}

/* ---------- 内部画布 ---------- */
function CanvasInner(): JSX.Element {
  const tree = useStore((s) => s.tree);
  const storyId = useStore((s) => s.storyId);
  const setView = useStore((s) => s.setView);
  const t = useT();
  const { fitView } = useReactFlow();

  const [customLayout, setCustomLayout] = useState<Record<string, { x: number; y: number }>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [actionNodeId, setActionNodeId] = useState<string | null>(null);
  const [stressCount, setStressCount] = useState(0);
  const suppressClick = useRef(false);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sourceTree = useMemo(() => (stressCount > 0 ? makeStressTree(stressCount) : tree), [stressCount, tree]);
  const states = useMemo(() => buildStates(sourceTree), [sourceTree]);
  const ordering = useMemo(() => buildOrdering(sourceTree), [sourceTree]);

  const positions = useMemo(() => {
    const auto = dagreLayout(sourceTree, { w: NODE_W, h: NODE_H });
    for (const id of Object.keys(customLayout)) {
      if (sourceTree.nodes[id]) auto[id] = customLayout[id];
    }
    return auto;
  }, [sourceTree, customLayout]);

  const flow = useMemo(
    () => buildFlow(sourceTree, { positions, layout: {}, collapsed, states, ordering }),
    [sourceTree, positions, collapsed, states, ordering],
  );

  const [nodes, setNodes] = useState<Node<WcNodeData>[]>(flow.nodes);
  const [edges, setEdges] = useState<Edge[]>(flow.edges);
  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [flow]);

  // 语义缩放：<55% 节点退化序号圆点（监视视口 transform）
  useEffect(() => {
    const el = document.querySelector('.wc-flow .react-flow__viewport');
    if (!el) return;
    const ob = new MutationObserver(() => {
      const m = /scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform);
      el.classList.toggle('wc-zoom-out', !!m && Number(m[1]) < 0.55);
    });
    ob.observe(el, { attributes: true, attributeFilter: ['style'] });
    return () => ob.disconnect();
  }, []);

  // 首次进入：读自定义坐标（拖动过的节点记住位置）+ 聚焦当前节点
  const storyIdRef = useRef(storyId);
  useEffect(() => {
    void (async () => {
      const saved = await loadTreeLayout(storyIdRef.current);
      setCustomLayout(saved);
      setTimeout(() => {
        const tl = timeline(sourceTree);
        const cur = tl[tl.length - 1];
        if (cur) fitView({ nodes: [{ id: cur.id }], duration: 400, maxZoom: 1.2, padding: 0.4 });
      }, 120);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIdRef.current]);

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node<WcNodeData>): void => {
      void saveNodePos(storyId, node.id, node.position);
    },
    [storyId],
  );

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node<WcNodeData>): void => {
      // 折叠钮优先（事件委托），不弹预览
      const target = e.target as HTMLElement;
      if (target.closest('.wcnode-fold')) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
        });
        return;
      }
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      setPreview(node.id);
    },
    [],
  );

  // Android 长按 → contextmenu：触感 + 操作弹层
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node<WcNodeData>): void => {
    e.preventDefault();
    suppressClick.current = true;
    void haptic('light');
    setActionNodeId(node.id);
  }, []);

  const cancelPress = useCallback((): void => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  async function reorganize(): Promise<void> {
    await clearTreeLayout(storyId);
    setCustomLayout({});
    setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 60);
  }

  function handlePaneClick(e: React.MouseEvent): void {
    const now = Date.now();
    if (isDoubleTap(now, lastTap.current, e.clientX, e.clientY)) {
      fitView({ duration: 400, padding: 0.2 });
      lastTap.current = null;
      return;
    }
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
  }

  function travelTo(nodeId: string): void {
    const t2 = useStore.getState().tree;
    if (t2.nodes[nodeId]) {
      moveTo(t2, nodeId);
      useStore.setState({ tree: { ...t2 } });
    }
    setActionNodeId(null);
  }

  const previewNode = preview ? sourceTree.nodes[preview] : null;

  return (
    <div className="wc-flow" style={{ position: 'absolute', inset: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDragStart={cancelPress}
        onNodeDrag={cancelPress}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={handlePaneClick}
        minZoom={0.2}
        maxZoom={2}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="var(--gray-2)" />
        <MiniMap
          pannable
          zoomable
          style={{ width: 84, height: 116, right: 10, bottom: 10, background: 'var(--gray-1)', border: '1px solid var(--gray-2)' }}
          nodeColor={(n): string => ((n.data as WcNodeData).state === 'adopted' ? '#f0655a' : '#9a9a9a')}
        />
      </ReactFlow>

      <button
        className="wc-home-btn"
        aria-label="回到当前节点"
        onClick={() => {
          const tl = timeline(sourceTree);
          const cur = tl[tl.length - 1];
          if (cur) fitView({ nodes: [{ id: cur.id }], duration: 400, maxZoom: 1.2, padding: 0.4 });
        }}
      >
        ◎
      </button>

      <div className="wc-toolbar">
        <Button variant="secondary" size="sm" onClick={() => void reorganize()}>
          一键整理
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="切换 500 节点压测演示"
          onClick={() => setStressCount((v) => (v > 0 ? 0 : 500))}
        >
          {stressCount > 0 ? '退出压测' : '压测 500'}
        </Button>
      </div>

      {/* 轻点节点 → 全文预览弹层 */}
      <BottomSheet open={previewNode !== null} onClose={() => setPreview(null)} title={`#${ordering[preview ?? ''] ?? ''} · 节点全文`}>
        {previewNode && (
          <>
            <p className="wcnode-pv">{previewNode.text}</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-3)', margin: '0 0 var(--sp-3)' }}>
              {previewNode.text.length} 字 ·{' '}
              {states[previewNode.id] === 'adopted' ? '已采纳' : states[previewNode.id] === 'cand' ? '未采纳候选' : '已淘汰'}
            </p>
            {states[previewNode.id] !== 'adopted' && (
              <Button
                variant="secondary"
                onClick={() => {
                  useStore.setState({ candidates: [...previewNode.candidates] });
                  setPreview(null);
                }}
              >
                {t((d) => d.dashRestore)}
              </Button>
            )}
          </>
        )}
      </BottomSheet>

      {/* 长按节点 → 操作弹层 */}
      <BottomSheet open={actionNodeId !== null} onClose={() => setActionNodeId(null)} title="节点操作">
        {actionNodeId && (
          <>
            <Button variant="secondary" onClick={() => travelTo(actionNodeId)}>
              ↩ 回溯到此处
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                travelTo(actionNodeId);
                setView('editor');
              }}
            >
              ✎ 从此处继续写
            </Button>
            <Button variant="secondary" onClick={() => setActionNodeId(null)}>
              ✏ 重命名分支（即将支持）
            </Button>
            <div style={{ height: 'var(--sp-2)' }} />
            <Button
              variant="danger"
              onClick={() => {
                // 删除分支 = 回退到父节点（正文与树数据永不被破坏）
                const t2 = useStore.getState().tree;
                const n: StoryNode | undefined = t2.nodes[actionNodeId];
                if (n?.parentId) travelTo(n.parentId);
              }}
            >
              🗑 确认删除分支（回退到父节点）
            </Button>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-3)', margin: 'var(--sp-2) 0 0' }}>
              删除分支以「回退到父节点」实现，正文与树数据永不被破坏（§5 数据安全原则）。
            </p>
          </>
        )}
      </BottomSheet>
    </div>
  );
}

export function WorldTreeCanvas(): JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
