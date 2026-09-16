/**
 * @file The Queen's Glass Game, against her sheet and Ch. 43 §43.11.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 * @see docs/43-bounded-fields.md §43.11
 *
 * Part 4 of four, and the first ability in either roster that reads the past.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { historyWanted, snapshotUnit, diffSnapshots, applyPatch } from "../../module/rules/history.mjs";
import {
  recordTurn, stateAt, rewindIntents, RETENTION_TURNS, REWIND_EXCLUDED_RESOURCES,
} from "../../module/engine/state-history.mjs";
import { SCRIPTS, runScript } from "../../module/engine/scripts.mjs";
import { glassGameClock, glassGameTargets } from "../../module/rules/glass-game.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";

describe("E2 — the gate, which is the whole performance story", () => {
  it("is OFF for a board with nobody who wants history", () => {
    // This assertion is worth more than any of the restore tests. If the
    // recorder is ever on by default, every match in the game pays for a
    // feature one Servant uses.
    expect(historyWanted({ units: [
      { id: "a", abilities: [{ id: "x", requiresHistory: false }] },
      { id: "b", abilities: [{ id: "y" }] },
    ] })).toBe(false);
  });

  it("is ON as soon as one unit declares it", () => {
    expect(historyWanted({ units: [
      { id: "a", abilities: [{ id: "x" }] },
      { id: "n", abilities: [{ id: "glass", requiresHistory: true }] },
    ] })).toBe(true);
  });

  it("is OFF again once that unit is gone", () => {
    expect(historyWanted({ units: [{ id: "a", abilities: [{ id: "x" }] }] })).toBe(false);
  });

  it("stays ON for a DEFEATED declarer", () => {
    // Effect 2 fires on her defeat and rewinds six Rounds. A gate that closed
    // the moment she died would throw away the buffer one step before the
    // clause reads it.
    expect(historyWanted({ units: [
      { id: "n", defeated: true, abilities: [{ id: "glass", requiresHistory: true }] },
    ] })).toBe(true);
  });

  it("handles an empty board", () => {
    expect(historyWanted({})).toBe(false);
  });
});

describe("E1 — the snapshot shape, from §43.11", () => {
  const unit = () => ({
    id: "foe",
    panel: { i: 4, j: 7 }, facing: "north",
    health: { value: 600, max: 1000 }, agility: 12, luck: { value: 6, max: 8 },
    parameters: { str: "B", end: "C", agi: "B", mag: "E", luc: "C" },
    grantedSteps: { str: 1 },
    baseAttackPenalty: { str: 10, mag: 10 },
    effectInstances: [
      { defId: "atkUp", magnitude: 30, expiry: 14, sourceUnitId: "nursery", uses: 0 },
    ],
    abilities: [
      { id: "someNp", isNP: true, cooldownRemaining: 4 },
      { id: "madEnh", isMode: true, active: true },
    ],
    resources: { namelessForestTokens: { value: 2, max: null } },
    turnState: { movedPanels: 3, acted: true },
    contract: "free",
  });

  it("records the things the sheet names", () => {
    const s = snapshotUnit(unit(), 9);
    expect(s.globalTurn).toBe(9);
    expect(s.stats.health).toEqual({ value: 600, max: 1000 });
    expect(s.parameters.mag).toBe("E");
    expect(s.effects).toHaveLength(1);
    expect(s.cooldowns.someNp).toEqual({ remaining: 4 });
    expect(s.resources.namelessForestTokens).toEqual({ value: 2, max: 0 });
    expect(s.modes.madEnh).toEqual({ active: true });
  });

  it("R1/Q45 — and records NEITHER position NOR facing", () => {
    // "The source lists 'Stats, Parameters, Buffs, Debuffs, Cooldowns, and
    // other existing effects' -- not location. Units are not teleported back."
    //
    // Excluded from the BUFFER rather than filtered by the applier, which is
    // what makes Q45 cheap to keep and expensive to reverse.
    const s = snapshotUnit(unit(), 9);
    expect(s.panel).toBeUndefined();
    expect(s.facing).toBeUndefined();
    expect(JSON.stringify(s)).not.toContain("north");
  });

  it("R1 — nor turn budget, nor contract", () => {
    const s = snapshotUnit(unit(), 9);
    expect(s.turnState).toBeUndefined();
    expect(s.contract).toBeUndefined();
  });

  it("R8 — an effect snapshot records the id of its SOURCE", () => {
    // §43.11's own RISK: the applier drops instances whose source no longer
    // exists, and it can only do that if the snapshot recorded one.
    expect(snapshotUnit(unit(), 9).effects[0].sourceUnitId).toBe("nursery");
  });

  it("stores FULL instances, not ids", () => {
    // An id alone cannot restore a magnitude or an expiry.
    expect(snapshotUnit(unit(), 9).effects[0])
      .toMatchObject({ defId: "atkUp", magnitude: 30, expiry: 14 });
  });

  it("normalises a pool the board flattened to a number", () => {
    // Agility arrives as a bare number and Health as a pair; a buffer that
    // stored whichever it was handed would restore two different shapes.
    expect(snapshotUnit(unit(), 9).stats.agility).toEqual({ value: 12, max: 12 });
  });

  it("carries the permanent Base Attack penalty", () => {
    // Part 3's reduction is a stored number the derivation subtracts, so a
    // rewind that ignored it would hand back Base Attack the Nameless Forest
    // took -- which is a different clause's business, and not this one's to
    // undo by accident.
    expect(snapshotUnit(unit(), 9).baseAttackPenalty).toEqual({ str: 10, mag: 10 });
  });

  it("round-trips through a patch", () => {
    const a = snapshotUnit(unit(), 9);
    const moved = unit(); moved.health.value = 250;
    const b = snapshotUnit(moved, 10);
    expect(applyPatch(a, diffSnapshots(a, b))).toEqual(b);
  });

  it("a patch between identical states is empty", () => {
    // The diffing is what keeps the buffer inside its budget. A patch that
    // always carries everything is a ring of full snapshots in disguise.
    expect(Object.keys(diffSnapshots(snapshotUnit(unit(), 9), snapshotUnit(unit(), 9))))
      .toHaveLength(0);
  });

  it("a patch carries only what moved", () => {
    const a = snapshotUnit(unit(), 9);
    const hurt = unit(); hurt.health.value = 250;
    const patch = diffSnapshots(a, snapshotUnit(hurt, 10));
    expect(Object.keys(patch).sort()).toEqual(["globalTurn", "stats"]);
  });
});

describe("E1 — the ring buffer", () => {
  const declarer = { id: "n", abilities: [{ id: "glass", requiresHistory: true }] };
  const foe = (hp) => ({
    id: "foe", health: { value: hp, max: 1000 }, agility: 12, luck: { value: 6, max: 8 },
    parameters: { mag: "C" }, effectInstances: [], abilities: [], resources: {},
  });

  /** Ten turns of one Unit losing 50 Health a turn. */
  const tenTurns = () => {
    let history = {};
    for (let t = 0; t < 10; t++) {
      history = recordTurn({ units: [declarer, foe(1000 - t * 50)] }, t, history, 3);
    }
    return history;
  };

  it("retains 6 Rounds plus two turns", () => {
    // §43.11's figure. Effect 2 reaches back six Rounds, so anything shorter
    // makes the once-per-game rewind reach past the end of the buffer.
    expect(RETENTION_TURNS(3)).toBe(6 * 3 + 2);
    expect(RETENTION_TURNS(4)).toBe(6 * 4 + 2);
  });

  it("reconstructs a state ten turns old from its patches", () => {
    const h = tenTurns();
    expect(stateAt(h, "foe", 4).stats.health.value).toBe(800);
    expect(stateAt(h, "foe", 9).stats.health.value).toBe(550);
  });

  it("returns null for a turn that has fallen off the end", () => {
    // Not a throw, and not the oldest entry it still holds. A rewind that
    // silently restored the wrong turn would be worse than one that did
    // nothing, because it would look like it worked.
    expect(stateAt(tenTurns(), "foe", -5)).toBeNull();
  });

  it("returns null for a unit it has never seen", () => {
    expect(stateAt(tenTurns(), "stranger", 4)).toBeNull();
  });

  it("writes NOTHING when the gate is closed", () => {
    // The assertion that matters most in this file.
    expect(recordTurn({ units: [foe(1000)] }, 1, {}, 3)).toBeNull();
  });

  it("drops entries past the retention window and re-bases what survives", () => {
    // A patch whose base has been discarded reconstructs nothing, so the new
    // oldest entry has to become a full snapshot.
    let history = {};
    for (let t = 0; t < 40; t++) {
      history = recordTurn({ units: [declarer, foe(1000 - t * 10)] }, t, history, 3);
    }
    expect(history.foe.entries.length).toBeLessThanOrEqual(RETENTION_TURNS(3) + 1);
    expect(history.foe.entries[0].full).toBeTruthy();
    // ...and the oldest turn it still holds reconstructs correctly.
    const oldest = history.foe.entries[0].globalTurn;
    expect(stateAt(history, "foe", oldest).stats.health.value).toBe(1000 - oldest * 10);
  });

  it("stays inside its storage budget at the stated worst case", () => {
    // §43.11 claims ~280 KB at 28 units x 50 turns. Within an order, because a
    // buffer that quietly grows unbounded on a long match is the failure mode
    // the diffing exists to prevent -- and an exact figure would break on any
    // harmless field addition.
    let history = {};
    const units = [declarer];
    for (let u = 0; u < 28; u++) units.push({ ...foe(1000), id: `u${u}` });
    for (let t = 0; t < 50; t++) {
      history = recordTurn({
        units: units.map((x) => (x.id === "n" ? x : { ...x, health: { value: 1000 - t, max: 1000 } })),
      }, t, history, 3);
    }
    expect(JSON.stringify(history).length).toBeLessThan(2_800_000);
  });
});

describe("E3 — the restore", () => {
  const declarer = { id: "n", abilities: [{ id: "glass", requiresHistory: true }] };
  const foe = {
    id: "foe", health: { value: 800, max: 1000 }, agility: 12, luck: { value: 6, max: 8 },
    parameters: { mag: "C" },
    effectInstances: [
      { defId: "atkUp", magnitude: 30, expiry: 14, sourceUnitId: "nursery" },
      { defId: "burn", magnitude: 50, expiry: 14, sourceUnitId: "ghost" },
    ],
    abilities: [{ id: "someNp", isNP: true, cooldownRemaining: 9 }, { id: "mode", isMode: true, active: true }],
    resources: { namelessForestTokens: { value: 3, max: null }, fragarachTokens: { value: 2, max: 5 } },
  };
  const board = { units: [declarer, foe, { id: "nursery" }] };
  const history = recordTurn(board, 4, {}, 3);

  it("emits one rewind per named unit", () => {
    const out = rewindIntents(board, history, ["foe"], 4);
    expect(out.filter((i) => i.kind === "rewind").map((i) => i.unitId)).toEqual(["foe"]);
  });

  it("restores stats, cooldowns, effects and modes", () => {
    const i = rewindIntents(board, history, ["foe"], 4).find((x) => x.kind === "rewind");
    expect(i.state.stats.health).toEqual({ value: 800, max: 1000 });
    expect(i.state.cooldowns.someNp).toEqual({ remaining: 9 });
    expect(i.state.modes.mode).toEqual({ active: true });
  });

  it("R2 — and does NOT restore Nameless Forest Tokens", () => {
    // Stated twice on the sheet, once per effect. Tokens live in `resources`
    // and the buffer stores `resources`, so this is a NAMED carve-out rather
    // than an emergent property -- without it the rewind silently undoes
    // Part 3.
    expect(REWIND_EXCLUDED_RESOURCES).toContain("namelessForestTokens");
    const i = rewindIntents(board, history, ["foe"], 4).find((x) => x.kind === "rewind");
    expect(i.state.resources.namelessForestTokens).toBeUndefined();
  });

  it("R2 — but DOES restore every other pool", () => {
    // The carve-out is one named pool, not "resources are excluded".
    const i = rewindIntents(board, history, ["foe"], 4).find((x) => x.kind === "rewind");
    expect(i.state.resources.fragarachTokens).toEqual({ value: 2, max: 5 });
  });

  it("R8 — drops an effect whose source is gone, and logs each drop", () => {
    // §43.11's own RISK, verbatim: "What must not happen is the rewind
    // restoring an effect whose source has since been removed, producing an
    // orphaned instance."
    const out = rewindIntents(board, history, ["foe"], 4);
    const rewind = out.find((i) => i.kind === "rewind");
    expect(rewind.state.effects.map((e) => e.defId)).toEqual(["atkUp"]);
    expect(out.some((i) => i.kind === "log" && i.event === "rewindDroppedOrphan")).toBe(true);
  });

  it("R1 — and writes no position", () => {
    const i = rewindIntents(board, history, ["foe"], 4).find((x) => x.kind === "rewind");
    expect(i.state.panel).toBeUndefined();
  });

  it("emits nothing for a unit with no history that far back", () => {
    expect(rewindIntents(board, history, ["foe"], -99)).toEqual([]);
  });

  it("R6 — restoring a defeated Nursery does not undo her defeat", () => {
    // "a rewind that restores health undoes a kill (though not a defeat)". Her
    // Stats come back and she stays defeated: the rewind is a parting shot, not
    // a resurrection.
    const i = rewindIntents(board, history, ["foe"], 4).find((x) => x.kind === "rewind");
    expect(i.clearsDefeat).toBe(false);
  });
});

describe("E4 — the Script registry the element has always promised", () => {
  // `rules/elements.mjs`'s Script element has collected {event, script, source}
  // since it was written, and NOTHING read handler.script. Its own comment
  // promises "named entries in a closed registry, never eval. Compendia are
  // shared, so content must not be able to execute" -- and there was no
  // registry. Consistent rather than surprising: the corpus has zero Scripts,
  // so the hatch had never been opened.

  it("is CLOSED — an unknown name runs nothing and does not throw", () => {
    // A compendium is data other people wrote. A name outside the registry runs
    // nothing and says so in the log; it does not throw, because one bad entry
    // must not stop a turn, and it certainly does not eval.
    expect(runScript("whateverTheyTyped", {})).toEqual([]);
  });

  it("refuses a name inherited from Object.prototype", () => {
    // `SCRIPTS["constructor"]` is a function, and a bare lookup would call it.
    expect(runScript("constructor", {})).toEqual([]);
    expect(runScript("toString", {})).toEqual([]);
  });

  it("is frozen, so nothing can add an entry at runtime", () => {
    expect(Object.isFrozen(SCRIPTS)).toBe(true);
  });

  it("holds exactly the entries the corpus actually has", () => {
    // Ch. 44 §44.6 budgets four across ~130 abilities and the tally has stood
    // at zero. This is the first. If this list grows past what Ch. 44 budgets,
    // that is a design conversation and not a merge.
    expect(Object.keys(SCRIPTS)).toEqual(["nurseryRhyme.rewind"]);
  });

  it("the Script element emits `events`, plural, which is what listensFor reads", () => {
    // Pushed as a singular `event` since the element was written, so a Script
    // handler could never have matched an event even once something dispatched
    // one -- which nothing did.
    const out = collectContributions(
      [{ id: "g", name: "Glass Game", rank: "C",
         passiveRules: [{ key: "Script", script: "nurseryRhyme.rewind", event: "turnEnd" }] }],
      { options: new Set(), refs: {} },
    );
    expect(out.eventHandlers[0].events).toEqual(["turnEnd"]);
    expect(out.eventHandlers[0].script).toBe("nurseryRhyme.rewind");
  });

  it("and carries the script's own parameters verbatim", () => {
    // A script is the escape hatch: its parameters are its own business, and
    // inventing a schema for them would be inventing the vocabulary the hatch
    // exists to avoid.
    const out = collectContributions(
      [{ id: "g", rank: "C", passiveRules: [{
        key: "Script", script: "nurseryRhyme.rewind", event: "finalDefeat",
        params: { rewind: "6◈", includesSelf: true },
      }] }],
      { options: new Set(), refs: {} },
    );
    expect(out.eventHandlers[0].params).toEqual({ rewind: "6◈", includesSelf: true });
  });
});

describe("R3 — effect 1's clock", () => {
  const ring = (n) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, relation: "enemy" }));

  it("advances at a Turn end with an enemy inside her 3-panel ring", () => {
    expect(glassGameClock({ ticks: 0 }, ring(1))).toMatchObject({ ticks: 1, fires: false });
  });

  it("fires at 3 Rounds, and not before", () => {
    expect(glassGameClock({ ticks: 7 }, ring(1), { turnsPerRound: 3 }).fires).toBe(false);
    expect(glassGameClock({ ticks: 8 }, ring(1), { turnsPerRound: 3 }))
      .toMatchObject({ ticks: 9, fires: true });
  });

  it("G3 — does not fire if the ring is empty at that Turn's end", () => {
    // "if there are STILL enemy Units within a 3 panel area at the end of that
    // Turn". The clock reaching three is necessary and not sufficient.
    expect(glassGameClock({ ticks: 9 }, [], { turnsPerRound: 3 }).fires).toBe(false);
  });

  it("does not advance while nobody is there to be caught", () => {
    expect(glassGameClock({ ticks: 5 }, []).ticks).toBe(5);
  });

  it("R4 — an empty ring at ROUND end resets the clock to zero", () => {
    expect(glassGameClock({ ticks: 8 }, [], { roundEnd: true }).ticks).toBe(0);
  });

  it("R4 — ...but a ring with an enemy in it at Round end does not", () => {
    expect(glassGameClock({ ticks: 8 }, ring(1), { roundEnd: true }).ticks).toBe(8);
  });

  it("R4 — and the reset NEVER touches the buffer", () => {
    // "the effect of / duration of time passed for this NP is reset" -- the
    // CLOCK. The recorded history must survive, because effect 2 still needs
    // six Rounds of it.
    expect(glassGameClock({ ticks: 8 }, [], { roundEnd: true }).clearsHistory).toBe(false);
  });

  it("counts only ENEMIES in the ring", () => {
    // The gate names enemies; the clause that says who is AFFECTED does not.
    expect(glassGameClock({ ticks: 0 }, [{ id: "a", relation: "ally" }]).ticks).toBe(0);
  });
});

describe("G4/G9 — who the rewind reaches", () => {
  const self = { id: "n", panel: { i: 5, j: 5 } };
  const units = [
    self,
    { id: "near", panel: { i: 5, j: 8 } },
    { id: "alsoNear", panel: { i: 2, j: 5 } },
    { id: "far", panel: { i: 5, j: 9 } },
  ];

  it("everyone within 3 panels, whatever side they are on", () => {
    // "all Units within a 3 panel area of Nursery" -- not "enemy Units". The
    // clause that gates the FIRING names enemies; this one does not.
    expect(glassGameTargets(self, units, false).sort()).toEqual(["alsoNear", "near"]);
  });

  it("G9 — and herself, when the clause says so", () => {
    expect(glassGameTargets(self, units, true)).toContain("n");
  });

  it("and not herself when it does not", () => {
    expect(glassGameTargets(self, units, false)).not.toContain("n");
  });

  it("reaches nobody when she is not on the board", () => {
    expect(glassGameTargets({ id: "n" }, units, true)).toEqual([]);
  });
});

describe("The Queen's Glass Game (G1–G10)", () => {
  const a = () => parse(readFileSync("packs/_source/abilities/nursery-queens-glass-game.yml", "utf8"));
  const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));
  const one = () => a().passiveRules.find((r) => r.event === "turnEnd");
  const two = () => a().passiveRules.find((r) => r.event === "finalDefeat");

  it("G1 — Rank C, NP, Anti-Self/Anti-World, PASSIVE", () => {
    expect(a()).toMatchObject({ rank: "C", isNP: true, isPassive: true });
    expect([...a().npTags].sort()).toEqual(["antiSelf", "antiWorld"]);
  });

  it("E2 — declares that it needs history", () => {
    // The field the whole subsystem is gated on, and exactly the shape this
    // project has silently dropped six times. One that compiles to `false`
    // means the recorder never starts and both effects do nothing.
    expect(a().requiresHistory).toBe(true);
  });

  it("both effects are Scripts, and both name the same one", () => {
    expect(one().key).toBe("Script");
    expect(two().key).toBe("Script");
    expect(one().script).toBe("nurseryRhyme.rewind");
    expect(two().script).toBe("nurseryRhyme.rewind");
  });

  it("and that script is in the registry", () => {
    // A `script:` naming nothing runs nothing, silently but for a log line.
    expect(Object.keys(SCRIPTS)).toContain(one().script);
  });

  it("G2 — effect 1 reaches back 3◈ and fires at the Turn end", () => {
    expect(one().params).toMatchObject({ rewind: "3◈", afterTicks: "3◈" });
  });

  it("G7/R4 — and resets when the ring empties", () => {
    expect(one().params.resetWhenRingEmpty).toBe(true);
  });

  it("G8/G9 — effect 2 reaches back 6◈ and includes her", () => {
    expect(two().params).toMatchObject({ rewind: "6◈", includesSelf: true });
  });

  it("G8/R5 — on finalDefeat, NOT on unitDefeated", () => {
    // unitDefeated fires at the TOP of resolveDefeat, before the revival query
    // -- "Handlers first: unitDefeated is where content that is not a revival
    // hangs." A handler there would spend her once-per-game rewind on a Nursery
    // whom Guts was about to save.
    expect(two().event).toBe("finalDefeat");
    expect(a().passiveRules.some((r) => r.event === "unitDefeated")).toBe(false);
  });

  it("G10/R7 — and is once per game", () => {
    expect(two().params.oncePerGame).toBe(true);
  });

  it("effect 1 does NOT include her, and effect 2 does", () => {
    // Effect 2 adds "(includes herself)" precisely because effect 1 does not.
    expect(one().params.includesSelf).toBe(false);
    expect(two().params.includesSelf).toBe(true);
  });

  it("her ability list is now complete, at thirteen", () => {
    const list = servant("nursery-rhyme").abilities;
    expect(list).toContainEqual({ ref: "nursery-queens-glass-game" });
    expect(list).toHaveLength(13);
  });
});

describe("the gate's field survives every hop between the YAML and the board", () => {
  // Found on a live board. `requiresHistory` was declared in the schema and in
  // both content allowlists, compiled correctly, and sat on the item -- and
  // `historyWanted` still said no, because the unit snapshot's own ability
  // projection dropped it. A recorder that never starts means both of The
  // Queen's Glass Game's effects do nothing at all, silently.
  //
  // Three hops, each of which has cost this project a Servant's clause at least
  // once: the compiler's allowlist, the schema, and the board projection.
  const src = readFileSync("module/rules/snapshot.mjs", "utf8");

  it("the board projection carries it", () => {
    const at = src.indexOf("function collectAbilities");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 2500)).toContain("requiresHistory");
  });

  it("the compiler carries it", () => {
    expect(readFileSync("tools/lib/content.mjs", "utf8")).toContain("requiresHistory: Boolean(doc.requiresHistory)");
  });

  it("the allowlist names it", () => {
    expect(readFileSync("module/content/authored-fields.mjs", "utf8")).toContain('"requiresHistory"');
  });

  it("and the schema declares it", () => {
    expect(readFileSync("module/data/item/ability.mjs", "utf8")).toContain("requiresHistory: new fields.BooleanField");
  });
});
