/**
 * 小梦织卷 · 宣传视频配置
 * 1080p / 30fps / 约 80 秒 / Anthropic 式极简风格
 */

export const VIDEO = {
  fps: 30,
  width: 1920,
  height: 1080,
} as const;

/** 粉与白色板：粉白底、玫粉点缀、暖灰正文 */
export const C = {
  bg: '#FFF5F8', // 粉白
  ink: '#3D2B33', // 樱木深棕（粉调近黑）
  sub: '#B08A96', // 灰粉
  accent: '#FF7BA9', // 樱粉
  accentSoft: '#FFE3EE',
  card: '#FFFFFF',
  line: '#F9D8E4',
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
