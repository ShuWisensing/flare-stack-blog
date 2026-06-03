import { describe, expect, it } from "vitest";
import { createLoginSearchParams } from "./-login-url";

describe("login route search params", () => {
  it("can parse route href without browser window origin", () => {
    const params = createLoginSearchParams(
      "/login?client_id=hub&response_type=code",
    );

    expect(params.get("client_id")).toBe("hub");
    expect(params.get("response_type")).toBe("code");
  });
});
