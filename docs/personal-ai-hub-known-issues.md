# Personal AI Hub 已知问题

## HUB-27：Codex 子进程初始化退出（代码已修复，运行中服务待重启）

- 现象：2026-10-23 用户使用 -WithCodex -CodexWorkspace E:\blog 启动后，/agent/status?runtime=codex 返回 HTTP 503、AGENT_RUNTIME_NOT_READY，安全错误为“Codex 进程已退出”。
- 影响：Codex Runtime 尚不可用；同次实测本地和公网健康检查、知识库状态、opencode 状态均为 HTTP 200。
- 根因：禁用工具时生成 mcp_servers."filesystem".enabled=false 一类 CLI 覆盖键，CLI 点分解析把引号保留为名称，创建缺少 transport 的额外服务器配置。本机 CLI 0.159.2 支持 --stdio，问题与 Tunnel 无关。
- 验证线索：本地 API 日志 api-20261023-093327.err.log，CodexTransport.__enter__ → initialize → _next；隔离诊断子进程退出码为 1，尚未发送模型任务。
- 修复：汇总各级配置名称，用顶层 TOML 内联表设置 enabled=false，保留名称中的点与 @；MCP / 插件各一项隔离回归已通过。独立 app-server 初始化及 ChatGPT account/read 成功，未发送模型任务。
- 下一步：用户重启运行中的 Hub 加载修改，再通过已部署博客验收状态和短任务；不自动重发执行请求。状态检查仍受 8 秒总预算约束，系统忙时可能显式超时。

## 2026-10-23 修复中补充发现

- REVIEW-FIX-01：普通文档引用改从原始文本分块后，原知识指纹仍只覆盖 HTML、元数据、摘要和 Wiki。修改原 Markdown/CSV/提取正文可能复用旧答案或缓存的索引校验；应把实际读取正文与引用快照纳入内容 hash。已按 RED/GREEN 修复，并重建新 generation；旧索引与原始资料保留。
- REVIEW-FIX-02：状态脚本在 StrictMode 下直接读取异常的 Response 属性，非 HTTP 网络异常可能令整次诊断中断；带 token 的诊断请求也需要拒绝重定向。已通过失败回归后修复，脚本测试 11 项通过，不发送真实公网请求。
- REVIEW-FIX-03：DeepSeek SDK 同步 HTTP 与 opencode 有相同的分阶段超时问题；使用真实 SDK 和隔离分块响应，70ms 总预算仍能在稍后成功返回。已使用 AsyncOpenAI + 总期限取消修复，单次调用创建并关闭 SDK，禁止自动重试；最小失败回归和全量 174 项通过。仅使用测试 key 和 HTTP 替身复现，没有真实模型请求。

## 验证环境限制：Workers 首次 SELF.fetch 超过默认 5 秒

- 本轮两次默认预算全量均为 198/199；唯一失败是未修改的 mcp-upload.integration.test.ts 匿名上传鉴权用例，均为 5 秒超时，没有返回错误鉴权结果的证据。
- 单独以 --testTimeout=20000 复测该文件，5/5 通过；首次 SELF.fetch 实测 6.903 秒，响应断言为 401。当前证据支持测试首请求加载耗时，不能写成默认预算全绿，也不能据此断言生产鉴权延迟。
- 未修改该业务功能、测试文件或全局超时配置。最终以相同的 20 秒 CLI 预算完成 Workers 全量 199/199，通过；参数没有写入测试文件或全局配置。
- Windows Miniflare 退出有 EBUSY 临时目录清理提示；未递归删除目录、未停止非本次创建的进程。

## 2026-10-23 二次代码审查：修复状态

审查后的 16 项问题已修改代码并增加隔离回归：Standards 5 项 P2；Spec 6 项 P1、5 项 P2。下列现象保留修复前证据，当前实现和测试见[报告第 8 节](personal-ai-hub-v1-code-review-2026-10-23.md#8-审查后的代码修复与验证)。真实模型、公网和部署后的博客仍待验收。

- REVIEW-STD-01：[已修复，隔离回归通过] 博客代理 fetch 默认跟随跨源重定向，会把自定义 `X-Hub-Token` 带给目标站。两个本机随机端口的隔离探针已确认；不表示当前生产域名已泄漏。应在公网验收前禁止跨源重定向。
- REVIEW-STD-02：[已修复，隔离回归通过] Agent Chat 切换会话只改 sessionId，未清除页面级 result。A 会话回答和引用仍显示在 B 会话下，已用内存 DOM 复现。
- REVIEW-STD-03：[已修复，隔离回归通过] Refresh 只刷新会话列表和状态，不刷新当前消息；超时后按提示刷新仍看不到更新，内存 DOM 的消息调用次数未变化。
- REVIEW-STD-04：[已修复，隔离回归通过] 会话创建/列表响应缺少 id 仍 error:null，页面又将缺失值变为空字符串，导致假成功与空会话项。
- REVIEW-STD-05：[已修复，隔离回归通过] opencode status 未调用 global/health；空会话状态不能作为完整健康或模型可用证明。此项为源码确认，未调用真实 Runtime。
- REVIEW-SPEC-01：[已修复，隔离回归通过] 问答缓存错返。语义词项集合忽略语序，精确键又压平代码缩进；已复现语义 similarity=1.0 和 exact 两类误命中。新答案 unknown 质量也被复用。
- REVIEW-SPEC-02：[已修复，隔离回归通过] 同类型同标题 Personal Wiki 用新 ID 写同一路径，第二次确认创建覆盖第一篇正文；临时库已复现。实际知识库未执行此操作。
- REVIEW-SPEC-03：[已修复，隔离回归通过] Gradio 重建索引仍有向量失败后自动重建并激活 BM25-only generation 的逻辑，违反禁止 fallback，可能撤换已有可用向量索引。应失败即报错并保持活动 generation。
- REVIEW-SPEC-04：[已修复，隔离回归通过] 普通 Markdown 最终引用未保留入库起始行；第二块 metadata 58–121 被标成 1–64，之前只修正了项目代码路径。
- REVIEW-SPEC-05：[已修复，隔离回归通过] 确认 Personal Wiki 只显示 applied，不重建或提示索引待更新；新严格校验令已建库查询返回 INDEX_GENERATION_MISMATCH，直到手动重建。
- REVIEW-SPEC-06：[已修复，隔离回归通过] 带正常文本页和空白隔页的 PDF 被误判为扫描件，整份导入失败；原扫描测试仅用空白页，未覆盖正常隔页。
- REVIEW-SPEC-07：[已修复，隔离回归通过] OpenAI/httpx 异常在 Exception 兜层映射后仍由 Starlette 重抛，Uvicorn 会记录原错误。模拟异常中的测试敏感串未进响应，但进入服务器日志；不是“没有堆栈”。
- REVIEW-SPEC-08：[已修复，隔离回归通过] 总 deadline 只部分实现。模拟 opencode 100ms 预算在 344ms 后成功，Codex 过期队列也能报 completed；生产会话客户端 60 秒还长于博客 10 秒。
- REVIEW-SPEC-09：[已修复，隔离回归通过] 发送后 ReadError 等非 Timeout 断连被记 failed / INTERNAL_ERROR，而非结果未知，可能诱发重复执行。
- REVIEW-SPEC-10：[已修复，隔离回归通过] 首条 Codex turn/start 确认丢失时，native_id 未保存；隔离探针中刷新历史返回空列表，不会查询原生会话，无法按提示恢复未知状态。
- REVIEW-SPEC-11：[已修复，隔离回归通过] 状态脚本强制要求 DEEPSEEK；仅检查 Codex、本机 health 或 Tunnel 时缺少该 key 也会在请求前中断，依赖范围不正确。

这些修复已在当前工作区完成，不包含 Git 提交、线上发布或真实 Agent 执行验收。精确缓存现在要求正反馈；旧格式缓存不复用。新索引 generation 已重建，旧索引与原始资料保留。

## 2026-10-23 当前状态

HUB-01–09、11、13、15–18、21–26 的相关代码已修正并有隔离回归覆盖。HUB-10 已建立独立环境；HUB-14/20/22 的生产入口与缓存已改为本地实现，GPU 实测和完整向量索引已通过。HUB-12 已实现 Codex 只读目录边界，网页写入审批仍属后续范围；HUB-19 未重写旧摘要，已解除摘要召回硬门控。

仍待验证：线上完整链路、校园网/TUN 对照、真实 DeepSeek 与两个 Runtime 的短任务、MCP 授权调用、无答案问题的稳定拒答。下文保留发现时的证据，“下一步”应结合本节和 completed 的最新记录阅读。

## HUB-26：首次本地模型加载超过请求预算

- 现象：本机 GPU 实测首次 embedding 加载和探针约 93.95 秒，超过 Wiki 40 秒、Agent 65 秒预算；预热后 rerank 探针为 2.55 秒。
- 影响：若在第一条网页请求中惰性加载，会返回超时，即使模型本身正常。
- 处理规格：手动启动脚本显式启用预热；FastAPI lifespan 在接收请求前完成两模型本地探针，失败则启动失败，不自动切云端或 CPU。API 启动等待预算调整为 180 秒，输出本地日志路径。
- 状态：已实现启动预热并通过隔离 lifespan 测试；真实本地模型探针与完整索引评估通过，手动启动链路仍待用户验收。

## 2026-10-23 实施中新发现：HUB-24 代码引用行号偏移

- 现象：旧项目代码块在正文前附加“文件 / 语言 / 行号”四行说明，新分块把说明行计入代码行号；例如 `verify_docx.py` 实际 16 行，引用错误显示到第 20 行。
- 影响：答案中的文件行范围不准确；不影响原始项目文件。
- 初步判断：派生索引需要先分离说明和实际代码，再把分块相对行号映射到 `start_line`。
- 验证：使用已有代码块格式构造隔离输入，断言拆分后的第一行和最后一行；修复只作用于新 generation，重建后复核真实引用。
- 状态：已按 RED/GREEN 修复派生索引；真实 `verify_docx.py` 引用复核为第 1–16 行，旧数据保留。

## 2026-10-23 实施中新发现：HUB-25 网页代码空白丢失

- 现象：DeepSeek 文档的高亮代码使用多个 span 和 br，提取时逐节点 strip 把 `from openai import OpenAI` 拼成 `fromopenaiimportOpenAI`，同时丢失换行。分块 strip 还会丢失块首代码缩进。
- 影响：检索证据中的示例代码失真，无法可靠引用；来源 HTML 仍完整。
- 状态：已增加高亮 HTML 和缩进分块回归测试，保留 pre 内空白并转换 br；新索引真实示例已复核。

本文记录当前已知 bug、限制和待排查事项。修复前先补最小失败测试；修复后同步更新本文、`personal-ai-hub-completed.md` 和 `personal-ai-hub-in-progress.md`。

## 2026-10-22 审查状态

本节是 2026-10-22 发现时的记录；当前修复状态以上面的 2026-10-23 记录为准。统一规格见 [Personal AI Hub V1 改进计划](personal-ai-hub-v1-improvement-plan.md)。

## 2026-10-23 / HUB-23：Codex 空会话不可依赖提前落盘

- 现象：官方仓库记录 thread/start 后、首次 turn/start 前会话尚无 rollout；若创建后立即关闭 app-server，再以 thread/resume 发送首条消息，可能找不到历史。
- 影响：Hub 页面创建会话成功后，第一次发送仍可能失败。属于协议生命周期风险，尚未在用户登录上发起真实模型任务。
- 验证线索：[官方问题记录](https://github.com/openai/codex/issues/42099)，并以离线 Runtime 替身验证空会话不能被提前 resume。
- 处理：Hub 先创建自身会话记录，首次发送时在同一个 stdio 连接中完成 thread/start 与 turn/start；在发送首条 turn 前保存 native thread ID 和 pending 状态；确认丢失后读取同一原生会话核验，不自动重发。仅从未提交过任务的空会话返回合法空列表。

- 编号清单已扩展为 HUB-01 至 HUB-22，包含用户确认本地模型要求后的语料、索引、缓存与云服务路径专项审查。
- 首版目标为 opencode / Codex 并存；Codex 尚未实现，DeepSeek Harness 暂停。不能把计划中的功能当成已修复或已可用。

- 已通过现有博客相关测试 10 个、后端相关测试 30 个；这不覆盖所有失败路径。
- 后端全量测试在 Gradio/Pandas 导入时产生 2 个收集错误，不能继续将历史“81 个通过”视为当前验证结果。
- 用户确认热点下曾打通链路、校园网下不通；还曾出现公网链路通而博客代理报错。当前发现的后端未启动不能解释全部历史故障。

## P0：线上 Personal AI Hub 功能无法稳定加载

- 现象：博客网页中的 Personal AI Hub 或 Agent Chat 功能无法正常加载或无法返回有效结果。
- 影响：管理员无法通过线上博客稳定使用本地知识库和 agent。
- 初步判断：可能涉及 Cloudflare 环境变量、管理员登录态、server function 调用、Hub 代理错误、Tunnel 不通、FastAPI 未启动或前端错误边界。
- 验证线索：先在本地带 token 验证 `/health`、`/kb/status`、`/kb/query`，再验证 Tunnel，最后验证线上博客代理。
- 下一步：收集线上浏览器控制台、Cloudflare Workers 日志和本地 FastAPI/opencode 日志，定位失败层级。

## P0：博客代理吞掉 Hub 具体错误

- 现象：`src\features\personal-ai-hub\service\personal-ai-hub.service.ts` 在 Hub 返回非 2xx 时统一抛出“Personal AI Hub 服务不可用”。
- 影响：token 错误、FastAPI 离线、opencode 离线、请求参数错误、索引缺失等都会显示成同一类错误，线上排查效率低。
- 初步判断：需要读取 Hub 响应状态码和安全的错误摘要，但不得泄露 `PERSONAL_AI_HUB_API_TOKEN`、`LOCAL_HUB_API_TOKEN` 或 DeepSeek key。
- 下一步：先写 Node 单元测试覆盖 401、422、503 和非 JSON 错误，再实现结构化错误信息。

## P0：API 调用失败

- 现象：博客代理调用本地 Hub API 失败。
- 影响：知识库查询、状态检查、Agent Chat 和 MCP 查询都会不可用。
- 初步判断：重点检查 `PERSONAL_AI_HUB_API_URL`、`PERSONAL_AI_HUB_API_TOKEN`、`LOCAL_HUB_API_TOKEN`、FastAPI 进程、Cloudflare Tunnel 和 opencode server。
- 验证线索：`/health` 也需要 `X-Hub-Token`；裸访问返回 401 不等于服务离线。
- 下一步：先确认 `E:\wiki` 本地受保护 `/health`，再确认 Tunnel 域名，最后确认博客代理。

## P1：博客 Workers 集成测试依赖本地 `wrangler.jsonc`

- 现象：`bun run test` 读取 `vitest.config.ts` 时需要 `./wrangler.jsonc`，该文件被 `.gitignore` 忽略，过去曾因缺失无法启动测试。2026-10-22 本地已存在该文件，本轮未执行 Workers 集成测试。
- 影响：Workers 集成测试无法启动时，容易被误判为业务测试失败。
- 初步判断：这是测试环境准备问题，不是 Personal AI Hub 业务逻辑失败。
- 验证线索：Personal AI Hub 的 `*.test.ts` 属于 Node 测试，使用 `bun run test:node`。
- 下一步：后续补齐本地 `wrangler.jsonc` 准备流程，或调整测试配置让缺省环境更清晰地报错。

## P1：校园网与热点的 Tunnel 差异尚需同条件复核

- 现象：用户确认过去手机热点下能通，校园网下不通；2026-10-22 现有连接器保持 4 条健康连接，本机同时存在启用的 TUN 网卡。
- 影响：远程博客无法访问本机 Hub API。
- 初步判断：历史网络路径差异需要保留，但不能将每次 API/博客错误都归结为校园网；当前没有关闭 TUN 的直连对照结果。
- 验证线索：保持服务版本、参数和 token 配置相同，分别记录热点/校园网、TUN 状态、本地请求、公网请求和博客请求的结果。
- 下一步：由用户启动后端后逐层对照；先修代理错误信息，禁止仅凭截图的统一提示判断网络根因。本轮不自动切换网络或 TUN。

## P1：Personal AI Hub 首页文案与当前实现不同步

- 现象：页面中仍写着“Agent Chat 会在下一阶段接入 opencode”，但当前代码已经有 Agent Chat 第一版和 opencode runtime 接入。
- 影响：文案误导排查和使用预期。
- 下一步：更新页面文案，并增加更明确的状态说明。

## P1：Agent Chat 页面偏调试形态

- 现象：页面主要展示 JSON，包括 runtime status、session messages、opencode result、execution 和 recall items。
- 影响：能排查，但正式使用体验不够清晰。
- 下一步：稳定 API 后再做 UI 整理，分别展示回答、引用、召回、工具日志和错误状态。

## P1：本地状态脚本还没有完整覆盖 opencode 和 cloudflared

- 现象：`E:\wiki\scripts\status_hub.ps1` 当前重点检查 FastAPI `/health` 和相关进程，对 opencode HTTP API、DeepSeek key、Cloudflare Tunnel 连接状态的诊断还不完整。
- 影响：Agent Chat 或远程访问失败时，需要人工分散检查多个服务。
- 下一步：在 `E:\wiki` 中补充状态脚本检查项；博客仓库只记录检查结果和前端代理问题。

## P2：MCP 查询工具仍需真实客户端验证

- 现象：代码中已注册 `wiki_query`、`wiki_status`、`wiki_sources_list`，但仍需用 Codex、Claude Code 或 Cursor 进行端到端调用验证。
- 影响：Node 测试通过不代表 MCP 客户端授权、scope、网络和返回结构完全可用。
- 下一步：在 Hub、Tunnel 和线上环境变量稳定后做 MCP 集成测试。

## P2：环境变量和启动流程需要统一清单

- 现象：博客、FastAPI、opencode、DeepSeek、Cloudflare Tunnel 分别依赖不同环境变量和启动状态。
- 影响：容易出现某个服务没启动或 token 不一致导致的联动失败。
- 下一步：在修复阶段将检查项固化到启动/状态脚本或运维清单。

## P2：opencode 真实消息调用仍需端到端验证

- 现象：已确认 opencode 1.14.19 的 `/global/health`、`/session/status`、`/session` 可用，但尚未通过真实 DeepSeek provider 发送 agent message 做完整验证。
- 影响：当前 mock 测试通过不等于真实模型调用、provider 配置和长响应流完全可用。
- 下一步：在确认 `DEEPSEEK`、`OPENCODE_CONFIG`、opencode server 后，做一次受控端到端验证，并记录是否产生费用。

## P0 / HUB-02：opencode 消息 model 格式不符合已安装版本契约

- 现象：`E:\wiki\personal_wiki_brain\agent\opencode_runtime.py:94` 发送字符串 model；当前 mock 测试也断言字符串。
- 影响：健康检查、会话列表可以成功，真实发消息仍可能被 Runtime 拒绝。
- 判断：已核对本机 opencode 1.14.19 的官方生成类型，要求 `{providerID, modelID}` 对象。这是源码与契约的确定差异，尚未启动真实 Runtime 发送消息。
- 验证来源：[v1.14.19 SessionPromptData](https://github.com/anomalyco/opencode/blob/v1.14.19/packages/sdk/js/src/gen/types.gen.ts)。
- 下一步：先修改契约测试验证 RED，再修 Adapter；同时处理 HTTP 200 但消息体包含执行错误的情况。

## P1 / HUB-03、06：查询失败不显示，后端错误缺少结构

- 现象：Agent Chat 的 status/sessions/messages 查询没有显示 error，缺数据时显示空 JSON；缺 Runtime 配置的 `/agent/status` 在隔离环境中返回纯文本 500。
- 影响：请求失败可能被看成正常空会话，代理无法区分配置缺失、Runtime 离线和其它故障。
- 判断：前端为源码确认，后端普通 500 已隔离复现。
- 下一步：后端错误 JSON、代理 Result 和页面三种状态一起修复；保留 request ID，不暴露原始敏感响应。

## P1 / HUB-04：问答缓存混用模型和检索配置

- 现象：`ChatService.chat` 只以问题查询缓存，未隔离模型、answerMode、检索、topK、rerank 和知识版本。
- 影响：相同问题切换配置仍可能返回旧答案，Agent 预检索也可能复用旧证据。
- 验证：临时库中先用模型 A/local/topK=8，再请求模型 B/bm25/topK=1，返回 A 的答案和 local/topK=8；B 与新检索均未调用。
- 下一步：新增用途和配置/知识指纹，精确及语义缓存都检查；保留旧文件，不自动清理。

## P1 / HUB-05：目录存在被误判为索引就绪

- 现象：空临时库无任何 BM25 文件，`/kb/status` 仍返回 ready，索引查询遇到缺文件时直接返回空数组。
- 影响：未构建或丢失索引与“知识库没有命中”无法区分。
- 判断：已经隔离复现；bootstrap 会预建索引目录，目录存在不证明索引可用。
- 下一步：区分空库、未建索引、损坏和正常无命中；只校验当前模式实际需要的数据组，0 页 Wiki 是合法空组。

## P1 / HUB-07：Wiki 页面尚未开放大模型问答选择

- 现象：`E:\blog\src\routes\admin\personal-ai-hub\index.tsx:38` 写死 local/bm25，虽然提交了模型名，local 模式不会调用大模型。
- 影响：现有网页是检索摘录，不能作为完整大模型知识问答体验验收。
- 下一步：开放现有后端的回答模式、模型和检索选择，展示实际配置与引用；持久化多轮会话另行实现。

## P1 / HUB-08、10：配置继承与 Python 环境存在运行差异

- 现象：启动与状态脚本只检查进程 token；当前用户级 token 存在但当前进程未继承。Python 实际 NumPy 2.4.6/Pandas 1.5.3 与 requirements 的 NumPy 1.26.4 不一致。
- 影响：从不同终端启动可能失败；Gradio 相关测试在导入阶段因 NumPy ABI 不兼容而中断。
- 验证：全量 `python -m pytest -q --tb=short` 出现两个收集错误；不依赖 Gradio 的相关测试 30 个通过。
- 下一步：统一配置来源和启动前校验；建立 wiki 专用可复现环境，不在全局 Python 上盲目更换依赖。

## P1 / HUB-09；P2 / HUB-11、12、13：执行与资源风险

- 现象：同步请求超时可能留下继续执行的任务；脚本按全机命令行子串识别进程；缺少项目选择和网页审批；SQLite 连接未显式关闭。
- 影响：可能出现未知运行状态、漏检或误停其它进程、工作目录不符合预期和 Windows 文件占用。
- 判断：当前为源码风险；隔离审查清理临时 SQLite 时观察到文件占用，尚未证明线上数据损坏或实际误停。
- 下一步：V1 限定受控短任务、记录开始和失败、按本项目 PID 管理，并增加 Codex Adapter；后续补齐异步执行、工作空间和审批。

## P1 / HUB-14、20：检索和解析仍有云服务调用

- 现象：默认向量模型为 DashScope `text-embedding-v4` / 1024 维，现有向量 manifest 一致；还保留云 rerank、Qwen 回答及 MinerU 云解析路径。
- 影响：不符合用户“除 DeepSeek 大模型 API 外，其余检索与解析本地运行”的新要求；是否免费不改变该边界。
- 验证线索：`retrieval/embedding.py`、`retrieval/rerank_cache.py`、`ingest/pdf_parser.py` 与 API/Gradio 工厂。当前博客写死 local/bm25，不代表 Agent 默认 hybrid 或导入过程没有云调用。
- 下一步：本地 Qwen3-Embedding-0.6B + bge-reranker-v2-m3；数字 PDF 本地解析，OCR 未配置时明确报错；旧参数拒绝，不能自动转发云 API。模型缺失显式失败。

## P1 / HUB-15、22：向量与重排缓存指纹不完整

- 现象：embedding 缓存未区分 query/document，text_hash 会合并空白；rerank 缓存仅包含候选 ID，没有候选内容或知识版本。
- 影响：可能复用不同编码角色的向量，Python 缩进改变后命中旧向量，资料更新后仍读取旧重排证据。
- 验证线索：只读调用现有 hash 函数，两个缩进语义不同的 Python 片段产生相同键；其余为源码确认，尚未证明所有历史缓存都存在错误。
- 下一步：指纹包含精确输入、角色、模型修订、instruction、预处理、候选内容和知识 generation；新建 namespace，保留旧缓存，不自动删除。

## P1 / HUB-16、17：网页过碎与长代码截断

- 现象：18 个网页来源产生 4176 个 chunk，平均约 11 字符，其中 3628 个不足 20 字符；项目来源有 22 个 chunk 超过向量化的 6000 字符阈值，最长 11832 字符。
- 影响：导航和孤立词句挤占候选，段落上下文丢失；长代码尾部没有进入向量表示。单换 embedding 无法修复语料质量。
- 验证线索：只读统计 `data/indexes/metadata.sqlite`；`ingest/service.py` 将整个 body 的文本节点逐项转为段落，分块缺少 token 预算与重叠；`retrieval/indexing.py` 只取前 6000 字符。
- 下一步：先做正文提取、标题与 token 感知分块、代码行范围和父块映射；从保存的原始资料构建新 generation，不覆盖原始文件或旧派生数据。

## P1 / HUB-18；P2 / HUB-19、21：召回策略与分词仍需验证

- 现象：摘要仅覆盖开头少量片段，却作为 chunk 来源过滤的硬门控；BM25/向量各组分数分别归一化后混排；中文按单字切分且 CamelCase 未拆词。
- 影响：摘要漏主题可能导致证据无法进入候选；跨组分数与技术标识符匹配的效果不稳定。属于源码确认的设计风险，尚无本地标注集质量结论。
- 验证线索：`retrieval/search.py`、`retrieval/index_objects.py`、`ingest/service.py` 的摘要生成逻辑。当前 Personal Wiki 为 0 页，应作为合法空组处理。
- 下一步：全局 chunk 独立召回、名次融合与本地重排，摘要用于补充展开；用 20–30 条本地标注题比较清洗前后 BM25/hybrid，检查长文后半段、代码尾部、引用和无答案问题。
