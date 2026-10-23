// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listPersonalAiHubAgentSessionsFn: vi.fn(),
  getPersonalAiHubAgentStatusFn: vi.fn(),
  listPersonalAiHubAgentMessagesFn: vi.fn(),
  createPersonalAiHubAgentSessionFn: vi.fn(),
  sendPersonalAiHubAgentChatMessageFn: vi.fn(),
}));
vi.mock("@/features/personal-ai-hub/api/personal-ai-hub.admin.api", () => api);
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options }),
}));

import { Route } from "@/routes/admin/personal-ai-hub/agent-chat";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function showPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(Route.options.component as ComponentType),
    ),
  );
}
describe("Agent Chat user flow", () => {
  it("refreshes the selected session messages after a request failure", async () => {
    readySessions();
    showPage();
    await screen.findByText("Session A");
    fireEvent.change(screen.getByLabelText("Hub session"), {
      target: { value: "A" },
    });
    await waitFor(() =>
      expect(api.listPersonalAiHubAgentMessagesFn).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() =>
      expect(api.listPersonalAiHubAgentMessagesFn).toHaveBeenCalledTimes(2),
    );
    expect(api.listPersonalAiHubAgentMessagesFn).toHaveBeenLastCalledWith({
      data: { runtime: "opencode", sessionId: "A" },
    });
  });
  function readySessions() {
    api.listPersonalAiHubAgentSessionsFn.mockResolvedValue({
      data: {
        items: [
          { id: "A", title: "Session A" },
          { id: "B", title: "Session B" },
        ],
      },
      error: null,
    });
    api.getPersonalAiHubAgentStatusFn.mockResolvedValue({
      data: { runtime: "opencode", runtime_status: {} },
      error: null,
    });
    api.listPersonalAiHubAgentMessagesFn.mockResolvedValue({
      data: { items: [] },
      error: null,
    });
  }
  it("clears the previous answer when switching sessions", async () => {
    readySessions();
    api.sendPersonalAiHubAgentChatMessageFn.mockResolvedValue({
      data: {
        runtime: "opencode",
        runtime_result: { text: "Answer for A" },
        citations: [],
        recall_items: [],
        execution: {},
        timings: {},
      },
      error: null,
    });
    showPage();
    await screen.findByText("Session A");
    fireEvent.change(screen.getByLabelText("Hub session"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "task" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send To Agent" }));
    await screen.findByText("Answer for A");
    fireEvent.change(screen.getByLabelText("Hub session"), {
      target: { value: "B" },
    });
    expect(screen.queryByText("Answer for A")).toBeNull();
  });
  it("clears the previous session error when creating a new session", async () => {
    readySessions();
    api.sendPersonalAiHubAgentChatMessageFn.mockResolvedValue({
      data: null,
      error: {
        reason: "AGENT_EXECUTION_UNKNOWN",
        layer: "agent_runtime",
        requestId: "req-A",
        message: "Previous session A error",
      },
    });
    api.createPersonalAiHubAgentSessionFn.mockResolvedValue({
      data: { session: { id: "B", title: "Session B" } },
      error: null,
    });
    showPage();
    await screen.findByText("Session A");
    fireEvent.change(screen.getByLabelText("Hub session"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "task" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send To Agent" }));
    await screen.findByText(/Previous session A error/);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Hub session")).toHaveProperty("value", "B"),
    );
    expect(screen.queryByText(/Previous session A error/)).toBeNull();
  });
  it("prevents sending and switching while a session is being created", async () => {
    readySessions();
    api.createPersonalAiHubAgentSessionFn.mockReturnValue(
      new Promise(() => {}),
    );
    showPage();
    await screen.findByText("Session A");
    fireEvent.change(screen.getByLabelText("Hub session"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "task" },
    });
    act(() => {
      screen.getByRole<HTMLButtonElement>("button", { name: "Create" }).click();
      screen
        .getByRole<HTMLButtonElement>("button", { name: "Send To Agent" })
        .click();
      fireEvent.change(screen.getByLabelText("执行器"), {
        target: { value: "codex" },
      });
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create" })).toHaveProperty(
        "disabled",
        true,
      ),
    );
    expect(
      screen.getByRole("button", { name: "Send To Agent" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Hub session")).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Send To Agent" }));
    expect(api.sendPersonalAiHubAgentChatMessageFn).not.toHaveBeenCalled();
    expect(screen.getByLabelText("执行器")).toHaveProperty("value", "opencode");
  });
  it("renders a failed session lookup as an error", async () => {
    api.listPersonalAiHubAgentSessionsFn.mockResolvedValue({
      data: null,
      error: {
        reason: "AGENT_RUNTIME_NOT_READY",
        message: "Runtime unavailable",
        layer: "hub",
        requestId: "req-test",
      },
    });
    api.getPersonalAiHubAgentStatusFn.mockResolvedValue({
      data: { runtime: "opencode", runtime_status: {} },
      error: null,
    });
    showPage();
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("Runtime unavailable"),
    );
  });
  it("clears the selected session when changing runtime", async () => {
    api.listPersonalAiHubAgentSessionsFn.mockImplementation(
      async ({ data }) => ({
        data: {
          items: [
            { id: data.runtime + "-1", title: data.runtime + " session" },
          ],
        },
        error: null,
      }),
    );
    api.getPersonalAiHubAgentStatusFn.mockImplementation(async ({ data }) => ({
      data: { runtime: data.runtime, runtime_status: {} },
      error: null,
    }));
    api.listPersonalAiHubAgentMessagesFn.mockResolvedValue({
      data: { items: [] },
      error: null,
    });
    showPage();
    await screen.findByText("opencode session");
    const select = screen.getByLabelText("Hub session");
    fireEvent.change(select, { target: { value: "opencode-1" } });
    expect(select).toHaveProperty("value", "opencode-1");
    fireEvent.change(screen.getByLabelText("执行器"), {
      target: { value: "codex" },
    });
    await waitFor(() =>
      expect(api.listPersonalAiHubAgentSessionsFn).toHaveBeenCalledWith({
        data: { runtime: "codex" },
      }),
    );
    expect(select).toHaveProperty("value", "");
  });
});
