/**
 * @file A Skill marked "Used during your Turn" cannot be used on another Player's Turn (#160).
 * @see module/rules/costs.mjs, module/rules/windows.mjs, docs/17-abilities.md, docs/19-action-economy.md
 *
 * > *"(Active) Used during your Turn."* -- Quetzalcoatl's Lucha Libre, and the
 * > content authors `timing: { window: ownTurn }`.
 *
 * Found live: on Faction 2's Turn, Lucha Libre was pressed from her action bar
 * and resolved -- Crit Up and Crit DmUp on her, its Cooldown set. `ownTurn` was
 * read in exactly one place, `rules/modes.mjs#canToggleMode`, so it gated Modes
 * and nothing else; `rules/windows.mjs` called the window "documentary" and
 * `canUseAbility` had no turn-owner test, so the action bar showed the slot lit
 * on the enemy's Turn. 142 content files author the window, most of them Actives.
 *
 * Built through `test/helpers/subject.mjs`: the window is authored in content and
 * has to survive the compile, the DataModel and `usageSpecFor` to reach the gate.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";
import { usedOnlyDuringOwnTurn } from "../../module/rules/windows.mjs";

beforeAll(prepareSubjects, 60_000);

/** One of a Subject's abilities, by slug or content id. */
const abilityOf = (world, actorId, key) =>
  world.actor(actorId).items.find((i) => i.system?.slug === key || i.system?.contentId === key);

/** The use gate, asked of the real document the way `useSkill` asks it. */
const gate = (item, unit, ctx = {}) => canUseAbility({
  ability: usageSpecFor(item), unit, round: 5, turnsPerRound: 3, ...ctx,
});

const lucha = (fn) => withSubjects(
  [{ from: "quetzalcoatl", state: { factionId: "red" } }],
  ({ world, unit }) => fn(abilityOf(world, "quetzalcoatl", "luchaLibre"), unit("quetzalcoatl"), world),
);

describe("Lucha Libre, which is used during its owner's Turn", () => {
  it("is authored with the window the gate reads", async () => {
    await lucha((item) => {
      expect(item.system.timing.window).toBe("ownTurn");
      expect(usageSpecFor(item).timing.window).toBe("ownTurn");
      expect(usedOnlyDuringOwnTurn(usageSpecFor(item))).toBe(true);
    });
  });

  it("is refused while another faction's Turn is running", async () => {
    await lucha((item, unit) => {
      expect(gate(item, unit, { actingFactionId: "blue" }))
        .toMatchObject({ ok: false, reason: "notOwnTurn" });
    });
  });

  it("is allowed on its owner's Turn", async () => {
    await lucha((item, unit) => {
      expect(gate(item, unit, { actingFactionId: "red" }).ok).toBe(true);
    });
  });

  it("asks nothing when no faction's Turn is running -- the GM's own slot, or no match", async () => {
    // The same answer `canToggleMode` gives: a table with no acting faction has
    // no "somebody else's Turn" to be on.
    await lucha((item, unit) => {
      expect(gate(item, unit, { actingFactionId: null }).ok).toBe(true);
      expect(gate(item, unit, {}).ok).toBe(true);
    });
  });

  it("follows a charmed Unit to the Turn it acts on", async () => {
    // Ch. 25: a charmed Unit acts on its CHARMER's Turn, and `actingFactionId`
    // is the annotation `rules/control.mjs` puts on the board's Units for it.
    await lucha((item, unit) => {
      const charmed = { ...unit, actingFactionId: "blue" };
      expect(gate(item, charmed, { actingFactionId: "blue" }).ok).toBe(true);
      expect(gate(item, charmed, { actingFactionId: "red" })).toMatchObject({ ok: false, reason: "notOwnTurn" });
    });
  });

  it("is not asked of a Counter, which is made on the enemy's Turn by definition", async () => {
    await lucha((item, unit) => {
      expect(gate(item, unit, { actingFactionId: "blue", isCounter: true }).ok).toBe(true);
    });
  });

  it("says why, with a reason the action bar has a string for", async () => {
    const { readFileSync } = await import("node:fs");
    const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
    expect(lang["FGT.Ability.Refused.notOwnTurn"]).toMatch(/Turn/);
  });
});

describe("an ability that names another moment as well", () => {
  it("is not refused: Medea's Argos is used during her Turn OR when she is Attacked", async () => {
    // `[ownTurn, whenAttacked]`. The use is made at one window or the other and
    // this gate cannot tell which, so it asks only of an ability whose ONLY
    // moment is its owner's Turn.
    await withSubjects([{ from: "medea", state: { factionId: "red" } }], ({ world, unit }) => {
      const argos = abilityOf(world, "medea", "medea-argos");
      expect(argos.system.timing.window).toEqual(["ownTurn", "whenAttacked"]);
      expect(usedOnlyDuringOwnTurn(usageSpecFor(argos))).toBe(false);
      expect(gate(argos, unit("medea"), { actingFactionId: "blue" }).ok).toBe(true);
    });
  });

  it("is not refused when it names no window at all", () => {
    expect(usedOnlyDuringOwnTurn({ timing: null })).toBe(false);
    expect(usedOnlyDuringOwnTurn({})).toBe(false);
    expect(usedOnlyDuringOwnTurn({ timing: { window: [] } })).toBe(false);
  });
});

describe("the gate's context", () => {
  it("`gateContext` names the faction whose Turn it is", async () => {
    await withSubjects([{ from: "quetzalcoatl" }], async ({ world }) => {
      const { gateContext } = await import("../../module/engine/board.mjs");
      world.combat.actingFactionId = "blue";
      expect(gateContext().actingFactionId).toBe("blue");
      world.combat.actingFactionId = null;
      expect(gateContext().actingFactionId).toBeNull();
    });
  });

  it("names none before the match has started", async () => {
    await withSubjects([{ from: "quetzalcoatl" }], async ({ world }) => {
      const { gateContext } = await import("../../module/engine/board.mjs");
      world.combat.actingFactionId = "blue";
      world.combat.started = false;
      expect(gateContext().actingFactionId).toBeNull();
    });
  });
});
