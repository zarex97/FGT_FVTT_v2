/**
 * @file The field ledger: every declared field is written and read, and nothing reads an undeclared one.
 * @see docs/44-testing.md, docs/agents/code-search.md, docs/46-roster-re-audit.md §46.4
 *
 * Eight Silent Drops were a reader and a writer disagreeing, which no survival
 * test can see because nothing was ever authored: `system.concealed` read by
 * four subsystems and never written or declared (dce679f), Home Base residency
 * read and never written (#19), `turnState.servantsActed` read and never
 * declared (ec60370), `kind` written where the reader compared `key` (92307da).
 * Ch. 46 §46.4 names the shapes: *collected but unread*, *two shapes of the same
 * value*, *name drift*.
 *
 * The field list comes from the REAL schemas (`tools/lib/foundry.mjs`), never
 * from source text. Readers and writers are found by **grep**, deliberately: a
 * graph cannot prove an absence, and templates and YAML are not in one
 * (`docs/agents/code-search.md`). It is a coarse net — a field named like a
 * common word is "read" by every `.value` in the codebase — so it only ever
 * errs toward passing, and what it catches is the field with no reader or no
 * writer ANYWHERE, which is exactly the defect.
 *
 * Paths built from template strings (`"system." + key`, `` `system.${k}` ``)
 * cannot be resolved by grep; the test prints how many there are, so the blind
 * spot stays visible.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { installSystem } from "../../tools/lib/foundry.mjs";

/* -------------------------------------------------------------------------- */
/*  What is allowed, and why                                                  */
/* -------------------------------------------------------------------------- */

/** Declared fields with no reader by name, and what reads them instead. */
const READ_ELSEWHERE = {
  contentVersion: "pack provenance; the content sync carries it generically through module/content/authored-fields.mjs",
  parameterized: "a template's slot list, read by the content validator in tools/lib/content.mjs",
};

/** Declared fields with no writer by name, and what writes them instead. */
const WRITTEN_ELSEWHERE = {
  biography: "typed on the sheet by the player",
  countsAsAct: "an authoring override (Ch. 17's \"unless stated\") that no content states yet",
};

/**
 * `sys.X` / `system.X` reads of names no schema declares that are not a
 * document's system at all, or are assigned onto the model during preparation.
 */
const NOT_A_SYSTEM_FIELD = {
  schema: "a content file's schema version",
  json: "system.json, the manifest",
  aria: "an ARIA attribute set, not a document",
  version: "game.system.version",
  fgt: "a socket message's system namespace",
};

/**
 * Found by this ledger in the code, owned by an issue. The list may only shrink;
 * an entry that stops being true fails as stale.
 */
const KNOWN = {
  // Declared and never read.
  unread: { nonStacking: "#104", requiresRank: "#104", isInterrupt: "#104", oneUse: "#104", turnOrderRoll: "#104",
    carriesOccupants: "#104", summonedAt: "#104", inheritedFrom: "#104", createdOnTurn: "#104" },
  // Declared and never written, by code or by content.
  unwritten: { nonStacking: "#104", requiresRank: "#104", isInterrupt: "#104", oneUse: "#104", turnOrderRoll: "#104",
    carriesOccupants: "#104" },
  // Read off a system that no schema declares it on.
  undeclared: { coveredByDebuffImmune: "#104", ignoresMagicResistance: "#104", zonDistance: "#104",
    outsideZon: "#104", zones: "#104", effects: "#104", suppressions: "#104" },
};

/* -------------------------------------------------------------------------- */
/*  The corpus of text                                                        */
/* -------------------------------------------------------------------------- */

const norm = (p) => p.split("\\").join("/");
function walk(dir, exts, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => p.endsWith(e))) out.push(norm(p));
  }
  return out;
}

/** Source without its comments, so prose that names a field is not a reader of it. */
const uncommented = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

describe("the field ledger", () => {
  const found = { unread: [], unwritten: [], undeclared: [] };
  let dynamicPaths = 0;

  beforeAll(async () => {
    const models = await installSystem();
    /** field name -> the Document/type pairs that declare it */
    const declared = new Map();
    for (const [doc, byType] of Object.entries(models)) {
      for (const [type, model] of Object.entries(byType)) {
        for (const key of Object.keys(model.schema.fields)) {
          if (!declared.has(key)) declared.set(key, []);
          declared.get(key).push(`${doc}/${type}`);
        }
      }
    }

    const code = walk("module", [".mjs"]).filter((p) => !p.startsWith("module/data/"))
      .map((p) => uncommented(readFileSync(p, "utf8"))).join("\n");
    const templates = walk("templates", [".hbs"]).map((p) => readFileSync(p, "utf8")).join("\n");
    const content = walk("packs/_source", [".yml"]).map((p) => readFileSync(p, "utf8")).join("\n");
    const compiler = readFileSync("tools/lib/content.mjs", "utf8");
    dynamicPaths = (code.match(/["'`]system\.["'`]\s*\+|`system\.\$\{/g) ?? []).length;

    for (const key of declared.keys()) {
      const read = new RegExp(String.raw`\??\.${key}\b(?!\s*=(?!=))`).test(code)
        || new RegExp(String.raw`\b${key}\b`).test(templates);
      const written = new RegExp(String.raw`["'\x60]system\.${key}\b|\.${key}\s*=(?!=)|\b${key}\s*:`).test(code)
        || new RegExp(String.raw`name="system\.${key}\b`).test(templates)
        || new RegExp(String.raw`(^|[\s{,])${key}:`, "m").test(content)
        || new RegExp(String.raw`\b${key}\b`).test(compiler);
      if (!read && !READ_ELSEWHERE[key]) found.unread.push(key);
      if (!written && !WRITTEN_ELSEWHERE[key]) found.unwritten.push(key);
    }

    const assigned = new Set([...code.matchAll(/\bsystem\.([A-Za-z_]\w*)\s*=(?!=)/g)].map((m) => m[1]));
    const names = new Set([...code.matchAll(/\b(?:system|sys)\??\.([A-Za-z_]\w*)/g)].map((m) => m[1]));
    for (const name of names) {
      if (declared.has(name) || assigned.has(name) || NOT_A_SYSTEM_FIELD[name]) continue;
      found.undeclared.push(name);
    }
  }, 60_000);

  for (const [kind, what] of [
    ["unread", "is declared and nothing reads it"],
    ["unwritten", "is declared and nothing writes or authors it"],
    ["undeclared", "is read off a system no schema declares it on"],
  ]) {
    it(`finds no field that ${what}, beyond the known ones`, () => {
      const unexpected = found[kind].filter((k) => !KNOWN[kind][k]);
      expect(unexpected.map((k) => `${k} ${what}`).join(String.fromCharCode(10))).toBe("");
    });

    it(`has no stale ${kind} entry: each known one is still true`, () => {
      expect(Object.keys(KNOWN[kind]).filter((k) => !found[kind].includes(k))).toEqual([]);
    });
  }

  it("owns every known entry with an issue, and never gains one", () => {
    const all = Object.values(KNOWN).flatMap((m) => Object.values(m));
    for (const issue of all) expect(issue).toMatch(/^#\d+$/);
    expect(all.length).toBeLessThanOrEqual(22);
  });

  it("says how many system paths it cannot resolve", () => {
    // Built by string concatenation or a template literal: a blind spot of any
    // grep, printed so it stays in view rather than silently passing.
    console.info(`  field ledger: ${dynamicPaths} dynamically built system path(s) not resolved`);
    expect(dynamicPaths).toBeGreaterThanOrEqual(0);
  });
});
