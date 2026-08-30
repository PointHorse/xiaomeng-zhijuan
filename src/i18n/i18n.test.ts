import { describe, it, expect } from 'vitest';
import { zh, en, interpolate } from './dict';
import { tFor } from './useI18n';

describe('i18n 词典', () => {
  it('中英词典键完全一致（无缺漏）', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });

  it('所有值非空字符串', () => {
    for (const v of Object.values(zh)) expect(String(v).length).toBeGreaterThan(0);
    for (const v of Object.values(en)) expect(String(v).length).toBeGreaterThan(0);
  });

  it('插值替换占位符', () => {
    expect(interpolate('{n} 字', { n: 123 })).toBe('123 字');
    expect(interpolate('Saved at {t}', { t: '01-01 08:00' })).toBe('Saved at 01-01 08:00');
  });

  it('tFor: 按语言取词典', () => {
    expect(tFor('en').notSatisfied).toBe('Not satisfied?');
    expect(tFor('zh').notSatisfied).toBe('没有满意的？');
  });

  it('en 词典占位符与 zh 一致（防漏参）', () => {
    const ph = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(zh)) {
      expect(ph(en[k as keyof typeof en])).toBe(ph(zh[k as keyof typeof zh]));
    }
  });
});
