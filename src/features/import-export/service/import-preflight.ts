import { McpOperationError } from "@/features/mcp/service/mcp-operation-error";
import * as PostRepo from "@/features/posts/data/posts.data";
import {
  EXPORT_MANIFEST_VERSION,
  ExportManifestSchema,
} from "../import-export.schema";
import { parseZip, readValidatedJsonFile } from "../utils/zip";
import {
  enumerateMarkdownPosts,
  enumerateNativePosts,
  ImportPostError,
  importEntryPath,
  inspectPostImages,
  prepareImportPost,
} from "../workflows/import-helpers";

export function inspectImportArchive(bytes: Uint8Array) {
  let files: Record<string, Uint8Array>;
  try {
    files = parseZip(bytes);
  } catch (error) {
    throw new McpOperationError(
      "INVALID_ARCHIVE",
      "ZIP 损坏、路径不安全或超过解压限制。",
      false,
      { reason: error instanceof Error ? error.message : String(error) },
    );
  }
  const hasManifest = Object.hasOwn(files, "manifest.json");
  const manifest = hasManifest
    ? readValidatedJsonFile(files, "manifest.json", ExportManifestSchema)
    : null;
  if (
    hasManifest &&
    (!manifest || manifest.version !== EXPORT_MANIFEST_VERSION)
  )
    throw new McpOperationError(
      "INVALID_MANIFEST",
      "manifest.json 无效或版本不受支持。",
    );
  const mode = hasManifest ? ("native" as const) : ("markdown" as const);
  const entries =
    mode === "native"
      ? enumerateNativePosts(files)
      : enumerateMarkdownPosts(files);
  if (entries.length === 0)
    throw new McpOperationError("NO_POSTS", "ZIP 内没有可识别的文章。");
  if (entries.length > 50)
    throw new McpOperationError(
      "POST_LIMIT_EXCEEDED",
      "每次最多导入 50 篇文章。",
    );
  if (manifest && manifest.postCount !== entries.length)
    throw new McpOperationError(
      "INVALID_MANIFEST",
      "manifest 的文章数量与包内目录不一致。",
    );
  return { files, mode, entries };
}

export async function preflightImport(
  db: DB,
  archive: ReturnType<typeof inspectImportArchive>,
) {
  const seen = new Set<string>();
  const previews: {
    entryPath: string;
    title: string;
    slug?: string;
    action: "create" | "skip" | "fail";
    code?: string;
    reason?: string;
    imageCount?: number;
    remoteImageCount?: number;
    imageFailures: { source: string; code: string; reason: string }[];
  }[] = [];
  for (const entry of archive.entries) {
    const entryPath = importEntryPath(entry);
    try {
      const post = await prepareImportPost(
        archive.files,
        entry,
        archive.mode,
        "force-draft",
      );
      if (seen.has(post.slug) || (await PostRepo.slugExists(db, post.slug))) {
        previews.push({
          entryPath,
          title: post.title,
          slug: post.slug,
          action: "skip",
          code: "SLUG_ALREADY_EXISTS",
          imageFailures: [],
        });
        continue;
      }
      const images = await inspectPostImages(
        archive.files,
        entry,
        archive.mode,
        post.contentJson,
      );
      previews.push({
        entryPath,
        title: post.title,
        slug: post.slug,
        action: "create",
        imageCount: images.images.length,
        remoteImageCount: images.remoteImageCount,
        imageFailures: [],
      });
      seen.add(post.slug);
    } catch (error) {
      previews.push({
        entryPath,
        title: entry.title,
        action: "fail",
        code: error instanceof ImportPostError ? error.code : "INVALID_POST",
        reason: error instanceof Error ? error.message : String(error),
        imageFailures:
          error instanceof ImportPostError ? error.imageFailures : [],
      });
    }
  }
  return previews;
}
