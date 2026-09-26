// @vitest-environment jsdom
/**
 * Switch / Slider 组件行为测试（阶段 3 §3）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { Switch } from './Switch';
import { Slider, snapToPoints } from './Slider';

vi.mock('./useHaptics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useHaptics')>();
  return { ...actual, haptic: vi.fn() };
});

afterEach(cleanup);

describe('Switch', () => {
  it('原生语义：role=switch 与 aria-checked 同步', () => {
    const { container, rerender } = render(<Switch checked={false} onChange={() => undefined} label="触感反馈" />);
    const sw = screen.getByRole('switch');
    expect(sw.tagName).toBe('BUTTON');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    rerender(<Switch checked onChange={() => undefined} label="触感反馈" />);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    void container;
  });

  it('点击切换并触发触感反馈', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="性能模式" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
    const { haptic } = await import('./useHaptics');
    expect(haptic).toHaveBeenCalledWith('selection');
  });

  it('禁用必须带原因且不可切换', () => {
    const onChange = vi.fn();
    render(
      <Switch checked={false} onChange={onChange} disabled disabledReason="低性能设备自动开启" label="性能模式" />,
    );
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('note').textContent).toBe('低性能设备自动开启');
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Slider 预设吸附', () => {
  it('接近预设档位时吸附（±step/2）', () => {
    expect(snapToPoints(0.62, [0.6, 0.9, 1.1], 0.1)).toBe(0.6);
    expect(snapToPoints(0.88, [0.6, 0.9, 1.1], 0.1)).toBe(0.9);
    expect(snapToPoints(0.75, [0.6, 0.9, 1.1], 0.1)).toBe(0.75); // 无档位附近，保持原值
    expect(snapToPoints(1.05, [800, 1500, 2500], 100)).toBe(1.05);
    expect(snapToPoints(1480, [800, 1500, 2500], 100)).toBe(1500);
  });

  it('滑杆渲染实时数值并响应变更', () => {
    function Harness(): JSX.Element {
      const [v, setV] = useState(0.9);
      return <Slider label="温度" min={0} max={2} step={0.1} value={v} onChange={setV} />;
    }
    render(<Harness />);
    expect(screen.getByText('0.9')).not.toBeNull();
    const input = screen.getByLabelText('温度') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.1' } });
    expect(screen.getByText('1.1')).not.toBeNull();
  });
});
