// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getWikiGraphFn: vi.fn(),
  searchWikiGraphFn: vi.fn(),
  getWikiNodeFn: vi.fn(),
  getWikiContentFn: vi.fn(),
}));
vi.mock("./api/hub-chat.admin.api", () => api);
vi.mock("./components/wiki-graph-canvas", () => ({
  WikiGraphCanvas: () =>
    createElement("div", { role: "img", "aria-label": "关系画布" }),
}));

import type { HubLocation } from "./components/hub-app";
import { WikiGraphView } from "./components/wiki-graph-view";

const ok = (data: unknown) => ({ data, error: null });
function node(id: string, title: string) {
  return {
    id,
    title,
    kind: "source",
    aliases: [],
    content_available: true,
    status: "ready",
    content_type: "source_overview",
  };
}
function graph(scope: string) {
  return {
    scope,
    revision: "rev",
    nodes: scope === "knowledge" ? [] : [node("source:s", "资料")],
    edges: [],
    matching_nodes: scope === "knowledge" ? 0 : 1,
    matching_edges: 0,
    visible_nodes: scope === "knowledge" ? 0 : 1,
    visible_edges: 0,
    clipped: false,
    issues: [],
    available_kinds: ["source"],
    available_relations: [],
    coverage: { knowledge_pages: 0, concepts: 0, entities: 0 },
  };
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function show() {
  function App() {
    const [location, navigate] = useState<HubLocation>({
      view: "graph",
      scope: "knowledge",
    });
    return createElement(WikiGraphView, { location, navigate });
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    createElement(QueryClientProvider, { client }, createElement(App)),
  );
}
it("shows an honest empty knowledge graph and switches to evidence only on click", async () => {
  api.getWikiGraphFn.mockImplementation(async ({ data }) =>
    ok(graph(data.scope)),
  );
  show();
  await screen.findByText("尚无已登记的知识节点");
  expect(screen.getByLabelText("节点类型说明")).toBeTruthy();
  expect(screen.getByTitle("用户确认的偏好")).toBeTruthy();
  expect(
    api.getWikiGraphFn.mock.calls.every(
      (call) => call[0].data.scope === "knowledge",
    ),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "查看资料结构" }));
  await screen.findByRole("img", { name: "关系画布" });
});
it.each([
  "source_overview",
  "wiki_markdown",
  "summary_markdown",
])("searches and reads %s without rendering its internal frontmatter as prose", async (contentType) => {
  api.getWikiGraphFn.mockImplementation(async ({ data }) =>
    ok(graph(data.scope)),
  );
  api.searchWikiGraphFn.mockResolvedValue(
    ok({
      revision: "rev",
      items: [node("source:hidden", "未绘制资料")],
      total: 1,
      next_cursor: null,
    }),
  );
  api.getWikiNodeFn.mockResolvedValue(
    ok({
      revision: "rev",
      node: {
        ...node("source:hidden", "未绘制资料"),
        content_type: contentType,
      },
      incoming: [],
      outgoing: [],
      neighbors: [],
      relation_count: 0,
      next_cursor: null,
      issues: [],
    }),
  );
  api.getWikiContentFn.mockResolvedValue(
    ok({
      revision: "rev",
      node_id: "source:hidden",
      content_type: contentType,
      content:
        contentType === "source_overview"
          ? "**正确正文**"
          : "---\nsource_refs:\n  - source:s\n---\n\n# 未绘制资料\n\n**正确正文**",
      next_cursor: null,
      links: [],
      total_bytes: 20,
    }),
  );
  show();
  await screen.findByText("尚无已登记的知识节点");
  fireEvent.change(screen.getByRole("textbox", { name: "搜索知识节点" }), {
    target: { value: "未绘制" },
  });
  fireEvent.click(await screen.findByRole("button", { name: /未绘制资料/ }));
  expect((await screen.findByText("正确正文")).tagName).toBe("STRONG");
  if (contentType !== "source_overview") {
    expect(
      screen
        .getByText(/source_refs:/)
        .closest("details")
        ?.hasAttribute("open"),
    ).toBe(false);
  }
  expect(api.getWikiContentFn.mock.calls[0][0].data.node_id).toBe(
    "source:hidden",
  );
});
