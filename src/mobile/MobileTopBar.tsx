/**
 * 移动端顶栏（阶段 3.5 §4 双胶囊）：＋｜书架｜[模型胶囊][风格胶囊]｜···
 * 应用名文字删除（320dp 下空间让给双胶囊）。
 * 模型胶囊面板：范围（仅本书/全局默认）、Base URL/Key、「获取模型」可搜索列表；
 * 风格胶囊面板：预设 + 自定义列表 + 「＋ 自定义」。
 */
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { BottomSheet, SheetRow, SheetSep } from './components/BottomSheet';
import { Button } from './components/Button';
import { TypographySheet } from './TypographySheet';
import type { MobilePage } from './MobileShell';
import { showToast } from '../components/toast';
import { probeModels } from '../settings/probe';
import { saveOverride, loadOverride } from '../shelf/storyOverride';

interface Props {
  onNew: () => void;
  onOpenShelf: () => void;
  onOpenPage: (p: MobilePage) => void;
}

type Scope = 'book' | 'global';

interface ModelForm {
  baseUrl: string;
  apiKey: string;
  model: string;
  showKey: boolean;
  fetching: boolean;
  models: string[];
  fetchError: string | null;
}

export function MobileTopBar({ onNew, onOpenShelf, onOpenPage }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [typoOpen, setTypoOpen] = useState(false);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const storyId = useStore((s) => s.storyId);
  const storyOverride = useStore((s) => s.storyOverride);
  const styles = (settings as { styles?: Array<{ id: string; name: string }> }).styles ?? [];
  const activeStyleId = (settings as { activeStyleId?: string }).activeStyleId;
  const activeStyle = styles.find((s) => s.id === activeStyleId);

  // 生效模型（书覆盖 > 全局）
  const effModel = storyOverride?.model || settings.model || 'mock';

  const [scope, setScope] = useState<Scope>('book');
  const [form, setForm] = useState<ModelForm>({
    baseUrl: '', apiKey: '', model: '', showKey: false, fetching: false, models: [], fetchError: null,
  });

  // 打开模型面板：按当前生效值初始化表单
  useEffect(() => {
    if (!modelOpen) return;
    void (async () => {
      const ov = storyId ? await loadOverride(storyId).catch(() => null) : null;
      const s: Scope = ov?.model || ov?.baseUrl ? 'book' : 'global';
      setScope(s);
      setForm((f) => ({
        ...f,
        baseUrl: (s === 'book' ? ov?.baseUrl : '') || settings.baseUrl,
        apiKey: (s === 'book' ? ov?.apiKey : '') || settings.apiKey,
        model: (s === 'book' ? ov?.model : '') || settings.model,
        models: [], fetchError: null, fetching: false,
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelOpen]);

  function formValues(): { baseUrl: string; apiKey: string; model: string } {
    return {
      baseUrl: form.baseUrl.trim() || settings.baseUrl,
      apiKey: form.apiKey,
      model: form.model.trim(),
    };
  }

  /** 应用生效：仅本书 → storyOverride；全局 → settings */
  function applyModel(patch: { model?: string; baseUrl?: string; apiKey?: string }): void {
    if (scope === 'book' && storyId) {
      const next = {
        baseUrl: patch.baseUrl ?? storyOverride?.baseUrl ?? settings.baseUrl,
        model: patch.model ?? storyOverride?.model ?? settings.model,
        apiKey: patch.apiKey ?? storyOverride?.apiKey ?? settings.apiKey,
        temperature: storyOverride?.temperature,
      };
      void saveOverride(storyId, next).then(() => {
        useStore.setState({ storyOverride: next });
        setSettings({}); // 触发持久化
      });
    } else {
      setSettings(patch);
    }
  }

  async function fetchModels(): Promise<void> {
    const { baseUrl, apiKey } = formValues();
    setForm((f) => ({ ...f, fetching: true, fetchError: null }));
    const r = await probeModels(baseUrl, apiKey);
    if (r.ok && r.models.length > 0) {
      setForm((f) => ({ ...f, fetching: false, models: r.models }));
    } else {
      setForm((f) => ({
        ...f,
        fetching: false,
        models: [],
        fetchError: r.error ?? `未获取到模型列表（${r.models.length} 个）。可手动输入模型名。`,
      }));
    }
  }

  const filteredModels = useMemo(() => {
    const q = form.model.trim().toLowerCase();
    if (!q) return form.models;
    return form.models.filter((m) => m.toLowerCase().includes(q));
  }, [form.models, form.model]);

  return (
    <header className="mtopbar mtopbar--dual">
      <button className="micon-btn" data-line-fx="1" aria-label="新建故事" onClick={onNew}>
        ＋
      </button>
      <button className="micon-btn" data-line-fx="1" aria-label="书架" onClick={onOpenShelf}>
        📚
      </button>
      <div className="mtopbar-capsules">
        <button className="mtopbar-capsule hit-44" aria-label="模型选择" onClick={() => setModelOpen(true)}>
          <span className="cap-label">⚡ {effModel}</span>
          <span className="cap-caret">▾</span>
        </button>
        <button className="mtopbar-capsule mtopbar-capsule--style hit-44" aria-label="风格选择" onClick={() => setStyleOpen(true)}>
          <span className="cap-label">◐ {activeStyle ? activeStyle.name : '默认'}</span>
          <span className="cap-caret">▾</span>
        </button>
      </div>
      <button className="micon-btn" data-line-fx="1" aria-label="更多" onClick={() => setMoreOpen(true)}>
        ···
      </button>

      {/* ===== 模型面板（§4） ===== */}
      <BottomSheet open={modelOpen} onClose={() => setModelOpen(false)} title="模型" height="80%">
        {/* 作用范围 */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
          <Button
            variant={scope === 'book' ? 'primary' : 'secondary'}
            size="sm"
            disabled={!storyId}
            onClick={() => setScope('book')}
          >
            仅本书
          </Button>
          <Button
            variant={scope === 'global' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setScope('global')}
          >
            全局默认
          </Button>
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-3)', margin: '0 0 var(--sp-3)' }}>
          {scope === 'book' ? '仅当前故事使用以下配置（其他故事不受影响）' : '所有未单独配置的故事都使用以下配置'}
        </p>

        <div className="mfield">
          <label>Base URL（仅支持 OpenAI 兼容格式）</label>
          <input
            type="text"
            value={form.baseUrl}
            onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
            placeholder="https://api.example.com/v1"
            inputMode="url"
          />
        </div>
        <div className="mfield">
          <label>API Key</label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <input
              type={form.showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder="sk-…"
              style={{ flex: 1 }}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={form.showKey ? '隐藏 Key' : '显示 Key'}
              onClick={() => setForm((f) => ({ ...f, showKey: !f.showKey }))}
            >
              {form.showKey ? '隐藏' : '显示'}
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-3)', margin: 'var(--sp-2) 0 var(--sp-3)' }}>
          <Button variant="primary" loading={form.fetching} onClick={() => void fetchModels()}>
            获取模型
          </Button>
          <Button
            variant="secondary"
            disabled={!form.model.trim()}
            disabledReason={form.model.trim() ? undefined : '请先选择或输入模型名'}
            onClick={() => {
              applyModel({ baseUrl: form.baseUrl.trim(), apiKey: form.apiKey, model: form.model.trim() });
              showToast(`已生效：${form.model.trim()}`);
              setModelOpen(false);
            }}
          >
            保存并生效
          </Button>
        </div>

        {/* 获取到的模型列表（可搜索） */}
        {form.fetchError && (
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)', margin: '0 0 var(--sp-3)', lineHeight: 1.7 }}>
            {form.fetchError}
          </p>
        )}
        {form.models.length > 0 && (
          <>
            <div className="mfield">
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="搜索或手动输入模型名"
                aria-label="搜索或手动输入模型名"
              />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--gray-2)', borderRadius: 'var(--radius-sm)' }}>
              {filteredModels.map((m) => (
                <SheetRow
                  key={m}
                  selected={m === form.model}
                  onClick={() => {
                    setForm((f) => ({ ...f, model: m }));
                    applyModel({ baseUrl: form.baseUrl.trim(), apiKey: form.apiKey, model: m });
                    showToast(`已生效：${m}`);
                    setModelOpen(false);
                  }}
                >
                  {m}
                </SheetRow>
              ))}
              {filteredModels.length === 0 && (
                <div style={{ padding: 'var(--sp-3)', fontSize: 'var(--fs-xs)', color: 'var(--gray-3)' }}>
                  无匹配模型，可手动输入。
                </div>
              )}
            </div>
          </>
        )}
        {form.models.length === 0 && !form.fetchError && (
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-3)', margin: '0 0 var(--sp-3)' }}>
            填好 Base URL 与 Key 后点「获取模型」，或直接在下方手动输入模型名。
          </p>
        )}
        <div className="mfield">
          <label>模型名（手动输入）</label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder="如 deepseek-chat"
          />
        </div>
      </BottomSheet>

      {/* ===== 风格面板（§4） ===== */}
      <BottomSheet open={styleOpen} onClose={() => setStyleOpen(false)} title="风格">
        {styles.map((s) => (
          <SheetRow
            key={s.id}
            icon="◐"
            selected={s.id === activeStyleId}
            onClick={() => {
              setSettings({ activeStyleId: s.id, styleSystemPrompt: (s as { systemPrompt?: string }).systemPrompt ?? '' });
              showToast(`风格已切换：${s.name}`);
              setStyleOpen(false);
            }}
          >
            {s.name}
          </SheetRow>
        ))}
        <SheetSep />
        <SheetRow
          icon="＋"
          sub="名称 / 源文章 / 提示词在设置页管理"
          onClick={() => {
            setStyleOpen(false);
            onOpenPage('settings');
          }}
        >
          自定义
        </SheetRow>
      </BottomSheet>

      {/* ===== 更多菜单 Sheet ===== */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="更多">
        <MoreMenu
          onClose={() => setMoreOpen(false)}
          onOpenPage={onOpenPage}
          onModel={() => setModelOpen(true)}
          onTypography={() => setTypoOpen(true)}
        />
      </BottomSheet>

      <TypographySheet open={typoOpen} onClose={() => setTypoOpen(false)} />
    </header>
  );
}

function MoreMenu({
  onClose,
  onOpenPage,
  onModel,
  onTypography,
}: {
  onClose: () => void;
  onOpenPage: (p: MobilePage) => void;
  onModel: () => void;
  onTypography: () => void;
}): JSX.Element {
  const isDark = document.documentElement.classList.contains('dark');
  return (
    <>
      <SheetRow
        icon="💾"
        onClick={() => {
          void import('../shelf/saveNow').then((m) => m.saveNowToShelf());
          onClose();
        }}
      >
        保存
      </SheetRow>
      <SheetRow
        icon="🅰"
        onClick={() => {
          onTypography();
          onClose();
        }}
      >
        字号与排版
      </SheetRow>
      <SheetRow
        icon={isDark ? '☀' : '🌙'}
        sub={isDark ? '当前深色' : '当前浅色'}
        onClick={() => {
          const next = isDark ? 'light' : 'dark';
          void import('../settings/theme').then((m) => m.applyTheme(next));
          useStore.getState().setSettings({ theme: next });
          showToast(isDark ? '已切换为浅色' : '已切换为深色');
        }}
      >
        明暗主题
      </SheetRow>
      <SheetSep />
      <SheetRow
        icon="🌳"
        onClick={() => {
          onOpenPage('worldtree');
          onClose();
        }}
      >
        平行世界树
      </SheetRow>
      <SheetRow
        icon="📊"
        onClick={() => {
          onOpenPage('dashboard');
          onClose();
        }}
      >
        仪表盘
      </SheetRow>
      <SheetRow
        icon="⚡"
        onClick={() => {
          onModel();
          onClose();
        }}
      >
        模型设置
      </SheetRow>
      <SheetRow
        icon="🖼"
        onClick={() => {
          void import('../export/shareImage').then(async (m) => {
            const s = useStore.getState();
            try {
              const r = await m.renderAndSaveShareImage({ title: s.title, tree: s.tree });
              showToast(r.path ? `长图已保存：${r.path}` : '已取消保存');
            } catch (e) {
              showToast(`长图保存失败：${e instanceof Error ? e.message : String(e)}`);
            }
          });
          onClose();
        }}
      >
        导出长图
      </SheetRow>
      <SheetSep />
      <SheetRow
        icon="⚙"
        onClick={() => {
          onOpenPage('settings');
          onClose();
        }}
      >
        设置
      </SheetRow>
    </>
  );
}
