/**
 * @file The Quetzalcoatlus as a mount: its size, who sits on it, and where.
 * @see packs/_source/platforms/quetzalcoatlus.yml, module/rules/platforms.mjs, docs/27-platforms-and-levels.md
 *
 * Ruled by the user (2026-10-01, #65): the Quetzalcoatlus is 2x2 panels, which the content
 * authored as 1x1; Winged Serpent puts her adjacent Master ON the mount; and her own Master may
 * board it freely at any time, with no roll, while nobody else takes its seat.
 *
 * Every subject is authored content through the real compile, the real DataModel and the real
 * projection (`test/helpers/subject.mjs`).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

/** A Foundry id is sixteen alphanumerics. */
const ID = {
  quetz: "quetzSubject0001", mast: "mastrSubject0001", mount: "mountSubject0001",
  foe: "foeSubject000001", friend: "friendSubject001", other: "otherSubject0001",
  garden: "gardenSubject001",
};

describe("the Quetzalcoatlus's size", () => {
  it("is 2x2 panels to the rules, as authored content states it", async () => {
    const footprint = await withSubjects(
      [{ from: "quetzalcoatlus", id: ID.mount, panel: { i: 5, j: 5, k: 1 } }],
      ({ unit }) => unit(ID.mount).footprint,
    );
    expect(footprint).toEqual({ w: 2, h: 2 });
  });
});

describe("where a summoned mount is placed", () => {
  // *"…summons a Quetzalcoatlus at her position"*. A token is placed by its top-left panel, which at
  // 1x1 was her own. At 2x2 a summoner on the last row or column would put half the mount off the board.
  const bounds = { iMin: 0, jMin: 0, iMax: 12, jMax: 12 };
  const size = { w: 2, h: 2 };

  it("anchors on her own panel when the whole mount fits", async () => {
    const { summonAnchor } = await import("../../module/rules/platforms.mjs");
    expect(summonAnchor({ i: 5, j: 6 }, size, bounds)).toEqual({ i: 5, j: 6 });
  });

  it("slides back inside the board from the last row, keeping her panel under it", async () => {
    const { summonAnchor, withinFootprint } = await import("../../module/rules/platforms.mjs");
    const anchor = summonAnchor({ i: 12, j: 12 }, size, bounds);
    expect(anchor).toEqual({ i: 11, j: 11 });
    expect(withinFootprint({ i: 12, j: 12 }, { panel: anchor, footprint: size })).toBe(true);
  });

  it("is her own panel when the board's bounds are not known", async () => {
    const { summonAnchor } = await import("../../module/rules/platforms.mjs");
    expect(summonAnchor({ i: 3, j: 4 }, size, null)).toEqual({ i: 3, j: 4 });
  });
});

/**
 * Quetz, her Master, the mount she owns, an enemy and an ally of hers -- all authored content.
 * `at` places a Unit; `k` is the Scene Level it stands on (0 the ground, 1 the mount's deck).
 */
const cast = (at = {}) => [
  { from: "quetzalcoatl", id: ID.quetz, state: { masterId: ID.mast, factionId: "f1" }, panel: at.quetz ?? { i: 5, j: 5, k: 1 } },
  { from: "master-advanced", id: ID.mast, state: { factionId: "f1" }, panel: at.mast ?? { i: 5, j: 6, k: 0 } },
  { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz, factionId: "f1" }, panel: at.mount ?? { i: 5, j: 5, k: 1 } },
  { from: "heracles", id: ID.foe, state: { factionId: "f2" }, panel: at.foe ?? { i: 6, j: 6, k: 0 } },
  { from: "castor", id: ID.friend, state: { factionId: "f1" }, panel: at.friend ?? { i: 6, j: 5, k: 0 } },
];

// *"…otherwise her Master can get on the Quetzalcoatlus at any time."* Ruled: freely, with no roll,
// and nobody else takes the seat.
describe("who may board the Quetzalcoatlus", () => {
  it("her Master may, and so may she", async () => {
    const { seatVerdict } = await import("../../module/rules/platforms.mjs");
    const verdicts = await withSubjects(cast(), ({ unit, board }) => ({
      master: seatVerdict(unit(ID.mast), unit(ID.mount), board),
      quetz: seatVerdict(unit(ID.quetz), unit(ID.mount), board),
    }));
    expect(verdicts).toEqual({ master: { ok: true }, quetz: { ok: true } });
  });

  it("an enemy may not take the seat, nor may an ally who is not her Master", async () => {
    const { seatVerdict } = await import("../../module/rules/platforms.mjs");
    const verdicts = await withSubjects(cast(), ({ unit, board }) => ({
      foe: seatVerdict(unit(ID.foe), unit(ID.mount), board),
      friend: seatVerdict(unit(ID.friend), unit(ID.mount), board),
    }));
    expect(verdicts).toEqual({
      foe: { ok: false, reason: "notYourSeat" },
      friend: { ok: false, reason: "notYourSeat" },
    });
  });

  it("another Servant's Master is not hers", async () => {
    const { seatVerdict } = await import("../../module/rules/platforms.mjs");
    const verdict = await withSubjects([
      ...cast(),
      { from: "master-advanced", id: ID.other, state: { factionId: "f2" }, panel: { i: 7, j: 7, k: 0 } },
    ], ({ unit, board }) => seatVerdict(unit(ID.other), unit(ID.mount), board));
    expect(verdict).toEqual({ ok: false, reason: "notYourSeat" });
  });

  it("a platform that states no seats leaves the ordinary boarding rule alone", async () => {
    const { seatVerdict } = await import("../../module/rules/platforms.mjs");
    const verdict = await withSubjects([
      { from: "heracles", id: ID.foe, state: { factionId: "f2" }, panel: { i: 6, j: 6, k: 0 } },
      { from: "hanging-gardens-of-babylon", id: ID.garden, panel: { i: 2, j: 2, k: 1 } },
    ], ({ unit, board }) => seatVerdict(unit(ID.foe), unit(ID.garden), board));
    expect(verdict).toBeNull();
  });

  it("the Board button is offered to her Master standing on the mount, and to nobody else", async () => {
    const { boardablePlatform } = await import("../../module/rules/platforms.mjs");
    // Everyone stands on the mount's footprint, on the ground.
    const standing = { mast: { i: 5, j: 6, k: 0 }, foe: { i: 6, j: 6, k: 0 }, friend: { i: 6, j: 5, k: 0 } };
    const offered = await withSubjects(cast(standing), ({ unit, board }) => Object.fromEntries(
      ["mast", "foe", "friend"].map((who) => [who, boardablePlatform(unit(ID[who]), board)?.id ?? null]),
    ));
    expect(offered).toEqual({ mast: ID.mount, foe: null, friend: null });
  });
});

// *"Quetz summons a Quetzalcoatlus at her position, and she is Moved onto the Quetzalcoatlus together
// with her Master (if her Master is next to the Quetzalcoatlus…)"*. Level assignment never changes x
// or y, so a Master merely beside the mount was left on the deck, on nothing.
describe("where her adjacent Master is put when the mount is summoned", () => {
  const mount = { panel: { i: 5, j: 5 }, footprint: { w: 2, h: 2 } };
  const seatFor = async (masterPanel) => {
    const { masterSeat } = await import("../../module/rules/platforms.mjs");
    return withSubjects(cast({ mast: { ...masterPanel, k: 0 }, quetz: { i: 5, j: 5, k: 0 } }),
      ({ unit }) => masterSeat(unit(ID.quetz), unit(ID.mast), mount));
  };

  it("lands a Master who stands beside the mount on a panel of its footprint, never hers", async () => {
    const { withinFootprint } = await import("../../module/rules/platforms.mjs");
    const seat = await seatFor({ i: 4, j: 4 });
    expect(withinFootprint(seat, mount)).toBe(true);
    expect(seat).not.toEqual({ i: 5, j: 5 });
  });

  it("leaves a Master who already stands on its footprint where he is", async () => {
    expect(await seatFor({ i: 6, j: 6 })).toEqual({ i: 6, j: 6 });
  });

  it("measures next to the mount, not next to her: two panels from her can still be beside it", async () => {
    const { withinFootprint } = await import("../../module/rules/platforms.mjs");
    const seat = await seatFor({ i: 7, j: 7 });
    expect(withinFootprint(seat, mount)).toBe(true);
  });

  it("does not carry a Master who is not next to the mount: he boards later, freely", async () => {
    expect(await seatFor({ i: 8, j: 8 })).toBeNull();
  });
});

// The two engine paths that carry the rules above need a live canvas and a roll to run, so they are
// held by what they read: a rule that matters needs something to call it (Ch. 27, Traps).
describe("the engine asks the rules about the seat", async () => {
  const { readFileSync } = await import("node:fs");
  const platforms = readFileSync("module/engine/platforms.mjs", "utf8");
  const skillUse = readFileSync("module/engine/skill-use.mjs", "utf8");
  const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
  const board = platforms.slice(platforms.indexOf("export async function boardPlatform"), platforms.indexOf("async function announceBoarding"));

  it("boardPlatform refuses a Unit the platform does not seat, before it counts capacity or rolls", () => {
    expect(board).toMatch(/seatVerdict\(unit, platform, board\)/);
    expect(board.indexOf("seatVerdict(")).toBeLessThan(board.indexOf("capacity"));
    expect(board.indexOf("seatVerdict(")).toBeLessThan(board.indexOf("new Roll"));
  });

  it("boardPlatform lets a seat the platform named board with no roll", () => {
    expect(board).toMatch(/seat\?\.ok \|\|/);
  });

  it("the refusal has a line to read", () => {
    expect(lang["FGT.Action.Refusal.notYourSeat"]).toBeTruthy();
  });

  it("summonPlatform moves a Master who is next to the mount onto it before the level change", () => {
    const summon = skillUse.slice(skillUse.indexOf("async function summonPlatform"), skillUse.indexOf("export async function actorFromPacks"));
    expect(summon).toMatch(/masterSeat\(/);
    expect(summon.indexOf("masterSeat(")).toBeLessThan(summon.indexOf("activatePlatform("));
  });
});

// *"…can Move onto occupied panels (place the Quetzalcoatlus on top of anything occupying said
// panels)."* So it falls over an enemy in ordinary play, and Quetz and her Master must not land on it (#140).
describe("a Quetzalcoatlus that falls over occupied ground", () => {
  const ids = ["foeSubject000001", "foeSubject000002", "foeSubject000003", "foeSubject000004"];

  it("drops her and her Master on free ground panels, never on the Units it covered", async () => {
    const { scatterPanels, passengersOf, withinFootprint } = await import("../../module/rules/platforms.mjs");
    const covering = ids.map((id, n) => ({
      from: "heracles", id, state: { factionId: "f2" }, panel: { i: 5 + Math.floor(n / 2), j: 5 + (n % 2), k: 0 },
    }));
    const [quetz, mast] = [ID.quetz, ID.mast];
    const landed = await withSubjects([
      { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: quetz }, panel: { i: 5, j: 5, k: 1 } },
      { from: "quetzalcoatl", id: quetz, panel: { i: 5, j: 5, k: 1 } },
      { from: "master-advanced", id: mast, panel: { i: 5, j: 6, k: 1 } },
      ...covering,
    ], ({ unit, board }) => {
      const mount = unit(ID.mount);
      return { mount, out: scatterPanels(passengersOf(mount, board), mount, board, Math.random) };
    });

    expect(Object.keys(landed.out).sort()).toEqual([mast, quetz].sort());
    const cells = Object.values(landed.out);
    expect(new Set(cells.map((p) => `${p.i},${p.j}`)).size).toBe(2);
    for (const p of cells) expect(withinFootprint(p, landed.mount)).toBe(false);
  });
});
