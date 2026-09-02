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
  const verdict = canConsume(budgetFor(combat, actingFactionOf(unit)), unit, action);
  return { ok: verdict.ok, reason: verdict.reason };
}

/**
 * Whose pool this unit spends from.
 *
 * Its own faction, unless a Charm has moved it. §25.7 puts a charmed unit in
 * *"the charmer's `currentUnits` during their turn"*, and a unit acting on
 * another faction's Turn has to spend that faction's slots — its owner's pool
 * is not even reset while somebody else is taking their Turn, so charging it
 * would deduct from a budget nobody is using and leave the charmer's
 * untouched.
 *
 * Annotated onto the snapshot by `rules/control.mjs#annotateControl`. The
 * fallback covers a bare `snapshotUnit` that never went through a board.
 *
 * @param {object} unit
 * @returns {string|null}
 */
function actingFactionOf(unit) {
  return unit.actingFactionId ?? unit.factionId ?? null;
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
  // The ACTING faction's pool, not the owning one — see `actingFactionOf`.
  const factionId = actingFactionOf(unit);
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
  // The GM's turn has no faction and no budget. Writing one anyway filed a
  // fresh pool under the literal key "null", which then shadowed nothing and
  // grew a junk entry on the flag every Round.
  if (!factionId) return;
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
