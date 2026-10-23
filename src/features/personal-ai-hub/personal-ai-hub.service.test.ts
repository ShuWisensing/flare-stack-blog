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
  it("preserves unknown execution state without recommending a resend", async () => {
    const result = await sendAgentChatMessage(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "https://hub.test",
          PERSONAL_AI_HUB_API_TOKEN: "private",
        },
        fetch: async () =>
          Response.json(
            {
              error: {
                reason: "AGENT_EXECUTION_UNKNOWN",
                layer: "agent_runtime",
              },
            },
            { status: 503 },
          ),
      },
      { runtime: "codex", sessionId: "s", question: "read file" },
    );
    expect(result.error?.reason).toBe("AGENT_EXECUTION_UNKNOWN");
    expect(result.error?.message).toContain("刷新会话");
  });
  it.each([
    {},
    { id: "" },
    { id: "   " },
    { id: 42 },
  ])("rejects an invalid session identifier: %j", async (session) => {
    const context = {
      env: {
        PERSONAL_AI_HUB_API_URL: "https://hub.test",
        PERSONAL_AI_HUB_API_TOKEN: "private",
      },
      fetch: async () => Response.json({ session, items: [session] }),
    };
    expect(
      (await createAgentSession(context, "new", "codex")).error?.reason,
    ).toBe("HUB_RESPONSE_INVALID");
    expect((await listAgentSessions(context, "codex")).error?.reason).toBe(
      "HUB_RESPONSE_INVALID",
    );
  });
  it("rejects redirects without forwarding the Hub credential", async () => {
    const fetchMock = vi.fn(async (_url, _init) => {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://other.test/private" },
      });
    });
    const result = await getAgentStatus(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "https://hub.test",
          PERSONAL_AI_HUB_API_TOKEN: "private",
        },
        fetch: fetchMock,
      },
      "opencode",
    );
    expect(result.error).toMatchObject({
      reason: "HUB_UPSTREAM_ERROR",
      upstreamStatus: 302,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    [401, "HUB_UNAUTHORIZED"],
    [422, "HUB_INVALID_REQUEST"],
  ])("preserves HTTP %i as %s", async (status, reason) => {
    const result = await queryKnowledgeBase(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "https://hub.test",
          PERSONAL_AI_HUB_API_TOKEN: "private",
        },
        fetch: async () => new Response("private upstream detail", { status }),
      },
      { question: "test" },
    );
    expect(result.error).toMatchObject({ reason, upstreamStatus: status });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("rejects a malformed successful response", async () => {
    const result = await queryKnowledgeBase(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "https://hub.test",
          PERSONAL_AI_HUB_API_TOKEN: "private",
        },
        fetch: async () => new Response('{"answer":42}'),
      },
      { question: "test" },
    );
    expect(result.error?.reason).toBe("HUB_RESPONSE_INVALID");
  });
  it("reports invalid URL before attempting a request", async () => {
    const fetchMock = vi.fn();
    const result = await queryKnowledgeBase(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "ftp://hub.test",
          PERSONAL_AI_HUB_API_TOKEN: "private",
        },
        fetch: fetchMock,
      },
      { question: "test" },
    );
    expect(result.error?.reason).toBe("HUB_URL_INVALID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns an actionable error Result without upstream secrets", async () => {
    const result = await queryKnowledgeBase(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "https://hub.test",
          PERSONAL_AI_HUB_API_TOKEN: "secret",
        },
        fetch: async () => new Response("<html>secret</html>", { status: 502 }),
      },
      { question: "test" },
    );
    expect(result.error).toMatchObject({
      reason: "HUB_UPSTREAM_ERROR",
      upstreamStatus: 502,
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("requires explicit Hub API URL and token", () => {
    expect(() => getHubApiConfig({})).toThrow("PERSONAL_AI_HUB_API_URL");
    expect(() =>
      getHubApiConfig({
        PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com",
      }),
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
    const fetchMock = vi.fn(
      async () =>
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

    expect(result.data?.answer).toBe("ok");
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

  it("surfaces Hub offline errors without leaking token", async () => {
    const fetchMock = vi.fn(
      async () => new Response("internal detail", { status: 503 }),
    );

    const result = await queryKnowledgeBase(
      {
        env: {
          PERSONAL_AI_HUB_API_URL: "https://hub.test",
          PERSONAL_AI_HUB_API_TOKEN: "secret-token",
        },
        fetch: fetchMock,
      },
      { question: "test" },
    );
    expect(result.error).toMatchObject({ upstreamStatus: 503 });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("proxies Agent Chat messages to the local Hub agent API", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            citations: [],
            execution: { cache_hit: "miss" },
            runtime: "opencode",
            runtime_result: { id: "msg_1", status: "completed" },
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
        runtime: "opencode",
        model: "deepseek-v4-pro",
        retrievalMode: "hybrid",
        sessionId: "ses_1",
        topK: 8,
      },
    );

    expect(result.data?.runtime_result).toEqual({
      id: "msg_1",
      status: "completed",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hub-api.libresensing.com/agent/chat",
      expect.objectContaining({
        body: expect.stringContaining("deepseek-v4-pro"),
        method: "POST",
      }),
    );
  });

  it("proxies Agent Chat session endpoints", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.endsWith("/agent/sessions?runtime=opencode") &&
          init?.method === "GET"
        ) {
          return new Response(JSON.stringify({ items: [{ id: "ses_1" }] }), {
            status: 200,
          });
        }
        if (url.endsWith("/agent/sessions") && init?.method === "POST") {
          return new Response(JSON.stringify({ session: { id: "ses_2" } }), {
            status: 200,
          });
        }
        if (url.endsWith("/agent/status?runtime=opencode")) {
          return new Response(
            JSON.stringify({
              runtime: "opencode",
              runtime_status: { busy: false },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith("/agent/sessions/ses_1/messages?runtime=opencode")) {
          return new Response(JSON.stringify({ items: [{ id: "msg_1" }] }), {
            status: 200,
          });
        }
        throw new Error(`unexpected URL: ${url}`);
      },
    );
    const context = {
      env: {
        PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com",
        PERSONAL_AI_HUB_API_TOKEN: "test-token",
      },
      fetch: fetchMock,
    };

    expect(
      (await listAgentSessions(context, "opencode")).data?.items[0].id,
    ).toBe("ses_1");
    expect(
      (await getAgentStatus(context, "opencode")).data?.runtime_status.busy,
    ).toBe(false);
    expect(
      (await listAgentMessages(context, "ses_1", "opencode")).data?.items[0].id,
    ).toBe("msg_1");
    expect(
      (await createAgentSession(context, "新会话", "opencode")).data?.session
        .id,
    ).toBe("ses_2");
  });
});
