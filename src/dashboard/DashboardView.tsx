/** 功能 B · 仪表盘：只读视图 + 候选区回退 + 清除历史（二次确认） */
import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { replayHistory, storyStats, aggregateStats, type HistoryEntry } from './data';
import { useT } from '../i18n/useI18n';

export function DashboardView() {
  const tree = useStore((s) => s.tree);
  const title = useStore((s) => s.title);
  const setView = useStore((s) => s.setView);
  const t = useT();

  // 清除历史：会话级黑名单（不删树节点，仅仪表盘不再展示）
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState<null | 'all'>(null);

  const stats = useMemo(() => storyStats(tree), [tree]);
  const history = useMemo(
    () => replayHistory(tree).filter((h) => !hiddenNodeIds.has(h.nodeId)).reverse(),
    [tree, hiddenNodeIds],
  );

  // 全部故事汇总：当前为单故事应用，汇总 = 当前故事（多故事列表为后续扩展位）
  const agg = useMemo(() => aggregateStats([tree]), [tree]);

  /** 回退：把编辑器右栏候选卡恢复为该轮次候选（仅恢复显示，不动正文与树结构） */
  function restoreCandidates(entry: HistoryEntry): void {
    useStore.setState({ candidates: [...entry.candidates] });
    showToast(t((d) => d.dashRestored));
  }

  function clearAll(): void {
    setHiddenNodeIds(new Set(replayHistory(tree).map((h) => h.nodeId)));
    setConfirmClear(null);
  }

  return (
    <div className="worldtree-page">
      <h2>{t((d) => d.dashTitle)}</h2>
      <div className="page-sub">
        {t((d) => d.dashSub)}
        <button className="pill-btn" style={{ marginLeft: 16, padding: '6px 18px' }} onClick={() => setView('editor')}>
          {t((d) => d.backToEditor)}
        </button>
      </div>

      <div className="dash-cards">
        <div className="dash-card">
          <div className="dash-num">{stats.chars.toLocaleString()}</div>
          <div className="dash-label">{t((d) => d.dashChars)}</div>
        </div>
        <div className="dash-card">
          <div className="dash-num">{stats.genRounds}</div>
          <div className="dash-label">{t((d) => d.dashRounds)}</div>
        </div>
        <div className="dash-card">
          <div className="dash-num">{agg.totalChars.toLocaleString()}</div>
          <div className="dash-label">{t((d) => d.dashTotalChars)}</div>
        </div>
        <div className="dash-card">
          <div className="dash-num">{agg.totalRounds}</div>
          <div className="dash-label">{t((d) => d.dashTotalRounds)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 0 14px' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>{t((d) => d.dashHistoryTitle)}</h3>
        {history.length > 0 && (
          <button className="dash-clear-btn" onClick={() => setConfirmClear('all')}>
            {t((d) => d.dashClearAll)}
          </button>
        )}
      </div>

      {history.length === 0 && <div style={{ color: 'var(--sub)', fontSize: 14 }}>{t((d) => d.dashEmpty)}</div>}

      {history.map((h) => (
        <div key={h.nodeId} className="dash-entry">
          <div className="dash-entry-meta">
            <span>{new Date(h.createdAt).toLocaleString('zh-CN')}</span>
            <span>{title}</span>
            <span>{t((d) => d.dashCandidates)}: {h.candidates.length}</span>
            <button className="dash-restore-btn" onClick={() => restoreCandidates(h)}>
              {t((d) => d.dashRestore)}
            </button>
          </div>
          <div className="dash-entry-cands">
            {h.candidates.map((c) => (
              <div key={c.id} className={`dash-cand ${h.chosenId === c.id ? 'chosen' : ''}`}>
                <div className="dash-cand-tag">
                  {h.chosenId === c.id ? t((d) => d.dashChosen) : t((d) => d.dashDiscarded)}
                </div>
                <div className="dash-cand-text">
                  {c.text.slice(0, 140)}
                  {c.text.length > 140 ? '…' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {confirmClear && (
        <div className="style-dialog-mask" onClick={() => setConfirmClear(null)}>
          <div className="style-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, marginBottom: 12 }}>{t((d) => d.dashClearConfirmTitle)}</div>
            <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 16, lineHeight: 1.7 }}>
              {t((d) => d.dashClearConfirmBody)}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="pill-btn" style={{ background: 'var(--text)' }} onClick={() => setConfirmClear(null)}>
                {t((d) => d.cancelAction)}
              </button>
              <button className="pill-btn" onClick={clearAll}>
                {t((d) => d.confirm)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function showToast(message: string): void {
  let el = document.getElementById('xm-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'xm-toast';
    el.className = 'hint-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => {
    if (el) el.style.display = 'none';
  }, 2500);
}
