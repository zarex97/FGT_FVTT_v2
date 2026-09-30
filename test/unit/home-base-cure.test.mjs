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

import { endOfRoundHomeBase } from "../../module/rules/environment.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

// Built through `test/helpers/subject.mjs`: Semiramis from the real corpus, her
// effects as real ActiveEffects, and the registry loaded from the real effect
// definitions -- `burn` a debuff, `atkUp` a buff, `hgob-owner-buff` an
// unremovable status. This file used to write its own registry and its own
// actor, which is the shape that hid this defect: a fixture can only prove the
// half of the path below it.

/** A resident of her own Home Base, three full Rounds in, carrying `effects`. */
const resident = (effects) => ({
  from: "semiramis",
  id: "semiramis",
  panel: { i: 0, j: 0 },
  effects,
  state: {
    factionId: "red",
    homeBase: { consecutiveRounds: 3 },
    roundState: { round: 1, abilitiesUsed: [], combatInBaseThisRound: true },
  },
});

/** A board whose only Home Base zone is her own. */
const zones = { red: { faction: "red", panels: [{ i: 0, j: 0 }] } };

/** Her projected effect instances. */
const instances = (effects) => withSubjects([resident(effects)], ({ units }) => units[0].effectInstances, { round: 1 });

/** Which effects the cure would take off her. */
const cured = (effects) => withSubjects([resident(effects)], ({ board, world }) => endOfRoundHomeBase(board.units, board)
  .filter((d) => d.kind === "removeEffect")
  .map((d) => world.actor("semiramis").effects.get(d.effectId)?.system.defId),
{ round: 1, settings: { zones } });

describe("the effect instances the projection hands the cure", () => {
  it("says whether an instance is unremovable", async () => {
    const [e] = await instances([{ defId: "hgob-owner-buff", unremovable: true }]);
    expect(e.unremovable).toBe(true);
  });

  it("says what polarity an instance has, from its definition", async () => {
    const [e] = await instances([{ defId: "burn" }]);
    expect(e.polarity).toBe("debuff");
  });

  it("lets the instance's own unremovable flag win where the definition is silent", async () => {
    // The owner buff is landed by an intent that says `unremovable: true`; a
    // definition that says nothing must not undo that.
    const [e] = await instances([{ defId: "dove", unremovable: true }]);
    expect(e.unremovable).toBe(true);
  });
});

describe("endOfRoundHomeBase, given what the projection actually carries", () => {
  it("cures a debuff", async () => {
    expect(await cured([{ defId: "burn" }])).toEqual(["burn"]);
  });

  it("leaves a buff alone", async () => {
    // Three Rounds at home is a rest, not a dispel of your own Skills.
    expect(await cured([{ defId: "atkUp" }])).toEqual([]);
  });

  it("leaves an unremovable neutral status alone", async () => {
    // The measured case: Semiramis aboard her own Hanging Gardens.
    expect(await cured([{ defId: "hgob-owner-buff", unremovable: true }])).toEqual([]);
  });

  it("takes the debuff and leaves the rest, in the same sweep", async () => {
    expect(await cured([
      { defId: "burn" },
      { defId: "atkUp" },
      { defId: "hgob-owner-buff", unremovable: true },
    ])).toEqual(["burn"]);
  });
});
