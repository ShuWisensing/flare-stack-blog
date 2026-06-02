import {
  AgentMessagesResponseSchema,
  AgentSessionResponseSchema,
  AgentSessionsResponseSchema,
  AgentStatusResponseSchema,
  AgentChatResponseSchema,
  HubQueryResponseSchema,
  HubSourcesResponseSchema,
  HubStatusResponseSchema,
  type AgentMessagesResponse,
  type AgentSessionResponse,
  type AgentSessionsResponse,
  type AgentStatusResponse,
  type AgentChatInput,
  type AgentChatResponse,
  type HubQueryInput,
  type HubQueryResponse,
  type HubSourcesResponse,
  type HubStatusResponse,
} from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";

type HubEnv = {
  PERSONAL_AI_HUB_API_URL?: string;
  PERSONAL_AI_HUB_API_TOKEN?: string;
};

type HubRequestContext = {
  env: HubEnv;
  fetch?: typeof fetch;
};

export function getHubApiConfig(env: HubEnv) {
  const apiUrl = env.PERSONAL_AI_HUB_API_URL?.trim().replace(/\/+$/, "");
  if (!apiUrl) {
    throw new Error("缺少环境变量 PERSONAL_AI_HUB_API_URL，无法连接本地 Personal AI Hub。");
  }

  const token = env.PERSONAL_AI_HUB_API_TOKEN?.trim();
  if (!token) {
    throw new Error("缺少环境变量 PERSONAL_AI_HUB_API_TOKEN，无法连接本地 Personal AI Hub。");
  }

  return { apiUrl, token };
}

export async function getHubStatus(context: HubRequestContext): Promise<HubStatusResponse> {
  const response = await hubFetch(context, "/kb/status", { method: "GET" });
  return HubStatusResponseSchema.parse(response);
}

export async function listKnowledgeSources(context: HubRequestContext): Promise<HubSourcesResponse> {
  const response = await hubFetch(context, "/kb/sources", { method: "GET" });
  return HubSourcesResponseSchema.parse(response);
}

export async function queryKnowledgeBase(
  context: HubRequestContext,
  input: HubQueryInput,
): Promise<HubQueryResponse> {
  const response = await hubFetch(context, "/kb/query", {
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
  });
  return HubQueryResponseSchema.parse(response);
}

export async function sendAgentChatMessage(
  context: HubRequestContext,
  input: AgentChatInput,
): Promise<AgentChatResponse> {
  const response = await hubFetch(context, "/agent/chat", {
    method: "POST",
    body: JSON.stringify({
      session_id: input.sessionId,
      question: input.question,
      model: input.model,
      retrieval_mode: input.retrievalMode,
      top_k: input.topK,
      bm25_top_k: input.bm25TopK,
      vector_top_k: input.vectorTopK,
      bm25_weight: input.bm25Weight,
    }),
  });
  return AgentChatResponseSchema.parse(response);
}

export async function listAgentSessions(context: HubRequestContext): Promise<AgentSessionsResponse> {
  const response = await hubFetch(context, "/agent/sessions", { method: "GET" });
  return AgentSessionsResponseSchema.parse(response);
}

export async function createAgentSession(
  context: HubRequestContext,
  title: string,
): Promise<AgentSessionResponse> {
  const response = await hubFetch(context, "/agent/sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return AgentSessionResponseSchema.parse(response);
}

export async function listAgentMessages(
  context: HubRequestContext,
  sessionId: string,
): Promise<AgentMessagesResponse> {
  const response = await hubFetch(context, `/agent/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "GET",
  });
  return AgentMessagesResponseSchema.parse(response);
}

export async function getAgentStatus(context: HubRequestContext): Promise<AgentStatusResponse> {
  const response = await hubFetch(context, "/agent/status", { method: "GET" });
  return AgentStatusResponseSchema.parse(response);
}

async function hubFetch(context: HubRequestContext, path: string, init: RequestInit) {
  const { apiUrl, token } = getHubApiConfig(context.env);
  const fetchImpl = context.fetch ?? fetch;
  const response = await fetchImpl(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Token": token,
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error("本地 Personal AI Hub 服务不可用，请确认本地电脑、FastAPI 和 Cloudflare Tunnel 已启动。");
  }

  return response.json();
}
