# DCR 阶段 3 报告：体验打磨与世界树节点画布

日期：2026-09-26 ｜ 版本：v0.3.0 ｜ 规则遵循：每项独立 commit（build + vitest + tsc 全绿后才提交）

---

## §1 遗留核查

① **APK 来源核对**：19:22 复制到项目根的 `DreamCore-revival-0.1.0.apk` 来自 18:38 构建；`git diff c1f4b76 HEAD` 源码为空（HEAD 即阶段 2 最终提交 c1f4b76，构建发生在提交前但工作区内容与之一致），**确认来源正确**。§6 仍按规范在最终提交上重新出包。

② **开关类设置盘点**（改造前 → 后）：

| 设置项 | 改造前 | 改造后 |
| --- | --- | --- |
| 明暗主题 | 三选 SheetRow（含"跟随系统"） | **拆为双 Switch**：「深色模式」+「跟随系统」 |
| 触感反馈 | 无开关（primary 自动触发） | **Switch**（`hapticsEnabled`，useHaptics 读取生效） |
| 性能模式 | 无 | **新增 Switch**（`performanceMode`，缺省按 `isLowPerfDevice()` 自动判定） |
| 减少动画 | 仅跟随系统 | **新增 Switch**（`reduceMotionOverride`，缺省跟随系统） |
| 界面语言 / 字号排版 | SheetRow 选择/入口 | 保留（选择性质，非开关） |

## Commit A：Switch / Slider 组件 + 设置页语义改造

- `Switch`：原生 `role="switch"` + `aria-checked`；thumb 弹性缓动（`--ease-spring`）；整行 ≥44dp；切换触发触感；禁用带原因。
- `Slider`：实时数值显示；**预设档位吸附**（`snapToPoints`：距档位 ≤step/2 时吸附，纯函数可测）。生成参数四项（温度/Top P/最大长度/记忆窗口）全部滑杆化，温度/Top P/最大长度吸附 GEN_PRESETS 档位（保守 0.6 / 平衡 0.9 / 脑洞 1.1；最大长度 800/1500/2500/4000）。
- 390/320 宽度排版：设置区全部流式布局（无固定宽），滑杆/开关最小触控 44dp，320dp 模拟器截图见 `docs/ui-refresh-shots/320-settings.png`，无截断溢出。

## Commit B：§2 低端机性能

- **blur 审计结果**（mobile 层）：`backdrop-filter` ×2（BottomSheet、候选抽屉玻璃）、实时 `filter: blur` ×1（骨架占位）。
- **骨架占位改 SVG 预渲染**：`feGaussianBlur` 模糊字形以 data-URI 位图化（light/dark 两份令牌 `--skel-blur-img`），**零实时 CSS filter**；扫光移至 `::after` 独立层保持不变；resolve/reduced-motion 行为保持。
- **性能模式**（`.mshell.perf`）：两处玻璃 `backdrop-filter` 去除，改 97% 不透明纯色；`isLowPerfDevice()`（hardwareConcurrency ≤4 或 deviceMemory ≤4）自动开启，设置页可覆盖。
- **帧率对比**（360dp 模拟器，生成动画 8s 窗口，`dumpsys gfxinfo`）：

| 版本 | 帧数 | Janky | p50 | p90 |
| --- | --- | --- | --- | --- |
| 阶段 2（CSS blur 骨架） | 218 | 88% | 65ms | 81ms |
| 阶段 3 SVG 骨架（perf OFF） | 261 | 51% | 46ms | 61ms |
| 阶段 3 perf ON | 314 | 47% | 46ms | 57ms |

相对改善：**p50 帧耗时 -30%**。注：headless 模拟器为 swiftshader 软件渲染（无 GPU），绝对值不代表真机；模拟器 `hardwareConcurrency` 命中低配判定故 perf 自动开启，两行数据同时验证了开关生效路径。

## Commit C：§4 仪表盘移动端重排

- 纵向卡片流：统计四卡（当前字数/续写轮次/全部总字数/总轮次）在上，输出历史列表在下（时间 + 候选数 + 两行摘要）。
- **展开/回退/清除全部走 BottomSheet**：轻点历史条目展开该轮全部候选（chosen 品牌色标记）+ 回退按钮；清除历史经确认 Sheet（danger）。数据层复用 `dashboard/data.ts`，会话级黑名单逻辑与桌面一致，**数据逻辑零改动**；桌面 `DashboardView` 保留。

## Commit D：§5 世界树画布原型（⛔ 停止点）

`docs/design-preview.html` 新增第 4 节「世界树节点画布原型」（30 节点 vanilla 实现，两段 script 经 `node --check` 语法校验，桌面浏览器实测渲染正常）：

- **节点三态**：已采纳（白底+珊瑚红左边条）/ 未采纳候选（浅粉）/ 被换一批淘汰（灰虚线）；卡片含序号、正文前 14 字、字数、状态标签。
- **连线**：贝塞尔曲线；根→当前路径珊瑚红虚线**流动动画**，其余浅灰。
- **手势**（全部实现，正式版将补自动化测试）：单指拖空白平移；双指缩放（0.2–2，锚点缩放）；轻点节点=预览弹层；按住 300ms=触感+进入拖动；长按松手未移动=操作弹层（回溯/从此继续/重命名/删除——删除二次确认）；双击空白=自适应视图。
- **折叠**：节点左上折叠钮，子树隐藏 + "+N" 角标；**语义缩放**：<55% 节点退化序号圆点。
- **导航**：右下小地图（全树缩略 + 视口框 + 点击跳转）、左下「回到当前」、「一键整理（自适应视图）」。
- `touch-action: none` 画布内接管手势，不与页面滚动/系统返回冲突。

**⛔ 按规范停止**：等待手机上试过手感并确认或提出修改后，再开发正式版（@xyflow/react + elkjs、tree_layout 表、可视区渲染、500 节点压测）。

## §6 终验

- ① vitest 143/143 全绿（无 fast-check：worldtree **不存在** property-based 测试，现有 tree.test.ts 12 例全过）；tsc 零错误；Windows 端 `tauri build` 出包且渲染路径未改（本阶段改动全部限定 `src/mobile/**` 与文档）。
- ② 截图：设置页（Switch+滑杆）`360-7/8-perf-switch.png`、`320-settings.png`；仪表盘、世界树全景/局部/预览/操作/折叠/500 节点远景**待原型确认后随正式版补齐**。
- ③ 出包：`DCR-v0.3.0-<shorthash>.apk` 与 Windows NSIS 安装包（见提交附件/项目根）。
- ④ **当前最不满意的三处**：
  1. 世界树正式版尚未落地——原型手势虽全，但真实树数据（tree_layout 持久化、elkjs 自动布局、可视区渲染）都还没接，30 节点原型与 500 节点目标之间还有可视区渲染这道坎。
  2. 设置页测试连接成功后不能顺带展示"可用模型列表选择"（现在只自动填第一个空模型名），用户仍需手打模型名。
  3. 触感反馈只有 selection/light 两档在用，删除确认等危险动作没有更重的反馈层次（plugin 支持 notificationFeedback 未接入）。

---

*阶段 3 完成于 Commit D + 终验提交；世界树正式版开发等原型手感确认。*
