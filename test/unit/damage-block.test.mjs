/**
 * @file The base attack of a damage block, and the keys a damage block may carry.
 * @see module/rules/damage/instances.mjs, tools/lib/content.mjs, docs/22-damage-pipeline.md, #135
 *
 * Xiuhcoatl authored her Base Attack as two sources at the TOP of the damage
 * block -- BA(STR) x1 and BA(MAG) x0.5, her sheet's "BA = 250" -- and the
 * engine read `damage.base`, failing that one source built from `component`.
 * So `component: str` won, the MAG half was dropped, and she dealt 500 where
 * her sheet says 1000. Nothing failed: the key reached the Combat Process and
 * was read there only for an aftermath, and no validator knew the spelling.
 *
 * Three readers shared the blind spot (the resolution, the actor-sheet preview,
 * the NP ranking), so the card, the preview and the ranking all agreed on the
 * wrong number. There is now one reader, and a validator that names a key
 * nothing reads.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { damageBaseOf, DAMAGE_BLOCK_KEYS } from "../../module/rules/damage/instances.mjs";
import { validateAll } from "../../tools/lib/content.mjs";

const SOURCES = [
  { unit: "self", component: "str", factor: 1 },
  { unit: "self", component: "mag", factor: 0.5 },
];

describe("damageBaseOf — one answer to 'the base attack of this block'", () => {
  it("is `base` when the block states one", () => {
    expect(damageBaseOf({ base: { sources: SOURCES }, component: "mag" })).toEqual({ sources: SOURCES });
    expect(damageBaseOf({ base: { fixedValue: 50 } })).toEqual({ fixedValue: 50 });
  });

  it("is the block's own `sources` when there is no `base`", () => {
    expect(damageBaseOf({ sources: SOURCES, component: "str" })).toEqual({ sources: SOURCES });
  });

  it("is one source built from `component` when there is neither", () => {
    expect(damageBaseOf({ component: "mag" }))
      .toEqual({ sources: [{ unit: "self", component: "mag", factor: 1 }] });
  });

  it("is null when the block names none, so the caller falls back to the Normal Attack", () => {
    expect(damageBaseOf({ multiplier: 2 })).toBeNull();
    expect(damageBaseOf(null)).toBeNull();
    expect(damageBaseOf(undefined)).toBeNull();
  });
});

describe("the validator and the damage block", () => {
  const errors = (damage) => validateAll([{
    path: "x.yml", dir: "abilities", doc: { schema: 1, id: "x", name: "X", damage },
  }]).problems;

  it("refuses a block that declares both `base` and `sources`", () => {
    const out = errors({ base: { sources: SOURCES }, sources: SOURCES });
    expect(out.length).toBe(1);
    expect(out[0]).toMatch(/both "base" and "sources"/);
  });

  it("refuses the same pair on an aftermath, a branch and an instance", () => {
    const both = { base: { sources: SOURCES }, sources: SOURCES };
    const inAftermath = validateAll([{
      path: "x.yml", dir: "abilities",
      doc: {
        schema: 1, id: "x", name: "X",
        aftermath: { targeting: { anchor: { kind: "self" } }, damage: { ...both, component: "mag" } },
      },
    }]).problems;
    expect(inAftermath.some((p) => /aftermath\.damage declares both "base" and "sources"/.test(p))).toBe(true);
    expect(errors({ branches: [{ predicate: [], ...both }] })[0]).toMatch(/damage\.branches\[0\] declares both/);
    expect(errors({ instances: [{ ...both }] })[0]).toMatch(/damage\.instances\[0\] declares both/);
  });

  it("refuses a subkey nothing reads, and names what does", () => {
    const out = errors({ component: "str", multipler: 4 });
    expect(out.length).toBe(1);
    expect(out[0]).toMatch(/"multipler"/);
    expect(out[0]).toMatch(/multiplier/);
  });

  it("accepts both spellings of a base attack, one at a time", () => {
    expect(errors({ sources: SOURCES, multiplier: 4 })).toEqual([]);
    expect(errors({ base: { sources: SOURCES }, multiplier: 4 })).toEqual([]);
  });
});

describe("the ledger — every damage subkey authored anywhere is one the engine reads", () => {
  const known = new Set(DAMAGE_BLOCK_KEYS);

  /** Every `*.yml` under `packs/_source`, parsed. */
  const documents = () => readdirSync("packs/_source", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join("packs/_source", d.name))
      .filter((f) => f.endsWith(".yml"))
      .map((f) => ({ path: `${d.name}/${f}`, doc: parse(readFileSync(join("packs/_source", d.name, f), "utf8")) })));

  /** Every damage block a document authors: primary, branches, instances, aftermath. */
  const blocksOf = ({ doc }) => {
    const out = [];
    const take = (block) => {
      if (!block || typeof block !== "object") return;
      out.push(block);
      for (const b of block.branches ?? []) out.push(b);
      for (const i of block.instances ?? []) out.push(i);
    };
    take(doc?.damage);
    take(doc?.aftermath?.damage);
    return out;
  };

  it("authors nothing the list does not carry", () => {
    const unknown = [];
    for (const d of documents()) {
      for (const block of blocksOf(d)) {
        for (const key of Object.keys(block)) if (!known.has(key)) unknown.push(`${d.path}: ${key}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("carries nothing the engine never reads", () => {
    // A key on the list that no module names is a key the validator would wave
    // through while the engine ignores it -- the Silent Drop this list exists to
    // stop. `base` and `sources` are read by `damageBaseOf` itself.
    // The list's own file is read up to the list, so the names it carries do not
    // vouch for themselves.
    const engine = ["module/engine", "module/rules", "module/apps"]
      .flatMap((dir) => readdirSync(dir, { recursive: true })
        .filter((f) => String(f).endsWith(".mjs"))
        .map((f) => {
          const text = readFileSync(join(dir, String(f)), "utf8");
          const own = text.indexOf("Every key a damage block");
          return own === -1 ? text : text.slice(0, own);
        }))
      .join("\n");
    const unread = DAMAGE_BLOCK_KEYS.filter((key) => !new RegExp(`\\b${key}\\b`).test(engine));
    expect(unread).toEqual([]);
  });
});
