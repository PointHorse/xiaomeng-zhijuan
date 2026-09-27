/**
 * BottomSheet —— 移动端一切弹出面板的唯一形态（docs/design-language.md §3.6、组件文档 §4）。
 * 升起 400ms 弹性（--ease-spring）、收回加速（--ease-exit）、遮罩 200ms 渐显、
 * 下拉 ≥90px 关闭、Escape 关闭；面板玻璃底 + 环境光阴影。
 * SheetRow：选项行，按压背景反馈；selected 时品牌色 + 浅红底 + 勾选图标。
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from '../../components/Icons';

/** 退场动画时长（--dur-slow）+ 缓冲，之后卸载 DOM */
const CLOSE_MS = 450;
/** 下拉关闭位移阈值（px） */
export const SHEET_DISMISS_THRESHOLD = 90;

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 面板高度（如 '80%'）；缺省自适应 */
  height?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps): JSX.Element | null {
  const [visible, setVisible] = useState(open);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!visible) return null;

  // portal 必须落在 .mshell 内：令牌（--scrim/--glass-bg/--gray-* 等）作用域在 .mshell，
  // 挂到 body 会令弹层丢失全部样式（阶段 2 实测教训）。
  const container = document.querySelector('.mshell') ?? document.body;

  function onPointerDown(e: React.PointerEvent): void {
    startY.current = e.clientY;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
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
    if (dy > SHEET_DISMISS_THRESHOLD) onClose();
  }

  return createPortal(
    <>
      <div className={`msheet2-mask ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <div
        className={`msheet2 ${open ? 'open' : ''} ${dragging ? 'dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="msheet2-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="msheet2-handle" />
        </div>
        {title && (
          <div className="msheet2-title-row">
            <div className="msheet2-title">{title}</div>
            <button type="button" className="msheet2-close" aria-label="关闭" onClick={onClose}>
              ✕
            </button>
          </div>
        )}
        <div className="msheet2-body">{children}</div>
      </div>
    </>,
    container,
  );
}

interface SheetRowProps {
  selected?: boolean;
  icon?: ReactNode;
  sub?: string;
  onClick?: () => void;
  children: ReactNode;
}

export function SheetRow({ selected, icon, sub, onClick, children }: SheetRowProps): JSX.Element {
  return (
    <button type="button" className="msheet-row2" data-line-fx="1" aria-selected={selected ?? undefined} onClick={onClick}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="row-main">
        {children}
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      <span className="row-check" aria-hidden="true">
        <CheckIcon />
      </span>
    </button>
  );
}

export function SheetSep(): JSX.Element {
  return <div className="msheet-sep2" />;
}
