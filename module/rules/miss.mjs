/**
 * @file Whether an attack misses before anybody reacts to it.
 * @see docs/A-effect-catalogue.md §A, docs/12-combat-process.md §12.2
 *
 * Layer 2 (rules). **Pure.**
 *
 * `Blind` is the only source in either roster, and its first clause is the
 * reason this module exists: *"80% chance of Missing on attacks and
 * enemy-affecting abilities."*
 *
 * Nothing in the engine could express that. **A Miss is not an Evade**: an
 * Evade is the DEFENDER's roll answering a swing that happened, resolved at
 * Combat Process step 2 with a Luck ladder hanging off it, while a Miss is the
 * swing not happening at all — no reaction, no contest, no Counter. So Blind
 * sat in Appendix A, catalogued and unbuilt, for want of a step.
 *
 * The step is 1.5, between Declaration and Reaction (`engine/combat-process.mjs`).
 */

import { test as testPredicate } from "./predicate.mjs";

/**
 * Effects that can make an attacker miss, and the chance each carries.
 *
 * A map rather than a constant, because the catalogue's other blinding effects
 * (`Pigify`, `Toad`) reduce accuracy by other means and a second entry here is
 * how a future one would arrive.
 */
export const MISS_SOURCES = Object.freeze({ blind: 80 });

/** With Clairvoyance, Blind's miss drops from 80% to 40% (Appendix A clause 4). */
const CLAIRVOYANCE_MISS = 40;

/**
 * Skills whose bearer is exempt from Blind's clauses 1, 2 and 4.
 *
 * Both readings of *"Eye of the Mind"* — EMIYA carries `(True)` and Heracles
 * carries `(False)`, and the catalogue's exemption names neither rank, so both
 * qualify. They are the reason clause 5 is worth building rather than stubbing:
 * both Servants are already authored, so the exemption has live readers.
 */
const EXEMPT_SKILLS = Object.freeze(["eyeOfTheMind", "eyeOfTheMindFalse"]);

/**
 * This attacker's chance of missing outright, 0–100.
 *
 * The ladder is **ordered, not summed**. `Eye of the Mind` exempts its bearer
 * from clauses 1, 2 and 4 together, so it beats Clairvoyance rather than
 * stacking with it: a unit carrying both is not 20%, and not 0%-by-way-of-40%,
 * it is simply exempt.
 *
 * Read off the attacker's ROLL OPTIONS rather than off a bespoke field, so this
 * asks the same questions authored content asks (`self:skill:clairvoyance`)
 * and cannot drift from them.
 *
 * @param {object} attacker the attacker's snapshot
 * @param {ReadonlySet<string>} [options] the attacker's roll options, `self:`-sided
 * @returns {number}
 */
export function missChance(attacker, options = new Set()) {
  const held = attacker?.effects ?? [];
  const source = Object.keys(MISS_SOURCES).find((id) => held.includes(id));
  if (!source) return 0;

  // A suppression that switches the check off outright.
  //
  // Anastasia's *Watermelon Splitting Master*: *"When Anastasia performs a
  // Normal Attack at a Range of 1 to 2 while inflicted with Blind, it does not
  // have a chance of Missing."* A Servant who inflicts Blind on herself to turn
  // it into an offensive buff -- Ch. 44 §44.3 calls the shape "self-harm as a
  // resource", with Van Gogh's Curse economy as the precedent. The difference
  // is that Gogh CONSUMES her debuff and Anastasia REINTERPRETS hers.
  //
  // The SAME `Suppress` element Blind's own clause 3 uses, rather than a second
  // way to switch a rule off. The predicate is evaluated HERE rather than at
  // collection time because it asks about the ATTACK -- `attack:range:lte:2` --
  // and the range is not known when contributions are gathered.
  //
  // Scoped, deliberately: an unscoped version of this would stop every Blinded
  // attacker in the game from ever missing.
  const suppressed = (attacker?.suppressions ?? []).some(
    (sup) => sup.scope === "miss"
      && (!sup.predicate || testPredicate(sup.predicate, { options })),
  );
  if (suppressed) return 0;

  if (EXEMPT_SKILLS.some((slug) => options.has(`self:skillActive:${slug}`))) return 0;
  if (options.has("self:skill:clairvoyance")) return CLAIRVOYANCE_MISS;
  return MISS_SOURCES[source];
}

/**
 * Which effect is causing this attacker to miss, for the card and the log.
 *
 * A swing that vanished with no named cause reads as a bug rather than as a
 * rule, which is the whole reason step 1.5 writes a roll record at all.
 *
 * @param {object} attacker
 * @returns {string|null}
 */
export function missSourceOf(attacker) {
  const held = attacker?.effects ?? [];
  return Object.keys(MISS_SOURCES).find((id) => held.includes(id)) ?? null;
}
