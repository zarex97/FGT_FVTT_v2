/**
 * @file The vitest config `tools/export-oracle.mjs` runs: the project's own, plus a recording setup file, the one
 * named by `ORACLE_SETUP` or the damage recorder. Never used by `npm test`.
 */
import { defineConfig, mergeConfig } from "vitest/config";
import base from "../../vitest.config.mjs";

export default mergeConfig(base, defineConfig({
  test: { setupFiles: [process.env.ORACLE_SETUP ?? "tools/oracle/record-setup.mjs"] },
}));
