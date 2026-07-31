import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
const deployStep = workflow.slice(
  workflow.indexOf("      - name: Deploy to Cloudflare Workers"),
  workflow.indexOf("      - name: Purge Cloudflare CDN Cache"),
);
const deployLines = deployStep.split(/\r?\n/).map((line) => line.trim());

describe("Cloudflare deploy workflow", () => {
  it("targets the top-level Wrangler environment when uploading secrets", () => {
    expect(
      deployLines.filter((line) => line.includes("wrangler secret bulk")),
    ).toEqual([
      'if bunx wrangler secret bulk secrets.json --env=""; then',
    ]);
  });

  it("retries secret uploads three times, waits, and still fails explicitly", () => {
    expect(deployStep).toMatch(/for attempt in 1 2 3; do/);
    expect(deployStep).toMatch(
      /if bunx wrangler secret bulk secrets\.json --env=""; then\s+break/,
    );
    expect(deployStep).toContain("sleep $((attempt * 10))");
    expect(deployStep).toMatch(
      /if \[ "\$attempt" -eq 3 \]; then\s+exit 1/,
    );
  });

  it("builds only after the retry loop without changing environment or falling back", () => {
    const loopEndIndex = deployLines.indexOf("done");
    const buildIndexes = deployLines.flatMap((line, index) =>
      line === "bun run build" ? [index] : [],
    );
    const deployIndexes = deployLines.flatMap((line, index) =>
      line === "bun run deploy" ? [index] : [],
    );

    expect(buildIndexes).toHaveLength(1);
    expect(deployIndexes).toHaveLength(1);
    expect(buildIndexes[0]).toBeGreaterThan(loopEndIndex);
    expect(deployIndexes[0]).toBeGreaterThan(buildIndexes[0]);
    expect(deployStep).not.toMatch(/continue-on-error|\|\|\s*true/);
  });
});
