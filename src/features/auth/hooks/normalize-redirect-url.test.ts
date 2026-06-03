import { describe, expect, it } from "vitest";
import { normalizeRedirectUrl } from "./normalize-redirect-url";

describe("normalizeRedirectUrl", () => {
  it("normalizes redirects without requiring browser window", () => {
    expect(normalizeRedirectUrl(undefined, "/dashboard")).toBe(
      "http://localhost/dashboard",
    );
    expect(normalizeRedirectUrl("/admin", "/dashboard")).toBe(
      "http://localhost/admin",
    );
  });
});
