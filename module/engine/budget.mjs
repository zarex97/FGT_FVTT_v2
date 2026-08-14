/**
 * @file Where the turn budget lives, and who is allowed to spend it.
 * @see docs/18-action-economy.md, docs/26-authority-and-sockets.md
 *
 * Layer 3. The arithmetic is in `rules/budget.mjs` and is pure; this decides
 * *where the number is stored* and routes the write.
 *
 * The budget lives on a **flag of the Combat document**, keyed by faction, and
 * is reset at the start of each faction's turn. Combat is the right home for
 * three reasons: it already exists for the duration of a match and no longer,
 * every client sees it, and the GM can correct it without touching an actor.
 *
 * Writes go through the GM proxy for the same reason every other write does —
 * a player owns their Servants, not the Combat document.
 */

import { emptyBudget, canConsume, consume, canEndTurn, summarize } from "../rules/budget.mjs";

const FLAG = "budgets";

/**
 * Read the acting faction's budget, creating an empty one on first read.
 *
 * @param {object} combat
 * @param {string} factionId
 * @returns {import("../rules/budget.mjs").Budget}
 */
export function budgetFor(combat, factionId) {
  const all = combat?.getFlag?.("fgt", FLAG) ?? {};
  return all[factionId] ?? emptyBudget(maxima());
}

/**
 * Ask whether an action is affordable, without spending anything.
 *
 * Every UI affordance calls this: the attack button is disabled with the
 * refusal as its tooltip rather than failing after the click, which is the
 * difference between a rule the player can plan around and one that ambushes
 * them.
 *
 * @param {object} combat
 * @param {object} unit a `UnitSnapshot`
 * @param {string} action
 * @returns {{ok: boolean, reason: string|null}}
 */
export function affordable(combat, unit, action) {
  const verdict = canConsume(budgetFor(combat, unit.factionId), unit, action);
  return { ok: verdict.ok, reason: verdict.reason };
}

/**
 * Spend the budget for an action, writing the result.
 *
 * @param {object} args
 * @param {object} args.combat
 * @param {object} args.unit a `UnitSnapshot`
 * @param {string} args.action
 * @returns {Promise<{ok: boolean, reason: string|null}>}
 */
export async function spend({ combat, unit, action }) {
  const factionId = unit.factionId;
  const result = consume(budgetFor(combat, factionId), unit, action);
  if (!result.ok) return { ok: false, reason: result.reason };

  await write(combat, factionId, result.budget);
  Hooks.callAll("fgtBudgetChanged", combat, factionId, result.budget);
  return { ok: true, reason: null };
}

/**
 * Clear a faction's budget. Called at the start of that faction's turn, not at
 * the end of it — a budget the player can still see after their turn is the
 * one they want to look at.
 *
 * @param {object} combat
 * @param {string} factionId
 * @returns {Promise<void>}
 */
export async function reset(combat, factionId) {
  await write(combat, factionId, emptyBudget(maxima()));
  Hooks.callAll("fgtBudgetChanged", combat, factionId, budgetFor(combat, factionId));
}

/**
 * May this faction end its turn?
 *
 * @param {object} combat
 * @param {string} factionId
 * @param {object[]} units the faction's unit snapshots
 * @returns {{ok: boolean, unmet: object[]}}
 */
export function endTurnVerdict(combat, factionId, units) {
  return canEndTurn(units.filter((u) => u.factionId === factionId));
}

/**
 * The rows the HUD draws.
 *
 * @param {object} combat
 * @param {string} factionId
 * @returns {object[]}
 */
export function rows(combat, factionId) {
  return summarize(budgetFor(combat, factionId));
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object} combat
 * @param {string} factionId
 * @param {object} budget
 * @returns {Promise<void>}
 */
async function write(combat, factionId, budget) {
  const all = { ...(combat.getFlag("fgt", FLAG) ?? {}), [factionId]: budget };

  if (game.user.isGM) {
    await combat.setFlag("fgt", FLAG, all);
    return;
  }
  const { FGTSocket } = await import("../net/socket.mjs");
  await FGTSocket.request("setBudget", { combatId: combat.id, budgets: all });
}

/**
 * The maxima, from settings, so a table running the 3-player format can widen
 * them without a code change.
 * @returns {object}
 */
function maxima() {
  const configured = game.settings?.settings?.has?.("fgt.budgetMaxima")
    ? game.settings.get("fgt", "budgetMaxima")
    : null;
  return configured ?? {};
}
