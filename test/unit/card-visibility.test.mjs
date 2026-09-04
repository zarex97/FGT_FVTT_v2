/**
 * @file Per-viewer chat card content.
 * @see docs/26-authority-and-sockets.md §26.7
 */

import { describe, it, expect } from "vitest";
import { cardFor, redactSources, VISIBILITY_MODES, skillEffectsFor } from "../../module/rules/card-visibility.mjs";

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
