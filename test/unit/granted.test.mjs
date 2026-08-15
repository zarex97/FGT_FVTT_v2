/**
 * @file Granted abilities — making `grantedAbilities` a live input.
 * @see docs/15-abilities.md §15.7, docs/45-implementation-status.md B3
 *
 * `GrantedAbility` collected ability ids into `grantedAbilities` and nothing
 * read the bucket. Riding's double move *did* work — but through a separate
 * `hasSkill(actor, "riding")` name-match, so the grant and the capability were
 * two mechanisms for one rule, one of them inert.
 *
 * That split is the defect. A Servant granted the double move by anything other
 * than the Riding class skill would not get it, and every future granted
 * capability would need its own bespoke name-match.
 */

import { describe, it, expect } from "vitest";
import { collectContributions } from "../../module/rules/elements.mjs";
import { hasGranted, GRANTS } from "../../module/rules/granted.mjs";
import { planMovement } from "../../module/rules/movement.mjs";
import { canConsume, emptyBudget } from "../../module/rules/budget.mjs";

/** The Riding class skill, as authored in `packs/_source/class-skills/riding.yml`. */
const riding = {
  id: "class-riding", name: "Riding", rank: "B",
  passiveRules: [{ key: "GrantedAbility", abilities: ["doubleMove", "ridingAttack", "passengerSeat"] }],
};

const grantsOf = (abilities) => collectContributions(abilities).grantedAbilities;

describe("GrantedAbility collection", () => {
  it("grants Riding's three passives to a Servant that has it", () => {
    expect(grantsOf([riding])).toEqual(["doubleMove", "ridingAttack", "passengerSeat"]);
  });

  it("grants nothing to a Servant without it", () => {
    expect(grantsOf([{ id: "x", name: "Something Else", rank: "B", passiveRules: [] }])).toEqual([]);
  });

  it("accepts the singular form as well as the list", () => {
    expect(grantsOf([{ id: "y", name: "Y", rank: "B", passiveRules: [{ key: "GrantedAbility", ability: "doubleMove" }] }]))
      .toEqual(["doubleMove"]);
  });
});

describe("hasGranted", () => {
  const withRiding = { grantedAbilities: grantsOf([riding]) };

  it("reports a capability the unit was granted", () => {
    expect(hasGranted(withRiding, GRANTS.doubleMove)).toBe(true);
  });

  it("reports the absence of one it was not", () => {
    expect(hasGranted({ grantedAbilities: [] }, GRANTS.doubleMove)).toBe(false);
  });

  it("is safe on a unit with no grants at all", () => {
    expect(hasGranted({}, GRANTS.doubleMove)).toBe(false);
  });
});

/* ========================================================================== */
/*  The readers — proving the bucket is no longer inert                       */
/* ========================================================================== */

describe("the double move reads the grant", () => {
  const board = { bounds: { rows: 13, columns: 13 }, units: [] };
  const unit = (grants) => ({
    id: "u", panel: { i: 5, j: 5 }, mov: 4, faction: "a",
    grantedAbilities: grants,
    turnState: { movedPanels: 0, moveSegments: 0, attacked: false },
  });

  it("allows a second movement segment when doubleMove is granted", () => {
    expect(planMovement(unit(["doubleMove"]), board).maxSegments).toBe(2);
  });

  it("allows only one segment without it", () => {
    expect(planMovement(unit([]), board).maxSegments).toBe(1);
  });

  it("lets a unit that has attacked move again when doubleMove is granted", () => {
    // "The Servant is able to Move twice in one turn if it Attacks in between."
    const attacked = {
      ...unit(["doubleMove"]),
      turnState: { attacked: true, moved: true, moveSegments: 1, movedPanels: 1 },
    };

    expect(canConsume(emptyBudget(), attacked, "move")).toMatchObject({ ok: true });
  });

  it("refuses the second move to a unit that was not granted it", () => {
    const attacked = {
      ...unit([]),
      turnState: { attacked: true, moved: true, moveSegments: 1, movedPanels: 1 },
    };

    expect(canConsume(emptyBudget(), attacked, "move")).toMatchObject({ ok: false });
  });
});
