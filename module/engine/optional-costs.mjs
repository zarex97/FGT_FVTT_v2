/**
 * @file Spends a Unit is OFFERED at a timing window, rather than charged.
 * @see docs/24-rules-engine.md §24.3, docs/33-case-mannanan.md §33.2
 *
 * Layer 3 (orchestration).
 *
 * Every other price in this system is a *cost*: the engine decides it is owed
 * and takes it (`rules/costs.mjs`, `engine/skill-use.mjs#itemCostIntents`).
 * `OptionalCost` is the other shape — a passive that *offers* a spend at a
 * moment, and the answer is a real decision rather than a formality:
 *
 * > *"At the start of a Combat Phase, Mannanán can remove 1 Fragarach Token
 * > from herself, her Crit Chance is increased by 30% for that Combat Phase."*
 *
 * Holding a token is worth 5% crit **damage** by her own *Tradition Carrier*,
 * and three other things want the same tokens, so spending one for crit
 * *chance* is a trade rather than a freebie. Deciding it for the player would
 * quietly delete the tension the sheet is built around.
 *
 * Offered to **both sides** of the exchange. The window is "a Combat Phase",
 * not "a Combat Phase you declared": she crits when she counters too, and a
 * Fragarach Counter is the whole point of standing there.
 */

import { currentBoard, unitFrom, unitSnapshot } from "./board.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import { resourcePathFor, resourceLabel } from "../domain/resources.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { applyEffect } from "./effect-applier.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import * as I from "./intents.mjs";

/**
 * Guards against re-entry.
 *
 * `declareProcesses` is shared by the declaration path and the §12.8 Counter
 * path, and a Counter is part of the same Combat Phase (§12.1) — so without
 * this the offer would be made a second time inside the exchange it was already
 * answered for, and a Servant with five tokens could be asked five times.
 *
 * Keyed by `groupId`, which is what "one Combat Phase" means everywhere else in
 * this engine (`fireCombatPhaseEnd` counts siblings by it).
 *
 * @type {Set<string>}
 */
const offered = new Set();

/**
 * Offer every optional spend these Units have at a timing window.
 *
 * @param {object} args
 * @param {string[]} args.unitIds everybody in the exchange, attacker first
 * @param {string} args.timing the window, e.g. `combatPhaseStart`
 * @param {string|null} [args.groupId] the Combat Phase, for the once-per guard
 * @returns {Promise<Array<{unitId: string, source: string}>>} what was spent
 */
export async function offerOptionalCosts({ unitIds, timing, groupId = null }) {
  const key = `${groupId ?? "none"}:${timing}`;
  if (groupId && offered.has(key)) return [];
  if (groupId) offered.add(key);

  const board = currentBoard();
  /** @type {Array<{unitId: string, source: string}>} */
  const taken = [];

  for (const unitId of [...new Set(unitIds)].filter(Boolean)) {
    const actor = game.actors.get(unitId);
    if (!actor) continue;
    const unit = unitFrom(board, actor) ?? unitSnapshot(actor);

    for (const spec of (unit.optionalCosts ?? []).filter((c) => c.timing === timing)) {
      if (!canPay(unit, spec.cost)) continue;
      if (!await accepted(actor, unit, spec)) continue;

      await spend({ actor, unit, spec });
      taken.push({ unitId, source: spec.source });
    }
  }
  return taken;
}

/**
 * Forget a Combat Phase, so a later one may offer again.
 *
 * Called from `fireCombatPhaseEnd`. Without it the guard is a leak that also
 * silently refuses every subsequent Phase in a long match.
 *
 * @param {string|null} groupId
 * @returns {void}
 */
export function clearOptionalCostOffers(groupId) {
  if (!groupId) return;
  for (const key of [...offered]) {
    if (key.startsWith(`${groupId}:`)) offered.delete(key);
  }
}

/* -------------------------------------------------------------------------- */

/**
 * A pool's name as the player reads it.
 *
 * `FGT.Pool.<key>` when the corpus has translated it, and the derived form
 * otherwise — the same rule the action bar and the sheet apply, from the same
 * function. Without it the prompt offered to *"spend 1 fragarachTokens"*.
 *
 * @param {string} key
 * @returns {string}
 */
function poolName(key) {
  const translation = `FGT.Pool.${key}`;
  return game.i18n.has(translation) ? game.i18n.localize(translation) : resourceLabel(key);
}

/**
 * Does this Unit hold what the spend asks for?
 *
 * Checked before the prompt rather than after it, for §17.6's reason: an option
 * that refuses when pressed teaches nothing a missing option does not teach
 * faster.
 *
 * @param {object} unit
 * @param {object|null} cost
 * @returns {boolean}
 */
function canPay(unit, cost) {
  if (!cost?.resource) return false;
  return (unit.resources?.[cost.resource]?.value ?? 0) >= (cost.amount ?? 1);
}

/**
 * Ask the Unit's owner, and take silence as "no".
 *
 * A spend nobody answered must not happen: this is a resource the player is
 * saving on purpose, and a timeout that spends it is worse than one that does
 * not.
 *
 * @param {object} actor
 * @param {object} unit
 * @param {object} spec
 * @returns {Promise<boolean>}
 */
async function accepted(actor, unit, spec) {
  const held = unit.resources?.[spec.cost.resource]?.value ?? 0;
  const owner = game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
    ?? game.user;

  try {
    const { FGTSocket } = await import("../net/socket.mjs");
    const picked = await FGTSocket.ask(owner.id, {
      kind: "choose",
      title: spec.source,
      hint: game.i18n.format("FGT.OptionalCost.Hint", {
        name: actor.name,
        amount: spec.cost.amount ?? 1,
        resource: poolName(spec.cost.resource),
        held,
        effect: spec.label ?? spec.source,
      }),
      min: 0,
      count: 1,
      options: [{
        id: "spend",
        name: game.i18n.localize("FGT.OptionalCost.Spend"),
        detail: `${held} available`,
      }],
    });
    return (picked ?? []).includes("spend");
  } catch (err) {
    console.warn(`FGT | ${actor.name}'s optional spend was not answered:`, err);
    return false;
  }
}

/**
 * Take the resource and apply what it bought.
 *
 * Through `effect-applier`, not a bare intent, so the buff it grants goes
 * through immunity, exclusivity, the chance roll and stacking exactly as one
 * from a Skill does — including the duration extension the same Servant's
 * *Tradition Carrier* adds to anything applied to her.
 *
 * @param {object} args
 * @param {object} args.actor
 * @param {object} args.unit
 * @param {object} args.spec
 * @returns {Promise<void>}
 */
async function spend({ actor, unit, spec }) {
  /** @type {object[]} */
  const intents = [
    I.resource(actor.id, resourcePathFor(spec.cost.resource, unit), -(spec.cost.amount ?? 1)),
    I.log({
      kind: "optionalCost", unitId: actor.id, source: spec.source,
      resource: spec.cost.resource, amount: spec.cost.amount ?? 1,
    }),
  ];

  for (const wanted of spec.effects ?? []) {
    const def = EffectRegistry.get(wanted.id ?? wanted.effect?.id);
    if (!def) {
      console.warn(`FGT | ${spec.source} applies unknown effect "${wanted.id}".`);
      continue;
    }
    const outcome = applyEffect({
      def,
      target: unit,
      magnitude: wanted.magnitude ?? def.defaultMagnitude ?? 0,
      npMagnitude: wanted.npMagnitude ?? null,
      duration: wanted.duration ?? def.defaultDuration,
      source: { unitId: actor.id, abilityId: null },
      ctx: {
        turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
        currentTick: game.combat?.system?.globalTurn ?? 0,
        roll: (await new Roll("1d100").evaluate()).total,
        inflictBonus: 0,
        options: rollOptionsFor({ attacker: unit }),
        sourceFactionId: unit.factionId ?? null,
      },
    });
    intents.push(...outcome.intents);
  }

  await applyWorldIntents(intents, "optionalCost");
  await ChatMessage.create({
    content: `<p><strong>${spec.source}</strong> — ${actor.name} spends `
      + `${spec.cost.amount ?? 1} × ${poolName(spec.cost.resource)}.</p>`,
  });
}
