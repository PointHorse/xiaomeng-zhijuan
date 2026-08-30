import { describe, it, expect } from 'vitest';
import { createTree, growWithCandidates } from '../worldtree/tree';
import { buildJsonExport, buildTxtExport, parseJsonExport } from './exporters';

function makeTree() {
  const t = createTree('从前有座山。');
  growWithCandidates(t, [{ id: 'c1', text: '山里有座庙。', createdAt: 1 }], 0);
  return t;
}

describe('导出器', () => {
  it('JSON 导出可往返解析', () => {
    const t = makeTree();
    const raw = buildJsonExport('测试故事', t);
    const parsed = parseJsonExport(raw);
    expect(parsed.title).toBe('测试故事');
    expect(parsed.tree.currentId).toBe(t.currentId);
  });

  it('TXT 导出包含标题与全文', () => {
    const raw = buildTxtExport('测试', makeTree());
    expect(raw).toContain('测试');
    expect(raw).toContain('从前有座山。');
    expect(raw).toContain('山里有座庙。');
  });

  it('parseJsonExport 拒绝非本应用格式', () => {
    expect(() => parseJsonExport('{"hello":1}')).toThrow();
    expect(() => parseJsonExport('not json')).toThrow();
  });
});
