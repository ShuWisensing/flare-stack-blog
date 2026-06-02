import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useViewCounts } from "@/features/pageview/queries";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import type { PostCategoryId } from "@/features/posts/utils/category";
import type { HomePageProps } from "@/features/theme/contract/pages";
import { PostCard } from "../../components/post-card";

interface HomeSection {
  title: string;
  description: string;
  category: PostCategoryId;
  posts: Array<PostItem>;
}

export function HomePage({
  pinnedPosts,
  popularPosts,
  trackingPosts,
  paperPosts,
  practicePosts,
}: HomePageProps) {
  const delayOffset = 50;

  const popularSlugs = useMemo(
    () => new Set((popularPosts ?? []).map((post) => post.slug)),
    [popularPosts],
  );
  const pinnedSlugs = useMemo(
    () => new Set((pinnedPosts ?? []).map((post) => post.slug)),
    [pinnedPosts],
  );

  const sections: Array<HomeSection> = useMemo(
    () => [
      {
        title: "长期追踪",
        description: "持续更新 AI 技术新闻与无线感知前沿。",
        category: "tracking",
        posts: trackingPosts,
      },
      {
        title: "论文阅读",
        description: "围绕模型、方法和研究趋势整理阅读笔记。",
        category: "paper",
        posts: paperPosts,
      },
      {
        title: "技术实践",
        description: "记录工程经验、工具链实践和项目复盘。",
        category: "practice",
        posts: practicePosts,
      },
    ],
    [paperPosts, practicePosts, trackingPosts],
  );

  const allSlugs = useMemo(() => {
    return [
      ...new Set(
        sections.flatMap((section) => section.posts.map((post) => post.slug)),
      ),
    ];
  }, [sections]);
  const { data: viewCounts, isPending: isPendingViewCounts } =
    useViewCounts(allSlugs);

  return (
    <div className="flex flex-col gap-5 md:gap-8">
      {sections.map((section, sectionIndex) => (
        <section key={section.category} className="flex flex-col gap-3">
          <div
            className="fuwari-onload-animation fuwari-card-base px-5 py-4 md:px-6 md:py-5"
            style={{
              animationDelay: `calc(var(--fuwari-content-delay) + ${sectionIndex * delayOffset}ms)`,
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-black/90 dark:text-white/90">
                  {section.title}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 fuwari-text-50">
                  {section.description}
                </p>
              </div>
              <Link
                to="/posts"
                search={{ category: section.category }}
                className="fuwari-btn-regular h-10 w-full shrink-0 rounded-lg px-4 text-sm font-bold sm:w-auto"
              >
                查看全部
              </Link>
            </div>
          </div>

          {section.posts.length > 0 ? (
            <div className="flex flex-col rounded-(--fuwari-radius-large) bg-(--fuwari-card-bg) py-1 md:py-0 md:bg-transparent md:gap-4">
              {section.posts.map((post, postIndex) => (
                <div
                  key={post.slug}
                  className="fuwari-onload-animation"
                  style={{
                    animationDelay: `calc(var(--fuwari-content-delay) + ${
                      (sectionIndex + postIndex + 1) * delayOffset
                    }ms)`,
                  }}
                >
                  <PostCard
                    post={post}
                    pinned={pinnedSlugs.has(post.slug)}
                    popular={
                      !pinnedSlugs.has(post.slug) && popularSlugs.has(post.slug)
                    }
                    views={viewCounts?.[post.slug]}
                    isLoadingViews={isPendingViewCounts}
                  />
                  <div className="border-t border-dashed mx-6 border-black/10 dark:border-white/15 last:border-t-0 md:hidden" />
                </div>
              ))}
            </div>
          ) : (
            <div className="fuwari-card-base px-6 py-8 text-sm fuwari-text-50">
              暂无{section.title}文章
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
