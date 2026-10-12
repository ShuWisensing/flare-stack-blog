import { m } from "@/paraglide/messages";
import type {
  ImportReport,
  PostEntry,
  TaskProgress,
} from "../import-export.schema";
import {
  ImportPostError,
  importEntryPath,
  importSinglePost,
} from "./import-helpers";

export function emptyImportReport() {
  return {
    succeeded: [],
    failed: [],
    warnings: [],
    skipped: [],
    imageFailures: [],
  } as ImportReport & {
    skipped: NonNullable<ImportReport["skipped"]>;
    imageFailures: NonNullable<ImportReport["imageFailures"]>;
  };
}

export function importProgress(
  report: ReturnType<typeof emptyImportReport>,
  total: number,
  completed: number,
  status: TaskProgress["status"],
  current = "",
  fatalError?: TaskProgress["fatalError"],
): TaskProgress {
  const outcome =
    status === "failed"
      ? "failed"
      : status !== "completed"
        ? "in_progress"
        : report.failed.length === total
          ? "all_failed"
          : report.failed.length > 0
            ? "partial_failure"
            : report.skipped.length === total
              ? "all_skipped"
              : "all_success";
  return {
    status,
    outcome,
    total,
    completed,
    current,
    errors: report.failed.map((entry) => ({
      post: entry.title,
      reason: entry.reason,
    })),
    warnings: report.warnings,
    report,
    ...(fatalError ? { fatalError } : {}),
  };
}

export async function importPostStep(
  env: Env,
  zipFiles: Record<string, Uint8Array>,
  entry: PostEntry,
  mode: "native" | "markdown",
  taskId: string,
  statusPolicy: "preserve" | "force-draft",
  locale: "zh" | "en",
) {
  const report = emptyImportReport();
  const entryPath = importEntryPath(entry);
  try {
    const result = await importSinglePost(env, zipFiles, entry, mode, locale, {
      taskId,
      statusPolicy,
    });
    if (result.skipped) {
      report.skipped.push({
        postId: result.postId,
        title: result.title,
        slug: result.slug,
        entryPath,
        reason: "SLUG_ALREADY_EXISTS",
      });
      report.warnings.push(
        m.import_export_import_warning_slug_skipped(
          { title: result.title },
          { locale },
        ),
      );
    } else
      report.succeeded.push({
        postId: result.postId,
        title: result.title,
        slug: result.slug,
        status: result.status,
        entryPath,
      });
    report.warnings.push(
      ...result.warnings.map((warning) => `${result.title}: ${warning}`),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof ImportPostError ? error.code : "POST_IMPORT_FAILED";
    report.failed.push({ title: entry.title, entryPath, reason, code });
    if (error instanceof ImportPostError)
      report.imageFailures.push(
        ...error.imageFailures.map((failure) => ({
          ...failure,
          title: entry.title,
          entryPath,
        })),
      );
    console.error(
      JSON.stringify({
        message: "post import failed",
        taskId,
        entryPath,
        code,
        error: reason,
      }),
    );
  }
  return report;
}
