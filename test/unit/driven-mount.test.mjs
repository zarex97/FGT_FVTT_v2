/**
 * @file A rider drives her mount, and the two share one Move and one Attack per Turn (#143).
 * @see module/rules/movement.mjs#gateMovement, module/rules/platforms.mjs#turnPartnersOf, docs/19-action-economy.md
 *
 * > *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack is replaced with
 * > Quetzalcoatlus'."*
 *
 * `replacesRiderAction` had exactly one reader that ran, the damage source. The movement gate never
 * consulted a driven mount (her drag was refused as "the destination panel is occupied", because she
 * may not leave the footprint she stands on), the Turn Record stamped only the unit that acted, so the
 * mount still had its own free Move and Attack, and her Range was read where the damage reads the mount's.
 *
 * Ruled by the user (2026-10-01): while she rides, she and the Quetzalcoatlus share one Move and one
 * Attack per Turn (her Move drives the mount; her Normal Attack is the mount's, with the mount's Range;
 * a Spell spends both).
 *
 * Every subject is authored content through the real compile, the real DataModel and the real projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = {
  quetz: "quetzSubject0001", mast: "mastrSubject0001", mount: "mountSubject0001",
  owner: "ownerSubject0001", hind: "hindSubject000001",
};

/** The mount at (5,5), 2x2, with Quetz on its east column and her Master on its west one -- all aboard (level 1). */
const aboard = (over = {}) => [
  { from: "quetzalcoatl", id: ID.quetz, state: { masterId: ID.mast }, panel: { i: 5, j: 6, k: 1 }, ...(over.quetz ?? {}) },
  { from: "master-advanced", id: ID.mast, panel: { i: 5, j: 5, k: 1 } },
  { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz }, panel: { i: 5, j: 5, k: 1 } },
];

const east = (from, steps) => Array.from({ length: steps }, (_, n) => ({ i: from.i, j: from.j + 1 + n }));
const west = (from, steps) => Array.from({ length: steps }, (_, n) => ({ i: from.i, j: from.j - 1 - n }));

describe("the movement gate", () => {
  it("lets her leave the mount's footprint, which the ordinary gate refuses as an occupied destination", async () => {
    const { gateMovement, validatePath } = await import("../../module/rules/movement.mjs");
    const out = await withSubjects(aboard(), ({ unit, board }) => ({
      ordinary: validatePath(east({ i: 5, j: 6 }, 1), unit(ID.quetz), board).ok,
      driven: gateMovement(east({ i: 5, j: 6 }, 1), unit(ID.quetz), board).ok,
    }));
    expect(out).toEqual({ ordinary: false, driven: true });
  });

  it("holds her Master, who does not drive, at the edge", async () => {
    const { gateMovement } = await import("../../module/rules/movement.mjs");
    const verdict = await withSubjects(aboard(), ({ unit, board }) => gateMovement(west({ i: 5, j: 5 }, 1), unit(ID.mast), board));
    expect(verdict.ok).toBe(false);
  });

  it("measures the drive against the mount's MOV and not her own", async () => {
    // Her own MOV is cut to 3; the mount's 7 is what a drive spends.
    const { gateMovement } = await import("../../module/rules/movement.mjs");
    const specs = [
      { from: "quetzalcoatl", id: ID.quetz, with: { mov: 3 }, panel: { i: 1, j: 2, k: 1 } },
      { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz }, panel: { i: 1, j: 1, k: 1 } },
    ];
    const out = await withSubjects(specs, ({ unit, board }) => ({
      five: gateMovement(east({ i: 1, j: 2 }, 5), unit(ID.quetz), board).ok,
      seven: gateMovement(east({ i: 1, j: 2 }, 7), unit(ID.quetz), board).ok,
      eight: gateMovement(east({ i: 1, j: 2 }, 8), unit(ID.quetz), board).ok,
    }));
    expect(out).toEqual({ five: true, seven: true, eight: false });
  });

  it("refuses a drive that would carry the mount's far panels off the board", async () => {
    // Quetz on the east column at the last column of the board: one step more and the mount hangs off.
    const { gateMovement } = await import("../../module/rules/movement.mjs");
    const specs = [
      { from: "quetzalcoatl", id: ID.quetz, panel: { i: 5, j: 11, k: 1 } },
      { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz }, panel: { i: 5, j: 10, k: 1 } },
    ];
    const out = await withSubjects(specs, ({ unit, board }) => ({
      onBoard: gateMovement(east({ i: 5, j: 11 }, 1), unit(ID.quetz), board).ok,
      off: gateMovement(east({ i: 5, j: 11 }, 2), unit(ID.quetz), board).ok,
    }));
    expect(out).toEqual({ onBoard: true, off: false });
  });

  it("is the ordinary gate for a unit that is not driving anything", async () => {
    const { gateMovement, validatePath } = await import("../../module/rules/movement.mjs");
    const out = await withSubjects([{ from: "heracles", id: ID.owner, panel: { i: 5, j: 5, k: 0 } }], ({ unit, board }) => ({
      driven: gateMovement(east({ i: 5, j: 5 }, 2), unit(ID.owner), board),
      ordinary: validatePath(east({ i: 5, j: 5 }, 2), unit(ID.owner), board),
    }));
    expect(out.driven).toEqual(out.ordinary);
  });

  it("the planner and the gate answer to the same mover: hers is the mount's, started from her panel", async () => {
    const { moverFor, planMovement } = await import("../../module/rules/movement.mjs");
    const specs = [
      { from: "quetzalcoatl", id: ID.quetz, with: { mov: 3 }, panel: { i: 1, j: 2, k: 1 } },
      { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz }, panel: { i: 1, j: 1, k: 1 } },
      { from: "master-advanced", id: ID.mast, panel: { i: 1, j: 1, k: 1 } },
    ];
    const out = await withSubjects(specs, ({ unit, board }) => {
      const mover = moverFor(unit(ID.quetz), board);
      return {
        id: mover.id, mov: mover.mov, panel: mover.panel, budget: planMovement(unit(ID.quetz), board).budget,
        master: moverFor(unit(ID.mast), board) === unit(ID.mast),
      };
    });
    expect(out).toEqual({ id: ID.mount, mov: 7, panel: { i: 1, j: 2, k: 1 }, budget: 7, master: true });
  });

  it("onPreMove asks it, not validatePath, for the drag", () => {
    const src = readFileSync("module/engine/movement-hooks.mjs", "utf8");
    expect(src).toMatch(/gateMovement\(path, unit, board/);
    expect(src).not.toMatch(/validatePath\(path, unit, board/);
  });
});

describe("the Turn Record the pair shares", () => {
  it("her mount shares hers, and she shares her mount's, and her Master shares nobody's", async () => {
    const { turnPartnersOf } = await import("../../module/rules/platforms.mjs");
    const out = await withSubjects(aboard(), ({ unit, board }) => ({
      quetz: turnPartnersOf(unit(ID.quetz), board).map((u) => u.id),
      mount: turnPartnersOf(unit(ID.mount), board).map((u) => u.id),
      master: turnPartnersOf(unit(ID.mast), board).map((u) => u.id),
    }));
    expect(out).toEqual({ quetz: [ID.mount], mount: [ID.quetz], master: [] });
  });

  it("nobody shares anything once she is off the mount", async () => {
    const { turnPartnersOf } = await import("../../module/rules/platforms.mjs");
    const out = await withSubjects(aboard({ quetz: { panel: { i: 9, j: 9, k: 0 } } }), ({ unit, board }) => ({
      quetz: turnPartnersOf(unit(ID.quetz), board).length,
      mount: turnPartnersOf(unit(ID.mount), board).length,
    }));
    expect(out).toEqual({ quetz: 0, mount: 0 });
  });

  it("a mount that replaces only the Normal Attack shares the Attack and not the Move", async () => {
    // The Golden Hind: *"Drake's Normal Attacks are replaced with Attacks from the Golden Hind"*, and the
    // ship keeps its own Move. Any Servant can own it here: Drake herself cannot be built through the real
    // model while her Riding authors the literal cooldown "@cooldown" (#120).
    const { turnPartnersOf } = await import("../../module/rules/platforms.mjs");
    const specs = [
      { from: "heracles", id: ID.owner, panel: { i: 5, j: 5, k: 1 } },
      { from: "platform-golden-hind", id: ID.hind, state: { ownerId: ID.owner }, panel: { i: 4, j: 4, k: 1 } },
    ];
    const out = await withSubjects(specs, ({ unit, board }) => ({
      move: turnPartnersOf(unit(ID.owner), board, "move").map((u) => u.id),
      attack: turnPartnersOf(unit(ID.owner), board, "attack").map((u) => u.id),
      shipAttack: turnPartnersOf(unit(ID.hind), board, "attack").map((u) => u.id),
      shipMove: turnPartnersOf(unit(ID.hind), board, "move").map((u) => u.id),
    }));
    expect(out).toEqual({ move: [], attack: [ID.hind], shipAttack: [ID.owner], shipMove: [] });
  });

  it("the three places that write a Turn Record write the partner's too", () => {
    const attack = readFileSync("module/engine/attack.mjs", "utf8");
    const declared = attack.slice(attack.indexOf("if (combat?.started && !resume && !free)"), attack.indexOf("await payAbilityPrice({ ability, attackerId"));
    expect(declared).toMatch(/turnPartnersOf\(/);

    const moves = readFileSync("module/engine/movement-hooks.mjs", "utf8");
    expect(moves.slice(moves.indexOf("const spent = panelsMoved(movement)"))).toMatch(/turnPartnersOf\(/);

    expect(readFileSync("module/engine/riding.mjs", "utf8")).toMatch(/turnPartnersOf\(/);
  });
});

describe("the Range she attacks with", () => {
  it("is the mount's while she rides and her own when she does not", async () => {
    const { attackRangeOf } = await import("../../module/rules/platforms.mjs");
    // A Range Up on her: 3. The mount's own is 2, and it is the mount that swings.
    const widened = { quetz: { with: { range: { panels: 3, targets: 1 } } } };
    const out = await withSubjects(aboard(widened), ({ unit, board }) => ({
      mounted: attackRangeOf(unit(ID.quetz), board),
      master: attackRangeOf(unit(ID.mast), board),
    }));
    expect(out.mounted).toBe(2);
    const afoot = await withSubjects(aboard({ quetz: { ...widened.quetz, panel: { i: 9, j: 9, k: 0 } } }), ({ unit, board }) => attackRangeOf(unit(ID.quetz), board));
    expect(afoot).toBe(3);
  });

  it("targetSpecFor reads it for a bare Normal Attack", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const spec = src.slice(src.indexOf("function targetSpecFor(attacker, ability, options = null, board = boardSnapshot())"), src.indexOf("export function targetSpecForAttack"));
    expect(spec).toMatch(/attackSourceOf\(/);
  });
});
