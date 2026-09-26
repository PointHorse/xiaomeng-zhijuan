/**
 * Switch —— 单一设置的开/关切换（docs/mobile-components.md §1 语义规则）。
 * 原生语义 role="switch" + aria-checked；thumb 弹性缓动；整行触控区 ≥44dp；
 * 切换时触发触感反馈（Android，静默降级）；禁用必须说明原因。
 */
import { haptic } from './useHaptics';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 开关名称（可访问名称） */
  label: string;
  sub?: string;
  icon?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function Switch({ checked, onChange, label, sub, icon, disabled, disabledReason }: SwitchProps): JSX.Element {
  return (
    <span className="mswitch-wrap">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`mswitch-row ${disabled ? 'mswitch-row--disabled' : ''}`}
        onClick={() => {
          if (disabled) return;
          void haptic('selection');
          onChange(!checked);
        }}
      >
        <span className="mswitch-main">
          <span className="mswitch-label">
            {icon && <span className="mswitch-icon" aria-hidden="true">{icon}</span>}
            {label}
          </span>
          {sub && <span className="mswitch-sub">{sub}</span>}
        </span>
        <span className="mswitch-track" aria-hidden="true">
          <span className="mswitch-thumb" />
        </span>
      </button>
      {disabled && disabledReason && (
        <span className="mswitch-reason" role="note">
          {disabledReason}
        </span>
      )}
    </span>
  );
}
