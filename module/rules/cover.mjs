/**
 * @file Cover — a Servant taking a Noble Phantasm for its Master.
 * @see docs/16-relationships.md §16.4 rule 4
 *
 * Layer 2 (rules). Pure.
 *
 * The fourth and most involved of the Master-protection rules, and the last of
 * them to be built:
 *
 * > *"When a Master that has its Servant within a 2 panel Range of itself gets
 * > caught in an AoE Noble Phantasm and fails to Evade, the Servant performs an
 * > Agility Check. If Successful, the Servant shoves (Moves) its Master out of
 * > the NP area … If Failed, the Master receives no damage and effects, while
 * > the Total Damage the Servant takes from the AoE NP is increased by 100%;
 * > and in this situation, Servants cannot Evade the enemy Unit's AoE NP if
 * > their Master is within a 2 panel range of them."*
 *
 * Three things make it awkward, and all three are the rule rather than the
 * implementation:
 *
 *   1. It spans **two Combat Processes**. An AoE Noble Phantasm fans out into
 *      one Process per defender, so the Master's Process decides the outcome
 *      and the *Servant's* Process is what the decision changes.
 *   2. The Servant must be **inside the area** — *"if a Servant fails to Shove
 *      their Master out of an AoE NP, but that Servant is not within the NP
 *      area, that Servant cannot Cover for their Master."* A Servant standing
 *      clear cannot absorb a blast it is not in.
 *   3. The doubling is **divided** among the covering Servants, so two of them
 *      take +50% each rather than +100% apiece.
 */

import { chebyshev, key as panelKey } from "../domain/geometry.mjs";
import { guardsOf } from "./relations.mjs";

/** How near a Servant must stand to cover its Master. */
export const COVER_RANGE = 2;

/**
 * The Servants that may cover this Master against this area.
 *
 * Every condition is stated by the rule and none is inferred:
 *
 * | Condition | Clause |
 * |---|---|
 * | is one of the Master's Servants | *"its Servant"* — through `guardsOf`, so Pale Rider's Kagome Spirits stand in for him |
 * | within 2 panels | *"within a 2 panel Range of itself"* |
 * | able to act | *"while a Servant is affected by … any other effect that prevents a Servant from Acting, the effects … are negated"* |
 * | inside the area | *"but that Servant is not within the NP area, that Servant cannot Cover"* |
 *
 * A defeated Servant covers nothing, which `canAct` does not say on its own —
 * a defeat leaves the token on the board.
 *
 * @param {object} master the Master caught in the area
 * @param {object} board
 * @param {Array<{i: number, j: number}>} areaPanels the Noble Phantasm's area
 * @returns {object[]} the covering Servants, in board order
 */
export function coveringServantsFor(master, board, areaPanels) {
  if (!master?.panel) return [];
  const inArea = new Set((areaPanels ?? []).map(panelKey));

  return guardsOf(master, board).filter((servant) =>
    servant.panel
    && !servant.defeated
    && servant.canAct !== false
    && chebyshev(servant.panel, master.panel) <= COVER_RANGE
    && inArea.has(panelKey(servant.panel)));
}

/**
 * How much the Total Damage each covering Servant takes is multiplied by.
 *
 * > *"The Total Damage the Servant takes … is increased by 100%"*, and *"if a
 * > Master in this situation has more than one Servant … the increase in Total
 * > Damage taken by the Servants are divided by the number of Servants
 * > Covering."*
 *
 * So the **increase** is divided, not the damage: one Servant takes +100%
 * (×2), two take +50% each (×1.5), three +33% each (×1.33). Covering in a
 * group is strictly better per Servant, which is the rule's own incentive.
 *
 * @param {number} count how many Servants are covering
 * @returns {number} the factor for stage 15
 */
export function coverFactor(count) {
  if (!Number.isFinite(count) || count < 1) return 1;
  return 1 + (1 / count);
}

/**
 * Where a Servant shoves its Master to.
 *
 * > *"The Servant shoves (Moves) its Master out of the NP area (the Master is
 * > Moved to one panel outside of the NP area)."*
 *
 * The NEAREST panel outside, so the shove is the shortest one that works — the
 * rule says "one panel outside", not "anywhere outside", and a Master flung
 * across the board would be a different effect entirely. Ties are broken by
 * board order so two clients shoving the same Master agree.
 *
 * Occupied panels are skipped: a shove is a Move, and a Move onto a standing
 * Unit is not legal (Ch. 08).
 *
 * @param {object} master
 * @param {Array<{i: number, j: number}>} areaPanels
 * @param {object} board
 * @returns {{i: number, j: number}|null} `null` when there is nowhere to go
 */
export function shoveDestination(master, areaPanels, board) {
  if (!master?.panel) return null;
  const inArea = new Set((areaPanels ?? []).map(panelKey));
  const taken = new Set(
    (board?.units ?? [])
      .filter((u) => u.panel && u.id !== master.id && !u.defeated)
      .map((u) => panelKey(u.panel)),
  );

  /** @type {{panel: object, distance: number}|null} */
  let best = null;
  // Outward from the Master, so the first ring that contains a legal panel
  // wins. Bounded by the area's own extent plus one: a panel further than that
  // cannot be nearer than one already found.
  const reach = Math.max(1, spanOf(areaPanels) + 1);
  for (let di = -reach; di <= reach; di++) {
    for (let dj = -reach; dj <= reach; dj++) {
      const panel = { i: master.panel.i + di, j: master.panel.j + dj };
      const k = panelKey(panel);
      if (inArea.has(k) || taken.has(k)) continue;
      if (!inBoard(panel, board?.bounds ?? null)) continue;

      const distance = chebyshev(master.panel, panel);
      if (!best || distance < best.distance) best = { panel, distance };
    }
  }
  return best?.panel ?? null;
}

/**
 * May this Servant Evade right now?
 *
 * > *"In this situation, Servants **cannot Evade** the enemy Unit's AoE NP if
 * > their Master is within a 2 panel range of them."*
 *
 * The refusal is the price of the shelter: a Servant that has just failed to
 * shove its Master takes the blast, and takes it standing.
 *
 * @param {object} unit
 * `coveringIds` rather than `servantIds`: the Master's own schema has a
 * `servantIds` SetField and this is a different list entirely — the Servants
 * that failed their Check on THIS Noble Phantasm, not the ones contracted.
 *
 * @param {object|null} cover the phase's cover record, or `null`
 * @returns {boolean}
 */
export function isCovering(unit, cover) {
  return Boolean(unit?.id && (cover?.coveringIds ?? []).includes(unit.id));
}

/* -------------------------------------------------------------------------- */

/**
 * The widest the area reaches from end to end, for bounding the shove search.
 * @param {Array<{i: number, j: number}>} panels
 * @returns {number}
 */
function spanOf(panels) {
  if (!panels?.length) return 0;
  const is = panels.map((p) => p.i);
  const js = panels.map((p) => p.j);
  return Math.max(Math.max(...is) - Math.min(...is), Math.max(...js) - Math.min(...js));
}

/**
 * @param {{i: number, j: number}} panel
 * @param {object|null} bounds
 * @returns {boolean}
 */
function inBoard(panel, bounds) {
  if (!bounds) return true;
  return panel.i >= bounds.iMin && panel.i <= bounds.iMax
    && panel.j >= bounds.jMin && panel.j <= bounds.jMax;
}
