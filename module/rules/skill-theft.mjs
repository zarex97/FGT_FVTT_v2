/**
 * @file Insect Eater's chance, and what a Unit's Skills may be taken.
 * @see docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md readings 20-28, 46
 *
 * Layer 2 (rules). Pure.
 *
 * *"she has a 15% chance of 'stealing' one of the DU's Skills… The chance of this
 * Skill triggering is affected by the following-"*: a closed list of terms, summed
 * in points and clamped last (reading 24). It is no debuff, so no Debuff Resist or
 * Immune and no Magic Resistance's Passive 2 has a say: term 4 is Magic Resistance's
 * only one.
 */

import { Rank } from "../domain/rank.mjs";
import { isSpellAbility } from "./costs.mjs";

/** E 1 to A 5, EX 6, as Paris prints *"Rank D=2 Ranks"*; plus and minus are ignored. */
const RANK_COUNT = Object.freeze({ E: 1, D: 2, C: 3, B: 4, A: 5, EX: 6 });

/**
 * How many Ranks a Rank counts as.
 *
 * @param {string|null|undefined} rank
 * @returns {number} 0 for none
 */
export function ranksIn(rank) {
  return RANK_COUNT[Rank.parseOrNull(rank)?.grade] ?? 0;
}

/**
 * The terms of a chance, each with its figure, the zeroes left out.
 *
 * @param {object} spec the ability's `stealsSkills`
 * @param {object} ctx
 * @param {ReadonlySet<string>} ctx.options this Attack's options
 * @param {(id: string) => number} ctx.magnitudeOf the thief's summed magnitude of an effect
 * @param {(slug: string) => string|null} ctx.rankOnTarget the DU's Rank in a Skill, in force
 * @returns {Array<{label: string, value: number}>}
 */
export function theftTerms(spec, { options = new Set(), magnitudeOf = () => 0, rankOnTarget = () => null } = {}) {
  /** @type {Array<{label: string, value: number}>} */
  const out = [];
  for (const term of spec?.terms ?? []) {
    let value = 0;
    if (term.effect) value = (term.sign ?? 1) * Number(magnitudeOf(term.effect) ?? 0);
    else if (term.perRank) value = Number(term.value ?? 0) * ranksIn(rankOnTarget(term.perRank));
    else if ((term.anyOf ?? []).some((o) => options.has(o))) value = Number(term.value ?? 0);
    if (value !== 0) out.push({ label: term.label ?? "", value });
  }
  return out;
}

/**
 * The chance, summed and clamped last: Arturia with Pixie's Debuff ChUp is
 * 15 + 30 - 25 = 20, never 15 + 30 with the -25 floored away.
 *
 * @param {object} spec the ability's `stealsSkills`
 * @param {Array<{value: number}>} terms
 * @returns {number} 0 to 100
 */
export function theftChance(spec, terms) {
  const total = Number(spec?.base ?? 0) + (terms ?? []).reduce((sum, t) => sum + t.value, 0);
  return Math.max(0, Math.min(100, total));
}

/**
 * Is this ability one a Unit's Skills list offers? A Noble Phantasm and a Spell are
 * not Skills, as for a copy (`rules/copy.mjs`). A Skill already taken is not there
 * to take, and a thing that is no Skill says so with `notASkill`.
 *
 * @param {object} item an ability Item
 * @param {{classSkills?: boolean}} [opts] Sakura Eater's *"non-Class"* leaves them out
 * @returns {boolean}
 */
export function isTakeableSkill(item, { classSkills = true } = {}) {
  const sys = item?.system ?? {};
  if (item?.type === "noblePhantasm" || sys.isNP || sys.categorizedAsNP) return false;
  if (item?.type !== "ability") return false;
  if (sys.notASkill || sys.stolenBy) return false;
  if (isSpellAbility(sys)) return false;
  return classSkills || sys.kind !== "classSkill";
}

/**
 * Which of two same-named passives stands down (reading 46): she holds both, they
 * do not add, the higher Rank governs, and her own wins a tie.
 *
 * @param {object} item an ability Item
 * @param {object[]} items everything its bearer holds
 * @returns {boolean} true when another of its name outranks this one
 */
export function outrankedByTwin(item, items) {
  const slug = item?.system?.slug;
  if (!slug) return false;
  const twins = [...(items ?? [])].filter((i) => i !== item && i.id !== item.id
    && i.system?.slug === slug && !i.system?.stolenBy);
  if (twins.length === 0) return false;
  const mine = ranksIn(item.system?.rank);
  return twins.some((t) => {
    const theirs = ranksIn(t.system?.rank);
    if (theirs !== mine) return theirs > mine;
    return Boolean(item.system?.stolenFrom) && !t.system?.stolenFrom;
  });
}
