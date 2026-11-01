/**
 * @file Attacks a MAG seal refuses, and the Base Attack it leaves.
 * @see docs/superpowers/specs/2026-10-31-gray-clauses.md (MY.1)
 *
 * Layer 2. Pure.
 *
 * > *"Attacks which use Base Attack (MAG) or deal MAG damage cannot be used. If
 * > an Attack were to use Base Attack (STR) & Base Attack (MAG) combined,
 * > damage calculation is performed only with Base Attack (STR)."* (Mythos 1)
 *
 * A seal is a `Suppress` of scope `magAttack` on the Unit. An Attack whose Base
 * Attack is MAG alone is refused: an ability by its damage block, a Normal
 * Attack by its band at the distance it is made (#362 reading 23). One that adds
 * both is let through and dealt with its STR part alone.
 */

/**
 * The seal this Unit stands under, or `null`.
 *
 * @param {object|null} unit a unit snapshot
 * @returns {object|null}
 */
export function magSealOf(unit) {
  return (unit?.suppressions ?? []).find((s) => s?.scope === "magAttack") ?? null;
}

/**
 * The components a Base Attack spec adds up: each source's, or the spec's own.
 *
 * @param {object|null} spec `{sources?, component?}`, a damage block or a base
 * @returns {string[]}
 */
function componentsOf(spec) {
  const sources = spec?.base?.sources ?? spec?.sources ?? [];
  const own = spec?.component ?? null;
  if (sources.length > 0) return sources.map((s) => s?.component ?? own ?? "str");
  return own ? [own] : [];
}

/**
 * Does this Attack use Base Attack (MAG) and nothing else?
 *
 * @param {object|null} spec a damage block, or a Normal Attack's resolved base
 * @returns {boolean}
 */
export function usesMagOnly(spec) {
  const parts = componentsOf(spec);
  return parts.length > 0 && parts.every((c) => c === "mag");
}

/**
 * A combined Base Attack read as its STR part alone, when the seal stands.
 *
 * @param {object|null} base `{sources}`
 * @param {object|null} unit the attacker's snapshot
 * @returns {object|null} the base, its MAG sources dropped when it had STR ones too
 */
export function strPartUnderSeal(base, unit) {
  const sources = base?.sources;
  if (!magSealOf(unit) || !Array.isArray(sources)) return base;
  const str = sources.filter((s) => (s?.component ?? "str") !== "mag");
  if (str.length === 0 || str.length === sources.length) return base;
  return { ...base, sources: str, strPartOnly: true };
}
