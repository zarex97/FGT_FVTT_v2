/**
 * @file Each War keeps its own rules (2026-10-18).
 * @see module/engine/war.mjs, module/domain/war-rules.mjs, docs/superpowers/specs/2026-10-18-war-rules-clauses.md
 *
 * A world holds several Wars, each on its own scene and played at the same
 * time. Every rule a world setting held -- the ◈, the Round gates, the
 * timeouts, the optional rules, the roster -- hit every War at once. These are
 * the War-Rule Clauses that can be pressed without a canvas: which War a client
 * is in, whose value a rule reads, what a locked rule refuses, which GM runs a
 * War, and what the migration copies. The `WR.*` ids are the Clause list's.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WAR_RULES, WAR_RULE_KEYS, missingWarRules, warRuleEditable } from "../../module/domain/war-rules.mjs";
import { MIGRATIONS } from "../../module/migration/migrations.mjs";

const saved = {};
/** @type {Record<string, unknown>} */ let world;

/** A War bound to a scene, with only the rules a test names. */
function war(id, sceneId, system = {}, { started = true } = {}) {
  const doc = {
    id, type: "match", started, scene: sceneId ? { id: sceneId } : null, system: { ...system },
    async update(patch) {
      for (const [path, value] of Object.entries(patch)) doc.system[path.replace(/^system\./, "")] = value;
      doc.updates.push(patch);
    },
    updates: [],
  };
  return doc;
}

/** Two Wars on two scenes; this client looking at `viewing`. */
function install({ wars, viewing, users = null, settings = {} }) {
  world = { ...settings };
  const gm = { id: "gm", isGM: true, active: true, isSelf: true, viewedScene: viewing };
  const list = users ?? [gm];
  globalThis.game = {
    combats: Object.assign([...wars], { contents: wars, active: wars[0] ?? null, get: (id) => wars.find((w) => w.id === id) }),
    combat: wars[wars.length - 1] ?? null,
    settings: { get: (_s, key) => (key in world ? world[key] : undefined), set: async (_s, key, v) => { world[key] = v; } },
    users: Object.assign([...list], { contents: list, activeGM: list.find((u) => u.isGM) ?? null }),
    i18n: { localize: (k) => k, format: (k) => k },
  };
  globalThis.canvas = { scene: viewing ? { id: viewing } : null };
  globalThis.ui = { notifications: { warn: (m) => world.__warned = [...(world.__warned ?? []), m] } };
}

beforeEach(() => {
  for (const k of ["game", "canvas", "ui"]) saved[k] = globalThis[k];
});
afterEach(() => {
  for (const k of ["game", "canvas", "ui"]) globalThis[k] = saved[k];
});

const load = () => import("../../module/engine/war.mjs");

describe("which War a client is in (WR.scene)", () => {
  it("is the War bound to the scene it is looking at, whatever the tracker shows", async () => {
    const a = war("warA", "sceneA", { turnsPerRound: 3 });
    const b = war("warB", "sceneB", { turnsPerRound: 8 });
    install({ wars: [a, b], viewing: "sceneB" });
    const { currentWar } = await load();
    // `game.combat` is the last War and `game.combats.active` the first: neither
    // decides it.
    expect(currentWar()).toBe(b);
    globalThis.canvas.scene = { id: "sceneA" };
    expect(currentWar()).toBe(a);
  });

  it("lets a War from before the move answer for a scene with no War of its own", async () => {
    const legacy = war("legacy", null, { turnsPerRound: 8 });
    const bound = war("warB", "sceneB");
    install({ wars: [legacy, bound], viewing: "prep" });
    const { currentWar, warOfScene } = await load();
    expect(currentWar()).toBe(legacy);
    expect(warOfScene("sceneB")).toBe(bound);
  });
});

describe("whose value a rule reads (WR.turnsPerRound, WR.world)", () => {
  it("reads the War's own value, and the other War set the other way is untouched", async () => {
    const a = war("warA", "sceneA", { turnsPerRound: 3, commandSpellTimeout: 45, closedInfo: true });
    const b = war("warB", "sceneB", { turnsPerRound: 8, commandSpellTimeout: 10, closedInfo: false });
    install({ wars: [a, b], viewing: "sceneA", settings: { turnsPerRound: 15, commandSpellTimeout: 99 } });
    const { warRule } = await load();
    expect([warRule("turnsPerRound"), warRule("commandSpellTimeout"), warRule("closedInfo")]).toEqual([3, 45, true]);
    globalThis.canvas.scene = { id: "sceneB" };
    expect([warRule("turnsPerRound"), warRule("commandSpellTimeout"), warRule("closedInfo")]).toEqual([8, 10, false]);
  });

  it("changing a world default changes no War in play", async () => {
    const a = war("warA", "sceneA", { reactionTimeout: 60 });
    install({ wars: [a], viewing: "sceneA", settings: { reactionTimeout: 60 } });
    const { warRule, setWorldDefaults, worldDefault } = await load();
    await setWorldDefaults({ reactionTimeout: 5 });
    expect(worldDefault("reactionTimeout")).toBe(5);
    expect(warRule("reactionTimeout")).toBe(60);
  });

  it("keeps a War fought in no Region at none, whatever the world names", async () => {
    const a = war("warA", "sceneA", { region: null });
    install({ wars: [a], viewing: "sceneA", settings: { region: "greece" } });
    const { warRule } = await load();
    expect(warRule("region")).toBe(null);
  });

  it("answers the world's default only where there is no War at all", async () => {
    install({ wars: [], viewing: "sceneA", settings: { turnsPerRound: 8 } });
    const { warRule } = await load();
    expect(warRule("turnsPerRound")).toBe(8);
  });

  it("refuses a key that is not a War Rule, rather than reading it as undefined", async () => {
    install({ wars: [], viewing: null });
    const { warRule } = await load();
    expect(() => warRule("showOverlays")).toThrow(/not a War Rule/);
  });
});

describe("the War rules window's writer (WR.window, WR.lock)", () => {
  it("changes only the War it was given", async () => {
    const a = war("warA", "sceneA", { commandSpellTimeout: 45 });
    const b = war("warB", "sceneB", { commandSpellTimeout: 45 });
    install({ wars: [a, b], viewing: "sceneA" });
    const { setWarRules } = await load();
    const out = await setWarRules(a, { commandSpellTimeout: "10" });
    expect(out).toEqual({ applied: ["commandSpellTimeout"], refused: [] });
    expect(a.system.commandSpellTimeout).toBe(10);
    expect(b.system.commandSpellTimeout).toBe(45);
  });

  it("refuses a locked rule once the War has started, out loud, and writes nothing for it", async () => {
    const a = war("warA", "sceneA", { turnsPerRound: 3, closedInfo: true });
    install({ wars: [a], viewing: "sceneA" });
    const { setWarRules } = await load();
    const out = await setWarRules(a, { turnsPerRound: 8, closedInfo: false });
    expect(out).toEqual({ applied: ["closedInfo"], refused: ["turnsPerRound"] });
    expect(a.system.turnsPerRound).toBe(3);
    expect(world.__warned).toEqual(["FGT.WarRules.Locked"]);
  });

  it("lets a locked rule change before the War starts", async () => {
    const a = war("warA", "sceneA", { turnsPerRound: 3 }, { started: false });
    install({ wars: [a], viewing: "sceneA" });
    const { setWarRules } = await load();
    expect((await setWarRules(a, { turnsPerRound: 8 })).applied).toEqual(["turnsPerRound"]);
  });

  it("marks exactly the rules that would invalidate stored state as locked", () => {
    const locked = WAR_RULES.filter((r) => !warRuleEditable(r.key, { started: true })).map((r) => r.key);
    expect(locked).toEqual(expect.arrayContaining(["turnsPerRound", "ruleset", "npGateRound", "npGateRoundAssassin", "noAttackRound"]));
    expect(locked).not.toContain("commandSpellTimeout");
    expect(locked).not.toContain("closedInfo");
  });
});

describe("which GM runs a War (WR.press, Q14 (B))", () => {
  const gmA = { id: "gmA", isGM: true, active: true, isSelf: false, viewedScene: "sceneA" };
  const gmB = { id: "gmB", isGM: true, active: true, isSelf: true, viewedScene: "sceneB" };

  it("is the GM looking at the War's scene, not the active GM", async () => {
    const a = war("warA", "sceneA");
    const b = war("warB", "sceneB");
    install({ wars: [a, b], viewing: "sceneB", users: [gmA, gmB] });
    const { gmForWar, isWarGM } = await load();
    expect(gmForWar(a)).toBe(gmA);
    expect(gmForWar(b)).toBe(gmB);
    expect(isWarGM(a)).toBe(false);
    expect(isWarGM(b)).toBe(true);
  });

  it("is nobody when the only GM is running another War: a press would read the wrong board", async () => {
    const a = war("warA", "sceneA");
    const b = war("warB", "sceneB");
    install({ wars: [a, b], viewing: "sceneB", users: [{ ...gmB }] });
    const { gmForWar } = await load();
    expect(gmForWar(a)).toBe(null);
  });

  it("is the active GM for a War from before the move, as every press was", async () => {
    const legacy = war("legacy", null);
    install({ wars: [legacy], viewing: "anywhere", users: [{ ...gmB }] });
    const { gmForWar } = await load();
    expect(gmForWar(legacy)?.id).toBe("gmB");
  });
});

describe("the schema-3 migration (WR.migrate)", () => {
  const entry = MIGRATIONS.find((m) => m.to === 3);
  const defaults = {
    turnsPerRound: 8, commandSpellTimeout: 12, closedInfo: false, region: "greece", ruleset: "advanced",
    factions: [{ id: "faction-1", name: "Red", userIds: ["p1"] }],
  };

  it("copies the world's values onto the rules a War never stored, and the roster", () => {
    const out = entry.combat({ _id: "w", type: "match", scene: "s", system: { turnsPerRound: 3, ruleset: "normal" } },
      { warDefaults: defaults });
    expect(out.system.turnsPerRound).toBe(8);
    expect(out.system.commandSpellTimeout).toBe(12);
    expect(out.system.closedInfo).toBe(false);
    expect(out.system.factions).toEqual(defaults.factions);
  });

  it("keeps the rules a War did store, and the Region the board read through to", () => {
    const out = entry.combat({ _id: "w", type: "match", scene: "s", system: { ruleset: "normal", region: null } },
      { warDefaults: defaults });
    expect(out.system.ruleset).toBe("normal");
    expect(out.system.region).toBe("greece");
    const kept = entry.combat({ _id: "w", type: "match", scene: "s", system: { region: "egypt" } }, { warDefaults: defaults });
    expect(kept.system.region).toBe("egypt");
  });

  it("binds a War from before the move to the scene the runner found, and leaves a bound one", () => {
    const out = entry.combat({ _id: "w", type: "match", scene: null, system: {} }, { warDefaults: {}, warScenes: { w: "board" } });
    expect(out.scene).toBe("board");
    const bound = entry.combat({ _id: "w", type: "match", scene: "mine", system: {} }, { warDefaults: {}, warScenes: { w: "board" } });
    expect(bound.scene).toBe("mine");
  });

  it("is idempotent", () => {
    const once = entry.combat({ _id: "w", type: "match", scene: null, system: { ruleset: "normal" } }, { warDefaults: defaults, warScenes: { w: "b" } });
    const twice = entry.combat(once, { warDefaults: defaults, warScenes: { w: "b" } });
    expect(twice).toEqual(once);
  });

  it("leaves a combat that is not a War alone", () => {
    const src = { _id: "x", type: "base", system: {} };
    expect(entry.combat(src, { warDefaults: defaults })).toBe(src);
  });
});

describe("the table", () => {
  it("names every rule once, the roster among them", () => {
    expect(new Set(WAR_RULE_KEYS).size).toBe(WAR_RULE_KEYS.length);
    expect(WAR_RULE_KEYS).toContain("factions");
    expect(WAR_RULE_KEYS).toHaveLength(27);
    // The three Classic/Revised rules joined 2026-10-20 (#260 reading 3).
  });

  it("fills only what a War lacks, and a held null stays", () => {
    const out = missingWarRules({ region: null, turnsPerRound: 8 }, { region: "greece", turnsPerRound: 3, closedInfo: false });
    expect(out).not.toHaveProperty("region");
    expect(out).not.toHaveProperty("turnsPerRound");
    expect(out.closedInfo).toBe(false);
  });
});
