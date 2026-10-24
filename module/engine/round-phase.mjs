/**
 * @file Changing the Round's Day or Night, and saying so (#294, #314).
 * @see rules/environment.mjs#roundPhase, docs/29-environment.md
 *
 * Layer 3 (engine).
 *
 * Kuonji Alice's NP: *"If this NP is used during the Day, the game state becomes
 * Night until the end of the Round (next Round will still be Night as usual)"*.
 * Tamamo Goth's: *"the current Round changes to a Day Round (Note: Day-Night
 * progression is unaffected in this case, the next Round will still be a Day
 * Round)"*. So the change is a `phaseOverride` naming the Round in progress, and
 * nothing else: every later Round is still the opening flip's.
 *
 * Both readers of a change (the `setRoundPhase` Phase on a Skill and on an
 * attack) call {@link setRoundPhase}; the Round boundary calls
 * {@link announcePhaseChange} when the alternation flips the phase.
 */

import { currentWar, warRule } from "./war.mjs";
import { currentBoard, currentMoment, currentRoundPhase } from "./board.mjs";
import { fireEvent } from "./scheduler.mjs";
import { worldIO } from "./io.mjs";

/**
 * Set the Round in progress to Day or Night.
 *
 * Refused, with a reason a card can print, when the War plays without the
 * cycle or the Round already is that phase: nothing changed, so no event.
 *
 * @param {"day"|"night"} to
 * @returns {Promise<{ok: boolean, line: string|null, reason: string|null}>}
 */
export async function setRoundPhase(to) {
  const war = currentWar();
  if (!war) return { ok: false, line: null, reason: game.i18n.localize("FGT.RoundPhase.NoWar") };
  const round = currentMoment().round ?? 1;
  const from = currentRoundPhase(round);
  const phaseName = game.i18n.localize(`FGT.RoundPhase.${to}`);
  if (from === "none") return { ok: false, line: null, reason: game.i18n.localize("FGT.RoundPhase.NoCycle") };
  if (from === to) return { ok: false, line: null, reason: game.i18n.format("FGT.RoundPhase.Already", { phase: phaseName }) };
  await worldIO().setRoundPhase(to, round);
  await announcePhaseChange(from, to, round);
  return { ok: true, line: game.i18n.format("FGT.RoundPhase.Set", { phase: phaseName }), reason: null };
}

/**
 * Fire `phaseChanged` for every Unit on the War's board.
 *
 * *"Whenever the game state changes from a Day Round to a Night Round"* is heard
 * whether the Round boundary flipped it or an ability did (ruled 2026-10-22,
 * #314). The payload is the `event` a handler's `eventFilter` reads: `{to:
 * night}` is that clause.
 *
 * @param {"day"|"night"} from
 * @param {"day"|"night"} to
 * @param {number} round
 * @returns {Promise<void>}
 */
export async function announcePhaseChange(from, to, round) {
  if (from === to || from === "none" || to === "none") return;
  const board = currentBoard();
  const intents = fireEvent("phaseChanged", board.units, {
    tick: currentMoment().tick ?? 0,
    turnsPerRound: warRule("turnsPerRound"),
    board,
    round,
    options: new Set([`war:phase:${to}`]),
    event: { from, to, round },
  });
  if (intents.length === 0) return;
  const { applyWorldIntents } = await import("./applier.mjs");
  const out = await applyWorldIntents(intents, "phaseChanged", { lines: true });
  // Said on a card of its own: Dracula taken off at dawn was a write and a log
  // entry, and the lines the batch returned reached no card (#333, live).
  const { postTurnEndReport } = await import("./turn-report.mjs");
  await postTurnEndReport(intents, null, null, `FGT.RoundPhase.ChangedTo.${to}`, out?.lines ?? []);
}
