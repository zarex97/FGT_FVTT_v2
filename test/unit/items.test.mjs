/**
 * @file Items, and the remaining §15.4 requirement kinds.
 * @see docs/15-abilities.md §15.4, §15.8
 */

import { describe, it, expect } from "vitest";
import {
  canTransferItem, transferItem, consumeItem,
  meetsRequirement, meetsRequirements, REQUIREMENT_KINDS,
} from "../../module/rules/items.mjs";

const at = (i, j) => ({ i, j });
const unit = (over = {}) => ({ id: "u", panel: at(0, 0), abilities: [], effects: [], zones: [], ...over });

const poison = (over = {}) => ({
  id: "semiramis-poison", quantity: 3,
  transferable: true, transferRange: 1, transfersPerTurn: 1,
  consumeEffect: [{ kind: "applyEffect", effect: { id: "queensPoison" } }],
  ...over,
});

/* ── §15.8 Items ──────────────────────────────────────────────────────────── */

describe("canTransferItem", () => {
  const from = unit({ id: "a", panel: at(0, 0) });
  const to = unit({ id: "b", panel: at(0, 1) });

  it("allows a transferable item to an adjacent unit", () => {
    expect(canTransferItem(poison(), from, to)).toMatchObject({ ok: true });
  });

  it("refuses an ordinary item", () => {
    // "Items cannot be traded/given/passed to other Units UNLESS STATED" — so
    // the default is refusal, and only Semiramis' Poison says otherwise.
    expect(canTransferItem(poison({ transferable: false }), from, to))
      .toMatchObject({ ok: false, reason: "notTransferable" });
  });

  it("refuses when none are left", () => {
    expect(canTransferItem(poison({ quantity: 0 }), from, to)).toMatchObject({ ok: false, reason: "noneLeft" });
  });

  it("refuses a unit that is not directly next to it", () => {
    expect(canTransferItem(poison(), from, unit({ id: "b", panel: at(0, 5) })))
      .toMatchObject({ ok: false, reason: "outOfRange" });
  });

  it("refuses a second pass in the same turn", () => {
    // "once per Turn".
    expect(canTransferItem(poison(), from, to, { transfersThisTurn: 1 }))
      .toMatchObject({ ok: false, reason: "alreadyPassedThisTurn" });
  });

  it("allows any number within the allowance", () => {
    expect(canTransferItem(poison({ transfersPerTurn: 3 }), from, to, { transfersThisTurn: 2 }))
      .toMatchObject({ ok: true });
  });
});

describe("transferItem", () => {
  it("moves the quantity from one unit to the other", () => {
    const out = transferItem(poison(), unit({ id: "a" }), unit({ id: "b" }));

    expect(out).toContainEqual(expect.objectContaining({ kind: "itemQuantity", unitId: "a", delta: -1 }));
    expect(out).toContainEqual(expect.objectContaining({ kind: "itemGrant", unitId: "b", delta: 1 }));
  });

  it("logs the transfer", () => {
    expect(transferItem(poison(), unit({ id: "a" }), unit({ id: "b" })))
      .toContainEqual(expect.objectContaining({ event: "itemTransferred" }));
  });
});

describe("consumeItem", () => {
  it("spends one and runs its effect", () => {
    const out = consumeItem(poison(), unit());

    expect(out[0]).toMatchObject({ kind: "itemQuantity", delta: -1 });
    expect(out[1]).toMatchObject({ kind: "applyEffect" });
  });

  it("spends it BEFORE the effect runs", () => {
    // An item whose effect kills its bearer is still spent; the other order
    // loses the cost when the consumer dies to its own consumption.
    const out = consumeItem(poison(), unit());
    const spend = out.findIndex((d) => d.kind === "itemQuantity");
    const effect = out.findIndex((d) => d.kind === "applyEffect");

    expect(spend).toBeLessThan(effect);
  });

  it("does nothing when there are none left", () => {
    expect(consumeItem(poison({ quantity: 0 }), unit())).toEqual([]);
  });
});

/* ── §15.4 requirement kinds ──────────────────────────────────────────────── */

describe("meetsRequirement", () => {
  const ctx = (over = {}) => ({ unit: unit(), round: 5, ...over });

  it("checks ZON", () => {
    expect(meetsRequirement({ kind: "inZon" }, ctx())).toBe(true);
    expect(meetsRequirement({ kind: "inZon" }, ctx({ unit: unit({ outsideZon: true }) }))).toBe(false);
  });

  it("checks the round gate", () => {
    expect(meetsRequirement({ kind: "roundAtLeast", round: 5 }, ctx())).toBe(true);
    expect(meetsRequirement({ kind: "roundAtLeast", round: 6 }, ctx())).toBe(false);
  });

  it("checks zone membership both ways", () => {
    const inThrone = ctx({ unit: unit({ zones: ["throneRoom"] }) });

    expect(meetsRequirement({ kind: "inZone", zoneId: "throneRoom" }, inThrone)).toBe(true);
    expect(meetsRequirement({ kind: "notInZone", zoneId: "throneRoom" }, inThrone)).toBe(false);
  });

  it("checks for a named skill by slug", () => {
    // Bašmu requires Double Summon: Caster. Matched on slug, because a display
    // name can be renamed and a slug cannot.
    const withSkill = ctx({ unit: unit({ abilities: [{ slug: "doubleSummonCaster" }] }) });

    expect(meetsRequirement({ kind: "hasSkill", abilityId: "doubleSummonCaster" }, withSkill)).toBe(true);
    expect(meetsRequirement({ kind: "hasSkill", abilityId: "riding" }, withSkill)).toBe(false);
  });

  it("distinguishes an active mode from a merely present one", () => {
    const held = ctx({ unit: unit({ abilities: [{ slug: "holderMode", active: false }] }) });
    const on = ctx({ unit: unit({ abilities: [{ slug: "holderMode", active: true }] }) });

    expect(meetsRequirement({ kind: "modeActive", mode: "holderMode" }, held)).toBe(false);
    expect(meetsRequirement({ kind: "modeActive", mode: "holderMode" }, on)).toBe(true);
  });

  it("checks a resource floor", () => {
    const withTokens = ctx({ unit: unit({ fragarachTokens: 2 }) });

    expect(meetsRequirement({ kind: "resourceAtLeast", key: "fragarachTokens", amount: 2 }, withTokens)).toBe(true);
    expect(meetsRequirement({ kind: "resourceAtLeast", key: "fragarachTokens", amount: 3 }, withTokens)).toBe(false);
  });

  it("checks a Health fraction", () => {
    // God's Holder: Possession, under 30%.
    const hurt = ctx({ unit: unit({ health: { value: 200, max: 1000 } }) });
    const well = ctx({ unit: unit({ health: { value: 900, max: 1000 } }) });

    expect(meetsRequirement({ kind: "healthBelow", fraction: 0.3 }, hurt)).toBe(true);
    expect(meetsRequirement({ kind: "healthBelow", fraction: 0.3 }, well)).toBe(false);
  });

  it("checks a Master's Health floor", () => {
    expect(meetsRequirement({ kind: "masterHealthAbove", amount: 50 },
      ctx({ master: { health: { value: 51 } } }))).toBe(true);
    expect(meetsRequirement({ kind: "masterHealthAbove", amount: 50 },
      ctx({ master: { health: { value: 50 } } }))).toBe(false);
  });

  it("checks that a counterpart is adjacent", () => {
    // The Dioscuri's Noble Phantasm needs the other twin beside it.
    const twin = { id: "castor", panel: at(0, 1) };
    const me = unit({ id: "pollux", panel: at(0, 0), zonPartnerIds: ["castor"] });

    expect(meetsRequirement({ kind: "counterpartAdjacent" },
      ctx({ unit: me, board: { units: [me, twin] } }))).toBe(true);
    expect(meetsRequirement({ kind: "counterpartAdjacent" },
      ctx({ unit: me, board: { units: [me, { ...twin, panel: at(9, 9) }] } }))).toBe(false);
  });

  it("checks an effect on the target", () => {
    expect(meetsRequirement({ kind: "targetHasEffect", effectId: "burn" },
      ctx({ target: { effects: ["burn"] } }))).toBe(true);
  });

  it("refuses a predicate when no evaluator was supplied", () => {
    // A gate nobody can answer is not an open gate.
    expect(meetsRequirement({ kind: "predicate", predicate: ["x"] }, ctx())).toBe(false);
  });

  it("uses the evaluator when there is one", () => {
    expect(meetsRequirement({ kind: "predicate", predicate: ["x"] },
      ctx({ testPredicate: () => true }))).toBe(true);
  });

  it("refuses a kind it does not recognise", () => {
    expect(meetsRequirement({ kind: "somethingNew" }, ctx())).toBe(false);
  });

  it("implements every kind §15.4 lists", () => {
    // The same guard that caught two unimplemented Command Spell requirements:
    // an unrecognised kind refuses, so the ability compiles, loads, and never
    // works.
    const listed = [
      "inZon", "roundAtLeast", "inZone", "notInZone", "hasSkill", "resourceAtLeast",
      "healthBelow", "modeActive", "counterpartAdjacent", "masterHealthAbove",
      "targetHasEffect", "predicate",
      // Beyond §15.4's own list, added by content that needed them.
      // `notHasEffect` had been AUTHORED on Medea since she was written.
      "notHasEffect", "abilityOffCooldown",
    ];
    expect([...REQUIREMENT_KINDS].sort()).toEqual(listed.sort());
  });
});

describe("notHasEffect", () => {
  it("passes when the user is clean, and refuses when it is not", () => {
    expect(meetsRequirement({ kind: "notHasEffect", effectId: "silence" }, { unit: unit() })).toBe(true);
    expect(meetsRequirement(
      { kind: "notHasEffect", effectId: "silence" },
      { unit: unit({ effects: ["silence"] }) },
    )).toBe(false);
  });

  it("asks about the USER, not the target", () => {
    // The distinction that makes it a different kind from `targetHasEffect`.
    expect(meetsRequirement(
      { kind: "notHasEffect", effectId: "silence" },
      { unit: unit(), target: { effects: ["silence"] } },
    )).toBe(true);
  });
});

describe("abilityOffCooldown", () => {
  const scathach = (over = []) => unit({
    abilities: [
      { id: "a1", contentId: "scathach-ar", category: "primordialRuneSpell", cooldownRemaining: 0 },
      { id: "a2", contentId: "scathach-thurs", category: "primordialRuneSpell", cooldownRemaining: 0 },
      { id: "a3", contentId: "scathach-ur", category: "primordialRuneSpell", cooldownRemaining: 0 },
      ...over,
    ],
  });

  it("passes while every named ability is off cooldown", () => {
    expect(meetsRequirement(
      { kind: "abilityOffCooldown", abilityIds: ["scathach-thurs"] },
      { unit: scathach() },
    )).toBe(true);
  });

  it("refuses while one of them is running", () => {
    const unitWith = unit({
      abilities: [{ id: "a2", contentId: "scathach-thurs", cooldownRemaining: 4 }],
    });
    expect(meetsRequirement(
      { kind: "abilityOffCooldown", abilityIds: ["scathach-thurs"] },
      { unit: unitWith },
    )).toBe(false);
  });

  it("gates a whole category", () => {
    const unitWith = unit({
      abilities: [
        { id: "a1", contentId: "scathach-ar", category: "primordialRuneSpell", cooldownRemaining: 0 },
        { id: "a2", contentId: "scathach-thurs", category: "primordialRuneSpell", cooldownRemaining: 6 },
      ],
    });
    expect(meetsRequirement(
      { kind: "abilityOffCooldown", category: "primordialRuneSpell" },
      { unit: unitWith },
    )).toBe(false);
  });

  it("excludes the ability that declares it", () => {
    // "the OTHER two cannot be used until Cooldown has ended for the used
    // Spell". Without `excludeSelf` a Spell gates on its own cooldown, which
    // `canUseAbility` already checks -- so the rule would say nothing.
    const unitWith = unit({
      abilities: [
        { id: "a1", contentId: "scathach-ar", category: "primordialRuneSpell", cooldownRemaining: 9 },
        { id: "a2", contentId: "scathach-thurs", category: "primordialRuneSpell", cooldownRemaining: 0 },
      ],
    });
    // Ar is running, and Ar itself is not blocked BY Ar -- the other Spell in
    // the category is clear, so Ar passes its own gate.
    expect(meetsRequirement(
      { kind: "abilityOffCooldown", category: "primordialRuneSpell", excludeSelf: true },
      { unit: unitWith, ability: { id: "a1", contentId: "scathach-ar" } },
    )).toBe(true);
    // Thurs, though, is blocked: Ar is on cooldown and Ar is one of the others.
    expect(meetsRequirement(
      { kind: "abilityOffCooldown", category: "primordialRuneSpell", excludeSelf: true },
      { unit: unitWith, ability: { id: "a2", contentId: "scathach-thurs" } },
    )).toBe(false);
  });

  it("gates an exclusion set, which is how copies are grouped", () => {
    const unitWith = unit({
      abilities: [
        { id: "c1", exclusionSet: "dunScaith", cooldownRemaining: 0 },
        { id: "c2", exclusionSet: "dunScaith", cooldownRemaining: 11 },
      ],
    });
    expect(meetsRequirement(
      { kind: "abilityOffCooldown", exclusionSet: "dunScaith", excludeSelf: true },
      { unit: unitWith, ability: { id: "c1" } },
    )).toBe(false);
  });

  it("passes vacuously when nothing matches", () => {
    // A Scathach who has copied nothing has no Wisdom slots to be blocked BY,
    // and a gate that refused on an empty set would make Clairvoyance unusable
    // until she copied something.
    expect(meetsRequirement(
      { kind: "abilityOffCooldown", exclusionSet: "dunScaith" },
      { unit: unit() },
    )).toBe(true);
  });
});

describe("meetsRequirements", () => {
  it("passes when every requirement is met", () => {
    expect(meetsRequirements([{ kind: "inZon" }], { unit: unit(), round: 1 })).toMatchObject({ ok: true });
  });

  it("names the FIRST failure, so a refusal points at one thing", () => {
    const out = meetsRequirements(
      [{ kind: "inZon" }, { kind: "roundAtLeast", round: 9 }, { kind: "hasSkill", abilityId: "x" }],
      { unit: unit(), round: 1 },
    );

    expect(out).toMatchObject({ ok: false, reason: "roundAtLeast" });
  });

  it("passes an empty list", () => {
    expect(meetsRequirements([], { unit: unit() })).toMatchObject({ ok: true });
  });
});
