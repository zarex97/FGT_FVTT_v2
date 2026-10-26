/**
 * Arturia, audit #230: the 25 readings ruled 2026-10-16, built through the real
 * projection. The Combat Process halves are in `arturia-230-arena.test.mjs`.
 * @see docs/superpowers/specs/2026-10-16-arturia-clauses.md
 */
import { beforeAll, describe, expect, it } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { terrainEffects, isPenalty } from "../../module/rules/terrain.mjs";
import { canToggleMode } from "../../module/rules/modes.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";
import { fireEvent } from "../../module/engine/scheduler.mjs";
import { legalPlacements } from "../../module/rules/targeting/resolve.mjs";
import { contributionsOf } from "../../module/rules/snapshot.mjs";
import { isEmittableOption } from "../../module/rules/options.mjs";
import { Rank } from "../../module/domain/rank.mjs";

beforeAll(prepareSubjects, 120_000);

const ART = "arturiaPendrag01";
const ALLY = "arturiaAlly00001";

const abilityOf = (world, actorId, contentId) =>
  world.actor(actorId).items.find((i) => i.system?.contentId === contentId);

/* ========================================================================== */

describe("the sheet, projected (SB, SB.attr; reading 1)", () => {
  it("Base Attack by the tables, 125 / 200, Health 1250, Round Table and Dragon", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ unit }) => {
      const a = unit(ART);
      expect(a.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 200 }));
      expect(a.maxHealth ?? a.health?.max).toBe(1250);
      expect(a.attributes).toEqual(expect.arrayContaining(["female", "earth", "saberface", "dragon", "king", "roundTable"]));
    });
  });
});

/* ========================================================================== */

describe("Magic Resistance A, and its Anti-Dragon weakness (MR.1, MR.3; reading 21)", () => {
  const hit = (defender, npTags, conditionalMultipliers = []) => {
    // A Rank, as the board projects one: a string would compare as nothing and
    // every threshold would read as "below", which is how this test first passed.
    const attacker = { id: "x", parameters: { mag: Rank.parse("B") }, baseAttack: { mag: 200 }, modifiers: [], effects: [] };
    const attack = { kind: "np", component: "mag", npTags, conditionalMultipliers };
    return computeDamage({
      attacker, defender, attack,
      base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
      rolls: { attackMinus: 0 },
      options: rollOptionsFor({ attacker, defender, attack }),
    });
  };
  const stage11 = (result) => result.breakdown.find((s) => s.index === 11)?.contributors.map((c) => c.note) ?? [];

  it("negates a MAG B attack outright", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ unit }) => {
      expect(stage11(hit(unit(ART), ["antiUnit"]))).toEqual([expect.stringMatching(/^negated: MR A ≥ attack B/)]);
    });
  });

  it("against an Anti-Dragon attack negates only up to C, and cuts 25% past it", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ unit }) => {
      const a = unit(ART);
      expect(a.magicResistance.variants).toEqual([expect.objectContaining({ percent: 25 })]);
      expect(String(a.magicResistance.variants[0].rank)).toBe("C");
      // Anti-Dragon is an attack that deals extra damage to Dragons (#341 ruling 5),
      // Siegfried's Balmung's +200% among them.
      const antiDragon = [{ factor: 3, predicate: ["target:attribute:dragon"], source: "Dragon (+200%)" }];
      expect(stage11(hit(a, ["antiArmy"], antiDragon))).toEqual([expect.stringMatching(/^−25% MAG \(MR C < attack B\)/)]);
      // A tag named after it, which no attack carries, is not.
      expect(stage11(hit(a, ["antiUnit", "antiDragon"]))).toEqual([expect.stringMatching(/^negated: MR A ≥ attack B/)]);
    });
  });
});

/* ========================================================================== */

describe("Vivian's Blessing (VB.1; reading 20)", () => {
  const board = { terrain: { areas: [{ type: "waterside", panels: [{ i: 1, j: 1 }] }] } };

  it("drops Waterside's penalties and keeps its benefits", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ unit }) => {
      const spared = terrainEffects({ ...unit(ART), panel: { i: 1, j: 1 } }, board);
      expect(spared.movDelta).toBe(0);
      expect(spared.evadeDelta).toBe(0);
      expect(spared.modifiers.map((m) => `${m.key}:${m.element}`)).toEqual(["elementAtkUp:water", "elementDefUp:fire"]);
      // Without the blessing, the same panel: MOV -1, Evade +1, four modifiers.
      const plain = terrainEffects({ panel: { i: 1, j: 1 }, attributes: [] }, board);
      expect([plain.movDelta, plain.evadeDelta, plain.modifiers.length]).toEqual([-1, 1, 4]);
    });
  });

  it("knows a penalty from a benefit", () => {
    expect(isPenalty({ kind: "evade", value: 1 })).toBe(true);
    expect(isPenalty({ kind: "evade", value: -2 })).toBe(false);
    expect(isPenalty({ kind: "elementDefDwn", value: 25 })).toBe(true);
    expect(isPenalty({ kind: "elementDefUp", value: 50 })).toBe(false);
  });
});

/* ========================================================================== */

describe("Instinct, and Radiant lending it (IN.*, RR.3; reading 8)", () => {
  it("a 70% automatic Evade, 35% against an NP, and Crit +10; nothing under Skill Seal", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ unit }) => {
      expect(unit(ART).autoSucceeds).toEqual([expect.objectContaining({ check: "evade", chance: 70, chanceWhen: [{ predicate: ["np"], chance: 35 }] })]);
      expect(unit(ART).checkModifiers).toEqual(expect.arrayContaining([expect.objectContaining({ check: "crit", value: 10 })]));
    });
    await withSubjects([{ from: "arturia", id: ART, effects: [{ defId: "skillSeal" }] }], ({ unit }) => {
      expect(unit(ART).autoSucceeds).toEqual([]);
    });
  });

  const party = (artEffects, allyPanel = { i: 5, j: 7 }) => [
    { from: "arturia", id: ART, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: artEffects },
    { from: "medea", id: ALLY, panel: allyPanel, state: { factionId: "A" } },
  ];

  it("an ally within 2 gains both parts, one beyond 2 does not", async () => {
    await withSubjects(party([{ defId: "radiant" }]), ({ unit }) => {
      expect(unit(ALLY).autoSucceeds).toEqual([expect.objectContaining({ check: "evade", chance: 70 })]);
      expect(unit(ALLY).checkModifiers).toEqual(expect.arrayContaining([expect.objectContaining({ check: "crit", value: 10 })]));
    });
    await withSubjects(party([{ defId: "radiant" }], { i: 5, j: 8 }), ({ unit }) => {
      expect(unit(ALLY).autoSucceeds ?? []).toEqual([]);
    });
  });

  it("her Skill Seal stops it for everybody (RR.3.seal)", async () => {
    await withSubjects(party([{ defId: "radiant" }, { defId: "skillSeal" }]), ({ unit }) => {
      expect(unit(ALLY).autoSucceeds ?? []).toEqual([]);
    });
  });
});

/* ========================================================================== */

describe("Charisma B, and Knight of Utopia as Charisma (CH.*, KU.cat; reading 23)", () => {
  const party = (artEffects) => [
    { from: "arturia", id: ART, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: artEffects },
    { from: "medea", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
  ];
  const plus20 = (u) => (u.modifiers ?? []).filter((m) => m.key === "flatDamage" && m.value === 20);

  it("+20 to another ally within 2, and not to herself", async () => {
    await withSubjects(party([]), ({ unit }) => {
      expect(plus20(unit(ALLY))).toHaveLength(1);
      expect(plus20(unit(ART))).toHaveLength(0);
    });
  });

  it("off while she holds Knight of Utopia's Atk Up (Charisma), or is Skill Sealed", async () => {
    await withSubjects(party([{ defId: "atkUpCharismaUnit", magnitude: 30, npMagnitude: 15 }]), ({ unit }) => {
      expect(plus20(unit(ALLY))).toHaveLength(0);
    });
    await withSubjects(party([{ defId: "skillSeal" }]), ({ unit }) => {
      expect(plus20(unit(ALLY))).toHaveLength(0);
    });
  });

  it("Penthesilea's Charisma goes off under the same Atk Up (Charisma) too, by family", async () => {
    await withSubjects([
      { from: "penthesilea", id: ART, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "atkUpCharismaUnit", magnitude: 30 }] },
      { from: "medea", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
    ], ({ unit }) => {
      expect(plus20(unit(ALLY))).toHaveLength(0);
    });
  });
});

/* ========================================================================== */

describe("Invisible Air's switch (IA.lock, IA.start; reading 10)", () => {
  it("starts active, switches on an enemy's Turn, and once per Turn", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ world, unit }) => {
      const ia = abilityOf(world, ART, "arturia-invisible-air");
      expect(ia.system.active).toBe(true);
      const off = canToggleMode(ia, unit(ART), { active: false, tick: 7, ownTurn: false });
      expect(off.ok).toBe(true);
      const again = canToggleMode({ system: { ...ia.system, toggledAt: 7 } }, unit(ART), { active: true, tick: 7, ownTurn: false });
      expect(again).toEqual({ ok: false, reason: "oncePerTurn" });
      expect(canToggleMode({ system: { ...ia.system, toggledAt: 7 } }, unit(ART), { active: true, tick: 8, ownTurn: false }).ok).toBe(true);
    });
  });

  it("switched back on in Round 1: the bar's gate holds no Round against it", async () => {
    // Found live: switched off in Round 1, the bar greyed it "Ready from Round 2"
    // while the sheet's switch went through. "At any time", and she starts the
    // game with it on: no Round gate holds the switch (#230).
    await withSubjects([{ from: "arturia", id: ART }], ({ world, unit }) => {
      const ia = abilityOf(world, ART, "arturia-invisible-air");
      const bar = canUseAbility({ ability: usageSpecFor(ia), unit: unit(ART), master: null, round: 1, turnsPerRound: 3 });
      expect(bar.reason).not.toBe("round");
      expect(bar.ok).toBe(true);
    });
  });

  it("not back on while a lockout runs", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ world, unit }) => {
      const ia = abilityOf(world, ART, "arturia-invisible-air");
      const locked = { system: { ...ia.system, active: false, suspendedUntil: 12 } };
      expect(canToggleMode(locked, unit(ART), { active: true, tick: 10, ownTurn: true })).toEqual({ ok: false, reason: "suspended" });
      expect(canToggleMode(locked, unit(ART), { active: true, tick: 12, ownTurn: true }).ok).toBe(true);
    });
  });

  it("halves a held Crit Dwn while on, and un-halves it when off (IA.2)", async () => {
    await withSubjects([{ from: "arturia", id: ART, effects: [{ defId: "critDwn", magnitude: 30 }] }], async ({ world }) => {
      const crit = () => contributionsOf(world.actor(ART)).checkModifiers
        .filter((m) => m.check === "crit").map((m) => m.value);
      expect(crit()).toEqual(expect.arrayContaining([10, -15]));
      await abilityOf(world, ART, "arturia-invisible-air").update({ "system.active": false });
      expect(crit()).toEqual(expect.arrayContaining([10, -30]));
    });
  });
});

/* ========================================================================== */

describe("Mana Burst on its Cooldown (MB.oncd.*; reading 2)", () => {
  const gate = (item, unit, master) => canUseAbility({
    ability: { ...usageSpecFor(item), cooldown: { remaining: 4, gatedDelay: 0 } }, unit, master, round: 5, turnsPerRound: 3,
  });
  const master = { id: "m", health: { value: 200, max: 250 } };

  it("inside the ZON: usable, the Master pays 20, and nothing else", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ world, unit }) => {
      const mb = abilityOf(world, ART, "arturia-mana-burst");
      const out = gate(mb, { ...unit(ART), outsideZon: false }, master);
      expect(out.ok).toBe(true);
      expect(out.overCooldown).toEqual({ kind: "masterHealth", amount: 20, unitId: "m", id: "overCooldown" });
    });
  });

  it("outside it, or with a Master at 20, refused", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ world, unit }) => {
      const mb = abilityOf(world, ART, "arturia-mana-burst");
      expect(gate(mb, { ...unit(ART), outsideZon: true }, master).reason).toBe("cooldownOutsideZon");
      expect(gate(mb, { ...unit(ART), outsideZon: false }, { id: "m", health: { value: 20, max: 250 } }).reason).toBe("masterHealth");
    });
  });

  it("a Skill with no override is refused on its Cooldown as ever", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ world, unit }) => {
      const drc = abilityOf(world, ART, "arturia-dragons-reactor-core");
      expect(gate(drc, unit(ART), master).reason).toBe("cooldown");
    });
  });
});

/* ========================================================================== */

describe("the vocabulary she asks with", () => {
  it("emits the attack's tags, the ability that made it, and how many of an effect", () => {
    const options = rollOptionsFor({
      attacker: { effects: ["utopiaCount", "utopiaCount", "utopiaCount"] },
      defender: null,
      attack: { kind: "normal", npTags: ["antiDragon"], sourceContentId: "arturia-mana-burst" },
    });
    expect([...options]).toEqual(expect.arrayContaining([
      "attack:tag:antiDragon", "attack:madeWith:arturia-mana-burst",
      "self:effectStacks:utopiaCount:gte:1", "self:effectStacks:utopiaCount:gte:3",
    ]));
    expect(options.has("self:effectStacks:utopiaCount:gte:4")).toBe(false);
    for (const o of ["attack:tag:antiDragon", "attack:madeWith:arturia-mana-burst", "self:effectStacks:utopiaCount:gte:3"]) {
      expect(isEmittableOption(o), o).toBe(true);
    }
  });
});

/* ========================================================================== */

describe("Utopia's cut, per Unit hit (KU.4; reading 7)", () => {
  it("⅓◈ for each Unit the Attack hit, and nothing for none", async () => {
    await withSubjects([{ from: "arturia", id: ART, effects: [{ defId: "utopia" }] }], ({ unit, board }) => {
      const cut = (unitsHit) => fireEvent("attackPerformed", [unit(ART)], {
        tick: 3, turnsPerRound: 3, board, options: new Set(["attack:kind:normal", "attack:performed"]),
        event: { unitsHit }, rolls: {},
      }).filter((i) => i.t === "cooldown");
      // Her four Noble Phantasms (Invisible Air, Strike Air, Excalibur, Avalon),
      // three Units: 3 ticks off each.
      expect(cut(3).map((i) => [i.ticks, i.mode])).toEqual([[3, "reduce"], [3, "reduce"], [3, "reduce"], [3, "reduce"]]);
      expect(cut(0)).toEqual([]);
    });
  });
});

/* ========================================================================== */

describe("Excalibur's area (EX.area; reading 13)", () => {
  it("offers both turns in each direction, and the 6-wide one in two placements", async () => {
    await withSubjects([{ from: "arturia", id: ART, panel: { i: 6, j: 6 } }], ({ world, unit, board }) => {
      const spec = abilityOf(world, ART, "arturia-excalibur").system.targeting;
      const north = legalPlacements(spec, unit(ART), { ...board, bounds: { iMin: 0, iMax: 12, jMin: 0, jMax: 12 } })
        .filter((p) => p.placement.direction === "n");
      expect(north.map((p) => p.placement)).toEqual([
        { direction: "n" },
        { direction: "n", transverse: true, shift: 0 },
        { direction: "n", transverse: true, shift: 1 },
      ]);
      const cols = (p) => [...new Set(p.resolved.panels.map((x) => x.j))].sort((a, b) => a - b);
      const rows = (p) => [...new Set(p.resolved.panels.map((x) => x.i))].sort((a, b) => a - b);
      expect([cols(north[0]), rows(north[0])]).toEqual([[5, 6, 7], [0, 1, 2, 3, 4, 5]]);
      expect([cols(north[1]), rows(north[1])]).toEqual([[3, 4, 5, 6, 7, 8], [3, 4, 5]]);
      expect(cols(north[2])).toEqual([4, 5, 6, 7, 8, 9]);
    });
  });
});

/* ========================================================================== */

describe("Excalibur's passive (EX.p; reading 12)", () => {
  const strike = (attacker, defender, attack, roll) => computeDamage({
    attacker, defender, attack: { component: "str", ...attack },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    rolls: { attackMinus: 0, "chance:excaliburPassive": roll },
    options: rollOptionsFor({ attacker, defender, attack }),
  }).breakdown.find((s) => s.index === 7)?.contributors.filter((c) => c.source === "flatDamage").map((c) => c.value) ?? [];

  it("with Invisible Air off, a plain Normal Attack adds 25 Light on a 50, 50 against Dark", async () => {
    await withSubjects([{ from: "arturia", id: ART }], async ({ world }) => {
      await abilityOf(world, ART, "arturia-invisible-air").update({ "system.active": false });
      const { unitOf, currentBoard } = await import("../../module/engine/board.mjs");
      const a = unitOf(world.actor(ART), currentBoard());
      const plain = { id: "d", health: 999, modifiers: [], effects: [], attributes: [] };
      const dark = { ...plain, attributes: ["dark"] };
      expect(strike(a, plain, { kind: "normal" }, 50)).toEqual([25]);
      expect(strike(a, plain, { kind: "normal" }, 51)).toEqual([0]);
      expect(strike(a, dark, { kind: "normal" }, 10)).toEqual([50]);
      // Not a Mana Burst, not a Riding Attack.
      expect(strike(a, plain, { kind: "normal", sourceContentId: "arturia-mana-burst", asNormalAttack: true }, 10)).toEqual([]);
      expect(strike(a, plain, { kind: "normal", ride: { distance: 3 } }, 10)).toEqual([]);
    });
  });

  it("files its 50% die on the card when it lands (live)", async () => {
    // Found live: a Counter added "Excalibur (light) 25" and the die that won it
    // was in no roll log; only a MISSED die said "rolled 51 vs 50%".
    await withSubjects([{ from: "arturia", id: ART }], async ({ world }) => {
      await abilityOf(world, ART, "arturia-invisible-air").update({ "system.active": false });
      const { unitOf, currentBoard } = await import("../../module/engine/board.mjs");
      const { modifierDiceRecords } = await import("../../module/rules/roll-log.mjs");
      const a = unitOf(world.actor(ART), currentBoard());
      const plain = { id: "d", health: 999, modifiers: [], effects: [], attributes: [] };
      const attack = { component: "str", kind: "normal" };
      const ctx = {
        attacker: a, defender: plain, attack,
        base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
        rolls: { attackMinus: 0, "chance:excaliburPassive": 40 },
        options: rollOptionsFor({ attacker: a, defender: plain, attack }),
      };
      const records = modifierDiceRecords(ctx, computeDamage(ctx), { attackerId: ART, defenderId: "d" }, 1);
      expect(records).toEqual([expect.objectContaining({ total: 40, formula: "1d100" })]);
      expect(records[0].purpose).toMatch(/Excalibur/);
      expect(records[0].modifiers.map((m) => m.source)).toEqual(["against 50%"]);
    });
  });

  it("with Invisible Air on, nothing", async () => {
    await withSubjects([{ from: "arturia", id: ART }], ({ unit }) => {
      const plain = { id: "d", health: 999, modifiers: [], effects: [], attributes: [] };
      expect(strike(unit(ART), plain, { kind: "normal" }, 10)).toEqual([]);
    });
  });
});

/* ========================================================================== */

describe("DRC leaves out Mana Burst (DRC.3.mb; reading 25)", () => {
  it("+25 on a Normal Attack and a Riding Attack, not on a Mana Burst", async () => {
    await withSubjects([{ from: "arturia", id: ART, effects: [{ defId: "drc" }] }], ({ unit }) => {
      const pct = (attack) => {
        const attacker = unit(ART);
        const defender = { id: "d", health: 999, modifiers: [], effects: [] };
        return computeDamage({
          attacker, defender, attack: { component: "str", ...attack },
          base: { sources: [{ unit: "self", component: "str", factor: 1 }] }, rolls: { attackMinus: 0 },
          options: rollOptionsFor({ attacker, defender, attack }),
        }).breakdown.find((s) => s.index === 4)?.contributors.filter((c) => c.note === "drc").map((c) => c.value) ?? [];
      };
      expect(pct({ kind: "normal" })).toEqual([25]);
      expect(pct({ kind: "normal", ride: { distance: 2 } })).toEqual([25]);
      expect(pct({ kind: "normal", sourceContentId: "arturia-mana-burst", asNormalAttack: true })).toEqual([]);
    });
  });
});

/* ========================================================================== */

describe("a prevention says its effect's name (live)", () => {
  // Found live: the Master's Avalon slot read "prevented by itemRite".
  it("names Item Rite, not its id", async () => {
    await withSubjects([{ from: "arturia", id: ART, effects: [{ defId: "itemRite" }] }], async ({ unit }) => {
      const { canConsume, emptyBudget, maxima } = await import("../../module/rules/budget.mjs");
      const out = canConsume(emptyBudget(maxima ? maxima() : undefined), unit(ART), "attack");
      expect(out.ok).toBe(false);
      expect(out.reason).toBe("prevented by Item Rite");
    });
  });
});
