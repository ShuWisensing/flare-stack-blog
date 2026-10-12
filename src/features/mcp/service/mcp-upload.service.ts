import { MAX_FILE_SIZE } from "@/features/media/media.schema";
import { validateImage } from "@/features/media/utils/validate-image";
import { sha256 } from "@/lib/sha256";
import * as UploadRepo from "../data/mcp-operations.data";
import type { McpToolContext } from "./mcp.types";
import { McpOperationError, requireMcpIdentity } from "./mcp-operation-error";

export const MAX_ZIP_UPLOAD_SIZE = 20 * 1024 * 1024;
export const MCP_UPLOAD_TTL_MS = 60 * 60 * 1000;

export function assertMcpFileName(name: string | null): asserts name is string {
  if (
    !name ||
    name.length > 200 ||
    name.includes("/") ||
    name.includes("\\") ||
    Array.from(name).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  ) {
    throw new McpOperationError(
      "INVALID_FILE_NAME",
      "文件名不能包含路径或控制字符。",
    );
  }
}

export async function stageMcpUpload(
  context: McpToolContext,
  file: File,
  kind: "image" | "zip",
) {
  const identity = requireMcpIdentity(
    context,
    kind === "image"
      ? { media: ["write"] }
      : { posts: ["write"], media: ["write"] },
  );
  assertMcpFileName(file.name);
  const maxSize = kind === "image" ? MAX_FILE_SIZE : MAX_ZIP_UPLOAD_SIZE;
  if (file.size === 0 || file.size > maxSize)
    throw new McpOperationError(
      "INVALID_FILE_SIZE",
      "文件为空或超过大小限制。",
      false,
      { maxSize },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "image") {
    try {
      await validateImage(file);
    } catch (error) {
      throw new McpOperationError(
        "INVALID_IMAGE",
        "图片格式、内容或尺寸无效。",
        false,
        { reason: String(error) },
      );
    }
  } else if (
    !file.name.toLowerCase().endsWith(".zip") ||
    ![
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ].includes(file.type) ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b
  ) {
    throw new McpOperationError("INVALID_ZIP", "需要有效的 ZIP 文件。");
  }
  const uploadId = crypto.randomUUID();
  const r2Key = `mcp-uploads/${uploadId}`;
  const expiresAt = new Date(Date.now() + MCP_UPLOAD_TTL_MS);
  const hash = await sha256(bytes);
  // 延迟到最长任务保留期之后清理临时对象，避免删除正在导入的 ZIP。
  const expiredUploads = await UploadRepo.findExpiredUploads(
    context.db,
    identity.subject,
    identity.clientId,
  );
  for (const expired of expiredUploads) {
    if (expired.r2Key !== `mcp-uploads/${expired.id}`)
      throw new McpOperationError(
        "INVALID_UPLOAD_RECORD",
        "临时文件记录损坏，停止清理。",
      );
    await context.env.R2.delete(expired.r2Key);
    await UploadRepo.deleteExpiredUpload(context.db, expired.id);
  }
  await context.env.R2.put(r2Key, bytes, {
    httpMetadata: { contentType: file.type },
  });
  try {
    await UploadRepo.insertUpload(context.db, {
      id: uploadId,
      ...identity,
      kind,
      r2Key,
      fileName: file.name,
      mimeType: file.type,
      sizeInBytes: file.size,
      sha256: hash,
      expiresAt,
    });
  } catch (error) {
    await context.env.R2.delete(r2Key);
    throw error;
  }
  return {
    uploadId,
    kind,
    fileName: file.name,
    sizeInBytes: file.size,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getMcpUpload(
  context: McpToolContext,
  uploadId: string,
  kind: "image" | "zip",
) {
  const identity = requireMcpIdentity(
    context,
    kind === "image"
      ? { media: ["write"] }
      : { posts: ["write"], media: ["write"] },
  );
  const upload = await UploadRepo.findUpload(
    context.db,
    uploadId,
    identity.subject,
    identity.clientId,
  );
  if (!upload || upload.kind !== kind)
    throw new McpOperationError(
      "UPLOAD_NOT_FOUND",
      "上传凭证不存在、类型不符或不属于当前客户端。",
    );
  return upload;
}

export async function readMcpUpload(
  context: McpToolContext,
  upload: UploadRepo.McpUpload,
) {
  if (upload.expiresAt.getTime() <= Date.now())
    throw new McpOperationError(
      "UPLOAD_EXPIRED",
      "上传凭证已过期，请重新上传文件。",
    );
  const object = await context.env.R2.get(upload.r2Key);
  if (!object)
    throw new McpOperationError(
      "UPLOAD_FILE_MISSING",
      "上传文件已不存在，请重新上传。",
    );
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (
    bytes.byteLength !== upload.sizeInBytes ||
    (await sha256(bytes)) !== upload.sha256
  )
    throw new McpOperationError(
      "UPLOAD_INTEGRITY_FAILED",
      "上传文件校验失败。",
    );
  return new File([bytes], upload.fileName, { type: upload.mimeType });
}

export async function reserveMcpOperation(
  context: McpToolContext,
  upload: UploadRepo.McpUpload,
  kind: UploadRepo.McpOperation["kind"],
  requestId: string,
  policy = "",
) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId))
    throw new McpOperationError(
      "INVALID_REQUEST_ID",
      "requestId 需要 8 至 128 位字母、数字、短横线或下划线。",
    );
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify([
        kind,
        upload.sha256,
        upload.fileName,
        upload.mimeType,
        policy,
      ]),
    ),
  );
  const operation = await UploadRepo.reserveOperation(context.db, {
    id: crypto.randomUUID(),
    subject: upload.subject,
    clientId: upload.clientId,
    kind,
    requestId,
    fingerprint,
    uploadId: upload.id,
    status: "pending",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  if (operation.fingerprint !== fingerprint)
    throw new McpOperationError(
      "IDEMPOTENCY_CONFLICT",
      "同一 requestId 已用于不同文件或参数，请使用新的 requestId。",
    );
  if (operation.expiresAt.getTime() <= Date.now())
    throw new McpOperationError(
      "REQUEST_EXPIRED",
      "该请求记录已过期，请使用新的 requestId。",
    );
  return operation;
}
