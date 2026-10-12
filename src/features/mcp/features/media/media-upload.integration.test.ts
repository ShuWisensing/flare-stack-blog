import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { McpToolContext } from "@/features/mcp/service/mcp.types";
import { stageMcpUpload } from "@/features/mcp/service/mcp-upload.service";
import { getDb } from "@/lib/db";
import { McpUploadsTable } from "@/lib/db/schema";
import { mediaListTool } from "./tools/media-list.tool";
import { mediaUploadTool } from "./tools/media-upload.tool";

function context(subject = "upload-admin"): McpToolContext {
  return {
    env,
    db: getDb(env),
    executionCtx: createExecutionContext(),
    principal: {
      subject,
      clientId: "test-client",
      scopes: ["media:read", "media:write"],
    },
  };
}

describe("MCP 图片上传", () => {
  it("后续上传会清理已超过任务保留期的临时文件，不删除已入库图片", async () => {
    const ctx = context();
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const receipt = await stageMcpUpload(
      ctx,
      new File([bytes], "abandoned.png", { type: "image/png" }),
      "image",
    );
    const [staged] = await ctx.db
      .select()
      .from(McpUploadsTable)
      .where(eq(McpUploadsTable.id, receipt.uploadId));
    await ctx.db
      .update(McpUploadsTable)
      .set({ expiresAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(McpUploadsTable.id, receipt.uploadId));
    const stagedObject = await env.R2.get(staged.r2Key);
    expect(stagedObject).not.toBeNull();
    await stagedObject!.arrayBuffer();
    await stageMcpUpload(
      ctx,
      new File([bytes], "next.png", { type: "image/png" }),
      "image",
    );
    expect(await env.R2.head(staged.r2Key)).toBeNull();
  });
  it("上传返回可用图片地址，重复请求只创建一条媒体记录", async () => {
    const ctx = context();
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const upload = await stageMcpUpload(
      ctx,
      new File([bytes], "pixel.png", { type: "image/png" }),
      "image",
    );
    const args = { uploadId: upload.uploadId, requestId: "upload-pixel-once" };
    const first = await mediaUploadTool.handler(args, ctx);
    const second = await mediaUploadTool.handler(args, ctx);
    expect(first.isError).not.toBe(true);
    expect(second.structuredContent).toEqual(first.structuredContent);
    expect(first.structuredContent).toMatchObject({
      url: expect.stringMatching(/^https:\/\/example.com\/images\//),
      width: 1,
      height: 1,
    });
    const listed = await mediaListTool.handler({ search: "pixel.png" }, ctx);
    expect(listed.structuredContent?.items).toHaveLength(1);
    await waitOnExecutionContext(ctx.executionCtx);
  });

  it("上传凭证绑定用户、客户端和权限", async () => {
    const ctx = context();
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const upload = await stageMcpUpload(
      ctx,
      new File([bytes], "owned.png", { type: "image/png" }),
      "image",
    );
    const args = { uploadId: upload.uploadId, requestId: "ownership-check" };
    expect(
      (await mediaUploadTool.handler(args, context("other-admin")))
        .structuredContent,
    ).toMatchObject({ error: { code: "UPLOAD_NOT_FOUND" } });
    const otherClient = context();
    otherClient.principal.clientId = "other-client";
    expect(
      (await mediaUploadTool.handler(args, otherClient)).structuredContent,
    ).toMatchObject({ error: { code: "UPLOAD_NOT_FOUND" } });
    const readOnly = context();
    readOnly.principal.scopes = ["media:read"];
    expect(
      (await mediaUploadTool.handler(args, readOnly)).structuredContent,
    ).toMatchObject({ error: { code: "INSUFFICIENT_SCOPE" } });
  });

  it("拒绝伪造图片和相同 requestId 的不同文件", async () => {
    const ctx = context();
    await expect(
      stageMcpUpload(
        ctx,
        new File(["not-a-png"], "fake.png", { type: "image/png" }),
        "image",
      ),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const first = await stageMcpUpload(
      ctx,
      new File([bytes], "one.png", { type: "image/png" }),
      "image",
    );
    const second = await stageMcpUpload(
      ctx,
      new File([bytes], "two.png", { type: "image/png" }),
      "image",
    );
    await mediaUploadTool.handler(
      { uploadId: first.uploadId, requestId: "conflicting-id" },
      ctx,
    );
    expect(
      (
        await mediaUploadTool.handler(
          { uploadId: second.uploadId, requestId: "conflicting-id" },
          ctx,
        )
      ).structuredContent,
    ).toMatchObject({
      error: { code: "IDEMPOTENCY_CONFLICT", retryable: false },
    });
  });

  it("并发重试只创建一张图片，过期凭证明确报错", async () => {
    const ctx = context();
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const upload = await stageMcpUpload(
      ctx,
      new File([bytes], "concurrent.png", { type: "image/png" }),
      "image",
    );
    const args = { uploadId: upload.uploadId, requestId: "concurrent-request" };
    const results = await Promise.all([
      mediaUploadTool.handler(args, ctx),
      mediaUploadTool.handler(args, ctx),
    ]);
    expect(results.some((result) => !result.isError)).toBe(true);
    const retry = await mediaUploadTool.handler(args, ctx);
    expect(retry.isError).not.toBe(true);
    const listed = await mediaListTool.handler(
      { search: "concurrent.png" },
      ctx,
    );
    expect(listed.structuredContent?.items).toHaveLength(1);
    const expired = await stageMcpUpload(
      ctx,
      new File([bytes], "expired.png", { type: "image/png" }),
      "image",
    );
    await ctx.db
      .update(McpUploadsTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(McpUploadsTable.id, expired.uploadId));
    expect(
      (
        await mediaUploadTool.handler(
          { uploadId: expired.uploadId, requestId: "expired-request" },
          ctx,
        )
      ).structuredContent,
    ).toMatchObject({ error: { code: "UPLOAD_EXPIRED", retryable: false } });
  });
});
