/**
 * 候选抽屉（§4）：默认隐藏；生成时升起约 40%，可上拉至 75%、下拉收成细条、再下拉关闭。
 * 三条候选横向轮播（scroll-snap + 页码圆点），轻点卡片即采纳替换红段；生成中骨架屏。
 * 抽屉升起时正文自动滚到红段可见（由 MobileEditor 监听生成完成态处理）。
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useGenerate } from '../editor/useGenerate';
import { Button } from './components/Button';
import { mobileCopy } from './copy';

type Snap = 'closed' | 'collapsed' | 'open' | 'expanded';

/** snap 档位对应的视口高度百分比 */
export function snapHeight(snap: Snap): string {
  switch (snap) {
    case 'collapsed':
      return '64px';
    case 'expanded':
      return '75%';
    case 'open':
      return '40%';
    default:
      return '0%';
  }
}

/** 拖拽手势 → 下一档位（纯函数，便于测试） */
export function nextSnap(current: Snap, dyDown: number, dyUp: number): Snap {
  if (dyDown > 90) {
    if (current === 'expanded') return 'open';
    if (current === 'open') return 'collapsed';
    return 'closed';
  }
  if (dyUp > 70) {
    if (current === 'collapsed') return 'open';
    if (current === 'open') return 'expanded';
  }
  return current;
}

export function CandidateSheet() {
  const candidates = useStore((s) => s.candidates);
  const gen = useStore((s) => s.gen);
  const tree = useStore((s) => s.tree);
  const adoptCandidate = useStore((s) => s.adoptCandidate);
  const { run } = useGenerate();

  const generating = gen.phase === 'generating';
  const currentNode = tree.nodes[tree.currentId];
  const adoptedId = generating ? null : currentNode?.chosenCandidateId;

  const [snap, setSnap] = useState<Snap>('closed');
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [page, setPage] = useState(0);
  const startY = useRef<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // 每轮生成开始（含「换一批」）→ 抽屉自动升起（§4）
  const wasGenerating = useRef(false);
  useEffect(() => {
    if (generating && !wasGenerating.current) setSnap('open');
    wasGenerating.current = generating;
  }, [generating]);

  // 轮播页码同步（§4 页码圆点）
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    function onScroll(): void {
      const c = carouselRef.current;
      if (!c || c.clientWidth === 0) return;
      setPage(Math.round(c.scrollLeft / c.clientWidth));
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [snap, generating, candidates.length]);

  function onPointerDown(e: React.PointerEvent): void {
    startY.current = e.clientY;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent): void {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  }
  function onPointerUp(e: React.PointerEvent): void {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    setDragging(false);
    setDragY(0);
    setSnap((s) => nextSnap(s, Math.max(0, dy), Math.max(0, -dy)));
  }

  if (snap === 'closed' && !dragging) return null;
  const hasContent = generating || candidates.length > 0;
  if (snap === 'collapsed' && !hasContent) return null;

  return (
    <section
      className={`msheet mcsheet ${snap === 'expanded' ? 'expanded' : ''} ${snap === 'collapsed' ? 'collapsed' : ''}`}
      role="complementary"
      aria-label="候选"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        transition: dragging ? 'none' : undefined,
      }}
    >
      {/* 头部：拖拽把手 + 标题 + 换一批 + 关闭（参照图 1） */}
      <div
        className="mcsheet-head"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="msheet-handle" style={{ margin: '0 8px 0 0' }} />
        <div className="mcs-title">🤖 {mobileCopy.candidateTitle}</div>
        <Button variant="secondary" size="sm" disabled={generating} onClick={() => void run()}>
          ⟳ 换一批
        </Button>
        <button className="mcs-close" aria-label="关闭" onClick={() => setSnap('closed')}>
          ✕
        </button>
      </div>

      {snap !== 'collapsed' && (
        <>
          <div className="mcs-carousel" ref={carouselRef}>
            {generating &&
              [0, 1, 2].map((i) => (
                <div className="mcs-skeleton" key={i}>
                  <div className="sk-line" />
                  <div className="sk-line" />
                  <div className="sk-line short" />
                </div>
              ))}
            {!generating &&
              candidates.map((c) => (
                <div
                  key={c.id}
                  className={`mcs-card ${c.id === adoptedId ? 'adopted' : ''}`}
                  onClick={() => adoptCandidate(c.id)}
                >
                  {c.text}
                </div>
              ))}
          </div>
          <div className="mcs-dots">
            {(generating ? [0, 1, 2] : candidates).map((_, i) => (
              <span key={i} className={i === page ? 'on' : ''} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
