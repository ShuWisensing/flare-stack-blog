import { describe, expect, it, vi } from "vitest";
import {
  createAgentSession,
  getAgentStatus,
  getHubApiConfig,
  listAgentMessages,
  listAgentSessions,
  queryKnowledgeBase,
  sendAgentChatMessage,
} from "@/features/personal-ai-hub/service/personal-ai-hub.service";

describe("Personal AI Hub service", () => {
  it("requires explicit local Hub API URL and token", () => {
    expect(() => getHubApiConfig({})).toThrow("PERSONAL_AI_HUB_API_URL");
    expect(() =>
      getHubApiConfig({ PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com" }),
    ).toThrow("PERSONAL_AI_HUB_API_TOKEN");
  });

  it("normalizes Hub API URL without trailing slash", () => {
    const config = getHubApiConfig({
      PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com/",
      PERSONAL_AI_HUB_API_TOKEN: "test-token",
    });

    expect(config.apiUrl).toBe("https://hub-api.libresensing.com");
    expect(config.token).toBe("test-token");
  });

  it("proxies knowledge base query with X-Hub-Token", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          answer: "ok",
          citations: [],
          recall_items: [],
          timings: { total_ms: 1 },
          execution: { cache_id: "qa_test" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await queryKnowledgeBase(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com",
          PERSONAL_AI_HUB_API_TOKEN: "test-token",
        },
        fetch: fetchMock,
      },
      {
        question: "怎么用 Fresnel Zone 做呼吸检测",
        answerMode: "local",
        retrievalMode: "bm25",
        topK: 8,
      },
    );

    expect(result.answer).toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hub-api.libresensing.com/kb/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Hub-Token": "test-token",
        }),
      }),
    );
  });

  it("surfaces local Hub offline errors without leaking token", async () => {
    const fetchMock = vi.fn(async () => new Response("internal detail", { status: 503 }));

    await expect(() =>
      queryKnowledgeBase(
        {
          env: {
            PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com",
            PERSONAL_AI_HUB_API_TOKEN: "secret-token",
          },
          fetch: fetchMock,
        },
        {
          question: "test",
          answerMode: "local",
          retrievalMode: "bm25",
          topK: 8,
        },
      ),
    ).rejects.toThrow("本地 Personal AI Hub 服务不可用");
  });

  it("proxies Agent Chat messages to the local Hub agent API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          citations: [],
          execution: { cache_hit: "miss" },
          opencode_result: { id: "msg_1", status: "completed" },
          recall_items: [],
          timings: { total_ms: 15 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await sendAgentChatMessage(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com",
          PERSONAL_AI_HUB_API_TOKEN: "test-token",
        },
        fetch: fetchMock,
      },
      {
        question: "Fresnel Zone",
        model: "deepseek-v4-pro",
        retrievalMode: "hybrid",
        sessionId: "ses_1",
        topK: 8,
      },
    );

    expect(result.opencode_result).toEqual({ id: "msg_1", status: "completed" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hub-api.libresensing.com/agent/chat",
      expect.objectContaining({
        body: expect.stringContaining("deepseek-v4-pro"),
        method: "POST",
      }),
    );
  });

  it("proxies Agent Chat session endpoints", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/agent/sessions") && init?.method === "GET") {
        return new Response(JSON.stringify({ items: [{ id: "ses_1" }] }), { status: 200 });
      }
      if (url.endsWith("/agent/sessions") && init?.method === "POST") {
        return new Response(JSON.stringify({ session: { id: "ses_2" } }), { status: 200 });
      }
      if (url.endsWith("/agent/status")) {
        return new Response(JSON.stringify({ opencode: { busy: false } }), { status: 200 });
      }
      if (url.endsWith("/agent/sessions/ses_1/messages")) {
        return new Response(JSON.stringify({ items: [{ id: "msg_1" }] }), { status: 200 });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const context = {
      env: {
        PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com",
        PERSONAL_AI_HUB_API_TOKEN: "test-token",
      },
      fetch: fetchMock,
    };

    expect((await listAgentSessions(context)).items[0].id).toBe("ses_1");
    expect((await getAgentStatus(context)).opencode.busy).toBe(false);
    expect((await listAgentMessages(context, "ses_1")).items[0].id).toBe("msg_1");
    expect((await createAgentSession(context, "新会话")).session.id).toBe("ses_2");
  });
});
