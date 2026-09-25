# DCR 移动端组件文档（阶段 1）

> 依据已确认的 docs/design-language.md。范围：`src/mobile/`（Android APK 主力平台）；
> Windows 桌面壳已冻结，本阶段零改动、零回归。

## §1 Button / Link / Switch 的使用规则

| 需求 | 用什么 | 禁止 |
| --- | --- | --- |
| 触发一个动作（保存、删除、开始续写） | `<Button variant=…>`（原生 `<button>`） | `<div>`/卡片冒充按钮 |
| 跳转到地址（外部网页、mailto 等 `href` 目标） | `<a>`（Link），保留浏览器语义 | 用 Button 包一层 onClick+location |
| 切换单一设置（开关型：如自动保存、暗色） | `<Switch>`（role="switch" 的控件，阶段 2 落地设置页时使用） | 用两个按钮或 checkbox 冒充 |

- **文案写动作本身**：「保存更改」「开始续写」「确认删除」；禁止「确定」「提交」「是」。
- **primary 每屏至多一个**：当前屏的主要动作（编辑页=「继续」；书架多选条=「删除」为其 danger 例外）。
- **danger 必须二次确认**：删除类操作先弹确认 Sheet（BookshelfPage 已实现），确认按钮文案「确认删除」。
- **禁用必须说明原因**：传 `disabledReason`，组件渲染为按钮下方的说明行。
- **处理中**：传 `loading`，按钮转 spinner 并阻止重复提交；结果反馈用 `successHint`（如「✓ 已保存」）。
- **触感反馈**：primary 点击自动触发轻触感（Tauri plugin-haptics，仅 Android 注册；桌面/不可用静默降级）。
- **可访问性**：原生 button 继承键盘操作；图标类按钮必须给 `aria-label`；320/390px 宽度下文字自动换行不截断。

## §2 Button API

```tsx
<Button
  variant="primary" | "secondary" | "danger" | "ghost"
  size="md" | "sm"
  loading?: boolean            // 处理中：spinner + 阻止重复提交 + aria-busy
  successHint?: string         // 成功反馈（role=status），调用方控制显隐
  disabledReason?: string      // 禁用原因（role=note），禁用时必传
  onClick={…}                  // primary 点击自动带触感
>动作文案</Button>
```

## §3 按钮替换清单（阶段 1 · Commit 1）

| 位置 | 原 | 现 |
| --- | --- | --- |
| 编辑页 · 红段工具条「继续」 | `<button class=mred-toolbar>` | `Button primary sm`（本屏 primary：确认并续写） |
| 编辑页 · 红段工具条「修改」 | 同上 | `Button secondary sm` |
| 编辑页 · 红段工具条「撤回」 | 同上 | `Button ghost sm` |
| 编辑页 · 修改态「确认」 | 同上 | `Button primary sm` |
| 编辑页 · 修改态「取消」 | 同上 | `Button ghost sm` |
| 编辑页 · 错误卡「重试」 | inline style button | `Button primary sm`（文案「重试续写」） |
| 编辑页 · 悬浮 AI 球 | `<button class=mai-ball>` | 保留原生按钮（浮球形态），触发时接 `haptic('light')` |
| 候选抽屉「换一批」 | `<button class=pill-refresh>` | `Button secondary sm` |
| 书架 · 多选条「删除」 | `<button class=danger>` | `Button danger` + 未勾选时 `disabledReason` |
| 书架 · 多选条「移入文件夹」 | `<button>` | `Button secondary` + 未勾选时 `disabledReason` |
| 书架 · 删除确认 Sheet 按钮 | `<button class=mprimary-btn>` | `Button danger`（文案「确认删除」，完成二次确认） |
| 书架 · 重命名「完成」 | `mprimary-btn` | `Button primary` |
| 书架 · 模型设置「完成」 | `mprimary-btn` | `Button primary` |
| 书架 · 新建文件夹 | `mprimary-btn` + disabled | `Button primary` + `disabledReason` |

保留为原生 `<button>`（图标按钮，非变体体系）：顶栏「＋新建 / 书架 / ···更多 / 模型胶囊 / 返回」、弹层「✕ 关闭」、书架行「⋯」。均为原生 button + `aria-label` + 44dp 触控区，符合规范中可访问性与触控要求。

## §4 BottomSheet（Commit 2）

- 全部弹出面板统一走 `BottomSheet`：升起 400ms 弹性（`--ease-spring`）、收回加速（`--ease-exit`）、遮罩 200ms 渐显、下拉 ≥90px 关闭、面板玻璃底 + 环境光阴影。
- 选项行 `SheetRow`：按压背景反馈；`aria-selected` 时品牌色 + 浅红底 + 右侧勾选图标；选中后弹层弹性收回。
- 适用场景：风格选择、模型/风格胶囊、字号与排版、更多菜单、书架条目操作（重命名/删除确认/文件夹/模型覆盖）。

## §5 生成中加载（Commit 3）

- 触发：生成开始且首字符未到时，红色续写位与三张候选卡显示 2~4 行模糊占位（品牌浅粉 + blur 4px）。
- 扫光：`background-position` 位移的高光 1.4s 循环；三卡错相 0.18s。
- 出字：占位层 300ms `blur→0 + 淡出` 过渡到流式文字。
- 仅动画 transform/opacity/background-position；`prefers-reduced-motion` 降级为 2.4s 呼吸。
