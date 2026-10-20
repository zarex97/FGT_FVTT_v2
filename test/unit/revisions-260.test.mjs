/**
 * @file Classic and Revised: three War Rules picking the text of three shared Skills (#260 reading 3).
 * @see module/domain/revisions.mjs, docs/superpowers/specs/2026-10-20-gilles-saber-clauses.md
 *
 * Ruled 2026-10-20: three rules (3a), every bearer follows the War's pick (3b),
 * Classic / Revised / As printed with Revised the default (3c), a War from before
 * them reads As printed (3h), locked once the War has started (3e), and the
 * sheet prints the War's text (3f). Revised is (3d, corrected by 3j): Mad
 * Enhancement clause 5's lock and per-Turn decay with no 2◈ at the death, and
 * clause 7's Skill Seal end; Divinity's Fixed Divine Damage; Presence
 * Concealment's Skill Seal end. Gilles's own *"cannot be negated"* is unsealable.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { effectiveRevision, revisionOf, REVISION_RULES } from "../../module/domain/revisions.mjs";
import { WAR_RULES, warRuleEditable } from "../../module/domain/war-rules.mjs";
import { onMasterDefeated } from "../../module/rules/relationships.mjs";
import { checkRemovals } from "../../module/engine/scheduler.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

describe("which text a bearer plays (3b, 3c)", () => {
  it("the War's pick wins, and As printed defers to the sheet", () => {
    expect(effectiveRevision("classic", "revised")).toBe("revised");
    expect(effectiveRevision("revised", "classic")).toBe("classic");
    expect(effectiveRevision("revised", "asPrinted")).toBe("revised");
    expect(effectiveRevision("classic", "asPrinted")).toBe("classic");
    expect(effectiveRevision(null, "asPrinted")).toBe("classic");
  });

  it("with no War to ask, Revised: the published default", () => {
    expect(effectiveRevision("classic", undefined)).toBe("revised");
  });

  it("answers only for the three revisable Skills", () => {
    expect(revisionOf({ slug: "divinity", printedRevision: "classic" }, { divinity: "asPrinted" })).toBe("classic");
    expect(revisionOf({ slug: "riding" }, { divinity: "classic" })).toBeNull();
    expect(Object.keys(REVISION_RULES).sort()).toEqual(["divinity", "madEnhancement", "presenceConcealment"]);
  });
});

describe("the three War Rules (3a, 3c, 3e, 3h)", () => {
  const rules = Object.values(REVISION_RULES).map((key) => WAR_RULES.find((r) => r.key === key));

  it("exist, start a new War at Revised, and read As printed on a War that never stored them", () => {
    for (const r of rules) {
      expect(r).toMatchObject({ initial: "revised", legacy: "asPrinted", locked: true });
      expect(Object.keys(r.choices)).toEqual(["revised", "classic", "asPrinted"]);
    }
  });

  it("refuse a change once the War has started", () => {
    for (const r of rules) {
      expect(warRuleEditable(r.key, { started: false })).toBe(true);
      expect(warRuleEditable(r.key, { started: true })).toBe(false);
    }
  });

  it("a War document with none stored reads As printed; the board carries all three", async () => {
    await withSubjects([{ from: "heracles", id: "heraclesRev00001" }], async ({ world: w }) => {
      const { warRule, revisionRules } = await import("../../module/engine/war.mjs");
      const war = { system: {} };
      for (const key of Object.values(REVISION_RULES)) expect(warRule(key, war)).toBe("asPrinted");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      expect(Object.keys(currentBoard().rules.revisions).sort()).toEqual(Object.keys(REVISION_RULES).sort());
      expect(Object.keys(revisionRules(war)).sort()).toEqual(Object.keys(REVISION_RULES).sort());
      expect(w).toBeTruthy();
    });
  });
});

describe("Divinity (3d): Fixed Divine Damage only under the Revised text", () => {
  const HE = "heraclesDiv00001", AR = "arjunaDiv0000001", FOE = "medusaDiv0000001";
  const strike = (attacker, defender, board) => computeDamage({
    attacker, defender, board,
    attack: { kind: "normal", component: "str" },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    rolls: { attackMinus: 0 },
    options: rollOptionsFor({ attacker, defender, attack: { kind: "normal", component: "str" } }),
  });
  const play = (rule, check) => withSubjects([
    { from: "heracles", id: HE }, { from: "arjuna", id: AR }, { from: "medusa", id: FOE },
  ], ({ unit, board }) => check(
    (who) => strike(unit(who), unit(FOE), { ...board, rules: { ...board.rules, revisions: { divinity: rule } } }),
  ));

  it("Revised: every bearer's bonus is Fixed, Heracles's Classic sheet included", async () => {
    await play("revised", (hit) => {
      expect(hit(HE).flags.fixedExtra).toBe(50);
      expect(hit(AR).flags.fixedExtra).toBe(40);
    });
  });

  it("Classic: no bearer's is, Arjuna's Revised sheet included", async () => {
    await play("classic", (hit) => {
      expect(hit(HE).flags.fixedExtra ?? 0).toBe(0);
      expect(hit(AR).flags.fixedExtra ?? 0).toBe(0);
    });
  });

  it("As printed: Arjuna's sheet is Revised and Heracles's Classic", async () => {
    await play("asPrinted", (hit) => {
      expect(hit(HE).flags.fixedExtra ?? 0).toBe(0);
      expect(hit(AR).flags.fixedExtra).toBe(40);
    });
  });
});

describe("Mad Enhancement clause 5 (3d)", () => {
  const servant = (printedRevision) => ({
    id: "s", kind: "servant", sustainability: 6,
    abilities: [{ slug: "madEnhancement", active: true, printedRevision }],
  });
  const resources = (out) => out.filter((d) => d.kind === "resource");

  it("Classic: 2◈ at the Master's death, nothing per Turn", () => {
    const out = onMasterDefeated(servant("classic"), { turnsPerRound: 3, revisions: { madEnhancement: "classic" } });
    expect(resources(out)).toEqual([{ kind: "resource", unitId: "s", key: "sustainability", delta: -6 }]);
  });

  it("Revised: nothing at the death, one more Turn lost at every Turn's end from then", () => {
    const out = onMasterDefeated(servant("classic"), { turnsPerRound: 3, revisions: { madEnhancement: "revised" } });
    expect(resources(out)).toEqual([{ kind: "resource", unitId: "s", key: "sustainabilityDecay", delta: 1 }]);
    expect(out).toContainEqual({ kind: "lockModes", unitId: "s", reason: "masterDefeated" });
  });

  it("As printed: Gilles's Revised sheet decays, Heracles's Classic one pays 2◈", () => {
    const asPrinted = { madEnhancement: "asPrinted" };
    expect(resources(onMasterDefeated(servant("revised"), { turnsPerRound: 3, revisions: asPrinted }))[0].key).toBe("sustainabilityDecay");
    expect(resources(onMasterDefeated(servant("classic"), { turnsPerRound: 3, revisions: asPrinted }))[0].key).toBe("sustainability");
  });

  // The line the table reads is named beside the write (#260, live): the
  // death wrote the clock and the decay and said only "No Conquest".
  it("names the clause it played, for the card", () => {
    const rev = onMasterDefeated(servant("classic"), { turnsPerRound: 3, revisions: { madEnhancement: "revised" } });
    expect(rev).toContainEqual({ kind: "note", unitId: "s", note: "madEnhancementRevised" });
    const cls = onMasterDefeated(servant("classic"), { turnsPerRound: 3, revisions: { madEnhancement: "classic" } });
    expect(cls).toContainEqual({ kind: "note", unitId: "s", note: "madEnhancementClassic", turns: 6 });
  });

  it("the clock loses 2 at a Turn's end with the decay, 1 without", () => {
    const unit = (decay) => ({ id: "s", kind: "servant", contract: "free", sustainability: 5, sustainabilityDecay: decay });
    const left = (decay) => checkRemovals([unit(decay)], { tick: 1 })[0].delta;
    expect(left(1)).toBe(3);
    expect(left(0)).toBe(4);
  });
});

describe("Skill Seal ends Presence Concealment and Mad Enhancement under the Revised text (3d, 3j)", () => {
  const verdicts = async (rule, subject, effects = []) => {
    let out;
    await withSubjects([{ ...subject, effects }], async ({ world: w }) => {
      const { sealVerdicts } = await import("../../module/engine/seal-ends.mjs");
      const v = sealVerdicts(w.actor(subject.id));
      out = { ends: v.ends.map((i) => i.system.slug), holds: v.holds.map((h) => [h.item.system.slug, h.why]) };
    }, { combat: { system: { madEnhancementRevision: rule, presenceConcealmentRevision: rule } } });
    return out;
  };
  const HE = { from: "heracles", id: "heraclesSeal0001" };
  const AS = { from: "asterios", id: "asteriosSeal0001" };
  const JACK = { from: "jack-the-ripper", id: "jackSeal00000001" };

  it("Revised: Asterios's Mad Enhancement ends; Classic: it holds", async () => {
    // Switched on as his own press would leave it: the seal ends an Active mode.
    const on = async (rule) => {
      let out;
      await withSubjects([AS], async ({ world: w }) => {
        await w.actor(AS.id).items.find((i) => i.system.slug === "madEnhancement").update({ "system.active": true });
        const { sealVerdicts } = await import("../../module/engine/seal-ends.mjs");
        out = sealVerdicts(w.actor(AS.id)).ends.map((i) => i.system.slug);
      }, { combat: { system: { madEnhancementRevision: rule } } });
      return out;
    };
    expect(await on("revised")).toContain("madEnhancement");
    expect(await on("classic")).not.toContain("madEnhancement");
  });

  // *"Constantly Active. Cannot be deactivated."* `io.setMode` refuses every
  // forced switch on it, so the seal says it held rather than claiming an end
  // that never happens (found pressing #260; Surprise
  // seal-claimed-an-end-setmode-refuses).
  it("Revised: Heracles's Mad Enhancement holds, with its own line", async () => {
    const v = await verdicts("revised", HE);
    expect(v.ends).not.toContain("madEnhancement");
    expect(v.holds).toContainEqual(["madEnhancement", "cannotDeactivate"]);
  });

  it("Revised: Jack's Presence Concealment ends; As printed: his Classic sheet keeps it", async () => {
    const pc = [{ defId: "presenceConcealment" }];
    expect((await verdicts("revised", JACK, pc)).ends).toContain("presenceConcealment");
    expect((await verdicts("asPrinted", JACK, pc)).ends).not.toContain("presenceConcealment");
  });
});
