/**
 * @file A platform that shares its owner's Luck shares ONE pool with her (#162).
 * @see module/rules/snapshot.mjs#annotatePlatforms, module/engine/io.mjs#adjustStat, docs/27-platforms-and-levels.md
 *
 * > *"Luck: Shared with Quetz's"* -- the Quetzalcoatlus. *"Luck: Shared with Drake"* -- the Golden Hind.
 *
 * `summonPlatform` resolved `inherit.luck: { from: summoner }` once, at the cast, into a COPY of the owner's
 * MAXIMUM. Luck is a spendable pool (every Luck Check costs 1, written as a stat delta on the checking unit's
 * own id) and nothing kept the two actors in step, so the pools started equal at her maximum -- the mount higher
 * than she was if she had spent Luck first -- and drifted apart with every check either made.
 *
 * Ruled by the user (2026-10-01): the Quetzalcoatlus shares one Luck pool with her, so a Luck spent by either is
 * gone for both.
 *
 * Every subject is authored content through the real compile, the real DataModel and the real projection.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);
beforeEach(() => { globalThis.Roll = class { async evaluate() { return { total: 1 }; } }; });
afterEach(() => { delete globalThis.Roll; });

const io = async () => (await import("../../module/engine/io.mjs")).worldIO();

const ID = { quetz: "quetzSubject0001", mount: "mountSubject0001", hind: "hindSubject000001", owner: "ownerSubject0001" };

/** Quetz with 3 of 5 Luck left, and the mount she owns. */
const pair = (mountState = {}) => [
  { from: "quetzalcoatl", id: ID.quetz, state: { luck: { value: 3, max: 5 } }, panel: { i: 5, j: 5, k: 1 } },
  { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz, ...mountState }, panel: { i: 5, j: 5, k: 1 } },
];

describe("what the mount reads", () => {
  it("is her CURRENT Luck, not a copy of her maximum", async () => {
    const luck = await withSubjects(pair(), ({ unit }) => ({ mount: unit(ID.mount).luck, quetz: unit(ID.quetz).luck }));
    expect(luck).toEqual({ mount: 3, quetz: 3 });
  });

  it("whatever its own document happens to hold", async () => {
    // A copy taken at an earlier cast, drifted since: the pool is hers, so the stored number is not read.
    const luck = await withSubjects(pair({ luck: { value: 5, max: 5 } }), ({ unit }) => unit(ID.mount).luck);
    expect(luck).toBe(3);
  });

  it("follows her as she spends", async () => {
    const luck = await withSubjects(pair(), async ({ world }) => {
      await (await io()).adjustStat(ID.quetz, "luck.value", -1);
      const { snapshotUnit, snapshotBoard } = await import("../../module/rules/snapshot.mjs");
      const units = [ID.quetz, ID.mount].map((id) => snapshotUnit(world.actor(id), { panel: { i: 5, j: 5, k: 1 } }));
      return snapshotBoard({ scene: null, actors: units.map((snapshot) => ({ snapshot })), settings: {} })
        .units.find((u) => u.id === ID.mount).luck;
    });
    expect(luck).toBe(2);
  });

  it("leaves a platform that does not share its owner's Luck with its own", async () => {
    const specs = [
      { from: "semiramis", id: ID.owner, state: { luck: { value: 3, max: 5 } }, panel: { i: 5, j: 5, k: 1 } },
      { from: "hanging-gardens-of-babylon", id: ID.hind, state: { ownerId: ID.owner, luck: { value: 9, max: 9 } }, panel: { i: 2, j: 2, k: 1 } },
    ];
    expect(await withSubjects(specs, ({ unit }) => unit(ID.hind).luck)).toBe(9);
  });
});

describe("what a Luck Check spends", () => {
  const spent = (spec, who, stat, delta) => withSubjects(spec, async ({ world }) => {
    await (await io()).adjustStat(who, stat, delta);
    return {
      quetz: world.actor(ID.quetz).system.luck,
      mount: world.actor(ID.mount).system.luck,
    };
  });

  it("the mount's check spends HER Luck: 3 becomes 2, for both", async () => {
    const out = await spent(pair(), ID.mount, "luck.value", -1);
    expect(out.quetz.value).toBe(2);
  });

  it("her own check is the same pool", async () => {
    const out = await spent(pair(), ID.quetz, "luck.value", -1);
    expect(out.quetz.value).toBe(2);
  });

  it("a ceiling the mount is asked to lower is hers", async () => {
    const out = await spent(pair(), ID.mount, "luck.max", -1);
    expect(out.quetz.max).toBe(4);
  });

  it("the mount's own document is never the pool: it is not written", async () => {
    // Holding a number of its own, so a write to it would show.
    const held = pair({ luck: { value: 5, max: 5 } });
    const before = await withSubjects(held, ({ world }) => world.actor(ID.mount).system.luck);
    const out = await spent(held, ID.mount, "luck.value", -1);
    expect(out.mount).toEqual(before);
  });

  it("the Golden Hind shares Drake's the same way", async () => {
    // Any Servant can own it here: Drake herself cannot be built through the real model while her Riding authors
    // the literal cooldown "@cooldown" (#120), and the clause under test is the ship's.
    const specs = [
      { from: "heracles", id: ID.quetz, state: { luck: { value: 4, max: 6 } }, panel: { i: 5, j: 5, k: 1 } },
      { from: "platform-golden-hind", id: ID.mount, state: { ownerId: ID.quetz }, panel: { i: 2, j: 2, k: 1 } },
    ];
    const out = await spent(specs, ID.mount, "luck.value", -1);
    expect(out.quetz.value).toBe(3);
  });

  it("an ordinary Unit's Luck is its own, and so is a platform's that shares nothing", async () => {
    const specs = [
      { from: "semiramis", id: ID.quetz, state: { luck: { value: 3, max: 5 } }, panel: { i: 5, j: 5, k: 1 } },
      { from: "hanging-gardens-of-babylon", id: ID.mount, state: { ownerId: ID.quetz, luck: { value: 9, max: 9 } }, panel: { i: 2, j: 2, k: 1 } },
    ];
    const out = await spent(specs, ID.mount, "luck.value", -1);
    expect(out.quetz.value).toBe(3);
    expect(out.mount.value).toBe(8);
  });
});

describe("the cast", () => {
  it("no longer copies her Luck onto the mount", () => {
    const src = readFileSync("module/engine/skill-use.mjs", "utf8");
    const summon = src.slice(src.indexOf("async function summonPlatform"), src.indexOf("export async function actorFromPacks"));
    const loop = summon.slice(summon.indexOf("Object.entries(data.system.inherit"));
    expect(loop.slice(0, loop.indexOf("const platform = await Actor.create"))).toMatch(/stat === "luck"/);
  });

  it("the other inherited stats keep their copy", () => {
    const src = readFileSync("module/engine/skill-use.mjs", "utf8");
    const summon = src.slice(src.indexOf("async function summonPlatform"), src.indexOf("export async function actorFromPacks"));
    expect(summon).toMatch(/data\.system\[stat\] = \{ value, max: value \}/);
  });
});
