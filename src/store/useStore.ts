/**
 * Zustand 全局状态：编辑器 + 故事树 + 设置 + 生成中状态。
 * 持久化走 persist.ts（SQLite，5 秒防抖），本模块保持纯净可测。
 */
import { create } from 'zustand';
import {
  createTree,
  growWithCandidates,
  switchCandidate,
  moveTo,
  undo,
  redo,
  appendUserText,
  fullText,
  currentNode,
  genId,
  type Candidate,
  type StoryTree,
} from '../worldtree/tree';
import type { AppSettings } from '../settings/settings';
import { DEFAULT_SETTINGS } from '../settings/settings';

export type ViewName = 'editor' | 'worldtree' | 'settings';
export type Phase = 'idle' | 'generating' | 'error';

export interface GenState {
  phase: Phase;
  /** 流式中的第一条候选文本（正文红色区渲染） */
  streamText: string;
  errorMessage: string;
}

export interface AppState {
  storyId: string;
  title: string;
  tree: StoryTree;
  settings: AppSettings;
  view: ViewName;
  /** 生成状态 */
  gen: GenState;
  /** 全部候选（生成完成后填充） */
  candidates: Candidate[];
  /** 自动保存时间戳（ms），0 表示未保存过 */
  lastSavedAt: number;
  /** 记忆截断提示 */
  memoryTruncated: boolean;

  newStory: (title: string, rootText: string) => void;
  loadStory: (storyId: string, title: string, tree: StoryTree) => void;
  setTitle: (title: string) => void;
  setSettings: (patch: Partial<AppSettings>) => void;
  setView: (v: ViewName) => void;
  markSaved: () => void;

  /** 开始生成（进入流式状态） */
  beginGenerate: () => void;
  appendStream: (delta: string) => void;
  /** 完成一轮：写入候选树（candidates 全量 + 选中第一条） */
  finishGenerate: (candidates: Candidate[]) => void;
  failGenerate: (message: string) => void;
  /** 用户编辑红色文本后确认 */
  confirmEditedText: (text: string) => void;

  adoptCandidate: (candidateId: string) => void;
  /** 撤回：指针回退到生成前节点 */
  revertRed: () => void;
  travelTo: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
}

function freshGen(): GenState {
  return { phase: 'idle', streamText: '', errorMessage: '' };
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
    set({ storyId, title, tree, view: 'editor', gen: freshGen(), candidates: [] });
  },

  setTitle: (title) => set({ title }),
  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
  setView: (view) => set({ view }),
  markSaved: () => set({ lastSavedAt: Date.now() }),

  beginGenerate: () => set({ gen: { phase: 'generating', streamText: '', errorMessage: '' }, candidates: [] }),
  appendStream: (delta) => set({ gen: { ...get().gen, streamText: get().gen.streamText + delta } }),
  finishGenerate: (candidates) => {
    const t = get().tree;
    growWithCandidates(t, candidates, 0);
    set({ tree: { ...t }, gen: freshGen(), candidates });
  },
  failGenerate: (message) => set({ gen: { phase: 'error', streamText: '', errorMessage: message } }),

  confirmEditedText: (text) => {
    const t = get().tree;
    const node = currentNode(t);
    if (node && node.source === 'ai') {
      // 修改确认：只改当前 AI 节点文本
      node.text = text;
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
