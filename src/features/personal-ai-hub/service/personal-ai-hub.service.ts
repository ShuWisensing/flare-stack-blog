import { z } from "zod";
import {
  type AgentChatInput,
  AgentChatResponseSchema,
  AgentMessagesResponseSchema,
  AgentSessionResponseSchema,
  AgentSessionsResponseSchema,
  AgentStatusResponseSchema,
  CodexCheckResponseSchema,
  HubDiagnosticsSchema,
  type HubQueryInput,
  HubQueryResponseSchema,
  HubSourcesResponseSchema,
  HubStatusResponseSchema,
} from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";
import type { AgentRuntime, HubResult } from "../schema/personal-ai-hub.schema";

type HubEnv = {
  PERSONAL_AI_HUB_API_URL?: string;
  PERSONAL_AI_HUB_API_TOKEN?: string;
};
export type HubRequestContext = { env: HubEnv; fetch?: typeof fetch };
class HubConfigError extends Error {
  constructor(
    public reason: string,
    message: string,
  ) {
    super(message);
  }
}
export function getHubApiConfig(env: HubEnv) {
  const apiUrl = env.PERSONAL_AI_HUB_API_URL?.trim().replace(/\/+$/, "");
  const token = env.PERSONAL_AI_HUB_API_TOKEN?.trim();
  if (!apiUrl)
    throw new HubConfigError(
      "HUB_CONFIG_MISSING",
      "缺少 PERSONAL_AI_HUB_API_URL。",
    );
  if (!token)
    throw new HubConfigError(
      "HUB_CONFIG_MISSING",
      "缺少 PERSONAL_AI_HUB_API_TOKEN。",
    );
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new HubConfigError(
      "HUB_URL_INVALID",
      "PERSONAL_AI_HUB_API_URL 格式不合法。",
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new HubConfigError(
      "HUB_URL_INVALID",
      "PERSONAL_AI_HUB_API_URL 必须是不含凭证的 HTTP(S) 地址。",
    );
  return { apiUrl, token };
}
const reasons: Record<string, string> = {
  AGENT_CONFIG_INVALID: "本机 Agent 运行预算配置不合法，请检查 HUB_AGENT_TURN_TIMEOUT_SECONDS。",
  NATIVE_SESSION_BUSY:
    "桌面或其它 Codex 客户端仍占用此聊天，请释放原生会话后重试，未复制聊天或抢锁。",
  NATIVE_HISTORY_CHANGED:
    "原生已完成记录发生变化，未覆盖本地历史，请核验原文。",
  NATIVE_HISTORY_TOO_LARGE: "原生会话正文超过本次读取上限，请在本机分段整理。",
  NATIVE_HISTORY_READ_ONLY:
    "此原生聊天目前仅同步与整理，请在本机续聊或新建 Hub 聊天。",
  NATIVE_SYNC_BUSY: "原生记录正在读取，请稍后刷新。",
  KNOWLEDGE_URL_INVALID: "网页链接、格式或访问目标不受支持。",
  KNOWLEDGE_URL_FAILED: "网页导入失败，请检查链接或上传原始文档。",
  KNOWLEDGE_SENSITIVE_CONTENT: "所选聊天包含疑似凭证，请先去掉敏感消息。",
  UPLOAD_CHUNK_CONFLICT: "上传分块与已保存内容不一致。",
  KB_UPDATING: "知识库更新尚未完成，请查看资料库中的处理进度。",
  KB_DATA_UNAVAILABLE: "知识资料目录不可读。",
  KNOWLEDGE_BUSY: "知识库正在更新，请稍后再试。",
  KNOWLEDGE_JOB_NOT_FOUND: "未找到知识任务。",
  KNOWLEDGE_JOB_FAILED: "知识任务失败，请按任务编号检查本机日志。",
  KNOWLEDGE_SOURCE_NOT_FOUND: "未找到原始资料。",
  KNOWLEDGE_CANDIDATE_NOT_FOUND: "未找到待确认知识。",
  KNOWLEDGE_REVIEW_CONFLICT: "知识候选已变化或正在处理，请刷新后核对。",
  KNOWLEDGE_INPUT_TOO_LARGE: "资料内容过长，请指定较小的原文行号范围。",
  EVIDENCE_UNAVAILABLE: "原文证据缺失、内容变化或校验失败。",
  UPLOAD_NOT_FOUND: "未找到上传任务。",
  UPLOAD_INCOMPLETE: "文件分块尚未上传完整。",
  UPLOAD_HASH_MISMATCH: "上传内容校验失败。",
  HUB_UNAUTHORIZED: "Hub 鉴权失败，请检查两端 token。",
  HUB_INVALID_REQUEST: "请求参数不合法。",
  KB_INDEX_NOT_READY: "所选知识库索引尚未就绪。",
  LOCAL_MODEL_NOT_READY: "本地模型或 CUDA 尚未就绪。",
  AGENT_RUNTIME_NOT_READY: "所选 Runtime 未就绪。",
  CODEX_AUTH_UNAVAILABLE: "Codex 登录不可用。",
  CODEX_AUTH_TIMEOUT: "Codex 连接或登录检查超时，请重新检查；未提交任务。",
  WORKSPACE_NOT_REGISTERED: "未找到已登记的工作区或项目目录。",
  WORKSPACE_PATH_UNAVAILABLE: "工作区目录不存在或不可访问，请在本机检查。",
  WORKSPACE_CONFIG_CHANGED: "工作区目录绑定已变化，请核验本机配置。",
  WORKSPACE_CONFIG_INVALID: "本机工作区登记文件缺失或格式有误。",
  CONVERSATION_NOT_FOUND: "聊天或所属记录不存在。",
  CONVERSATION_BUSY: "此聊天有未完成或结果未知的请求，请先核验当前请求。",
  REQUEST_ID_CONFLICT: "请求编号已用于不同内容，未重复执行或覆盖旧记录。",
  HUB_UPGRADE_REQUIRED:
    "Hub 接口或聊天数据库版本不匹配，请核验后端版本和数据目录。",
  RUNTIME_SESSION_MISMATCH: "会话与当前 Runtime 或目录不匹配。",
  MODEL_CONFIG_MISSING: "模型配置缺失。",
  MODEL_AUTH_FAILED: "DeepSeek 鉴权失败，请检查本机系统环境变量 DEEPSEEK。",
  MODEL_RATE_LIMITED: "DeepSeek 额度或请求频率受到限制。",
  MODEL_REQUEST_FAILED: "DeepSeek 请求失败，请检查本机模型配置和上游服务。",
  HUB_TIMEOUT: "请求超时；Agent 任务可能仍在运行，请先刷新会话。",
  HUB_UPSTREAM_TIMEOUT:
    "博客等待 Hub 上游超时，尚未取得可识别的本地错误；请按请求编号检查链路。",
  INTERNAL_ERROR: "本地服务内部错误。",
  AGENT_EXECUTION_FAILED: "Agent 执行失败。",
  AGENT_EXECUTION_UNKNOWN:
    "Agent 执行状态未知，任务可能已执行；请先刷新会话核验，不要直接重发。",
  AGENT_RESPONSE_INVALID: "Agent 响应格式不正确，请核对 Runtime 版本与接口。",
  AGENT_APPROVAL_REQUIRED: "本版不支持此审批操作。",
  AGENT_POLICY_MISMATCH: "Codex 实际权限或工作目录与 Hub 配置不一致。",
  AGENT_BUSY: "所选执行器正在处理任务，请稍后再试。",
  NATIVE_PROJECT_CHANGED: "原生项目目录已变化，请重新发现后接入。",
  WORKSPACE_CONFIG_BUSY: "其它请求正在登记项目，请稍后重试。",
  INDEX_GENERATION_MISMATCH: "索引版本或内容校验失败，请重建所选索引。",
  LOCAL_PARSER_NOT_READY: "本地文档解析或 OCR 未就绪。",
  GRAPH_DATA_UNAVAILABLE: "知识数据库不可读或结构不兼容。",
  GRAPH_NODE_NOT_FOUND: "当前范围没有此知识节点。",
  GRAPH_CONTENT_UNAVAILABLE: "已登记正文缺失或不可读取，请核查本机文件。",
  GRAPH_SNAPSHOT_CHANGED: "知识内容已经变化，请刷新图谱后继续浏览。",
  RELEVANCE_NOT_READY: "相关性校准缺失或与当前索引不匹配，请在本机校准。",
  HUB_RESTARTED: "本机服务已重启，此请求没有自动重发。",
  HUB_BUSY: "本机未完成请求已达上限，请先处理或核验现有请求。",
};
export async function hubFetch<T>(
  context: HubRequestContext,
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  timeout = 10000,
): Promise<HubResult<T>> {
  const requestId = crypto.randomUUID();
  const fail = (
    reason: string,
    message: string,
    upstreamStatus?: number,
    layer = "blog_proxy",
    diagnostics?: z.infer<typeof HubDiagnosticsSchema>,
  ): HubResult<T> => ({
    data: null,
    error: {
      reason,
      message,
      layer,
      requestId,
      ...(diagnostics === undefined ? {} : { diagnostics }),
      ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
    },
  });
  let config: ReturnType<typeof getHubApiConfig>;
  try {
    config = getHubApiConfig(context.env);
  } catch (error) {
    if (error instanceof HubConfigError)
      return fail(error.reason, error.message);
    throw error;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await (context.fetch ?? fetch)(config.apiUrl + path, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Token": config.token,
        "X-Hub-Request-Id": requestId,
      },
    });
    if (!response.ok) {
      let reason =
        response.status === 401
          ? "HUB_UNAUTHORIZED"
          : response.status === 422
            ? "HUB_INVALID_REQUEST"
            : response.status === 504
              ? "HUB_UPSTREAM_TIMEOUT"
              : "HUB_UPSTREAM_ERROR";
      let layer = "blog_proxy";
      let diagnostics: z.infer<typeof HubDiagnosticsSchema> | undefined;
      const contentType = response.headers
        .get("Content-Type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();
      const isJson =
        contentType === "application/json" ||
        (contentType?.startsWith("application/") &&
          contentType.endsWith("+json"));
      if (isJson) {
        const body: unknown = await response.json().catch(() => null);
        const parsed = z
          .object({
            error: z.object({
              reason: z.string(),
              layer: z.enum([
                "hub",
                "retrieval",
                "agent_runtime",
                "blog_proxy",
                "knowledge_graph",
                "knowledge",
              ]),
              diagnostics: z.unknown().optional(),
            }),
          })
          .safeParse(body);
        if (
          parsed.success &&
          Object.hasOwn(reasons, parsed.data.error.reason)
        ) {
          reason = parsed.data.error.reason;
          layer = parsed.data.error.layer;
          if (parsed.data.error.diagnostics !== undefined) {
            const detail = HubDiagnosticsSchema.safeParse(
              parsed.data.error.diagnostics,
            );
            if (detail.success) diagnostics = detail.data;
          }
        }
      }
      const upstreamRequestId = response.headers.get("X-Hub-Request-Id");
      console.error(
        JSON.stringify({
          message: "hub upstream request failed",
          request_id: requestId,
          upstream_status: response.status,
          content_type: contentType,
          reason,
          layer,
          ...(upstreamRequestId &&
          /^[A-Za-z0-9-]{1,64}$/.test(upstreamRequestId)
            ? { upstream_request_id: upstreamRequestId }
            : {}),
        }),
      );
      return fail(
        reason,
        reasons[reason] ??
          "上游返回 HTTP " + response.status + "，请按请求编号检查日志。",
        response.status,
        layer,
        diagnostics,
      );
    }
    const body: unknown = await response.json().catch(() => null);
    const parsed = schema.safeParse(body);
    return parsed.success
      ? { data: parsed.data, error: null }
      : fail("HUB_RESPONSE_INVALID", "Hub 响应结构不符合接口契约。");
  } catch {
    return controller.signal.aborted
      ? fail("HUB_TIMEOUT", reasons.HUB_TIMEOUT)
      : fail("HUB_NETWORK_ERROR", "博客未能连接 Hub，请检查公网链路。");
  } finally {
    clearTimeout(timer);
  }
}
export const getHubStatus = (context: HubRequestContext) =>
  hubFetch(
    context,
    "/kb/status",
    HubStatusResponseSchema,
    { method: "GET" },
    5000,
  );
export const listKnowledgeSources = (context: HubRequestContext) =>
  hubFetch(context, "/kb/sources", HubSourcesResponseSchema, { method: "GET" });
export const queryKnowledgeBase = (
  context: HubRequestContext,
  input: HubQueryInput,
) =>
  hubFetch(
    context,
    "/kb/query",
    HubQueryResponseSchema,
    {
      method: "POST",
      body: JSON.stringify({
        question: input.question,
        answer_mode: input.answerMode,
        llm_model: input.llmModel,
        retrieval_mode: input.retrievalMode,
        top_k: input.topK,
        rerank_mode: input.rerankMode,
        rerank_top_k: input.rerankTopK,
        bm25_top_k: input.bm25TopK,
        vector_top_k: input.vectorTopK,
        bm25_weight: input.bm25Weight,
      }),
    },
    45000,
  );
export const sendAgentChatMessage = (
  context: HubRequestContext,
  input: AgentChatInput,
) =>
  hubFetch(
    context,
    "/agent/chat",
    AgentChatResponseSchema,
    {
      method: "POST",
      body: JSON.stringify({
        runtime: input.runtime,
        session_id: input.sessionId,
        question: input.question,
        model: input.model,
        rerank_mode: input.rerankMode,
        retrieval_mode: input.retrievalMode,
        top_k: input.topK,
        bm25_top_k: input.bm25TopK,
        vector_top_k: input.vectorTopK,
        bm25_weight: input.bm25Weight,
      }),
    },
    75000,
  );
export const listAgentSessions = (
  context: HubRequestContext,
  runtime: AgentRuntime,
) =>
  hubFetch(
    context,
    "/agent/sessions?runtime=" + runtime,
    AgentSessionsResponseSchema,
    { method: "GET" },
  );
export const getAgentStatus = (
  context: HubRequestContext,
  runtime: AgentRuntime,
) =>
  hubFetch(
    context,
    "/agent/status?runtime=" + runtime,
    AgentStatusResponseSchema,
    { method: "GET" },
  );
export const checkCodexConnection = (context: HubRequestContext) =>
  hubFetch(
    context,
    "/hub/runtimes/codex/checks",
    CodexCheckResponseSchema,
    { method: "POST" },
    5000,
  );
export const createAgentSession = (
  context: HubRequestContext,
  title: string,
  runtime: AgentRuntime,
) =>
  hubFetch(context, "/agent/sessions", AgentSessionResponseSchema, {
    method: "POST",
    body: JSON.stringify({ title, runtime }),
  });
export const listAgentMessages = (
  context: HubRequestContext,
  sessionId: string,
  runtime: AgentRuntime,
) =>
  hubFetch(
    context,
    "/agent/sessions/" +
      encodeURIComponent(sessionId) +
      "/messages?runtime=" +
      runtime,
    AgentMessagesResponseSchema,
    { method: "GET" },
  );
