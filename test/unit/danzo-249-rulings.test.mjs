/**
 * @file Katō Danzō's build (#249): her Clauses and the readings the grill ruled, slice by slice.
 * @see docs/superpowers/specs/2026-10-17-kato-danzo-clauses.md, docs/D-servant-data-sheets.md §D.20
 *
 * Built through `test/helpers/subject.mjs`: every figure below is authored content reaching the
 * engine through the real compile and projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";
import { isCooling } from "../../module/rules/items.mjs";
import { watermarkKey } from "../../module/domain/health.mjs";
import { concealmentProfile } from "../../module/rules/concealment.mjs";
import { discoverChance } from "../../module/rules/identity.mjs";
import { swapPlan } from "../../module/rules/swap.mjs";
import { untouchableBy } from "../../module/rules/untouchable.mjs";
import { hiddenFromViewer } from "../../module/rules/concealment.mjs";
import { terrainEffects } from "../../module/rules/terrain.mjs";

beforeAll(prepareSubjects, 120_000);

const DANZO = "danzoSubject0001";
const TICK = 12;

/** One of a Subject's abilities, by content id. */
const abilityOf = (world, actorId, contentId) =>
  world.actor(actorId).items.find((i) => i.system?.contentId === contentId);

/** The use gate, asked of the real document the way `useSkill` asks it. */
const gate = (item, unit, ctx = {}) => canUseAbility({
  ability: usageSpecFor(item), unit, round: 5, turnsPerRound: 3, ...ctx,
});

const danzo = (fn, { state = {}, effects = [] } = {}) => withSubjects(
  [{ from: "kato-danzo", id: DANZO, state: { factionId: "red", ...state }, effects }],
  ({ world, unit }) => fn({ world, unit: unit(DANZO) }),
  { tick: TICK },
);

/* ========================================================================== */
/*  Slice 1: the statblock and the plain Skills                               */
/* ========================================================================== */

describe("her statblock (SB, reading 1)", () => {
  it("is an Assassin of Japan, True Neutral, with the Attributes her sheet prints", async () => {
    await danzo(({ unit }) => {
      expect(unit.region).toEqual(["japan"]);
      expect(unit.attributes).toEqual(expect.arrayContaining(["female", "servant", "man", "humanoid", "mechanical"]));
      expect(unit.mov).toBe(7);
      expect(unit.range).toBe(3);
    });
  });

  it("takes BA(STR) 75 from the STR table, not the printed 65 (§46.6), and BA(MAG) 150", async () => {
    await danzo(({ unit }) => {
      expect(unit.baseAttack).toMatchObject({ str: 75, mag: 150 });
    });
  });

  it("carries Presence Concealment at Rank A", async () => {
    await danzo(({ world }) => {
      const pc = world.actor(DANZO).items.find((i) => i.system?.slug === "presenceConcealment");
      expect(pc.system.rank).toBe("A");
    });
  });
});

describe("Synthetic Limbs (SL.p, SL.p.bleed)", () => {
  it("makes her Immune to Sap and to Bleed", async () => {
    await danzo(({ unit }) => {
      expect(unit.immunities).toEqual(expect.arrayContaining(["sap", "bleed"]));
    });
  });
});

describe("Tobikatō (TK.*, reading 10)", () => {
  it("gives three Dodges in one application", async () => {
    await danzo(({ world }) => {
      const dodge = abilityOf(world, DANZO, "danzo-tobikato").system.phases[0].effects.find((e) => e.id === "dodge");
      expect(dodge).toMatchObject({ duration: "1◈", uses: 3 });
    });
  });

  it("is refused on a Turn Harisenbon or Funshindan was used, one way, as written", async () => {
    for (const partner of ["danzo-harisenbon", "danzo-funshindan"]) {
      await danzo(({ world, unit }) => {
        expect(gate(abilityOf(world, DANZO, "danzo-tobikato"), unit, { actingFactionId: "red" }))
          .toMatchObject({ ok: false, reason: "sameTurnExclusive" });
      }, { state: { turnState: { tick: TICK, abilitiesUsed: [partner] } } });
    }
  });
});

describe("Subversive Activities (SA.*)", () => {
  it("can be used while she is concealed, though it reaches enemies", async () => {
    await danzo(({ world, unit }) => {
      expect(gate(abilityOf(world, DANZO, "danzo-subversive-activities"), unit, { actingFactionId: "red" }).ok).toBe(true);
    }, { effects: [{ defId: "presenceConcealment", unremovable: true }] });
  });
});

/* ========================================================================== */
/*  Slice 4: one reader of "on Cooldown"                                       */
/* ========================================================================== */

describe("\"on Cooldown\" reads the whole Cooldown line (#249 readings 20, 37)", () => {
  const key = watermarkKey(0.75);
  const kirihanasu = { cooldownRemaining: 0, lastUsedTick: 10, restoreGate: { fraction: 0.75 } };

  it("is cooling while its clock runs", () => {
    expect(isCooling({ ...kirihanasu, cooldownRemaining: 2 }, { healthWatermarks: { [key]: 11 } })).toBe(true);
  });

  it("is cooling after its clock until Health has been above 75% since the use", () => {
    expect(isCooling(kirihanasu, { healthWatermarks: {} })).toBe(true);
    expect(isCooling(kirihanasu, { healthWatermarks: { [key]: 9 } })).toBe(true);
    expect(isCooling(kirihanasu, { healthWatermarks: { [key]: 10 } })).toBe(false);
  });

  it("is not cooling when never used, or with no restore gate", () => {
    expect(isCooling({ ...kirihanasu, lastUsedTick: null }, {})).toBe(false);
    expect(isCooling({ cooldownRemaining: 0 }, {})).toBe(false);
  });

  it("is projected from the ability's own requirement (Rho Aias)", async () => {
    const gate = await withSubjects([{ from: "emiya", id: "emiyaRhoAias0001" }],
      ({ unit }) => unit("emiyaRhoAias0001").abilities.find((a) => a.contentId === "emiya-rho-aias")?.restoreGate);
    expect(gate).toEqual({ fraction: 0.5 });
  });
});

/* ========================================================================== */
/*  Slice 5: one reader of Presence Concealment's numbers                      */
/* ========================================================================== */

describe("concealmentProfile: the instance first, then the Skill (#249 readings 2, 4)", () => {
  const PC = (params) => ({ defId: "presenceConcealment", unremovable: true, ...(params ? { params } : {}) });

  it("reads her own Rank A off the Skill: 10%, +4, 2◈", async () => {
    await danzo(({ unit }) => {
      expect(concealmentProfile(unit)).toEqual({ rank: "A", evade: 4, discover: 10, cooldown: "2◈", granted: false });
      expect(discoverChance(unit)).toBe(10);
    }, { effects: [PC()] });
  });

  it("reads a granted C+ off the instance, on a Unit with no Skill: +2, 35%, no clock", async () => {
    const out = await withSubjects([{ from: "medea", id: "medeaGranted0001", effects: [PC({ rank: "C+", evade: 2 })] }],
      ({ unit }) => ({ profile: concealmentProfile(unit("medeaGranted0001")), discover: discoverChance(unit("medeaGranted0001")) }));
    expect(out.profile).toEqual({ rank: "C+", evade: 2, discover: 35, cooldown: null, granted: true });
    expect(out.discover).toBe(35);
  });
});

/* ========================================================================== */
/*  Slice 7: where two Units trading places land                               */
/* ========================================================================== */

describe("swapPlan (#249 readings 13, 38)", () => {
  const board = { bounds: { iMin: 0, iMax: 19, jMin: 0, jMax: 19 }, units: [] };

  it("trades one panel for one panel", () => {
    const plan = swapPlan({ id: "d", panel: { i: 5, j: 5 } }, { id: "p", panel: { i: 3, j: 5 } }, board);
    expect(plan).toMatchObject({ mover: { i: 3, j: 5 }, partner: { i: 5, j: 5 }, knockback: [] });
  });

  it("covers her panel with a 2x2 partner, keeping most of its old footprint, and sends her to a freed panel", () => {
    const partner = { id: "p", panel: { i: 3, j: 5 }, panels: [{ i: 3, j: 5 }, { i: 3, j: 6 }, { i: 4, j: 5 }, { i: 4, j: 6 }] };
    const plan = swapPlan({ id: "d", panel: { i: 5, j: 5 } }, partner, board);
    expect(plan.partnerPanels).toContainEqual({ i: 5, j: 5 });
    expect(plan.partner).toEqual({ i: 4, j: 5 });
    expect(plan.mover).toEqual({ i: 3, j: 5 });
  });
});

/* ========================================================================== */
/*  Slice 9: the ghost                                                         */
/* ========================================================================== */

describe("the ghost a Feigned Defeat leaves (#249 readings 19, 26-28, 34, 35)", () => {
  const GHOST = [{ defId: "feignedDefeat", unremovable: true }];

  it("projects its grants: shares panels, off budget, untouchable but by itself", async () => {
    await danzo(({ unit }) => {
      expect(unit.sharesPanel).toBe(true);
      expect(unit.exemptFromBudget).toBe(true);
      expect(untouchableBy(unit, "someoneElse00001")).toBe(true);
      expect(untouchableBy(unit, DANZO)).toBe(false);
    }, { effects: GHOST });
  });

  it("may use a Skill that touches herself, an Attack, and nothing that touches another", async () => {
    await danzo(({ world, unit }) => {
      const use = (id) => gate(abilityOf(world, DANZO, id), unit, { actingFactionId: "red" });
      expect(use("danzo-synthetic-limbs").ok).toBe(true);
      expect(use("danzo-subversive-activities")).toMatchObject({ ok: false, reason: "feignedDefeat" });
      expect(use("danzo-funshindan").ok, "an Attack, which reveals her").toBe(true);
    }, { effects: GHOST });
  });

  it("is hidden from every player but her owner, teammates included", () => {
    const unit = { factionId: "red", effects: ["feignedDefeat", "presenceConcealment"] };
    const factions = [{ id: "red", userIds: ["mate"] }];
    expect(hiddenFromViewer(unit, { userId: "mate", isGM: false, isOwner: true, isTrueOwner: false }, factions)).toBe(true);
    expect(hiddenFromViewer(unit, { userId: "owner", isGM: false, isOwner: true, isTrueOwner: true }, factions)).toBe(false);
    expect(hiddenFromViewer(unit, { userId: "gm", isGM: true }, factions)).toBe(false);
  });

  it("is untouched by Terrain: a Forest costs others a panel and her nothing", () => {
    const board = { terrain: { areas: [{ type: "forest", panels: [{ i: 0, j: 0 }] }] } };
    expect(terrainEffects({ panel: { i: 0, j: 0 } }, board).movDelta).toBe(-1);
    expect(terrainEffects({ panel: { i: 0, j: 0 }, grantedAbilities: ["ignoresTerrain"] }, board).movDelta).toBe(0);
  });
});
