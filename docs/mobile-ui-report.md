# 移动端 UI 重构验证报告（DCR Android）

日期：2026-09-13 ｜ 基准：彩云小梦手机端截图（需求图 1）
环境：Windows 构建机 + Android 15 x86_64 模拟器（API 35，headless）
产物：`src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`（已签名）

## 一、实现结构

新建 `src/mobile/` 独立壳层，与桌面壳共享 store / provider / worldtree / i18n 全部业务逻辑，仅重写布局与交互层：

| 文件 | 职责 |
|---|---|
| `platform.ts` | 启用条件：窗口 < 768px 或 Android UA（+ 响应式 Hook） |
| `copy.ts` | 移动文案表（上方/下方/轻点），附桌面禁用词合规测试 |
| `SheetPortal.tsx` | 底部弹层原语：圆角/遮罩/下拉关闭/Escape，portal 挂 body |
| `MobileShell.tsx` | 页面栈：编辑页 ↔ 书架页 / 世界树 / 仪表盘 / 设置 |
| `MobileTopBar.tsx` | §2 单行 56dp 顶栏 + 模型风格胶囊 + 更多菜单 Sheet |
| `MobileEditor.tsx` | §3 标题/元信息/全屏正文/红段工具条/悬浮 AI 球/错误重试 |
| `CandidateSheet.tsx` | §4 底部抽屉：档位手势/横向轮播/页码圆点/骨架屏 |
| `BookshelfPage.tsx` | §5 书架独立页：长按多选/操作 Sheet/文件夹/每书模型覆盖 |
| `TypographySheet.tsx` | 字号/行距/字体 BottomSheet（实时生效） |
| `mobile.css` | 全部移动样式，色板引用 design-tokens（珊瑚红 #F0655A） |

`App.tsx` 在 `useIsMobile()` 为真时渲染 `<MobileShell/>`，桌面渲染路径零改动。

## 二、逐项自查（对照图 1）

### §1 安全区与基础规范
- [x] 顶栏在状态栏之下，无任何元素与状态栏重叠（截图 1/4/6 全部尺寸核验）；壳层已带 `env(safe-area-inset-*)` 让位，Android 手势导航栏区域由 Sheet 的 `max(16px, env(safe-area-inset-bottom))` 避让
- [x] 可点击元素 ≥44dp：图标按钮 44×44；胶囊/换一批/红条工具条/重试为小视觉 + `::after` 外扩热区（.hit-44）
- [x] 正文区上下滑动滚动；抽屉下拉收起/关闭
- [x] 桌面残留清零：无分栏竖线、无侧边栏、无悬浮书架、无 Ctrl+Enter 提示（移动文案合规测试自动校验）
- [x] 全部弹出面板（更多菜单/模型风格/字号排版/书架操作/重命名/删除确认/文件夹/模型覆盖）均为 Bottom Sheet，无 popover，无裁切

### §2 顶栏
- [x] 顺序：＋新建 → 书架 → 居中应用名/风格名 → 珊瑚红胶囊「⚡ 模型 ▾」→ ···（截图 360-1 / 412-1）
- [x] 更多菜单 Sheet 含：保存、字号与排版、明暗主题、平行世界树、仪表盘、模型设置、导出长图、设置（截图 360-7 / 412-7）
- [x] 字数与最后保存时间移至标题下方浅灰小字（截图 360-4）

### §3 正文编辑页
- [x] 顶栏下为大号浅灰「标题」输入框 → 全屏正文，内边距 18dp，字号/行距引用排版设置（默认 18px/1.8）
- [x] 无虚线输入框、无「写下这段并续写」按钮；空文档 placeholder「写下故事开头…」直接输入；正文区空白处轻点也可聚焦
- [x] 红色未确认段 + 红色游标线 + 右对齐红色胶囊工具条（撤回/修改/继续）紧贴游标线、随正文滚动（截图 360-4 / 412-4，与图 1 层叠关系一致）
- [x] 键盘弹出正文上推、光标可见（截图 360-2 / 412-2，`interactive-widget=resizes-content`）
- [x] 右缘悬浮圆球为 AI 续写主入口；生成中呼吸动画 + 轻点取消（截图 360-3 捕获呼吸帧）
- [x] 生成失败时有错误卡片 + 重试按钮

### §4 候选抽屉
- [x] 默认不显示；生成开始升起约 40%（含「换一批」再次唤起）；可上拉至 75%、下拉收细条（64px 只露把手+标题）、再下拉完全关闭（档位函数 `nextSnap` 有单元测试）
- [x] 抽屉头部：🤖「看看 DCR 写的」+「换一批」胶囊 +「✕」（与图 1 一致）
- [x] 三条候选横向滑动轮播（scroll-snap）+ 页码圆点；采纳卡片左侧红竖条 + 浅红底；轻点卡片即替换红段（截图 360-5 / 412-5）
- [x] 生成中骨架屏（实现同桌面 skeleton 样式；注：mock 后端生成 <1s，模拟器截帧未能捕获骨架态，逻辑由桌面端与单元测试覆盖）
- [x] 抽屉升起时正文自动滚动使红段完整位于抽屉上方（按抽屉 42% 视口高计算滚动量）

### §5 书架独立页
- [x] 全屏页面栈切换，专属顶栏：← 返回 /「书架」/ 多选 / ＋新建（截图 360-6 / 412-6）；编辑页顶栏与候选抽屉不同时出现
- [x] 条目卡片：书名、更新日期、字数、所属文件夹
- [x] 长按 500ms 进入多选（Android 惯例），多选底部操作条：删除（带确认 Sheet）/ 移入文件夹
- [x] 单条「···」操作 Sheet：重命名、多选、导出 TXT、模型设置（每书覆盖 baseUrl/model/apiKey/温度，与桌面 storyOverride 一致）、移入文件夹、删除
- [x] 文件夹：新建文件夹 + 移入/移出，数据层与桌面共用 shelf.ts

## 三、截图清单（docs/mobile-ui-shots/）

360×800dp：`360-1-empty` `360-2-keyboard` `360-3-generating` `360-4-candidates` `360-5-adopted` `360-6-shelf` `360-7-moresheet`
412×915dp：`412-1-empty` `412-2-keyboard` `412-3-generating` `412-4-candidates` `412-5-adopted` `412-6-shelf` `412-7-moresheet`

安全区检查：14 张截图中状态栏区域均无应用元素侵入 —— **通过**。

## 四、过程中发现并修复的问题（勘误）

1. **候选抽屉标题折行**（「看看 DCR 写的」的「的」掉行）→ `white-space: nowrap + ellipsis`
2. **Sheet 末项被手势导航栏遮挡** → Sheet 底部 padding 改 `max(16px, env(safe-area-inset-bottom))`
3. **红段被抽屉盖住**：正文 textarea `min-height: 60vh` 在短文场景把红段推入抽屉区域 → 高度改为纯随内容（60px 起），并按抽屉高度计算自动滚动量
4. **悬浮球与「继续」按钮重叠** → 球上移至视口 40% 处（与图 1 位置一致）
5. **触控区不足**：胶囊 36px/工具条 36px → 补透明外扩热区至 ≥44dp
6. **换一批时已关闭的抽屉不再升起** → 改为按 generating 上升沿唤起

## 五、桌面回归与出包

- [x] 桌面布局与交互零变化：重新构建后 Windows 端截图比对，顶栏/书架/虚线输入框/候选栏与重构前一致
- [x] `vitest` 120/120 全绿（新增移动端平台判定 + 文案合规测试），`tsc --noEmit` 零错误
- [x] Windows 出包：`src-tauri/target/release/bundle/nsis/DreamCore-revival_0.1.0_x64-setup.exe`（含移动壳）
- [x] Android 出包：`src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`（已签名，apksigner 验签通过；项目根 `DreamCore-revival-0.1.0.apk` 为同文件副本）

## 六、遗留事项

- mock 后端生成过快，骨架屏/流式态在模拟器上转瞬即逝，截图以真实模型验证效果更佳
- 世界树/仪表盘/设置三个功能页复用桌面组件，窄屏下未做深度重排（可用，后续可单独优化）
- adb `input text` 不支持中文，验证流程中开头文本以 ASCII 输入，中文内容由 mock 候选采纳产生
