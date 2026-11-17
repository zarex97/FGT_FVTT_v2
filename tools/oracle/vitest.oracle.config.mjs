/**
 * @file The vitest config `tools/export-oracle.mjs` runs: the project's own, plus a recording setup file, the one
 * named by `ORACLE_SETUP` or the damage recorder. Never used by `npm test`.
 */
import { defineConfig, mergeConfig } from "vitest/config";
import base from "../../vitest.config.mjs";

export default mergeConfig(base, defineConfig({
  // A recording run copies every call it hears, so a test runs several times slower than under `npm test`: at the
  // default 5 s a loaded machine timed out a different handful of tests on each export (2026-11-16). The tests'
  // own timing is `npm test`'s to judge; here only their calls are wanted.
  test: { setupFiles: [process.env.ORACLE_SETUP ?? "tools/oracle/record-setup.mjs"], testTimeout: 60_000, hookTimeout: 120_000 },
}));
