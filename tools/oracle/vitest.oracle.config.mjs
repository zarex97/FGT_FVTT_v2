/**
 * @file The vitest config `tools/export-oracle.mjs` runs: the project's own, plus the recording setup file.
 * Never used by `npm test`.
 */
import { defineConfig, mergeConfig } from "vitest/config";
import base from "../../vitest.config.mjs";

export default mergeConfig(base, defineConfig({
  test: { setupFiles: ["tools/oracle/record-setup.mjs"] },
}));
