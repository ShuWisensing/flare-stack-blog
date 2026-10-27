import { z } from "zod";
import { CodexRuntimeStatusSchema } from "./personal-ai-hub.schema";

export const Id = z.string().min(1).max(200);
export const Runtime = z.enum(["wiki", "codex", "opencode"]);
export const WorkspaceDirectoryInput = z.object({
  path: z.string().trim().min(1).max(4096),
  name: z.string().trim().min(1).max(80),
});
export const AgentRuntime = z.enum(["codex", "opencode"]);
export const Scope = z.enum(["knowledge", "evidence"]);
export const TurnState = z.enum([
  "queued",
  "preparing",
  "submitting",
  "running",
  "completed",
  "failed",
  "unknown",
  "interrupted",
]);
const ErrorInfo = z.object({ reason: z.string(), message: z.string() });
export const Workspace = z.object({
  id: Id,
  kind: z.enum(["wiki", "agent"]),
  root_key: z.string(),
  root_path: z.string(),
  name: z.string(),
  available: z.boolean(),
  error: ErrorInfo.optional(),
});
export const Root = z.object({
  key: z.string(),
  name: z.string(),
  path: z.string(),
  available: z.boolean(),
  error: ErrorInfo.optional(),
});
export const KnowledgeOptions = z.object({
  enabled: z.boolean(),
  retrieval_mode: z.enum(["bm25", "vector", "hybrid"]),
  rerank_mode: z.enum(["off", "local"]),
});
const SettingsSnapshot = z.object({
  model_id: z.string().nullable(),
  answer_mode: z.enum(["chat", "search"]),
  knowledge: KnowledgeOptions,
});
export const Conversation = z.object({
  id: Id,
  workspace_id: Id,
  runtime: Runtime,
  title: z.string(),
  preferred_model_id: z.string().nullable(),
  native_session_id: z.string().nullable().optional(),
  native_read_only: z.boolean().optional(),
  archived_at: z.string().nullable(),
  updated_at: z.string(),
  active_turn: z
    .object({ id: Id, state: TurnState, client_request_id: z.string() })
    .nullable()
    .optional(),
  last_settings: SettingsSnapshot.nullable().optional(),
});
export const Message = z.object({
  id: Id,
  conversation_id: Id,
  turn_id: Id,
  seq: z.number().int().positive(),
  role: z.enum(["user", "assistant"]),
  content_md: z.string(),
  created_at: z.string(),
  citations: z.array(
    z.object({
      ordinal: z.number().int().positive(),
      used_in_answer: z.boolean(),
    }),
  ),
});
export const TurnInput = z.object({
  client_request_id: z.string().uuid(),
  question: z
    .string()
    .min(1)
    .max(16000)
    .refine((q) => Boolean(q.trim()), "问题不能为空"),
  model_id: z.string().min(1).max(128).nullable(),
  answer_mode: z.enum(["chat", "search"]),
  knowledge: KnowledgeOptions,
});
export const Turn = z.object({
  turn_id: Id,
  conversation_id: Id,
  state: TurnState,
  client_request_id: z.string(),
  error_reason: z.string().nullable(),
  updated_at: z.string(),
});
export const Details = z.object({
  turn_id: Id,
  settings: z.record(z.string(), z.json()),
  timings: z.record(z.string(), z.json()),
  recall_items: z.array(z.record(z.string(), z.json())),
  tool_summary: z.array(z.record(z.string(), z.json())),
});
export const Citation = z.object({
  message_id: Id,
  ordinal: z.number(),
  used_in_answer: z.boolean(),
  generation: z.string(),
  source_snapshot: z.record(z.string(), z.json()),
});
export const RuntimeStatus = CodexRuntimeStatusSchema;
export const Runtimes = z.object({
  items: z.array(
    z.object({ runtime: AgentRuntime, runtime_status: RuntimeStatus }),
  ),
});
export const Check = z.object({
  runtime: AgentRuntime,
  check_id: z.string(),
  runtime_status: RuntimeStatus,
});
export const Models = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
  configured_model: z.string().nullable(),
});
export const GraphNode = z.object({
  id: Id,
  kind: z.string(),
  title: z.string(),
  aliases: z.array(z.string()),
  status: z.string(),
  content_available: z.boolean(),
  content_type: z.string(),
  source_id: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
});
export const GraphEdge = z.object({
  id: Id,
  source: Id,
  target: Id,
  kind: z.string(),
  evidence_refs: z.array(z.record(z.string(), z.json())),
});
const Issues = z.array(z.record(z.string(), z.json()));
export const Graph = z.object({
  scope: Scope,
  revision: z.string(),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  matching_nodes: z.number(),
  matching_edges: z.number(),
  visible_nodes: z.number(),
  visible_edges: z.number(),
  clipped: z.boolean(),
  coverage: z.record(z.string(), z.number()),
  issues: Issues,
  available_kinds: z.array(z.string()),
  available_relations: z.array(z.string()),
});
export const GraphSearch = z.object({
  revision: z.string(),
  items: z.array(GraphNode),
  total: z.number(),
  next_cursor: z.string().nullable(),
});
export const NodeDetail = z.object({
  revision: z.string(),
  node: GraphNode,
  incoming: z.array(GraphEdge),
  outgoing: z.array(GraphEdge),
  neighbors: z.array(GraphNode),
  relation_count: z.number(),
  next_cursor: z.string().nullable(),
  issues: Issues,
});
export const NodeContent = z.object({
  revision: z.string(),
  node_id: Id,
  content_type: z.string(),
  content: z.string(),
  total_bytes: z.number(),
  next_cursor: z.string().nullable(),
  links: z.array(
    z.object({
      target_id: Id,
      label: z.string(),
      aliases: z.array(z.string()),
    }),
  ),
});
export const GraphInput = z.object({
  scope: Scope,
  center_id: Id.optional(),
  depth: z.number().int().min(1).max(2).optional(),
  revision: z.string().max(64).optional(),
  kinds: z.string().max(200).optional(),
  relations: z.string().max(200).optional(),
  include_isolated: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});
export type HubWorkspace = z.infer<typeof Workspace>;
export type HubConversation = z.infer<typeof Conversation>;
export type HubMessage = z.infer<typeof Message>;
export type HubTurnInput = z.infer<typeof TurnInput>;
export type HubGraph = z.infer<typeof Graph>;
export type HubGraphNode = z.infer<typeof GraphNode>;
export type HubGraphEdge = z.infer<typeof GraphEdge>;
