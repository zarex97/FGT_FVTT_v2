/**
 * A validator that always passes is worthless. These tests exist to prove it
 * fails on the failure modes Ch. 37 §37.4 says it must catch.
 */
import { describe, it, expect } from "vitest";
import {
  validateAll, resolveRef, substitute, documentId, ruleElements, compileDocument,
  indexAssets, unitImages, ASSET_ROOT,
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

  // `table:` names a rank table everywhere; TableOverride needs a CHECK table,
  // so it uses `forceTable:`. The two were briefly the same field, and the
  // collision produced a validation error nobody could read.
  it("keeps the rank-table and check-table fields apart", () => {
    expect(errorsFor([file(ok({ rules: [{ key: "TableOverride", check: "evade", forceTable: "unfavourable" }] }))]))
      .toEqual([]);
  });

  it("points at forceTable when a check table lands in the table field", () => {
    expect(errorsFor([file(ok({ rules: [{ key: "TableOverride", check: "evade", table: "unfavourable" }] }))])[0])
      .toMatch(/did you mean forceTable: unfavourable\?/);
  });

  it("catches an unknown check table", () => {
    expect(errorsFor([file(ok({ rules: [{ key: "TableOverride", check: "evade", forceTable: "favorable" }] }))])[0])
      .toMatch(/unknown check table "favorable"/);
  });

  it("catches a TableOverride with nothing to force", () => {
    expect(errorsFor([file(ok({ rules: [{ key: "TableOverride", check: "evade" }] }))])[0])
      .toMatch(/TableOverride with no "forceTable"/);
  });

  it("rejects forceTable on any other element", () => {
    expect(errorsFor([file(ok({ rules: [{ key: "FlatDamage", forceTable: "unfavourable" }] }))])[0])
      .toMatch(/only TableOverride uses it/);
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

  it("carries a Servant's summonVariant block through — every actorSystem field must be listed explicitly or it compiles to its schema default", () => {
    const doc = {
      schema: 1, id: "semiramis", name: "Semiramis", parameters: { str: "E" },
      summonVariant: { heads: { id: "dsc", overrides: { sustainability: "4◈" } }, tails: { id: "noDsc" } },
    };
    const out = compileDocument(doc, "servants", library);
    expect(out.system.summonVariant).toEqual(doc.summonVariant);
  });

  it("carries an ability's itemCost through — same allowlist gap as summonVariant", () => {
    // Found live: Arrogant King's Poison landed its AoE but never spent the 3
    // [Semiramis' Poison] it costs, because `itemCost` was authored and never
    // added to this file's explicit field list -- it compiled to `null` and
    // `itemCostIntents` (engine/skill-use.mjs) saw nothing to spend.
    const doc = {
      schema: 1, id: "akp", name: "Arrogant King's Poison",
      itemCost: { contentId: "semiramis-poison", amount: 3 },
    };
    const out = compileDocument(doc, "abilities", library);
    expect(out.system.itemCost).toEqual(doc.itemCost);
  });

  it("keeps an authored max alongside countFrom (Ch. 32, Sikera Ušum's '6◈+⅓◈ after the NP ends')", () => {
    // The object-form branch used to return `max: null` unconditionally,
    // discarding any authored one -- fine for Presence Concealment (rank
    // table only) and silent for the first ability that ALSO needed a flat
    // max with its `countFrom: deactivation`.
    const doc = {
      schema: 1, id: "sikera-usum", name: "Sikera Ušum",
      cooldown: { max: "6◈+⅓◈", countFrom: "deactivation" },
    };
    const out = compileDocument(doc, "abilities", library);
    expect(out.system.cooldown).toMatchObject({ max: "6◈+⅓◈", countFrom: "deactivation" });
  });

  it("carries Bašmu's summon-specific fields through", () => {
    const doc = {
      schema: 1, id: "basmu", name: "Bašmu", parameters: { str: "E" },
      movesOntoOccupiedPanels: true,
    };
    const out = compileDocument(doc, "summons", library);
    expect(out.system.movesOntoOccupiedPanels).toBe(true);
  });

  it("carries Dragon Wing Warriors' rolled repeat and fixed damage through — `damage` is a raw passthrough", () => {
    const doc = {
      schema: 1, id: "dww", name: "Dragon Wing Warriors",
      damage: { fixed: true, base: { fixedValue: 50 }, component: "str", repeat: { roll: "1d6+4" } },
    };
    const out = compileDocument(doc, "abilities", library);
    expect(out.system.damage).toEqual(doc.damage);
  });

  it("carries a platform's actsOncePerTurn through — the same field basmu.yml uses", () => {
    const doc = {
      schema: 1, id: "hgob", name: "Hanging Gardens of Babylon", parameters: { str: "E" },
      actsOncePerTurn: true,
    };
    const out = compileDocument(doc, "platforms", library);
    expect(out.system.actsOncePerTurn).toBe(true);
  });

  it("sizes a platform's prototype token from its footprint", () => {
    const doc = {
      schema: 1, id: "hgob", name: "Hanging Gardens of Babylon",
      footprint: { w: 9, h: 9 },
    };
    const out = compileDocument(doc, "platforms", library);
    expect(out.system.footprint).toEqual({ w: 9, h: 9 });
    // The board reads occupancy off the TOKEN's grid footprint
    // (`rules/snapshot.mjs#gridFootprint`), so a 1x1 prototype for a 9x9
    // platform is a rules contradiction, not a display one.
    expect(out.prototypeToken.width).toBe(9);
    expect(out.prototypeToken.height).toBe(9);
  });

  it("leaves the token size alone for a document with no footprint", () => {
    const out = compileDocument({ schema: 1, id: "x", name: "X" }, "servants", library);
    expect(out.prototypeToken.width).toBeUndefined();
    expect(out.prototypeToken.height).toBeUndefined();
  });

  it("locks artwork rotation on every compiled prototype token", () => {
    // Facing is `system.facing`; Foundry's own rotation is artwork only, and
    // spinning it desyncs the picture from the field the rules read.
    for (const dir of ["servants", "masters", "summons", "platforms"]) {
      const out = compileDocument({ schema: 1, id: "x", name: "X" }, dir, library);
      expect(out.prototypeToken.lockRotation).toBe(true);
    }
  });

  it("lets an explicit prototypeToken override the footprint-derived size", () => {
    const doc = {
      schema: 1, id: "hgob", name: "HGoB",
      footprint: { w: 9, h: 9 }, prototypeToken: { width: 11, height: 11 },
    };
    const out = compileDocument(doc, "platforms", library);
    expect(out.prototypeToken.width).toBe(11);
  });
});

describe("activeRules nothing can switch on (§37.4)", () => {
  const errors = (doc, dir = "abilities") => validateAll([file(doc, "x.yml", dir)]).problems;
  const withActive = (over = {}) => ok({
    activeRules: [{ key: "MovDelta", value: 5 }], ...over,
  });

  it("accepts a declared mode", () => {
    expect(errors(withActive({ isMode: true }))).toEqual([]);
  });

  it("accepts an ability whose activeRules ARE its mode, undeclared", () => {
    // `class-riding.yml` and Pale Rider's: activeRules and no phases, which
    // `classifyAbility` reads as a mode that forgot to say so.
    expect(errors(withActive())).toEqual([]);
  });

  it("accepts a windowed ability, which is offered at its window instead", () => {
    // Monstrous Strength: `engine/attack.mjs#offerAttackerWindow` reads
    // `activeRules` off the item directly, so this path is genuinely wired.
    expect(errors(withActive({ timing: { window: "damageStep" } }))).toEqual([]);
  });

  it("REFUSES activeRules on an ability that has phases", () => {
    // Medusa's Riding: phases make it `active`, and `contributionsOf` reads
    // `activeRules` only while `system.active` is set, which nothing ever sets
    // for a used ability. Authored, shipped, and applied by nothing.
    const problems = errors(withActive({ phases: [{ kind: "applyEffects", target: "self" }] }));
    expect(problems[0]).toMatch(/activeRules/);
    expect(problems[0]).toMatch(/active/);
  });

  it("REFUSES activeRules on an attack", () => {
    expect(errors(withActive({ isSpell: true }))[0]).toMatch(/activeRules/);
  });

  it("says nothing about an ability with no activeRules at all", () => {
    expect(errors(ok({ phases: [{ kind: "applyEffects", target: "self" }] }))).toEqual([]);
  });
});

describe("shipped artwork (§37.3)", () => {
  const library = new Map();
  const { assets } = indexAssets([
    "classes/berserker.webp", "classes/alterEgo.png", "servants/asterios.webp",
    "masters/kiritsugu.jpg", "README.md", "classes/notes.txt",
  ]);
  const servant = (over = {}) => ({
    schema: 1, id: "asterios", name: "Asterios", servantClasses: ["berserker"], ...over,
  });

  it("indexes by <dir>/<basename> under the system's Foundry path, ignoring non-images", () => {
    expect(assets.get("classes/berserker")).toBe(`${ASSET_ROOT}/classes/berserker.webp`);
    expect(assets.get("servants/asterios")).toBe(`${ASSET_ROOT}/servants/asterios.webp`);
    expect(assets.has("README")).toBe(false);
    expect(assets.has("classes/notes")).toBe(false);
  });

  it("refuses two files that differ only by extension rather than picking one", () => {
    const { assets: a, problems } = indexAssets(["servants/karna.png", "servants/karna.webp"]);
    expect(problems[0]).toMatch(/servants\/karna\.webp: ambiguous with assets\/servants\/karna\.png/);
    expect(a.get("servants/karna")).toBe(`${ASSET_ROOT}/servants/karna.png`);
  });

  it("derives a Servant's portrait from its id and its standard image from its class container", () => {
    const out = compileDocument(servant(), "servants", library, assets);
    expect(out.img).toBe(`${ASSET_ROOT}/servants/asterios.webp`);
    expect(out.system.defaultImage).toBe(`${ASSET_ROOT}/classes/berserker.webp`);
  });

  it("starts a Servant's token on the class image, not the true portrait", () => {
    // A Servant leaves the compendium unrevealed. Foundry copies `img` onto a
    // token whose texture is unset, so without this the true face is on the
    // board for every opponent before `engine/token-image.mjs` has anything to
    // react to.
    const out = compileDocument(servant(), "servants", library, assets);
    expect(out.prototypeToken.texture.src).toBe(`${ASSET_ROOT}/classes/berserker.webp`);
  });

  it("falls back to the portrait for a Servant whose class has no image yet", () => {
    const out = compileDocument(servant({ servantClasses: ["saber"] }), "servants", library, assets);
    expect(out.system.defaultImage).toBeNull();
    expect(out.prototypeToken.texture.src).toBe(`${ASSET_ROOT}/servants/asterios.webp`);
  });

  it("uses classContainer over the first declared class, as the runtime does", () => {
    const images = unitImages(
      servant({ servantClasses: ["saber", "alterEgo"], classContainer: "alterEgo" }), "servants", "servant", assets,
    );
    expect(images.defaultImage).toBe(`${ASSET_ROOT}/classes/alterEgo.png`);
  });

  it("gives a non-Servant its own portrait as token art and no standard image", () => {
    // `defaultImage` is inert on anything but an unrevealed Servant
    // (`publicImageOf`); filling it would be authored-and-inert by construction.
    const out = compileDocument({ schema: 1, id: "kiritsugu", name: "Kiritsugu" }, "masters", library, assets);
    expect(out.img).toBe(`${ASSET_ROOT}/masters/kiritsugu.jpg`);
    expect(out.system.defaultImage).toBeNull();
    expect(out.prototypeToken.texture.src).toBe(`${ASSET_ROOT}/masters/kiritsugu.jpg`);
  });

  it("lets authored img and defaultImage win over the files on disk", () => {
    const out = compileDocument(
      servant({ img: "worlds/x/true.png", defaultImage: "worlds/x/mask.png" }), "servants", library, assets,
    );
    expect(out.img).toBe("worlds/x/true.png");
    expect(out.system.defaultImage).toBe("worlds/x/mask.png");
    expect(out.prototypeToken.texture.src).toBe("worlds/x/mask.png");
  });

  it("leaves the token texture unset when there is no image at all", () => {
    // Foundry's own default (`mystery-man`) is the honest state; an empty
    // string is a broken image.
    const out = compileDocument(servant({ id: "nobody" }), "servants", library, new Map());
    expect(out.img).toBeUndefined();
    expect(out.prototypeToken.texture).toBeUndefined();
  });

  it("warns, by expected path, for a unit whose artwork is missing", () => {
    const files = [
      file(servant({ id: "medea", servantClasses: ["caster"] }), "medea.yml", "servants"),
      file(servant({ id: "medusa", servantClasses: ["caster", "rider"] }), "medusa.yml", "servants"),
    ];
    const warnings = validateAll(files, assets).warnings;
    expect(warnings).toContain("medea.yml: no portrait -- expected assets/servants/medea.<ext>");
    // One class, one warning -- not one per Servant summoned into it.
    expect(warnings.filter((w) => w.includes('class image for "caster"'))).toHaveLength(1);
  });

  it("collapses an empty assets directory to a single warning", () => {
    const warnings = validateAll([file(servant(), "asterios.yml", "servants")], new Map()).warnings;
    expect(warnings.filter((w) => w.startsWith("assets/"))).toHaveLength(1);
    expect(warnings.some((w) => w.includes("no portrait"))).toBe(false);
  });

  it("warns for a class image under a name no classContainer will ever ask for", () => {
    // The one miss no Servant file can reveal: `Class-Shielder-Gold.webp` came
    // in with a downloaded icon set, ships in the release zip, and is
    // indistinguishable from a working class image by inspection alone.
    const { assets: a } = indexAssets(["classes/berserker.webp", "classes/Class-Shielder-Gold.webp"]);
    const warnings = validateAll([file(servant(), "asterios.yml", "servants")], a).warnings;
    const orphan = warnings.filter((w) => w.startsWith("classes/Class-Shielder-Gold.webp"));
    expect(orphan).toHaveLength(1);
    expect(orphan[0]).toMatch(/no Servant class is called "Class-Shielder-Gold"/);
    // And says nothing about the one that is a real class.
    expect(warnings.some((w) => w.startsWith("classes/berserker.webp"))).toBe(false);
  });

  it("says nothing about images when no index is passed at all", () => {
    expect(validateAll([file(servant(), "asterios.yml", "servants")]).warnings.some((w) => /portrait|assets/.test(w)))
      .toBe(false);
  });
});

describe("copyable (§15.7)", () => {
  it("accepts an ability that says nothing, because copyable defaults to allowed", () => {
    expect(errorsFor([file(ok())])).toEqual([]);
  });

  it("accepts a documented refusal", () => {
    expect(errorsFor([file(ok({ copyable: { allowed: false, reason: "physical" } }))])).toEqual([]);
  });

  it("catches a refusal with no reason", () => {
    // "cannot be copied" with no reason is a rule nobody can check against
    // §15.7's exclusion list.
    expect(errorsFor([file(ok({ copyable: { allowed: false } }))])[0])
      .toMatch(/copyable\.allowed is false/);
  });

  it("catches a reason outside the documented set", () => {
    expect(errorsFor([file(ok({ copyable: { allowed: false, reason: "because" } }))])[0])
      .toMatch(/expected one of/);
  });

  it("catches a copy that also carries its own phases", () => {
    // With both, which one runs depends on the reader — and the two readers
    // would disagree.
    expect(errorsFor([file(ok({ copiedFrom: "manaBurst", phases: [{ kind: "damage" }] }))])[0])
      .toMatch(/a copy carries no phases of its own/);
  });
});

describe("priority overrides (§24.6)", () => {
  const withPriority = (over = {}) => ok({
    rules: [{ key: "StatDelta", priority: 45, ...over }],
  });

  it("warns about a priority override, rather than failing the build", () => {
    // "Content may override with an explicit priority, but doing so requires an
    // @intentional marker and the validator warns." A warning, because it is
    // legitimate -- fewer than five elements in the reference set need it --
    // and an error would make a supported feature unusable.
    const out = validateAll([file(withPriority({ "@intentional": "Suppress must see the clamp" }))]);

    expect(out.problems).toEqual([]);
    expect(out.warnings.join(" ")).toMatch(/priority/i);
  });

  it("ERRORS on a priority override with no @intentional marker", () => {
    // An unmarked override is indistinguishable from a typo, and it silently
    // reorders the element against every other one in its band.
    expect(errorsFor([file(withPriority())])[0]).toMatch(/@intentional/);
  });

  it("errors on an @intentional marker that explains nothing", () => {
    // The marker exists to make the author state WHY. `true` states nothing,
    // and a reviewer reading it a year later learns nothing either.
    expect(errorsFor([file(withPriority({ "@intentional": true }))])[0]).toMatch(/@intentional/);
    expect(errorsFor([file(withPriority({ "@intentional": "" }))])[0]).toMatch(/@intentional/);
  });

  it("says nothing about an element with no priority", () => {
    const out = validateAll([file(ok({ rules: [{ key: "StatDelta" }] }))]);

    expect(out.problems).toEqual([]);
    expect(out.warnings.filter((w) => /priority/i.test(w))).toEqual([]);
  });

  it("names the band the override lands in, so the warning is actionable", () => {
    // "priority 45" means nothing; "45, between Aura consumers (35) and
    // Multiplicative (40)" tells the author what they are stepping between.
    const out = validateAll([file(withPriority({ "@intentional": "because" }))]);

    expect(out.warnings.join(" ")).toMatch(/multiplicative|40/i);
  });
});
