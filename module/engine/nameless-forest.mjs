/**
 * @file Walking out of the Nameless Forest.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 * @see docs/14-checks-and-randomness.md
 *
 * Layer 3. The arithmetic is `rules/nameless-forest.mjs` and pure; this rolls
 * the die, writes the result, and says so on the card.
 *
 * > *"During an affected Unit's Turn, it can attempt a Luck Check once per Turn
 * > to remove the effects of this NP (i.e. all Nameless Forest Tokens) from
 * > itself, the effects of the NP are removed on a successful Luck Check
 * > (Health and Luck that are lost from the effects of this NP are not
 * > restored)."*
 *
 * **Can**, not must. Nothing else in the corpus offers a Unit an optional roll
 * on its own Turn — every check today is either compulsory (an Evade in the
 * ladder) or attached to using something — so this is an entry point the owner
 * invokes rather than a prompt the engine pushes. §27.5's default on an
 * unanswered prompt is *"the option that spends nothing"*, and for an escape a
 * Unit may decline that is simply not taking it.
 */

import { lookup } from "../domain/tables.mjs";
import { Rank } from "../domain/rank.mjs";
import { luckCheck, checkPlan } from "../rules/checks.mjs";
import { mayAttemptEscape, escapeModifiers } from "../rules/nameless-forest.mjs";
import { currentBoard } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";

/**
 * Roll a caught Unit's once-per-Turn escape.
 *
 * On success the TOKENS go and the marker with them. **Nothing is written
 * back**: *"Health and Luck that are lost from the effects of this NP are not
 * restored."* That sentence is the whole reason the reductions were built as
 * permanent writes rather than as contributions, and this function is where
 * getting it wrong would be invisible — a restore here would look like
 * generosity rather than like a bug.
 *
 * @param {string} unitId
 * @returns {Promise<{ok: boolean, reason?: string, success?: boolean, result?: object}>}
 */
export async function attemptForestEscape(unitId) {
  const board = currentBoard();
  const unit = (board.units ?? []).find((u) => u.id === unitId);
  if (!unit) return { ok: false, reason: "notFound" };

  const may = mayAttemptEscape(unit, board);
  if (!may.ok) return { ok: false, reason: may.reason };

  // Both terms of the ladder, summed, plus anything else the Unit carries that
  // bears on a Luck Check -- `checkPlan` is what already knows about `Luck
  // Boost`, `Luck Loss` and every authored `CheckModifier`.
  const plan = checkPlan(unit, "luck", { options: new Set() });
  const modifiers = [
    ...escapeModifiers(unit, lookup, (g) => Rank.parseOrNull(g)),
    ...plan.modifiers,
  ];

  const roll = (await new Roll("1d20").evaluate()).total;
  const result = luckCheck({
    roll,
    luck: unit.luck?.value ?? 0,
    hasBoost: (unit.effects ?? []).includes("luckBoost"),
    hasLoss: (unit.effects ?? []).includes("luckLoss"),
    modifiers,
  });

  /** @type {object[]} */
  const intents = [
    // Spent whether or not it succeeded: *"once per Turn"* counts attempts, and
    // a failed escape that cost nothing would be a free reroll every Turn.
    I.markTurn(unitId, { namelessForestAttempts: 1 }),
    I.log({
      kind: "namelessForestEscape", unitId, roll,
      total: result.total, target: result.target, success: result.success,
      modifiers: result.modifiers,
    }),
  ];

  if (result.success) {
    // The tokens, and the marker that hangs from them. NOTHING ELSE -- no stat
    // is written back. See the note above.
    intents.push(I.setResource(unitId, "resources.namelessForestTokens.value", 0));
    intents.push(I.removeEffect(unitId, "namelessForest", "escaped"));
    // *"Every time a Unit successfully removes Nameless Forest Tokens from
    // itself, the chance of it gaining them again is reduced by 10% (base
    // chance=100%); this effect can stack."* A property of the UNIT, so it
    // survives losing every token and being caught again.
    intents.push(I.applyEffect(unitId, {
      defId: "namelessForestResistance", magnitude: 10, expiry: null,
    }, unitId));
  }

  await applyWorldIntents(intents, "namelessForest:escape");
  return { ok: true, success: result.success, result };
}
