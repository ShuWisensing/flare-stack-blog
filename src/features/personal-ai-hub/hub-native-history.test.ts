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
  listNativeCodexFn: vi.fn(),
  bindNativeCodexFn: vi.fn(),
  discoverNativeProjectsFn: vi.fn(),
  registerNativeProjectFn: vi.fn(),
}));
vi.mock("./api/hub-native.admin.api", () => api);

import { NativeHistoryPicker } from "./components/native-history-picker";
import { NativeProjectPicker } from "./components/native-project-picker";

afterEach(cleanup);
it("discovers project pages, merges repeated directories and registers only the selected native project", async () => {
  const project = {
    id: "p1",
    cwd: "E:/projects/native",
    name: "原生项目",
    native_id: "native-a",
    available: true,
    error: null,
    workspace_id: null,
    observed_chats: 2,
    updated_at: "2026-10-26",
  };
  api.discoverNativeProjectsFn.mockImplementation(async ({ data }) => ({
    data: {
      items: data.cursor
        ? [
            project,
            {
              ...project,
              id: "p2",
              name: "失效项目",
              cwd: "E:/missing",
              available: false,
            },
          ]
        : [project],
      next_cursor: data.cursor ? null : "page-2",
    },
    error: null,
  }));
  api.registerNativeProjectFn.mockResolvedValue({
    data: {
      workspace: {
        id: "w-new",
        name: "原生项目",
        kind: "agent",
        root_key: "native",
        root_path: project.cwd,
        available: true,
      },
    },
    error: null,
  });
  const select = vi.fn();
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
      createElement(NativeProjectPicker, { close: vi.fn(), select }),
    ),
  );
  expect(await screen.findByText("原生项目")).toBeTruthy();
  expect(api.registerNativeProjectFn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "继续发现项目" }));
  await screen.findByText("失效项目");
  expect(screen.getAllByText("原生项目")).toHaveLength(1);
  expect(
    screen
      .getByRole("button", { name: "接入 失效项目" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "接入 原生项目" }));
  await waitFor(() => expect(select).toHaveBeenCalledOnce());
  expect(api.registerNativeProjectFn.mock.calls[0][0].data).toEqual({
    native_id: "native-a",
    expected_cwd: "E:/projects/native",
    name: "原生项目",
  });
  client.clear();
});
it("loads native pages for this workspace and binds the selected original thread", async () => {
  const ok = (data: unknown) => ({ data, error: null });
  const row = {
    id: "native-1",
    title: "本机项目聊天",
    cwd: "E:/blog",
    source: "appServer",
    parent_id: null,
    created_at: "today",
    updated_at: "today",
    status: "notLoaded",
    archived: false,
  };
  api.listNativeCodexFn.mockImplementation(async ({ data }) =>
    ok({
      items: [
        {
          ...row,
          id: data.cursor ? "native-2" : "native-1",
          title: data.cursor ? "第二页聊天" : "本机项目聊天",
        },
      ],
      next_cursor: data.cursor ? null : "page-2",
    }),
  );
  api.bindNativeCodexFn.mockResolvedValue(
    ok({
      conversation: {
        id: "chat-1",
        workspace_id: "w",
        runtime: "codex",
        title: "本机项目聊天",
        preferred_model_id: null,
        archived_at: null,
        updated_at: "today",
        native_session_id: "native-1",
        native_read_only: true,
      },
      conversation_id: "chat-1",
      native_session_id: "native-1",
      added_turns: 1,
      native_busy: false,
      read_only: true,
    }),
  );
  const select = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(NativeHistoryPicker, {
        workspaceId: "w",
        close: vi.fn(),
        select,
      }),
    ),
  );
  expect(await screen.findByText("本机项目聊天")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "更多原生聊天" }));
  await screen.findByText("第二页聊天");
  fireEvent.click(screen.getByRole("button", { name: /本机项目聊天/ }));
  await waitFor(() => expect(select).toHaveBeenCalledOnce());
  expect(api.bindNativeCodexFn.mock.calls[0][0].data).toEqual({
    workspace_id: "w",
    native_id: "native-1",
  });
  expect(api.listNativeCodexFn.mock.calls[1][0].data.cursor).toBe("page-2");
  client.clear();
});
