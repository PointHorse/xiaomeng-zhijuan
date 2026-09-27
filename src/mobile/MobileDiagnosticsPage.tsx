/**
 * 诊断日志页（阶段 3.5 §1①）：最近 50 次模型请求的时间/地址/模型/状态码/
 * 错误正文/首字耗时/总耗时/finish_reason/reasoning 标记；支持复制全部。
 */
import { useState } from 'react';
import { diagAll, diagClear, diagCopyText, type DiagEntry } from '../diagnostics/diagLog';
import { Button } from './components/Button';
import { showToast } from '../components/toast';

function rowLabel(e: DiagEntry): string {
  const time = new Date(e.t).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ok = e.status >= 200 && e.status < 300 && e.verdict.startsWith('成功');
  return `${time} · HTTP ${e.status} · ${ok ? '成功' : '失败'}`;
}

export function MobileDiagnosticsPage(): JSX.Element {
  const entries = diagAll();
  const [tick, setTick] = useState(0);
  void tick; // 清空后强制重渲染

  async function copyAll(): Promise<void> {
    const text = diagCopyText();
    if (!text.trim()) {
      showToast('暂无日志');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制全部日志');
    } catch {
      showToast('复制失败（剪贴板不可用）');
    }
  }

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <Button variant="primary" onClick={() => void copyAll()}>
          复制全部日志
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            diagClear();
            setTick((v) => v + 1);
          }}
        >
          清空
        </Button>
      </div>

      {entries.length === 0 && (
        <div style={{ color: 'var(--gray-3)', fontSize: 'var(--fs-sm)', padding: 'var(--sp-6) 0', textAlign: 'center', lineHeight: 2 }}>
          暂无请求记录。
          <br />
          每次续写/测试连接都会在这里留下一条：
          <br />
          时间、地址、模型、状态码、耗时与失败原因。
        </div>
      )}

      {entries.map((e, i) => {
        const ok = e.status >= 200 && e.status < 300 && e.verdict.startsWith('成功');
        return (
          <div
            key={`${e.t}-${i}`}
            style={{
              background: 'var(--gray-1)',
              border: `1px solid ${ok ? 'var(--gray-2)' : 'var(--danger)'}`,
              borderLeft: `4px solid ${ok ? 'var(--success)' : 'var(--danger)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--sp-3)',
              marginBottom: 'var(--sp-3)',
              fontSize: 'var(--fs-xs)',
              lineHeight: 1.8,
              color: 'var(--gray-4)',
              wordBreak: 'break-all',
            }}
          >
            <div style={{ fontWeight: 700, color: ok ? 'var(--success)' : 'var(--danger)', fontSize: 'var(--fs-sm)' }}>
              {rowLabel(e)}
            </div>
            <div>地址：{e.url.replace(/([?&](?:key|api[_-]?key|token)=)[^&]+/gi, '$1***')}</div>
            <div>模型：{e.model || '—'}</div>
            <div>
              首字：{e.firstByteMs !== null ? `${e.firstByteMs}ms` : '—'} · 总耗时：{e.totalMs}ms · finish_reason: {e.finishReason ?? '—'} · 思考: {e.reasoning ? '是' : '否'}
            </div>
            <div style={{ color: ok ? 'var(--gray-4)' : 'var(--danger)' }}>{e.verdict}</div>
            {e.errBody && <div style={{ marginTop: 4, color: 'var(--gray-3)' }}>错误正文：{e.errBody.slice(0, 500)}</div>}
          </div>
        );
      })}
    </div>
  );
}
