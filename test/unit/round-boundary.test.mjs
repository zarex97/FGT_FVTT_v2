/**
 * @file A Round boundary ends the Round that ended and starts the NEW order's
 *       first faction (#173).
 * @see module/engine/scheduler-hooks.mjs, docs/25-turn-order-and-scheduler.md
 *
 * Driven, not read: the two Foundry hooks the scheduler binds are called in
 * the order Foundry fires them, against a fake Combat that behaves as Foundry's
 * does where it matters here --
 *
 * - `combatRound` fires from `nextRound` BEFORE the update is written, and is
 *   not awaited;
 * - the update lands, `combat.round` is the new Round, `combatTurnChange` fires
 *   with `combat.previous` -- the one object `_onUpdate` refills on EVERY later
 *   update (§46.4-BV);
 * - `FGTCombat#_onUpdate` re-sorts `turns` when `system.turnOrder` changes at
 *   `turn === 0` (§46.4-BB), and that re-sort fires no turn change of its own.
 *
 * Source guards cannot see this defect: both hooks were individually plausible
 * and the fault was how they interleaved. The collaborators that need a world
 * (the board, the applier, the budget, the field engine) are mocked; the
 * sequences in `scheduler.mjs`, and the hooks themselves, are real.
 *
 * Found live (#65): the Combat went 14 -> 15 and the log read `roundEnd 15` /
 * `roundStart 16`, then `turnStart faction-1 tick 42` while Faction 2 held it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/** What happened, in order. */
let events = [];
/** Every board the hooks asked for, with the overrides it was built from. */
let boards = [];

vi.mock("../../module/engine/board.mjs", () => ({
  currentBoard: (overrides = {}) => {
    boards.push(overrides);
    return { units: [], fields: [], ...overrides };
  },
}));
vi.mock("../../module/engine/io.mjs", () => ({ worldIO: () => ({}) }));
vi.mock("../../module/engine/applier.mjs", () => ({
  applyIntents: async (intents, ctx) => {
    for (const intent of intents) {
      if (intent.t === "log") events.push({ at: ctx.source, ...intent.entry });
    }
  },
}));
vi.mock("../../module/engine/budget.mjs", () => ({
  reset: async (_combat, factionId) => { events.push({ at: "budget.reset", faction: factionId }); },
}));
vi.mock("../../module/engine/fields.mjs", () => ({
  runFieldEvents: async () => [],
  runUpkeep: async (tick, opts) => { events.push({ at: "runUpkeep", tick, ...opts }); },
  offerReshape: async () => {},
  expireFields: async () => {},
  ensurePassiveFields: async () => {},
  returnBanished: async () => {},
  resetFieldWindows: async () => {},
}));
vi.mock("../../module/engine/terrain.mjs", () => ({ expireTerrain: async () => {} }));
vi.mock("../../module/engine/state-history.mjs", () => ({
  recordTurn: () => null, historyOf: () => ({}), setHistory: async () => {},
}));
vi.mock("../../module/engine/dimension.mjs", () => ({ runDimensionClock: async () => {} }));
vi.mock("../../module/engine/channel.mjs", () => ({ advanceChannels: async () => {} }));
vi.mock("../../module/engine/modes.mjs", () => ({ turnEndModeIntents: () => [], reconcileForcedModes: async () => [] }));

/** The hooks the scheduler registers, by name. */
const handlers = {};
globalThis.Hooks = { on: (name, fn) => { handlers[name] = fn; } };
globalThis.foundry = { utils: { randomID: () => Math.random().toString(36).slice(2) } };
globalThis.game = {
  users: { activeGM: { isSelf: true } },
  user: { isGM: false },
  settings: { get: (_scope, key) => (key === "turnsPerRound" ? 3 : null) },
};

const { Scheduler } = await import("../../module/engine/scheduler-hooks.mjs");
Scheduler.attach();

/* -------------------------------------------------------------------------- */

const setPath = (obj, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  let cursor = obj;
  for (const key of keys) cursor = cursor[key] ??= {};
  cursor[last] = value;
};

/**
 * A Combat as Foundry and `FGTCombat` drive it, to the extent this boundary
 * depends on.
 *
 * @param {object} opts
 * @param {string[]} opts.rolled the order `rollTurnOrder` will write
 */
function makeCombat({ rolled }) {
  const combatants = new Map([
    ["c1", { id: "c1", name: "Faction 1", system: { factionId: "faction-1", isGM: false } }],
    ["c2", { id: "c2", name: "Faction 2", system: { factionId: "faction-2", isGM: false } }],
    ["cg", { id: "cg", name: "GM", system: { factionId: null, isGM: true } }],
  ]);
  const byFaction = (order) => order.map((f) => [...combatants.values()]
    .find((c) => (c.system.isGM ? f === "gm" : c.system.factionId === f)));

  const combat = {
    id: "combat",
    started: true,
    round: 14,
    turn: 2,
    system: {
      globalTurn: 41,
      scheduleClaim: {},
      turnOrder: ["faction-1", "faction-2", "gm"],
    },
    combatants,
    turns: [],
    inflight: [],
    flags: {},
    getFlag: () => undefined,
    setFlag: async () => {},
    get combatant() { return this.turns[this.turn]; },
    get actingFactionId() { return this.combatant?.system?.factionId ?? null; },
    _state() {
      return { round: this.round, turn: this.turn, combatantId: this.combatant?.id ?? null };
    },
    setupTurns() { this.turns = byFaction(this.system.turnOrder); this.current = this._state(); },

    /** Foundry's `Document#update`, then `Combat#_onUpdate`. */
    async update(data) {
      await Promise.resolve();
      const priorState = structuredClone(this.current);
      let turnOrderChanged = false;
      for (const [path, value] of Object.entries(data)) {
        if (path === "system.turnOrder") {
          turnOrderChanged = JSON.stringify(value) !== JSON.stringify(this.system.turnOrder);
        }
        setPath(this, path, value);
      }
      this.current = this._state();
      const changed = this.current.combatantId !== priorState.combatantId
        || this.current.round !== priorState.round || this.current.turn !== priorState.turn;
      // `#recordPreviousState`: the SAME object, refilled on every update.
      Object.assign(this.previous, priorState);
      // `_manageTurnEvents`: fired, not awaited.
      if (changed) this.inflight.push(handlers.combatTurnChange(this, this.previous, this.current));
      // `FGTCombat#_onUpdate`: the re-sort, at the top of the Round only, and
      // with no turn change of its own.
      if (turnOrderChanged && this.turn === 0) this.setupTurns();
    },

    async markTurnTaken(factionId) { events.push({ at: "markTurnTaken", faction: factionId }); },
    async rollTurnOrder() {
      events.push({ at: "rollTurnOrder" });
      await this.update({ "system.turnOrder": rolled });
      return rolled;
    },

    /** `Combat#nextRound`. */
    async nextRound() {
      const updateData = { round: this.round + 1, turn: 0 };
      handlers.combatRound(this, updateData, { direction: 1 });
      await this.update(updateData);
      await Promise.all(this.inflight);
    },
    /** `Combat#nextTurn`, within a Round. */
    async nextTurn() {
      await this.update({ turn: this.turn + 1 });
      await Promise.all(this.inflight);
    },
  };
  combat.setupTurns();
  combat.previous = structuredClone(combat.current);
  return combat;
}

const logs = (kind) => events.filter((e) => e.kind === kind);

beforeEach(() => {
  events = [];
  boards = [];
});

/* -------------------------------------------------------------------------- */

describe("a Round boundary whose re-roll flips the order", () => {
  // The GM's slot ends Round 14 at tick 41; the re-roll puts Faction 2 first.
  const flipped = ["faction-2", "faction-1", "gm"];

  it("logs the Round that ended and the Round that began, as the Combat counts them", async () => {
    const combat = makeCombat({ rolled: flipped });
    await combat.nextRound();

    expect(combat.round).toBe(15);
    expect(logs("roundEnd").map((e) => e.round)).toEqual([14]);
    expect(logs("roundStart").map((e) => e.round)).toEqual([15]);
  });

  it("builds the Round-end board and the Round-end toll for the Round that ended", async () => {
    const combat = makeCombat({ rolled: flipped });
    await combat.nextRound();

    // (The Turn's own upkeep sweep runs too, with no Round.)
    expect(events.filter((e) => e.at === "runUpkeep" && e.round !== undefined)).toEqual([
      { at: "runUpkeep", tick: 41, round: 14 },
    ]);
    // The end half's board is the ended Round's; the start half's is the new one.
    expect(boards.filter((b) => b.round === 14).length).toBeGreaterThan(0);
    expect(boards.filter((b) => b.round === 15).length).toBeGreaterThan(0);
  });

  it("starts the first Turn for the faction the NEW order puts first", async () => {
    const combat = makeCombat({ rolled: flipped });
    await combat.nextRound();

    // The Combat's own answer, after the re-sort.
    expect(combat.combatant.system.factionId).toBe("faction-2");

    const turnStart = logs("turnStart");
    expect(turnStart).toHaveLength(1);
    expect(turnStart[0]).toMatchObject({ faction: "faction-2", tick: 42 });
    expect(events.filter((e) => e.at === "budget.reset")).toEqual([
      { at: "budget.reset", faction: "faction-2" },
    ]);
  });

  it("runs it in the order: end Turn, end Round, roll, begin Round, begin Turn", async () => {
    const combat = makeCombat({ rolled: flipped });
    await combat.nextRound();

    const marks = events
      .map((e) => (e.kind ? `${e.kind}` : e.at))
      .filter((m) => ["markTurnTaken", "roundEnd", "rollTurnOrder", "roundStart", "budget.reset", "turnStart"].includes(m));
    expect(marks).toEqual([
      "markTurnTaken", "roundEnd", "rollTurnOrder", "roundStart", "budget.reset", "turnStart",
    ]);
  });

  it("still ends the Turn that ended, for the faction that held it", async () => {
    const combat = makeCombat({ rolled: flipped });
    await combat.nextRound();

    // The GM's slot took the last Turn of Round 14 and has no faction. Before
    // the fix this read the INCOMING combatant's faction (§46.4-BV).
    expect(events.filter((e) => e.at === "markTurnTaken").map((e) => e.faction)).toEqual([null]);
  });
});

describe("a Round boundary whose re-roll keeps the order", () => {
  it("begins the Turn for the faction that held it all along", async () => {
    const combat = makeCombat({ rolled: ["faction-1", "faction-2", "gm"] });
    await combat.nextRound();

    expect(logs("roundEnd").map((e) => e.round)).toEqual([14]);
    expect(logs("roundStart").map((e) => e.round)).toEqual([15]);
    expect(logs("turnStart")[0]).toMatchObject({ faction: "faction-1", tick: 42 });
  });
});

describe("a Turn change within a Round", () => {
  it("runs no Round boundary and begins the Turn for the faction now holding it", async () => {
    const combat = makeCombat({ rolled: ["faction-2", "faction-1", "gm"] });
    combat.turn = 0;
    combat.current = combat._state();
    combat.previous = structuredClone(combat.current);
    combat.round = 14;

    await combat.nextTurn();

    expect(logs("roundEnd")).toEqual([]);
    expect(logs("roundStart")).toEqual([]);
    expect(logs("turnStart")[0]).toMatchObject({ faction: "faction-2", tick: 42 });
    expect(events.filter((e) => e.at === "budget.reset")).toEqual([
      { at: "budget.reset", faction: "faction-2" },
    ]);
  });
});

describe("a rewind", () => {
  it("records no Round boundary for a later Turn change to pick up", async () => {
    const combat = makeCombat({ rolled: ["faction-2", "faction-1", "gm"] });
    combat.turn = 0;
    combat.current = combat._state();
    combat.previous = structuredClone(combat.current);

    // `previousRound` announces a backward change; rewinding is a GM correction.
    handlers.combatRound(combat, { round: 13, turn: null }, { direction: -1 });
    await combat.nextTurn();

    expect(logs("roundEnd")).toEqual([]);
    expect(logs("roundStart")).toEqual([]);
  });
});
