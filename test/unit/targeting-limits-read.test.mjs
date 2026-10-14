/**
 * @file Every key content authors under `targeting.limits` has a reader.
 * @see module/rules/targeting/resolve.mjs, docs/surprises/2026-10-14-master-protection-limit-unread.md
 *
 * `targeting` is a raw object on the DataModel, so the field ledger cannot see
 * into it. Gate of Skye authored `limits.ignoresMasterProtection` where the
 * resolver reads `bypassMasterProtection`, and nothing failed (#204 reading
 * 18). This scan names a limit no module code reads.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/** Every file under `dir` ending in `ext`, with `/` separators on any checkout. */
function files(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, ext);
    return path.endsWith(ext) ? [path.replace(/\\/g, "/")] : [];
  });
}

/** Every `targeting.limits` key in `node`, wherever a targeting block sits. */
function limitKeys(node, out = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((n) => limitKeys(n, out));
    return out;
  }
  if (!node || typeof node !== "object") return out;
  for (const k of Object.keys(node.targeting?.limits ?? {})) out.add(k);
  for (const value of Object.values(node)) limitKeys(value, out);
  return out;
}

describe("targeting limits", () => {
  it("are each read somewhere in the module", () => {
    const source = files("module", ".mjs").map((f) => readFileSync(f, "utf8")).join("\n");
    const authored = new Map();
    for (const f of files("packs/_source", ".yml")) {
      for (const k of limitKeys(parse(readFileSync(f, "utf8")))) authored.set(k, f);
    }
    const unread = [...authored].filter(([k]) => !new RegExp(`\\.${k}\\b`).test(source)).map(([k, f]) => `${f}: ${k}`);
    expect(unread).toEqual([]);
    // The scan sees the corpus at all: a limit every Noble Phantasm carries.
    expect(authored.has("requiresZon")).toBe(true);
  }, 30_000);
});
