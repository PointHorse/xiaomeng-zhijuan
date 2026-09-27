/**
 * 移动端壳层启用条件：Android 平台，或窗口宽度 < 768px（§0）。
 * 纯函数 + React Hook 两层：测试覆盖纯函数，Hook 负责响应 resize。
 */
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

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

/**
 * 低性能设备判定（阶段 3.5 §3 收紧）：核数与内存**同时**过低才判定。
 * 理由：CSS blur/玻璃在真机 GPU 上是合成器路径，中端机（6 核/6GB）完全可承载；
 * 旧版「或」条件会把 8 核 4GB 的普通手机误判（deviceMemory 在部分 WebView 上报偏低）。
 * 模拟器/software rendering 不在此判定内——用户可手动开启性能模式。
 */
export function isLowPerfDevice(nav: Navigator = navigator): boolean {
  const n = nav as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = n.deviceMemory ?? 8;
  return cores <= 4 && mem <= 4;
}

export interface PerfPreferences {
  /** 性能模式：显式设置 ?? 设备能力 */
  perfMode: boolean;
  /** 减少动画：强制开启 ?? 跟随系统 */
  reduceMotion: boolean;
}

/** 响应式读取性能偏好（性能模式/减少动画），供壳层与设置页共用 */
export function usePerfPreferences(): PerfPreferences {
  const performanceMode = useStore((s) => s.settings.performanceMode);
  const reduceMotionOverride = useStore((s) => s.settings.reduceMotionOverride);
  const [sysReduce, setSysReduce] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = (e: MediaQueryListEvent): void => setSysReduce(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return {
    perfMode: performanceMode ?? isLowPerfDevice(),
    reduceMotion: reduceMotionOverride ?? sysReduce,
  };
}
