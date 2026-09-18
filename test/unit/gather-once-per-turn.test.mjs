/**
 * @file Gather is once per Turn, and it is your Move.
 * @see docs/46-roster-re-audit.md §46.4-BA, module/engine/gather.mjs
 *
 * The game's author states **two** rules, and they are separable:
 *
 * > *"A unit can only use Gather once per turn."*
 *
 * > *"Using 'Gather' counts as a Unit's 'Move' for that Turn"* — read strictly:
 * > Gather **is** the Move, so a Unit that has already Moved has no Move left
 * > to spend on one, and a Unit that has Gathered cannot then walk.
 *
 * Both are asserted here, and separately, because the first has to hold on its
 * own. Resting it on the second would leave it at the mercy of `canConsume`'s
 * free-second-non-attack-action rule (D18.3) — which is precisely what let
 * Gather repeat without limit in the first place.
 *
 * Neither was enforced. `poolFor` bills `gather` to the MOVE pool, but the
 * post-attack guard tested `action === "move"` by **name**, so Gather was a Move
 * for costing and not a Move for refusing. Measured live on Semiramis: four
 * `gather()` calls in one Turn, every one `{ok: true, amount: 5}`, Construction
 * **10 → 30** — against a Noble Phantasm gated at 100 that her sheet spends six
 * sources and many Rounds reaching. Available to any allied Unit, so a faction
 * could stack it.
 */

import { describe, it, expect } from "vitest";

import { canConsume, poolFor } from "../../module/rules/budget.mjs";
import { TURN_RECORD } from "../../module/domain/stamped-record.mjs";

/** Pools with room to spare, so only the per-unit rules can refuse. */
const roomy = {
  pools: {
    servantAttack: { usedHalves: 0, maxHalves: 8 },
    servantMove: { usedHalves: 0, maxHalves: 8 },
  },
  countedUnits: [],
  attackedUnits: [],
};

const unit = (turnState) => ({ id: "s", kind: "servant", factionId: "f1", turnState: { tick: 1, ...turnState } });

describe("Gather is once per Turn — rule 1, on its own", () => {
  it("refuses a second Gather", () => {
    const verdict = canConsume(roomy, unit({ gathered: true, moved: true, attacked: true }), "gather");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("this unit has already gathered this turn");
  });

  it("refuses it even when the move pool has room and the unit is already counted", () => {
    // This is the shape that made it unbounded: `alreadyCounted` returns
    // `{ok: true, free: true}` for a second non-attack action, so the pool was
    // no brake at all.
    const counted = { ...roomy, countedUnits: ["s"] };
    expect(canConsume(counted, unit({ gathered: true, moved: true, attacked: true }), "gather").ok)
      .toBe(false);
  });

  it("refuses it on the strength of `gathered` alone", () => {
    // Rule 1 must not depend on rule 2. If `moved` were somehow clear, the
    // second Gather is still refused.
    expect(canConsume(roomy, unit({ gathered: true, moved: false, attacked: false }), "gather").ok)
      .toBe(false);
  });

  it("allows the first one", () => {
    expect(canConsume(roomy, unit({ gathered: false, moved: false, attacked: false }), "gather").ok)
      .toBe(true);
  });
});

describe("Gather is your Move — rule 2, strict", () => {
  it("refuses Gather to a unit that has already Moved", () => {
    const verdict = canConsume(roomy, unit({ moved: true, gathered: false, attacked: false }), "gather");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("this unit has moved and cannot gather this turn");
  });

  it("refuses Move to a unit that has Gathered", () => {
    const verdict = canConsume(roomy, unit({ gathered: true, moved: true, attacked: false }), "move");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("this unit gathered and cannot move again");
  });

  it("still bills Gather to the move pool, which is what makes it the Move", () => {
    expect(poolFor(unit({}), "gather")).toBe(poolFor(unit({}), "move"));
  });
});

describe("the rest of the budget is unchanged", () => {
  it("a second Skill is still free — D18.3 is not repealed", () => {
    const counted = { ...roomy, countedUnits: ["s"] };
    expect(canConsume(counted, unit({ moved: true, attacked: false }), "skill"))
      .toMatchObject({ ok: true, free: true });
  });

  it("a unit that has only attacked can still not Move, for its own reason", () => {
    expect(canConsume(roomy, unit({ attacked: true, moved: false, gathered: false }), "move").reason)
      .toBe("this unit has attacked and cannot move again");
  });
});

describe("the flag survives a Turn boundary the way every other one does", () => {
  it("is declared on the Turn Record, so it is stale-by-reading", () => {
    // A record stamped with an earlier tick reads as blank; nothing has to
    // reset `gathered`, for the same reason nothing resets `attacked`.
    expect(TURN_RECORD.fields).toHaveProperty("gathered", false);
    expect(TURN_RECORD.stamp).toBe("tick");
  });
});
