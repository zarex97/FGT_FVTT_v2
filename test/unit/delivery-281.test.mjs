/**
 * An Attack's delivery, Ranged, Melee or Special, as the sheet states it (#281).
 * Ruled 2026-10-24 in the Arturia (Lancer) grill, rulings 8 and 11–16.
 * @see docs/superpowers/specs/2026-10-24-lanceturia-clauses.md, module/rules/delivery.mjs
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { importAttack } from "../helpers/engine.mjs";
import {
  DELIVERIES, NORMAL_ATTACK_DELIVERY, deliveryOf, statedDeliveryOf, rangedMinimumRange,
} from "../../module/rules/delivery.mjs";
import { normalAttackAt } from "../../module/rules/normal-attack.mjs";
import { crossLevelLegal } from "../../module/rules/platforms.mjs";
import { nullifiedBy } from "../../module/rules/miss.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { parseOption } from "../../module/rules/facets.mjs";
import { targetSpecFor } from "../../module/rules/ability-use.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { expandInstances } from "../../module/rules/damage/instances.mjs";

beforeAll(prepareSubjects, 120_000);
let engine;
beforeAll(async () => { engine = await importAttack(); }, 60_000);
vi.setConfig({ testTimeout: 30_000 });

const at = (i, j) => ({ i, j });

/* ========================================================================== */

describe("one reader: stated wins, else measured (rulings 11, 12, 13)", () => {
  const board = (min) => ({ rules: { rangedMinimumRange: min } });

  it("a stated tag wins over the Range, whatever it is", () => {
    expect(deliveryOf({ stated: "melee", reach: 5 }, board(2))).toBe("melee");
    expect(deliveryOf({ stated: "ranged", reach: 1 }, board(2))).toBe("ranged");
    expect(deliveryOf({ stated: "special", reach: 5 }, board(2))).toBe("special");
  });

  it("an Attack that states none is measured against the War Rule", () => {
    expect(deliveryOf({ reach: 2 }, board(2))).toBe("ranged");
    expect(deliveryOf({ reach: 1 }, board(2))).toBe("melee");
    expect(deliveryOf({ reach: 2 }, board(3))).toBe("melee");
    expect(rangedMinimumRange(null)).toBe(2);
  });

  it("an unknown word is not a statement: it is measured, never trusted", () => {
    expect(deliveryOf({ stated: "Ranged", reach: 1 }, board(2))).toBe("melee");
    expect(deliveryOf({ stated: "normalAttack", reach: 3 }, board(2))).toBe("ranged");
  });

  it("what an ability's spec states: its block, the Normal Attack's for a Mana Burst, or none", () => {
    expect(statedDeliveryOf(null)).toBe(NORMAL_ATTACK_DELIVERY);
    expect(statedDeliveryOf({ system: { damage: { delivery: "special" } } })).toBe("special");
    expect(statedDeliveryOf({ system: { countsAsNormalAttack: true, damage: {} } })).toBe(NORMAL_ATTACK_DELIVERY);
    expect(statedDeliveryOf({ system: { damage: { component: "str" } } })).toBe(null);
  });
});

describe("the closest statement wins (ruling 11)", () => {
  it("a Normal Attack's band over its own: Trung Sisters' STR, Melee (1pan); MAG, Ranged (2+pan)", () => {
    const unit = { normalAttack: {
      mode: "rangeBanded", component: "str", delivery: "melee",
      bands: [{ from: 2, component: "mag", delivery: "ranged" }],
    } };
    expect(normalAttackAt(unit, 1).delivery).toBe("melee");
    expect(normalAttackAt(unit, 2).delivery).toBe("ranged");
    expect(normalAttackAt({ normalAttack: { mode: "fixed", component: "str" } }, 3).delivery).toBe(null);
  });

  it("a hit's own over its Attack's: Bradamante's {Ranged} hit, then {Melee}", () => {
    const hits = expandInstances({ delivery: "ranged", instances: [{ component: "mag" }, { component: "str", delivery: "melee" }] });
    expect(hits.map((h) => h.delivery)).toEqual(["ranged", "melee"]);
  });
});

describe("the option a Clause asks (ruling 15)", () => {
  it("attack:delivery is emitted for the three, and admitted by a facet", () => {
    for (const d of DELIVERIES) {
      expect(rollOptionsFor({ attack: { kind: "normal", delivery: d } }).has(`attack:delivery:${d}`)).toBe(true);
      expect(parseOption(`attack:delivery:${d}`)).toMatchObject({ subject: "attack", facet: "delivery" });
    }
    expect([...rollOptionsFor({ attack: { kind: "normal", delivery: null } })].some((o) => o.startsWith("attack:delivery"))).toBe(false);
    expect(parseOption("attack:delivery:thrown")).toBe(null);
  });
});

/* ========================================================================== */

describe("a platform that admits only Ranged Attacks (ruling 15)", () => {
  const ship = {
    id: "ship", kind: "platform", faction: "a", level: 1, panel: at(5, 5), footprint: { w: 3, h: 3 },
    crossLevel: { occupantTargeting: "free", outboundTargeting: "rangedOnly" },
  };
  const rider = (normalAttack) => ({
    id: "r", kind: "servant", faction: "a", level: 1, panel: at(5, 6), range: 2, parameters: {}, normalAttack,
  });
  const foe = { id: "g", kind: "servant", faction: "b", level: 0, panel: at(5, 8), parameters: {} };
  const boardOf = (units) => ({ units, alliances: {}, rules: { rangedMinimumRange: 2 } });

  it("a stated Melee Attack at Range 2 is refused, where Range alone called it Ranged", () => {
    const r = rider({ mode: "fixed", component: "str" });
    const b = boardOf([ship, r, foe]);
    expect(crossLevelLegal(r, foe, b, { range: 2 })).toMatchObject({ ok: true });
    expect(crossLevelLegal(r, foe, b, { range: 2, delivery: "melee" })).toMatchObject({ ok: false, reason: "requiresRanged" });
    expect(crossLevelLegal(r, foe, b, { range: 1, delivery: "ranged" })).toMatchObject({ ok: true });
  });

  it("a Special Attack is not Ranged, so the platform refuses it (ruling 13)", () => {
    const r = rider({ mode: "fixed", component: "str" });
    expect(crossLevelLegal(r, foe, boardOf([ship, r, foe]), { range: 5, delivery: "special" }))
      .toMatchObject({ ok: false, reason: "requiresRanged" });
  });

  it("the resolver asks the rider's own Normal Attack, stated Melee, and drops the target", () => {
    const melee = rider({ mode: "fixed", component: "str", delivery: "melee" });
    const spec = targetSpecFor(null, 2, null, melee);
    expect(spec.delivery).toBe(NORMAL_ATTACK_DELIVERY);
    const aim = { reach: "attack", unitId: "g" };
    const refused = resolveTargets(spec, melee, boardOf([ship, melee, foe]), aim);
    expect(refused.units.map((u) => u.unitId)).not.toContain("g");
    // Refused for the platform's reason, not for another one.
    expect(refused.excluded.find((x) => x.unitId === "g")?.reason ?? "").toBe("on another level; only a Ranged Attack reaches across");

    const unstated = rider({ mode: "fixed", component: "str" });
    const allowed = resolveTargets(spec, unstated, boardOf([ship, unstated, foe]), aim);
    expect(allowed.errors).toEqual([]);
    expect(allowed.units.map((u) => u.unitId)).toContain("g");
  });
});

describe("Gravity Manipulation turns away a Ranged Attack only (ruling 15, #328 ruling 9)", () => {
  const olga = { panel: at(5, 5), attackNullifiers: [{ component: "str", delivery: "ranged", minDistance: 4, source: "gm" }] };
  const from4 = { panel: at(5, 9) };

  it("a Ranged STR Attack from 4 has no effect; a Melee or Special one from 4 lands", () => {
    expect(nullifiedBy(olga, from4, { component: "str", delivery: "ranged" })).toMatchObject({ source: "gm" });
    expect(nullifiedBy(olga, from4, { component: "str", delivery: "melee" })).toBe(null);
    expect(nullifiedBy(olga, from4, { component: "str", delivery: "special" })).toBe(null);
    expect(nullifiedBy(olga, { panel: at(5, 8) }, { component: "str", delivery: "ranged" })).toBe(null);
  });

  it("her authored clause carries the word to the board", async () => {
    await withSubjects([{ from: "u-olga-marie", id: "olgaMarie0000001", panel: at(5, 5) }], ({ unit }) => {
      expect(unit("olgaMarie0000001").attackNullifiers).toEqual([
        expect.objectContaining({ component: "str", delivery: "ranged", minDistance: 4 }),
      ]);
    });
  });
});

/* ========================================================================== */

describe("the Attack Description decides it per defender (rulings 11, 12, 14)", () => {
  const KAR = "karnaDelivery001";
  const MED = "medusaDeliver001";
  const FOE = "foeDelivery00001";
  const scene = [
    { from: "karna", id: KAR, panel: at(5, 5), state: { factionId: "A" } },
    { from: "medusa", id: MED, panel: at(3, 5), state: { factionId: "A" } },
    { from: "medusa", id: FOE, panel: at(5, 7), state: { factionId: "B" } },
  ];
  const byContent = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);

  it("Karna's Normal Attack is Melee at Range 2, as stated; Medusa's, stating none, is measured Ranged", async () => {
    await withSubjects(scene, ({ unit }) => {
      expect(unit(KAR).normalAttack.delivery).toBe("melee");
      const karna = engine.attackFacts(unit(KAR), unit(FOE), { attack: { kind: "normal", reach: 2 } });
      expect(karna.delivery).toBe("melee");
      expect(rollOptionsFor({ attacker: unit(KAR), defender: unit(FOE), attack: karna }).has("attack:delivery:melee")).toBe(true);
      expect(engine.attackFacts(unit(MED), unit(FOE), { attack: { kind: "normal", reach: 2 } }).delivery).toBe("ranged");
    });
  });

  it("Brahmastra states {R}, from the declaration to the description", async () => {
    await withSubjects(scene, ({ unit, board, world: w }) => {
      const ability = byContent(w, KAR, "karna-brahmastra");
      const declared = engine.buildAttackSpec({
        attacker: w.actor(KAR), ability, abilityId: ability.id,
        options: rollOptionsFor({ attacker: unit(KAR), defender: unit(FOE) }), board,
      });
      expect(declared.delivery).toBe("ranged");
      const { attack } = engine.describeAttack({
        state: { attack: { ...declared, kind: "np" } }, attacker: unit(KAR), defender: unit(FOE), board, ability,
      });
      expect(attack.delivery).toBe("ranged");
    });
  });

  it("his Mana Burst (Flames) is his Normal Attack's: Melee (ruling 14)", async () => {
    await withSubjects(scene, ({ unit, board, world: w }) => {
      const ability = byContent(w, KAR, "karna-mana-burst-flames");
      const declared = engine.buildAttackSpec({
        attacker: w.actor(KAR), ability, abilityId: ability.id,
        options: rollOptionsFor({ attacker: unit(KAR), defender: unit(FOE) }), board,
      });
      expect(declared.delivery).toBe(null);
      expect(declared.asNormalAttack).toBe(true);
      expect(engine.attackFacts(unit(KAR), unit(FOE), { attack: declared }, board).delivery).toBe("melee");
    });
  });

  it("a Riding Attack's every hit is at Range 1, its band's delivery there", async () => {
    await withSubjects(scene, ({ unit }) => {
      const ride = engine.attackFacts(unit(MED), unit(FOE), { attack: { kind: "normal", reach: 2, ride: { hitCount: 1 } } });
      expect(ride.range).toBe(1);
      // Medusa states nothing: measured by the Attack's Range, 2, not the hit's distance.
      expect(ride.delivery).toBe("ranged");
    });
  });
});

/* ========================================================================== */

describe("the build refuses a word that is not a delivery", async () => {
  const { validateAll } = await import("../../tools/lib/content.mjs");
  const file = (doc, dir) => ({ path: `${doc.id}.yml`, dir, doc });

  it("on a damage block and an instance", () => {
    const ability = (damage) => ({ schema: 1, id: "hit", name: "Hit", kind: "skill", damage, phases: [{ kind: "damage" }] });
    const problems = (damage) => validateAll([file(ability(damage), "abilities")]).problems.join("\n");
    expect(problems({ component: "str", delivery: "ranged" })).not.toMatch(/delivery/);
    expect(problems({ component: "str", delivery: "thrown" })).toMatch(/damage\.delivery is "thrown"/);
    expect(problems({ component: "str", instances: [{}, { delivery: "Melee" }] })).toMatch(/instances\[1\]\.delivery is "Melee"/);
  });

  it("on a Normal Attack and its band", () => {
    const servant = (normalAttack) => ({
      schema: 1, id: "s", name: "S", type: "servant", servantClasses: ["lancer"], normalAttack,
    });
    const problems = (na) => validateAll([file(servant(na), "servants")]).problems.join("\n");
    expect(problems({ mode: "fixed", component: "str", delivery: "melee" })).not.toMatch(/delivery/);
    expect(problems({ mode: "rangeBanded", component: "str", bands: [{ from: 2, delivery: "far" }] }))
      .toMatch(/normalAttack\.bands\[0\]\.delivery is "far"/);
  });
});
