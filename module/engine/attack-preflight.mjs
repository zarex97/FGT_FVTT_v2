/**
 * @file The gates a declaration passes before anything is spent or written.
 * @see module/engine/attack.mjs, module/engine/riding.mjs, docs/17-abilities.md, docs/19-action-economy.md
 *
 * Layer 3. `resolveAttack` used to hold these inline, so the one other action
 * that is an attack -- a Riding Attack, which MOVES first -- could not ask them
 * ahead of the displacement. `performRidingAttack` moved the token and stamped
 * `moved`, `acted` and `usedRidingAttack` and only then called `resolveAttack`,
 * whose gates throw: the first-Round ban, the 25-Health Master order limit,
 * `canUseAbility` for a Noble Phantasm ride. In Round 1 a ride that reached
 * somebody left the token on its destination with no attack made (#114).
 *
 * Pure of the apps layer on purpose: `attack.mjs` cannot be imported without it,
 * and a gate that cannot be run cannot be tested.
 */

import { budgetActionFor } from "../rules/budget.mjs";
import { attackForbiddenThisRound } from "../rules/environment.mjs";
import { mayOrderAnotherServant, multiServantRule } from "../rules/relationships.mjs";
import { GRANTS, hasGranted } from "../rules/granted.mjs";
import { actionSourceFor } from "../rules/platforms.mjs";
import { unitFrom, unitActor } from "./board.mjs";
import { pressGate, abilityKind } from "./press-gate.mjs";
import { warRule } from "./war.mjs";

/**
 * @typedef {object} Preflight
 * @property {true} ok
 * @property {object} self the attacker as the board sees it
 * @property {object|null} ability the Item it resolves to; `null` for a Normal Attack
 * @property {string} actionKind the budget's name for the action
 * @property {boolean} free whether the sheet says it costs nothing
 * @property {object|null} master
 * @property {object} usage `canUseAbility`'s verdict, which carries the cost
 */

/**
 * @param {string} message the refusal, in words a player can act on
 * @returns {{ok: false, message: string}}
 */
const refuse = (message) => ({ ok: false, message });

/**
 * Every refusal a declaration can meet before it spends anything, in the order a
 * player can act on them.
 *
 * @param {object} args
 * @param {object} args.attacker the Actor
 * @param {string|null} args.abilityId `null` for a Normal Attack
 * @param {object} [args.placement] the player's choices; `overrides` waives a
 *   refusal a Command Spell can lift
 * @param {object} args.board a board snapshot
 * @param {object} [args.combat] the active Combat
 * @returns {Preflight|{ok: false, message: string, budgetReason?: string}}
 */
export function attackPreflight({ attacker, abilityId, placement = {}, board, combat, resume = false, atWindow = false }) {
  // From the board, not projected alone: ZON is pairwise, so only the board
  // knows whether this Servant is inside its Master's zone -- and that is what
  // `limits.requiresZon` on every Noble Phantasm turns on.
  const self = unitFrom(board, attacker);
  // A Normal Attack this Unit's own ability STANDS IN FOR. *"Can be used by
  // Ozymandias as his Normal Attack while within Ramesseum Tentyris."*
  //
  // Substituted at the DECLARATION, which is the one place that makes the rest
  // of the flow correct for free: the cost, the targeting, the multiplier, the
  // choice of method and the chat card all then run through the ordinary
  // ability machinery instead of through a second, parallel Normal Attack path.
  // The alternative -- teaching `baseSpecFor`, `attackFacts`, the multiplier
  // stage and the cost gate about it one at a time -- is four chances to
  // disagree with each other.
  const substituted = abilityId ? null : replacingNormalAttack(self, attacker, board);
  const ability = abilityId ? attacker.items.get(abilityId) : substituted;

  // Pale Rider's Riding EX passive 3: *"Pale Rider cannot perform Normal
  // Attacks."* Refused ahead of the budget, so the message names the rule
  // rather than reporting an attack slot he was never going to spend -- and
  // ahead of the cost check, because a refused declaration costs nothing.
  //
  // A grant rather than a Range of 0: his sheet prints Base Attack (MAG) 200,
  // which an Attack Skill or a Spell could still spend, and a zero Range would
  // have refused those too.
  if (!ability && hasGranted(self, GRANTS.noNormalAttack)) {
    // fgt-name-ok: the Unit's own player's prompt or notice; its owner knows the name
    return refuse(`${attacker.name} cannot perform Normal Attacks.`);
  }

  // The budget is checked before the targeting is resolved, so a player who
  // has no attacks left is told that rather than being told their target is
  // out of range. Refusals are cheap; a half-resolved attack is not.
  const actionKind = budgetActionFor(ability ? abilityKind(ability) : "normal");
  // An attack the sheet says costs nothing. Kiritsugu's Lethal Gunfire
  // Suppression is *"instantly perform a Normal Attack"* on somebody else's
  // Turn: a real Normal Attack, dealing real damage, billed to nobody -- so it
  // skips the budget on BOTH sides, the check here and the spend below, rather
  // than being excused one and refused by the other.
  //
  // And damage that is only MEASURED as an attack. Akhilleus Kosmos's shove:
  // *"receives damage equivalent to a Normal Attack from Achilles"* -- ruled
  // 2026-10-04 (#184 reading 8): not an Attack, so it spends nothing.
  const free = Boolean(ability?.system?.freeAction) || Boolean(placement?.plainDamage);
  // ...and not a RESUMED declaration. A pre-empted attack paid its budget when
  // it was first declared; asking again found it already spent and refused it,
  // so the attack Jack struck first against never came back (#185, found live:
  // "this unit has already attacked this turn").
  // The aimed Unit. A placement from the canvas names it `unitId`; `targetId`
  // is the older spelling some callers still use. Reading only `targetId`
  // left every target requirement unsatisfiable from the interface: Maria
  // Method 2 was refused on a Female inside the Mist at Night (#185).
  const aimedId = placement?.unitId ?? placement?.targetId ?? null;
  const aimed = aimedId ? unitFrom(board, unitActor(aimedId)) : null;
  // The gate every offer of this press asks too (`press-gate.mjs`, #244): the
  // Turn's budget and `canUseAbility`, priced against the aimed Unit. The
  // `predicate` requirement reads the defender as well: `target:attribute:female`,
  // the second of the three gates on Jack's Maria the Ripper, was unsatisfiable
  // while the option set was built from the attacker alone.
  const gate = pressGate(attacker, ability, {
    board, combat, atWindow, target: aimed, asAttack: true, billsBudget: !free && !resume,
  });
  if (!gate.budget.ok) {
    const verdict = gate.budget;
    // `budgetReason` is how `resolveAttack` knows to TELL the player as well as
    // refuse: a Unit that had already attacked -- after Gather, most naturally --
    // clicked Attack, was shown `✓ Legal`, confirmed, and got silence
    // (§46.4-AW). In the budget's own words, so the two can never drift.
    if (!verdict.ok) return { ...refuse(`Cannot attack: ${verdict.reason}`), budgetReason: verdict.reason };
  }

  // Costs are **validated** at declaration and **paid** at confirmation
  // (Ch. 17): cancelling during targeting must cost nothing, and no rule
  // requires otherwise. So this refuses early, and the payment is below.
  const master = self.masterId ? unitFrom(board, unitActor(self.masterId)) : null;
  // The engine declaring a window-only attack at its window (Kiritsugu's shot,
  // a reaction) passed `atWindow` above: the use gate refuses one anywhere else
  // (#208 reading 8).
  const usage = gate.usage;
  // CS: Force Noble Phantasm bypasses the cooldown and uses-exhausted gates.
  // It explicitly cannot bypass the Round gate, so `overrides` is consulted per
  // reason rather than as a blanket "skip validation".
  const overridden = (placement?.overrides ?? []).includes(usage.reason);
  if (!usage.ok && !overridden) return refuse(`Cannot use this ability: ${usageRefusal(usage, attacker)}`);

  // Ch. 32: at 25 Health or less a Master cannot order more than one of its
  // Servants to Act. Enforced here, where it composes with the ordinary budget.
  if (master && combat?.started) {
    const siblings = board.units.filter((u) => u.masterId === master.id && u.id !== self.id);
    const allowed = mayOrderAnotherServant(master, siblings, {
      grandOrder: warRule("grandOrder"), ruleset: board.ruleset,
    });
    if (!allowed.ok) {
      return refuse(`This Master is at ${multiServantRule(board.ruleset).floor} Health or less and cannot order a second Servant to Act.`);
    }
  }

  // "During the first Round, neither Player/Faction is allowed to Attack"
  // (Ch. 29 step 12). A hard gate at declaration, so the refusal names the rule
  // instead of letting a player discover it as an unexplained targeting error.
  if (combat?.started
    && attackForbiddenThisRound(actionKind, combat.round ?? 1, warRule("noAttackRound"))) {
    return refuse("No attacks are permitted during the first Round.");
  }

  return { ok: true, self, ability, actionKind, free, master, usage };
}

/**
 * The ability that IS this Unit's Normal Attack right now, if one is.
 *
 * `actionSourceFor` answers the question against the board -- the condition is
 * *"while within Ramesseum Tentyris"*, and only the board knows where anybody
 * is standing -- and this maps its answer back onto the item document, because
 * that is what the declaration path needs.
 *
 * @param {object} self the attacker's board unit
 * @param {object} actor
 * @param {object} board
 * @returns {object|null} the ability Item, or `null`
 */
function replacingNormalAttack(self, actor, board) {
  const source = actionSourceFor(self, board);
  if (!source.ability) return null;
  return actor.items.get(source.ability.id) ?? null;
}

/**
 * Turn a refusal into something a player can act on.
 * @param {object} usage
 * @param {object|null} [actor] the attacker, whose items name an exclusion's partner
 * @returns {string}
 */
function usageRefusal(usage, actor = null) {
  const d = usage.detail ?? {};
  // An exclusion names its partner by content id; the player reads its name, as
  // the sheet does (`apps/actor-sheet/present.mjs`). Torrent of Light refused a
  // Mana Burst "on the same Round as lanceturia-torrent-of-light" (#336, live).
  if (d.partner) {
    const named = actor?.items?.find?.((i) => i.id === d.partner || i.system?.contentId === d.partner)?.name;
    if (named) usage = { ...usage, detail: { ...d, partner: named } };
  }
  switch (usage.reason) {
    case "cooldown": return `it is on cooldown for another ${d.remaining} turn(s).`;
    case "round": return `it cannot be used before Round ${d.requiresRound} (this is Round ${d.round}).`;
    case "zon": return "the Servant is outside its Master's ZON.";
    // WHICH ability it waits on, as the bar says it: "An ability it depends on
    // is still cooling" named nothing to wait for (Auctoritas, #351, live).
    case "abilityOffCooldown":
      if (d.names) return game.i18n.format("FGT.Ability.CoolingNamed", { names: d.names });
      return game.i18n.localize("FGT.Ability.Refused.abilityOffCooldown");
    case "masterHealth":
      // The strict comparison is the surprising half, so it is spelled out.
      return `its Master needs MORE than ${usage.cost.amount} Health to pay for it.`;
    case "selfHealth": return `it needs more than ${usage.cost.amount} Health to pay for it.`;
    case "sustainability": return `it needs more than ${usage.cost.amount}◈ of Sustainability.`;
    default: {
      // A failed requirement reports its KIND (`rules/items.mjs`), and the
      // sheet and the bar already word every kind under this key. Printed
      // raw it read "Cannot use this ability: roundPhase" (#185).
      const key = `FGT.Ability.Refused.${usage.reason}`;
      // Formatted with the refusal's detail: "Cannot be used on the same Turn as
      // {partner}" printed its placeholder (#244 review).
      if (usage.reason && globalThis.game?.i18n?.has?.(key)) return game.i18n.format(key, usage.detail ?? {});
      return usage.reason ?? "unknown reason.";
    }
  }
}

// `abilityKind` moved to `press-gate.mjs`, which the gate below and this share (#244).
export { abilityKind };
