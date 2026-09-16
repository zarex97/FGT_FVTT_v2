/**
 * @file Nursery Rhyme's summons, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 2 of four. Pinned to the SHEET; every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { expiredSummonIds } from "../../module/rules/summons.mjs";
import { dispatch } from "../../module/engine/scheduler.mjs";


describe("E5 — a summon that goes away on its own", () => {
  it("names a summon whose expiry has passed", () => {
    const board = { units: [
      { id: "jab", kind: "summon", expiresAt: 12 },
      { id: "soldier", kind: "summon", expiresAt: null },
      { id: "nursery", kind: "servant", expiresAt: 3 },
    ] };
    expect(expiredSummonIds(board, 12)).toEqual(["jab"]);
  });

  it("does NOT name one whose expiry is still ahead", () => {
    const board = { units: [{ id: "jab", kind: "summon", expiresAt: 13 }] };
    expect(expiredSummonIds(board, 12)).toEqual([]);
  });

  it("ignores a summon with no clock at all", () => {
    // Every summon before the Jabberwock. A Dragon Tooth Warrior stays until
    // something kills it, and must not be swept up by this pass.
    const board = { units: [{ id: "dtw", kind: "summon", expiresAt: null }] };
    expect(expiredSummonIds(board, 99999)).toEqual([]);
  });

  it("ignores a STRUCTURE carrying an expiry", () => {
    // `expiresAt` sits on the simple-actor schema, which structures and
    // platforms share. A platform with a clock is a different teardown.
    const board = { units: [{ id: "x", kind: "structure", expiresAt: 1 }] };
    expect(expiredSummonIds(board, 99)).toEqual([]);
  });

  it("handles a board with no units", () => {
    expect(expiredSummonIds({}, 5)).toEqual([]);
  });
});

describe("R8 — Alice Eater extends the stay, it does not reset it", () => {
  const run = (action, unit, ctx) =>
    dispatch(action, unit, { source: "test", abilityId: null }, ctx);

  it("adds to whatever remains", () => {
    // "extends its period of existing on the board for 3 MORE Turns."
    //
    // A monster with one Turn left must end with four, not three. A test
    // starting from an expiry that has already passed proves nothing, because
    // "set" and "add" agree there -- so this one starts from an expiry that is
    // still ahead.
    const out = run(
      { kind: "DurationDelta", ticks: "1◈" },
      { id: "jab", expiresAt: 13 },
      { tick: 12, turnsPerRound: 3 },
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ t: "durationDelta", unitId: "jab", delta: 3 });
  });

  it("does nothing to a summon that has no clock", () => {
    // A Trump Soldier has no `expiresAt`. Adding to nothing must not GIVE it a
    // clock and quietly make a permanent summon mortal.
    const out = run(
      { kind: "DurationDelta", ticks: "1◈" },
      { id: "soldier", expiresAt: null },
      { tick: 12, turnsPerRound: 3 },
    );
    expect(out).toEqual([]);
  });

  it("does not negate its tick expression, unlike CooldownDelta beside it", () => {
    // Every cooldown clause in the corpus reduces, so `CooldownDelta` reads
    // `ticks` as `-resolveTicks(...)`. This one increases, and copying the
    // neighbouring line would shorten the stay it exists to lengthen.
    const out = run(
      { kind: "DurationDelta", ticks: "2◈" },
      { id: "jab", expiresAt: 20 },
      { tick: 12, turnsPerRound: 3 },
    );
    expect(out[0].delta).toBeGreaterThan(0);
    expect(out[0].delta).toBe(6);
  });
});
