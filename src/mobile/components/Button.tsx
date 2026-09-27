/**
 * Button —— 语义优先的按钮（docs/design-language.md §3.5、组件文档 docs/mobile-components.md §1）。
 *
 * 规则摘要：
 * - 动作用 <Button>；跳转地址用 <Link>；单一设置切换用 <Switch>（阶段 2 落地）。
 * - 变体按动作优先级：primary（每屏至多一个）/ secondary / danger（删除类，必须二次确认）/ ghost。
 * - 状态：默认 → 按压（scale 0.97 + 色加深，100ms）→ 处理中（loading，阻止重复提交）→
 *   成功（successHint 短暂显示）/ 失败（由调用方以可读原因提示）。
 * - 禁用必须给 disabledReason，不能只是变灰。
 * - 文案写动作本身（"保存更改"），禁用"确定/提交"类含糊词。
 * - 触控区 ≥44dp；primary 触发轻触感反馈（不可用时静默降级）。
 */
import { ButtonHTMLAttributes, ReactNode, useState } from 'react';
import { haptic } from './useHaptics';
import './components.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  /** 处理中：显示 spinner 并阻止重复提交 */
  loading?: boolean;
  /** 成功反馈：按钮旁短暂显示（如"已保存"），由调用方控制显隐 */
  successHint?: string;
  /** 禁用原因：禁用时必须说明，不能只是变灰 */
  disabledReason?: string;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  successHint,
  disabledReason,
  className,
  disabled,
  onClick,
  children,
  ...rest
}: ButtonProps): JSX.Element {
  const [ringKey, setRingKey] = useState(0);
  const isDisabled = disabled || loading;
  const cls = ['m-btn', `m-btn--${variant}`, size === 'sm' ? 'm-btn--sm' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  const btn = (
    <button
      type="button"
      className={cls}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      onClick={(e) => {
        if (isDisabled) return;
        // 珊瑚红胶囊描边环（阶段 3.5 §6）：内侧 3px 白线绕行 350ms 后淡出
        if (variant === 'primary') {
          void haptic('light');
          setRingKey((k) => k + 1);
        }
        void onClick?.(e);
      }}
      {...rest}
    >
      {variant === 'primary' && ringKey > 0 && (
        <svg key={ringKey} className="m-btn-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="97" height="97" rx="12" ry="18" pathLength="100" />
        </svg>
      )}
      {loading && <span className="m-btn-spin" aria-hidden="true" />}
      <span className={loading ? 'm-btn-loading-text' : undefined}>{children}</span>
    </button>
  );

  const hint =
    successHint !== undefined && successHint !== '' ? (
      <span className="m-btn-result" role="status">
        {successHint}
      </span>
    ) : null;

  if (isDisabled && disabledReason) {
    return (
      <span className="m-btn-wrap">
        {btn}
        <span className="m-btn-reason" role="note">
          {disabledReason}
        </span>
        {hint}
      </span>
    );
  }
  return hint ? (
    <span className="m-btn-wrap">
      {btn}
      {hint}
    </span>
  ) : (
    btn
  );
}
