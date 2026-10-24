/**
 * @file The gate a press runs, and the offers that ask it (#244).
 * @see module/rules/costs.mjs#canUseAbility, module/engine/skill-use.mjs#useSkill,
 *   module/engine/attack-preflight.mjs, docs/23-reactions.md, docs/34-action-bar.md
 *
 * An offer is a reader of the use gate: a window, a reaction rung or a prompt
 * offers only what its press would let through. Each offer built its own list,
 * and pressing an offer ran a different gate. They disagreed at least eight
 * times, four of them in Kiritsugu's audit (#243): a window offered a Spell the
 * category cap refused, a prompt listed Spells the use gate refused off-Turn.
 *
 * So the press and its offer ask one function. `useSkill` and the attack
 * preflight call `pressGate`; every offer filters its list through `offerable`
 * with the context its press will pass. `tools/check-offers.mjs` holds a new
 * ability prompt to `offerable`, or to a marker saying why not.
 */

import { canUseAbility } from "../rules/costs.mjs";
import { usageSpecFor, classifyAbility, useBudgetKind } from "../rules/ability-use.mjs";
import { budgetActionFor } from "../rules/budget.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import { currentBoard, unitFrom, gateContext, unitActor } from "./board.mjs";
import * as budget from "./budget.mjs";
import { currentWar } from "./war.mjs";

/**
 * The budget's name for an Attack an ability makes.
 *
 * Moved here from `attack-preflight.mjs`, which re-exports it, so the gate and
 * the preflight that calls it share one answer without importing each other.
 *
 * @param {object} ability
 * @returns {string}
 */
export function abilityKind(ability) {
  if (ability.type === "noblePhantasm" || ability.system?.isNP) return "np";
  if (ability.system?.isAttackSkill) return "attackSkill";
  if (ability.system?.isSpell) return "damageSpell";
  // A skill that is not an attack still resolves through this flow when it has
  // phases to run; the budget maps it to a move slot, not an attack slot.
  return classifyAbility(ability).isAttack ? "normal" : "skill";
}

/**
 * Does pressing this ability go through the attack flow?
 *
 * The test the reaction press makes (`attack.mjs`, a `damage` phase routes to
 * `resolveAttack`), so the gate prices and bills the path that will run.
 *
 * @param {object|null} item
 * @returns {boolean}
 */
export function pressesAsAttack(item) {
  return !item || (item.system?.phases ?? []).some((p) => p.kind === "damage");
}

/**
 * Would a press of this ability, now, be let through?
 *
 * `target`: `null` judges the press as `useSkill` does, with no target; a Unit
 * judges requirements against it. `selfOnly` is for a use whose target is not
 * known until after the offer (a billed window use): only the requirements the
 * Unit can answer alone are judged (`rules/items.mjs#SELF_REQUIREMENTS`). A flag,
 * not `target: undefined`: a destructuring default turns `undefined` into the
 * default, and the mode never switched on (#244 review).
 *
 * @param {object} actor the user's Actor
 * @param {object|null} item the ability Item; `null` for a Normal Attack
 * @param {object} [ctx]
 * @param {object} [ctx.board]
 * @param {object|null} [ctx.combat]
 * @param {boolean} [ctx.atWindow] the engine casts it at its own window
 * @param {boolean} [ctx.anyMoment] granted at another ability's moment (#243 reading 9)
 * @param {boolean} [ctx.bypassesCategoryLimit] a use the category cap does not count
 * @param {boolean} [ctx.isCounter]
 * @param {object|null} [ctx.target]
 * @param {boolean} [ctx.selfOnly] judge only what the Unit can answer alone
 * @param {boolean} [ctx.billsBudget] whether the press charges the Turn's budget
 * @param {boolean} [ctx.asAttack] the press is the attack flow's; read off the ability when absent
 * @returns {{ok: boolean, reason: string|null, usage: object, budget: {ok: boolean, reason: string|null}}}
 */
export function pressGate(actor, item, {
  board = currentBoard(), combat = currentWar() ?? null,
  atWindow = false, anyMoment = false, bypassesCategoryLimit = false, isCounter = false,
  target = null, selfOnly = false, billsBudget = true, asAttack = pressesAsAttack(item),
} = {}) {
  const self = unitFrom(board, actor);
  const master = self.masterId ? unitFrom(board, unitActor(self.masterId)) : null;
  const spec = usageSpecFor(item);
  const usage = canUseAbility({
    // Spread FIRST, then OR: an ability may carry the flag on its own document.
    ability: bypassesCategoryLimit && spec ? { ...spec, bypassesCategoryLimit: true } : spec,
    unit: self,
    master,
    board,
    // The Round and the Turn, off the live Moment (`engine/board.mjs`).
    ...gateContext(),
    atWindow,
    anyMoment,
    isCounter,
    target,
    selfOnly,
    testPredicate: (p) => testPredicate(p, {
      options: rollOptionsFor({ attacker: self, ...(target ? { defender: target } : {}) }),
    }),
  });

  // The Turn's budget, in the kind the press bills: the attack flow's for an
  // ability that attacks, the use path's for any other. A free action bills
  // nothing on either. A use free at a window is free at one, and only there:
  // Kazıklı Bey's Active 2 (#330 ruling 9), the use path's own rule.
  const free = Boolean(item?.system?.freeAction) || (atWindow && Boolean(item?.system?.freeAtWindow));
  const kind = asAttack ? (item ? abilityKind(item) : "normal") : useBudgetKind(item);
  const afford = billsBudget && combat?.started && !free
    ? budget.affordable(combat, self, budgetActionFor(kind))
    : { ok: true, reason: null };

  const ok = usage.ok && afford.ok;
  return { ok, reason: ok ? null : (usage.ok ? afford.reason : usage.reason), usage, budget: afford };
}

/**
 * The abilities an offer may show: those a press with this context lets through.
 *
 * `ctx` may be a function of the Item, for an offer whose abilities press
 * differently (a window casts some and bills others; a reaction aims at the
 * attacker or at the Unit in peril).
 *
 * @template T
 * @param {object} actor
 * @param {T[]} items
 * @param {object|((item: T) => object)} [ctx]
 * @returns {T[]}
 */
export function offerable(actor, items, ctx = {}) {
  // One board for the list, built only when no context carries one: a board
  // snapshot is not cheap, and a per-item context usually brings its own.
  let shared = null;
  return [...(items ?? [])].filter((item) => {
    const own = typeof ctx === "function" ? ctx(item) : ctx;
    return pressGate(actor, item, { ...own, board: own.board ?? (shared ??= currentBoard()) }).ok;
  });
}
