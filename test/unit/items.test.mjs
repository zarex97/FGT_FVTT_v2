/**
 * @file Items, and the remaining §15.4 requirement kinds.
 * @see docs/15-abilities.md §15.4, §15.8
 */

import { describe, it, expect } from "vitest";
import {
  canTransferItem, transferItem, consumeItem,
  meetsRequirement, meetsRequirements, REQUIREMENT_KINDS,
} from "../../module/rules/items.mjs";
import { toIntents } from "../../module/engine/items.mjs";

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

describe("toIntents resolves a consumeEffect's applyEffect descriptor (engine/items.mjs)", () => {
  // `consumeEffect` is authored in the short form `{id, duration}` -- the same
  // convention `OnEvent`'s `then:` actions use -- not the resolved
  // `{defId, expiry}` shape an `applyEffect` intent actually carries.
  // `toIntents` used to pass `d.effect` straight through unresolved, so
  // `resolveEffects` (`applier.mjs`), which reads `intent.effect.defId`, found
  // nothing and the effect was never applied -- the item was still spent.
  const descriptors = () => consumeItem(
    poison({ consumeEffect: [{ kind: "applyEffect", effect: { id: "queensPoison", duration: "3◈" } }] }),
    unit(),
  );

  it("resolves the short-form id into defId", () => {
    const [, applyEffect] = toIntents(descriptors(), { tick: 10, turnsPerRound: 3 });
    expect(applyEffect.effect.defId).toBe("queensPoison");
  });

  it("resolves the authored duration into an absolute expiry", () => {
    // 3◈ at 3 turns/round = 9 ticks, from the current tick.
    const [, applyEffect] = toIntents(descriptors(), { tick: 10, turnsPerRound: 3 });
    expect(applyEffect.effect.expiry).toBe(19);
  });

  it("leaves expiry null for an undurationed effect", () => {
    const noDuration = consumeItem(
      poison({ consumeEffect: [{ kind: "applyEffect", effect: { id: "queensPoison" } }] }),
      unit(),
    );
    const [, applyEffect] = toIntents(noDuration, { tick: 10, turnsPerRound: 3 });
    expect(applyEffect.effect.expiry).toBeNull();
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

  it("checks the caster's own held item quantity", () => {
    // Arrogant King's Poison: "Requires 3 [Semiramis' Poison] to use."
    const req = { kind: "itemAtLeast", contentId: "semiramis-poison", amount: 3 };
    const held = (quantity) => unit({ items: [{ contentId: "semiramis-poison", quantity }] });

    expect(meetsRequirement(req, ctx({ unit: held(3) }))).toBe(true);
    expect(meetsRequirement(req, ctx({ unit: held(4) }))).toBe(true);
    expect(meetsRequirement(req, ctx({ unit: held(2) }))).toBe(false);
    expect(meetsRequirement(req, ctx({ unit: unit() }))).toBe(false);
  });

  it("refuses while a summon of the same content id and summoner is still alive", () => {
    // "Only one Bašmu summoned by this Spell can exist on the field."
    const req = { kind: "noAliveSummon", contentId: "basmu" };
    const semiramis = unit({ id: "semiramis" });
    const basmu = (over = {}) => ({ contentId: "basmu", summonerId: "semiramis", defeated: false, ...over });

    expect(meetsRequirement(req, ctx({ unit: semiramis, board: { units: [semiramis] } }))).toBe(true);
    expect(meetsRequirement(req,
      ctx({ unit: semiramis, board: { units: [semiramis, basmu()] } }))).toBe(false);
    // Defeated: does not block a rebuild.
    expect(meetsRequirement(req,
      ctx({ unit: semiramis, board: { units: [semiramis, basmu({ defeated: true })] } }))).toBe(true);
    // A different Servant's own Bašmu is not this clause's business.
    expect(meetsRequirement(req,
      ctx({ unit: semiramis, board: { units: [semiramis, basmu({ summonerId: "medea" })] } }))).toBe(true);
  });

  it("scopes any requirement to a branch via its own predicate, vacuously passing when it doesn't apply", () => {
    // Summoning: Bašmu's `noAliveSummon` must not block its unrelated
    // damage-spell branch just because a Bašmu happens to be alive.
    const req = { kind: "noAliveSummon", contentId: "basmu", predicate: ["self:onPlatform:hgob"] };
    const semiramis = unit({ id: "semiramis" });
    const board = { units: [semiramis, { contentId: "basmu", summonerId: "semiramis", defeated: false }] };

    // Not on the platform: the gate does not apply, so it does not refuse --
    // even though a Bašmu is alive.
    expect(meetsRequirement(req, ctx({ unit: semiramis, board, testPredicate: () => false }))).toBe(true);
    // On the platform: the gate applies, and a live Bašmu refuses it.
    expect(meetsRequirement(req, ctx({ unit: semiramis, board, testPredicate: () => true }))).toBe(false);
  });

  it("does not vacuously pass a plain predicate requirement -- its own predicate IS the test", () => {
    expect(meetsRequirement({ kind: "predicate", predicate: ["x"] },
      ctx({ testPredicate: () => false }))).toBe(false);
  });

  it("checks whether the caster is within a radius of its platform's centre", () => {
    // Sikera Ušum: "Can only be used within the 'Throne Room' of 'Hanging
    // Gardens of Babylon'" -- the middle 5x5 (radius 2) of a 9x9 platform.
    const req = { kind: "withinPlatformCentre" };
    const platform = { id: "hgob", panel: at(0, 0), footprint: { w: 9, h: 9 } };
    // Centre is (4, 4); radius 2 reaches (2, 2)-(6, 6).
    const inCentre = unit({ id: "semiramis", panel: at(4, 4), platformId: "hgob" });
    const atEdgeOfRadius = unit({ id: "semiramis", panel: at(6, 6), platformId: "hgob" });
    const outsideRadius = unit({ id: "semiramis", panel: at(7, 4), platformId: "hgob" });
    const board = { units: [platform] };

    expect(meetsRequirement(req, ctx({ unit: inCentre, board }))).toBe(true);
    expect(meetsRequirement(req, ctx({ unit: atEdgeOfRadius, board }))).toBe(true);
    expect(meetsRequirement(req, ctx({ unit: outsideRadius, board }))).toBe(false);
    // Not aboard any platform at all.
    expect(meetsRequirement(req, ctx({ unit: unit({ platformId: null }), board }))).toBe(false);
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
      "notHasEffect", "abilityOffCooldown", "modeInactive",
      // EMIYA's Eye of the Mind (True) exists at two Ranks and exactly one is
      // offered at a time, so both halves of the threshold are gates.
      "healthAbove",
      // "Health must have been restored back to above half its maximum value
      // at least once SINCE the last usage" -- a question about history, which
      // Rho Aias states and Battle Continuation's revival has always had with
      // nothing enforcing it.
      "healthRestoredSince",
      // "Requires 3 [Semiramis' Poison] to use" -- a gate on the caster's own
      // held item quantity, needed by nothing before Arrogant King's Poison.
      "itemAtLeast",
      // "Only one Bašmu summoned by this Spell can exist on the field" --
      // needed by nothing before Summoning: Bašmu's summon branch.
      "noAliveSummon",
      // "Can only be used within the 'Throne Room'" -- needed by nothing
      // before Sikera Ušum's DSC branch.
      "withinPlatformCentre",
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

describe("modeInactive", () => {
  const withMode = (active) => unit({ abilities: [{ id: "me", slug: "madEnhancement", active }] });

  it("is the mirror of modeActive", () => {
    // Penthesilea's Charisma "cannot be used when Mad Enhancement is
    // activated" -- and she ALWAYS has Mad Enhancement, so a `hasSkill` test
    // would refuse it for ever and its absence refused it never.
    expect(meetsRequirement({ kind: "modeInactive", mode: "madEnhancement" }, { unit: withMode(false) }))
      .toBe(true);
    expect(meetsRequirement({ kind: "modeInactive", mode: "madEnhancement" }, { unit: withMode(true) }))
      .toBe(false);
  });

  it("passes for a Unit that does not have the mode at all", () => {
    expect(meetsRequirement({ kind: "modeInactive", mode: "madEnhancement" }, { unit: unit() })).toBe(true);
  });
});

describe("healthAbove", () => {
  it("is the mirror of healthBelow, at the same boundary", () => {
    // One of EMIYA's two Eye of the Mind documents is offered at any moment,
    // so the pair has to partition the bar rather than overlap or leave a gap.
    const at20 = unit({ health: 200, maxHealth: 1000 });
    expect(meetsRequirement({ kind: "healthAbove", fraction: 0.2 }, { unit: at20 })).toBe(true);
    expect(meetsRequirement({ kind: "healthBelow", fraction: 0.2 }, { unit: at20 })).toBe(false);

    const at19 = unit({ health: 199, maxHealth: 1000 });
    expect(meetsRequirement({ kind: "healthAbove", fraction: 0.2 }, { unit: at19 })).toBe(false);
    expect(meetsRequirement({ kind: "healthBelow", fraction: 0.2 }, { unit: at19 })).toBe(true);
  });
});

describe("healthRestoredSince", () => {
  const ability = (lastUsedTick) => ({ lastUsedTick });

  it("passes when the ability has never been used", () => {
    // "Since the last usage", and there has not been one.
    expect(meetsRequirement({ kind: "healthRestoredSince", fraction: 0.5 },
      { unit: unit(), ability: ability(null) })).toBe(true);
  });

  it("refuses when Health has not been that high since the last use", () => {
    expect(meetsRequirement({ kind: "healthRestoredSince", fraction: 0.5 },
      { unit: unit({ healthWatermarks: { 0.5: 3 } }), ability: ability(7) })).toBe(false);
  });

  it("passes once it has", () => {
    expect(meetsRequirement({ kind: "healthRestoredSince", fraction: 0.5 },
      { unit: unit({ healthWatermarks: { 0.5: 9 } }), ability: ability(7) })).toBe(true);
  });

  it("refuses a Unit that has no watermark at all", () => {
    // Not the same as "currently above half": a Servant who has been at full
    // Health the whole match and never dropped has not been RESTORED to it,
    // and the stamp is written on the way up.
    expect(meetsRequirement({ kind: "healthRestoredSince", fraction: 0.5 },
      { unit: unit(), ability: ability(2) })).toBe(false);
  });
});

describe("resourceAtLeast", () => {
  it("reads a §6.10 pool, which is the mechanism it exists for", () => {
    // It looked only at the top level, so a gate on a real Resource pool always
    // read `undefined` and refused. EMIYA's Unlimited Blade Works is the first
    // content to gate on one, and it could not be used however much Aria he had.
    const emiya = unit({ resources: { aria: { value: 6, max: 6 } } });
    expect(meetsRequirement({ kind: "resourceAtLeast", key: "aria", amount: 6 }, { unit: emiya })).toBe(true);
    expect(meetsRequirement({ kind: "resourceAtLeast", key: "aria", amount: 7 }, { unit: emiya })).toBe(false);
  });

  it("still reads a top-level stat pool", () => {
    const u = unit({ luck: { value: 3, max: 3 } });
    expect(meetsRequirement({ kind: "resourceAtLeast", key: "luck", amount: 3 }, { unit: u })).toBe(true);
  });

  it("refuses a pool the unit does not have at all", () => {
    expect(meetsRequirement({ kind: "resourceAtLeast", key: "aria", amount: 1 }, { unit: unit() })).toBe(false);
  });
});
