import { describe, expect, it, vi } from "vitest";
import type { McpToolContext } from "../../service/mcp.types";
import { mcpPersonalAiHubTools } from "./index";
import { wikiQueryTool } from "./tools/wiki-query.tool";
import { wikiSourcesListTool } from "./tools/wiki-sources-list.tool";
import { wikiStatusTool } from "./tools/wiki-status.tool";

describe("personal ai hub mcp tools", () => {
  it("registers wiki_query as a read-only Personal AI Hub tool", () => {
    expect(mcpPersonalAiHubTools).toContain(wikiQueryTool);
    expect(wikiQueryTool.name).toBe("wiki_query");
    expect(wikiQueryTool.requiredScopes).toEqual({
      "personal-ai-hub": ["read"],
    });
    expect(mcpPersonalAiHubTools).toContain(wikiStatusTool);
    expect(mcpPersonalAiHubTools).toContain(wikiSourcesListTool);
  });

  it("forwards wiki_query requests to the local Hub query API", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          answer: "matched answer",
          citations: [],
          execution: { cache_hit: false },
          recall_items: [],
          timings: { total_ms: 12 },
        }),
        { status: 200 },
      );
    });

    const result = await wikiQueryTool.handler(
      {
        question: "Fresnel Zone",
        answerMode: "llm_rag",
        llmModel: "deepseek-v4-flash",
        retrievalMode: "hybrid",
        topK: 8,
        rerankMode: "off",
        rerankTopK: 8,
      },
      {
        env: {
          PERSONAL_AI_HUB_API_TOKEN: "test-token",
          PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com/",
        },
        fetch: fetchMock,
      } as unknown as McpToolContext,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hub-api.libresensing.com/kb/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Hub-Token": "test-token",
        }),
      }),
    );
    expect(result.isError).not.toBe(true);
    expect("structuredContent" in result ? result.structuredContent : null).toEqual(
      expect.objectContaining({ answer: "matched answer" }),
    );
  });

  it("forwards wiki_status and wiki_sources_list to local Hub APIs", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/kb/status")) {
        return new Response(JSON.stringify({ status: "ready" }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [{ source_id: "src_1" }] }), {
        status: 200,
      });
    });
    const context = {
      env: {
        PERSONAL_AI_HUB_API_TOKEN: "test-token",
        PERSONAL_AI_HUB_API_URL: "https://hub-api.libresensing.com",
      },
      fetch: fetchMock,
    } as unknown as McpToolContext;

    const status = await wikiStatusTool.handler(context);
    const sources = await wikiSourcesListTool.handler(context);

    expect(status.isError).not.toBe(true);
    expect(sources.isError).not.toBe(true);
    expect("structuredContent" in status ? status.structuredContent : null).toEqual({ status: "ready" });
    expect("structuredContent" in sources ? sources.structuredContent : null).toEqual({ items: [{ source_id: "src_1" }] });
  });
});
