# DCR 移动端 UI 刷新报告（阶段 2）

日期：2026-09-26 ｜ 依据：已确认的 docs/design-language.md（阶段 0）+ 阶段 1 组件库
平台：Windows 构建机 + Android 15 x86_64 模拟器（headless，软件渲染 swiftshader）
产物：`src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`（已签名）

---

## ① 页面级令牌统一

- `mobile.css` / `components.css` 裸色值与裸时长**清零**（grep 校验 0 残留）：10 处颜色（`#fff`→`--on-brand`、球投影三阶→`--brand-shadow-*`、遮罩→`--scrim` 等）+ 5 处时长（`--dur-spin/sweep/resolve/breath/breathe`）。
- 新增 dark 模式 tint 适配：`--brand-tint/--danger-tint/--success-tint/--warning-tint` 在 dark 下改为品牌色低透明度叠加（修复 dark 模式候选卡浅粉底刺眼问题）。
- **移动版设置页新建**（`MobileSettingsPage`）：模型服务（测试连接 loading/结果/自动探测）、生成参数、外观（主题/语言/字号排版 Sheet）、风格管理（内置+自定义列表、文风分析生成提示词、删除二次确认），全部使用阶段 1 组件。`probeModels` 抽至 `settings/probe.ts` 桌面移动共用（桌面 SettingsView 行为零变化）。
- 仪表盘/世界树：经 `.mshell` 桥接令牌自动继承新灰阶与文字色；内部复杂可视化保留桌面布局（见"不满意"§6.1）。

## ② 双尺寸截图对照（docs/ui-refresh-shots/）

| 状态 | 360×800 | 412×915 | 自查结论 |
| --- | --- | --- | --- |
| 空文档 | 360-1-empty | 412-1-empty | 顶栏/标题/占位/悬浮球正常，与 design-preview 令牌一致；无元素触碰状态栏 |
| 生成中（加载动画） | 360-2a/2b | 412-2a/2b/3 | 品牌浅粉模糊占位 + 扫光高光错相清晰可见；球变 ✕ 可取消；候选抽屉升起且卡片骨架同扫光 |
| 候选展示 | 360-3 | 412-3 | 采纳卡红竖条+浅红底（dark 下为低透明叠加，已修复刺眼问题）；页码圆点正常 |
| 底部弹层展开 | 360-4 | 412-4 | 玻璃底+圆角+把手+分隔线+sub 行；遮罩暗化生效（修复 portal 逃逸令牌作用域 bug 后） |
| 按钮处理中/成功 | 360-5 | 412-5 | 成功 toast「已保存…」完整显示且抬离手势栏（修复遮挡）；处理中 spinner 转瞬即逝未能定格，组件级由 9 条 Button 测试覆盖 |
| 书架多选 | 360-6 | 412-6 | 长按进入多选、勾选卡红边浅底、底部操作条完整可见（修复手势栏遮挡） |

过程勘误（均已修复并重新构建验证）：

1. **BottomSheet portal 逃逸令牌作用域**（严重）：portal 到 `document.body` 使 `--scrim/--glass-bg/--gray-*` 全部失效——菜单透明无底色无圆角，遮罩不可见。修复：portal 目标改为 `.mshell` 容器。
2. **长按书架条目误弹操作 Sheet**：Android 长按派发 `contextmenu`，行内调试代码直接 `setActionTarget`。修复：contextmenu 与长按手势统一进入多选；另加 `suppressClick` 吞掉长按后紧跟的 click（避免取消勾选）。
3. **红段工具条与悬浮 AI 球重叠**：工具条 `padding-right: 76px` 为球留位。
4. **成功 toast 被手势导航栏遮挡**：768px 断点内 toast `bottom` 抬高 44px。
5. **书架多选操作条被手势栏遮挡**：`mshelf-actions` 底部 padding 加 `max(env(...), 26px)` 兜底。
6. **dark 模式 tint 未适配**：新增 dark tint 令牌组。

## ③ 性能自检（GPU 渲染分析）

环境限制：headless 模拟器使用 **swiftshader 软件渲染，无 GPU**，绝对帧率不代表真机。采用"空闲 vs 动画"对照法隔离动画开销（`dumpsys gfxinfo`）：

| 场景 | 帧数 | Janky | p50 | p90 |
| --- | --- | --- | --- | --- |
| 书架空闲（无动画） | 16 | 100% | 34ms | 48ms |
| 生成中（扫光+玻璃浮层，8s 窗口） | 218 | 88% | 65ms | 81ms |

解读：空闲基线本身已超 16.7ms 预算（软件渲染固有开销），动画增量约 +31ms/帧。动画仅动 `transform/opacity/background-position`（无重排），主要渲染代价来自全屏 `backdrop-filter` 在软件渲染下的填充成本。**结论：模拟器数据无法证伪 60fps，需真机复测**（方法：开发者选项→GPU 渲染模式分析，或 `adb shell dumpsys gfxinfo <pkg>` 同法采样）；低端机风险缓解已内置：扫光仅 background-position、reduced-motion 降级、blur 半径 0.4rem 保守值。

## ④ 回归

- [x] vitest 138/138 全绿（新增 genLoadingPhase 3 条 + 阶段 1 组件 18 条）
- [x] `tsc --noEmit` 零错误；`vite build` 成功
- [x] Windows 桌面零变化：渲染路径未改（改动限 `src/mobile/**`、`settings/probe.ts` 函数搬家、global.css 768px 断点内 toast）；`tauri build` 出包成功
- [x] `tauri android build` 出包成功（签名沿用）

## ⑤ 当前体验最不满意的三处

1. **仪表盘与世界树仍是桌面布局**：在移动壳里是"桌面组件塞进容器"，表格/图表在窄屏下需要横向滚动，触控目标偏小。是本轮最大的未完成项——两者都是数据可视化界面，重排需要单独一轮设计（卡片化仪表盘 + 世界树的缩放/拖拽手势）。
2. **全屏 backdrop-filter 玻璃在低端机的代价**：扫光动画 + 玻璃浮层叠加时，软件渲染设备上帧成本明显（本报告 ③ 的对照数据）。真机上大概率无碍，但缺乏低端真机数据佐证；若真机掉帧，预案是把遮罩改为纯色（去 blur）只保留面板玻璃。
3. **设置页表单仍是"桌面表单竖排"的气质**：虽然已组件化（按钮/弹层/令牌全部到位），但 number 输入用的是系统数字键盘 + 精确值输入（温度 0.9 这种），对没有电脑的目标用户不友好——更适合做成滑杆 + 预设档（保守/均衡/狂野 三档 GEN_PRESETS 已存在，未接入移动端）。
