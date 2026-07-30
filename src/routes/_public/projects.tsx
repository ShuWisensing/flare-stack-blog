import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import { siteDomainQuery } from "@/features/config/queries";
import { getProjects } from "@/features/projects/projects.data";
import { getProjectsSeo } from "@/features/projects/projects.seo";
import { canonicalLink } from "@/lib/seo";

export const Route = createFileRoute("/_public/projects")({
  loader: async ({ context }) => {
    const domain = await context.queryClient.ensureQueryData(siteDomainQuery);

    return getProjectsSeo(domain);
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
      {
        name: "description",
        content: loaderData?.description,
      },
    ],
    links: [canonicalLink(loaderData?.canonicalHref ?? "/projects")],
  }),
  component: ProjectsRoute,
});

function ProjectsRoute() {
  return <theme.ProjectsPage projects={getProjects()} />;
}
