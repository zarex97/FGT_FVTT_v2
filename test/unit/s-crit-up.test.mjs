/**
 * @file S.Crit Up as an aura its caster holds (#132).
 * @see packs/_source/effects/s-crit-up.yml, module/rules/auras.mjs, docs/A-effect-catalogue.md
 *
 * Ruled 2026-10-06: "cannot be prevented" means the bonus is not removed from
 * the Units it reaches; it is removed from its holder, as an aura is ended at
 * its source. A recipient with No Buff or a buff Immunity receives nothing; No
 * Buff on the holder stops nothing. Allies gain it walking in and lose it
 * walking out, and two sources stack.
 *
 * Every subject is real content through the real projection: the effect is a
 * real ActiveEffect on the holder, and the bonus is read by `critChance`.
 */

import { describe, it, expect } from "vitest";
import { critChance } from "../../module/rules/checks.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { effectDef } from "../helpers/effect-defs.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

// Document ids, as a live world stamps them on `sourceUnitId`.
// The holder is Medusa, whose own Crit Chance carries nothing to add.
const HOLDER = "medusa0000000000";
const QUETZ = "quetz00000000000";
const KIRI = "kiritsugu0000000";
const scu = (magnitude, over = {}) => ({
  defId: "sCritUp", magnitude, sourceUnitId: HOLDER, sourceAbilityId: "karna-end-of-charity", appliedTick: 4, ...over,
});
const side = (id, from, i, j, over = {}) => ({ from, id, panel: { i, j }, state: { factionId: "a" }, ...over });
const crit = (board, id) => critChance(board.units.find((u) => u.id === id), null, { base: 0 }).percent;

describe("S.Crit Up reaches allies from its holder (#132)", () => {
  it("reaches the holder and allies within 2 panels, and no further", async () => {
    await prepareSubjects();
    await withSubjects([
      side(HOLDER, "medusa", 5, 5, { effects: [scu(40)] }),
      side("near", "medea", 5, 7),
      side("far", "emiya", 5, 8),
      { from: "kiritsugu", id: "foe", panel: { i: 5, j: 6 }, state: { factionId: "b" } },
    ], ({ board }) => {
      expect(crit(board, HOLDER)).toBe(40);
      expect(crit(board, "near")).toBe(40);
      expect(crit(board, "far")).toBe(0);
      expect(crit(board, "foe")).toBe(0);
      // Nothing is put on the ally: there is nothing there to remove.
      expect(board.units.find((u) => u.id === "near").effects).not.toContain("sCritUp");
    });
  }, 120_000);

  it("is refused by a recipient's No Buff or buff Immunity, never by its holder's", async () => {
    await prepareSubjects();
    await withSubjects([
      side(HOLDER, "medusa", 5, 5, { effects: [scu(40), { defId: "noBuff" }] }),
      side("barred", "medea", 5, 6, { effects: [{ defId: "noBuff" }] }),
      side("near", "emiya", 5, 7),
    ], ({ board }) => {
      expect(crit(board, HOLDER)).toBe(0);
      expect(crit(board, "barred")).toBe(0);
      expect(crit(board, "near")).toBe(40);
    });
  }, 120_000);

  it("stacks across two sources", async () => {
    await prepareSubjects();
    await withSubjects([
      side(HOLDER, "medusa", 5, 5, { effects: [scu(40)] }),
      side(QUETZ, "quetzalcoatl", 5, 9, { effects: [scu(25, { sourceUnitId: QUETZ, sourceAbilityId: "quetz-charisma-of-the-sun" })] }),
      side("between", "medea", 5, 7),
    ], ({ board }) => {
      expect(crit(board, "between")).toBe(65);
    });
  }, 120_000);

  it("reaches a Unit once from one cast on two holders (Scapegoat)", async () => {
    await prepareSubjects();
    const cast = { sourceUnitId: KIRI, sourceAbilityId: "kiritsugu-scapegoat", appliedTick: 7 };
    await withSubjects([
      side(KIRI, "kiritsugu", 5, 5, { effects: [scu(15, cast)] }),
      side("bait", "emiya", 5, 7, { effects: [scu(15, cast)] }),
      side("between", "medea", 5, 6),
    ], ({ board }) => {
      expect(crit(board, "between")).toBe(15);
      expect(crit(board, KIRI)).toBe(15);
    });
  }, 120_000);
});

describe("the Pollux buff's S.Crit Up reaches the partner wherever it stands (#132)", () => {
  it("reaches Pollux across the board, and an ally 3 panels out not at all", async () => {
    await prepareSubjects();
    const CASTOR = "castor0000000000";
    const POLLUX = "pollux0000000000";
    // The pairing a live world writes when the twins are summoned together.
    const linked = (partner) => ({ factionId: "a", linkedGroup: { id: "dioscuri", memberIds: [partner] } });
    await withSubjects([
      side(CASTOR, "castor", 5, 5, {
        effects: [{ defId: "sCritUpPollux", magnitude: 10, sourceUnitId: CASTOR }], state: linked(POLLUX),
      }),
      side(POLLUX, "pollux", 14, 14, { state: linked(CASTOR) }),
      side("far", "medea", 5, 8),
    ], ({ board }) => {
      // Pollux carries her own +5 (Twin God's Divine Core); only the aura's is counted.
      const base = (id) => critChance(board.units.find((u) => u.id === id), null, { base: 0 }).modifiers
        .filter((m) => m.source === "sCritUpPollux").reduce((a, m) => a + m.value, 0);
      expect(base(POLLUX)).toBe(10);
      expect(base("far")).toBe(0);
    });
  }, 120_000);
});

describe("Rho Aias is a barrier, not a buff (#132)", () => {
  it("is a status at an ordinary chance", async () => {
    const { readFileSync } = await import("node:fs");
    const { parse } = await import("yaml");
    const rho = parse(readFileSync("packs/_source/effects/rho-aias.yml", "utf8"));
    expect(rho).toMatchObject({ polarity: "status", baseChance: 100 });
  });
});

describe("Decoy from its own side meets the target's gates (#132)", () => {
  const apply = (id, target) => applyEffect({
    def: effectDef(id), target: { id: "ally", factionId: "a", effects: [], effectInstances: [], ...target },
    source: { unitId: "mannanan" }, ctx: { roll: 100, currentTick: 0, turnsPerRound: 3, sourceFactionId: "a" },
  });

  it("is refused by Debuff Immune on herself or an ally", () => {
    for (const id of ["decoy", "decoyScapegoat"]) {
      const out = apply(id, { immunities: [{ scope: "debuff", except: [] }] });
      expect(out.outcome, id).toBe("blocked");
    }
  });

  it("lands on an ally with no gate against it", () => {
    expect(apply("decoyScapegoat", {}).outcome).toBe("applied");
  });
});
