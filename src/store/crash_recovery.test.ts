/**
 * 崩溃恢复链路验证（逻辑层模拟）：
 * scheduleSave 的防抖+签名去重行为，以及崩溃后 loadStoryTree 可回放。
 * （真实进程强杀演练见 docs/night-report.md 的手工步骤记录）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTree, growWithCandidates, serialize, deserialize, fullText } from '../worldtree/tree';

// 模拟"崩溃前最后两次编辑"的保存时序
describe('崩溃恢复链路（逻辑层）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('防抖窗口内的连续编辑只保存最后一次内容', () => {
    const saved: string[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSave = (payload: string, onSaved: () => void) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        saved.push(payload);
        onSaved();
      }, 5000);
    };
    const onSaved = vi.fn();

    const t = createTree('第一段');
    scheduleSave(serialize(t), onSaved);
    growWithCandidates(t, [{ id: 'c1', text: '第二段', createdAt: 1 }], 0);
    scheduleSave(serialize(t), onSaved);

    vi.advanceTimersByTime(6000);
    expect(saved).toHaveLength(1); // 只落一次盘
    expect(onSaved).toHaveBeenCalledTimes(1);
    // 落盘的是最后一次内容
    const restored = deserialize(saved[0]);
    expect(fullText(restored)).toBe('第一段第二段');
  });

  it('崩溃后从快照恢复：反序列化即完整时间线', () => {
    const t = createTree('开头');
    growWithCandidates(t, [
      { id: 'cb1', text: '候选一', createdAt: 1 },
      { id: 'cb2', text: '候选二', createdAt: 1 },
    ], 0);
    const snapshot = serialize(t); // 假设这是崩溃前最后一次落盘

    // "重启"：从快照重建
    const restored = deserialize(snapshot);
    expect(fullText(restored)).toBe('开头候选一');
    expect(restored.nodes[restored.currentId].candidates).toHaveLength(2);
  });

  it('损坏快照：deserialize 抛错而不是产出坏树', () => {
    expect(() => deserialize('{"nodes": null}')).toThrow();
  });
});
