import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./helper";
import { PostsTable } from "./posts.table";

export const McpUploadsTable = sqliteTable("mcp_uploads", {
  id: text().primaryKey(),
  subject: text().notNull(),
  clientId: text("client_id").notNull(),
  kind: text({ enum: ["image", "zip"] }).notNull(),
  r2Key: text("r2_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeInBytes: integer("size_in_bytes").notNull(),
  sha256: text().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt,
});

export const McpOperationsTable = sqliteTable(
  "mcp_operations",
  {
    id: text().primaryKey(),
    subject: text().notNull(),
    clientId: text("client_id").notNull(),
    kind: text({ enum: ["media_upload", "posts_import_zip"] }).notNull(),
    requestId: text("request_id").notNull(),
    fingerprint: text().notNull(),
    uploadId: text("upload_id").notNull(),
    status: text({
      enum: ["pending", "processing", "completed", "failed"],
    }).notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    result: text({ mode: "json" }).$type<Record<string, unknown>>(),
    progress: text({ mode: "json" }).$type<Record<string, unknown>>(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("mcp_operations_request_idx").on(
      table.subject,
      table.clientId,
      table.kind,
      table.requestId,
    ),
  ],
);

// 与文章和关联表同批提交，避免 Workflow 重放时把已导入文章误报为跳过。
export const ImportEntriesTable = sqliteTable(
  "import_entries",
  {
    taskId: text("task_id").notNull(),
    entryPath: text("entry_path").notNull(),
    postId: integer("post_id")
      .notNull()
      .references(() => PostsTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.entryPath] })],
);
