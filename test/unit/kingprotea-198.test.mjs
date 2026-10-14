/**
 * @file Kingprotea's audit rulings (#198) that changed the engine.
 * @see docs/46-roster-re-audit.md, char_orig_sheets/Copia de Kingprotea.md
 *
 * - reading 2: Airavata's 3x3 hits every Unit in it.
 * - reading 3: grown, the 3x3 sits against her whole side, one placement a
 *   side at 1x1 and 3x3, two at 2x2 and 4x4.
 * - reading 4: no stock at the end of the Turn she used Huge Scale.
 * - reading 8: a stock's worth is the stock's, so a Skill Seal on Huge Scale
 *   does not take it.
 * - reading 12: one GAO charge per boundary; a second Monstrous Strength sums
 *   into one instance, stamped with the Turn of that use.
 * - readings 6 and 7: a Unit on a panel she lands on or grows into is pushed
 *   off her along one line, the line pushed on, one against the edge to the
 *   nearest free panel.
 * - reading 14: Mad Enhancement's ZON adds to Independent Action's.
 *
 * And what the press found: an Unremovable instance cleansed, a Caster that
 * could not contract, a strip that took every stock, a fan-out's Processes
 * racing at the Damage Step, two growth dialogs, GAO's exception at X = 0.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { expand, edgeOffsets } from "../../module/rules/targeting/shapes.mjs";
import { legalPlacements } from "../../module/rules/targeting/resolve.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { endTurn } from "../../module/engine/scheduler.mjs";
import { zonRadius } from "../../module/rules/zon.mjs";
import { clearFootprintPlan } from "../../module/rules/movement.mjs";
import { prepareSubjects, subject } from "../helpers/subject.mjs";
import { isUnremovable } from "../../module/rules/removal.mjs";
import { canAttemptContract } from "../../module/rules/contract.mjs";

const yml = (dir, id) => parse(readFileSync(`packs/_source/${dir}/${id}.yml`, "utf8"));
const AIRAVATA = yml("abilities", "kingprotea-airavata-king-size");

/** A square footprint of side `n` with its top-left at (5, 5). */
const square = (n) => Array.from({ length: n * n }, (_, k) => ({ i: 5 + Math.floor(k / n), j: 5 + (k % n) }));

describe("Airavata's 3x3 (readings 2 and 3)", () => {
  it("hits every Unit in it", () => {
    expect(AIRAVATA.targeting.selection.relations).toEqual(["enemy", "ally", "neutral"]);
  });

  it("covers as much of her edge as it can", () => {
    expect(edgeOffsets(1, 3)).toEqual([-1]);
    expect(edgeOffsets(2, 3)).toEqual([-1, 0]);
    expect(edgeOffsets(3, 3)).toEqual([0]);
    expect(edgeOffsets(4, 3)).toEqual([0, 1]);
  });

  it("offers one placement a side at 1x1 and 3x3, two at 2x2 and 4x4", () => {
    const board = { units: [], bounds: { rows: 30, cols: 30 } };
    for (const [n, each] of [[1, 1], [2, 2], [3, 1], [4, 2]]) {
      const caster = { id: "k", panel: { i: 5, j: 5 }, panels: square(n), range: 1 };
      const placements = legalPlacements(AIRAVATA.targeting, caster, board).map((o) => o.placement);
      expect(placements, `${n}x${n}`).toHaveLength(4 * each);
    }
  });

  it("sits flush against a grown side, outside her", () => {
    const panels = square(3);
    const north = expand({ kind: "square", size: 3 },
      { panel: { i: 5, j: 5 }, casterPanel: { i: 5, j: 5 }, casterPanels: panels, direction: "n", shift: 0 }).panels;
    expect(north.map((p) => `${p.i},${p.j}`).sort()).toEqual(
      ["2,5", "2,6", "2,7", "3,5", "3,6", "3,7", "4,5", "4,6", "4,7"]);
    const east = expand({ kind: "square", size: 3 },
      { panel: { i: 5, j: 5 }, casterPanel: { i: 5, j: 5 }, casterPanels: square(2), direction: "e", shift: 1 }).panels;
    // 2x2 at rows 5-6: the second placement covers rows 5-7.
    expect(Math.min(...east.map((p) => p.i))).toBe(5);
    expect(Math.min(...east.map((p) => p.j))).toBe(7);
  });
});

describe("Endless Proliferation (reading 4)", () => {
  it("gives no stock at the end of the Turn she used Huge Scale", () => {
    const handler = yml("effects", "endless-proliferation").rules[0];
    expect(handler).toMatchObject({ event: "anyTurnEnd", notOnApplyTurn: true });
  });
});

describe("NP DmUp (GAO) (reading 12)", () => {
  const def = yml("effects", "np-dm-up-gao");
  const target = (existing) => ({
    id: "k", name: "Kingprotea", kind: "servant", attributes: [], applicationChances: [],
    effectInstances: existing ? [{ id: "e1", defId: "npDmUpGao", uses: 2, appliedTick: 3 }] : [],
    effects: existing ? [{ id: "e1", defId: "npDmUpGao", uses: 2, appliedTick: 3 }] : [],
  });
  const apply = (t) => applyEffect({
    def, target: t, uses: 3, source: { unitId: "k", abilityId: "gm" },
    ctx: { turnsPerRound: 3, currentTick: 7, roll: 1, options: new Set() },
  });

  it("sums a second use into one instance, stamped with this Turn", () => {
    const out = apply(target(true));
    expect(out.intents.filter((i) => i.t === "removeEffect")).toHaveLength(1);
    const created = out.intents.filter((i) => i.t === "applyEffect");
    expect(created).toHaveLength(1);
    expect(created[0].effect).toMatchObject({ uses: 5, appliedTick: 7 });
  });

  it("loses one charge at a boundary where her Turn and her Acting coincide", () => {
    const handler = {
      events: ["turnEnd", "actedTurnEnd"], actions: [], consumesUse: true, defId: "npDmUpGao",
      notOnApplyTurn: true, appliedAt: 3, expiry: null, source: "NP DmUp (GAO)",
    };
    const unit = { id: "k", factionId: "f1", acted: true, eventHandlers: [handler], effectInstances: [] };
    const intents = endTurn({ units: [unit] }, { tick: 5, turnsPerRound: 3, activeFactionId: "f1", options: new Set() });
    expect(intents.filter((i) => i.t === "consumeUse")).toHaveLength(1);
  });
});

describe("her Master's ZON (reading 14)", () => {
  it("is +4 while Mad Enhancement is Active, Independent Action's +2 and its own", () => {
    const servant = (bonuses) => ({ servantClasses: ["alterEgo"], zonBonuses: bonuses });
    const ia = { value: 2, stacks: false };
    const me = yml("class-skills", "mad-enhancement").activeRules.find((r) => r.key === "ZonBonus");
    expect(me.stacks).toBe(true);
    const off = zonRadius(servant([ia]), { zon: 0 });
    const on = zonRadius(servant([ia, { value: 2, stacks: true }]), { zon: 0 });
    expect(on - off).toBe(2);
  });
});

describe("a stock's worth is the stock's (reading 8)", () => {
  beforeAll(prepareSubjects, 120_000);

  const stocks = (n) => Array.from({ length: n }, () => ({ defId: "proliferationStock" }));

  it("grows her at six stocks, Huge Scale or not", async () => {
    const withSkill = await subject({ from: "kingprotea", effects: stocks(6) });
    const sheet = yml("servants", "kingprotea");
    const withoutSkill = await subject({
      from: "kingprotea", effects: stocks(6),
      with: { abilities: sheet.abilities.filter((a) => a.ref !== "kingprotea-huge-scale") },
    });
    for (const unit of [withSkill, withoutSkill]) {
      expect(unit.maxHealth).toBe(4400);
      expect(unit.footprint).toEqual({ w: 3, h: 3 });
      expect(unit.range).toBe(3);
      expect(unit.mov).toBe(5);
    }
  }, 60_000);
});

describe("the shove off her footprint (readings 6 and 7)", () => {
  const bounds = { iMin: 0, iMax: 9, jMin: 0, jMax: 9 };
  const at = (id, i, j) => ({ id, kind: "servant", panel: { i, j } });
  const east = () => ({ i: 0, j: 1 });
  const landing = (plan, id) => plan.filter((m) => m.unitId === id).at(-1)?.landing.panel;

  it("pushes a Unit off her along her travel, and the one behind it on by one", () => {
    // She lands on (5,5)-(6,6), travelling east. A on (5,6), B right behind on (5,7).
    const board = { bounds, units: [at("A", 5, 6), at("B", 5, 7)] };
    const plan = clearFootprintPlan({ id: "k" }, square(2), east, board);
    expect(landing(plan, "A")).toEqual({ i: 5, j: 7 });
    expect(landing(plan, "B")).toEqual({ i: 5, j: 8 });
    // The front of the line moves first.
    expect(plan.map((m) => m.unitId)).toEqual(["B", "A"]);
  });

  it("sends a Unit pinned against the edge to the nearest free panel off her", () => {
    const board = { bounds: { iMin: 0, iMax: 9, jMin: 0, jMax: 6 }, units: [at("A", 5, 6)] };
    const plan = clearFootprintPlan({ id: "k" }, square(2), east, board);
    const p = landing(plan, "A");
    expect(p).toBeDefined();
    expect([`${p.i},${p.j}`]).not.toContain("5,5");
    expect(Math.max(Math.abs(p.i - 5), Math.abs(p.j - 6))).toBe(1);
    expect(p.i === 5 || p.i === 6 ? p.j : 0).not.toBe(5);
  });

  it("stands on objects and leaves the mover alone", () => {
    const board = { bounds, units: [{ id: "k", kind: "servant", panel: { i: 5, j: 5 } }, { id: "s", kind: "structure", panel: { i: 6, j: 6 } }] };
    expect(clearFootprintPlan({ id: "k" }, square(2), east, board)).toEqual([]);
  });
});

/* ── Found by the press (#198) ──────────────────────────────────────────── */


describe("an Unremovable instance survives a cleanse (SS.unrem)", () => {
  it("reads the instance's flag where the definition's is false", () => {
    expect(isUnremovable({ unremovable: false }, { system: { unremovable: true } })).toBe(true);
    expect(isUnremovable({ unremovable: true }, { system: {} })).toBe(true);
    expect(isUnremovable({ unremovable: false }, { system: { unremovable: false } })).toBe(false);
  });

  it("is the one reader both removal paths ask", () => {
    for (const file of ["module/engine/skill-use.mjs", "module/engine/attack.mjs"]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/def\??\.unremovable \?\? e\.system/);
      expect(src, file).toMatch(/isUnremovable\(def, e\)/);
    }
  });
});

describe("a Caster can contract (IA.contract)", () => {
  beforeAll(prepareSubjects, 120_000);

  it("reads the class off the board's servantClasses", async () => {
    const medea = await subject({ from: "medea", panel: { i: 5, j: 5 }, state: { factionId: "f2" } });
    const free = { id: "k", kind: "servant", contract: "free", factionId: "f1", panel: { i: 5, j: 6 } };
    expect(medea.servantClasses).toContain("caster");
    expect(canAttemptContract(medea, free, { units: [medea, free] })).toMatchObject({ ok: true });
  }, 60_000);
});

describe("one strip takes one stock (PS.buff)", () => {
  it("removes the document it rolled for, and says so", () => {
    // The strip is the scheduler's `StripBuff` now (Wave B), by instance;
    // `suppression-strip.test.mjs` plays it. The caller posts the line.
    expect(readFileSync("module/engine/scheduler.mjs", "utf8")).toMatch(/I\.removeEffect\(u\.id, t\.documentId/);
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const body = src.slice(src.indexOf("async function fireDamageStepStart"), src.indexOf("async function offerPreAttackSpell"));
    expect(body).toMatch(/FGT\.Removal\.StripResisted/);
  });
});

describe("a fan-out's Processes reach the Damage Step together (MS.aoe, AK)", () => {
  const src = readFileSync("module/engine/attack.mjs", "utf8");

  it("asks the attacker's window once for the group", () => {
    const body = src.slice(src.indexOf("async function offerAttackerWindow"), src.indexOf("async function askAttackerWindow"));
    expect(body).toMatch(/openWindowPicks\.get\(key\)/);
  });

  it("pays a before-damage self rider once, and its siblings wait for it", () => {
    expect(src).toMatch(/selfPayments\.has\(key\)\) \{\s*await selfPayments\.get\(key\)/);
  });

  it("holds an after-damage self rider until every hit has struck", () => {
    expect(src).toMatch(/await siblingsPastDamage\(state\);\s*applied\.push/);
  });
});

describe("one growth, one question (PS.grow)", () => {
  it("serializes the footprint sync per actor", () => {
    const src = readFileSync("module/engine/token-footprint.mjs", "utf8");
    expect(src).toMatch(/const pending = syncing\.get\(actor\.id\)/);
  });
});

describe("GAO's exception is the Turn of the use (reading 12)", () => {
  it("is read off Monstrous Strength's use as well as the charges' stamp", () => {
    const handler = yml("effects", "np-dm-up-gao").rules.find((r) => r.key === "OnEvent");
    expect(handler.unlessUsedThisTurn).toEqual({ contentId: "kingprotea-monstrous-strength" });
    expect(handler.notOnApplyTurn).toBe(true);
  });
});
