import { describe, expect, it } from "vitest";
import { isPathValid } from "../src/lib/hono/path-manifest.generated";

describe("path manifest", () => {
  it("allows Personal AI Hub admin routes", () => {
    expect(isPathValid("/admin/personal-ai-hub")).toBe(true);
    expect(isPathValid("/admin/personal-ai-hub/agent-chat")).toBe(true);
  });
});
