/**
 * @file Spends a Unit is OFFERED at a timing window, rather than charged.
 * @see docs/11-predicates.md, docs/45-case-studies.md
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

import { currentBoard, unitOf, unitActor } from "./board.mjs";
import { resourcePathFor, resourceLabel } from "../domain/resources.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { landEntry } from "./landing.mjs";
import { entryOf } from "../rules/effect-flow.mjs";
import * as I from "./intents.mjs";
import { shownName } from "./public-identity.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";

/**
 * Guards against re-entry.
 *
 * `declareProcesses` is shared by the declaration path and the Ch. 21 Counter
 * path, and a Counter is part of the same Combat Phase (Ch. 21) — so without
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
 * `damageStep` is the attacker's own, once per Process: Ruffian's *"whenever
 * Yan Qing deals damage with an Attack, he can spend X Agility"* is asked after
 * the DU's reaction and before the damage, so an Evade, which never reaches the
 * Damage Step, is never asked (#253 reading 2). `scope` names the Process, so
 * the once-per guard is per Process there and per Phase everywhere else.
 *
 * @param {object} args
 * @param {string[]} args.unitIds everybody in the exchange, attacker first
 * @param {string} args.timing the window, e.g. `combatPhaseStart`
 * @param {string|null} [args.groupId] the Combat Phase, for the once-per guard
 * @param {string|null} [args.scope] a narrower once-per key inside the Phase
 * @param {Set<string>|null} [args.options] the attack's options, for a spend's `attack:` clause
 * @returns {Promise<Array<{unitId: string, source: string, amount: number}>>} what was spent
 */
export async function offerOptionalCosts({ unitIds, timing, groupId = null, scope = null, options = null }) {
  const key = `${groupId ?? "none"}:${timing}${scope ? `:${scope}` : ""}`;
  if (groupId && offered.has(key)) return [];
  if (groupId) offered.add(key);

  const board = currentBoard();
  /** @type {Array<{unitId: string, source: string, amount: number}>} */
  const taken = [];

  for (const unitId of [...new Set(unitIds)].filter(Boolean)) {
    const actor = unitActor(unitId);
    if (!actor) continue;
    const unit = unitOf(actor, board);

    for (const spec of (unit.optionalCosts ?? []).filter((c) => c.timing === timing)) {
      // An `attack:` clause the offer could not answer at collection. No attack
      // in hand means the clause cannot be true, so nothing is offered.
      if (spec.predicate && !(options && testPredicate(spec.predicate, { options }))) continue;
      if (!canPay(unit, spec.cost)) continue;
      const amount = await accepted(actor, unit, spec);
      if (!(amount > 0)) continue;

      await spend({ actor, unit, spec, amount });
      taken.push({ unitId, source: spec.source, amount });
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
 * Checked before the prompt rather than after it, for Ch. 33's reason: an option
 * that refuses when pressed teaches nothing a missing option does not teach
 * faster.
 *
 * @param {object} unit
 * @param {object|null} cost
 * @returns {boolean}
 */
function canPay(unit, cost) {
  if (!cost?.resource) return false;
  return heldOf(unit, cost.resource) >= (isChosen(cost) ? 1 : (cost.amount ?? 1));
}

/**
 * A spend's label with its `{total}` filled for this many units spent: the
 * first effect's magnitude times the amount.
 *
 * @param {object} spec
 * @param {number} amount
 * @returns {string}
 */
function labelWith(spec, amount) {
  const per = spec.effects?.[0]?.magnitude ?? 0;
  return String(spec.label ?? "").replace("{total}", String(per * (spec.scalesWithSpend ? amount : 1)));
}

/** `amount: chosen`: the player picks how much, from 1 up to what is held. */
const isChosen = (cost) => cost?.amount === "chosen";

/**
 * What the Unit holds of a spend's resource: a Ch. 06 pool, or a stat pool the
 * snapshot carries by name (`agility`, `luck`). Ruffian spends Agility, which
 * is not in `resources` (#253 reading 2).
 *
 * @param {object} unit
 * @param {string} key
 * @returns {number}
 */
function heldOf(unit, key) {
  if (unit.resources?.[key]) return unit.resources[key].value ?? 0;
  return Number.isFinite(unit[key]) ? unit[key] : 0;
}

/**
 * Ask the Unit's owner, and take silence as "no".
 *
 * A spend nobody answered must not happen: this is a resource the player is
 * saving on purpose, and a timeout that spends it is worse than one that does
 * not.
 *
 * A chosen amount is asked as one option per amount, 1 up to what is held:
 * Ruffian has no cap (#253 reading 2), and Agility is a pool of about twenty.
 *
 * @param {object} actor
 * @param {object} unit
 * @param {object} spec
 * @returns {Promise<number>} how much to spend; 0 for no
 */
async function accepted(actor, unit, spec) {
  const held = heldOf(unit, spec.cost.resource);
  const owner = game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
    ?? game.user;
  const chosen = isChosen(spec.cost);
  const resource = poolName(spec.cost.resource);
  // A scaling label names its `{total}` on the card; asked before anything is
  // spent, it names one unit's worth, per unit (#253, found live).
  const effect = spec.scalesWithSpend && spec.label
    ? game.i18n.format("FGT.OptionalCost.PerUnit", { effect: labelWith(spec, 1) })
    : (spec.label ?? spec.source);

  try {
    const { FGTSocket } = await import("../net/socket.mjs");
    const picked = await FGTSocket.ask(owner.id, {
      kind: "choose",
      title: spec.source,
      hint: game.i18n.format(chosen ? "FGT.OptionalCost.HintChosen" : "FGT.OptionalCost.Hint", {
        // fgt-name-ok: the Unit's own player's prompt or notice; its owner knows the name
        name: actor.name,
        amount: chosen ? held : (spec.cost.amount ?? 1),
        resource,
        held,
        effect,
      }),
      min: 0,
      count: 1,
      options: chosen
        ? Array.from({ length: held }, (_, k) => ({
          id: String(k + 1),
          name: game.i18n.format("FGT.OptionalCost.SpendN", { amount: k + 1, resource }),
          detail: `${held} available`,
        }))
        : [{
          id: "spend",
          name: game.i18n.localize("FGT.OptionalCost.Spend"),
          detail: `${held} available`,
        }],
    });
    const first = (picked ?? [])[0];
    if (!first) return 0;
    if (!chosen) return first === "spend" ? (spec.cost.amount ?? 1) : 0;
    const n = Number(first);
    return Number.isInteger(n) && n >= 1 && n <= held ? n : 0;
  } catch (err) {
    // fgt-name-ok: console text for the GM and the developer
    console.warn(`FGT | ${actor.name}'s optional spend was not answered:`, err);
    return 0;
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
 * @param {number} args.amount how much the player chose to spend
 * @returns {Promise<void>}
 */
async function spend({ actor, unit, spec, amount }) {
  /** @type {object[]} */
  const intents = [
    I.resource(actor.id, resourcePathFor(spec.cost.resource, unit), -amount),
    I.log({
      kind: "optionalCost", unitId: actor.id, source: spec.source,
      resource: spec.cost.resource, amount,
    }),
  ];

  // Through the one door. The buff it bought is the Unit's own, so the Unit is
  // the caster too -- and its own outgoing bonuses count, where this path
  // passed a hard 0. A spend that scales multiplies each magnitude by what was
  // spent: 7 Agility at 5% each is one +35% (#253 reading 2).
  for (const authored of spec.effects ?? []) {
    const wanted = spec.scalesWithSpend && Number.isFinite(authored.magnitude)
      ? { ...authored, magnitude: authored.magnitude * amount }
      : authored;
    await landEntry(entryOf(wanted), {
      target: unit,
      source: { unitId: actor.id, abilityId: null },
      caster: actor,
      casterUnit: unit,
    }, { write: async (landed) => { intents.push(...landed); } });
  }

  await applyWorldIntents(intents, "optionalCost");
  // What it bought, on the card: a scaling spend names its total (#253).
  const bought = spec.label ? `: ${labelWith(spec, amount)}` : "";
  await ChatMessage.create({
    content: `<p><strong>${spec.source}</strong> — ${shownName(actor)} spends `
      + `${amount} × ${poolName(spec.cost.resource)}${bought}.</p>`,
  });
}
