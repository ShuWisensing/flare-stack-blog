import { describe, expect, it } from "vitest";
import { normalizeCommandOutput } from "./main";

describe("safe d1 migrate command output", () => {
  it("normalizes empty spawn output without throwing", () => {
    expect(normalizeCommandOutput(null)).toBe("");
    expect(normalizeCommandOutput(undefined)).toBe("");
    expect(normalizeCommandOutput("  ok\n")).toBe("ok");
  });
});
