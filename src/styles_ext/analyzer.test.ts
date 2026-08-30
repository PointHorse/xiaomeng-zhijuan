import { describe, it, expect } from 'vitest';
import {
  STYLE_ANALYST_PROMPT,
  buildAnalysisUserMessage,
  parseStylePrompt,
  fallbackStylePrompt,
  extractStylePrompt,
  ANALYSIS_MAX_CHARS,
} from './analyzer';
import { builtinStyles, BUILTIN_WILD, validateCustomStyle } from './model';

describe('风格数据模型', () => {
  it('内置风格：默认在前、脑洞大开带完整提示词', () => {
    const styles = builtinStyles();
    expect(styles[0].name).toBe('默认');
    expect(styles[0].systemPrompt).toBe('');
    expect(styles[1].name).toBe('脑洞大开');
    expect(BUILTIN_WILD.systemPrompt).toContain('脑洞大开');
    expect(BUILTIN_WILD.systemPrompt).toContain('只输出续写正文');
    expect(BUILTIN_WILD.sourceArticle).toContain('李逵');
    expect(styles.every((s) => s.builtin)).toBe(true);
  });

  it('自定义风格校验', () => {
    expect(validateCustomStyle('', 'p', 'a'.repeat(60))).toContain('名称');
    expect(validateCustomStyle('名', '', 'a'.repeat(60))).toContain('提示词为空');
    expect(validateCustomStyle('名', 'p', '短')).toContain('太短');
    expect(validateCustomStyle('名', 'p', 'a'.repeat(60))).toBeNull();
  });
});

describe('文风分析 skill', () => {
  it('元提示词含六标签与禁止事项', () => {
    for (const tag of ['【叙事视角】', '【句式节奏】', '【用词习惯】', '【对话密度】', '【情感基调】', '【风格指令】']) {
      expect(STYLE_ANALYST_PROMPT).toContain(tag);
    }
    expect(STYLE_ANALYST_PROMPT).toContain('不要复述');
  });

  it('buildAnalysisUserMessage：长文章截断到安全长度', () => {
    const long = '字'.repeat(ANALYSIS_MAX_CHARS + 500);
    const msg = buildAnalysisUserMessage(long);
    expect(msg).toContain('【待分析文章】');
    expect(msg).toContain(STYLE_ANALYST_PROMPT);
    expect(msg.length).toBeLessThan(ANALYSIS_MAX_CHARS + STYLE_ANALYST_PROMPT.length + 100);
  });

  it('parseStylePrompt：标准六段输出 → 原样通过', () => {
    const out = ['【叙事视角】第三人称。', '【句式节奏】短句。', '【用词习惯】口语。', '【对话密度】高。', '【情感基调】荒诞。', '【风格指令】续写时请保持。'].join('\n');
    expect(parseStylePrompt(out)).toBe(out);
  });

  it('parseStylePrompt：带开场白/代码块包裹 → 剥离后通过（防呆）', () => {
    const out = '好的，以下是分析：\n```\n【叙事视角】第三人称。\n【句式节奏】短句。\n【用词习惯】口语。\n【对话密度】高。\n【情感基调】荒诞。\n【风格指令】续写时请保持。\n```';
    const r = parseStylePrompt(out);
    expect(r).toContain('【叙事视角】');
    expect(r).not.toContain('好的');
    expect(r).not.toContain('```');
  });

  it('parseStylePrompt：缺个别段落 → 自动补风格指令段', () => {
    const out = '【叙事视角】A\n【句式节奏】B\n【用词习惯】C\n【对话密度】D\n【情感基调】E';
    const r = parseStylePrompt(out);
    expect(r).toContain('【风格指令】');
  });

  it('parseStylePrompt：完全乱来（少于3个标签）→ null', () => {
    expect(parseStylePrompt('我觉得这篇文章写得很搞笑，主角是吕蒙。')).toBeNull();
    expect(parseStylePrompt('')).toBeNull();
  });

  it('extractStylePrompt：失败时走模板兜底且 usedFallback 标记', () => {
    const r = extractStylePrompt('模型胡言乱语');
    expect(r.usedFallback).toBe(true);
    expect(r.prompt).toBe(fallbackStylePrompt());
    expect(r.prompt).toContain('【风格指令】');
  });
});
