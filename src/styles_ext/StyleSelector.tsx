/**
 * 功能 A③ · 风格选择器 UI + 自定义风格管理弹窗
 */
import { useEffect, useState } from 'react';
import { builtinStyles, validateCustomStyle, type StylePreset } from './model';
import { buildAnalysisUserMessage, extractStylePrompt } from './analyzer';
import { listCustomStyles, upsertCustomStyle, deleteCustomStyle, initStyleSchema } from './persist';
import { createProvider } from '../provider/openai';
import { useStore } from '../store/useStore';
import { useT } from '../i18n/useI18n';
import { TrashIcon, EditIcon } from '../components/Icons';

type AnalysisPhase = 'idle' | 'analyzing' | 'done' | 'error';

export function StyleSelector() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const t = useT();

  const [customStyles, setCustomStyles] = useState<StylePreset[]>([]);
  const [activeId, setActiveId] = useState<string>('style_builtin_default');

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = 新建
  const [styleName, setStyleName] = useState('');
  const [sourceArticle, setSourceArticle] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
  const [analysisMsg, setAnalysisMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      await initStyleSchema();
      setCustomStyles(await listCustomStyles());
    })();
  }, []);

  const allStyles = [...builtinStyles(), ...customStyles];
  const active = allStyles.find((s) => s.id === activeId) ?? allStyles[0];

  function select(id: string): void {
    setActiveId(id);
    const s = allStyles.find((x) => x.id === id);
    // 选中即生效：该风格的 systemPrompt 由 useGenerate 在发起请求时读取
    setSettings({ activeStyleId: id, styleSystemPrompt: s?.systemPrompt ?? '' });
  }

  function openNewDialog(): void {
    setEditingId(null);
    setStyleName('');
    setSourceArticle('');
    setGeneratedPrompt('');
    setAnalysisPhase('idle');
    setAnalysisMsg('');
    setDialogOpen(true);
  }

  function openEditDialog(s: StylePreset): void {
    setEditingId(s.id);
    setStyleName(s.name);
    setSourceArticle(s.sourceArticle);
    setGeneratedPrompt(s.systemPrompt);
    setAnalysisPhase('done');
    setAnalysisMsg('');
    setDialogOpen(true);
  }

  async function analyze(): Promise<void> {
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
      systemPrompt: generatedPrompt,
      sourceArticle,
      builtin: false,
      createdAt: editingId ? (customStyles.find((s) => s.id === editingId)?.createdAt ?? Date.now()) : Date.now(),
    };
    await upsertCustomStyle(preset);
    const list = await listCustomStyles();
    setCustomStyles(list);
    setDialogOpen(false);
    select(id); // 保存即生效
  }

  async function removeStyle(id: string): Promise<void> {
    await deleteCustomStyle(id);
    const list = await listCustomStyles();
    setCustomStyles(list);
    if (activeId === id) select('style_builtin_default');
    setConfirmDeleteId(null);
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}>
        {t((d) => d.styleHint)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {allStyles.map((s) => (
          <button
            key={s.id}
            onClick={() => select(s.id)}
            className="style-chip"
            data-active={active.id === s.id}
            title={s.systemPrompt ? s.systemPrompt.slice(0, 120) : '无系统提示词'}
          >
            {s.name}
            {!s.builtin && (
              <span
                className="style-chip-actions"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditDialog(s);
                }}
                title="查看/编辑"
              >
                <EditIcon size={12} />
              </span>
            )}
            {!s.builtin && (
              <span
                className="style-chip-actions"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(s.id);
                }}
                title="删除"
              >
                <TrashIcon size={12} />
              </span>
            )}
          </button>
        ))}
        <button className="style-chip style-chip-add" onClick={openNewDialog}>
          + {t((d) => d.customStyleAdd)}
        </button>
      </div>

      {/* 删除二次确认 */}
      {confirmDeleteId && (
        <div className="style-dialog-mask" onClick={() => setConfirmDeleteId(null)}>
          <div className="style-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, marginBottom: 16 }}>{t((d) => d.customDeleteConfirm)}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="pill-btn" style={{ background: 'var(--text)' }} onClick={() => setConfirmDeleteId(null)}>
                {t((d) => d.cancelAction)}
              </button>
              <button className="pill-btn" onClick={() => void removeStyle(confirmDeleteId)}>
                {t((d) => d.confirm)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {dialogOpen && (
        <div className="style-dialog-mask" onClick={() => setDialogOpen(false)}>
          <div className="style-dialog style-dialog-wide" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>
              {editingId ? t((d) => d.customEditTitle) : t((d) => d.customNewTitle)}
            </h3>
            <div className="field-row">
              <label>{t((d) => d.customNameLabel)}</label>
              <input type="text" value={styleName} maxLength={40} onChange={(e) => setStyleName(e.target.value)} placeholder={t((d) => d.customNameLabel)} />
            </div>
            <div className="field-row" style={{ alignItems: 'flex-start' }}>
              <label>{t((d) => d.customSourceLabel)}</label>
              <textarea
                className="style-source-area"
                value={sourceArticle}
                onChange={(e) => setSourceArticle(e.target.value)}
                placeholder={t((d) => d.customSourcePlaceholder)}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <button className="pill-btn" disabled={analysisPhase === 'analyzing'} onClick={() => void analyze()}>
                {analysisPhase === 'analyzing' ? t((d) => d.customAnalyzing) : t((d) => d.customAnalyzeBtn)}
              </button>
              {analysisMsg && (
                <span style={{ fontSize: 12.5, color: analysisPhase === 'error' ? 'var(--accent)' : 'var(--sub)' }}>
                  {analysisMsg}
                </span>
              )}
            </div>
            <div className="field-row" style={{ alignItems: 'flex-start' }}>
              <label>{t((d) => d.customPromptLabel)}</label>
              <textarea
                className="style-source-area"
                style={{ minHeight: 140 }}
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                placeholder={t((d) => d.customPromptPlaceholder)}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="pill-btn" style={{ background: 'var(--text)' }} onClick={() => setDialogOpen(false)}>
                {t((d) => d.cancelAction)}
              </button>
              <button className="pill-btn" onClick={() => void saveStyle()}>
                {t((d) => d.customSaveBtn)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

