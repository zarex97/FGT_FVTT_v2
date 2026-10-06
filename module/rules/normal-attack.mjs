/**
 * @file Which Base Attack a Normal Attack draws on, at this distance.
 * @see docs/21-combat-process.md, docs/22-damage-pipeline.md
 *
 * Layer 2 (rules). Pure.
 *
 * Most Servants answer this once and for ever: a Lancer hits with STR, a
 * Caster with MAG, and `normalAttack: {mode: fixed, component: str}` says so.
 * `rangeBanded` has been one of the three declared modes since the actor schema
 * was written and **nothing implemented it**, so a Servant authored with it
 * would have attacked with its `component` at every distance — the fallback,
 * silently.
 *
 * EMIYA is the Servant it was declared for:
 *
 * > *"At a Range of 1 or 2, EMIYA's Normal Attacks use Base Attack (STR). At a
 * > Range of 3 or higher, EMIYA's Normal Attacks use Base Attack (STR) and 20%
 * > of his Base Attack (MAG) combined (i.e. 75+35=110); not affected by Magic
 * > Resistance."*
 *
 * Three things change together at the band edge — the sources, which component
 * the attack counts as, and whether Magic Resistance sees it at all — which is
 * why this returns all three rather than just a letter. The third is not
 * decoration: EMIYA's ranged shot would otherwise be a MAG attack that a
 * Rank D Magic Resistance negates outright.
 */

/**
 * @typedef {object} NormalAttackSpec
 * @property {Array<{unit: string, component: string, factor: number}>} sources
 * @property {"str"|"mag"} component what the attack counts AS, for predicates
 * @property {string|null} element the damage type, or null
 * @property {boolean} ignoresMagicResistance
 */

/**
 * @param {object} unit a unit snapshot, or any `{normalAttack}` shape
 * @param {number|null} [range] panels between attacker and defender
 * @returns {NormalAttackSpec}
 */
export function normalAttackAt(unit, range = null, { platform = null } = {}) {
  // A rider whose mount replaces her Normal Attack swings the MOUNT'S, not her
  // own: *"Quetz's Move and Normal Attack is replaced with Quetzalcoatlus'."*
  // The whole spec comes from the platform, not just the number, because a
  // mount could be range-banded too.
  //
  // `unit: "mount"` rather than `"self"` is what makes the base attack come off
  // the right actor -- stage 1 of the pipeline has resolved named sources
  // through `ctx.units[...]` since it was written, and this is its first
  // caller. Resolving it as "self" would have swung Quetzalcoatl's own 125
  // while reporting the mount's reach.
  const from = platform ?? unit;
  const named = platform ? "mount" : "self";

  const spec = from?.normalAttack ?? {};
  const component = spec.component ?? "str";
  const flat = {
    sources: [{ unit: named, component, factor: 1 }],
    component,
    // From `from`, not from `unit`: a rider whose mount replaces her Normal
    // Attack swings the mount's, and the damage type comes with it.
    element: spec.element ?? null,
    // "...Lightning damage (HALF)". Travels BESIDE the element for the reason
    // `buildAttackSpec` gives at all three of its spec-building sites: an
    // element that arrives without its fraction is silently a whole-element
    // attack, which is a bigger number than the sheet prints.
    elementFraction: spec.elementFraction ?? undefined,
    ignoresMagicResistance: false,
    // The Rank Magic Resistance meets it at, when it is not the attacker's
    // MAG: the Golden Hind's swing is the Noble Phantasm's, A+ (#187).
    attackRank: spec.attackRank ?? null,
    // Its own stage-3 multipliers: Mesektet's ×2 against Dark (#189).
    conditionalMultipliers: spec.conditionalMultipliers ?? [],
  };

  if (spec.mode !== "rangeBanded") return flat;
  // An unknown distance falls back rather than guessing. A snapshot taken off
  // the board has no panel, and reading that as range 0 would put EMIYA in his
  // melee band while previewing a shot across the map.
  if (typeof range !== "number" || !Number.isFinite(range)) return flat;

  const band = bandFor(spec.bands ?? [], range);
  if (!band) return flat;

  const sources = (band.sources ?? []).map((s) => ({
    unit: named, component: s.component ?? component, factor: s.factor ?? 1,
  }));
  // A band that names only a COMPONENT re-sources the swing from it: the
  // Sphinx Wehem-Mesut's *"Base Attack (STR/MAG): 200 (At a Range of 2 or
  // higher, Attack deals MAG damage)"* is `{from: 2, component: mag}`, and
  // falling back to the flat STR sources labelled the hit MAG and dealt it as
  // STR, so Magic Resistance never saw it (#189).
  const bandOnly = band.component && sources.length === 0
    ? [{ unit: named, component: band.component, factor: 1 }]
    : null;

  return {
    sources: sources.length > 0 ? sources : (bandOnly ?? flat.sources),
    // What the attack COUNTS AS when two components are combined: the sheet's
    // own framing is "Base Attack (STR) and 20% of his Base Attack (MAG)
    // combined", a STR attack with a MAG top-up, and `damage.component` is
    // what Magic Resistance's Instakill exemption reads. Stated explicitly
    // when the author means otherwise.
    component: band.component ?? sources[0]?.component ?? component,
    // A band may RETYPE the damage as well as re-source it.
    element: band.element ?? spec.element ?? null,
    ignoresMagicResistance: Boolean(band.ignoresMagicResistance),
    attackRank: spec.attackRank ?? null,
    conditionalMultipliers: spec.conditionalMultipliers ?? [],
  };
}

/**
 * The band covering this distance, narrowest first.
 *
 * Sorted by `from` DESCENDING so overlapping bands resolve to the most
 * specific one — "1 or 2" and "3 or higher" do not overlap, but an author
 * writing a third band inside an existing one should get the inner answer
 * rather than whichever happened to be listed first.
 *
 * @param {object[]} bands
 * @param {number} range
 * @returns {object|null}
 */
function bandFor(bands, range) {
  return [...bands]
    .filter((b) => range >= (b.from ?? 0) && range <= (b.to ?? Number.POSITIVE_INFINITY))
    .sort((a, b) => (b.from ?? 0) - (a.from ?? 0))[0] ?? null;
}
