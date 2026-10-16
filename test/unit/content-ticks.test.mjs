/**
 * @file Every authored ◈ span parses (#195).
 *
 * The 'Raikou' buff authored `ticks: "-⅓◈"`. `parseTick` threw on it inside the
 * live Damage Step, the Combat Process never saved, and every retry of the
 * reaction applied the hit again. The unit test beside it asserted the string.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { parseTick } from "../../module/domain/tick.mjs";

const ROOT = "packs/_source";
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : (p.endsWith(".yml") ? [p] : []);
});

/**
 * The keys that hold a span. `ticks` was the only one checked, and `duration` is
 * the one an `ApplyEffect` hands `parseTick` inside the live Damage Step: EMIYA's
 * two Circuits authored `duration: "thisRound"`, which throws, and no test saw it
 * (#208, 2026-10-15). `defaultDuration` is the same grammar on an effect document.
 */
const SPAN_KEYS = new Set(["ticks", "duration", "defaultDuration"]);

/** Every span string under a document, with where it sits. */
function* spans(node, path = []) {
  if (Array.isArray(node)) { for (const [i, v] of node.entries()) yield* spans(v, [...path, i]); return; }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (SPAN_KEYS.has(k) && typeof v === "string" && !v.startsWith("@")) yield [path.concat(k).join("."), v];
    else yield* spans(v, [...path, k]);
  }
}

describe("authored ◈ spans", () => {
  it("all parse", () => {
    const bad = [];
    for (const f of files(ROOT)) {
      for (const [where, v] of spans(parse(readFileSync(f, "utf8")))) {
        try { parseTick(v); } catch (err) { bad.push(`${f} ${where}: ${JSON.stringify(v)} — ${err.message}`); }
      }
    }
    expect(bad).toEqual([]);
  });
});
