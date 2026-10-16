/**
 * @file Items bound to their holder by another Unit, and what the board knows
 * about that bond.
 * @see docs/18-items.md, docs/46-roster-re-audit.md
 *
 * Layer 2 (rules). Pure.
 *
 * Arturia's Avalon is the first (#230). She places it inside her Master, and
 * what it does there turns on her: *"If Arturia is at most 3 panels away from
 * her Master ... 20% ... If Arturia is more than 3 panels away ... 10%"*, *"If
 * Arturia is defeated while [Avalon] is inside her Master, her Master keeps it
 * ... reduce the condition of effect (c) to 5%"*, and *"If [Avalon] is inside
 * any Master other than Arturia's Master, Health Regen ... is reduced to 5%"*.
 *
 * So the Item records who bound it (`bondUnitId`) and whose Master that was
 * when she did (`bondMasterId`), and this pass answers three questions a rule
 * on the Item asks of its holder, as board facts:
 *
 *   - `own`: the holder is the binder's own Master;
 *   - `defeated`: the binder is defeated, or gone from the board;
 *   - `distance`: how far the binder stands, while she stands at all.
 *
 * The Master is recorded at the bond rather than read off the binder, because
 * a defeated Servant leaves the board and with it the only place that said who
 * her Master was -- and the clause that matters most is the one about her
 * being defeated.
 */

import { chebyshev } from "../domain/geometry.mjs";

/**
 * Give every Unit the bonds of the Items it holds.
 *
 * @param {object[]} units the board's Units, with `items` projected
 * @returns {void} sets `unit.bonds`
 */
export function annotateBonds(units) {
  const byId = new Map((units ?? []).map((u) => [u.id, u]));
  for (const u of units ?? []) {
    const bound = (u.items ?? []).filter((i) => i.bondUnitId);
    if (bound.length === 0) continue;
    u.bonds = bound.map((i) => bondOf(u, i, byId.get(i.bondUnitId) ?? null));
  }
}

/**
 * @param {object} holder
 * @param {object} item a projected Item, with `bondUnitId` and `bondMasterId`
 * @param {object|null} binder the binding Unit, if it is on the board
 * @returns {{contentId: string, unitId: string, own: boolean, defeated: boolean, distance: number|null}}
 */
export function bondOf(holder, item, binder) {
  const defeated = !binder || Boolean(binder.defeated);
  const distance = !defeated && binder.panel && holder.panel ? chebyshev(binder.panel, holder.panel) : null;
  return {
    contentId: item.contentId,
    unitId: item.bondUnitId,
    own: Boolean(item.bondMasterId) && item.bondMasterId === holder.id,
    defeated,
    distance,
  };
}
