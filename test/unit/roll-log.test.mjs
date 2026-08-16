/**
 * @file The roll log.
 * @see docs/14-checks-and-randomness.md §14.8
 */

import { describe, it, expect } from "vitest";
import { record, append, reroll, chainOf, visibleTo, renderBreakdown } from "../../module/rules/roll-log.mjs";

const evade = (over = {}) => record({
  id: "r1",
  globalTurn: 4,
  entryId: "evade-",
  formula: "1d20+4",
  raw: 10,
  total: 14,
  purpose: "Heracles evades Karna's normal attack",
  actorId: "heracles",
  ...over,
});

describe("record", () => {
  it("keeps the raw die apart from the total", () => {
    // The whole point of the log: "1d20+4 → 14" is only checkable when the
    // die and the arithmetic are both stored.
    expect(evade()).toMatchObject({ raw: 10, total: 14 });
  });

  it("defaults to public visibility", () => {
    expect(evade().visibility).toBe("public");
  });

  it("starts with no reroll ancestor", () => {
    expect(evade().rerolledFrom).toBeNull();
  });

  it("carries its modifiers with their source and stage", () => {
    const r = evade({ modifiers: [{ source: "attacked from the left", delta: 1, stage: "situational" }] });

    expect(r.modifiers[0]).toMatchObject({ source: "attacked from the left", delta: 1 });
  });
});

describe("append", () => {
  it("adds to the log without mutating it", () => {
    // Process state is serialized and passed between clients; mutating it in
    // place loses records on the round trip.
    const before = [evade()];
    const after = append(before, evade({ id: "r2" }));

    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);
  });

  it("refuses a duplicate id", () => {
    // Two records under one id makes the audit trail unreadable, and an
    // interrupt that replays is the way it happens.
    const log = append([evade()], evade());

    expect(log).toHaveLength(1);
  });
});

describe("reroll", () => {
  it("keeps the original and links the replacement to it", () => {
    // P6: a GM may re-roll, and the log shows BOTH — a replacement that erased
    // its predecessor would let a re-roll pass unnoticed.
    const log = reroll([evade()], "r1", { id: "r2", raw: 18, total: 22 }, "GM ruled the modifier misapplied");

    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({ id: "r2", rerolledFrom: "r1", reason: "GM ruled the modifier misapplied" });
  });

  it("copies the unchanged fields from the original", () => {
    const log = reroll([evade()], "r1", { id: "r2", raw: 18, total: 22 }, "reason");

    expect(log[1]).toMatchObject({ entryId: "evade-", actorId: "heracles", formula: "1d20+4" });
  });

  it("leaves the log alone when the original is not in it", () => {
    expect(reroll([evade()], "nope", { id: "r2" }, "reason")).toHaveLength(1);
  });

  it("follows a chain of re-rolls back to the first", () => {
    let log = [evade()];
    log = reroll(log, "r1", { id: "r2", raw: 1, total: 5 }, "first");
    log = reroll(log, "r2", { id: "r3", raw: 20, total: 24 }, "second");

    expect(chainOf(log, "r3").map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("visibleTo", () => {
  it("shows public records to everyone", () => {
    expect(visibleTo([evade()], { userId: "u", isGM: false, ownedActorIds: [] })).toHaveLength(1);
  });

  it("hides a GM roll from a player", () => {
    // Presence Concealment's Discover roll is hidden by design (§26.6); a
    // player who sees it learns where the Assassin is from the log alone.
    expect(visibleTo([evade({ visibility: "gm" })], { isGM: false, ownedActorIds: ["heracles"] }))
      .toHaveLength(0);
  });

  it("shows a GM everything", () => {
    expect(visibleTo([evade({ visibility: "gm" })], { isGM: true, ownedActorIds: [] })).toHaveLength(1);
  });

  it("shows an owner-visible roll to the actor's owner only", () => {
    const log = [evade({ visibility: "owner" })];

    expect(visibleTo(log, { isGM: false, ownedActorIds: ["heracles"] })).toHaveLength(1);
    expect(visibleTo(log, { isGM: false, ownedActorIds: ["karna"] })).toHaveLength(0);
  });
});

describe("renderBreakdown", () => {
  const full = evade({
    modifiers: [
      { source: "attacked from the left", delta: 1, stage: "situational" },
      { source: "Mad Enhancement B: Evade- forced", delta: 0, stage: "forced" },
    ],
    total: 15,
  });

  it("opens with the formula and the raw result", () => {
    expect(renderBreakdown(full)[0]).toContain("1d20+4");
    expect(renderBreakdown(full)[0]).toContain("10");
  });

  it("lists each modifier with a signed delta", () => {
    expect(renderBreakdown(full)).toContainEqual(expect.stringContaining("+1"));
  });

  it("shows a zero-delta modifier without a sign, because it explains rather than adds", () => {
    // "Mad Enhancement B: Evade- forced" changed which table was used, not the
    // number. Printing it as "+0" would read as a bug.
    const line = renderBreakdown(full).find((l) => l.includes("Mad Enhancement"));

    expect(line).not.toContain("+0");
  });

  it("ends with the total", () => {
    expect(renderBreakdown(full).at(-1)).toContain("15");
  });

  it("renders a record with no modifiers", () => {
    expect(renderBreakdown(evade({ modifiers: [] })).length).toBeGreaterThan(0);
  });
});
