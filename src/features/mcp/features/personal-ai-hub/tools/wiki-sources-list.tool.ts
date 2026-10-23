import type { OAuthScopeRequest } from "@/features/oauth-provider/schema/oauth-provider.schema";
import { listKnowledgeSources } from "@/features/personal-ai-hub/service/personal-ai-hub.service";
import { defineMcpTool } from "../../../service/mcp-tool";

const WIKI_SOURCES_LIST_REQUIRED_SCOPES: OAuthScopeRequest = {
  "personal-ai-hub": ["read"],
};

export const wikiSourcesListTool = defineMcpTool({
  name: "wiki_sources_list",
  description: "List source records from the local Personal AI Hub LLM Wiki.",
  requiredScopes: WIKI_SOURCES_LIST_REQUIRED_SCOPES,
  async handler(context) {
    const result = await listKnowledgeSources(context);
    if (result.error)
      return {
        isError: true,
        content: [
          { type: "text" as const, text: JSON.stringify(result.error) },
        ],
      };
    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      structuredContent: result.data,
    };
  },
});
