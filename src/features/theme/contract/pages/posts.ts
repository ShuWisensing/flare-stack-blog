import type { PostItem } from "@/features/posts/schema/posts.schema";
import type {
  PostCategoryFilter,
  PostCategoryId,
} from "@/features/posts/utils/category";
import type { TagWithCount } from "@/features/tags/tags.schema";

export interface PostsPageProps {
  posts: Array<PostItem>;
  tags: Array<Omit<TagWithCount, "createdAt">>;
  selectedTag?: string;
  selectedCategory?: PostCategoryId;
  onCategoryClick: (category: PostCategoryFilter) => void;
  onTagClick: (tag: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}
