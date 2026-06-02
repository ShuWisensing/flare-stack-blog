import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  POST_CATEGORY_OPTIONS,
  getPostCategoryLabel,
} from "@/features/posts/utils/category";
import type { PostsPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { ArchivePanel } from "../../components/archive/archive-panel";

export function PostsPage({
  posts,
  tags,
  selectedTag,
  selectedCategory,
  onCategoryClick,
  onTagClick,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: PostsPageProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "0px" },
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="fuwari-onload-animation flex flex-col gap-4">
      <div className="fuwari-card-base px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-(--fuwari-primary)">
              文章库
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-black/90 dark:text-white/90">
              {getPostCategoryLabel(selectedCategory ?? "all")}
            </h1>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {POST_CATEGORY_OPTIONS.map((option) => {
              const isActive =
                option.id === (selectedCategory ?? "all");
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onCategoryClick(option.id)}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-(--fuwari-primary) text-white"
                      : "bg-(--fuwari-btn-regular-bg) fuwari-text-75 hover:text-(--fuwari-primary)"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-dashed border-black/10 pt-4 dark:border-white/10">
              {tags.slice(0, 18).map((tag) => {
                const isActive = tag.name === selectedTag;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onTagClick(tag.name)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      isActive
                        ? "bg-(--fuwari-primary) text-white"
                        : "bg-(--fuwari-btn-regular-bg) fuwari-text-75 hover:text-(--fuwari-primary)"
                    }`}
                  >
                    {tag.name}
                    <span className="ml-1 opacity-60">{tag.postCount}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {posts.length > 0 && <ArchivePanel posts={posts} />}

      {/* Infinite Scroll trigger and loading indicator */}
      <div
        ref={observerRef}
        className="flex flex-col items-center justify-center pt-2 pb-8"
      >
        {isFetchingNextPage ? (
          <div className="fuwari-card-base w-full px-8 py-6 opacity-70 animate-pulse">
            {/* Inline Mini Skeleton for appending items */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-full rounded-lg flex flex-row justify-start items-center"
              >
                <div className="w-[15%] md:w-[10%] flex justify-end pr-2">
                  <Skeleton className="h-4 w-10 bg-black/10 dark:bg-white/10" />
                </div>
                <div className="w-[15%] md:w-[10%] relative h-full flex items-center before:absolute before:w-1 left-1/2 -ml-0.5 pointer-events-none before:border-l-2 before:border-dashed before:border-black/5 dark:before:border-white/5 before:-top-5 before:bottom-0 before:h-20 z-0">
                  <div className="mx-auto w-2 h-2 rounded-full bg-black/20 dark:bg-white/20 z-10" />
                </div>
                <div className="w-[70%] md:max-w-[65%] md:w-[65%] flex justify-start pl-2">
                  <Skeleton className="h-5 w-3/4 max-w-50 bg-black/10 dark:bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : hasNextPage ? (
          <div className="h-px w-24 bg-black/10 dark:bg-white/10"></div>
        ) : posts.length > 0 ? (
          <div className="flex items-center gap-4 text-black/20 dark:text-white/20 mt-4">
            <span className="h-px w-12 bg-current" />
            <span className="text-sm font-bold italic">{m.posts_end()}</span>
            <span className="h-px w-12 bg-current" />
          </div>
        ) : (
          <div className="fuwari-card-base w-full px-8 py-12 text-center text-sm fuwari-text-50">
            {m.posts_no_posts()}
          </div>
        )}
      </div>
    </div>
  );
}
