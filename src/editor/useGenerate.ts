/**
 * 生成编排：上下文拼接 → 三候选并发 → 流式渲染 → 写入故事树。
 * 可取消（AbortController）；失败给出错误态。
 */
import { useRef } from 'react';
import { useStore } from '../store/useStore';
import { fullText } from '../worldtree/tree';
import { stitchContext } from './context';
import { generateCandidates } from '../provider/candidates';
import { createProvider } from '../provider/openai';
import { createMockProvider } from '../provider/mock';
import type { Provider } from '../provider/types';

const INSTRUCTION = '直接续写下面的文本。不要解释，不要总结，只输出续写正文。';

export function useGenerate() {
  const abortRef = useRef<AbortController | null>(null);

  function buildProvider(): Provider {
    const { baseUrl, apiKey, model } = useStore.getState().settings;
    // 未配置模型或显式填 mock 时使用演示服务
    if (!model || model === 'mock') return createMockProvider();
    return createProvider({ baseUrl, apiKey, model });
  }

  async function run(): Promise<void> {
    const s = useStore.getState();
    if (s.gen.phase === 'generating') return;

    const full = fullText(s.tree);
    const stitched = stitchContext(full, s.settings.contextWindow);
    useStore.setState({ memoryTruncated: stitched.truncated });

    const provider = buildProvider();
    const ac = new AbortController();
    abortRef.current = ac;

    s.beginGenerate();
    try {
      const candidates = await generateCandidates(provider, {
        context: stitched.context,
        instruction: INSTRUCTION,
        params: {
          temperature: s.settings.temperature,
          topP: s.settings.topP,
          maxTokens: s.settings.maxTokens,
        },
        onDelta: (_index, d) => useStore.getState().appendStream(d),
        signal: ac.signal,
      });
      useStore.getState().finishGenerate(candidates);
    } catch (e) {
      if (!ac.signal.aborted) {
        useStore.getState().failGenerate(e instanceof Error ? e.message : String(e));
      } else {
        useStore.getState().failGenerate('已取消');
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancel(): void {
    abortRef.current?.abort();
  }

  function generateFromInput(userText: string): Promise<void> {
    const s = useStore.getState();
    if (userText.trim()) {
      s.confirmEditedText(userText.trim());
    }
    return run();
  }

  function continueAfterRed(): Promise<void> {
    return run();
  }

  return { run, cancel, generateFromInput, continueAfterRed };
}

export { INSTRUCTION };
