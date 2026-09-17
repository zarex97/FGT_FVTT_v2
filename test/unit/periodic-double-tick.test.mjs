/**
 * @file A widened periodic at a boundary that satisfies both its triggers.
 * @see module/engine/scheduler.mjs, docs/46-roster-re-audit.md §46.4-AJ
 *
 * Sikera Ušum clause c: *"Units inflicted with Poison while within this NP area
 * receive Poison damage **at the end of its Turn and at the end of any Turn it
 * Acts**, in addition to at the end of the Round."*
 *
 * Three occasions, and two of them coincide constantly: a Unit acting on its
 * own Turn is the ordinary case. `endTurn` makes two `tickPeriodics` calls at
 * one boundary — `("turnEnd", every unit)` and `("actedTurnEnd", the ones that
 * acted)` — and the widened instance answers both. The `turnEnd` branch is
 * gated on `u.factionId === ctx.activeFactionId`, which is the *"end of ITS
 * Turn"* reading and correct; the `actedTurnEnd` branch had no matching gate.
 *
 * So a Servant poisoned inside the Throne Room, acting on its own Turn, took
 * the tick **twice**. Measured live at stage 1: **40** where §A.12's curve and
 * `periodicDamageFor` both say 20, reproducible across runs, with a single
 * instance and a single override on the unit. The common case was double and
 * the rare one — acting during an enemy's Turn, i.e. reacting — was single,
 * which inverts the clause.
 *
 * The cure reads like the sheet: the acted branch covers *"any Turn it Acts"*
 * that is **not its own**, because its own is already the first clause.
 */

import { describe, it, expect } from "vitest";
import { tickPeriodics } from "../../module/engine/scheduler.mjs";

const OVERRIDE = { effectId: "poison", triggers: ["turnEnd", "actedTurnEnd"], source: "semiramis-sikera-usum" };

const unit = ({ faction = "f1", acted = false }) => ({
  id: "u", factionId: faction, acted,
  effects: [], effectInstances: [{ defId: "poison", stage: 1, expiry: null }],
  periodicOverrides: [OVERRIDE],
});

const ctx = { tick: 10, activeFactionId: "f1", effectDef: () => null };

/** Both calls `endTurn` makes at one boundary, as it makes them. */
function boundary(u) {
  return [
    ...tickPeriodics([u], "turnEnd", ctx),
    ...tickPeriodics([u].filter((x) => x.acted), "actedTurnEnd", ctx),
  ];
}

describe("a widened periodic ticks once per boundary", () => {
  it("does not tick twice for a unit acting on its OWN Turn", () => {
    const out = boundary(unit({ faction: "f1", acted: true }));
    expect(out).toHaveLength(1);
    expect(out[0].amount ?? out[0].value).toBe(20);
  });

  it("still ticks for a unit acting during somebody ELSE's Turn", () => {
    // The clause's second occasion, and the only one the acted branch is for.
    expect(boundary(unit({ faction: "f2", acted: true }))).toHaveLength(1);
  });

  it("still ticks at the end of its own Turn when it did not act", () => {
    expect(boundary(unit({ faction: "f1", acted: false }))).toHaveLength(1);
  });

  it("does not tick on a Turn that is neither its own nor one it acted in", () => {
    expect(boundary(unit({ faction: "f2", acted: false }))).toHaveLength(0);
  });
});

describe("the widening is still what makes any of it happen", () => {
  it("an un-widened Poison ticks at neither trigger — its own clock is roundEnd", () => {
    const bare = { ...unit({ faction: "f1", acted: true }), periodicOverrides: [] };
    expect(boundary(bare)).toHaveLength(0);
  });
});
