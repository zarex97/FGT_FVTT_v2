/**
 * @file Bounded fields — the six-axis model.
 * @see docs/43-bounded-fields.md, docs/45-implementation-status.md C4
 *
 * Ten fields across nine Servants, more than a third of the expanded roster.
 * They need a shared model or the engine grows ten special cases — which is
 * the whole argument of Ch. 43.
 */

import { describe, it, expect } from "vitest";
import {
  NP_TAG_SCALE, scaleOf, meetsTagThreshold,
  panelsOf, contains, membershipVerdict, escapeAttempt,
  isolationBlocks, interiorModifiers, extensionFor, vulnerabilityTriggered,
  annotateFields,
} from "../../module/rules/bounded-fields.mjs";

const at = (i, j) => ({ i, j });

/** Chaos Labyrinthos, as authored. */
const labyrinth = (over = {}) => ({
  id: "labyrinth", ownerId: "asterios", npTags: ["labyrinth"],
  geometry: { kind: "fixedArea", shape: { kind: "square", size: 9 }, anchor: at(6, 6) },
  membership: {
    enemyEntry: "free", enemyExit: "rollRequired", allyEntry: "free", allyExit: "free",
    escape: {
      baseChance: 20, formula: "1d20", onFailure: "randomRelocate",
      chanceIncreasePerFailure: 5, requiresBorderContact: true, requiresRemainingMove: true,
      veteranBonus: { baseChance: 100, noMovPenalty: true, leadsAdjacentAllies: true },
    },
  },
  isolation: {
    outsideCanTargetInside: false, insideCanTargetOutside: false,
    outsideCanApplyEffectsInside: false, visibilityAcrossBoundary: "full",
  },
  interior: [{ key: "MovDelta", value: -2, minimum: 2, relations: ["enemy"] }],
  vulnerabilities: [{ kind: "ownerDefeat", result: "end" }],
  state: { escapeHistory: {} },
  ...over,
});

const inside = (over = {}) => ({ id: "u", faction: "b", panel: at(6, 6), mov: 4, ...over });
const outside = (over = {}) => ({ id: "o", faction: "a", panel: at(0, 0), mov: 4, ...over });

/* ── NP tag ordering ──────────────────────────────────────────────────────── */

describe("NP tag scale", () => {
  it("orders the five scale tags", () => {
    expect(NP_TAG_SCALE.indexOf("antiUnit")).toBeLessThan(NP_TAG_SCALE.indexOf("antiArmy"));
    expect(NP_TAG_SCALE.indexOf("antiFortress")).toBeLessThan(NP_TAG_SCALE.indexOf("antiWorld"));
  });

  it("takes the HIGHEST scale tag an NP carries", () => {
    // Ozymandias is [Anti-Fortress/Fortress/Anti-Unit]; the comparison uses
    // Anti-Fortress, not the Anti-Unit it also carries.
    expect(scaleOf(["antiUnit", "fortress", "antiFortress"])).toBe(NP_TAG_SCALE.indexOf("antiFortress"));
  });

  it("ignores qualifiers that do not participate in the ordering", () => {
    expect(scaleOf(["barrier", "antiDivine"])).toBe(-1);
  });

  it("satisfies a threshold at or above it", () => {
    expect(meetsTagThreshold(["antiWorld"], "antiWorld")).toBe(true);
    expect(meetsTagThreshold(["antiCountry"], "antiFortress")).toBe(true);
  });

  it("refuses a threshold above the NP's scale", () => {
    expect(meetsTagThreshold(["antiArmy"], "antiWorld")).toBe(false);
  });

  it("never lets `???` satisfy a threshold, so the GM is asked instead", () => {
    // "??? sorts as unknown and never satisfies a threshold" — the field's
    // check surfaces a prompt rather than silently failing.
    expect(meetsTagThreshold(["unknown"], "antiUnit")).toBe(false);
  });
});

/* ── Axis 1: geometry ─────────────────────────────────────────────────────── */

describe("geometry", () => {
  it("resolves a fixed square area around its anchor", () => {
    expect(panelsOf(labyrinth(), { units: [] })).toHaveLength(81);
  });

  it("contains a panel inside it", () => {
    expect(contains(labyrinth(), at(6, 6), { units: [] })).toBe(true);
  });

  it("does not contain a panel outside it", () => {
    expect(contains(labyrinth(), at(0, 0), { units: [] })).toBe(false);
  });

  it("follows a named unit when the geometry says so", () => {
    // Doomsday Come tracks Pale Rider's MASTER, not its creator — the field is
    // a mobile prison, which is the whole design.
    const doomsday = labyrinth({
      geometry: { kind: "followsUnit", unitRef: "ownerMaster", shape: { kind: "square", size: 5 } },
      ownerMasterId: "m",
    });
    const board = { units: [{ id: "m", panel: at(2, 2) }] };

    expect(contains(doomsday, at(2, 2), board)).toBe(true);
    expect(contains(doomsday, at(9, 9), board)).toBe(false);
  });
});

/* ── Axis 2: membership ───────────────────────────────────────────────────── */

describe("membership", () => {
  const board = { units: [], alliances: {} };
  const field = labyrinth({ ownerFaction: "a" });

  it("lets an enemy walk in freely", () => {
    expect(membershipVerdict(field, outside({ faction: "b" }), "enter", board)).toMatchObject({ ok: true });
  });

  it("requires a roll for an enemy to leave", () => {
    expect(membershipVerdict(field, inside(), "exit", board))
      .toMatchObject({ ok: false, reason: "rollRequired" });
  });

  it("lets an ally leave freely", () => {
    expect(membershipVerdict(field, inside({ faction: "a" }), "exit", board)).toMatchObject({ ok: true });
  });

  it("forbids entry outright when the field says so", () => {
    // Unlimited Blade Works: forbidden both ways.
    const ubw = labyrinth({ ownerFaction: "a", membership: { enemyEntry: "forbidden", enemyExit: "forbidden" } });

    expect(membershipVerdict(ubw, outside({ faction: "b" }), "enter", board))
      .toMatchObject({ ok: false, reason: "forbidden" });
  });
});

/* ── The Labyrinth escape ladder ──────────────────────────────────────────── */

describe("escapeAttempt", () => {
  const field = labyrinth();
  const border = inside({ panel: at(2, 6) });

  it("refuses a unit that has not reached the inner border", () => {
    expect(escapeAttempt(field, inside({ panel: at(6, 6) }), { roll: 1, movRemaining: 2 }))
      .toMatchObject({ ok: false, reason: "notAtBorder" });
  });

  it("refuses a unit with no movement left", () => {
    expect(escapeAttempt(field, border, { roll: 1, movRemaining: 0 }))
      .toMatchObject({ ok: false, reason: "noMovement" });
  });

  it("succeeds on a roll within the base 20%", () => {
    // 1d20: 20% is a roll of 4 or less.
    expect(escapeAttempt(field, border, { roll: 4, movRemaining: 2 })).toMatchObject({ ok: true });
  });

  it("fails above it, and relocates the unit at random inside", () => {
    expect(escapeAttempt(field, border, { roll: 5, movRemaining: 2 }))
      .toMatchObject({ ok: false, reason: "failed", onFailure: "randomRelocate" });
  });

  it("raises the chance by 5 points for each previous failure", () => {
    const tried = labyrinth({ state: { escapeHistory: { u: { failures: 2, escaped: false } } } });

    // 20 + 10 = 30%, so a roll of 6 now succeeds where it would not have.
    expect(escapeAttempt(tried, border, { roll: 6, movRemaining: 2 })).toMatchObject({ ok: true });
  });

  it("gives a veteran a certain escape", () => {
    // "A unit that has escaped ONCE has, on every re-entry, base escape chance
    // 100%." The clause that makes the Labyrinth a puzzle, not a soft lock.
    const veteran = labyrinth({ state: { escapeHistory: { u: { failures: 0, escaped: true } } } });

    expect(escapeAttempt(veteran, border, { roll: 20, movRemaining: 2 })).toMatchObject({ ok: true });
  });

  it("lets a veteran lead an adjacent ally out", () => {
    const field2 = labyrinth({ state: { escapeHistory: { vet: { failures: 0, escaped: true } } } });
    const ally = inside({ id: "u", faction: "b", panel: at(2, 6) });
    const vet = { id: "vet", faction: "b", panel: at(2, 7) };

    expect(escapeAttempt(field2, ally, { roll: 20, movRemaining: 2, adjacentVeterans: [vet] }))
      .toMatchObject({ ok: true, reason: "ledOut" });
  });

  it("does not let a distant veteran help", () => {
    const field2 = labyrinth({ state: { escapeHistory: { vet: { failures: 0, escaped: true } } } });
    const ally = inside({ id: "u", faction: "b", panel: at(2, 6) });

    expect(escapeAttempt(field2, ally, { roll: 20, movRemaining: 2, adjacentVeterans: [] }))
      .toMatchObject({ ok: false });
  });
});

/* ── Axis 3: isolation ────────────────────────────────────────────────────── */

describe("isolation", () => {
  const board = { units: [], alliances: {} };
  const field = labyrinth();

  it("blocks an outsider attacking in", () => {
    expect(isolationBlocks(field, outside(), inside(), board)).toMatchObject({ blocked: true });
  });

  it("blocks an insider attacking out", () => {
    expect(isolationBlocks(field, inside(), outside(), board)).toMatchObject({ blocked: true });
  });

  it("allows two units both inside to fight", () => {
    expect(isolationBlocks(field, inside(), inside({ id: "u2" }), board)).toMatchObject({ blocked: false });
  });

  it("allows two units both outside to fight", () => {
    expect(isolationBlocks(field, outside(), outside({ id: "o2" }), board)).toMatchObject({ blocked: false });
  });

  it("lets an open field through, because it is a debuff field and not a prison", () => {
    // The Mist.
    const mist = labyrinth({
      isolation: { outsideCanTargetInside: true, insideCanTargetOutside: true },
    });

    expect(isolationBlocks(mist, outside(), inside(), board)).toMatchObject({ blocked: false });
  });

  it("blocks even a Command Spell when the field says so", () => {
    // The duel field is the only thing in the game that stops one.
    const duel = labyrinth({ isolation: { ...labyrinth().isolation, blocksCommandSpells: true } });

    expect(isolationBlocks(duel, outside(), inside(), board, { isCommandSpell: true }))
      .toMatchObject({ blocked: true, reason: "commandSpellsBlocked" });
  });

  it("lets a Command Spell through an ordinary isolating field", () => {
    expect(isolationBlocks(field, outside(), inside(), board, { isCommandSpell: true }))
      .toMatchObject({ blocked: false });
  });
});

/* ── Axis 4: interior rules ───────────────────────────────────────────────── */

describe("interiorModifiers", () => {
  const board = { units: [], alliances: {} };

  it("applies its interior rules to an enemy inside", () => {
    expect(interiorModifiers(labyrinth({ ownerFaction: "a" }), inside({ faction: "b" }), board))
      .toEqual([expect.objectContaining({ key: "MovDelta", value: -2 })]);
  });

  it("spares an ally when the rule is enemy-only", () => {
    expect(interiorModifiers(labyrinth({ ownerFaction: "a" }), inside({ faction: "a" }), board)).toEqual([]);
  });

  it("gives nothing to a unit outside", () => {
    expect(interiorModifiers(labyrinth(), outside(), board)).toEqual([]);
  });
});

/* ── Axis 5: duration and extension ───────────────────────────────────────── */

describe("extensionFor", () => {
  const paid = labyrinth({
    extension: { cost: { kind: "health", amount: 200, payer: "owner" }, grants: "2◈", repeatable: true },
  });

  it("names the cost and what it buys", () => {
    expect(extensionFor(paid, { id: "asterios", health: { value: 900 } }))
      .toMatchObject({ ok: true, amount: 200, grants: "2◈" });
  });

  it("refuses when the payer cannot afford it", () => {
    // "Cannot be used if Asterios's Health is less than 200."
    expect(extensionFor(paid, { id: "asterios", health: { value: 150 } }))
      .toMatchObject({ ok: false, reason: "cannotAfford" });
  });

  it("reports nothing for a field that cannot be extended", () => {
    expect(extensionFor(labyrinth(), { health: { value: 900 } })).toMatchObject({ ok: false, reason: "notExtendable" });
  });
});

/* ── Axis 6: vulnerability ────────────────────────────────────────────────── */

describe("vulnerabilityTriggered", () => {
  it("ends a field when its owner is defeated", () => {
    expect(vulnerabilityTriggered(labyrinth(), { kind: "ownerDefeat" }))
      .toMatchObject({ triggered: true, result: "end" });
  });

  it("ends an Anti-World field hit by an Anti-World NP", () => {
    const doomsday = labyrinth({
      vulnerabilities: [{ kind: "npTagAtLeast", tag: "antiWorld", result: "end" }],
    });

    expect(vulnerabilityTriggered(doomsday, { kind: "npUsed", npTags: ["antiWorld"] }))
      .toMatchObject({ triggered: true });
  });

  it("is unmoved by a smaller Noble Phantasm", () => {
    const doomsday = labyrinth({
      vulnerabilities: [{ kind: "npTagAtLeast", tag: "antiWorld", result: "end" }],
    });

    expect(vulnerabilityTriggered(doomsday, { kind: "npUsed", npTags: ["antiArmy"] }))
      .toMatchObject({ triggered: false });
  });

  it("needs the full count within the window", () => {
    // Ramesseum Tentyris: TWO Anti-Fortress NPs in the same Round.
    const tentyris = labyrinth({
      vulnerabilities: [{ kind: "npCount", tag: "antiFortress", threshold: 2, window: "round",
        result: "endPermanently" }],
    });

    expect(vulnerabilityTriggered(tentyris, { kind: "npUsed", npTags: ["antiFortress"], countThisWindow: 1 }))
      .toMatchObject({ triggered: false });
    expect(vulnerabilityTriggered(tentyris, { kind: "npUsed", npTags: ["antiFortress"], countThisWindow: 2 }))
      .toMatchObject({ triggered: true, result: "endPermanently" });
  });

  it("ends on a damage threshold within a Round", () => {
    const tentyris = labyrinth({
      vulnerabilities: [{ kind: "damageThreshold", threshold: 3000, window: "round", result: "endPermanently" }],
    });

    expect(vulnerabilityTriggered(tentyris, { kind: "damage", damageThisWindow: 3100 }))
      .toMatchObject({ triggered: true });
  });
});

/* ── The board pass ───────────────────────────────────────────────────────── */

describe("annotateFields", () => {
  it("tells each unit which fields it is inside", () => {
    const board = { units: [inside(), outside()], fields: [labyrinth()], alliances: {} };

    annotateFields(board.units, board);

    expect(board.units[0].fields).toEqual(["labyrinth"]);
    expect(board.units[1].fields).toEqual([]);
  });

  it("folds a stat-shaped interior rule onto the stat itself", () => {
    // Everything went into `modifiers`, which the damage pipeline reads and
    // which does not carry stats — so `MovDelta` inside a Labyrinth changed
    // nobody's MOV, and EMIYA's "+50 Base Attack (STR) inside Unlimited Blade
    // Works" changed nobody's Base Attack.
    const u = inside({ faction: "b", modifiers: [], mov: 6 });
    const board = { units: [u], fields: [labyrinth({ ownerFaction: "a" })], alliances: {} };

    annotateFields(board.units, board);

    expect(u.modifiers).toEqual([]);
    expect(u.mov).toBe(4);
  });

  it("honours a minimum, which floors the RESULT and not the deduction", () => {
    const u = inside({ faction: "b", modifiers: [], mov: 3 });
    const board = { units: [u], fields: [labyrinth({ ownerFaction: "a" })], alliances: {} };

    annotateFields(board.units, board);

    expect(u.mov).toBe(2);
  });

  it("gives the owner its own relation", () => {
    // Folded into "ally", a rule scoped `relations: [self]` matched nobody —
    // which is every owner-only interior clause in the reference set.
    const owner = inside({ id: "owner", faction: "a", modifiers: [], mov: 6 });
    const field = labyrinth({
      ownerFaction: "a",
      ownerId: "owner",
      interior: [{ key: "MovDelta", value: 4, relations: ["self"] }],
    });

    annotateFields([owner], { units: [owner], fields: [field], alliances: {} });

    expect(owner.mov).toBe(10);
  });

  it("is a no-op on a board with no fields", () => {
    const u = inside();
    annotateFields([u], { units: [u], alliances: {} });

    expect(u.fields).toEqual([]);
  });

  it("routes a DamageModifier-shaped interior rule to modifiers, through the real executor", () => {
    const u = inside({ faction: "b", modifiers: [] });
    const field = labyrinth({
      ownerFaction: "a",
      interior: [{ key: "DamageModifier", stage: "flat", value: 10, relations: ["enemy"] }],
    });

    annotateFields([u], { units: [u], fields: [field], alliances: {} });

    expect(u.modifiers).toEqual([expect.objectContaining({ key: "atkUp", value: 10 })]);
  });

  it("routes ImmunityDowngrade to suppressions, not modifiers (Sikera Ušum clause d)", () => {
    // The raw dump this replaced put every non-stat interior rule into
    // `modifiers` verbatim -- a `{key: "ImmunityDowngrade", to: ...}` shape
    // nothing that reads `suppressions` would ever recognise.
    const u = inside({ faction: "b", modifiers: [] });
    const field = labyrinth({
      ownerFaction: "a",
      interior: [{ key: "ImmunityDowngrade", effectId: "poison", to: "poisonResist", relations: ["enemy"] }],
    });

    annotateFields([u], { units: [u], fields: [field], alliances: {} });

    expect(u.modifiers).toEqual([]);
    expect(u.suppressions).toEqual([
      expect.objectContaining({ scope: "immunity", effectId: "poison", downgradeTo: "poisonResist" }),
    ]);
  });

  it("routes VulnerabilityAmplifier and PeriodicOverride to their own buckets", () => {
    const u = inside({ faction: "b", modifiers: [] });
    const field = labyrinth({
      ownerFaction: "a",
      interior: [
        { key: "VulnerabilityAmplifier", effectId: "poison", factor: 2, relations: ["enemy"] },
        { key: "PeriodicOverride", effectId: "poison", triggers: ["turnEnd", "actedTurnEnd"], relations: ["enemy"] },
      ],
    });

    annotateFields([u], { units: [u], fields: [field], alliances: {} });

    expect(u.vulnerabilityAmplifiers).toEqual([expect.objectContaining({ effectId: "poison", factor: 2 })]);
    expect(u.periodicOverrides).toEqual([
      expect.objectContaining({ effectId: "poison", triggers: ["turnEnd", "actedTurnEnd"] }),
    ]);
  });
});
