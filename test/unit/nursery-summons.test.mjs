/**
 * @file Nursery Rhyme's summons, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 2 of four. Pinned to the SHEET; every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { expiredSummonIds } from "../../module/rules/summons.mjs";
import { dispatch } from "../../module/engine/scheduler.mjs";
import { contributionsOf } from "../../module/rules/snapshot.mjs";
import { acquisitionTarget, itemPickupIntents } from "../../module/rules/items.mjs";


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

describe("E1 — a share of the damage that landed", () => {
  const run = (action, unit, ctx) =>
    dispatch(action, unit, { source: "test", abilityId: null }, ctx);
  const heal = { kind: "StatDelta", stat: "health.value", delta: "@amount", factor: 0.75 };

  it("multiplies the event's payload by the stated factor", () => {
    const out = run(heal, { id: "jab" }, { event: { amount: 400 } });
    expect(out[0]).toMatchObject({ t: "statDelta", unitId: "jab", stat: "health.value", delta: 300 });
  });

  it("reads what LANDED, not what was rolled", () => {
    // R2. The payload is `result.total` -- after every reduction. A Servant who
    // swings 1000 into a Def Up that stops 600 heals it by 300, not by 750.
    const out = run(heal, { id: "jab" }, { event: { amount: 400, rolled: 1000 } });
    expect(out[0].delta).toBe(300);
  });

  it("rounds toward zero, so a factor cannot invent a point of Health", () => {
    const out = run(heal, { id: "jab" }, { event: { amount: 5 } });
    expect(out[0].delta).toBe(3);
  });

  it("emits nothing when the event carries no payload", () => {
    // What every damageTaken handler saw before this task: `fireDamageTaken`
    // passed no `event` at all, so `@amount` resolved to null.
    expect(run(heal, { id: "jab" }, {})).toEqual([]);
  });

  it("leaves a literal delta alone", () => {
    // Every StatDelta authored before this one states a number.
    const out = run({ kind: "StatDelta", stat: "luck.value", delta: -1 }, { id: "x" }, {});
    expect(out[0]).toMatchObject({ delta: -1 });
  });
});

describe("E6 — an Item's rules apply only while it is Equipped", () => {
  // `EquipmentData` has carried `equipped` since it was written and the only
  // thing that read it was the actor sheet's context builder, which draws a
  // checkbox. `contributionsOf` collected an Item's `rules` from the moment it
  // was HELD.
  //
  // Nothing noticed because [Semiramis' Poison] is the only Item in the corpus
  // and it carries no `rules` at all -- it is a consumable with a
  // `consumeEffect`. The Vorpal Blade is the first Item that does anything
  // while worn, and every one of its five stat clauses opens with "When
  // Equipped".
  const blade = (equipped) => ({
    id: "blade", name: "[Vorpal Blade]", type: "equipment",
    system: { contentId: "vorpal-blade", equipped, rules: [{ key: "Ward", value: 30 }] },
  });
  const wards = (actor) => (contributionsOf(actor).modifiers ?? []).filter((m) => m.key === "ward");

  it("collects them when it is worn", () => {
    expect(wards({ system: {}, items: [blade(true)], effects: [] })).toHaveLength(1);
  });

  it("does NOT collect them when it is merely held", () => {
    // This is what the engine did in BOTH cases before this task.
    expect(wards({ system: {}, items: [blade(false)], effects: [] })).toEqual([]);
  });

  it("treats an unset `equipped` as not worn", () => {
    const held = blade(true);
    delete held.system.equipped;
    expect(wards({ system: {}, items: [held], effects: [] })).toEqual([]);
  });

  it("leaves an ordinary ABILITY item alone", () => {
    // The gate is on the item TYPE. An ability has no `equipped` field, and
    // reading one off it would switch off every passive in the game.
    const skill = {
      id: "s", name: "Shapeshift", type: "ability",
      system: { passiveRules: [{ key: "Ward", value: 30 }] },
    };
    expect(wards({ system: {}, items: [skill], effects: [] })).toHaveLength(1);
  });
});

describe("E4 — an Item may refuse particular holders", () => {
  // `acquisitionTarget` is the right seam -- its own docstring calls itself
  // "the one seam every acquisition goes through" and anticipates this exact
  // day: "the day a drop or a reward is added, it asks this and inherits the
  // redirect for free." What it could not do is refuse THIS item to THESE
  // units: its signature was (unit, board), and both its refusals are
  // properties of the unit. Pale Rider holds nothing at all; Nursery holds
  // anything except one sword.
  const blade = { contentId: "vorpal-blade", barredFrom: { ofUnit: "nursery-rhyme", roles: ["self", "master"] } };
  const board = () => ({ units: [
    { id: "n", contentId: "nursery-rhyme", kind: "servant", masterId: "m", panel: { i: 0, j: 0 } },
    { id: "m", kind: "master", servantId: "n", panel: { i: 0, j: 1 } },
    { id: "e", contentId: "cu-chulainn", kind: "servant", masterId: "em", panel: { i: 5, j: 5 } },
  ] });

  it("refuses Nursery herself", () => {
    const b = board();
    expect(acquisitionTarget(b.units[0], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });

  it("refuses her Master", () => {
    // The clause the Blade exists for. It is designed to be carried by a
    // MASTER -- "If the Master with this Item Equipped cannot be Underpowered
    // by Servants" -- so the refusal has to name hers specifically.
    const b = board();
    expect(acquisitionTarget(b.units[1], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });

  it("allows anybody else", () => {
    const b = board();
    expect(acquisitionTarget(b.units[2], b, blade)).toMatchObject({ ok: true, unitId: "e" });
  });

  it("is unchanged when no item is named", () => {
    // The existing callers pass two arguments and must not move.
    const b = board();
    expect(acquisitionTarget(b.units[0], b)).toMatchObject({ ok: true, unitId: "n" });
  });

  it("refuses a barred Servant BEFORE redirecting to a Master", () => {
    // Order matters. A barred Servant who redirects would otherwise hand the
    // sword straight to the second person the clause names.
    const b = board();
    b.units[0].itemHandling = "redirectToMaster";
    expect(acquisitionTarget(b.units[0], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });

  it("allows everybody when the named unit is not on the board", () => {
    // A bar against a Servant nobody summoned refuses nobody.
    const b = { units: [{ id: "e", contentId: "cu-chulainn", kind: "servant", panel: { i: 1, j: 1 } }] };
    expect(acquisitionTarget(b.units[0], b, blade)).toMatchObject({ ok: true });
  });
});

describe("E3 — an Item lying on a panel", () => {
  const barred = { ofUnit: "nursery-rhyme", roles: ["self", "master"] };
  const board = () => ({ units: [
    { id: "cache", kind: "structure", panel: { i: 3, j: 3 },
      carriesItemId: "vorpal-blade",
      carriesItem: { contentId: "vorpal-blade", barredFrom: barred } },
    { id: "e", contentId: "cu-chulainn", kind: "servant", panel: { i: 3, j: 3 } },
    { id: "n", contentId: "nursery-rhyme", kind: "servant", masterId: "m", panel: { i: 9, j: 9 } },
    { id: "m", kind: "master", servantId: "n", panel: { i: 9, j: 8 } },
  ] });

  it("hands it to a unit standing on its panel", () => {
    const b = board();
    expect(itemPickupIntents(b.units[1], b)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "itemGrant", unitId: "e", contentId: "vorpal-blade" }),
    ]));
  });

  it("removes the cache, so it cannot be picked up twice", () => {
    const b = board();
    expect(itemPickupIntents(b.units[1], b).some((i) => i.kind === "dismiss" && i.unitId === "cache")).toBe(true);
  });

  it("hands it to nobody standing elsewhere", () => {
    const b = board();
    expect(itemPickupIntents(b.units[2], b)).toEqual([]);
  });

  it("REFUSES Nursery standing on it, and leaves the cache there", () => {
    // Enforced at ACQUISITION rather than in the hook -- a refusal written into
    // the pickup is one a future trade or reward would not inherit.
    const b = board();
    b.units[2].panel = { i: 3, j: 3 };
    expect(itemPickupIntents(b.units[2], b)).toEqual([]);
  });

  it("REFUSES her Master too, and still leaves it there", () => {
    const b = board();
    b.units[3].panel = { i: 3, j: 3 };
    expect(itemPickupIntents(b.units[3], b)).toEqual([]);
  });

  it("ignores a structure that carries nothing", () => {
    const b = { units: [
      { id: "stone", kind: "structure", panel: { i: 1, j: 1 } },
      { id: "e", kind: "servant", panel: { i: 1, j: 1 } },
    ] };
    expect(itemPickupIntents(b.units[1], b)).toEqual([]);
  });
});
