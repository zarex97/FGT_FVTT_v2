/**
 * @file Where the turn budget lives, and who is allowed to spend it.
 * @see docs/19-action-economy.md, docs/38-authority.md
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

import { emptyBudget, canConsume, consume, canEndTurn, summarize, ACTION_KINDS, poolFor } from "../rules/budget.mjs";

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
  warnUnknownAction(action, "affordable");
  // An Attack made outside its owner's Turn is not checked against the attack
  // pool at all. The budget on the flag is the one that faction spent on its
  // OWN last Turn -- `reset` clears it when their next Turn begins, not when
  // the last one ended -- so consulting it here refuses a Servant a defensive
  // reaction because of how aggressive they were a Turn ago. Rho Aias is a
  // shield (Ch. 46 §46.4-AZ).
  if (attackOutsideOwnTurn(combat, unit, action)) return { ok: true, reason: null };
  const verdict = canConsume(budgetFor(combat, actingFactionOf(unit)), unit, action);
  return { ok: verdict.ok, reason: verdict.reason };
}

/**
 * Say so when a caller names an action the budget does not know.
 *
 * `poolFor` answers `null` for an unrecognised action, and a null pool means
 * *"draws from no pool"* — `{ok: true, free: true}`. That is right for a
 * platform or a reaction, which genuinely cost nothing, and catastrophic for a
 * typo: the action is checked against nothing and charged nothing, and it fails
 * **open**, so the only symptom is a Unit that can act slightly more than it
 * should. `engine/skill-use.mjs` passed the ability KIND `"normal"` here for as
 * long as it existed, and nothing ever said a word (Ch. 46 §46.4-AY).
 *
 * Here rather than in `poolFor`: the rules layer is pure and silent — there is
 * not one `console` call under `module/rules/` — and a bad action name arrives
 * from a caller, which is this side of the boundary.
 *
 * @param {string} action
 * @param {string} site the function that was called, for the message
 */
function warnUnknownAction(action, site) {
  if (ACTION_KINDS.includes(action)) return;
  console.warn(
    `FGT | budget.${site}: "${action}" is not a budget action. `
    + `Known: ${ACTION_KINDS.join(", ")}. It will draw from no pool and cost nothing. `
    + "An ability KIND needs rules/budget.mjs#budgetActionFor first.",
  );
}

/**
 * Whose pool this unit spends from.
 *
 * Its own faction, unless a Charm has moved it. Ch. 25 puts a charmed unit in
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
 * Is this an Attack the unit is making **outside its own Turn**?
 *
 * The game's author states the rule as one line:
 *
 * > *"Every Noble Phantasm consumes the attack budget if it is used on its
 * > owner's own Turn, and none does otherwise."*
 *
 * So the exemption is a property of **the moment**, not of the ability. Rho
 * Aias costs EMIYA his Attack when he raises it on his own Turn and costs him
 * nothing when he raises it as a reaction on somebody else's — and that is the
 * same Noble Phantasm, with the same sheet, either way. Giving the content a
 * `countsAsAttack: false` would have exempted it in both, which is why this is
 * derived here instead: a reaction-window Noble Phantasm authored tomorrow
 * inherits it with no content change (Ch. 46 §46.4-AZ).
 *
 * Only the **attack** pools. A reaction that draws from the move pool is
 * already free on somebody else's Turn for the ordinary reason — that faction's
 * budget is not the one being spent.
 *
 * `actingFactionOf` rather than `unit.factionId`, so a **charmed** unit acting
 * on the charmer's Turn is still on "its own" Turn for this purpose: Ch. 25 puts
 * it in the charmer's units, and it spends their slots. The comparison is
 * against the faction the budget is being kept for, which is the same one.
 *
 * @param {object} combat
 * @param {object} unit a `UnitSnapshot`
 * @param {string} action
 * @returns {boolean}
 */
function attackOutsideOwnTurn(combat, unit, action) {
  const pool = poolFor(unit, action);
  if (pool !== "servantAttack" && pool !== "masterAttack") return false;

  const acting = combat?.actingFactionId ?? null;
  // Before the match has an acting faction there is no "somebody else's Turn"
  // to be on, and withholding the charge then would make every attack free.
  if (!acting) return false;

  return actingFactionOf(unit) !== acting;
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
export async function spend({ combat, unit, action, ability = null, board = null }) {
  warnUnknownAction(action, "spend");
  // Nothing to charge: see `attackOutsideOwnTurn`. Skipped on the SAME test the
  // check above uses, so an ability can never be waved through by one and
  // billed by the other.
  if (attackOutsideOwnTurn(combat, unit, action)) return { ok: true, reason: null };
  // The ACTING faction's pool, not the owning one — see `actingFactionOf`.
  const factionId = actingFactionOf(unit);
  const result = consume(budgetFor(combat, factionId), unit, action, {
    // *"Counts as both Castor and Pollux's Attack for the Turn."* Read off the
    // ability rather than off the unit: it is a property of the joint Noble
    // Phantasm, not of being a twin, and their other attacks charge one each.
    alsoCountsAsAttackFor: ability?.system?.alsoCountsAsAttackFor || null,
    board,
  });
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
  return summarize(budgetFor(combat, factionId)).map((row) => ({
    ...row,
    // `summarize` is pure and returns 1 / 0.5 / 0; a CSS class name is not a
    // rule, so the view vocabulary is named here. Handlebars cannot compare
    // numbers without a helper, and `{{#if spent}}` reads 0.5 as "full".
    pips: row.pips.map((v) => (v === 1 ? "full" : v === 0.5 ? "half" : "empty")),
    // Ch. 45 asks for this in as many words: the boundary case is
    // correct and surprising, so the HUD explains it rather than looking broken.
    hint: HALF_POOLS.has(row.pool)
      ? "A linked pair counts as one Unit -- each twin spends half a slot."
      : null,
  }));
}

/** Pools a half-unit can draw from, and therefore render a half-pip in. */
const HALF_POOLS = new Set(["servantMove", "servantAttack"]);

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
