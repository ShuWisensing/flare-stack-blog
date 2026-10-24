import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HubApp } from "@/features/personal-ai-hub/components/hub-app";
import { HubLocationSchema } from "@/features/personal-ai-hub/schema/hub-location.schema";

export const Route = createFileRoute("/admin/personal-ai-hub/agent-chat")({
  validateSearch: (search) => HubLocationSchema.parse(search),
  component: HubPage,
  loader: () => ({ title: "Agent Chat" }),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title }] }),
});
function HubPage() {
  const location = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <HubApp
      mode="agent"
      location={location}
      navigate={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}
