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

import { glassGameTargets, glassGameClock, GLASS_GAME_RADIUS } from "../rules/glass-game.mjs";
import { relationOf } from "../rules/relations.mjs";
import { chebyshev } from "../domain/geometry.mjs";
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

/**
 * The Glass Game's first effect, with its clock.
 *
 * > *"Activates at the end of the Turn, 3◈ Turns after Nursery enters Combat, if
 * > there are still enemy Units within a 3 panel area of Nursery at the end of
 * > that Turn … At the end of every Round, if there are no enemy Units within a
 * > 3 panel area of Nursery, the effect of/duration of time passed for this NP
 * > is reset."*
 *
 * Its handler ran `rewindScript` at every Turn end she heard: no clock, no
 * enemy in the ring, no reset. Every Unit within 3 of her went back 3◈ every
 * Turn of hers (#247 D1). `rules/glass-game.mjs#glassGameClock` held the rule
 * and was called by nothing.
 *
 * Heard at EVERY Turn's end (`anyTurnEnd`), any faction's, because 3◈ is nine
 * Turns of the match and not three of hers; and at the Round's end, where an
 * empty ring resets it. After it fires the clock starts again (#247 reading 7).
 *
 * @param {object} ctx
 * @param {"anyTurnEnd"|"roundEnd"|string} ctx.event the boundary
 * @param {object} ctx.self her board projection
 * @param {object} ctx.board
 * @param {object} ctx.history the match's buffer
 * @param {number} ctx.tick
 * @param {number} ctx.turnsPerRound
 * @param {number} ctx.rewindTurns how far back, in turns
 * @returns {object[]} intents
 */
export function glassGameScript({ event, self, board, history, tick, turnsPerRound = 3, rewindTurns }) {
  if (!self?.panel) return [];
  const ring = (board?.units ?? [])
    .filter((u) => u.id !== self.id && u.panel && !u.defeated)
    .filter((u) => chebyshev(u.panel, self.panel) <= GLASS_GAME_RADIUS)
    .map((u) => ({ ...u, relation: relationOf(self, u, board) }));
  const was = self.glassGameClock ?? 0;
  const next = glassGameClock({ ticks: was }, ring, { turnsPerRound, roundEnd: event === "roundEnd" });

  /** @type {object[]} */
  const out = [];
  if (next.fires) {
    const back = rewindScript({ self, board, history, tick, rewindTurns, includesSelf: false });
    out.push(
      ...back,
      I.log({
        kind: "glassGameRewind", unitId: self.id, effect: 1, tick, turns: rewindTurns,
        // Whom it turned back, for the card a player reads (#247, live).
        rewound: back.filter((i) => i.t === "rewind").map((i) => i.unitId),
      }),
    );
  }
  const ticks = next.fires ? 0 : next.ticks;
  if (ticks !== was) out.push(I.statDelta(self.id, "glassGameClock", ticks - was));
  return out;
}

/**
 * The card's words for one rewind: whose Glass Game, whom it turned back and
 * how far. `null` when it reached nobody. Logged and shown nowhere, until a
 * player saw Arturia's Health jump and no card said why (#247, live).
 *
 * @param {{unitId: string, effect?: number, rewound?: string[], turns?: number}} entry
 * @param {(id: string) => string} nameOfUnit
 * @param {(key: string, data?: object) => string} t
 * @returns {string|null}
 */
export function glassGameLine(entry, nameOfUnit, t) {
  const ids = entry.rewound ?? [];
  if (ids.length === 0) return null;
  const data = { name: nameOfUnit(entry.unitId), units: ids.map(nameOfUnit).join(", "), turns: entry.turns ?? 0 };
  return `<div class="fgt-card fgt-card--glass-game"><p>${t("FGT.GlassGame.Rewound", data)}</p></div>`;
}

/**
 * Post it, naming the Units as the table knows them (#234).
 *
 * @param {object} entry a `glassGameRewind` log entry
 * @returns {Promise<void>}
 */
export async function postGlassGame(entry) {
  if (!game.users?.activeGM?.isSelf) return;
  const escape = foundry.utils.escapeHTML;
  const { shownName } = await import("./public-identity.mjs");
  const { currentBoard, unitActor } = await import("./board.mjs");
  const board = currentBoard();
  const nameOfUnit = (id) => {
    const actor = unitActor(id);
    return escape(actor ? shownName(actor, board) : id);
  };
  const content = glassGameLine(entry, nameOfUnit, (key, data) => game.i18n.format(key, data));
  if (content) await ChatMessage.create({ content, flags: { fgt: { glassGame: entry.unitId } } });
}
