/**
 * @file A defeated Unit declares nothing: no attack, no Skill, no Move.
 * @see module/rules/costs.mjs#canUseAbility, module/rules/movement.mjs#validatePath, docs/surprises/2026-10-14-defeated-servant-still-declares.md
 *
 * Pressed live during Wave A: Serenity, masterless, ran out of Sustainability
 * at Tick 30 and was defeated. Her body stays on the board until it is cleared
 * a Tick later, and in that Tick Player1 declared her Normal Attack on Achilles
 * and it resolved; at Tick 33, her token gone, her Presence Concealment was
 * cast and applied. Neither declaration path asked whether its actor was
 * defeated. A defeated Unit is a body: it is passed through, it projects no
 * reaction (`rules/reactions.mjs`), and it does nothing of its own.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { validatePath } from "../../module/rules/movement.mjs";

beforeAll(prepareSubjects, 120_000);

const SERENITY = "serenityAttacker";
const ACHILLES = "achillesDefender";

/** Defeated at Tick 30; her body not yet cleared. */
const fallen = [
  { from: "serenity", id: SERENITY, owner: "p1", state: { factionId: "A", defeated: true, defeatedAt: 30 }, panel: { i: 5, j: 4 } },
  { from: "achilles", id: ACHILLES, state: { factionId: "B", stance: "dismounted" }, panel: { i: 5, j: 5 } },
];
const tick31 = { tokens: true, combat: { round: 11, started: true, system: { globalTurn: 31 }, actingFactionId: "A" } };

describe("a defeated Servant, the Tick after it fell", () => {
  it("cannot declare an attack", async () => {
    await withSubjects(fallen, async ({ world: w }) => {
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      await expect(resolveAttack({ attackerId: SERENITY, abilityId: null, placement: { unitId: ACHILLES, chosenIds: [ACHILLES] } }))
        .rejects.toThrow(/defeated/i);
      expect(w.actor(ACHILLES).system.health.value).toBe(w.actor(ACHILLES).system.health.max);
    }, tick31);
  });

  it("cannot use a Skill", async () => {
    await withSubjects(fallen, async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      const concealment = [...w.actor(SERENITY).items].find((i) => i.system.slug === "presenceConcealment");
      const out = await useSkill({ actorId: SERENITY, abilityId: concealment.id });
      expect(out).toMatchObject({ ok: false, reason: "defeated" });
      expect([...w.actor(SERENITY).effects].map((e) => e.system.defId)).not.toContain("presenceConcealment");
    }, tick31);
  });

  it("is told why, in words", async () => {
    const { readFileSync } = await import("node:fs");
    const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
    expect(lang["FGT.Ability.Refused.defeated"]).toMatch(/defeated/i);
  });

  it("cannot Move", () => {
    const unit = { id: "s", defeated: true, panel: { i: 5, j: 4 }, mov: 4 };
    expect(validatePath([{ i: 5, j: 3 }], unit, { units: [unit] }).ok).toBe(false);
  });

  it("is offered no action on the bar", async () => {
    const { availableActions } = await import("../../module/rules/actions.mjs");
    const body = { id: "m", kind: "master", defeated: true, panel: { i: 0, j: 0 }, commandSpells: 3 };
    expect(availableActions(body, { units: [body] })).toEqual([]);
  });

  it("is refused before anything else is asked", () => {
    expect(canUseAbility({ ability: null, unit: { id: "s", defeated: true } })).toMatchObject({ ok: false, reason: "defeated" });
  });
});
