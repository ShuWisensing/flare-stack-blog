import { z } from "zod";
import {
  ImportFailedSchema,
  ImportImageFailureSchema,
  ImportOutcomeSchema,
  ImportSkippedSchema,
  ImportSucceededSchema,
} from "@/features/import-export/import-export.schema";

export const McpImportZipInputSchema = z.object({
  uploadId: z.string().uuid(),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  targetStatus: z.literal("draft"),
  dryRun: z.boolean().default(true),
});
export const McpImportZipOutputSchema = z.object({
  dryRun: z.boolean(),
  mode: z.enum(["native", "markdown"]),
  targetStatus: z.literal("draft"),
  total: z.number(),
  taskId: z.string().uuid().optional(),
  expiresAt: z.string().optional(),
  preflight: z
    .array(
      z.object({
        entryPath: z.string(),
        title: z.string(),
        slug: z.string().optional(),
        action: z.enum(["create", "skip", "fail"]),
        code: z.string().optional(),
        reason: z.string().optional(),
        imageCount: z.number().optional(),
        remoteImageCount: z.number().optional(),
        imageFailures: z.array(
          ImportImageFailureSchema.omit({ title: true, entryPath: true }),
        ),
      }),
    )
    .optional(),
});
export const McpImportProgressInputSchema = z.object({
  taskId: z.string().uuid(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(50).default(20),
});
export const McpImportProgressOutputSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  outcome: ImportOutcomeSchema,
  total: z.number(),
  completed: z.number(),
  current: z.string(),
  counts: z.object({
    succeeded: z.number(),
    skipped: z.number(),
    failed: z.number(),
    imageFailures: z.number(),
  }),
  succeeded: z.array(
    ImportSucceededSchema.extend({
      postId: z.number(),
      status: z.enum(["draft", "published"]),
      adminUrl: z.string().url(),
    }),
  ),
  skipped: z.array(ImportSkippedSchema),
  failed: z.array(ImportFailedSchema),
  imageFailures: z.array(ImportImageFailureSchema),
  warnings: z.array(z.string()),
  fatalError: z.object({ code: z.string(), message: z.string() }).optional(),
  pagination: z.object({
    offset: z.number(),
    limit: z.number(),
    nextOffset: z.number().nullable(),
  }),
  expiresAt: z.string(),
  pollAfterSeconds: z.number().nullable(),
});
