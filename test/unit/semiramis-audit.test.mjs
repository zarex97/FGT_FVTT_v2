/**
 * @file Clauses the Semiramis audit (#68) found authored wrong.
 * @see char_orig_sheets/Copia de Semiramis.md, docs/46-roster-re-audit.md
 */

import { describe, it, expect } from "vitest";
import { effectDef } from "../helpers/effect-defs.mjs";

describe("Scales of the Sacred Fish's Shield", () => {
  // *"the Unit gains the Shield (200) buff for 2◈ Turns"* -- a buff, and
  // Appendix A's `Shield (X)` is an ordinary one. The file said `unremovable`,
  // copied from Rho Aias's marker, so no buff removal could touch it.
  it("is a buff that buff removal can take", () => {
    expect(effectDef("scalesShield")).toMatchObject({ polarity: "buff" });
    expect(effectDef("scalesShield").unremovable).toBeFalsy();
  });
});

// The Hanging Gardens' own rules, which its file recorded as UNMODELLED: *"The
// HGoB cannot be affected by buffs and/or debuffs"* and *"cannot Evade, Block,
// and Counter; and cannot be Countered"*. Now authored, on the platform's own
// `rules`, and read through the real executors.
describe("the Hanging Gardens, the Unit", async () => {
  const { readFileSync } = await import("node:fs");
  const { parse } = await import("yaml");
  const { collectContributions } = await import("../../module/rules/elements.mjs");
  const { applyEffect } = await import("../../module/engine/effect-applier.mjs");
  const { crossLevelLegal } = await import("../../module/rules/platforms.mjs");
  const hgob = parse(readFileSync("packs/_source/platforms/hanging-gardens.yml", "utf8"));
  const own = collectContributions([{ name: hgob.name, active: true, rules: hgob.rules }]);
  const land = (id, polarity) => applyEffect({
    def: { ...effectDef(id), id, polarity },
    target: { id: "hgob", effects: [], effectInstances: [], immunities: own.immunities },
    source: {}, ctx: { turnsPerRound: 3, currentTick: 0, roll: 1, options: new Set() },
  }).outcome;

  it("cannot be affected by a buff or a debuff", () => {
    expect(land("atkUp", "buff")).toBe("blocked");
    expect(land("slow", "debuff")).toBe("blocked");
    expect(land("instakill", "debuff")).toBe("blocked");
  });

  it("cannot Evade, Block or Counter, and cannot be Countered", () => {
    expect(own.forbiddenReactions.sort()).toEqual(["block", "counter", "evade"]);
    expect(own.refusesReactions).toEqual(["counter"]);
  });

  // *"Enemy Units on the ground ... may only Attack the HGoB itself, with
  // ranged Attacks."* A target that IS the platform was waved through at any
  // reach.
  it("can be attacked from the ground only at range", () => {
    const platform = { id: "hgob", kind: "platform", level: 20, panel: { i: 0, j: 0 }, footprint: { w: 9, h: 9 }, crossLevel: hgob.crossLevel };
    const board = { units: [platform] };
    const at = (range) => crossLevelLegal({ id: "e", level: 0, range, panel: { i: 10, j: 10 } }, platform, board).ok;
    expect(at(1)).toBe(false);
    expect(at(3)).toBe(true);
  });
});

// *"If a Unit attempts to board the HGoB on the same Turn it was Attacked by
// Dragon Wing Warriors, the required roll is reduced by 2."* `boardingTarget`
// took a `hitByDragonWingWarriors` flag and nothing ever passed it: no record
// said which ability had attacked a Unit, and the Board button asked nothing.
describe("boarding after Dragon Wing Warriors", async () => {
  const { readFileSync } = await import("node:fs");
  const { parse } = await import("yaml");
  const { TURN_RECORD } = await import("../../module/domain/stamped-record.mjs");
  const { attackedByReliefApplies } = await import("../../module/rules/platforms.mjs");
  const hgob = parse(readFileSync("packs/_source/platforms/hanging-gardens.yml", "utf8"));

  it("is remembered per Turn: the record carries which abilities attacked the Unit", () => {
    expect(TURN_RECORD.at({ tick: 5, attackedBy: ["semiramis-hgob-dragon-wing-warriors"] }, 5).attackedBy)
      .toEqual(["semiramis-hgob-dragon-wing-warriors"]);
    expect(TURN_RECORD.at({ tick: 4, attackedBy: ["semiramis-hgob-dragon-wing-warriors"] }, 5).attackedBy).toEqual([]);
  });

  it("relieves the roll for a Unit that Dragon Wing Warriors attacked, and for no other attack", () => {
    expect(attackedByReliefApplies(["semiramis-hgob-dragon-wing-warriors"], hgob)).toBe(true);
    expect(attackedByReliefApplies(["semiramis-hgob-aerial-garden-of-vanity"], hgob)).toBe(false);
    expect(attackedByReliefApplies([], hgob)).toBe(false);
  });
});

// *"A Bašmu can only Move/Attack once per Turn"* -- a cap on top of the
// per-unit limit, not a replacement for it. Ch. 19: exempt units *"still obey
// their per-unit limits"*, and one of those is that a Unit that has attacked
// cannot Move again. The once-per-Turn branch returned before that guard, so a
// Bašmu that had just attacked was offered, and allowed, a Move.
describe("a Bašmu that has attacked", async () => {
  const { canConsume, emptyBudget } = await import("../../module/rules/budget.mjs");
  const basmu = (turnState) => ({ id: "b", kind: "summon", actsOncePerTurn: true, turnState });

  it("cannot Move afterwards", () => {
    const v = canConsume(emptyBudget(), basmu({ attacked: true }), "move");
    expect(v).toMatchObject({ ok: false, reason: "this unit has attacked and cannot move again" });
  });

  it("can still Attack after a Move, once, and spends no pool", () => {
    expect(canConsume(emptyBudget(), basmu({ moved: true }), "attack")).toMatchObject({ ok: true, pool: null });
    expect(canConsume(emptyBudget(), basmu({ moved: true, attacked: true }), "attack").ok).toBe(false);
  });

  it("and the Hanging Gardens, a platform, is held the same way", () => {
    const hgob = { id: "p", kind: "platform", turnState: { attacked: true } };
    expect(canConsume(emptyBudget(), hgob, "move").ok).toBe(false);
  });
});

// *"During Semiramis' Turn, the HGoB can Move/Attack once per Turn."* The cap
// reads the platform's Turn Record, and `PlatformData` declared none: every
// `system.turnState` write to the garden was dropped by the model, so the cap
// read a blank record forever. Found live -- the garden Moved by drag and the
// bar offered it Move, Dragon Wing Warriors and Aerial Garden of Vanity again.
describe("the Hanging Gardens' Turn Record", async () => {
  const { keptByModel } = await import("../helpers/world.mjs");

  it("is kept by the platform's model", async () => {
    const kept = await keptByModel("Actor", {
      name: "Hanging Gardens of Babylon", type: "platform",
      system: { turnState: { tick: 54, acted: true, moved: true, movedPanels: 1 } },
    });
    expect(kept.system.turnState).toMatchObject({ tick: 54, moved: true, movedPanels: 1 });
  });
});
