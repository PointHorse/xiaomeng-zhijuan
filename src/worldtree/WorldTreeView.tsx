/** 平行世界树：纵向时间线 + 分叉视图，点击节点即"穿越" */
import { useStore } from '../store/useStore';
import { TreeIcon } from '../components/Icons';
import { useT } from '../i18n/useI18n';

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
  const t = useT();

  const rows = collectRows(tree);

  return (
    <div className="worldtree-page">
      <h2>{t((d) => d.worldTreeTitle)}</h2>
      <div className="page-sub">
        {t((d) => d.worldTreeSub)}
        <button
          className="pill-btn"
          style={{ marginLeft: 16, padding: '6px 18px' }}
          onClick={() => setView('editor')}
        >
          {t((d) => d.backToEditor)}
        </button>
      </div>

      {rows.map((r) => (
        <div
          key={r.id}
          className={`wt-node ${r.isCurrent ? 'current' : ''}`}
          style={{ marginLeft: 14 + r.depth * 26 }}
          onClick={() => travelTo(r.id)}
          title={t((d) => d.clickTravel)}
        >
          <span className="wt-dot" />
          <div className="wt-meta">
            <span>{r.isCurrent ? `⬤ ${t((d) => d.nodeCurrent)}` : r.source === 'user' ? t((d) => d.nodeUser) : t((d) => d.nodeAi)}</span>
            {r.candidateCount > 1 && (
              <span className="wt-branch-tag">{t((d) => d.branchTag, { n: r.candidateCount })}</span>
            )}
            <span>{new Date(r.createdAt).toLocaleTimeString('zh-CN')}</span>
          </div>
          <div className="wt-text">{r.text || '（空）'}</div>
        </div>
      ))}

      {rows.length === 0 && (
        <div style={{ color: 'var(--sub)', fontSize: 14 }}>
          <TreeIcon /> {t((d) => d.emptyTree)}
        </div>
      )}
    </div>
  );
}
