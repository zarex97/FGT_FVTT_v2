/**
 * @file The environment — Day/Night, Home Base and the Holy Grail.
 * @see docs/19-environment.md, docs/45-implementation-status.md C2
 */

import { describe, it, expect } from "vitest";
import {
  phase, darkModifiers, homeBaseModifiers, endOfRoundHomeBase,
  grailState, registerDefeat, grailContest, grailDestructionChance,
} from "../../module/rules/environment.mjs";

const at = (i, j) => ({ i, j });

/* ========================================================================== */
/*  19.2 — the Day/Night cycle                                                */
/* ========================================================================== */

describe("the Day/Night cycle", () => {
  it("starts on the side the opening coin flip chose", () => {
    expect(phase(1, true)).toBe("day");
    expect(phase(1, false)).toBe("night");
  });

  it("alternates every Round", () => {
    // "If Heads, the first Round is 'Day'. The next Round will be 'Night' and
    // so on." One flip at the start, so the phase is a pure function of the
    // round number — no state to drift, and a reconnect cannot lose it.
    expect([1, 2, 3, 4, 5].map((r) => phase(r, true))).toEqual(["day", "night", "day", "night", "day"]);
  });

  it("alternates the same way from a Night start", () => {
    expect([1, 2, 3, 4].map((r) => phase(r, false))).toEqual(["night", "day", "night", "day"]);
  });
});

describe("the Dark attribute", () => {
  const dark = { attributes: ["dark"] };
  const plain = { attributes: [] };

  it("punishes a Dark unit during the Day, both ways", () => {
    expect(darkModifiers(dark, "day")).toEqual([
      expect.objectContaining({ key: "atkDwn", value: 25 }),
      expect.objectContaining({ key: "defDwn", value: 25 }),
    ]);
  });

  it("rewards a Dark unit during the Night, both ways", () => {
    expect(darkModifiers(dark, "night")).toEqual([
      expect.objectContaining({ key: "atkUp", value: 25 }),
      expect.objectContaining({ key: "defUp", value: 25 }),
    ]);
  });

  it("does nothing to a unit without the attribute", () => {
    expect(darkModifiers(plain, "day")).toEqual([]);
    expect(darkModifiers(plain, "night")).toEqual([]);
  });

  it("includes Noble Phantasms, so there is no reduced magnitude", () => {
    // "Both including NP" — an npValue would silently halve it.
    for (const m of darkModifiers(dark, "day")) expect(m.npValue).toBeUndefined();
  });
});

/* ========================================================================== */
/*  19.1 — the Home Base                                                      */
/* ========================================================================== */

describe("Home Base damage modifiers", () => {
  const board = {
    zones: { baseA: { faction: "a", panels: [at(0, 0), at(0, 1)] } },
    units: [],
  };
  const inBase = { id: "u", faction: "a", panel: at(0, 0) };
  const outside = { id: "u", faction: "a", panel: at(5, 5) };

  it("reduces damage taken in its own base by 10%", () => {
    expect(homeBaseModifiers(inBase, board, {}))
      .toContainEqual(expect.objectContaining({ key: "defUp", value: 10 }));
  });

  it("gives nothing to a unit outside its base", () => {
    expect(homeBaseModifiers(outside, board, {})).toEqual([]);
  });

  it("gives nothing in someone else's base", () => {
    const enemy = { id: "e", faction: "b", panel: at(0, 0) };
    expect(homeBaseModifiers(enemy, board, {})).toEqual([]);
  });

  it("adds a damage bonus only when the opponent is in the base too", () => {
    // "Both Units have to be in the Home Base."
    const opponent = { id: "e", faction: "b", panel: at(0, 1) };
    const mods = homeBaseModifiers(inBase, board, { opponent });

    expect(mods).toContainEqual(expect.objectContaining({ key: "atkUp", value: 20, npValue: 10 }));
  });

  it("withholds that bonus when the opponent is outside", () => {
    const opponent = { id: "e", faction: "b", panel: at(9, 9) };
    const mods = homeBaseModifiers(inBase, board, { opponent });

    expect(mods.some((m) => m.key === "atkUp")).toBe(false);
  });
});

describe("end-of-round Home Base recovery", () => {
  const board = { zones: { baseA: { faction: "a", panels: [at(0, 0)] } }, units: [] };
  const resident = (over = {}) => ({
    id: "u", faction: "a", panel: at(0, 0),
    homeBase: { consecutiveRounds: 0, combatInBaseThisRound: false },
    effectInstances: [], ...over,
  });

  it("restores 100 Health and 1 Agility to a resident", () => {
    const intents = endOfRoundHomeBase([resident()], board);

    expect(intents).toContainEqual(expect.objectContaining({ kind: "heal", unitId: "u", amount: 100 }));
    expect(intents).toContainEqual(expect.objectContaining({ kind: "statDelta", stat: "agility.value", delta: 1 }));
  });

  it("excludes a unit that fought inside its own base this Round", () => {
    const u = resident({ homeBase: { consecutiveRounds: 0, combatInBaseThisRound: true } });

    expect(endOfRoundHomeBase([u], board).some((i) => i.kind === "heal")).toBe(false);
  });

  it("still restores a unit that sortied out, fought, and came back", () => {
    // The exclusion is narrower than it reads: only combat *within the base*
    // disqualifies, so `combatInBaseThisRound` is false for this unit.
    expect(endOfRoundHomeBase([resident()], board).some((i) => i.kind === "heal")).toBe(true);
  });

  it("cures debuffs after three full Rounds in the base", () => {
    const u = resident({
      homeBase: { consecutiveRounds: 3, combatInBaseThisRound: false },
      effectInstances: [{ id: "e1", defId: "curse", polarity: "debuff" }],
    });

    expect(endOfRoundHomeBase([u], board))
      .toContainEqual(expect.objectContaining({ kind: "removeEffect", effectId: "e1" }));
  });

  it("does not cure before the third Round", () => {
    const u = resident({
      homeBase: { consecutiveRounds: 2, combatInBaseThisRound: false },
      effectInstances: [{ id: "e1", defId: "curse", polarity: "debuff" }],
    });

    expect(endOfRoundHomeBase([u], board).some((i) => i.kind === "removeEffect")).toBe(false);
  });

  it("never cures an Unremovable debuff", () => {
    const u = resident({
      homeBase: { consecutiveRounds: 3, combatInBaseThisRound: false },
      effectInstances: [{ id: "e1", defId: "fragarach", polarity: "debuff", unremovable: true }],
    });

    expect(endOfRoundHomeBase([u], board).some((i) => i.kind === "removeEffect")).toBe(false);
  });
});

/* ========================================================================== */
/*  19.4 — the Holy Grail                                                     */
/* ========================================================================== */

describe("Grail materialization", () => {
  it("starts unmaterialized, at the configured threshold", () => {
    expect(grailState({ threshold: 9 })).toMatchObject({
      threshold: 9, defeatedCount: 0, materialized: false, destroyed: false,
    });
  });

  it("counts a defeated Servant towards the threshold", () => {
    expect(registerDefeat(grailState({ threshold: 2 }), { kind: "servant" }).defeatedCount).toBe(1);
  });

  it("counts a disappeared Servant too", () => {
    const s = registerDefeat(grailState({ threshold: 2 }), { kind: "servant" }, "sustainabilityExhausted");
    expect(s.defeatedCount).toBe(1);
  });

  it("does not count a Servant removed by Erase", () => {
    // "A disappeared Servant counts ... but not if inflicted with Erase."
    const s = registerDefeat(grailState({ threshold: 2 }), { kind: "servant" }, "erase");
    expect(s.defeatedCount).toBe(0);
  });

  it("does not count a Master", () => {
    expect(registerDefeat(grailState({ threshold: 2 }), { kind: "master" }).defeatedCount).toBe(0);
  });

  it("materializes once the threshold is reached", () => {
    let s = grailState({ threshold: 2 });
    s = registerDefeat(s, { kind: "servant" });
    expect(s.materialized).toBe(false);
    s = registerDefeat(s, { kind: "servant" });
    expect(s.materialized).toBe(true);
  });
});

describe("Grail acquisition", () => {
  const state = { ...grailState({ threshold: 1 }), materialized: true, position: at(6, 6), contest: {} };
  const adjacent = { id: "u", faction: "a", panel: at(6, 7) };

  it("credits a Round to a unit standing next to the Grail", () => {
    expect(grailContest(state, [adjacent]).contest.u).toMatchObject({ roundsHeld: 1 });
  });

  it("awards the Grail after one full Round", () => {
    expect(grailContest(state, [adjacent]).claimedBy).toBe("u");
  });

  it("credits nothing to a unit two panels away", () => {
    // "On a panel next to the Grail" — Chebyshev 1, not the 2-panel Grail Area.
    const far = { id: "u", faction: "a", panel: at(6, 8) };
    expect(grailContest(state, [far]).contest).toEqual({});
  });

  it("is blocked by an enemy anywhere in the 2-panel Grail Area", () => {
    const enemy = { id: "e", faction: "b", panel: at(6, 8) };
    const result = grailContest(state, [adjacent, enemy]);

    expect(result.claimedBy).toBeNull();
    expect(result.contest).toEqual({});
  });

  it("makes two adjacent rivals a standoff, so neither claims it", () => {
    // Each is "an enemy Unit within the Grail Area" for the other. Correct and
    // intended: it makes the Grail a standoff rather than a footrace.
    const rival = { id: "r", faction: "b", panel: at(5, 6) };
    expect(grailContest(state, [adjacent, rival]).claimedBy).toBeNull();
  });
});

describe("Grail destruction", () => {
  it("is damage over twenty, as a percentage", () => {
    expect(grailDestructionChance(1000)).toBe(50);
  });

  it("is certain at 2000 damage", () => {
    expect(grailDestructionChance(2000)).toBe(100);
  });

  it("never exceeds certainty", () => {
    expect(grailDestructionChance(9999)).toBe(100);
  });

  it("is nothing at no damage", () => {
    expect(grailDestructionChance(0)).toBe(0);
  });
});
