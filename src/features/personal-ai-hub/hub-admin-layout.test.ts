// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ path: "/admin/personal-ai-hub" }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: state.path } }),
  Outlet: () => createElement("div", null, "page"),
  Link: ({ children }: { children: unknown }) =>
    createElement("span", null, children as string),
  redirect: vi.fn(),
}));
vi.mock("@/components/admin/side-bar", () => ({
  SideBar: () => createElement("aside", null, "博客导航"),
}));
vi.mock("@/components/breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/components/ui/toaster", () => ({ default: () => null }));
vi.mock("@/features/auth/queries", () => ({ sessionQuery: {} }));
vi.mock("@/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_, key) => () => String(key) }),
}));

import { Route } from "@/routes/admin/route";

afterEach(cleanup);
it("allows the blog navigation to collapse only within Hub pages", () => {
  state.path = "/admin/personal-ai-hub";
  render(createElement(Route.options.component as ComponentType));
  const toggle = screen.getByRole("button", { name: "切换博客导航" });
  expect(screen.getByText("博客导航").parentElement?.hidden).toBe(true);
  fireEvent.click(toggle);
  expect(screen.getByText("博客导航").parentElement?.hidden).toBe(false);
  cleanup();
  state.path = "/admin/posts";
  render(createElement(Route.options.component as ComponentType));
  expect(screen.getByText("博客导航").parentElement?.hidden).toBe(false);
  expect(screen.queryByRole("button", { name: "切换博客导航" })).toBeNull();
});
