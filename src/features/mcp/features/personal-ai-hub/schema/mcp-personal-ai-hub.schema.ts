import { z } from "zod";
import { HubQueryResponseSchema } from "@/features/personal-ai-hub/schema/personal-ai-hub.schema";

export const McpWikiQueryInputSchema = z.object({
  question: z.string().trim().min(1).describe("Question to ask the local LLM Wiki knowledge base."),
  answerMode: z.enum(["local", "llm_rag"]).default("llm_rag").describe("Answer mode."),
  llmModel: z
    .enum(["qwen-max", "qwen-plus", "qwen3.6-plus", "deepseek-v4-flash", "deepseek-v4-pro"])
    .default("deepseek-v4-flash")
    .describe("LLM model used when answerMode is llm_rag."),
  retrievalMode: z.enum(["bm25", "vector", "hybrid", "local"]).default("hybrid").describe("Retrieval mode."),
  topK: z.number().int().min(1).max(50).default(8).describe("Maximum retrieved items."),
  rerankMode: z.string().default("off").describe("Rerank mode, such as off, qwen3-rerank, or llm model name."),
  rerankTopK: z.number().int().min(1).max(50).default(8).describe("Maximum reranked items."),
});

export const McpWikiQueryOutputSchema = HubQueryResponseSchema;
