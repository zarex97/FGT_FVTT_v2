/**
 * @file What every oracle recording setup shares (`tools/export-oracle.mjs`): the wrapper that records a call, and
 * the hook that writes a test file's records when its tests end. A call whose arguments or result hold a function
 * cannot be replayed: it is counted, never recorded half.
 */

import { afterAll, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { encode } from "./codec.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";

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
export function recording(fn, impl, { registry = false } = {}) {
  return (...args) => {
    const seen = kept.get(fn) ?? new Set();
    kept.set(fn, seen);
    if (seen.size >= CAP) return impl(...args);
    // A function handed in (a scheduler's `effectDef`) is recorded as the table of what it answered during this call:
    // its slot is written now, before the call can change the arguments, and filled as the call asks it.
    const tables = new Map();
    let broken = false;
    const fnSlot = (f) => {
      if (!tables.has(f)) tables.set(f, { $fn: [] });
      return tables.get(f);
    };
    let input = null;
    try {
      input = encode(args, "args", fnSlot);
    } catch {
      unreplayable++;
    }
    const key = input === null ? null : JSON.stringify(input);
    if (key !== null && seen.has(key)) input = null;
    const callArgs = tables.size === 0 ? args : swapFns(args, (f) => (...fargs) => {
      const r = f(...fargs);
      try {
        tables.get(f)?.$fn.push([encode(fargs, "fnArgs"), encode(r, "fnResult")]);
      } catch {
        broken = true;
      }
      return r;
    });
    // The effect definitions the call asked the registry for, when the target says it reads one (`registry: true`): a
    // test may load definitions of its own, which the Godot content does not hold, so the case carries what it read.
    const looked = new Map();
    const get = EffectRegistry.get;
    if (registry) {
      EffectRegistry.get = (id) => {
        const def = get.call(EffectRegistry, id);
        if (!looked.has(id)) looked.set(id, def ?? null);
        return def;
      };
    }
    let result;
    try {
      result = impl(...callArgs);
    } finally {
      if (registry) EffectRegistry.get = get;
    }
    if (registry && input !== null) {
      try {
        input = { args: input, registry: encode([...looked], "registry") };
      } catch {
        broken = true;
      }
    } else if (input !== null) {
      input = { args: input };
    }
    if (broken && input !== null) {
      unreplayable++;
      input = null;
    }
    if (input !== null) {
      seen.add(key);
      try {
        const test = expect.getState().currentTestName ?? `describe-time ${++unnamed}`;
        records.push({ fn, test, input, expect: { result: encode(result, "result") } });
      } catch {
        unreplayable++;
      }
    }
    return result;
  };
}

/**
 * The value with each function in it swapped for `wrap(fn)`, every container on the way copied and the rest shared.
 *
 * @param {unknown} value
 * @param {(fn: Function) => Function} wrap
 * @returns {unknown}
 */
function swapFns(value, wrap) {
  if (typeof value === "function") return wrap(value);
  if (Array.isArray(value)) {
    const out = value.map((v) => swapFns(v, wrap));
    return out.some((v, i) => v !== value[i]) ? out : value;
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    let changed = false;
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = swapFns(value[k], wrap);
      if (out[k] !== value[k]) changed = true;
    }
    return changed ? out : value;
  }
  return value;
}

afterAll(() => {
  const out = process.env.ORACLE_OUT;
  if (!out) throw new Error("record-lib: ORACLE_OUT is not set");
  const file = basename(expect.getState().testPath ?? "unknown");
  writeFileSync(join(out, `${file}.json`), JSON.stringify({ records, unreplayable }), "utf8");
});
