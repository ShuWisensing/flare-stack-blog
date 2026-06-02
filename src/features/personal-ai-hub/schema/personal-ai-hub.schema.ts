import { z } from "zod";

export const HubQueryInputSchema = z.object({
  question: z.string().trim().min(1, "问题不能为空"),
  answerMode: z.enum(["local", "llm_rag"]).default("local"),
  llmModel: z
    .enum(["qwen-max", "qwen-plus", "qwen3.6-plus", "deepseek-v4-flash", "deepseek-v4-pro"])
    .default("deepseek-v4-flash"),
  retrievalMode: z.enum(["bm25", "vector", "hybrid", "local"]).default("bm25"),
  topK: z.number().int().min(1).max(50).default(8),
  rerankMode: z.string().default("off"),
  rerankTopK: z.number().int().min(1).max(50).default(8),
  bm25TopK: z.number().int().min(1).max(100).optional(),
  vectorTopK: z.number().int().min(1).max(100).optional(),
  bm25Weight: z.number().min(0).max(1).default(0.45),
});

export const HubQueryResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(z.record(z.string(), z.unknown())),
  recall_items: z.array(z.record(z.string(), z.unknown())),
  timings: z.record(z.string(), z.unknown()),
  execution: z.record(z.string(), z.unknown()),
});

export const HubStatusResponseSchema = z.object({
  status: z.string(),
  project_root: z.string().optional(),
  counts: z.record(z.string(), z.number()).optional(),
  indexes: z.record(z.string(), z.unknown()).optional(),
});

export const HubSourcesResponseSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});

export const AgentChatInputSchema = z.object({
  sessionId: z.string().trim().min(1, "opencode session id 不能为空"),
  question: z.string().trim().min(1, "问题不能为空"),
  model: z.enum(["deepseek-v4-flash", "deepseek-v4-pro"]).default("deepseek-v4-flash"),
  retrievalMode: z.enum(["bm25", "vector", "hybrid", "local"]).default("hybrid"),
  topK: z.number().int().min(1).max(50).default(8),
  bm25TopK: z.number().int().min(1).max(100).optional(),
  vectorTopK: z.number().int().min(1).max(100).optional(),
  bm25Weight: z.number().min(0).max(1).default(0.45),
});

export const AgentChatResponseSchema = z.object({
  opencode_result: z.record(z.string(), z.unknown()),
  citations: z.array(z.record(z.string(), z.unknown())),
  recall_items: z.array(z.record(z.string(), z.unknown())),
  timings: z.record(z.string(), z.unknown()),
  execution: z.record(z.string(), z.unknown()),
  run_record: z.record(z.string(), z.unknown()).optional(),
});

export const AgentSessionCreateInputSchema = z.object({
  title: z.string().trim().min(1, "会话标题不能为空"),
});

export const AgentSessionMessagesInputSchema = z.object({
  sessionId: z.string().trim().min(1, "opencode session id 不能为空"),
});

export const AgentSessionsResponseSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});

export const AgentSessionResponseSchema = z.object({
  session: z.record(z.string(), z.unknown()),
});

export const AgentMessagesResponseSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});

export const AgentStatusResponseSchema = z.object({
  opencode: z.record(z.string(), z.unknown()),
});

export type HubQueryInput = z.infer<typeof HubQueryInputSchema>;
export type HubQueryResponse = z.infer<typeof HubQueryResponseSchema>;
export type HubStatusResponse = z.infer<typeof HubStatusResponseSchema>;
export type HubSourcesResponse = z.infer<typeof HubSourcesResponseSchema>;
export type AgentChatInput = z.infer<typeof AgentChatInputSchema>;
export type AgentChatResponse = z.infer<typeof AgentChatResponseSchema>;
export type AgentSessionCreateInput = z.infer<typeof AgentSessionCreateInputSchema>;
export type AgentSessionMessagesInput = z.infer<typeof AgentSessionMessagesInputSchema>;
export type AgentSessionsResponse = z.infer<typeof AgentSessionsResponseSchema>;
export type AgentSessionResponse = z.infer<typeof AgentSessionResponseSchema>;
export type AgentMessagesResponse = z.infer<typeof AgentMessagesResponseSchema>;
export type AgentStatusResponse = z.infer<typeof AgentStatusResponseSchema>;
