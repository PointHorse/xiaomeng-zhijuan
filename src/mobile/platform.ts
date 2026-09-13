/**
 * 移动端壳层启用条件：Android 平台，或窗口宽度 < 768px（§0）。
 * 纯函数 + React Hook 两层：测试覆盖纯函数，Hook 负责响应 resize。
 */
import { useEffect, useState } from 'react';

export const MOBILE_BREAKPOINT = 768;

export function isAndroidPlatform(ua: string = navigator.userAgent): boolean {
  return /android/i.test(ua);
}

export function isMobileWidth(width: number = window.innerWidth): boolean {
  return width < MOBILE_BREAKPOINT;
}

export function shouldUseMobileShell(
  ua: string = navigator.userAgent,
  width: number = window.innerWidth,
): boolean {
  return isAndroidPlatform(ua) || isMobileWidth(width);
}

/** 响应式 Hook：监听窗口宽度变化，Android 平台恒为 true */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => shouldUseMobileShell());
  useEffect(() => {
    if (isAndroidPlatform()) return;
    function onResize(): void {
      setMobile(shouldUseMobileShell());
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}
