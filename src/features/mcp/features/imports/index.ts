import type { McpToolDefinition } from "../../service/mcp-tool";
import { importsGetProgressTool } from "./tools/imports-get-progress.tool";
import { postsImportZipTool } from "./tools/posts-import-zip.tool";

export const mcpImportTools: McpToolDefinition[] = [
  postsImportZipTool,
  importsGetProgressTool,
];
