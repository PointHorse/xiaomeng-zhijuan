/**
 * <Icon name="…" />（阶段 3.5 §5）：统一图标组件。
 * SVG 文件位于 src/assets/icons/<name>.svg（文件名即图标名），
 * 经 Vite ?raw 全量预载；注入时强制 currentColor 以跟随明暗主题。
 * 用户放入同名 .svg（优先）或 .png 即自动生效，无需改代码。
 */
const svgFiles = import.meta.glob('../assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const pngFiles = import.meta.glob('../assets/icons/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function fileBase(path: string): string {
  const base = path.split('/').pop() ?? '';
  return base.replace(/\.(svg|png)$/i, '');
}

const svgByName: Record<string, string> = {};
for (const [path, raw] of Object.entries(svgFiles)) {
  svgByName[fileBase(path)] = raw;
}
const pngByName: Record<string, string> = {};
for (const [path, url] of Object.entries(pngFiles)) {
  pngByName[fileBase(path)] = url;
}

export function iconNames(): string[] {
  return Object.keys({ ...pngByName, ...svgByName }).sort();
}

/** 强制 SVG 使用 currentColor（Lucide 本身已用，保险处理） */
function toCurrentColor(raw: string): string {
  return raw
    .replace(/stroke="[^"]*"/g, 'stroke="currentColor"')
    .replace(/fill="[^"]*"/g, (m) => (m.includes('none') ? m : 'fill="currentColor"'))
    .replace(/width="24"/, 'width="100%"')
    .replace(/height="24"/, 'height="100%"');
}

export interface IconProps {
  name: string;
  /** 显示尺寸（CSS 尺寸，默认 1em 跟随字号） */
  size?: number | string;
  className?: string;
}

export function Icon({ name, size, className }: IconProps): JSX.Element {
  const style = size !== undefined ? { width: size, height: size } : undefined;
  const svg = svgByName[name];
  if (svg) {
    return (
      <span
        className={`micon ${className ?? ''}`}
        style={{ display: 'inline-flex', width: size ?? '1.1em', height: size ?? '1.1em', overflow: 'hidden', ...style }}
        dangerouslySetInnerHTML={{ __html: toCurrentColor(svg) }}
        role="img"
        aria-label={name}
      />
    );
  }
  const png = pngByName[name];
  if (png) {
    return (
      <img
        src={png}
        alt={name}
        className={`micon ${className ?? ''}`}
        style={{ width: size ?? '1.1em', height: size ?? '1.1em' }}
      />
    );
  }
  // 未找到：空占位（保持布局，便于发现缺失）
  return <span className={`micon micon--missing ${className ?? ''}`} style={style} aria-label={name} data-missing={name} />;
}
