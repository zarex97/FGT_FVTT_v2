/**
 * @file Per-viewer chat card content.
 * @see docs/26-authority-and-sockets.md §26.7
 */

import { describe, it, expect } from "vitest";
import {
  cardFor, redactSources, VISIBILITY_MODES, skillEffectsFor, redactBreakdown,
} from "../../module/rules/card-visibility.mjs";
import { readFileSync } from "node:fs";

const result = () => ({
  summary: "Karna attacks Heracles",
  attackerId: "karna",
  defenderIds: ["heracles"],
  attackerControllers: ["u-karna"],
  defenderControllers: ["u-heracles"],
  total: 2071,
  breakdown: [
    { source: "Karna: Mana Burst (Flames)", side: "attacker", value: 300 },
    { source: "Heracles: God Hand", side: "defender", value: -200 },
    { source: "attacked from the left", side: "neutral", value: 50 },
  ],
  effects: ["burn", "atkDown"],
  rolls: [
    { id: "r1", visibility: "public", actorId: "heracles" },
    { id: "r2", visibility: "gm", actorId: "karna" },
  ],
});

const viewer = (over = {}) => ({ id: "u-bystander", isGM: false, ...over });

describe("cardFor", () => {
  it("shows the summary to everyone", () => {
    // "a bystander sees 'Karna attacked Heracles'".
    expect(cardFor(result(), viewer()).header).toBe("Karna attacks Heracles");
  });

  it("hides the damage total from a bystander", () => {
    expect(cardFor(result(), viewer()).damage).toBe(null);
  });

  it("shows the damage to the attacker, the defender and the GM", () => {
    expect(cardFor(result(), viewer({ id: "u-karna" })).damage).toBe(2071);
    expect(cardFor(result(), viewer({ id: "u-heracles" })).damage).toBe(2071);
    expect(cardFor(result(), viewer({ isGM: true })).damage).toBe(2071);
  });

  it("gives the GM the whole breakdown", () => {
    expect(cardFor(result(), viewer({ isGM: true })).breakdown).toHaveLength(3);
  });

  it("redacts the DEFENDER's sources from the attacker", () => {
    // The attacker learns what they contributed, not what the defender has.
    // Learning "God Hand: −200" tells them a skill they were not told about.
    const rows = cardFor(result(), viewer({ id: "u-karna" })).breakdown;

    expect(rows.some((r) => r.source.includes("Mana Burst"))).toBe(true);
    expect(rows.some((r) => r.source.includes("God Hand"))).toBe(false);
  });

  it("redacts the ATTACKER's sources from the defender", () => {
    const rows = cardFor(result(), viewer({ id: "u-heracles" })).breakdown;

    expect(rows.some((r) => r.source.includes("God Hand"))).toBe(true);
    expect(rows.some((r) => r.source.includes("Mana Burst"))).toBe(false);
  });

  it("keeps neutral rows for both sides", () => {
    // A facing bonus is a fact about the board, which both players can see.
    for (const id of ["u-karna", "u-heracles"]) {
      expect(cardFor(result(), viewer({ id })).breakdown.some((r) => r.source.includes("from the left")))
        .toBe(true);
    }
  });

  it("gives a bystander no breakdown at all", () => {
    expect(cardFor(result(), viewer()).breakdown).toBe(null);
  });

  it("names the effects for the defender and counts them for everyone else", () => {
    // "a player learns the effects applied to their OWN units" — a bystander
    // learns only that something was applied.
    expect(cardFor(result(), viewer({ id: "u-heracles" })).effects).toEqual(["burn", "atkDown"]);
    expect(cardFor(result(), viewer()).effects).toBe(2);
  });

  it("filters the rolls by their own visibility", () => {
    // A GM-only Discover roll on a card everyone can read gives away the
    // Assassin's panel without anyone rolling anything.
    expect(cardFor(result(), viewer({ id: "u-karna" })).rolls.map((r) => r.id)).toEqual(["r1"]);
    expect(cardFor(result(), viewer({ isGM: true })).rolls).toHaveLength(2);
  });

  it("treats a viewer who is both attacker and defender as both", () => {
    // A Servant charmed into attacking its own faction, or an AoE that catches
    // the attacker. Neither redaction should apply.
    const r = { ...result(), defenderControllers: ["u-karna"] };

    expect(cardFor(r, viewer({ id: "u-karna" })).breakdown).toHaveLength(3);
  });
});

describe("redactSources", () => {
  it("drops rows belonging to one side", () => {
    expect(redactSources([{ side: "attacker" }, { side: "defender" }], "attacker"))
      .toEqual([{ side: "defender" }]);
  });

  it("keeps a row with no side, because unattributed is not secret", () => {
    // A row nobody claimed is a board fact; dropping it would silently change
    // the arithmetic the viewer can check.
    expect(redactSources([{ source: "x" }], "attacker")).toHaveLength(1);
  });
});

describe("VISIBILITY_MODES", () => {
  it("offers the two §26.7 documents", () => {
    // "one message with client-side filtering (fast, simple)" is the default,
    // and "separate whispered messages (slower, actually secure)" is strict.
    expect([...VISIBILITY_MODES].sort()).toEqual(["filtered", "strict"]);
  });
});

describe("a Skill card's effect list (§26.7)", () => {
  const rows = [
    { name: "Atk Up (STR)", controllers: ["caster-player"] },
    { name: "Burn", controllers: ["victim-player"] },
    { name: "Crit DmUp", controllers: ["caster-player"] },
  ];
  const casterControllers = ["caster-player"];

  it("shows the caster's controller everything", () => {
    // They applied it, so they already know it.
    const out = skillEffectsFor(rows, { id: "caster-player", casterControllers });
    expect(out.names).toEqual(["Atk Up (STR)", "Burn", "Crit DmUp"]);
    expect(out.hidden).toBe(0);
  });

  it("shows a GM everything", () => {
    expect(skillEffectsFor(rows, { id: "gm", isGM: true, casterControllers }).names).toHaveLength(3);
  });

  it("shows a victim only what landed on their own unit", () => {
    // The two buffs the caster put on ITSELF are not this player's business.
    const out = skillEffectsFor(rows, { id: "victim-player", casterControllers });
    expect(out.names).toEqual(["Burn"]);
    expect(out.hidden).toBe(2);
  });

  it("shows a bystander nothing but a count", () => {
    const out = skillEffectsFor(rows, { id: "nobody", casterControllers });
    expect(out.names).toEqual([]);
    expect(out.hidden).toBe(3);
  });

  it("counts rather than hides, so something is known to have happened", () => {
    // Silence reads as "the Skill did nothing", which is a different fact.
    expect(skillEffectsFor(rows, { id: "nobody", casterControllers }).hidden).toBe(3);
  });

  it("survives an empty list", () => {
    expect(skillEffectsFor([], { id: "x" })).toEqual({ names: [], hidden: 0 });
    expect(skillEffectsFor(undefined, { id: "x" })).toEqual({ names: [], hidden: 0 });
  });
});

describe("an attack card's effects, split for a template (§26.7)", () => {
  // `cardFor` returns `effects` as an ARRAY for those entitled to read it and
  // a COUNT for everyone else. One field with two types cannot be rendered
  // without a helper Handlebars does not have, so the card splits it — and the
  // split has to agree with `cardFor` or the card shows the wrong thing.
  const input = {
    attackerControllers: ["att"], defenderControllers: ["def"],
    total: 120, breakdown: [], rolls: [],
    effects: ["Burn", "Def Dwn"],
  };

  it("gives the defender the names", () => {
    expect(cardFor(input, { id: "def" }).effects).toEqual(["Burn", "Def Dwn"]);
  });

  it("gives a bystander a count and no names", () => {
    const out = cardFor(input, { id: "nobody" });
    expect(out.effects).toBe(2);
    expect(Array.isArray(out.effects)).toBe(false);
  });

  it("gives the attacker a count too, since the effects landed on the defender", () => {
    // The attacker learns their damage and their own modifiers, not what
    // stuck to the target -- that is the defender's to know.
    expect(cardFor(input, { id: "att" }).effects).toBe(2);
  });

  it("marks a bystander as not involved, which is what hides the breakdown", () => {
    expect(cardFor(input, { id: "nobody" }).involved).toBe(false);
    expect(cardFor(input, { id: "att" }).involved).toBe(true);
    expect(cardFor(input, { id: "def" }).involved).toBe(true);
    expect(cardFor(input, { id: "gm", isGM: true }).involved).toBe(true);
  });

  it("gives a bystander no damage total at all", () => {
    expect(cardFor(input, { id: "nobody" }).damage).toBeNull();
    expect(cardFor(input, { id: "def" }).damage).toBe(120);
  });
});

describe("redactBreakdown", () => {
  // One stage of the real sixteen, with a contributor from each side and one
  // that belongs to neither.
  const rows = () => [
    {
      index: 4,
      label: "Combined percent",
      delta: "+30%",
      running: 390,
      inert: false,
      contributors: [
        { source: "Atk Up", value: "+30%", note: "Howl of the War God", side: "attacker" },
        { source: "Def Up", value: "-20%", note: "God Hand", side: "defender" },
        { source: "Day/Night", value: "+25%", note: "night vs [Dark]", side: null },
      ],
      notes: [
        { source: "bucket", text: "+35% -> x1.35", side: null },
        { source: "block", text: "bypassed by Pierce", side: "defender" },
      ],
    },
  ];

  const names = (out) => out[0].contributors.map((c) => c.source);

  it("keeps the attacker their own modifiers and the board's", () => {
    const out = redactBreakdown(rows(), { isAttacker: true });
    expect(names(out)).toEqual(["Atk Up", "Day/Night"]);
  });

  it("keeps the defender their own modifiers and the board's", () => {
    const out = redactBreakdown(rows(), { isDefender: true });
    expect(names(out)).toEqual(["Def Up", "Day/Night"]);
  });

  it("gives the GM everything, untouched", () => {
    expect(names(redactBreakdown(rows(), { isGM: true }))).toEqual(
      ["Atk Up", "Def Up", "Day/Night"],
    );
  });

  it("hides nothing from a unit that is both sides at once", () => {
    // An AoE that caught its own caster, or a charmed Servant attacking its
    // own faction. There is no side to hide it from.
    const out = redactBreakdown(rows(), { isAttacker: true, isDefender: true });
    expect(names(out)).toHaveLength(3);
  });

  it("hides both sides from a bystander", () => {
    // `involved` already gates the whole section, so a bystander never sees
    // this. Returning "nothing hidden" would make the function unsafe the
    // moment somebody renders it without that gate -- which is exactly how the
    // redaction came to be computed and never read.
    expect(names(redactBreakdown(rows(), {}))).toEqual(["Day/Night"]);
  });

  it("counts what it withheld rather than saying nothing", () => {
    // One contributor and one note, so the reader knows there is more here.
    expect(redactBreakdown(rows(), { isAttacker: true })[0].hiddenContributors).toBe(2);
    expect(redactBreakdown(rows(), { isDefender: true })[0].hiddenContributors).toBe(1);
    expect(redactBreakdown(rows(), { isGM: true })[0].hiddenContributors).toBeUndefined();
  });

  it("redacts the blocked-reason notes too", () => {
    const out = redactBreakdown(rows(), { isAttacker: true });
    expect(out[0].notes.map((n) => n.source)).toEqual(["bucket"]);
  });

  it("leaves the arithmetic alone", () => {
    // The delta and the running total are how a viewer checks the number they
    // are being shown. A table that does not add up reads as a bug rather
    // than as discretion.
    const out = redactBreakdown(rows(), { isAttacker: true })[0];
    expect(out.delta).toBe("+30%");
    expect(out.running).toBe(390);
    expect(out.index).toBe(4);
    expect(out.label).toBe("Combined percent");
  });

  it("survives rows with no contributors at all", () => {
    const inert = [{ index: 9, label: "ZON penalty", delta: "\u2014", running: 390, inert: true }];
    expect(() => redactBreakdown(inert, { isDefender: true })).not.toThrow();
    expect(redactBreakdown(inert, { isDefender: true })[0].contributors).toEqual([]);
  });
});

describe("the pipeline attributes every contribution", () => {
  // A contributor with no side is shown to EVERYONE. That is right for a board
  // fact and wrong for a modifier, and the difference is invisible at review:
  // the card still renders, just to the wrong person. So the six deliberate
  // unattributed calls are listed here by hand, and a seventh fails this test.
  const UNATTRIBUTED = [
    'state.note("fixedDamage"',       // arithmetic: which stages were skipped
    's.note("bucket"',                // arithmetic: the summed percentage
    's.contribute("band"',            // the board: an AoE's distance band
    's.contribute("dayNight"',        // the board: the panel's phase
    's.contribute("homeBaseAttack"',  // the board: both units in a home base
    's.contribute(m.key ?? "totalDamage"', // no owner is recorded on these
    'this.note("precondition"',       // the negation, already public in the summary
  ];

  it("gives every contributor an explicit side", () => {
    const source = readFileSync("module/rules/damage/pipeline.mjs", "utf8");
    const calls = source
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /\b(s|state|this)\.(contribute|note)\(/.test(l));

    const unsided = calls.filter(
      (l) => !/"(attacker|defender)"\);$/.test(l) && !UNATTRIBUTED.some((u) => l.includes(u)),
    );
    expect(unsided).toEqual([]);
  });

  it("finds the calls at all, so a broken match cannot pass vacuously", () => {
    const source = readFileSync("module/rules/damage/pipeline.mjs", "utf8");
    const calls = source.match(/\b(s|state|this)\.(contribute|note)\(/g) ?? [];
    expect(calls.length).toBeGreaterThan(30);
  });
});

describe("an open table", () => {
  // `closedInfo` is the GM's switch, and it spent its whole life registered
  // and read by nothing. Off, every viewer reads the card the GM reads.
  const result = () => ({
    summary: "Karna attacks Heracles",
    attackerControllers: ["u-karna"],
    defenderControllers: ["u-heracles"],
    total: 2071,
    breakdown: [
      { source: "Mana Burst", side: "attacker", value: 300 },
      { source: "God Hand", side: "defender", value: -200 },
    ],
    effects: ["Burn"],
    rolls: [{ purpose: "discover", visibility: "gm", actorId: "hassan" }],
  });

  it("gives a bystander the damage and the whole breakdown", () => {
    const out = cardFor(result(), { id: "nobody", openTable: true });
    expect(out.involved).toBe(true);
    expect(out.damage).toBe(2071);
    expect(out.breakdown).toHaveLength(2);
  });

  it("gives the attacker the defender's rows too", () => {
    const out = cardFor(result(), { id: "u-karna", openTable: true });
    expect(out.breakdown.map((r) => r.source)).toEqual(["Mana Burst", "God Hand"]);
  });

  it("still keeps a GM-only roll to the GM", () => {
    // Opening the table is not the same as opening the GM's screen: a hidden
    // Discover roll would give away the Assassin's panel to everyone.
    expect(cardFor(result(), { id: "nobody", openTable: true }).rolls).toEqual([]);
    expect(cardFor(result(), { id: "gm", isGM: true }).rolls).toHaveLength(1);
  });

  it("hides nothing in the rich breakdown either", () => {
    const rows = [{
      index: 4, label: "Combined percent", delta: "+30%", running: 390, inert: false,
      contributors: [
        { source: "Atk Up", value: "+30%", note: null, side: "attacker" },
        { source: "Def Up", value: "-20%", note: null, side: "defender" },
      ],
      notes: [],
    }];
    const out = redactBreakdown(rows, { isAttacker: true, seesAll: true });
    expect(out[0].contributors).toHaveLength(2);
  });

  it("names every effect on a Skill card", () => {
    const rows = [{ name: "Burn", controllers: ["u-a"] }, { name: "Atk Up", controllers: ["u-b"] }];
    expect(skillEffectsFor(rows, { id: "u-c", openTable: true })).toEqual({
      names: ["Burn", "Atk Up"], hidden: 0,
    });
    expect(skillEffectsFor(rows, { id: "u-c" })).toEqual({ names: [], hidden: 2 });
  });
});
