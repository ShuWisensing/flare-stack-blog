import { z } from "zod";
import * as S from "../schema/hub-chat.schema";
import { type HubRequestContext, hubFetch } from "./personal-ai-hub.service";

const id = encodeURIComponent;
function query(values: Record<string, string | number | boolean | undefined>) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) result.set(key, String(value));
  const text = result.toString();
  return text ? `?${text}` : "";
}
const get = <T>(
  ctx: HubRequestContext,
  path: string,
  schema: z.ZodType<T>,
  timeout = 10000,
) => hubFetch(ctx, path, schema, { method: "GET" }, timeout);
const write = <T>(
  ctx: HubRequestContext,
  path: string,
  schema: z.ZodType<T>,
  body: unknown,
  method = "POST",
) => hubFetch(ctx, path, schema, { method, body: JSON.stringify(body) }, 10000);

export const listHubRoots = (ctx: HubRequestContext) =>
  get(ctx, "/hub/workspace-roots", z.object({ items: z.array(S.Root) }));
export const listHubWorkspaces = (
  ctx: HubRequestContext,
  kind: "wiki" | "agent",
  cursor?: string,
) =>
  get(
    ctx,
    "/hub/workspaces" + query({ kind, cursor }),
    z.object({
      items: z.array(S.Workspace),
      next_cursor: z.string().nullable(),
    }),
  );
export const createHubWorkspace = (
  ctx: HubRequestContext,
  root_key: string,
  name: string,
) =>
  write(ctx, "/hub/workspaces", z.object({ workspace: S.Workspace }), {
    root_key,
    name,
  });
export const renameHubWorkspace = (
  ctx: HubRequestContext,
  workspace_id: string,
  name: string,
) =>
  write(
    ctx,
    `/hub/workspaces/${id(workspace_id)}`,
    z.object({ workspace: S.Workspace }),
    { name },
    "PATCH",
  );
export const listHubConversations = (
  ctx: HubRequestContext,
  workspace_id: string,
  cursor?: string,
  include_archived = false,
) =>
  get(
    ctx,
    "/hub/conversations" + query({ workspace_id, cursor, include_archived }),
    z.object({
      items: z.array(S.Conversation),
      next_cursor: z.string().nullable(),
    }),
  );
export const createHubConversation = (
  ctx: HubRequestContext,
  input: {
    workspace_id: string;
    runtime: "wiki" | "codex" | "opencode";
    title: string;
    model_id: string | null;
  },
) =>
  write(
    ctx,
    "/hub/conversations",
    z.object({ conversation: S.Conversation }),
    input,
  );
export const updateHubConversation = (
  ctx: HubRequestContext,
  conversation_id: string,
  input: { title?: string; archived?: boolean },
) =>
  write(
    ctx,
    `/hub/conversations/${id(conversation_id)}`,
    z.object({ conversation: S.Conversation }),
    input,
    "PATCH",
  );
export const getHubConversation = (
  ctx: HubRequestContext,
  conversation_id: string,
) =>
  get(
    ctx,
    `/hub/conversations/${id(conversation_id)}`,
    z.object({ conversation: S.Conversation }),
  );
export const listHubMessages = (
  ctx: HubRequestContext,
  conversation_id: string,
  before_seq?: number,
) =>
  get(
    ctx,
    `/hub/conversations/${id(conversation_id)}/messages` +
      query({ before_seq }),
    z.object({
      items: z.array(S.Message),
      next_before_seq: z.number().nullable(),
    }),
  );
export const submitHubTurn = (
  ctx: HubRequestContext,
  conversation_id: string,
  input: S.HubTurnInput,
) =>
  write(ctx, `/hub/conversations/${id(conversation_id)}/turns`, S.Turn, input);
export const getHubTurn = (
  ctx: HubRequestContext,
  turn_id: string,
  verify_native = false,
) =>
  get(
    ctx,
    `/hub/turns/${id(turn_id)}` +
      query(verify_native ? { verify_native: true } : {}),
    S.Turn,
    15000,
  );
export const getHubRequest = (
  ctx: HubRequestContext,
  conversation_id: string,
  client_request_id: string,
) =>
  get(
    ctx,
    `/hub/conversations/${id(conversation_id)}/requests/${id(client_request_id)}`,
    S.Turn,
  );
export const getHubTurnDetails = (ctx: HubRequestContext, turn_id: string) =>
  get(ctx, `/hub/turns/${id(turn_id)}/details`, S.Details);
export const getHubCitation = (
  ctx: HubRequestContext,
  message_id: string,
  ordinal: number,
) =>
  get(ctx, `/hub/messages/${id(message_id)}/citations/${ordinal}`, S.Citation);
export const getHubRuntimes = (ctx: HubRequestContext, workspace_id: string) =>
  get(ctx, "/hub/runtimes" + query({ workspace_id }), S.Runtimes);
export const checkHubRuntime = (
  ctx: HubRequestContext,
  runtime: "codex" | "opencode",
  workspace_id: string,
) =>
  write(
    ctx,
    `/hub/runtimes/${runtime}/checks` + query({ workspace_id }),
    S.Check,
    {},
  );
export const getHubModels = (
  ctx: HubRequestContext,
  runtime: "codex" | "opencode",
  workspace_id: string,
) =>
  get(
    ctx,
    `/hub/runtimes/${runtime}/models` + query({ workspace_id }),
    S.Models,
    25000,
  );
export const getWikiGraph = (
  ctx: HubRequestContext,
  input: z.infer<typeof S.GraphInput>,
) => get(ctx, "/kb/graph" + query(input), S.Graph);
export const searchWikiGraph = (
  ctx: HubRequestContext,
  input: {
    scope: "knowledge" | "evidence";
    q: string;
    kinds?: string;
    revision?: string;
    cursor?: string;
  },
) => get(ctx, "/kb/graph/search" + query(input), S.GraphSearch);
export const getWikiNode = (
  ctx: HubRequestContext,
  node_id: string,
  revision?: string,
  cursor?: string,
) =>
  get(
    ctx,
    `/kb/graph/nodes/${id(node_id)}` + query({ revision, cursor }),
    S.NodeDetail,
  );
export const getWikiContent = (
  ctx: HubRequestContext,
  node_id: string,
  revision?: string,
  cursor?: string,
) =>
  get(
    ctx,
    `/kb/graph/nodes/${id(node_id)}/content` + query({ revision, cursor }),
    S.NodeContent,
  );
