/** 内联 SVG 图标集（stroke 风格，currentColor） */
import type { SVGProps } from 'react';

type P = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & { size?: number };

function svg(p: P): P & { width: number; height: number; viewBox: string; fill: string; strokeWidth: number; strokeLinecap: 'round'; strokeLinejoin: 'round' } {
  const s = p.size ?? 20;
  return {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

export function GridIcon(p: P) {
  const s = svg(p);
  return (
    <svg {...s}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function ClockIcon(p: P) {
  const s = svg({ ...p, size: 14 });
  return (
    <svg {...s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CloudIcon(p: P) {
  const s = svg({ ...p, size: 14 });
  return (
    <svg {...s}>
      <path d="M6.5 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.6 4.2 4.2 0 0 1 17.5 18Z" />
    </svg>
  );
}

/** A≡ 字号排版 */
export function TypeIcon(p: P) {
  const s = svg({ ...p, size: 20 });
  return (
    <svg {...s}>
      <path d="M4 18 9 5l5 13" />
      <path d="M5.8 14h6.4" />
      <path d="M15 12h6M15 16h6M15 8h6" />
    </svg>
  );
}

export function SunIcon(p: P) {
  const s = svg({ ...p, size: 20 });
  return (
    <svg {...s}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon(p: P) {
  const s = svg({ ...p, size: 20 });
  return (
    <svg {...s}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z" />
    </svg>
  );
}

export function UndoIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export function EditIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export function CheckIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <path d="m4 12.5 5.5 5.5L20 6.5" />
    </svg>
  );
}

export function TrashIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
    </svg>
  );
}

export function CopyIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function GearIcon(p: P) {
  const s = svg({ ...p, size: 18 });
  return (
    <svg {...s}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </svg>
  );
}

export function BookIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

export function TreeIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M12 7.5v4M5 16.5v-4h14v4M12 11.5v1" />
    </svg>
  );
}

export function DocIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function RefreshIcon(p: P) {
  const s = svg({ ...p, size: 16 });
  return (
    <svg {...s}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
