/** Anthropic 式场景通用组件：衬线大字、spring 入场、克制的动效 */
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { C } from './config';

export function Scene({
  children,
  bg = C.bg,
}: {
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <AbsoluteFill style={{ background: bg, fontFamily: 'Georgia, "Songti SC", "SimSun", serif' }}>
      {children}
    </AbsoluteFill>
  );
}

/** 标题：spring 缓动上浮 */
export function BigTitle({ text, delay = 0, sub }: { text: string; delay?: number; sub?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 80 } });
  const opacity = interpolate(rise, [0, 1], [0, 1]);
  const y = interpolate(rise, [0, 1], [40, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        top: sub ? '34%' : '40%',
        textAlign: 'center',
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontSize: 96,
          color: C.ink,
          fontWeight: 500,
          letterSpacing: '0.04em',
          lineHeight: 1.35,
        }}
      >
        {text}
      </div>
      {sub && (
        <div style={{ fontSize: 34, color: C.sub, marginTop: 34, fontWeight: 400 }}>{sub}</div>
      )}
    </div>
  );
}

/** 逐行浮现的要点列表 */
export function BulletLines({
  lines,
  startDelay = 20,
  accentIndex = -1,
}: {
  lines: string[];
  startDelay?: number;
  accentIndex?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        top: '28%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 42,
      }}
    >
      {lines.map((line, i) => {
        const rise = spring({
          frame: frame - startDelay - i * 18,
          fps,
          config: { damping: 200, stiffness: 90 },
        });
        return (
          <div
            key={i}
            style={{
              opacity: interpolate(rise, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(rise, [0, 1], [30, 0])}px)`,
              fontSize: i === accentIndex ? 76 : 60,
              color: i === accentIndex ? C.accent : C.ink,
              fontWeight: i === accentIndex ? 600 : 400,
              letterSpacing: '0.03em',
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

/** 小梦织卷 Logo（珊瑚红圆角方块 + 白弧 + 字标） */
export function Logo({ scale = 1 }: { scale?: number }) {
  const s = 170 * scale;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
      <div
        style={{
          width: s,
          height: s,
          borderRadius: s * 0.18,
          background: `linear-gradient(135deg, ${C.accent}, #E85A8F)`,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          style={{
            width: s * 0.34,
            height: s * 0.34,
            borderRadius: '50%',
            border: `${s * 0.05}px solid #FFF0F6`,
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 64 * scale, color: C.ink, fontWeight: 600, letterSpacing: '0.08em' }}>
          小梦织卷
        </div>
        <div style={{ fontSize: 22 * scale, color: C.sub, letterSpacing: '0.14em', marginTop: 8 * scale }}>
          XIAOMENG WEAVER
        </div>
      </div>
    </div>
  );
}

/** 页间滑动转场：内容从右滑入 */
export function SlideIn({
  children,
  durationInFrames,
}: {
  children: React.ReactNode;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exitStart = durationInFrames - 15;
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 70 } });
  const exit = interpolate(frame, [exitStart, durationInFrames], [0, -80], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${interpolate(enter, [0, 1], [120, 0]) + exit}px)`,
        opacity: interpolate(enter, [0, 1], [0, 1]) * interpolate(frame, [exitStart, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/** UI 模拟框（截图占位：真实截图放 assets/ 后替换 src） */
export function UiMock({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div
      style={{
        width: 1240,
        height: 700,
        margin: '0 auto',
        background: C.card,
        borderRadius: 18,
        border: `1px solid ${C.line}`,
        boxShadow: '0 24px 70px rgba(25,25,25,0.14)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ height: 54, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
        <div style={{ width: 12, height: 12, borderRadius: 3, background: C.accent }} />
        <span style={{ marginLeft: 14, fontSize: 22, color: C.sub }}>{label}</span>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>{children}</div>
    </div>
  );
}
