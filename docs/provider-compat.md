# 各厂商 OpenAI 兼容端点差异矩阵与兼容说明

> 本应用的模型契约：`POST {baseUrl}/chat/completions` + `stream: true`（OpenAI 主契约）。
> 本文按公开文档整理主流服务的差异点、本应用的兼容结论，以及连接配置建议。
> 契约级测试见 `src/provider/vendors.test.ts`（fixture 驱动，无需真实 Key）；
> live 验证测试见 `src/provider/deepseek_live.test.ts`（需环境变量 `DEEPSEEK_API_KEY`）。

## 一、差异矩阵

| 维度 | OpenRouter | 硅基流动 | DeepSeek | Ollama | LM Studio | llama.cpp server |
|---|---|---|---|---|---|---|
| Base URL | `https://openrouter.ai/api/v1` | `https://api.siliconflow.cn/v1` | `https://api.deepseek.com` | `http://127.0.0.1:11434/v1` | `http://127.0.0.1:1234/v1` | `http://127.0.0.1:8080/v1` |
| 必需请求头 | `Authorization` + 推荐 `HTTP-Referer`/`X-Title` | `Authorization` | `Authorization` | 可无 | 可无 | 可无 |
| 模型名格式 | `厂商/模型`（如 `deepseek/deepseek-chat`） | `厂商/模型`（如 `deepseek-ai/DeepSeek-V3`） | `deepseek-chat` / `deepseek-reasoner` / `deepseek-v4-flash` 等 | `pull 下来的 tag`（如 `qwen2.5:7b`） | 本地已加载模型名 | `--model` 参数值（可任意） |
| SSE 方言 | 标准 `data:` 行；**会发 `: OPENROUTER PROCESSING` 注释行**（须跳过） | 标准；首块 delta 含 `role`，尾块 `finish_reason:"stop"` | 标准 | 标准；增量在 `message.content` | 标准；首块 delta 为 `{role:"assistant",content:""}` | 增量在 `choices[].content`（非 delta） |
| 推理字段 | 视上游模型（`reasoning` 字段） | DeepSeek 系模型有 `reasoning_content` | **`reasoning_content` 与正文分开**；计入 `completion_tokens` | 思考类模型有 `thinking` 字段 | 视模型 | 无 |
| `finish_reason` | `stop`/`length` | `stop`/`length` | `stop`/`length`/`insufficient_system_quota` | `stop`/`length` | `stop`/`length` | `stop` |
| 非标准 `[DONE]` | 标准 `[DONE]` | 标准 | 标准 | 标准（部分旧版无 `[DONE]`，直接断流） | 标准 | 标准 |
| usage 块 | 流式默认无（`stream_options` 可开） | 流式末块带 usage | 非流式有；流式默认无 | 流式末块带（done 时） | 无 | 有（`timings` 在别处） |
| Key 错误 | 401 | 401 | 401 | —（无 Key） | —（无 Key） | —（无 Key） |
| 限流 | 429 | 429 | 429 | — | — | — |

## 二、本应用兼容结论

| 结论 | 说明 |
|---|---|
| ✅ 直接兼容 | OpenRouter、硅基流动、DeepSeek、Moonshot、智谱、Ollama、LM Studio、llama.cpp —— 增量解析覆盖 `delta.content` / `message.content` / `choices[].content` / `choices[].text` 四种方言，注释行与非 data 行自动跳过（`src/provider/sse.ts`） |
| ✅ 三候选并发 | 三次独立请求（不用 `n` 参数），温度 ±0.1 抖动；全部后端可用 |
| ⚠️ 需要配置的点 | ① **DeepSeek 推理型模型**（`deepseek-reasoner`、`deepseek-v4-flash` 的思考模式）：`max_tokens` 包含思考消耗，正文可能为空截断——应用已做**空正文防护 + 自动重试**，并把默认生成长度提到 1000；② **DashScope 原生模式**的增量在 `output.choices[].message.content`，非 OpenAI 主契约——请使用其「兼容模式」端点 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| ❌ 明确不兼容 | Anthropic Messages 格式（`/v1/messages`，如截图中的 `api.deepseek.com/anthropic`）——请求/响应结构与 OpenAI 契约完全不同。DeepSeek 请改填 `https://api.deepseek.com` |

## 三、错误提示映射（应用层）

| HTTP 状态 / 情形 | 用户可见提示 |
|---|---|
| 401 / 403 | 「模型服务返回错误：401 · <响应体摘要>」（提示检查 API Key） |
| 429 | 「模型服务返回错误：429 · …」（候选编排层自动重试一次） |
| 5xx | 「模型服务返回错误：5xx · …」 |
| 连接失败 | 「无法连接模型服务：<原因>」 |
| 流中断 | 「流式读取中断：<原因>」 |
| 空正文（推理截断） | 自动重试；重试仍空则提示「调大最大生成长度」 |
| 用户取消 | 「已取消」（不作为错误弹卡片） |

## 四、fixture 测试映射

`src/provider/vendors.test.ts` 中每个厂商一组 fixture 分帧：

- OpenRouter：注释行 + data 行混排
- 硅基流动：role 首块 / 空 delta 尾块 / finish_reason 逐块
- Moonshot：role-only 首块（无 content）
- 智谱 / Ollama / LM Studio / llama.cpp：各方言 + finish_reason stop
- 故障路径：401 / 429 / 503 → 中文错误映射

## 五、live 验证（有真实 Key 时）

```powershell
$env:DEEPSEEK_API_KEY = "sk-..."
npx vitest run src/provider/deepseek_live.test.ts
```

覆盖：流式生成、跨题材、两轮接力、错误路径（无效模型）。DeepSeek v4-flash 已实测通过（见 acceptance 记录）。
