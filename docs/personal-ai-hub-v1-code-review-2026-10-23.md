# Personal AI Hub V1 二次代码审查

日期：2026-10-23。范围：`E:\blog` 与 `E:\wiki`。本轮只审查、隔离复现和更新文档，**未修改业务代码，也未修复下列问题**。

> 上句及第 1–7 节保留审查当时的证据；第 8–9 节为随后修复的历史记录。2026-10-24 已重新逐项核对，当前结论以文末第 10 节为准，不能把原始“待修复”或“未部署”统计视为当前状态。

## 1. 审查结论

两个功能都有实际实现：博客页面会通过管理员代理调用 FastAPI，Wiki 有本地检索与 DeepSeek 问答，Agent Chat 有知识预检索和两个 Runtime Adapter。它们不是只有页面或模拟返回值。

但当前不能认定为“功能完整、可以稳定使用”。本轮确认 **16 项待处理问题**：Standards 轴 5 项 P2；Spec 轴 6 项 P1、5 项 P2。主要缺口包括缓存错答、个人知识覆盖、索引自动降级，以及 Agent 会话与未知执行状态的恢复。原有测试仍全部通过，说明这些场景没有被已有测试有效覆盖。

这里的 P1 表示应优先修复的答案正确性、数据安全或执行状态问题；P2 表示条件触发的安全问题、正常输入失败、契约及交互缺口。**没有证据证明生产环境已发生 token 泄漏、数据覆盖或重复执行事故。**

## 2. 范围与证据等级

- 博客固定点：`1df7f10723d475a8e1bff64058dd56797d8a85c9`。上一轮实现尚未提交，本次审查包含当前工作区的已跟踪改动和 Hub 新文件，不使用空的 `HEAD...HEAD` 差异冒充审查。
- 后端不是 Git 仓库；对照 `E:\wiki\.codex-backups\2026-10-23-v1` 区分遗留逻辑与本轮新增逻辑。
- 规格：[主需求文档](E:/wiki/LLM_Wiki_需求文档.md:1719)、[V1 改进计划](E:/blog/docs/personal-ai-hub-v1-improvement-plan.md:80)、两个项目的 AGENTS.md。后端规则中的旧博客路径以用户明确指定的 `E:\blog` 为准。
- **隔离复现**：实际导入现有函数/页面，在临时库、内存 DOM、替身 Runtime 或本机随机端口模拟 HTTP 中复现；不代表线上已发生。
- **源码确认**：调用链和实现差异明确，但未调用真实 Runtime 验证现场行为。
- 未启动实际 Hub、opencode 或 Codex 执行服务；未请求付费模型，未切换网络/TUN，未部署博客。用于复现的临时 HTTP 监听均已关闭，没有写入实际知识库。

## 3. 功能是否真正实现

| 功能 | 实现判断 | 本次审查边界 |
|---|---|---|
| 博客管理员代理 | 已实现 | Server Function 均有 adminMiddleware；浏览器不需要 Hub token。跨源重定向保护遗漏，见 STD-01 |
| Wiki 单轮问答 | 已实现，有正确性缺陷 | 页面传递回答模式、模型和检索参数；DeepSeek 客户端读取系统 DEEPSEEK。缓存可能返回另一个问题的答案，见 SPEC-01 |
| 本地 embedding / rerank | 已实现 | 默认生产工厂使用本地 Qwen3 / BGE，运行时 local_files_only。权重与活动索引实际存在；本轮未重新做 GPU 性能基准 |
| 索引 generation 与内容校验 | 已实现，有流程缺口 | query 的严格校验存在；Gradio 自动降级与 Personal Wiki 写入后索引更新不完整，见 SPEC-03、05 |
| 网页、项目、文档导入 | 后端/Gradio 已实现 | 博客当前主要提供查询入口，不是完整的资料管理界面；普通文档引用与正常 PDF 输入仍有 bug，见 SPEC-04、06 |
| Personal Wiki 草稿与确认写入 | 已实现，有数据安全问题 | 两次同名写入会覆盖文件；不能作为安全完成的知识写入闭环，见 SPEC-02、05 |
| Agent 先查 Wiki 再执行 | 已实现 | API 调用 ChatService 后将 recall_items 注入对应 Runtime；不会把 Wiki 回答缓存直接代替 Agent 预检索 |
| opencode / Codex 切换 | 已实现，有会话交互缺陷 | 页面和 API 均传 runtime；会话结果归属、刷新和响应校验不完整，见 STD-02–04 |
| Hub 独立 Codex 会话 | Adapter 与映射已实现，真实续聊待验收 | 原生 thread 使用 stdio；本机 Home 为 D:\AIData\Codex。首条消息确认丢失时无法恢复映射，见 SPEC-10 |
| Codex 本地文件任务 | 只读调用路径已实现，实际任务未验收 | 参数及实际返回权限有核对；不表示已支持修改文件、网页审批或 GUI 操作 |
| 运行记录及 unknown 状态 | 部分实现 | 会记录 started/completed/failed/unknown；断连误分类和首条 Codex 恢复缺口仍存在，见 SPEC-08–10 |
| 历史展示 | 有 API 和调试展示，尚非完整聊天界面 | 原生消息以折叠 JSON 显示；没有同步已有桌面聊天。Refresh 还漏刷新当前消息 |
| MCP Wiki 工具 | 工具与错误适配已实现 | 当前是 Wiki 查询/状态/来源工具，不是通过 MCP 控制本机 Codex；实际客户端授权和调用未重新验收 |
| 公网与校园网链路 | 待真实验证 | 当前源码和离线测试不能证明校园网根因，也不能证明已部署博客与本地新版接口配套 |

本次只读检查到：两模型固定修订的权重存在；活动索引为 `v1_194a0f098db747b28747e614c212d754`，manifest 声明 BM25/vector/hybrid、21 个摘要、1450 个派生 chunk、0 个 Wiki 对象。**文件存在和 manifest 声明不等于本轮重新完成了 GPU、全文内容校验或公网验收。**

持久化 Wiki 多轮聊天、网页写入审批、长任务、桌面历史同步、扫描 OCR、DeepSeek Harness 本来就不在已确认 V1 范围内，不能把它们简单记成漏写的 bug。

## 4. Standards：项目规则、契约与实现正确性

### REVIEW-STD-01 / P2：代理重定向会带出 Hub token

- 位置：[personal-ai-hub.service.ts:120](E:/blog/src/features/personal-ai-hub/service/personal-ai-hub.service.ts:120)。
- 规则：博客 token 仅用于受保护的 Hub 调用，凭证不能泄漏；配置或协议异常应明确返回错误。
- 触发：Hub 域名因 Access、代理规则或源站响应返回跨 origin 30x；fetch 没有设置 `redirect: "manual"` 或 `"error"`。
- 隔离复现：两个本机随机端口，一个返回 302 指向另一个；实际调用 getHubStatus。目标收到测试 X-Hub-Token，结果仍被代理接受为成功。
- 影响：凭证可能随重定向到达配置的 Hub 以外的目标。本轮没有发现生产泄漏证据。
- 建议：拒绝重定向并保留可诊断的 HTTP 状态；增加跨源跳转与凭证不转发的回归验证。Cloudflare 的 [Request 文档](https://developers.cloudflare.com/workers/runtime-apis/request/)说明默认 follow 行为及跨域转发 header 的风险。

### REVIEW-STD-02 / P2：切会话残留旧回答，并有创建/发送竞态

- 位置：[agent-chat.tsx:198](E:/blog/src/routes/admin/personal-ai-hub/agent-chat.tsx:198)、[创建回调:77](E:/blog/src/routes/admin/personal-ai-hub/agent-chat.tsx:77)、[发送按钮状态:109](E:/blog/src/routes/admin/personal-ai-hub/agent-chat.tsx:109)。
- 隔离复现一：A 会话发送成功后切 B，选中会话已是 B，A 的回答与引用仍可见。
- 隔离复现二：选 A → 开始创建 C，暂缓创建响应 → Send 仍启用并向 A 发送 → 创建返回选中 C → A 的执行响应展示在 C 下。
- 原因：result 是页面级状态，切换/创建会话不清除；发送未检查 createSessionMutation.isPending，响应未核对请求时的 runtime/session。
- 影响：用户可能把别的会话结果当成本次任务结果。
- 建议：清除旧结果，禁止创建与发送重叠，使用提交时的会话标识判断响应归属。

### REVIEW-STD-03 / P2：Refresh 不刷新当前消息历史

- 位置：[agent-chat.tsx:254](E:/blog/src/routes/admin/personal-ai-hub/agent-chat.tsx:254)。
- 隔离复现：实际页面点击 Refresh 前后，messages API 调用次数保持为 3；仅 sessions/status 被重查。
- 影响：错误提示要求“先刷新会话”，按钮却不能取得当前会话新消息，尤其影响超时后的检查。
- 建议：同时刷新当前 messages；刷新失败和结果未知应分别展示，不自动重新发送任务。

### REVIEW-STD-04 / P2：会话响应缺少必需字段仍被当成功

- 位置：[schema:74](E:/blog/src/features/personal-ai-hub/schema/personal-ai-hub.schema.ts:74)、[schema:78](E:/blog/src/features/personal-ai-hub/schema/personal-ai-hub.schema.ts:78)、[页面:78](E:/blog/src/routes/admin/personal-ai-hub/agent-chat.tsx:78)。
- 隔离复现：调用实际 service，fetch 替身返回 `{session:{}}` 或 `{items:[{}]}`，两者均得到 `error:null`。
- 原因：响应使用 record(any)，未强制非空会话 ID；页面又把缺失 ID 转为 `""`。
- 影响：表现为创建成功但不能提问，或会话列表出现空项，协议错误没有产生 HUB_RESPONSE_INVALID。
- 建议：定义两个 Runtime 共用的最小会话契约，强制必需字段和类型，再保留 Runtime 扩展字段。

### REVIEW-STD-05 / P2：opencode 就绪检查未核验 health

- 位置：[opencode_runtime.py:55](E:/wiki/personal_wiki_brain/agent/opencode_runtime.py:55)。
- 源码确认：status 只 GET `/session/status`；`/global/health` 方法存在，但该状态链路不调用它。
- 与规格不符：[V1 4.3](E:/blog/docs/personal-ai-hub-v1-improvement-plan.md:174)明确要求不能单凭空的 session/status 判断就绪。
- 影响：页面能展示状态 JSON，不等于健康状态或模型执行能力已验证。尚未对真实 Runtime 复现现场故障。
- 建议：在明确的总预算内核验 health，分别表达健康、会话忙闲和模型配置状态。

## 5. Spec：需求完成度与功能缺口

### REVIEW-SPEC-01 / P1：问答精确与语义缓存仍会错答

- 位置：[cache.py:65](E:/wiki/personal_wiki_brain/chat/cache.py:65)、[精确键:168](E:/wiki/personal_wiki_brain/chat/cache.py:168)、[词项相似度:172](E:/wiki/personal_wiki_brain/chat/cache.py:172)。
- 归属：遗留算法；上一轮仅修了配置/模型/知识指纹隔离，没有修复问题文本之间的碰撞。
- 语义碰撞复现：依次询问 `A safer than B scheme?` 和 `B safer than A scheme?`，模型替身只调用一次；第二问 similarity=1.0，原样返回第一问答案。
- 精确碰撞复现：两段 Python 问题只有 second() 的缩进不同，第二段仍 hit_type=exact，返回“second always executes”。_exact_key 会合并换行和缩进，且转为小写。
- 另一个规格缺口：记录初始质量为 unknown，_record_can_reuse 只排除负反馈和无证据答案，没有实现[主需求:956](E:/wiki/LLM_Wiki_需求文档.md:956)要求的“历史答案质量为正”。
- 建议：精确键保留具有语义的原始文本；未验证的相似问答不能直接替代当前回答。区分精确复用、检索辅助和经确认的正向答案复用。

### REVIEW-SPEC-02 / P1：同名 Personal Wiki 会覆盖已有正文

- 位置：[personal/service.py:81](E:/wiki/personal_wiki_brain/personal/service.py:81)。
- 归属：改造前已有，不是上一轮新写入的逻辑，但属于当前 Wiki 功能的真实缺陷。
- 隔离复现：创建并确认两份相同类型、相同标题、不同内容的草稿；生成不同 wiki_page_id，却写入相同文件名。数据库仍有两页，两条记录读取到的都是第二份正文，第一份正文丢失。
- 规则冲突：[主需求:1111](E:/wiki/LLM_Wiki_需求文档.md:1111)要求覆盖个人知识必须人工确认；确认“创建新页”不等于确认覆盖同名旧页。
- 建议：使用唯一文件路径，或明确拒绝/提示冲突；文件、元数据、审计应形成一致的写入操作。不要用新的 ID 掩盖相同文件路径。

### REVIEW-SPEC-03 / P1：Gradio 仍会在向量失败后自动撤换活动索引

- 位置：[gradio_app.py:503](E:/wiki/personal_wiki_brain/ui/gradio_app.py:503)。
- 归属：遗留 fallback 与本轮新 generation 激活机制交互，扩大了影响。
- 隔离复现：临时库先建立 full generation；使下一次 rebuild_all 抛 LOCAL_MODEL_NOT_READY。异常分支执行 rebuild_bm25_all，活动指针改变，模式从 `[bm25,vector,hybrid]` 变为 `[bm25]`。
- 与规则冲突：禁止 fallback；[V1 4.2](E:/blog/docs/personal-ai-hub-v1-improvement-plan.md:163)要求所选索引失败时“不切换为别的检索模式”。
- 影响：导入操作后，博客默认 hybrid 查询可能突然不可用。即使新语料确实需要重建，也不能把自动降级当作完整成功。
- 建议：失败直接报告并保留原活动 generation；新增语料标记待建索引。只有用户明确选择 BM25-only 时才激活该模式。

### REVIEW-SPEC-04 / P2：普通文档的最终引用行号仍错误

- 位置：[index_objects.py:116](E:/wiki/personal_wiki_brain/retrieval/index_objects.py:116)、[重算行号:44](E:/wiki/personal_wiki_brain/retrieval/index_objects.py:44)。
- 归属：本轮新增的统一派生分块只对 project 保留原 metadata 行号，普通 Markdown 等没有带入起始行。
- 隔离复现：新导入 160 行 Markdown，第二块 metadata 为 58–121 行，最终 IndexObject 引用却是 1–64 行。现有长文测试只验证入库 metadata，没有验证最终引用。
- 与规格不符：[V1 9.3](E:/blog/docs/personal-ai-hub-v1-improvement-plan.md:552)要求保留行号和父块映射。
- 建议：所有来源统一保留正确的坐标系；区分原文行号、块内行号和派生 JSONL 位置，并让网页显示的路径与行号指向同一份内容。

### REVIEW-SPEC-05 / P2：确认 Personal Wiki 后，索引查询闭环会中断

- 位置：[gradio_app.py:182](E:/wiki/personal_wiki_brain/ui/gradio_app.py:182)、[personal/service.py:95](E:/wiki/personal_wiki_brain/personal/service.py:95)。
- 归属：遗留未刷新索引与本轮新严格内容校验交互。
- 隔离复现：已有可用 BM25 generation 的库新增并确认一页 Personal Wiki，界面只返回 applied；后续 BM25 查询返回 INDEX_GENERATION_MISMATCH，直到手动重建索引。
- 与规格不符：[主需求:792](E:/wiki/LLM_Wiki_需求文档.md:792)要求 Personal Wiki 同样进入 BM25/向量检索。
- 影响：不只是新页暂未可搜，旧资料的正常索引查询也被阻断。严格拒绝旧索引本身符合“不兜底”，遗漏在写入后的索引与用户状态衔接。
- 建议：确认后完成受控重建，或明确展示“知识已保存、索引待更新”与可执行的重建入口，不能只显示 applied。

### REVIEW-SPEC-06 / P2：空白隔页被误判为需 OCR 的扫描件

- 位置：[pdf_parser.py:23](E:/wiki/personal_wiki_brain/ingest/pdf_parser.py:23)。
- 归属：本轮新增 LocalPdfParser。
- 隔离复现：本地创建两页 PDF，第一页有正常可选文本、第二页完全空白；导入整份文档被拒绝，提示第二页需要 OCR。
- 与规格不符：本地数字 PDF 是正常支持范围，明确拒绝的是无 OCR 配置的扫描件。空白页不等于扫描页。
- 测试遗漏：现有“扫描件”测试只生成空白页并断言报错，反而固化了错误分类。
- 建议：区分空白页、图片/扫描页和正常文本页，保留正确页码；不通过调用云解析或静默切换解析器解决。

### REVIEW-SPEC-07 / P2：响应脱敏后，原异常仍可能进入 Uvicorn 日志

- 位置：[errors.py:27](E:/wiki/personal_wiki_brain/api/errors.py:27)、[处理器注册:59](E:/wiki/personal_wiki_brain/api/errors.py:59)。
- 归属：本轮新增错误映射的服务器边界遗漏。
- 隔离复现：通用 FastAPI 应用安装生产 install_error_handlers，在本机随机端口使用 Uvicorn，模拟 AuthenticationError 含测试字符串。响应为 502 / MODEL_AUTH_FAILED 且无测试字符串；Uvicorn 的原异常 traceback 中却仍有该字符串。
- 原因：OpenAI/httpx/MissingSystemEnvironment 仅在 Exception handler 的内部 isinstance 分支映射，没有注册相应异常类型。Starlette 的 ServerErrorMiddleware 发送错误响应后仍重抛原异常，Uvicorn 会记录它。
- 与规格不符：[V1 4.2](E:/blog/docs/personal-ai-hub-v1-improvement-plan.md:170)要求敏感信息不进入日志。若 provider 原错误包含 key 或私密输入，安全 JSON 日志之外仍可能发生泄漏。
- 建议：已知异常在正确异常层注册、受控处理；意外异常仍需可定位的堆栈，但必须有一致脱敏策略。不能简单关闭全部日志。
- 已排除的误判：不能声称“内部异常完全没有堆栈、无法定位”，真实 Uvicorn 会记录堆栈；问题是该路径绕过当前脱敏设计。本轮没有使用真实凭证复现。

### REVIEW-SPEC-08 / P1：总超时预算未真正兑现，普通会话调用也存在期限不匹配

- 位置：[opencode_runtime.py:96](E:/wiki/personal_wiki_brain/agent/opencode_runtime.py:96)、[客户端默认期限:46](E:/wiki/personal_wiki_brain/agent/opencode_runtime.py:46)、[CodexTransport:75](E:/wiki/personal_wiki_brain/agent/codex_runtime.py:75)、[完成结果返回:116](E:/wiki/personal_wiki_brain/agent/codex_runtime.py:116)。
- 隔离复现一：本机 HTTP 替身逐段发送合法 opencode 响应。传入总预算 100ms，实际约 344ms 后仍成功；HTTPX 的 timeout 限制网络阶段/读等待，不是总墙钟期限。
- 隔离复现二：Codex deadline 已过期 5 秒，但队列中有 completed 通知，completed_turn 仍返回成功；_next 没有先拒绝已到期请求。
- 另一个期限不匹配：生产自建 opencode httpx.Client 是 60 秒，list/create/messages 没有覆盖它；博客对应调用默认 10 秒。现有测试注入的 client 默认约 5 秒，测试通过不能证明生产期限一致。
- 与规格不符：[主需求 V1:1730](E:/wiki/LLM_Wiki_需求文档.md:1730)和[V1 4.2](E:/blog/docs/personal-ai-hub-v1-improvement-plan.md:172)明确 Wiki/Agent 与代理预算、剩余期限及禁止自动重发。
- 建议：在每个 Runtime 请求/事件处理与返回处实施真正截止检查，明确调用方断开后的运行状态；让会话创建/读取预算小于代理预算。不能把“浏览器不再等待”称为工具已停止。

### REVIEW-SPEC-09 / P1：发送后断连被误记为确定失败

- 位置：[server.py:241](E:/wiki/personal_wiki_brain/api/server.py:241)。
- 隔离复现：Runtime 替身在 send_message 中抛 ReadError；API 返回 503，记录为 failed，error_reason 为 INTERNAL_ERROR。
- 原因：unknown 只覆盖 TimeoutException 和 HUB_TIMEOUT。ReadError、RemoteProtocolError 等发送后断连也不能证明上游没有执行。
- 影响：用户可能看到“失败”后重试一个已执行的任务，opencode 可执行本地操作，因此不是普通文字展示问题。
- 建议：区分发送前明确拒绝、发送后状态未知和上游明确失败；记录对应 reason 与检查方式。对未知状态不自动重发，也不暗示已取消。

### REVIEW-SPEC-10 / P1：首条 Codex 消息确认丢失后，Hub 无法恢复原生会话

- 位置：[codex_runtime.py:224](E:/wiki/personal_wiki_brain/agent/codex_runtime.py:224)、[空历史分支:176](E:/wiki/personal_wiki_brain/agent/codex_runtime.py:176)。
- 隔离复现：thread/start 成功，turn/start 抛 HUB_TIMEOUT，模拟服务器可能接受 turn 但确认响应丢失。保存的 native_id 仍为 `""`；随后 list_messages 返回 `[]`，没有向 Runtime 查询历史。
- 影响：错误提示“先查看会话”无法兑现；再次发送会重新 thread/start，可能生成另一条模型任务并重复消耗额度。当前没有调用真实 Codex 推理证明实际账号已发生该情况。
- 建议：保存首条 turn 提交的 pending 原生标识与运行状态，设计确认丢失后的恢复/核验路径。既要处理空 thread 未落盘，也要处理 turn 已提交却丢失确认，不能只覆盖正常首发成功路径。

### REVIEW-SPEC-11 / P2：Codex 和状态诊断被不必要地绑定 DeepSeek key

- 位置：[hub_common.ps1:4](E:/wiki/scripts/hub_common.ps1:4)、[status_hub.ps1:7](E:/wiki/scripts/status_hub.ps1:7)、[start_hub.ps1:10](E:/wiki/scripts/start_hub.ps1:10)。
- 隔离复现：只在本次 PowerShell 进程设置测试 LOCAL_HUB_API_TOKEN，移除 DEEPSEEK，执行 status_hub -EnvSource Process -Runtime codex；在任何 HTTP 探针之前报缺 DEEPSEEK。
- 影响：本机 health、Codex 登录和 Tunnel 诊断本不需要 DeepSeek key，却全部无法检查。只选择 Codex 的启动预检也被绑定；当前用户 key 已配置不等于此依赖合理。
- 与规格不符：启动与诊断应只加载本次所需配置；Codex 走其独立 ChatGPT 登录。
- 建议：状态检查仅要求 token；DeepSeek key 在需要 Wiki LLM/opencode 能力时显式校验，按能力分别报告就绪，不从其它来源自动兜底读取。

## 6. 本轮验证记录与现有测试盲区

| 验证 | 本轮结果 | 不能据此证明什么 |
|---|---|---|
| Hub/MCP Node 测试 | 5 文件、21 测试通过 | 未覆盖跨源重定向、会话切换残留、创建/发送竞态和 Refresh 消息刷新 |
| 后端 API/两个 Runtime/缓存/脚本测试 | 53 测试通过 | 未覆盖生产 client 的真实总期限、确认丢失、同名知识写入、普通文档最终引用等 |
| 临时库与本地 PDF 探针 | 复现缓存、覆盖、索引切换/失配、行号和 PDF 正常输入失败 | 不表示实际知识库已被覆盖或破坏 |
| 内存 DOM + 实际 service 探针 | 复现 UI 会话归属、刷新、响应校验和重定向 | 不表示已有管理员浏览器或生产域名被攻击 |
| 本机 HTTP/Uvicorn 模拟 | 复现 deadline 失效与异常日志绕过脱敏 | 不包含真实 Hub、真实 Agent 或外部模型调用 |
| 现有全量记录 | 上轮后端 136、Node 166、Workers 199，通过记录存在 | 本轮未重复全量构建与 Workers；不能替代当前发现所需的新回归用例 |
| 真实 DeepSeek / Codex / opencode / 公网 / MCP OAuth | 本轮未执行 | 不应写成“已证明端到端可用” |

本轮没有新增持久测试脚本；所有复现逻辑仅在内存命令或临时目录执行。修复时应把对应探针转成最小失败测试，再按 TDD 修改。

此前 22 个有答案标注题的检索命中结果只检查检索证据，不能验证问答缓存不会错返、知识写入不会覆盖、真实工具执行能恢复，也不能证明 8 条最终上下文或大模型最终回答正确。

## 7. 修复与验收建议

两个轴分别跟踪，不把“符合规则”与“完成规格”互相抵消：

- **Standards 轴**：处理跨源凭证转发、会话结果归属与竞态、真正刷新消息和最小响应契约，再完善 Runtime health。最坏的条件性安全问题为 STD-01。
- **Spec 轴**：先处理同名覆盖、缓存错答、自动降级及执行状态/期限闭环；再修引用、PDF、知识更新衔接与诊断依赖。明确的数据丢失问题为 SPEC-02，答案正确性问题为 SPEC-01。

修复后再做真实验收：本地 health/模型/索引 → 受控 Wiki 问答 → 各 Runtime 连续两轮与历史恢复 → 超时/断连检查 → Tunnel → 同版博客 → MCP OAuth。真实模型调用需单独记录输入、结果和验证范围，不能把替身结果当真实执行证明。

当前仍应保留这些边界：Codex 首版只读；网页没有写入审批；同步 Agent 有运行时长限制；Wiki 当前单轮；当前 Personal Wiki 页面数为零；博客需要与新版 API 配套部署。校园网是否为根因仍须在记录网络/TUN 状态的条件下做对照。

**统计：Standards 5 项（均 P2）；Spec 11 项（6 P1、5 P2）。本轮仅标记，全部处于待修复状态。**


## 8. 审查后的代码修复与验证

用户授权按上述发现修改代码后，当前工作区已经完成 16 项修复。前文的问题描述、源码行号和“待处理”统计保留为审查时证据，以下记录当前状态；没有提交或部署，也没有执行真实 Agent 推理任务。

| 编号 | 当前实现 | 持久回归位置 |
|---|---|---|
| STD-01 | fetch 使用 redirect=manual，30x 作为受控上游错误，不把 token 发到跳转目标 | 博客 personal-ai-hub.service.test.ts |
| STD-02 | 提交参数固定 Runtime/会话；创建与发送使用同步锁互斥（含同一事件周期的连续点击），运行中拒绝切换归属；切换/创建清理结果和错误，渲染同时核对结果归属 | 博客 agent-chat-page.test.ts |
| STD-03 | Refresh 除列表/状态外，显式重新获取当前会话消息 | 博客 agent-chat-page.test.ts |
| STD-04 | 会话公共响应校验非空字符串 id；缺失、空串、纯空白和数字均拒绝，移除空 ID 假成功 | 博客 personal-ai-hub.service.test.ts |
| STD-05 | status 在共享 4 秒预算内请求 global/health 和 session/status，healthy 必须为 true | 后端 test_opencode_runtime.py |
| SPEC-01 | 原始 UTF-8 问题 hash + key_version + 指纹 + 正反馈；不再用相似词复用/注入答案，旧格式跳过 | test_query_cache_and_tuning.py |
| SPEC-02 | 唯一 ID 文件名、独占创建；元数据、变更集、审计事务提交，事务失败只清理本次新文件 | test_url_and_personal_wiki.py |
| SPEC-03 | 完全移除自动 BM25 降级；失败显式报错并保留 active 指针 | test_gradio_app.py |
| SPEC-04 | 普通文档按真实正文重新分块；HTML/生成内容使用不可变文本快照；项目文件路径及 frontmatter 偏移准确 | test_local_ingest.py；新 generation 全量引用探针 |
| SPEC-05 | 个人知识确认后重建；失败显示 applied + indexes: pending 以及重建入口提示 | test_gradio_app.py |
| SPEC-06 | 无图片/绘图的空白页保留页号；无文本且有图像/绘图的页面显式要求本地 OCR | test_local_ingest.py |
| SPEC-07 | 已知异常按类型处理；ASGI 边界阻止原始异常值上抛；日志只记录类型/帧位置/请求 ID | test_fastapi_hub_api.py，严格 TestClient 验证异常不逃逸 |
| SPEC-08 | opencode 使用异步 HTTP 总期限取消；普通操作 8 秒；Codex 收发/队列/缓冲事件/返回检查期限，看门狗结束受管进程，清理预算不再额外等待 10 秒 | test_opencode_runtime.py、test_codex_runtime.py、test_fastapi_hub_api.py |
| SPEC-09 | 连接前超时为 failed；发送后读/写断连或协议异常为 unknown，新增安全错误 AGENT_EXECUTION_UNKNOWN；不自动重发 | test_fastapi_hub_api.py、博客 service 测试 |
| SPEC-10 | 首次 turn 提交前持久化 native_id/pending/baseline，确认后记录 turn ID；先读原生历史解除未知，缺记录/进行中时阻止再次提交 | test_codex_runtime.py，覆盖确认丢失、空历史、不可读、进行中、完成及旧数据库升级 |
| SPEC-11 | 状态只要求 Hub token；Codex 独立预检无 DeepSeek 依赖；opencode 明确要求 DEEPSEEK，Wiki LLM 按需校验 | test_hub_scripts.py |

修复中额外补齐三个关联缺陷，均先复现后实现：

- FIX-01：源文本、CSV/提取正文和引用快照纳入知识指纹；检索每次固定并校验 generation，长期 ChatService 不继续使用旧索引。原文变更后的已赞答案和过期索引均不能继续返回。
- FIX-02：PowerShell 诊断兼容无 Response 属性的网络异常，并对携带 token 的探针禁用重定向。
- FIX-03：真实 DeepSeek SDK + HTTP 替身同样复现慢速分块超过总预算；改用 AsyncOpenAI 及可取消总期限，逐次创建/关闭客户端，max_retries=0，不调用真实模型。

### 验证与实际数据

- 后端最终全量：174 项通过；博客 Node 全量：176 项通过；类型检查、修改文件 Biome 通过。
- Node 首轮一个未修改的 Markdown 导入用例首次加载超过默认 5 秒；单独复跑和后续完整 176 项均通过，未调整该功能或测试超时配置。
- Workers 默认 5 秒预算两轮均为 198/199，未修改的 OAuth 上传用例首次 SELF.fetch 超时；改用 20 秒 CLI 预算单独复测 5/5 通过，首请求为 6.903 秒且正确返回 401。未修改该业务或测试配置；按相同预算全量复跑 199/199 通过，生产构建通过。
- 使用已有本地权重重建并激活 v1_20cc470675154991b991fafd9e7de804：21 个摘要、1295 个 chunk、0 个 Wiki，共 1316 对象；内容校验及引用文件/行范围逐一校验通过，失配 0。旧 generation 与原始资料保留。
- 24 题离线检索复评已完成，22 条有答案题中 BM25 命中 22/22；hybrid 命中 21/22；hybrid + BGE 重排命中 22/22、MRR@20=0.932、nDCG@20=0.922。重排评估含一次约 24 秒的模型冷启动，P50=1.48 秒、P95=1.73 秒；这不是稳定服务压测，也未检查最终 LLM 答案。原始结果：[本轮结果](E:/wiki/data/evaluations/v1/results_20261023_090326.json)。
- 没有启动实际 Hub/opencode 服务，没有调用付费 DeepSeek/Codex 模型，没有更改 TUN/网络或发布博客。协议 schema 只从本机 Codex 导出到临时目录，用于核对必需字段与终态，不启动推理。

本轮最终验证命令：

```powershell
# E:\wiki
.\.venv\Scripts\python.exe -m pytest -q
# E:\blog
bun run test:node --maxWorkers=1 --minWorkers=1
bun run test --maxWorkers=1 --minWorkers=1 --testTimeout=20000 --silent
bun typecheck
bun run build
```

本机双 Runtime 用户级环境 -ValidateOnly 预检已通过，未启动任何服务。启动可使用：

```powershell
Set-Location E:\wiki
.\scripts\start_hub.ps1 -EnvSource User -WithOpencode -WithCodex -CodexWorkspace E:\blog
```

### 仍需用户手动验收的边界

先启动本地 Hub，核对本地/公网带 token 的 health、索引和受控查询，再部署同一版博客并验证管理员代理、两个 Runtime 连续两轮、超时后历史核验和 MCP OAuth。Codex 仍是 Hub 独立只读会话；缺少原生历史时明确保留 unknown，不承诺自动恢复所有既往丢失的 native ID。历史版本已经丢失的映射不能由此次数据库加字段凭空找回。

当前 Wiki 仍为单轮 RAG，网页写入审批、长任务、桌面历史同步、OCR 和 Harness 仍不在本版范围。同步请求截止不等于已证明所有本地子工具停止。缓存要求正反馈后才复用，博客当前没有新增反馈交互；需要使用现有本地反馈入口或 API 确认质量。

## 9. 用户启动后的检查（2026-10-23）

用户手动启动后，本地和公网 Tunnel 的带 token 健康检查、知识库状态、opencode 状态均为 HTTP 200，活动 generation ready。没有据此认定真实 Agent 任务、模型额度或博客管理员代理已经验收。

Codex 状态发现 HUB-27：CLI 覆盖键中带引号的工具名触发 invalid transport，本地子进程初始化退出。改为顶层 TOML 内联表禁用 MCP / 插件后，两项新增失败回归转绿，后端全量 176 项通过；独立 app-server 初始化、ChatGPT account/read 成功，未发送模型任务。用户已启动的 Hub 不会热加载本次修复，须重启后再验证。博客本轮由 main 推送触发自动部署，发布结果以 GitHub Actions 为准。

## 10. 2026-10-24 逐项复核与测试准备

### 结论

本报告列出的 **16 项代码修复和 FIX-01–03 三项关联修复均已实现**，本轮重新检查调用链并复跑现有测试通过。没有为了重新发布而改动已完成的业务代码。这里的完成指代码及隔离验证；管理员页面、真实模型任务和 MCP OAuth 的人工验收仍按下方清单保留，不计为已经通过。

| 原编号 | 本次核对结果 | 当前验证依据 |
| --- | --- | --- |
| STD-01 | 已完成；带 token 的代理拒绝重定向 | personal-ai-hub.service.test.ts |
| STD-02 | 已完成；V2 以会话独立状态、固定请求归属和卸载隔离取代旧页的共享 result，不把 A 的结果写进 B | hub-chat-shell.test.ts、agent-chat-page.test.ts |
| STD-03 | 已完成；旧 Refresh 表单已由 V2 GET 观察、终态读取消息及显式核验原任务取代，不重发执行 | hub-chat-shell.test.ts、test_turn_coordinator.py |
| STD-04 | 已完成；旧会话响应仍严格检查 id，新接口使用完整工作区/会话/turn 契约 | personal-ai-hub.service.test.ts、hub-chat.service.test.ts |
| STD-05 | 已完成；opencode 同时核验 global/health 与 session/status | test_opencode_runtime.py；本轮真实只读检查 ready |
| SPEC-01 | 已完成；V1 缓存只复用原始文本精确匹配、正反馈和真实证据；V2 多轮不使用单轮答案缓存 | test_query_cache_and_tuning.py、test_wiki_conversations.py |
| SPEC-02 | 已完成；唯一文件名与独占创建，事务失败只清理本次新文件 | test_url_and_personal_wiki.py |
| SPEC-03 | 已完成；Gradio 重建失败显式报错，不自动激活 BM25-only | test_gradio_app.py |
| SPEC-04 | 已完成；最终引用对应真实来源坐标及不可变快照 | test_local_ingest.py；上一轮 generation 全量引用核验记录保留 |
| SPEC-05 | 已完成；确认后重建，失败明确知识已保存/索引待更新 | test_gradio_app.py |
| SPEC-06 | 已完成；空白 PDF 页与扫描/图片页区分，保留页号 | test_local_ingest.py |
| SPEC-07 | 已完成；异常按类型处理，ASGI 边界及日志帧位置不输出原异常值 | test_fastapi_hub_api.py |
| SPEC-08 | 已完成；HTTP、RPC 事件与返回实施总期限，清理受管进程；V2 接受与观察分离 | test_opencode_runtime.py、test_codex_runtime.py、test_conversation_api.py |
| SPEC-09 | 已完成；发送后失联保持 unknown，重启/刷新不重放；未送达恢复也只显式重交同 UUID 原输入 | test_fastapi_hub_api.py、test_turn_coordinator.py、hub-chat-shell.test.ts |
| SPEC-10 | 已完成；提交前保存原生映射/意图，按原任务核验；Codex 显式支持 legacy/paginated 历史 | test_codex_runtime.py、test_native_messages.py、test_turn_coordinator.py |
| SPEC-11 | 已完成；诊断/Codex 独立于 DEEPSEEK，opencode 和 Wiki 问答各自按需检查 | test_hub_scripts.py；本轮两个 Runtime 的原生模型目录可读取 |
| FIX-01 | 已完成；内容指纹、固定 generation 与实际内容校验 | test_query_cache_and_tuning.py、test_vector_bm25_retrieval.py |
| FIX-02 | 已完成；诊断兼容无 Response 网络错误，带 token 探针拒绝跳转 | test_hub_scripts.py |
| FIX-03 | 已完成；DeepSeek 异步 SDK 受总期限约束，禁用自动重试 | test_deepseek_model.py |

V2 已增加 Wiki SQLite 多轮、工作区/聊天、图谱与资料阅读。因此第 8 节的“Wiki 仍为单轮”和“未提交/未部署”是当时的历史状态；当前产品范围以 [V2 计划](personal-ai-hub-v2-workspace-chat-plan.md) 为准。桌面历史同步、网页写入审批、OCR、Harness 仍不属于本版。

### 本轮验证与运行状态

- 后端现有全量：266 项通过，75.69 秒；博客 Node 全量：201 项通过，53.24 秒。本轮未改业务代码，Workers 沿用同版已通过的 199 项（CLI 20 秒），不把旧记录伪称本轮重跑。
- 后端保持现有实例：FastAPI 8000、opencode 4096 的监听 PID 与四条登记身份逐一匹配，均正常；没有执行重复启动、停止或安装系统服务。Codex 通过 Hub 按需创建 stdio 子进程，不另开公网端口。
- 本机及 Tunnel 的带 token /health 均返回 V2/online，/kb/status 均 ready。真实元数据为资料 21、摘要 21、片段 5237、资源 68、Wiki 页 0。
- 通过公网地址实际调用博客 service/Zod：Codex、opencode 显式只读检查均 ready；模型目录分别 7 个（本机配置 gpt-6.1-sol）、2 个（deepseek-flash）。资料图返回 42 节点、21 关系。没有创建原生聊天或消耗模型推理额度。
- 源码已推送的业务提交为 608d73f 与 2aca5ad，前次[部署已成功](https://github.com/ShuWisensing/flare-stack-blog/actions/runs/40083036705)。本轮审查记录推送后，对最新 main 再运行既有部署流程，最终结果在进行中文档补记。
- HUB-56 的历史退出原因仍未确认；本次同一批进程已跨上次会话继续运行，本轮未复现退出，不能把历史问题当作当前服务离线。

### 留给用户的真实功能验收

- [ ] 登录博客后，Wiki 新建聊天、连续追问两轮、无答案问题、刷新后读取历史。
- [ ] Agent Chat 分别选择 Codex/opencode，在正确工作区新建独立聊天、读一个普通项目文件并继续追问；Codex 首版仍为只读。
- [ ] 测试运行中刷新、超时后的原任务核验、聊天切换、改名/归档与引用打开。
- [ ] 查看资料图、资料正文及返回导航；实体/概念数据目前为 0，HUB-35 保留，不把资料结构图当作完整语义知识网络。
- [ ] 如使用博客 MCP，验收实际客户端 OAuth 授权和知识查询。协议隔离测试通过不能代替客户端登录验收。
