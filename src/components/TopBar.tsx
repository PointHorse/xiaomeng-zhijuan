/** 顶部栏：九宫格菜单 + 标题 + 元信息 + 排版/主题/设置 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  GridIcon,
  ClockIcon,
  CloudIcon,
  TypeIcon,
  SunIcon,
  MoonIcon,
  BookIcon,
  TreeIcon,
  GearIcon,
  DocIcon,
} from './Icons';

interface Props {
  onOpenWorldTree: () => void;
  onOpenSettings: () => void;
  onExportJson: () => void;
  onExportTxt: () => void;
  onExportMd: () => void;
  onExportPng: () => void;
  onNewStory: () => void;
}

export function TopBar({ onOpenWorldTree, onOpenSettings, onExportJson, onExportTxt, onExportMd, onExportPng, onNewStory }: Props) {
  const title = useStore((s) => s.title);
  const setTitle = useStore((s) => s.setTitle);
  const tree = useStore((s) => s.tree);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const genPhase = useStore((s) => s.gen.phase);
  const lang = useI18n((s) => s.lang);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 12, y: 12 });
  const [typoOpen, setTypoOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const typoRef = useRef<HTMLDivElement>(null);

  const charCount = fullTextLen(tree);
  const savedText = lastSavedAt
    ? tFor(lang).lastSaved.replace('{t}', formatTime(lastSavedAt))
    : tFor(lang).notSavedYet;

  // 点击外部关闭弹层
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (typoOpen && typoRef.current && !typoRef.current.contains(t)) setTypoOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, typoOpen]);

  const isDark = document.documentElement.classList.contains('dark');

  function toggleTheme() {
    setSettings({ theme: isDark ? 'light' : 'dark' });
    applyTheme(isDark ? 'light' : 'dark');
  }

  return (
    <header className="topbar">
      {/* 九宫格菜单 */}
      <button
        className="grid-btn"
        title="菜单"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenuPos({ x: r.left, y: r.bottom + 6 });
          setMenuOpen((v) => !v);
        }}
      >
        <GridIcon size={22} />
      </button>
      {menuOpen && (
        <div className="dropdown" style={{ left: menuPos.x, top: menuPos.y }} ref={menuRef}>
          <button
            className="dropdown-item"
            onClick={() => {
              setMenuOpen(false);
              if (confirm('新建故事？当前故事已自动保存。')) {
                onNewStory();
                setMenuOpen(false);
              }
            }}
          >
            <DocIcon /> {tFor(lang).newStory}
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              setMenuOpen(false);
              onExportJson();
            }}
          >
            <BookIcon /> {tFor(lang).exportJson}
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              setMenuOpen(false);
              onExportTxt();
            }}
          >
            <DocIcon /> {tFor(lang).exportTxt}
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              setMenuOpen(false);
              onExportMd();
            }}
          >
            <DocIcon /> {tFor(lang).exportMd}
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              setMenuOpen(false);
              onExportPng();
            }}
          >
            <DocIcon /> {tFor(lang).exportPng}
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              setMenuOpen(false);
              onOpenWorldTree();
            }}
          >
            <TreeIcon /> {tFor(lang).worldTree}
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              setMenuOpen(false);
              onOpenSettings();
            }}
          >
            <GearIcon /> {tFor(lang).settings}
          </button>
        </div>
      )}

      {/* 标题 + 元信息 */}
      <div className="topbar-title-block">
        <input
          className="topbar-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="未命名故事"
          spellCheck={false}
        />
        <div className="topbar-meta">
          <span>
            <ClockIcon /> {tFor(lang).charCount.replace('{n}', String(charCount))}
          </span>
          <span>
            <CloudIcon /> {savedText}
          </span>
          {genPhase === 'generating' && <span style={{ color: 'var(--accent)' }}>{tFor(lang).dreaming}</span>}
        </div>
      </div>

      {/* 右侧 */}
      <div className="topbar-right">
        <button
          className="icon-btn"
          title="字号与排版"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setMenuPos({ x: r.right - 250, y: r.bottom + 8 });
            setTypoOpen((v) => !v);
          }}
        >
          <TypeIcon />
        </button>
        {typoOpen && (
          <div className="popover" style={{ left: menuPos.x, top: menuPos.y }} ref={typoRef}>
            <div className="field-row">
              <label>字号</label>
              <input
                type="range"
                min={14}
                max={26}
                step={1}
                value={settings.fontSize}
                onChange={(e) => {
                  setSettings({ fontSize: Number(e.target.value) });
                  applyTypography(settings);
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--sub)' }}>{settings.fontSize}px</span>
            </div>
            <div className="field-row">
              <label>行距</label>
              <input
                type="range"
                min={1.5}
                max={2.4}
                step={0.05}
                value={settings.lineHeight}
                onChange={(e) => {
                  setSettings({ lineHeight: Number(e.target.value) });
                  applyTypography(settings);
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--sub)' }}>{settings.lineHeight.toFixed(2)}</span>
            </div>
            <div className="field-row">
              <label>字体</label>
              <select
                value={settings.fontFamily}
                onChange={(e) => {
                  setSettings({ fontFamily: e.target.value });
                  applyTypography(settings);
                }}
              >
                <option value='"Microsoft YaHei", "PingFang SC", serif'>默认</option>
                <option value='"Songti SC", "SimSun", serif'>宋体</option>
                <option value='"KaiTi", "Kaiti SC", serif'>楷体</option>
                <option value='"Microsoft YaHei", sans-serif'>黑体</option>
              </select>
            </div>
          </div>
        )}
        <div className="topbar-divider" />
        <button className="icon-btn" title="明暗主题" onClick={toggleTheme}>
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="avatar" title="设置" onClick={onOpenSettings}>
          梦
        </button>
      </div>
    </header>
  );
}

import { fullText } from '../worldtree/tree';
import { tFor, useI18n } from '../i18n/useI18n';
import { applyTheme, applyTypography } from '../settings/theme';

function formatTime(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

function fullTextLen(tree: Parameters<typeof fullText>[0]): number {
  return fullText(tree).length;
}

