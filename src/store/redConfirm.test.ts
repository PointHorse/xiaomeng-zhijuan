/**
 * 回归测试：保留/修改确认后，AI 节点必须带 confirmed 标记。
 * 缺陷背景：keepRed 曾只设一个从未被渲染的 redConfirmed 标志，
 * 导致点「保留」后红色续写从界面上消失（树里有、哪儿都不显示）。
 */
import { describe, it, expect } from 'vitest';
import { useStore } from './useStore';
import { createTree, growWithCandidates, currentNode, type Candidate } from '../worldtree/tree';

function seedWithAiNode(text: string): void {
  const tree = createTree('开头。');
  const cand: Candidate = { id: 'c1', text, createdAt: Date.now() };
  growWithCandidates(tree, [cand], 0);
  useStore.setState({
    storyId: 's1',
    tree: { ...tree },
    gen: { phase: 'idle', streamText: '', errorMessage: '' },
  });
}

describe('保留/确认：AI 节点转为已采纳正文', () => {
  it('keepRed: 当前 AI 节点标记 confirmed=true', () => {
    seedWithAiNode('续写内容。');
    expect(currentNode(useStore.getState().tree)!.confirmed).toBeFalsy();
    useStore.getState().keepRed();
    expect(currentNode(useStore.getState().tree)!.confirmed).toBe(true);
  });

  it('confirmEditedText: 修改确认后文本更新且标记 confirmed=true', () => {
    seedWithAiNode('原始续写。');
    useStore.getState().confirmEditedText('修改后的续写。');
    const node = currentNode(useStore.getState().tree)!;
    expect(node.text).toBe('修改后的续写。');
    expect(node.confirmed).toBe(true);
  });

  it('confirmEditedText: 无 AI 节点时按用户输入追加，不受影响', () => {
    useStore.setState({
      storyId: 's2',
      tree: createTree('开头。'),
      gen: { phase: 'idle', streamText: '', errorMessage: '' },
    });
    useStore.getState().confirmEditedText('用户手写段。');
    const node = currentNode(useStore.getState().tree)!;
    expect(node.source).toBe('user');
    expect(node.confirmed).toBeFalsy();
  });
});
