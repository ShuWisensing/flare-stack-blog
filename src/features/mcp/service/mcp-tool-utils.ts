import type { OAuthScopeRequest } from "@/features/oauth-provider/schema/oauth-provider.schema";
import { getMissingScopes } from "@/features/oauth-provider/service/oauth-provider.service";
import type { McpToolContext } from "./mcp.types";

export function createTextToolResult(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

export function createScopeErrorResult(
  context: McpToolContext,
  requiredScopes: OAuthScopeRequest,
  structuredErrors = false,
) {
  const missingScopes = getMissingScopes(
    context.principal.scopes,
    requiredScopes,
  );

  return {
    content: [
      {
        type: "text" as const,
        text: `Missing required scopes: ${missingScopes.join(", ")}`,
      },
    ],
    isError: true as const,
    ...(structuredErrors
      ? {
          structuredContent: {
            error: {
              code: "INSUFFICIENT_SCOPE",
              message: `Missing required scopes: ${missingScopes.join(", ")}`,
              retryable: false,
              details: { missingScopes },
            },
          },
        }
      : {}),
  };
}

export function canAccessTool(
  context: McpToolContext,
  requiredScopes: OAuthScopeRequest,
) {
  return canAccessScopes(context, requiredScopes);
}

export function canAccessScopes(
  context: McpToolContext,
  requiredScopes: OAuthScopeRequest,
) {
  return (
    getMissingScopes(context.principal.scopes, requiredScopes).length === 0
  );
}
