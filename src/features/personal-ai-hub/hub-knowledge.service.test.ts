import { expect, it } from "vitest";
import {
  beginKnowledgeUpload,
  getKnowledgeCandidates,
  getKnowledgeCatalog,
  sendKnowledgeChunk,
  submitKnowledgeExtraction,
} from "./service/hub-knowledge.service";

it("forwards the candidate cursor and preserves the next page contract", async () => {
  const ctx = {
    env: {
      PERSONAL_AI_HUB_API_URL: "https://hub.test",
      PERSONAL_AI_HUB_API_TOKEN: "server-only",
    },
    fetch: async (url: string | URL | Request) => {
      expect(new URL(String(url)).searchParams.get("cursor")).toBe("page-2");
      return Response.json({ items: [], next_cursor: "page-3" });
    },
  };
  expect((await getKnowledgeCandidates(ctx, "page-2")).data).toEqual({
    items: [],
    next_cursor: "page-3",
  });
});

it("accepts the chunk acknowledgement contract", async () => {
  const ctx = {
    env: {
      PERSONAL_AI_HUB_API_URL: "https://hub.test",
      PERSONAL_AI_HUB_API_TOKEN: "server-only",
    },
    fetch: async () => Response.json({ accepted: true, index: 0 }),
  };
  expect(
    (
      await sendKnowledgeChunk(ctx, "upload_1", {
        index: 0,
        data_base64: "YWJj",
        sha256: "a".repeat(64),
      })
    ).data,
  ).toEqual({ accepted: true, index: 0 });
});

it("uploads and extraction use the protected proxy and return jobs immediately", async () => {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const ctx = {
    env: {
      PERSONAL_AI_HUB_API_URL: "https://hub.test",
      PERSONAL_AI_HUB_API_TOKEN: "server-only",
    },
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["X-Hub-Token"]).toBe(
        "server-only",
      );
      calls.push({
        url: String(url),
        method: String(init?.method),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json(
        String(url).endsWith("catalog")
          ? {
              sources: [],
              jobs: [],
              publication: { state: "ready" },
              source_count: 0,
              wiki_page_count: 0,
            }
          : String(url).endsWith("uploads")
            ? { id: "upload_1", chunk_bytes: 1048576, state: "uploading" }
            : {
                id: "job_1",
                kind: "extract",
                state: "queued",
                stage: "queued",
                created_at: "today",
                result: null,
                error: null,
              },
      );
    },
  };
  expect((await getKnowledgeCatalog(ctx)).data?.sources).toEqual([]);
  expect(
    (
      await beginKnowledgeUpload(ctx, {
        request_id: "request-1",
        filename: "paper.pdf",
        size_bytes: 12,
        sha256: "a".repeat(64),
      })
    ).data?.id,
  ).toBe("upload_1");
  expect(
    (
      await submitKnowledgeExtraction(ctx, {
        request_id: "request-2",
        source_id: "s1",
        model: "deepseek-flash",
      })
    ).data?.state,
  ).toBe("queued");
  expect(calls.map((c) => c.method)).toEqual(["GET", "POST", "POST"]);
});
