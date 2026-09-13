/**
 * 移动端正文编辑页（§3）：顶栏之下 标题 → 元信息 → 全屏正文。
 * 无虚线输入框、无「写下这段并续写」按钮——空文档直接显示 placeholder；
 * 红色未确认段 + 游标线 + 右对齐工具条沿用桌面语义；
 * 右缘悬浮圆球为 AI 续写主入口（生成中呼吸动画、轻点取消）。
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { timeline } from '../worldtree/tree';
import { useGenerate } from '../editor/useGenerate';
import { mobileCopy } from './copy';

function formatTime(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

export function MobileEditor() {
  const tree = useStore((s) => s.tree);
  const gen = useStore((s) => s.gen);
  const title = useStore((s) => s.title);
  const setTitle = useStore((s) => s.setTitle);
  const editAdoptedText = useStore((s) => s.editAdoptedText);
  const confirmEditedText = useStore((s) => s.confirmEditedText);
  const revertRed = useStore((s) => s.revertRed);
  const keepRed = useStore((s) => s.keepRed);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const { run, cancel } = useGenerate();

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const redRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nodes = timeline(tree);
  const lastNode = nodes[nodes.length - 1];
  const redNode = lastNode && lastNode.source === 'ai' && !lastNode.confirmed ? lastNode : null;
  const adoptedNodes = redNode ? nodes.slice(0, -1) : nodes;
  const adoptedText = adoptedNodes.map((n) => n.text).join('');
  const charCount = adoptedText.length + (redNode?.text.length ?? 0);

  const generating = gen.phase === 'generating';

  // 正文 textarea 自适应内容高度
  useEffect(() => {
    const el = bodyRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [adoptedText]);

  // 生成中跟随流式输出滚动到底部；生成完成（红段出现）滚动让红段可见
  useEffect(() => {
    if (generating && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [generating, gen.streamText]);

  useEffect(() => {
    if (!generating && redNode && redRef.current && scrollRef.current) {
      redRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [generating, redNode?.id]);

  function onBallClick(): void {
    if (generating) {
      cancel();
      return;
    }
    void run();
  }

  return (
    <>
      <div className="meditor">
        <input
          className="mtitle-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={mobileCopy.titlePlaceholder}
          spellCheck={false}
        />
        <div className="mmeta-line">
          <span>{mobileCopy.charCount.replace('{n}', String(charCount))}</span>
          {lastSavedAt > 0 && <span>{mobileCopy.lastSavedAt.replace('{t}', formatTime(lastSavedAt))}</span>}
        </div>

        <div className="mbody-scroll" ref={scrollRef}>
          {/* 已采纳正文：直接可编辑，无虚线框 */}
          <textarea
            ref={bodyRef}
            className="mbody-text"
            value={adoptedText}
            onChange={(e) => editAdoptedText(e.target.value)}
            placeholder={mobileCopy.writeOpening}
            spellCheck={false}
          />

          {/* 生成中：流式红字 */}
          {generating && (
            <div className="mred-text">
              {gen.streamText}
              <span className="mstream-caret" />
            </div>
          )}

          {/* 生成完毕：红色未确认段 + 游标线 + 工具条 */}
          {!generating && redNode && !editing && (
            <>
              <span className="mred-text" ref={redRef}>
                {redNode.text}
              </span>
              <span className="mred-line" />
              <div className="mred-toolbar">
                <button
                  onClick={() => {
                    revertRed();
                  }}
                >
                  ↩ 撤回
                </button>
                <button
                  onClick={() => {
                    setEditValue(redNode.text);
                    setEditing(true);
                  }}
                >
                  ✎ 修改
                </button>
                <button
                  onClick={() => {
                    keepRed();
                    void run();
                  }}
                >
                  ✓ 继续
                </button>
              </div>
            </>
          )}

          {/* 编辑态（修改红段） */}
          {!generating && redNode && editing && (
            <>
              <textarea
                className="mbody-text"
                style={{ color: 'var(--accent)', minHeight: '120px' }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <div className="mred-toolbar">
                <button
                  onClick={() => {
                    confirmEditedText(editValue);
                    setEditing(false);
                  }}
                >
                  ✓ 确认
                </button>
                <button onClick={() => setEditing(false)}>✕ 取消</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 错误卡片 + 重试 */}
      {!generating && gen.phase === 'error' && (
        <div style={{ margin: '10px 0', padding: '12px 14px', background: 'var(--accent-soft)', borderRadius: 12, fontSize: 14, lineHeight: 1.8, color: 'var(--accent-text)' }}>
          ⚠ 生成失败：{gen.errorMessage}
          <div style={{ marginTop: 8 }}>
            <button
              className="hit-44"
              onClick={() => void run()}
              style={{ height: 36, padding: '0 16px', border: 'none', borderRadius: 18, background: 'var(--accent)', color: '#fff', fontSize: 14 }}
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 右缘悬浮 AI 球（§3）：主触发入口；生成中呼吸 + 轻点取消 */}
      <button
        className={`mai-ball ${generating ? 'generating' : ''}`}
        aria-label={generating ? mobileCopy.cancelGen : mobileCopy.aiContinue}
        onClick={onBallClick}
      >
        {generating ? '✕' : '✒'}
      </button>
    </>
  );
}
