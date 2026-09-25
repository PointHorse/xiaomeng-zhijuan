// @vitest-environment jsdom
/**
 * BottomSheet 组件行为测试（规范见 docs/mobile-components.md §4）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { BottomSheet, SheetRow, SHEET_DISMISS_THRESHOLD } from './BottomSheet';

afterEach(cleanup);

function Harness({ onClose }: { onClose: () => void }): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <>
      <BottomSheet open={open} onClose={() => { onClose(); setOpen(false); }} title="选择风格">
        <SheetRow selected onClick={() => setOpen(false)}>脑洞大开</SheetRow>
        <SheetRow onClick={() => setOpen(false)}>默认</SheetRow>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet', () => {
  it('open 时经 portal 渲染标题与选项', () => {
    render(
      <BottomSheet open onClose={() => undefined} title="模型与风格">
        <SheetRow>mock</SheetRow>
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog', { name: '模型与风格' })).not.toBeNull();
    expect(screen.getByText('mock').closest('button')!.tagName).toBe('BUTTON');
  });

  it('Escape 触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="T">
        <SheetRow>x</SheetRow>
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('下拉超过阈值触发 onClose；未超过不关闭', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const grip = document.querySelector('.msheet2-grip')!;
    fireEvent.pointerDown(grip, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientY: 100 + SHEET_DISMISS_THRESHOLD + 10, pointerId: 1 });
    fireEvent.pointerUp(grip, { clientY: 100 + SHEET_DISMISS_THRESHOLD + 10, pointerId: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(grip, { clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(grip, { clientY: 130, pointerId: 2 });
    fireEvent.pointerUp(grip, { clientY: 130, pointerId: 2 });
    expect(onClose).toHaveBeenCalledTimes(1); // 未达阈值
  });

  it('open→false 后保留退场动画期，随后卸载', async () => {
    const { rerender } = render(
      <BottomSheet open onClose={() => undefined} title="T">
        <SheetRow>x</SheetRow>
      </BottomSheet>,
    );
    expect(document.querySelector('.msheet2')).not.toBeNull();
    rerender(
      <BottomSheet open={false} onClose={() => undefined} title="T">
        <SheetRow>x</SheetRow>
      </BottomSheet>,
    );
    // 退场动画期间仍在 DOM
    expect(document.querySelector('.msheet2')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('.msheet2')).toBeNull(), { timeout: 700 });
  });
});

describe('SheetRow', () => {
  it('selected 渲染 aria-selected 与勾选标记；未选中不标记', () => {
    render(
      <>
        <SheetRow selected>甲</SheetRow>
        <SheetRow>乙</SheetRow>
      </>,
    );
    const rows = screen.getAllByRole('button');
    expect(rows[0].getAttribute('aria-selected')).toBe('true');
    expect(rows[0].querySelector('.row-check')).not.toBeNull();
    // 未选中：无 aria-selected 属性（= false），勾选标记仅靠 CSS 控制可见性
    expect(rows[1].hasAttribute('aria-selected')).toBe(false);
    expect(rows[1].querySelector('.row-check')).not.toBeNull();
  });

  it('sub 说明行渲染', () => {
    render(<SheetRow sub="补充说明">标题</SheetRow>);
    expect(screen.getByText('补充说明')).not.toBeNull();
  });
});
