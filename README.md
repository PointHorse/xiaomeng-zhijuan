# 小梦织卷

**AI 小说续写桌面客户端** —— 用户写下故事开头，AI 给出多条续写候选；择一采纳、随时回溯，在"平行世界"中反复探索故事走向。

![架构](docs/architecture.svg)

## 三行安装

```powershell
git clone <本仓库> && cd xiaomeng-zhijuan
npm install
npm run tauri:build   # 产出 NSIS 安装器（src-tauri/target/release/bundle/nsis/）
```

## 本地模型五分钟接入（以 Ollama 为例）

```powershell
winget install Ollama.Ollama      # 1. 安装
ollama pull qwen2.5:7b            # 2. 拉模型
```

3. 打开小梦织卷 → 设置 → 自动探测会找到 `http://localhost:11434/v1` → 一键接入。

同样支持 LM Studio（`http://localhost:1234/v1`）、llama.cpp server、vLLM、text-generation-webui 及任意 OpenAI 兼容端点（含云端，API Key 经 Windows DPAPI 加密存储）。

## 架构

```text
┌────────────────────────────────────────────┐
│  WebView 前端 (React 18 + TS + Zustand)     │
│  ├─ editor/    正文编辑 + 候选卡片           │
│  ├─ worldtree/ 故事树逻辑 + 平行世界视图      │
│  ├─ provider/  OpenAI 兼容客户端 + Mock      │
│  ├─ settings/  预设 / 主题 / 探测            │
│  └─ store/     Zustand + SQLite 持久化      │
├──────────── 屏障：仅插件与原语 ────────────────┤
│  Rust 壳 (tauri 2, 最薄封装)                 │
│  ├─ tauri-plugin-sql   SQLite 持久化         │
│  ├─ tauri-plugin-dialog 导出对话框           │
│  ├─ tauri-plugin-http  本地/云端端点转发      │
│  ├─ dpapi.rs           DPAPI 加解密原语       │
│  └─ window-vibrancy    Win11 Mica 质感       │
└────────────────────────────────────────────┘
```

- **业务逻辑 100% TypeScript**；Rust 仅注册插件与两个加密原语。
- 模型契约：OpenAI 兼容 `POST /v1/chat/completions (stream)`，详见
  [docs/provider-contract.md](docs/provider-contract.md)。

## 常用命令

```powershell
npm run dev        # 前端开发
npm run tauri dev  # 桌面应用开发（热重载）
npm test           # 单元测试（故事树/上下文/SSE/候选/Mock/导出）
npm run test:cov   # 覆盖率（核心模块 ≥80%）
npm run tauri:build  # NSIS 安装器 + 便携版产物
```

## 文档

- [docs/design-tokens.md](docs/design-tokens.md) — 色板与排版令牌
- [docs/provider-contract.md](docs/provider-contract.md) — 模型接入契约
- [docs/demo-script.md](docs/demo-script.md) — 纯 Mock 环境验收演示脚本

## 兼容性

- Windows 10/11；WebView2 缺失时由安装器自动引导安装（downloadBootstrapper）
- 125%–200% DPI 缩放适配；Win11 圆角 + Mica（Win10 优雅降级为纯色）
