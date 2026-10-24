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
  listHubMessagesFn: vi.fn(),
  getHubRuntimesFn: vi.fn(),
  getHubModelsFn: vi.fn(),
  checkHubRuntimeFn: vi.fn(),
  getHubTurnFn: vi.fn(),
  submitHubTurnFn: vi.fn(),
  getHubRequestFn: vi.fn(),
  getHubTurnDetailsFn: vi.fn(),
  getHubCitationFn: vi.fn(),
}));
vi.mock("./api/hub-chat.admin.api", () => api);

import { HubConversationView } from "./components/hub-conversation";
import type { HubConversation } from "./schema/hub-chat.schema";
import { HubLocationSchema } from "./schema/hub-location.schema";

const ok = (data: unknown) => ({ data, error: null });
const chat: HubConversation = {
  id: "c",
  workspace_id: "w",
  runtime: "codex",
  title: "Read",
  preferred_model_id: null,
  archived_at: null,
  updated_at: "now",
  active_turn: null,
};
function ready() {
  api.listHubMessagesFn.mockResolvedValue(
    ok({ items: [], next_before_seq: null }),
  );
  api.getHubRuntimesFn.mockResolvedValue(
    ok({
      items: [
        {
          runtime: "codex",
          runtime_status: {
            status: "unverified",
            check_id: null,
            checked_at: null,
            expires_at: null,
          },
        },
      ],
    }),
  );
  api.getHubModelsFn.mockResolvedValue(
    ok({
      items: [{ id: "codex-test-model", name: "Codex 原生模型" }],
      configured_model: "codex-test-model",
    }),
  );
}
function show(value = chat) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(HubConversationView, { chat: value }),
    ),
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
});
it("uses local Codex configuration without DeepSeek model options or automatic checks", async () => {
  ready();
  show();
  await screen.findByText("这个项目需要做什么？");
  expect(screen.getByText("本机 Codex 配置")).toBeTruthy();
  expect(document.querySelector('option[value^="deepseek"]')).toBeNull();
  expect(api.checkHubRuntimeFn).not.toHaveBeenCalled();
});
it("checks the selected runtime and workspace without submitting a task", async () => {
  ready();
  api.checkHubRuntimeFn.mockResolvedValue(
    ok({
      runtime: "codex",
      check_id: "check",
      runtime_status: { status: "checking" },
    }),
  );
  show();
  await screen.findByText("这个项目需要做什么？");
  fireEvent.click(screen.getByRole("button", { name: "检查连接" }));
  await waitFor(() =>
    expect(api.checkHubRuntimeFn).toHaveBeenCalledWith({
      data: { runtime: "codex", workspace_id: "w" },
    }),
  );
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
});
it("refreshes an expired ready snapshot by GET without a new check", async () => {
  ready();
  const expiry = new Date(Date.now() + 50).toISOString();
  api.getHubRuntimesFn
    .mockResolvedValueOnce(
      ok({
        items: [
          {
            runtime: "codex",
            runtime_status: {
              status: "ready",
              check_id: "check",
              checked_at: new Date().toISOString(),
              expires_at: expiry,
            },
          },
        ],
      }),
    )
    .mockResolvedValue(
      ok({
        items: [
          {
            runtime: "codex",
            runtime_status: {
              status: "stale",
              check_id: "check",
              checked_at: new Date().toISOString(),
              expires_at: expiry,
            },
          },
        ],
      }),
    );
  show();
  await waitFor(
    () =>
      expect(api.getHubRuntimesFn.mock.calls.length).toBeGreaterThanOrEqual(2),
    { timeout: 2500 },
  );
  expect(api.checkHubRuntimeFn).not.toHaveBeenCalled();
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
});
it("restores observation of a pending turn after refresh without posting", async () => {
  ready();
  api.getHubTurnFn.mockResolvedValue(
    ok({
      turn_id: "pending",
      conversation_id: "c",
      state: "completed",
      client_request_id: "rid",
      error_reason: null,
      updated_at: "now",
    }),
  );
  show({
    ...chat,
    active_turn: { id: "pending", state: "running", client_request_id: "rid" },
  });
  await waitFor(() =>
    expect(api.getHubTurnFn).toHaveBeenCalledWith({ data: { id: "pending" } }),
  );
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
});
it("keeps an unknown turn blocked until the original native task is explicitly verified", async () => {
  ready();
  api.getHubTurnFn.mockImplementation(async ({ data }) =>
    ok({
      turn_id: "unknown",
      conversation_id: "c",
      state: data.verify_native ? "completed" : "unknown",
      client_request_id: "rid",
      error_reason: null,
      updated_at: "now",
    }),
  );
  show({
    ...chat,
    active_turn: { id: "unknown", state: "unknown", client_request_id: "rid" },
  });
  const verify = await screen.findByRole("button", { name: "核验原任务" });
  expect(
    (screen.getByRole("textbox", { name: "发送消息" }) as HTMLTextAreaElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(verify);
  await waitFor(() =>
    expect(api.getHubTurnFn).toHaveBeenCalledWith({
      data: { id: "unknown", verify_native: true },
    }),
  );
  expect(api.submitHubTurnFn).not.toHaveBeenCalled();
});
it("rejects malformed reader URLs rather than opening another node", () => {
  expect(() => HubLocationSchema.parse({ view: "reader" })).toThrow();
  expect(() => HubLocationSchema.parse({ view: "invalid" })).toThrow();
  expect(
    HubLocationSchema.parse({
      view: "reader",
      node: "wiki:a",
      scope: "knowledge",
    }).node,
  ).toBe("wiki:a");
});
