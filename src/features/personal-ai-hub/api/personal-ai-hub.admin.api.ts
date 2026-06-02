import { createServerFn } from "@tanstack/react-start";
import {
  AgentChatInputSchema,
  AgentSessionCreateInputSchema,
  AgentSessionMessagesInputSchema,
  HubQueryInputSchema,
} from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";
import * as PersonalAiHubService from "@/features/personal-ai-hub/service/personal-ai-hub.service";
import { adminMiddleware } from "@/lib/middlewares";

export const getPersonalAiHubStatusFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => PersonalAiHubService.getHubStatus(context));

export const queryPersonalAiHubKnowledgeBaseFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(HubQueryInputSchema)
  .handler(({ data, context }) =>
    PersonalAiHubService.queryKnowledgeBase(context, data),
  );

export const sendPersonalAiHubAgentChatMessageFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(AgentChatInputSchema)
  .handler(({ data, context }) =>
    PersonalAiHubService.sendAgentChatMessage(context, data),
  );

export const listPersonalAiHubAgentSessionsFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => PersonalAiHubService.listAgentSessions(context));

export const getPersonalAiHubAgentStatusFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => PersonalAiHubService.getAgentStatus(context));

export const createPersonalAiHubAgentSessionFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(AgentSessionCreateInputSchema)
  .handler(({ data, context }) =>
    PersonalAiHubService.createAgentSession(context, data.title),
  );

export const listPersonalAiHubAgentMessagesFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(AgentSessionMessagesInputSchema)
  .handler(({ data, context }) =>
    PersonalAiHubService.listAgentMessages(context, data.sessionId),
  );
