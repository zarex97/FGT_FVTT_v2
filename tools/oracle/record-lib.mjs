/**
 * @file What every oracle recording setup shares (`tools/export-oracle.mjs`): the wrapper that records a call, and
 * the hook that writes a test file's records when its tests end. A call whose arguments or result hold a function
 * cannot be replayed: it is counted, never recorded half.
 */

import { afterAll, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { encode } from "./codec.mjs";

const records = [];
let unnamed = 0;
let unreplayable = 0;

/**
 * @param {string} fn the case's function name, as the Godot table keys it
 * @param {Function} impl the real function
 * @returns {Function}
 */
export function recording(fn, impl) {
  return (...args) => {
    let input = null;
    try {
      input = encode(args, "args");
    } catch {
      unreplayable++;
    }
    const result = impl(...args);
    if (input !== null) {
      try {
        const test = expect.getState().currentTestName ?? `describe-time ${++unnamed}`;
        records.push({ fn, test, input: { args: input }, expect: { result: encode(result, "result") } });
      } catch {
        unreplayable++;
      }
    }
    return result;
  };
}

afterAll(() => {
  const out = process.env.ORACLE_OUT;
  if (!out) throw new Error("record-lib: ORACLE_OUT is not set");
  const file = basename(expect.getState().testPath ?? "unknown");
  writeFileSync(join(out, `${file}.json`), JSON.stringify({ records, unreplayable }), "utf8");
});
