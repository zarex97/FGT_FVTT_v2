/**
 * @file Roll options — the vocabulary every predicate is written against.
 * @see docs/11-predicates.md
 *
 * Layer 2 (rules). Pure.
 *
 * A predicate is a set membership test: `["target:attribute:divine"]` is true
 * when that string is in the option set. So the set *is* the vocabulary, and a
 * clause nobody emits is a clause that can never be true.
 *
 * Two such clauses were found by authoring Penthesilea:
 *
 *   - `domain/tables.mjs` has predicated on `target:skill:divinity` since the
 *     tables were transcribed, and **nothing emitted a `skill:` option**. The
 *     Divinity-versus-Divinity clause could not fire, in either direction.
 *   - Nothing emitted region, so *"damage dealt to Male Units from the Greece
 *     region"* could not be written at all.
 *
 * This lives in the rules layer rather than in the attack flow because the flow
 * needs Foundry and this does not — which is the only reason the gaps above
 * went unnoticed for as long as they did.
 */

import { Rank } from "../domain/rank.mjs";
import { GENERATED_EMITTABLE } from "./facets.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { NP_TAG_SCALE, scaleTagOf } from "./np-scale.mjs";
import { referencedOptions } from "./predicate.mjs";
import { stanceOf, mountedThisTurn } from "./stance.mjs";
import { heldOn } from "./modes.mjs";
import { categoriesOf } from "./items.mjs";
import { isNPAttack } from "./damage/pipeline.mjs";

/**
 * A Unit's own facts, as `self:` options, and nothing else.
 *
 * What a handler's hearer, a caster gating its own phases, or anything asking
 * about one Unit alone is addressed by. Three places each filtered a full set
 * down to this (the damage rider gate, the scheduler, `runPhases`), each for
 * the same reason: `rollOptionsFor` used to invent `attack:kind:normal` for
 * an attack nobody named (#190, #199).
 *
 * @param {object} unit
 * @returns {string[]}
 */
export function ownerOptionsOf(unit) {
  return [...rollOptionsFor({ attacker: unit, defender: null })].filter((o) => o.startsWith("self:"));
}

/**
 * Every option describing this attacker, this defender and this attack.
 *
 * @param {object} args
 * @param {object} args.attacker the attacker's snapshot
 * @param {object} args.defender the defender's snapshot
 * @param {object|null} [args.attack] the Attack Description's facts
 *   (`{kind, isAoE, component, range, aim, pierce}`), or null when there is no
 *   attack -- and then no `attack:` option at all
 * @returns {Set<string>}
 */
export function rollOptionsFor({ attacker, defender, attack = null, withoutModeHeld = false }) {
  /** @type {Set<string>} */
  const options = new Set();

  add(options, "self", attacker, withoutModeHeld);
  add(options, "target", defender, withoutModeHeld);
  compareParameters(options, attacker, defender);

  // `attack:` options ONLY FROM AN ATTACK. Every call that named none used to
  // get `attack:kind:normal` anyway, so a Skill, a Turn boundary or a hearer
  // with no attack in sight looked like a Normal Attack to every clause that
  // asked: Karna's "Normal Attacks only" Burn was filed on Brahmastra (#190),
  // and Zabaniya's NP rode Serenity's Normal-Attack riders (#199). And no kind
  // is invented for an attack that states none.
  if (!attack) return options;
  if (attack.kind) options.add(`attack:kind:${attack.kind}`);
  // A RIDE is a kind too. Troias Tragoidia's passive is *"Riding Attack damage
  // is increased by 25%"*, authored `attack:kind:ridingAttack`, and nothing
  // emitted it: a ride's Normal Attack is `kind: normal`, so the +25% never
  // applied to any ride (#184, found live). Both, because a ride is still that
  // Unit's Normal Attack (or the Noble Phantasm it is) for everything else.
  if (attack.ride) options.add("attack:kind:ridingAttack");
  // A Skill whose attack IS its user's Normal Attack, powered up: Karna's Mana
  // Burst (Flames), *"used when performing a Normal Attack"*. Its own kind
  // stays, as a ride's does, so Vasavi Shakti's Normal-Attack Divinity bonus
  // reaches it (#206 reading 5).
  if (attack.asNormalAttack) options.add("attack:kind:normal");
  // "An NP" is a Noble Phantasm or an ability the sheet CATEGORIZES as one
  // (EMIYA's Overedge, Mannanán's Fragarach Counter, Magic Crest), for every
  // clause that asks (ruled 2026-10-16, #208): NP DmUp, Rho Aias, Nemo, the
  // Circuits. Answered by the one definition the damage pipeline and the crit
  // coin share (`isNPAttack`). It replaces `attack:isNP`, which said the same
  // thing beside a narrower `attack:kind:np` -- two names for one question.
  // Overedge keeps `attack:kind:normal` too: each swing is both (reading 7).
  if (isNPAttack(attack)) options.add("attack:kind:np");
  // The HEARER made this attack. Every other `attack:` option is a fact about the
  // attack, and an event fired on both combatants hands both the same set; this
  // one is set only for a firing on the attacker (`combatProcessEnd`), so "an
  // Attack he performs" can be asked apart from "an Attack he took" (#208 reading 10).
  if (attack.performed) options.add("attack:performed");
  if (attack.isAoE) options.add("attack:isAoE");
  // Whether this declaration ANSWERS an attack rather than starting one
  // (Ch. 21). Avenger's second half is the first clause to ask: *"If Castor
  // Counters after receiving an Attack, increase the damage dealt when
  // Countering."* "After receiving an Attack" needs no separate test -- a
  // Counter is only ever declared at Combat Process step 6.
  if (attack.isCounter) options.add("attack:isCounter");

  // Damage MEASURED as an attack's and dealt by none: a Knockback's
  // *"receives damage equivalent to a Normal Attack"* (#184 reading 8). It runs
  // a Combat Process for the arithmetic and is not an Attack, which Def Dwn (A)
  // and (C) are about: Luck and Agility fall *"whenever damage is received from
  // an Attack"* (#209, #223).
  if (attack.plainDamage) options.add("attack:plainDamage");

  // HOW THE DEFENDER REACTED, once the ladder has closed. Emitted on `target`
  // because that is what the defender is called throughout this vocabulary.
  //
  // `none` is emitted as a real answer rather than left absent: Nemo's
  // Quickfire pays him *"if the enemy Unit does not perform a Counter"*, which
  // is a clause about an absence, and `not:target:reaction:counter` can only be
  // false-by-default unless something says what DID happen. Two of his clauses
  // read this and nothing emitted it.
  if (attack.reaction) options.add(`target:reaction:${attack.reaction}`);

  // WHICH Base Attack, and whether the attack is one Magic Resistance sees.
  // Magic Resistance's Instakill/Death ladder turns on both: it covers those
  // two tiers *"unless the Instakill or Death debuffs are from an Attack /
  // Attack Skill / Spell / NP that deals STR damage or that is not affected by
  // Magic Resistance"*. Neither was expressible before, so the exemption could
  // not be written at all.
  if (attack.component) options.add(`attack:component:${attack.component}`);
  // WHICH ELEMENT, for a resistance written against a damage type rather than
  // against a source. Karna's Mana Burst (Flames) is *"All Total Fire Damage
  // taken is reduced by 50% including NP"* -- a clause about the attack's
  // element, which the pipeline has read as `ctx.attack.element` since stage 0
  // was written (Fire breaks Freeze, `flamHeal` converts it) while no predicate
  // could ask about it. Three Servants in the corpus already declare an
  // `element:` on an ability and none of them could be resisted by type.
  if (attack.element) options.add(`attack:element:${attack.element}`);
  // WHICH SCALE. Emitted as a ladder, for the same reason the rank comparison
  // is: a predicate can only test set membership, so *"[Anti-World] **or
  // higher**"* has to already be a member. An Anti-Army NP is therefore also
  // "Anti-Unit or higher".
  //
  // Doomsday Come is the first clause to ask -- its isolation opens for one,
  // its vulnerability ends on one, and its interior halves that one's damage.
  // A qualifier-only tag list (`[Barrier]`) has no scale and emits nothing.
  const scale = scaleTagOf(attack.npTags ?? []);
  if (scale) {
    for (const tag of NP_TAG_SCALE) {
      options.add(`attack:npScale:gte:${tag}`);
      if (tag === scale) break;
    }
  }
  // EVERY TAG, the qualifiers included. *"An Attack with the 'Anti-Dragon'
  // Attribute"* (Arturia's Magic Resistance, #230 reading 21) asks about a tag
  // that is no scale, and nothing emitted one: the ladder above stops at the
  // scale, so a qualifier was unaskable.
  for (const tag of attack.npTags ?? []) options.add(`attack:tag:${tag}`);
  // WHICH ABILITY made it (`attack.sourceContentId`): *"Normal Attacks performed
  // with Mana Burst"* (Arturia's DRC, #230). A bare Normal Attack has none.
  if (attack.sourceContentId) options.add(`attack:madeWith:${attack.sourceContentId}`);
  // WHAT THE ATTACK IS GOOD AGAINST. *"An Attack that deals extra damage to
  // Units with the 'Dark' or 'Spirit' Attribute"* is not a property an ability
  // declares -- it is a property of the attacker's own active damage
  // modifiers, which is where the extra damage comes from. So it is read off
  // the predicates those modifiers carry.
  //
  // The Kagome Spirits are the first clause to ask, and they ask about a whole
  // class of attacks nobody has to remember to tag.
  for (const m of attacker?.modifiers ?? []) {
    if (m.direction !== "dealt" || !m.predicate) continue;
    if ((m.value ?? 0) <= 0 && (m.npValue ?? 0) <= 0) continue;
    for (const ref of referencedOptions(m.predicate)) {
      const hit = /^target:attribute:([A-Za-z][\w-]*)$/.exec(ref);
      if (hit) options.add(`attack:vsAttribute:${hit[1]}`);
    }
  }
  if (attack.ignoresMagicResistance) options.add("attack:ignoresMagicResistance");
  if (attack.aim) options.add("attack:aim");
  if (attack.pierce) options.add("attack:pierce");
  // A property only Rho Aias asks about -- "if the NP is a 'thrown weapon',
  // Rho Aias' Health cannot drop below 1" -- and therefore the only clause in
  // the game that can stop an arbitrarily large Noble Phantasm outright.
  if (attack.thrownWeapon) options.add("attack:thrownWeapon");
  // WHETHER IT CRIT. Known only once the coin has been flipped, so it is absent
  // from every option set built before the Damage Step -- which is correct: a
  // clause that reads it is by definition asking about a resolved attack.
  // Serenity's `Macabre` is the first: *"Normal Attack Crits inflict an
  // additional Stage of Poison on the DU"*.
  if (attack.crit) options.add("attack:crit");
  // WHETHER IT HURT: damage was dealt, not only a hit landed. Known once the
  // Damage Step has resolved, like the crit. Nursery's Enigma is *"a Normal
  // Attack which deals STR damage"*, ruled to need damage dealt (#247 reading 2),
  // against the hit-not-hurt rule riders follow.
  if (attack.dealtDamage) options.add("attack:dealtDamage");

  // HOW FAR. EMIYA is written almost entirely in terms of it -- his Normal
  // Attack changes component at 3, *Clairvoyance* and *Hawkeye* turn on at 3,
  // *Kanshou & Bakuya* at 2 or lower -- and nothing emitted a distance, so
  // none of those clauses could be written at all.
  //
  // Emitted as a LADDER in both directions, for the same reason the rank
  // comparison is: a predicate can only test set membership, so "3 or higher"
  // has to already be a member.
  if (typeof attack.range === "number" && Number.isFinite(attack.range)) {
    const range = Math.max(0, Math.round(attack.range));
    options.add(`attack:range:${range}`);
    for (let r = 1; r <= Math.min(range, MAX_RANGE_OPTION); r++) options.add(`attack:range:gte:${r}`);
    for (let r = range; r <= MAX_RANGE_OPTION; r++) options.add(`attack:range:lte:${r}`);
  }

  return options;
}

/**
 * How far the range ladder is emitted.
 *
 * A cap rather than a board dimension, because `lte` has to be emitted upwards
 * and the board's own width would put four hundred strings in a set that is
 * rebuilt for every damage event. The longest range any sheet in the reference
 * set names is 3.
 */
export const MAX_RANGE_OPTION = 12;

/**
 * The defender's Parameters against the attacker's own, one option per
 * Parameter.
 *
 * Karna's *Brahmastra* is the only clause in the reference set that compares
 * two Units Parameter by Parameter:
 *
 * > 1. If **all** of the DU's Parameters are equal or lower than Karna's, this
 * >    NP deals 4× damage plus 100.
 * > 2. If the DU has **any** Parameter higher than Karna's, it deals 2× plus 100.
 *
 * It cannot be written with the `rank:gte:` ladder `add()` emits. That ladder is
 * absolute and **grade-coarse**: `gradesClearedBy` gives a `B+` Unit the grades
 * `E…B` and not `A`, so `not:target:rank:str:gte:A` reads as *"STR is not above
 * B"* for a Unit whose STR **is** above B. Against Karna's own `B/C/A/B/D` that
 * silently hands the 4× branch to half the Servants who should get 2× — and 4×
 * versus 2× on an A+ Noble Phantasm is the largest single damage swing any
 * predicate in the game decides.
 *
 * So the comparison is made where both Units are in scope, with `Rank.compare`,
 * and emitted as its answer. `gt` is the one the clause actually names; `eq` and
 * `lt` are emitted too because the same three-way answer is what any future
 * "higher/equal/lower Parameter" clause asks for, and leaving them out would
 * make the next one add a fourth comparison mechanism.
 *
 * An **unranked** Parameter on either side emits nothing for that Parameter,
 * rather than guessing. A Unit with no MAG rank at all has not got a MAG higher
 * than Karna's, and it has not got one equal to his either — the question does
 * not apply, and `not:...:gt` (which is how clause 1 is authored) is therefore
 * satisfied, matching *"all of the DU's Parameters are equal or lower"* read
 * over the Parameters it has.
 *
 * @param {Set<string>} options
 * @param {object} attacker
 * @param {object} defender
 * @returns {void}
 */
function compareParameters(options, attacker, defender) {
  const mine = attacker?.parameters ?? null;
  const theirs = defender?.parameters ?? null;
  if (!mine || !theirs) return;

  for (const parameter of Object.keys(theirs)) {
    const a = parseRank(theirs[parameter]);
    const b = parseRank(mine[parameter]);
    if (!a || !b) continue;
    const order = Rank.compare(a, b);
    const verdict = order > 0 ? "gt" : order < 0 ? "lt" : "eq";
    options.add(`target:paramVsSelf:${parameter}:${verdict}`);
  }
}

/**
 * A rank, or `null` for anything unparseable.
 *
 * Same reason `gradesClearedBy` swallows the throw: this pass runs over whatever
 * a live document holds, and one malformed rank must not take the whole board
 * snapshot down with it.
 *
 * @param {unknown} raw
 * @returns {Rank|null}
 */
function parseRank(raw) {
  try {
    return Rank.parseOrNull(raw);
  } catch {
    return null;
  }
}

/**
 * Everything one side contributes, under its own prefix.
 *
 * @param {Set<string>} options
 * @param {"self"|"target"} side
 * @param {object} unit
 * @param {boolean} [withoutModeHeld] see `rollOptionsFor`
 * @returns {void}
 */
function add(options, side, unit, withoutModeHeld = false) {
  if (!unit) return;

  if (unit.kind) options.add(`${side}:type:${unit.kind}`);

  // WHICH Servant this is, by the one name of theirs that a world cannot rename.
  //
  // Ch. 45's DECISION -- *"cross-Servant references resolve by a stable slug"* --
  // with nothing emitting one, so the only clause in the reference set that
  // names another Heroic Spirit could not be written at all. Karna's *Fated
  // Rivals of the Mahabharata* is *"if **Arjuna** is on the opposing Faction and
  // within Range of Karna, they will only Attack each other"*.
  //
  // The content id, not the display name and not the true name: a player may
  // rename an actor, and `identityRevealed` deliberately hides the true name
  // from opponents. The compulsion is a fact about who the Servant IS, and it
  // holds whether or not the table has worked that out yet.
  if (unit.contentId) options.add(`${side}:contentId:${unit.contentId}`);
  for (const a of unit.attributes ?? []) options.add(`${side}:attribute:${a}`);
  for (const e of unit.effects ?? []) options.add(`${side}:effect:${e}`);
  // HOW MANY of each, as a ladder, the way the rank comparison is: a predicate
  // can only test membership, so *"after Arturia performs 3 Attacks"* (her
  // Utopia count, #230) has to already be a member at 3, 4 and onwards.
  // `effects` lists one id per instance.
  const held = new Map();
  for (const e of unit.effects ?? []) held.set(e, (held.get(e) ?? 0) + 1);
  for (const [e, n] of held) {
    for (let k = 1; k <= Math.min(n, 20); k += 1) options.add(`${side}:effectStacks:${e}:gte:${k}`);
  }
  // The umbrella, beside the members. Medusa's `Dmg Up (Bind)` is
  // *"all damage dealt to Units inflicted with Bind effects"* -- one predicate
  // over ten effects, which naming each of them could not keep current.
  for (const f of unit.effectFamilies ?? []) options.add(`${side}:effectFamily:${f}`);

  // Day or Night AT THIS UNIT'S PANEL. There was no day/night option in the
  // vocabulary at all, so Ozymandias's *"If used during a Day Round"* clauses
  // -- two of Pharaoh of the Hot Sands' three -- could not be written.
  //
  // Per panel rather than per Round, because `phaseAt` already makes it a
  // positional question: a unit inside Quetzalcoatl's `Sol`, or inside
  // Pyramid Drop's own daylight, is in Day while the Round is Night.
  //
  // `"none"` -- the cycle switched off -- emits NOTHING rather than a third
  // value. There is no Day to be in, and a clause gated on one should not fire.
  if (unit.phase === "day" || unit.phase === "night") options.add(`${side}:phase:${unit.phase}`);

  // Region, so a clause can name where a unit is from.
  for (const r of unit.region ?? []) options.add(`${side}:region:${r}`);

  // A resolved summon-time variant (`rules/summon-variant.mjs`) — Semiramis's
  // 'Double Summon: Caster' passives are gated on `self:variant:dsc`.
  if (unit.variant) options.add(`${side}:variant:${unit.variant}`);

  // The stance (Ch. 45). This one option is what makes the rest of
  // Achilles's sheet ordinary: every *"while Mounted"* clause on it — Riding's
  // Attack and Passenger Seat, Troias Tragōidia and its Master upkeep — and
  // every *"when Unmounted"* clause — Dromeus Komētēs, Runner Comet, the duel,
  // Akhilleus Kosmos, the Heel itself — is one predicate rather than a special
  // case in whatever code happens to be asking.
  const stance = stanceOf(unit);
  if (stance) options.add(`${side}:stance:${stance}`);
  // Mounted at any point of this Turn, for the toll that a mid-Turn Dismount
  // does not refund (#184).
  if (stance && mountedThisTurn(unit)) options.add(`${side}:stance:mountedThisTurn`);

  // Which bounded fields the unit is standing in. `annotateFields` has written
  // `u.fields` since Ch. 28 was implemented and nothing ever read it back into
  // a predicate, so "while Unlimited Blade Works is Active" -- which both of
  // EMIYA's Circuits turn on -- had no way to be written.
  for (const f of unit.fields ?? []) options.add(`${side}:inField:${f}`);
  // A field this unit OWNS being open, wherever the unit is standing. Medusa's
  // Blood Temple reduces her NP cooldown by more *"if Blood Fort Andromeda is
  // Active"* -- a question about the area existing, not about her position,
  // and `inField` cannot answer it.
  for (const f of unit.ownedFields ?? []) options.add(`${side}:fieldActive:${f}`);

  // Acted this Turn, or one of its summons did. Raikou's Tenmōkaikai charges
  // her Master 25 *per Turn* rather than per copy, and one handler on her
  // gated on this is what makes that so -- see `annotateSummonsActed`.
  if (unit.selfOrSummonsActed) options.add(`${side}:selfOrSummonsActed`);

  // A Noble Phantasm of this unit's is on its Cooldown. Golden Rule's fallback
  // turns on it: *"If none of his NP are on Cooldown, reduce the Turn count of
  // Enki by 1 Turn"* (#232 reading 14). An NP spent for the game is not on
  // a Cooldown: it has none to run.
  if ((unit.abilities ?? []).some((a) => (a.isNP || a.categorizedAsNP) && (a.cooldownRemaining ?? 0) > 0)) {
    options.add(`${side}:npOnCooldown`);
  }

  // The LAST summon of its summoner's group still standing. Raikou's copies:
  // the one that dies last is what ends Tenmōkaikai and starts its cooldown,
  // and it has to know that about itself because the handler fires from the
  // unit that died. Annotated by `snapshotBoard`, like ZON and the auras,
  // because it is a fact about everybody else's existence.
  if (unit.lastOfSummonGroup) options.add(`${side}:lastOfSummonGroup`);

  // How close this Servant stands to its OWN Master. Distinct from
  // `withinOfOwnerMaster` below, which measures to the Master of whoever owns
  // the FIELD the unit is standing in and is absent on open ground.
  //
  // Raikou's Mad Enhancement is the first clause to ask: *"when Raikou's
  // Master is within a 2 panel area of herself, her Mad Enhancement is
  // constantly Active and cannot be deactivated."*
  //
  // A LADDER, like `attack:range:gte`, and capped at 6 for the same reason
  // the neighbour below is: a predicate can only test set membership, so
  // "within 3" has to already be a member for a Master standing 2 away.
  if (typeof unit.masterDistance === "number") {
    for (let n = Math.max(1, unit.masterDistance); n <= 6; n++) {
      options.add(`${side}:withinOfMaster:${n}`);
    }
  }

  // How close this unit stands to the other member of its linked group.
  //
  // Two clauses ask, and both are the Dioscuri's: Mad Enhancement's *"If
  // Castor is directly next to Pollux ... his Master's Health lost ... are
  // halved"* and Magic Resistance's *"When Castor is directly next to Pollux,
  // Castor also receives the effect of this Skill."*
  //
  // A LADDER, exactly like `withinOfMaster` above, so adjacency is `:1` and
  // needs no special case of its own. `null` emits nothing at all, which is
  // the right answer for a twin standing alone: `:1` is false and its negation
  // is true, and both are correct.
  //
  // Distinct from the `counterpartAdjacent` REQUIREMENT kind, which gates
  // whether an ability may be used at all; this modifies a rule already in
  // force.
  // An Item's bond to whoever placed it (`rules/bonds.mjs`, Avalon #230): the
  // holder is her Master, she is defeated, or she stands within N, as a ladder.
  for (const b of unit.bonds ?? []) {
    if (b.own) options.add(`${side}:bond:${b.contentId}:own`);
    if (b.defeated) options.add(`${side}:bond:${b.contentId}:defeated`);
    if (typeof b.distance === "number") {
      for (let n = Math.max(0, b.distance); n <= 30; n++) options.add(`${side}:bondWithin:${b.contentId}:${n}`);
    }
  }
  if (typeof unit.partnerDistance === "number") {
    for (let n = Math.max(1, unit.partnerDistance); n <= 6; n++) {
      options.add(`${side}:withinOfPartner:${n}`);
    }
  }

  // How close this unit is standing to the MASTER of whoever owns the field it
  // is in. Contagion under Doomsday: *"if the enemy Unit is within a 3 panel
  // area of Pale Rider's Master, Health is reduced by 150 instead of 100"* --
  // a distance to a third party neither side of the clause is, which is why
  // `annotateFields` stamps `ownerMasterPanel` rather than this reaching for
  // the board.
  //
  // A LADDER, like `attack:range:gte`: a unit 2 panels away is also "within 3".
  // Capped at 6 because a bounded field's own leash is shorter than that and an
  // unbounded loop over board size would emit noise.
  if (unit.panel && unit.ownerMasterPanel) {
    const d = chebyshev(unit.panel, unit.ownerMasterPanel);
    for (let n = Math.max(1, d); n <= 6; n++) options.add(`${side}:withinOfOwnerMaster:${n}`);
  }

  // Which PLATFORM the unit is aboard (Ch. 27) -- distinct from a bounded
  // field. `annotatePlatforms` sets `u.platformContentId` to the platform's
  // STABLE content id (never its random Foundry document id, which content
  // cannot predicate on) -- Semiramis's Territory Creation needs to tell "on
  // the Hanging Gardens" apart from "in the ground Home Base" to give the two
  // different Ranks.
  if (unit.platformContentId) options.add(`${side}:onPlatform:${unit.platformContentId}`);

  // WHICH TERRAIN the unit is standing in (Ch. 26). `annotateTerrain` has
  // written `u.terrain` onto every unit in the snapshot since terrain shipped
  // and NOTHING has ever read it -- so a clause like Nemo's *"when Nemo is
  // within a 'Waterside' or 'Imaginary Numbers Space' area"*, which gates four
  // of his clauses, could not be written at all in 35 facets.
  //
  // Overlapping areas each emit, because `terrainAt` returns all of them and a
  // unit standing in two is in both.
  for (const type of unit.terrain ?? []) options.add(`${side}:terrain:${type}`);

  // A Servant with no Master. Ch. 32's state, and the one this system already
  // charges differently for (`rules/costs.mjs`'s `freeServantNPSustainability
  // Cost`) — but the cost path asked the question privately, so no clause could
  // be WRITTEN against it. Jack the Ripper's Sustainability grows by 1◈ for
  // every Human she kills "when she is a Free Servant", which is the first
  // clause in the corpus that needs to say it.
  if (unit.contract === "free" || unit.contract === "unbound") options.add(`${side}:free`);

  // The rank of the Master this unit answers to -- or its own, if it IS one.
  // Jack's Mist exempts a High Rank Master from its contact Poison, which is
  // the first clause in the corpus to ask.
  if (unit.masterTier) options.add(`${side}:masterTier:${unit.masterTier}`);

  // Standing in its OWN Home Base. Medea's Territory Creation predicates on it
  // from both directions -- her own damage dealt, and an ally's damage taken --
  // which is why it is emitted for `self` and `target` alike.
  if (unit.inHomeBase) options.add(`${side}:inHomeBase`);

  // An empty pool. Emitted only for pools the unit actually HAS, so that a
  // clause about somebody else's resource is false rather than vacuously true
  // -- "Drake has no Galleon Tokens" must not be satisfied by a Servant who
  // has no Galleon Tokens because she is not Drake.
  for (const [name, pool] of Object.entries(unit.resources ?? {})) {
    const held = typeof pool === "number" ? pool : (pool?.value ?? 0);
    if (held <= 0) options.add(`${side}:resourceEmpty:${name}`);
  }

  // Rank COMPARISONS, emitted as one option per grade the unit clears.
  //
  // Medea's Atlas is "reduced by 25% on Units with a MAG Rank of B or higher",
  // and an equality option (`rank:mag:A`) cannot express that -- a rule written
  // for B would miss every A. Emitting the whole ladder below the unit's rank
  // turns a comparison into a set membership, which is all a predicate can do.
  for (const [parameter, raw] of Object.entries(unit.parameters ?? {})) {
    for (const grade of gradesClearedBy(raw)) {
      options.add(`${side}:rank:${parameter}:gte:${grade}`);
    }
  }

  // WHICH Parameter is highest, which is the whole of Innocent World: six
  // clauses, one per Parameter, applied *"depending on which of the Unit's
  // Parameters are highest"*.
  //
  // One option per Parameter TIED for the top, because *"if the Unit has two
  // or more Parameters of the same Rank, it is affected by all related
  // effects"* — set membership, not a tie-break. An unranked Parameter is
  // skipped rather than treated as lowest: a Unit that has no MAG has not got
  // a low MAG, and the question does not apply to it.
  const ranked = Object.entries(unit.parameters ?? {})
    .map(([p, raw]) => [p, parseRank(raw)])
    .filter(([, rank]) => rank);

  if (ranked.length > 0) {
    const best = ranked.reduce((top, [, rank]) => (top === null || Rank.compare(rank, top) > 0 ? rank : top), null);
    for (const [p, rank] of ranked) {
      if (Rank.compare(rank, best) === 0) options.add(`${side}:highestParameter:${p}`);
    }

    // Clause 6: *"if the Unit has any NP whose Rank is HIGHER than all its
    // Parameters"*. Higher, not equal — an A-rank NP on a Servant with an
    // A-rank Parameter does not qualify.
    const outranks = (unit.abilities ?? []).some((a) => {
      if (!a?.isNP) return false;
      const rank = parseRank(a.rank);
      return rank && Rank.compare(rank, best) > 0;
    });
    if (outranks) options.add(`${side}:npAboveAllParameters`);
  } else if (unit.id) {
    // *"If a Unit has no Parameters, roll a six-sided die and apply the effect
    // corresponding to the number rolled; that Unit will receive the SAME
    // effect every time it is affected by Innocent World."*
    //
    // A hash of the unit's id folded to 1–6 rather than a roll that has to be
    // remembered: random-looking, identical on every read, survives a reload,
    // needs no stored state, and cannot drift between two clients computing
    // the same board. Masters are the case — none of them has Parameters.
    //
    // This satisfies the clause's intent rather than its letter: no die is
    // ever rolled, so a GM cannot reroll one. Recorded in the spec (§9).
    options.add(`${side}:stableDie:d6:${stableDie(unit.id, 6)}`);
  }

  for (const ability of unit.abilities ?? []) {
    const slug = ability.slug ?? ability.id;
    if (!slug) continue;
    options.add(`${side}:skill:${slug}`);
    // The rank of a SKILL, for Atlas's second reduction -- and the two stack,
    // so each has to be expressible on its own.
    for (const grade of gradesClearedBy(ability.rank)) {
      options.add(`${side}:skillRank:${slug}:gte:${grade}`);
    }
    // Held and *switched on* are different questions. Penthesilea's Charisma is
    // "negated and cannot be used when Mad Enhancement is activated" — an
    // ability disabled by its owner's other ability, which needs the second.
    if (ability.active) options.add(`${side}:skillActive:${slug}`);
    // ...and *held* on is a third question again: switched on AND unable to be
    // switched off, which is what Penthesilea's and Raikou's Master-health
    // floors are conditioned on (Ch. 46 §46.4-C).
    //
    // `withoutModeHeld` breaks a real cycle rather than guarding a theoretical
    // one: `heldOn` asks `forcedOn`, which tests a `ForceMode` rule's `when`
    // against a fresh option set, which would arrive back here and ask again.
    // Measured: `RangeError: Maximum call stack size exceeded` for any unit
    // carrying a `ForceMode` rule on a mode that is on -- which is Raikou,
    // every Turn her Master stands beside her.
    //
    // Skipping it costs nothing: a `ForceMode`'s condition is about the board
    // (*"when Raikou's Master is within a 2 panel area"*), never about whether
    // the mode it governs is already held.
    if (!withoutModeHeld && ability.active && heldOn(slug, unit)) {
      options.add(`${side}:modeHeld:${slug}`);
    }
    // ...and LOCKED on: inside its two-way lockout, it cannot be switched off
    // either (#190 reading 12).
    if (ability.active && ability.locked) options.add(`${side}:modeLocked:${slug}`);
  }

  // A Skill that COUNTS AS another is that Skill to every predicate that asks.
  // Goddess's Divine Core is `categorizedAs: [divinity]`, and Kingprotea's header
  // says it is a Divinity "for every clause in the game that asks" -- including
  // Vasavi Shakti's `target:skill:divinity`, which read the slug and called every
  // Divine Core holder "Divine, no Divinity" (#125). Read through the one
  // reader `hasCategory` and `categoryRankOf` share. A Skill whose slug IS its
  // tag (the class skill `divinity`) emits the same strings twice into a set.
  for (const [tag, rank] of categoriesOf(unit)) {
    options.add(`${side}:skill:${tag}`);
    for (const grade of gradesClearedBy(rank)) {
      options.add(`${side}:skillRank:${tag}:gte:${grade}`);
    }
  }
}

/**
 * Every grade a rank is at or above.
 *
 * `B+` clears `B`, which is the reading "Rank B or higher" needs -- a `+` step
 * is above its grade, not beside it.
 *
 * @param {string|null} raw
 * @returns {string[]}
 */
function gradesClearedBy(raw) {
  let rank = null;
  try {
    // `parseOrNull` handles the *unranked marker* and rethrows on anything
    // else, which is right at build time and wrong here: this pass runs over
    // whatever a live document holds, and one malformed rank must not take the
    // whole board snapshot down with it. The content validator is where a bad
    // rank is supposed to be loud.
    rank = Rank.parseOrNull(raw);
  } catch {
    return [];
  }
  if (!rank) return [];
  // Read at the LETTER: "a Rank of B or higher" is met by B−, B and B+ alike
  // (#193 reading 11, for Atlas; the same words mean the same everywhere).
  // Comparing the whole rank put B− below B, so a MAG B− Servant escaped
  // Atlas's −25.
  return GRADE_LADDER.filter((grade) => Rank.gte(Rank.of(rank.grade), Rank.of(grade)));
}

/** The grades a comparison may name, weakest first. */
const GRADE_LADDER = Object.freeze(["E", "D", "C", "B", "A", "EX"]);

/**
 * Every option shape this file can emit.
 *
 * **Generated**, not declared. `rules/facets.mjs` describes each facet once —
 * its subjects, its segments and where each value comes from — and the
 * patterns are derived. Before, this was 37 hand-written regexes beside a
 * vocabulary that did not exist, so nothing could offer a GM a picker and
 * nothing could say what `self:phase:tuesday` was wrong about.
 *
 * The swap is proved behaviour-neutral by `test/unit/facets.test.mjs`, which
 * holds the generated set against a captured fixture of the regexes it
 * replaces and against every option the shipped corpus names.
 */
const EMITTABLE = GENERATED_EMITTABLE;

/**
 * Could this option ever be in the set?
 *
 * @param {string} option a bare option, with any `not:` prefix already stripped
 * @returns {boolean}
 */
export function isEmittableOption(option) {
  return EMITTABLE.some((pattern) => pattern.test(option));
}

/**
 * A stable die face for an id.
 *
 * FNV-1a, folded onto `1..faces`. Innocent World needs *"the same effect every
 * time"* for a Unit with no Parameters, and a hash gives that for free: no
 * stored roll to lose, nothing to reload, and two clients computing the same
 * board agree without talking to each other.
 *
 * @param {string} id
 * @param {number} faces
 * @returns {number} `1..faces`
 */
function stableDie(id, faces) {
  let h = 0x811c9dc5;
  for (const ch of String(id)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % faces) + 1;
}
