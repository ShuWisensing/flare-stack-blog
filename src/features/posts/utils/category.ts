import type { PostItem } from "@/features/posts/schema/posts.schema";

export const POST_CATEGORY_IDS = ["tracking", "paper", "practice"] as const;

export type PostCategoryId = (typeof POST_CATEGORY_IDS)[number];

export type PostCategoryFilter = PostCategoryId | "all";

export interface PostCategoryOption {
  id: PostCategoryFilter;
  label: string;
  description: string;
}

export const POST_CATEGORY_OPTIONS: Array<PostCategoryOption> = [
  {
    id: "all",
    label: "全部",
    description: "按发布时间查看所有文章",
  },
  {
    id: "tracking",
    label: "长期追踪",
    description: "持续更新的技术新闻和研究前沿",
  },
  {
    id: "paper",
    label: "论文阅读",
    description: "论文解读、模型方法和研究笔记",
  },
  {
    id: "practice",
    label: "技术实践",
    description: "工程经验、工具链和项目复盘",
  },
];

export const TRACKING_POST_TITLES = ["AI 技术新闻", "无线感知前沿"];
export const PAPER_TAG_NAME = "论文阅读";

export function isPostCategoryId(
  value: string | undefined,
): value is PostCategoryId {
  return POST_CATEGORY_IDS.some((id) => id === value);
}

export function getPostCategory(post: PostItem): PostCategoryId {
  if (TRACKING_POST_TITLES.includes(post.title)) {
    return "tracking";
  }

  if (post.tags?.some((tag) => tag.name === PAPER_TAG_NAME)) {
    return "paper";
  }

  return "practice";
}

export function getPostCategoryLabel(category: PostCategoryFilter) {
  return (
    POST_CATEGORY_OPTIONS.find((option) => option.id === category)?.label ??
    POST_CATEGORY_OPTIONS[0].label
  );
}
