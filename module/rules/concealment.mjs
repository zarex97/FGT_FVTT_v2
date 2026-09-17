/**
 * @file Presence Concealment — the eight clauses, as answerable questions.
 * @see docs/A-effect-catalogue.md §A.19, docs/45-case-studies.md
 *
 * Layer 2 (rules). Pure.
 *
 * Presence Concealment is the widest single ability in the reference set: one
 * class skill that touches targeting, the reaction ladder, the damage
 * pipeline, movement legality, Master protection and what a player is even
 * allowed to press. Every one of those readers existed already. What did not
 * exist was anything that made a Unit **concealed** — `system.concealed` was
 * projected by the snapshot, consulted by four subsystems, and written by
 * nothing and declared by no schema, so all four asked a question whose answer
 * was always `false`.
 *
 * The state now rides the `presenceConcealment` **effect** rather than a
 * boolean, which is what clause 8 asks for anyway: *"the effects of Presence
 * Concealment are neither a buff or a debuff, and are Unremovable"* — a
 * `status` polarity with `unremovable: true` says exactly that, and it gives
 * the duration ("lasts for 2◈ Turns") somewhere to live.
 *
 * This file answers the clauses that are decisions. The clauses that are
 * numbers — the +4 to a defender's Evade, the discovery percentage, the
 * cooldown — are rank tables (`presenceConcealmentEvade`, `…Discover`,
 * `…Cooldown`), and the clauses that are damage are ordinary rule elements on
 * the skill itself.
 */

import { Rank } from "../domain/rank.mjs";
import { alliancesOf, factionForUser } from "./factions.mjs";

/** The effect id that *is* the state. */
export const CONCEALMENT = "presenceConcealment";

/** The skill slug, for cooldowns and for `self:skillActive:` options. */
export const CONCEALMENT_SLUG = "presenceConcealment";

/**
 * Is this Unit concealed right now?
 *
 * @param {object} unit a unit snapshot
 * @returns {boolean}
 */
export function isConcealed(unit) {
  return (unit?.effects ?? []).includes(CONCEALMENT);
}

/**
 * Is this Unit's token hidden from the viewer looking at the canvas?
 *
 * > *"This Unit cannot be targeted for an Attack or an enemy Unit's Skill."*
 *
 * The rule half of that clause has worked since Presence Concealment was
 * authored -- an adjacent, in-range attacker is refused by name. What nothing
 * ever did was hide the **token**: a concealed Servant sat on the canvas in
 * plain sight of every player, who could read its panel, its facing and its
 * Health bar, and route around a Skill they could see perfectly well was there.
 * Concealment that the table can see through is a rules footnote rather than a
 * Skill (Ch. 46 §46.4-AK).
 *
 * The reading is the one every tabletop invisibility uses: hidden from
 * non-allies, and from nobody else.
 *
 *  - The **GM** always sees. A token hidden from the one person who has to move
 *    it is a lost token, and every other system draws the line here.
 *  - An **owner** always sees. This is how a player finds their own Assassin.
 *  - The Unit's **own faction and its declared allies** always see. Your side
 *    knows where it put the thing; what it buys is that the enemy does not.
 *
 * Pure, and given its inputs rather than reaching for `game`: the canvas asks
 * this once per token per visibility pass, and a layer-2 predicate is what lets
 * it be tested without a world.
 *
 * @param {object|null} unit `{factionId, effects}` -- the actor's own system data
 * @param {{userId: string, isGM: boolean, isOwner: boolean}} viewer
 * @param {object[]} factions the normalized faction roster
 * @returns {boolean}
 */
export function hiddenFromViewer(unit, viewer, factions) {
  if (!unit) return false;
  if (viewer?.isGM || viewer?.isOwner) return false;
  if (!(unit.effects ?? []).includes(CONCEALMENT)) return false;

  const mine = factionForUser(factions ?? [], viewer?.userId);
  if (!mine) return true;

  const allied = alliancesOf(factions ?? [])[mine.id] ?? [mine.id];
  return !allied.includes(unit.factionId);
}

/**
 * Reactions the defender may not declare against a concealed attacker.
 *
 * > *"This Unit's Attacks cannot be Blocked or Countered unless the DU's
 * > current AGI Rank is equal to or higher than it."*
 *
 * **AGI Rank**, not the Agility pool. The engine compared `attacker.agility >
 * defender.agility`, which are the *spendable* Agility resources — two Servants
 * of identical AGI Rank disagree about them constantly, and a Servant who had
 * spent Agility on Evades became blockable mid-match for no stated reason.
 *
 * "Equal to or higher" is the escape, so the refusal needs strictly greater.
 *
 * @param {object} attacker
 * @param {object} defender
 * @returns {string[]} reaction ids to forbid — `[]` when nothing is refused
 */
export function reactionsRefused(attacker, defender) {
  if (!isConcealed(attacker)) return [];
  if (rankOf(defender, "agi") !== null && Rank.gte(rankOf(defender, "agi"), rankOf(attacker, "agi"), false)) {
    return [];
  }
  // An attacker with no AGI Rank at all conceals nothing: the comparison has no
  // answer, and the safe direction is to leave the defender its reactions.
  if (rankOf(attacker, "agi") === null) return [];
  return ["block", "counter"];
}

/**
 * Reactions refused against an attack that lands before the ladder opens.
 *
 * Kiritsugu's Lethal Gunfire Suppression: *"…which cannot be Reacted to unless
 * the AU's AGI Rank is higher than Kiritsugu's."*
 *
 * **One boundary apart from `reactionsRefused` above, and in this file on
 * purpose.** Presence Concealment escapes on *"equal to or higher"* and names
 * two rungs, leaving Evade open at +4; this escapes only on *"higher"* and
 * names the whole ladder, because the sheet says *"cannot be Reacted to"*
 * without qualification. Two copies of rank arithmetic that must differ by
 * exactly one step are how they end up differing by two, so they sit together.
 *
 * `Rank.gte(theirs, ours, false)` plus an inequality rather than a `gt` helper:
 * `Rank` exports `compare`, `gte` and `equals`, and inventing a fourth spelling
 * of the same comparison is how the two above would drift.
 *
 * @param {object} attacker the Unit taking the shot
 * @param {object} defender the Unit being shot at
 * @returns {string[]} reaction ids to forbid — `[]` when nothing is refused
 */
export function reactionRefusedByAgility(attacker, defender) {
  const ours = rankOf(attacker, "agi");
  // A shooter with no AGI Rank refuses nothing: the comparison has no answer,
  // and the safe direction is to leave the defender its ladder — the same
  // ruling `reactionsRefused` makes for the same reason.
  if (ours === null) return [];

  const theirs = rankOf(defender, "agi");
  const strictlyHigher = theirs !== null
    && Rank.gte(theirs, ours, false)
    && !Rank.equals(theirs, ours);
  return strictlyHigher ? [] : ["block", "counter", "evade"];
}

/**
 * @param {object} unit
 * @param {string} parameter
 * @returns {Rank|null}
 */
function rankOf(unit, parameter) {
  const raw = unit?.parameters?.[parameter] ?? null;
  if (raw === null || raw === undefined) return null;
  return raw instanceof Rank ? raw : Rank.parseOrNull(raw);
}

/**
 * What an AoE that caught a concealed Unit actually does to it.
 *
 * > *"If it is caught in an AoE Attack and fails to Evade, Flip a Coin. If
 * > Heads, no damage and effects are received; if Tails, Total Damage taken
 * > from that Attack is reduced by 50% & PC is deactivated."*
 *
 * The one place in the game where a coin decides whether an attack happened at
 * all, and the reason concealment does not simply make a Unit untargetable:
 * targeting drops it from anything *chosen* (Ch. 20), an area still reaches it, and
 * this is the compensation.
 *
 * @param {number} coin `1` or `2` from a `1d2` — 1 is Heads
 * @returns {{heads: boolean, factor: number, deactivates: boolean, effects: boolean}}
 */
export function aoeOutcome(coin) {
  const heads = coin === 1;
  return {
    heads,
    // Heads is a complete negation, so the factor is zero rather than "skip the
    // damage step": a zero travels through the pipeline and shows up in the
    // explainer as a modifier with a cause.
    factor: heads ? 0 : 0.5,
    deactivates: !heads,
    effects: !heads,
  };
}

/**
 * May this ability be used while its owner is concealed?
 *
 * > *"Active Skills targeting/affecting an enemy Unit(s) cannot be used unless
 * > stated. Note: Does not include Attack Skills and Spells that deal damage."*
 *
 * Three escapes, and the sheet states all three. `usableWhileConcealed` is the
 * "unless stated" — Serenity's own *Shapeshift* is the single instance in the
 * reference set, and it pays for the exemption with a 20% chance of ending the
 * concealment.
 *
 * @param {object} item an ability, or any `{system}` shape
 * @param {object} [opts]
 * @param {boolean} [opts.targetsEnemy] whether this use is aimed at an enemy
 * @returns {{ok: boolean, reason?: string}}
 */
export function canUseWhileConcealed(item, { targetsEnemy = null } = {}) {
  const sys = item?.system ?? item ?? {};
  if (sys.usableWhileConcealed) return { ok: true };
  // "Does not include Attack Skills and Spells that deal damage."
  if (sys.isAttackSkill || sys.damage) return { ok: true };
  if (sys.isNP) return { ok: true };

  const aimed = targetsEnemy ?? touchesEnemy(sys.targeting);
  if (!aimed) return { ok: true };
  return { ok: false, reason: "presenceConcealment" };
}

/**
 * Does this targeting spec reach an enemy?
 *
 * `affecting` as well as `targeting`, which is why the relation list is read
 * rather than the `target` shorthand: an ability that names `all` inside a
 * radius affects enemies without ever selecting one.
 *
 * @param {object|null} targeting
 * @returns {boolean}
 */
function touchesEnemy(targeting) {
  if (!targeting) return false;
  // `selection.relations` is where Ch. 20 puts them. Reading `relations` off
  // the top level found nothing on every authored ability in the corpus, so the
  // clause answered "aims at nobody" and refused nothing at all.
  const relations = targeting.selection?.relations
    ?? targeting.relations
    ?? (targeting.target ? [targeting.target] : []);
  if (relations.length === 0) return false;
  return relations.includes("enemy") || relations.includes("any") || relations.includes("all");
}

/**
 * The chance, in percent, that using this ability ends its owner's concealment.
 *
 * Zero for everything but *Shapeshift*, which is the price of its exemption.
 *
 * @param {object} item
 * @returns {number}
 */
export function concealmentBreakChance(item) {
  return (item?.system ?? item ?? {}).concealmentBreakChance ?? 0;
}

/**
 * Every way concealment can end, as a closed vocabulary.
 *
 * Named rather than free text because the reason reaches the chat card, the
 * game log and the disclosure of any Secret Poison the concealed Unit inflicted
 * — three readers that must agree about what happened.
 */
export const DEACTIVATION_REASONS = Object.freeze({
  attacked: "attacked",           // clause 5, at the end of the Combat Process
  discovered: "discovered",       // clause 6, a watcher's Detect roll
  aoe: "aoe",                     // clause 1, the coin came up Tails
  skillUse: "skillUse",           // Shapeshift's 20%
  expired: "expired",             // the 2◈ ran out
  manual: "manual",               // the player switched it off
});
