import { z } from "zod";
import * as S from "../schema/hub-knowledge.schema";
import { type HubRequestContext, hubFetch } from "./personal-ai-hub.service";
export const getKnowledgeCollection = (
  ctx: HubRequestContext,
  workspace_id: string,
) =>
  hubFetch(
    ctx,
    "/hub/knowledge/collection-settings?" +
      new URLSearchParams({ workspace_id }),
    S.CollectionSettings,
    { method: "GET" },
  );
export const configureKnowledgeCollection = (
  ctx: HubRequestContext,
  body: z.infer<typeof S.CollectionInput>,
) =>
  hubFetch(ctx, "/hub/knowledge/collection-settings", S.CollectionSettings, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const rebuildKnowledge = (ctx: HubRequestContext, request_id: string) =>
  hubFetch(ctx, "/hub/knowledge/rebuilds", S.Job, {
    method: "POST",
    body: JSON.stringify({ request_id }),
  });

const get = <T>(ctx: HubRequestContext, path: string, schema: z.ZodType<T>) =>
  hubFetch(ctx, path, schema, { method: "GET" });
const post = <T>(
  ctx: HubRequestContext,
  path: string,
  schema: z.ZodType<T>,
  body: unknown,
  method = "POST",
) => hubFetch(ctx, path, schema, { method, body: JSON.stringify(body) });
export const getKnowledgeCatalog = (ctx: HubRequestContext) =>
  get(ctx, "/hub/knowledge/catalog", S.Catalog);
export const getIngestCapabilities = (ctx: HubRequestContext) =>
  get(ctx, "/hub/ingest/capabilities", S.Capabilities);
export const beginKnowledgeUpload = (
  ctx: HubRequestContext,
  body: {
    request_id: string;
    filename: string;
    size_bytes: number;
    sha256: string;
  },
) => post(ctx, "/hub/uploads", S.Upload, body);
export const sendKnowledgeChunk = (
  ctx: HubRequestContext,
  id: string,
  body: { index: number; data_base64: string; sha256: string },
) =>
  post(
    ctx,
    `/hub/uploads/${encodeURIComponent(id)}/chunks`,
    z.object({ accepted: z.literal(true), index: z.number().int() }),
    body,
  );
export const finishKnowledgeUpload = (
  ctx: HubRequestContext,
  id: string,
  previous_source_id?: string,
) =>
  post(ctx, `/hub/uploads/${encodeURIComponent(id)}/complete`, S.Job, {
    previous_source_id,
  });
export const submitKnowledgeImport = (
  ctx: HubRequestContext,
  body: z.infer<typeof S.TextInput>,
) => post(ctx, "/hub/ingest", S.Job, body);
export const submitKnowledgeExtraction = (
  ctx: HubRequestContext,
  body: z.infer<typeof S.ExtractInput>,
) => post(ctx, "/hub/knowledge/extractions", S.Job, body);
export const getKnowledgeJob = (ctx: HubRequestContext, id: string) =>
  get(ctx, `/hub/jobs/${encodeURIComponent(id)}`, S.Job);
export const retryKnowledgeJob = (ctx: HubRequestContext, id: string) =>
  post(ctx, `/hub/jobs/${encodeURIComponent(id)}/retry`, S.Job, {});
export const getKnowledgeCandidates = (
  ctx: HubRequestContext,
  cursor?: string,
) =>
  get(
    ctx,
    "/hub/knowledge/candidates?" +
      new URLSearchParams({
        status: "waiting_review",
        ...(cursor ? { cursor } : {}),
      }),
    S.CandidatePage,
  );
export const editKnowledgeCandidate = (
  ctx: HubRequestContext,
  id: string,
  body: z.infer<typeof S.CandidateEditInput>,
) =>
  post(
    ctx,
    `/hub/knowledge/candidates/${encodeURIComponent(id)}`,
    S.Candidate,
    body,
    "PATCH",
  );
export const publishKnowledgeCandidates = (
  ctx: HubRequestContext,
  body: { request_id: string; candidates: { id: string; version: number }[] },
) => post(ctx, "/hub/knowledge/publications", S.Job, body);
export const collectKnowledgeChat = (
  ctx: HubRequestContext,
  body: { request_id: string; conversation_id: string; message_ids: string[] },
) => post(ctx, "/hub/knowledge/collections", S.Job, body);
