import { z } from "zod";
import * as MediaService from "@/features/media/service/media.service";
import * as OperationRepo from "../../../data/mcp-operations.data";
import {
  McpOperationError,
  mcpOperationErrorResult,
  mcpOperationResult,
  withMcpOperationError,
} from "../../../service/mcp-operation-error";
import { defineMcpTool } from "../../../service/mcp-tool";
import {
  getMcpUpload,
  readMcpUpload,
  reserveMcpOperation,
} from "../../../service/mcp-upload.service";

export const mediaUploadTool = defineMcpTool({
  name: "media_upload",
  description:
    "Upload one image to the existing media library. First POST raw image bytes to /api/mcp/uploads?kind=image&fileName=<encoded-name> with the same OAuth Bearer token and matching Content-Type; pass its uploadId here, not a local path or an R2 key. Reuse requestId when retrying the same file. Returns a full image URL; does not create or publish a post.",
  requiredScopes: { media: ["write"] },
  structuredErrors: true,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: z.object({
    uploadId: z.string().uuid(),
    requestId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  }),
  outputSchema: withMcpOperationError(
    z.object({
      id: z.number(),
      key: z.string(),
      url: z.string().url(),
      fileName: z.string(),
      mimeType: z.string(),
      sizeInBytes: z.number(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    }),
  ),
  async handler(args, context) {
    let claim: { id: string; owner: string } | undefined;
    try {
      const upload = await getMcpUpload(context, args.uploadId, "image");
      const operation = await reserveMcpOperation(
        context,
        upload,
        "media_upload",
        args.requestId,
      );
      if (operation.result) return mcpOperationResult(operation.result);
      const file = await readMcpUpload(context, upload);
      const owner = crypto.randomUUID();
      if (
        !(await OperationRepo.claimOperation(context.db, operation.id, owner))
      )
        throw new McpOperationError(
          "REQUEST_IN_PROGRESS",
          "同一请求正在处理中，请稍后使用相同 requestId 重试。",
          true,
        );
      claim = { id: operation.id, owner };
      const result = await MediaService.upload(context, {
        file,
        storageKey: `mcp-${operation.id}.${file.type === "image/jpeg" || file.type === "image/jpg" ? "jpg" : file.type.slice(6)}`,
      });
      if (result.error)
        throw new McpOperationError(
          result.error.reason,
          "图片保存失败，请重试。",
          true,
        );
      const media = result.data;
      const output = {
        id: media.id,
        key: media.key,
        url: `https://${context.env.DOMAIN}${media.url}`,
        fileName: media.fileName,
        mimeType: media.mimeType,
        sizeInBytes: media.sizeInBytes,
        width: media.width,
        height: media.height,
      };
      await OperationRepo.finishOperation(
        context.db,
        operation.id,
        owner,
        output,
        "completed",
      );
      await context.env.R2.delete(upload.r2Key);
      return mcpOperationResult(output);
    } catch (error) {
      if (claim)
        await OperationRepo.releaseOperation(context.db, claim.id, claim.owner);
      return mcpOperationErrorResult(error);
    }
  },
});
