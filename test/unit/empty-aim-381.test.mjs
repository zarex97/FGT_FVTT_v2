/**
 * An Empty Aim (#381): an area Attack aimed where its user sees no Unit.
 * @see docs/20-targeting.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";
import { resolveTargets, unitsShown } from "../../module/rules/targeting/resolve.mjs";
import { unseenCard } from "../../module/apps/chat/surface.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const GIL = "emptyAimGil00001";
const FOE = "emptyAimFoe00001";
const ALLY = "emptyAimAlly0001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const gil = () => ({ from: "gilgamesh", id: GIL, panel: { i: 6, j: 6 }, state: { factionId: "A" } });
const foe = (panel, extra = {}) => ({ from: "drake", id: FOE, panel, ...extra, state: { factionId: "B", ...(extra.state ?? {}) } });
const hidden = { effects: [{ defId: "presenceConcealment", expiry: 40 }] };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const aim = (unit, ability, board, placement = { direction: "e", reach: "attack" }) => resolveTargets(ability.system.targeting, unit, board, placement);

describe("what an area Attack may be aimed at", () => {
  it("passes over nothing, with a warning and no error", async () => {
    await withSubjects([gil(), foe({ i: 2, j: 2 })], ({ unit, world: w, board }) => {
      const r = aim(unit(GIL), abilityOf(w, GIL, "gilgamesh-enuma-elish"), board);
      expect(r.errors).toEqual([]);
      expect(r.emptyAim).toBe(true);
      expect(r.units).toEqual([]);
    }, WAR);
  });

  it("passes over only a concealed enemy, catches it, and shows it to nobody aiming", async () => {
    await withSubjects([gil(), foe({ i: 6, j: 8 }, hidden)], ({ unit, world: w, board }) => {
      const r = aim(unit(GIL), abilityOf(w, GIL, "gilgamesh-enuma-elish"), board);
      expect(r.errors).toEqual([]);
      expect(r.emptyAim).toBe(true);
      expect(r.units.map((t) => t.unitId)).toEqual([FOE]);
      expect(r.units[0]).toMatchObject({ unseen: true, concealedAoE: true });
      expect(unitsShown(r)).toEqual([]);
    }, WAR);
  });

  it("reads the same warning either way, so the warning tells nothing", async () => {
    const warningOf = (specs) => withSubjects(specs, ({ unit, world: w, board }) => aim(unit(GIL), abilityOf(w, GIL, "gilgamesh-enuma-elish"), board).warnings, WAR);
    expect(await warningOf([gil(), foe({ i: 2, j: 2 })])).toEqual(await warningOf([gil(), foe({ i: 6, j: 8 }, hidden)]));
  });

  it("keeps a concealed Unit the dialog never offered when it sends its choice", async () => {
    await withSubjects([gil(), foe({ i: 6, j: 8 }, hidden)], ({ unit, world: w, board }) => {
      const r = aim(unit(GIL), abilityOf(w, GIL, "gilgamesh-enuma-elish"), board, { direction: "e", reach: "attack", chosenIds: [] });
      expect(r.units.map((t) => t.unitId)).toEqual([FOE]);
    }, WAR);
  });

  it("treats a concealed friend as seen: the area is not empty", async () => {
    await withSubjects([gil(), { from: "drake", id: ALLY, panel: { i: 6, j: 8 }, ...hidden, state: { factionId: "A" } }], ({ unit, world: w, board }) => {
      const r = aim(unit(GIL), abilityOf(w, GIL, "gilgamesh-enuma-elish"), board);
      expect(r.emptyAim).toBe(false);
      expect(r.units[0].unseen).toBeUndefined();
      expect(unitsShown(r).map((t) => t.unitId)).toEqual([ALLY]);
    }, WAR);
  });

  it("counts a body as nothing, and still lists it", async () => {
    await withSubjects([gil(), foe({ i: 6, j: 8 }, { state: { defeated: true } })], ({ unit, world: w, board }) => {
      const r = aim(unit(GIL), abilityOf(w, GIL, "gilgamesh-enuma-elish"), board);
      expect(r.errors).toEqual([]);
      expect(r.emptyAim).toBe(true);
      expect(r.excluded.map((e) => e.reason)).toEqual(expect.arrayContaining(["defeated"]));
    }, WAR);
  });

  it("does not open a Skill's area: its reach is the effect's", async () => {
    await withSubjects([gil(), foe({ i: 2, j: 2 })], ({ unit, world: w, board }) => {
      const r = aim(unit(GIL), abilityOf(w, GIL, "gilgamesh-enuma-elish"), board, { direction: "e", reach: "effect" });
      expect(r.emptyAim).toBe(false);
      expect(r.errors.join()).toMatch(/No legal targets/);
    }, WAR);
  });
});

describe("the use, paid in full", () => {
  it("spends its clock, its Master and its Attack, opens no Process, and says one line", async () => {
    await withSubjects([gil(), foe({ i: 2, j: 2 })], async ({ world: w }) => {
      const ee = abilityOf(w, GIL, "gilgamesh-enuma-elish");
      const out = await playAttack(w, { attacker: GIL, ability: ee.id, placement: { direction: "e" } });
      expect(out?.processes ?? []).toEqual([]);
      expect(w.actor(GIL).items.get(ee.id).system.cooldown.remaining).toBe(24);
      expect(w.actor(GIL).system.turnState.attacked).toBe(true);
    }, WAR);
  });
});

describe("the card a hidden Unit's Process makes", () => {
  const state = { unseenByAttacker: true };
  it("is closed to the attacker's side until the damage lands", () => {
    expect(unseenCard({ state })).toBe(true);
    expect(unseenCard({ state, result: { flags: { concealmentVeil: { heads: true } } } })).toBe(true);
    expect(unseenCard({ state, result: { flags: { concealmentVeil: { heads: false } } } })).toBe(false);
    expect(unseenCard({ state, result: { flags: {} } })).toBe(false);
  });
  it("is open to the GM, the defender's side, and on any other Process", () => {
    expect(unseenCard({ state, isGM: true })).toBe(false);
    expect(unseenCard({ state, seesDefender: true })).toBe(false);
    expect(unseenCard({ state: {} })).toBe(false);
  });
});
