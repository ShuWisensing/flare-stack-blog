import type { JSONContent } from "@tiptap/react";
import * as MediaService from "@/features/media/service/media.service";
import {
  extractImageKey,
  getContentTypeFromKey,
} from "@/features/media/utils/media.utils";
import { validateImage } from "@/features/media/utils/validate-image";
import * as PostRepo from "@/features/posts/data/posts.data";
import { JsonContentSchema } from "@/features/posts/schema/json-content.schema";
import {
  extractAllImageKeys,
  highlightCodeBlocks,
  slugify,
} from "@/features/posts/utils/content";
import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { sha256 } from "@/lib/sha256";
import {
  findImportedPost,
  insertImportedPost,
} from "../data/import-posts.data";
import type { PostEntry, PostFrontmatter } from "../import-export.schema";
import { normalizeFrontmatter, parseFrontmatter } from "../utils/frontmatter";
import { markdownToJsonContent } from "../utils/markdown-parser";
import { listDirectories, readTextFile } from "../utils/zip";

export type ImportImageFailure = {
  source: string;
  code: string;
  reason: string;
};

export class ImportPostError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly imageFailures: ImportImageFailure[] = [],
  ) {
    super(message);
    this.name = "ImportPostError";
  }
}

function makeEntry(
  zipFiles: Record<string, Uint8Array>,
  entry: PostEntry,
): PostEntry {
  const path = entry.mdPath ?? `${entry.prefix}/index.md`;
  const markdown = readTextFile(zipFiles, path);
  if (markdown === null)
    return { ...entry, metadataError: "MARKDOWN_NOT_FOUND" };
  try {
    const normalized = normalizeFrontmatter(parseFrontmatter(markdown).data);
    if (!normalized) return { ...entry, metadataError: "INVALID_METADATA" };
    return { ...entry, title: normalized.title || entry.dir };
  } catch (error) {
    return { ...entry, metadataError: String(error) };
  }
}

export function enumerateNativePosts(
  zipFiles: Record<string, Uint8Array>,
): PostEntry[] {
  return listDirectories(zipFiles, "posts/").map((dir) =>
    makeEntry(zipFiles, { dir, title: dir, prefix: `posts/${dir}` }),
  );
}

export function enumerateMarkdownPosts(
  zipFiles: Record<string, Uint8Array>,
): PostEntry[] {
  return Object.keys(zipFiles)
    .filter(
      (path) =>
        path.toLowerCase().endsWith(".md") && !path.startsWith("__MACOSX/"),
    )
    .map((path) => {
      const dir = path.slice(0, -3).split("/").pop()!;
      return makeEntry(zipFiles, {
        dir,
        title: dir,
        prefix: path.substring(0, path.lastIndexOf("/")),
        mdPath: path,
      });
    });
}

export function importEntryPath(entry: PostEntry) {
  return entry.mdPath ?? `${entry.prefix}/index.md`;
}

export function resolveRelativePath(base: string, relative: string): string {
  if (
    relative.startsWith("/") ||
    relative.includes("\\") ||
    relative.includes(":") ||
    relative.includes("\0")
  )
    throw new ImportPostError("UNSAFE_IMAGE_PATH", "图片路径不安全。");
  const parts = base ? base.split("/") : [];
  for (const segment of relative.split("/")) {
    if (segment === "..") {
      if (parts.length === 0)
        throw new ImportPostError(
          "UNSAFE_IMAGE_PATH",
          "图片引用越过 ZIP 根目录。",
        );
      parts.pop();
    } else if (segment !== "." && segment !== "") parts.push(segment);
  }
  return parts.join("/");
}

type PreparedPost = {
  title: string;
  slug: string;
  metadata: PostFrontmatter;
  contentJson: JSONContent;
  status: "draft" | "published";
};

export async function prepareImportPost(
  zipFiles: Record<string, Uint8Array>,
  entry: PostEntry,
  mode: "native" | "markdown",
  statusPolicy: "preserve" | "force-draft",
): Promise<PreparedPost> {
  if (entry.metadataError)
    throw new ImportPostError("INVALID_METADATA", entry.metadataError);
  const path = importEntryPath(entry);
  const markdown = readTextFile(zipFiles, path);
  if (markdown === null)
    throw new ImportPostError("MARKDOWN_NOT_FOUND", `找不到文章文件：${path}`);
  if (zipFiles[path].byteLength > 2 * 1024 * 1024)
    throw new ImportPostError("POST_TOO_LARGE", "单篇文章不能超过 2 MiB。");
  let parsed: ReturnType<typeof parseFrontmatter>;
  try {
    parsed = parseFrontmatter(markdown);
  } catch {
    throw new ImportPostError("INVALID_METADATA", "文章 frontmatter 无效。");
  }
  const metadata = normalizeFrontmatter(parsed.data);
  if (!metadata || metadata.readTimeInMinutes < 1 || metadata.tags.length > 50)
    throw new ImportPostError("INVALID_METADATA", "文章元数据无效。");
  const title = metadata.title.trim() || entry.dir;
  if (
    title.length > 200 ||
    metadata.slug.length > 200 ||
    (metadata.summary?.length ?? 0) > 4000
  )
    throw new ImportPostError("INVALID_METADATA", "标题、slug 或摘要过长。");
  let contentJson: JSONContent;
  const jsonPath = `${entry.prefix}/content.json`;
  if (mode === "native" && Object.hasOwn(zipFiles, jsonPath)) {
    if (zipFiles[jsonPath].byteLength > 2 * 1024 * 1024)
      throw new ImportPostError("POST_TOO_LARGE", "单篇正文不能超过 2 MiB。");
    try {
      contentJson = JsonContentSchema.parse(
        JSON.parse(readTextFile(zipFiles, jsonPath)!),
      );
    } catch {
      throw new ImportPostError(
        "INVALID_CONTENT_JSON",
        "包内 content.json 损坏或结构不正确。",
      );
    }
  } else {
    if (!parsed.content.trim())
      throw new ImportPostError("EMPTY_CONTENT", "文章正文为空。");
    try {
      contentJson = await markdownToJsonContent(parsed.content);
    } catch {
      throw new ImportPostError(
        "MARKDOWN_CONVERSION_FAILED",
        "Markdown 正文转换失败。",
      );
    }
  }
  if (contentJson.type !== "doc" || !contentJson.content?.length)
    throw new ImportPostError("EMPTY_CONTENT", "文章正文为空或根节点不正确。");
  return {
    title,
    slug: slugify(metadata.slug || title),
    metadata,
    contentJson,
    status: statusPolicy === "force-draft" ? "draft" : metadata.status,
  };
}

function visitImages(node: JSONContent, visit: (node: JSONContent) => void) {
  if (node.type === "image") visit(node);
  node.content?.forEach((child) => visitImages(child, visit));
}

/** 只读取包内图片，不下载外链；所有本地引用先校验，避免导入半篇文章。 */
export async function inspectPostImages(
  zipFiles: Record<string, Uint8Array>,
  entry: PostEntry,
  mode: "native" | "markdown",
  contentJson: JSONContent,
) {
  const sources = new Set<string>();
  visitImages(contentJson, (node) => {
    sources.add(typeof node.attrs?.src === "string" ? node.attrs.src : "");
  });
  const images: { source: string; path: string; file: File }[] = [];
  const imageFailures: ImportImageFailure[] = [];
  let remoteImageCount = 0;
  for (const source of sources) {
    try {
      const oldKey = mode === "native" ? extractImageKey(source) : undefined;
      if (!oldKey && /^https?:\/\//i.test(source)) {
        new URL(source);
        remoteImageCount++;
        continue;
      }
      if (
        !source ||
        (!oldKey &&
          (/^[a-z][a-z0-9+.-]*:/i.test(source) || source.startsWith("//")))
      )
        throw new ImportPostError(
          "IMAGE_SOURCE_UNSUPPORTED",
          "仅支持包内图片和 HTTP(S) 外链。",
        );
      const relative = oldKey
        ? `images/${oldKey}`
        : decodeURIComponent(source.split(/[?#]/)[0]);
      const path = resolveRelativePath(entry.prefix, relative);
      const bytes = zipFiles[path];
      if (!bytes)
        throw new ImportPostError(
          "IMAGE_NOT_FOUND",
          `图片未在 ZIP 中找到：${source}`,
        );
      const fileName = path.split("/").pop()!;
      const mimeType = getContentTypeFromKey(fileName);
      if (!mimeType)
        throw new ImportPostError(
          "UNSUPPORTED_IMAGE_TYPE",
          `不支持的图片类型：${source}`,
        );
      const file = new File([new Uint8Array(bytes)], fileName, {
        type: mimeType,
      });
      await validateImage(file);
      images.push({ source, path, file });
    } catch (error) {
      imageFailures.push({
        source,
        code: error instanceof ImportPostError ? error.code : "INVALID_IMAGE",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (imageFailures.length > 0)
    throw new ImportPostError(
      "IMAGE_IMPORT_FAILED",
      "图片校验失败，文章未导入。",
      imageFailures,
    );
  return { images, remoteImageCount };
}

export async function importSinglePost(
  env: Env,
  zipFiles: Record<string, Uint8Array>,
  entry: PostEntry,
  mode: "native" | "markdown",
  _locale: Locale = "zh",
  options: { statusPolicy: "preserve" | "force-draft"; taskId?: string } = {
    statusPolicy: "preserve",
  },
) {
  const db = getDb(env);
  const entryPath = importEntryPath(entry);
  const warnings: string[] = [];
  if (options.taskId) {
    const previous = await findImportedPost(db, options.taskId, entryPath);
    if (previous)
      return {
        postId: previous.id,
        title: previous.title,
        slug: previous.slug,
        status: previous.status,
        warnings,
      };
  }
  const prepared = await prepareImportPost(
    zipFiles,
    entry,
    mode,
    options.statusPolicy,
  );
  const existing = await PostRepo.findPostBySlug(db, prepared.slug);
  if (existing)
    return {
      postId: existing.id,
      title: prepared.title,
      slug: existing.slug,
      status: existing.status,
      skipped: true,
      warnings,
    };
  const { images, remoteImageCount } = await inspectPostImages(
    zipFiles,
    entry,
    mode,
    prepared.contentJson,
  );
  if (remoteImageCount > 0)
    warnings.push(
      `${remoteImageCount} 张外链图片保留原地址，未下载或验证可访问性。`,
    );
  const rewrites = new Map<string, string>();
  const taskId = options.taskId ?? crypto.randomUUID();
  const uploadedKeys: string[] = [];
  try {
    for (const image of images) {
      try {
        const digest = await sha256(
          new Uint8Array(await image.file.arrayBuffer()),
        );
        const keyHash = await sha256(
          new TextEncoder().encode(`${taskId}:${image.path}:${digest}`),
        );
        const extension =
          image.file.type === "image/jpeg" ? "jpg" : image.file.type.slice(6);
        const result = await MediaService.upload(
          { env, db },
          { file: image.file, storageKey: `import-${keyHash}.${extension}` },
        );
        if (result.error) throw new Error(result.error.reason);
        uploadedKeys.push(result.data.key);
        rewrites.set(image.source, `${result.data.url}?quality=80`);
      } catch (error) {
        throw new ImportPostError(
          "IMAGE_IMPORT_FAILED",
          "图片上传失败，文章未导入。",
          [
            {
              source: image.source,
              code: "IMAGE_UPLOAD_FAILED",
              reason: error instanceof Error ? error.message : String(error),
            },
          ],
        );
      }
    }
    visitImages(prepared.contentJson, (node) => {
      const rewritten = rewrites.get(node.attrs?.src);
      if (rewritten) node.attrs = { ...node.attrs, src: rewritten };
    });
    const contentJson = await highlightCodeBlocks(prepared.contentJson);
    const post = await insertImportedPost(
      db,
      {
        title: prepared.title,
        slug: prepared.slug,
        summary: prepared.metadata.summary ?? null,
        contentJson,
        status: prepared.status,
        readTimeInMinutes: prepared.metadata.readTimeInMinutes,
        publishedAt:
          prepared.status === "draft"
            ? null
            : prepared.metadata.publishedAt
              ? new Date(prepared.metadata.publishedAt)
              : new Date(),
      },
      prepared.metadata.tags,
      extractAllImageKeys(contentJson),
      options.taskId ? { taskId: options.taskId, entryPath } : undefined,
    );
    return {
      postId: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      warnings,
    };
  } catch (error) {
    await MediaService.rollbackUnusedUploads({ env, db }, uploadedKeys);
    throw error;
  }
}
