import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

type EsbuildOptionsWithExternal = {
  external?: Array<string>;
};

describe("Vite config", () => {
  it("keeps Cloudflare Worker built-in modules external during optimization and build", () => {
    const config =
      typeof viteConfig === "function"
        ? viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false })
        : viteConfig;

    const esbuildOptions = config.optimizeDeps
      ?.esbuildOptions as EsbuildOptionsWithExternal | undefined;

    expect(esbuildOptions?.external).toEqual(
      expect.arrayContaining(["cloudflare:workers", "cloudflare:sockets"]),
    );
    expect(config.build?.rollupOptions?.external).toEqual(
      expect.arrayContaining(["cloudflare:workers", "cloudflare:sockets"]),
    );
  });
});
