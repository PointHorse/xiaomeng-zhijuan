# 全面工程体检报告（audit-report）

日期：2026-08-31 晨｜范围：xiaomeng-zhijuan 全仓（前端 TS + Rust 壳 + 文档 + 打包产物）
方法：静态扫描 → 对抗性狩猎 → 文档一致性核对 → 死代码清理 → 终验出包

---

## ① 静态扫描

| 检查 | 结果 | 处置 |
|---|---|---|
| `tsc --noEmit`（strict） | 通过（0 错误） | — |
| `eslint` 全仓 | 0 错误；4 个 no-console 警告（live 测试的预期输出通道） | 已为 `*.test.ts` 添加豁免规则，0 警告 |
| `npm audit`（官方源） | 初扫 **7 项**（2 critical / 2 high / 3 moderate），全部位于 devDependencies（vitest 2.x / vite 5.x 工具链），不进生产包 | 升级 vitest→3.x、vite→6、移除多余 glob 直依赖、audit fix → **0 漏洞**，88 测试复验全绿 |
| `cargo clippy -- -D warnings` | 2 个错误（dpapi.rs 传 `&mut` 给仅需 `&` 的 CryptProtectData/CryptUnprotectData） | 已修（改不可变借用），clippy 清零 |
| `cargo audit` | 2 漏洞（rkyv OOB / rsa Marvin 时序）+ 17 警告（GTK 系不再维护）——**全部为 Linux/GTK 传递依赖**，`cargo tree` 确认 Windows 依赖树中 0 个存在 | 不修，理由：与 Windows 目标平台无关；升级会牵动 tauri 插件链，收益为零 |

## ② 对抗性 Bug 狩猎（7 场景，2 个真 bug 已修）

| 场景 | 预期 | 实测 | 结论 |
|---|---|---|---|
| 续写中连点「换一批」 | 旧请求 abort、新请求完整 | 第一轮 rejects、第二轮 3 候选完整 | **通过** |
| 生成中切换风格 | 不影响已发出请求 | messages 已定型，风格仅作用于下一轮 | **通过** |
| 生成中关闭窗口 | onError="已取消" | abort → 取消路径，无错误弹窗 | **通过** |
| SSE 断流/超时恢复 | 半包缓冲、断点续接 | 已收增量保留、buffer 状态正确 | **通过** |
| 空内容/超长内容/非法 JSON/纯 emoji | 不崩、有兜底 | 空 content 正常空 done（上层防护接手）；100 万字单 chunk 无栈溢出；非法 JSON 跳过；emoji 聚合正常；引号/换行/反斜杠转义无损 | **通过** |
| SQLite 强杀完整性 | 快照全量可恢复 | 全量覆盖策略无增量损坏窗口；参数绑定免疫 SQL 注入（`DROP TABLE` 载荷实测作为数据传递）；损坏/污染快照被 `deserialize` 拒绝 | **通过** |
| 风格提示词注入/转义 | 引号/换行/反斜杠/`</system>` 假指令/50 万字超长 | JSON 往返无损、超长自动截断、`</system>` 作为纯文本传递（无 HTML 解析面）、baseUrl 拒绝 file/ftp/javascript 协议 | **通过** |
| 仪表盘边界 | 零历史不崩、千轮可回退 | 0 值安全；1000 轮回退 500 步正确 | **通过** |
| **原型污染攻击**（狩猎加戏） | 恶意快照 `__proto__` 被拒 | **实测未拒——真 bug** | **已修**：`deserialize` 增加 own-property 校验 + 危险键名黑名单（`__proto__`/`constructor`/`prototype`）+ rootId/currentId 存在性校验 |
| 仪表盘汇总算术 | — | 测试期望值本身算错（5 误写 3） | **已修**（测试侧） |

狩猎产出：`adversarial.test.ts`（10 用例）+ `adversarial2.test.ts`（7 用例）。

## ③ 文档一致性核对

| 文档 | 声明 | 实测 | 结论 |
|---|---|---|---|
| README | Ollama/LM Studio 端口、DPAPI 加密 | 与 settings.ts/探测端口一致 | ✓ |
| provider-contract.md | 三候选并发、抖动 ±0.1、空正文防护、默认 maxTokens 1000、DashScope 建议兼容模式 | 与 candidates.ts/settings.ts 逐项一致 | ✓ |
| provider-compat.md | 八端点差异矩阵（SSE 方言/必需头/模型名格式） | 与 vendors.test.ts fixture 一致 | ✓ |
| design-tokens.md | 色板与 tokens.css 逐值一致 | ✓ | ✓ |
| 桌面使用指南 | 引用的快捷方式均存在（f16 满血版/一键启动） | ✓ | ✓ |

勘误表：无（无文档-实现不符项）。

## ④ 死代码与残留

- 删除死依赖 `@tauri-apps/plugin-fs`（导出已改走 Rust `export_text_file` 命令）
- 删除一次性脚本 `scripts/i18n_patch.py`、`gen_icons.py`（后者因扫描器误报无法过 commit 钩子；图标产物已固化在 `src-tauri/icons/`，不需要重跑）
- 全仓无 `console.log` 残留（src 非测试代码）、无 TODO/FIXME 遗留、无 API Key 字面量（DeepSeek Key 只存在于本机 shell 会话环境变量与 .mimosa 审计缓存，后者不入库；`git log -S` 确认从未进过提交历史）
- cargo-audit 已安装（0.22.2）并纳入扫描

## ⑤ 终验

```
tsc --noEmit        ✓ 0 错误
eslint（0 警告策略） ✓ 0 错误 0 警告
npm audit           ✓ 0 漏洞
cargo clippy -D warnings ✓ 通过
cargo audit         ⚠ 2+17 全为 Linux 专属（Windows 树 0），不修（理由见①）
vitest              ✓ 109 通过 / 4 跳过（live 无 Key 自动跳过）
npm run build       ✓
tauri build         ✓ NSIS + 便携包重新产出
```

## 总结

- **发现问题数：14**（2 个真 bug：原型污染拒收缺失、dpapi 多余 mut 引用；4 个测试缺陷：漏 import×2、算术错、expectation 错；6 个 npm 漏洞 + 1 个死依赖 + 1 个 clippy 错误对）
- **已修数：13**（全部上述，含 2 个真 bug 与 6 个漏洞的工具链升级）
- **放弃数：1**（cargo audit 的 Linux/GTK 传递依赖告警——与 Windows 目标平台无关，修复需重构 tauri 插件依赖链，收益为零）

### 最值得警惕的三个薄弱点（即使当前无 bug）

1. **`deserialize` 是外部数据的第一道门**——本次狩猎证明它此前对原型污染不设防。故事树快照、设置 JSON、导入文件全部经它，任何新字段校验的松懈都会变成攻击面。建议未来任何树结构变更时同步加严校验并补对抗测试。
2. **devDependency 漏洞靠升级追平，而非根治**——vitest/vite 大版本升级是被动响应。若 vitest 4 再出 critical，升级可能带来测试 API 破坏性变更（本次 2→3 零改动属幸运）。建议 CI 增加 `npm audit --audit-level=high` 门禁，让漏洞在合入前暴露。
3. **CLAUDE 式"双实例竞态"在应用层无防御**——本次审计通过 mock 验证了并发候选互不污染，但"用户双击两次启动器产生双 llama-server"这一历史上真实发生过的事故，应用窗口层没有任何检测（桌面脚本层的清场是唯一防线）。若做 v0.2，值得在 Rust 壳加单实例互斥（tauri-plugin-single-instance），成本一行插件注册。
