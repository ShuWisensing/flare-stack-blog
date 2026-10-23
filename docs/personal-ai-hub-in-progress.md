# Personal AI Hub 进行中

本文记录博客接入本地 AI agent 与知识库的当前工作面。主规格来源是 `E:\wiki\LLM_Wiki_需求文档.md`，博客入口和 Cloudflare 部署在 `E:\blog`，本地后端和数据在 `E:\wiki`。

## 2026-10-23 当前工作

- 最新状态：已按[二次审查](personal-ai-hub-v1-code-review-2026-10-23.md#8-审查后的代码修复与验证)修复 16 项问题，补充源文本指纹和诊断脚本及 DeepSeek 网络预算三个关联缺陷；逐项按失败回归后实现。本轮按用户要求推送 main，由 GitHub Actions 自动部署，发布结果以对应 Actions 为准。
- 2026-10-23 用户手动启动后实测：本地 /health、公网 Tunnel /health、知识库状态、opencode 状态均为 HTTP 200，cloudflared 服务 Running；活动索引 ready。Codex 的 AGENT_RUNTIME_NOT_READY 已定位并修复为 CLI 配置覆盖键错误，新增两项回归通过，独立 app-server 初始化及 ChatGPT 登录读取成功；运行中的 Hub 仍需用户重启加载，见 HUB-27。健康检查不代表真实模型任务或博客管理员代理已经验收。
- 最新验证：HUB-27 修复后后端全量 176 项通过；博客 Node 全量 176 通过，类型检查及修改文件 Biome 通过；Workers 默认 5 秒下有一个未修改的 OAuth 首请求超时；20 秒 CLI 预算全量 199/199 通过，生产构建通过。最新代码以本节为准，下列较早的数量和 generation 为上一阶段记录。
- 新 generation 为 `v1_20cc470675154991b991fafd9e7de804`：21 摘要、1295 chunk、0 Wiki，1316 对象的实际引用路径/行范围校验全部通过，旧索引保留。新一轮 24 题离线检索评估完成，混合检索加本地重排命中 22/22、MRR@20=0.932；原始结果在 E:\wiki\data\evaluations\v1\results_20261023_090326.json。该评估不调用问答模型，不代表最终回答或无答案拒答通过。
- Codex 首次 turn 确认丢失时保留 pending 原生映射；未知会话须先刷新核验，不能直接再次发送。缺少原生记录时显式报未知，不创建替代 thread。历史版本已经丢失的 native ID 不能凭空恢复，本轮不扫描或接管桌面历史。

- 以下为本轮发布前的 V1 实现记录；线上博客需部署当前版本后再验证页面和代理。
- 博客 Node 166 个、Workers 集成 199 个、后端 136 个测试通过，类型检查、Biome 与生产构建通过；Workers 最终独立重跑退出码为 0。
- 两个固定修订的本地模型权重均已验证 SHA256，实际 GPU 编码及重排通过。活动 generation 为 `v1_194a0f098db747b28747e614c212d754`，BM25 / vector / hybrid 内容校验均为 ready；21 摘要、1450 派生 chunk，原始数据和旧索引保留。
- 24 条本地标注题完成四组对照（22 条有答案、2 条无答案探针）。最终本地 hybrid + 标题/章节重排命中 22/22，19 题目标证据排第一；MRR@20=0.932，中位耗时约 0.95 秒。这不代表真实回答质量或无答案拒答已经通过。
- 已增加启动前模型预热，避免首次加载约 94 秒超过 Wiki / Agent 请求预算；启动日志和最长 180 秒等待由脚本提供。环境锁定列表为 `E:\wiki\requirements.lock.txt`。
- 后续由用户手动启动，按本地 Hub → 公网 Tunnel → 已部署博客 → 两个 Runtime → MCP 顺序验收；热点 / 校园网与 TUN 条件仍需对照，尚未证明历史故障的唯一根因。
- Codex 首版只读，工作目录通过启动参数指定；Wiki 当前为单轮 RAG。网页写入审批、长任务及 Wiki 多轮会话放后续版本。
- 手动启动命令、指标边界和完整验收顺序见 [V1 计划第 10 节](personal-ai-hub-v1-improvement-plan.md#10-2026-10-23-实现交付与手动验收)。

## 2026-10-22 审查基线（历史）

- 已完成 Wiki、Agent Chat、代理、脚本与相关协议审查；本轮没有修改业务代码或启动服务。
- 首版规格、问题编号、执行顺序、Runtime 选择和人工验收统一放在 [V1 改进计划](personal-ai-hub-v1-improvement-plan.md)。
- 接下来按首版规格修错误诊断、opencode model 对象契约、Wiki 回答模式、缓存与索引就绪状态，并接入本地检索模型和 Codex；用户随后手动启动后端验证。
- 用户确认历史热点能通、校园网不通，也曾出现公网通而博客失败；必须分别验证，不能以当前后端未启动替代历史根因。
- 用户已确认 Codex 纳入 V1，与 opencode 在页面中二选一；只创建 Hub 独立会话，不同步或接管已有桌面聊天。DeepSeek Harness 暂停。
- Wiki 检索目标改为本地 Qwen3-Embedding-0.6B + bge-reranker-v2-m3 + BM25；文档解析也留在本地，停用云向量、云重排、Qwen 回答及 MinerU 云解析入口。
- 已发现网页分块过碎、长代码向量化截断、embedding 缓存角色/空白键碰撞、摘要硬门控及重排缓存版本缺失；不能只替换模型后直接沿用旧索引。
- DeepSeek 问答与 opencode 默认目标为 `deepseek-flash`，保留 `deepseek-v4-pro` 显式选项；密钥只读系统变量 `DEEPSEEK`。已只读验证账号模型目录，尚未发起推理。

## 当前阶段结论

当前系统已经完成“博客管理员入口 + 本地 FastAPI Hub API + Cloudflare Tunnel + MCP 查询工具 + Agent Chat 第一版”的代码接入，但线上端到端可用性仍需集中验证和修复。

首版先稳定以下现有链路，再在同一版本完成用户确认的双 Runtime 与本地检索改造；下面展示的是当前实现，Codex 尚未接入：

```text
libresensing.com 管理员后台
-> TanStack Server Function 管理员代理
-> PERSONAL_AI_HUB_API_URL=https://hub-api.libresensing.com
-> Cloudflare Tunnel
-> 本机 http://127.0.0.1:8000
-> E:\wiki FastAPI
-> LLM Wiki 检索 / opencode runtime
```

## 已按源码确认的边界

`E:\blog` 负责：

- 管理员后台入口：`src\components\admin\side-bar.tsx`
- Personal AI Hub 页面：`src\routes\admin\personal-ai-hub\index.tsx`
- Agent Chat 页面：`src\routes\admin\personal-ai-hub\agent-chat.tsx`
- 管理员代理：`src\features\personal-ai-hub\api\personal-ai-hub.admin.api.ts`
- Hub 服务调用与 `X-Hub-Token` 注入：`src\features\personal-ai-hub\service\personal-ai-hub.service.ts`
- Hub API schema：`src\features\personal-ai-hub\schema\personal-ai-hub.schema.ts`
- MCP 工具：`src\features\mcp\features\personal-ai-hub`

`E:\wiki` 负责：

- FastAPI 应用：`personal_wiki_brain\api\server.py`
- 知识库查询：`personal_wiki_brain\chat\service.py`
- Agent Chat 运行记录：`personal_wiki_brain\agent\chat_store.py`
- opencode runtime 适配：`personal_wiki_brain\agent\opencode_runtime.py`
- 本地启动、停止、状态脚本：`scripts\start_hub.ps1`、`scripts\stop_hub.ps1`、`scripts\status_hub.ps1`

## 当前 API 契约（实现基线）

博客代理调用本地 Hub 时必须带 `X-Hub-Token`。浏览器不得直接携带本地 token 请求 `hub-api.libresensing.com`。

知识库接口：

```text
GET  /health
GET  /kb/status
GET  /kb/sources
POST /kb/query
POST /kb/feedback
```

Agent Chat 接口：

```text
GET  /agent/opencode/health
GET  /agent/status
GET  /agent/sessions
POST /agent/sessions
GET  /agent/sessions/{session_id}/messages
POST /agent/chat
```

注意：`/health` 也受 `X-Hub-Token` 保护。裸访问 Tunnel `/health` 返回 401 不等于 FastAPI 离线。

V1 目标契约新增必选 `runtime: opencode | codex`，会话归属与模型配置按 Runtime 隔离；后端、博客代理、页面和 MCP 必须同步检查。详细请求、错误与会话规格见 V1 改进计划，不能把当前接口基线当作 Codex 已实现。

## 当前运行前提

线上博客侧：

- `PERSONAL_AI_HUB_API_URL=https://hub-api.libresensing.com`
- `PERSONAL_AI_HUB_API_TOKEN` 与本机 `LOCAL_HUB_API_TOKEN` 一致
- 管理员账号可以正常登录，并且 server function 能拿到管理员 session

本地 Hub 侧：

- 本机 `LOCAL_HUB_API_TOKEN` 已设置
- `E:\wiki` FastAPI 运行在 `http://127.0.0.1:8000`
- `cloudflared` 已把 `hub-api.libresensing.com` 转发到本机 8000
- 使用 Agent Chat 时，opencode server 运行在 `http://127.0.0.1:4096`
- 使用 Agent Chat 时，`OPENCODE_SERVER_URL`、`OPENCODE_CONFIG` 和 `DEEPSEEK` 已配置

## 当前排查顺序

1. 在 `E:\wiki` 本机检查环境变量和进程状态。
2. 使用带 `X-Hub-Token` 的请求检查 `http://127.0.0.1:8000/health`。
3. 检查 `http://127.0.0.1:8000/kb/status` 和 `/kb/query`。
4. 如果 Agent Chat 失败，检查 `http://127.0.0.1:8000/agent/status` 和 opencode server。
5. 检查 `cloudflared` 是否在线，并确认 Tunnel 指向本机 8000。
6. 检查线上 Cloudflare 环境变量是否和本机 token 一致。
7. 用管理员登录的线上博客测试 Personal AI Hub 页面和 Agent Chat 页面。
8. 用 MCP 客户端验证 `wiki_query`、`wiki_status`、`wiki_sources_list`。
9. 将真实错误写入 `personal-ai-hub-known-issues.md`，再按 TDD 修复。

## 当前验证状态

历史核验记录（不代表 2026-10-22 当前全量状态）：

- `E:\wiki`：`python -m pytest -q` 通过，81 个测试通过。
- `E:\blog`：`bun run test:node` 通过，137 个测试通过。
- `E:\blog`：Personal AI Hub 相关 Node 测试通过，9 个测试通过。
- `E:\blog`：`bun typecheck` 通过。
- `E:\blog`：`bun run test` 当前依赖本地未提交的 `wrangler.jsonc`，缺失该文件时 Workers 集成测试无法启动。

2026-10-22 本轮验证：

- 博客 Hub 服务、MCP、env 相关现有测试：10 个通过。
- 后端 API、Runtime、脚本、检索、env 相关现有测试：30 个通过。
- 后端全量测试：Gradio/Pandas 导入发生 NumPy ABI 不兼容，2 个收集错误；不能宣称全量通过。
- 已隔离复现缓存配置混用、索引错误就绪和 Runtime 缺配置返回纯文本 500。
- 本地 wrangler.jsonc 当前存在；本轮未运行 Workers 集成测试、typecheck 或真实模型调用。
- 补充审查确认两个 Codex Home 保存的是同一 ChatGPT 账号；拟指定 `D:\AIData\Codex`，共用该账号的 Codex 额度，Hub 历史和运行映射保存到 `E:\wiki`。
- 数据审查确认 4176 个网页块平均约 11 字符、22 个代码块超过现有向量化截断阈值；本地模型尚未下载，新索引尚未构建。

## 当前工作重点

- 修复线上 Personal AI Hub / Agent Chat 功能无法稳定加载的问题。
- 让博客代理在 Hub 返回非 2xx 时保留可诊断错误信息，同时不泄露 token。
- 更新页面中过期文案，避免把已接入的 Agent Chat 描述为“下一阶段”。
- 补充本地状态脚本对 opencode 和 cloudflared 的检查。
- 在同一首版增加 Codex Adapter 和 Runtime 选择，只管理 Hub 自建会话；不公开 Codex 原始端口。
- 修复正文、分块、缓存与融合检索，使用本地模型建立新的索引 generation，保留原始资料和旧派生数据。
- 统一 DeepSeek 最新模型目录与系统 `DEEPSEEK` 读取来源，移除不符合新约束的云推理/解析入口。
- 完成 MCP 真实客户端端到端验证。

## 文档维护规则

- 新发现问题写入 `personal-ai-hub-known-issues.md`。
- 修复或确认完成的能力写入 `personal-ai-hub-completed.md`。
- 未来功能只写入 `personal-ai-hub-roadmap.md`，不要混入当前任务清单。
- 跨博客代理、MCP、FastAPI、Agent Chat 或 opencode 的改动，必须同步检查 API 契约和测试命令。
