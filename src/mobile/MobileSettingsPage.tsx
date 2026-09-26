/**
 * 移动版设置页（阶段 2）：模型服务 / 生成参数 / 外观 / 风格管理。
 * 全部消费设计令牌与阶段 1 组件（Button / BottomSheet / SheetRow）；
 * 与桌面 SettingsView 共享 store 与 probe/analyzer 逻辑，桌面零改动。
 */
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { probeModels } from '../settings/probe';
import { builtinStyles, validateCustomStyle, type StylePreset } from '../styles_ext/model';
import { buildAnalysisUserMessage, extractStylePrompt } from '../styles_ext/analyzer';
import { createProvider } from '../provider/openai';
import { listCustomStyles, upsertCustomStyle, deleteCustomStyle, initStyleSchema } from '../styles_ext/persist';
import { useI18n } from '../i18n/useI18n';
import { BottomSheet, SheetRow, SheetSep } from './components/BottomSheet';
import { Button } from './components/Button';
import { TypographySheet } from './TypographySheet';

type AnalysisPhase = 'idle' | 'analyzing' | 'done' | 'error';

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section style={{ marginBottom: 'var(--sp-6)' }}>
      <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--gray-3)', margin: '0 0 var(--sp-2)', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      <div
        style={{
          background: 'var(--gray-1)',
          border: '1px solid var(--gray-2)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--sp-4)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function MobileSettingsPage(): JSX.Element {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const { lang, setLang } = useI18n();

  const [probe, setProbe] = useState<{ ok: boolean; msg: string } | null>(null);
  const [probing, setProbing] = useState(false);

  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [typoOpen, setTypoOpen] = useState(false);

  // 风格管理
  const [customStyles, setCustomStyles] = useState<StylePreset[]>([]);
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [styleName, setStyleName] = useState('');
  const [sourceArticle, setSourceArticle] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
  const [analysisMsg, setAnalysisMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StylePreset | null>(null);

  useEffect(() => {
    void (async () => {
      await initStyleSchema();
      setCustomStyles(await listCustomStyles());
    })();
  }, []);

  const allStyles = [...builtinStyles(), ...customStyles];
  const activeStyle = allStyles.find((s) => s.id === settings.activeStyleId) ?? allStyles[0];

  async function runProbe(): Promise<void> {
    setProbing(true);
    setProbe(null);
    const r = await probeModels(settings.baseUrl, settings.apiKey);
    setProbing(false);
    if (r.ok) {
      const detail = `连接成功 · ${r.latencyMs}ms · ${r.models.length} 个模型${r.error ?? ''}`;
      setProbe({ ok: true, msg: detail });
      if (r.models.length > 0 && !settings.model) setSettings({ model: r.models[0] });
    } else {
      setProbe({ ok: false, msg: r.error ?? 'unknown' });
    }
  }

  function openNewStyle(): void {
    setEditingId(null);
    setStyleName('');
    setSourceArticle('');
    setGeneratedPrompt('');
    setAnalysisPhase('idle');
    setAnalysisMsg('');
    setStyleEditorOpen(true);
  }

  function openEditStyle(s: StylePreset): void {
    if (s.builtin) return;
    setEditingId(s.id);
    setStyleName(s.name);
    setSourceArticle(s.sourceArticle);
    setGeneratedPrompt(s.systemPrompt);
    setAnalysisPhase('done');
    setAnalysisMsg('');
    setStyleEditorOpen(true);
  }

  async function analyzeStyle(): Promise<void> {
    const err = validateCustomStyle(styleName, '占位', sourceArticle);
    if (err) {
      setAnalysisPhase('error');
      setAnalysisMsg(err);
      return;
    }
    setAnalysisPhase('analyzing');
    setAnalysisMsg('');
    try {
      const provider = createProvider(settings);
      let output = '';
      const ac = new AbortController();
      await provider.generate({
        messages: [{ role: 'user', content: buildAnalysisUserMessage(sourceArticle) }],
        params: { temperature: 0.4, topP: 0.9, maxTokens: Math.max(1200, settings.maxTokens) },
        handlers: {
          onDelta: () => undefined,
          onDone: (full) => (output = full),
          onError: (m) => setAnalysisMsg(m),
        },
        signal: ac.signal,
      });
      const { prompt, usedFallback } = extractStylePrompt(output);
      setGeneratedPrompt(prompt);
      setAnalysisPhase('done');
      setAnalysisMsg(usedFallback ? '模型输出格式异常，已使用内置模板兜底。' : '文风分析完成。');
    } catch (e) {
      setAnalysisPhase('error');
      setAnalysisMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveStyle(): Promise<void> {
    const err = validateCustomStyle(styleName, generatedPrompt, sourceArticle);
    if (err) {
      setAnalysisPhase('error');
      setAnalysisMsg(err);
      return;
    }
    const id = editingId ?? `style_custom_${Date.now().toString(36)}`;
    const preset: StylePreset = {
      id,
      name: styleName.trim(),
      systemPrompt: generatedPrompt.trim(),
      sourceArticle: sourceArticle.trim(),
      builtin: false,
      createdAt: Date.now(),
    };
    await upsertCustomStyle(preset);
    setCustomStyles(await listCustomStyles());
    if (settings.activeStyleId === id) setSettings({ styleSystemPrompt: preset.systemPrompt });
    setStyleEditorOpen(false);
  }

  async function removeStyle(): Promise<void> {
    if (!deleteTarget) return;
    await deleteCustomStyle(deleteTarget.id);
    setCustomStyles(await listCustomStyles());
    if (settings.activeStyleId === deleteTarget.id) {
      setSettings({ activeStyleId: 'style_builtin_default', styleSystemPrompt: '' });
    }
    setDeleteTarget(null);
  }

  const themeLabel = settings.theme === 'dark' ? '🌙 深色' : settings.theme === 'light' ? '☀️ 浅色' : '⚙ 跟随系统';
  const langLabel = lang === 'zh' ? '中文' : 'English';

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      {/* ============ 模型服务 ============ */}
      <Section title="模型服务">
        <div className="mfield">
          <label>Base URL</label>
          <input
            type="text"
            value={settings.baseUrl}
            onChange={(e) => setSettings({ baseUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
            inputMode="url"
          />
        </div>
        <div className="mfield">
          <label>API Key</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => setSettings({ apiKey: e.target.value })}
            placeholder="本地服务可留空"
          />
        </div>
        <div className="mfield">
          <label>模型名</label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => setSettings({ model: e.target.value })}
            placeholder="留空或填 mock 试用演示模式"
          />
        </div>
        <div className="btn-row" style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <Button variant="primary" loading={probing} onClick={() => void runProbe()}>
            测试连接
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void import('../settings/SettingsView').then(async (m) => {
                const r = await m.autoDetectLocal();
                if (r) {
                  setSettings({ baseUrl: r.url, model: r.model });
                  setProbe({ ok: true, msg: `已接入 ${r.url}（模型：${r.model}）` });
                } else {
                  setProbe({ ok: false, msg: '未发现本地模型服务（已探测 11434 / 1234 / 8080）' });
                }
              });
            }}
          >
            自动探测本地服务
          </Button>
        </div>
        {probe && (
          <p
            role="status"
            style={{
              fontSize: 'var(--fs-sm)',
              margin: 'var(--sp-2) 0 0',
              color: probe.ok ? 'var(--success)' : 'var(--danger)',
              lineHeight: 1.6,
              wordBreak: 'break-all',
            }}
          >
            {probe.msg}
          </p>
        )}
      </Section>

      {/* ============ 生成参数 ============ */}
      <Section title="生成参数">
        <div className="mfield">
          <label>温度（0–2）</label>
          <input type="number" step="0.1" min="0" max="2" value={settings.temperature} onChange={(e) => setSettings({ temperature: Number(e.target.value) })} />
        </div>
        <div className="mfield">
          <label>Top P（0–1）</label>
          <input type="number" step="0.01" min="0" max="1" value={settings.topP} onChange={(e) => setSettings({ topP: Number(e.target.value) })} />
        </div>
        <div className="mfield">
          <label>最大生成长度（tokens）</label>
          <input type="number" min="100" step="100" value={settings.maxTokens} onChange={(e) => setSettings({ maxTokens: Number(e.target.value) })} />
        </div>
        <div className="mfield">
          <label>记忆窗口（字）</label>
          <input type="number" min="500" step="500" value={settings.contextWindow} onChange={(e) => setSettings({ contextWindow: Number(e.target.value) })} />
        </div>
      </Section>

      {/* ============ 外观 ============ */}
      <Section title="外观">
        <SheetRow
          icon={themeLabel.split(' ')[0]}
          sub={`当前 ${themeLabel.split(' ')[1] ?? ''}`}
          onClick={() => setThemeOpen(true)}
        >
          明暗主题
        </SheetRow>
        <SheetRow icon="🌐" sub={`当前 ${langLabel}`} onClick={() => setLangOpen(true)}>
          界面语言
        </SheetRow>
        <SheetRow icon="🅰" sub="字号 / 行距 / 字体" onClick={() => setTypoOpen(true)}>
          字号与排版
        </SheetRow>
      </Section>

      {/* ============ 风格管理 ============ */}
      <Section title="风格管理">
        {allStyles.map((s) => (
          <SheetRow
            key={s.id}
            icon="◐"
            selected={s.id === activeStyle?.id}
            sub={s.builtin ? '内置风格' : '自定义 · 轻点编辑'}
            onClick={() => {
              if (s.builtin) {
                setSettings({ activeStyleId: s.id, styleSystemPrompt: s.systemPrompt });
              } else {
                openEditStyle(s);
              }
            }}
          >
            {s.name}
          </SheetRow>
        ))}
        {customStyles.length > 0 && <SheetSep />}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
          <Button variant="secondary" onClick={openNewStyle}>
            ＋ 新建自定义风格
          </Button>
          {customStyles.some((s) => s.id === activeStyle?.id) && (
            <Button variant="danger" onClick={() => setDeleteTarget(activeStyle)}>
              删除当前
            </Button>
          )}
        </div>
      </Section>

      {/* ============ Sheets ============ */}
      <BottomSheet open={themeOpen} onClose={() => setThemeOpen(false)} title="明暗主题">
        {([
          { v: 'light', label: '☀️ 浅色' },
          { v: 'dark', label: '🌙 深色' },
          { v: 'system', label: '⚙ 跟随系统' },
        ] as const).map((o) => (
          <SheetRow
            key={o.v}
            selected={settings.theme === o.v}
            onClick={() => {
              setSettings({ theme: o.v });
              void import('../settings/theme').then((m) => m.applyTheme(o.v));
              setThemeOpen(false);
            }}
          >
            {o.label}
          </SheetRow>
        ))}
      </BottomSheet>

      <BottomSheet open={langOpen} onClose={() => setLangOpen(false)} title="界面语言">
        {([
          { v: 'zh', label: '中文' },
          { v: 'en', label: 'English' },
        ] as const).map((o) => (
          <SheetRow
            key={o.v}
            selected={lang === o.v}
            onClick={() => {
              setLang(o.v);
              setLangOpen(false);
            }}
          >
            {o.label}
          </SheetRow>
        ))}
      </BottomSheet>

      <TypographySheet open={typoOpen} onClose={() => setTypoOpen(false)} />

      {/* 风格编辑 Sheet */}
      <BottomSheet open={styleEditorOpen} onClose={() => setStyleEditorOpen(false)} title={editingId ? '编辑自定义风格' : '新建自定义风格'}>
        <div className="mfield">
          <label>风格名称</label>
          <input type="text" value={styleName} onChange={(e) => setStyleName(e.target.value)} placeholder="如：王家卫风" />
        </div>
        <div className="mfield">
          <label>源文章（≥50 字，用于分析文风）</label>
          <textarea
            value={sourceArticle}
            onChange={(e) => setSourceArticle(e.target.value)}
            rows={4}
            style={{
              width: '100%', border: '1px solid var(--gray-2)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)', color: 'var(--gray-5)', font: 'inherit', fontSize: 'var(--fs-sm)',
              padding: 'var(--sp-2) var(--sp-3)', resize: 'vertical',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <Button
            variant="secondary"
            loading={analysisPhase === 'analyzing'}
            disabled={sourceArticle.trim().length < 50}
            disabledReason={sourceArticle.trim().length < 50 ? '源文章不足 50 字' : undefined}
            onClick={() => void analyzeStyle()}
          >
            生成风格提示词
          </Button>
        </div>
        {analysisMsg && (
          <p style={{ fontSize: 'var(--fs-sm)', color: analysisPhase === 'error' ? 'var(--danger)' : 'var(--gray-3)', margin: 'var(--sp-2) 0 0' }}>
            {analysisMsg}
          </p>
        )}
        {generatedPrompt && (
          <div className="mfield">
            <label>风格提示词（可修改）</label>
            <textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              rows={4}
              style={{
                width: '100%', border: '1px solid var(--gray-2)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)', color: 'var(--gray-5)', font: 'inherit', fontSize: 'var(--fs-sm)',
                padding: 'var(--sp-2) var(--sp-3)', resize: 'vertical',
              }}
            />
          </div>
        )}
        <Button variant="primary" onClick={() => void saveStyle()}>
          保存风格
        </Button>
      </BottomSheet>

      {/* 删除风格确认 */}
      <BottomSheet open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="删除风格">
        <p style={{ margin: '0 0 var(--sp-4)', lineHeight: 1.8 }}>
          确认删除自定义风格「{deleteTarget?.name}」？此操作不可恢复。
        </p>
        <Button variant="danger" onClick={() => void removeStyle()}>
          确认删除
        </Button>
      </BottomSheet>
    </div>
  );
}
