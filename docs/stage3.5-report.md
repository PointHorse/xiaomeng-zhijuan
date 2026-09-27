# 阶段 3.5 报告：生成修复、功能找回与交互打磨（v0.3.5）

对应规范：阶段 3.5 §0–§7。验证环境：Android 模拟器（AVD dcr_test，360dp）+ 本地模拟服务器（scripts/mock-openai-server.mjs，10.0.2.2:8787）+ 应用内诊断日志。遵守 §0：未做 adb 真机调试，真机验收由用户手动完成；真实外部 API 仅使用会话内变量注入的 DeepSeek 官方 Key 完成一次验证，Key 未写入任何文件、日志或提交，验证后已从应用配置中清除。

---

## §1 续写失败：根因结论与修复（最高优先级）

**根因结论（四个，按权重排序）：**

1. **tauri-plugin-http 自动注入 `Origin` 头 → 中转站 CSRF 403。** 插件请求带 `Origin: http://tauri.localhost`，很多 OpenAI 中转站按浏览器 CSRF 规则直接拒绝。修复：http 插件启用 `unsafe-headers` feature，请求时显式置空 `Origin`（`provider/openai.ts`）。
2. **推理模型的 `reasoning_content` 长时间流动而 UI 零反馈。** DeepSeek 类模型先思考 10–20 秒甚至更久，旧 UI 只显示骨架屏，用户感知即「卡死/失败」。修复：SSE 层解析 `reasoning_content`（`provider/sse.ts`），编辑页实时显示「模型正在思考… 已思考 N 字」（`MobileEditor.tsx` 思考中态）。真实 DeepSeek V4.1-Flash 实测首字等待 11–20 秒，思考期间反馈正常（见 §1③ 实测）。
3. **推理模型把 `max_tokens` 全部耗在思考上，正文为空。** 旧版直接「成功但什么都没有」。修复：空正文视为失败并自动重试一次（重试时 `max_tokens` 翻倍），仍为空则给出明确中文原因「推理模型把生成长度全部用于思考，正文为空。请在设置中调大『最大生成长度』后重试。」
4. **Android release 禁止明文 http（`usesCleartextTraffic=false`）。** 用户自建的 http:// 中转/本地服务全部连接失败。修复：release manifestPlaceholders 置 `usesCleartextTraffic=true`，由用户自担明文风险（与桌面行为对齐）。

**排查中额外发现并修复的两个环境级阻断（等价于「第五、六个根因」）：**

5. **HTTP capability 端口匹配缺失。** tauri-plugin-http 的 URL 模式 `http://**` 中省略端口时只匹配默认端口（urlpattern 语义：缺失组件按空串匹配，插件只对 pathname/search/hash 补 `*`，不补 port）。所有带端口的地址（`http://10.0.2.2:8787`、`https://中转站:8443`）一律被 scope 拒绝，报「url not allowed on the configured scope」。修复：`src-tauri/capabilities/default.json` 增加 `http://**:*` 与 `https://**:*`。
6. **子页滚动回归。** `.msubpage-canvas-host { overflow: hidden }`（为世界树画布加）被同时挂在设置/仪表盘/诊断四个子页容器上，同优先级后声明覆盖了 `.msubpage-body` 的 `overflow-y: auto`——触屏下设置页完全无法滚动，诊断日志入口不可达。修复：canvas-host 类只挂世界树分支（`MobileShell.tsx`）。

### §1① 诊断日志页

设置 → 诊断 → 诊断日志（`MobileDiagnosticsPage.tsx`，`diagnostics/diagLog.ts`，localStorage 上限 50 条）：

- 每条记录：时间、地址（URL 中 key/api-key/token 参数自动打码 `***`）、模型、HTTP 状态码、首字耗时、总耗时、finish_reason、思考标记、判定文案、错误正文（截 500 字）。
- 成功绿边条 / 失败红边条；支持「复制全部日志」「清空」。
- 生成、测试连接、获取模型等所有模型请求均落日志（probe 走独立 fetch，不经 diag）。

### §1② 推理模型处理

- `reasoning_content` 增量计数透传（`StreamHandlers.onReasoningDelta`），仅候选 0 生效；
- 思考中 UI：「模型正在思考… 已思考 N 字」+ 呼吸圆点；正文到达后自动切换为流式正文；
- 首字超时 45s / 总超时 180s 双闸（超时文案区分「等待首字」与「总时长」），取消路径不受影响；
- 空正文 → 失败 + 可读原因（见根因 3）。

### §1③ 本地模拟服务器 9 场景实测

模拟器经 `http://10.0.2.2:8787/v1` 请求宿主机 mock（模型名决定场景，错误场景用手动输入模型名，贴近真实）。每个场景 3 条候选并发（失败自动重试一次，故诊断记录数 = 3 或 6）：

| # | 场景 | 实测结果 | 诊断日志表现 | 截图 |
|---|------|----------|--------------|------|
| 1 | 正常流式（normal） | 编辑页逐字流式渲染，完整收到 68 字，撤回/修改/继续 出现 | HTTP 200 · 首字 9–17ms · 总耗时 ~1.97s · finish_reason: stop | 360-11 |
| 2 | 先推理后正文（reasoning） | 「模型正在思考… 已思考 77 字」实时计数 → 正文 68 字流式完成 | 首字 1292ms（首帧 reasoning）· finish_reason: stop · 思考: 是 | 360-12/13 |
| 3 | 思考耗尽 max_tokens（empty） | 失败卡片显示「生成失败（已重试一次）：推理模型把生成长度全部用于思考，正文为空。请在设置中调大『最大生成长度』后重试。」+ 重试续写按钮 | HTTP 200 · finish_reason: length · 思考: 是 · 0 字 | 360-14/15/24 |
| 4 | 慢速首字 15s（slow） | 骨架屏等待 15 秒不误判、不超时，正文 20 字正常完成 | 首字 15094–15120ms · finish_reason: stop | 360-16/17 |
| 5 | 中途断流（break） | 服务端半途销毁连接 → 失败卡片（流式读取中断原因已透传） | HTTP 200 · verdict 流式读取中断 | 360-18 |
| 6 | 401（err401） | 失败卡片可读中文 + 服务端原文 | 「API Key 无效或未填写（401）。请到设置页检查 Key 是否正确」+ 错误正文 | 360-19/20 |
| 7 | 404 模型不存在（err404） | 同上 | 「模型名不存在，请在模型列表中重新选择（404）。也请检查 Base URL 是否以 /v1 结尾」+ 错误正文 | 360-22/23 |
| 8 | 429 限流（err429） | 同上 | 「请求过于频繁，已被限流（429）。稍等片刻再试，或降低生成频率」+ 错误正文 | 360-21/22 |
| 9 | http 明文地址 | 全部场景本身即跑在 `http://10.0.2.2` 明文地址上：cleartext 放行（根因 4）+ capability 端口放行（根因 5）共同验证 | 地址列显示 http:// 明文 | 360-11～27 全部 |

（截图位于 `docs/ui-refresh-shots/`。）

### §1④ DeepSeek 官方真实验证

- 端点 `https://api.deepseek.com/v1`，Key 经会话变量注入 adb input（未落盘）；
- 「获取模型」实拉列表：返回 **deepseek-flash（V4.1-Flash）/ deepseek-v4-pro**（DeepSeek 当前模型代目，非旧 deepseek-chat——搜索「deepseek-chat」无匹配是正确行为）；
- 选中 deepseek-flash 生成：思考阶段实时显示「已思考 650 字」，正文流式完成（故事为空，模型回复「请提供需要续写的文本。」11 字——行为正确）；
- 诊断记录：HTTP 200 · 首字 11235/12452/19759ms · finish_reason: stop · 思考: 是 —— **首字 11–20 秒即旧版「看似卡死」的直接实证**；
- 验证后 Key 已从应用配置清除（字段仅剩占位符），诊断日志不含任何 Key 材料。截图 360-25/26/27。

---

## §2 功能完整性回归（对照桌面）

逐项对照桌面版，移动端状态：

| 功能 | 桌面 | 移动端（阶段 3.5 后） | 备注 |
|------|------|----------------------|------|
| 模型服务配置（URL/Key/模型名/测试连接） | ✓ | ✓ 设置页 + 顶栏模型面板（双入口共享 store） | |
| 获取模型列表（/v1/models 可搜索） | ✓ | ✓ 新增（顶栏面板，阶段 3.5 §4） | |
| 每本书模型覆盖（仅本书/全局） | ✓ | ✓ 顶栏面板 scope 切换 | |
| 生成参数（温度/Top P/最大长度/记忆窗口/预设档位） | ✓ | ✓ 设置页滑杆 | |
| 外观（深色/跟随系统/语言/字号排版） | ✓ | ✓ 设置页 + TypographySheet | |
| 风格管理（内置 + 自定义新建/分析/删除） | ✓ | ✓ 设置页风格管理 | |
| 风格快捷切换 | 顶栏胶囊 | ✓ 顶栏风格胶囊（阶段 3.5 §4） | |
| 书架（多选/删除/文件夹） | ✓ | ✓ | |
| 书架导出 TXT/JSON/MD | ✓ 三格式 | ✓ 三格式 | **阶段 2 丢失、本阶段找回**：旧实现仅 TXT |
| 历史版本/仪表盘 | ✓ | ✓ 纵向卡片流 + BottomSheet 版历史 | |
| 平行世界树 | ✓ | ✓ 正式版画布（阶段 3，本轮冻结不开发） | |
| 导出分享长图（预览 + 保存 + 复制） | ✓ 保存对话框 | ✓ 预览弹窗（BottomSheet 内 img 预览 + 保存到 appDataDir + 复制 dataUrl） | **阶段 2 丢失、本阶段找回** |
| 编辑器撤销/重做、字数统计、自动保存 | ✓ | ✓ | |

**丢失提交定位**：阶段 2 顶栏重写（`c1f4b76` 阶段2：页面级落地与验证 及其前置 4280ae2）将旧顶栏的功能收拢时丢弃了「长图预览」与「书架多格式导出」的移动入口；本阶段在 `阶段3.5-F` 找回（`renderShareDataUrl` 无对话框渲染 + `buildJsonExport`/`buildMdExport`）。

---

## §3 加载动画恢复与性能判定收紧

- `skel-line` 恢复阶段 2 的 CSS `blur(4px)` 骨架 + 扫光（`resolve` 渐清晰 keyframes 回归）；性能模式（`.mshell.perf`）仍用预渲染 SVG data-URI（`--skel-blur-img`），保低端机帧率。
- `isLowPerfDevice` 判定由「核数 ≤ 4 **或** 内存 ≤ 4」收紧为「核数 ≤ 4 **且** 内存 ≤ 4」：原「或」会把 8 核 4GB 的主流机误判为低端（8 核性能充足，仅内存紧张，不应牺牲动效）。理由：核数决定模糊/扫光这类逐帧合成开销的主要上限，内存只影响缓存余量；两者同时低才值得降级。

## §4 顶栏双胶囊

- 布局：`＋｜书架｜[模型胶囊][风格胶囊]｜···`，应用名移除（`MobileTopBar.tsx` 重写）。
- 模型面板：范围选择（仅本书/全局默认，默认仅本书，带说明文案）、Base URL、API Key（掩码 + 显示切换）、「获取模型」（`/v1/models`，可搜索列表，点击行即生效）、「保存并生效」、模型名手动输入兜底；错误场景可用手动模型名触发（§1③ 6–8 即此路径）。
- 风格胶囊：列表选择，与设置页共享 activeStyle。
- MoreMenu 增加「导出长图」→ 预览 Sheet（§2 找回项）。

## §5 图标系统

- 新增 `components/Icon.tsx`：`import.meta.glob` 加载 `src/assets/icons/`（SVG 优先、PNG 兜底、缺失显示占位块），SVG 经 toCurrentColor 全量 `currentColor` 化。
- 36 个 Lucide 占位图标落库；移动端全部 emoji 图标清除（工具条/AI 球/菜单/Sheet 行/设置分组）。
- `docs/icon-inventory.md`：26 个在用图标的名称/位置/尺寸/画布/2x3x 与绘制规范。

## §6 点击反馈

- 移除系统高亮（tap highlight 全局关）。
- 珊瑚红胶囊：内侧 3px 白线绕行 350ms（SVG stroke-dashoffset 动画，`m-btn-ring`）。
- 其他按钮：底部中央 2px 线条展开淡出（`[data-line-fx]` 事件委托，含 BottomSheet 行）。
- `prefers-reduced-motion` / 减少动画开关时全部降级为无动效。
- `docs/design-preview.html` 追加两项反馈的演示区块。

---

## 排查期间顺手修复（不在 § 清单内）

1. BottomSheet portal 到 `.mshell`（原挂 body 逃逸令牌作用域，弹层透明）；
2. Android 长按 contextmenu 误触多选——与长按手势统一并吞 click；
3. 失败错误卡片对比度：`--accent-soft/--accent-text`（暗色下不可读）→ `--danger-tint/--danger` + 红描边（`MobileEditor.tsx`）；
4. 失败文案链：候选重试后丢弃具体原因 → 透传「生成失败（已重试一次）：〈具体原因〉」（`provider/candidates.ts`）；
5. 诊断 verdict「成功（0 字）」误导 → 「HTTP 200 但正文为空」（`provider/openai.ts`）。

## 终验

- `npx tsc --noEmit` 零错误；`vitest run` 25 文件 154 用例全绿（含桌面共享用例，Windows 逻辑零回归）；`npm run build` 通过。
- Windows：桌面组件未改动；改动仅 mobile/、provider（文案级）、capabilities（仅放行范围扩大）。NSIS 包随 v0.3.5 重新出包验证。
- 模拟器截图清单：`docs/ui-refresh-shots/360-10`～`360-27`（双胶囊顶栏、9 场景、诊断页、DeepSeek 实测）。
- 出包：`DCR-v0.3.5-<shorthash>.apk`（universal release）+ Windows NSIS。

## 三处不满意（如实记录）

1. **世界树 500 节点远景软渲染 p50 ≈ 250ms**（阶段 3 遗留，本轮冻结未动）：拖拽平移时帧内布局+分批渲染仍有可感顿挫，真机上大概率更明显。根治需要把 dagre 布局移出交互热路径（增量布局或 Web Worker），工作量超出本轮范围。
2. **候选失败时错误卡片位于候选抽屉下层，被抽屉遮罩压暗**：用户第一眼看到的是抽屉内的暗红文字，要点掉抽屉才见到完整错误卡与「重试续写」。应把失败态提升到抽屉内部渲染（结构改动波及 CandidateSheet 状态机，本轮只修了对比度与文案）。
3. **模型列表搜索框与「模型名（手动输入）」共用同一个 state**：语义耦合——输入模型名即过滤列表，列表为空时提示「无匹配模型，可手动输入」，但「搜索」和「指定」两个意图没有视觉分离；首次使用者容易把搜索词当成模型名保存。应拆成独立搜索框 + 显式「使用此模型名」动作。
