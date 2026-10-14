import { defineConfig } from "vitest/config";
import { foundryClientPlugin } from "./tools/lib/foundry-client-plugin.mjs";

export default defineConfig({
  // Two pieces of Foundry's CLIENT layer import in Node -- its dice and its
  // `Hooks` -- once `@common/` resolves and the dice grammar is compiled. The
  // plugin does both; the test world loads them (`test/helpers/foundry-client.mjs`).
  plugins: [foundryClientPlugin()],
  test: {
    include: ["test/**/*.test.mjs"],
    // L1 and L2 are pure ESM with no Foundry globals, so the default Node
    // environment is correct and no setup file is needed. A test that needs
    // Foundry's real data layer loads it itself through tools/lib/foundry.mjs
    // (ADR-0006). Integration tests that require a live world live outside
    // vitest entirely (Ch. 44).
    environment: "node",
    coverage: { include: ["module/domain/**", "module/rules/**"], reporter: ["text", "html"] },
  },
});
