# Personal AI Hub V3：知识沉淀、图谱体验与原生会话同步实施计划

> 状态：2026-10-26，V3 主链路已实现并完成本机验证；原生已有会话只读同步、Pilot 适配和线上管理员端验收分别保留边界。本轮博客修改尚未推送/部署，下方以实际接口及执行清单为准。

**目标：** 修复知识图谱和 Agent Chat 的实际体验问题，让资料、网页及日常聊天中的知识能够带着证据进入本地 Wiki，并使网页能够发现、展示和续聊同一个本机 Codex 原生会话。

**架构：** E:\blog 保持管理员前端与服务端代理；E:\wiki 负责后台任务、聊天投影、知识候选、资料快照、索引与图谱。Codex/opencode 原生会话作为各自执行历史的权威来源，Hub SQLite 保存展示投影和知识沉淀状态；现有 Wiki Markdown/元数据继续作为已确认知识的权威来源。

**技术栈：** TanStack Start / React / TanStack Query / Cytoscape Worker；FastAPI / SQLite / 本地 Markdown；Codex app-server stdio / opencode API；本地 Qwen3-Embedding-4B NF4 / 2560 维、BGE reranker-v2-m3、BM25；DeepSeek 问答及候选整理继续读取本机 DEEPSEEK。

### 2026-10-26 执行修订：本地构建与模型

用户已授权开始修复、清理旧的派生知识库并以新模型重建，要求保留原始资料。清理先备份并记录 hash，聊天/原生 Agent 历史不属于清理对象。

硬件为 Ryzen 9 7940H、63.2GiB RAM、RTX 4060 Laptop 8GiB。候选升级为 Qwen3-Embedding-4B NF4 / 2560 维，固定修订 5cf2132abc99cad020ac570b19d031efec650f2b；已通过对照实测并启用，BGE 重排保持。4B 半精度权重约 8GB，选择显式 4-bit 避免与重排模型争抢 8GiB 显存；新增 bitsandbytes/accelerate 依赖，PyTorch 保持当前版本。权重放 D:\AIData\Models，服务只离线加载，不自动降级旧模型/CPU。[官方模型卡](https://huggingface.co/Qwen/Qwen3-Embedding-4B)、[量化平台支持](https://huggingface.co/docs/bitsandbytes/main/en/installation)。

导入、审核和发布采用可独立版本化的本地知识管理 SQLite，与现有严格的 Hub 聊天库隔离。复用 metadata.sqlite 的资料/Wiki/变更集，新增作业和证据数据库不修改现有聊天表；跨库步骤由作业状态和可恢复对账协调，减少首次上线的迁移范围。后续原生历史扩展也先保证旧聊天库可读，不能为了新能力重新初始化旧库。

## 1. 本轮复核结果

### 1.1 实施前现状（历史排查证据）

| 项目 | 本轮证据 | 结论 |
| --- | --- | --- |
| 知识网络为空 | metadata.sqlite：wiki_pages=0、change_sets=0 | 当前没有已确认的语义知识页；空态符合数据，知识生成入口缺失 |
| 资料有数据 | sources=21、summaries=21、chunks=5237、assets=68 | 资料入库和实体/概念整理是两个阶段 |
| 资料图布局 | 真实 42 节点/21 边调用现有 Worker，三次宽高约 394×1454、512×1570、414×1632 | 在横屏被挤成纵向长条，现有 fit 无法解决分量排布比例 |
| 节点颜色/说明 | 画布只为部分类型定义淡色样式，缺顶部图例 | 图例、完整类型映射、节点/边对比度需要补齐 |
| 知识库概览拒答 | 意图路由只有介绍/内容检索 | 目录问题错误地走了片段召回，不应降低专业问答门槛处理 |
| 手动添加资料 | 本地已有 IngestService，博客资料库只有浏览 | 需要接上传/文字/链接入口和后台任务 |
| 知识沉淀 | 有 PersonalWikiService 草稿/确认，无聊天候选与证据归档 | 需要复用现有能力补完整流程 |
| Codex 检查失败 | 原生 error 被统一改写为“Codex 协议请求失败” | 截图根因尚未取得；错误丢失已确认 |
| Codex 当前可读性 | 独立只读探测成功，账号为 ChatGPT，模型目录 8 个 | 单次成功；不代表稳定接通或真实任务已经通过 |
| 本地原生历史 | thread/list 首屏 100 条，仍有 nextCursor，覆盖 13 个 cwd | 本机原生目录明显超过 Hub 已登记聊天；包含子 Agent，不能据此说有 13 个待接入项目 |
| 当前 Hub 历史 | SQLite：Codex 1、opencode 2、Wiki 1 条聊天 | 不是原生历史全量；统计期间用户操作会改变数量 |
| 工具历史混列 | 前后端 list_conversations 只按 workspace/归档筛选 | 切换“新对话执行器”没有切换侧栏历史范围 |
| 知识页标题 | 内存生成“DeepSeek: API 使用”后实际 parse_wiki 失败 | frontmatter 字符串拼接需要改为严格序列化 |

原生探测没有提交 turn/start 或调用付费推理。账号读取约 13.39 秒、模型目录约 5.02 秒；共享 25 秒预算内继续读取历史超时，独立历史读取随后成功。此前日志也有 account_read / AGENT_RUNTIME_NOT_READY，但不能将其直接等同新截图请求。

只统计 D:\AIData\Codex\sessions 中的 rollout 文件，本轮得到 19 个；这不等于原生目录总量。后续以分页协议结果和每条记录的实际可读状态对账，不以文件数推断历史丢失。

### 1.2 原有范围与本轮新增范围

V2 明确只展示 Hub 创建或明确导入的聊天，图谱为只读投影，没有自动整理实体、网页导入或桌面全部历史同步。本轮用户新增了这些交付范围。需要修复的现有缺陷和需要新增的能力分别编号，详见 [已知问题](personal-ai-hub-known-issues.md)：

- 保留未关闭的 HUB-29、HUB-35。
- 现有缺陷：HUB-57 布局、HUB-58 图例/类型、HUB-59 概览路由、HUB-62 Runtime 列表隔离、HUB-66 YAML 序列化。
- 新能力：HUB-60 资料导入、HUB-61 知识沉淀、HUB-63 原生历史发现、HUB-64 双向增量对账。
- 新能力的上线依赖：HUB-65 索引/校准/知识发布状态一致性。

## 2. 用户操作目标与页面安排

### 2.1 保留两个入口，Agent Chat 承接主要工作

Personal AI Hub 保留“对话 / 知识图谱 / 资料库”，增加“待整理”入口及数量；顶部提供“添加资料”。Wiki 对话负责资料目录、知识查询和有证据的问答。

Agent Chat 的侧栏最上方提供 Codex / opencode 工具切换，再展示当前工具下的工作区及聊天。工作区仍对应真实项目目录。输入框保留原生模型选择与知识库开关，连接诊断、检索和工具过程收在可展开区域。

每轮已完成聊天旁提供“沉淀到 Wiki”；整段聊天的操作菜单可“整理本次对话”。开启某个工作区的自动收集后，新完成轮次可以进入待整理列表；是否自动调用 DeepSeek 整理另设明确开关和输入预算。

“知识库已启用”表示本轮可检索已有知识。“收集到待整理”表示保存聊天来源；两者分别显示状态，避免用户以为开了检索就会自动写入 Wiki。

### 2.2 资料入口

“添加资料”提供三个选项：上传文件、粘贴链接、粘贴文字。资料库顶部展示导入任务、索引状态及最近更新，原有资料列表继续可搜索/阅读。

每条资料提供“更新资料 / 重新解析 / 整理知识”菜单。更新文件或重新抓取 URL 后创建新的资料版本，保留旧 source_id、原文及历史引用；内容 hash 相同显示“内容未变化”。重新解析也通过任务执行，不能覆盖旧证据后仍沿用原 hash。资料列表与默认检索只使用当前有效版本，旧引用仍可按版本打开。

第一批仅开放已具备并验证过的本地解析能力：Markdown/TXT、CSV、可提取文本的 PDF、DOCX、PPTX。运行时能力列表决定能否提交；缺解析依赖或扫描件需要 OCR 时明确报错。图片、音视频、整站抓取和压缩项目导入不与首批网页入口一起开放。

初版产品上限为单文件 20MiB、单块 1MiB，最多两块并行上传。块通过已有管理员 Server Function 的 JSON 代理传递 base64，后端逐块校验 SHA256；全部块到齐后校验文件总 hash 再排解析任务。这是本版主动限制，需要在实际代理链路验收，不据此宣称 Cloudflare 平台最大配额。

文件正文与快照落在 E:\wiki；Cloudflare 只转发请求。重复提交同一 request_id 返回原任务；同一块索引、相同 hash 幂等，不同内容返回 409。解析不会占住一次长 HTTP 请求。

### 2.3 图谱顶部、布局与阅读

页面顺序为：标题及数量 → 类型图例 → 范围/搜索/筛选 → 自适应画布。图例是紧凑的彩色标识，包含名称、简短含义和当前数量；当前范围未出现的类型可在“全部类型说明”里查看。

| 类型 | 含义 | 计划主色 | 形状 |
| --- | --- | --- | --- |
| source | 原始资料或可核对的聊天快照 | #2563EB | 圆角矩形 |
| summary | 资料摘要 | #0891B2 | 小圆 |
| chunk | 已解析片段 | #64748B | 小矩形 |
| asset | 资料中的资源文字 | #D97706 | 菱形 |
| concept | 专业概念 | #7C3AED | 圆 |
| entity | 人、组织、设备等实体 | #059669 | 六边形 |
| method | 方法或可复用操作 | #EA580C | 圆角矩形 |
| project | 项目及结论 | #DB2777 | 方形 |
| preference | 用户确认的偏好 | #C026D3 | 菱形 |
| rule | 用户确认的长期规则 | #DC2626 | 八边形 |

这些是设计值，需浅深主题实测调整。图例和画布共用一个类型目录，不能在两处独立维护。类型依靠文字/形状/颜色一起表达。

布局继续使用现有 Worker。将画布实际宽高和标签预留尺寸传入布局，分别处理连通分量内部布局与分量在视口内的打包；横屏横向利用空间，竖屏重新适配。边仍来自真实外键、已确认来源和页面链接。

普通节点适当放大，关联边加深；选中节点保留完整标题，缩小时收起低优先级标签，悬浮/聚焦可以看全名。初次进入自动适配全图；用户平移后不因轮询强制居中。阅读返回恢复原坐标/缩放；画布大小显著变化时才提供明确的重新布局操作。

无知识页时同时显示真实数量与“添加资料 / 整理已有资料”的入口。加载中、无知识、筛选无结果、读取失败为独立状态，读取失败不能显示成空库。

### 2.4 知识库概览

增加显式“查看知识库概览”按钮，并识别“我的知识库有什么 / 包含哪些资料 / 大概有哪些内容”等有限意图。

概览直接读取登记资料标题、类型、数量、更新时间以及已确认知识页，返回资料链接和有边界的主题摘要；标明“基于登记目录”。不要求向量召回命中某个片段，不为列目录调用 DeepSeek。复杂内容总结仍走有来源的检索问答。

## 3. Codex 接入与同步的准确含义

### 3.1 第一优先级：取得真实错误原因

在 CodexTransport 的 RPC 边界保留 method、native error code、脱敏后的原因摘要、阶段耗时、CLI 版本、Home 标识、工作区和请求编号。凭据、账号标识和原始 stderr 正文不能原样进入页面。

登录、模型目录、历史读取分别计时和显示状态；模型目录不再因为 UI 只剩“本机配置”而呈现正常空列表。保持显式的 20 秒登录探测和独立的 20 秒模型目录预算，目录与登录状态分别可观察；超时不自动重提任务。

目录是否可读与账号是否已登录不是同一个状态。真实发送仍校验 ChatGPT 账号、工作目录、只读策略和原生返回，失败不切换 DeepSeek/opencode。

### 3.2 原生模型目录

从当前安装版本的 model/list 分页读取原生 model/displayName/isDefault/hidden，按实际目录展示。接入历史聊天后保留该线程已有模型信息；不把 DeepSeek 型号送给 Codex。

菜单必须区分：正在读取、已读取、空目录、读取失败、所选模型当前不可用。默认选项显示“使用本机 Codex 配置”；它是用户的明确选择，不能作为请求失败时的自动替代模型。

官方模型目录字段会随版本变化。以本机 CLI 0.159.2 的生成协议和真实返回为实现基线，升级后重新做契约验证。[Codex App Server 官方文档](https://learn.chatgpt.com/docs/app-server#models)

### 3.3 原生历史发现

同一个 Home 下通过 thread/list 分页发现历史；明确包含 CLI、VS Code、appServer、exec 等主会话来源，归档另查。子 Agent 折叠在父会话下，默认不占主聊天目录。

官方协议的 sourceKinds 留空只返回交互来源，archived 也只选择一个范围；这些默认条件不能当“全部历史”。当前成功首屏含大量子 Agent，更需要区分主线程与子线程。[原生历史分页和筛选](https://learn.chatgpt.com/docs/app-server#list-threads-with-pagination--filters)

按原生 cwd 规范化映射工作区。未登记项目显示为“尚未接入的项目”，本机登记后再绑定；空 cwd、相对 cwd、已删除目录、junction 逃逸和 Home 不一致都显式提示，不能推断为当前 blog 项目。

首次发现只读元数据；用户选择某条聊天接入后才读取所需历史和建立 Hub 投影。重复接入同一来源/原生 ID 必须回到同一条 Hub 聊天。

### 3.4 网页与本机的同一条会话

原生 thread_id/session_id 是执行身份；Hub conversation_id 是网页展示身份。每个绑定还必须包含 runtime、Home/数据根身份和工作区。

- 本机 → 网页：读取原生消息，按原生轮次/消息 ID 和内容 hash 幂等投影；读取下一页或刷新不会重复消息。
- 网页 → 本机：用户在已绑定线程发送问题时，恢复相同原生 ID 再开始一个新 turn；保留原生持久化。不能新建另一条原生线程后称为同步。
- 本机继续聊天 → 网页：本地观察器发现新轮次，更新投影；网页展示最近同步时间、是否落后及原生忙碌状态。
- Hub 改名、归档先作用于自己的目录，不自动重命名、删除或归档原生历史。

只通过官方读取/恢复接口操作原生历史，不能为让桌面侧栏出现而手工补写 Codex state SQLite 或 rollout。恢复同一原生 ID 的协议能力与桌面客户端是否自动刷新目录分别验收。[原生会话恢复与读取](https://learn.chatgpt.com/docs/app-server#threads)

本版“同步”限定为这台笔记本、已选择接入的本地来源。跨设备/云端会话、其它账号和其它 Home 不自动纳入。

### 3.5 并发与权限

同一原生会话可能同时被桌面与网页打开。Hub 的 Python 锁只能协调 Hub 内部，不能保证另一进程没有执行任务。

发送前核对原生 busy/最新轮次与已展示 revision；忙碌或版本改变时拒绝并刷新。若本机版本没有可验证的跨客户端互斥机制，先对该绑定启用只读同步，继续任务要求停止另一端并通过真实并发验收；不能仅凭一次“空闲”检查宣称无竞态。

既有 Codex 首版只读项目策略继续保留。接入旧线程不自动继承原来完全权限或可写 MCP；原生能力、provider 或权限不兼容时允许展示历史并说明不能续聊。审批式写电脑需要独立权限规格。

### 3.6 opencode 独立目录

工具切换成为路由、工作区聊天查询、归档查询、搜索、分页游标和 Query cache 的共同维度。

同一项目可以分别有 Codex 与 opencode 聊天，列表只展示当前工具。点击旧聊天验证其 runtime 与当前工具一致；不匹配时明确切换到该工具的目录，不修改聊天本身的执行器。

opencode 继续使用自己的原生项目目录、session ID、模型目录与消息 API。Wiki 可以被两种工具共同检索，聊天记录和任务状态保持独立。

## 4. 从资料和聊天生成有证据的 Wiki

### 4.1 三种状态必须分开

1. **来源资料已保存：** 原始文件、网页快照或选中聊天原文已安全保存，拥有稳定 source_id。
2. **候选知识待确认：** 整理出概念、实体、方法、项目结论、偏好或规则，附原文定位；尚不作为有效知识参与回答。
3. **知识已发布可检索：** 用户确认/合并后的 Wiki 页、来源关系、索引和相关性门控版本都已验证并发布。

候选模型失败不能使原始资料消失，也不能把“任务返回 202”显示成“已进入知识库”。

### 4.2 手动与自动收集

手动上传/粘贴先保存来源；资料库可选中已有资料点击“整理知识”。Agent 可手动勾选当前加载的最多 50 条消息收集；更早记录先继续读取；本地 Codex 接入后使用同一套收集接口。

自动收集按来源、工作区显式启用，仅处理新完成的轮次。默认先进入待整理，用户开启自动整理时才按所选 DeepSeek 模型和输入上限调用整理；每次抽取最多 60000 字符，超限显式拒绝并要求选择行范围，不静默截断或自动拆成多次付费调用；最多产生 20 条候选。聊天收集每次最多 50 条消息、200000 字符；原文保存本身不调用大模型。自动收集和付费自动提取分别开关，默认均关闭。

开启某个已登记工作区的自动收集后，该原生来源随后新建的主会话可自动建立只读采集绑定，并标记“本机发现”；不需要每个新聊天再手动导入。启用时间之前的历史批量整理另设明确操作，不在开关启用时自动回填。自动绑定本身不能启动/恢复 Agent 任务。

提炼范围为用户关心的专业知识、可复用代码经验、项目决策、显式偏好与规则。寒暄、报错日志全文、重复工具过程不直接变成知识页。模型产生的知识都要带来源，偏好推断和用户明确陈述需要不同标记。

自动整理输入只取选中范围的用户消息、最终回答及必要证据，排除系统/开发者指令、环境变量输出和工具日志全文。检测到凭据的输入阻断自动整理，提示用户清理后显式提交；不能因为已存在 Pilot 脱敏就假定文本可以整批送出。本地原生记录继续保留原状。

### 4.3 证据模型

每个候选至少包含一条可打开的证据：

~~~json
{
  "candidate_id": "candidate_example",
  "node_type": "preference",
  "title": "项目交流使用中文",
  "statement": "在该项目中优先使用中文解释代码。",
  "scope": {"kind": "project", "workspace_id": "workspace_example"},
  "assertion_kind": "user_explicit",
  "evidence": [{
    "evidence_id": "evidence_example",
    "source_id": "src_example",
    "source_kind": "codex_chat",
    "runtime": "codex",
    "native_session_id": "native_thread_example",
    "native_turn_id": "native_turn_example",
    "native_message_id": "native_message_example",
    "speaker": "user",
    "snapshot_sha256": "sha256:example",
    "start_line": 12,
    "end_line": 12,
    "excerpt": "这个项目请用中文解释代码",
    "external_url": null
  }]
}
~~~

上例为契约示意，ID 和 hash 不是生产记录。真实写入时 hash 必须为完整 SHA256，范围必须命中对应快照原文。

网页材料保留原始 URL、抓取时间和本地正文 hash；文件保留原文件 ID、hash、页码/章节/行号。聊天事实引用网页/项目文件时同时保留那些依据；单纯“助手说过”只能证明该助手的陈述，不能标成外部已验证事实。

证据正文先形成受保护的本地 Markdown 快照，再以 source_id 接入已有 sources/摘要/索引链路。额外表记录原生身份与精确段落映射。Wiki source_refs 继续引用登记资料 ID；原生聊天 ID 和外链通过证据详情解析，避免直接写进去后形成悬空来源边。

查看知识页可打开证据抽屉，显示原文、作者角色、时间、资料/聊天入口和外链。原生文件后来清理时，已批准知识仍可回查本地快照；显示原生记录是否仍可访问。

### 4.4 确认、合并与更新

复用 change_sets 与 wiki_pages。审核页支持确认新建、并入已有页、编辑、拒绝；关联页与别名也需可见，节点类型必须来自固定集合。

偏好区分 global/project 作用域；本版不把临时会话要求自动提升为长期偏好。显式陈述和推断分别保存，推断默认待审核。更新长期偏好时记录 supersedes 和原证据，不覆盖掉旧来源；检索仅注入当前有效且匹配作用域的偏好。

专业结论的更正保留修订历史及依据。确认不自动修改 AGENTS.md、系统提示或项目源文件。

前置修复 HUB-66：使用 YAML 序列化生成 frontmatter，再用实际解析器往返验证 title、source_refs、别名和节点类型，验证通过后才提交变更。

### 4.5 索引与相关性门控发布

V3 首版采用明确的更新窗口，先保证一致性；不同时引入复杂的在线多版本知识库。

1. 上传和聊天快照先进入待处理区域，候选数据不计入活动检索语料。
2. 确认发布时创建幂等 publication job，取得单实例知识发布锁；跨进程不能只靠 threading.Lock。
3. 进入 updating 后，新知识查询返回 KB_UPDATING；已有查询在发布修改前排空/终止，不能一半读取旧页一半读取新索引。
4. 保存已确认页面及来源关系，构建新 generation 的 BM25/向量索引，使用同一候选 generation 运行本地正负样本校准；校准阶段必须可读取尚未激活的候选目录。
5. 校验正文引用、知识图谱来源边、模型 revision、索引 checksum、generation 与 relevance 配置一致。再在仍持有发布锁时切换活动指针及门控，并最后把 job 标记 ready。
6. 进程启动时先检查未终态 publication job；若上次在切换中断，仍显示 updating/failed，经过对账后显式恢复。发布中断不能被新进程误报 ready。

构建/校准失败保留原文件、候选、旧 generation 和失败作业。允许用户显式恢复/重试该作业，不能自动沿用不匹配阈值、改 BM25 或换模型。失败后 Wiki 目录仍可浏览，但内容问答明确显示未就绪。

一批候选合并为一次 publication，避免每条偏好重算全库。新样本量不足时明确显示校准覆盖有限，保留已验证的正负样本并加入新增领域用例。

## 5. Pilot 参考方式

实际布局已经核实：

| 位置 | 职责 |
| --- | --- |
| E:\pilot\README.md | 本机安装及使用说明 |
| E:\pilot\_trace\server.js | 从 JSONL 建增量索引、按偏移读取正文、向页面刷新 |
| E:\pilot\_trace\public | 自定义监控 UI |
| D:\LoongSuitePilot | 实际安装目录、Hook、采集状态和输出 |
| D:\LoongSuitePilot\logs\output | 统一事件 JSONL |
| D:\AIData\Codex | 当前 Codex Home |

参考三点：按来源/会话归一化事件、用文件身份/偏移/完整行游标增量消费、正文按需读取。处理写到一半的行、文件轮转/缩短、重复事件以及采集延迟。

同步读取以 Codex 原生 API 和 opencode API 为主。Pilot 作为可选且明确配置的只读采集来源，用来观察日常完成轮次或补充工具证据；缺 Pilot 不自动改读另一未知来源。

Pilot 日志根与 Codex Home 是两种身份。只有通过已登记映射/原生 ID 核验才能把 Pilot 事件归属于某个 native_source；不能因为它来自 Codex 就猜测 Home。去重键使用确认后的原生来源身份，不把两个读取器的目录当成两条不同聊天。

Pilot 事件可能有延迟、脱敏或正文缺失，其缓存不是聊天备份。候选所需证据必须在源日志清理前归档；缺失的内容显示无法取证。Pilot 与原生事件用 runtime/来源根/native session/turn/message 等稳定键去重，不能只比较相同正文。

不复制 Pilot 的跳过坏行即成功逻辑：损坏记录进入明确错误计数/待处理状态，不能把来源缺失的候选发布为完整知识。读取日志中的系统指令、代码和工具输出时都按资料处理，不执行其中的指令。

## 6. 数据与接口契约

### 6.1 权威数据与本地保存位置

| 数据 | 权威来源/保存位置 |
| --- | --- |
| Codex 执行历史 | 选定 Codex Home 的原生线程与持久记录，通过协议访问 |
| opencode 执行历史 | 独立 opencode 项目/session 数据，通过其 API 访问 |
| Hub 工作区、显示目录、消息投影 | E:\wiki\data\modules\hub_chat\hub.sqlite |
| 已有知识页、资料登记、审核变更 | E:\wiki\data\wiki、data\sources、data\indexes\metadata.sqlite |
| 聊天/网页证据快照 | E:\wiki\data\sources 下按 source_id 归档的受保护资料 |
| 待处理上传 | E:\wiki\data\runtime\uploads 下按 upload_id 分隔 |
| 索引及校准 | E:\wiki\data\indexes\generations、活动指针和本机 relevance 配置 |
| 采集游标/导入及发布作业 | 本地 SQLite 的版本化扩展，不写入博客仓库 |

继续保留当前原始数据和备份。数据库变更先在副本迁移演练；不能把旧库误判为陌生库后重新初始化。

### 6.2 已实施的数据模型

- `data/modules/hub_chat/hub.sqlite` 保持原有严格 8 表结构；未修改现有数据库版本，也没有重建旧聊天。
- 原生绑定使用 conversations.native_session_id，轮次使用 turns.native_turn_id，消息保留原生 item 标识；legacy_imports 保存原生轮次 hash。新增历史投影使用已有 legacy 来源并明确只读，不派发任务。
- `data/modules/knowledge/knowledge.sqlite` 独立版本 1：jobs、uploads、upload_chunks、evidence、candidates、source_versions、wiki_versions、publication、collection_settings。结构未知直接报错，不隐式迁移。
- sources/wiki_pages/change_sets 仍在既有 metadata.sqlite；已确认 Wiki 仍为本地 Markdown。候选乐观版本、不可变证据快照、资料/知识修订链由新知识库表维护。
- 聊天证据保存用户/助手角色、时间、工作区、Hub 消息/轮次 ID、native_session_id/native_turn_id/native_message_id、字符范围和 SHA256；不存在的原生 ID 保存 null，不推测。
- 跨数据库步骤依靠幂等作业、发布状态和原文件校验恢复；没有宣称跨库原子事务。原生 state SQLite 和 rollout 文件不直接写入。

### 6.3 当前受保护 API

以下路径已按源码校正，替换初稿中的占位端点。博客全部经过 adminMiddleware，本地全部校验 X-Hub-Token。

| API | 当前契约 |
| --- | --- |
| GET /hub/conversations | workspace_id、runtime、cursor、归档条件；游标绑定筛选范围 |
| GET /hub/wiki/inventory | 资料/知识计数、类型与有界目录；概览不调用模型/检索 |
| GET /hub/knowledge/catalog | 资料、Wiki 页、最近作业与 publication 状态，不含作业原始 payload |
| GET /hub/ingest/capabilities | 本地格式、20MiB 文件限制、1MiB 块大小、不支持类型的原因 |
| POST /hub/uploads | 文件名/大小/SHA256/request_id，返回上传标识和已接收块 |
| POST /hub/uploads/{id}/chunks | index、data_base64、sha256；重复幂等，内容冲突明确拒绝 |
| POST /hub/uploads/{id}/complete | 可含 previous_source_id；校验完整文件后 202 返回任务状态 |
| POST /hub/ingest | kind=text/url、title、request_id、text/url；可含 previous_source_id 更新资料 |
| GET /hub/jobs/{id}、POST /hub/jobs/{id}/retry | 观察/显式恢复失败或中断任务；不回传原文 payload/input_hash，不自动重跑付费请求 |
| POST /hub/knowledge/collections | conversation_id、所选 message_ids、request_id；原文保存为 review_only，不直接进入问答 |
| POST /hub/knowledge/extractions | source_id、model、可选 relative_path/起止行、request_id；生成待审候选 |
| GET /hub/knowledge/candidates | status、cursor、limit（1–100）；稳定排序游标及 next_cursor |
| PATCH /hub/knowledge/candidates/{id} | version、标题/正文/作用域/merge_target_id 或拒绝；冲突 409 |
| POST /hub/knowledge/publications | request_id、候选 id/version 数组，202 返回发布作业；同批次同旧页修订冲突拒绝 |
| POST /hub/knowledge/rebuilds | request_id，可选 reparse_sources；后台构建和同代校准 |
| GET /hub/evidence/{id} | 证据原文范围、不可变快照校验、原始 URL、聊天来源身份 |
| GET /hub/native/codex | 已登记 workspace_id、cursor、archived、include_children；原生分页目录 |
| POST /hub/native/codex/bindings | workspace_id/native_id；有界只读导入原生正文，不创建/恢复/执行线程 |
| POST /hub/conversations/{id}/native-sync | 对同一原生 ID 增量投影；读取在途返回 NATIVE_SYNC_BUSY |
| GET/POST /hub/knowledge/collection-settings | workspace_id、乐观 version、enabled、auto_extract、DeepSeek 型号；默认关闭 |

更新资料与首次导入共用接口及 previous_source_id，未增加占位的 /sources/{id}/updates。原生只读导入和同步限时 20 秒，不使用一个虚构的后台 import job。模型目录与账号检查分别计时，目录失败不会显示成普通空列表。

### 6.4 错误和任务约束

保留 HubError reason/message/layer/request_id，增加受控 diagnostics；博客 Zod schema 与本地响应同步。所有 job 的 client request ID 做输入 hash 校验，重复相同请求只观察原任务。

diagnostics 采用固定字段 method、native_code、upstream_message，分段耗时保存在运行状态 timings；upstream_message 必须经过明确的长度/凭据/账号脱敏，无法安全展示时只公开 method/code，原始对象不能透传。

新增明确错误：NATIVE_SOURCE_MISMATCH、NATIVE_SESSION_BUSY、NATIVE_HISTORY_CHANGED、EVIDENCE_UNAVAILABLE、UPLOAD_CHUNK_CONFLICT、KNOWLEDGE_REVIEW_CONFLICT、KB_UPDATING。HTTP 409 表示状态/身份冲突，422 为非法输入，503 为能力或索引未就绪。

对账/日志观察允许重启后恢复只读消费；Agent 任务和不确定是否已发送的 DeepSeek 整理调用不能因此自动重放。LLM 结果丢失时保留 unknown，用户看清原任务后显式处理。

URL 仅允许公开 HTTP(S)，重定向每跳重新验证；资料访问通过登记 ID，上传路径由后端生成。前端不接触本地 API token，也不能借预览接口读取任意本机文件。

## 7. 执行清单与未完成边界（2026-10-26）

### 本轮续做规格：原生项目发现、登记与发布

- 目标：补齐未登记 Codex 项目的接入；继续已完成的知识主链路发布与真实验收。
- 输入输出：GET `/hub/native/codex/projects` 接受原生 cursor/archived，按原生 cwd 分组返回本页项目、样本 native_id、可访问状态及继续游标；POST 同路径接受 native_id、expected_cwd、项目名，再读原生元数据核对 cwd，返回已登记工作区。同目录重复接入不创建第二个工作区。
- 数据模型：原生历史仍只读；工作目录继续存本机 hub_workspaces.json，使用确定性 root_key 与原聊天库工作区。跨进程锁串行登记、原子替换配置，审计写本机；不接收任意文件路径作为执行目录。
- 边界与错误：目录失效/相对路径/原生 cwd 改变/错误游标/缺 token 显式报错。GET 不读取正文、不启动任务、不自动登记目录。原配置和其它工作区不覆盖，Junction 解析后的路径必须与发现时一致。
- 不做：不自动接管桌面进程，不修改 Codex state/rollout，不把仅属 Hub 的锁称为跨客户端互斥。已有原生会话保持只读；本机 CLI 0.159.2 的 turn/start 没有 expected revision 或跨进程排他参数，完整双端写入仍未满足验收。[官方 App Server 文档](https://learn.chatgpt.com/docs/app-server)只说明 resume/turn 等接口，未提供此并发保证。
- 验收：替身原生 RPC + 临时真实配置/SQLite 验证分页发现、无正文读取、重复登记、路径变化拒绝、配置并发保护与 API 鉴权；博客测试代理和项目选择。真实只读发现本机项目后，继续类型/测试/构建、博客源码推送和自动部署验证，不包含本地数据或凭据。

### A：Codex 诊断、模型与工具隔离

- [x] 原生 RPC method/code/受控消息脱敏，模型目录独立于 account/read；目录加载/失败/空状态区分。
- [x] SQL、分页、路由、缓存与归档按 runtime 隔离；切换工具不改变已有聊天归属。
- [x] Codex 8 个模型、opencode 2 个 DeepSeek 模型实际读取；两 Runtime 只读检查 ready。
- [x] 真实 Wiki/opencode 双轮任务已通过；Codex 新建 Hub 会话曾完成两轮只读文件校验，另一次因运行时超过 65 秒中断，保留间歇性超时边界并不扩大自动重试。

### B：图谱、目录与阅读

- [x] Worker 按视口对断开分量打包；顶部完整颜色/形状图例、统计和原位置恢复。
- [x] 概览直接读目录，专业内容继续执行相关性门控。
- [x] 真实 42/21 资料图宽屏布局、23/38 知识网络、节点预览/阅读/原文跳转；资料卡与上传窗口检查浅深主题和移动端。
- [x] Wiki/摘要页头折叠到资料信息，避免内部 YAML 进入正文；连续图谱只读访问复用内容 hash 校验缓存，约 35ms。
- [x] 2560 宽屏无横向溢出；390px 真触屏点击节点可打开阅读预览。300 节点/900 关系 synthetic 图谱布局 Worker 约 2289ms，拖动帧 P95 约 16.8ms，无页面溢出；该项是组件压力验收，不代表生产图谱一定有 300/900 数据。

### C：资料、候选与可靠发布

- [x] 安全 YAML、严格知识 SQLite、保留原 8 表聊天库；原始文件/聊天/历史引用快照不覆盖。
- [x] 文件/文字/公网网页入口、资料修订、异步任务、进度和显式重试；1MiB 块、20MiB 文件、SHA256、并发完成幂等。
- [x] 本地解析 MD/TXT/代码/CSV/HTML、文本 PDF、DOCX、PPTX、XLSX；扫描/OCR、图片、音视频和旧 Office 格式明确不支持。
- [x] 证据快照、角色/原生轮次身份、候选编辑/拒绝/确认/作用域/更新已有页，游标分页；过期资料和同时修订冲突预检。
- [x] 跨进程发布锁、查询隔离、候选 generation 构建/同代校准/最终 ready；失败保留作业，重启不自动重放。
- [x] 经校验备份后，重解析 20 份独立资料、保留项目原快照；21 资料、925 原始片段，14 篇逐条原文核对的专业知识页。
- [x] RTX 4060 8GiB 对照 0.6B / 4B，启用 Qwen3-Embedding-4B NF4/2560 维，BGE 重排保持；归档旧代和旧缓存。
- [ ] 线上登录管理员经博客代理上传、知识提取与问答的真实验收；未使用付费推理替代用户验收。

### D：原生历史接入与同步

- [x] 已登记工作区、原生多来源/分页/归档/子会话发现，严格匹配 cwd；只读绑定保留 native ID。
- [x] legacy/paginated 正文按 ID/hash 幂等投影；当前聊天每 5 秒观察，不重复执行任务。
- [x] 实际接入一条旧主会话：首次 1 轮，重复同步新增 0，原生 ID 一致。
- [ ] 已有原生聊天的网页续聊及跨客户端并发安全；当前界面明确只读。Hub 自建聊天继续使用原执行链路。
- [x] 全机未登记项目的发现/登记界面已实现；实测原生首屏 13 个项目，登记仍需用户显式选择，不自动接管。
- [ ] 桌面目录可见/刷新/本机继续/双端忙碌的完整人工验收。

### E：聊天知识沉淀和可选收集

- [x] Wiki/Agent 勾选聊天原文保存为 review_only，助手断言不会直接变成可靠事实；个人偏好必须由用户原话支持并确认。
- [x] DeepSeek 生成候选、原文引句校验、审核后发布；聊天原文/角色/时间/原生 ID 和外链可回查。
- [x] 日常 Codex 原生 API 观察器：显式按工作区启用，仅收新完成轮次，默认不调用模型；收集/付费自动提取分别开关。
- [x] 重复扫描幂等、分页续扫、停用检查；系统上下文/凭据拒收并显示原因，不阻塞其它普通轮次。
- [x] 开启真实收集后完成一条 Codex 只读任务，60 秒观察周期生成 1 个 completed collect 作业；自动提取关闭，遇到旧忙会话不阻塞其它任务。验收后生产开关已恢复关闭。
- [ ] Pilot 文件/Hook 适配器未实施；本轮仅借鉴其思路，不修改安装、Hook、数据。

### F：验证与发布

- [x] 后端全量 Pytest、博客 Node、Workers、类型、lint 和生产构建；确切结果以 completed 文档最后记录为准。
- [x] 备份 1024 个数据文件；来源目录 178 个文件中 65 个原文/项目文本快照逐个核对；旧代归档审计保留。
- [x] 本机 FastAPI/opencode 已启动，Cloudflare Windows 服务运行；本机与公网 Tunnel 健康、索引和数据一致。
- [x] AGENTS.md 用户已暂存/未暂存内容及无关文件保持原状；知识/聊天/模型/截图不提交博客。
- [ ] 本轮博客推送/自动部署及线上管理员端验收，仍待本次提交完成后执行；不包含本地数据和凭据。

## 8. 交付验收矩阵

| 场景 | 通过条件 |
| --- | --- |
| 知识图谱 | 上传/聊天确认后有真实知识页；概念、实体、方法、偏好等类型可识别，点击能读正文和证据 |
| 资料布局 | 真实 42/21 在横屏合理铺开，手机仍可用；图例、搜索、筛选、阅读返回正常 |
| 目录问题 | “我的知识库有什么”返回当前真实目录概况和链接；空库/坏库分别显示 |
| 手动导入 | 博客完成文件/URL/文字导入，后台任务有进度，索引发布后能查询；不支持格式明确说明 |
| Codex 连接与模型 | 可见具体失败阶段；模型来自当前账号/客户端原生目录，读取失败可明确重试 |
| 工具隔离 | 同项目两个工具的聊天、归档、模型、状态不混列；不能把另一工具 cursor 用到当前列表 |
| 原生历史接入 | 分页/来源/归档覆盖已选范围，保留原生身份与项目归属，不新建替代线程 |
| 双向同步 | 网页与本机连续各发一轮，同一原生 ID；网页读取能观察本机新消息，重复刷新不重放 |
| 并发/中断 | 原生忙碌/状态变化/unknown 明确处理，重启只恢复观察；未通过互斥验证的来源只读展示 |
| 知识沉淀 | 候选、确认、发布分开，事实/偏好都有证据和作用域；原生日志清理后快照仍可查 |
| 来源真实性 | 一条用户偏好、一条有网页/文件依据的专业知识可逐层回到原文；助手推断标识清楚 |
| 更新一致性 | 构建/校准任一失败都不能 ready，重启不会暴露半代索引；后续能显式恢复原 job |

## 9. 最小 RED 用例示例

以下保留初稿的 RED 示例作为设计依据；真实回归已写入现有测试文件并执行，以第 7 节和 completed 中的记录为准。

A1：不依赖网络，复现原生错误原因丢失；diagnostics 字段约定见 6.4。

~~~python
def test_codex_rpc_keeps_safe_native_diagnostics(tmp_path, monkeypatch):
    from personal_wiki_brain.agent.codex_runtime import CodexTransport
    from personal_wiki_brain.api.errors import HubError
    import pytest

    transport = CodexTransport(tmp_path)
    monkeypatch.setattr(transport, "_write", lambda payload: None)
    monkeypatch.setattr(transport, "_next", lambda: {
        "id": 1,
        "error": {"code": -32602, "message": "invalid account parameters"},
    })
    with pytest.raises(HubError) as caught:
        transport.request("account/read", {"refreshToken": False})
    assert caught.value.diagnostics["method"] == "account/read"
    assert caught.value.diagnostics["native_code"] == -32602
~~~

A2：Store 使用新增 runtime 关键字筛选；未传参数的旧全量语义也有断言。

~~~python
def test_runtime_list_is_filtered_before_pagination(tmp_path):
    from personal_wiki_brain.conversations.store import ConversationStore

    store = ConversationStore(tmp_path / "hub.sqlite")
    workspace = store.create_workspace("blog", str(tmp_path), "blog", "agent")
    codex_id = store.create_conversation(workspace, "codex", "同名聊天", None)
    opencode_id = store.create_conversation(workspace, "opencode", "同名聊天", None)
    page = store.list_conversations(workspace, runtime="codex")
    assert [row["id"] for row in page["items"]] == [codex_id]
    all_ids = {row["id"] for row in store.list_conversations(workspace)["items"]}
    assert all_ids == {codex_id, opencode_id}
~~~

C1：直接使用真实渲染器与解析器，覆盖常见标题。

~~~python
def test_personal_page_title_roundtrips_as_yaml():
    from personal_wiki_brain.personal.service import PersonalWikiService
    from personal_wiki_brain.knowledge_graph.wiki_links import parse_wiki

    title = "DeepSeek: API 使用"
    text = PersonalWikiService._render_page(
        wiki_page_id="wiki_concept_test", node_type="concept", title=title,
        text="需要保留的原文。", source_refs=["source:src_test"],
        confidence=None, created_at="2026-10-26T00:00:00+08:00",
    )
    metadata, _ = parse_wiki(text)
    assert metadata["title"] == title
    assert metadata["source_refs"] == ["source:src_test"]
~~~

## 10. 本版范围与实现判断

实施优先级为 A（Codex/隔离）→B（图谱/概览）→C（可靠资料和知识发布）→D（原生历史同步）→E（知识沉淀与自动收集）→F（真实验收）。

DeepSeek Harness 继续作为交互参考。当前 Codex 只读执行策略、两工具可选、本地检索模型以及管理员代理边界继续保留。

只有通过真实原生客户端验收，才能把“可读历史 / 可在同一线程续聊 / 桌面列表可见 / 自动刷新 / 并发安全”分别标记完成。若原生协议不提供某项能力，文档和界面明确保留限制，不能靠伪造文件或静默创建新会话来交付。

本轮主链路已实现；第 7 节未勾选的原生双端续聊、Pilot 和真实管理员验收继续保留，不标为完成。
