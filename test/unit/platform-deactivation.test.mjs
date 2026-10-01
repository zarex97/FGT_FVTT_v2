/**
 * @file The owner of a platform can end it, and its lockout holds off only a voluntary end (#141).
 * @see module/rules/platforms.mjs#deactivatablePlatforms, module/engine/platforms.mjs#deactivatePlatform, docs/27-platforms-and-levels.md
 *
 * Two platforms author `deactivation: { byOwner: true, window: any }` -- the Quetzalcoatlus with a
 * `lockout: "2◈"`, and the Golden Hind -- and nothing let an owner use it: the action bar built its End
 * slots from `board.fields` and a platform lives in `board.units`. So the only things that ended a mount
 * were defeat, an unpayable toll, an effect on the owner, or a GM at the console, which skips every gate.
 *
 * Ruled by the user (2026-10-01): a forced deactivation is not held off by the 2◈ lock (ruling 8), and the
 * 7◈ cooldown starts from any end of the mount (ruling 9). So the lock belongs to the voluntary path alone.
 *
 * Every Platform is authored content through the real compile, the real DataModel and the real projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { OPERATIONS } from "../../module/net/operations.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = {
  quetz: "quetzSubject0001", mount: "mountSubject0001", rival: "rivalSubject0001",
  drake: "drakeSubject0001", hind: "hindSubject000001",
};

/** Raised at tick 10, with three Turns to a Round, so the 2◈ lock opens at tick 16. */
const RAISED = 10;
const TURNS_PER_ROUND = 3;

const cast = (extra = []) => [
  { from: "quetzalcoatl", id: ID.quetz, panel: { i: 5, j: 5, k: 1 } },
  { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz, activatedAt: RAISED }, panel: { i: 5, j: 5, k: 1 } },
  ...extra,
];

const endable = (specs, who, tick) => withSubjects(specs, async ({ unit, board }) => {
  const { deactivatablePlatforms } = await import("../../module/rules/platforms.mjs");
  return deactivatablePlatforms(unit(who), board, { tick, turnsPerRound: TURNS_PER_ROUND })
    .map(({ platform, verdict }) => ({ id: platform.id, verdict }));
});

describe("the platforms an owner may end", () => {
  it("a Quetzalcoatlus one Turn after it was raised is locked, and says when it unlocks", async () => {
    expect(await endable(cast(), ID.quetz, RAISED + 1)).toEqual([
      { id: ID.mount, verdict: { ok: false, reason: "locked", unlocksAt: RAISED + 2 * TURNS_PER_ROUND } },
    ]);
  });

  it("is endable once the 2◈ lock has run out", async () => {
    expect(await endable(cast(), ID.quetz, RAISED + 2 * TURNS_PER_ROUND)).toEqual([
      { id: ID.mount, verdict: { ok: true } },
    ]);
  });

  it("a Golden Hind, which states no lockout, is endable at once", async () => {
    // Any Servant can own it: Drake herself cannot be built through the real model while her Riding
    // authors the literal cooldown "@cooldown" (#120), and the clause under test is the ship's.
    const specs = [
      { from: "heracles", id: ID.drake, panel: { i: 5, j: 5, k: 1 } },
      { from: "platform-golden-hind", id: ID.hind, state: { ownerId: ID.drake, activatedAt: RAISED }, panel: { i: 5, j: 5, k: 1 } },
    ];
    expect(await endable(specs, ID.drake, RAISED)).toEqual([{ id: ID.hind, verdict: { ok: true } }]);
  });

  it("another Unit's platform is never offered", async () => {
    const specs = [...cast(), { from: "heracles", id: ID.rival, panel: { i: 8, j: 8, k: 0 } }];
    expect(await endable(specs, ID.rival, RAISED + 99)).toEqual([]);
  });

  it("a platform that authors no deactivation is not offered to its owner", async () => {
    const specs = [
      { from: "semiramis", id: ID.drake, panel: { i: 5, j: 5, k: 1 } },
      { from: "hanging-gardens-of-babylon", id: ID.hind, state: { ownerId: ID.drake }, panel: { i: 2, j: 2, k: 1 } },
    ];
    expect(await endable(specs, ID.drake, RAISED)).toEqual([]);
  });
});

// The lockout is a rule, not a hidden button: the bar greys the slot, and the GM re-checks it.
describe("the deactivatePlatform operation", () => {
  const auth = OPERATIONS.deactivatePlatform?.authorize;

  /** `authorize` reads `game` off the global; give it one. Alice owns the Servant that owns the mount. */
  function withWorld(fn) {
    const alice = { id: "alice", name: "Alice", isGM: false };
    const bob = { id: "bob", name: "Bob", isGM: false };
    const gm = { id: "gm", name: "GM", isGM: true };
    const quetz = { id: "quetz", name: "Quetzalcoatl", testUserPermission: (u) => u.id === "alice" };
    const mount = { id: "mount", name: "Quetzalcoatlus", system: { ownerId: "quetz" } };
    const previous = globalThis.game;
    globalThis.game = {
      users: { get: (id) => ({ alice, bob, gm }[id] ?? null) },
      actors: { get: (id) => ({ quetz, mount }[id] ?? null) },
    };
    try { return fn(); } finally { globalThis.game = previous; }
  }

  it("exists", () => {
    expect(auth).toBeTypeOf("function");
  });

  it("allows the player who owns the Servant that owns the platform", () => {
    expect(withWorld(() => auth({ platformId: "mount" }, "alice")).allowed).toBe(true);
  });

  it("refuses another player", () => {
    const out = withWorld(() => auth({ platformId: "mount" }, "bob"));
    expect(out.allowed).toBe(false);
  });

  it("allows the GM", () => {
    expect(withWorld(() => auth({ platformId: "mount" }, "gm")).allowed).toBe(true);
  });

  it("refuses a platform that is not there, rather than guessing", () => {
    expect(withWorld(() => auth({ platformId: "ghost" }, "alice")).allowed).toBe(false);
  });
});

// `deactivatePlatform` and the bar need a live canvas to run, so they are held by what they read
// (Ch. 27, Traps): a rule that matters needs something to call it.
describe("the engine and the bar reach the rule", () => {
  const engine = readFileSync("module/engine/platforms.mjs", "utf8");
  const bar = readFileSync("module/apps/hud/action-bar.mjs", "utf8");
  const deactivate = engine.slice(engine.indexOf("export async function deactivatePlatform"), engine.indexOf("export async function destroyPlatform"));

  it("deactivatePlatform re-checks the verdict before it ends anything", () => {
    expect(deactivate).toMatch(/platformDeactivation\(/);
    expect(deactivate.indexOf("platformDeactivation(")).toBeLessThan(deactivate.indexOf("destroyPlatform("));
  });

  it("the bar offers an End slot for each platform its unit may end, and asks the GM to do it", () => {
    expect(bar).toMatch(/deactivatablePlatforms\(/);
    expect(bar).toMatch(/FGTSocket\.request\("deactivatePlatform"/);
  });

  it("the forced ends go straight to destroyPlatform, so the lock never holds them off", () => {
    // An unpayable toll, and an effect on the owner such as NP Seal: ruling 8.
    for (const file of ["module/engine/fields.mjs", "module/engine/applier.mjs"]) {
      const text = readFileSync(file, "utf8");
      expect(text, file).toMatch(/destroyPlatform\(/);
      expect(text, file).not.toMatch(/deactivatePlatform\(/);
    }
  });

  it("has lines to read", () => {
    const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
    for (const key of ["FGT.HUD.EndPlatform", "FGT.HUD.EndPlatformLocked", "FGT.Action.Refusal.locked"]) {
      expect(lang[key], key).toBeTruthy();
    }
  });
});
