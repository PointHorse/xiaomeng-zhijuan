/**
 * Zustand 全局状态：编辑器 + 故事树 + 设置 + 生成中状态。
 * 持久化走 persist.ts（SQLite，5 秒防抖），本模块保持纯净可测。
 */
import { create } from 'zustand';
import {
  createTree,
  applyEditedText,
  growWithCandidates,
  switchCandidate,
  moveTo,
  undo,
  redo,
  appendUserText,
  fullText,
  currentNode,
  genId,
  timeline,
  type Candidate,
  type StoryTree,
} from '../worldtree/tree';
import type { AppSettings } from '../settings/settings';
import { DEFAULT_SETTINGS } from '../settings/settings';

export type ViewName = 'editor' | 'worldtree' | 'dashboard' | 'settings';
export type Phase = 'idle' | 'generating' | 'error';

export interface GenState {
  phase: Phase;
  /** 流式中的第一条候选文本（正文红色区渲染） */
  streamText: string;
  errorMessage: string;
  /** 推理模型已思考字数（阶段 3.5 §1②） */
  reasoningChars: number;
}

export interface AppState {
  storyId: string;
  title: string;
  tree: StoryTree;
  settings: AppSettings;
  view: ViewName;
  /** 生成状态 */
  gen: GenState;
  /** DCR：保留按钮——确认当前红色文本但不再续写 */
  redConfirmed: boolean;
  /** 全部候选（生成完成后填充） */
  candidates: Candidate[];
  /** 自动保存时间戳（ms），0 表示未保存过 */
  lastSavedAt: number;
  /** DCR②：正文就地编辑的撤销栈（每项 = 一次提交的全部节点旧文本） */
  editUndoStack: Array<Array<{ id: string; oldText: string }>>;
  /** 编辑过正文但未撤销标记（Ctrl+Z 优先弹编辑栈） */
  editAdoptedText: (newFull: string) => void;
  undoEdit: () => void;
  /** 记忆截断提示 */
  memoryTruncated: boolean;
  /** DCR⑦ 当前故事的模型覆盖（loadStory 时由 App 层填充） */
  storyOverride: { baseUrl?: string; model?: string; apiKey?: string; temperature?: number } | null;
  setStoryOverride: (ov: { baseUrl?: string; model?: string; apiKey?: string; temperature?: number } | null) => void;

  newStory: (title: string, rootText: string) => void;
  loadStory: (storyId: string, title: string, tree: StoryTree) => void;
  setTitle: (title: string) => void;
  setSettings: (patch: Partial<AppSettings>) => void;
  setView: (v: ViewName) => void;
  markSaved: () => void;

  /** 开始生成（进入流式状态） */
  beginGenerate: () => void;
  appendStream: (delta: string) => void;
  /** 推理模型思考中：更新已思考字数（阶段 3.5） */
  appendReasoning: (chars: number) => void;
  /** 完成一轮：写入候选树（candidates 全量 + 选中第一条） */
  finishGenerate: (candidates: Candidate[]) => void;
  failGenerate: (message: string) => void;
  /** 用户编辑红色文本后确认 */
  confirmEditedText: (text: string) => void;

  adoptCandidate: (candidateId: string) => void;
  /** 撤回：指针回退到生成前节点 */
  revertRed: () => void;
  /** DCR：保留当前红色文本（不续写） */
  keepRed: () => void;
  travelTo: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
}

function freshGen(): GenState {
  return { phase: 'idle', streamText: '', errorMessage: '', reasoningChars: 0 };
}

export const useStore = create<AppState>((set, get) => ({
  storyId: '',
  title: '未命名故事',
  tree: createTree(''),
  settings: { ...DEFAULT_SETTINGS },
  view: 'editor',
  gen: freshGen(),
  candidates: [],
  lastSavedAt: 0,
  memoryTruncated: false,
  redConfirmed: false,
  storyOverride: null,
  editUndoStack: [],

  editAdoptedText: (newFull) => {
    const t = get().tree;
    const path = timeline(t);
    const before = path.map((n) => ({ id: n.id, oldText: n.text }));
    const after = path.map((n) => ({ id: n.id, oldText: '' }));
    void after;
    applyEditedText(t, newFull);
    set({ tree: { ...t }, editUndoStack: [...get().editUndoStack.slice(-50), before] });
  },
  undoEdit: () => {
    const stack = get().editUndoStack;
    if (stack.length === 0) return;
    const last = stack[stack.length - 1];
    const t = get().tree;
    for (const e of last) {
      if (t.nodes[e.id]) t.nodes[e.id].text = e.oldText;
    }
    set({ tree: { ...t }, editUndoStack: stack.slice(0, -1) });
  },

  newStory: (title, rootText) => {
    set({
      storyId: genId('story'),
      title,
      tree: createTree(rootText),
      view: 'editor',
      gen: freshGen(),
      candidates: [],
      lastSavedAt: 0,
    });
  },

  loadStory: (storyId, title, tree) => {
    set({ storyId, title, tree, view: 'editor', gen: freshGen(), candidates: [], storyOverride: null });
  },
  setStoryOverride: (ov) => set({ storyOverride: ov }),

  setTitle: (title) => set({ title }),
  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
  setView: (view) => set({ view }),
  markSaved: () => set({ lastSavedAt: Date.now() }),

  beginGenerate: () => set({ gen: { phase: 'generating', streamText: '', errorMessage: '', reasoningChars: 0 }, candidates: [], redConfirmed: false }),
  keepRed: () => {
    const t = get().tree;
    const node = currentNode(t);
    // 保留 = 确认当前 AI 节点：转为已采纳正文（深灰），不再是红色待确认
    if (node && node.source === 'ai') node.confirmed = true;
    set({ tree: { ...t }, redConfirmed: true });
  },
  appendStream: (delta) => set({ gen: { ...get().gen, streamText: get().gen.streamText + delta } }),
  appendReasoning: (chars) => set({ gen: { ...get().gen, reasoningChars: chars } }),
  finishGenerate: (candidates) => {
    const t = get().tree;
    growWithCandidates(t, candidates, 0);
    set({ tree: { ...t }, gen: freshGen(), candidates });
  },
  failGenerate: (message) => set({ gen: { phase: 'error', streamText: '', errorMessage: message, reasoningChars: 0 } }),

  confirmEditedText: (text) => {
    const t = get().tree;
    const node = currentNode(t);
    if (node && node.source === 'ai') {
      // 修改确认：只改当前 AI 节点文本，并转为已采纳正文
      node.text = text;
      node.confirmed = true;
      set({ tree: { ...t } });
    } else {
      appendUserText(t, text);
      set({ tree: { ...t } });
    }
  },

  adoptCandidate: (candidateId) => {
    const t = get().tree;
    switchCandidate(t, candidateId);
    set({ tree: { ...t }, candidates: [...get().candidates] });
  },

  revertRed: () => {
    const t = get().tree;
    undo(t);
    set({ tree: { ...t } });
  },

  travelTo: (nodeId) => {
    const t = get().tree;
    moveTo(t, nodeId);
    set({ tree: { ...t }, candidates: [...currentCandidatesOf(t)] });
  },

  undo: () => {
    const t = get().tree;
    if (undo(t)) set({ tree: { ...t }, candidates: [...currentCandidatesOf(t)] });
  },
  redo: () => {
    const t = get().tree;
    if (redo(t)) set({ tree: { ...t }, candidates: [...currentCandidatesOf(t)] });
  },
}));

function currentCandidatesOf(t: StoryTree): Candidate[] {
  const node = currentNode(t);
  return node ? [...node.candidates] : [];
}

/** 供持久化层读取的全量文本 */
export function currentFullText(s: AppState): string {
  return fullText(s.tree);
}
