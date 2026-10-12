import {
  mcpOperationErrorResult,
  mcpOperationResult,
  withMcpOperationError,
} from "../../../service/mcp-operation-error";
import { defineMcpTool } from "../../../service/mcp-tool";
import {
  McpImportProgressInputSchema,
  McpImportProgressOutputSchema,
} from "../schema/mcp-imports.schema";
import { getMcpImportProgress } from "../service/mcp-imports.service";

export const importsGetProgressTool = defineMcpTool({
  name: "imports_get_progress",
  description:
    "Read fresh, caller-owned import progress from D1 (requires posts:read). Returns lifecycle status, business outcome, global counts, draft post IDs/admin links, skipped slugs, failed posts and image failures. Records expire after 24 hours. Wait pollAfterSeconds between polls. A completed task can still be partial_failure/all_failed/all_skipped; inspect counts before claiming success. offset/limit paginate each result array independently; follow pagination.nextOffset until null. Does not publish, retry or modify articles.",
  requiredScopes: { posts: ["read"] },
  structuredErrors: true,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: McpImportProgressInputSchema,
  outputSchema: withMcpOperationError(McpImportProgressOutputSchema),
  async handler(args, context) {
    try {
      return mcpOperationResult(await getMcpImportProgress(context, args));
    } catch (error) {
      return mcpOperationErrorResult(error);
    }
  },
});
