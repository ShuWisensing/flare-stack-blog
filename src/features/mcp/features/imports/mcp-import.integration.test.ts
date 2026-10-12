import {
  createExecutionContext,
  env,
  introspectWorkflow,
} from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { buildZip } from "@/features/import-export/utils/zip";
import { getDb } from "@/lib/db";
import { McpOperationsTable, MediaTable, PostsTable } from "@/lib/db/schema";
import type { McpToolContext } from "../../service/mcp.types";
import { stageMcpUpload } from "../../service/mcp-upload.service";
import { importsGetProgressTool } from "./tools/imports-get-progress.tool";
import { postsImportZipTool } from "./tools/posts-import-zip.tool";

function context(subject = "import-admin"): McpToolContext {
  return {
    env,
    db: getDb(env),
    executionCtx: createExecutionContext(),
    principal: {
      subject,
      clientId: "import-client",
      scopes: ["posts:read", "posts:write", "media:write"],
    },
  };
}

const md = (title: string, slug: string, body = "正文") =>
  `---\ntitle: ${title}\nslug: ${slug}\nstatus: published\npublishedAt: 2024-01-01\n---\n${body}`;

describe("MCP ZIP 导入", () => {
  it("预检返回有效文章和具体图片错误，不写文章、媒体或启动任务", async () => {
    const ctx = context();
    const zip = buildZip({
      "good.md": md("Good", "good-preview"),
      "broken.md": md("Broken", "broken-preview", "![图](absent.png)"),
    });
    const upload = await stageMcpUpload(
      ctx,
      new File([new Uint8Array(zip)], "preview.zip", {
        type: "application/zip",
      }),
      "zip",
    );
    const workflows = await introspectWorkflow(env.IMPORT_WORKFLOW);
    try {
      const result = await postsImportZipTool.handler(
        {
          uploadId: upload.uploadId,
          requestId: "dry-run-request",
          targetStatus: "draft",
          dryRun: true,
        },
        ctx,
      );
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        dryRun: true,
        mode: "markdown",
        targetStatus: "draft",
        total: 2,
        preflight: [
          { title: "Good", action: "create" },
          {
            title: "Broken",
            action: "fail",
            code: "IMAGE_IMPORT_FAILED",
            imageFailures: [{ source: "absent.png", code: "IMAGE_NOT_FOUND" }],
          },
        ],
      });
      expect(await ctx.db.select().from(PostsTable)).toHaveLength(0);
      expect(await ctx.db.select().from(MediaTable)).toHaveLength(0);
      expect(workflows.get()).toHaveLength(0);
    } finally {
      await workflows.dispose();
    }
  });

  it("真实 Workflow 固定草稿并报告成功、跳过和图片失败，重试不重复导入", async () => {
    const ctx = context();
    await ctx.db
      .insert(PostsTable)
      .values({ title: "原文", slug: "existing", status: "published" });
    const zip = buildZip({
      "good.md": md("Good", "good-import"),
      "broken.md": md("Broken", "broken-import", "![图](missing.png)"),
      "existing.md": md("Duplicate", "existing"),
    });
    const upload = await stageMcpUpload(
      ctx,
      new File([new Uint8Array(zip)], "import.zip", {
        type: "application/zip",
      }),
      "zip",
    );
    const workflows = await introspectWorkflow(env.IMPORT_WORKFLOW);
    try {
      const args = {
        uploadId: upload.uploadId,
        requestId: "import-once-request",
        targetStatus: "draft" as const,
        dryRun: false,
      };
      const started = await postsImportZipTool.handler(args, ctx);
      expect(started.isError).not.toBe(true);
      const taskId = started.structuredContent?.taskId as string;
      expect(taskId).toEqual(expect.any(String));
      const retry = await postsImportZipTool.handler(args, ctx);
      expect(retry.structuredContent).toEqual(started.structuredContent);
      expect(workflows.get()).toHaveLength(1);
      await workflows.get()[0].waitForStatus("complete");
      const progress = await importsGetProgressTool.handler(
        { taskId, offset: 0, limit: 20 },
        ctx,
      );
      expect(progress.structuredContent).toMatchObject({
        status: "completed",
        outcome: "partial_failure",
        total: 3,
        completed: 3,
        counts: { succeeded: 1, skipped: 1, failed: 1, imageFailures: 1 },
        succeeded: [
          {
            title: "Good",
            slug: "good-import",
            status: "draft",
            postId: expect.any(Number),
            adminUrl: expect.stringMatching(/\/admin\/posts\/edit\/\d+$/),
          },
        ],
        failed: [{ title: "Broken", code: "IMAGE_IMPORT_FAILED" }],
        skipped: [{ slug: "existing" }],
        imageFailures: [{ source: "missing.png", code: "IMAGE_NOT_FOUND" }],
      });
      expect(await ctx.db.select().from(PostsTable)).toHaveLength(2);
      expect(
        (await postsImportZipTool.handler(args, ctx)).structuredContent,
      ).toEqual(started.structuredContent);
      expect(
        (
          await importsGetProgressTool.handler(
            { taskId, offset: 0, limit: 20 },
            context("another-user"),
          )
        ).structuredContent,
      ).toMatchObject({ error: { code: "TASK_NOT_FOUND" } });
      const page = await importsGetProgressTool.handler(
        { taskId, offset: 1, limit: 1 },
        ctx,
      );
      expect(page.structuredContent).toMatchObject({
        succeeded: [],
        counts: { succeeded: 1, failed: 1, skipped: 1 },
      });
      const noRead = context();
      noRead.principal.scopes = ["posts:write"];
      expect(
        (
          await importsGetProgressTool.handler(
            { taskId, offset: 0, limit: 20 },
            noRead,
          )
        ).structuredContent,
      ).toMatchObject({ error: { code: "INSUFFICIENT_SCOPE" } });
      await ctx.db
        .update(McpOperationsTable)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(McpOperationsTable.id, taskId));
      expect(
        (
          await importsGetProgressTool.handler(
            { taskId, offset: 0, limit: 20 },
            ctx,
          )
        ).structuredContent,
      ).toMatchObject({ error: { code: "TASK_EXPIRED" } });
    } finally {
      await workflows.dispose();
    }
  });

  it("原生备份包含图片时复用媒体服务，所有新文章仍为草稿", async () => {
    const ctx = context();
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const zip = buildZip({
      "manifest.json": JSON.stringify({
        version: "1.0",
        exportedAt: new Date().toISOString(),
        postCount: 1,
        generator: "blog-cms",
      }),
      "posts/native/index.md": md("Native", "native-draft"),
      "posts/native/content.json": JSON.stringify({
        type: "doc",
        content: [
          { type: "image", attrs: { src: "/images/old.png?quality=80" } },
        ],
      }),
      "posts/native/images/old.png": png,
    });
    const upload = await stageMcpUpload(
      ctx,
      new File([new Uint8Array(zip)], "native.zip", {
        type: "application/zip",
      }),
      "zip",
    );
    const workflows = await introspectWorkflow(env.IMPORT_WORKFLOW);
    try {
      const result = await postsImportZipTool.handler(
        {
          uploadId: upload.uploadId,
          requestId: "native-image-request",
          targetStatus: "draft",
          dryRun: false,
        },
        ctx,
      );
      expect(result.structuredContent).toMatchObject({ mode: "native" });
      await workflows.get()[0].waitForStatus("complete");
      const progress = await importsGetProgressTool.handler(
        {
          taskId: result.structuredContent?.taskId as string,
          offset: 0,
          limit: 20,
        },
        ctx,
      );
      expect(progress.structuredContent).toMatchObject({
        outcome: "all_success",
        counts: { succeeded: 1, failed: 0, imageFailures: 0 },
        succeeded: [{ title: "Native", status: "draft" }],
      });
      const [post] = await ctx.db.select().from(PostsTable);
      expect(post).toMatchObject({ status: "draft", publishedAt: null });
      const [media] = await ctx.db.select().from(MediaTable);
      expect(media).toMatchObject({
        width: 1,
        height: 1,
        mimeType: "image/png",
      });
      const imageObject = await env.R2.get(media.key);
      expect(imageObject).not.toBeNull();
      await imageObject!.arrayBuffer();
    } finally {
      await workflows.dispose();
    }
  });

  it("全部失败和全部跳过分别报告，不把任务完成误当成功", async () => {
    const ctx = context();
    await ctx.db
      .insert(PostsTable)
      .values({ title: "Existing", slug: "skip-only", status: "published" });
    for (const [name, body, outcome] of [
      ["failed", md("Bad", "bad-only", "![图](absent.png)"), "all_failed"],
      ["skipped", md("Skip", "skip-only"), "all_skipped"],
    ] as const) {
      const zip = buildZip({ "only.md": body });
      const upload = await stageMcpUpload(
        ctx,
        new File([new Uint8Array(zip)], `${name}.zip`, {
          type: "application/zip",
        }),
        "zip",
      );
      const workflows = await introspectWorkflow(env.IMPORT_WORKFLOW);
      try {
        const result = await postsImportZipTool.handler(
          {
            uploadId: upload.uploadId,
            requestId: `outcome-${name}`,
            targetStatus: "draft",
            dryRun: false,
          },
          ctx,
        );
        expect(result.isError).not.toBe(true);
        await workflows.get()[0].waitForStatus("complete");
        const progress = await importsGetProgressTool.handler(
          {
            taskId: result.structuredContent?.taskId as string,
            offset: 0,
            limit: 20,
          },
          ctx,
        );
        expect(progress.structuredContent).toMatchObject({
          status: "completed",
          outcome,
          counts: { succeeded: 0 },
        });
        if (outcome === "all_skipped")
          expect(progress.structuredContent?.warnings).toEqual([
            expect.stringContaining("Skip"),
          ]);
      } finally {
        await workflows.dispose();
      }
    }
  });

  it("拒绝空包、损坏 manifest、越界路径和无导入权限", async () => {
    const ctx = context();
    for (const [name, files, code] of [
      ["empty", { "readme.txt": "empty" }, "NO_POSTS"],
      [
        "manifest",
        { "manifest.json": "{broken", "x.md": md("X", "x") },
        "INVALID_MANIFEST",
      ],
      ["unsafe", { "../x.md": md("X", "x") }, "INVALID_ARCHIVE"],
    ] as const) {
      const zip = buildZip(files);
      const upload = await stageMcpUpload(
        ctx,
        new File([new Uint8Array(zip)], `${name}.zip`, {
          type: "application/zip",
        }),
        "zip",
      );
      expect(
        (
          await postsImportZipTool.handler(
            {
              uploadId: upload.uploadId,
              requestId: `invalid-${name}`,
              targetStatus: "draft",
              dryRun: true,
            },
            ctx,
          )
        ).structuredContent,
      ).toMatchObject({ error: { code } });
    }
    const forbidden = context();
    forbidden.principal.scopes = ["posts:read"];
    expect(
      (
        await postsImportZipTool.handler(
          {
            uploadId: crypto.randomUUID(),
            requestId: "forbidden-request",
            targetStatus: "draft",
            dryRun: true,
          },
          forbidden,
        )
      ).structuredContent,
    ).toMatchObject({ error: { code: "INSUFFICIENT_SCOPE" } });
  });
});
