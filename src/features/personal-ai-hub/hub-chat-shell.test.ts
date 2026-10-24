// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listHubWorkspacesFn: vi.fn(),
  listHubConversationsFn: vi.fn(),
  getHubConversationFn: vi.fn(),
  listHubMessagesFn: vi.fn(),
  submitHubTurnFn: vi.fn(),
  getHubTurnFn: vi.fn(),
  getHubRuntimesFn: vi.fn(),
  getHubModelsFn: vi.fn(),
  listHubRootsFn: vi.fn(),
  createHubWorkspaceFn: vi.fn(),
  createHubConversationFn: vi.fn(),
  updateHubConversationFn: vi.fn(),
  renameHubWorkspaceFn: vi.fn(),
  checkHubRuntimeFn: vi.fn(),
  getHubTurnDetailsFn: vi.fn(),
  getHubCitationFn: vi.fn(),
  getHubRequestFn: vi.fn(),
}));
vi.mock("./api/hub-chat.admin.api", () => api);
vi.mock("./components/wiki-graph-view", () => ({
  WikiGraphView: () => createElement("p", null, "graph"),
}));

import { HubApp, type HubLocation } from "./components/hub-app";

const ok = (data: unknown) => ({ data, error: null });
function show() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function App() {
    const [location, navigate] = useState<HubLocation>({
      view: "chat",
      workspace: "w",
      chat: "a",
      scope: "knowledge",
    });
    return createElement(HubApp, { mode: "wiki", location, navigate });
  }
  return render(
    createElement(QueryClientProvider, { client }, createElement(App)),
  );
}
function ready() {
  api.listHubWorkspacesFn.mockResolvedValue(
    ok({
      items: [
        {
          id: "w",
          kind: "wiki",
          name: "我的知识库",
          root_key: "knowledge",
          root_path: "data",
          available: true,
        },
      ],
      next_cursor: null,
    }),
  );
  const chats = ["a", "b"].map((id) => ({
    id,
    workspace_id: "w",
    runtime: "wiki",
    title: `聊天 ${id}`,
    preferred_model_id: "deepseek-flash",
    archived_at: null,
    updated_at: "now",
    active_turn: null,
  }));
  api.listHubConversationsFn.mockResolvedValue(
    ok({ items: chats, next_cursor: null }),
  );
  api.getHubConversationFn.mockImplementation(async ({ data }) =>
    ok({ conversation: chats.find((c) => c.id === data.id) }),
  );
  api.listHubMessagesFn.mockImplementation(async ({ data }) =>
    ok({
      items: [
        {
          id: "m-" + data.id,
          conversation_id: data.id,
          turn_id: "old-" + data.id,
          seq: 1,
          role: "assistant",
          content_md: `**回答 ${data.id}**`,
          created_at: "now",
          citations: [],
        },
      ],
      next_before_seq: null,
    }),
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
});

it("reads saved Markdown messages without the old diagnostic JSON panels", async () => {
  ready();
  show();
  expect((await screen.findByText("回答 a")).tagName).toBe("STRONG");
  expect(screen.queryByText("SESSION MESSAGES")).toBeNull();
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
});

it("preserves indentation, prevents IME enter and double submission, and polls only the accepted turn", async () => {
  ready();
  api.submitHubTurnFn.mockResolvedValue(
    ok({
      turn_id: "turn-a",
      conversation_id: "a",
      state: "queued",
      client_request_id: "rid",
      error_reason: null,
      updated_at: "now",
    }),
  );
  api.getHubTurnFn.mockResolvedValue(
    ok({
      turn_id: "turn-a",
      conversation_id: "a",
      state: "completed",
      client_request_id: "rid",
      error_reason: null,
      updated_at: "now",
    }),
  );
  show();
  await screen.findByText("回答 a");
  const input = screen.getByRole("textbox", { name: "发送消息" });
  fireEvent.change(input, { target: { value: "  code\n    body\n" } });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await waitFor(() => expect(api.submitHubTurnFn).toHaveBeenCalledTimes(1));
  expect(api.submitHubTurnFn.mock.calls[0][0].data.input.question).toBe(
    "  code\n    body\n",
  );
  await waitFor(() => expect(api.getHubTurnFn).toHaveBeenCalled());
});

it("does not append an old session result after switching conversations", async () => {
  ready();
  let finish: (data: unknown) => void = () => {};
  api.submitHubTurnFn.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  show();
  await screen.findByText("回答 a");
  fireEvent.change(screen.getByRole("textbox", { name: "发送消息" }), {
    target: { value: "read" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  fireEvent.click(screen.getByRole("button", { name: "聊天 b" }));
  await screen.findByText("回答 b");
  finish(
    ok({
      turn_id: "turn-a",
      conversation_id: "a",
      state: "queued",
      client_request_id: "rid",
      error_reason: null,
      updated_at: "now",
    }),
  );
  await waitFor(() => expect(screen.queryByText("回答 a")).toBeNull());
  expect(screen.getByText("回答 b")).toBeTruthy();
});

it("does not lock a definitely rejected request as an unknown execution", async () => {
  ready();
  api.submitHubTurnFn.mockResolvedValue({
    data: null,
    error: {
      reason: "HUB_INVALID_REQUEST",
      message: "参数不合法",
      layer: "hub",
      requestId: "rejected",
      upstreamStatus: 422,
    },
  });
  show();
  await screen.findByText("回答 a");
  fireEvent.change(screen.getByRole("textbox", { name: "发送消息" }), {
    target: { value: "read" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await screen.findByText(/参数不合法/);
  expect(screen.queryByRole("button", { name: "核对原请求" })).toBeNull();
  expect(
    (screen.getByRole("button", { name: "发送" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

it("resolves a lost submission response by its original request ID without posting again", async () => {
  ready();
  api.submitHubTurnFn.mockRejectedValue(new Error("connection lost"));
  api.getHubRequestFn.mockResolvedValue(
    ok({
      turn_id: "lost-turn",
      conversation_id: "a",
      state: "completed",
      client_request_id: "original",
      error_reason: null,
      updated_at: "now",
    }),
  );
  api.getHubTurnFn.mockResolvedValue(
    ok({
      turn_id: "lost-turn",
      conversation_id: "a",
      state: "completed",
      client_request_id: "original",
      error_reason: null,
      updated_at: "now",
    }),
  );
  show();
  await screen.findByText("回答 a");
  fireEvent.change(screen.getByRole("textbox", { name: "发送消息" }), {
    target: { value: "read" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  fireEvent.click(await screen.findByRole("button", { name: "核对原请求" }));
  await waitFor(() => expect(api.getHubRequestFn).toHaveBeenCalledTimes(1));
  expect(api.getHubRequestFn.mock.calls[0][0].data.client_request_id).toBe(
    api.submitHubTurnFn.mock.calls[0][0].data.input.client_request_id,
  );
  expect(api.submitHubTurnFn).toHaveBeenCalledTimes(1);
});

it("restores an archived chat through metadata without creating or executing a replacement", async () => {
  ready();
  const original = api.listHubConversationsFn.getMockImplementation();
  api.listHubConversationsFn.mockImplementation(async ({ data }) =>
    data.include_archived
      ? ok({
          items: [
            {
              id: "archived",
              workspace_id: "w",
              runtime: "wiki",
              title: "归档讨论",
              archived_at: "then",
            },
          ],
          next_cursor: null,
        })
      : original?.({ data }),
  );
  api.updateHubConversationFn.mockResolvedValue(
    ok({
      conversation: {
        id: "archived",
        workspace_id: "w",
        runtime: "wiki",
        title: "归档讨论",
        archived_at: null,
      },
    }),
  );
  show();
  await screen.findByText("回答 a");
  fireEvent.click(screen.getByRole("button", { name: "已归档聊天" }));
  fireEvent.click(await screen.findByRole("button", { name: "恢复 归档讨论" }));
  await waitFor(() =>
    expect(api.updateHubConversationFn).toHaveBeenCalledWith({
      data: { id: "archived", archived: false },
    }),
  );
  expect(api.createHubConversationFn).not.toHaveBeenCalled();
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
});
