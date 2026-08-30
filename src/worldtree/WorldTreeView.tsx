/** 平行世界树：纵向时间线 + 分叉视图，点击节点即"穿越" */
import { useStore } from '../store/useStore';
import { TreeIcon } from '../components/Icons';

interface Row {
  id: string;
  depth: number;
  text: string;
  createdAt: number;
  source: string;
  candidateCount: number;
  isCurrent: boolean;
}

/** 从树上收集全部节点（含分支），按创建序排列，附带深度 */
function collectRows(tree: Parameters<typeof collect>[0]): Row[] {
  return collect(tree);
}

function collect(tree: {
  nodes: Record<string, { id: string; parentId: string | null; text: string; createdAt: number; source: string; candidates: unknown[] }>;
  currentId: string;
}): Row[] {
  const nodes = Object.values(tree.nodes).sort((a, b) => a.createdAt - b.createdAt);
  const depthMap = new Map<string, number>();
  for (const n of nodes) {
    const parentDepth = n.parentId ? (depthMap.get(n.parentId) ?? 0) : -1;
    depthMap.set(n.id, parentDepth + 1);
  }
  return nodes.map((n) => ({
    id: n.id,
    depth: depthMap.get(n.id) ?? 0,
    text: n.text,
    createdAt: n.createdAt,
    source: n.source,
    candidateCount: n.candidates.length,
    isCurrent: n.id === tree.currentId,
  }));
}

export function WorldTreeView() {
  const tree = useStore((s) => s.tree);
  const travelTo = useStore((s) => s.travelTo);
  const setView = useStore((s) => s.setView);

  const rows = collectRows(tree);

  return (
    <div className="worldtree-page">
      <h2>平行世界树</h2>
      <div className="page-sub">
        点击任意节点穿越回该时间线继续创作；原分支完整保留。
        <button
          className="pill-btn"
          style={{ marginLeft: 16, padding: '6px 18px' }}
          onClick={() => setView('editor')}
        >
          返回正文
        </button>
      </div>

      {rows.map((r) => (
        <div
          key={r.id}
          className={`wt-node ${r.isCurrent ? 'current' : ''}`}
          style={{ marginLeft: 14 + r.depth * 26 }}
          onClick={() => travelTo(r.id)}
          title="点击穿越到此节点"
        >
          <span className="wt-dot" />
          <div className="wt-meta">
            <span>{r.isCurrent ? '⬤ 当前' : r.source === 'user' ? '用户' : 'AI 续写'}</span>
            {r.candidateCount > 1 && (
              <span className="wt-branch-tag">分叉 · {r.candidateCount} 条候选</span>
            )}
            <span>{new Date(r.createdAt).toLocaleTimeString('zh-CN')}</span>
          </div>
          <div className="wt-text">{r.text || '（空）'}</div>
        </div>
      ))}

      {rows.length === 0 && (
        <div style={{ color: 'var(--sub)', fontSize: 14 }}>
          <TreeIcon /> 暂无节点
        </div>
      )}
    </div>
  );
}
