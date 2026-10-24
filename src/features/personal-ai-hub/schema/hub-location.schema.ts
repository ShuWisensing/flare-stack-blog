import { z } from "zod";
export const HubLocationSchema = z
  .object({
    view: z.enum(["chat", "graph", "sources", "reader"]).default("chat"),
    scope: z.enum(["knowledge", "evidence"]).default("knowledge"),
    workspace: z.string().min(1).max(200).optional(),
    chat: z.string().min(1).max(200).optional(),
    node: z.string().min(1).max(200).optional(),
  })
  .refine(
    (value) => value.view !== "reader" || Boolean(value.node),
    "阅读页需要知识节点编号",
  );
