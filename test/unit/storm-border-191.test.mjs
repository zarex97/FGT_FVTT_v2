/**
 * @file The Storm Border's inside, its separation and its way out (#191).
 * @see char_orig_sheets/Copia de Nemo.md, docs/27-platforms-and-levels.md
 *
 * The rulings of 2026-10-10 that live outside `engine/dimension.mjs`'s pure
 * half: nothing crosses in or out (reading 3, #178), the 5x5 holds a walk
 * (reading 3), the Resurface control is offered to its owner (reading 5), and
 * Quickfire deals one hit per success (reading 10).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { crossLevelLegal, dimensionOf } from "../../module/rules/platforms.mjs";
import { canStopOn } from "../../module/rules/movement.mjs";
import { availableActions } from "../../module/rules/actions.mjs";
import { computeDamageHits } from "../../module/rules/damage/pipeline.mjs";
import { landingOptions } from "../../module/engine/dimension.mjs";

const SPEC = parse(readFileSync("packs/_source/platforms/storm-border.yml", "utf8")).dimension;
const at = (i, j) => ({ i, j });

const DIM = {
  id: "sb", contentId: "platform-storm-border", ownerId: "nemo", levelId: "lvlSB",
  spec: SPEC, centre: at(5, 5), plan: null, activatedAt: 10, factionId: "red",
};
const nemo = { id: "nemo", kind: "servant", factionId: "red", panel: at(5, 5), level: 20, levelId: "lvlSB", range: 3 };
const inside = { id: "ally", kind: "servant", factionId: "red", panel: at(6, 5), level: 20, levelId: "lvlSB", range: 1 };
const ground = { id: "karna", kind: "servant", factionId: "blue", panel: at(5, 7), level: 0, levelId: "lvlG", range: 3 };
const BOARD = {
  units: [nemo, inside, ground], dimensions: [DIM], bounds: { iMin: 0, iMax: 20, jMin: 0, jMax: 20 },
};

describe("nothing crosses in or out of the Storm Border (#191 reading 3, #178)", () => {
  it("knows who is inside by Level", () => {
    expect(dimensionOf(nemo, BOARD)?.id).toBe("sb");
    expect(dimensionOf(ground, BOARD)).toBeNull();
  });

  it("refuses an Attack from the ground onto a Unit inside", () => {
    expect(crossLevelLegal(ground, nemo, BOARD)).toEqual({ ok: false, reason: "otherDimension" });
  });

  it("refuses an area from the ground that only catches one", () => {
    expect(crossLevelLegal(ground, nemo, BOARD, { area: true }).ok).toBe(false);
  });

  it("refuses an Attack from inside onto the ground", () => {
    expect(crossLevelLegal(nemo, ground, BOARD)).toEqual({ ok: false, reason: "otherDimension" });
  });

  it("refuses a buff from outside too, not only an Attack", () => {
    const groundAlly = { ...ground, factionId: "red" };
    expect(crossLevelLegal(groundAlly, nemo, BOARD, { reach: "effect" }).ok).toBe(false);
  });

  it("lets two Units inside reach each other", () => {
    expect(crossLevelLegal(nemo, inside, BOARD).ok).toBe(true);
  });
});

describe("the 5x5 holds a walk (#191 reading 3)", () => {
  it("lets a Unit inside stop anywhere in it", () => {
    expect(canStopOn(at(7, 7), inside, BOARD)).toBe(true);
    expect(canStopOn(at(3, 3), inside, BOARD)).toBe(true);
  });

  it("refuses a panel past its edge", () => {
    expect(canStopOn(at(8, 5), inside, BOARD)).toBe(false);
  });

  it("does not hold a Unit on the ground", () => {
    expect(canStopOn(at(12, 12), ground, BOARD)).toBe(true);
  });
});

describe("the Resurface control (#191 reading 5)", () => {
  const ids = (unit, board = BOARD) => availableActions(unit, board).map((a) => a.id);

  it("is on Nemo's bar while he is submerged", () => {
    const entry = availableActions(nemo, BOARD).find((a) => a.id === "resurface");
    expect(entry.context).toMatchObject({ platformId: "sb", on: false });
  });

  it("shows pressed once a resurface is planned", () => {
    const board = { ...BOARD, dimensions: [{ ...DIM, plan: { at: at(9, 9), orientation: "r0" } }] };
    expect(availableActions(nemo, board).find((a) => a.id === "resurface").context.on).toBe(true);
  });

  it("is on nobody else's", () => {
    expect(ids(inside)).not.toContain("resurface");
    expect(ids(ground)).not.toContain("resurface");
  });

  it("is gone once he is defeated", () => {
    expect(ids({ ...nemo, defeated: true })).not.toContain("resurface");
  });
});

describe("what the Resurface control offers", () => {
  it("offers spots within the allowance at the next Turn End, and no further", () => {
    // Three Turns inside at three a Round: 2 + 3 = 5 panels.
    const options = landingOptions(DIM, BOARD, { now: 13, turnsPerRound: 3 });
    const far = Math.max(...options.map((o) => Math.max(Math.abs(o.at.i - 5), Math.abs(o.at.j - 5))));
    expect(far).toBe(5);
  });

  it("offers all eight orientations on an empty board", () => {
    const options = landingOptions(DIM, BOARD, { now: 13, turnsPerRound: 3 });
    expect(options.find((o) => o.at.i === 10 && o.at.j === 10)?.orientations).toHaveLength(8);
  });
});

describe("Quickfire: one hit per success (#191 reading 10)", () => {
  const base = { diceTotal: 75, successes: 3, diceRolled: 6, threshold: 5 };
  const ctx = (defender = {}) => ({
    attacker: { id: "nemo", modifiers: [] },
    defender: { id: "x", health: 1000, modifiers: [], ...defender },
    board: {},
    attack: { component: "str", bypassModifiers: { attacker: true, defender: false } },
    base,
    crit: { isCrit: false },
    rolls: {},
    options: new Set(),
  });

  it("deals the same total as one hit when nothing is met per hit", () => {
    expect(computeDamageHits(ctx()).total).toBe(75);
    expect(computeDamageHits(ctx()).hits).toHaveLength(3);
  });

  it("empties a Shield across the hits rather than three times over", () => {
    const out = computeDamageHits(ctx({ shield: 40 }));
    expect(out.flags.shieldAbsorbed).toBe(40);
    expect(out.total).toBe(35);
  });

  it("meets Freeze's 150 with every 25", () => {
    const frozen = ctx({ effects: ["freeze"] });
    const out = computeDamageHits(frozen);
    const one = computeDamageHits({ ...frozen, base: { ...base, successes: 1, diceTotal: 200 } });
    // A single 200 breaks the ice; three 25s do nothing.
    expect(one.total).toBeGreaterThan(0);
    expect(out.total).toBe(0);
  });

  it("leaves every other attack one hit", () => {
    const one = computeDamageHits({ ...ctx(), base: { ...base, successes: 1, diceTotal: 25 } });
    expect(one.hits).toBeUndefined();
    expect(one.total).toBe(25);
  });
});

describe("no Attack± on a figure, one ZON penalty (#191 reading 14)", () => {
  const base = { diceTotal: 150, successes: 6, diceRolled: 6, threshold: 5 };
  const ctx = (over = {}) => ({
    attacker: { id: "nemo", modifiers: [] },
    defender: { id: "x", health: 1000, modifiers: [] },
    board: {},
    attack: { component: "str", bypassModifiers: { attacker: true, defender: false } },
    base,
    crit: { isCrit: false },
    rolls: { attackMinus: 27, attackPlus: 30 },
    options: new Set(),
    ...over,
  });

  it("rolls no 5d10 against Quickfire's 25s, crit or not", () => {
    expect(computeDamageHits(ctx()).total).toBe(150);
    expect(computeDamageHits(ctx({ crit: { isCrit: true } })).total).toBe(150);
  });

  it("rolls no 5d10 against Barrel Bombing's flat 150", () => {
    const out = computeDamageHits(ctx({ base: { fixedValue: 150 } }));
    expect(out.total).toBe(150);
  });

  it("takes the ZON penalty once off Quickfire's total, carried hit to hit", () => {
    const out = computeDamageHits(ctx({
      attacker: { id: "nemo", modifiers: [], outsideZon: true },
      rolls: { zonPenalty: 30 },
    }));
    expect(out.total).toBe(120);
    expect(out.hits.map((h) => h.total)).toEqual([0, 20, 25, 25, 25, 25]);
  });

  it("still takes the ZON penalty off Barrel Bombing", () => {
    const out = computeDamageHits(ctx({
      attacker: { id: "nemo", modifiers: [], outsideZon: true },
      base: { fixedValue: 150 },
      rolls: { zonPenalty: 30 },
    }));
    expect(out.total).toBe(120);
  });
});

describe("Imaginary Numbers Space is terrain inside (#191)", async () => {
  const { annotateTerrain } = await import("../../module/rules/terrain.mjs");
  const { rollOptionsFor } = await import("../../module/rules/options.mjs");

  it("gives everyone inside the dimension's terrain, and nobody outside", () => {
    const units = [{ ...nemo }, { ...ground }];
    annotateTerrain(units, { ...BOARD, units, terrain: {} });
    expect(rollOptionsFor({ attacker: units[0] }).has("self:terrain:imaginaryNumbers")).toBe(true);
    expect(rollOptionsFor({ attacker: units[1] }).has("self:terrain:imaginaryNumbers")).toBe(false);
  });
});

describe("a rider's chance is one die (#191)", () => {
  const run = async (roll) => {
    const { withSubjects } = await import("../helpers/subject.mjs");
    const { fireEvent, pendingRolls } = await import("../../module/engine/scheduler.mjs");
    return withSubjects([
      { from: "nemo", panel: at(5, 5), state: { factionId: "red" } },
      { from: "karna", panel: at(5, 7), state: { factionId: "blue" } },
    ], ({ unit, board }) => {
      const nemoUnit = unit("nemo");
      const rolls = Object.fromEntries(pendingRolls(nemoUnit, "damageDealt").map((r) => [r.key, roll]));
      return fireEvent("damageDealt", [nemoUnit], {
        tick: 7, turnsPerRound: 3, board, options: new Set(["attack:kind:normal"]),
        victim: { unitId: "karna" }, rolls,
      }).filter((i) => i.t === "applyEffect");
    });
  };

  it("hands the die the card shows to the application", { timeout: 60_000 }, async () => {
    const applied = await run(1);
    expect(applied).toHaveLength(1);
    expect(applied[0].effect).toMatchObject({ defId: "slow", chance: 10, rolled: 1 });
  });

  it("leaves the verdict to the application, on that same die", { timeout: 60_000 }, async () => {
    const applied = await run(50);
    expect(applied[0].effect.rolled).toBe(50);
  });
});

describe("Quickfire's Evade is not rolled, so nothing rescues it (#191)", async () => {
  const { TRANSITIONS } = await import("../../module/engine/combat-process.mjs");
  it("goes straight to damage — no Lucky Evasion, no escape", () => {
    expect(TRANSITIONS["evadeRoll:overridden"]).toBe("damage");
  });
});

describe("a rider listed before the damage says when it runs (#191)", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  it("no Ability leaves an effect phase before its damage without `when`", () => {
    const loose = [];
    for (const dir of ["packs/_source/abilities", "packs/_source/class-skills"]) {
      for (const f of fs.readdirSync(dir)) {
        const d = parse(fs.readFileSync(path.join(dir, f), "utf8"));
        const phases = d?.phases ?? [];
        const at = phases.findIndex((p) => p.kind === "damage");
        if (at < 0) continue;
        if (phases.slice(0, at).some((p) => ["applyEffects", "applyEffect"].includes(p.kind) && !p.when)) loose.push(f);
      }
    }
    // Unstated means AFTER the damage, so the list's order alone does nothing:
    // Great Ram's NP DmUp and Snegleta's Def Dwn (A) both missed their own hit.
    expect(loose).toEqual([]);
  });
});

describe("what the Storm Border forbids inside (ruling R1, #191)", () => {
  it("stamps the refusal on a Unit inside, and not on one outside", { timeout: 60_000 }, async () => {
    const { withSubjects } = await import("../helpers/subject.mjs");
    const { snapshotBoard } = await import("../../module/rules/snapshot.mjs");
    await withSubjects([
      { from: "nemo", panel: at(5, 5), state: { factionId: "red" } },
    ], ({ units }) => {
      const project = (levelId) => snapshotBoard({
        scene: null,
        actors: [{ snapshot: { ...units[0], levelId, suppressions: [] } }],
        settings: { dimensions: [{ ...DIM, centre: at(5, 5) }] },
      }).units[0];
      const creating = (u) => (u.suppressions ?? []).filter((x) => x.scope === "creating").flatMap((x) => x.attributes);
      expect(creating(project("lvlSB"))).toEqual(["large", "giant"]);
      expect(creating(project("ground"))).toEqual([]);
    });
  });
});

describe("Indomited hears the revival it names (#191)", () => {
  it("projects its unitRevived handler, and pays on revival:source:guts", { timeout: 60_000 }, async () => {
    const { withSubjects } = await import("../helpers/subject.mjs");
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    await withSubjects([
      { from: "nemo", panel: at(5, 5), state: { factionId: "red" }, effects: [{ defId: "indomited", uses: 1, expiry: 99 }] },
    ], ({ unit, board }) => {
      const nemoUnit = unit("nemo");
      expect((nemoUnit.eventHandlers ?? []).some((h) => [h.event, h.events].flat().includes("unitRevived"))).toBe(true);
      const paid = fireEvent("unitRevived", [nemoUnit], {
        tick: 7, turnsPerRound: 3, board, options: new Set(["revival:source:guts"]), rolls: {},
      });
      expect(paid.some((i) => i.t === "cooldown")).toBe(true);
      const other = fireEvent("unitRevived", [nemoUnit], {
        tick: 7, turnsPerRound: 3, board, options: new Set(["revival:source:battleContinuation"]), rolls: {},
      });
      expect(other.some((i) => i.t === "cooldown")).toBe(false);
    });
  });
});
