import type { z } from "zod";
import { TaskProgressSchema } from "@/features/import-export/import-export.schema";
import {
  inspectImportArchive,
  preflightImport,
} from "@/features/import-export/service/import-preflight";
import {
  emptyImportReport,
  importProgress,
} from "@/features/import-export/workflows/import-report";
import * as OperationRepo from "../../../data/mcp-operations.data";
import type { McpToolContext } from "../../../service/mcp.types";
import {
  McpOperationError,
  requireMcpIdentity,
} from "../../../service/mcp-operation-error";
import {
  getMcpUpload,
  readMcpUpload,
  reserveMcpOperation,
} from "../../../service/mcp-upload.service";
import type {
  McpImportProgressInputSchema,
  McpImportZipInputSchema,
} from "../schema/mcp-imports.schema";

export async function importMcpZip(
  context: McpToolContext,
  input: z.output<typeof McpImportZipInputSchema>,
) {
  if (input.targetStatus !== "draft")
    throw new McpOperationError(
      "DRAFT_REQUIRED",
      "MCP 批量导入仅允许保存草稿。",
    );
  const upload = await getMcpUpload(context, input.uploadId, "zip");
  const operation = input.dryRun
    ? null
    : await reserveMcpOperation(
        context,
        upload,
        "posts_import_zip",
        input.requestId,
        "force-draft",
      );
  if (operation?.result) return operation.result;
  const file = await readMcpUpload(context, upload);
  const archive = inspectImportArchive(
    new Uint8Array(await file.arrayBuffer()),
  );
  if (input.dryRun)
    return {
      dryRun: true,
      mode: archive.mode,
      targetStatus: "draft",
      total: archive.entries.length,
      preflight: await preflightImport(context.db, archive),
    };
  if (!operation) throw new Error("IMPORT_OPERATION_MISSING");
  const owner = crypto.randomUUID();
  if (!(await OperationRepo.claimOperation(context.db, operation.id, owner)))
    throw new McpOperationError(
      "REQUEST_IN_PROGRESS",
      "请求正在提交，请使用相同 requestId 稍后重试。",
      true,
    );
  try {
    if (!operation.progress)
      await OperationRepo.saveImportProgress(
        context.db,
        operation.id,
        importProgress(
          emptyImportReport(),
          archive.entries.length,
          0,
          "pending",
        ),
      );
    // 固定 Workflow ID；仅明确的“实例已存在”可视作之前的提交已成功。
    try {
      await context.env.IMPORT_WORKFLOW.create({
        id: operation.id,
        params: {
          taskId: operation.id,
          r2Key: upload.r2Key,
          mode: archive.mode,
          locale: "zh",
          statusPolicy: "force-draft",
          tracked: true,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/\b10405\b|instance.*already exists/i.test(error.message)
      )
        throw error;
      await (await context.env.IMPORT_WORKFLOW.get(operation.id)).status();
    }
    const result = {
      dryRun: false,
      mode: archive.mode,
      targetStatus: "draft",
      total: archive.entries.length,
      taskId: operation.id,
      expiresAt: operation.expiresAt.toISOString(),
    };
    await OperationRepo.finishOperation(
      context.db,
      operation.id,
      owner,
      result,
    );
    return result;
  } catch (error) {
    await OperationRepo.releaseOperation(context.db, operation.id, owner);
    throw new McpOperationError(
      "WORKFLOW_CREATE_FAILED",
      "导入任务提交失败，请使用相同 requestId 重试。",
      true,
      { reason: error instanceof Error ? error.message : String(error) },
    );
  }
}

export async function getMcpImportProgress(
  context: McpToolContext,
  input: z.output<typeof McpImportProgressInputSchema>,
) {
  const identity = requireMcpIdentity(context, { posts: ["read"] });
  const task = await OperationRepo.findOperation(
    context.db,
    input.taskId,
    identity.subject,
    identity.clientId,
  );
  if (!task || task.kind !== "posts_import_zip")
    throw new McpOperationError(
      "TASK_NOT_FOUND",
      "导入任务不存在或不属于当前客户端。",
    );
  if (task.expiresAt.getTime() <= Date.now())
    throw new McpOperationError("TASK_EXPIRED", "导入任务记录已过期。");
  const parsed = TaskProgressSchema.safeParse(task.progress);
  if (
    !parsed.success ||
    !parsed.data.report?.skipped ||
    !parsed.data.report.imageFailures ||
    !parsed.data.outcome
  )
    throw new McpOperationError(
      "INVALID_PROGRESS_DATA",
      "导入任务状态不完整，请检查服务端日志。",
    );
  const progress = parsed.data;
  const report = parsed.data.report;
  const offset = input.offset;
  const end = offset + input.limit;
  const counts = {
    succeeded: report.succeeded.length,
    failed: report.failed.length,
    skipped: report.skipped!.length,
    imageFailures: report.imageFailures!.length,
  };
  const nextOffset =
    Math.max(...Object.values(counts), report.warnings.length) > end
      ? end
      : null;
  const succeeded = report.succeeded.slice(offset, end).map((post) => {
    if (!post.postId || !post.status)
      throw new McpOperationError(
        "INVALID_PROGRESS_DATA",
        "成功文章缺少 ID 或状态。",
      );
    return {
      ...post,
      postId: post.postId,
      status: post.status,
      adminUrl: `https://${context.env.DOMAIN}/admin/posts/edit/${post.postId}`,
    };
  });
  return {
    taskId: task.id,
    status: progress.status,
    outcome: progress.outcome,
    total: progress.total,
    completed: progress.completed,
    current: progress.current,
    counts,
    succeeded,
    skipped: report.skipped!.slice(offset, end),
    failed: report.failed.slice(offset, end),
    imageFailures: report.imageFailures!.slice(offset, end),
    warnings: report.warnings.slice(offset, end),
    ...(progress.fatalError ? { fatalError: progress.fatalError } : {}),
    pagination: { offset, limit: input.limit, nextOffset },
    expiresAt: task.expiresAt.toISOString(),
    pollAfterSeconds:
      progress.status === "pending" || progress.status === "processing"
        ? 3
        : null,
  };
}
