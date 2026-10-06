/**
 * @file Ozymandias — the rulings of his audit (#189).
 * @see char_orig_sheets/Copia de Ozymandias.md, docs/46-roster-re-audit.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { turnWrite } from "../../module/rules/snapshot.mjs";
import { interiorModifiers } from "../../module/rules/bounded-fields.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { normalAttackAt } from "../../module/rules/normal-attack.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

const src = (dir, file) =>
  parse(readFileSync(join(process.cwd(), "packs/_source", dir, file), "utf8"));

describe("Move then Attack, or Attack then Move (#189 reading 15)", () => {
  it("records whether a Move came before the Attack, at the moment of the Attack", () => {
    const moved = turnWrite({ tick: 4, moved: true }, 4, { attacked: true });
    expect(moved).toMatchObject({ attacked: true, movedBeforeAttack: true });
    const stood = turnWrite({ tick: 4 }, 4, { attacked: true });
    expect(stood).toMatchObject({ attacked: true, movedBeforeAttack: false });
    // A Move after the Attack does not rewrite it.
    expect(turnWrite(stood, 4, { moved: true })).toMatchObject({ movedBeforeAttack: false, moved: true });
    // A ride stamps its Move and its Attack together: it moved first.
    expect(turnWrite({ tick: 4 }, 4, { moved: true, attacked: true })).toMatchObject({ movedBeforeAttack: true });
  });
});

describe("his content, as ruled", () => {
  it("has his own Riding: Double Move and Riding Attack, no Passenger Seat (reading 1)", () => {
    const o = src("servants", "ozymandias.yml");
    expect(o.abilities).toContainEqual({ ref: "class-riding-ozymandias", rank: "A+", cooldown: "3◈-⅓◈" });
    const riding = src("class-skills", "riding-ozymandias.yml");
    expect(riding.passiveRules[0].abilities).toEqual(["doubleMove", "ridingAttack"]);
  });

  it("asks his Master to keep some Health after paying (reading 4)", () => {
    const rt = src("abilities", "ozymandias-ramesseum-tentyris.yml");
    expect(rt.targeting.limits.requirements).toContainEqual({ kind: "masterHealthFraction", above: 0.5 });
    for (const f of ["ozymandias-dendera-electric-bulb.yml", "ozymandias-dendera-electric-bulb-area.yml"]) {
      expect(src("abilities", f).requirements).toContainEqual({ kind: "masterHealthAbove", amount: 10 });
    }
  });
});

describe("Divine Protection revives the Sphinxes, not any allied summon (reading 5)", () => {
  const rt = src("abilities", "ozymandias-ramesseum-tentyris.yml");
  const panels = [];
  for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) panels.push({ i, j });
  const field = { id: "rt", ownerId: "oz", geometry: { kind: "markDefined" }, panels, interior: rt.field.interior };
  const oz = { id: "oz", kind: "servant", faction: "a", factionId: "a", panel: { i: 5, j: 5 } };
  const board = (u) => ({ units: [oz, u], fields: [field], alliances: { a: ["a"] } });
  const revivals = (u) => interiorModifiers(field, u, board(u)).filter((r) => r.key === "RevivalSource").map((r) => r.id);

  it("gives the Sphinx Queen its 10%", () => {
    const queen = { id: "q", kind: "summon", contentId: "sphinx-queen", faction: "a", factionId: "a", panel: { i: 4, j: 4 } };
    expect(revivals(queen)).toEqual(["divineProtectionSphinx"]);
  });

  it("gives another allied summon nothing", () => {
    const other = { id: "d", kind: "summon", contentId: "dragon-tooth-warrior-blade", faction: "a", factionId: "a", panel: { i: 4, j: 4 } };
    expect(revivals(other)).toEqual([]);
  });
});

describe("doubled against Dark, inside the bracket (readings 2, 3, 18)", () => {
  const dark = { id: "d", attributes: ["dark"], parameters: {}, effects: [], modifiers: [], health: 5000, maxHealth: 5000 };
  const light = { ...dark, attributes: [] };
  const attacker = { id: "oz", baseAttack: { str: 100, mag: 200 }, modifiers: [], abilities: [] };
  const hit = (defender, block) => computeDamage({
    attacker, defender, base: { sources: [{ unit: "self", component: "mag", factor: 1 }] }, component: "mag",
    multiplier: block.multiplier ?? 1, flatBonus: block.flatBonus ?? 0,
    conditionalMultipliers: block.conditionalMultipliers ?? [], rolls: { attackMinus: 0 },
    // The option set the resolution builds (`rollOptionsFor`), as far as this asks.
    options: new Set(defender.attributes.map((a) => `target:attribute:${a}`)),
  }).total;

  it("Mesektet: 200 × 4 × 2 + 100 against Dark, 200 × 4 + 100 otherwise", () => {
    const mk = src("abilities", "ozymandias-mesektet.yml").damage;
    expect(hit(dark, mk)).toBe(1700);
    expect(hit(light, mk)).toBe(900);
  });

  it("his Normal Attack carries its ×2 through the real projection", async () => {
    await prepareSubjects();
    await withSubjects([{ from: "ozymandias", id: "oz", panel: { i: 5, j: 5 } }], ({ board }) => {
      const oz = board.units.find((u) => u.id === "oz");
      const normal = normalAttackAt(oz, 1);
      expect(normal.conditionalMultipliers).toEqual([{ factor: 2, predicate: ["target:attribute:dark"], source: "Mesektet: Dark (+100%)" }]);
      expect(hit(dark, normal)).toBe(400);
      expect(hit(light, normal)).toBe(200);
    });
  }, 120_000);
});

describe("Protection from Ra reaches each ally's own Noble Phantasm (#189)", () => {
  it("cuts the TARGET's NP cooldown, not the caster's once per ally", async () => {
    globalThis.game ??= {};
    const settings = game.settings;
    game.settings = { get: () => 3 };
    try {
      const { cooldownChanges } = await import("../../module/engine/skill-use.mjs");
      const phase = src("abilities", "ozymandias-protection-from-ra.yml").phases.find((p) => p.kind === "cooldown");
      const item = (id) => ({ id, type: "noblePhantasm", system: { isNP: true, contentId: id, cooldown: { remaining: 10 } } });
      const caster = { id: "oz", items: [item("mesektet")] };
      const medea = { id: "medea", items: [item("rule-breaker")] };
      const out = cooldownChanges(phase, caster, null, null, medea);
      expect(out).toEqual([{ t: "cooldown", unitId: "medea", abilityId: "rule-breaker", ticks: 2, mode: "reduce" }]);
    } finally {
      game.settings = settings;
    }
  });
});

describe("a Civilian an attack kills is no defender of its Processes (#189)", () => {
  it("builds the fan-out from the Units left after the Civilians died", () => {
    const src2 = readFileSync("module/engine/attack.mjs", "utf8");
    expect(src2).toMatch(/const defenders = targets\.units\.filter\(\(t\) => !killedCivilians\.has\(t\.unitId\)\)/);
    expect(src2).toMatch(/const targetIds = defenders\.flatMap/);
  });
});

describe("the Bulb's reach beyond the Complex: 4 straight, 3 diagonally (#189)", () => {
  const panels = [];
  for (let i = 4; i <= 14; i++) for (let j = 5; j <= 15; j++) panels.push({ i, j });
  const field = { id: "ozymandias-ramesseum-tentyris", ownerId: "oz", geometry: { kind: "markDefined" }, panels };
  const bulb = src("abilities", "ozymandias-dendera-electric-bulb.yml").targeting;
  const oz = { id: "oz", name: "Ozymandias", kind: "servant", faction: "a", factionId: "a", panel: { i: 9, j: 10 }, range: 3 };
  const errorsAt = (i, j) => {
    const foe = { id: "foe", name: "Foe", kind: "master", faction: "b", factionId: "b", panel: { i, j } };
    const board = { bounds: squareBounds(21), units: [oz, foe], fields: [field], alliances: { a: ["a"], b: ["b"] } };
    return resolveTargets(bulb, oz, board, { unitId: "foe" }).errors;
  };

  it("reaches 4 panels straight out, though a corner panel is as near", () => {
    // (9,1): 4 from (9,5), and 4 from the corner (5,5) as well -- the tie that
    // measured a straight shot as a diagonal one.
    expect(errorsAt(9, 1)).toEqual([]);
    expect(errorsAt(9, 0)[0]).toMatch(/5 panels from the area; Range is 4\./);
  });

  it("reaches 3 diagonally and not 4", () => {
    expect(errorsAt(1, 2)).toEqual([]);
    expect(errorsAt(0, 1)[0]).toMatch(/Range is 3 on the diagonal/);
  });
});
