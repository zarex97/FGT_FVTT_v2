/**
 * @file A vitest setup file for `tools/export-oracle.mjs` only: wraps the functions an oracle case is cut at, so
 * each call a test makes is recorded with its arguments (encoded before the call, which may mutate them) and its
 * return value. The test's own assertions run unchanged: the case's expectation is what the function returned.
 *
 * Records go to `$ORACLE_OUT/<test file>.json` when the file's tests end.
 */

import { vi, afterAll, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { encode } from "./codec.mjs";

const records = [];
let unnamed = 0;

/**
 * @param {string} fn the case's function name, as the Godot table keys it
 * @param {Function} impl the real function
 */
function recording(fn, impl) {
  return (...args) => {
    const input = encode(args, "args");
    const result = impl(...args);
    const test = expect.getState().currentTestName ?? `describe-time ${++unnamed}`;
    records.push({ fn, test, input: { args: input }, expect: { result: encode(result, "result") } });
    return result;
  };
}

vi.mock("../../module/rules/damage/pipeline.mjs", async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, computeDamage: recording("rules.damage.compute_damage", mod.computeDamage) };
});

afterAll(() => {
  const out = process.env.ORACLE_OUT;
  if (!out) throw new Error("record-setup: ORACLE_OUT is not set");
  const file = basename(expect.getState().testPath ?? "unknown");
  writeFileSync(join(out, `${file}.json`), JSON.stringify(records), "utf8");
});
