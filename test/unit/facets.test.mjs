/**
 * @file The predicate facet vocabulary.
 * @see module/rules/facets.mjs, docs/24-rules-engine.md §24.4
 *
 * `EMITTABLE` is GENERATED from this table rather than declared beside it.
 * Unlike `EXECUTORS` -- functions, which no table can generate -- it is pure
 * data describing a string shape, which is exactly what a descriptor with
 * typed segments is. The equivalence test below is what makes that swap safe.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  FACETS, GENERATED_EMITTABLE, patternFor, parseOption, REF_SCOPES,
} from "../../module/rules/facets.mjs";
import { corpusOptions } from "./helpers/corpus.mjs";

/** The 37 regexes this table replaces, captured before it was written. */
const before = JSON.parse(readFileSync("test/fixtures/emittable-before.json", "utf8"))
  .map((src) => new RegExp(src.slice(1, -1)));

const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));

/** Options that must be accepted, and near-misses that must not. */
const ACCEPT = [
  "self:stance:dismounted", "target:attribute:large", "self:free", "attack:crit",
  "self:phase:day", "target:masterTier:high", "self:rank:str:gte:B",
  "target:paramVsSelf:agi:gt", "self:skillRank:divinity:gte:A",
  "attack:range:gte:3", "attack:component:mag", "self:stableDie:d6:4",
  "self:withinOfOwnerMaster:2", "self:inHomeBase", "attack:isAoE",
];
const REJECT = [
  "self:stanse:dismounted",       // typo'd facet
  "self:phase:tuesday",           // closed value, not a member
  "target:masterTier:middling",   // closed value
  "self:rank:str:gte:Z",          // not a grade
  "attack:range:gte:x",           // not a number
  "self:withinOfOwnerMaster:9",   // out of range
  "not:self:stance:dismounted",   // the prefix is stripped BEFORE this is asked
  "",
];

describe("equivalence with the regexes it replaces", () => {
  const oldAccepts = (o) => before.some((r) => r.test(o));
  const newAccepts = (o) => GENERATED_EMITTABLE.some((r) => r.test(o));

  it("captured the fixture it is measured against", () => {
    expect(before.length).toBe(37);
  });

  it("agrees on everything it should accept", () => {
    for (const o of ACCEPT) {
      expect(oldAccepts(o), `fixture rejects ${o}; fix the fixture, not the table`).toBe(true);
      expect(newAccepts(o), o).toBe(true);
    }
  });

  it("agrees on everything it should reject", () => {
    for (const o of REJECT) {
      expect(newAccepts(o), `${o} must not be emittable`).toBe(false);
    }
  });

  it("accepts every option the shipped corpus names", () => {
    // The real equivalence proof. 92 distinct options across 239 references.
    for (const o of corpusOptions()) {
      expect(newAccepts(o), `the corpus names ${o} and the table refuses it`).toBe(true);
    }
  });

  it("rejects nothing the old list accepted, across the corpus", () => {
    // ONE-DIRECTIONAL, as the title says. This guard exists to prove the swap
    // to a generated table lost nothing; it was never meant to freeze the
    // vocabulary, which `facets.mjs`'s own header describes as still being
    // written. A two-way equality would make every NEW facet fail here --
    // `terrain:` was the first to do so -- and the fixture is a snapshot of
    // what the regexes accepted in September 2026, not a specification.
    for (const o of corpusOptions()) {
      if (!oldAccepts(o)) continue;
      expect(newAccepts(o), `the old list accepted ${o} and the table refuses it`).toBe(true);
    }
  });

  it("accepts corpus options the old list could not, only through a declared facet", () => {
    // The other half of the guard the equality used to provide: an option the
    // old regexes refused is either a facet added since (fine) or a typo that
    // slipped past (not). `parseOption` answering with a known facet id is
    // what separates the two.
    const added = corpusOptions().filter((o) => !oldAccepts(o));
    for (const o of added) {
      const facet = parseOption(o)?.facet;
      expect(FACETS.some((f) => f.id === facet), `${o} matches no declared facet`).toBe(true);
    }
  });
});

describe("the table is well formed", () => {
  it("gives every facet an id, subjects, a label, a hint and prose", () => {
    for (const f of FACETS) {
      expect(f.id, JSON.stringify(f)).toBeTruthy();
      expect(f.subjects.length, f.id).toBeGreaterThan(0);
      expect(f.label, f.id).toBeTruthy();
      expect(f.hint, f.id).toBeTruthy();
      expect(f.english.length, f.id).toBeGreaterThan(15);
      expect(f.prose, f.id).toBeTruthy();
    }
  });

  it("resolves every label and hint in lang/en.json", () => {
    for (const f of FACETS) {
      expect(lang[f.label], `${f.label} missing`).toBeTruthy();
      expect(lang[f.hint], `${f.hint} disagrees with the table`).toBe(f.english);
    }
  });

  it("declares a value kind for every segment", () => {
    for (const f of FACETS) {
      for (const seg of f.segments ?? []) {
        expect(["closed", "registry", "open", "literal", "number"], `${f.id}.${seg.name}`)
          .toContain(seg.value.kind);
      }
    }
  });

  it("names a real enum for every closed segment that cites one", async () => {
    const enums = await import("../../module/domain/enums.mjs");
    for (const f of FACETS) {
      for (const seg of (f.segments ?? []).filter((s) => s.value.kind === "closed")) {
        if (!seg.value.from) {
          expect(seg.value.list?.length, `${f.id}.${seg.name} has neither from nor list`)
            .toBeGreaterThan(0);
          continue;
        }
        expect(enums[seg.value.from], `${f.id}.${seg.name} names ${seg.value.from}`).toBeDefined();
      }
    }
  });

  it("interpolates only segments it declares, in its prose", () => {
    for (const f of FACETS) {
      const names = new Set([...(f.segments ?? []).map((s) => s.name), "subject"]);
      for (const [, token] of f.prose.matchAll(/\{(\w+)\}/g)) {
        expect(names, `${f.id}.prose names {${token}}, which is not a segment`).toContain(token);
      }
    }
  });

  it("gives no facet two segments with the same name", () => {
    for (const f of FACETS) {
      const names = (f.segments ?? []).map((s) => s.name);
      expect(new Set(names).size, `${f.id} repeats a segment name`).toBe(names.length);
    }
  });
});

describe("the five facets that had an enum and were not using it", () => {
  // spec §1.2: these validated as free text and could never be typo-caught.
  // `self:highestParameter:strength` passed and can never match, because the
  // parameter is `str`.
  const valueOf = (id, seg) =>
    FACETS.find((f) => f.id === id)?.segments.find((s) => s.name === seg)?.value;

  it("closes them", () => {
    expect(valueOf("highestParameter", "parameter")).toMatchObject({ kind: "closed", from: "PARAMETERS" });
    expect(valueOf("rank", "parameter")).toMatchObject({ kind: "closed", from: "PARAMETERS" });
    expect(valueOf("paramVsSelf", "parameter")).toMatchObject({ kind: "closed", from: "PARAMETERS" });
    expect(valueOf("element", "element")).toMatchObject({ kind: "closed", from: "ELEMENTS" });
    expect(valueOf("npScale", "scale")).toMatchObject({ kind: "closed", from: "NP_TAG_SCALE" });
  });

  it("now rejects what they used to wave through", () => {
    const accepts = (o) => GENERATED_EMITTABLE.some((r) => r.test(o));
    expect(accepts("self:highestParameter:strength")).toBe(false);
    expect(accepts("self:highestParameter:str")).toBe(true);
    expect(accepts("attack:element:frost")).toBe(false);
  });
});

describe("attribute stays open", () => {
  it("is not a registry, because content names what is not built yet", () => {
    // spec §10.1: `outsider` and `undead` are referenced by six clauses in four
    // files and granted by no authored unit. They are forward references to
    // the 29 Servants still to come, and a registry that errored would fail
    // the build on legitimate content.
    expect(FACETS.find((f) => f.id === "attribute").segments[0].value.kind).toBe("open");
  });

  it("still accepts the two the corpus names and nothing grants", () => {
    const accepts = (o) => GENERATED_EMITTABLE.some((r) => r.test(o));
    expect(accepts("self:attribute:outsider")).toBe(true);
    expect(accepts("target:attribute:undead")).toBe(true);
  });
});

describe("parseOption", () => {
  it("splits an option into subject, facet and named segments", () => {
    expect(parseOption("self:skillRank:divinity:gte:B")).toEqual({
      subject: "self",
      facet: "skillRank",
      segments: { slug: "divinity", grade: "B" },
    });
  });

  it("reads a facet with no value at all", () => {
    expect(parseOption("attack:crit")).toEqual({ subject: "attack", facet: "crit", segments: {} });
  });

  it("returns null for anything no facet admits", () => {
    // A module's compendium may name anything; the caller falls back rather
    // than throwing.
    expect(parseOption("self:stanse:dismounted")).toBe(null);
    expect(parseOption("nonsense")).toBe(null);
    expect(parseOption("")).toBe(null);
  });

  it("round-trips every option the corpus names", () => {
    for (const o of corpusOptions()) {
      expect(parseOption(o), `${o} is emittable and unparseable`).not.toBe(null);
    }
  });
});

describe("patternFor", () => {
  it("makes one pattern per subject", () => {
    const stance = FACETS.find((f) => f.id === "stance");
    expect(patternFor(stance)).toHaveLength(stance.subjects.length);
  });
});

describe("REF_SCOPES", () => {
  it("says which roots each site may reference, and their shape", () => {
    // spec §5.2: `@self.health` is `{value,max}` under expressionRefs and a
    // NUMBER under a unit snapshot. A picker offering one flat list would
    // emit paths that cannot resolve where they sit.
    expect(REF_SCOPES.ownerOnly.roots).toEqual(["self"]);
    expect(REF_SCOPES.exchange.roots).toEqual(expect.arrayContaining(["self", "target"]));
    expect(REF_SCOPES.ownerOnly.shape).not.toBe(REF_SCOPES.exchange.shape);
  });

  it("does not offer target where expressionRefs supplies none", () => {
    expect(REF_SCOPES.ownerOnly.roots).not.toContain("target");
  });
});
