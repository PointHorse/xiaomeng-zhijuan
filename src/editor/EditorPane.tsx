/** 正文编辑区：已采纳深灰文本 + 红色未确认续写 + 游标工具条 + 用户输入区 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { timeline } from '../worldtree/tree';
import { UndoIcon, EditIcon, CheckIcon } from '../components/Icons';
import { useGenerate } from './useGenerate';

export function EditorPane() {
  const tree = useStore((s) => s.tree);
  const gen = useStore((s) => s.gen);
  const settings = useStore((s) => s.settings);
  const candidates = useStore((s) => s.candidates);
  const memoryTruncated = useStore((s) => s.memoryTruncated);
  const confirmEditedText = useStore((s) => s.confirmEditedText);
  const revertRed = useStore((s) => s.revertRed);

  const { run, generateFromInput } = useGenerate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 编辑态（修改红色文本）
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const nodes = timeline(tree);
  const lastNode = nodes[nodes.length - 1];
  // 红色未确认段 = 时间线最后一个 AI 节点
  const redNode = lastNode && lastNode.source === 'ai' ? lastNode : null;
  const adoptedNodes = redNode ? nodes.slice(0, -1) : nodes;

  const generating = gen.phase === 'generating';
  const showRed = (redNode && !generating) || (generating && gen.streamText);
  const showInput = !generating && !showRed;

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [gen.streamText, tree.currentId, lastNode?.text]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const text = (e.currentTarget as HTMLTextAreaElement).value;
      void generateFromInput(text);
      (e.currentTarget as HTMLTextAreaElement).value = '';
    }
  }

  return (
    <section className="editor-pane" ref={scrollRef}>
      {/* 已采纳正文（深灰） */}
      <article className="story-text">
        {adoptedNodes.map((n) => (
          <span key={n.id}>{n.text}</span>
        ))}
      </article>

      {/* 红色未确认续写 */}
      {generating && (
        <article className="story-text">
          <span className="red">{gen.streamText}</span>
          <span className="stream-caret" />
        </article>
      )}
      {!generating && redNode && !editing && (
        <article className="story-text">
          <span className="red">{redNode.text}</span>
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
                }}
              >
                <CheckIcon /> 确认
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                }}
              >
                取消
              </button>
            </div>
          </div>
        </>
      )}

      {/* 红色游标工具条（撤回 / 修改 / 继续） */}
      {!generating && redNode && !editing && (
        <div className="cursor-toolbar">
          <div className="inner">
            <button
              title="删除本次红色续写，回到生成前"
              onClick={() => {
                setEditing(false);
                revertRed();
              }}
            >
              <UndoIcon /> 撤回
            </button>
            <button
              title="转为可编辑态"
              onClick={() => {
                setEditValue(redNode.text);
                setEditing(true);
              }}
            >
              <EditIcon /> 修改
            </button>
            <button
              title="转正并继续生成"
              onClick={() => {
                void run();
              }}
            >
              <CheckIcon /> 继续
            </button>
          </div>
        </div>
      )}

      {/* 错误卡片 + 重试 */}
      {!generating && gen.phase === 'error' && (
        <div className="error-card">
          ⚠ 生成失败：{gen.errorMessage}
          <div className="retry">
            <button
              className="pill-btn"
              onClick={() => {
                void run();
              }}
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 用户输入区（空闲时） */}
      {showInput && (
        <>
          <textarea
            ref={inputRef}
            className="user-input"
            placeholder="在这里写下或粘贴故事开头… 按 Ctrl+Enter 生成续写"
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
              ✒ 写下这段并续写
            </button>
            {memoryTruncated && (
              <span style={{ fontSize: 12, color: 'var(--sub)', alignSelf: 'center' }}>
                记忆截断：仅使用最近 {settings.contextWindow} 字作为上下文
              </span>
            )}
          </div>
        </>
      )}

      {/* 已完成候选数提示（转正后） */}
      {!generating && candidates.length > 0 && redNode && !editing && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sub)' }}>
          本轮共 {candidates.length} 条候选，可在右侧切换
        </div>
      )}
    </section>
  );
}
