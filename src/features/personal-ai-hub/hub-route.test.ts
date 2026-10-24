// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useSearch: () => ({ view: "chat", scope: "knowledge" }),
  }),
  useNavigate: () => vi.fn(),
}));
vi.mock("./components/hub-app", () => ({
  HubApp: ({ mode }: { mode: string }) =>
    createElement("p", null, `Hub ${mode}`),
}));

import { Route as Agent } from "@/routes/admin/personal-ai-hub/agent-chat";
import { Route as Wiki } from "@/routes/admin/personal-ai-hub/index";

afterEach(cleanup);
it("keeps both existing URLs and renders the shared workspace interface", () => {
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(Wiki.options.component as ComponentType),
    ),
  );
  expect(screen.getByText("Hub wiki")).toBeTruthy();
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(Agent.options.component as ComponentType),
    ),
  );
  expect(screen.getByText("Hub agent")).toBeTruthy();
});
