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
  getKnowledgeCollectionFn: vi.fn(),
  configureKnowledgeCollectionFn: vi.fn(),
}));
vi.mock("./api/hub-knowledge.admin.api", () => api);

import { HubCollectionSettings } from "./components/hub-collection-settings";

afterEach(cleanup);
it("collection is opt in and enabling it does not enable paid extraction", async () => {
  const config = {
    workspace_id: "w",
    version: 0,
    enabled: false,
    auto_extract: false,
    model: "deepseek-flash",
    enabled_at: null,
    last_scan_at: null,
    last_error: null,
  };
  api.getKnowledgeCollectionFn.mockResolvedValue({ data: config, error: null });
  api.configureKnowledgeCollectionFn.mockImplementation(async ({ data }) => ({
    data: { ...config, ...data, version: 1 },
    error: null,
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(HubCollectionSettings, {
        workspaceId: "w",
        close: vi.fn(),
      }),
    ),
  );
  const enabled = await screen.findByLabelText("收集本项目的新 Codex 聊天");
  expect((enabled as HTMLInputElement).checked).toBe(false);
  fireEvent.click(enabled);
  expect(
    (
      screen.getByLabelText(
        "自动整理知识候选（调用 DeepSeek）",
      ) as HTMLInputElement
    ).checked,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "保存收集设置" }));
  await waitFor(() =>
    expect(api.configureKnowledgeCollectionFn).toHaveBeenCalledOnce(),
  );
  expect(
    api.configureKnowledgeCollectionFn.mock.calls[0][0].data,
  ).toMatchObject({
    workspace_id: "w",
    version: 0,
    enabled: true,
    auto_extract: false,
  });
  client.clear();
});
