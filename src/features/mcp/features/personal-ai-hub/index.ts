import type { McpToolDefinition } from "../../service/mcp-tool";
import { wikiQueryTool } from "./tools/wiki-query.tool";
import { wikiSourcesListTool } from "./tools/wiki-sources-list.tool";
import { wikiStatusTool } from "./tools/wiki-status.tool";

export const mcpPersonalAiHubTools: McpToolDefinition[] = [
  wikiQueryTool,
  wikiSourcesListTool,
  wikiStatusTool,
];
