/**
 * @file Every `inField:` a Clause names is a field that exists (#208, 2026-10-15).
 *
 * EMIYA's Circuits asked `self:inField:unlimitedBladeWorks`. A field's id is its
 * ability's CONTENT id (`engine/fields.mjs` stamps `fieldId` from
 * `system.contentId`), which is `emiya-unlimited-blade-works`; `unlimitedBladeWorks`
 * is the slug. The option could never be in any set, so the Circuits' first
 * clause had never fired, hit or miss, and `validate:content` calls an option of
 * the right SHAPE well formed. Nothing checked that the name was a field.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = "packs/_source";
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : (p.endsWith(".yml") ? [p] : []);
});

describe("`inField:` names a field", () => {
  it("every one is the content id of an ability that opens a field", () => {
    const fields = new Set();
    const named = [];
    for (const f of files(ROOT)) {
      const text = readFileSync(f, "utf8");
      const doc = parse(text);
      if (doc?.field && doc.id) fields.add(doc.id);
      for (const m of text.matchAll(/(?:self|target):inField:([A-Za-z][\w-]*)/g)) named.push([f, m[1]]);
    }
    expect(named.length).toBeGreaterThan(5);
    const unknown = named.filter(([, id]) => !fields.has(id)).map(([f, id]) => `${f}: ${id}`);
    expect(unknown).toEqual([]);
  });
});
