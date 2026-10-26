import { describe, expect, it } from "vitest";
import {
  getHubTurn,
  getWikiGraph,
  submitHubTurn,
} from "./service/hub-chat.service";

const context = {
  env: {
    PERSONAL_AI_HUB_API_URL: "https://hub.test",
    PERSONAL_AI_HUB_API_TOKEN: "server-secret",
  },
};

describe("Hub V2 proxy contract", () => {
  it("retains bounded native method and code diagnostics", async () => {
    const result = await getWikiGraph(
      {
        ...context,
        fetch: async () =>
          Response.json(
            {
              error: {
                reason: "AGENT_RUNTIME_NOT_READY",
                layer: "agent_runtime",
                diagnostics: {
                  method: "account/read",
                  native_code: -32602,
                  upstream_message: "invalid account parameters",
                },
              },
            },
            { status: 503 },
          ),
      },
      { scope: "knowledge" },
    );
    expect(result.error?.diagnostics?.method).toBe("account/read");
    expect(result.error?.diagnostics?.native_code).toBe(-32602);
  });
  it("keeps the original question and request ID, then only reads the accepted turn", async () => {
    const calls: { path: string; method: string; body: unknown }[] = [];
    const input = {
      client_request_id: "71f9a516-9c08-4caf-93c4-b9d8f0c4ec40",
      question: "  code\n",
      model_id: null,
      answer_mode: "chat" as const,
      knowledge: {
        enabled: false,
        retrieval_mode: "hybrid" as const,
        rerank_mode: "local" as const,
      },
    };
    const fetcher: typeof fetch = async (url, init) => {
      expect((init?.headers as Record<string, string>)["X-Hub-Token"]).toBe(
        "server-secret",
      );
      calls.push({
        path: String(url),
        method: String(init?.method),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json({
        turn_id: "turn_1",
        conversation_id: "conversation_1",
        state: "queued",
        client_request_id: input.client_request_id,
        error_reason: null,
        updated_at: "2026-10-24T00:00:00Z",
      });
    };
    const ctx = { ...context, fetch: fetcher };
    expect(
      (await submitHubTurn(ctx, "conversation_1", input)).error,
    ).toBeNull();
    await getHubTurn(ctx, "turn_1");
    expect(calls[0].body).toEqual(input);
    expect(calls.map((c) => c.method)).toEqual(["POST", "GET"]);
  });

  it("preserves graph version errors rather than reporting an empty graph", async () => {
    const result = await getWikiGraph(
      {
        ...context,
        fetch: async () =>
          Response.json(
            {
              error: {
                reason: "GRAPH_SNAPSHOT_CHANGED",
                layer: "knowledge_graph",
              },
            },
            { status: 409 },
          ),
      },
      { scope: "knowledge" },
    );
    expect(result.error?.reason).toBe("GRAPH_SNAPSHOT_CHANGED");
  });
});
