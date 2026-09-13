/** 保存当前故事到书架（桌面/移动共用）。未命名时自动编号；成功后派发书架刷新。 */
import { useStore } from '../store/useStore';
import { showToast } from '../components/toast';
import { listShelfStories, nextUntitledNumber, saveToShelf } from './shelf';

export async function saveNowToShelf(): Promise<void> {
  const s = useStore.getState();
  // storyId 为空时自动创建（用户直接开始写而未走新建流程）
  let sid = s.storyId;
  if (!sid) {
    sid = `story_${Date.now().toString(36)}`;
    useStore.setState({ storyId: sid });
  }
  const existing = await listShelfStories().catch(() => []);
  let finalTitle = s.title.trim();
  if (!finalTitle || finalTitle === '未命名故事') {
    finalTitle = `未命名${nextUntitledNumber(existing.map((x) => x.title))}`;
  }
  await saveToShelf(sid, finalTitle, JSON.stringify(s.tree), existing.find((x) => x.id === sid)?.folderId ?? null);
  s.setTitle(finalTitle);
  s.markSaved();
  showToast(`已保存「${finalTitle}」`);
  window.dispatchEvent(new CustomEvent('shelf-refresh'));
}
