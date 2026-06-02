import type { OAuthScopeRequest } from "@/features/oauth-provider/schema/oauth-provider.schema";
import { getHubStatus } from "@/features/personal-ai-hub/service/personal-ai-hub.service";
import { defineMcpTool } from "../../../service/mcp-tool";

const WIKI_STATUS_REQUIRED_SCOPES: OAuthScopeRequest = {
  "personal-ai-hub": ["read"],
};

export const wikiStatusTool = defineMcpTool({
  name: "wiki_status",
  description: "Get local Personal AI Hub LLM Wiki status and index counts.",
  requiredScopes: WIKI_STATUS_REQUIRED_SCOPES,
  async handler(context) {
    const result = await getHubStatus(context);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
