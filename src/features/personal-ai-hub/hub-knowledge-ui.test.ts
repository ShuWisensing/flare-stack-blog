// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getKnowledgeCatalogFn: vi.fn(),
  getIngestCapabilitiesFn: vi.fn(),
  getKnowledgeCandidatesFn: vi.fn(),
  submitKnowledgeImportFn: vi.fn(),
  publishKnowledgeCandidatesFn: vi.fn(),
}));
vi.mock("./api/hub-knowledge.admin.api", () => api);

import { HubKnowledgeManager } from "./components/hub-knowledge-manager";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("manual notes are submitted once and evidence stays visible before confirmation", async () => {
  const ok = (data: unknown) => ({ data, error: null });
  const job = {
    id: "j1",
    state: "queued",
    kind: "ingest",
    stage: "queued",
    result: null,
    error: null,
    created_at: "today",
  };
  api.getKnowledgeCatalogFn.mockResolvedValue(
    ok({
      sources: [],
      jobs: [],
      publication: { state: "ready" },
      counts: { sources: 0, wiki_pages: 0 },
    }),
  );
  api.getIngestCapabilitiesFn.mockResolvedValue(
    ok({
      formats: [{ extension: ".md", name: "Markdown" }],
      max_file_bytes: 20971520,
      unsupported: [],
    }),
  );
  api.getKnowledgeCandidatesFn.mockResolvedValue(
    ok({
      next_cursor: "page-2",
      items: [
        {
          id: "c1",
          version: 1,
          status: "waiting_review",
          wiki_page_id: null,
          payload: {
            title: "端侧部署",
            statement: "ESP32-S3 用于端侧部署。",
            node_type: "concept",
            scope: { kind: "global" },
            assertion_kind: "source_statement",
            related_titles: [],
          },
          evidence: [
            {
              id: "e1",
              source_id: "s1",
              excerpt: "ESP32-S3 用于端侧部署。",
              start_line: 1,
              end_line: 1,
              source_url: "https://example.com/source",
              sha256: "a".repeat(64),
              origin: {
                role: "user",
                runtime: "codex",
                conversation_id: "chat-source",
                message_id: "message-source",
                workspace_id: "workspace-source",
                created_at: "2026-10-26T09:00:00+08:00",
              },
            },
          ],
        },
      ],
    }),
  );
  api.submitKnowledgeImportFn.mockResolvedValue(ok(job));
  api.publishKnowledgeCandidatesFn.mockResolvedValue(
    ok({ ...job, kind: "publish" }),
  );
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(HubKnowledgeManager, { onNode: vi.fn() }),
    ),
  );
  fireEvent.click(await screen.findByRole("button", { name: "添加资料" }));
  fireEvent.click(screen.getByRole("button", { name: "文字笔记" }));
  fireEvent.change(screen.getByLabelText("资料标题"), {
    target: { value: "我的笔记" },
  });
  fireEvent.change(screen.getByLabelText("资料正文"), {
    target: { value: "保留原文证据。" },
  });
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "保存到知识库" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "保存到知识库" }));
  await waitFor(() =>
    expect(api.submitKnowledgeImportFn).toHaveBeenCalledTimes(1),
  );
  expect(api.submitKnowledgeImportFn.mock.calls[0][0].data).toMatchObject({
    kind: "text",
    title: "我的笔记",
    text: "保留原文证据。",
  });
  fireEvent.click(screen.getByRole("button", { name: /待确认/ }));
  expect(await screen.findByText("原文证据")).toBeTruthy();
  expect(screen.getByText(/用户原话/)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "返回来源聊天" }).getAttribute("href"),
  ).toContain("chat=chat-source");
  expect(
    screen.getByRole("link", { name: "来源链接" }).getAttribute("href"),
  ).toBe("https://example.com/source");
  api.getKnowledgeCandidatesFn.mockResolvedValue(
    ok({ items: [], next_cursor: null }),
  );
  fireEvent.click(screen.getByRole("button", { name: "继续查看待确认知识" }));
  await waitFor(() =>
    expect(api.getKnowledgeCandidatesFn).toHaveBeenCalledWith({
      data: { cursor: "page-2" },
    }),
  );
  expect(screen.getByLabelText("确认方式")).toBeTruthy();
  expect(screen.getByLabelText("知识作用范围")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "确认并更新知识库" }));
  await waitFor(() =>
    expect(api.publishKnowledgeCandidatesFn).toHaveBeenCalledTimes(1),
  );
  expect(
    api.publishKnowledgeCandidatesFn.mock.calls[0][0].data.candidates,
  ).toEqual([{ id: "c1", version: 1 }]);
  client.clear();
});
