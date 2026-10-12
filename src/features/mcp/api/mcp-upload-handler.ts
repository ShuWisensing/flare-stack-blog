import { WorkerEntrypoint } from "cloudflare:workers";
import { MAX_FILE_SIZE } from "@/features/media/media.schema";
import { createOAuthPrincipalFromProps } from "@/features/oauth-provider/service/oauth-provider.service";
import { getDb } from "@/lib/db";
import type { McpToolContext } from "../service/mcp.types";
import {
  McpOperationError,
  mcpOperationErrorResult,
  requireMcpIdentity,
} from "../service/mcp-operation-error";
import {
  assertMcpFileName,
  MAX_ZIP_UPLOAD_SIZE,
  stageMcpUpload,
} from "../service/mcp-upload.service";
import {
  applyMcpOriginPolicy,
  createInvalidOriginResponse,
  isAllowedMcpOrigin,
} from "../utils/mcp-origin";

async function readBoundedBody(request: Request, limit: number) {
  const declaredSize = request.headers.get("content-length");
  if (declaredSize && Number(declaredSize) > limit)
    throw new McpOperationError(
      "FILE_TOO_LARGE",
      "上传文件超过大小限制。",
      false,
      { maxSize: limit },
    );
  if (!request.body)
    throw new McpOperationError("EMPTY_FILE", "上传内容不能为空。");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new McpOperationError(
          "FILE_TOO_LARGE",
          "上传文件超过大小限制。",
          false,
          { maxSize: limit },
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function handleMcpUploadRequest(
  request: Request,
  context: McpToolContext,
) {
  if (!isAllowedMcpOrigin(request)) return createInvalidOriginResponse();
  const url = new URL(request.url);
  if (url.pathname !== "/api/mcp/uploads")
    return new Response("Not Found", { status: 404 });
  if (request.method !== "POST")
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  try {
    const kind = url.searchParams.get("kind");
    if (kind !== "image" && kind !== "zip")
      throw new McpOperationError(
        "INVALID_UPLOAD_KIND",
        "kind 必须为 image 或 zip。",
      );
    requireMcpIdentity(
      context,
      kind === "image"
        ? { media: ["write"] }
        : { posts: ["write"], media: ["write"] },
    );
    const fileName = url.searchParams.get("fileName");
    assertMcpFileName(fileName);
    const mimeType = request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (!mimeType)
      throw new McpOperationError(
        "CONTENT_TYPE_REQUIRED",
        "需要与文件匹配的 Content-Type。",
      );
    const bytes = await readBoundedBody(
      request,
      kind === "image" ? MAX_FILE_SIZE : MAX_ZIP_UPLOAD_SIZE,
    );
    const result = await stageMcpUpload(
      context,
      new File([bytes], fileName, { type: mimeType }),
      kind,
    );
    return applyMcpOriginPolicy(
      request,
      Response.json(result, {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }),
    );
  } catch (error) {
    const result = mcpOperationErrorResult(error);
    const status =
      error instanceof McpOperationError
        ? error.code === "UNAUTHENTICATED"
          ? 401
          : error.code === "INSUFFICIENT_SCOPE"
            ? 403
            : error.code === "FILE_TOO_LARGE"
              ? 413
              : 400
        : 500;
    return applyMcpOriginPolicy(
      request,
      Response.json(result.structuredContent, {
        status,
        headers: { "Cache-Control": "no-store" },
      }),
    );
  }
}

export class McpUploadHandler extends WorkerEntrypoint<Env> {
  async fetch(request: Request) {
    const executionCtx = this.ctx as ExecutionContext & {
      props?: Record<string, unknown>;
    };
    return handleMcpUploadRequest(request, {
      env: this.env,
      db: getDb(this.env),
      executionCtx,
      principal: createOAuthPrincipalFromProps(executionCtx.props ?? {}),
    });
  }
}
