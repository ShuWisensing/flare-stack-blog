import {
  mcpOperationErrorResult,
  mcpOperationResult,
  withMcpOperationError,
} from "../../../service/mcp-operation-error";
import { defineMcpTool } from "../../../service/mcp-tool";
import {
  McpImportZipInputSchema,
  McpImportZipOutputSchema,
} from "../schema/mcp-imports.schema";
import { importMcpZip } from "../service/mcp-imports.service";

export const postsImportZipTool = defineMcpTool({
  name: "posts_import_zip",
  description:
    "Preflight or import a blog ZIP using the existing import Workflow. First POST raw ZIP bytes to /api/mcp/uploads?kind=zip&fileName=<encoded-name> with the same OAuth Bearer token and Content-Type: application/zip. Requires posts:write and media:write. Local paths/R2 keys are not accepted. Always set targetStatus=draft. Run dryRun=true first (no post/media/task writes), inspect per-entry and image errors, then dryRun=false to start. Reuse requestId on retries; existing slugs are skipped, never overwritten. Poll imports_get_progress until completed/failed and inspect outcome and counts; completion alone does not imply success. External HTTP(S) images are preserved without download or availability checks. Limits: 20 MiB ZIP, 40 MiB unpacked, 200 entries, 50 posts, 2 MiB/post; JPEG/PNG/WebP/GIF images up to 10 MiB each.",
  requiredScopes: { posts: ["write"], media: ["write"] },
  structuredErrors: true,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: McpImportZipInputSchema,
  outputSchema: withMcpOperationError(McpImportZipOutputSchema),
  async handler(args, context) {
    try {
      return mcpOperationResult(await importMcpZip(context, args));
    } catch (error) {
      return mcpOperationErrorResult(error);
    }
  },
});
