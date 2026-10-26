import { z } from "zod";

export const Job = z.object({
  id: z.string(),
  kind: z.string(),
  state: z.enum(["queued", "running", "completed", "failed", "interrupted"]),
  stage: z.string(),
  created_at: z.string(),
  result: z
    .object({
      source_id: z.string().optional(),
      generation: z.string().optional(),
      wiki_page_ids: z.array(z.string()).optional(),
      candidate_ids: z.array(z.string()).optional(),
      start_line: z.number().optional(),
      end_line: z.number().optional(),
      total_lines: z.number().optional(),
      review_required: z.boolean().optional(),
    })
    .nullable(),
  error: z.object({ reason: z.string(), message: z.string() }).nullable(),
});
export const Source = z.object({
  source_id: z.string(),
  original_name: z.string(),
  source_type: z.string(),
  source_url: z.string().nullable(),
  created_at: z.string(),
  status: z.string(),
});
export const Catalog = z.object({
  wiki_pages: z
    .array(
      z.object({
        wiki_page_id: z.string(),
        title: z.string(),
        node_type: z.string(),
        status: z.string(),
      }),
    )
    .optional(),
  sources: z.array(Source),
  jobs: z.array(Job),
  publication: z.object({ state: z.string() }),
  counts: z.object({ sources: z.number(), wiki_pages: z.number() }).optional(),
});
export const Upload = z.object({
  id: z.string(),
  chunk_bytes: z.number().int().positive(),
  state: z.string(),
});
export const Capabilities = z.object({
  formats: z.array(z.object({ extension: z.string(), name: z.string() })),
  max_file_bytes: z.number(),
  chunk_bytes: z.number(),
  unsupported: z.array(z.object({ extension: z.string(), reason: z.string() })),
});
export const Candidate = z.object({
  id: z.string(),
  version: z.number().int(),
  status: z.string(),
  wiki_page_id: z.string().nullable(),
  payload: z.object({
    merge_target_id: z.string().nullable().optional(),
    title: z.string(),
    statement: z.string(),
    node_type: z.enum([
      "concept",
      "entity",
      "method",
      "project",
      "preference",
      "rule",
    ]),
    assertion_kind: z.string(),
    related_titles: z.array(z.string()),
    scope: z.object({
      kind: z.enum(["global", "project"]),
      workspace_id: z.string().optional(),
    }),
  }),
  evidence: z.array(
    z.object({
      id: z.string(),
      source_id: z.string(),
      excerpt: z.string(),
      start_line: z.number(),
      end_line: z.number(),
      source_url: z.string().nullable(),
      sha256: z.string(),
      origin: z
        .object({
          role: z.enum(["user", "assistant"]),
          runtime: z.enum(["wiki", "codex", "opencode"]),
          conversation_id: z.string(),
          message_id: z.string(),
          workspace_id: z.string(),
          created_at: z.string().datetime({ offset: true }),
          native_session_id: z.string().nullable().optional(),
          native_turn_id: z.string().nullable().optional(),
          native_message_id: z.string().nullable().optional(),
          turn_id: z.string().optional(),
        })
        .optional(),
    }),
  ),
});
export const TextInput = z.object({
  request_id: z.string().min(1).max(128),
  kind: z.enum(["text", "url"]),
  title: z.string().trim().min(1).max(200),
  text: z
    .string()
    .max(1024 * 1024)
    .optional(),
  url: z.string().url().max(2048).optional(),
  previous_source_id: z.string().min(1).max(200).optional(),
});
export const ExtractInput = z.object({
  request_id: z.string().min(1).max(128),
  source_id: z.string().min(1).max(200),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]),
  relative_path: z.string().max(1024).optional(),
  start_line: z.number().int().positive().optional(),
  end_line: z.number().int().positive().optional(),
});
export type KnowledgeCandidate = z.infer<typeof Candidate>;
export const CandidatePage = z.object({
  items: z.array(Candidate),
  next_cursor: z.string().nullable(),
});
export const CandidateEditInput = z.object({
  version: z.number().int().positive(),
  status: z.literal("rejected").optional(),
  title: z.string().trim().min(1).max(200).optional(),
  statement: z.string().trim().min(1).max(16000).optional(),
  merge_target_id: z.string().min(1).max(200).nullable().optional(),
  scope: z
    .object({
      kind: z.enum(["global", "project"]),
      workspace_id: z.string().min(1).max(200).optional(),
    })
    .optional(),
});
export const CollectionSettings = z.object({
  workspace_id: z.string(),
  version: z.number().int(),
  enabled: z.boolean(),
  auto_extract: z.boolean(),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]),
  enabled_at: z.string().nullable(),
  last_scan_at: z.string().nullable(),
  last_error: z.object({ reason: z.string(), message: z.string() }).nullable(),
});
export const CollectionInput = z.object({
  workspace_id: z.string().min(1).max(200),
  version: z.number().int().min(0),
  enabled: z.boolean(),
  auto_extract: z.boolean(),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]),
});
