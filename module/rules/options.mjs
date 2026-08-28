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

  options.add(`attack:kind:${attack.kind ?? "normal"}`);
  if (attack.isAoE) options.add("attack:isAoE");

  // WHICH Base Attack, and whether the attack is one Magic Resistance sees.
  // Magic Resistance's Instakill/Death ladder turns on both: it covers those
  // two tiers *"unless the Instakill or Death debuffs are from an Attack /
  // Attack Skill / Spell / NP that deals STR damage or that is not affected by
  // Magic Resistance"*. Neither was expressible before, so the exemption could
  // not be written at all.
  if (attack.component) options.add(`attack:component:${attack.component}`);
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

  // Which PLATFORM the unit is aboard (Ch. 20) -- distinct from a bounded
  // field. `annotatePlatforms` sets `u.platformContentId` to the platform's
  // STABLE content id (never its random Foundry document id, which content
  // cannot predicate on) -- Semiramis's Territory Creation needs to tell "on
  // the Hanging Gardens" apart from "in the ground Home Base" to give the two
  // different Ranks.
  if (unit.platformContentId) options.add(`${side}:onPlatform:${unit.platformContentId}`);

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
  /^(self|target):attribute:[A-Za-z][\w-]*$/,
  /^(self|target):effect:[A-Za-z][\w-]*$/,
  /^(self|target):region:[A-Za-z][\w-]*$/,
  /^(self|target):variant:[A-Za-z][\w-]*$/,
  /^(self|target):inHomeBase$/,
  /^(self|target):inField:[A-Za-z][\w-]*$/,
  /^(self|target):onPlatform:[A-Za-z][\w-]*$/,
  /^(self|target):rank:[A-Za-z]+:gte:(E|D|C|B|A|EX)$/,
  /^(self|target):skill:[A-Za-z][\w-]*$/,
  /^(self|target):skillRank:[A-Za-z][\w-]*:gte:(E|D|C|B|A|EX)$/,
  /^(self|target):skillActive:[A-Za-z][\w-]*$/,
  /^attack:kind:[A-Za-z][\w-]*$/,
  /^attack:isAoE$/,
  /^attack:component:(str|mag)$/,
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
