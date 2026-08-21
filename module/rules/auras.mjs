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
import { Rank } from "../domain/rank.mjs";
import { candidatesAt } from "./aura-index.mjs";
import { relationOf } from "./relations.mjs";

/**
 * Every aura contribution a unit receives, from every source on the board.
 *
 * An optional `index` (§23.9) narrows which sources are worth asking about, by
 * position. It changes **nothing** about the answer: the relation test and the
 * stacking below are the same either way, and `test/unit/aura-index.test.mjs`
 * holds the two paths against each other. The index is spatial and this
 * function is semantic — one question, one implementation.
 *
 * @param {object} unit the **recipient**
 * @param {object} board
 * @param {object} [index] from `rules/aura-index.mjs`
 * @returns {object[]} modifiers, ready for the pipeline
 */
export function collectAuras(unit, board, index = null) {
  /** @type {object[]} */
  const found = [];

  for (const { source, aura } of candidateAuras(unit, board, index)) {
    const relations = aura.relations ?? ["ally", "self"];
    if (!relations.includes(relationOf(source, unit, board))) continue;

    // `scope: "field"` is unbounded: Medea's Territory Creation applies "while
    // this Unit is on the field", and giving it a radius would have made it an
    // ordinary aura and quietly bounded a rule that is not.
    if (aura.scope !== "field" && distanceBetween(source, unit) > (aura.radius ?? 0)) continue;

    // A condition on the RECIPIENT rather than on the source. Territory
    // Creation reduces damage taken by "allied Units who are in THEIR Home
    // Base", which a predicate evaluated against the source cannot say -- the
    // contributions are collected on the bearer and delivered to somebody else.
    if (!recipientQualifies(aura.requiresRecipient, unit)) continue;

    // An aura may carry SEVERAL modifiers. Medea's Item Construction is six --
    // three outgoing and three incoming, one per severity tier -- and they are
    // the ability: collapsing them to one number keeps the 50% and silently
    // drops Instakill and Death.
    for (const element of aura.elements ?? [aura]) {
      found.push(bind({ ...element, stacking: aura.stacking, group: aura.group, rank: aura.rank }, source));
    }
  }

  return resolveStacking(found);
}

/**
 * The (source, aura) pairs worth testing for this recipient.
 *
 * With an index, the bucket lookup; without one, every aura on the board. The
 * distance test below runs either way — the index narrows the candidates and
 * does not decide them, so a stale index can never *add* an aura that the
 * geometry does not support.
 *
 * @param {object} unit
 * @param {object} board
 * @param {object|null} index
 * @returns {Array<{source: object, aura: object}>}
 */
function candidateAuras(unit, board, index) {
  if (index && unit?.panel) {
    return candidatesAt(index, unit.panel).map((c) => ({ source: c.unit, aura: c.aura }));
  }
  return (board.units ?? []).flatMap(
    (source) => (source.auras ?? []).map((aura) => ({ source, aura })),
  );
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
 * @param {object} [index] a spatial index (§23.9); an optimisation only
 * @returns {void} mutates the recipient's contribution buckets
 */
export function annotateAuras(units, board, index = null) {
  const received = units.map((u) => collectAuras(u, board, index));
  units.forEach((u, k) => {
    if (received[k].length === 0) return;

    // Routed to the field its READER consults. `ApplicationChance` is read off
    // `unit.applicationChances` by the effect applier, so an aura that dropped
    // it into `modifiers` alongside everything else would be collected on every
    // snapshot and consulted by nobody — which is exactly what Medea's Item
    // Construction did until this line existed.
    for (const m of received[k]) {
      const bucket = ROUTES[m.key] ?? "modifiers";
      u[bucket] = [...(u[bucket] ?? []), m];
    }
  });
}

/**
 * Which snapshot field each contribution kind is read from.
 *
 * Only the kinds whose reader is somewhere other than `modifiers` need an
 * entry; everything else takes the default.
 */
const ROUTES = Object.freeze({
  ApplicationChance: "applicationChances",
  Compulsion: "compulsions",
});

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
  const { radius, relations, elements, ...modifier } = a;
  void relations;
  void elements;
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
  /** @type {Map<string, object>} */
  const bestSourceFor = new Map();
  /** @type {object[]} */
  const out = [];

  // A GROUPED aura is resolved by rank across its whole group, and the winner
  // keeps ALL of its elements. "Only the Item Construction with the highest
  // Rank takes effect" is a statement about the Skill, not about each number
  // inside it -- comparing element values would let a C-rank instance win one
  // tier and lose another, producing a blend of two Skills that never existed.
  for (const m of found) {
    if (!m.group) continue;
    const prior = bestSourceFor.get(m.group);
    if (!prior || outranks(m.rank, prior.rank)) {
      bestSourceFor.set(m.group, { rank: m.rank, sourceUnitId: m.aura?.sourceUnitId });
    }
  }

  for (const m of found) {
    if (m.group) {
      const winner = bestSourceFor.get(m.group);
      if (winner && m.aura?.sourceUnitId === winner.sourceUnitId) out.push(m);
      continue;
    }
    if ((m.stacking ?? "highestOnly") !== "highestOnly") {
      out.push(m);
      continue;
    }
    const prior = highest.get(m.key);
    if (!prior || (m.value ?? 0) > (prior.value ?? 0)) highest.set(m.key, m);
  }

  return [...highest.values(), ...out];
}

/**
 * Does `a` outrank `b`? An unranked instance never displaces a ranked one.
 * @param {string|null} a
 * @param {string|null} b
 * @returns {boolean}
 */
function outranks(a, b) {
  const left = Rank.parseOrNull(a ?? null);
  const right = Rank.parseOrNull(b ?? null);
  if (!left) return false;
  if (!right) return true;
  return Rank.compare(left, right) > 0;
}

/**
 * Does the recipient meet the aura's own condition?
 *
 * @param {object|null} requires
 * @param {object} unit the RECIPIENT
 * @returns {boolean}
 */
function recipientQualifies(requires, unit) {
  if (!requires) return true;
  for (const [key, wanted] of Object.entries(requires)) {
    if (Boolean(unit?.[key]) !== Boolean(wanted)) return false;
  }
  return true;
}
