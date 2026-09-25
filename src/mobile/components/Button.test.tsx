// @vitest-environment jsdom
/**
 * Button 组件行为测试（规范见 docs/mobile-components.md §1）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Button } from './Button';

vi.mock('./useHaptics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useHaptics')>();
  return { ...actual, haptic: vi.fn() };
});

afterEach(cleanup);

describe('Button 语义与变体', () => {
  it('渲染原生 <button>（禁止 div 冒充）', () => {
    render(<Button variant="primary">保存更改</Button>);
    expect(screen.getByRole('button', { name: '保存更改' }).tagName).toBe('BUTTON');
  });

  it('变体类名正确应用', () => {
    const { container, rerender } = render(<Button variant="primary">A</Button>);
    expect(container.querySelector('button')!.className).toContain('m-btn--primary');
    rerender(<Button variant="danger">B</Button>);
    expect(container.querySelector('button')!.className).toContain('m-btn--danger');
    rerender(<Button variant="ghost">C</Button>);
    expect(container.querySelector('button')!.className).toContain('m-btn--ghost');
    rerender(<Button variant="secondary">D</Button>);
    expect(container.querySelector('button')!.className).toContain('m-btn--secondary');
  });
});

describe('Button 处理中与禁用', () => {
  it('loading 时阻止重复提交且 aria-busy', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button variant="primary" loading onClick={onClick}>
        保存更改
      </Button>,
    );
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.querySelector('.m-btn-spin')).not.toBeNull();
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled(); // 处理中完全阻止
  });

  it('禁用必须带原因：disabledReason 渲染为可见说明', () => {
    render(
      <Button variant="primary" disabled disabledReason="请先填写模型地址">
        开始续写
      </Button>,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('note').textContent).toBe('请先填写模型地址');
  });

  it('无 disabledReason 的禁用不渲染说明', () => {
    render(<Button disabled>开始续写</Button>);
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('Button 成功反馈', () => {
  it('successHint 以 role=status 渲染在按钮旁', () => {
    render(
      <Button variant="primary" successHint="✓ 已保存">
        保存更改
      </Button>,
    );
    expect(screen.getByRole('status').textContent).toBe('✓ 已保存');
  });
});

describe('Button 触感反馈', () => {
  it('primary 点击触发轻触感；其他变体不触发', async () => {
    const { haptic } = await import('./useHaptics');
    const onClick = vi.fn();
    const { container, rerender } = render(
      <Button variant="primary" onClick={onClick}>
        保存更改
      </Button>,
    );
    fireEvent.click(container.querySelector('button')!);
    await vi.waitFor(() => expect(haptic).toHaveBeenCalledWith('light'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Button variant="secondary" onClick={onClick}>B</Button>);
    fireEvent.click(screen.getByRole('button'));
    await new Promise((r) => setTimeout(r, 20));
    expect(haptic).toHaveBeenCalledTimes(1); // 未新增
  });
});

describe('haptic 分发', () => {
  it('selection/success/light 各路由到对应插件 API', async () => {
    const { dispatchHaptic } = await import('./useHaptics');
    const m = {
      selectionFeedback: vi.fn(),
      impactFeedback: vi.fn(),
      notificationFeedback: vi.fn(),
    };
    dispatchHaptic(m, 'selection');
    expect(m.selectionFeedback).toHaveBeenCalled();
    dispatchHaptic(m, 'light');
    expect(m.impactFeedback).toHaveBeenCalledWith('light');
    dispatchHaptic(m, 'success');
    expect(m.notificationFeedback).toHaveBeenCalledWith('success');
  });

  it('插件 API 缺失时不抛错（静默降级）', async () => {
    const { dispatchHaptic } = await import('./useHaptics');
    expect(() => dispatchHaptic({}, 'light')).not.toThrow();
  });
});
