import type { OAuthScopeRequest } from "@/features/oauth-provider/schema/oauth-provider.schema";
import { queryKnowledgeBase } from "@/features/personal-ai-hub/service/personal-ai-hub.service";
import { defineMcpTool } from "../../../service/mcp-tool";
import {
  McpWikiQueryInputSchema,
  McpWikiQueryOutputSchema,
} from "../schema/mcp-personal-ai-hub.schema";

const WIKI_QUERY_REQUIRED_SCOPES: OAuthScopeRequest = {
  "personal-ai-hub": ["read"],
};

export const wikiQueryTool = defineMcpTool({
  name: "wiki_query",
  description:
    "Query the local Personal AI Hub LLM Wiki through the blog proxy and return answer, citations, recall items, and timing metadata.",
  requiredScopes: WIKI_QUERY_REQUIRED_SCOPES,
  inputSchema: McpWikiQueryInputSchema,
  outputSchema: McpWikiQueryOutputSchema,
  async handler(args, context) {
    const result = await queryKnowledgeBase(context, {
      answerMode: args.answerMode,
      bm25Weight: 0.45,
      llmModel: args.llmModel,
      question: args.question,
      rerankMode: args.rerankMode,
      rerankTopK: args.rerankTopK,
      retrievalMode: args.retrievalMode,
      topK: args.topK,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
    };
  },
});
