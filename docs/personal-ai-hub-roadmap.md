# Personal AI Hub 未来规划

本文只记录未来规划，不代表当前已经可用。实现前必须先补规格，再按 TDD 修改博客或 `E:\wiki` 后端代码。

## 2026-10-23 阶段更新

V1 的代理诊断、双 Runtime、Wiki 模式、本地模型、语料分块、缓存、generation 和启停脚本已经进入实现验收。具体完成项以 completed 为准，下一步优先完成手动启动后的完整链路验证。

后续保留：长任务 / 取消 / 断线恢复、网页写入审批与项目选择、Wiki 多轮聊天、扫描 OCR、摘要重建与低相关证据拒答校准。DeepSeek Harness 暂停。历史校园网限制须以热点/校园网及 TUN 条件对照重新判断，不预设唯一根因。

## 2026-10-22 执行顺序

具体规格、代码范围和验收以 [V1 改进计划](personal-ai-hub-v1-improvement-plan.md) 为准：

1. V1 先修当前链路、错误诊断、opencode 协议、Wiki 问答、缓存、索引与手动启动。
2. 同一首版接入本地 Qwen3-Embedding-0.6B、bge-reranker-v2-m3 和文档解析；清理正文与分块问题，建立新的索引 generation，保留旧数据。
3. 同一首版新增 Codex Adapter，保留 opencode，页面二选一；Hub 通过 stdio 驱动 app-server，只创建 Hub 独立会话，不同步既有桌面聊天、不公开 Codex 原始端口。
4. DeepSeek 默认更新为 `deepseek-flash`，保留 `deepseek-v4-pro` 显式选项；只读系统 `DEEPSEEK`。停止其它云向量、重排、Qwen 回答和 MinerU 解析入口。
5. 完成离线验证后，用户手动启动后端，分别验收本地、公网、博客、MCP 以及两个 Runtime。
6. DeepSeek Harness 暂停，本版不实现、不新增选项或依赖。更广泛的本地执行等待长任务、取消、权限审批和工作空间机制。

Codex 主动调用博客 MCP 与博客驱动本机 Codex 是独立方向；本版继续完成现有 Wiki MCP 工具的客户端授权和调用验收。

## 路线原则

- 本地优先：知识库正文、索引、缓存、Agent Chat 会话和运行记录默认留在 `E:\wiki`。
- 云端轻量：`E:\blog` 只承担入口、认证、管理员代理、MCP 和展示。
- 本地推理：embedding、rerank、OCR/解析均使用本地开源组件；Wiki 大模型问答与 opencode 使用 DeepSeek API，Codex 使用其登录账号额度。
- API 契约优先：博客前端、MCP 工具和 FastAPI 必须遵守同一套接口约束。
- 查询先行：MCP 初期只开放查询，不开放删除、合并、覆盖和批量导入。
- 危险操作必须人工确认，并写入本地审计记录。
- 不使用 fallback 兜底掩盖配置、网络、模型或索引问题。

## Phase A：稳定性修复

目标：让当前已经接入的 Personal AI Hub、Agent Chat 和 MCP 查询工具稳定可用。

- 修复线上博客无法加载 Personal AI Hub 功能的问题。
- 修复 API 调用失败时错误信息不够明确的问题。
- 明确线上 Cloudflare 环境变量配置流程。
- 为本地 FastAPI、opencode 和 cloudflared 建立稳定的启动、停止、状态检查流程。
- 明确 `/health`、`/kb/status`、`/agent/status` 的受保护验证方式。
- 验证 MCP `wiki_query`、`wiki_status`、`wiki_sources_list` 在 Codex、Claude Code 或 Cursor 中的调用。
- 更新 Personal AI Hub 页面中过期文案。
- 把本地模型就绪状态、索引 generation 和 Runtime 会话归属纳入诊断。

验收方式：

- 管理员能从线上 `libresensing.com` 查询本地知识库。
- 管理员能从线上 Agent Chat 页面选择 opencode 或 Codex，分别创建 Hub 会话并发送一次受控短任务。
- MCP 客户端能成功调用只读 Wiki 工具。
- 失败时能区分 token 错误、Hub 离线、Tunnel 不通、所选 Runtime 离线、本地模型缺失和索引不匹配。

## Phase B：知识库管理增强

目标：把当前查询入口扩展成可用的知识库管理界面，但实际数据仍保存在 `E:\wiki`。

- 在博客端展示 sources、summaries、chunks、wiki pages 的更清晰状态。
- 增加只读文档列表和引用展开视图。
- 增加问答结果的 citations、recall items、timings、execution 分区展示。
- 增加反馈入口，把回答质量、召回质量和用户备注写回本地。
- 增加导入任务状态展示，但实际导入仍由 `E:\wiki` 本地后端执行。
- 为删除、合并、覆盖等危险操作设计确认流程和审计记录。

暂不做：

- 不把知识库正文上传到 Cloudflare。
- 不让博客仓库存储本地索引、缓存、原始文件或运行记录。
- 不让 MCP 直接执行删除、合并、覆盖。

## Phase C：Agent Chat 增强

目标：把 Agent Chat 从调试页面整理成可长期使用的 agent 前端。

- 优化 Agent Chat 的消息展示，不只显示 JSON。
- 展示知识库预检索结果、引用来源、所选 Runtime 执行状态和工具调用日志。
- 增加运行失败的可诊断错误：知识库离线、Runtime 离线、模型配置缺失、token 不一致、Tunnel 不通。
- 建立 agent 会话缓存、反馈分析和可复盘运行记录。
- 支持更清晰的模型选择和运行状态展示。
- 保持 opencode 可替换，避免把业务逻辑写死到 opencode 内部。

技术边界：

- opencode 继续作为 Agent Runtime，不 fork、不深改核心。
- Personal AI Hub 通过 opencode server/API 接入 opencode，通过本机 app-server stdio 接入 Codex，使用同一层 Runtime Adapter 契约。
- Codex 首版只管理 Hub 自建会话；原生记录由 `D:\AIData\Codex` 管理，Hub 会话映射与运行记录在 `E:\wiki`。
- DeepSeek API key 只从系统环境变量 `DEEPSEEK` 读取，opencode provider 引用该变量，不写入仓库。

## Phase D：MCP 与外部 Agent

目标：让 Codex、Claude Code、Cursor 等外部 Agent 可以安全调用个人知识库。

- 为 MCP 查询结果增加更适合 agent 使用的结构化字段：核心概念、相关实体、证据片段、可展开来源。
- 评估 `agent_chat_send` MCP 工具，但默认仍需管理员权限和受控 scope。
- 初期不开放 MCP 删除、合并、覆盖和批量导入。
- 让外部 Agent 可以先查个人知识库，再辅助写博客、论文、代码和实验计划。
- 为 MCP 端到端调用建立测试或人工验证清单。

## Phase E：多模态与知识维护

目标：逐步补齐需求文档中的 Source Library、摘要卡、chunk 证据层和维护机制。

- 展示 source、summary、chunk、asset 的层级关系。
- 增加图片、表格、公式、项目代码 chunk 的引用展示。
- 增加重复内容、低质量内容、可能过期内容的维护建议。
- 所有自动维护建议必须先进入待确认状态。
- 用户确认后才能执行归档、合并、更新或删除。
- 所有危险操作写入本地 audit log。

## Phase F：任务型模块

目标：在稳定的知识库和 Agent Runtime 基础上扩展个人工作流。

- 学术论文与实验助手。
- 代码项目助手。
- 无线感知研究助手。
- 博客写作助手。
- 量化研究或其它个人工作流模块。

## 长期设计方向

- Personal AI Hub 是本地优先的个人智能中枢，不是把完整知识库迁到云端。
- LLM Wiki 是知识资产层，Agent Chat 是执行与交互层。
- 博客是安全入口，不是本地数据仓库。
- Cloudflare Tunnel 是当前主访问链路，但不是业务数据存储层。
- Agent Runtime 使用可替换 Adapter；首版支持 opencode / Codex，DeepSeek Harness 暂停。
- 所有新功能都应先明确规格，再实现，再同步更新 docs。
