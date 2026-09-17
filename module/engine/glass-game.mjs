/**
 * @file `nurseryRhyme.rewind` — the corpus's first `Script`.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 * @see docs/28-bounded-fields.md, docs/45-case-studies.md
 *
 * Layer 3.
 *
 * **Why this is a Script and not a rule element.** Every other ability in the
 * corpus is data because its behaviour is a *composition* of named mechanisms.
 * This one has to walk a unit set, resolve a historical index, diff two states
 * and emit a heterogeneous batch — and it has **exactly one customer**. Ch. 10's
 * own position is that *"Scripts are the escape hatch, not the norm."* A rule
 * element generalising "rewind" from a single example would be inventing a
 * vocabulary for a shape nothing else has.
 *
 * If a second rewind ever appears, generalise then — which is the rule Ch. 45
 * already applies to `innocentWorld` and `heel`.
 */

import { glassGameTargets } from "../rules/glass-game.mjs";
import { rewindIntents } from "./state-history.mjs";
import * as I from "./intents.mjs";

/**
 * Restore an arbitrary historical snapshot across a unit set.
 *
 * @param {object} ctx
 * @param {object} ctx.self Nursery's board projection
 * @param {object} ctx.board
 * @param {object} ctx.history the match's buffer
 * @param {number} ctx.tick the current global turn
 * @param {number} ctx.rewindTurns how far back, in turns
 * @param {boolean} [ctx.includesSelf]
 * @returns {object[]} intents
 */
export function rewindScript({ self, board, history, tick, rewindTurns, includesSelf = false }) {
  const ids = glassGameTargets(self, board?.units ?? [], includesSelf);
  if (ids.length === 0) return [];

  const toTurn = tick - rewindTurns;
  const descriptors = rewindIntents(board, history, ids, toTurn);

  return descriptors.map((d) => (d.kind === "rewind"
    ? I.rewind(d.unitId, d.state, { clearsDefeat: d.clearsDefeat })
    : I.log(d)));
}
