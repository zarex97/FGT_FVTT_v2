/**
 * @file The game log, and GM overrides in the record.
 * @see docs/30-chat-and-audit.md §30.8, §30.10
 */

import { describe, it, expect } from "vitest";
import {
  entry, appendEntry, LOG_KINDS, overrideEntry, isOverride,
  splitForFlush, filterLog, summarizeLog, exportPayload,
} from "../../module/rules/game-log.mjs";

const attack = (over = {}) => entry({
  seq: 1, globalTurn: 12, round: 4, kind: "attack",
  actorIds: ["karna", "heracles"],
  summary: "Karna attacks Heracles",
  ...over,
});

describe("entry", () => {
  it("carries the fields §30.8 names", () => {
    expect(attack()).toMatchObject({
      seq: 1, globalTurn: 12, round: 4, kind: "attack",
      actorIds: ["karna", "heracles"], messageId: null,
    });
  });

  it("defaults rolls and detail rather than leaving them undefined", () => {
    // An entry with `undefined` rolls serializes to a missing key, and the
    // exporter would then produce a file the replayer cannot read.
    expect(attack()).toMatchObject({ rolls: [], detail: null });
  });

  it("refuses a kind outside the documented set", () => {
    // A typo'd kind makes an entry the viewer's filters can never show: it is
    // in the log, and no filter matches it.
    expect(() => entry({ seq: 1, kind: "atack", summary: "x" })).toThrow(/unknown log kind/i);
  });

  it("lists every kind §30.8 enumerates", () => {
    expect([...LOG_KINDS].sort()).toEqual([
      "ability", "attack", "commandSpell", "contract", "defeat", "effect",
      "gmOverride", "grail", "movement", "scheduler",
    ].sort());
  });
});

describe("appendEntry", () => {
  it("numbers each entry one past the last", () => {
    const log = appendEntry([attack({ seq: 1 })], { kind: "defeat", summary: "Heracles falls" });

    expect(log[1].seq).toBe(2);
  });

  it("starts an empty log at 1", () => {
    expect(appendEntry([], { kind: "defeat", summary: "x" })[0].seq).toBe(1);
  });

  it("does not renumber what is already there", () => {
    // Sequence numbers are referenced by overrides, so renumbering would
    // silently repoint an override at a different entry.
    const log = appendEntry([attack({ seq: 7 })], { kind: "defeat", summary: "x" });

    expect(log.map((e) => e.seq)).toEqual([7, 8]);
  });

  it("returns a new array", () => {
    const before = [attack()];
    appendEntry(before, { kind: "defeat", summary: "x" });

    expect(before).toHaveLength(1);
  });
});

describe("overrideEntry", () => {
  it("keeps the original and records the change beside it", () => {
    // P6 lets the GM override anything; "report outcomes faithfully" says the
    // record must show it. Both, or neither is worth having.
    const log = overrideEntry([attack({ seq: 3 })], 3, {
      original: "2071 damage", changed: "1000 damage",
      reason: "Territory Creation should apply twice",
      byUserId: "alice", round: 7, globalTurn: 20,
    });

    expect(log).toHaveLength(2);
    expect(log[0].seq).toBe(3);
    expect(log[1]).toMatchObject({
      kind: "gmOverride", overrides: 3,
      reason: "Territory Creation should apply twice",
    });
  });

  it("REFUSES an override with no reason", () => {
    // §30.10: "always carry a reason (the field is required)". An unexplained
    // override is indistinguishable from a bug in the record.
    expect(() => overrideEntry([attack({ seq: 3 })], 3, {
      original: "a", changed: "b", byUserId: "alice",
    })).toThrow(/reason/i);
  });

  it("refuses to override an entry that is not in the log", () => {
    expect(() => overrideEntry([attack({ seq: 3 })], 99, {
      original: "a", changed: "b", reason: "r", byUserId: "alice",
    })).toThrow(/no entry/i);
  });

  it("attributes the override to a user", () => {
    const log = overrideEntry([attack({ seq: 1 })], 1, {
      original: "a", changed: "b", reason: "r", byUserId: "alice",
    });

    expect(log[1].byUserId).toBe("alice");
  });

  it("marks the overridden entry so a viewer can strike it through", () => {
    const log = overrideEntry([attack({ seq: 1 })], 1, {
      original: "a", changed: "b", reason: "r", byUserId: "alice",
    });

    expect(log[0].overriddenBy).toBe(log[1].seq);
  });
});

describe("isOverride", () => {
  it("recognises an override entry", () => {
    expect(isOverride({ kind: "gmOverride" })).toBe(true);
    expect(isOverride(attack())).toBe(false);
  });
});

describe("splitForFlush", () => {
  const many = (n) => Array.from({ length: n }, (_, k) => attack({ seq: k + 1 }));

  it("keeps everything while under the cap", () => {
    const { keep, flush } = splitForFlush(many(50), { cap: 200, batch: 100 });

    expect(flush).toEqual([]);
    expect(keep).toHaveLength(50);
  });

  it("flushes a whole batch once the cap is exceeded", () => {
    // "the last 200 entries live on Combat.system.log; older entries are
    // flushed in batches of 100".
    const { keep, flush } = splitForFlush(many(250), { cap: 200, batch: 100 });

    expect(flush).toHaveLength(100);
    expect(keep).toHaveLength(150);
  });

  it("flushes the OLDEST entries, not the newest", () => {
    const { keep, flush } = splitForFlush(many(250), { cap: 200, batch: 100 });

    expect(flush[0].seq).toBe(1);
    expect(keep[0].seq).toBe(101);
  });

  it("does not flush a partial batch", () => {
    // Flushing one entry per write would make every write a journal write.
    const { flush } = splitForFlush(many(250), { cap: 200, batch: 400 });

    expect(flush).toEqual([]);
  });
});

describe("filterLog", () => {
  const log = [
    attack({ seq: 1, round: 1, kind: "attack", actorIds: ["karna"], summary: "Karna attacks" }),
    attack({ seq: 2, round: 2, kind: "effect", actorIds: ["heracles"], summary: "Heracles burns" }),
    attack({ seq: 3, round: 2, kind: "attack", actorIds: ["karna", "heracles"], summary: "Karna again" }),
  ];

  it("filters by round", () => {
    expect(filterLog(log, { round: 2 }).map((e) => e.seq)).toEqual([2, 3]);
  });

  it("filters by kind", () => {
    expect(filterLog(log, { kind: "attack" }).map((e) => e.seq)).toEqual([1, 3]);
  });

  it("filters by actor, matching any participant", () => {
    // "show me everything that happened to my Servant last round" is the
    // viewer's most-used function, and a Servant is as often the target as the
    // actor.
    expect(filterLog(log, { actorId: "heracles" }).map((e) => e.seq)).toEqual([2, 3]);
  });

  it("searches the summary, case-insensitively", () => {
    expect(filterLog(log, { search: "BURNS" }).map((e) => e.seq)).toEqual([2]);
  });

  it("combines filters", () => {
    expect(filterLog(log, { round: 2, kind: "attack" }).map((e) => e.seq)).toEqual([3]);
  });

  it("returns everything for an empty filter", () => {
    expect(filterLog(log, {})).toHaveLength(3);
  });
});

describe("exportPayload", () => {
  it("is self-contained: ruleset, roster and entries", () => {
    // §30.9: a maintainer must be able to replay it without the world.
    const out = exportPayload({
      log: [attack()],
      systemVersion: "0.2.13",
      settings: { difficulty: "expert" },
      roster: [{ id: "karna", name: "Karna", setup: { maxHealth: 1013 } }],
    });

    expect(out).toMatchObject({ systemVersion: "0.2.13", settings: { difficulty: "expert" } });
    expect(out.roster).toHaveLength(1);
    expect(out.entries).toHaveLength(1);
  });

  it("stamps a format version, so a later reader knows what it is holding", () => {
    expect(exportPayload({ log: [] }).format).toBe(1);
  });

  it("carries the rolls, because replay is exact only with them", () => {
    // "the rules layer is pure and consumes a roll map, so replay is exact".
    // Without the recorded rolls it is not replay, it is re-simulation.
    const out = exportPayload({ log: [attack({ rolls: [{ id: "r1", raw: 14, total: 15 }] })] });

    expect(out.entries[0].rolls[0]).toMatchObject({ id: "r1", raw: 14 });
  });
});

describe("summarizeLog", () => {
  it("counts entries by kind, for the balance analysis §30.9 wants", () => {
    const out = summarizeLog([
      attack({ seq: 1, kind: "attack" }),
      attack({ seq: 2, kind: "attack" }),
      attack({ seq: 3, kind: "commandSpell" }),
    ]);

    expect(out.byKind).toMatchObject({ attack: 2, commandSpell: 1 });
  });

  it("reports the round span", () => {
    expect(summarizeLog([attack({ seq: 1, round: 2 }), attack({ seq: 2, round: 9 })]))
      .toMatchObject({ rounds: { first: 2, last: 9 } });
  });

  it("handles an empty log without dividing by zero", () => {
    expect(summarizeLog([])).toMatchObject({ total: 0, byKind: {} });
  });
});
