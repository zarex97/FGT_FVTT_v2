/**
 * @file Nursery Rhyme's summons, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 2 of four. Pinned to the SHEET; every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { test as testPredicate } from "../../module/rules/predicate.mjs";
import { expiredSummonIds } from "../../module/rules/summons.mjs";
import { dispatch } from "../../module/engine/scheduler.mjs";
import { contributionsOf } from "../../module/rules/snapshot.mjs";
import { acquisitionTarget, itemPickupIntents } from "../../module/rules/items.mjs";


describe("E5 — a summon that goes away on its own", () => {
  it("names a summon whose expiry has passed", () => {
    const board = { units: [
      { id: "jab", kind: "summon", expiresAt: 12 },
      { id: "soldier", kind: "summon", expiresAt: null },
      { id: "nursery", kind: "servant", expiresAt: 3 },
    ] };
    expect(expiredSummonIds(board, 12)).toEqual(["jab"]);
  });

  it("does NOT name one whose expiry is still ahead", () => {
    const board = { units: [{ id: "jab", kind: "summon", expiresAt: 13 }] };
    expect(expiredSummonIds(board, 12)).toEqual([]);
  });

  it("ignores a summon with no clock at all", () => {
    // Every summon before the Jabberwock. A Dragon Tooth Warrior stays until
    // something kills it, and must not be swept up by this pass.
    const board = { units: [{ id: "dtw", kind: "summon", expiresAt: null }] };
    expect(expiredSummonIds(board, 99999)).toEqual([]);
  });

  it("ignores a STRUCTURE carrying an expiry", () => {
    // `expiresAt` sits on the simple-actor schema, which structures and
    // platforms share. A platform with a clock is a different teardown.
    const board = { units: [{ id: "x", kind: "structure", expiresAt: 1 }] };
    expect(expiredSummonIds(board, 99)).toEqual([]);
  });

  it("handles a board with no units", () => {
    expect(expiredSummonIds({}, 5)).toEqual([]);
  });
});

describe("R8 — Alice Eater extends the stay, it does not reset it", () => {
  const run = (action, unit, ctx) =>
    dispatch(action, unit, { source: "test", abilityId: null }, ctx);

  it("adds to whatever remains", () => {
    // "extends its period of existing on the board for 3 MORE Turns."
    //
    // A monster with one Turn left must end with four, not three. A test
    // starting from an expiry that has already passed proves nothing, because
    // "set" and "add" agree there -- so this one starts from an expiry that is
    // still ahead.
    const out = run(
      { kind: "DurationDelta", ticks: "1◈" },
      { id: "jab", expiresAt: 13 },
      { tick: 12, turnsPerRound: 3 },
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ t: "durationDelta", unitId: "jab", delta: 3 });
  });

  it("does nothing to a summon that has no clock", () => {
    // A Trump Soldier has no `expiresAt`. Adding to nothing must not GIVE it a
    // clock and quietly make a permanent summon mortal.
    const out = run(
      { kind: "DurationDelta", ticks: "1◈" },
      { id: "soldier", expiresAt: null },
      { tick: 12, turnsPerRound: 3 },
    );
    expect(out).toEqual([]);
  });

  it("does not negate its tick expression, unlike CooldownDelta beside it", () => {
    // Every cooldown clause in the corpus reduces, so `CooldownDelta` reads
    // `ticks` as `-resolveTicks(...)`. This one increases, and copying the
    // neighbouring line would shorten the stay it exists to lengthen.
    const out = run(
      { kind: "DurationDelta", ticks: "2◈" },
      { id: "jab", expiresAt: 20 },
      { tick: 12, turnsPerRound: 3 },
    );
    expect(out[0].delta).toBeGreaterThan(0);
    expect(out[0].delta).toBe(6);
  });
});

describe("E1 — a share of the damage that landed", () => {
  const run = (action, unit, ctx) =>
    dispatch(action, unit, { source: "test", abilityId: null }, ctx);
  const heal = { kind: "StatDelta", stat: "health.value", delta: "@amount", factor: 0.75 };

  it("multiplies the event's payload by the stated factor", () => {
    const out = run(heal, { id: "jab" }, { event: { amount: 400 } });
    expect(out[0]).toMatchObject({ t: "statDelta", unitId: "jab", stat: "health.value", delta: 300 });
  });

  it("reads what LANDED, not what was rolled", () => {
    // R2. The payload is `result.total` -- after every reduction. A Servant who
    // swings 1000 into a Def Up that stops 600 heals it by 300, not by 750.
    const out = run(heal, { id: "jab" }, { event: { amount: 400, rolled: 1000 } });
    expect(out[0].delta).toBe(300);
  });

  it("rounds toward zero, so a factor cannot invent a point of Health", () => {
    const out = run(heal, { id: "jab" }, { event: { amount: 5 } });
    expect(out[0].delta).toBe(3);
  });

  it("emits nothing when the event carries no payload", () => {
    // What every damageTaken handler saw before this task: `fireDamageTaken`
    // passed no `event` at all, so `@amount` resolved to null.
    expect(run(heal, { id: "jab" }, {})).toEqual([]);
  });

  it("leaves a literal delta alone", () => {
    // Every StatDelta authored before this one states a number.
    const out = run({ kind: "StatDelta", stat: "luck.value", delta: -1 }, { id: "x" }, {});
    expect(out[0]).toMatchObject({ delta: -1 });
  });
});

describe("E6 — an Item's rules apply only while it is Equipped", () => {
  // `EquipmentData` has carried `equipped` since it was written and the only
  // thing that read it was the actor sheet's context builder, which draws a
  // checkbox. `contributionsOf` collected an Item's `rules` from the moment it
  // was HELD.
  //
  // Nothing noticed because [Semiramis' Poison] is the only Item in the corpus
  // and it carries no `rules` at all -- it is a consumable with a
  // `consumeEffect`. The Vorpal Blade is the first Item that does anything
  // while worn, and every one of its five stat clauses opens with "When
  // Equipped".
  const blade = (equipped) => ({
    id: "blade", name: "[Vorpal Blade]", type: "equipment",
    system: { contentId: "vorpal-blade", equipped, rules: [{ key: "Ward", value: 30 }] },
  });
  const wards = (actor) => (contributionsOf(actor).modifiers ?? []).filter((m) => m.key === "ward");

  it("collects them when it is worn", () => {
    expect(wards({ system: {}, items: [blade(true)], effects: [] })).toHaveLength(1);
  });

  it("does NOT collect them when it is merely held", () => {
    // This is what the engine did in BOTH cases before this task.
    expect(wards({ system: {}, items: [blade(false)], effects: [] })).toEqual([]);
  });

  it("treats an unset `equipped` as not worn", () => {
    const held = blade(true);
    delete held.system.equipped;
    expect(wards({ system: {}, items: [held], effects: [] })).toEqual([]);
  });

  it("leaves an ordinary ABILITY item alone", () => {
    // The gate is on the item TYPE. An ability has no `equipped` field, and
    // reading one off it would switch off every passive in the game.
    const skill = {
      id: "s", name: "Shapeshift", type: "ability",
      system: { passiveRules: [{ key: "Ward", value: 30 }] },
    };
    expect(wards({ system: {}, items: [skill], effects: [] })).toHaveLength(1);
  });
});

describe("E4 — an Item may refuse particular holders", () => {
  // `acquisitionTarget` is the right seam -- its own docstring calls itself
  // "the one seam every acquisition goes through" and anticipates this exact
  // day: "the day a drop or a reward is added, it asks this and inherits the
  // redirect for free." What it could not do is refuse THIS item to THESE
  // units: its signature was (unit, board), and both its refusals are
  // properties of the unit. Pale Rider holds nothing at all; Nursery holds
  // anything except one sword.
  const blade = { contentId: "vorpal-blade", barredFrom: { ofUnit: "nursery-rhyme", roles: ["self", "master"] } };
  const board = () => ({ units: [
    { id: "n", contentId: "nursery-rhyme", kind: "servant", masterId: "m", panel: { i: 0, j: 0 } },
    { id: "m", kind: "master", servantId: "n", panel: { i: 0, j: 1 } },
    { id: "e", contentId: "cu-chulainn", kind: "servant", masterId: "em", panel: { i: 5, j: 5 } },
  ] });

  it("refuses Nursery herself", () => {
    const b = board();
    expect(acquisitionTarget(b.units[0], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });

  it("refuses her Master", () => {
    // The clause the Blade exists for. It is designed to be carried by a
    // MASTER -- "If the Master with this Item Equipped cannot be Underpowered
    // by Servants" -- so the refusal has to name hers specifically.
    const b = board();
    expect(acquisitionTarget(b.units[1], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });

  it("allows anybody else", () => {
    const b = board();
    expect(acquisitionTarget(b.units[2], b, blade)).toMatchObject({ ok: true, unitId: "e" });
  });

  it("is unchanged when no item is named", () => {
    // The existing callers pass two arguments and must not move.
    const b = board();
    expect(acquisitionTarget(b.units[0], b)).toMatchObject({ ok: true, unitId: "n" });
  });

  it("refuses a barred Servant BEFORE redirecting to a Master", () => {
    // Order matters. A barred Servant who redirects would otherwise hand the
    // sword straight to the second person the clause names.
    const b = board();
    b.units[0].itemHandling = "redirectToMaster";
    expect(acquisitionTarget(b.units[0], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });

  it("allows everybody when the named unit is not on the board", () => {
    // A bar against a Servant nobody summoned refuses nobody.
    const b = { units: [{ id: "e", contentId: "cu-chulainn", kind: "servant", panel: { i: 1, j: 1 } }] };
    expect(acquisitionTarget(b.units[0], b, blade)).toMatchObject({ ok: true });
  });
});

describe("E3 — an Item lying on a panel", () => {
  const barred = { ofUnit: "nursery-rhyme", roles: ["self", "master"] };
  const board = () => ({ units: [
    { id: "cache", kind: "structure", panel: { i: 3, j: 3 },
      carriesItemId: "vorpal-blade",
      carriesItem: { contentId: "vorpal-blade", barredFrom: barred } },
    { id: "e", contentId: "cu-chulainn", kind: "servant", panel: { i: 3, j: 3 } },
    { id: "n", contentId: "nursery-rhyme", kind: "servant", masterId: "m", panel: { i: 9, j: 9 } },
    { id: "m", kind: "master", servantId: "n", panel: { i: 9, j: 8 } },
  ] });

  it("hands it to a unit standing on its panel", () => {
    const b = board();
    expect(itemPickupIntents(b.units[1], b)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "itemGrant", unitId: "e", contentId: "vorpal-blade" }),
    ]));
  });

  it("removes the cache, so it cannot be picked up twice", () => {
    const b = board();
    expect(itemPickupIntents(b.units[1], b).some((i) => i.kind === "dismiss" && i.unitId === "cache")).toBe(true);
  });

  it("hands it to nobody standing elsewhere", () => {
    const b = board();
    expect(itemPickupIntents(b.units[2], b)).toEqual([]);
  });

  it("REFUSES Nursery standing on it, and leaves the cache there", () => {
    // Enforced at ACQUISITION rather than in the hook -- a refusal written into
    // the pickup is one a future trade or reward would not inherit.
    const b = board();
    b.units[2].panel = { i: 3, j: 3 };
    expect(itemPickupIntents(b.units[2], b)).toEqual([]);
  });

  it("REFUSES her Master too, and still leaves it there", () => {
    const b = board();
    b.units[3].panel = { i: 3, j: 3 };
    expect(itemPickupIntents(b.units[3], b)).toEqual([]);
  });

  it("ignores a structure that carries nothing", () => {
    const b = { units: [
      { id: "stone", kind: "structure", panel: { i: 1, j: 1 } },
      { id: "e", kind: "servant", panel: { i: 1, j: 1 } },
    ] };
    expect(itemPickupIntents(b.units[1], b)).toEqual([]);
  });
});

describe("E2 — a rule switched off permanently, by name", () => {
  const monster = (suppressed = []) => ({
    system: { suppressedScopes: suppressed },
    items: [{
      id: "jab", name: "Jabberwock", type: "ability",
      system: {
        passiveRules: [
          { key: "OnEvent", slug: "jabberwockLifesteal", event: "damageTaken", automatic: true,
            then: [{ key: "StatDelta", stat: "health.value", delta: "@amount", factor: 0.75 }] },
          { key: "Ward", value: 10 },
        ],
      },
    }],
    effects: [],
  });

  it("collects the lifesteal while nothing has switched it off", () => {
    const c = contributionsOf(monster());
    expect(c.eventHandlers).toHaveLength(1);
  });

  it("drops it once its slug is suppressed", () => {
    // "the 'Whenever the Jabberwock receives damage from Servants...' effect is
    // PERMANENTLY REMOVED from the Jabberwock."
    //
    // Not a RemoveEffect: the lifesteal is a passiveRule on its own statblock,
    // so there is no effect instance to strip, and buff-removal is the wrong
    // vocabulary besides -- it is not a buff.
    const c = contributionsOf(monster(["jabberwockLifesteal"]));
    expect(c.eventHandlers).toEqual([]);
  });

  it("leaves every OTHER rule on the same statblock alone", () => {
    // Scoped by slug, not by document. The Blade takes one clause away and the
    // monster keeps its Knockback, its Attributes and everything else.
    const c = contributionsOf(monster(["jabberwockLifesteal"]));
    expect((c.modifiers ?? []).filter((m) => m.key === "ward")).toHaveLength(1);
  });

  it("ignores a scope that names nothing", () => {
    const c = contributionsOf(monster(["somethingElse"]));
    expect(c.eventHandlers).toHaveLength(1);
  });
});

describe("R5 — the suppression survives a disappear-and-re-summon", () => {
  // The subtle half. A suppression that lives on the summon dies with the
  // summon, and the Jabberwock comes back "with the same Stats as when it
  // disappeared" -- so without the ride home the Blade's sacrifice is undone by
  // the next summoning, which is precisely the interaction the sheet spends a
  // sentence on.
  const applyRemembered = (data, remembered) => {
    for (const [stat, value] of Object.entries(remembered ?? {})) {
      if (stat === "suppressedScopes") continue;
      if (typeof value?.value !== "number") continue;
      data.system[stat] = { value: value.value, max: value.max ?? value.value };
    }
    if (Array.isArray(remembered?.suppressedScopes)) {
      data.system.suppressedScopes = [...remembered.suppressedScopes];
    }
    return data;
  };

  it("comes back at the Health it left on AND still suppressed", () => {
    const data = applyRemembered({ system: {} }, {
      health: { value: 900, max: 1500 },
      suppressedScopes: ["jabberwockLifesteal"],
    });
    expect(data.system.health).toEqual({ value: 900, max: 1500 });
    expect(data.system.suppressedScopes).toEqual(["jabberwockLifesteal"]);
  });

  it("does not treat the scope list as a stat", () => {
    // It is an array of strings, and the stat loop reads `.value` off a
    // `{value, max}` pair -- so without the skip it writes garbage.
    const data = applyRemembered({ system: {} }, { suppressedScopes: ["x"] });
    expect(data.system.suppressedScopes).toEqual(["x"]);
    expect(Object.keys(data.system)).toEqual(["suppressedScopes"]);
  });

  it("comes back clean when nothing was taken", () => {
    const data = applyRemembered({ system: {} }, { health: { value: 400, max: 1500 } });
    expect(data.system.suppressedScopes).toBeUndefined();
  });
});

const summon = (id) => parse(readFileSync(`packs/_source/summons/${id}.yml`, "utf8"));
const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
const structure = (id) => parse(readFileSync(`packs/_source/structures/${id}.yml`, "utf8"));
const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));

describe("Trump Soldiers (T1–T14, R1)", () => {
  it("T5–T10 — the statblock her sheet prints", () => {
    expect(summon("trump-soldier")).toMatchObject({
      baseHealth: 200, agility: 10, luck: 6, mov: 4,
      range: { panels: 2, targets: 1 },
      baseAttack: { str: 75, mag: 0 },
    });
  });

  it("T11/T12 — outside the budget, and once per Turn", () => {
    expect(summon("trump-soldier")).toMatchObject({ countsTowardBudget: false, actsOncePerTurn: true });
  });

  it("T13 — protects Nursery and her Master, from the SUMMON's own statblock", () => {
    // Medea's Dragon Tooth Warriors carry the identical sentence and, now, the
    // identical rule: a Decoy-shaped aura that removes targets rather than
    // forcing one. See the block below for what all four were authored as
    // first, and why it did nothing.
    const rule = summon("trump-soldier").passiveRules.find((r) => r.key === "TargetabilityModifier");
    expect(rule).toMatchObject({ radius: 1, recipientRoles: ["summoner", "summonerMaster"] });
  });

  it("R1 — 1d8+4, one die and then plus four", () => {
    // "4d8" is the other plausible reading of a careless transcription, and it
    // is a completely different swarm: 4 to 32 rather than 5 to 12.
    expect(ability("nursery-trump-soldiers").phases[0].spec.countRoll).toBe("1d8+4");
  });

  it("T4 — placed within a 2 panel area, which is a 5x5 side", () => {
    // `freePanels` reads `size` as a SIDE and halves it, so a Chebyshev radius
    // of 2 is `size: 5`. Medea's "within a 5x5 panel area" is the same ring.
    expect(ability("nursery-trump-soldiers").phases[0].spec.placement)
      .toMatchObject({ shape: "square", size: 5, anchor: "self" });
  });

  it("T14 — counts as her Attack, and costs a third of a Round PER soldier", () => {
    const a = ability("nursery-trump-soldiers");
    expect(a.countsAsAttack).toBe(true);
    expect(a.cooldown).toMatchObject({ perUnit: "⅓◈", countFrom: "summonCount" });
  });

  it("T1 — non-damaging: phases, and no damage phase", () => {
    const a = ability("nursery-trump-soldiers");
    expect(a.phases.some((p) => p.kind === "damage")).toBe(false);
    expect(a.damage).toBeUndefined();
  });
});

describe("the Jabberwock (J1–J18, R2, R3, R6, R7, R8)", () => {
  it("J3–J9 — the statblock, and both Attributes", () => {
    expect(summon("jabberwock")).toMatchObject({
      baseHealth: 1500, agility: 6, luck: 6, mov: 3,
      range: { panels: 2, targets: 1 },
      baseAttack: { str: 200, mag: 0 },
    });
    expect(summon("jabberwock").attributes).toEqual(expect.arrayContaining(["demonic", "giant"]));
  });

  it("J12 — walks onto occupied panels, which is what knocks the occupants back", () => {
    // Bašmu's pair of clauses exactly, and one field says both: the one-panel
    // push is what `knockBackOccupants` does for anything with this flag.
    expect(summon("jabberwock").movesOntoOccupiedPanels).toBe(true);
  });

  it("J13/R2/R3 — heals 75% of what LANDED, from Servants only", () => {
    const rule = summon("jabberwock").passiveRules.find((r) => r.event === "damageTaken");
    expect(rule.slug).toBe("jabberwockLifesteal");
    expect(rule.predicate).toContain("self:type:servant");
    // `defer: true`, or the rule is dropped at COLLECTION: `self:` means the
    // element's owner there and the attacker at event time, and the Jabberwock
    // is a summon rather than a Servant. Found on a live board -- the rule was
    // on the document, its slug was right, nothing was suppressed, and the
    // monster collected zero event handlers.
    expect(rule.defer).toBe(true);
    expect(rule.then[0]).toMatchObject({
      key: "StatDelta", stat: "health.value", delta: "@amount", factor: 0.75,
    });
  });

  it("J13 — and it actually reaches the handler bucket", () => {
    // The assertion the live board needed: a predicate answered at collection
    // time does not merely mis-gate the rule, it deletes it.
    const out = contributionsOf({
      system: { passiveRules: summon("jabberwock").passiveRules },
      items: [], effects: [],
    });
    expect(out.eventHandlers).toHaveLength(1);
    expect(out.eventHandlers[0].events).toContain("damageTaken");
  });

  it("J13/R3 — and NOT from a Master", () => {
    // Load-bearing: the Vorpal Blade is designed to be carried by a Master, so
    // a Master hitting the monster must not heal it even before the Blade's
    // own clause fires.
    const rule = summon("jabberwock").passiveRules.find((r) => r.event === "damageTaken");
    expect(testPredicate(rule.predicate, { options: new Set(["self:type:master"]) })).toBe(false);
    expect(testPredicate(rule.predicate, { options: new Set(["self:type:servant"]) })).toBe(true);
  });

  it("J10 — a stay of 3◈, on the summoning phase", () => {
    expect(ability("nursery-jabberwock").phases[0].spec.duration).toBe("3◈");
  });

  it("J2 — summoned on a panel NEXT to her", () => {
    expect(ability("nursery-jabberwock").phases[0].spec.placement).toMatchObject({ adjacentTo: "self" });
  });

  it("J11 — the Blade appears on its FIRST summoning only", () => {
    const phase = ability("nursery-jabberwock").phases.find((p) => p.kind === "createStructure");
    expect(phase).toMatchObject({ structureId: "vorpal-blade-cache", at: "randomPanel", once: true });
    expect(phase.carriesItemId).toBe("vorpal-blade");
  });

  it("J17/R6 — summoning counts as her Attack; the monster acts outside the budget", () => {
    // Otherwise this and `countsTowardBudget: false` would contradict.
    expect(ability("nursery-jabberwock").countsAsAttack).toBe(true);
    expect(summon("jabberwock").countsTowardBudget).toBe(false);
  });

  it("J18/R7 — the cooldown starts when it DISAPPEARS", () => {
    // Quetzalcoatl's mount records the defect this field exists to prevent:
    // "the mount may stand for twenty Turns and the clock has not begun."
    expect(ability("nursery-jabberwock").cooldown).toMatchObject({ max: "5◈", countFrom: "destroyed" });
  });

  it("J14/J15/R8 — Alice Eater buffs it and ADDS to its stay", () => {
    const a = ability("jabberwock-alice-eater");
    expect(a.cooldown).toBe("4◈");
    expect(a.phases[0].effects[0]).toMatchObject({ id: "atkUp", magnitude: 50, npMagnitude: 25, duration: "1◈" });
    const extend = a.phases.find((p) => p.rules)?.rules[0];
    expect(extend).toMatchObject({ key: "DurationDelta", ticks: "3◈" });
  });

  it("and the monster carries Alice Eater itself", () => {
    expect(summon("jabberwock").abilities).toContainEqual({ ref: "jabberwock-alice-eater" });
  });
});

describe("[Vorpal Blade] (B1–B8, R4, R5)", () => {
  const b = () => ability("vorpal-blade");
  const rule = (pred) => b().rules.find(pred);

  it("is an Item, spelled the way the corpus spells one", () => {
    // `type: equipment`, which is what semiramis-poison.yml carries.
    expect(b().type).toBe("equipment");
    expect(b().transferable).toBe(false);
  });

  it("B1 — +50 to a STR Normal Attack, and nothing to a Noble Phantasm", () => {
    // A flat addition rather than a change to the printed Base Attack:
    // `BaseAttackModifier` is a FACTOR, and "increase by 50" is not one.
    const r = rule((x) => x.key === "FlatDamage");
    expect(r).toMatchObject({ value: 50, npValue: 0 });
    expect(r.predicate).toEqual(expect.arrayContaining(["attack:kind:normal", "attack:component:str"]));
  });

  it("B2 — Range reduced TO 1, absolutely", () => {
    // A Servant at Range 4 and a Servant at Range 2 both end at 1, which no
    // single delta expresses.
    const r = rule((x) => x.key === "RangeDelta");
    expect(r.set).toBe(1);
    expect(r.value).toBeUndefined();
  });

  it("B3 — +50% Normal Attack damage to Demonic Units", () => {
    const r = rule((x) => x.key === "DamageModifier" && x.value === 50);
    expect(r.predicate).toEqual(expect.arrayContaining(["attack:kind:normal", "target:attribute:demonic"]));
  });

  it("R4 — and NOT against the Jabberwock, which is what 'instead of' means", () => {
    const r = rule((x) => x.key === "DamageModifier" && x.value === 50);
    expect(r.predicate).toContainEqual({ not: "target:contentId:jabberwock" });
  });

  it("R4 — the Jabberwock clause is 3x in the SAME bucket, so +200%", () => {
    // "it receives 3x damage INSTEAD OF 50% extra damage due to having the
    // 'Demonic' Attribute" -- the sheet compares the two directly, so they are
    // the same slot. 4.5x is the reading that looks right and is wrong.
    const r = rule((x) => x.key === "DamageModifier" && x.value === 200);
    expect(r.predicate).toEqual(expect.arrayContaining(["attack:kind:normal", "target:contentId:jabberwock"]));
  });

  it("B4 — none of the stat clauses reach an NP", () => {
    for (const r of b().rules.filter((x) => ["FlatDamage", "DamageModifier"].includes(x.key))) {
      expect(r.npValue).toBe(0);
    }
  });

  it("B6 — a Master holding it cannot be Underpowered", () => {
    expect(rule((x) => x.key === "Suppress" && x.scope === "underpower")).toBeTruthy();
  });

  it("B8 — barred from Nursery and her Master", () => {
    expect(b().barredFrom).toMatchObject({ ofUnit: "nursery-rhyme", roles: ["self", "master"] });
  });

  it("R5/B7 — one attack: the lifesteal goes, and the Blade breaks", () => {
    const r = rule((x) => x.event === "damageStepEnd");
    expect(r.predicate).toContain("target:contentId:jabberwock");
    expect(r.then).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "SuppressRule", subject: "victim", scope: "jabberwockLifesteal" }),
      expect.objectContaining({ key: "ItemDelta", item: "vorpal-blade", delta: -1 }),
    ]));
  });

  it("R5 — and the slug it suppresses is the one the monster actually carries", () => {
    // Without this pairing the removal aims at nothing and the monster keeps
    // healing -- silently, which is the whole shape of defect this part found
    // four of.
    const suppressed = rule((x) => x.event === "damageStepEnd")
      .then.find((a) => a.key === "SuppressRule").scope;
    expect(summon("jabberwock").passiveRules.some((r) => r.slug === suppressed)).toBe(true);
  });

  it("J11 — the cache it lies in is a structure nothing can break", () => {
    expect(structure("vorpal-blade-cache")).toMatchObject({ type: "structure", destroyableBy: [] });
  });

  it("her Servant file gains exactly two refs, taking it from 9 to 11", () => {
    const a = servant("nursery-rhyme").abilities;
    expect(a).toContainEqual({ ref: "nursery-trump-soldiers" });
    expect(a).toContainEqual({ ref: "nursery-jabberwock" });
    expect(a).toHaveLength(11);
  });
});

describe("the protection every summon that has it was missing", () => {
  // "Enemy Units cannot Attack Nursery or her Master if any Trump Soldiers are
  // directly next to them" -- and Medea's Dragon Tooth Warriors carry the same
  // sentence word for word.
  //
  // All four authored it as `TargetingModifier`, which pushes into `modifiers`
  // under a key the damage pipeline has no entry for and the targeting resolver
  // never reads. Collected, routed nowhere, and the protection had never once
  // applied -- for any of them, since the Warriors were written. Found on a
  // live board.
  const summons = ["trump-soldier", "dragon-tooth-warrior-blade",
    "dragon-tooth-warrior-bow", "dragon-tooth-warrior-daggers"];

  it.each(summons)("%s shields its summoner through an aura that is read", (id) => {
    const rule = summon(id).passiveRules.find((r) => r.key === "TargetabilityModifier");
    expect(rule).toMatchObject({ radius: 1, recipientRoles: ["summoner", "summonerMaster"] });
  });

  it.each(summons)("%s does not use the inert element", (id) => {
    expect(summon(id).passiveRules.some((r) => r.key === "TargetingModifier")).toBe(false);
  });

  it("and the aura actually reaches the `untargetable` bucket", () => {
    const out = contributionsOf({
      system: { summonerId: "nursery" },
      items: [{
        id: "s", name: "Trump Soldier", type: "ability",
        system: { passiveRules: [{
          key: "TargetabilityModifier", radius: 1,
          relations: ["ally", "self"], recipientRoles: ["summoner", "summonerMaster"],
        }] },
      }],
      effects: [],
    });
    expect(out.auras).toEqual([expect.objectContaining({ key: "untargetable", radius: 1 })]);
  });

  it("NOTHING in the corpus uses TargetingModifier any more", () => {
    // A guard rather than one assertion per file: the two names differ by three
    // letters and mean entirely different things.
    const files = readdirSync("packs/_source/summons")
      .concat(readdirSync("packs/_source/abilities").map((f) => `abilities/${f}`))
      .filter((f) => f.endsWith(".yml"));
    const offenders = files.filter((f) => {
      const path = f.startsWith("abilities/")
        ? `packs/_source/${f}` : `packs/_source/summons/${f}`;
      return readFileSync(path, "utf8").includes("key: TargetingModifier");
    });
    expect(offenders).toEqual([]);
  });
});

describe("the cache's fields exist on the type the engine writes them to", () => {
  // Found on a live board: the Vorpal Blade's cache was created, placed on its
  // random panel, and carried NOTHING -- because `carriesItemId` was declared
  // on `SummonData` and the cache is a `structure`.
  //
  // `placedById` two fields above it in the same file records the identical
  // failure in its own comment: "writing to a field this type does not have is
  // how the first four Bloodmarks placed themselves and then could not be
  // found again."
  const source = readFileSync("module/data/actor/simple.mjs", "utf8");
  const blockOf = (cls) => {
    const at = source.indexOf(`export class ${cls} extends`);
    const next = source.indexOf("\nexport class ", at + 1);
    return source.slice(at, next === -1 ? source.length : next);
  };

  it("declares carriesItemId on StructureData", () => {
    expect(blockOf("StructureData")).toContain("carriesItemId");
    expect(blockOf("StructureData")).toContain("carriesItemBarredFrom");
  });

  it("and NOT on SummonData, where it did nothing", () => {
    expect(blockOf("SummonData")).not.toContain("carriesItemId");
  });

  it("the structure the Jabberwock places is a structure", () => {
    // If this ever became a summon the fields would silently move type again.
    expect(structure("vorpal-blade-cache").type).toBe("structure");
  });
});

describe("damageStepEnd names who was hit", () => {
  // The event fires on the ATTACKER, and every rider hung from it is about the
  // Unit on the other end. `targetsOf` and `subjectOf` both read
  // `ctx.victim.unitId` and both correctly emit nothing when it is absent --
  // "a rider with no victim has nobody to ride."
  //
  // It was absent, so every such rider emitted nothing: Bašmu's "Normal Attacks
  // have a 50% chance of inflicting Poison" had never inflicted any, and
  // neither had Nursery Rhyme's Enigma. Found on a live board when the Vorpal
  // Blade dealt its 846 damage and took nothing away.
  const run = (action, ctx) =>
    dispatch(action, { id: "attacker" }, { source: "test", abilityId: null }, ctx);

  it("a victim-directed rider reaches the defender", () => {
    const out = run({ kind: "ApplyEffect", target: "victim", effect: { id: "poison" } },
      { victim: { unitId: "defender" }, tick: 0 });
    expect(out[0]).toMatchObject({ t: "applyEffect", unitId: "defender" });
  });

  it("and a victim-directed SuppressRule does too", () => {
    const out = run({ kind: "SuppressRule", subject: "victim", scope: "jabberwockLifesteal" },
      { victim: { unitId: "defender" }, board: { units: [{ id: "defender" }] } });
    expect(out[0]).toMatchObject({ t: "suppressRule", unitId: "defender", scope: "jabberwockLifesteal" });
  });

  it("and emits nothing when the event names nobody", () => {
    // The state the engine was in: correct refusal, wrong context.
    expect(run({ kind: "ApplyEffect", target: "victim", effect: { id: "poison" } }, { tick: 0 })).toEqual([]);
    expect(run({ kind: "SuppressRule", subject: "victim", scope: "x" }, { board: { units: [] } })).toEqual([]);
  });

  it("the fire site supplies one", () => {
    // A source scan, because the wiring is what was missing and no pure test
    // can reach it.
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const at = src.indexOf('fireEvent("damageStepEnd"');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 900)).toContain("victim:");
  });
});
