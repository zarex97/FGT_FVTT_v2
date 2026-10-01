/**
 * @file Riding's Active: a cooldown on entry, and "this Turn" really ends with the Turn.
 * @see module/rules/modes.mjs, module/engine/modes.mjs, docs/17-abilities.md, docs/24-modes-and-control.md
 *
 * > *"(Active) Used during your Turn. Increases MOV by 6 panels for this Turn.
 * > Cooldown: 3◈ Turns."*
 *
 * The code did neither half. Riding's Active is an `activeRules` ability with no
 * `phases`, so `classifyAbility` calls it a **mode**, and a mode's toggle called
 * `useSkill` only when it had phases -- so the cooldown the sheet states was
 * never gated, never billed and never started. And the `MovDelta`'s
 * `duration: "this turn"` was copied into `statDeltas` and stopped there
 * (`rules/derived.mjs`: *"duration governs when the SOURCE goes away"*, and the
 * source is `system.active`, which nothing switched off). One press gave +6 MOV
 * through the enemy's Turns and into her next one, and she could press it again
 * at will.
 *
 * Every Subject here is authored content through the real projection
 * (`test/helpers/subject.mjs`), because the defect lived in the second hop of a
 * key the rule-survival guard counts as read.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { loadSource } from "../../tools/lib/load.mjs";
import { compileDocument } from "../../tools/lib/content.mjs";
import { pricedOnEntry, endsWithTurn } from "../../module/rules/modes.mjs";
import { classifyAbility, usageSpecFor } from "../../module/rules/ability-use.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";

beforeAll(prepareSubjects, 60_000);

/** One of a Subject's abilities, by slug. */
const abilityOf = (world, actorId, slug) =>
  world.actor(actorId).items.find((i) => i.system?.slug === slug);

describe("a mode that is priced on entry", () => {
  it("is true for Quetzalcoatl's Riding, which states a 3◈ cooldown and no phases", async () => {
    await withSubjects([{ from: "quetzalcoatl" }], ({ world }) => {
      const riding = abilityOf(world, "quetzalcoatl", "riding");
      expect(classifyAbility(riding).kind).toBe("mode");
      expect(riding.system.phases).toEqual([]);
      expect(riding.system.cooldown.max).toBe("3◈");
      expect(pricedOnEntry(riding)).toBe(true);
    });
  });

  it("is false for Mad Enhancement, which is a free switch", async () => {
    await withSubjects([{ from: "asterios" }], ({ world }) => {
      const mad = abilityOf(world, "asterios", "madEnhancement");
      expect(classifyAbility(mad).kind).toBe("mode");
      expect(pricedOnEntry(mad)).toBe(false);
    });
  });

  it("stays true for a mode with phases, as it always was", async () => {
    // Mannanán's God's Holder: Possession and Nemo's Zero Sail are used, and
    // the toggle has always gone through `useSkill` for them.
    await withSubjects([{ from: "mannanan" }], ({ world }) => {
      const holder = world.actor("mannanan").items.find((i) => i.system?.slug === "godsHolderPossession"
        || i.system?.contentId === "mannanan-gods-holder-possession");
      expect(pricedOnEntry(holder)).toBe(true);
    });
  });

  it("is false for a clock that starts when the mode ENDS, which is not an entry price", () => {
    // `countFrom: deactivation` is Presence Concealment's, Zero Sail's and
    // Tenmōkaikai's -- "Cooldown: 5◈ AFTER Nemo resurfaces". Those three all
    // have phases and are priced for that reason; a phase-less mode that
    // carried one would start its clock at the END, so it has no price here.
    const afterwards = { system: { phases: [], cooldown: { max: "5◈", countFrom: "deactivation" } } };
    expect(pricedOnEntry(afterwards)).toBe(false);
    expect(pricedOnEntry({ system: { phases: [], cooldown: { max: "5◈" } } })).toBe(true);
  });
});

describe("a mode whose duration is this Turn", () => {
  /** Every mode a Unit in the real corpus carries, as the compile leaves it. */
  async function corpusModes() {
    const { files } = await loadSource("packs/_source");
    const docs = new Map(files.filter((f) => f.doc?.id).map((f) => [f.doc.id, f.doc]));
    const out = new Map();
    for (const f of files.filter((x) => ["servants", "masters", "summons", "platforms"].includes(x.dir))) {
      for (const item of compileDocument(f.doc, f.dir, docs).items ?? []) {
        if (classifyAbility(item).kind !== "mode") continue;
        out.set(item.system?.contentId ?? item.name, item);
      }
    }
    return out;
  }

  it("is exactly the three Riding documents that author it, and no other mode", async () => {
    const modes = await corpusModes();
    const ending = [...modes].filter(([, item]) => endsWithTurn(item)).map(([id]) => id).sort();
    expect(ending).toEqual(["class-riding", "class-riding-achilles", "pale-rider-riding"]);
    // ...and the corpus really holds other modes for that to be a distinction.
    expect([...modes.keys()].length).toBeGreaterThan(ending.length);
  }, 60_000);

  it("is judged from the real projection of Quetzalcoatl's Riding", async () => {
    await withSubjects([{ from: "quetzalcoatl" }], ({ world }) => {
      expect(endsWithTurn(abilityOf(world, "quetzalcoatl", "riding"))).toBe(true);
    });
  });
});

describe("the end of a Turn switches off a mode whose duration was this Turn", () => {
  /** What the scheduler asks at the end of the Turn at `tick`, applied for real. */
  async function endTurnAt(tick, specs, arrange) {
    return withSubjects(specs, async ({ world, board }) => {
      await arrange(world);
      const { turnEndModeIntents } = await import("../../module/engine/modes.mjs");
      const { applyIntents } = await import("../../module/engine/applier.mjs");
      const { worldIO } = await import("../../module/engine/io.mjs");
      const intents = turnEndModeIntents(board.units, tick);
      await applyIntents(intents, { io: worldIO(), canWrite: () => true, isGM: true, source: "test" });
      return { intents, world };
    });
  }

  const riding = (world) => abilityOf(world, "quetzalcoatl", "riding");
  const pressedAt = (toggledAt) => async (world) => {
    await riding(world).update({ "system.active": true, "system.toggledAt": toggledAt });
  };

  it("at the end of the Turn it was switched on in", async () => {
    const { intents, world } = await endTurnAt(10, [{ from: "quetzalcoatl" }], pressedAt(10));
    expect(intents).toHaveLength(1);
    expect(riding(world).system.active).toBe(false);
  });

  it("not at the end of an EARLIER Turn, which is not the one it ran through", async () => {
    const { intents, world } = await endTurnAt(9, [{ from: "quetzalcoatl" }], pressedAt(10));
    expect(intents).toEqual([]);
    expect(riding(world).system.active).toBe(true);
  });

  it("at the end of any later Turn too, so a mode left on cannot outlive its Turn", async () => {
    const { world } = await endTurnAt(14, [{ from: "quetzalcoatl" }], pressedAt(10));
    expect(riding(world).system.active).toBe(false);
  });

  it("takes her MOV back with it", async () => {
    // The point of the clause: +6 for this Turn, not for the enemy's Turns.
    const { world } = await endTurnAt(10, [{ from: "quetzalcoatl" }], async (w) => {
      await pressedAt(10)(w);
      expect(w.actor("quetzalcoatl").system.mov).toBe(13);
    });
    expect(world.actor("quetzalcoatl").system.mov).toBe(7);
  });

  it("leaves a mode with no duration alone", async () => {
    const { intents, world } = await endTurnAt(10, [{ from: "asterios" }], async (w) => {
      await abilityOf(w, "asterios", "madEnhancement").update({ "system.active": true, "system.toggledAt": 10 });
    });
    expect(intents).toEqual([]);
    expect(abilityOf(world, "asterios", "madEnhancement").system.active).toBe(true);
  });

  it("leaves a mode that is already off alone", async () => {
    const { intents } = await endTurnAt(10, [{ from: "quetzalcoatl" }], async () => {});
    expect(intents).toEqual([]);
  });
});

describe("the entry price, once paid", () => {
  /** The gate, asked of the real document the way `useSkill` asks it. */
  const gate = (world, unit) => canUseAbility({
    ability: usageSpecFor(abilityOf(world, "quetzalcoatl", "riding")), unit, round: 5, turnsPerRound: 3,
  });

  it("starts a 3◈ clock that is 9 Turns at three Turns a Round, and refuses a second switch on", async () => {
    await withSubjects([{ from: "quetzalcoatl" }], async ({ world, unit }) => {
      const { cooldownFor } = await import("../../module/engine/cooldown.mjs");
      const { applyIntents } = await import("../../module/engine/applier.mjs");
      const { worldIO } = await import("../../module/engine/io.mjs");
      const I = await import("../../module/engine/intents.mjs");
      const item = abilityOf(world, "quetzalcoatl", "riding");

      expect(gate(world, unit("quetzalcoatl")).ok).toBe(true);

      const plan = cooldownFor(item, "quetzalcoatl");
      expect(plan.cooldowns.map((c) => c.ticks)).toEqual([9]);
      await applyIntents(
        plan.cooldowns.map((c) => I.cooldown(c.actorId, c.abilityId, c.ticks, "set")),
        { io: worldIO(), canWrite: () => true, isGM: true, source: "test" },
      );

      expect(item.system.cooldown.remaining).toBe(9);
      const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
      const refused = gate(world, snapshotUnit(world.actor("quetzalcoatl"), { panel: null }));
      expect(refused).toMatchObject({ ok: false, reason: "cooldown", detail: { remaining: 9 } });
    });
  });
});

describe("the sheet's toggle", () => {
  it("asks `pricedOnEntry` rather than testing for phases itself", () => {
    // `sheet.mjs` is ApplicationV2 and cannot be imported in Node, so the
    // wiring is held as text -- the gate it calls is held above.
    const src = readFileSync("module/apps/actor-sheet/sheet.mjs", "utf8");
    expect(src).toMatch(/pricedOnEntry\(item\)/);
    expect(src).not.toMatch(/active && \(item\.system\?\.phases \?\? \[\]\)\.length > 0/);
  });

  it("is where the scheduler asks the Turn-end sweep", () => {
    const src = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");
    expect(src).toMatch(/turnEndModeIntents/);
  });
});
