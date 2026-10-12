import { createExecutionContext, env } from "cloudflare:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, it } from "vitest";
import { buildZip } from "@/features/import-export/utils/zip";
import { getDb } from "@/lib/db";
import { createMcpServer } from "../service/mcp.server";
import type { McpToolContext } from "../service/mcp.types";
import { stageMcpUpload } from "../service/mcp-upload.service";

it("真实 MCP 协议公开三个新工具、输出结构和结构化权限错误", async () => {
  const context: McpToolContext = {
    env,
    db: getDb(env),
    executionCtx: createExecutionContext(),
    principal: {
      subject: "protocol-admin",
      clientId: "protocol-client",
      scopes: ["posts:read", "media:read"],
    },
  };
  const server = await createMcpServer(context);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    const listed = await client.listTools();
    for (const name of [
      "media_upload",
      "posts_import_zip",
      "imports_get_progress",
    ]) {
      expect(listed.tools.find((tool) => tool.name === name)).toMatchObject({
        name,
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        annotations: { idempotentHint: true },
      });
    }
    const forbidden = await client.callTool({
      name: "media_upload",
      arguments: {
        uploadId: crypto.randomUUID(),
        requestId: "protocol-forbidden",
      },
    });
    expect(forbidden).toMatchObject({
      isError: true,
      structuredContent: {
        error: { code: "INSUFFICIENT_SCOPE", retryable: false },
      },
    });
    const invalid = await client.callTool({
      name: "posts_import_zip",
      arguments: {
        uploadId: crypto.randomUUID(),
        requestId: "protocol-invalid",
        targetStatus: "published",
        dryRun: false,
      },
    });
    expect(invalid.isError).toBe(true);
    context.principal.scopes.push("media:write", "posts:write");
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const upload = await stageMcpUpload(
      context,
      new File([bytes], "protocol.png", { type: "image/png" }),
      "image",
    );
    const uploaded = await client.callTool({
      name: "media_upload",
      arguments: { uploadId: upload.uploadId, requestId: "protocol-upload" },
    });
    expect(uploaded).toMatchObject({
      structuredContent: {
        url: expect.stringMatching(/^https:\/\/example.com\/images\//),
        width: 1,
        height: 1,
      },
    });
    const zip = buildZip({
      "protocol.md": "---\ntitle: Protocol\nslug: protocol-preview\n---\n正文",
    });
    const receipt = await stageMcpUpload(
      context,
      new File([new Uint8Array(zip)], "protocol.zip", {
        type: "application/zip",
      }),
      "zip",
    );
    const preflight = await client.callTool({
      name: "posts_import_zip",
      arguments: {
        uploadId: receipt.uploadId,
        requestId: "protocol-preview",
        targetStatus: "draft",
        dryRun: true,
      },
    });
    expect(preflight).toMatchObject({
      structuredContent: {
        dryRun: true,
        total: 1,
        preflight: [{ action: "create" }],
      },
    });
    const missing = await client.callTool({
      name: "imports_get_progress",
      arguments: { taskId: crypto.randomUUID() },
    });
    expect(missing).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "TASK_NOT_FOUND" } },
    });
  } finally {
    await client.close();
    await server.close();
  }
});
