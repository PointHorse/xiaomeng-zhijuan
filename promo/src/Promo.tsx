/** 小梦织卷 · 宣传视频主序列（Anthropic 式极简风） */
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { SCENES, sceneStart, sceneDuration, C } from './config';
import { Scene, BigTitle, BulletLines, Logo, SlideIn, UiMock } from './components';

/** 品牌 Logo 开场 */
const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pop = spring({ frame: frame - 5, fps, config: { damping: 12, stiffness: 110 } });
  const tagRise = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <Scene>
      <AbsoluteFill
        style={{
          display: 'grid',
          placeItems: 'center',
          opacity: fadeOut,
          transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}>
          <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})`, opacity: pop }}>
            <Logo scale={1.15} />
          </div>
          <div
            style={{
              opacity: interpolate(tagRise, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(tagRise, [0, 1], [30, 0])}px)`,
              fontSize: 58,
              color: C.ink,
              letterSpacing: '0.1em',
            }}
          >
            AI 续写，三个平行世界
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/** 痛点页 */
const PainScene: React.FC = () => (
  <SlideIn durationInFrames={sceneDuration(1)}>
    <Scene>
      <BigTitle
        text="写出一个好开头之后"
        sub="然后呢？"
      />
      <div
        style={{
          position: 'absolute',
          bottom: '18%',
          width: '100%',
          textAlign: 'center',
          fontSize: 30,
          color: C.sub,
        }}
      >
        写不下去 · 舍不得删 · 想看看别的可能
      </div>
    </Scene>
  </SlideIn>
);

/** 功能一：三候选 */
const CandidatesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cards = [
    { title: '狼的首领现身', tone: '写实' },
    { title: '屠夫反将一军', tone: '反转' },
    { title: '狼开口说人话', tone: '荒诞' },
  ];
  return (
    <SlideIn durationInFrames={sceneDuration(2)}>
      <Scene>
        <div style={{ position: 'absolute', top: '10%', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 62, color: C.ink, fontWeight: 500 }}>
            一个开头，<span style={{ color: C.accent }}>三个世界</span>
          </div>
          <div style={{ fontSize: 26, color: C.sub, marginTop: 18 }}>
            每次生成三条候选 · 点击即切换
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: '32%',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            gap: 40,
          }}
        >
          {cards.map((card, i) => {
            const rise = spring({ frame: frame - 30 - i * 15, fps, config: { damping: 200 } });
            return (
              <div
                key={i}
                style={{
                  width: 380,
                  height: 300,
                  background: C.card,
                  borderRadius: 16,
                  border: i === 1 ? `2.5px solid ${C.accent}` : `1px solid ${C.line}`,
                  padding: 36,
                  opacity: interpolate(rise, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(rise, [0, 1], [50, 0])}px)`,
                }}
              >
                <div style={{ fontSize: 18, color: C.accent, letterSpacing: '0.12em' }}>
                  候选 {String(i + 1)}
                </div>
                <div
                  style={{
                    fontSize: 34,
                    color: C.ink,
                    marginTop: 22,
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {card.title}
                </div>
                <div style={{ fontSize: 20, color: C.sub, marginTop: 18 }}>风味 · {card.tone}</div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '12%',
            width: '100%',
            textAlign: 'center',
            fontSize: 28,
            color: C.sub,
          }}
        >
          不满意？换一批。旧走向自动进入平行世界。
        </div>
      </Scene>
    </SlideIn>
  );
};

/** 功能二：平行世界树 */
const WorldTreeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nodes = [
    { d: 0, x: 960, y: 190, label: '开头' },
    { d: 0, x: 960, y: 400, label: '主线' },
    { d: -1, x: 620, y: 610, label: '平行 A' },
    { d: 1, x: 1300, y: 610, label: '平行 B' },
    { d: -1, x: 620, y: 810, label: '分支 A2' },
  ];
  return (
    <SlideIn durationInFrames={sceneDuration(3)}>
      <Scene>
        <div style={{ position: 'absolute', top: '8%', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 62, color: C.ink, fontWeight: 500 }}>
            每一次选择，<span style={{ color: C.accent }}>都是一个世界</span>
          </div>
          <div style={{ fontSize: 26, color: C.sub, marginTop: 18 }}>
            树状历史 · 点击穿越 · 分支永不丢失
          </div>
        </div>
        <svg
          width={1920}
          height={1080}
          style={{ position: 'absolute', inset: 0, opacity: 0.85 }}
        >
          {[
            [960, 240, 960, 400],
            [960, 440, 620, 610],
            [960, 440, 1300, 610],
            [620, 650, 620, 810],
          ].map(([x1, y1, x2, y2], i) => {
            const draw = interpolate(frame, [40 + i * 10, 60 + i * 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x1 + (x2 - x1) * draw}
                y2={y1 + (y2 - y1) * draw}
                stroke={C.line}
                strokeWidth={3}
              />
            );
          })}
        </svg>
        {nodes.map((n, i) => {
          const pop = spring({ frame: frame - 30 - i * 12, fps, config: { damping: 15 } });
          const current = i <= 1;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: n.x,
                top: n.y,
                transform: `translate(-50%,-50%) scale(${interpolate(pop, [0, 1], [0, 1])})`,
                background: current ? C.accent : C.card,
                color: current ? '#fff' : C.ink,
                border: current ? 'none' : `1.5px solid ${C.line}`,
                borderRadius: 14,
                padding: '18px 34px',
                fontSize: 26,
                fontWeight: current ? 600 : 400,
                boxShadow: '0 10px 30px rgba(25,25,25,0.12)',
              }}
            >
              {n.label}
            </div>
          );
        })}
      </Scene>
    </SlideIn>
  );
};

/** 功能三：本地模型接入 */
const LocalScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
  <SlideIn durationInFrames={sceneDuration(4)}>
    <Scene>
      <div style={{ position: 'absolute', top: '9%', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 62, color: C.ink, fontWeight: 500 }}>
          你的模型，<span style={{ color: C.accent }}>你的机器</span>
        </div>
        <div style={{ fontSize: 26, color: C.sub, marginTop: 18 }}>
          Ollama · LM Studio · llama.cpp · 任意 OpenAI 兼容端点
        </div>
      </div>
      <div style={{ position: 'absolute', top: '30%', width: '100%' }}>
        <UiMock label="设置 · 模型服务">
          <div style={{ padding: '36px 48px' }}>
            {[
              ['Base URL', 'http://127.0.0.1:11434/v1'],
              ['模型', 'qwen2.5:7b'],
              ['状态', '● 已连接 · 3ms'],
            ].map(([k, v], i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 24,
                  marginBottom: 26,
                  opacity: interpolate(frame, [20 + i * 12, 32 + i * 12], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                <div style={{ width: 150, fontSize: 22, color: C.sub }}>{k}</div>
                <div
                  style={{
                    flex: 1,
                    fontSize: 24,
                    color: C.ink,
                    background: C.bg,
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    padding: '10px 18px',
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 22, color: C.accent, marginTop: 8 }}>
              ✓ 三条命令接入 · 数据 100% 本地
            </div>
          </div>
        </UiMock>
      </div>
    </Scene>
  </SlideIn>
  );
};

/** 收尾页 */
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  return (
    <Scene>
      <AbsoluteFill
        style={{
          display: 'grid',
          placeItems: 'center',
          opacity: interpolate(rise, [0, 1], [0, 1]),
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
          <Logo scale={1.1} />
          <div style={{ fontSize: 48, color: C.ink, letterSpacing: '0.06em' }}>
            开源免费 · 一键安装
          </div>
          <div
            style={{
              fontSize: 32,
              color: C.accent,
              background: C.accentSoft,
              padding: '16px 44px',
              borderRadius: 999,
              fontFamily: 'Consolas, monospace',
            }}
          >
            github.com/PointHorse/xiaomeng-zhijuan
          </div>
          <div style={{ fontSize: 24, color: C.sub }}>
            Releases 页下载 · Windows 10 / 11 · 约 10MB
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/** 主序列：按 config.SCENES 顺序拼接 */
export const PromoSequence: React.FC = () => {
  const starts = SCENES.map((_, i) => sceneStart(i));
  const durs = SCENES.map((s) => s.sec * 30);
  const scenes = [LogoScene, PainScene, CandidatesScene, WorldTreeScene, LocalScene, OutroScene];
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {scenes.map((Sc, i) => {
        if (frame >= starts[i] && frame < starts[i] + durs[i]) {
          const scoped = (
            <Sequence key={i} from={starts[i]} durationInFrames={durs[i]} name={SCENES[i].id}>
              <Sc />
            </Sequence>
          );
          void scoped;
          // Remotion 的 Sequence 直接渲染即可
          return (
            <Sequence key={i} from={starts[i]} durationInFrames={durs[i]} name={SCENES[i].id}>
              <Sc />
            </Sequence>
          );
        }
        return null;
      })}
    </AbsoluteFill>
  );
};

import { Sequence } from 'remotion';
