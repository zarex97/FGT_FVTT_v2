/**
 * @file Roll options — the vocabulary every predicate is written against.
 * @see docs/24-rules-engine.md §24.4
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
import { chebyshev } from "../domain/geometry.mjs";

/**
 * Every option describing this attacker, this defender and this attack.
 *
 * @param {object} args
 * @param {object} args.attacker the attacker's snapshot
 * @param {object} args.defender the defender's snapshot
 * @param {object} [args.attack] `{kind, isAoE, component, range, aim, pierce}`
 * @returns {Set<string>}
 */
export function rollOptionsFor({ attacker, defender, attack = {} }) {
  /** @type {Set<string>} */
  const options = new Set();

  add(options, "self", attacker);
  add(options, "target", defender);
  compareParameters(options, attacker, defender);

  options.add(`attack:kind:${attack.kind ?? "normal"}`);
  if (attack.isAoE) options.add("attack:isAoE");

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
 * @returns {void}
 */
function add(options, side, unit) {
  if (!unit) return;

  if (unit.kind) options.add(`${side}:type:${unit.kind}`);

  // WHICH Servant this is, by the one name of theirs that a world cannot rename.
  //
  // §36.1's DECISION -- *"cross-Servant references resolve by a stable slug"* --
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

  // Region, so a clause can name where a unit is from.
  for (const r of unit.region ?? []) options.add(`${side}:region:${r}`);

  // A resolved summon-time variant (`rules/summon-variant.mjs`) — Semiramis's
  // 'Double Summon: Caster' passives are gated on `self:variant:dsc`.
  if (unit.variant) options.add(`${side}:variant:${unit.variant}`);

  // Which bounded fields the unit is standing in. `annotateFields` has written
  // `u.fields` since Ch. 43 was implemented and nothing ever read it back into
  // a predicate, so "while Unlimited Blade Works is Active" -- which both of
  // EMIYA's Circuits turn on -- had no way to be written.
  for (const f of unit.fields ?? []) options.add(`${side}:inField:${f}`);

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

  // Which PLATFORM the unit is aboard (Ch. 20) -- distinct from a bounded
  // field. `annotatePlatforms` sets `u.platformContentId` to the platform's
  // STABLE content id (never its random Foundry document id, which content
  // cannot predicate on) -- Semiramis's Territory Creation needs to tell "on
  // the Hanging Gardens" apart from "in the ground Home Base" to give the two
  // different Ranks.
  if (unit.platformContentId) options.add(`${side}:onPlatform:${unit.platformContentId}`);

  // A Servant with no Master. §16.6's state, and the one this system already
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
  return GRADE_LADDER.filter((grade) => Rank.gte(rank, Rank.of(grade)));
}

/** The grades a comparison may name, weakest first. */
const GRADE_LADDER = Object.freeze(["E", "D", "C", "B", "A", "EX"]);

/**
 * Every shape `rollOptionsFor` can produce.
 *
 * A predicate is a set-membership test, so an option nobody emits is a clause
 * that is false for ever — it authors cleanly, compiles cleanly, loads cleanly
 * and never fires. Two shipped effects were written against
 * `self:attack:normal`, which is not a string this file has ever produced;
 * `N.Atk Up` therefore raised no Normal Attack's damage and `Bleed Atk` was
 * inert. Held against the content by `test/unit/options.test.mjs`.
 *
 * Patterns rather than a literal set, because most of the vocabulary is
 * open-ended: any effect id, any region, any skill slug.
 */
const EMITTABLE = Object.freeze([
  /^(self|target):type:[A-Za-z][\w-]*$/,
  /^(self|target):contentId:[A-Za-z][\w-]*$/,
  /^(self|target):attribute:[A-Za-z][\w-]*$/,
  /^(self|target):effect:[A-Za-z][\w-]*$/,
  /^(self|target):region:[A-Za-z][\w-]*$/,
  /^(self|target):variant:[A-Za-z][\w-]*$/,
  /^(self|target):inHomeBase$/,
  /^(self|target):free$/,
  /^(self|target):masterTier:(high|low|rankless)$/,
  /^(self|target):inField:[A-Za-z][\w-]*$/,
  /^(self|target):withinOfOwnerMaster:[1-6]$/,
  /^(self|target):onPlatform:[A-Za-z][\w-]*$/,
  /^(self|target):rank:[A-Za-z]+:gte:(E|D|C|B|A|EX)$/,
  /^target:paramVsSelf:[A-Za-z]+:(gt|eq|lt)$/,
  /^(self|target):skill:[A-Za-z][\w-]*$/,
  /^(self|target):skillRank:[A-Za-z][\w-]*:gte:(E|D|C|B|A|EX)$/,
  /^(self|target):skillActive:[A-Za-z][\w-]*$/,
  /^attack:kind:[A-Za-z][\w-]*$/,
  /^attack:isAoE$/,
  /^attack:component:(str|mag)$/,
  /^attack:element:[A-Za-z][\w-]*$/,
  /^attack:ignoresMagicResistance$/,
  /^attack:aim$/,
  /^attack:pierce$/,
  /^attack:thrownWeapon$/,
  /^attack:crit$/,
  /^attack:range:\d+$/,
  /^attack:range:(gte|lte):\d+$/,
]);

/**
 * Could this option ever be in the set?
 *
 * @param {string} option a bare option, with any `not:` prefix already stripped
 * @returns {boolean}
 */
export function isEmittableOption(option) {
  return EMITTABLE.some((pattern) => pattern.test(option));
}
