import { describe, it, expect } from 'vitest';
import {
  isAndroidPlatform,
  shouldUseMobileShell,
  MOBILE_BREAKPOINT,
} from './platform';
import { mobileCopy, assertMobileCopyCompliance } from './copy';

describe('移动壳启用条件（§0）', () => {
  it('Android UA 恒为移动端，无论宽度', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
    expect(isAndroidPlatform(ua)).toBe(true);
    expect(shouldUseMobileShell(ua, 1920)).toBe(true);
  });

  it('桌面 UA：宽度 < 768 启用移动壳，≥ 768 用桌面壳', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36';
    expect(isAndroidPlatform(ua)).toBe(false);
    expect(shouldUseMobileShell(ua, 767)).toBe(true);
    expect(shouldUseMobileShell(ua, MOBILE_BREAKPOINT)).toBe(false);
    expect(shouldUseMobileShell(ua, 1200)).toBe(false);
  });
});

describe('移动端文案表合规（§1）', () => {
  it('不得出现「左侧/右侧/点击/Ctrl」等桌面词汇', () => {
    expect(assertMobileCopyCompliance(mobileCopy as unknown as Record<string, unknown>)).toEqual([]);
  });
});
