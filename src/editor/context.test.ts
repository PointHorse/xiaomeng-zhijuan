import { describe, it, expect } from 'vitest';
import { stitchContext } from './context';

describe('上下文拼接', () => {
  it('未超限：原样返回', () => {
    const r = stitchContext('一二三四五', 10);
    expect(r.context).toBe('一二三四五');
    expect(r.truncated).toBe(false);
    expect(r.usedChars).toBe(5);
  });

  it('超限：取末尾 maxChars 字', () => {
    const text = '一二三四五六七八九十';
    const r = stitchContext(text, 4);
    expect(r.context).toBe('七八九十');
    expect(r.truncated).toBe(true);
    expect(r.usedChars).toBe(4);
  });

  it('maxChars 最小为 1', () => {
    const r = stitchContext('abc', 0);
    expect(r.usedChars).toBe(1);
  });

  it('不拆散代理对（emoji）', () => {
    // 😀 是代理对（2 个 UTF-16 code unit）
    const text = 'a😀b';
    const r = stitchContext(text, 2);
    // 从尾部取 2 个 code unit：会落在代理对上 → 回退
    // text.length = 4 ('a', hi, lo, 'b')；slice(-2) = (lo, 'b') → 回退到 hi 开始 → '😀b'
    expect(r.context).toBe('😀b');
  });

  it('恰好等于上限：不截断', () => {
    const r = stitchContext('12345', 5);
    expect(r.truncated).toBe(false);
  });
});
