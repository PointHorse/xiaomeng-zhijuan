/**
 * 字号与排版 BottomSheet（§1：移动端一切面板 Sheet 化；§5 阶段补充）
 * 与桌面 TopBar 排版 popover 同参数集：字号 / 行距 / 字体，实时生效。
 */
import { useStore } from '../store/useStore';
import { BottomSheet } from './components/BottomSheet';
import { applyTypography } from '../settings/theme';

const FONTS: Array<{ label: string; value: string }> = [
  { label: '默认', value: '"Microsoft YaHei", "PingFang SC", serif' },
  { label: '宋体', value: '"Songti SC", "SimSun", serif' },
  { label: '楷体', value: '"KaiTi", "Kaiti SC", serif' },
  { label: '黑体', value: '"Microsoft YaHei", sans-serif' },
];

export function TypographySheet({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  function patch(p: Partial<typeof settings>): void {
    const next = { ...settings, ...p };
    setSettings(p);
    applyTypography(next);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="字号与排版">
      <div className="mfield">
        <label>字号 · {settings.fontSize}px</label>
        <input
          type="range"
          min={14}
          max={26}
          step={1}
          value={settings.fontSize}
          onChange={(e) => patch({ fontSize: Number(e.target.value) })}
        />
      </div>
      <div className="mfield">
        <label>行距 · {settings.lineHeight.toFixed(2)}</label>
        <input
          type="range"
          min={1.5}
          max={2.4}
          step={0.05}
          value={settings.lineHeight}
          onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
        />
      </div>
      <div className="mfield">
        <label>字体</label>
        <select
          value={settings.fontFamily}
          onChange={(e) => patch({ fontFamily: e.target.value })}
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <button className="mprimary-btn" onClick={onClose}>
        完成
      </button>
    </BottomSheet>
  );
}
