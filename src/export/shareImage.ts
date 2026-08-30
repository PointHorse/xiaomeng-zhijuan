/**
 * Markdown 导出与分享长图（品牌风格 PNG，Canvas 原生绘制，零依赖）。
 */
import type { StoryTree } from '../worldtree/tree';
import { fullText, timeline } from '../worldtree/tree';

export function buildMdExport(title: string, tree: StoryTree): string {
  const nodes = timeline(tree);
  const head = `# ${title}\n\n> 小梦织卷 · ${nodes.length} 个节点 · ${new Date().toLocaleDateString('zh-CN')}\n\n---\n\n`;
  const body = fullText(tree)
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p) => p.trim())
    .join('\n\n');
  return head + body + '\n';
}

/** 把正文按宽度换行（中英文混排近似：CJK 记 1、半角记 0.55） */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    if (ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface ShareImageOptions {
  title: string;
  tree: StoryTree;
  /** 最长正文截取（超出省略） */
  maxChars?: number;
  dark?: boolean;
}

/** 品牌风格分享长图：珊瑚红头部 + 正文卡片 + 品牌页脚 */
export function renderShareImage(opts: ShareImageOptions): HTMLCanvasElement {
  const { title, tree, dark = false } = opts;
  const text = fullText(tree).slice(0, opts.maxChars ?? 1200);
  const W = 1080;
  const PAD = 72;
  const HEAD_H = 190;
  const FOOT_H = 120;
  const LINE_H = 44;
  const FONT = '22px "Microsoft YaHei", "PingFang SC", sans-serif';

  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = FONT;
  const lines = wrapText(probe, text, W - PAD * 2);
  const H = HEAD_H + PAD + lines.length * LINE_H + 40 + FOOT_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 背景
  ctx.fillStyle = dark ? '#1E1F22' : '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // 珊瑚红头部带
  const grad = ctx.createLinearGradient(0, 0, W, HEAD_H);
  grad.addColorStop(0, '#F0655A');
  grad.addColorStop(1, '#C83E34');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEAD_H);

  // 头部文字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 40px "Microsoft YaHei", sans-serif';
  ctx.fillText(title.slice(0, 20) || '小梦织卷', PAD, 86);
  ctx.font = '300 20px "Microsoft YaHei", sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText('Xiaomeng Weaver · AI Story Continuation', PAD, 130);
  ctx.globalAlpha = 1;

  // 正文
  ctx.fillStyle = dark ? '#E6E6E6' : '#303133';
  ctx.font = FONT;
  let y = HEAD_H + PAD + LINE_H;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += LINE_H;
  }

  // 截断省略提示
  if (fullText(tree).length > (opts.maxChars ?? 1200)) {
    ctx.fillStyle = dark ? '#9A9A9A' : '#909399';
    ctx.font = '18px "Microsoft YaHei", sans-serif';
    ctx.fillText('……', PAD, y);
    y += LINE_H;
  }

  // 页脚
  const footY = H - FOOT_H + 46;
  ctx.fillStyle = dark ? '#FF7A6E' : '#F0655A';
  ctx.font = '600 20px "Microsoft YaHei", sans-serif';
  ctx.fillText('小梦织卷', PAD, footY);
  ctx.fillStyle = dark ? '#9A9A9A' : '#909399';
  ctx.font = '400 16px "Microsoft YaHei", sans-serif';
  ctx.fillText('AI 续写 · 平行世界 · 本地模型', PAD + 110, footY);
  ctx.fillText('github.com/PointHorse/xiaomeng-zhijuan', PAD, footY + 28);

  return canvas;
}

/** 渲染并触发 PNG 下载 */
export function downloadShareImage(opts: ShareImageOptions): void {
  const canvas = renderShareImage(opts);
  const link = document.createElement('a');
  link.download = `${opts.title || '小梦织卷'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
