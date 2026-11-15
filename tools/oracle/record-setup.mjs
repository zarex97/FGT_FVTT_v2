/**
 * @file A vitest setup file for `tools/export-oracle.mjs` only: wraps `computeDamage`, the golden damage file's
 * subject, so each call is recorded with its arguments and its return value. The other targets get a setup file the
 * exporter writes from `tools/oracle/targets.mjs`.
 */

import { vi } from "vitest";
import { recording } from "./record-lib.mjs";

vi.mock("../../module/rules/damage/pipeline.mjs", async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, computeDamage: recording("rules.damage.compute_damage", mod.computeDamage) };
});
