import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/middlewares";
import * as S from "../schema/hub-chat.schema";
import * as Hub from "../service/hub-chat.service";

const Cursor = z.string().max(2048).optional();
const RuntimeInput = z.object({ runtime: S.AgentRuntime, workspace_id: S.Id });
const NodeInput = z.object({
  node_id: S.Id,
  revision: z.string().max(64).optional(),
  cursor: Cursor,
});

export const listHubRootsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(({ context }) => Hub.listHubRoots(context));
export const listHubWorkspacesFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ kind: z.enum(["wiki", "agent"]), cursor: Cursor }))
  .handler(({ context, data }) =>
    Hub.listHubWorkspaces(context, data.kind, data.cursor),
  );
export const createHubWorkspaceFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      root_key: z.string().min(1).max(64),
      name: z.string().trim().min(1).max(80),
    }),
  )
  .handler(({ context, data }) =>
    Hub.createHubWorkspace(context, data.root_key, data.name),
  );
export const renameHubWorkspaceFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({ id: S.Id, name: z.string().trim().min(1).max(80) }),
  )
  .handler(({ context, data }) =>
    Hub.renameHubWorkspace(context, data.id, data.name),
  );
export const listHubConversationsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      workspace_id: S.Id,
      cursor: Cursor,
      include_archived: z.boolean().optional(),
    }),
  )
  .handler(({ context, data }) =>
    Hub.listHubConversations(
      context,
      data.workspace_id,
      data.cursor,
      data.include_archived,
    ),
  );
export const createHubConversationFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      workspace_id: S.Id,
      runtime: S.Runtime,
      title: z.string().trim().min(1).max(120),
      model_id: z.string().max(128).nullable(),
    }),
  )
  .handler(({ context, data }) => Hub.createHubConversation(context, data));
export const updateHubConversationFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(
    z
      .object({
        id: S.Id,
        title: z.string().trim().min(1).max(120).optional(),
        archived: z.boolean().optional(),
      })
      .refine((d) => d.title !== undefined || d.archived !== undefined),
  )
  .handler(({ context, data }) =>
    Hub.updateHubConversation(context, data.id, {
      title: data.title,
      archived: data.archived,
    }),
  );
export const getHubConversationFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ id: S.Id }))
  .handler(({ context, data }) => Hub.getHubConversation(context, data.id));
export const listHubMessagesFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({ id: S.Id, before_seq: z.number().int().positive().optional() }),
  )
  .handler(({ context, data }) =>
    Hub.listHubMessages(context, data.id, data.before_seq),
  );
export const submitHubTurnFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ id: S.Id, input: S.TurnInput }))
  .handler(({ context, data }) =>
    Hub.submitHubTurn(context, data.id, data.input),
  );
export const getHubTurnFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ id: S.Id, verify_native: z.boolean().optional() }))
  .handler(({ context, data }) =>
    Hub.getHubTurn(context, data.id, data.verify_native),
  );
export const getHubRequestFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({ conversation_id: S.Id, client_request_id: z.string().uuid() }),
  )
  .handler(({ context, data }) =>
    Hub.getHubRequest(context, data.conversation_id, data.client_request_id),
  );
export const getHubTurnDetailsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ id: S.Id }))
  .handler(({ context, data }) => Hub.getHubTurnDetails(context, data.id));
export const getHubCitationFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({ message_id: S.Id, ordinal: z.number().int().positive() }),
  )
  .handler(({ context, data }) =>
    Hub.getHubCitation(context, data.message_id, data.ordinal),
  );
export const getHubRuntimesFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ workspace_id: S.Id }))
  .handler(({ context, data }) =>
    Hub.getHubRuntimes(context, data.workspace_id),
  );
export const checkHubRuntimeFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(RuntimeInput)
  .handler(({ context, data }) =>
    Hub.checkHubRuntime(context, data.runtime, data.workspace_id),
  );
export const getHubModelsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(RuntimeInput)
  .handler(({ context, data }) =>
    Hub.getHubModels(context, data.runtime, data.workspace_id),
  );
export const getWikiGraphFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(S.GraphInput)
  .handler(({ context, data }) => Hub.getWikiGraph(context, data));
export const searchWikiGraphFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      scope: S.Scope,
      q: z.string().max(200),
      kinds: z.string().max(200).optional(),
      revision: z.string().max(64).optional(),
      cursor: Cursor,
    }),
  )
  .handler(({ context, data }) => Hub.searchWikiGraph(context, data));
export const getWikiNodeFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(NodeInput)
  .handler(({ context, data }) =>
    Hub.getWikiNode(context, data.node_id, data.revision, data.cursor),
  );
export const getWikiContentFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(NodeInput)
  .handler(({ context, data }) =>
    Hub.getWikiContent(context, data.node_id, data.revision, data.cursor),
  );
