/**
 * @file Whether an Attack is Ranged, Melee or Special: its delivery.
 * @see docs/20-targeting.md, docs/21-combat-process.md, #281
 *
 * Layer 2 (rules). Pure.
 *
 * The Drive sheets STATE it. An Attack's head carries `{R}`, `{M}` or `{S}`:
 * Ranged, Melee or Special (the user, 2026-10-21). A Normal Attack's line says
 * `N.Atk Type: STR, Melee`, and some change with distance: Trung Sisters'
 * *"STR, Melee (1pan); MAG, Ranged (2+pan)"*. One hit inside an Attack may say
 * its own: Bradamante's *"normal {Ranged} damage … 2.5x {Melee} damage"*.
 *
 * Ruled 2026-10-24 (#281, Arturia (Lancer) rulings 11–15):
 *
 *   - The closest statement wins: a hit's own tag (a `damage.instances` entry),
 *     else its Normal Attack band's, else the Attack's (`damage.delivery`,
 *     `normalAttack.delivery`). The caller folds those; this reads the result.
 *   - An Attack that states none is MEASURED, as every one was before: its Range
 *     at or above the War Rule `rangedMinimumRange` is Ranged, below it Melee
 *     (#187 reading 4).
 *   - Special is neither: a rule that asks for Ranged or for Melee never
 *     matches it.
 *   - Mana Burst, a Riding Attack and a Counter take the Normal Attack's
 *     delivery at the distance struck.
 *
 * Measuring alone called a Range-2 `{M}` swing Ranged, and Moralltach, `{M}` at
 * Range=3, the same (Surprise `2026-10-21-ranged-is-stated-not-measured`).
 */

import { DELIVERIES } from "../domain/enums.mjs";

/** The three a sheet states. */
export { DELIVERIES };

/**
 * A targeting spec's word for "ask the caster's Normal Attack, at the distance":
 * a bare Normal Attack, or an ability that counts as one and states no tag.
 */
export const NORMAL_ATTACK_DELIVERY = "normalAttack";

/**
 * Is this one of the three?
 *
 * @param {unknown} value
 * @returns {value is "ranged"|"melee"|"special"}
 */
export function isDelivery(value) {
  return DELIVERIES.includes(/** @type {string} */ (value));
}

/**
 * The minimum Range an unstated Attack needs to count as Ranged.
 *
 * A table setting (#187 reading 4), carried on `board.rules` because Layer 2
 * reads no settings: Range 2 or more unless the GM raised it.
 *
 * @param {object|null} board
 * @returns {number}
 */
export function rangedMinimumRange(board) {
  const n = Number(board?.rules?.rangedMinimumRange);
  return Number.isFinite(n) && n >= 2 ? n : 2;
}

/**
 * The delivery of one Attack: what it states, or else what its Range measures.
 *
 * @param {{stated?: string|null, reach?: number|null}} attack `stated` is the
 *   closest tag already folded (hit, band, Attack); `reach` is the Attack's Range
 * @param {object|null} board for the War Rule
 * @returns {"ranged"|"melee"|"special"}
 */
export function deliveryOf({ stated = null, reach = null } = {}, board = null) {
  if (isDelivery(stated)) return stated;
  const range = typeof reach === "number" && Number.isFinite(reach) ? reach : 1;
  return range >= rangedMinimumRange(board) ? "ranged" : "melee";
}

/**
 * What an ability's targeting spec says about its delivery, before any distance.
 *
 * The ability's own `damage.delivery`; failing that, an ability that counts as
 * its user's Normal Attack (a Mana Burst) is the Normal Attack's, at whatever
 * distance it strikes (ruling 14); a bare Normal Attack (`item` null) likewise.
 * Anything else states none, and is measured.
 *
 * @param {object|null} item the ability, or `null` for a bare Normal Attack
 * @returns {string|null} a delivery, {@link NORMAL_ATTACK_DELIVERY}, or `null`
 */
export function statedDeliveryOf(item) {
  if (!item) return NORMAL_ATTACK_DELIVERY;
  const stated = item.system?.damage?.delivery ?? null;
  if (isDelivery(stated)) return stated;
  return item.system?.countsAsNormalAttack ? NORMAL_ATTACK_DELIVERY : null;
}
