/**
 * @file Effect families — an umbrella name for a set of effects.
 * @see docs/A-effect-catalogue.md, docs/11-effect-engine.md
 *
 * Layer 2 (rules). Pure.
 *
 * `Bind` is not an effect anybody applies. Appendix A defines it as *"umbrella
 * for Stun, Disable, Immobilize, Slow, Petrify, Shock, Webbed, Seal, Freeze,
 * Crystalfreeze"*, and Medusa's Monstrous Snake Metamorphosis pays out against
 * *"Units inflicted with Bind effects"* — the first clause in the corpus that
 * has to ask about the umbrella rather than about a member.
 *
 * Declared **on each member** rather than as a central list, so a binding
 * effect authored tomorrow counts by saying so about itself instead of needing
 * an edit somewhere else. That is also why this file holds no list.
 */

/**
 * The families an effect definition declares.
 * @param {object|null|undefined} def
 * @returns {string[]}
 */
export function familiesOf(def) {
  return Array.isArray(def?.families) ? def.families : [];
}

/**
 * Every family a unit's live effects put it in.
 *
 * A **suppressed** instance does not count: a Stun that is not stunning
 * anybody is not binding them either, which is the same reading
 * `rules/control.mjs#findCharm` takes of a suppressed Charm.
 *
 * `unit` here is the shape the snapshot is being built from, so it takes the
 * active ids directly rather than re-deriving them.
 *
 * @param {string[]} effectIds active, unsuppressed ids
 * @param {{get: (id: string) => object|undefined}} registry
 * @returns {string[]} unique, in first-seen order
 */
export function familiesPresent(effectIds, registry) {
  const out = [];
  for (const id of effectIds ?? []) {
    for (const family of familiesOf(registry?.get?.(id))) {
      if (!out.includes(family)) out.push(family);
    }
  }
  return out;
}

/**
 * Does this unit carry any effect of the named family?
 *
 * Reads the projected `effectFamilies` when there is one — the snapshot
 * computes it once, and every consumer downstream is entitled to the answer
 * without a registry in hand.
 *
 * @param {object} unit a unit snapshot
 * @param {string} family
 * @param {{get: (id: string) => object|undefined}} [registry] for a bare unit
 * @returns {boolean}
 */
export function unitHasFamily(unit, family, registry = null) {
  if (Array.isArray(unit?.effectFamilies)) return unit.effectFamilies.includes(family);
  if (!registry) return false;

  const suppressed = new Set(
    (unit?.effectInstances ?? []).filter((i) => i.suppressed).map((i) => i.defId),
  );
  return (unit?.effects ?? []).some((id) =>
    !suppressed.has(id) && familiesOf(registry.get?.(id)).includes(family));
}
