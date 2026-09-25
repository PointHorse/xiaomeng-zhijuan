# DCR 设计语言 v2 · Peroxide × 珊瑚红融合方案

> 阶段 0 产出 · 设计调研文档 · 不含任何业务代码变更
> 调研对象：[Peroxide](https://github.com/OxygenNine/Peroxide)（过氧化物基础版式，Wikidot 站点 CSS 主题）
> 本文档所有对 Peroxide 的引用均标注 `文件名:行号`（基于 commit 快照 v1.0.1-release，`--p-version` 见 CSS/Variables.css:404）。

---

## 0. 许可条款与使用范围（必读）

Peroxide 采用 **Creative Commons 署名-相同方式共享 4.0 国际（CC BY-SA 4.0）** 许可（`LICENSE:1`，全文为标准 CC BY-SA 4.0 文本）。

对我们意味着：

| 行为 | 是否允许 | 条件 |
| --- | --- | --- |
| 阅读、学习其设计手法与参数（颜色、时长、圆角等**数值事实**） | 允许 | 无（设计参数/思想本身不受版权保护） |
| 参考"风格气质"在 DCR 中**重写实现**（自写 CSS/组件，不复制其源码） | 允许 | 建议在文档中致谢（本文档已做） |
| **逐字复制**其 CSS 代码 / SVG 资源进 DCR | 允许但有约束 | 该部分构成 Adapted Material：分发 DCR 时需（a）署名 OxygenNine 并附许可证链接；（b）被复制部分以 CC BY-SA 4.0 相同方式共享（LICENSE §3a, §3b） |
| 将 DCR 闭源商业分发 | 允许 | 前提同上：不含逐字复制的 Peroxide 素材，或对复制部分遵守 BY-SA |

**本项目采取的合规策略**：只提取设计参数与手法（令牌数值、动效曲线、层次规律），全部实现由 DCR 自行编写，不逐字复制 Peroxide 的 CSS 行。此策略下 DCR 不产生 BY-SA 传染义务。本文档按学术惯例保留完整出处。

---

## 1. Peroxide 设计要素取证（逐项：出处 + 内容）

### 1.1 配色体系

| 要素 | 出处 | 内容 |
| --- | --- | --- |
| 7 级中性灰 | CSS/Variables.css:13-19 | `#ffffff / #f5f5f5 / #dedede / #707070 / #414141 / #1e1e1e / #000000` |
| 黑白透明度梯度 | Variables.css:21-28 | 白/黑各 85% / 65% / 40% / 20% 四档 |
| 6 组语义色（三阶 light/base/dark） | Variables.css:30-47 | 红 `#dd7a7a/#e72a2a/#7b1111`、绿、蓝、黄、紫、橙，每组的 light/dark 都由 base 手调（非算法生成） |
| 层次调色盘 gray-0~7 | Variables.css:50-57 | 语义化层次：0=页面底 → 7=最深；供组件引用而非直接用绝对色 |
| 主题色三阶 | Variables.css:59-61 | `#3b69e4(light) / #3d5cab(base) / #354f96(dark)` |
| color-mix 派生色 | Variables.css:86-103 | 主题色与白/黑按 10%~90% 混合生成 18 个派生变量（W10~W90 / B10~B90）——**hover/active/disabled 色阶算法化的关键手法** |
| 功能语义色 | Variables.css:72-83 | warning `#e72a2a`、success `#7acc7a`、info `#7aaccd`、danger `#e7922a`（橙），各带 dark/light |
| 暗色方案 | Branches/Substance/theme.css:3-20 | **不引入 prefers-color-scheme，而是整表反转 gray-0~7 的赋值**（0=最暗 `#181818`，7=最亮）+ 透明度变量对调 |
| 红调色板示例 | Settings/Palettes/red.css:9-13 | theme 三阶换为 `#e43b3b/#ab3d3d/#963535` + 头部 SVG 图案叠加渐变 `linear-gradient(45deg, light, dark)` |
| 链接色 | Variables.css:286-288 | link=主题色、visited=主题色 dark、新页=danger 色 |

### 1.2 字体与字重层级

| 要素 | 出处 | 内容 |
| --- | --- | --- |
| 字族三件套 | Variables.css:112-114 | 无衬线 `Sarasa Gothic SC → Noto Sans SC → 微软雅黑`；衬线 `Noto Serif CJK → 宋体`；等宽 `zsft-hk → Consolas`；经 zeoseven CDN @import 加载（L6-8） |
| 基准 | Variables.css:110-111 | 16px / line-height 1.5 |
| 7 级字阶（每级配对行高） | Variables.css:115-128 | xxsmall 0.6/1.2、xsmall 0.8/1.2、small 0.9/1.2、medium 1/1.55、large 1.2/1.75、xlarge 1.4/2.2、xxlarge 1.6/2.4（rem） |
| 权重 | Variables.css:141-142, 149 | 仅两档：标题 700、正文 400；全库无 500/600 中间档（Elements.css 内 bold/normal 共 14 处散用） |
| 页标题 | Variables.css:262-265 | xxlarge×1.25、居中、`0.1rem` 灰底边线 |

### 1.3 间距与圆角

| 要素 | 出处 | 内容 |
| --- | --- | --- |
| 圆角 3 档 | Variables.css:177-180 | small 0.2rem / medium 0.4rem / large 0.8rem |
| 模态框圆角特例 | Base.css:2212 | 0.5rem（介于 medium 与 large 之间） |
| 阅读版心 | Variables.css:130-136 | 正文 max-width 45rem，侧栏 20rem，内容 padding 1rem×2rem |
| 移动端边距 | Variables.css:155-156 | 侧边距收窄为 0.25rem / 1.5rem |
| 段落间距 | Variables.css:281-284 | 段间 0.85rem、字距 0、无首行缩进 |

### 1.4 阴影与层次

| 要素 | 出处 | 内容 |
| --- | --- | --- |
| 5 档环境光阴影 | Variables.css:164-169 | `--p-shadow-0..4`，全部为 `0 0 Xrem 0 rgba(0,0,0,0.2)`，X = 0/0.5/1/1.5/2 —— **无方向性偏移、纯扩散**（区别于 Material 的方向性投影），模糊半径递增=层级递增 |
| 遮罩层特例阴影 | Base.css:2207 | 模态框 `0 0.5rem 1rem rgba(255,255,255,0.2)`（白投影，用于暗景） |
| hover 阴影升级 | Base.css:716-734 | 侧栏静止 shadow-1，悬停 shadow-3；过渡时长 ×2（`calc(var(--p-animation-duration-short) * 2)`，Base.css:426） |
| 玻璃拟态 | Base.css:14 处（218-219, 270-272, 457-459, 2059-2061, 2200-2202 等） | 半透明底（白 85% 或黑 65%）+ `backdrop-filter: blur(0.4rem)`（模态遮罩 5px）；顶栏、下拉菜单、账户面板、模态遮罩、预览消息统一使用 |
| 滚动条 | Base.css:2653-2668 | 轨道 gray-1、滑块 gray-4（hover gray-5）、0.5rem 圆头 |

### 1.5 动画与过渡（缓动 / 时长 / 触发）

| 要素 | 出处 | 内容 |
| --- | --- | --- |
| 时长 3 档令牌 | Variables.css:172-175 | short 0.2s / medium 0.4s / long 0.6s；hovertip 延迟=medium |
| **缓动令牌** | **未找到** | 全库无 `--ease-*` 变量；transition 绝大多数未写 timing-function（浏览器默认 `ease`） |
| 显式缓动仅 2 处 | Elements.css:244, 1956；Base.css:2770 | `ease-in-out` 两处；`cubic-bezier(0.365, 0, 0.635, 1)`（对称进出）一处（折叠面板淡入） |
| transition 属性习惯 | Base.css:231, 281, 426, 451, 721；Elements.css:176, 315, 336, 449, 504… | 逐属性声明（transform/opacity/color/bg/border/width/box-shadow 分开写），偶有 `transition: all`（Elements.css:176, 202, 394）；另有两处故意 2s 慢速（Elements.css:1050, 1063 黑块揭示效果） |
| 菜单淡入 + 上滑 | Base.css:448-460, 496-520 | 下拉子菜单 `opacity 0→1` + `translateY(-0.5rem → 0)`，short 时长，hover/focus-within 触发 |
| 账户面板 | Base.css:270-293 | 半透明玻璃卡 + shadow-2，translateY 位移 + opacity 过渡 |
| 图标微旋转 | Base.css:243-247, 251-253 | 登录图标 hover `rotate(15deg)`、头像 `rotate(-15deg)` |
| 顶栏下划线展开 | Base.css:434-443 | 链接 ::after 宽度 `0 → min(2rem,100%)`，theme 色圆头短线 |
| 侧栏滑出 | Base.css:716-734 | `left` 位移（medium 时长）+ 阴影 1→3，hover 悬停即出 |
| 遮罩淡入 | Base.css:2767-2781 | 折叠面板 0.2s，唯一显式 cubic-bezier |
| 勾选扩散 | Elements.css:239-257 | checkbox focus 时 outline `offset 0→0.5rem` + 色变透明，medium/ease-in-out |
| 双粒子加载动画 | Base.css:2455-2530 | 两个 1rem 圆点，4s / 4.5s 双周期 + 0.5s 错相，opacity 往复 + 位移 + 旋转，语义为"保存中" |
| reduced-motion | Variables.css:393-399 | `@media (prefers-reduced-motion: reduce)` 下三档时长全部归零 |
| 断点 | Base.css:572, 744, 967, 1188, 1613, 1862, 2616 | 768px（主断点，7 处）+ 500px（1 处） |

### 1.6 交互状态表现

| 状态 | 出处 | 手法 |
| --- | --- | --- |
| hover（按钮） | Elements.css:317-324（页内按钮）、329-335（input.button）；Variables.css:296-304, 334-345 | 背景gray-0→gray-1、边框 gray-3→gray-4（**色阶各深一档**），无位移 |
| hover（链接） | Variables.css:217, 251-252, 286-287 | 文字色变主题色 |
| hover（图标按钮） | Base.css:243-247 | 微旋转 + 颜色加深 |
| focus-visible | Elements.css:46-49；Base.css:1285-1287 | `outline: solid 0.15rem 主题色`（链接加粗下划线）；表单 focus 边框变主题色（Elements.css:340-343） |
| **active（按压）** | **未找到独立按压态** | 仅与 hover 同组定义（Base.css:2802-2805）；无缩放、无第二段色阶——**移动端必须补建** |
| 选中（checkbox/radio） | Elements.css:229-237 | 边框与勾选图形变主题色 light 阶 |
| 禁用 | **未找到** | 全库无 `:disabled` 样式 |

### 1.7 其他气质要素

- **图标体系**：Bootstrap Icons 的 16px SVG 以 base64 data-URI 存入 CSS 变量，经 `mask` + `background-color: currentColor` 着色（Variables.css:349-375；Base.css:238-241）——图标随文字色变，与 DCR 现有 SVG 组件思路一致。
- **克制的装饰观**：整体为"浅灰纸面 + 细边框(0.1rem gray-2) + 环境光阴影 + 玻璃浮层"，装饰集中于页头图案（Palettes/*.css），正文区域零装饰。

---

## 2. 迁移分析

### 2.1 适合迁移到 DCR 移动端（APK）的要素

| # | 要素 | 迁移方式 | 理由 |
| --- | --- | --- | --- |
| M1 | 层次调色盘 gray-0~7 + 语义色三阶 | 直接替换 DCR 现有扁平令牌（现仅 `--text/--sub/--border` 三档） | 移动端需要更细的层级表达（卡片/浮层/分隔线）；三阶主题色支撑按压/禁用态 |
| M2 | color-mix 派生色手法 | 用 `color-mix` 从珊瑚红生成 hover/active/浅底 | 免手调色值，保证色相一致；Android WebView 121+ 支持 |
| M3 | 环境光式阴影 5 档 | 底部弹层/悬浮球/Toast 采纳，透明度降至 0.14~0.18 | 无方向阴影在深浅两色下都自然；移动端浮层层级比桌面多，正需要纯扩散阴影 |
| M4 | 玻璃拟态（半透明 + blur） | 顶栏、底部弹层遮罩统一为 `rgba(bg,0.65) + blur(0.4rem)` | Peroxide 全库一致的玻璃语言，比纯色遮罩更有"浮起"感；WebView2/Android WebView 均支持 |
| M5 | 动效时长三档 + reduced-motion 归零 | 原样采纳并补缓动令牌 | 已经是成熟做法；DCR 阶段 1 的动效令牌直接扩容 |
| M6 | 微交互词汇（下划线展开、图标微旋转、勾选扩散） | hover 词汇转译为**按压反馈**：下划线展开→选项按压背景变化；勾选扩散→选中弹层收回的弹性 | 移动端无 hover，但其"小而准"的反馈哲学完全适配触控 |
| M7 | 主题色随语义变化的 tab 指示（tabview bar 0.15rem，Variables.css:272-276） | 候选抽屉页码点、书架选中态 | 已有类似手法，统一规格 |
| M8 | 滚动条样式 | 仅桌面端（冻结维护，不动） | Android 原生滚动条，无需处理 |

### 2.2 不应迁移的要素（桌面阅读/Wikidot 专属）

| # | 要素 | 不迁移理由 |
| --- | --- | --- |
| N1 | hover 系交互（sfhover 下拉、账户面板、侧栏 hover 滑出，Base.css:495-543, 716-734） | 移动端无 hover；侧栏抽屉在 DCR 已是书架页；下拉菜单由 Bottom Sheet 替代 |
| N2 | 45rem 阅读版心 + 页标题居中 + 衬线正文（Noto Serif CJK，Variables.css:113, 130, 262-265） | DCR 是**写作**应用，正文是可编辑器而非静态阅读；衬线 CJK 字体包体积大（数 MB）且不适合编辑场景 |
| N3 | zeoseven CDN 字体加载（Variables.css:6-8） | APK 必须离线可用；网络字体引入失败态与加载抖动 |
| N4 | bootstrap-icons base64 mask 方案（Variables.css:349-375） | DCR 已有类型安全的 `Icons.tsx` SVG 组件体系，双轨制增加维护成本 |
| N5 | 双粒子 4s 保存动画（Base.css:2472-2530） | 语义不同（保存 vs 生成续写）；只借鉴其"双周期错相位"思想用于候选卡扫光 |
| N6 | 768px 响应式断点体系（Base.css 7 处） | DCR 以"窗口 <768 或 Android"整体切换移动壳，壳内不再做响应式分叉 |
| N7 | Localization.css 伪元素注入多语言（734 行） | Wikidot 平台专属 hack，与 React 渲染体系冲突 |
| N8 | warning=红 / danger=橙 的语义映射（Variables.css:72-83） | 违反移动端惯例（danger=删除=红）；DCR 保持 danger 红、warning 橙 |

---

## 3. DCR 设计令牌 v2（Peroxide 骨架 × 珊瑚红品牌）

> 命名延续 DCR 现有前缀风格；新增 `--ease-*` / `--dur-*` 动效令牌与 `--shadow-*` 阴影档。
> 所有主题派生色用 `color-mix` 生成（M2），换主题色时整表自动成立。

### 3.1 颜色

```css
:root {
  /* 品牌三阶（Peroxide 三阶法 Variables.css:59-61 × DCR 珊瑚红） */
  --brand:            #f0655a;  /* DCR 品牌色，不动 */
  --brand-strong:     #e04b40;  /* 按压/强调（≈ mix black 10%） */
  --brand-soft:       #f8796f;  /* 大面积浅层（≈ mix white 15%） */
  --brand-tint:       #fef0ef;  /* 选中浅底 / 骨架底色（现 accent-soft） */

  /* 中性灰 7 级（Peroxide Variables.css:50-57 的语义化版） */
  --gray-0: #ffffff;  /* 页面底 */
  --gray-1: #fafafa;  /* 卡片/输入底 */
  --gray-2: #e8e8e8;  /* 边框/分隔线 */
  --gray-3: #9a9a9a;  /* 次要文字（现 --sub） */
  --gray-4: #5a5a5a;  /* 图标/占位 */
  --gray-5: #303133;  /* 正文（现 --text） */
  --gray-6: #1e1e1e;  /* 深色卡片底 */
  --gray-7: #000000;  /* 纯黑/遮罩 */

  /* 语义（三阶法生成；danger 用品牌红系，warning 独立橙） */
  --danger:        #e5484d;  --danger-strong: #c73338;  --danger-tint:  #fdecec;
  --success:       #2f9e6e;  --success-strong:#237a54;  --success-tint: #e6f6ef;
  --warning:       #e7922a;  --warning-strong:#c16e21;  --warning-tint: #fff3e4; /* Peroxide danger 橙转正为 warning */

  /* 浮层玻璃（Peroxide Base.css:218-219 手法） */
  --glass-bg:    color-mix(in srgb, var(--gray-0) 82%, transparent);
  --glass-blur:  0.4rem;
  --scrim:       rgba(0, 0, 0, 0.45);
}

.dark {
  /* Substance 反转法（Branches/Substance/theme.css:3-11）：同表重赋值 */
  --gray-0: #1a1b1e;  --gray-1: #232428;  --gray-2: #36383d;
  --gray-3: #9a9a9a;  --gray-4: #b8b8b8;  --gray-5: #e8e8e8;
  --gray-6: #f2f2f2;  --gray-7: #ffffff;
  --glass-bg: color-mix(in srgb, var(--gray-1) 82%, transparent);
}
```

### 3.2 字号（沿用 Peroxide 7 级配对行高，换 rem 基准为移动可读尺度）

```css
:root {
  --fs-xs:   12px;  /* 行高 1.2，元信息 */
  --fs-sm:   13px;  /* 1.3，辅助 */
  --fs-md:   15px;  /* 1.55，控件/候选正文 */
  --fs-body: 17px;  /* 1.8，故事正文（DCR 排版设置默认 18 由用户可调，此为 UI 默认） */
  --fs-lg:   20px;  /* 1.5，区块标题 */
  --fs-xl:   24px;  /* 1.4，页标题 */
  --fs-2xl:  28px;  /* 1.3，编辑页大标题输入框 */
  /* 字重仅两档（Peroxide 克制法）：400 / 700；强调用 700 不用 600 */
}
```

### 3.3 间距 / 圆角 / 阴影

```css
:root {
  /* 4px 基距（Peroxide 0.2rem 系的像素化） */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px;

  /* 圆角（Peroxide Variables.css:177-180 × 2；弹层用大圆角） */
  --radius-sm: 8px;   /* 输入框/小钮 */
  --radius-md: 14px;  /* 卡片/候选卡 */
  --radius-lg: 20px;  /* 底部弹层顶部两角 */
  --radius-full: 999px; /* 胶囊/悬浮球 */

  /* 阴影：Peroxide 环境光式（无方向），透明度按移动端调轻 */
  --shadow-1: 0 0 8px  rgba(0,0,0,0.08);
  --shadow-2: 0 0 16px rgba(0,0,0,0.12);
  --shadow-3: 0 0 24px rgba(0,0,0,0.16);
  --shadow-float: 0 4px 16px rgba(240,101,90,0.35); /* 悬浮球品牌投影（沿现值） */
}
```

### 3.4 动效令牌（Peroxide 时长三档 + 新增缓动与弹性）

```css
:root {
  /* 时长（Peroxide Variables.css:172-174 的 100ms 化细分） */
  --dur-fast:   100ms;  /* 按压响应、颜色切换 */
  --dur-base:   200ms;  /* hover/focus、菜单淡入（=Peroxide short） */
  --dur-slow:   400ms;  /* 弹层升降、页面转场（=Peroxide medium；long 0.6s 不迁移，超上限） */

  /* 缓动（Peroxide 未提供 → 补建） */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);      /* Material standard：进出通用 */
  --ease-exit:     cubic-bezier(0.4, 0, 1, 1);      /* 加速离场 */
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性（过冲 ~5%）：仅浮层升降与确认动效 */

  /* 弹簧物理（阶段1 引入 motion 库时用同参数） */
  --spring-stiffness: 380; --spring-damping: 26;    /* ≈ 320ms, 轻微过冲 */
}

@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms; }
  /* 弹层改为瞬时显隐；加载动画降级为呼吸（见 §3.7） */
}
```

### 3.5 组件草案 · Button

语义与规则（阶段 1 组件文档同款）：

- 语义优先：跳转 = `Link`；开关 = `Switch`；其余动作才用 `<button>`
- 变体：`primary`（每屏至多一个，品牌色实心）/ `secondary`（灰底描边，Peroxide 默认按钮气质）/ `danger`（删除类，红实心，**必须二次确认**）/ `ghost`（透明底，工具条行内）
- 状态机：`默认 → 按压(scale 0.97 + brand→brand-strong，100ms) → 处理中(spinner + aria-busy，阻止重复提交) → 成功(按钮旁短提示"已保存"，1.6s) / 失败(旁内联可读原因)`；禁用必须带原因文案（如"请先填写 API 地址"）

```css
.m-btn {
  min-height: 44px; padding: 0 var(--sp-4);
  border-radius: var(--radius-sm); border: none;
  font-size: var(--fs-md); font-weight: 700;
  display: inline-flex; align-items: center; gap: var(--sp-2);
  transition: background-color var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard);
}
.m-btn:active { transform: scale(0.97); }
.m-btn--primary { background: var(--brand); color: #fff; }
.m-btn--primary:active { background: var(--brand-strong); }
.m-btn--secondary {
  background: var(--gray-1); color: var(--gray-5);
  border: 1px solid var(--gray-2);           /* Peroxide 细描边语言 */
}
.m-btn--secondary:active { background: var(--gray-2); }
.m-btn--danger { background: var(--danger); color: #fff; }
.m-btn--danger:active { background: var(--danger-strong); }
.m-btn--ghost { background: transparent; color: var(--gray-5); }
.m-btn--ghost:active { background: var(--gray-2); }
.m-btn[disabled] { opacity: 0.55; }  /* + 紧邻的原因说明行，见阶段1文档 */
```

### 3.6 组件草案 · Bottom Sheet

结构：遮罩（scrim 淡入）+ 面板（顶部两角 radius-lg、玻璃底、环境光阴影）。升降用 `--ease-spring`；遮罩用 `--dur-base` 线性淡入；**面板下拉 ≥90px 或速度阈值即关闭**（沿现有手势）；选项按压背景变化（替代 Peroxide hover 色阶），选中项品牌色文字 + 右侧勾选图标 + 浅红底（tint）。

```css
.msheet {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-3);
  animation: sheet-up var(--dur-slow) var(--ease-spring);
}
.msheet--closing { animation: sheet-down var(--dur-base) var(--ease-exit) forwards; }
@keyframes sheet-up   { from { transform: translateY(100%); } }
@keyframes sheet-down { to   { transform: translateY(100%); } }
.msheet-mask { background: var(--scrim); animation: fade-in var(--dur-base) var(--ease-standard); }

.msheet-row { min-height: 48px; border-radius: var(--radius-sm); transition: background-color var(--dur-fast); }
.msheet-row:active { background: var(--gray-2); }        /* 按压反馈（hover 的移动转译） */
.msheet-row[aria-selected="true"] {
  color: var(--brand); background: var(--brand-tint);
  font-weight: 700;                                       /* + 右侧 ✓ 图标（Icons.tsx CheckIcon） */
}
```

### 3.7 组件草案 · 生成中加载（模糊文字擦除扫光）

形态：红色续写位与三张候选卡内，先渲染 2~4 行与目标文字同排版的**模糊占位行**（`filter: blur(4px)` + 品牌浅粉 `--brand-tint` 加深底），一道高光每 1.4s 从左向右扫过（`background-position` 位移，错开相位 0 / 0.18s / 0.36s）。流式文字到达后，占位层 `blur(4px)→0 + opacity 1→0` 渐变让位（300ms），不生硬切换。

```css
.skel-line {
  height: 1em; border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--brand-tint) 70%, var(--brand) 8%);
  filter: blur(4px);
  background-image: linear-gradient(100deg, transparent 32%, rgba(255,255,255,.75) 50%, transparent 68%);
  background-size: 220% 100%;
  animation: skel-sweep 1.4s linear infinite;   /* 只动 background-position */
}
.skel-line:nth-child(2) { animation-delay: 0.18s; }
.skel-line:nth-child(3) { animation-delay: 0.36s; width: 72%; }
@keyframes skel-sweep { from { background-position: 130% 0; } to { background-position: -90% 0; } }

.skel-text.is-resolving { animation: skel-resolve 300ms var(--ease-standard) forwards; }
@keyframes skel-resolve { to { filter: blur(0); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .skel-line { animation: none; filter: blur(2px); animation: skel-breath 2.4s ease-in-out infinite; }
  @keyframes skel-breath { 50% { opacity: 0.55; } }
}
```

### 3.8 动效原则

1. **何时用弹性（--ease-spring）**：仅"从无到有召唤"的元素——底部弹层升起、抽屉展开、确认打勾。位移元素且用户预期它"停住"的场景。**列表项、文字、图标一律不用弹性**（过冲会显乱）。
2. **何时用线性**：循环动画（扫光、呼吸、进度）——循环里用非对称缓动会产生节奏顿挫，`linear` + 错相位即可。
3. **何时用 standard/exit**：一切进出屏幕的转场与遮罩淡入淡出；离场用加速（exit），比对称缓动更利落。
4. **时长上限 400ms**（`--dur-slow` 封顶）；按压/颜色类反馈 ≤100ms；任何动画不得阻塞输入。
5. **只动 `transform / opacity / background-position`**，禁止动画 width/height/left/top（Peroxide 侧栏 `left` 手法 Base.css:721 在移动端被明确否决）。
6. **reduced-motion**：时长归零 + 循环动画降级为 2.4s 呼吸（沿用 Peroxide 归零法 Variables.css:393-399，呼吸为其移动端替代）。
7. **错相位**：同组循环元素（3 张候选卡）必须错开 0.15~0.2s，避免机械感（借鉴 Peroxide 双粒子 0.5s 错相，Base.css:2477-2481）。

---

## 4. 演示页

`docs/design-preview.html`（与本文档同目录）为静态演示页：按钮四变体全状态、底部弹层（含下拉关闭与选中态）、生成中扫光（含"模拟出字"演示渐清晰）。手机浏览器直接打开即可，无需构建。

---

*调研与撰写：ZCode · 阶段 0 · 等待确认后进入阶段 1（组件库）*
