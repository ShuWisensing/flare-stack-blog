import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import * as CacheService from "@/features/cache/cache.service";
import { saveImportProgress } from "@/features/mcp/data/mcp-operations.data";
import { getDb } from "@/lib/db";
import { serverEnv } from "@/lib/env/server.env";
import {
  IMPORT_EXPORT_CACHE_KEYS,
  type TaskProgress,
} from "../import-export.schema";
import { parseZip } from "../utils/zip";
import { enumerateMarkdownPosts, enumerateNativePosts } from "./import-helpers";
import {
  emptyImportReport,
  importPostStep,
  importProgress,
} from "./import-report";

export class ImportWorkflow extends WorkflowEntrypoint<
  Env,
  ImportWorkflowParams
> {
  async run(event: WorkflowEvent<ImportWorkflowParams>, step: WorkflowStep) {
    const {
      taskId,
      r2Key,
      mode,
      tracked = false,
      statusPolicy = "preserve",
    } = event.payload;
    const locale = event.payload.locale ?? serverEnv(this.env).LOCALE;
    const report = emptyImportReport();
    let total = 0;
    let completed = 0;
    try {
      const entries = await step.do("enumerate posts", async () => {
        const files = await this.fetchZipFiles(r2Key);
        return mode === "native"
          ? enumerateNativePosts(files)
          : enumerateMarkdownPosts(files);
      });
      total = entries.length;
      if (total === 0) throw new Error("NO_POSTS");
      await this.updateProgress(
        taskId,
        tracked,
        importProgress(report, total, completed, "processing"),
      );
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const delta = await step.do(
          `import post ${i + 1}/${total}: ${entry.title.slice(0, 120)}`,
          async () => {
            // 二进制不经过 step 的 JSON 序列化；每步从 R2 重新读取。
            return importPostStep(
              this.env,
              await this.fetchZipFiles(r2Key),
              entry,
              mode,
              taskId,
              statusPolicy,
              locale,
            );
          },
        );
        report.succeeded.push(...delta.succeeded);
        report.failed.push(...delta.failed);
        report.skipped.push(...delta.skipped);
        report.imageFailures.push(...delta.imageFailures);
        report.warnings.push(...delta.warnings);
        completed = i + 1;
        // 完整报告随进度保存；重放时由各步的持久化返回值重新累积。
        await this.updateProgress(
          taskId,
          tracked,
          importProgress(report, total, completed, "processing", entry.title),
        );
      }
      await step.do("finalize", async () => {
        await this.updateProgress(
          taskId,
          tracked,
          importProgress(report, total, completed, "completed"),
        );
        await this.env.R2.delete(r2Key);
      });
      console.log(
        JSON.stringify({
          message: "import workflow completed",
          taskId,
          succeeded: report.succeeded.length,
          failed: report.failed.length,
          skipped: report.skipped.length,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({
          message: "import workflow failed",
          taskId,
          error: message,
        }),
      );
      // 保留已处理文章和图片失败信息，不把进度清零。
      await this.updateProgress(
        taskId,
        tracked,
        importProgress(report, total, completed, "failed", "", {
          code: "IMPORT_WORKFLOW_FAILED",
          message,
        }),
      );
      throw error;
    }
  }

  private async fetchZipFiles(r2Key: string) {
    const object = await this.env.R2.get(r2Key);
    if (!object) throw new Error("IMPORT_FILE_MISSING");
    return parseZip(new Uint8Array(await object.arrayBuffer()));
  }

  private async updateProgress(
    taskId: string,
    tracked: boolean,
    progress: TaskProgress,
  ) {
    if (tracked) await saveImportProgress(getDb(this.env), taskId, progress);
    else
      await CacheService.set(
        { env: this.env },
        IMPORT_EXPORT_CACHE_KEYS.importProgress(taskId),
        JSON.stringify(progress),
        { ttl: "24h" },
      );
  }
}
