/** 正文编辑区：已采纳深灰文本 + 红色未确认续写 + 游标工具条 + 用户输入区 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { timeline } from '../worldtree/tree';
import { UndoIcon, EditIcon, CheckIcon } from '../components/Icons';
import { useGenerate } from './useGenerate';
import { useT } from '../i18n/useI18n';

export function EditorPane() {
  const tree = useStore((s) => s.tree);
  const gen = useStore((s) => s.gen);
  const settings = useStore((s) => s.settings);
  const candidates = useStore((s) => s.candidates);
  const memoryTruncated = useStore((s) => s.memoryTruncated);
  const editAdoptedText = useStore((s) => s.editAdoptedText);
  const confirmEditedText = useStore((s) => s.confirmEditedText);
  const revertRed = useStore((s) => s.revertRed);
  const keepRed = useStore((s) => s.keepRed);
  const t = useT();

  const { run, generateFromInput } = useGenerate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  /** 操作按钮可见性：点击撤回或保留后隐藏，新一轮生成时重置 */
  const [actionsVisible, setActionsVisible] = useState(true);

  const nodes = timeline(tree);
  const lastNode = nodes[nodes.length - 1];
  const redNode = lastNode && lastNode.source === 'ai' ? lastNode : null;
  const adoptedNodes = redNode ? nodes.slice(0, -1) : nodes;

  const generating = gen.phase === 'generating';
  const showRedText = !generating && redNode && actionsVisible;
  const showToolbar = showRedText && !editing;

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [gen.streamText, tree.currentId, lastNode?.text]);

  // 新一轮生成时重置
  useEffect(() => {
    if (generating) setActionsVisible(true);
  }, [generating]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const text = (e.currentTarget as HTMLTextAreaElement).value;
      void generateFromInput(text);
      (e.currentTarget as HTMLTextAreaElement).value = '';
    }
  }

  /** 撤回：删除最后一个 AI 节点 */
  function handleKeep(): void {
    keepRed();
    setActionsVisible(false);
  }

  return (
    <section className="editor-pane" ref={scrollRef}>
      {/* 已采纳正文（深灰，全程可自由编辑） */}
      <textarea
        className="adopted-edit"
        value={adoptedNodes.map((n) => n.text).join('')}
        onChange={(e) => editAdoptedText(e.target.value)}
        spellCheck={false}
        placeholder="写下故事开头…"
      />

      {/* 红色未确认续写（生成中流式） */}
      {generating && (
        <article className="story-text">
          <span className="red">{gen.streamText}</span>
          <span className="stream-caret" />
        </article>
      )}

      {/* 红色未确认续写（生成完毕） */}
      {showRedText && !editing && (
        <article className="story-text">
          <span className="red">{redNode?.text}</span>
          <span className="red-line" />
        </article>
      )}

      {/* 编辑态（修改） */}
      {!generating && redNode && editing && (
        <>
          <textarea
            className="edit-area"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
          />
          <div className="cursor-toolbar">
            <div className="inner">
              <button
                onClick={() => {
                  confirmEditedText(editValue);
                  setEditing(false);
                  setActionsVisible(false);
                }}
              >
                <CheckIcon /> {t((d) => d.confirm)}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                }}
              >
                {t((d) => d.cancelAction)}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 工具条：撤回 / 修改 / 保留 / 继续 */}
      {showToolbar && (
        <div className="cursor-toolbar">
          <div className="inner">
            <button
              title="删除本次续写，回到生成前"
              onClick={() => {
                setEditing(false);
                setActionsVisible(false);
                revertRed();
              }}
            >
              <UndoIcon /> {t((d) => d.undoRed)}
            </button>
            <button
              title="转为可编辑态"
              onClick={() => {
                setEditValue(redNode?.text ?? '');
                setEditing(true);
              }}
            >
              <EditIcon /> {t((d) => d.editRed)}
            </button>
            <button
              title="确认当前内容，不再续写"
              onClick={handleKeep}
            >
              ✓ 保留
            </button>
            <button
              title="确认当前内容并继续生成"
              onClick={() => {
                void run();
              }}
            >
              <CheckIcon /> {t((d) => d.continueGen)}
            </button>
          </div>
        </div>
      )}

      {/* 错误卡片 + 重试 */}
      {!generating && gen.phase === 'error' && (
        <div className="error-card">
          ⚠ {t((d) => d.genFailed)}：{gen.errorMessage}
          <div className="retry">
            <button className="pill-btn" onClick={() => void run()}>
              {t((d) => d.retry)}
            </button>
          </div>
        </div>
      )}

      {/* 用户输入区 */}
      {!generating && !showRedText && (
        <>
          <textarea
            ref={inputRef}
            className="user-input"
            placeholder={t((d) => d.inputPlaceholder)}
            onKeyDown={onKeyDown}
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <button
              className="pill-btn"
              onClick={() => {
                const el = inputRef.current;
                if (el && el.value.trim()) {
                  void generateFromInput(el.value.trim());
                  el.value = '';
                }
              }}
            >
              {t((d) => d.writeAndContinue)}
            </button>
            {memoryTruncated && (
              <span style={{ fontSize: 12, color: 'var(--sub)', alignSelf: 'center' }}>
                {t((d) => d.memoryTruncated, { n: settings.contextWindow })}
              </span>
            )}
          </div>
        </>
      )}

      {/* 候选数提示 */}
      {!generating && candidates.length > 0 && redNode && !editing && actionsVisible && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sub)' }}>
          {t((d) => d.candidatesInRound, { n: candidates.length })}
        </div>
      )}
    </section>
  );
}
