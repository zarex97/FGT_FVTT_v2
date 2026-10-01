/**
 * @file A platform shelters its riders from enemy Attacks, in the tiers its sheet states (#138).
 * @see module/rules/platforms.mjs#crossLevelLegal, module/rules/targeting/resolve.mjs step 4d, docs/27-platforms-and-levels.md
 *
 * Quetzalcoatl's sheet: *"Quetz or her Master cannot be targeted for an Attack while they are Riding
 * the Quetzalcoatlus. If they are hit with an AoE Attack, the Quetzalcoatlus receives full damage, Quetz
 * receives 50% Total Damage while her Master receives no damage and effects."* Semiramis: *"Enemy Units on
 * the ground cannot target Units onboard"*. Drake: *"Enemy Units cannot target Units onboard"*.
 *
 * The platform's protection was read in one place, step 4d, through `crossLevelLegal`, and it asked
 * nothing: not what was being done, to whom, or in what shape. `forbidden` refused every occupant for
 * every caster and every kind of resolution, so a buff from an ally was refused, and an area reached nobody
 * aboard -- the 50% tier (`aoePassengerFactor`) had no reader at all, only tests.
 *
 * Ruled by the user (2026-10-01): the Spells' 3x3 hits enemies only. The sheet says "for an Attack", so an
 * enemy's non-Attack Skill may target her while she rides; the Hanging Gardens and the Golden Hind name
 * Skills too, and say `anything`.
 *
 * Every Platform is authored content through the real compile, the real DataModel and the real projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = {
  quetz: "quetzSubject0001", mast: "mastrSubject0001", mount: "mountSubject0001",
  foe: "foeSubject000001", friend: "friendSubject001", owner: "ownerSubject0001",
  ship: "shipSubject00001", garden: "gardenSubject001", queen: "queenSubject0001",
};

/** Quetz and her Master aboard the mount (level 1); an enemy and an ally of hers on the ground. */
const cast = () => [
  { from: "quetzalcoatl", id: ID.quetz, state: { masterId: ID.mast, factionId: "f1" }, panel: { i: 5, j: 5, k: 1 } },
  { from: "master-advanced", id: ID.mast, state: { factionId: "f1" }, panel: { i: 5, j: 6, k: 1 } },
  { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz, factionId: "f1" }, panel: { i: 5, j: 5, k: 1 } },
  { from: "heracles", id: ID.foe, state: { factionId: "f2" }, panel: { i: 8, j: 8, k: 0 } },
  { from: "castor", id: ID.friend, state: { factionId: "f1" }, panel: { i: 9, j: 5, k: 0 } },
];

/** A 3x3 dropped anywhere within 5 panels, on whoever the caster counts as its targets. */
const area = (relations = ["enemy"]) => ({
  anchor: { kind: "withinRange", range: 5, metric: "chebyshev" },
  shape: { kind: "square", size: 3 },
  selection: { relations, chooser: "all" },
});
/** One chosen Unit within 5 panels. */
const single = (relations = ["enemy"]) => ({
  anchor: { kind: "targetUnit", range: 5 },
  shape: { kind: "unit" },
  selection: { relations, chooser: "all", count: 1 },
});

const aimedAt = (spec, caster, at, extra = {}) => ({ spec, caster, at, extra });
const resolve = (specs, { spec, caster, at, extra }) => withSubjects(specs, ({ unit, board }) => {
  const out = resolveTargets(spec, unit(caster), board, { ...at, ...extra });
  return {
    ids: out.units.map((u) => u.unitId).sort(),
    factors: Object.fromEntries(out.units.filter((u) => u.platformFactor !== undefined).map((u) => [u.unitId, u.platformFactor])),
    excluded: Object.fromEntries(out.excluded.map((e) => [e.unitId, e.reason])),
  };
});

describe("an enemy Attack in the shape of an area", () => {
  const over = aimedAt(area(), ID.foe, { panel: { i: 5, j: 6 } }, { reach: "attack" });

  it("catches the mount whole, and Quetz at the 50% tier, and drops her Master", async () => {
    const out = await resolve(cast(), over);
    expect(out.ids).toEqual([ID.mount, ID.quetz].sort());
    expect(out.factors).toEqual({ [ID.quetz]: 0.5 });
    expect(out.excluded[ID.mast]).toMatch(/Master/i);
  });

  it("is the default reach: a resolution that does not say is an Attack", async () => {
    const out = await resolve(cast(), aimedAt(area(), ID.foe, { panel: { i: 5, j: 6 } }));
    expect(out.ids).toEqual([ID.mount, ID.quetz].sort());
  });
});

describe("an enemy Attack on one Unit", () => {
  // The mount stands on the same panel as the Unit aimed at, so it is a legal target of the same swing:
  // what these assert is who is NOT.
  it("is refused against Quetz while she rides", async () => {
    const out = await resolve(cast(), aimedAt(single(), ID.foe, { unitId: ID.quetz }, { reach: "attack" }));
    expect(out.ids).not.toContain(ID.quetz);
    expect(out.excluded[ID.quetz]).toMatch(/cannot be attacked into/);
  });

  it("is refused against her Master too", async () => {
    const out = await resolve(cast(), aimedAt(single(), ID.foe, { unitId: ID.mast }, { reach: "attack" }));
    expect(out.ids).not.toContain(ID.mast);
  });

  it("is not refused against the mount itself, which is always a legal target", async () => {
    const out = await resolve(cast(), aimedAt(single(), ID.foe, { unitId: ID.mount }, { reach: "attack" }));
    expect(out.ids).toContain(ID.mount);
  });
});

describe("what is not an enemy Attack", () => {
  it("an allied effect on Quetz while she rides is legal", async () => {
    const out = await resolve(cast(), aimedAt(single(["ally"]), ID.friend, { unitId: ID.quetz }, { reach: "effect" }));
    expect(out.ids).toContain(ID.quetz);
  });

  it("an allied area catches everyone aboard whole: the tiers shelter from enemies", async () => {
    const out = await resolve(cast(), aimedAt(area(["ally"]), ID.friend, { panel: { i: 6, j: 6 } }, { reach: "effect" }));
    expect(out.ids).toEqual([ID.mast, ID.mount, ID.quetz].sort());
    expect(out.factors).toEqual({});
  });

  it("an enemy's Skill that is not an Attack may target her: the sheet says \"for an Attack\"", async () => {
    const out = await resolve(cast(), aimedAt(single(), ID.foe, { unitId: ID.quetz }, { reach: "effect" }));
    expect(out.ids).toContain(ID.quetz);
  });

  it("an enemy's area EFFECT catches her Master like anyone, with no tier", async () => {
    const out = await resolve(cast(), aimedAt(area(), ID.foe, { panel: { i: 5, j: 6 } }, { reach: "effect" }));
    expect(out.ids).toEqual([ID.mast, ID.mount, ID.quetz].sort());
    expect(out.factors).toEqual({});
  });
});

describe("the preview says what it is on the spec", () => {
  // `validate` and `legalPlacements` take no reach of their own, and the targeting session aims before
  // there is a placement: the sheet marks the spec, so the player sees what the resolution will do.
  it("a Skill's spec lets the effect through, an Attack's does not", async () => {
    const aimedEffect = aimedAt({ ...single(), reach: "effect" }, ID.foe, { unitId: ID.quetz });
    const aimedAttack = aimedAt({ ...single(), reach: "attack" }, ID.foe, { unitId: ID.quetz });
    expect((await resolve(cast(), aimedEffect)).ids).toContain(ID.quetz);
    expect((await resolve(cast(), aimedAttack)).ids).not.toContain(ID.quetz);
  });

  it("the placement wins over the spec", async () => {
    const out = await resolve(cast(), aimedAt({ ...single(), reach: "effect" }, ID.foe, { unitId: ID.quetz }, { reach: "attack" }));
    expect(out.ids).not.toContain(ID.quetz);
  });
});

describe("the other platforms keep what their sheets state", () => {
  const riders = (platform, platformId) => [
    { from: "heracles", id: ID.owner, state: { factionId: "f1" }, panel: { i: 5, j: 5, k: 1 } },
    { from: platform, id: platformId, state: { ownerId: ID.owner, factionId: "f1" }, panel: { i: 5, j: 5, k: 1 } },
    { from: "heracles", id: ID.foe, state: { factionId: "f2" }, panel: { i: 9, j: 9, k: 0 } },
    { from: "castor", id: ID.friend, state: { factionId: "f1" }, panel: { i: 9, j: 5, k: 0 } },
  ];

  it("the Golden Hind: an enemy area hits its riders at 50%", async () => {
    const out = await resolve(riders("platform-golden-hind", ID.ship), aimedAt(area(), ID.foe, { panel: { i: 6, j: 6 } }, { reach: "attack" }));
    expect(out.ids).toContain(ID.owner);
    expect(out.factors).toEqual({ [ID.owner]: 0.5 });
  });

  it("the Golden Hind shelters from Skills too: an enemy effect on a rider is refused", async () => {
    const out = await resolve(riders("platform-golden-hind", ID.ship), aimedAt(single(), ID.foe, { unitId: ID.owner }, { reach: "effect" }));
    expect(out.ids).not.toContain(ID.owner);
  });

  it("the Golden Hind lets its owner's allies buff her aboard", async () => {
    const out = await resolve(riders("platform-golden-hind", ID.ship), aimedAt(single(["ally"]), ID.friend, { unitId: ID.owner }, { reach: "effect" }));
    expect(out.ids).toContain(ID.owner);
  });

  it("the Hanging Gardens soaks all of an enemy area: nobody aboard is caught", async () => {
    const out = await resolve(riders("hanging-gardens-of-babylon", ID.garden), aimedAt(area(), ID.foe, { panel: { i: 6, j: 6 } }, { reach: "attack" }));
    expect(out.ids).not.toContain(ID.owner);
  });

  it("the Storm Border, which states no protection wording, keeps its blanket refusal", async () => {
    const out = await resolve(riders("platform-storm-border", ID.queen), aimedAt(single(["ally"]), ID.friend, { unitId: ID.owner }, { reach: "effect" }));
    expect(out.ids).not.toContain(ID.owner);
  });
});

describe("the readers", () => {
  it("there is one: `board.crossLevel` and its two readers are gone", async () => {
    const { readFileSync } = await import("node:fs");
    const resolveSrc = readFileSync("module/rules/targeting/resolve.mjs", "utf8");
    const platformsSrc = readFileSync("module/rules/platforms.mjs", "utf8");
    const snapshotSrc = readFileSync("module/rules/snapshot.mjs", "utf8");
    expect(resolveSrc).not.toMatch(/function crossLevelAllows/);
    expect(platformsSrc).not.toMatch(/export function crossLevelRulesFor/);
    expect(snapshotSrc).not.toMatch(/board\.crossLevel\s*=/);
  });

  it("the attack paths say they are Attacks and the Skill paths say they are not", async () => {
    const { readFileSync } = await import("node:fs");
    const attack = readFileSync("module/engine/attack.mjs", "utf8");
    const skill = readFileSync("module/engine/skill-use.mjs", "utf8");
    expect((attack.match(/reach: "attack"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((skill.match(/reach: "effect"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
