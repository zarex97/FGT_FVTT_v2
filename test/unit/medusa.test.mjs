/**
 * @file Medusa — the rulings of her audit (#188).
 * @see char_orig_sheets/Copia de Medusa.md, docs/46-roster-re-audit.md §46.20
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";
import { haltIndex } from "../../module/rules/bounded-fields.mjs";
import { splitPool, distributePool } from "../../module/rules/fields/pool.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

const src = (dir, file) =>
  parse(readFileSync(join(process.cwd(), "packs/_source", dir, file), "utf8"));

const at = (i, j) => ({ i, j });
const unit = (id, i, j, over = {}) =>
  ({ id, name: id, panel: at(i, j), kind: "servant", faction: "b", factionId: "b", attributes: [], effects: [], ...over });

describe("Bellerophon hits everyone on its line (#188 reading 11)", () => {
  // "Hits a 1x13 or 13x1 panel area" names no relation. EMIYA's Caladbolg II
  // is the precedent: an area that names nobody catches everybody in it.
  const np = src("abilities", "medusa-bellerophon.yml");
  const medusa = unit("medusa", 6, 0, { faction: "a", factionId: "a", range: 2 });
  const board = (units) => ({ bounds: squareBounds(13), units, alliances: { a: ["a"], b: ["b"] } });

  it("takes her own Master and an enemy alike, and never Medusa", () => {
    const master = unit("master", 6, 3, { kind: "master", faction: "a", factionId: "a" });
    const foe = unit("foe", 6, 8);
    const r = resolveTargets(np.targeting, medusa, board([medusa, master, foe]), { direction: "e" });
    expect(r.units.map((u) => u.unitId).sort()).toEqual(["foe", "master"]);
  });
});

describe("a Civilian crossing Blood Fort Andromeda stops on its first panel inside (#188 reading 9)", () => {
  // "Normal Human: Immediately dies." Ruled: on the first panel inside, the
  // move stopping there.
  const np = src("abilities", "medusa-blood-fort-andromeda.yml");
  const panels = [];
  for (let i = 2; i <= 6; i++) for (let j = 2; j <= 6; j++) panels.push(at(i, j));
  const fort = {
    id: "medusa-blood-fort-andromeda", ownerId: "medusa", ownerMasterId: "master",
    geometry: { kind: "markDefined" }, panels, interiorEvents: np.field.interiorEvents,
  };
  const medusa = unit("medusa", 0, 0, { faction: "a", factionId: "a" });
  const board = (mover) => ({
    bounds: squareBounds(13), fields: [fort], units: [medusa, mover], alliances: { a: ["a"], b: ["b"] },
  });
  const walk = [at(4, 0), at(4, 1), at(4, 2), at(4, 3), at(4, 4)];

  it("cuts a Civilian's walk at the first panel inside", () => {
    const civ = unit("civ", 4, -1, { kind: "civilian", faction: null, factionId: null });
    expect(haltIndex(walk, civ, board(civ))).toBe(2);
  });

  it("lets a Servant walk through — the tier is the Civilian's", () => {
    const foe = unit("foe", 4, -1);
    expect(haltIndex(walk, foe, board(foe))).toBe(null);
  });

  it("stops nothing that started inside", () => {
    const civ = unit("civ", 4, 2, { kind: "civilian", faction: null, factionId: null });
    expect(haltIndex([at(4, 3), at(4, 4)], civ, board(civ))).toBe(null);
  });
});

describe("the drain, divided by her player (#188 reading 2)", () => {
  const two = [{ unitId: "medusa" }, { unitId: "master" }];

  it("pays the first what was chosen and the second the rest", () => {
    expect(splitPool(60, two, 45)).toEqual([{ unitId: "medusa", amount: 45 }, { unitId: "master", amount: 15 }]);
  });

  it("may give it all to either", () => {
    expect(splitPool(60, two, 0)).toEqual([{ unitId: "master", amount: 60 }]);
    expect(splitPool(60, two, 60)).toEqual([{ unitId: "medusa", amount: 60 }]);
  });

  it("never pays more than was drained", () => {
    expect(splitPool(60, two, 500)).toEqual([{ unitId: "medusa", amount: 60 }]);
    expect(splitPool(60, two, -5)).toEqual([{ unitId: "master", amount: 60 }]);
  });

  it("is the even split when nobody answers", () => {
    expect(splitPool(61, two, null)).toEqual(distributePool(61, two));
    expect(distributePool(61, two)).toEqual([{ unitId: "medusa", amount: 31 }, { unitId: "master", amount: 30 }]);
  });
});

describe("what a Skill's card says (#188)", () => {
  // Live: the Eyes read "No effects were applied" over an Agility Check that
  // took 2 Agility, and Blood Temple read "NP Regen" over a 2-Turn cut.
  it("words a check and a cooldown change", async () => {
    const { checkLine, cooldownLine } = await import("../../module/engine/skill-use.mjs");
    expect(checkLine("Agility Check", "agility", { total: 3, target: 18, success: true })).toBe("Agility Check 3 vs 18: success");
    expect(checkLine("FGT.CheckRoll.foo", "foo", { total: 9, target: 4, success: false })).toBe("foo 9 vs 4: failure");
    expect(cooldownLine("Bellerophon", 22, 20)).toBe("Bellerophon: Cooldown 22 → 20");
    // A cut on an ability already ready changed nothing, and prints nothing.
    expect(cooldownLine("Blood Fort Andromeda", 0, 0)).toBe(null);
  });

  it("puts the check, the stat change and the cooldown on the card's rows", async () => {
    const { readFileSync } = await import("node:fs");
    const attack = readFileSync("module/engine/attack.mjs", "utf8");
    expect(attack).toMatch(/id: "check", name: checkLine\(/);
    expect(attack).toMatch(/summary: \{ id: "statChange", name: line/);
    const skill = readFileSync("module/engine/skill-use.mjs", "utf8");
    expect(skill).toMatch(/summary: \{ id: "cooldown", name: line/);
  });

  it("names an exclusion's partner, not its content id", async () => {
    const { abilityState, abilityNamesOf } = await import("../../module/apps/actor-sheet/present.mjs");
    const actor = { items: [{ id: "i1", name: "Monstrous Strength", system: { contentId: "medusa-monstrous-strength" } }] };
    const verdict = { ok: false, reason: "sameTurnExclusive", detail: { partner: "medusa-monstrous-strength" } };
    expect(abilityState(verdict, { nameOf: abilityNamesOf(actor) }).detail.partner).toBe("Monstrous Strength");
    expect(abilityState(verdict).detail.partner).toBe("medusa-monstrous-strength");
  });
});

describe("a Structure under attack (#188)", () => {
  it("answers no rung: no reaction, no Luck, no escape", async () => {
    const process = await import("../../module/engine/combat-process.mjs");
    expect(process.inertAnswer({ state: "react", defenderInert: true })).toBe("nothing");
    expect(process.inertAnswer({ state: "s23_acceptOrEscape", defenderInert: true })).toBe("accept");
    expect(process.inertAnswer({ state: "s22_duContest", defenderInert: true })).toBe("declined");
    expect(process.inertAnswer({ state: "s21_luckyHit", defenderInert: true })).toBe(null);
    expect(process.inertAnswer({ state: "react" })).toBe(null);
    expect(process.pendingPrompt({ state: "react", defenderInert: true, defenderId: "m", attackerId: "a" })).toBe(null);
    expect(process.pendingPrompt({ state: "react", defenderId: "m", attackerId: "a" })).not.toBe(null);
  });

  it("has the Health it was authored with, so a Master's Attack can break it", async () => {
    // `baseHealth: 1` and no derivation: Health stayed null, which the damage
    // pipeline reads as invulnerable by nature -- live, a Master's swing dealt 0.
    await prepareSubjects();
    await withSubjects([{ from: "bloodmark", id: "mark", panel: { i: 5, j: 5 } }], ({ board }) => {
      const mark = board.units.find((u) => u.id === "mark");
      expect(mark.kind).toBe("structure");
      expect(mark.maxHealth ?? mark.health?.max).toBe(1);
    });
  }, 120_000);

  it("is destroyed when defeated, not left on its panel", async () => {
    const { readFileSync } = await import("node:fs");
    const io = readFileSync("module/engine/io.mjs", "utf8");
    expect(io).toMatch(/if \(actor\.type === "structure"\) \{\s*for \(const token of actor\.getActiveTokens/);
  });
});
