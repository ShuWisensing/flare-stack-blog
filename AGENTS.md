# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A full-stack blog CMS running on **Cloudflare Workers**. Built with TanStack Start (React 19 SSR meta-framework), Hono (API gateway), Drizzle ORM (D1 SQLite), and Better Auth (GitHub OAuth).

## Personal AI Hub 项目规则

### 项目边界

- 博客仓库路径固定为 `E:\blog`，GitHub 仓库为 `ShuWisensing/flare-stack-blog`。
- 本地 Personal AI Hub 后端、LLM Wiki 知识库、索引、缓存、Agent Chat 会话、opencode 运行记录固定在 `E:\wiki`。
- 已按源码确认：`E:\blog` 负责博客页面、管理员后台入口、Personal AI Hub 前端、TanStack Server Function 管理员代理、MCP 工具和 Cloudflare 部署。相关入口包括 `src\routes\admin\personal-ai-hub`、`src\features\personal-ai-hub`、`src\features\mcp\features\personal-ai-hub`。
- 已按源码确认：`E:\wiki` 负责 FastAPI、本地知识库、Gradio 调试界面、检索与 RAG、Agent Chat 编排、opencode runtime 调用、本地运行记录和本地运行脚本。相关入口包括 `personal_wiki_brain\api`、`personal_wiki_brain\chat`、`personal_wiki_brain\agent`、`scripts`。
- 不要把 `E:\wiki` 的知识库数据、原始文件、索引、缓存、日志或运行记录提交到博客仓库。
- 上述本地记录指 Hub 自己的记录；Codex 原生历史在 `D:\AIData\Codex`，opencode 当前原生数据在 `C:\Users\songm\.local\share\opencode`（以 `opencode debug paths` 为准）。备份和同步要区分权威原生库与 Hub 投影，不在未迁移数据时只改路径。
- 后续以 `E:\blog` 作为用户入口；即使需要改后端，也只在 `E:\wiki` 修改本地服务实现，并保持两个项目的 git 与数据边界清晰。
- 本文件只维护 `E:\blog` 的项目规则；如需同步修改 `E:\wiki\AGENTS.md`，必须先得到用户明确授权。

### Personal AI Hub 架构约定

- 当前目标链路是：线上博客 `libresensing.com` 管理员入口 -> 博客代理 API -> `https://hub-api.libresensing.com` -> Cloudflare Tunnel -> 本机 `http://127.0.0.1:8000` -> `E:\wiki` FastAPI。
- 博客前端不得直接携带本地 API token 请求 `hub-api.libresensing.com`；必须通过管理员受保护的博客服务端代理。
- 博客环境变量 `PERSONAL_AI_HUB_API_URL` 指向 Hub API 地址，`PERSONAL_AI_HUB_API_TOKEN` 必须与本地 `LOCAL_HUB_API_TOKEN` 一致。
- 本地 FastAPI 必须显式校验 `X-Hub-Token`。缺少配置、token 不一致、opencode 未启动、索引缺失时，应显式报错，不写 fallback 兜底逻辑。
- 本地 FastAPI 的 `/health` 也受 `X-Hub-Token` 保护；直接浏览器访问 Tunnel `/health` 返回 401 不一定代表服务离线，排查时应带 token 或使用 `E:\wiki\scripts\status_hub.ps1`。
- 校园网无法使用 Cloudflare Tunnel 属于当前网络限制。排查时先确认手机热点或其它网络、`cloudflared`、FastAPI、opencode 和环境变量，再判断是否为代码问题。

### Agent Chat 约定

- Codex 的目标是可在博客正常操作的本机客户端：聊天、模型选择、新建聊天及绑定本地项目目录，复用 `D:\AIData\Codex` 的原生会话与历史。不能把“展示已有 Codex 能力”理解为只读禁发；不 fork Codex 核心，不用新会话冒充恢复旧会话，忙碌/原生锁冲突时明确拒绝而非抢锁或复制历史。Wiki 问答与 opencode 聊天同时保留。
- Agent Chat 的设计目标不是训练或微调模型权重，而是在调用 opencode 前先查询本地知识库，把召回内容、引用和用户问题一起注入 agent 上下文。
- opencode 在本系统中定位为可替换的 Agent Runtime。不要 fork 或深改 opencode 核心。
- 博客 Agent Chat 页面只作为前端与代理入口；会话、召回、缓存、反馈和运行记录保存在 `E:\wiki`。
- DeepSeek API key 走本机环境变量或 opencode provider 配置，不写入仓库。

### 文档维护

- `E:\blog\doc\blog-and-ai-hub-architecture.md` 是博客、Wiki Hub 和本地 Agent 的长期架构与使用说明；维护实际架构、模型/配置、资料和会话存储、手动/自动知识维护、启动排查和已知边界，使用必要的 Mermaid 流程图。
- 相关代码、接口、模型、目录、权限、维护流程或部署方式变化时，必须在同一开发任务中更新上述说明及既有状态文档；写清代码现状、配置快照、未完成项与核验日期。不能把规划或替身测试当作已实现能力，不在文档记录密钥或聊天私密正文。
- `E:\wiki\LLM_Wiki_需求文档.md` 是 Personal AI Hub 的主规格来源。
- `E:\blog\docs\personal-ai-hub-in-progress.md` 记录进行中的接入任务和当前焦点。
- `E:\blog\docs\personal-ai-hub-completed.md` 记录已经完成并可复核的能力。
- `E:\blog\docs\personal-ai-hub-roadmap.md` 记录未来规划和阶段路线。
- `E:\blog\docs\personal-ai-hub-known-issues.md` 记录已发现 bug、限制和待排查事项。
- 发现 bug 时先写入 known issues 文档，包含现象、影响范围、初步判断、复现/验证线索和下一步处理建议。
- 完成功能或修复 bug 后，同步更新 completed / in-progress / known issues，避免代码状态和文档状态分离。
- 用户未明确要求时，不主动创建额外说明文档；但 Personal AI Hub 的长期计划、阶段状态和 bug 清单按上述固定文档维护。

### SDD：先规格，后实现

- 复杂功能、跨模块功能、接口变更、数据结构变更，必须先明确规格再写代码。
- 规格至少包含：目标、输入输出、数据模型、边界条件、错误行为、不做范围和验收方式。
- API 契约是前端、MCP 和本地 FastAPI 的共同约束；任一端变更后必须检查其它端是否同步。
- Personal AI Hub 相关实现前，先对照 `E:\wiki\LLM_Wiki_需求文档.md` 和 `E:\blog\docs` 下的阶段文档。

### TDD 与验证

- 新功能、Bug 修复、重构和行为变化必须使用 TDD：先写最小失败测试，验证 RED，再写最少实现，验证 GREEN，最后按需重构。
- 博客项目测试命令使用 `bun run test`，不要用 `npx vitest`。
- 博客 Node 单元测试使用 `bun run test:node`；当前 Personal AI Hub 的 `*.test.ts` 属于 Node 测试，不会被只包含 `*.integration.test.ts` 的 Workers 测试配置自动覆盖。
- 博客 Workers 集成测试使用 `bun run test`；该命令依赖本地未提交的 `wrangler.jsonc`。若缺少该文件导致测试无法启动，必须明确说明测试环境未准备，而不是误判为业务代码失败。
- 后端 `E:\wiki` 测试命令使用 `python -m pytest -q`。
- 博客代码变更至少运行相关 Vitest；跨 Personal AI Hub 代理、MCP、环境变量或路由时，运行对应测试文件和必要的全量测试。
- wiki 后端代码变更至少运行相关 Pytest；涉及 API 契约、检索、Agent Chat 或 opencode runtime 时，补充/更新对应测试。
- 不在测试中调用真实付费 LLM、MinerU、Cloudflare Tunnel、opencode 外部服务或网络服务，除非用户明确要求做集成测试。
- 若测试无法运行，必须说明原因、已验证部分和剩余风险。

### 协作与安全

- 使用中文与用户沟通，表达简洁、准确。
- 涉及修改文件时，先说明将修改什么，再执行修改。
- 发现规则冲突、影响范围大、可能破坏已有数据或测试时，先说明风险。
- 不主动回滚用户已有修改；遇到无关改动时忽略，遇到相关改动时在其基础上继续。
- 已经完成且正确的功能尽量不要修改，只处理当前需求相关内容。
- 代码和注释使用 UTF-8 编码，代码注释默认使用中文。
- 修改函数实现前，先理解原有逻辑，再在原逻辑基础上修改。
- 写代码时严禁使用 fallback 兜底逻辑。缺少配置、模型、索引或环境变量时，应显式报错并暴露原因。
- 每次修改本文件后，必须向用户报告修改了哪些规则，并询问是否需要修正。

## Commands

```bash
bun dev              # Dev server on port 3000
bun run build        # Production build (generates manifest + vite build)
bun run test         # Run all tests (Vitest with Cloudflare Workers pool) — NOT npx vitest
bun run test posts   # Run tests matching pattern
bun run test src/features/posts/posts.service.test.ts  # Run specific test file
bun lint             # ESLint check
bun lint:fix         # ESLint fix + formatting
bun check            # Type check + lint + format (tsc --noEmit && lint:fix && format)
```

## Architecture

### Feature Modules (`src/features/`)

Each feature follows a layered pattern:

```
features/<name>/
├── api/              # Server functions (TanStack Start) and/or Hono routes
├── data/             # Data access layer — raw Drizzle queries, no business logic
│                     # Functions: (db: DB, params) → Promise<T>
├── <name>.service.ts # Business logic — orchestrates data, cache, workflows
├── <name>.schema.ts  # Zod schemas + cache key factories
├── components/       # React components specific to this feature
├── queries/          # TanStack Query hooks + query key factories
├── utils/            # Feature-specific utilities
└── workflows/        # Cloudflare Workflows (async processing)
```

### Result Type for Error Handling (`src/lib/errors/error.ts`)

Service functions return `Result<TData, { reason: string }>` instead of throwing:

```typescript
import { ok, err } from "@/lib/errors";

// Service returns Result
const exists = await TagRepo.nameExists(db, name);
if (exists) return err({ reason: "TAG_NAME_ALREADY_EXISTS" });
return ok(tag);

// Consumer handles with exhaustive switch
if (result.error) {
  switch (result.error.reason) {
    case "TAG_NAME_ALREADY_EXISTS":
      throw new Error("标签已存在");
    default:
      result.error.reason satisfies never;
  }
}
```

### Middleware Chain (`src/lib/middlewares.ts`)

TanStack Start middleware composes as: `dbMiddleware` → `sessionMiddleware` → `authMiddleware` → `adminMiddleware`. Each layer injects into context (`context.db`, `context.session`, `context.auth`). The `DbContext` type is used widely in service function signatures.

Additionally, `errorLoggingMiddleware` is globally registered (via `@tanstack/react-start` global middleware) to log unhandled server function errors in structured JSON format.

### Caching Strategy

Multi-layer: Cloudflare CDN (Cache-Control headers) → KV Store (versioned keys) → D1. Cache keys are defined as factories in `*.schema.ts` files.

### Environment Variables

Client-side (Vite-injected, validated in `src/lib/env/client.env.ts`).
Server-side (Wrangler-injected, validated in `src/lib/env/server.env.ts`).

### Testing

Tests run in Cloudflare Workers pool via `@cloudflare/vitest-pool-workers`. Config in `vitest.config.ts` applies D1 migrations and provides mock bindings. Test helpers and mocks live in `tests/`.

### Structured Logging

Use JSON format for logs to enable search/filtering in Cloudflare Workers Observability:

```typescript
console.error(
  JSON.stringify({ message: "request failed", error: String(error) }),
);
```
