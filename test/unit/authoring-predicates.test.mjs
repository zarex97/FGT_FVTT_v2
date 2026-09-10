/**
 * @file Every place a predicate can hide.
 * @see module/rules/authoring/predicates.mjs
 *
 * The existing guard in `options.test.mjs` reads rule elements only -- 147 of
 * the 236 option references in the corpus. The other 89 sit on requirements
 * and phases, and nothing has ever checked them.
 */

import { describe, it, expect } from "vitest";
import {
  predicateSitesIn, PREDICATE_FIELDS, NOT_PREDICATES,
} from "../../module/rules/authoring/predicates.mjs";

describe("predicateSitesIn", () => {
  it("finds a rule element's own predicate", () => {
    const doc = { passiveRules: [{ key: "Aura", predicate: ["self:free"] }] };
    expect(predicateSitesIn(doc)).toEqual([
      { where: "passiveRules[0].predicate", options: ["self:free"] },
    ]);
  });

  it("finds the attack and target predicates beside it", () => {
    const doc = {
      rules: [{ key: "X", attackPredicate: ["attack:crit"], targetPredicate: ["target:free"] }],
    };
    expect(predicateSitesIn(doc).map((s) => s.where))
      .toEqual(["rules[0].attackPredicate", "rules[0].targetPredicate"]);
  });

  it("finds a requirement's predicate — 89 references nothing checked", () => {
    const doc = { requirements: [{ kind: "predicate", predicate: ["self:stance:dismounted"] }] };
    expect(predicateSitesIn(doc)[0]).toMatchObject({ options: ["self:stance:dismounted"] });
  });

  it("finds a phase's predicate, and a phase rule's", () => {
    const doc = {
      phases: [{
        kind: "damage",
        predicate: ["attack:isAoE"],
        rules: [{ effect: { id: "burn" }, predicate: ["target:free"] }],
      }],
    };
    expect(predicateSitesIn(doc).map((s) => s.options))
      .toEqual([["attack:isAoE"], ["target:free"]]);
  });

  it("finds targeting.selection.attributes, which IS a predicate", () => {
    // `rules/targeting/resolve.mjs:252` hands it to `testPredicate`. Achilles's
    // Diatrekhōn Astēr Lonkhē uses it for "cannot be used on Female Units".
    const doc = {
      targeting: { selection: { attributes: [{ not: { or: ["target:attribute:female"] } }] } },
    };
    expect(predicateSitesIn(doc)[0].options).toEqual(["target:attribute:female"]);
  });

  it("does NOT mistake a unit's own attribute list for a predicate", () => {
    // A Servant declares `attributes: [servant, male]`. Collected by PATH, not
    // by name, so the two cannot be confused.
    expect(predicateSitesIn({ attributes: ["servant", "male"] })).toEqual([]);
  });

  it("strips the not: prefix, because the guard asks about the option", () => {
    const doc = { rules: [{ key: "X", predicate: ["not:self:free"] }] };
    expect(predicateSitesIn(doc)[0].options).toEqual(["self:free"]);
  });

  it("descends into or, anyOf and nor", () => {
    const doc = {
      rules: [{ key: "X", predicate: [{ or: ["self:free", { anyOf: ["target:free"] }] }] }],
    };
    expect(predicateSitesIn(doc)[0].options.sort()).toEqual(["self:free", "target:free"]);
  });

  it("finds requiresRecipient on an Aura", () => {
    const doc = { passiveRules: [{ key: "Aura", requiresRecipient: ["target:free"] }] };
    expect(predicateSitesIn(doc)[0].options).toEqual(["target:free"]);
  });

  it("returns nothing for a document with no predicates", () => {
    expect(predicateSitesIn({ id: "x", name: "X" })).toEqual([]);
  });

  it("survives a malformed document rather than throwing", () => {
    expect(predicateSitesIn(null)).toEqual([]);
    expect(predicateSitesIn({ rules: "not a list" })).toEqual([]);
  });
});

describe("the fields that are NOT predicates", () => {
  it("skips chanceWhen, and says why", () => {
    // `engine/attack.mjs:4508` matches it with a bespoke string compare that
    // strips `attack:kind:`. `auto-evade.yml` correctly authors the bare "np".
    const doc = {
      rules: [{ key: "AutoSucceed", chanceWhen: [{ predicate: ["np"], chance: 50 }] }],
    };
    expect(predicateSitesIn(doc)).toEqual([]);
    expect(NOT_PREDICATES.chanceWhen).toBeTruthy();
  });

  it("skips blockedWhen, and says why", () => {
    // `{state, condition}`, matched by `conditionHolds` -- a switch with one
    // case. No options, no operators.
    const doc = { blockedWhen: [{ state: "damage", condition: "damageWouldDefeatServant" }] };
    expect(predicateSitesIn(doc)).toEqual([]);
    expect(NOT_PREDICATES.blockedWhen).toBeTruthy();
  });

  it("gives a reason for every exclusion, so none is a silent omission", () => {
    for (const [field, why] of Object.entries(NOT_PREDICATES)) {
      expect(why.length, field).toBeGreaterThan(20);
    }
  });
});

describe("no predicate site escapes the collector", () => {
  it("accounts for every field named like a predicate in the corpus", async () => {
    // The guard on the guard. A new predicate site added to the schema fails
    // here until it is either collected or explicitly excluded with a reason.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { parse } = await import("yaml");

    const seen = new Set();
    const scan = (node) => {
      if (Array.isArray(node)) return void node.forEach(scan);
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node)) {
        if (/predicate/i.test(k)) seen.add(k);
        scan(v);
      }
    };
    for (const dir of readdirSync("packs/_source")) {
      const p = join("packs/_source", dir);
      if (!statSync(p).isDirectory()) continue;
      for (const f of readdirSync(p).filter((n) => n.endsWith(".yml"))) {
        try {
          scan(parse(readFileSync(join(p, f), "utf8")));
        } catch { /* malformed YAML is the content validator's business */ }
      }
    }

    const known = new Set([...PREDICATE_FIELDS, ...Object.keys(NOT_PREDICATES)]);
    expect([...seen].filter((k) => !known.has(k))).toEqual([]);
  });
});
