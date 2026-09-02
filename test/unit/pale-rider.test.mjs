/**
 * Pale Rider — the clauses that needed engine.
 *
 * @see char_orig_sheets/Copia de Pale Rider.md, docs/D-servant-data-sheets.md §D.26
 * @see docs/superpowers/plans/2026-09-02-pale-rider.md
 *
 * Almost nothing on his sheet is an attack: he cannot be damaged, cannot
 * attack and cannot react. What he has instead is an area that leaks Health, a
 * moving prison anchored to his Master, an aura of parameter-keyed effects and
 * four summoned spirits. These pin the general pieces each of those needed.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { GRANTS, hasGranted } from "../../module/rules/granted.mjs";
import { zonRadius } from "../../module/rules/zon.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { interiorModifiers } from "../../module/rules/bounded-fields.mjs";
import { pursuitVerdict } from "../../module/rules/movement.mjs";
import { guardsOf } from "../../module/rules/relations.mjs";

const effect = (name) => parse(readFileSync(`packs/_source/effects/${name}.yml`, "utf8"));
const classSkill = (name) => parse(readFileSync(`packs/_source/class-skills/${name}.yml`, "utf8"));
const ability = (name) => parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));

/* -------------------------------------------------------------------------- */

describe("Riding EX — the four passives", () => {
  it("names two grants no other Servant carries", () => {
    // "3. Pale Rider cannot perform Normal Attacks. 4. Pale Rider cannot
    // Evade, Block, or Counter." Grants rather than a Range of 0 or an empty
    // reaction list: he has a MAG Base Attack the sheet prints, and the
    // defender's rung still exists -- the only answer is nothing.
    expect(GRANTS.noNormalAttack).toBe("noNormalAttack");
    expect(GRANTS.noReactions).toBe("noReactions");
    const unit = { grantedAbilities: ["noNormalAttack", "noReactions"] };
    expect(hasGranted(unit, GRANTS.noNormalAttack)).toBe(true);
    expect(hasGranted(unit, GRANTS.noReactions)).toBe(true);
  });

  it("swells the Master's ZON by the Servant's MOV, and by six more on Riding's Turn", () => {
    // "Pale Rider's Master's ZON is increased by X panels, X = Pale Rider's
    // MOV." A bonus that names a STAT, which `ZonBonus` could not express.
    const master = { zon: 0, rank: null };
    const base = { servantClasses: ["rider"], mov: 6, zonBonuses: [{ fromStat: "mov", stacks: true }] };
    const withBonus = zonRadius(base, master);
    const without = zonRadius({ ...base, zonBonuses: [] }, master);
    expect(withBonus - without).toBe(6);

    // Read literally: Riding's Active is "+6 MOV for this Turn" and `mov` on
    // the snapshot includes it, so the zone swells by six on that Turn too.
    // The sheet gives no cap and none is imposed.
    expect(zonRadius({ ...base, mov: 12 }, master) - withBonus).toBe(6);
  });

  it("is authored as its own class-skill variant, not a rank row", () => {
    // The PASSIVE SET differs -- none of Double Move / Riding Attack /
    // Passenger Seat -- and a rank table cannot say that.
    const riding = classSkill("riding-pale-rider");
    expect(riding.rank).toBe("EX");
    const granted = riding.passiveRules.find((r) => r.key === "GrantedAbility");
    expect(granted.abilities).toEqual(["noNormalAttack", "noReactions"]);
    expect(riding.passiveRules.find((r) => r.key === "ZonBonus")).toMatchObject({
      fromStat: "mov", stacks: true,
    });
    // "The MOV Up effect from Riding's Active usage is not a buff."
    expect(riding.activeRules[0]).toMatchObject({ key: "MovDelta", value: 6, isBuff: false });
  });
});

describe("the three new effects", () => {
  it("Charm is the id control.mjs already looks for", () => {
    const charm = effect("charm");
    expect(charm.id).toBe("charm");
    expect(charm.polarity).toBe("debuff");
    // `mental` is a VOLATILITY -- Appendix A's own classification, and what
    // Heracles' Bravery and Jack's Mental Pollution both name, so both resist
    // Charm without either sheet listing it. `severity` is the other ladder
    // entirely (normal｜instakill｜death｜erase), which is what the content
    // validator caught when this was first authored the wrong way round.
    expect(charm.volatility).toBe("mental");
    expect(charm.severity).toBe("normal");
  });

  it("Regen heals 10% of maximum on all three boundaries", () => {
    // "Health is restored by 10% of its maximum value at the end of the Unit's
    // Turn, the end of any Turn the Unit Acts, and at the end of the Round."
    const rules = effect("regen").rules;
    // `event`, singular, holding an array -- which is what `normalizeHandler`
    // reads. Authored as `events:` it listened for `undefined` and healed
    // nobody; this assertion is the reason that was caught.
    const events = rules.flatMap((r) => (Array.isArray(r.event) ? r.event : [r.event]));
    expect(events).toEqual(["turnEnd", "actedTurnEnd", "roundEnd"]);
    expect(rules[0].then[0]).toMatchObject({ key: "Heal", percentOfMax: 10 });
  });

  it("Dmg Cut is a flat negation that spends one of three uses", () => {
    // "Applies Dmg Cut for 1◈ Turns, 3 times; all damage taken is reduced by
    // 100." A charge count `DamageNegation` never carried.
    const def = effect("dmg-cut");
    expect(def.uses).toBe(3);
    const out = collectContributions([{ id: "dmgCut", name: "Dmg Cut", rules: def.rules }]);
    expect(out.damageNegation[0]).toMatchObject({ mode: "flat", consumesUse: true });
  });
});

/* -------------------------------------------------------------------------- */
/*  Contagion — the first passive bounded field                                */
/* -------------------------------------------------------------------------- */

describe("Contagion", () => {
  const contagion = ability("pale-rider-contagion");

  it("is a passive field that follows him, with no duration and nothing to cast it", () => {
    // "(Passive) The 2 panel area around Pale Rider IS the Contagion area."
    const f = contagion.field;
    expect(f.passive).toBe(true);
    expect(f.geometry).toMatchObject({ kind: "followsUnit", shape: { kind: "square", size: 5 } });
    expect(f.duration).toBeUndefined();
  });

  it("lets Doomsday's area outrank the Active's marker, in file order", () => {
    // "Instead of its usual Range" is a precedence claim, and the file is
    // where precedence lives: first match wins.
    const [first, second] = contagion.field.geometry.overrides;
    expect(first).toMatchObject({ whileFieldOpen: "pale-rider-doomsday-come", sameAs: "pale-rider-doomsday-come" });
    expect(second).toMatchObject({ whileOwnerHas: "contagionExpanded", shape: { size: 9 } });
  });

  it("answers all three boundaries the sheet names", () => {
    // Trigger 1 is the OWNER's Turn ending, reaching every enemy inside;
    // trigger 2 is one enemy's own Turn ending inside, acted or not.
    const events = contagion.field.interiorEvents;
    expect(events.map((e) => e.event)).toEqual(["unitTurnEnd", "turnEnd", "actedTurnEnd"]);
    expect(events.every((e) => e.relations).valueOf()).toBe(true);
    expect(events.find((e) => e.event === "actedTurnEnd").requiresActed).toBe(true);
  });

  it("takes 100 as a Health loss rather than as damage, everywhere", () => {
    // "Not affected by effects that modify damage taken (does not count as
    // 'damage')" -- so never `Damage`, which is the pipeline.
    for (const event of contagion.field.interiorEvents) {
      expect(event.onFail[0]).toEqual({ key: "HealthLoss", amount: 100 });
      expect(event.onFail.some((a) => a.key === "Damage")).toBe(false);
    }
  });

  it("rewrites all three numbers under Doomsday Come, and 150 only near the Master", () => {
    const [near, inside] = contagion.field.interiorEvents[0].branches;
    expect(near.predicate).toEqual([
      "self:inField:pale-rider-doomsday-come", "self:withinOfOwnerMaster:3",
    ]);
    expect(near.onFail[0]).toEqual({ key: "HealthLoss", amount: 150 });
    expect(inside.onFail[0]).toEqual({ key: "HealthLoss", amount: 100 });
    for (const branch of [near, inside]) {
      expect(branch.onFail.find((a) => a.effect?.id === "poison").chance).toBe(75);
      expect(branch.onFail.find((a) => a.effect?.id === "charm").chance).toBe(25);
    }
  });

  it("uses 50/10 with no Doomsday standing", () => {
    const base = contagion.field.interiorEvents[0].onFail;
    expect(base.find((a) => a.effect?.id === "poison").chance).toBe(50);
    expect(base.find((a) => a.effect?.id === "charm")).toMatchObject({ chance: 10, duration: "1◈" });
  });

  it("has an Active that only marks him — the area reads the marker", () => {
    expect(contagion.cooldown).toBe("4◈");
    expect(contagion.phases).toEqual([
      { kind: "applyEffects", target: "self", effects: [{ id: "contagionExpanded", duration: "1◈" }] },
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Doomsday Come — the six axes                                               */
/* -------------------------------------------------------------------------- */

describe("Doomsday Come", () => {
  const np = ability("pale-rider-doomsday-come");

  it("is a non-damaging Anti-World NP on an 8◈ cooldown counted from its end", () => {
    expect(np.isNP).toBe(true);
    expect(np.npTags).toEqual(["antiWorld"]);
    // "(Non-damaging)" is a SHAPE, not a flag: phases declared, no `damage`
    // block among them. `asterios.test.mjs` holds that invariant for the
    // whole corpus, and this NP is the seventh in it.
    expect(np.damage).toBeUndefined();
    expect(np.phases.some((p) => p.kind === "damage")).toBe(false);
    // "Cooldown: 8◈ Turns AFTER Doomsday Come ends" -- from the field's own
    // closure, not from the cast.
    expect(np.cooldown).toEqual({ max: "8◈", countFrom: "deactivation" });
  });

  it("is a rolled-radius area around the MASTER that moves with them", () => {
    // "An X panel area around Pale Rider's Master ... X = (2 + number rolled on
    // a four-sided die) ... this area Moves together with Pale Rider's Master."
    expect(np.field.geometry).toMatchObject({
      kind: "followsUnit", unitRef: "ownerMaster",
      shape: { kind: "square", radiusRoll: "2+1d4" },
    });
  });

  it("seals enemies in and lets allies through", () => {
    // "Enemy Units within cannot leave said area, but enemy Units outside can
    // enter it; while allied Units can freely Move in and out."
    expect(np.field.membership).toEqual({
      enemyEntry: "free", enemyExit: "sealed", allyEntry: "free", allyExit: "free",
    });
  });

  it("isolates both directions", () => {
    // "Units outside cannot Attack Units within it and vice versa."
    expect(np.field.isolation).toMatchObject({
      outsideCanTargetInside: false, insideCanTargetOutside: false,
    });
  });

  it("lasts 2◈ and is extended by the Master, repeatedly, never below 100", () => {
    expect(np.field.duration).toBe("2◈");
    expect(np.field.extension).toEqual({
      cost: { kind: "health", amount: 100, payer: "ownerMaster", minimum: 100 },
      grants: "1◈", repeatable: true,
    });
  });
});

describe("Doomsday Come — the Anti-World escape", () => {
  const np = ability("pale-rider-doomsday-come");

  it("opens its boundary for an Anti-World NP and ends on the same use", () => {
    expect(np.field.isolation.piercedBy).toEqual({ npScale: "antiWorld" });
    expect(np.field.vulnerabilities).toContainEqual({
      kind: "npScaleUsedOn", scale: "antiWorld", result: "end", when: "combatProcessEnd",
    });
  });

  it("halves that NP's damage for everyone inside, ally and enemy alike", () => {
    // "All Units within it receive the damage from that NP, but its Total
    // Damage is reduced by 50%."
    const [rule] = np.field.interior;
    // POSITIVE, and keyed `defUp`: a `taken` modifier's magnitude is how much
    // the damage is reduced by, and the pipeline reads that bucket by name.
    expect(rule).toMatchObject({
      key: "DamageModifier", modifierKey: "defUp", direction: "taken", value: 50, npValue: 50,
    });
    expect(rule.relations).toEqual(["ally", "enemy", "self"]);
    expect(rule.predicate).toEqual(["attack:npScale:gte:antiWorld"]);
  });
});

describe("Doomsday Come — the drag-in", () => {
  const drag = ability("pale-rider-doomsday-drag");

  it("is measured from the AREA's edge, not from Pale Rider", () => {
    // The area is anchored on his Master and may be nowhere near him, so an
    // anchor measured from the caster would ask the wrong question entirely.
    expect(drag.targeting.anchor).toEqual({
      kind: "fieldEdge", fieldId: "pale-rider-doomsday-come", range: 2,
    });
  });

  it("exists only while the area does, and costs an Attack once per Turn", () => {
    expect(drag.requirements).toEqual([{ kind: "fieldOpen", field: "pale-rider-doomsday-come" }]);
    expect(drag.countsAsAttack).toBe(true);
    expect(drag.oncePerTurn).toBe(true);
  });

  it("resolves as a dragInto phase and deals no damage", () => {
    expect(drag.phases).toEqual([
      { kind: "dragInto", target: "reuse", fieldId: "pale-rider-doomsday-come" },
    ]);
    expect(drag.damage).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  Innocent World — six interior rules on Doomsday Come                       */
/* -------------------------------------------------------------------------- */

describe("Innocent World", () => {
  const np = ability("pale-rider-doomsday-come");
  const clauses = np.field.interior.filter((r) => r.relations?.length === 1 && r.relations[0] === "enemy");

  const field = (interior) => ({
    id: "pale-rider-doomsday-come", ownerId: "pale", ownerFaction: "a",
    geometry: { kind: "freeform" }, panels: [{ i: 0, j: 0 }], interior,
  });
  const enemy = (over = {}) => ({
    id: "e", kind: "servant", faction: "b", panel: { i: 0, j: 0 },
    parameters: {}, abilities: [], effects: [], ...over,
  });
  // Innocent World's six, without the Anti-World shelter beside them: that one
  // is `relations: [ally, enemy, self]` because "all Units within it receive
  // the damage" means all of them, and it would otherwise be counted here.
  const rulesFor = (unit) => interiorModifiers(field(np.field.interior), unit, { units: [unit], alliances: {} })
    .filter((r) => r.relations?.length === 1)
    .map((r) => r.key + (r.check ? `:${r.check}` : "") + (r.scope ? `:${r.scope}` : ""));

  it("is authored on the AREA, and its own Skill file carries no rules", () => {
    // "Constantly affects all enemy Units WITHIN Doomsday Come" -- a fact
    // about the area, so a Unit dragged in by somebody else is subject to it.
    expect(ability("pale-rider-innocent-world").passiveRules).toEqual([]);
    // SEVEN rules for six numbered clauses: clause 4 is two of them, because
    // "chance of being inflicted by debuffs is increased by 50% AND Total
    // Debuff Damage taken is increased by 50%" is two different mechanisms.
    expect(clauses).toHaveLength(7);
    expect(clauses.filter((r) => r.key === "ApplicationChance")).toHaveLength(1);
    expect(clauses.filter((r) => r.key === "VulnerabilityAmplifier")).toHaveLength(1);
  });

  it("gives a STR-highest enemy the damage-dealt reduction and nothing else", () => {
    expect(rulesFor(enemy({ parameters: { str: "A", end: "C", agi: "C", mag: "C", luc: "C" } })))
      .toEqual(["DamageModifier"]);
  });

  it("gives an AGI-highest enemy the Evade bonus", () => {
    expect(rulesFor(enemy({ parameters: { agi: "A", str: "C" } })))
      .toEqual(["CheckModifier:evade"]);
  });

  it("gives a MAG-highest enemy both halves of clause 4", () => {
    // "Chance of being inflicted by debuffs is increased by 50% AND Total
    // Debuff Damage taken is increased by 50%."
    expect(rulesFor(enemy({ parameters: { mag: "A", str: "C" } })))
      .toEqual(["ApplicationChance", "VulnerabilityAmplifier"]);
  });

  it("gives a tied enemy every related effect", () => {
    // "If the Unit has two or more Parameters of the same Rank, it is affected
    // by all related effects."
    expect(rulesFor(enemy({ parameters: { str: "A", agi: "A", luc: "C" } })))
      .toEqual(["DamageModifier", "CheckModifier:evade"]);
  });

  it("seals an enemy whose NP outranks every Parameter", () => {
    const sealed = enemy({ parameters: { str: "C", end: "C" }, abilities: [{ isNP: true, rank: "A" }] });
    expect(rulesFor(sealed)).toContain("Suppress:npSeal");
    const unsealed = enemy({ parameters: { str: "A" }, abilities: [{ isNP: true, rank: "A" }] });
    expect(rulesFor(unsealed)).not.toContain("Suppress:npSeal");
  });

  it("gives a Unit with NO Parameters exactly one clause, stably", () => {
    // "Roll a six-sided die and apply the effect corresponding to the number
    // rolled; that Unit will receive the same effect every time."
    const master = enemy({ id: "our-master", kind: "master", parameters: {} });
    const once = rulesFor(master);
    expect(once).toHaveLength(1);
    expect(rulesFor(master)).toEqual(once);
  });

  it("touches no ally, however its Parameters fall", () => {
    // "Constantly affects all enemy Units within" -- enemies only. The
    // Anti-World shelter beside these six is the clause that covers everyone,
    // and it is filtered out above.
    const ally = { ...enemy(), id: "a", faction: "a", parameters: { str: "A" } };
    expect(rulesFor(ally)).toEqual([]);
    const shelter = interiorModifiers(field(np.field.interior), ally, { units: [ally], alliances: {} })
      .filter((r) => r.relations?.length === 3);
    expect(shelter).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Guidance of the Netherworld, and the GotN discharge                        */
/* -------------------------------------------------------------------------- */

describe("Guidance of the Netherworld", () => {
  const g = ability("pale-rider-guidance-of-the-netherworld");

  it("buffs every ally within 2, itself included", () => {
    expect(g.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(g.targeting.selection).toMatchObject({ relations: ["ally", "self"], includeSelf: true });
    expect(g.phases[0].effects.map((e) => e.id)).toEqual(["atkUp", "regen", "dmgCut"]);
    expect(g.phases[0].effects[0]).toMatchObject({ magnitude: 20, npMagnitude: 10, duration: "1◈" });
    expect(g.cooldown).toBe("4◈");
  });

  it("marks everyone it affected EXCEPT itself", () => {
    // Its own targeting rather than a flag: the phase target list is the
    // ability's, and this clause reaches a different set.
    const mark = g.phases[1];
    expect(mark.effects).toEqual([{ id: "gotn" }]);
    expect(mark.targeting.selection).toMatchObject({ relations: ["ally"], includeSelf: false });
  });

  it("leaves the charge count on the effect definition, where it is read", () => {
    expect(effect("dmg-cut").uses).toBe(3);
    expect(g.phases[0].effects.find((e) => e.id === "dmgCut").uses).toBeUndefined();
  });

  it("is neither buff nor debuff, and unremovable", () => {
    expect(effect("gotn")).toMatchObject({
      polarity: "status", valence: "neither", unremovable: true, rules: [],
    });
  });

  it("discharges on contact with Doomsday, then removes the marker", () => {
    const contact = ability("pale-rider-doomsday-come").field.interiorEvents
      .find((e) => e.requiresEffect === "gotn");
    expect(contact).toMatchObject({ event: "contact", relations: ["ally", "self"] });
    expect(contact.onFail.map((a) => a.effect?.id)).toEqual(["atkUp", "regen", "dmgCut", "gotn"]);
    expect(contact.onFail.at(-1).key).toBe("RemoveEffect");
  });
});

/* -------------------------------------------------------------------------- */
/*  Kagome Kagome — four bound Spirits                                         */
/* -------------------------------------------------------------------------- */

describe("the Kagome Spirits", () => {
  const summon = (name) => parse(readFileSync(`packs/_source/summons/${name}.yml`, "utf8"));

  it.each([
    ["kagome-sword", { delta: 2 }, 5, 1, 150, 5],
    ["kagome-famine", { delta: -1 }, 4, 3, 100, 10],
    ["kagome-death", null, 5, 1, 125, 25],
    ["kagome-beast", { delta: 1 }, 6, 2, 125, 10],
  ])("%s takes its Agility from the summoner and rides a Death chance", (id, agi, mov, range, mag, chance) => {
    const s = summon(id);
    // "Health: - (Cannot be damaged)" -- no number at all.
    expect(s.undamageable).toBe(true);
    expect(s.baseHealth).toBeNull();
    // "Agility: Pale Rider's plus 2" / "Same as Pale Rider's".
    expect(s.inherit.agility).toEqual(agi ? { from: "summoner", ...agi } : { from: "summoner" });
    expect(s.inherit.luck).toEqual({ from: "summoner" });
    expect(s.mov).toBe(mov);
    expect(s.range.panels).toBe(range);
    expect(s.baseAttack.mag).toBe(mag);
    expect(s.attributes).toEqual(expect.arrayContaining(["dark", "spirit"]));
    // "Do not count towards the number of Units that Move and/or Attack" AND
    // "can only Move/Attack once per Turn" -- two rules, both stated.
    expect(s.countsTowardBudget).toBe(false);
    expect(s.actsOncePerTurn).toBe(true);

    const rider = s.passiveRules.find((r) => r.event === "damageDealt");
    expect(rider.then[0]).toMatchObject({
      key: "ApplyEffect", target: "victim", effect: { id: "death" }, chance,
    });
  });

  it("gives Famine, and only Famine, an area Normal Attack", () => {
    // "Range: 3 panels, 3x3 panel area."
    expect(summon("kagome-famine").normalAttack.shape).toEqual({ kind: "square", size: 3 });
    for (const id of ["kagome-sword", "kagome-death", "kagome-beast"]) {
      expect(summon(id).normalAttack.shape).toBeUndefined();
    }
  });

  it("vanishes from Light and from anti-Dark or anti-Spirit attacks", () => {
    for (const id of ["kagome-sword", "kagome-famine", "kagome-death", "kagome-beast"]) {
      const banish = summon(id).passiveRules.find((r) => r.event === "attacked");
      expect(banish.predicate[0].or).toEqual([
        "attack:element:light", "attack:vsAttribute:dark", "attack:vsAttribute:spirit",
      ]);
      // "1◈ Turns if Tails, 2◈ Turns if Heads."
      expect(banish.then[0]).toEqual({ key: "Banish", coin: { heads: "2◈", tails: "1◈" } });
    }
  });

  it("cannot Evade, Block or Counter", () => {
    const granted = summon("kagome-sword").passiveRules.find((r) => r.key === "GrantedAbility");
    expect(granted.abilities).toEqual(["noReactions"]);
  });

  it("is summoned one per enemy on contact, remembered on Pale Rider", () => {
    const ev = ability("pale-rider-doomsday-come").field.interiorEvents
      .find((e) => e.onFail.some((a) => a.key === "SummonBound"));
    expect(ev).toMatchObject({ event: "contact", relations: ["enemy"] });
    const [action] = ev.onFail;
    expect(action).toMatchObject({ typeRoll: "1d4", rememberOn: "owner" });
    expect(Object.values(action.types))
      .toEqual(["kagome-sword", "kagome-famine", "kagome-death", "kagome-beast"]);
  });
});

describe("pursuit", () => {
  const prey = { id: "prey", name: "Prey", faction: "b", panel: { i: 0, j: 5 }, fields: ["doomsday"] };
  const spirit = {
    id: "s", name: "Kagome: Sword", faction: "a", panel: { i: 0, j: 0 },
    pursuitTargetId: "prey", boundToFieldId: "doomsday",
  };
  const board = { units: [prey, spirit] };

  it("refuses a step that ends further away", () => {
    // "Constantly Move towards that Unit" is a constraint on the player, not
    // an automaton: the route is theirs, the direction is the rule's.
    // Chebyshev, so retreating means moving AWAY along the axis that
    // separates them: the prey is five panels east, so west is away.
    const verdict = pursuitVerdict(spirit, [{ i: 0, j: 0 }, { i: 0, j: -1 }, { i: 0, j: -2 }], board);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/must Move towards Prey/);
  });

  it("allows a step that closes or holds the distance", () => {
    expect(pursuitVerdict(spirit, [{ i: 0, j: 0 }, { i: 0, j: 1 }], board).ok).toBe(true);
    expect(pursuitVerdict(spirit, [{ i: 0, j: 0 }, { i: 1, j: 1 }], board).ok).toBe(true);
  });

  it("is lifted once the prey has left the bound field", () => {
    // A Spirit is summoned for an enemy WITHIN Doomsday Come; one who has left
    // is no longer its business.
    const gone = { ...prey, fields: [] };
    expect(pursuitVerdict(spirit, [{ i: 0, j: 0 }, { i: 0, j: -2 }], { units: [gone, spirit] }).ok).toBe(true);
  });

  it("says nothing about a unit that hunts nobody", () => {
    expect(pursuitVerdict({ id: "x" }, [{ i: 0, j: 0 }, { i: 9, j: 9 }], board).ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  The Servant, and the relationship proxy                                    */
/* -------------------------------------------------------------------------- */

describe("Pale Rider", () => {
  const pale = parse(readFileSync("packs/_source/servants/pale-rider.yml", "utf8"));

  it("has no Health at all, and cannot hold Items", () => {
    expect(pale.baseHealth).toBeNull();
    expect(pale.undamageable).toBe(true);
    expect(pale.cannotHoldItems).toBe(true);
  });

  it("carries every ability on his sheet, in the sheet's order", () => {
    expect(pale.abilities.map((a) => a.ref)).toEqual([
      "pale-rider-riding",
      "class-magic-resistance",
      "pale-rider-contagion",
      "pale-rider-innocent-world",
      "pale-rider-guidance-of-the-netherworld",
      "pale-rider-doomsday-come",
      "pale-rider-doomsday-drag",
      "pale-rider-kagome-kagome",
    ]);
    expect(pale.abilities.find((a) => a.ref === "class-magic-resistance").rank).toBe("C");
  });

  it("states the sheet's numbers", () => {
    expect(pale.parameters).toEqual({ str: "E", end: "A", agi: "B", mag: "A", luc: "C" });
    expect(pale.mov).toBe(6);
    expect(pale.baseAttack).toEqual({ str: 50, mag: 200 });
    expect(pale.sustainability).toBe("2◈");
    // "Range: - (See 'Contagion')" -- and he cannot Normal Attack at all.
    expect(pale.range.panels).toBe(0);
  });

  it("hands the relationship rules to his Spirits", () => {
    expect(pale.rules).toEqual([{ key: "RelationshipProxy", proxy: "summons" }]);
  });
});

describe("guardsOf", () => {
  const master = { id: "m", kind: "master", factionId: "a", panel: { i: 5, j: 5 } };
  const ordinary = { id: "s", kind: "servant", factionId: "a", panel: { i: 5, j: 6 } };
  const proxying = {
    id: "pale", kind: "servant", factionId: "a", panel: { i: 5, j: 6 },
    suppressions: [{ scope: "relationship", proxy: "summons" }],
  };
  const spirit = {
    id: "k", kind: "summon", factionId: "a", panel: { i: 6, j: 6 },
    summonerId: "pale", boundToFieldId: "doomsday",
  };

  it("is the Master's own Servants, ordinarily", () => {
    expect(guardsOf(master, { units: [master, ordinary] }).map((u) => u.id)).toEqual(["s"]);
  });

  it("substitutes a proxying Servant's bound summons for the Servant itself", () => {
    // "...have no effect between Pale Rider and its Master; but apply between
    // Kagome Spirits and Pale Rider's Master." The substitution is total.
    const board = { units: [master, proxying, spirit] };
    expect(guardsOf(master, board).map((u) => u.id)).toEqual(["k"]);
  });

  it("leaves the Master unguarded when the proxy has no summons left", () => {
    expect(guardsOf(master, { units: [master, proxying] })).toEqual([]);
    const dead = { ...spirit, defeated: true };
    expect(guardsOf(master, { units: [master, proxying, dead] })).toEqual([]);
    const unbound = { ...spirit, boundToFieldId: null };
    expect(guardsOf(master, { units: [master, proxying, unbound] })).toEqual([]);
  });
});
