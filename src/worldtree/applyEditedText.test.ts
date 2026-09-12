import { describe, it, expect } from 'vitest';
import { createTree, growWithCandidates, applyEditedText, fullText } from './tree';

function build() {
  const t = createTree('从前有座山。');
  growWithCandidates(t, [{ id: 'c1', text: '山里有座庙。', createdAt: 1 }], 0);
  growWithCandidates(t, [{ id: 'c2', text: '庙里有口井。', createdAt: 2 }], 0);
  return t;
}

describe('applyEditedText（DCR② 正文就地编辑）', () => {
  it('只编辑 tip 节点：前缀节点不动', () => {
    const t = build();
    applyEditedText(t, '从前有座山。山里有座庙。庙里根本就没有井。');
    expect(fullText(t)).toBe('从前有座山。山里有座庙。庙里根本就没有井。');
    expect(t.nodes[t.nodes[t.currentId].parentId!].text).toBe('山里有座庙。'); // 前缀节点未动
  });

  it('编辑中部节点：fullText 正确（切片按原长度分配）', () => {
    const t = build();
    applyEditedText(t, '从前有片海。海里有条龙。庙里有口井。');
    expect(fullText(t)).toBe('从前有片海。海里有条龙。庙里有口井。');
  });

  it('大幅增长：tip 吸收全部差值', () => {
    const t = build();
    const tail = '井底有本无字天书。'.repeat(50);
    applyEditedText(t, '从前有座山。山里有座庙。' + tail);
    expect(fullText(t)).toBe('从前有座山。山里有座庙。' + tail);
  });

  it('大幅删减：tip 吸收（可能为空），fullText 正确', () => {
    const t = build();
    applyEditedText(t, '只剩一句。');
    expect(fullText(t)).toBe('只剩一句。');
  });

  it('相同文本：不变', () => {
    const t = build();
    applyEditedText(t, '从前有座山。山里有座庙。庙里有口井。');
    expect(fullText(t)).toBe('从前有座山。山里有座庙。庙里有口井。');
  });

  it('编辑后续写：上下文以编辑后正文为准（fullText 即上下文来源）', () => {
    const t = build();
    applyEditedText(t, '从前有座山。山里有座庙。庙里的老和尚把井改成了泳池。');
    const ctx = fullText(t);
    expect(ctx).toContain('泳池');
    expect(ctx).not.toContain('井。');
  });
});
