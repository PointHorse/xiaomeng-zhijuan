/**
 * 移动端文案表（§1 按端区分）：移动端禁止出现「左侧/右侧/点击/Ctrl」等桌面词汇，
 * 一律用「上方/下方/轻点」。与桌面 dict.ts 分离，避免共用键被桌面措辞污染。
 */

export const mobileCopy = {
  titlePlaceholder: '标题',
  writeOpening: '写下故事开头…',
  generating: '生成中…轻点圆球可取消',
  aiContinue: 'AI 续写',
  cancelGen: '取消生成',
  candidateTitle: '看看 DCR 写的',
  charCount: '{n} 字',
  lastSavedAt: '最后保存于 {t}',
  saved: '已保存「{t}」',
  exported: '已导出 .{kind}',
  // 书架
  shelfTitle: '书架',
  multiSelect: '多选',
  rename: '重命名',
  delete: '删除',
  modelSettings: '模型设置',
  export: '导出',
  newFolder: '新建文件夹',
  moveToFolder: '移入文件夹',
  noFolder: '未分类',
  deleteConfirm: '删除选中的 {n} 个故事？此操作不可恢复。',
  renamePromptTitle: '重命名',
  // 底部 Sheet 通用
  done: '完成',
  cancel: '取消',
} as const;

/** §1 合规校验：移动端文案不得含桌面词汇 */
const FORBIDDEN = ['左侧', '右侧', '点击', 'Ctrl', '鼠标', '右键'];

export function assertMobileCopyCompliance(copy: Record<string, unknown>): string[] {
  const violations: string[] = [];
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value !== 'string') continue;
    for (const word of FORBIDDEN) {
      if (value.includes(word)) violations.push(`${key} 含禁用词「${word}」`);
    }
  }
  return violations;
}
