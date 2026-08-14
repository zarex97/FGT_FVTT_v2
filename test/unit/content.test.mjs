/**
 * A validator that always passes is worthless. These tests exist to prove it
 * fails on the failure modes Ch. 37 §37.4 says it must catch.
 */
import { describe, it, expect } from "vitest";
import {
  validateAll, resolveRef, substitute, documentId, ruleElements, compileDocument,
} from "../../tools/lib/content.mjs";

const file = (doc, path = "test.yml", dir = "effects") => ({ path, dir, doc });
const ok = (over = {}) => ({ schema: 1, id: "thing", name: "Thing", ...over });

const errorsFor = (files) => validateAll(files).problems;
const warningsFor = (files) => validateAll(files).warnings;

describe("structural validation", () => {
  it("passes a well-formed document", () => {
    expect(errorsFor([file(ok())])).toEqual([]);
  });

  it("catches a wrong or missing schema version", () => {
    expect(errorsFor([file(ok({ schema: 2 }))])[0]).toMatch(/schema is 2, expected 1/);
    expect(errorsFor([file({ id: "x", name: "X" })])[0]).toMatch(/schema is undefined/);
  });

  it("catches missing required fields", () => {
    expect(errorsFor([file({ schema: 1, name: "X" })])[0]).toMatch(/missing required field "id"/);
    expect(errorsFor([file({ schema: 1, id: "x" })])[0]).toMatch(/missing required field "name"/);
  });

  it("catches duplicate ids across files, naming both", () => {
    const problems = errorsFor([file(ok(), "a.yml"), file(ok(), "b.yml")]);
    expect(problems[0]).toMatch(/duplicate id "thing" \(also in a\.yml\)/);
  });

  it("catches a file that is not a mapping", () => {
    expect(errorsFor([file("just a string")])[0]).toMatch(/does not contain a mapping/);
  });
});

describe("domain validation", () => {
  it("catches an unparseable rank", () => {
    expect(errorsFor([file(ok({ rank: "A+++" }))])).toEqual([]); // grammatical, if odd
    expect(errorsFor([file(ok({ rank: "S" }))])[0]).toMatch(/not a valid rank \("S"\)/);
    expect(errorsFor([file(ok({ parameters: { str: "F" } }))])[0]).toMatch(/parameters\.str is not a valid rank/);
  });

  it("catches a duration missing its ◈", () => {
    expect(errorsFor([file(ok({ cooldown: "1◈+2/3◈" }))])).toEqual([]);
    expect(errorsFor([file(ok({ cooldown: "3 rounds" }))])[0]).toMatch(/not a valid duration/);
  });

  it("catches an unknown rule element key — a typo that would silently do nothing", () => {
    expect(errorsFor([file(ok({ rules: [{ key: "DamageModifer", value: 10 }] }))])[0])
      .toMatch(/unknown rule element key "DamageModifer"/);
  });

  it("catches a rule element with no key at all", () => {
    expect(errorsFor([file(ok({ rules: [{ value: 10 }] }))])[0]).toMatch(/has no "key"/);
  });

  it("catches a Script element with no script id", () => {
    expect(errorsFor([file(ok({ rules: [{ key: "Script" }] }))])[0])
      .toMatch(/Script element with no "script" id/);
  });

  it("catches a reference to a table that does not exist", () => {
    expect(errorsFor([file(ok({ rules: [{ key: "FlatDamage", table: "divinty" }] }))])[0])
      .toMatch(/unknown table "divinty"/);
    expect(errorsFor([file(ok({ rules: [{ key: "FlatDamage", table: "divinity" }] }))])).toEqual([]);
  });

  it("catches unknown effect classification values", () => {
    expect(errorsFor([file(ok({ polarity: "bufff" }))])[0]).toMatch(/unknown polarity/);
    expect(errorsFor([file(ok({ polarity: "buff", stacking: "stacks" }))])[0]).toMatch(/unknown stacking/);
    expect(errorsFor([file(ok({ polarity: "buff", volatility: "volatle" }))])[0]).toMatch(/unknown volatility/);
  });

  it("catches a cross-reference to a renamed document", () => {
    expect(errorsFor([file(ok({ blocks: ["ghost"] }))])[0]).toMatch(/blocks references unknown id "ghost"/);
  });

  it("catches an effect id a rule element applies but that does not exist", () => {
    const problems = errorsFor([
      file(ok({ id: "skill", rules: [{ key: "OnEvent", event: "x", effect: { id: "defDownC" } }] })),
      file(ok({ id: "defDwnC", name: "Def Dwn (C)" }), "b.yml"),
    ]);
    expect(problems[0]).toMatch(/applies unknown effect "defDownC"/);
  });

  it("warns on a one-sided mutual exclusion", () => {
    const warnings = warningsFor([
      file(ok({ id: "charm", blockedBy: ["berserk"] }), "a.yml"),
      file(ok({ id: "berserk" }), "b.yml"),
    ]);
    expect(warnings[0]).toMatch(/not reciprocated/);
  });

  it("does not warn when both sides declare it", () => {
    const warnings = warningsFor([
      file(ok({ id: "charm", blockedBy: ["berserk"] }), "a.yml"),
      file(ok({ id: "berserk", blocks: ["charm"] }), "b.yml"),
    ]);
    expect(warnings).toEqual([]);
  });

  it("warns on a malformed roll option in a predicate", () => {
    const warnings = warningsFor([
      file(ok({ rules: [{ key: "FlatDamage", predicate: ["targetattributedivine"] }] })),
    ]);
    expect(warnings[0]).toMatch(/does not match the expected shape/);
  });

  it("accepts a well-formed roll option", () => {
    expect(warningsFor([file(ok({ rules: [{ key: "FlatDamage", predicate: ["target:attribute:divine"] }] }))]))
      .toEqual([]);
  });

  it("skips unresolved template placeholders rather than failing on them", () => {
    // A class-skill template legitimately carries "@rank" until instantiated.
    expect(errorsFor([file(ok({ rank: "@rank", cooldown: "@cooldown" }))])).toEqual([]);
  });
});

describe("ref resolution", () => {
  const library = new Map([
    ["class-magic-resistance", {
      id: "class-magic-resistance", name: "Magic Resistance", parameterized: ["rank"],
      rank: "@rank",
      passiveRules: [{ key: "Resistance", negatesUpToRank: "@rank" }],
    }],
  ]);

  it("substitutes supplied parameters throughout the template", () => {
    const problems = [];
    const r = resolveRef({ ref: "class-magic-resistance", rank: "C" }, library, problems, "abilities[0]");
    expect(problems).toEqual([]);
    expect(r.rank).toBe("C");
    expect(r.passiveRules[0].negatesUpToRank).toBe("C");
    expect(r._ref).toBe("class-magic-resistance");
  });

  it("catches a ref that does not resolve — the renamed-file failure mode", () => {
    const problems = [];
    resolveRef({ ref: "class-magic-resistence" }, library, problems, "abilities[0]");
    expect(problems[0]).toMatch(/does not resolve to any known document/);
  });

  it("catches an incomplete instantiation", () => {
    const problems = [];
    resolveRef({ ref: "class-magic-resistance" }, library, problems, "abilities[0]");
    expect(problems[0]).toMatch(/requires the parameter "rank"/);
  });

  it("passes an inline ability straight through", () => {
    const inline = { id: "x", name: "X" };
    expect(resolveRef(inline, library, [], "abilities[0]")).toBe(inline);
  });

  it("validates refs reached through a Servant's ability list", () => {
    const problems = errorsFor([
      file({ schema: 1, id: "karna", name: "Karna", abilities: [{ ref: "nope" }] }, "karna.yml", "servants"),
    ]);
    expect(problems[0]).toMatch(/abilities\[0\].*does not resolve/);
  });
});

describe("substitute", () => {
  it("replaces only whole-string placeholders", () => {
    expect(substitute("@rank", { rank: "A" })).toBe("A");
    // Embedded ones are left for the runtime expression evaluator.
    expect(substitute("@self.health.value", { rank: "A" })).toBe("@self.health.value");
  });

  it("leaves unknown placeholders alone rather than blanking them", () => {
    expect(substitute("@missing", { rank: "A" })).toBe("@missing");
  });

  it("recurses through arrays and objects", () => {
    expect(substitute({ a: ["@r", { b: "@r" }] }, { r: 5 })).toEqual({ a: [5, { b: 5 }] });
  });
});

describe("documentId", () => {
  it("is deterministic, so rebuilding does not churn ids", () => {
    expect(documentId("karna")).toBe(documentId("karna"));
  });

  it("is 16 alphanumeric characters, as Foundry requires", () => {
    for (const id of ["karna", "heracles", "atkUp", "class-magic-resistance"]) {
      expect(documentId(id), id).toMatch(/^[a-z0-9]{16}$/);
    }
  });

  it("distinguishes different content", () => {
    expect(documentId("karna")).not.toBe(documentId("heracles"));
  });
});

describe("ruleElements traversal", () => {
  it("finds elements in rules, passiveRules, activeRules and phases", () => {
    const doc = {
      rules: [{ key: "A" }],
      passiveRules: [{ key: "B" }],
      activeRules: [{ key: "C" }],
      phases: [{ rules: [{ key: "D" }] }],
    };
    expect(ruleElements(doc).map(([, el]) => el.key)).toEqual(["A", "B", "C", "D"]);
    expect(ruleElements(doc)[3][0]).toBe("phases[0].rules[0]");
  });
});

describe("compileDocument", () => {
  const library = new Map([["divinity", { id: "divinity", name: "Divinity", parameterized: ["rank"], rank: "@rank" }]]);

  it("produces a keyed Actor with embedded, separately-keyed abilities", () => {
    const doc = {
      schema: 1, id: "karna", name: "Karna",
      parameters: { str: "B" }, abilities: [{ ref: "divinity", rank: "A" }],
    };
    const out = compileDocument(doc, "servants", library);
    expect(out._key).toBe(`!actors!${out._id}`);
    expect(out.type).toBe("servant");
    expect(out.items.length).toBe(1);
    // Embedded documents need their own key or the pack compiler throws.
    expect(out.items[0]._key).toBe(`!actors.items!${out._id}.${out.items[0]._id}`);
  });

  it("keeps rank tables symbolic rather than baking them at build time", () => {
    // A Magic Resistance resolved to 30% at build time would not respond to a
    // runtime rank shift (Ch. 37 §37.3 step 4).
    const doc = { schema: 1, id: "mr", name: "MR", rules: [{ key: "Resistance", table: "magicResistancePercent" }] };
    const out = compileDocument(doc, "effects", library);
    expect(out.system.rules[0].table).toBe("magicResistancePercent");
  });

  it("throws for a source directory with no pack mapping", () => {
    expect(() => compileDocument(ok(), "sketches", library)).toThrow(/No pack mapping/);
  });
});
