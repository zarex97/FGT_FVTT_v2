/**
 * @file A defeated Unit's token stays on the board; nothing it carries still acts (#168).
 * @see module/rules/auras.mjs, module/rules/targeting/resolve.mjs, docs/20-targeting.md
 *
 * A defeat never removes the token (`engine/io.mjs`), so every per-Unit reader
 * that walks `board.units` meets the corpse. Two of them did not look: a dead
 * Medea's Item Construction went on giving her ally +50 incoming debuff
 * resistance, and the same Ehecatle preview listed her as a checked target.
 *
 * Every Unit here is authored and projected for real (`test/helpers/subject.mjs`):
 * `defeated` is the world's own `system.defeated`, read by the real snapshot.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { guardsOf } from "../../module/rules/relations.mjs";
import { canAttemptContract } from "../../module/rules/contract.mjs";

beforeAll(prepareSubjects, 60_000);

const at = (i, j) => ({ i, j });

const MEDEA = "medeaCaster00001";
const NEMO = "nemoAllyUnit0001";
const FOE = "enemyUnitFoe0001";

const medeaBoard = (defeated) => [
  { from: "medea", id: MEDEA, panel: at(5, 5), state: { factionId: "f1", defeated } },
  { from: "nemo", id: NEMO, panel: at(5, 7), state: { factionId: "f1" } },
  { from: "heracles", id: FOE, panel: at(8, 8), state: { factionId: "f2" } },
];

const itemConstruction = (u) =>
  (u.applicationChances ?? []).filter((c) => c.source === "Item Construction");

describe("a defeated aura bearer (#168)", () => {
  it("living Medea shields her ally two panels away", async () => {
    const chances = await withSubjects(medeaBoard(false), ({ unit }) => itemConstruction(unit(NEMO)));
    expect(chances.some((c) => c.direction === "incoming")).toBe(true);
  });

  it("defeated Medea shields nobody, though her token stands beside him", async () => {
    const [chances, board] = await withSubjects(medeaBoard(true), ({ unit, board }) => [itemConstruction(unit(NEMO)), board]);
    expect(board.units.find((u) => u.id === MEDEA).defeated).toBe(true);
    expect(chances).toEqual([]);
  });

  it("an area lists her NOT TARGETED with the reason, and her ally is still a target", async () => {
    const spec = {
      anchor: { kind: "self" },
      shape: { kind: "chebyshevRadius", r: 4 },
      selection: { relations: ["ally"], chooser: "all", includeSelf: false },
    };
    const caster = { from: "heracles", id: FOE, panel: at(5, 6), state: { factionId: "f1" } };
    const r = await withSubjects(
      [
        caster,
        { from: "medea", id: MEDEA, panel: at(5, 5), state: { factionId: "f1", defeated: true } },
        { from: "nemo", id: NEMO, panel: at(5, 7), state: { factionId: "f1" } },
      ],
      ({ unit, board }) => resolveTargets(spec, unit(FOE), board),
    );
    expect(r.units.map((u) => u.unitId)).toEqual([NEMO]);
    expect(r.excluded).toContainEqual(expect.objectContaining({ unitId: MEDEA, reason: "defeated" }));
  });

  it("a living Medea is a target of the same area", async () => {
    const spec = {
      anchor: { kind: "self" },
      shape: { kind: "chebyshevRadius", r: 4 },
      selection: { relations: ["ally"], chooser: "all", includeSelf: false },
    };
    const r = await withSubjects(
      [
        { from: "heracles", id: FOE, panel: at(5, 6), state: { factionId: "f1" } },
        { from: "medea", id: MEDEA, panel: at(5, 5), state: { factionId: "f1" } },
      ],
      ({ unit, board }) => resolveTargets(spec, unit(FOE), board),
    );
    expect(r.units.map((u) => u.unitId)).toEqual([MEDEA]);
  });
});

describe("the other readers that must not see a corpse (#168)", () => {
  const MASTER = "masterOfFact0001";

  it("a defeated Servant guards no Master, so the Master can be aimed at", async () => {
    const make = (defeated) => [
      { from: "master-normal", id: MASTER, panel: at(5, 5), state: { factionId: "f1" } },
      { from: "nemo", id: NEMO, panel: at(5, 6), state: { factionId: "f1", masterId: MASTER, defeated } },
      { from: "heracles", id: FOE, panel: at(5, 8), state: { factionId: "f2" } },
    ];
    const spec = {
      anchor: { kind: "self" },
      shape: { kind: "chebyshevRadius", r: 4 },
      selection: { relations: ["enemy"], chooser: "chosen", count: 3 },
    };
    const alive = await withSubjects(make(false), ({ unit, board }) => [
      guardsOf(unit(MASTER), board).map((u) => u.id), resolveTargets(spec, unit(FOE), board).candidates.map((u) => u.unitId),
    ]);
    expect(alive[0]).toEqual([NEMO]);
    expect(alive[1]).not.toContain(MASTER);

    const dead = await withSubjects(make(true), ({ unit, board }) => [
      guardsOf(unit(MASTER), board).map((u) => u.id), resolveTargets(spec, unit(FOE), board).candidates.map((u) => u.unitId),
    ]);
    expect(dead[0]).toEqual([]);
    expect(dead[1]).toContain(MASTER);
  });

  it("a defeated Greek Male does not compel Penthesilea", async () => {
    const make = (defeated) => [
      { from: "penthesilea", id: MEDEA, panel: at(5, 5), state: { factionId: "f1" } },
      { from: "achilles", id: NEMO, panel: at(5, 6), state: { factionId: "f2", defeated } },
    ];
    const compulsions = (defeated) => withSubjects(make(defeated), ({ unit }) => unit(MEDEA).compulsions ?? []);
    expect((await compulsions(false)).length).toBeGreaterThan(0);
    expect(await compulsions(true)).toEqual([]);
  });

  it("a defeated enemy Servant standing next to a Master does not forbid contracting", async () => {
    const make = (defeated) => [
      { from: "master-normal", id: MASTER, panel: at(5, 5), state: { factionId: "f1" } },
      { from: "nemo", id: NEMO, panel: at(5, 6), state: { factionId: "f2", contract: "free" } },
      { from: "heracles", id: FOE, panel: at(5, 7), state: { factionId: "f2", defeated } },
    ];
    const verdict = (defeated) => withSubjects(make(defeated), ({ unit, board }) =>
      canAttemptContract(unit(MASTER), unit(NEMO), board));
    expect((await verdict(false)).reason).toBe("enemyNearby");
    expect(await verdict(true)).toEqual({ ok: true });
  });
});
