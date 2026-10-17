/**
 * @file The Master Essence draft: which Essences a Faction may take (#241).
 * @see docs/31-war-setup-and-summoning.md
 *
 * Layer 2 (rules). Pure.
 *
 * > *"Masters are divided into four Ranks, and the limitations on selections
 * > are as follows- Rank A ... Only 1 allowed. Rank B ... Only 2 allowed. Rank
 * > C ... Only 2 allowed. Rank D ... Only 2 allowed."*
 * > *"The Players may substitute a higher Ranking Master with a lower Ranking
 * > Master instead."* (`docs/Master Essences.md`)
 *
 * One Essence per container, per Faction (ruled 2026-10-17, #241 reading 1): a
 * Great Holy Grail War Faction holds one pair per container, a Holy Grail War
 * player one pair, and the limits count that Faction's containers. A custom war
 * may set its own.
 */

/** The four Ranks, highest first: the order a slot accepts substitutes in. */
export const ESSENCE_RANKS = Object.freeze(["A", "B", "C", "D"]);

/** The published limits, per Faction. */
export const ESSENCE_LIMITS = Object.freeze({ A: 1, B: 2, C: 2, D: 2 });

/**
 * The limits a war drafts under: the published ones, or a custom war's own.
 *
 * @param {string} warType
 * @param {Record<string, number>|null|undefined} custom the draft's, for a custom war
 * @returns {Record<string, number>}
 */
export function limitsFor(warType, custom = null) {
  if (warType !== "custom" || !custom) return { ...ESSENCE_LIMITS };
  const out = {};
  for (const r of ESSENCE_RANKS) {
    const n = Number(custom[r]);
    out[r] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : ESSENCE_LIMITS[r];
  }
  return out;
}

/**
 * Do these Essences fit the slots, a lower Rank filling a higher slot?
 *
 * A slot of Rank X takes an Essence of X or lower, never higher. That is a
 * nested condition: the Rank A Essences need A slots, A and B together need
 * A and B slots, and so on down. Three Rank B Essences fit 1 A + 2 B, which is
 * the sheet's own example; two Rank A Essences never fit one A slot.
 *
 * @param {string[]} ranks one per container, `"A"` to `"D"`
 * @param {Record<string, number>} limits
 * @returns {{ok: boolean, rank?: string}} the first Rank whose cumulative count overflows
 */
export function fitsLimits(ranks, limits) {
  let need = 0;
  let have = 0;
  for (const r of ESSENCE_RANKS) {
    need += ranks.filter((x) => x === r).length;
    have += limits[r] ?? 0;
    if (need > have) return { ok: false, rank: r };
  }
  return { ok: true };
}

/**
 * Why this draft of Essences cannot be committed, container by container.
 *
 * @param {object[]} containers each with `essenceId`
 * @param {object[]} factions
 * @param {{ranks: Map<string, string>|Record<string, string>, limits: Record<string, number>}} essences
 *   the catalogue's Rank of each Essence id, and the limits
 * @returns {Array<{containerId: string|null, code: string, message: string, detail?: object}>}
 */
export function essenceRefusals(containers, factions, { ranks, limits }) {
  const out = [];
  const rankOf = (id) => (ranks instanceof Map ? ranks.get(id) : ranks?.[id]) ?? null;
  const say = (containerId, code, detail) =>
    out.push({ containerId, code, message: `FGT.Setup.Refusal.${code}`, ...(detail ? { detail } : {}) });

  for (const c of containers ?? []) {
    if (!c.essenceId) say(c.id, "noEssence");
    else if (!rankOf(c.essenceId)) say(c.id, "unknownEssence");
  }
  for (const f of factions ?? []) {
    const ranks = (containers ?? []).filter((c) => c.factionId === f.id)
      .map((c) => rankOf(c.essenceId)).filter(Boolean);
    const fit = fitsLimits(ranks, limits);
    if (!fit.ok) say(null, "essenceLimit", { faction: f.name ?? f.id, rank: fit.rank });
  }
  return out;
}

/**
 * Whether an Essence of this Rank makes its Master High Rank, and so offers
 * the Parameter `+` (#241 reading 17).
 *
 * @param {string|null} rank
 * @returns {boolean}
 */
export function grantsParameter(rank) {
  return rank === "A" || rank === "B";
}
