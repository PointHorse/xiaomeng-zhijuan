/** 设置页：模型服务 / 生成参数 / 外观 / 记忆窗口 */
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { GEN_PRESETS, resolveTheme } from './settings';
import { invoke } from '@tauri-apps/api/core';
import { useI18n, useT } from '../i18n/useI18n';

interface ProbeResult {
  ok: boolean;
  models: string[];
  latencyMs: number;
  error?: string;
}

/** 经 Rust 探测端点（GET /v1/models，无 CORS 问题） */
async function probeModels(baseUrl: string, apiKey: string): Promise<ProbeResult> {
  try {
    return (await invoke('probe_models', {
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      apiKey,
    })) as ProbeResult;
  } catch (e) {
    return { ok: false, models: [], latencyMs: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 首次启动自动探测本地端口 */
export async function autoDetectLocal(): Promise<{ url: string; model: string } | null> {
  for (const port of [11434, 1234, 8080]) {
    const url = `http://127.0.0.1:${port}/v1`;
    const r = await probeModels(url, '');
    if (r.ok && r.models.length > 0) {
      return { url, model: r.models[0] };
    }
  }
  return null;
}

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setView = useStore((s) => s.setView);
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const t = useT();

  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [preset, setPreset] = useState<keyof typeof GEN_PRESETS | null>(null);
  const [detectMsg, setDetectMsg] = useState('');

  useEffect(() => {
    applyTypographyNow(settings);
  }, [settings.fontSize, settings.lineHeight, settings.fontFamily, settings.theme]);

  async function runProbe(): Promise<void> {
    setProbing(true);
    setProbe(null);
    const r = await probeModels(settings.baseUrl, settings.apiKey);
    setProbe(r);
    setProbing(false);
    if (r.ok && r.models.length > 0 && !settings.model) {
      setSettings({ model: r.models[0] });
    }
  }

  async function runDetect(): Promise<void> {
    setDetectMsg('探测中…');
    const r = await autoDetectLocal();
    if (r) {
      setSettings({ baseUrl: r.url, model: r.model });
      setDetectMsg(`已接入 ${r.url}（模型：${r.model}）`);
    } else {
      setDetectMsg('未发现本地模型服务（已探测 11434 / 1234 / 8080）');
    }
  }

  return (
    <div className="settings-page">
      <h2>{t((d) => d.settingsTitle)}</h2>
      <div className="page-sub">{t((d) => d.settingsSub)}</div>

      {/* 模型服务 */}
      <section className="settings-section">
        <h3>{t((d) => d.sectionModel)}</h3>
        <div className="field-row">
          <label>{t((d) => d.baseUrl)}</label>
          <input
            type="text"
            value={settings.baseUrl}
            placeholder="http://127.0.0.1:8080/v1"
            onChange={(e) => setSettings({ baseUrl: e.target.value })}
          />
        </div>
        <div className="field-row">
          <label>{t((d) => d.apiKey)}</label>
          <input
            type="password"
            value={settings.apiKey}
            placeholder={t((d) => d.apiKeyPlaceholder)}
            onChange={(e) => setSettings({ apiKey: e.target.value })}
          />
        </div>
        <div className="field-row">
          <label>{t((d) => d.model)}</label>
          <input
            type="text"
            list="model-list"
            value={settings.model}
            placeholder={t((d) => d.modelPlaceholder)}
            onChange={(e) => setSettings({ model: e.target.value })}
          />
          <datalist id="model-list">
            {(probe?.models ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="pill-btn" disabled={probing} onClick={() => void runProbe()}>
            {probing ? t((d) => d.testing) : t((d) => d.testConn)}
          </button>
          <button
            className="pill-btn"
            style={{ background: 'var(--text)' }}
            onClick={() => void runDetect()}
          >
            {t((d) => d.autoDetect)}
          </button>
          {probe && (
            <span style={{ fontSize: 13, color: probe.ok ? 'var(--accent)' : 'var(--sub)' }}>
              {probe.ok
                ? t((d) => d.connOk, { ms: probe.latencyMs, n: probe.models.length })
                : t((d) => d.connFail, { e: probe.error ?? 'unknown' })}
            </span>
          )}
        </div>
        {detectMsg && (
          <div style={{ fontSize: 13, color: 'var(--sub)', marginTop: 10 }}>{detectMsg}</div>
        )}
      </section>

      {/* 生成参数 */}
      <section className="settings-section">
        <h3>{t((d) => d.sectionGen)}</h3>
        <div className="presets">
          {(Object.keys(GEN_PRESETS) as (keyof typeof GEN_PRESETS)[]).map((k) => (
            <button
              key={k}
              className={preset === k ? 'active' : ''}
              onClick={() => {
                setPreset(k);
                setSettings(GEN_PRESETS[k]);
              }}
            >
              {t((d) => d[`preset${k[0].toUpperCase()}${k.slice(1)}` as keyof typeof d])}
            </button>
          ))}
        </div>
        <div className="field-row">
          <label>{t((d) => d.temperature)}</label>
          <input
            type="number"
            min={0}
            max={2}
            step={0.05}
            value={settings.temperature}
            onChange={(e) => {
              setSettings({ temperature: Number(e.target.value) });
              setPreset(null);
            }}
          />
        </div>
        <div className="field-row">
          <label>{t((d) => d.topP)}</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={settings.topP}
            onChange={(e) => {
              setSettings({ topP: Number(e.target.value) });
              setPreset(null);
            }}
          />
        </div>
        <div className="field-row">
          <label>{t((d) => d.maxTokens)}</label>
          <input
            type="number"
            min={64}
            max={4096}
            step={32}
            value={settings.maxTokens}
            onChange={(e) => {
              setSettings({ maxTokens: Number(e.target.value) });
              setPreset(null);
            }}
          />
        </div>
        <div className="field-row">
          <label>{t((d) => d.contextWindow)}</label>
          <input
            type="number"
            min={1000}
            max={100000}
            step={1000}
            value={settings.contextWindow}
            onChange={(e) => setSettings({ contextWindow: Number(e.target.value) })}
          />
        </div>
      </section>

      {/* 语言 */}
      <section className="settings-section">
        <h3>{t((d) => d.sectionLang)}</h3>
        <div className="field-row">
          <label>{t((d) => d.language)}</label>
          <select value={lang} onChange={(e) => setLang(e.target.value as 'zh' | 'en')}>
            <option value="zh">{t((d) => d.langZh)}</option>
            <option value="en">{t((d) => d.langEn)}</option>
          </select>
        </div>
      </section>

      {/* 外观 */}
      <section className="settings-section">
        <h3>{t((d) => d.sectionAppearance)}</h3>
        <div className="field-row">
          <label>{t((d) => d.theme)}</label>
          <select
            value={settings.theme}
            onChange={(e) => setSettings({ theme: e.target.value as AppSettingsTheme })}
          >
            <option value="system">{t((d) => d.themeSystem)}</option>
            <option value="light">{t((d) => d.themeLight)}</option>
            <option value="dark">{t((d) => d.themeDark)}</option>
          </select>
        </div>
        <div className="field-row">
          <label>{t((d) => d.fontSize)}</label>
          <input
            type="number"
            min={14}
            max={26}
            value={settings.fontSize}
            onChange={(e) => setSettings({ fontSize: Number(e.target.value) })}
          />
        </div>
        <div className="field-row">
          <label>{t((d) => d.lineHeight)}</label>
          <input
            type="number"
            min={1.5}
            max={2.4}
            step={0.05}
            value={settings.lineHeight}
            onChange={(e) => setSettings({ lineHeight: Number(e.target.value) })}
          />
        </div>
      </section>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button className="pill-btn" onClick={() => setView('editor')}>
          返回正文
        </button>
      </div>
    </div>
  );
}

type AppSettingsTheme = 'light' | 'dark' | 'system';

function applyTypographyNow(s: {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: AppSettingsTheme;
}): void {
  const root = document.documentElement;
  root.style.setProperty('--editor-font-size', `${s.fontSize}px`);
  root.style.setProperty('--editor-line-height', String(s.lineHeight));
  root.style.setProperty('--editor-font-family', s.fontFamily);
  root.classList.toggle('dark', resolveTheme(s.theme) === 'dark');
}
