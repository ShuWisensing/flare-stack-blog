import { z } from "zod";

export const HubQueryInputSchema = z.object({
  question: z.string().trim().min(1, "问题不能为空"),
  answerMode: z.enum(["local", "llm_rag"]).default("local"),
  llmModel: z
    .enum(["deepseek-flash", "deepseek-v4-pro"])
    .default("deepseek-flash"),
  retrievalMode: z.enum(["bm25", "vector", "hybrid", "local"]).default("bm25"),
  topK: z.number().int().min(1).max(50).default(8),
  rerankMode: z.enum(["off", "local"]).default("off"),
  rerankTopK: z.number().int().min(1).max(50).default(8),
  bm25TopK: z.number().int().min(1).max(100).optional(),
  vectorTopK: z.number().int().min(1).max(100).optional(),
  bm25Weight: z.number().min(0).max(1).default(0.45),
});

export const HubQueryResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(z.record(z.string(), z.any())),
  recall_items: z.array(z.record(z.string(), z.any())),
  timings: z.record(z.string(), z.any()),
  execution: z.record(z.string(), z.any()),
});

export const HubStatusResponseSchema = z.object({
  status: z.string(),
  project_root: z.string().optional(),
  counts: z.record(z.string(), z.number()).optional(),
  indexes: z.record(z.string(), z.any()).optional(),
});

export const HubSourcesResponseSchema = z.object({
  items: z.array(z.record(z.string(), z.any())),
});

export const AgentRuntimeInputSchema = z.object({
  runtime: z.enum(["opencode", "codex"]),
});
export const AgentChatInputSchema = z.object({
  runtime: z.enum(["opencode", "codex"]),
  sessionId: z.string().trim().min(1, "opencode session id 不能为空"),
  question: z.string().trim().min(1, "问题不能为空"),
  model: z.string().trim().min(1).optional(),
  rerankMode: z.enum(["off", "local"]).default("local"),
  retrievalMode: z
    .enum(["bm25", "vector", "hybrid", "local"])
    .default("hybrid"),
  topK: z.number().int().min(1).max(50).default(8),
  bm25TopK: z.number().int().min(1).max(100).optional(),
  vectorTopK: z.number().int().min(1).max(100).optional(),
  bm25Weight: z.number().min(0).max(1).default(0.45),
});

export const AgentChatResponseSchema = z.object({
  runtime: z.enum(["opencode", "codex"]),
  runtime_result: z.record(z.string(), z.any()),
  opencode_result: z.record(z.string(), z.any()).optional(),
  citations: z.array(z.record(z.string(), z.any())),
  recall_items: z.array(z.record(z.string(), z.any())),
  timings: z.record(z.string(), z.any()),
  execution: z.record(z.string(), z.any()),
  run_record: z.record(z.string(), z.any()).optional(),
});

export const AgentSessionCreateInputSchema = AgentRuntimeInputSchema.extend({
  title: z.string().trim().min(1, "会话标题不能为空"),
});

export const AgentSessionMessagesInputSchema = AgentRuntimeInputSchema.extend({
  sessionId: z.string().trim().min(1, "opencode session id 不能为空"),
});

const AgentSessionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().optional(),
});

export const AgentSessionsResponseSchema = z.object({
  items: z.array(AgentSessionSchema),
});

export const AgentSessionResponseSchema = z.object({
  session: AgentSessionSchema,
});

export const AgentMessagesResponseSchema = z.object({
  items: z.array(z.record(z.string(), z.any())),
});

export const CodexRuntimeStatusSchema = z
  .object({
    status: z.enum(["unverified", "checking", "ready", "stale", "error"]),
    check_id: z.string().trim().min(1).nullable(),
    checked_at: z.string().datetime({ offset: true }).nullable(),
    expires_at: z.string().datetime({ offset: true }).nullable(),
    workspace: z.string().optional(),
    mode: z.literal("read-only").optional(),
    billing: z.literal("chatgpt").optional(),
    timings: z.record(z.string(), z.number().nonnegative()).optional(),
    error: z
      .object({
        reason: z.string().min(1),
        message: z.string().min(1),
        layer: z.literal("agent_runtime"),
      })
      .optional(),
  })
  .superRefine((state, context) => {
    if (
      (state.status !== "unverified" && !state.check_id) ||
      (state.status === "error" && !state.error) ||
      ((state.status === "ready" || state.status === "stale") &&
        (!state.checked_at || !state.expires_at))
    ) {
      context.addIssue({
        code: "custom",
        message: "Codex 状态快照缺少对应状态的字段。",
      });
    }
  });

export const AgentStatusResponseSchema = z.discriminatedUnion("runtime", [
  z.object({
    runtime: z.literal("opencode"),
    runtime_status: z.record(z.string(), z.any()),
  }),
  z.object({
    runtime: z.literal("codex"),
    runtime_status: CodexRuntimeStatusSchema,
  }),
]);

export const CodexCheckResponseSchema = z.object({
  runtime: z.literal("codex"),
  check_id: z.string().trim().min(1),
  runtime_status: CodexRuntimeStatusSchema,
});

export type HubQueryInput = z.input<typeof HubQueryInputSchema>;
export type HubQueryResponse = z.infer<typeof HubQueryResponseSchema>;
export type HubStatusResponse = z.infer<typeof HubStatusResponseSchema>;
export type HubSourcesResponse = z.infer<typeof HubSourcesResponseSchema>;
export type AgentChatInput = z.input<typeof AgentChatInputSchema>;
export type AgentChatResponse = z.infer<typeof AgentChatResponseSchema>;
export type AgentSessionCreateInput = z.input<
  typeof AgentSessionCreateInputSchema
>;
export type AgentSessionMessagesInput = z.input<
  typeof AgentSessionMessagesInputSchema
>;
export type AgentSessionsResponse = z.infer<typeof AgentSessionsResponseSchema>;
export type AgentSessionResponse = z.infer<typeof AgentSessionResponseSchema>;
export type AgentMessagesResponse = z.infer<typeof AgentMessagesResponseSchema>;
export type AgentStatusResponse = z.infer<typeof AgentStatusResponseSchema>;

export type AgentRuntime = "opencode" | "codex";
export const HubDiagnosticsSchema = z.object({
  method: z.string().min(1).max(80),
  native_code: z.number().int().nullable(),
  upstream_message: z.string().max(300),
});
export type HubError = {
  reason: string;
  layer: string;
  message: string;
  requestId: string;
  upstreamStatus?: number;
  diagnostics?: z.infer<typeof HubDiagnosticsSchema>;
};
export type HubResult<T> = import("@/lib/errors/error").Result<T, HubError>;
export function unwrapHubResult<T>(result: HubResult<T>): T {
  if (result.error)
    throw Object.assign(
      new Error(
        result.error.message +
          " [" +
          result.error.reason +
          ", " +
          result.error.requestId +
          "]",
      ),
      {
        reason: result.error.reason,
        upstreamStatus: result.error.upstreamStatus,
        diagnostics: result.error.diagnostics,
      },
    );
  return result.data;
}
