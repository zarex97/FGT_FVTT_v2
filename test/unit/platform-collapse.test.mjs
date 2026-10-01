/**
 * @file A platform's end drops its riders unhurt, unless its sheet states the ladder (#139).
 * @see module/rules/platforms.mjs#destructionSequence, docs/27-platforms-and-levels.md, docs/adr/0001-falling-from-a-platform-is-opt-in.md
 *
 * Only the Hanging Gardens states a destruction ladder -- *"all Units on it perform either an
 * Agility Check or a Luck Check roll... fails, takes 100 Fixed STR damage"*. The Golden Hind says
 * only that its riders are *"randomly scattered below it"*, and Quetzalcoatl's sheet says nothing
 * of riders when the mount falls. Ruled by the user (2026-10-01): when a mount falls, its riders
 * just drop to the ground -- no check, no damage.
 *
 * ADR 0001 made falling opt-in per Platform; destruction is the same decision. A Platform that
 * states the ladder authors a `collapse` block carrying its numbers, and one that says nothing
 * does not have it.
 *
 * Every Platform here is authored content through the real compile, the real DataModel and the
 * real projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { destructionSequence } from "../../module/rules/platforms.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = { quetz: "quetzSubject0001", mast: "mastrSubject0001", mount: "mountSubject0001", garden: "gardenSubject001" };

/** The platform on its own Level (1), and its two riders standing on it. */
const aboard = (platform, state = {}) => [
  { from: platform, id: platform === "quetzalcoatlus" ? ID.mount : ID.garden, state, panel: { i: 5, j: 5, k: 1 } },
  { from: "quetzalcoatl", id: ID.quetz, state: { masterId: ID.mast }, panel: { i: 5, j: 5, k: 1 } },
  { from: "master-advanced", id: ID.mast, panel: { i: 5, j: 6, k: 1 } },
];

const ended = (platform, saves) => withSubjects(aboard(platform), ({ unit, board }) => {
  const id = platform === "quetzalcoatlus" ? ID.mount : ID.garden;
  return { collapse: unit(id).collapse, steps: destructionSequence(unit(id), board, { saves }) };
});

describe("a platform's end", () => {
  it("the Quetzalcoatlus states no ladder, so riders who 'failed' take no damage", async () => {
    const { collapse, steps } = await ended("quetzalcoatlus", { [ID.quetz]: false, [ID.mast]: false });
    expect(collapse).toBeNull();
    expect(steps.filter((d) => d.kind === "damage")).toEqual([]);
  });

  it("the Quetzalcoatlus still drops everyone to the ground", async () => {
    const { steps } = await ended("quetzalcoatlus", {});
    expect(steps.filter((d) => d.kind === "scatter").map((d) => d.unitId).sort())
      .toEqual([ID.mast, ID.quetz].sort());
    expect(steps.at(-1)).toMatchObject({ kind: "removeLevel" });
  });

  it("the Hanging Gardens states the ladder: 100 Fixed STR to each rider who failed", async () => {
    const { collapse, steps } = await ended("hanging-gardens-of-babylon", { [ID.quetz]: false, [ID.mast]: true });
    expect(collapse).toEqual({ damage: 100, component: "str" });
    expect(steps.filter((d) => d.kind === "damage")).toEqual([
      expect.objectContaining({ unitId: ID.quetz, amount: 100, component: "str", fixed: true }),
    ]);
  });
});

describe("destructionSequence", () => {
  const unit = (id, kind = "servant") => ({ id, kind, level: 7, panel: { i: 5, j: 5 } });
  const platform = (over = {}) => ({ id: "p", kind: "platform", level: 7, panel: { i: 5, j: 5 }, footprint: { w: 2, h: 2 }, ...over });
  const board = { units: [unit("a"), unit("b")] };

  it("with no collapse block emits no damage and still scatters each passenger", () => {
    const out = destructionSequence(platform(), { units: [platform(), ...board.units] }, { saves: { a: false, b: false } });
    expect(out.some((d) => d.kind === "damage")).toBe(false);
    expect(out.filter((d) => d.kind === "scatter").map((d) => d.unitId)).toEqual(["a", "b"]);
  });

  it("with a collapse block emits its damage for each failing passenger", () => {
    const withLadder = platform({ collapse: { damage: 100, component: "str" } });
    const out = destructionSequence(withLadder, { units: [withLadder, ...board.units] }, { saves: { a: false, b: true } });
    expect(out.filter((d) => d.kind === "damage")).toEqual([
      expect.objectContaining({ unitId: "a", amount: 100, component: "str", fixed: true }),
    ]);
  });

  it("takes the damage from the block, not from a constant", () => {
    const withLadder = platform({ collapse: { damage: 40, component: "mag" } });
    const out = destructionSequence(withLadder, { units: [withLadder, ...board.units] }, { saves: { a: false } });
    expect(out.find((d) => d.kind === "damage")).toMatchObject({ amount: 40, component: "mag" });
  });
});

// `destroyPlatform` needs a live canvas to run, so it is held by what it reads (Ch. 27, Traps): a
// rule that matters needs something to call it.
describe("destroyPlatform rolls the ladder only for a platform that states it", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("module/engine/platforms.mjs", "utf8");
  const destroy = src.slice(src.indexOf("export async function destroyPlatform"), src.indexOf("async function setCooldownOnDestruction"));

  it("gates the rolls and the announcement on the platform's collapse block", () => {
    expect(destroy).toMatch(/if \(!decided && platform\.collapse\)/);
  });

  it("hands the sequence an empty save set rather than null when nothing was rolled", () => {
    expect(destroy).toMatch(/saves: decided \?\? \{\}/);
  });
});
