# 模型接入契约（Provider Contract）

本应用与所有模型服务之间**只使用一种协议**：OpenAI 兼容的
`POST {baseUrl}/chat/completions`，支持 `stream: true`。借此天然兼容
Ollama、LM Studio、llama.cpp server、vLLM、text-generation-webui 及云端服务。

## 请求

```http
POST {baseUrl}/chat/completions
Content-Type: application/json
Authorization: Bearer <可选 API Key>

{
  "model": "<模型名>",
  "messages": [
    { "role": "user", "content": "<指令 + 故事上文（末尾至多 8000 字）>" }
  ],
  "stream": true,
  "temperature": 0.9,
  "top_p": 0.92,
  "max_tokens": 400
}
```

## 流式响应

标准 SSE 分帧（`data: {...}` 行，`data: [DONE]` 结束）。增量文本兼容以下字段风格：

| 后端 | 增量位置 |
|---|---|
| OpenAI / llama.cpp / vLLM | `choices[0].delta.content` |
| 部分 llama.cpp 变体 | `choices[0].content` / `choices[0].text` |
| Ollama 兼容层 | `message.content` |

解析器实现：`src/provider/sse.ts`（含单元测试，容忍坏 JSON 行与非 data 行）。

## 非流式回退

若响应无 body 流（个别网关），退化为整段文本一次性解析。

## 候选策略

三条候选 = **三次并发独立请求**（不使用 `n` 参数，兼容不支持多候选采样的本地后端）：

- 温度抖动：`t-0.1` / `t` / `t+0.1`（下限 0）
- 单条失败自动重试一次；全部失败抛出聚合错误
- 实现：`src/provider/candidates.ts`

## 取消

前端 `AbortSignal` → `fetch` 中止。Mock Provider 在下一个分片检查信号。

## 端点发现

| 来源 | 地址 |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| llama.cpp server | `http://127.0.0.1:8080/v1` |
| 云端 | 用户自填（仅 http/https） |

模型列表：`GET {baseUrl}/models`（由 Rust 侧 reqwest 执行，见
`src-tauri/src/lib.rs` 的 `probe_models` 命令；前端经 invoke 调用，
规避 WebView CORS）。

## API Key 安全

- 存储前经 **Windows DPAPI** 加密（`src-tauri/src/dpapi.rs`），密文绑定
  当前 Windows 用户，绝不明文落盘
- 请求时由 Rust 侧解密注入 `Authorization: Bearer` 头

## Mock Provider

`model = "mock"` 或未配置模型时启用 `src/provider/mock.ts`：
确定性假续写（基于输入哈希选模板），完整走 流式回调 → 候选卡片 →
平行世界 链路，用于无模型环境演示与开发调试。

## 已知限制（有意为之）

- 不实现多候选 `n` 参数：三次独立请求以兼容所有本地后端
- 不做端点健康轮询：仅启动时探测 + 「测试连接」手动触发
- 本地端点（localhost/127.0.0.1）是本产品核心场景，HTTP 域白名单
  对 localhost 放行为**有意设计**
