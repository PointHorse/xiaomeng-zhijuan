/**
 * 移动版仪表盘（阶段 3 §4）：纵向卡片流。
 * 统计卡片在上（当前故事 + 全部故事汇总），输出历史在下；
 * 展开、回退、清除一律经 BottomSheet；数据逻辑与桌面 DashboardView 共用（dashboard/data.ts）。
 */
import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { replayHistory, storyStats, aggregateStats, type HistoryEntry } from '../dashboard/data';
import { useT } from '../i18n/useI18n';
import { BottomSheet } from './components/BottomSheet';
import { Button } from './components/Button';
import { showToast } from '../components/toast';

export function MobileDashboardPage(): JSX.Element {
  const tree = useStore((s) => s.tree);
  const title = useStore((s) => s.title);
  const t = useT();

  // 清除历史：会话级黑名单（不删树节点，仅仪表盘不再展示）——与桌面逻辑一致
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const [expanded, setExpanded] = useState<HistoryEntry | null>(null);

  const stats = useMemo(() => storyStats(tree), [tree]);
  const history = useMemo(
    () => replayHistory(tree).filter((h) => !hiddenNodeIds.has(h.nodeId)).reverse(),
    [tree, hiddenNodeIds],
  );
  const agg = useMemo(() => aggregateStats([tree]), [tree]);

  function restoreCandidates(entry: HistoryEntry): void {
    useStore.setState({ candidates: [...entry.candidates] });
    showToast(t((d) => d.dashRestored));
    setExpanded(null);
  }

  function clearAll(): void {
    setHiddenNodeIds(new Set(replayHistory(tree).map((h) => h.nodeId)));
    setConfirmClear(false);
  }

  const cards: Array<{ num: string; label: string }> = [
    { num: stats.chars.toLocaleString(), label: t((d) => d.dashChars) },
    { num: String(stats.genRounds), label: t((d) => d.dashRounds) },
    { num: agg.totalChars.toLocaleString(), label: t((d) => d.dashTotalChars) },
    { num: String(agg.totalRounds), label: t((d) => d.dashTotalRounds) },
  ];

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      {/* 统计卡片（上） */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-5)',
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              background: 'var(--gray-1)',
              border: '1px solid var(--gray-2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--sp-4)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
              {c.num}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-3)', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* 输出历史（下） */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--gray-5)' }}>
          {t((d) => d.dashHistoryTitle)}
        </h3>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            {t((d) => d.dashClearAll)}
          </Button>
        )}
      </div>

      {history.length === 0 && (
        <div style={{ color: 'var(--gray-3)', fontSize: 'var(--fs-sm)', padding: 'var(--sp-6) 0', textAlign: 'center' }}>
          {t((d) => d.dashEmpty)}
        </div>
      )}

      {history.map((h) => {
        const chosen = h.candidates.find((c) => c.id === h.chosenId);
        return (
          <button
            key={h.nodeId}
            type="button"
            className="mdash-entry"
            onClick={() => setExpanded(h)}
          >
            <div className="mdash-meta">
              <span>{new Date(h.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span>
                {t((d) => d.dashCandidates)}: {h.candidates.length}
              </span>
            </div>
            <div className="mdash-preview">
              {(chosen ?? h.candidates[0])?.text.slice(0, 48) ?? '…'}
              {(chosen ?? h.candidates[0])?.text.length ?? 0 > 48 ? '…' : ''}
            </div>
          </button>
        );
      })}

      {/* 历史展开 Sheet（§4：展开/回退走弹层） */}
      <BottomSheet open={expanded !== null} onClose={() => setExpanded(null)} title={t((d) => d.dashHistoryTitle)}>
        {expanded && (
          <>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-3)', margin: '0 0 var(--sp-3)' }}>
              {new Date(expanded.createdAt).toLocaleString('zh-CN')} · {title} · {t((d) => d.dashCandidates)}: {expanded.candidates.length}
            </p>
            {expanded.candidates.map((c) => (
              <div
                key={c.id}
                className={`mdash-cand ${expanded.chosenId === c.id ? 'chosen' : ''}`}
              >
                <div className="mdash-cand-tag">
                  {expanded.chosenId === c.id ? t((d) => d.dashChosen) : t((d) => d.dashDiscarded)}
                </div>
                <div className="mdash-cand-text">{c.text.slice(0, 140)}{c.text.length > 140 ? '…' : ''}</div>
              </div>
            ))}
            <Button variant="secondary" onClick={() => restoreCandidates(expanded)}>
              {t((d) => d.dashRestore)}
            </Button>
          </>
        )}
      </BottomSheet>

      {/* 清除历史确认（§4：二次确认走弹层） */}
      <BottomSheet open={confirmClear} onClose={() => setConfirmClear(false)} title={t((d) => d.dashClearConfirmTitle)}>
        <p style={{ margin: '0 0 var(--sp-4)', lineHeight: 1.8 }}>{t((d) => d.dashClearConfirmBody)}</p>
        <Button variant="danger" onClick={clearAll}>
          {t((d) => d.confirm)}
        </Button>
      </BottomSheet>
    </div>
  );
}
