/**
 * 功能 A② · 文风分析 skill（内置元提示词）
 *
 * 设计目标：让**本地小模型**（4B 级）也能稳定产出结构化风格提示词。
 * 防呆约束：
 *  - 强制分段标签输出（【叙事视角】…），小模型照标签填空而非自由发挥
 *  - 每段给定"写什么+写几句"的硬指令
 *  - 明确禁止清单（不分析情节、不剧透、不复述原文、不评价好坏）
 *  - 输出后由 parseStylePrompt 做结构校验，失败自动降级为模板兜底
 */

/** 元提示词（skill 本体） */
export const STYLE_ANALYST_PROMPT = `你是一名文风分析师。用户会给你一篇文章。你的唯一任务：输出一份"系统提示词"，让另一个 AI 模仿这篇文章的写作风格来续写故事。

严格按以下六个标签分段输出，每个标签一段，不使用其他格式：

【叙事视角】
用 1-2 句话说明：文章用什么人称和视角（如"第三人称过去式，镜头跟随单一主角"），场景切换方式（如"以对话为枢纽跳切"）。

【句式节奏】
用 2-3 句话说明：平均句长（短促/绵长）、段落长度、对话与叙述的比例（如"对话占七成"）、是否有重复句式或排比习惯。

【用词习惯】
用 2-3 句话说明：词汇难度与领域偏好（口语/书面/混搭）、标志性用词或口头禅、数字与细节的使用习惯（如"爱用精确到荒谬的数字"）、标点习惯。

【对话密度】
用 1-2 句话说明：对话占比、对话风格（如"对白里夹带长篇讲述""对话推动全部情节"）。

【情感基调】
用 1-2 句话说明：整体氛围（荒诞/热血/阴郁/温馨等）、幽默感的类型、严肃与恶搞的混合方式。

【风格指令】
把以上特征整合成 3-5 条祈使句指令，以"续写时请……"开头，直接命令写作模型执行。

禁止事项：
- 不要复述文章情节，不要提到任何具体人名和事件
- 不要评价文章好坏
- 不要输出标签以外的任何内容（无开场白、无总结语）
- 每个标签下的内容必须是"风格特征"而不是"内容摘要"`;

/** 从文章中截取送入分析的安全长度（小模型上下文有限） */
export const ANALYSIS_MAX_CHARS = 6000;

/** 组装分析请求的 user 消息 */
export function buildAnalysisUserMessage(article: string): string {
  const clipped = article.length > ANALYSIS_MAX_CHARS ? article.slice(0, ANALYSIS_MAX_CHARS) : article;
  return `${STYLE_ANALYST_PROMPT}\n\n【待分析文章】\n${clipped}`;
}

const REQUIRED_SECTIONS = ['【叙事视角】', '【句式节奏】', '【用词习惯】', '【对话密度】', '【情感基调】', '【风格指令】'] as const;

/**
 * 解析模型输出 → 风格系统提示词。
 * 校验：六个标签齐全。缺失时降级：用已有段落拼装；全缺则返回 null（调用方走模板兜底）。
 * 同时剥掉小模型可能加的开场白/结语（防呆）。
 */
export function parseStylePrompt(modelOutput: string): string | null {
  if (!modelOutput || !modelOutput.includes('【')) return null;
  // 提取从第一个标签起到最后一个非空行
  const first = modelOutput.indexOf('【');
  let text = modelOutput.slice(first).trim();
  // 剥掉常见的多余包裹
  text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();

  const present = REQUIRED_SECTIONS.filter((s) => text.includes(s));
  if (present.length < 3) return null; // 防呆：连一半标签都没有 → 不可信

  // 若缺少个别段落，补一条通用指令占位，保证"风格指令"段存在
  if (!text.includes('【风格指令】')) {
    text += '\n\n【风格指令】\n续写时请严格保持上述文风特征，只输出正文。';
  }
  return text.trim();
}

/** 模板兜底：解析失败时用通用荒诞风格模板（保证功能永远有产出） */
export function fallbackStylePrompt(): string {
  return [
    '【叙事视角】',
    '第三人称过去式，镜头跟随主要角色，场景以对话为枢纽切换。',
    '',
    '【句式节奏】',
    '短句为主，段落偏短。对话与叙述交替出现，偶尔用重复句式制造节奏感。',
    '',
    '【用词习惯】',
    '口语化，带夸张色彩，爱用具体到荒谬的数字和现代与古典混搭的名词。',
    '',
    '【对话密度】',
    '对话密集，人物在对话中讲述离题的长段故事。',
    '',
    '【情感基调】',
    '一本正经的荒诞：情节离谱但人物反应严肃，偶尔穿插真诚的落魄感。',
    '',
    '【风格指令】',
    '续写时请保持以上文风：多用对白推进、设定大胆混搭、数字具体而离谱、因果不必合理但语气必须认真。只输出正文。',
  ].join('\n');
}

/** 一步到位：模型输出 → 可入库存储的系统提示词（null 时调用方用兜底） */
export function extractStylePrompt(modelOutput: string): { prompt: string; usedFallback: boolean } {
  const parsed = parseStylePrompt(modelOutput);
  if (parsed) return { prompt: parsed, usedFallback: false };
  return { prompt: fallbackStylePrompt(), usedFallback: true };
}
