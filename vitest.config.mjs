import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.mjs"],
    // L1 and L2 are pure ESM with no Foundry globals, so the default Node
    // environment is correct and no setup file is needed. Integration tests
    // that require a live world live outside vitest entirely (Ch. 38 §38.5).
    environment: "node",
    coverage: { include: ["module/domain/**", "module/rules/**"], reporter: ["text", "html"] },
  },
});
