/**
 * @file One reader of a War's rules, and one way to find "the War".
 * @see module/engine/war.mjs, docs/superpowers/specs/2026-10-18-war-rules-clauses.md (WR.world)
 *
 * A world holds several Wars at once (2026-10-18). A War Rule read off a world
 * setting hits every War; "the match" read off `game.combat` is whatever the
 * combat tracker shows, and off `game.combats.active` it is the War of the one
 * activated scene. Both were how every reader found its War before. Grep, not a
 * graph: this proves an absence.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { WAR_RULE_KEYS } from "../../module/domain/war-rules.mjs";

/** Every `.mjs` under `module/`, with `/` separators. */
function sources(dir = "module") {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith(".mjs") ? [path.replace(/\\/g, "/")] : [];
  });
}

/** Code lines, comments stripped. */
function codeLines(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
  return text.split("\n").map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1"));
}

const hits = (pattern, allowed) => sources()
  .filter((f) => !allowed.has(f))
  .flatMap((f) => codeLines(f).flatMap((l, n) => (pattern.test(l) ? [`${f}:${n + 1}: ${l.trim()}`] : [])));

describe("a War Rule", () => {
  it("is read off a world setting only by `engine/war.mjs#worldDefault`", () => {
    const keys = WAR_RULE_KEYS.filter((k) => k !== "factions").join("|");
    const read = new RegExp(String.raw`settings\.get\(\s*"fgt",\s*"(?:${keys})"`);
    expect(hits(read, new Set(["module/engine/war.mjs"]))).toEqual([]);
  });

  it("is written to a world setting only by the defaults writer", () => {
    const keys = WAR_RULE_KEYS.join("|");
    const write = new RegExp(String.raw`settings\.set\(\s*"fgt",\s*"(?:${keys})"`);
    expect(hits(write, new Set(["module/engine/war.mjs"]))).toEqual([]);
  });

  it("finds the readers at all, so a broken pattern cannot pass vacuously", () => {
    expect(hits(/\bwarRule\("turnsPerRound"/, new Set()).length).toBeGreaterThan(30);
  });
});

describe("the War", () => {
  it("is never `game.combat` or `game.combats.active` outside the resolver", () => {
    // The migration runner walks EVERY combat, and its `globalTurn` context
    // feeds a schema-1 example handler that no War-specific migration reads.
    const allowed = new Set(["module/engine/war.mjs", "module/migration/runner.mjs"]);
    expect(hits(/\bgame\.combat\b(?!s)|\bgame\.combats\??\.active\b/, allowed)).toEqual([]);
  });
});
