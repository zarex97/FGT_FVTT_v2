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
// Calls past this many per function are not encoded at all: a hot reader (relationOf) is called many thousand times
// a file, and holding every one ran the worker out of memory. The exporter applies the target's own cap after.
const CAP = Number(process.env.ORACLE_CAP ?? 400);
const kept = new Map();

/**
 * @param {string} fn the case's function name, as the Godot table keys it
 * @param {Function} impl the real function
 * @returns {Function}
 */
export function recording(fn, impl) {
  return (...args) => {
    const seen = kept.get(fn) ?? new Set();
    kept.set(fn, seen);
    if (seen.size >= CAP) return impl(...args);
    let input = null;
    try {
      input = encode(args, "args");
    } catch {
      unreplayable++;
    }
    const key = input === null ? null : JSON.stringify(input);
    if (key !== null && seen.has(key)) input = null;
    const result = impl(...args);
    if (input !== null) {
      seen.add(key);
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
