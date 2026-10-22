/**
 * @file A Count names a kind the system knows, or it is refused: at build, and at use (#319, Q19).
 * @see module/rules/count.mjs, tools/lib/content.mjs, module/rules/costs.mjs
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { validateAll } from "../../tools/lib/content.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { slotFor } from "../../module/apps/hud/present.mjs";
import { unknownCountKindsIn } from "../../module/rules/count.mjs";
import { loadSource } from "../../tools/lib/load.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

const file = (doc, dir) => ({ path: "x.yml", dir, doc });
const ok = (over = {}) => ({ schema: 1, id: "thing", name: "Thing", ...over });
const problems = (doc, dir) => validateAll([file(doc, dir)]).problems;

/** What a Count adds to a document's problems: the same document with a valid Count is the baseline. */
function added(build, dir, bad) {
  const base = problems(build({ of: "stacks", effect: "curse" }), dir);
  return problems(build(bad), dir).filter((p) => !base.includes(p));
}

describe("the build refuses a Count it cannot read", () => {
  it("on an element, naming the file, the place and the kind", () => {
    const out = added((count) => ok({ rules: [{ key: "FlatDamage", value: 5, count }] }), "effects", { of: "bogus" });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("x.yml");
    expect(out[0]).toContain("rules[0].count");
    expect(out[0]).toContain("bogus");
  });

  it("when a known kind lacks the key it reads", () => {
    const out = added((count) => ok({ rules: [{ key: "FlatDamage", value: 5, count }] }), "effects", { of: "stacks" });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("effect");
  });

  it("wherever it sits: a cooldown change, a cooldown bonus, a cost, a damage multiplier", () => {
    const ability = (count) => ok({
      kind: "skill", timing: { window: "ownTurn" },
      phases: [{ kind: "cooldown", changes: [{ scope: "np", ticks: "⅓◈", count }] }],
      cooldown: { max: "3◈", countBonus: [{ ticks: "½◈", count }] },
      additionalCosts: [{ id: "c", kind: "masterHealth", amount: { base: 30, per: 5, count } }],
      damage: { component: "mag", multiplier: { base: 3, per: 0.5, count } },
    });
    const out = added(ability, "abilities", { of: "bogus" });
    expect(out.filter((p) => p.includes("bogus"))).toHaveLength(4);
    for (const where of ["phases[0].changes[0].count", "cooldown.countBonus[0].count",
      "additionalCosts[0].amount.count", "damage.multiplier.count"]) {
      expect(out.some((p) => p.includes(where)), where).toBe(true);
    }
  });

  it("refuses a RankShift ladder rung that is not a Rank, naming it", () => {
    const build = (rung) => ok({ rules: [{ key: "RankShift", parameter: "agi",
      to: { ladder: ["B", rung, "EX"], count: { of: "resource", key: "aria" } } }] });
    const out = problems(build("A++x"), "effects").filter((p) => !problems(build("A"), "effects").includes(p));
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("rules[0].to.ladder[1]");
    expect(out[0]).toContain("A++x");
  });

  it("passes every kind it knows with its keys", () => {
    for (const count of [
      { of: "stacks", effect: "curse" }, { of: "targets" }, { of: "board", relation: "enemy" },
      { of: "resource", key: "aria" }, { of: "parameters", vs: "self", compare: "gte" }, { of: "criteria" },
      { of: "use", fact: "debuffsInflicted" }, { of: "tally" },
    ]) {
      expect(added((c) => ok({ rules: [{ key: "FlatDamage", value: 5, count: c }] }), "effects", count), count.of).toEqual([]);
    }
  });
});

describe("the use refuses a Count it cannot read, out loud", () => {
  const item = { id: "a1", name: "Bogus", type: "skill", system: { rules: [{ key: "FlatDamage", value: 5, count: { of: "bogus" } }] } };

  it("finds the unknown kinds anywhere in an ability", () => {
    expect(unknownCountKindsIn(item.system)).toEqual(["bogus"]);
    expect(unknownCountKindsIn({ rules: [{ count: { of: "stacks", effect: "x" } }] })).toEqual([]);
  });

  it("is refused by the gate, with the kind in its detail", () => {
    const verdict = canUseAbility({ ability: usageSpecFor(item), unit: { id: "u", kind: "servant" }, clockRunning: true });
    expect(verdict).toMatchObject({ ok: false, reason: "unknownCountKind", detail: { kind: "bogus" } });
  });

  it("is refused when the bar hands the gate the Item's own system", () => {
    const verdict = canUseAbility({ ability: { ...item.system, id: item.id }, unit: { id: "u", kind: "servant" } });
    expect(verdict).toMatchObject({ ok: false, reason: "unknownCountKind" });
  });

  it("has words, naming the kind", () => {
    const lang = JSON.parse(readFileSync(new URL("../../lang/en.json", import.meta.url), "utf8"));
    expect(lang["FGT.Ability.Refused.unknownCountKind"]).toContain("{kind}");
  });

  it("greys the bar's slot with that reason", () => {
    const s = slotFor({ id: "a1", name: "Bogus", cooldownRemaining: 0 },
      { verdict: { ok: false, reason: "unknownCountKind", detail: { kind: "bogus" } } });
    expect(s).toMatchObject({ disabled: true, reason: "unknownCountKind" });
  });
});

describe("an unknown Count costs its own clause, never the board (found live, #319)", () => {
  it("projects the Unit, drops the clause, and refuses the use by name", async () => {
    await prepareSubjects();
    const { files } = await loadSource("packs/_source");
    const jeanne = files.find((f) => f.doc?.id === "test-jeanne-d-arc").doc;
    const bogus = {
      id: "test-count-bogus", slug: "testCountBogus", name: "Test Count: Bogus", kind: "skill",
      timing: { window: "ownTurn" }, cooldown: "1◈",
      phases: [{ kind: "applyEffects", effects: [{ id: "atkUp", duration: "1◈", magnitude: 5 }] }],
      rules: [{ key: "FlatDamage", value: 5, count: { of: "bogus" } }],
    };
    const said = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await withSubjects([{ from: "test-jeanne-d-arc", id: "bogusHolder00001",
        with: { abilities: [...(jeanne.abilities ?? []), bogus] } }], ({ units, board, world }) => {
        // The board projected: the Unit is on it, with the ability.
        expect(board.units.map((u) => u.id)).toContain("bogusHolder00001");
        expect(units[0].abilities.some((a) => a.contentId === "test-count-bogus")).toBe(true);
        // The clause was dropped out loud, by name.
        expect(said.mock.calls.flat().join(" ")).toContain('Unknown count kind "bogus"');
        // ...and the use is refused by name, as the bar then shows it.
        const item = world.actor("bogusHolder00001").items.find((i) => i.system?.contentId === "test-count-bogus");
        const verdict = canUseAbility({ ability: usageSpecFor(item), unit: units[0] });
        expect(verdict).toMatchObject({ ok: false, reason: "unknownCountKind", detail: { kind: "bogus" } });
      });
    } finally {
      said.mockRestore();
    }
  }, 120_000);
});
