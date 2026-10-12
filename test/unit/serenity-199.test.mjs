/**
 * @file Serenity's audit rulings (#199) that changed the engine.
 * @see docs/46-roster-re-audit.md, char_orig_sheets/Copia de Hassan (Serenity).md
 *
 * - reading 10: Secret Poison "explodes" when it is revealed. Its ticks are
 *   banked against her, the victim's bar does not move, and the bank lands at
 *   the reveal. This replaces Q47, which took the Health on schedule.
 * - reading 13: each tick banks at its real value: the stage, Deadly Poison's
 *   doubling, the modifiers in force.
 * - reading 16: Pois Heal banks as a negative and nets out.
 * - reading 11: "not affected by Magic Resistance" covers the whole NP, its
 *   debuffs and Instakill included.
 *
 * And what the build found: the rider loop never read `ignoresResistanceFrom`,
 * so Kiritsugu's Mark has met Debuff Res Up since it was authored.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { tickPeriodics } from "../../module/engine/scheduler.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { INTENT_TYPES, order } from "../../module/engine/intents.mjs";
import { effectDef } from "../helpers/effect-defs.mjs";
import { prepareSubjects, subject } from "../helpers/subject.mjs";

const yml = (dir, id) => parse(readFileSync(`packs/_source/${dir}/${id}.yml`, "utf8"));
const ZABANIYA = yml("abilities", "serenity-zabaniya");

/** A 16-character id, as the instance schema demands. */
const SERENITY = "serenityHassan01";

const ctx = { tick: 10, turnsPerRound: 3, rolls: {}, options: new Set(), effectDef };

/** A Poison instance Serenity inflicted while concealed. */
const secret = (stage) => ({
  defId: "poison", stage, attributionHidden: true, visibility: "gmOnly", sourceUnitId: SERENITY,
});

beforeAll(prepareSubjects, 120_000);

describe("Secret Poison banks its ticks (readings 10, 13, 16)", () => {
  it("banks against her and moves no Health", async () => {
    const victim = await subject({ from: "drake", effects: [secret(2)] });
    const out = tickPeriodics([{ ...victim, acted: true }], "roundEnd", ctx);
    expect(out).toEqual([{ t: "bankSecret", unitId: victim.id, inflicterId: SERENITY, defId: "poison", amount: 40 }]);
    expect(out.some((i) => i.t === "damage")).toBe(false);
  });

  it("banks at the real value: Deadly Poison doubles it", async () => {
    const victim = await subject({ from: "drake", effects: [secret(3), { defId: "deadlyPoison" }] });
    const [bank] = tickPeriodics([{ ...victim, acted: true }], "roundEnd", ctx);
    expect(bank.amount).toBe(160);
  });

  it("banks a Pois Heal tick as a negative", async () => {
    const victim = await subject({ from: "drake", effects: [secret(1), { defId: "poisHeal" }] });
    const [bank] = tickPeriodics([{ ...victim, acted: true }], "roundEnd", ctx);
    expect(bank).toMatchObject({ t: "bankSecret", amount: -20 });
  });

  it("leaves an open Poison dealing its damage on schedule", async () => {
    const victim = await subject({ from: "drake", effects: [{ defId: "poison", stage: 1 }] });
    const [tick] = tickPeriodics([{ ...victim, acted: true }], "roundEnd", ctx);
    expect(tick).toMatchObject({ t: "damage", amount: 20, periodic: true });
  });

  it("is a legal intent, written as bookkeeping before any damage", () => {
    expect(INTENT_TYPES).toContain("bankSecret");
    const sorted = order([{ t: "damage", unitId: "v", amount: 5 }, { t: "bankSecret", unitId: "v", amount: 5 }]);
    expect(sorted.map((i) => i.t)).toEqual(["bankSecret", "damage"]);
  });
});

describe("Zabaniya is not affected by Magic Resistance (reading 11)", () => {
  const phase = ZABANIYA.phases.find((p) => p.kind === "applyEffects");

  it("names Magic Resistance on its rider phase", () => {
    expect(phase.ignoresResistanceFrom).toEqual(["magicResistance"]);
  });

  /** Apply one of Zabaniya's riders to Drake, Magic Resistance D. */
  const land = async (id, ignoresResistanceFrom) => {
    const target = await subject({ from: "drake" });
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    const spec = phase.effects.find((e) => e.id === id);
    return applyEffect({
      def: EffectRegistry.get(id), target, chance: spec.chance ?? null,
      source: { unitId: "serenity", abilityId: "zabaniya" },
      ctx: { turnsPerRound: 3, currentTick: 0, roll: 100, options: new Set(), ignoresResistanceFrom },
    });
  };

  it("meets no debuff resistance from it", async () => {
    expect((await land("skillSeal", [])).chance).toBe("rolled 100 vs 30%");
    expect((await land("skillSeal", ["magicResistance"])).chance).toBe("rolled 100 vs 40%");
  });

  it("meets none on the Instakill ladder either", async () => {
    expect((await land("instakill", [])).chance).toBe("rolled 100 vs 50%");
    expect((await land("instakill", ["magicResistance"])).chance).toBe("rolled 100 vs 60%");
  });

  it("is read on the rider loop, which read it on the check path only", () => {
    const source = readFileSync("module/engine/attack.mjs", "utf8");
    expect(source).toMatch(/\.\.\.\(phase\.ignoresResistanceFrom \?\? \[\]\)/);
    expect(source).toMatch(/\.\.\.\(spec\.ignoresResistanceFrom \?\? rule\.ignoresResistanceFrom \?\? \[\]\)/);
  });
});
