/**
 * DeepSeek 外部 API 稳定性测试（走应用真实 Provider 代码路径）。
 * 密钥从环境变量 DEEPSEEK_API_KEY 读取，不落盘。
 */
import { describe, it, expect } from 'vitest';

/** Node 环境类型（项目 tsconfig 未含 @types/node） */
declare const process: { env: Record<string, string | undefined> };

const KEY = (process.env as Record<string, string | undefined>).DEEPSEEK_API_KEY ?? '';
const BASE = 'https://api.deepseek.com';
const MODEL = (process.env as Record<string, string | undefined>).DEEPSEEK_MODEL ?? 'deepseek-v4-flash';

const { createOpenAIProvider } = await import('./openai');

describe.skipIf(!KEY)('DeepSeek 外部 API 稳定性（真实端点）', () => {
  it('第 1 轮：流式生成（安塞腰鼓开头）', async () => {
    const p = createOpenAIProvider({ baseUrl: BASE, apiKey: KEY, model: MODEL });
    const c = { deltas: '', done: '', errors: [] as string[] };
    await p.generate({
      messages: [{
        role: 'user',
        content: '直接续写下面的文本。不要解释，不要总结，只输出续写正文。\n一群茂腾腾的后生。他们的身后是一片高粱地。咝溜溜的南风吹动了高粱叶子，也吹动了他们的衣衫。但是：看！——一捶起来就发狠了，忘情了，没命了！',
      }],
      params: { temperature: 0.9, topP: 0.92, maxTokens: 300 },
      handlers: {
        onDelta: (d) => (c.deltas += d),
        onDone: (full) => (c.done = full),
        onError: (m) => c.errors.push(m),
      },
      signal: new AbortController().signal,
    });
    expect(c.errors).toHaveLength(0);
    expect(c.done.length).toBeGreaterThan(50);
    expect(c.done).toBe(c.deltas);
    console.log(`[1] ${c.done.length} 字 | 开头: ${c.done.slice(0, 60)}`);
  });

  it('第 2 轮：不同题材（都市）', async () => {
    const p = createOpenAIProvider({ baseUrl: BASE, apiKey: KEY, model: MODEL });
    const c = { deltas: '', done: '', errors: [] as string[] };
    await p.generate({
      messages: [{
        role: 'user',
        content: '直接续写下面的文本。不要解释，不要总结，只输出续写正文。\n凌晨两点的便利店，自动门叮咚一响，走进来一个浑身湿透的男人。',
      }],
      params: { temperature: 0.75, topP: 0.92, maxTokens: 300 },
      handlers: {
        onDelta: (d) => (c.deltas += d),
        onDone: (full) => (c.done = full),
        onError: (m) => c.errors.push(m),
      },
      signal: new AbortController().signal,
    });
    expect(c.errors).toHaveLength(0);
    expect(c.done.length).toBeGreaterThan(50);
    console.log(`[2] ${c.done.length} 字 | 开头: ${c.done.slice(0, 60)}`);
  });

  it('第 3 轮：连续两次生成（模拟接力）', { timeout: 120000 }, async () => {
    const p = createOpenAIProvider({ baseUrl: BASE, apiKey: KEY, model: MODEL });
    let context = '直接续写下面的文本。不要解释，不要总结，只输出续写正文。\n老周把渔网撒进江里，等了半晌，网沉甸甸的。';
    for (let round = 1; round <= 2; round++) {
      const c = { deltas: '', done: '', errors: [] as string[] };
      await p.generate({
        messages: [{ role: 'user', content: context }],
        params: { temperature: 0.9, topP: 0.92, maxTokens: 250 },
        handlers: {
          onDelta: (d) => (c.deltas += d),
          onDone: (full) => (c.done = full),
          onError: (m) => c.errors.push(m),
        },
        signal: new AbortController().signal,
      });
      expect(c.errors).toHaveLength(0);
      context += c.done.slice(0, 200);
      console.log(`[3-${round}] ${c.done.length} 字 | 结尾: …${c.done.slice(-40)}`);
    }
  });

  it('错误路径：无效模型名 → onError（不抛系统异常）', async () => {
    const p = createOpenAIProvider({ baseUrl: BASE, apiKey: KEY, model: '不存在的模型' });
    const c = { errors: [] as string[] };
    await p.generate({
      messages: [{ role: 'user', content: 'x' }],
      params: { temperature: 1, topP: 1, maxTokens: 10 },
      handlers: {
        onDelta: () => {},
        onDone: () => {},
        onError: (m) => c.errors.push(m),
      },
      signal: new AbortController().signal,
    });
    expect(c.errors.length).toBeGreaterThan(0);
    console.log(`[4] 错误路径正常: ${c.errors[0].slice(0, 80)}`);
  });
});
