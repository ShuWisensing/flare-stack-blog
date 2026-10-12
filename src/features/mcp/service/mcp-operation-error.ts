import { z } from "zod";
import type { OAuthScopeRequest } from "@/features/oauth-provider/schema/oauth-provider.schema";
import type { McpToolContext } from "./mcp.types";
import { canAccessScopes } from "./mcp-tool-utils";

export class McpOperationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "McpOperationError";
  }
}

export function requireMcpIdentity(
  context: McpToolContext,
  scopes: OAuthScopeRequest,
) {
  const { subject, clientId } = context.principal;
  if (!subject || !clientId)
    throw new McpOperationError(
      "UNAUTHENTICATED",
      "缺少 OAuth 用户或客户端身份。",
    );
  if (!canAccessScopes(context, scopes))
    throw new McpOperationError(
      "INSUFFICIENT_SCOPE",
      "当前授权不包含所需权限。",
    );
  return { subject, clientId };
}

export function mcpOperationErrorResult(error: unknown) {
  if (!(error instanceof McpOperationError)) {
    console.error(
      JSON.stringify({ message: "MCP operation failed", error: String(error) }),
    );
  }
  const failure =
    error instanceof McpOperationError
      ? {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          details: error.details,
        }
      : {
          code: "INTERNAL_ERROR",
          message: "操作失败，请检查服务端日志后重试。",
          retryable: true,
          details: {},
        };
  return {
    isError: true as const,
    content: [
      { type: "text" as const, text: JSON.stringify({ error: failure }) },
    ],
    structuredContent: { error: failure },
  };
}

export function mcpOperationResult(result: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: result,
  };
}

/** 同时声明成功对象和错误对象，避免客户端用成功字段校验错误结果。 */
export function withMcpOperationError<T extends z.ZodRawShape>(
  success: z.ZodObject<T>,
) {
  const errorSchema = z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
      details: z.record(z.string(), z.unknown()),
    }),
  });
  return success
    .partial()
    .extend({ error: errorSchema.shape.error.optional() })
    .superRefine((value, ctx) => {
      if (
        !success.strict().safeParse(value).success &&
        !errorSchema.strict().safeParse(value).success
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "Expected a complete success result or a structured operation error.",
        });
      }
    })
    .meta({
      anyOf: [
        z.toJSONSchema(success, { target: "draft-7" }),
        z.toJSONSchema(errorSchema, { target: "draft-7" }),
      ],
    });
}
