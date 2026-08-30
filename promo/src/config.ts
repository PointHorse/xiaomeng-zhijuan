/**
 * 小梦织卷 · 宣传视频配置
 * 1080p / 30fps / 约 80 秒 / Anthropic 式极简风格
 */

export const VIDEO = {
  fps: 30,
  width: 1920,
  height: 1080,
} as const;

/** Anthropic 式色板：米白底、赭红点缀、暖灰正文 */
export const C = {
  bg: '#F7F4EE', // 米白
  ink: '#191919', // 近黑
  sub: '#6B675E', // 暖灰
  accent: '#D97757', // 赭红（Anthropic 风）
  accentSoft: '#F5E6DF',
  card: '#FFFFFF',
  line: '#E5E0D5',
};

/** 每页时长（秒）→ 帧数 */
export const SCENES = [
  { id: 'logo', sec: 7 },
  { id: 'pain', sec: 8 },
  { id: 'feature-candidates', sec: 12 },
  { id: 'feature-worldtree', sec: 12 },
  { id: 'feature-local', sec: 12 },
  { id: 'outro', sec: 9 },
] as const;

export const totalDurationSec = SCENES.reduce((a, s) => a + s.sec, 0);

/** 场景 i 的起始帧 */
export function sceneStart(index: number): number {
  let f = 0;
  for (let i = 0; i < index; i++) f += SCENES[i].sec;
  return f * VIDEO.fps;
}

export function sceneDuration(index: number): number {
  return SCENES[index].sec * VIDEO.fps;
}

export const totalFrames = totalDurationSec * VIDEO.fps;
