/**
 * @file Which Base Attack a Normal Attack draws on, at this distance.
 * @see docs/12-combat-process.md, docs/13-damage-pipeline.md §13.2
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
    ignoresMagicResistance: false,
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

  return {
    sources: sources.length > 0 ? sources : flat.sources,
    // What the attack COUNTS AS when two components are combined: the sheet's
    // own framing is "Base Attack (STR) and 20% of his Base Attack (MAG)
    // combined", a STR attack with a MAG top-up, and `damage.component` is
    // what Magic Resistance's Instakill exemption reads. Stated explicitly
    // when the author means otherwise.
    component: band.component ?? sources[0]?.component ?? component,
    ignoresMagicResistance: Boolean(band.ignoresMagicResistance),
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
