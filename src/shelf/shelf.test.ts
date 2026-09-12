import { describe, it, expect } from 'vitest';
import { nextUntitledNumber } from './shelf';

describe('书架', () => {
  it('nextUntitledNumber: 空书架从 1 开始', () => {
    expect(nextUntitledNumber([])).toBe(1);
  });
  it('已有未命名1/未命名3 → 下一个为 4', () => {
    expect(nextUntitledNumber(['未命名1', '未命名3'])).toBe(4);
  });
  it('忽略非未命名标题与格式不符项', () => {
    expect(nextUntitledNumber(['我的故事', '未命名abc', '未命名'])).toBe(1);
  });
});
