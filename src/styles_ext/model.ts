/**
 * 功能 A · 风格系统数据模型
 * {名称, 风格系统提示词, 源文章原文}；选中风格 → 其系统提示词注入续写请求。
 */

export interface StylePreset {
  id: string;
  name: string;
  /** 生效时注入请求的 system prompt */
  systemPrompt: string;
  /** 生成此提示词所用的源文章（自定义风格可查看/编辑后重新生成） */
  sourceArticle: string;
  /** 内置风格不可删除/重命名 */
  builtin: boolean;
  createdAt: number;
}

/** 内置风格：脑洞大开（源文章 = 老小梦三国荒诞接龙节选，萃取其文风特征） */
export const BUILTIN_WILD: StylePreset = {
  id: 'style_builtin_wild',
  name: '脑洞大开',
  systemPrompt: [
    '你是"脑洞大开"风格的小说续写引擎。请延续用户给出的故事，严格遵守：',
    '1. 视角与节奏：多用对白推进，人物在对话里讲长段离题的故事；情节高频突转，几乎每两三段就抛出新设定。',
    '2. 设定混搭：历史人物、现代事物（啤酒、冰淇淋、天气预报、军衔）与战争、科举等古典元素毫无过渡地混用；数字要具体而离谱（"五千多年有期徒刑""百分之八十七点二九五"）。',
    '3. 因果逻辑：不追求合理，追求"一本正经地胡说八道"——人物对荒谬事件的反应永远严肃认真。',
    '4. 用词：口语化、夸张化，爱用"竟然、居然、足足、直接"等强调词；允许重复句式形成排比惯性。',
    '5. 情感底色：在胡闹中偶尔冒出真诚的落魄感与兄弟义气（"信任我这样的穷鬼，对你来说是耻辱还是荣幸"），随即又被新的荒诞冲淡。',
    '6. 只输出续写正文，不解释，不总结，不跳出故事。',
  ].join('\n'),
  sourceArticle: [
    '"你说李逵什么时候能打过孙悟空？"吕蒙用铁筷子在锅中涮菜，吃着火炭，喝着啤酒，向孙权问道。',
    '"谁啊，你认识？"孙权一口气把半条鱼塞进肚子里。',
    '"我的同学李大蛋因此被判了五千多年有期徒刑，后来被有罪释放，接着又被判了七十四万年的有期徒刑。"',
    '"这个时代的汉室，很重视科举，科举之人会被朝廷高薪聘为官员。军校的训练方式是比武招亲，一般由女孩子获胜，然后就可以娶到她。在比武中，男女双方只有一人能活着走出去。"',
    '"敌人开出的价码是一百五十五万五千三百块，就要你这颗脑袋。要不我拿五十五万，这些钱足够买五个亿的五十万了。"',
    '"可以啊，我本就是一个卑鄙无耻、下贱肮脏、无恶不作、没有良心、人神共弃的人渣，死不足惜。"',
    '"江阴的大雪伴随着大雾……水底的温度极高，是零下六摄氏度……夏季的气温更是高达三百五十摄氏度，即使光着膀子也会被冻得牙齿发痒。"',
    '"信任我这样的穷鬼，对你来说，究竟是耻辱，还是荣幸？"',
    '"是荣幸，每时每刻……"',
  ].join('\n'),
  builtin: true,
  createdAt: 0,
};

/** 内置风格：默认（无系统提示词 = 纯净续写，行为与 v0.1.0 一致） */
export const BUILTIN_DEFAULT: StylePreset = {
  id: 'style_builtin_default',
  name: '默认',
  systemPrompt: '',
  sourceArticle: '',
  builtin: true,
  createdAt: -1,
};

/** 全部内置风格（列表头部） */
export function builtinStyles(): StylePreset[] {
  return [BUILTIN_DEFAULT, BUILTIN_WILD];
}

/** 校验自定义风格入参 */
export function validateCustomStyle(name: string, systemPrompt: string, sourceArticle: string): string | null {
  if (!name.trim()) return '风格名称不能为空';
  if (name.length > 40) return '风格名称过长（≤40 字）';
  if (!systemPrompt.trim()) return '风格提示词为空（分析失败或源文章太短）';
  if (systemPrompt.length > 4000) return '风格提示词过长（≤4000 字）';
  if (sourceArticle.trim().length < 50) return '源文章太短（至少 50 字），无法可靠分析文风';
  return null;
}
