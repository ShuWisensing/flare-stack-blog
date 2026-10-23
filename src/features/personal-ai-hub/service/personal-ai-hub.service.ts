import { z } from "zod";
import {
  type AgentChatInput,
  AgentChatResponseSchema,
  AgentMessagesResponseSchema,
  AgentSessionResponseSchema,
  AgentSessionsResponseSchema,
  AgentStatusResponseSchema,
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
type HubRequestContext = { env: HubEnv; fetch?: typeof fetch };
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
  HUB_UNAUTHORIZED: "Hub 鉴权失败，请检查两端 token。",
  HUB_INVALID_REQUEST: "请求参数不合法。",
  KB_INDEX_NOT_READY: "所选知识库索引尚未就绪。",
  LOCAL_MODEL_NOT_READY: "本地模型或 CUDA 尚未就绪。",
  AGENT_RUNTIME_NOT_READY: "所选 Runtime 未就绪。",
  CODEX_AUTH_UNAVAILABLE: "Codex 登录不可用。",
  RUNTIME_SESSION_MISMATCH: "会话与当前 Runtime 或目录不匹配。",
  MODEL_CONFIG_MISSING: "模型配置缺失。",
  MODEL_AUTH_FAILED: "DeepSeek 鉴权失败，请检查本机系统环境变量 DEEPSEEK。",
  MODEL_RATE_LIMITED: "DeepSeek 额度或请求频率受到限制。",
  MODEL_REQUEST_FAILED: "DeepSeek 请求失败，请检查本机模型配置和上游服务。",
  HUB_TIMEOUT: "请求超时；Agent 任务可能仍在运行，请先刷新会话。",
  INTERNAL_ERROR: "本地服务内部错误。",
  AGENT_EXECUTION_FAILED: "Agent 执行失败。",
  AGENT_EXECUTION_UNKNOWN:
    "Agent 执行状态未知，任务可能已执行；请先刷新会话核验，不要直接重发。",
  AGENT_RESPONSE_INVALID: "Agent 响应格式不正确，请核对 Runtime 版本与接口。",
  AGENT_APPROVAL_REQUIRED: "本版不支持此审批操作。",
  AGENT_POLICY_MISMATCH: "Codex 实际权限或工作目录与 Hub 配置不一致。",
  AGENT_BUSY: "所选执行器正在处理任务，请稍后再试。",
  INDEX_GENERATION_MISMATCH: "索引版本或内容校验失败，请重建所选索引。",
  LOCAL_PARSER_NOT_READY: "本地文档解析或 OCR 未就绪。",
};
async function hubFetch<T>(
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
  ): HubResult<T> => ({
    data: null,
    error: {
      reason,
      message,
      layer,
      requestId,
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
            : "HUB_UPSTREAM_ERROR";
      let layer = "blog_proxy";
      if (response.headers.get("Content-Type")?.includes("application/json")) {
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
              ]),
            }),
          })
          .safeParse(body);
        if (
          parsed.success &&
          Object.hasOwn(reasons, parsed.data.error.reason)
        ) {
          reason = parsed.data.error.reason;
          layer = parsed.data.error.layer;
        }
      }
      return fail(
        reason,
        reasons[reason] ??
          "上游返回 HTTP " + response.status + "，请按请求编号检查日志。",
        response.status,
        layer,
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
