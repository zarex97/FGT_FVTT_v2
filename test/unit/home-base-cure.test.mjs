/**
 * @file What the Home Base's three-Round cure is allowed to take.
 * @see docs/46-roster-re-audit.md §46.4-BC, docs/29-environment.md
 *
 * > *"A Unit that has spent three full Rounds in its own Home Base is cured of
 * > every removable debuff."*
 *
 * `rules/environment.mjs#endOfRoundHomeBase` states that correctly and always
 * has — it skips an instance that is `unremovable`, and it skips anything whose
 * `polarity` is not `debuff`. **Neither field was ever projected onto an effect
 * instance.** Both guards therefore read `undefined`, neither could ever fire,
 * and the cure took every effect a resident carried: buffs, neutral statuses
 * and unremovable ones alike.
 *
 * Found live on the Semiramis audit board. Her Hanging Gardens counts as her
 * Faction's **second Home Base**, so standing aboard her own Noble Phantasm
 * made her a permanent resident — and three Rounds after activating it she lost
 * `hgob-owner-buff`, which is `unremovable: true`, `polarity: status`, and has
 * no expiry. Her Parameters, Health, Base Attack, MOV, Agility and Luck all
 * fell back to their unbuffed values in silence, which is why the same board
 * had shown a garden flying with an unbuffed owner aboard it and nobody could
 * say when it had happened.
 *
 * The test runs the projection and the rule together on purpose. Either half
 * alone passes: the rule is right, and the projection looks complete until you
 * ask it the two questions the rule asks.
 */

import { describe, it, expect, beforeAll } from "vitest";

import { snapshotUnit } from "../../module/rules/snapshot.mjs";
import { endOfRoundHomeBase } from "../../module/rules/environment.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";

beforeAll(() => {
  EffectRegistry.load([
    { name: "Burn", system: { contentId: "burn", polarity: "debuff" } },
    { name: "Atk Up", system: { contentId: "atkUp", polarity: "buff" } },
    {
      name: "Aboard the Hanging Gardens",
      system: { contentId: "hgob-owner-buff", polarity: "status", unremovable: true },
    },
    { name: "Dove", system: { contentId: "dove", polarity: "status" } },
  ]);
});

/** An actor carrying the given effect instances. */
const bearer = (instances) => ({
  id: "semiramis", uuid: "Actor.semiramis", name: "Semiramis", type: "servant",
  system: { factionId: "red", range: { panels: 3, targets: 1 } },
  items: [],
  effects: instances.map((e, n) => ({
    id: `e${n}`, disabled: false, isSuppressed: false, system: e,
  })),
});

/** A resident who has been home long enough for E2 to fire. */
const resident = (unit) => ({
  ...unit,
  homeBase: { consecutiveRounds: 3, combatInBaseThisRound: true },
});

/** A board whose only Home Base zone is this unit's own. */
const board = { zones: { red: { faction: "red", panels: [{ i: 0, j: 0 }] } } };
const seated = (unit) => ({ ...unit, panel: { i: 0, j: 0 }, faction: "red" });

/** Which effects the cure would take off this unit. */
const cured = (unit) => endOfRoundHomeBase([resident(seated(unit))], board)
  .filter((d) => d.kind === "removeEffect")
  .map((d) => d.effectId);

describe("the effect instances the projection hands the cure", () => {
  it("says whether an instance is unremovable", () => {
    const unit = snapshotUnit(bearer([{ defId: "hgob-owner-buff", unremovable: true }]));
    expect(unit.effectInstances[0].unremovable).toBe(true);
  });

  it("says what polarity an instance has, from its definition", () => {
    const unit = snapshotUnit(bearer([{ defId: "burn" }]));
    expect(unit.effectInstances[0].polarity).toBe("debuff");
  });

  it("lets the instance's own unremovable flag win where the definition is silent", () => {
    // The owner buff is landed by an intent that says `unremovable: true`; a
    // definition that says nothing must not undo that.
    const unit = snapshotUnit(bearer([{ defId: "dove", unremovable: true }]));
    expect(unit.effectInstances[0].unremovable).toBe(true);
  });
});

describe("endOfRoundHomeBase, given what the projection actually carries", () => {
  it("cures a debuff", () => {
    expect(cured(snapshotUnit(bearer([{ defId: "burn" }])))).toEqual(["e0"]);
  });

  it("leaves a buff alone", () => {
    // Three Rounds at home is a rest, not a dispel of your own Skills.
    expect(cured(snapshotUnit(bearer([{ defId: "atkUp" }])))).toEqual([]);
  });

  it("leaves an unremovable neutral status alone", () => {
    // The measured case: Semiramis aboard her own Hanging Gardens.
    expect(cured(snapshotUnit(bearer([{ defId: "hgob-owner-buff", unremovable: true }])))).toEqual([]);
  });

  it("takes the debuff and leaves the rest, in the same sweep", () => {
    const unit = snapshotUnit(bearer([
      { defId: "burn" },
      { defId: "atkUp" },
      { defId: "hgob-owner-buff", unremovable: true },
    ]));
    expect(cured(unit)).toEqual(["e0"]);
  });
});
