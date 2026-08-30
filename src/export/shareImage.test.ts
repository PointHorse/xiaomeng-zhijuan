import { describe, it, expect } from 'vitest';
import { createTree, growWithCandidates } from '../worldtree/tree';
import { buildMdExport } from './shareImage';

function makeTree() {
  const t = createTree('夜色降临。');
  growWithCandidates(t, [{ id: 'c1', text: '街灯亮起，雨丝斜织。', createdAt: 1 }], 0);
  return t;
}

describe('Markdown 导出', () => {
  it('包含标题、正文与分隔', () => {
    const md = buildMdExport('测试', makeTree());
    expect(md).toContain('# 测试');
    expect(md).toContain('夜色降临。');
    expect(md).toContain('街灯亮起，雨丝斜织。');
    expect(md).toContain('---');
  });

  it('空段落被过滤', () => {
    const md = buildMdExport('t', makeTree());
    expect(md).not.toContain('\n\n\n');
  });
});
