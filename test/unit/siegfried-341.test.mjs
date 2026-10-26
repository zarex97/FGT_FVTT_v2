/**
 * Siegfried (Saber), audit #341: his sheet built through the real projection,
 * and the pieces he brought: a Total cut read off the attack's Rank, its
 * bypasses (Anti-Dragon, from behind, NP Seal), a Max Health wound, a Golden
 * Rule cut a buff lengthens, and an NP Regen counted from his Anti-Dragon
 * effects.
 * @see docs/superpowers/specs/2026-10-26-siegfried-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";
import { countOf } from "../../module/rules/count.mjs";
import { rollOptionsFor, antiAttributesOf } from "../../module/rules/options.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const SIEG = "siegfried0000001";
const FOE = "siegFoe000000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "B" } };
const ON_A = { ...WAR, combat: { ...WAR.combat, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);
const effectOf = (w, id, defId) => [...w.actor(id).effects].find((e) => e.system?.defId === defId);

/**
 * One hit's damage on him, as the resolution computes it, with no dice.
 * He stands at (6, 6) facing north: (5, 6) is his Front, (7, 6) his back.
 */
async function hitOn({ from, ability = null, at = { i: 5, j: 6 }, sieg = {}, foe = {}, isNP = false }) {
  let out = null;
  await withSubjects([
    { from: "siegfried", id: SIEG, panel: { i: 6, j: 6 }, state: { factionId: "A" }, ...sieg },
    { from, id: FOE, panel: at, state: { factionId: "B" }, ...foe },
  ], async ({ world: w }) => {
    const { previewContext } = await import("../../module/engine/attack.mjs");
    const { computeDamage } = await import("../../module/rules/damage/pipeline.mjs");
    const { currentBoard } = await import("../../module/engine/board.mjs");
    const board = currentBoard();
    const caster = board.units.find((u) => u.id === FOE);
    const defender = board.units.find((u) => u.id === SIEG);
    const item = ability ? abilityOf(w, FOE, ability) : null;
    out = computeDamage({ ...previewContext({ caster, defender, ability: item, board, isNP, targets: [defender] }), rolls: { attackMinus: 0 } });
  }, WAR);
  return out;
}
const notes = (out) => out.breakdown.flatMap((s) => [
  ...(s.contributors ?? []).map((c) => c.note ?? ""), ...(s.notes ?? []).map((n) => n.text ?? ""),
]);
const tier = (out) => notes(out).filter((n) => /Armor of Fafnir/.test(n));

/* ========================================================================== */

describe("the sheet, projected (ST.*; MR.none)", () => {
  it("Saber, Chaotic Good, Germany; B+ A B C E; 1500, MOV 5, Range 1; BA 135/150 by the tables; Melee; 2◈", async () => {
    await withSubjects([{ from: "siegfried", id: SIEG }], ({ unit, world: w }) => {
      const s = unit(SIEG);
      expect(s.servantClasses).toEqual(["saber"]);
      expect(s.alignment).toMatchObject({ order: "chaotic", morality: "good" });
      expect(s.region).toEqual(["germany"]);
      expect(s.attributes).toEqual(expect.arrayContaining(["male", "servant", "earth", "dragon", "king", "humanoid"]));
      expect(Object.fromEntries(Object.entries(s.parameters).map(([k, v]) => [k, String(v)])))
        .toMatchObject({ str: "B+", end: "A", agi: "B", mag: "C", luc: "E" });
      expect(s.maxHealth ?? s.health?.max).toBe(1500);
      expect(s.mov).toBe(5);
      expect(s.range).toBe(1);
      // The STR table at B+ is 135; the sheet prints 185, and the table wins (§46.6).
      expect(s.baseAttack).toEqual(expect.objectContaining({ str: 135, mag: 150 }));
      expect(s.normalAttack).toMatchObject({ component: "str", delivery: "melee" });
      expect(w.actor(SIEG).system.sustainability).toBe("2◈");
      // Rank —: no Magic Resistance of his own (ruling 1).
      expect(s.magicResistance).toBeFalsy();
    });
  });

  it("holds Riding B, Golden Rule C- at 55, Disengage A, and his four own", async () => {
    await withSubjects([{ from: "siegfried", id: SIEG }], ({ world: w }) => {
      const ids = w.actor(SIEG).items.map((i) => i.system.contentId).sort();
      expect(ids).toEqual([
        "class-riding-unlocks", "disengage", "golden-rule", "siegfried-armor-of-fafnir", "siegfried-avaricious-gold",
        "siegfried-balmung", "siegfried-dragon-slayer",
      ]);
      expect(abilityOf(w, SIEG, "class-riding-unlocks").system.rank).toBe("B");
      expect(abilityOf(w, SIEG, "golden-rule").system.rank).toBe("C-");
      const de = abilityOf(w, SIEG, "disengage").system;
      expect(de.rank).toBe("A");
      expect(de.cooldown.max).toBe("3◈");
      expect(de.phases.map((p) => [p.kind, p.panels ?? p.percentOfMax ?? p.pick])).toEqual([["move", 5], ["heal", 25], ["removeEffect", 0]]);
    });
  });
});

/* ========================================================================== */

describe("Armor of Fafnir, effect 1 (AF.1.*; rulings 2, 3, 4)", () => {
  it("nullifies a Normal Attack from STR B, Divinity's Fixed 40 included", async () => {
    const out = await hitOn({ from: "cu-chulainn" });
    expect(out.total).toBe(0);
    expect(out.flags.negatedBy).toMatch(/Armor of Fafnir/);
    expect(out.flags.fixedExtra ?? 0).toBe(0);
    expect(tier(out)).toEqual([expect.stringMatching(/nullified, STR B ≤ B/)]);
  });

  it("cuts a Normal Attack from STR A+ by 75% of its Total", async () => {
    const out = await hitOn({ from: "heracles" });
    expect(out.flags.negatedBy ?? null).toBeNull();
    expect(out.total).toBeGreaterThan(0);
    expect(tier(out)).toEqual([expect.stringMatching(/−75% Total, STR A\+/)]);
  });

  it("reads MAG for a MAG Spell: Medea's Aero at MAG A+ is cut, not nullified by her STR E (ruling 2)", async () => {
    const out = await hitOn({ from: "medea", ability: "medea-aero", at: { i: 4, j: 6 } });
    expect(out.flags.negatedBy ?? null).toBeNull();
    expect(tier(out)).toEqual([expect.stringMatching(/−75% Total, MAG A\+/)]);
  });

  it("an attacker with no Rank to read is cut, never nullified (ruling 3)", async () => {
    await withSubjects([{ from: "siegfried", id: SIEG }], async ({ unit }) => {
      const { computeDamage } = await import("../../module/rules/damage/pipeline.mjs");
      const attacker = { id: "x", parameters: {}, baseAttack: { str: 200 }, modifiers: [], effects: [] };
      const attack = { kind: "normal", component: "str" };
      const out = computeDamage({
        attacker, defender: unit(SIEG), attack,
        base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
        rolls: { attackMinus: 0 }, options: rollOptionsFor({ attacker, defender: unit(SIEG), attack }),
      });
      expect(out.total).toBe(50);
      expect(tier(out)).toEqual([expect.stringMatching(/−75% Total, STR with no Rank/)]);
    });
  });
});

describe("Armor of Fafnir, effect 2 (AF.2.*)", () => {
  it("nullifies an NP of Rank B+: Gáe Bolg, Soaring Spear", async () => {
    const out = await hitOn({ from: "cu-chulainn", ability: "cu-gae-bolg-soaring-spear", isNP: true, at: { i: 3, j: 6 } });
    expect(out.total).toBe(0);
    expect(tier(out)).toEqual([expect.stringMatching(/nullified, NP Rank B\+ ≤ B\+/)]);
  });

  it("cuts an NP of Rank A++ by 75%: Excalibur", async () => {
    const out = await hitOn({ from: "arturia", ability: "arturia-excalibur", isNP: true });
    expect(out.total).toBeGreaterThan(0);
    expect(tier(out)).toEqual([expect.stringMatching(/−75% Total, NP Rank A\+\+/)]);
  });
});

describe("Armor of Fafnir, the bypasses (AF.3, AF.4, AF.5; rulings 5, 6, 8)", () => {
  it("an AU holding Dmg Up (Dragon) is Anti-Dragon: Cú's Normal Attack lands whole", async () => {
    const out = await hitOn({ from: "cu-chulainn", foe: { effects: [{ defId: "dmgUpDragon", magnitude: 60 }] } });
    expect(out.total).toBeGreaterThan(0);
    expect(tier(out)).toEqual([]);
  });

  it("an attack whose own damage rises against Dragons is Anti-Dragon: another Siegfried's Balmung", async () => {
    const out = await hitOn({ from: "siegfried", ability: "siegfried-balmung", isNP: true });
    expect(out.total).toBeGreaterThan(0);
    expect(tier(out)).toEqual([]);
  });

  it("from behind: no tier, and Def Up and Invuln on him do nothing", async () => {
    const out = await hitOn({
      from: "cu-chulainn", at: { i: 7, j: 6 },
      sieg: { effects: [{ defId: "defUp", magnitude: 50 }, { defId: "invuln" }] },
    });
    expect(out.total).toBeGreaterThan(0);
    expect(tier(out)).toEqual([expect.stringMatching(/\(bypassed\)/)]);
    expect(notes(out).some((n) => /Invuln \(bypassed\)/.test(n))).toBe(true);
  });

  it("under NP Seal the Armor holds back nothing", async () => {
    const out = await hitOn({ from: "cu-chulainn", sieg: { effects: [{ defId: "npSeal" }] } });
    expect(out.total).toBeGreaterThan(0);
    expect(tier(out)).toEqual([]);
  });
});

describe("Armor of Fafnir, the wound from behind (AF.4.max; ruling 7)", () => {
  it("a hit from behind takes the Health it took off his Max Health too", async () => {
    await withSubjects([
      { from: "siegfried", id: SIEG, panel: { i: 6, j: 6 }, state: { factionId: "A" } },
      { from: "heracles", id: FOE, panel: { i: 7, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: FOE, target: SIEG, react: { [SIEG]: ["nothing", "declined", "declined", "declined"], [FOE]: ["declined", "declined"] } });
      const h = w.actor(SIEG).system.health;
      expect(h.value).toBeLessThan(1500);
      expect(h.max).toBe(h.value);
      // The card names what lowered the maximum.
      const said = w.messages.contents.map((m) => JSON.stringify(m.flags?.fgt?.effects ?? [])).join(" ");
      expect(said).toContain(`Health max 1500 → ${h.max} (Armor of Fafnir`);
    }, WAR);
  });

  it("woundOf: by the Health lost, never below 1", async () => {
    const { woundOf } = await import("../../module/engine/attack.mjs");
    const unit = { health: { value: 300, max: 1500 }, woundsMaxHealth: [{ predicate: ["attack:cone:back"], source: "Armor" }] };
    expect(woundOf(unit, 500, new Set(["attack:cone:back"]))).toMatchObject({ cut: 300, max: 1200 });
    expect(woundOf(unit, 500, new Set(["attack:cone:front"]))).toBeNull();
    expect(woundOf({ ...unit, health: { value: 1500, max: 1500 } }, 2000, new Set(["attack:cone:back"]))).toMatchObject({ cut: 1499, max: 1 });
  });
});

/* ========================================================================== */

describe("Anti-Dragon, one reader (AF.3.def; ruling 5)", () => {
  it("a percent bonus against Dragons is dealt; a Ward against them is taken", () => {
    expect(antiAttributesOf({ key: "dmgUp", direction: "dealt", value: 20, predicate: ["target:attribute:dragon"] }))
      .toEqual({ dealt: ["dragon"], taken: [] });
    expect(antiAttributesOf({ key: "ward", value: 30, predicate: ["self:attribute:dragon"] }))
      .toEqual({ dealt: [], taken: ["dragon"] });
  });

  it("Arturia's Magic Resistance weakness reads the same rule", async () => {
    await withSubjects([{ from: "arturia", id: "arturiaSieg00001" }], ({ unit }) => {
      const a = unit("arturiaSieg00001");
      expect(a.magicResistance.variants[0].attackPredicate).toEqual(["attack:vsAttribute:dragon"]);
    });
  });
});

/* ========================================================================== */

describe("Dragon Slayer (DS.*)", () => {
  it("Ward (Dragon) 30, Dmg Up (Dragon) 60, Atk Up 60/40 on him", async () => {
    await withSubjects([{ from: "siegfried", id: SIEG, state: { factionId: "A" } }], async ({ world: w }) => {
      const out = await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "siegfried-dragon-slayer").id });
      expect(out.ok).toBe(true);
      expect(effectOf(w, SIEG, "wardDragon").system.magnitude).toBe(30);
      expect(effectOf(w, SIEG, "dmgUpDragon").system.magnitude).toBe(60);
      expect(effectOf(w, SIEG, "atkUp").system.magnitude).toBe(60);
      expect(effectOf(w, SIEG, "atkUp").system.npMagnitude).toBe(40);
    }, ON_A);
  });

  it("the Passive's 20 and Dmg Up (Dragon)'s 60 add against a Dragon, NP included", async () => {
    await withSubjects([
      { from: "siegfried", id: SIEG, panel: { i: 6, j: 6 }, state: { factionId: "A" }, effects: [{ defId: "dmgUpDragon", magnitude: 60 }] },
      { from: "siegfried", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { previewContext } = await import("../../module/engine/attack.mjs");
      const { computeDamage } = await import("../../module/rules/damage/pipeline.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const caster = board.units.find((u) => u.id === SIEG);
      const defender = board.units.find((u) => u.id === FOE);
      const out = computeDamage({ ...previewContext({ caster, defender, ability: abilityOf(w, SIEG, "siegfried-balmung"), board, isNP: true, targets: [defender] }), rolls: {} });
      const stage4 = out.breakdown.find((s) => s.index === 4).contributors.map((c) => [c.source, c.value, c.note]);
      // On an NP, at the full figures: Dmg Up takes no reduced magnitude.
      expect(stage4).toEqual([["dmgUp", 20, "Dragon Slayer"], ["dmgUp", 60, "dmgUpDragon"]]);
      const stage3 = out.breakdown.find((s) => s.index === 3).contributors.map((c) => [c.source, c.value]);
      expect(stage3).toEqual([["conditionalMultiplier", 3], ["multiplier", 5]]);
    }, ON_A);
  });
});

describe("Avaricious Gold and Golden Rule (AV.*, GR; ruling 10)", () => {
  it("Rheingold, NP Regen 1 and Atk Up 30/15 on him", async () => {
    await withSubjects([{ from: "siegfried", id: SIEG, state: { factionId: "A" } }], async ({ world: w }) => {
      const out = await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "siegfried-avaricious-gold").id });
      expect(out.ok).toBe(true);
      expect(held(w, SIEG)).toEqual(expect.arrayContaining(["rheingold", "npRegen", "atkUp"]));
      expect(effectOf(w, SIEG, "atkUp").system.npMagnitude).toBe(15);
    }, ON_A);
  });

  it("under Rheingold a Golden Rule success cuts 1◈, not 1 Turn", async () => {
    const { fireEvent, chanceKey } = await import("../../module/engine/scheduler.mjs");
    await withSubjects([{ from: "siegfried", id: SIEG, state: { factionId: "A" }, effects: [{ defId: "rheingold" }] }], async ({ unit, world: w }) => {
      const balmung = abilityOf(w, SIEG, "siegfried-balmung");
      await balmung.update({ "system.cooldown.remaining": 20 });
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const u = currentBoard().units.find((x) => x.id === SIEG) ?? unit(SIEG);
      const intents = fireEvent("damageDealt", [u], {
        tick: 18, turnsPerRound: 3, board: currentBoard(),
        options: new Set(["attack:crit", "self:npOnCooldown"]),
        rolls: { [chanceKey({ kind: "CooldownDelta" }, { id: SIEG })]: 1 },
      });
      const cut = intents.find((i) => i.t === "cooldown");
      expect(cut).toMatchObject({ mode: "reduce", ticks: 3 });
      expect(cut.source).toMatch(/Golden Rule \(rheingold\)/i);
    }, ON_A);
  });
});

describe("the card's words for a landing that changed nothing (#341)", () => {
  it("says not applied, never noop", async () => {
    const { effectLine } = await import("../../module/rules/card-visibility.mjs");
    expect(effectLine({ name: "NP Regen (Balmung)", outcome: "noop", reason: "nothing to count" }))
      .toBe("NP Regen (Balmung): not applied, nothing to count");
    expect(effectLine({ name: "Burn", outcome: "resisted", reason: "rolled 85 vs 50%" })).toBe("Burn: resisted, rolled 85 vs 50%");
  });
});

describe("Balmung (BM.*; ruling 9)", () => {
  const cast = (effects) => async ({ world: w }) => {
    // Cú's Disengage is offered at the Phase's start; he lets the NP land.
    w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
    await playAttack(w, {
      attacker: SIEG, ability: abilityOf(w, SIEG, "siegfried-balmung").id, placement: { direction: "n" },
      react: { [FOE]: ["nothing", "declined", "declined", "declined"], [SIEG]: ["declined", "declined"] },
    });
    return effects;
  };
  const scene = (effects) => [
    { from: "siegfried", id: SIEG, panel: { i: 6, j: 6 }, state: { factionId: "A" }, effects },
    { from: "cu-chulainn", id: FOE, panel: { i: 4, j: 6 }, state: { factionId: "B" } },
  ];

  it("then lands NP Regen (Balmung) at one per Anti-Dragon effect on him", async () => {
    await withSubjects(scene([{ defId: "wardDragon", magnitude: 30 }, { defId: "dmgUpDragon", magnitude: 60 }]), async (ctx) => {
      await cast()(ctx);
      const regen = effectOf(ctx.world, SIEG, "npRegenBalmung");
      expect(regen?.system.magnitude).toBe(2);
      expect(ctx.world.actor(FOE).system.health.value).toBeLessThan(1000);
    }, ON_A);
  });

  it("with none, none lands", async () => {
    await withSubjects(scene([]), async (ctx) => {
      await cast()(ctx);
      expect(held(ctx.world, SIEG)).not.toContain("npRegenBalmung");
      // The card says so, as his own row: his player reads it by name, never
      // as one more effect applied to the defender.
      const rows = ctx.world.messages.contents.flatMap((m) => m.flags?.fgt?.effects ?? []);
      expect(rows).toContainEqual(expect.objectContaining({ id: "npRegenBalmung", outcome: "noop", reason: "nothing to count", unitId: SIEG }));
    }, ON_A);
  });

  it("counts each Anti-Dragon effect once, Passives left out", async () => {
    await withSubjects([{ from: "siegfried", id: SIEG, effects: [{ defId: "wardDragon", magnitude: 30 }, { defId: "dmgUpDragon", magnitude: 60 }, { defId: "atkUp", magnitude: 30 }] }], ({ unit }) => {
      // Dragon Slayer's Passive is Anti-Dragon too, and carries no effect instance.
      expect(countOf({ of: "antiAttributeEffects", attribute: "dragon" }, { self: unit(SIEG) })).toBe(2);
    });
    await withSubjects([{ from: "siegfried", id: SIEG }], ({ unit }) => {
      expect(countOf({ of: "antiAttributeEffects", attribute: "dragon" }, { self: unit(SIEG) })).toBe(0);
    });
  });
});
