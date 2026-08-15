/**
 * @file Auras — expanding a source's contribution onto the units around it.
 * @see docs/11-effect-engine.md §11.6, docs/23-documents-and-derived-data.md §23.3
 *
 * Layer 2 (rules). Pure — takes the board, returns modifiers.
 *
 * An aura is a rule element on unit A that affects units within a radius
 * **without applying an effect to them**. That distinction is load-bearing:
 * leaving the radius has to remove the benefit instantly, which an applied
 * effect could only manage with a position-watcher writing on every move;
 * `highestOnly` resolution has to compare every source at evaluation time; and
 * an ally's aura contribution living on *your* unit would be dispellable from
 * your unit, which is nonsense.
 *
 * Until now the `Aura` executor wrote its modifier straight into its owner's
 * modifier bag, carrying `radius` and `relations` fields that the damage
 * pipeline never read. The contribution reached the owner and stopped there, at
 * any distance, regardless of relation.
 *
 * Reaching the owner was never the bug. **"Every allied unit" includes itself**
 * unless the text says otherwise, which is why `relations` defaults to
 * `["ally", "self"]`; the auras that exclude their bearer — Penthesilea's
 * *Charisma* ("other allies"), Kiritsugu's *Affection of the Holy Grail*
 * ("everyone except himself") — say so, and drop `"self"` from the list.
 */

import { chebyshev } from "../domain/geometry.mjs";

/**
 * Every aura contribution a unit receives, from every source on the board.
 *
 * @param {object} unit the **recipient**
 * @param {object} board
 * @returns {object[]} modifiers, ready for the pipeline
 */
export function collectAuras(unit, board) {
  /** @type {object[]} */
  const found = [];

  for (const source of board.units ?? []) {
    for (const a of source.auras ?? []) {
      const relations = a.relations ?? ["ally", "self"];
      if (!relations.includes(relationOf(source, unit, board))) continue;
      if (distanceBetween(source, unit) > (a.radius ?? 0)) continue;
      found.push(bind(a, source));
    }
  }

  return resolveStacking(found);
}

/**
 * Give every unit on the board the auras it stands in.
 *
 * Two passes, and the reason is §23.3's cycle: unit A's derived data depends on
 * unit B's position and rules, and vice versa. Collecting for **all** units
 * against the untouched board before writing any of it back means no unit can
 * observe another unit's freshly-received auras — an aura cannot feed an aura,
 * and the result does not depend on the order units are visited in.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void} mutates `unit.modifiers`
 */
export function annotateAuras(units, board) {
  const received = units.map((u) => collectAuras(u, board));
  units.forEach((u, k) => {
    if (received[k].length === 0) return;
    u.modifiers = [...(u.modifiers ?? []), ...received[k]];
  });
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Strip the aura's own bookkeeping and record its provenance.
 *
 * `radius` and `relations` do not survive: they are the aura's *addressing*,
 * answered by the time we get here. Leaving them on the modifier is what let
 * the original defect look plausible — the pipeline saw fields it did not
 * understand and ignored them.
 *
 * @param {object} a
 * @param {object} source
 * @returns {object}
 */
function bind(a, source) {
  const { radius, relations, ...modifier } = a;
  void relations;
  return { ...modifier, aura: { sourceUnitId: source.id, radius } };
}

/**
 * Distance between two units, nearest panel to nearest panel.
 *
 * Multi-panel units are measured from their closest occupied panel, the same
 * rule facing and attack range use — a 3-panel platform is in range if any part
 * of it is.
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function distanceBetween(a, b) {
  const from = a.panels ?? (a.panel ? [a.panel] : []);
  const to = b.panels ?? (b.panel ? [b.panel] : []);
  let best = Infinity;
  for (const p of from) for (const q of to) best = Math.min(best, chebyshev(p, q));
  return best;
}

/**
 * How a source sees a recipient.
 *
 * Deliberately a copy of the targeting resolver's rule rather than an import:
 * importing across `rules/targeting` for three lines would couple the aura pass
 * to the eleven-step resolver's module graph, and the two answer the same
 * question for different reasons.
 *
 * @param {object} source
 * @param {object} unit
 * @param {object} board
 * @returns {"self"|"ally"|"enemy"|"neutral"}
 */
function relationOf(source, unit, board) {
  if (unit.id === source.id) return "self";
  if (unit.kind === "civilian" || unit.faction === null) return "neutral";
  const allied = board.alliances?.[source.faction]?.includes(unit.faction)
    ?? unit.faction === source.faction;
  return allied ? "ally" : "enemy";
}

/**
 * Apply each modifier key's stacking rule across the sources that reached here.
 *
 * `highestOnly` is the default and the interesting one: *"only the highest-rank
 * Territory Creation takes effect"* is a comparison across **all** sources, and
 * it is why auras resolve at evaluation time instead of being applied as
 * effects.
 *
 * @param {object[]} found
 * @returns {object[]}
 */
function resolveStacking(found) {
  /** @type {Map<string, object>} */
  const highest = new Map();
  /** @type {object[]} */
  const out = [];

  for (const m of found) {
    if ((m.stacking ?? "highestOnly") !== "highestOnly") {
      out.push(m);
      continue;
    }
    const prior = highest.get(m.key);
    if (!prior || (m.value ?? 0) > (prior.value ?? 0)) highest.set(m.key, m);
  }

  return [...highest.values(), ...out];
}
