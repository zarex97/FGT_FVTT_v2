/**
 * #385: Kazuradrop's pure readers, against her rulings. The Clauses themselves are
 * closed on a live board, in `docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md`.
 */
import { describe, expect, it } from "vitest";
import { groupsOf } from "../../module/rules/unit-groups.mjs";
import { bugSpaceCapacity, forcedLandings, isOffBoard } from "../../module/rules/bug-space.mjs";
import { isTakeableSkill, outrankedByTwin, ranksIn, theftChance, theftTerms } from "../../module/rules/skill-theft.mjs";
import { formSheet } from "../../module/rules/form.mjs";
import { grantHeld } from "../../module/rules/summon-grants.mjs";

const servant = (trueName) => ({ kind: "servant", trueName });

describe("the groups a sheet names (readings 2, 3)", () => {
  it("lists the Sakura Five by True Name, herself among them", () => {
    for (const name of ["Passionlip", "Meltryllis", "Kazuradrop", "Violet", "Kingprotea"]) {
      expect(groupsOf(servant(name))).toEqual(["sakuraFive"]);
    }
  });

  it("reads BB off a True Name, a summer form with it", () => {
    expect(groupsOf(servant("BB"))).toEqual(["bb"]);
    expect(groupsOf(servant("Arturia"))).toEqual([]);
  });

  it("is a Servant's: a Master named BB is no member", () => {
    expect(groupsOf({ kind: "master", trueName: "BB" })).toEqual([]);
  });
});

describe("Insect Eater's chance (readings 23, 24)", () => {
  const spec = {
    base: 15,
    terms: [
      { label: "Moon Cell", value: 30, anyOf: ["war:region:moon"] },
      { label: "Debuff ChUp", effect: "debuffChUp", sign: 1 },
      { label: "Kin", value: 30, anyOf: ["target:group:bb", "target:group:sakuraFive"] },
      { label: "Magic Resistance", perRank: "magicResistance", value: -5 },
      { label: "Debuff ChDwn", effect: "debuffChDwn", sign: -1 },
      { label: "Form", value: 15, anyOf: ["self:skillActive:atomicrosForm"] },
    ],
  };
  const chanceOf = ({ options = [], chUp = 0, rank = null }) => theftChance(spec, theftTerms(spec, {
    options: new Set(options),
    magnitudeOf: (id) => (id === "debuffChUp" ? chUp : 0),
    rankOnTarget: () => rank,
  }));

  it("counts E 1 to A 5, EX 6, plus and minus ignored", () => {
    expect(["E", "D", "C", "B", "A", "EX", "A+", null].map(ranksIn)).toEqual([1, 2, 3, 4, 5, 6, 5, 0]);
  });

  it("sums in points and clamps last, as the worked table says", () => {
    expect(chanceOf({ options: ["target:group:sakuraFive"] })).toBe(45);
    expect(chanceOf({ options: ["target:group:sakuraFive"], chUp: 30 })).toBe(75);
    expect(chanceOf({ rank: "D" })).toBe(5);
    expect(chanceOf({ rank: "C" })).toBe(0);
    expect(chanceOf({ rank: "A" })).toBe(0);
    expect(chanceOf({ rank: "A", chUp: 30 })).toBe(20);
    expect(chanceOf({ rank: "EX", chUp: 30, options: ["self:skillActive:atomicrosForm", "war:region:moon"] })).toBe(60);
  });

  it("counts BB or Sakura Five once", () => {
    expect(chanceOf({ options: ["target:group:bb", "target:group:sakuraFive"] })).toBe(45);
  });

  it("caps at 100", () => {
    expect(chanceOf({ chUp: 30, options: ["target:group:bb", "self:skillActive:atomicrosForm", "war:region:moon"] })).toBe(100);
  });

  it("leaves a zero out of the card's terms", () => {
    expect(theftTerms(spec, { rankOnTarget: () => null })).toEqual([]);
  });
});

describe("what may be taken (readings 15, 20)", () => {
  const skill = (extra = {}) => ({ type: "ability", system: { kind: "skill", ...extra } });

  it("takes a Class Skill for Insect Eater and leaves it for Sakura Eater", () => {
    const cls = skill({ kind: "classSkill" });
    expect(isTakeableSkill(cls)).toBe(true);
    expect(isTakeableSkill(cls, { classSkills: false })).toBe(false);
  });

  it("refuses an NP, a Spell, an action and a Skill already taken", () => {
    expect(isTakeableSkill({ type: "noblePhantasm", system: {} })).toBe(false);
    expect(isTakeableSkill(skill({ category: "spell" }))).toBe(false);
    expect(isTakeableSkill(skill({ notASkill: true }))).toBe(false);
    expect(isTakeableSkill(skill({ stolenBy: "x" }))).toBe(false);
  });

  it("takes a passive", () => {
    expect(isTakeableSkill(skill({ passive: true }))).toBe(true);
  });
});

describe("two passives of one name (reading 46)", () => {
  const passive = (id, rank, extra = {}) => ({ id, system: { slug: "magicResistance", rank, passive: true, ...extra } });

  it("stands the lower Rank down", () => {
    const hers = passive("a", "A");
    const stolen = passive("d", "D", { stolenFrom: { unitId: "x" } });
    expect(outrankedByTwin(stolen, [hers, stolen])).toBe(true);
    expect(outrankedByTwin(hers, [hers, stolen])).toBe(false);
  });

  it("lets her own win a tie", () => {
    const hers = passive("a", "B");
    const stolen = passive("d", "B", { stolenFrom: { unitId: "x" } });
    expect(outrankedByTwin(stolen, [hers, stolen])).toBe(true);
    expect(outrankedByTwin(hers, [hers, stolen])).toBe(false);
  });
});

describe("a Stolen Skill's owner (reading 26)", () => {
  it("does not hold it, by the one door", () => {
    expect(grantHeld({}, { system: { stolenBy: "thief" } })).toBe(false);
    expect(grantHeld({}, { system: {} })).toBe(true);
  });
});

describe("a Class taken for a time (readings 17-19)", () => {
  it("is what the one reader answers, its sheet's otherwise", () => {
    const sys = { servantClasses: new Set(["alterEgo"]) };
    const effect = { disabled: false, system: { defId: "classTaken", params: { classes: ["rider", "archer"] } } };
    expect(formSheet({ system: sys, effects: [effect], items: [] }).servantClasses).toEqual(["rider", "archer"]);
    expect(formSheet({ system: sys, effects: [], items: [] }).servantClasses).toEqual(["alterEgo"]);
  });
});

describe("Bug Space (readings 30-45)", () => {
  const cap = { system: { bugSpace: { capacity: 3, capacityWhile: [{ mode: "atomicrosForm", capacity: 5 }] } } };

  it("holds three, five in the Form, and none without the ability", () => {
    expect(bugSpaceCapacity([cap])).toBe(3);
    expect(bugSpaceCapacity([cap, { system: { slug: "atomicrosForm", active: true } }])).toBe(5);
    expect(bugSpaceCapacity([{ system: {} }])).toBe(0);
  });

  it("is off the board until a sweep strikes it", () => {
    expect(isOffBoard({ system: { heldIn: "k" } })).toBe(true);
    expect(isOffBoard({ system: { heldIn: "k", heldStruck: true } })).toBe(false);
    expect(isOffBoard({ system: {} })).toBe(false);
  });

  const bounds = { iMin: 0, jMin: 0, iMax: 24, jMax: 24 };
  const first = () => 0;

  it("lands within 2 while there is room", () => {
    const landed = forcedLandings([{ id: "a" }, { id: "b" }], { i: 12, j: 12 }, { bounds, units: [] }, first);
    for (const p of Object.values(landed)) {
      expect(Math.max(Math.abs(p.i - 12), Math.abs(p.j - 12))).toBeLessThanOrEqual(2);
    }
    expect(landed.a).not.toEqual(landed.b);
  });

  it("goes to the nearest free panels outward when 2 is full (reading 45)", () => {
    const units = [];
    for (let i = 10; i <= 14; i += 1) for (let j = 10; j <= 14; j += 1) units.push({ id: `${i},${j}`, panel: { i, j } });
    const landed = forcedLandings([{ id: "a" }], { i: 12, j: 12 }, { bounds, units }, first);
    expect(Math.max(Math.abs(landed.a.i - 12), Math.abs(landed.a.j - 12))).toBe(3);
  });

  it("finds room for a footprint", () => {
    const landed = forcedLandings([{ id: "big", footprint: { w: 2, h: 2 } }], { i: 0, j: 0 }, { bounds, units: [{ id: "x", panel: { i: 0, j: 0 } }] }, first);
    expect(landed.big).toBeTruthy();
    expect(landed.big).not.toEqual({ i: 0, j: 0 });
  });
});
