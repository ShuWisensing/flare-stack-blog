import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import { siteDomainQuery } from "@/features/config/queries";
import {
  categoryPostsQuery,
  pinnedPostsQuery,
  popularPostsQuery,
  recentPostsQuery,
} from "@/features/posts/queries";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";

const { recentPostsLimit, popularPostsLimit } = theme.config.home;

export const Route = createFileRoute("/_public/")({
  loader: async ({ context }) => {
    const domainPromise = context.queryClient.ensureQueryData(siteDomainQuery);
    await Promise.all([
      context.queryClient.ensureQueryData(recentPostsQuery(recentPostsLimit)),
      context.queryClient.ensureQueryData(categoryPostsQuery("tracking", 3)),
      context.queryClient.ensureQueryData(categoryPostsQuery("paper", 3)),
      context.queryClient.ensureQueryData(categoryPostsQuery("practice", 3)),
      domainPromise,
      context.queryClient.ensureQueryData(pinnedPostsQuery),
      context.queryClient.ensureQueryData(popularPostsQuery(popularPostsLimit)),
    ]);
    const domain = await domainPromise;

    return {
      canonicalHref: buildCanonicalUrl(domain, "/"),
    };
  },
  head: ({ loaderData }) => ({
    links: [canonicalLink(loaderData?.canonicalHref ?? "/")],
  }),
  pendingComponent: HomePageSkeleton,
  component: HomeRoute,
});

function HomeRoute() {
  const { data: posts } = useSuspenseQuery(recentPostsQuery(recentPostsLimit));
  const { data: trackingPosts } = useSuspenseQuery(
    categoryPostsQuery("tracking", 3),
  );
  const { data: paperPosts } = useSuspenseQuery(categoryPostsQuery("paper", 3));
  const { data: practicePosts } = useSuspenseQuery(
    categoryPostsQuery("practice", 3),
  );
  const { data: pinnedPosts } = useSuspenseQuery(pinnedPostsQuery);
  const { data: popularPosts } = useSuspenseQuery(
    popularPostsQuery(popularPostsLimit),
  );

  return (
    <theme.HomePage
      posts={posts}
      pinnedPosts={pinnedPosts}
      popularPosts={popularPosts}
      trackingPosts={trackingPosts}
      paperPosts={paperPosts}
      practicePosts={practicePosts}
    />
  );
}

function HomePageSkeleton() {
  return <theme.HomePageSkeleton />;
}
