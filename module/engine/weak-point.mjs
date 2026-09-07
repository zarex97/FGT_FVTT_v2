/**
 * @file Offering and resolving a weak-point attack.
 * @see module/rules/weak-point.mjs, docs/44-case-expanded-roster.md §44.2
 *
 * Layer 3. The arithmetic is pure and lives next door; this is the half that
 * asks the attacker, rolls, and writes.
 *
 * Achilles' Heel is the only weak point in either roster. The shape is:
 *
 *  - **at declaration**, the attacker is offered it, but only when it can land
 *    (`weakPointOffered`) — a prompt in front of every ordinary frontal attack
 *    on him would be a question with one answer;
 *  - **in place of the damage**, `heelResolve` rolls it. On a success the
 *    attack goes through every defence he has and wounds him permanently; on a
 *    failure he Evades, which is the clause that makes declaring it a gamble
 *    rather than a free extra.
 */

import { weakPointChance, weakPointOffered } from "../rules/weak-point.mjs";
import { luckCheck } from "../rules/checks.mjs";
import { unitSnapshot } from "./board.mjs";
import * as I from "./intents.mjs";

/**
 * The weak point this defender exposes to this attack, or `null`.
 *
 * @param {object} defender a Unit projection
 * @param {object} attacker a Unit projection
 * @param {object} state the Combat Process state
 * @param {object|null} [board]
 * @returns {object|null} the spec
 */
export function exposedWeakPoint(defender, attacker, state, board = null) {
  for (const spec of defender?.weakPoints ?? []) {
    if (weakPointOffered(spec, { defender, attacker, state, board })) return spec;
  }
  return null;
}

/**
 * Ask the attacker whether to aim for it.
 *
 * Returns the state unchanged when there is nothing to offer, so the caller can
 * run this over every Process without asking first.
 *
 * @param {object} state the Combat Process state, at `declare`
 * @param {object} [ctx]
 * @param {object|null} [ctx.board]
 * @returns {Promise<object>} the state, with `heel` set when it was taken
 */
export async function offerWeakPoint(state, { board = null } = {}) {
  const attackerDoc = game.actors.get(state.attackerId);
  const defenderDoc = game.actors.get(state.defenderId);
  if (!attackerDoc || !defenderDoc) return state;

  const attacker = unitSnapshot(attackerDoc);
  const defender = unitSnapshot(defenderDoc);
  const spec = exposedWeakPoint(defender, attacker, state, board);
  if (!spec) return state;

  const plain = weakPointChance(spec, { defender, attacker, state, board });
  const withLuck = weakPointChance(spec, { defender, attacker, state, board, luckCheckPassed: true });

  // The Luck Check is a second opt-in INSIDE this offer rather than a rung of
  // its own: it is one decision — "aim low, and how hard" — and splitting it
  // would ask the attacker to commit before knowing what the commitment buys.
  const options = [{
    id: "heel",
    name: game.i18n.format("FGT.WeakPoint.Aim", { name: defenderDoc.name, chance: plain.chance }),
    detail: describe(plain),
  }];
  if (spec.luckCheckBonus && (attacker.luck?.value ?? 0) > 0) {
    options.push({
      id: "heelLuck",
      name: game.i18n.format("FGT.WeakPoint.AimWithLuck", {
        chance: withLuck.chance, bonus: spec.luckCheckBonus,
      }),
      detail: game.i18n.localize("FGT.WeakPoint.LuckHint"),
    });
  }

  const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
  // `min: 0` because declining is the common answer and a real one -- the
  // attacker who does not aim low simply attacks.
  const picked = await ChoiceDialog.pick({
    title: game.i18n.format("FGT.WeakPoint.Title", { name: defenderDoc.name }),
    hint: game.i18n.localize("FGT.WeakPoint.Optional"),
    count: 1,
    min: 0,
    options,
  });
  const taken = (picked ?? [])[0] ?? null;
  if (!taken) return state;

  return {
    ...state,
    heel: {
      declared: true,
      specId: spec.id,
      usesLuck: taken === "heelLuck",
      chance: plain.chance,
      breakdown: plain.breakdown,
    },
    // "Achilles cannot Block Heel Attacks." Added to what the attack already
    // forbids rather than replacing it.
    forbiddenReactions: [...new Set([...(state.forbiddenReactions ?? []), "block"])],
    attack: { ...state.attack, unblockable: true },
  };
}

/**
 * Roll the declared weak-point attack.
 *
 * @param {object} state at `heelResolve`
 * @param {object} [ctx]
 * @param {object|null} [ctx.board]
 * @returns {Promise<{event: string, detail: object}>}
 */
export async function resolveWeakPoint(state, { board = null } = {}) {
  const attackerDoc = game.actors.get(state.attackerId);
  const defenderDoc = game.actors.get(state.defenderId);
  const attacker = unitSnapshot(attackerDoc);
  const defender = unitSnapshot(defenderDoc);
  const spec = (defender?.weakPoints ?? []).find((w) => w.id === state.heel?.specId) ?? null;
  if (!spec) return { event: "fail", detail: { reason: "no weak point" } };

  // The Luck Check first, because its outcome is an input to the chance rather
  // than a re-roll of it. Luck is spent whether or not it succeeds, which is
  // the rule everywhere else and the reason declining is a real option.
  let luckPassed = false;
  let luckRoll = null;
  if (state.heel?.usesLuck) {
    luckRoll = (await new Roll("1d20").evaluate()).total;
    luckPassed = luckCheck({
      roll: luckRoll,
      luck: attacker.luck?.value ?? 0,
      opposingLuck: defender.luck?.value ?? null,
    }).success;
  }

  const { chance, breakdown } = weakPointChance(spec, {
    defender, attacker, state, board, luckCheckPassed: luckPassed,
  });
  const roll = (await new Roll("1d100").evaluate()).total;
  const succeeded = roll <= chance;

  return {
    event: succeeded ? "success" : "fail",
    detail: { chance, roll, breakdown, luckRoll, luckPassed, specId: spec.id },
    // What a success leaves behind. Returned rather than applied here so that
    // the caller writes it in the same batch as everything else the rung does,
    // and so this function stays a roll rather than a write.
    onSuccess: succeeded ? (spec.onSuccess ?? null) : null,
  };
}

/**
 * The permanent mark a successful weak-point attack leaves.
 *
 * Applied with no chance roll and no duration: the sheet states the consequence
 * outright, so there is nothing to resist and nothing to expire. `heelWounded`
 * is `unremovable`, which is what carries "for the rest of the game".
 *
 * @param {object} state at `heelResolve`, after a success
 * @param {object|null} onSuccess the spec's `onSuccess` block
 * @returns {import("./intents.mjs").Intent[]}
 */
export function weakPointIntents(state, onSuccess) {
  if (!onSuccess?.applies) return [];
  return [I.applyEffect(state.defenderId, {
    defId: onSuccess.applies,
    magnitude: 0,
    stage: 0,
    uses: 0,
    expiry: null,
    unremovable: true,
    sourceUnitId: state.attackerId,
    visibility: "public",
  }, state.attackerId)];
}

/**
 * A one-line summary of where a chance came from, for the offer.
 *
 * @param {{chance: number, breakdown: Array<{label: string, delta: number}>}} out
 * @returns {string}
 */
function describe(out) {
  return out.breakdown
    .filter((b) => b.delta !== 0)
    .map((b) => `${game.i18n.localize(`FGT.WeakPoint.Part.${b.label}`)} ${b.delta > 0 ? "+" : ""}${b.delta}`)
    .join(" · ");
}
