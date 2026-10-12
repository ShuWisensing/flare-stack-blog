import { and, eq, isNull, lt, or } from "drizzle-orm";
import { McpOperationsTable, McpUploadsTable } from "@/lib/db/schema";

export type McpUpload = typeof McpUploadsTable.$inferSelect;
export type McpOperation = typeof McpOperationsTable.$inferSelect;

export async function findExpiredUploads(
  db: DB,
  subject: string,
  clientId: string,
) {
  return await db
    .select()
    .from(McpUploadsTable)
    .where(
      and(
        eq(McpUploadsTable.subject, subject),
        eq(McpUploadsTable.clientId, clientId),
        lt(
          McpUploadsTable.expiresAt,
          new Date(Date.now() - 24 * 60 * 60 * 1000),
        ),
      ),
    )
    .limit(25);
}

export async function deleteExpiredUpload(db: DB, id: string) {
  await db.delete(McpUploadsTable).where(eq(McpUploadsTable.id, id));
}

export async function insertUpload(
  db: DB,
  data: typeof McpUploadsTable.$inferInsert,
) {
  await db.insert(McpUploadsTable).values(data);
}

export async function findUpload(
  db: DB,
  id: string,
  subject: string,
  clientId: string,
) {
  const [upload] = await db
    .select()
    .from(McpUploadsTable)
    .where(
      and(
        eq(McpUploadsTable.id, id),
        eq(McpUploadsTable.subject, subject),
        eq(McpUploadsTable.clientId, clientId),
      ),
    );
  return upload;
}

export async function reserveOperation(
  db: DB,
  data: typeof McpOperationsTable.$inferInsert,
) {
  await db.insert(McpOperationsTable).values(data).onConflictDoNothing();
  const [operation] = await db
    .select()
    .from(McpOperationsTable)
    .where(
      and(
        eq(McpOperationsTable.subject, data.subject),
        eq(McpOperationsTable.clientId, data.clientId),
        eq(McpOperationsTable.kind, data.kind),
        eq(McpOperationsTable.requestId, data.requestId),
      ),
    );
  return operation;
}

export async function findOperation(
  db: DB,
  id: string,
  subject: string,
  clientId: string,
) {
  const [operation] = await db
    .select()
    .from(McpOperationsTable)
    .where(
      and(
        eq(McpOperationsTable.id, id),
        eq(McpOperationsTable.subject, subject),
        eq(McpOperationsTable.clientId, clientId),
      ),
    );
  return operation;
}

export async function claimOperation(db: DB, id: string, owner: string) {
  const [claimed] = await db
    .update(McpOperationsTable)
    .set({
      status: "processing",
      leaseOwner: owner,
      leaseExpiresAt: new Date(Date.now() + 300_000),
    })
    .where(
      and(
        eq(McpOperationsTable.id, id),
        isNull(McpOperationsTable.result),
        or(
          isNull(McpOperationsTable.leaseExpiresAt),
          lt(McpOperationsTable.leaseExpiresAt, new Date()),
        ),
      ),
    )
    .returning();
  return claimed;
}

export async function finishOperation(
  db: DB,
  id: string,
  owner: string,
  result: Record<string, unknown>,
  status?: McpOperation["status"],
) {
  await db
    .update(McpOperationsTable)
    .set({
      result,
      ...(status ? { status } : {}),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(
      and(
        eq(McpOperationsTable.id, id),
        eq(McpOperationsTable.leaseOwner, owner),
      ),
    );
}

export async function releaseOperation(db: DB, id: string, owner: string) {
  await db
    .update(McpOperationsTable)
    .set({ status: "failed", leaseOwner: null, leaseExpiresAt: null })
    .where(
      and(
        eq(McpOperationsTable.id, id),
        eq(McpOperationsTable.leaseOwner, owner),
      ),
    );
}

export async function saveImportProgress(
  db: DB,
  id: string,
  progress: Record<string, unknown> & { status: McpOperation["status"] },
) {
  await db
    .update(McpOperationsTable)
    .set({ progress, status: progress.status })
    .where(
      and(
        eq(McpOperationsTable.id, id),
        eq(McpOperationsTable.kind, "posts_import_zip"),
      ),
    );
}
