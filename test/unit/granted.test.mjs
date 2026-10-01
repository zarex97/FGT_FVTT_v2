/**
 * @file Granted abilities — making `grantedAbilities` a live input.
 * @see docs/17-abilities.md, docs/46-roster-re-audit.md B3
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

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { collectContributions } from "../../module/rules/elements.mjs";
import { hasGranted, GRANTS } from "../../module/rules/granted.mjs";
import { planMovement, segmentCheck } from "../../module/rules/movement.mjs";
import { canConsume, emptyBudget } from "../../module/rules/budget.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

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

/* ========================================================================== */
/*  The drag gate asks the grant, not the item's name (#117)                  */
/* ========================================================================== */

// `onPreMove` handed `validatePath` `unit.hasRiding`, which is `hasSkill(actor,
// "riding")` -- an item slug or lowercase name. So the gate asked "is there an
// item called Riding" while `planMovement` and `canConsume` (half of it) asked
// the grant, and the two disagreed for exactly the Servants whose Riding does not
// grant Double Move all the time: Pollux and Drake (only on the Turn of the
// Active, `self:effect:ridingActive`) and Pale Rider (never).
//
// Built through the real projection, because the drift is between the grant a
// content file authors and the name of the item that carries it.

describe("the drag gate after an Attack", () => {
  /** What the gate says to a Unit that has Attacked and has not Moved. */
  const gate = (spec) => withSubjects([{
    ...spec,
    state: { ...(spec.state ?? {}), turnState: { attacked: true, movedPanels: 0 } },
  }], ({ units }) => segmentCheck(units[0]));
  // `null` is "may move", so a refusal is asserted as the text it should be.
  const refusal = async (spec) => String(await gate(spec));

  it("refuses Pollux while her Riding Active is not in force", async () => {
    // "'Double Move', 'Riding Attack' and 'Passenger Seat' can be used ON THIS
    // TURN" -- the Turn of the Active, and no other.
    expect(await refusal({ from: "pollux" })).toMatch(/cannot Move again/);
  });

  it("allows Pollux on the Turn of her Active", async () => {
    expect(await gate({ from: "pollux", effects: [{ defId: "ridingActive" }] })).toBeNull();
  });

  it("refuses Pale Rider, whose Riding grants none of the three", async () => {
    expect(await refusal({ from: "pale-rider" })).toMatch(/cannot Move again/);
  });

  it("allows Quetzalcoatl, whose Riding grants Double Move for good", async () => {
    expect(await gate({ from: "quetzalcoatl" })).toBeNull();
  });

  it("allows Achilles, who holds Double Move on foot as well", async () => {
    expect(await gate({ from: "achilles" })).toBeNull();
  });

  it("allows a Unit granted Double Move by something that is not called Riding", async () => {
    // The converse: the name match let a grant from another item through only
    // because the bearer also held a Riding item. A Unit that carries the grant
    // and no Riding at all is still believed.
    const wings = {
      type: "servant", id: "wyvern-rider", name: "Wyvern Rider", servantClasses: ["rider"], mov: 6,
      parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
      abilities: [{
        id: "wing-flight", name: "Wing Flight", source: "class",
        passiveRules: [{ key: "GrantedAbility", abilities: ["doubleMove"] }],
      }],
    };
    expect(await gate({ from: wings })).toBeNull();
  });

  it("reads the grant at the budget too, so the two gates cannot disagree", async () => {
    const verdicts = await withSubjects([
      { from: "pollux", id: "pollux", state: { turnState: { attacked: true, moved: true, moveSegments: 1, movedPanels: 1 } } },
      { from: "quetzalcoatl", id: "quetzalcoatl", state: { turnState: { attacked: true, moved: true, moveSegments: 1, movedPanels: 1 } } },
    ], ({ units }) => units.map((u) => canConsume(emptyBudget(), u, "move").ok));
    expect(verdicts).toEqual([false, true]);
  });
});

describe("the name match is gone", () => {
  /** @param {string} dir @returns {string[]} */
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path);
    return e.name.endsWith(".mjs") ? [path] : [];
  });

  it("leaves no `hasRiding` anywhere under module/", () => {
    const left = files("module").filter((f) => /hasRiding/.test(readFileSync(f, "utf8")));
    expect(left).toEqual([]);
  });
});
