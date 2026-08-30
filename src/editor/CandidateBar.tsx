/** 右侧候选栏：没有满意的？/ 换一批 / 三张候选卡片 / 骨架屏 */
import { useStore } from '../store/useStore';
import { RefreshIcon } from '../components/Icons';
import { useGenerate } from './useGenerate';

export function CandidateBar() {
  const tree = useStore((s) => s.tree);
  const candidates = useStore((s) => s.candidates);
  const gen = useStore((s) => s.gen);
  const adoptCandidate = useStore((s) => s.adoptCandidate);
  const { run } = useGenerate();

  const generating = gen.phase === 'generating';
  const currentNode = tree.nodes[tree.currentId];
  const selectedId = gen.phase === 'generating' ? null : currentNode?.chosenCandidateId;

  function refreshBatch(): void {
    // 换一批：以当前上下文重新生成三条（旧候选已随节点记入平行世界树）
    void run();
  }

  return (
    <aside className="candidate-pane">
      <div className="candidate-head">
        <div>
          <h2>没有满意的？</h2>
          <div className="sub">点击其他卡片看一看</div>
        </div>
        <button className="pill-btn" disabled={generating} onClick={refreshBatch}>
          <RefreshIcon /> 换一批
        </button>
      </div>

      {generating && (
        <>
          <div className="dreaming">小梦正在做梦…</div>
          {gen.streamText && (
            <div className="candidate-card selected">
              <div className="cand-text">{gen.streamText.slice(-160)}</div>
            </div>
          )}
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {!generating && candidates.length > 0 && (
        <>
          {candidates.map((c) => (
            <div
              key={c.id}
              className={`candidate-card ${selectedId === c.id ? 'selected' : ''}`}
              onClick={() => adoptCandidate(c.id)}
            >
              <div className="cand-text">{truncate(c.text, 220)}</div>
            </div>
          ))}
        </>
      )}

      {!generating && candidates.length === 0 && (
        <div style={{ color: 'var(--sub)', fontSize: 13, lineHeight: 1.8 }}>
          在左侧写下故事开头并生成后，
          <br />
          三条候选会出现在这里。
        </div>
      )}
    </aside>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

function SkeletonCard(): JSX.Element {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
  );
}
