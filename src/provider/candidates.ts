/**
 * 候选管理：三条候选并发独立请求（兼容不支持多候选采样的本地后端），
 * 温度轻微抖动（-0.1 / +0 / +0.1）保证差异度；单条失败自动重试一次。
 * 纯编排逻辑，Provider 依赖注入（测试时用 Mock）。
 */
import type { ChatMessage, GenParams, Provider } from './types';
import type { Candidate } from '../worldtree/tree';

export interface CandidateProgress {
  /** 完成的候选序号（0-2） */
  index: number;
  candidate: Candidate;
}

export interface GenerateCandidatesOptions {
  context: string;
  instruction: string;
  params: GenParams;
  /** 最多并发 3 条（可调小用于测试） */
  count?: number;
  /** 进度回调：某条候选完成 */
  onCandidate?: (p: CandidateProgress) => void;
  /** 流式增量回调（index, delta）；仅第一条用于正文流式渲染 */
  onDelta?: (index: number, delta: string) => void;
  signal: AbortSignal;
}

interface RunResult {
  index: number;
  ok: boolean;
  candidate?: Candidate;
  error?: string;
}

function jitter(index: number, base: number): number {
  const offsets = [-0.3, 0, 0.3];
  return Math.max(0, Math.min(2, +(base + offsets[index % 3]).toFixed(3)));
}

function makeCandidate(index: number, text: string): Candidate {
  return { id: `cand_${index}_${Date.now().toString(36)}`, text, createdAt: Date.now() };
}

/** 单条候选：失败自动重试一次 */
async function runOne(
  provider: Provider,
  index: number,
  messages: ChatMessage[],
  params: GenParams,
  signal: AbortSignal,
  onDelta?: (delta: string) => void,
): Promise<RunResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal.aborted) return { index, ok: false, error: '已取消' };
    let text = '';
    let failed: string | undefined;
    const maxTok = attempt === 0 ? params.maxTokens : params.maxTokens * 2;
    try {
      await provider.generate({
        messages,
        params: { ...params, temperature: jitter(index, params.temperature), maxTokens: maxTok },
        signal,
        handlers: {
          onDelta: (d) => {
            text += d;
            onDelta?.(d);
          },
          // 契约：onDone 携带全文；若 provider 未走流式，以此为准
          onDone: (full) => {
            if (!text) text = full;
          },
          onError: (m) => {
            failed = m;
          },
        },
      });
      // 推理型模型可能把生成长度耗在思考上：空正文视为失败并自动重试
      if (!failed && text.trim().length === 0) {
        failed = '模型未返回正文（可能已耗尽生成长度），建议在设置中调大「最大生成长度」';
      }
      if (!failed && text.trim().length > 0) {
        return { index, ok: true, candidate: makeCandidate(index, text) };
      }
      failed = failed ?? '空返回';
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }
    // 重试前小退避
    await new Promise((r) => setTimeout(r, 250));
  }
  return { index, ok: false, error: '生成失败（已重试一次）；若持续出现，请调大「最大生成长度」' };
}

/**
 * 并发生成 count 条候选。
 * 返回成功候选数组（按完成顺序）；全部失败时抛出聚合错误。
 */
export async function generateCandidates(
  provider: Provider,
  opts: GenerateCandidatesOptions,
): Promise<Candidate[]> {
  const count = Math.max(1, opts.count ?? 3);
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `${opts.instruction}\n${opts.context}`,
    },
  ];

  const runs = Array.from({ length: count }, (_, i) =>
    runOne(
      provider,
      i,
      messages,
      opts.params,
      opts.signal,
      i === 0 && opts.onDelta ? (d: string) => opts.onDelta?.(i, d) : undefined,
    ),
  );

  const results: RunResult[] = [];
  for (const p of runs) {
    const r = await p;
    results.push(r);
    if (r.ok && r.candidate) {
      opts.onCandidate?.({ index: r.index, candidate: r.candidate });
    }
  }

  const okResults = results.filter((r) => r.ok && r.candidate);
  if (okResults.length === 0) {
    const firstErr = results.find((r) => r.error)?.error ?? '全部候选生成失败';
    throw new Error(firstErr);
  }
  return okResults.map((r) => r.candidate as Candidate);
}
