import { describe, it, expect } from 'vitest';
import { genLoadingPhase } from './loading';

describe('genLoadingPhase 状态机', () => {
  it('非生成态 = idle', () => {
    expect(genLoadingPhase(false, '')).toBe('idle');
    expect(genLoadingPhase(false, '有残留文本')).toBe('idle');
  });

  it('生成中且首字符未到 = skeleton（显示模糊占位+扫光）', () => {
    expect(genLoadingPhase(true, '')).toBe('skeleton');
  });

  it('流式字符到达 = resolving（占位渐清晰+淡出，与真实文字共存）', () => {
    expect(genLoadingPhase(true, '夜')).toBe('resolving');
    expect(genLoadingPhase(true, '夜深了，城市的霓虹灯')).toBe('resolving');
  });
});
