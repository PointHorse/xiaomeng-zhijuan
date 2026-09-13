/**
 * 底部弹层 Sheet（§1 全局规范）：移动端一切弹出面板的唯一形态。
 * 圆角 + 遮罩 + 下拉关闭；经 portal 挂到 body，彻底避开桌面 popover 的裁切问题。
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 面板高度：'auto'（默认，最高 85%）或如 '75%' */
  height?: string;
  children: ReactNode;
}

/** 下拉关闭的位移阈值（px） */
export const DISMISS_THRESHOLD = 90;

export function SheetPortal({ open, onClose, title, height, children }: Props) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setDragY(0);
      setDragging(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

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
    if (dy > DISMISS_THRESHOLD) onClose();
    else setDragY(0);
  }

  return createPortal(
    <div className="msheet-mask" onClick={onClose}>
      <div
        className="msheet"
        role="dialog"
        aria-modal="true"
        style={{
          height: height ?? 'auto',
          maxHeight: '85%',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="msheet-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="msheet-handle" />
          {title && <div className="msheet-title">{title}</div>}
        </div>
        <div className="msheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
