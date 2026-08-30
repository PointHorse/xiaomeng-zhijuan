/** i18n React 绑定：语言存于 Zustand settings.lang，t() 为纯取值函数 */
import { create } from 'zustand';
import { DICTS, type Dict, type Lang } from './dict';

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useI18n = create<I18nState>((set) => ({
  lang: 'zh',
  setLang: (lang) => set({ lang }),
}));

/** 组件内取翻译：t((d) => d.notSatisfied, {n: 3}) */
export function useT(): <P extends Record<string, string | number> | undefined>(pick: (d: Dict) => string, params?: P) => string {
  const lang = useI18n((s) => s.lang);
  const dict = DICTS[lang];
  return (pick, params) => {
    const v = pick(dict);
    // 若 pick 落空（词典键缺失），回退中文
    if (v === undefined) {
      const fallback = pick(DICTS.zh);
      return fallback ?? String(pick);
    }
    return interpolateKeys(v, params);
  };
}

function interpolateKeys(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let out = template;
  for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** 非 React 场景（纯函数/错误映射）直接取 */
export function tFor(lang: Lang): Dict {
  return DICTS[lang];
}

export type { Lang, Dict };
