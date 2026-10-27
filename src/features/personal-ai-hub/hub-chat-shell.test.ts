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
  registerHubDirectoryFn: vi.fn(),
  createHubConversationFn: vi.fn(),
  updateHubConversationFn: vi.fn(),
  renameHubWorkspaceFn: vi.fn(),
  checkHubRuntimeFn: vi.fn(),
  getHubTurnDetailsFn: vi.fn(),
  getHubCitationFn: vi.fn(),
  getHubRequestFn: vi.fn(),
}));
vi.mock("./api/hub-chat.admin.api", () => api);
const nativeApi = vi.hoisted(() => ({
  discoverNativeProjectsFn: vi.fn(),
  registerNativeProjectFn: vi.fn(),
  listNativeCodexFn: vi.fn(),
  bindNativeCodexFn: vi.fn(),
  synchronizeNativeCodexFn: vi.fn(),
}));
vi.mock("./api/hub-native.admin.api", () => nativeApi);
vi.mock("./components/wiki-graph-view", () => ({
  WikiGraphView: () => createElement("p", null, "graph"),
}));

import { HubApp, type HubLocation } from "./components/hub-app";

const ok = (data: unknown) => ({ data, error: null });

it("closes the project picker after registering a discovered native project", async () => {
  nativeApi.listNativeCodexFn.mockResolvedValue(
    ok({ items: [], next_cursor: null }),
  );
  let registered = false;
  const workspace = {
    id: "native-project",
    name: "原生项目",
    kind: "agent",
    root_key: "native",
    root_path: "E:/native",
    available: true,
  };
  api.listHubWorkspacesFn.mockImplementation(async () =>
    ok({ items: registered ? [workspace] : [], next_cursor: null }),
  );
  api.listHubRootsFn.mockResolvedValue(ok({ items: [] }));
  api.listHubConversationsFn.mockResolvedValue(
    ok({ items: [], next_cursor: null }),
  );
  nativeApi.discoverNativeProjectsFn.mockResolvedValue(
    ok({
      items: [
        {
          id: "p",
          name: "原生项目",
          cwd: "E:/native",
          native_id: "n",
          available: true,
          error: null,
          workspace_id: null,
        },
      ],
      next_cursor: null,
    }),
  );
  nativeApi.registerNativeProjectFn.mockImplementation(async () => {
    registered = true;
    return ok({ workspace });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function App() {
    const [location, navigate] = useState<HubLocation>({
      view: "chat",
      scope: "knowledge",
    });
    return createElement(HubApp, { mode: "agent", location, navigate });
  }
  render(createElement(QueryClientProvider, { client }, createElement(App)));
  fireEvent.click(await screen.findByRole("button", { name: "添加工作区" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "从本机 Codex 发现项目" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "接入 原生项目" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(await screen.findByRole("button", { name: /原生项目/ })).toBeTruthy();
  client.clear();
});

it("switching tools selects a separate conversation directory", async () => {
  nativeApi.listNativeCodexFn.mockResolvedValue(
    ok({
      items: [
        {
          id: "native",
          title: "codex 对话",
          updated_at: "2026-10-27",
          parent_id: null,
        },
      ],
      next_cursor: null,
    }),
  );
  api.listHubWorkspacesFn.mockResolvedValue(
    ok({
      items: [
        {
          id: "w",
          kind: "agent",
          root_key: "blog",
          root_path: "E:/blog",
          name: "blog",
          available: true,
        },
      ],
      next_cursor: null,
    }),
  );
  api.listHubConversationsFn.mockImplementation(async ({ data }) =>
    ok({
      items: [
        {
          id: data.runtime,
          title: data.runtime + " 对话",
          runtime: data.runtime,
          workspace_id: "w",
          native_session_id: data.runtime === "codex" ? "native" : null,
        },
      ],
      next_cursor: null,
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function App() {
    const [location, navigate] = useState<HubLocation>({
      view: "chat",
      scope: "knowledge",
      workspace: "w",
    });
    return createElement(HubApp, { mode: "agent", location, navigate });
  }
  render(createElement(QueryClientProvider, { client }, createElement(App)));
  await screen.findByText("codex 对话");
  fireEvent.change(screen.getByLabelText("新对话执行器"), {
    target: { value: "opencode" },
  });
  await screen.findByText("opencode 对话");
  expect(screen.queryByText("codex 对话")).toBeNull();
  expect(nativeApi.listNativeCodexFn).toHaveBeenCalledWith({
    data: {
      workspace_id: "w",
      cursor: undefined,
      archived: false,
      include_children: false,
    },
  });
});

it("registers an existing local directory explicitly and selects the resulting workspace", async () => {
  const workspace = {
    id: "manual",
    name: "本机项目",
    kind: "agent",
    root_key: "project",
    root_path: "E:/projects/app",
    available: true,
  };
  api.listHubWorkspacesFn.mockResolvedValue(
    ok({ items: [], next_cursor: null }),
  );
  api.listHubRootsFn.mockResolvedValue(ok({ items: [] }));
  api.listHubConversationsFn.mockResolvedValue(
    ok({ items: [], next_cursor: null }),
  );
  api.registerHubDirectoryFn.mockResolvedValue(ok({ workspace }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function App() {
    const [location, navigate] = useState<HubLocation>({
      view: "chat",
      scope: "knowledge",
    });
    return createElement(HubApp, { mode: "agent", location, navigate });
  }
  render(createElement(QueryClientProvider, { client }, createElement(App)));
  fireEvent.click(await screen.findByRole("button", { name: "添加工作区" }));
  fireEvent.change(await screen.findByLabelText("本机项目路径"), {
    target: { value: "E:/projects/app" },
  });
  fireEvent.change(screen.getByLabelText("新工作区名称"), {
    target: { value: "本机项目" },
  });
  fireEvent.click(screen.getByRole("button", { name: "添加本地文件夹" }));
  await waitFor(() =>
    expect(api.registerHubDirectoryFn).toHaveBeenCalledWith({
      data: { path: "E:/projects/app", name: "本机项目" },
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.createHubConversationFn).not.toHaveBeenCalled();
  client.clear();
});
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
it("shows a newly materialized Codex thread in the native sidebar after the first turn", async () => {
  ready();
  let completed = false;
  let finish!: (value: unknown) => void;
  const workspace = {
    id: "w",
    kind: "agent",
    name: "blog",
    root_key: "blog",
    root_path: "E:/blog",
    available: true,
  };
  const chat = () => ({
    id: "a",
    workspace_id: "w",
    runtime: "codex",
    title: "网页新对话",
    preferred_model_id: null,
    archived_at: null,
    updated_at: "now",
    native_session_id: completed ? "native-new" : null,
    native_read_only: false,
    active_turn: completed ? null : { id: "first-turn", state: "running" },
  });
  api.listHubWorkspacesFn.mockResolvedValue(
    ok({ items: [workspace], next_cursor: null }),
  );
  api.getHubConversationFn.mockImplementation(async () =>
    ok({ conversation: chat() }),
  );
  api.listHubConversationsFn.mockImplementation(async () =>
    ok({ items: [chat()], next_cursor: null }),
  );
  api.getHubRuntimesFn.mockResolvedValue(ok({ items: [] }));
  api.getHubTurnFn.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  nativeApi.listNativeCodexFn.mockImplementation(async () =>
    ok({
      items: completed
        ? [
            {
              id: "native-new",
              title: "首轮后的原生聊天",
              parent_id: null,
              updated_at: "now",
            },
          ]
        : [],
      next_cursor: null,
    }),
  );
  nativeApi.synchronizeNativeCodexFn.mockResolvedValue(
    ok({ added_turns: 0, read_only: false, native_busy: false }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function App() {
    const [location, navigate] = useState<HubLocation>({
      view: "chat",
      workspace: "w",
      chat: "a",
      scope: "knowledge",
      runtime: "codex",
    });
    return createElement(HubApp, { mode: "agent", location, navigate });
  }
  render(createElement(QueryClientProvider, { client }, createElement(App)));
  await screen.findByText(/这个目录尚无原生聊天/);
  await waitFor(() => expect(api.getHubTurnFn).toHaveBeenCalled());
  completed = true;
  finish(
    ok({
      turn_id: "first-turn",
      conversation_id: "a",
      state: "completed",
      client_request_id: "rid",
      error_reason: null,
      updated_at: "now",
    }),
  );
  expect(
    await screen.findByRole("button", { name: "首轮后的原生聊天" }),
  ).toBeTruthy();
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
  client.clear();
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
});

it("explicitly resubmits the identical request only after its original ID was not found", async () => {
  ready();
  api.submitHubTurnFn.mockRejectedValueOnce(new Error("connection lost"));
  api.getHubRequestFn.mockResolvedValue({
    data: null,
    error: {
      reason: "CONVERSATION_NOT_FOUND",
      upstreamStatus: 404,
      message: "原请求不存在",
      layer: "hub",
      requestId: "lookup",
    },
  });
  api.getHubRequestFn.mockResolvedValueOnce({
    data: null,
    error: {
      reason: "HUB_TIMEOUT",
      upstreamStatus: 504,
      message: "核对超时",
      layer: "hub",
      requestId: "lookup-timeout",
    },
  });
  const accepted = {
    turn_id: "same-turn",
    conversation_id: "a",
    state: "completed",
    client_request_id: "original",
    error_reason: null,
    updated_at: "now",
  };
  api.submitHubTurnFn.mockResolvedValueOnce(ok(accepted));
  api.getHubTurnFn.mockResolvedValue(ok(accepted));
  show();
  await screen.findByText("回答 a");
  fireEvent.change(screen.getByRole("textbox", { name: "发送消息" }), {
    target: { value: "  original\n    code\n" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  await screen.findByRole("button", { name: "核对原请求" });
  expect(screen.queryByRole("button", { name: "重新提交原请求" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "核对原请求" }));
  await screen.findByText(/核对超时/);
  expect(screen.queryByRole("button", { name: "重新提交原请求" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "核对原请求" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "重新提交原请求" }),
  );
  await waitFor(() => expect(api.submitHubTurnFn).toHaveBeenCalledTimes(2));
  expect(api.submitHubTurnFn.mock.calls[1][0].data).toEqual(
    api.submitHubTurnFn.mock.calls[0][0].data,
  );
  expect(api.getHubRequestFn.mock.calls[0][0].data.client_request_id).toBe(
    api.submitHubTurnFn.mock.calls[0][0].data.input.client_request_id,
  );
});

it("never reconstructs an original request body from an ID restored after reload", async () => {
  ready();
  sessionStorage.setItem(
    "hub-request:a",
    "7a1d0c69-e707-46aa-b026-1fd5f6a9034c",
  );
  api.getHubRequestFn.mockResolvedValue({
    data: null,
    error: {
      reason: "CONVERSATION_NOT_FOUND",
      upstreamStatus: 404,
      message: "原请求不存在",
      layer: "hub",
      requestId: "lookup",
    },
  });
  show();
  fireEvent.click(await screen.findByRole("button", { name: "核对原请求" }));
  await screen.findByText("当前页面未保留原请求内容，请继续核对，或新建聊天。");
  expect(screen.queryByRole("button", { name: "重新提交原请求" })).toBeNull();
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
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
