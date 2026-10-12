import { and, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  ImportEntriesTable,
  MediaTable,
  PostMediaTable,
  PostsTable,
  PostTagsTable,
  TagsTable,
} from "@/lib/db/schema";

export async function findImportedPost(
  db: DB,
  taskId: string,
  entryPath: string,
) {
  const [result] = await db
    .select({ post: PostsTable })
    .from(ImportEntriesTable)
    .innerJoin(PostsTable, eq(ImportEntriesTable.postId, PostsTable.id))
    .where(
      and(
        eq(ImportEntriesTable.taskId, taskId),
        eq(ImportEntriesTable.entryPath, entryPath),
      ),
    );
  return result?.post;
}

export async function insertImportedPost(
  db: DB,
  data: typeof PostsTable.$inferInsert,
  tagNames: string[],
  imageKeys: string[],
  checkpoint?: { taskId: string; entryPath: string },
) {
  const tags = [...new Set(tagNames)];
  if (tags.length > 0)
    await db
      .insert(TagsTable)
      .values(tags.map((name) => ({ name })))
      .onConflictDoNothing();
  const tagRecords =
    tags.length === 0
      ? []
      : await db
          .select({ id: TagsTable.id })
          .from(TagsTable)
          .where(inArray(TagsTable.name, tags));
  const media =
    imageKeys.length === 0
      ? []
      : await db
          .select({ id: MediaTable.id })
          .from(MediaTable)
          .where(inArray(MediaTable.key, [...new Set(imageKeys)]));
  const postId = sql<number>`(select id from posts where slug = ${data.slug})`;
  const statements: BatchItem<"sqlite">[] = [];
  if (tagRecords.length > 0)
    statements.push(
      db
        .insert(PostTagsTable)
        .values(tagRecords.map((tag) => ({ postId, tagId: tag.id }))),
    );
  if (media.length > 0)
    statements.push(
      db
        .insert(PostMediaTable)
        .values(media.map((item) => ({ postId, mediaId: item.id }))),
    );
  if (checkpoint)
    statements.push(
      db.insert(ImportEntriesTable).values({ ...checkpoint, postId }),
    );
  // D1 batch 是事务：文章、标签关联、媒体关联和重放凭证必须一起成功。
  const [inserted] = await db.batch([
    db.insert(PostsTable).values(data).returning(),
    ...statements,
  ]);
  return inserted[0];
}
