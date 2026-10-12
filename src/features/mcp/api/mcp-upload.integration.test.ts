import { createExecutionContext, env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getOAuthHelpers } from "@/features/oauth-provider/oauth-provider.config";
import { getDb } from "@/lib/db";
import type { McpToolContext } from "../service/mcp.types";
import { handleMcpUploadRequest } from "./mcp-upload-handler";

function context(): McpToolContext {
  return {
    env,
    db: getDb(env),
    executionCtx: createExecutionContext(),
    principal: {
      subject: "upload-admin",
      clientId: "test-client",
      scopes: ["posts:write", "media:write"],
    },
  };
}

describe("MCP 二进制上传接口", () => {
  it("复用 OAuth 保护，匿名请求不能上传", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/mcp/uploads?kind=image&fileName=x.png",
      {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: "fake",
      },
    );
    expect(response.status).toBe(401);
  });

  it("接收二进制图片并返回有期限的凭证", async () => {
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const response = await handleMcpUploadRequest(
      new Request(
        "https://example.com/api/mcp/uploads?kind=image&fileName=test.png",
        {
          method: "POST",
          headers: { "content-type": "image/png" },
          body: bytes,
        },
      ),
      context(),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      uploadId: expect.any(String),
      kind: "image",
      expiresAt: expect.any(String),
    });
  });

  it("真实 OAuth 令牌可在上传接口使用，并与 MCP 共享用户和客户端身份", async () => {
    const oauth = getOAuthHelpers(env);
    const redirectUri = "https://client.example/callback";
    const client = await oauth.createClient({
      clientName: "upload-test",
      redirectUris: [redirectUri],
      tokenEndpointAuthMethod: "none",
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
    });
    const verifier = "a".repeat(64);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const scope = ["media:write", "media:read"];
    const authorization = await oauth.completeAuthorization({
      request: {
        responseType: "code",
        clientId: client.clientId,
        redirectUri,
        scope,
        state: "test-state",
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        resource: "https://example.com/",
      },
      userId: "oauth-upload-admin",
      metadata: {},
      scope,
      props: {
        subject: "oauth-upload-admin",
        clientId: client.clientId,
        scopes: scope,
      },
    });
    const code = new URL(authorization.redirectTo).searchParams.get("code")!;
    const tokenResponse = await SELF.fetch("https://example.com/oauth/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: client.clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
        resource: "https://example.com/",
      }),
    });
    expect(tokenResponse.status).toBe(200);
    const token = await tokenResponse.json<{ access_token: string }>();
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const response = await SELF.fetch(
      "https://example.com/api/mcp/uploads?kind=image&fileName=oauth.png",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token.access_token}`,
          "content-type": "image/png",
        },
        body: bytes,
      },
    );
    expect(response.status).toBe(201);
    const receipt = await response.json<{ uploadId: string }>();
    const { mediaUploadTool } = await import(
      "../features/media/tools/media-upload.tool"
    );
    const ctx = context();
    ctx.principal = {
      subject: "oauth-upload-admin",
      clientId: client.clientId,
      scopes: ["media:write"],
    };
    expect(
      (
        await mediaUploadTool.handler(
          { uploadId: receipt.uploadId, requestId: "oauth-shared-identity" },
          ctx,
        )
      ).isError,
    ).not.toBe(true);
  });

  it("不信任 Content-Length，对实际读取的请求体限制大小", async () => {
    const response = await handleMcpUploadRequest(
      new Request(
        "https://example.com/api/mcp/uploads?kind=image&fileName=large.png",
        {
          method: "POST",
          headers: { "content-type": "image/png", "content-length": "1" },
          body: new Uint8Array(10 * 1024 * 1024 + 1),
        },
      ),
      context(),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "FILE_TOO_LARGE" },
    });
  });

  it("拒绝跨域、路径文件名以及无写权限请求", async () => {
    const crossOrigin = await handleMcpUploadRequest(
      new Request("https://example.com/api/mcp/uploads", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
      context(),
    );
    expect(crossOrigin.status).toBe(403);
    const badName = await handleMcpUploadRequest(
      new Request(
        "https://example.com/api/mcp/uploads?kind=image&fileName=../secret.png",
        {
          method: "POST",
          headers: { "content-type": "image/png" },
          body: "fake",
        },
      ),
      context(),
    );
    expect(badName.status).toBe(400);
    const readOnly = context();
    readOnly.principal.scopes = ["media:read"];
    const forbidden = await handleMcpUploadRequest(
      new Request(
        "https://example.com/api/mcp/uploads?kind=image&fileName=test.png",
        { method: "POST", body: "fake" },
      ),
      readOnly,
    );
    expect(forbidden.status).toBe(403);
  });
});
