# Personal AI Hub 已完成

本文记录已经实现、已经形成明确规格，或已经通过源码核验的部分。后续排查时先区分“已接入但可能有 bug”和“尚未实现”。

## 2026-10-24 V2 阶段 2–4 代码与阶段 5 切换

- 原生适配：Codex legacy/paginated 分页与 experimentalApi 握手；Codex/opencode 每次核对工作区目录。普通消息与工具摘要分离，Hub 只索引自己创建或明确导入的原生会话。
- 会话执行：先事务接受返回 202、后台执行、原生提交意图持久化、同 ID 唯一调度；刷新只读取，响应丢失可按原请求 ID 找回，unknown 必须显式核验原任务，重启不重放。全局最多 8 个未终态请求。
- 断网恢复补充 HUB-55：原请求查找明确 404、页面仍有完整输入时，可显式重交同一 UUID/问题/设置，由服务端幂等去重；核对超时不开放此按钮，刷新后仅有 UUID 不拼凑请求。相关 RED/GREEN 通过，Node 全量增为 201 项。
- Wiki 多轮：同会话最近 3 轮/24KiB，必要改写最多 10 秒并共用 40 秒期限，不读写单轮答案缓存；寒暄不召回，无证据明确拒答，纯检索模式不调用改写或问答模型。
- 本地相关性校准：32 条标注题（22 正/10 负），六种检索/重排组合分别绑定 generation。默认 hybrid:local 为正 22/22、负 0/10；模型、向量和重排仍在本机，小样本不能代表所有查询。
- 图谱接口：只读真实外键、显式 Wiki 链接和已登记 Markdown，提供范围、来源、局部图、revision、有界图、全范围搜索、分页正文及入出链。当前真实资料图 42 节点/21 关系；语义页为 0，未创建 graph.sqlite 或生成实体关系。
- 新界面：两个原 URL 共用工作区/聊天布局，支持改名、归档恢复、Markdown/代码复制、输入框、只读原生模型目录；引用、活动与诊断默认折叠。Wiki 含对话/知识图谱/资料库及阅读页，博客其它后台保持原布局。
- 视觉验证：1440×900 / 390×844、浅/深主题、真实 Canvas/Worker、节点预览/阅读/后退。手机底部预览不覆盖画布，修复后 9/9 隔离样例节点可见。截图位于本地 output/playwright，样例未写生产库。
- 自动验证：后端 266 项（79.22 秒）、博客 Node 201 项、Workers 199 项（CLI --testTimeout=20000）、类型、lint、生产构建通过。Workers 的 EBUSY 清理警告退出码为 0；默认 5 秒环境限制仍保留。
- 阶段 5 真实迁移：先停登记 Hub 并确认 8000/4096 释放，再备份、二次演练并导入新 hub.sqlite。导入 1 工作区/1 聊天/2 消息，未归属 0，重复导入不增加、旧来源校验和不变。审计/备份位于 E:\wiki\data\runtime\hub-v2-migration-20261024-092045-19e0738d；生产审计为 data/modules/hub_chat/migration-v2.json。
- 新后端已按原双 Runtime 参数启动并预热。本机与公网 Tunnel 均返回 chat_api_version=2；博客实际 service/Zod 经两地址读取的工作区、2 消息、8 引用、运行状态、详情、21 资料、42 图节点及正文均通过契约校验。
- 真实只读探测：新版工作区 Codex/opencode 均返回 ready；原生目录分别读取 7 个 Codex 模型（配置 gpt-6.1-sol）、2 个 opencode 模型（deepseek-flash）。公网匿名读取聊天/图谱为 401，旧 Agent 创建接口为 409/HUB_UPGRADE_REQUIRED。未创建原生聊天或提交任务。
- 图谱性能最终复核：Windows Chrome 155、1440×900、前台焦点，300 节点/900 边 Worker 约 2.087 秒，平移约 55fps、缩放约 60fps，P95 帧间隔 17ms（各 2.5 秒采样）。早先焦点状态下 1fps 的记录不能当作真实性能结论；本机自动化场景通过，真实触屏仍待用户验收。
- 博客 608d73f 已推送 main 并[自动部署成功](https://github.com/ShuWisensing/flare-stack-blog/actions/runs/40082059888)；线上首页实测 HTTP 200，两个 Hub URL 规范化后匿名都转 /login。
- 未发起真实付费模型任务。Wiki 两轮答案、Codex/opencode 项目任务及管理员端验收仍保留，真实实体/概念数据门槛未通过。代码完成与这些人工验收分开记录，旧版历史说明以下保留。

> 2026-10-23 二次审查后的修复：审查发现的 16 项问题已修改代码并补充隔离回归，修复状态见[审查报告第 8 节](personal-ai-hub-v1-code-review-2026-10-23.md#8-审查后的代码修复与验证)。自动测试覆盖不代表真实 Agent、公网与已部署博客已经验收。

## 2026-10-23 V2 第一批已实现代码（真实接入验收未完成）

- Codex 状态读取为快照；显式检查以 202 返回 check_id，后台最多检查 20 秒，同工作区/Home 合并，ready 60 秒过期。页面只读刷新过期状态，不能自动发起新探测或模型任务。
- 原生连接检查返回初始化、account/read、清理耗时；超时与任务执行未知分开。一次真实只读检查 ready，初始化约 0.328 秒、account/read 约 3.625 秒；没有创建模型对话，不能据此认定 Codex 双轮任务验收通过。
- 博客提供检查按钮与本机配置显示；原生模型目录尚未接入。JSON Content-Type 大小写/+json 解析、非 JSON 504 和错误透传已补回归及安全诊断。
- 本地 SQLite 8 表、原子接受/完成、引用快照、分页、并发请求去重、busy/unknown 阻塞与重启持久化已实现。工作区/空会话创建、读取、改名、归档/恢复 API 已受 token 保护；不启动 Runtime 或模型。
- 目录按本机 E:\wiki\config\hub_workspaces.json 登记；只接受 root_key，Windows Junction、大小写规范化及绑定变化拒绝已有真实临时目录测试。陌生数据库拒绝前不切 WAL；重复完成的引用不能改写旧结果。
- 旧记录只读清点已实现：合并 Hub 两份日志、标记冲突和缺失信息、保留 Codex pending 字段，空/相对目录不猜当前项目。真实清点原文件校验和不变，生产聊天库未创建。
- Codex 原生响应的 cwd 必须是非空绝对目录并匹配配置；缺失、空值、相对值不会默取当前进程目录，提交 turn 前即明确拒绝。
- 最终验证：后端 235 项、博客 Node 186 项、类型检查、lint、生产构建通过；Workers 本批回归基线为 199 项（CLI 20 秒，临时目录清理警告退出码 0）。没有调用付费模型任务。
- 这些完成项是代码/隔离测试范围；真实任务尚未写入新会话库，副本导入、Native 工作区执行、Wiki 多轮、全新聊天 UI 和知识图谱尚未交付。完整当前状态见[进行中](personal-ai-hub-in-progress.md)。

## 2026-10-23 用户截图验收与 V2 规划边界（历史）

- 用户截图确认线上 Wiki 已返回 DeepSeek 回答，opencode 已读取本机型号信息；这是用户实际操作证据，本轮规划没有再次调用真实模型。
- Codex 页面仍出现 504，且同请求日志定位到 account/read 超时；不能把此前单次 ready 视为接入完成，后续按 HUB-29 / HUB-30 修复与验收。
- 当时已形成 [V2 工作区、聊天与知识图谱计划](personal-ai-hub-v2-workspace-chat-plan.md)；随后开始实施，当前完成范围以上节为准，Wiki 多轮、新聊天界面和图谱界面仍未实现。
- 已只读核验图谱前提：现有 metadata.sqlite 有资料/摘要/片段/资源记录，但 wiki_pages=0、graph.sqlite 不存在。已完成图谱视觉、点击阅读、只读 API 和验收规划，HUB-35 继续记录真实语义数据与实现缺口；没有创建节点、关系或迁移数据。

## V1 代码与启停验证记录

- 2026-10-23 博客业务提交 2e7238f 已[自动部署成功](https://github.com/ShuWisensing/flare-stack-blog/actions/runs/39893276364)，首页 HTTP 200。
- HUB-28 已修复 Windows PowerShell 5.1 / 7 的进程数组、日期和中文脚本编码问题；停止前完整验证记录，保留 PID 创建时间与可执行文件核验，停止成功清空注册表。测试副本保留生产字节；脚本 27 项、后端全量 192 项通过。
- 旧坏进程记录已备份；按当前监听 PID 及父链核验后恢复，实际在 5.1 下停止并确认端口释放，再以原参数启动和预热。新表四条记录均为扁平身份对象。
- HUB-27 的工具禁用参数修复已加载，本地与公网健康检查、知识库状态、opencode 状态均 HTTP 200；真实 Codex 状态 API 复测为 HTTP 200 / ready，目录 E:\blog、只读、ChatGPT 登录。登录状态仍多次超时，另记 HUB-29，不计为稳定通过；未调用真实模型或执行任务。

## 2026-10-23 审查修复

- 博客拒绝代理重定向，校验会话非空字符串 ID；会话创建与发送互斥，切换/创建清除旧结果，结果按提交时 Runtime 与会话归属，Refresh 同时刷新当前消息。
- Wiki 仅复用当前格式、获得正反馈的精确问题缓存，保留原始大小写、词序和缩进；相似词不再触发旧答案复用或历史答案注入。旧缓存保留但不复用。
- Personal Wiki 使用完整唯一 ID 文件名和独占创建；页面元数据、变更集、审计写入同一 SQLite 事务。普通写入失败只清理本次未提交文件；同名页面不覆盖。确认后重建索引，失败明确显示已保存/索引待更新，不切换检索模式。
- 普通文档从实际文本重新分块；HTML 和项目生成内容保留不可变引用快照，代码引用指向保存的项目文件，摘要/个人页保留 frontmatter 行偏移。图片不伪造文本行号，PDF 空白页与扫描图片页分开处理。
- opencode 状态同时验证健康和会话状态；HTTP 改为可取消的异步传输并在同步接口内执行总预算，状态 4 秒、会话操作 8 秒，发送沿用剩余任务期限。Codex 检查事件、发送和返回期限，受管子进程有截止看门狗及短清理预算；超时不声称已取消工具。
- 发送前连接失败记录 failed；发送后断连、确认丢失记录 unknown。新增安全错误 AGENT_EXECUTION_UNKNOWN，博客保留原因并提示先核验，执行请求不自动重发。
- Codex 首条 turn 提交前保存 native_id、pending 标识、原历史 ID 和确认后的 turn ID；读取原生历史核验完成状态，历史为空/不可读/仍执行时保留未知并阻止重发。SQLite 只添加字段，既有映射有升级回归覆盖。
- API 使用按类型的错误处理与 ASGI 脱敏边界；日志保留 request ID、异常类型和帧位置，不记录异常值、源码行及局部变量。状态诊断不要求 DeepSeek key，Codex 独立启动不绑定它；opencode 仍显式要求 DEEPSEEK。
- DeepSeek 同样改为异步 SDK 与总期限取消，逐次创建/关闭客户端，保持仅使用系统 DEEPSEEK 和禁用自动重试；慢速分块响应回归通过。
- 补充修复：源文本与引用快照纳入知识指纹，每次检索固定并校验 generation；诊断脚本可处理无 Response 属性的网络错误，且拒绝带 token 的重定向。
- 新活动 generation：`v1_20cc470675154991b991fafd9e7de804`，21 个摘要、1295 个 chunk、0 个 Wiki，共 1316 个对象；内容校验和逐对象引用校验通过，行范围失配为 0。保留原始资料和旧 generation。
- 本轮验证：后端全量 174 项、博客 Node 全量 176 项、类型检查和修改文件 Biome 通过。Workers 使用 --testTimeout=20000 全量 199/199 通过；默认 5 秒超时记录在 known issues。生产构建通过。没有启动实际 Hub/Runtime 服务，没有调用付费模型或部署博客。

## 2026-10-23 V1 代码实现

- 博客代理改为 Result，区分鉴权、参数、网络、上游响应、索引、模型和 Runtime 错误；带 request ID，前端及 MCP 不接收原始敏感错误。所有 Hub Server Function 保留管理员中间件。
- Wiki 页面支持 DeepSeek 问答 / 检索摘录、最新模型、本地检索及重排，展示引用路径和行范围；新请求清除旧结果。
- Agent 页面支持 opencode / Codex，切换时清除旧会话；正文与可折叠诊断分开，执行请求不自动重试。
- opencode 使用正确的 model 对象并检查响应错误。Codex 通过 stdio 创建 Hub 独立会话，首次发送才创建原生 thread；限定 ChatGPT 登录和只读任务，核对实际权限、目录与模型。
- Codex Home 为 `D:\AIData\Codex`；映射和运行记录在 `E:\wiki\data`，原生历史由 Codex 管理。子进程不继承 Hub/DeepSeek key，不继承可写 MCP/插件工具。
- Wiki / Gradio 的生产工厂使用本地 Qwen3 embedding、BGE reranker 和本地数字 PDF 解析；扫描 PDF 无 OCR 时明确拒绝。DeepSeek 使用系统 `DEEPSEEK`，模型为 `deepseek-flash` / `deepseek-v4-pro`。
- 缓存隔离配置、用途、模型修订、编码角色、精确文本与知识版本；Agent 每次重新取知识。开始、完成、失败及结果未知均有运行记录，运行失败后保留已召回证据。
- 修正文档正文提取、代码空白、长块分片与引用行号；实现全局候选、RRF、父块相邻证据展开和去重。generation 包含内容校验与模式清单，原始资料和旧索引保留。
- 启停脚本固定 `.venv`、显式环境来源、`-ValidateOnly` 和本项目 PID 身份核验；实际监听子进程须验证父子关系。User 环境的双 Runtime 预检通过，未启动服务。
- 本地 GPU、1024 维归一化向量与 BGE 重排已实测；已启用完整向量 generation，BM25 / vector / hybrid 校验通过。最终人工小样本检索命中 22/22，MRR@20=0.932；原始结果与限制见 V1 计划第 10 节。
- 隔离验证：后端 136 个、博客 Node 166 个、Workers 集成 199 个测试通过；Workers 最终独立重跑退出码为 0。博客类型检查、Biome 与生产构建通过。

以下较早记录为历史基线，不能覆盖本节实现状态。

## 架构与边界

- 顶层系统名确定为 Personal AI Hub。
- LLM Wiki 是 Personal AI Hub 的第一个核心模块，负责本地知识库管理、检索、RAG 问答、缓存和反馈。
- Agent Chat 是 Personal AI Hub 的第二个核心模块，负责先查本地知识库，再把召回内容注入 opencode runtime。
- 博客仓库路径确定为 `E:\blog`，负责前端入口、管理员代理、MCP 工具和 Cloudflare 部署。
- 本地后端路径确定为 `E:\wiki`，负责 FastAPI、知识库、索引、缓存、Agent Chat 会话和 opencode runtime。
- 设计边界明确：博客是入口、认证、代理、MCP 和展示，本地 PC 是知识库与 agent 执行环境。
- `E:\wiki` 的知识库数据、原始文件、索引、缓存、日志和运行记录不进入博客仓库。

## 当前主链路

当前采用 Cloudflare Tunnel 链路：

```text
管理员浏览器
-> libresensing.com 管理员后台
-> TanStack Server Function + adminMiddleware
-> PERSONAL_AI_HUB_API_URL
-> hub-api.libresensing.com
-> Cloudflare Tunnel
-> 本机 http://127.0.0.1:8000
-> E:\wiki FastAPI
```

已形成的安全约束：

- 浏览器不直接携带本地 API token 请求 `hub-api.libresensing.com`。
- 博客 server function 必须先通过 `adminMiddleware`。
- 博客代理向本地 Hub 注入 `X-Hub-Token`。
- 本地 FastAPI 使用 `LOCAL_HUB_API_TOKEN` 校验 `X-Hub-Token`。
- `/health`、知识库接口和 Agent Chat 接口都要求 token。

## 博客端

已按源码确认：

- 管理员后台侧边栏已有 `Personal AI Hub` 入口。
- 管理员后台侧边栏已有 `Agent Chat` 入口。
- Personal AI Hub 页面位于 `src\routes\admin\personal-ai-hub\index.tsx`。
- Agent Chat 页面位于 `src\routes\admin\personal-ai-hub\agent-chat.tsx`。
- 服务层位于 `src\features\personal-ai-hub\service\personal-ai-hub.service.ts`。
- schema 位于 `src\features\personal-ai-hub\schema\personal-ai-hub.schema.ts`。
- 管理员 server function 位于 `src\features\personal-ai-hub\api\personal-ai-hub.admin.api.ts`。
- Personal AI Hub 页面已能调用状态查询和知识库查询。
- Agent Chat 页面已能列出/创建 opencode 会话、选择 DeepSeek 业务模型、发送问题和展示返回结果。
- 博客环境变量已预留 `PERSONAL_AI_HUB_API_URL` 和 `PERSONAL_AI_HUB_API_TOKEN`。

## 博客代理接口

博客服务层已调用以下本地 Hub API：

```text
GET  /kb/status
GET  /kb/sources
POST /kb/query
GET  /agent/status
GET  /agent/sessions
POST /agent/sessions
GET  /agent/sessions/{session_id}/messages
POST /agent/chat
```

请求发送时已注入：

```text
Content-Type: application/json
X-Hub-Token: PERSONAL_AI_HUB_API_TOKEN
```

## MCP

已按源码确认：

- 已新增 Personal AI Hub MCP 工具目录：`src\features\mcp\features\personal-ai-hub`。
- 已注册 `wiki_query`。
- 已注册 `wiki_status`。
- 已注册 `wiki_sources_list`。
- 这些工具使用 `personal-ai-hub:read` OAuth scope，初版保持只读。
- MCP 工具通过博客 Hub 服务层调用本地 Hub，不直接接触本地 token 以外的知识库数据。

## 本地后端

已按源码确认：

- `E:\wiki` 已有 FastAPI 应用入口：`personal_wiki_brain\api\server.py`。
- 已实现 `/health`、`/kb/status`、`/kb/sources`、`/kb/query`、`/kb/feedback`。
- 已实现 `/agent/opencode/health`、`/agent/status`、`/agent/sessions`、`/agent/sessions/{session_id}/messages`、`/agent/chat`。
- 本地 API 使用 `LOCAL_HUB_API_TOKEN`，通过 `X-Hub-Token` 校验内部访问。
- 知识库查询由 `personal_wiki_brain\chat\service.py` 的 `ChatService` 处理。
- `scripts\start_hub.ps1`、`scripts\stop_hub.ps1`、`scripts\status_hub.ps1` 已存在。

## Agent Chat 与 opencode

已按源码确认：

- Agent Chat 已按“先查知识库，再注入 agent 上下文”的方向实现第一版。
- `/agent/chat` 会先调用 `ChatService` 检索，再调用 opencode client。
- opencode runtime 适配位于 `personal_wiki_brain\agent\opencode_runtime.py`。
- opencode 定位为 Agent Runtime，不 fork、不深改核心。
- 支持 `deepseek-v4-flash` 和 `deepseek-v4-pro` 业务模型名。
- 本地 runtime 会把业务模型名映射为 `deepseek-direct/deepseek-v4-flash` 或 `deepseek-direct/deepseek-v4-pro`。
- `E:\wiki\opencode.json` 使用 `{env:DEEPSEEK}` 读取本机 DeepSeek API key。
- Agent Chat 运行记录由 `personal_wiki_brain\agent\chat_store.py` 写入 `data\modules\agent_chat\conversations.jsonl` 和 `data\runtime\opencode\runs.jsonl`。

## 测试与核验

历史代码接入阶段核验（不能视为当前环境全量通过）：

- `E:\wiki` 全量 Pytest 通过：81 个测试通过。
- `E:\blog` Node 测试通过：137 个测试通过。
- `E:\blog` Personal AI Hub 相关 Node 测试通过：9 个测试通过。
- `E:\blog` TypeScript typecheck 通过。
- 本机已安装 opencode 1.14.19，并确认 `opencode serve` 命令存在。
- 已确认 opencode server 的 `/global/health`、`/session/status`、`/session` 路径存在。

2026-10-22 已完成一次独立审查，结果见 [V1 改进计划](personal-ai-hub-v1-improvement-plan.md)。本轮相关博客测试 10 个、后端测试 30 个通过；后端全量测试被 NumPy/Pandas ABI 导入错误阻断。已发现 opencode 消息 model 请求与 1.14.19 契约不符，以及缓存、就绪检查等问题；这些发现尚未修复，不能因本文件记录“已接入”就认定真实调用已验收。

## 2026-10-22 补充审查与规格已完成（尚未实现）

- 已按用户确认更新 V1：Codex 与 opencode 并存可选，只创建 Hub 独立会话；DeepSeek Harness 暂停。
- 已只读核验 Codex CLI、两套 Home 的登录模式和账号一致性，明确登录账号额度与原生/Hub 历史的保存边界；未启动新的模型任务。
- 已核对当前 DashScope 向量、云重排、Qwen 问答和 MinerU 云解析调用路径，形成全部改成本地检索/解析的迁移规格。
- 已统计知识库分块质量并确认 embedding 缓存键碰撞，问题总表扩展到 HUB-22；这些问题尚未修复。
- 已结合本机 RTX 4060 Laptop 8GB 确定待验证的本地模型组合；未下载权重、安装依赖或重建索引。
- 已通过账号的只读 `GET /models` 核对 DeepSeek 当前支持 `deepseek-flash`、`deepseek-v4-pro`；规划只使用系统 `DEEPSEEK`，业务代码尚未更新。

## 当前确认的限制

- Cloudflare Tunnel 依赖本地 PC、`cloudflared` 和网络环境，不能完全靠 GitHub 自动部署解决。
- 校园网限制 Cloudflare Tunnel 时，需要换网络、代理/TUN 或其它内网穿透方案验证。
- MCP 初版只开放查询类能力，不开放写入、删除、合并。
- Agent Chat UI 当前偏调试形态，正式体验仍需优化。
- 危险操作必须人工确认并写审计记录。
