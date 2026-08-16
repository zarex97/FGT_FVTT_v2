/**
 * @file Copying an ability — Wisdom of Dún Scáith.
 * @see docs/15-abilities.md §15.7
 *
 * Layer 2 (rules). Pure.
 *
 * §15.7 calls this the hardest ability in the reference set to model, and the
 * reason is that it is not one rule but two: *which* abilities may be copied,
 * and *what a copy is*. Both are here, because separating them is how a copy
 * ends up with the source's rank or the source's cooldown.
 *
 * A copy holds `copiedFrom` and **no phases of its own**. Copying by reference
 * means a later content fix to the source propagates; copying by value would
 * freeze a bug into every Scáthach who ever took it.
 */

import { Rank } from "../domain/rank.mjs";
import { grantedAbility } from "./granted.mjs";

/**
 * Every reason a copy can be refused.
 *
 * `physical` and `unique` come from the content — the exclusion list is
 * per-ability data, not a name list here, because "Skills a Servant is
 * physically born with" is a judgement the author makes and the engine cannot.
 */
export const COPY_REFUSALS = Object.freeze([
  "classSkill", "rankEX", "physical", "unique", "notActive", "notASkill",
]);

/**
 * May this ability be copied?
 *
 * @param {object} ability
 * @returns {{ok: boolean, reason?: string}}
 */
export function canCopy(ability) {
  // A Noble Phantasm is not a Skill. The grant asks for Skills, and copying an
  // NP would hand over the most consequential thing a Servant owns.
  if (ability?.isNP) return { ok: false, reason: "notASkill" };

  // "excluding Class Skills" — in the grant itself rather than in the longer
  // exclusion list below, which is exactly how it gets lost.
  if (ability?.kind === "classSkill") return { ok: false, reason: "classSkill" };

  const rank = Rank.parseOrNull(ability?.rank);
  if (rank?.grade === "EX") return { ok: false, reason: "rankEX" };

  // "must have an Active effect": a passive has nothing to use as an effect of
  // this Skill.
  if (ability?.passive || (ability?.phases ?? []).length === 0) {
    return { ok: false, reason: "notActive" };
  }

  const copyable = ability?.copyable;
  if (copyable && copyable.allowed === false) {
    return { ok: false, reason: copyable.reason ?? "unique" };
  }

  return { ok: true };
}

/**
 * Everything on the field this unit could copy.
 *
 * The rank preference is a **preference**, not a filter: *"preferably Rank B to
 * Rank A"*. Filtering on it would leave a war whose Servants happen to sit
 * outside that band with nothing to offer, and the text does not say that.
 *
 * @param {object} board
 * @param {object} copier
 * @param {object} [options]
 * @param {string[]} [options.prefer] grades to mark as preferred
 * @returns {Array<{unitId: string, unitName: string, ability: object, preferred: boolean}>}
 */
export function copyCandidates(board, copier, { prefer = [] } = {}) {
  /** @type {Array<{unitId: string, unitName: string, ability: object, preferred: boolean}>} */
  const out = [];

  for (const unit of board?.units ?? []) {
    // "of all OTHER Servants on the field".
    if (unit.id === copier?.id) continue;

    for (const ability of unit.abilities ?? []) {
      if (!canCopy(ability).ok) continue;
      out.push({
        unitId: unit.id,
        unitName: unit.name,
        ability,
        preferred: prefer.includes(Rank.parseOrNull(ability.rank)?.grade ?? ""),
      });
    }
  }
  return out;
}

/**
 * The granted ability a copy produces.
 *
 * Rank and cooldown are the **copier's**: Scáthach uses the copied effects *"as
 * effects of this Skill"*, so her A+ and her `4◈−⅓◈` govern. Taking the
 * source's would let a copy outrank and outpace the original, which is the
 * opposite of what a copy is.
 *
 * @param {object} source
 * @param {object} copier
 * @param {object} options
 * @param {string} options.rank the copier's own rank
 * @param {string} [options.cooldown] the copier's own cooldown
 * @param {string} [options.grantedBy] the ability doing the copying
 * @param {string} [options.exclusionSet] the mutual-exclusion set every copy shares
 * @returns {object|null} null when the source may not be copied
 */
export function copyAbility(source, copier, { rank, cooldown = null, grantedBy = null, exclusionSet = null }) {
  if (!canCopy(source).ok) return null;

  return grantedAbility({
    // Named for its source, so the card says what was copied rather than
    // showing an unattributed effect nobody can trace.
    name: `${source.name} (copied)`,
    // By reference. No `phases` — the executor resolves `copiedFrom`, so a
    // content fix to the source reaches every copy of it.
    copiedFrom: source.id,
    rank,
    cooldown,
    exclusionSet,
    unitId: copier?.id ?? null,
    grantedBy,
  });
}

/**
 * The phases an ability actually runs.
 *
 * A copy has none of its own; it has `copiedFrom`. Every phase reader goes
 * through here rather than reading `.phases` directly, because a reader that
 * forgets makes the copy load correctly and do nothing — the exact defect this
 * codebase keeps producing.
 *
 * @param {object} ability
 * @param {(id: string) => object|null} resolveSource
 * @returns {object[]}
 */
export function effectivePhases(ability, resolveSource) {
  if (!ability?.copiedFrom) return ability?.phases ?? [];

  const source = resolveSource?.(ability.copiedFrom) ?? null;
  if (!source) {
    // Loud in the caller's log rather than silent here: a copy whose source
    // was deleted does nothing, and nothing on the sheet would say so.
    return [];
  }
  return source.phases ?? source.system?.phases ?? [];
}
