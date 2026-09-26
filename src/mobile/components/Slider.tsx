/**
 * Slider —— 数值滑杆（阶段 3 §3）：实时数值显示 + 预设档位吸附。
 * 吸附规则：目标值与任一 snapPoint 距离 ≤ step/2 时取该档位。
 */
import { ChangeEvent } from 'react';

export interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  /** 预设档位（拖动接近时吸附） */
  snapPoints?: number[];
  onChange: (v: number) => void;
}

export function snapToPoints(value: number, snapPoints: number[] | undefined, step: number): number {
  if (!snapPoints || snapPoints.length === 0) return value;
  for (const sp of snapPoints) {
    if (Math.abs(value - sp) <= step / 2) return sp;
  }
  return value;
}

export function Slider({ label, min, max, step, value, unit = '', snapPoints, onChange }: SliderProps): JSX.Element {
  function handle(e: ChangeEvent<HTMLInputElement>): void {
    const raw = Number(e.target.value);
    onChange(snapToPoints(raw, snapPoints, step));
  }
  return (
    <span className="mslider">
      <span className="mslider-head">
        <span className="mslider-label">{label}</span>
        <span className="mslider-value">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handle}
        aria-label={label}
      />
    </span>
  );
}
