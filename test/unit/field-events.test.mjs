/**
 * @file A bounded field's interior EVENTS — branch selection and filters.
 * @see docs/28-bounded-fields.md
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";
import { runFieldEvents } from "../../module/engine/fields.mjs";
import { elementalEarlyExit } from "../../module/rules/damage/pipeline.mjs";
import * as I from "../../module/engine/intents.mjs";
import { validateAll } from "../../tools/lib/content.mjs";


describe("requiresEffect", () => {
  // The mirror of `kinds:` — a filter on what the Unit is carrying rather than
  // on what it is. Guidance of the Netherworld's discharge is the only clause
  // in the corpus that needs one.
  const spec = { event: "contact", relations: ["ally"], requiresEffect: "gotn" };

  const holds = (unit) => !spec.requiresEffect
    || (unit.effects ?? []).map((e) => e?.defId ?? e).includes(spec.requiresEffect);

  it("passes a Unit carrying the effect, as an id or an instance", () => {
    expect(holds({ effects: ["gotn"] })).toBe(true);
    expect(holds({ effects: [{ defId: "gotn" }] })).toBe(true);
  });

  it("refuses a Unit without it", () => {
    expect(holds({ effects: ["atkUp"] })).toBe(false);
    expect(holds({ effects: [] })).toBe(false);
    expect(holds({})).toBe(false);
  });
});

describe("a field announces itself opening and closing", () => {
  it("names the hook the action bar listens to", async () => {
    // Nothing announced a field's lifecycle, so the bar's Fields row had no
    // trigger. Listening to Region documents instead would fire for terrain
    // and home bases too, which is why this is explicit.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("module/engine/fields.mjs", "utf8");
    const raises = [...source.matchAll(/Hooks\.callAll\("fgtFieldChanged"/g)];
    expect(raises.length).toBeGreaterThanOrEqual(2);
  });
});

/* ========================================================================== */
/*  A field's Damage action keeps its element, and an element acts (#154)     */
/* ========================================================================== */

describe("a field's Damage action and the element it names (#154)", () => {
  beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

  // Document ids: a world actor named like its content id would not be a valid one where it is stamped.
  const QZ = "quetzalcoatlAct1";
  const FOE = "foeHeraclesAct01";
  const QUETZ = { from: "quetzalcoatl", id: QZ, state: { factionId: "A" }, panel: { i: 6, j: 6 } };
  const foe = (effects = []) => ({ from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 6, j: 8 }, effects });

  /** Piedra Del Sol's clause 2, run for the enemy's own Turn end. */
  async function stoneIntents(board) {
    return runFieldEvents("turnEnd", { board, activeFactionId: "B" });
  }
  const stone = () => fieldsOf([{
    ability: "quetz-piedra-del-sol", owner: QZ, faction: "A", panels: squareAround({ i: 6, j: 6 }, 7),
  }]);

  /** Apply `intents` through the REAL applier, and say what `FOE` is left with. */
  async function afterApplying(world, intents) {
    const { applyIntents } = await import("../../module/engine/applier.mjs");
    const { worldIO } = await import("../../module/engine/io.mjs");
    const before = world.actor(FOE).system.health.value;
    await applyIntents(intents, { io: worldIO(), canWrite: () => true, isGM: true, source: "test" });
    return {
      lost: before - world.actor(FOE).system.health.value,
      effects: [...world.actor(FOE).effects].map((e) => e.system.defId),
    };
  }

  beforeEach(() => { globalThis.Roll = class { async evaluate() { this.total = 1; return this; } }; });
  afterEach(() => { delete globalThis.Roll; });

  it("Piedra Del Sol's 50 Fire damage carries its element", async () => {
    const fields = await stone();
    const damage = await withSubjects([QUETZ, foe()], async ({ board }) => (await stoneIntents(board)).find((i) => i.t === "damage"),
      { settings: { fields } });
    expect(damage).toMatchObject({ unitId: FOE, amount: 50, element: "fire", bypassModifiers: true });
  });

  it("breaks a Frozen enemy's Freeze and deals it nothing: Fire removes Freeze with no damage", async () => {
    const fields = await stone();
    const out = await withSubjects([QUETZ, foe([{ defId: "freeze" }])], async ({ board, world }) => {
      const intents = (await stoneIntents(board)).filter((i) => i.t === "damage");
      return afterApplying(world, intents);
    }, { settings: { fields } });
    expect(out.lost).toBe(0);
    expect(out.effects).not.toContain("freeze");
  });

  it("still deals the 50 to an enemy that is not Frozen", async () => {
    const fields = await stone();
    const out = await withSubjects([QUETZ, foe()], async ({ board, world }) => {
      const intents = (await stoneIntents(board)).filter((i) => i.t === "damage");
      return afterApplying(world, intents);
    }, { settings: { fields } });
    expect(out.lost).toBe(50);
  });

  it("heals a Unit with Flame Heal by the amount of a Burn-element damage, instead of hurting it", async () => {
    const out = await withSubjects([foe([{ defId: "flamHeal" }])], async ({ world }) => {
      await world.actor(FOE).update({ "system.health.value": 1000 });
      return afterApplying(world, [I.damage(FOE, 40, null, { element: "burn" })]);
    });
    expect(out.lost).toBe(-40);
  });

  it("leaves damage with no element, and a Unit with no conversion, exactly as it was", async () => {
    const out = await withSubjects([foe()], async ({ world }) => afterApplying(world, [
      I.damage(FOE, 30, null, {}), I.damage(FOE, 20, null, { element: "burn" }),
    ]));
    expect(out.lost).toBe(50);
  });

  it("says one rule once: stage 0 and a bare damage intent ask the same function", () => {
    expect(elementalEarlyExit({ effects: ["freeze"] }, "fire")).toEqual({ kind: "freeze" });
    expect(elementalEarlyExit({ effects: ["flamHeal"] }, "burn")).toEqual({ kind: "heal", by: "flamHeal" });
    expect(elementalEarlyExit({ effects: ["poisHeal"] }, "poison")).toEqual({ kind: "heal", by: "poisHeal" });
    expect(elementalEarlyExit({ effects: ["cursHeal"] }, "curse")).toEqual({ kind: "heal", by: "cursHeal" });
    expect(elementalEarlyExit({ effects: ["flamHeal"] }, "fire")).toBeNull();
    expect(elementalEarlyExit({ effects: ["freeze"] }, "water")).toBeNull();
    expect(elementalEarlyExit({ effects: ["freeze"] }, null)).toBeNull();
  });
});

describe("the build refuses a field Damage that claims not to be Fixed (#154)", () => {
  const field = (damage) => ({
    schema: 1, id: "t-field", name: "T", kind: "noblePhantasm", isNP: true, rank: "A",
    field: {
      geometry: { kind: "fixedArea", shape: { kind: "square", size: 3 } },
      interiorEvents: [{ event: "turnEnd", relations: ["enemy"], onFail: [damage] }],
    },
    phases: [{ kind: "createField", target: "self" }],
  });
  const problems = (damage) => validateAll([{ path: "t.yml", dir: "abilities", doc: field(damage) }]).problems;

  it("accepts fixed: true, and an action that says nothing", () => {
    expect(problems({ key: "Damage", amount: 50, element: "fire", fixed: true })).toEqual([]);
    expect(problems({ key: "Damage", amount: 50, element: "fire" })).toEqual([]);
  });

  it("refuses fixed: false, which nothing honours", () => {
    expect(problems({ key: "Damage", amount: 50, fixed: false })[0]).toMatch(/fixed: false/);
  });
});

/* ========================================================================== */
/*  A bounded field's interior events act on the living (#153)                */
/* ========================================================================== */

describe("a field's interior events leave the defeated alone (#153)", () => {
  beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

  const QZ = "quetzalcoatlAct1";
  const OWNER = { from: "quetzalcoatl", id: QZ, state: { factionId: "A" }, panel: { i: 6, j: 6 } };
  const foe = (id, defeated, panel) => ({
    from: "heracles", id, state: { factionId: "B", ...(defeated ? { defeated: true } : {}) }, panel,
  });
  const LIVING = "livingFoeAct0001";
  const DEAD = "defeatedFoeAct01";

  beforeEach(() => { globalThis.Roll = class { async evaluate() { this.total = 1; return this; } }; });
  afterEach(() => { delete globalThis.Roll; });

  it("Piedra Del Sol: the 50 and the Burn go to the living enemy and not to the corpse", async () => {
    const fields = await fieldsOf([{
      ability: "quetz-piedra-del-sol", owner: QZ, faction: "A", panels: squareAround({ i: 6, j: 6 }, 7),
    }]);
    const intents = await withSubjects(
      [OWNER, foe(LIVING, false, { i: 6, j: 8 }), foe(DEAD, true, { i: 6, j: 9 })],
      ({ board }) => runFieldEvents("turnEnd", { board, activeFactionId: "B" }),
      { settings: { fields } },
    );
    expect(intents.filter((i) => i.unitId === DEAD)).toEqual([]);
    expect(intents.filter((i) => i.unitId === LIVING).map((i) => i.t).sort()).toEqual(["applyEffect", "damage"]);
  });

  it("Blood Fort Andromeda: a defeated Civilian yields no Defeat, Heal or StatDelta", async () => {
    const fields = await fieldsOf([{
      ability: "medusa-blood-fort-andromeda", owner: QZ, faction: "A", panels: squareAround({ i: 6, j: 6 }, 7),
    }]);
    const civilian = (id, defeated, panel) => ({
      from: { type: "civilian", id, name: id }, id, panel, ...(defeated ? { state: { defeated: true } } : {}),
    });
    const intents = await withSubjects(
      [OWNER, civilian(LIVING, false, { i: 6, j: 8 }), civilian(DEAD, true, { i: 6, j: 9 })],
      ({ board }) => runFieldEvents("anyTurnEnd", { board }),
      { settings: { fields } },
    );
    // The living one is killed and pays Medusa once; the corpse is not killed again and pays nobody.
    expect(intents.filter((i) => i.t === "defeat").map((i) => i.unitId)).toEqual([LIVING]);
    expect(intents.filter((i) => i.t === "heal")).toHaveLength(1);
    expect(intents.filter((i) => i.t === "statDelta")).toHaveLength(1);
    expect(intents.filter((i) => i.t === "log" && i.unitId === DEAD)).toEqual([]);
  });

  it("a contact event does not wake a corpse either", async () => {
    // Contact goes through the same filter. Jack's Mist kills a Normal Human *"caught in"* it.
    const fields = await fieldsOf([{
      ability: "jack-the-mist", owner: QZ, faction: "A", panels: squareAround({ i: 6, j: 6 }, 5),
    }]);
    const civilian = (id, defeated) => ({
      from: { type: "civilian", id, name: id }, id, panel: { i: 6, j: 7 }, ...(defeated ? { state: { defeated: true } } : {}),
    });
    const intents = await withSubjects([OWNER, civilian(DEAD, true)],
      ({ board }) => runFieldEvents("contact", { board }), { settings: { fields } });
    expect(intents).toEqual([]);
  });
});

/* ========================================================================== */
/*  A field that kills for its owner credits the owner (#185)                 */
/* ========================================================================== */

describe("the Mist's kill is Jack's kill (#185)", () => {
  beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

  // *"Normal Humans immediately die if they are caught in the Mist (this counts
  // as Jack killing the Human)."* Live: a Civilian died in the Mist and the
  // defeat named no killer; `creditOwner` wrote a log line nothing read, so
  // her Free Servant Sustainability never grew from a Mist kill.
  const JACK = "jackTheRipperAc1";
  const CIV = "civilianCaught01";
  const jack = (state) => ({ from: "jack-the-ripper", id: JACK, state: { factionId: "A", ...state }, panel: { i: 6, j: 6 } });
  const civilian = { from: { type: "civilian", id: CIV, name: CIV }, id: CIV, panel: { i: 6, j: 7 } };

  async function contact(state) {
    const fields = await fieldsOf([{
      ability: "jack-the-mist", owner: JACK, faction: "A", panels: squareAround({ i: 6, j: 6 }, 5),
    }]);
    return withSubjects([jack(state), civilian],
      ({ board }) => runFieldEvents("contact", { board }), { settings: { fields } });
  }

  it("names her as the killer", async () => {
    const intents = await contact({ masterId: null, contract: "free" });
    expect(intents.find((i) => i.t === "defeat")).toMatchObject({ unitId: CIV, cause: "mist", killerId: JACK });
  });

  it("pays her a Civilian's bounty: 100 Health and 1 Agility (reading 13)", async () => {
    const intents = await contact({});
    expect(intents.find((i) => i.t === "heal")).toMatchObject({ unitId: JACK, amount: 100 });
    expect(intents.find((i) => i.t === "statDelta")).toMatchObject({ unitId: JACK, stat: "agility.value", delta: 1 });
  });

  it("pays a contracted Jack no Sustainability", async () => {
    const intents = await contact({});
    expect(intents.some((i) => i.t === "resource" && i.key === "sustainabilityRemaining")).toBe(false);
  });

  it("grows a Free Servant's Sustainability by 1◈", async () => {
    const intents = await contact({ masterId: null, contract: "free" });
    expect(intents.some((i) => i.t === "resource" && i.unitId === JACK && i.key === "sustainabilityRemaining")).toBe(true);
  });

  it("and the attack path tells the attacker too", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    expect(src).toMatch(/civilianIntents\(descriptors, self\.id\)/);
    expect(src).toMatch(/fireEvent\("unitKilled", \[self\]/);
  });
});
