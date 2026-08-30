/** 轻量 i18n：无依赖、类型安全、词典即对象 */

export type Lang = 'zh' | 'en';

/** 界面文案键（中英双语包共享此结构，编译期校验缺漏） */
export interface Dict {
  // 顶栏
  appName: string;
  storyTitlePlaceholder: string;
  charCount: string;
  lastSaved: string;
  notSavedYet: string;
  dreaming: string;
  menu: string;
  // 菜单
  newStory: string;
  exportJson: string;
  exportTxt: string;
  exportMd: string;
  exportPng: string;
  worldTree: string;
  settings: string;
  // 编辑器
  inputPlaceholder: string;
  writeAndContinue: string;
  memoryTruncated: string;
  undoRed: string;
  editRed: string;
  continueGen: string;
  confirm: string;
  cancelAction: string;
  retry: string;
  genFailed: string;
  cancelled: string;
  candidatesInRound: string;
  candidateHint: string;
  emptyContent: string;
  // 候选栏
  notSatisfied: string;
  clickOtherCards: string;
  refreshBatch: string;
  dreamingHint: string;
  // 生成中
  generatingCancel: string;
  // 世界树
  worldTreeTitle: string;
  worldTreeSub: string;
  backToEditor: string;
  nodeUser: string;
  nodeAi: string;
  nodeCurrent: string;
  branchTag: string;
  emptyTree: string;
  clickTravel: string;
  // 设置
  settingsTitle: string;
  settingsSub: string;
  sectionModel: string;
  sectionGen: string;
  sectionAppearance: string;
  sectionLang: string;
  baseUrl: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  model: string;
  modelPlaceholder: string;
  testConn: string;
  testing: string;
  autoDetect: string;
  connOk: string;
  connFail: string;
  presetConservative: string;
  presetBalanced: string;
  presetWild: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  contextWindow: string;
  theme: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  fontSize: string;
  lineHeight: string;
  language: string;
  langZh: string;
  langEn: string;
  back: string;
  // 提示
  saved: string;
  exportedFile: string;
  newStoryConfirm: string;
  switchFastConfirm: string;
  localModelFound: string;
  localModelNotFound: string;
  // 错误提示（provider 层注入参数）
  errKeyInvalid: string;
  errForbidden: string;
  errNotFound: string;
  errRateLimit: string;
  errServer: string;
  errConnect: string;
  errTimeout: string;
  errStream: string;
  errEmpty: string;
  errCancelled: string;
  // 风格系统
  styleLabel: string;
  styleHint: string;
  customStyleAdd: string;
  customEditTitle: string;
  customNewTitle: string;
  customNameLabel: string;
  customSourceLabel: string;
  customSourcePlaceholder: string;
  customAnalyzing: string;
  customAnalyzeBtn: string;
  customPromptLabel: string;
  customPromptPlaceholder: string;
  customSaveBtn: string;
  customDeleteConfirm: string;
  // 仪表盘
  dashTitle: string;
  dashSub: string;
  dashChars: string;
  dashRounds: string;
  dashTotalChars: string;
  dashTotalRounds: string;
  dashHistoryTitle: string;
  dashEmpty: string;
  dashCandidates: string;
  dashRestore: string;
  dashChosen: string;
  dashDiscarded: string;
  dashClearAll: string;
  dashClearConfirmTitle: string;
  dashClearConfirmBody: string;
  dashRestored: string;
}

export const zh: Dict = {
  appName: '小梦织卷',
  storyTitlePlaceholder: '未命名故事',
  charCount: '字数统计：{n} 字',
  lastSaved: '最后保存于 {t}',
  notSavedYet: '尚未保存',
  dreaming: '小梦正在做梦…',
  menu: '菜单',
  newStory: '新建故事',
  exportJson: '导出 JSON',
  exportTxt: '导出 TXT',
  exportMd: '导出 Markdown',
  exportPng: '分享长图',
  worldTree: '平行世界树',
  settings: '设置',
  inputPlaceholder: '在这里写下或粘贴故事开头… 按 Ctrl+Enter 生成续写',
  writeAndContinue: '✒ 写下这段并续写',
  memoryTruncated: '记忆截断：仅使用最近 {n} 字作为上下文',
  undoRed: '撤回',
  editRed: '修改',
  continueGen: '继续',
  confirm: '确认',
  cancelAction: '取消',
  retry: '重试',
  genFailed: '生成失败',
  cancelled: '已取消',
  candidatesInRound: '本轮共 {n} 条候选，可在右侧切换',
  candidateHint: '在左侧写下故事开头并生成后，三条候选会出现在这里。',
  emptyContent: '在左侧写下故事开头并生成后，三条候选会出现在这里。',
  notSatisfied: '没有满意的？',
  clickOtherCards: '点击其他卡片看一看',
  refreshBatch: '换一批',
  dreamingHint: '小梦正在做梦…',
  generatingCancel: '生成中… 点击取消',
  worldTreeTitle: '平行世界树',
  worldTreeSub: '点击任意节点穿越回该时间线继续创作；原分支完整保留。',
  backToEditor: '返回正文',
  nodeUser: '用户',
  nodeAi: 'AI 续写',
  nodeCurrent: '当前',
  branchTag: '分叉 · {n} 条候选',
  emptyTree: '暂无节点',
  clickTravel: '点击穿越到此节点',
  settingsTitle: '设置',
  settingsSub: '全部数据仅保存在本机；API Key 经 Windows DPAPI 加密存储。',
  sectionModel: '模型服务',
  sectionGen: '生成参数',
  sectionAppearance: '外观',
  sectionLang: '语言 / Language',
  baseUrl: 'Base URL',
  apiKey: 'API Key',
  apiKeyPlaceholder: '本地服务可留空',
  model: '模型名',
  modelPlaceholder: '留空或填 mock 试用演示模式',
  testConn: '测试连接',
  testing: '测试中…',
  autoDetect: '自动探测本地服务',
  connOk: '连接成功 · {ms}ms · {n} 个模型',
  connFail: '失败：{e}',
  presetConservative: '保守',
  presetBalanced: '平衡',
  presetWild: '脑洞',
  temperature: '温度',
  topP: 'Top P',
  maxTokens: '最大生成长度',
  contextWindow: '记忆窗口（字）',
  theme: '主题',
  themeSystem: '跟随系统',
  themeLight: '浅色',
  themeDark: '深色',
  fontSize: '字号',
  lineHeight: '行距',
  language: '界面语言',
  langZh: '中文',
  langEn: 'English',
  back: '返回正文',
  saved: '已保存',
  exportedFile: '已导出 .{ext}',
  newStoryConfirm: '新建故事？当前故事已自动保存。',
  switchFastConfirm: '切换模式？正在生成的内容会中断。',
  localModelFound: '检测到本地模型服务：{url}（模型：{model}）',
  localModelNotFound: '未发现本地模型服务（已探测 11434 / 1234 / 8080）',
  errKeyInvalid: 'API Key 无效或未填写（401）。请到设置页检查 Key 是否正确',
  errForbidden: '无权访问该模型（403）。请确认账号已开通此模型、Key 权限充足',
  errNotFound: '端点或模型不存在（404）。请检查 Base URL 是否以 /v1 结尾、模型名是否正确',
  errRateLimit: '请求过于频繁，已被限流（429）。稍等片刻再试，或降低生成频率',
  errServer: '模型服务暂时不可用（{status}）。请稍后重试',
  errConnect: '无法连接模型服务：{msg}',
  errTimeout: '连接模型服务超时：请确认服务已启动、地址正确（{msg}）',
  errStream: '流式读取中断：{msg}',
  errEmpty: '模型未返回正文（可能已耗尽生成长度），建议在设置中调大「最大生成长度」',
  errCancelled: '已取消',
  styleLabel: '风格',
  styleHint: '选中风格的提示词将注入每次续写请求',
  customStyleAdd: '自定义',
  customEditTitle: '编辑风格',
  customNewTitle: '新建风格',
  customNameLabel: '风格名称',
  customSourceLabel: '源文章',
  customSourcePlaceholder: '粘贴一段你想模仿的文章（至少 50 字）…',
  customAnalyzing: '分析中…',
  customAnalyzeBtn: '分析文风并生成提示词',
  customPromptLabel: '风格提示词（可手改）',
  customPromptPlaceholder: '点击上方按钮自动生成，或直接手写…',
  customSaveBtn: '保存并启用',
  customDeleteConfirm: '确定删除该自定义风格？',
  dashTitle: '仪表盘',
  dashSub: '数据复用平行世界树，只读展示 + 候选区回退。',
  dashChars: '当前故事字数',
  dashRounds: '当前故事续写次数',
  dashTotalChars: '全部故事总字数',
  dashTotalRounds: '全部故事续写次数',
  dashHistoryTitle: '输出历史',
  dashEmpty: '还没有续写记录。生成一次后，每轮的三条候选都会出现在这里。',
  dashCandidates: '候选',
  dashRestore: '恢复到候选区',
  dashChosen: '已采纳',
  dashDiscarded: '未采纳',
  dashClearAll: '清除全部历史',
  dashClearConfirmTitle: '清除输出历史？',
  dashClearConfirmBody: '仅清空仪表盘展示记录，不会删除平行世界树节点，也不影响正文。此操作不可撤销。',
  dashRestored: '已将该轮候选恢复到右侧候选区。',
};

export const en: Dict = {
  appName: 'Xiaomeng Weaver',
  storyTitlePlaceholder: 'Untitled Story',
  charCount: 'Characters: {n}',
  lastSaved: 'Saved at {t}',
  notSavedYet: 'Not saved yet',
  dreaming: 'Xiaomeng is dreaming…',
  menu: 'Menu',
  newStory: 'New Story',
  exportJson: 'Export JSON',
  exportTxt: 'Export TXT',
  exportMd: 'Export Markdown',
  exportPng: 'Share as Image',
  worldTree: 'World Tree',
  settings: 'Settings',
  inputPlaceholder: 'Write or paste your story opening here… Ctrl+Enter to continue',
  writeAndContinue: '✒ Use this and Continue',
  memoryTruncated: 'Memory truncated: using last {n} characters as context',
  undoRed: 'Undo',
  editRed: 'Edit',
  continueGen: 'Continue',
  confirm: 'Confirm',
  cancelAction: 'Cancel',
  retry: 'Retry',
  genFailed: 'Generation failed',
  cancelled: 'Cancelled',
  candidatesInRound: '{n} candidates this round — switch on the right',
  candidateHint: 'Write an opening on the left and generate; three candidates will appear here.',
  emptyContent: 'Write an opening on the left and generate; three candidates will appear here.',
  notSatisfied: 'Not satisfied?',
  clickOtherCards: 'Click another card to explore',
  refreshBatch: 'Refresh',
  dreamingHint: 'Xiaomeng is dreaming…',
  generatingCancel: 'Generating… click to cancel',
  worldTreeTitle: 'World Tree',
  worldTreeSub: 'Click any node to travel back to that timeline; all branches are preserved.',
  backToEditor: 'Back to Editor',
  nodeUser: 'You',
  nodeAi: 'AI',
  nodeCurrent: 'Current',
  branchTag: 'Branch · {n} candidates',
  emptyTree: 'No nodes yet',
  clickTravel: 'Click to travel to this node',
  settingsTitle: 'Settings',
  settingsSub: 'All data stays local; API keys are encrypted with Windows DPAPI.',
  sectionModel: 'Model Service',
  sectionGen: 'Generation',
  sectionAppearance: 'Appearance',
  sectionLang: 'Language / 语言',
  baseUrl: 'Base URL',
  apiKey: 'API Key',
  apiKeyPlaceholder: 'Leave empty for local services',
  model: 'Model',
  modelPlaceholder: 'Empty or "mock" for demo mode',
  testConn: 'Test Connection',
  testing: 'Testing…',
  autoDetect: 'Auto-detect local services',
  connOk: 'Connected · {ms}ms · {n} models',
  connFail: 'Failed: {e}',
  presetConservative: 'Conservative',
  presetBalanced: 'Balanced',
  presetWild: 'Wild',
  temperature: 'Temperature',
  topP: 'Top P',
  maxTokens: 'Max Tokens',
  contextWindow: 'Context Window (chars)',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  fontSize: 'Font Size',
  lineHeight: 'Line Height',
  language: 'Language',
  langZh: '中文',
  langEn: 'English',
  back: 'Back to Editor',
  saved: 'Saved',
  exportedFile: 'Exported .{ext}',
  newStoryConfirm: 'Start a new story? The current one has been auto-saved.',
  switchFastConfirm: 'Switch mode? Ongoing generation will be interrupted.',
  localModelFound: 'Local model service detected: {url} (model: {model})',
  localModelNotFound: 'No local model service found (probed 11434 / 1234 / 8080)',
  errKeyInvalid: 'API key invalid or missing (401). Check your key in Settings',
  errForbidden: 'Access denied for this model (403). Check your plan and key permissions',
  errNotFound: 'Endpoint or model not found (404). Check the Base URL ends with /v1 and the model name',
  errRateLimit: 'Rate limited (429). Wait a moment or slow down generation',
  errServer: 'Model service unavailable ({status}). Please retry later',
  errConnect: 'Cannot connect to model service: {msg}',
  errTimeout: 'Connection timed out: make sure the service is running ( {msg} )',
  errStream: 'Stream interrupted: {msg}',
  errEmpty: 'Model returned no text (length budget likely spent). Try raising "Max Tokens" in Settings',
  errCancelled: 'Cancelled',
  styleLabel: 'Style',
  styleHint: 'The selected style prompt is injected into every continuation request',
  customStyleAdd: 'Custom',
  customEditTitle: 'Edit Style',
  customNewTitle: 'New Style',
  customNameLabel: 'Style name',
  customSourceLabel: 'Source article',
  customSourcePlaceholder: 'Paste an article whose style you want to imitate (50+ chars)…',
  customAnalyzing: 'Analyzing…',
  customAnalyzeBtn: 'Analyze style & generate prompt',
  customPromptLabel: 'Style prompt (editable)',
  customPromptPlaceholder: 'Click the button above to auto-generate, or write your own…',
  customSaveBtn: 'Save & apply',
  customDeleteConfirm: 'Delete this custom style?',
  dashTitle: 'Dashboard',
  dashSub: 'Reuses the world tree, read-only + candidate restore.',
  dashChars: 'Current story characters',
  dashRounds: 'Current story generations',
  dashTotalChars: 'Total characters (all stories)',
  dashTotalRounds: 'Total generations (all stories)',
  dashHistoryTitle: 'Output History',
  dashEmpty: 'No generations yet. Every round of three candidates will appear here.',
  dashCandidates: 'Candidates',
  dashRestore: 'Restore to candidates panel',
  dashChosen: 'Adopted',
  dashDiscarded: 'Discarded',
  dashClearAll: 'Clear all history',
  dashClearConfirmTitle: 'Clear output history?',
  dashClearConfirmBody: 'Only clears dashboard records. World tree nodes and story text are untouched. This cannot be undone.',
  dashRestored: 'Candidates of this round restored to the right panel.',
};

export const DICTS: Record<Lang, Dict> = { zh, en };

/** 简单插值：'{n}' / '{t}' / '{ms}' 等占位符按 params 键替换 */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let out = template;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}
