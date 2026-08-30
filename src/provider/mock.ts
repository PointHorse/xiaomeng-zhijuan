/**
 * Mock Provider：无任何模型/网络时演示完整链路。
 * 确定性的假续写（基于输入哈希挑模板），供开发调试与开箱体验。
 */
import type { GenRequest, Provider } from './types';

const OPENINGS = [
  '夜风掠过高粱地，叶子沙沙作响，像是谁在暗处低声数着拍子。',
  '灯芯爆了个花，影子在墙上晃了三晃，又归于平静。',
  '远处的锣声停了，只剩檐角铁马叮当作响。',
  '雪粒子打在窗纸上，簌簌地，像谁在撒一把粗盐。',
];

const BODY = [
  '他没有立刻去看那扇门，而是先把灯芯挑亮了些——亮光不至于照见脸，却足够看清对方的手。',
  '门外的人咳了一声，声音压得很低，像是怕惊动了什么。\n"我知道你在里面。"他说，"我有话，只说给你一个人听。"',
  '桌上那盏茶早就凉透了，浮着一层薄薄的灰。谁也没有去动它——动茶的人，一定是有事相求；倒茶的人，一定是有话想说。',
  '雨又下起来了。这一次不是急雨，是那种能把人困在原地说不出话的绵绵长雨。',
];

const ENDINGS = [
  '故事到这里，才刚刚开始。',
  '可谁也没有注意到，屋檐下还站着第三个人。',
  '而他袖中那封信，终究没有递出去。',
  '灯花又爆了一声。这一次，连影子都停住了。',
];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 生成一条确定性假续写（salt 不同 → 候选不同；salt 取温度×10 的抖动值） */
export function mockContinuation(context: string, salt: number): string {
  const h = hash(context + salt);
  const a = OPENINGS[h % OPENINGS.length];
  const b = BODY[(h >> 3) % BODY.length];
  const c = ENDINGS[(h >> 6) % ENDINGS.length];
  return `${a}${b}${c}`;
}

/** 把 context 的尾部当作"用户输入的故事开头" */
export function createMockProvider(): Provider {
  return {
    kind: 'mock',
    async generate(req: GenRequest): Promise<void> {
      const last = [...req.messages].reverse().find((m) => m.role === 'user');
      const context = last?.content ?? '';
      // 以温度为盐（候选编排层对三条候选做 ±0.1 抖动 → 三条候选互不相同）
      const full = mockContinuation(context, Math.round(req.params.temperature * 10));
      // 模拟流式：按字符分片吐出
      const step = 8;
      for (let i = 0; i < full.length; i += step) {
        if (req.signal.aborted) {
          req.handlers.onError('已取消');
          return;
        }
        req.handlers.onDelta(full.slice(i, i + step));
        await new Promise((r) => setTimeout(r, 12));
      }
      req.handlers.onDone(full);
    },
  };
}
