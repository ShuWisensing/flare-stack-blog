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

const api = vi.hoisted(() => ({ collectKnowledgeChatFn: vi.fn() }));
vi.mock("./api/hub-knowledge.admin.api", () => api);

import { ChatKnowledgeCapture } from "./components/chat-knowledge-capture";

afterEach(cleanup);
it("exports only selected messages without calling an answer model", async () => {
  api.collectKnowledgeChatFn.mockResolvedValue({
    data: { id: "job", state: "queued" },
    error: null,
  });
  const close = vi.fn();
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const messages = [
    { id: "m1", role: "user", content_md: "我偏好中文注释。" },
    { id: "m2", role: "assistant", content_md: "模型推断" },
  ];
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(ChatKnowledgeCapture, {
        conversationId: "c1",
        messages,
        close,
      }),
    ),
  );
  fireEvent.click(screen.getByLabelText("选择消息 m2"));
  fireEvent.click(screen.getByRole("button", { name: "保存所选聊天" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(api.collectKnowledgeChatFn.mock.calls[0][0].data).toMatchObject({
    conversation_id: "c1",
    message_ids: ["m1"],
  });
  client.clear();
});
