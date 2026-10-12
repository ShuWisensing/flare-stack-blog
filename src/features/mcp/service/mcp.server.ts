import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "./mcp.types";
import { registerMcpPrompts } from "./mcp-prompt-registry";
import { registerMcpTools } from "./mcp-tool-registry";

export async function createMcpServer(
  context: McpToolContext,
): Promise<McpServer> {
  const [{ McpServer }, { CfWorkerJsonSchemaValidator }] = await Promise.all([
    import("@modelcontextprotocol/sdk/server/mcp.js"),
    import("@modelcontextprotocol/sdk/validation/cfworker"),
  ]);

  const server = new McpServer(
    {
      name: "flare-stack-blog",
      version: __APP_VERSION__,
    },
    {
      instructions:
        "Use these tools to manage the blog. Prefer structured tool outputs over guessing state. To upload local files, POST raw bytes to /api/mcp/uploads with the same OAuth token, kind=image|zip and an encoded fileName; use the returned uploadId in media_upload or posts_import_zip. Never send a local filesystem path or an arbitrary R2 key. For ZIP imports, preflight with dryRun=true and targetStatus=draft, review errors, then start with dryRun=false. Keep requestId stable on retries. Poll imports_get_progress and read outcome, counts, failed posts and imageFailures before reporting success. Importing never publishes; use the existing explicit publication workflow only when the user requests publication.",
      jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
    },
  );

  registerMcpTools(server, context);
  registerMcpPrompts(server, context);
  return server;
}
