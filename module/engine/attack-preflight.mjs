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

import { canUseAbility } from "../rules/costs.mjs";
import { usageSpecFor, classifyAbility } from "../rules/ability-use.mjs";
import { budgetActionFor } from "../rules/budget.mjs";
import { attacksPermitted } from "../rules/environment.mjs";
import { mayOrderAnotherServant } from "../rules/relationships.mjs";
import { GRANTS, hasGranted } from "../rules/granted.mjs";
import { actionSourceFor } from "../rules/platforms.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import { unitFrom, gateContext } from "./board.mjs";
import * as budget from "./budget.mjs";

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
export function attackPreflight({ attacker, abilityId, placement = {}, board, combat }) {
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
  if (combat?.started && !free) {
    const verdict = budget.affordable(combat, self, actionKind);
    // `budgetReason` is how `resolveAttack` knows to TELL the player as well as
    // refuse: a Unit that had already attacked -- after Gather, most naturally --
    // clicked Attack, was shown `✓ Legal`, confirmed, and got silence
    // (§46.4-AW). In the budget's own words, so the two can never drift.
    if (!verdict.ok) return { ...refuse(`Cannot attack: ${verdict.reason}`), budgetReason: verdict.reason };
  }

  // Costs are **validated** at declaration and **paid** at confirmation
  // (Ch. 17): cancelling during targeting must cost nothing, and no rule
  // requires otherwise. So this refuses early, and the payment is below.
  const master = self.masterId ? unitFrom(board, game.actors.get(self.masterId)) : null;
  const usage = canUseAbility({
    ability: usageSpecFor(ability),
    unit: self,
    master,
    round: combat?.round ?? 1,
    // Ch. 04's Round gate: its numbers are world settings, which Layer 2 may not
    // read, so they travel with the call.
    ...gateContext(),
    // The rest of Ch. 17's requirement kinds need more than the unit: a
    // counterpart check reads the board, and a target-effect check reads the
    // target. Passing neither made those two kinds silently unsatisfiable.
    board,
    target: placement?.targetId ? unitFrom(board, game.actors.get(placement.targetId)) : null,
    // The same gap `engine/skill-use.mjs`'s `useSkill` had: the `predicate`
    // requirement kind (`rules/items.mjs`) refused every use on the ATTACK
    // path too, unconditionally, for the same reason -- nothing ever
    // supplied `ctx.testPredicate`. Semiramis's Summoning: Bašmu is the
    // first damage-dealing ability that names one.
    // The DEFENDER too, when the declaration already names one. A `predicate`
    // requirement mentioning `target:` was unsatisfiable in EVERY case: this
    // built the option set from the attacker alone, so
    // `target:attribute:female` -- the second of the three gates on Jack's
    // Maria the Ripper -- could never be true. The target is resolved a few
    // lines above for the other requirement kinds that need it, and was simply
    // never handed to this one.
    testPredicate: (p) => testPredicate(p, {
      options: rollOptionsFor({
        attacker: self,
        defender: placement?.targetId ? unitFrom(board, game.actors.get(placement.targetId)) : null,
      }),
    }),
  });
  // CS: Force Noble Phantasm bypasses the cooldown and uses-exhausted gates.
  // It explicitly cannot bypass the Round gate, so `overrides` is consulted per
  // reason rather than as a blanket "skip validation".
  const overridden = (placement?.overrides ?? []).includes(usage.reason);
  if (!usage.ok && !overridden) return refuse(`Cannot use this ability: ${usageRefusal(usage)}`);

  // Ch. 32: at 25 Health or less a Master cannot order more than one of its
  // Servants to Act. Enforced here, where it composes with the ordinary budget.
  if (master && combat?.started) {
    const siblings = board.units.filter((u) => u.masterId === master.id && u.id !== self.id);
    const allowed = mayOrderAnotherServant(master, siblings, { grandOrder: game.settings.get("fgt", "grandOrder") });
    if (!allowed.ok) return refuse("This Master is at 25 Health or less and cannot order a second Servant to Act.");
  }

  // "During the first Round, neither Player/Faction is allowed to Attack"
  // (Ch. 29 step 12). A hard gate at declaration, so the refusal names the rule
  // instead of letting a player discover it as an unexplained targeting error.
  if (combat?.started
    && !attacksPermitted(combat.round ?? 1, game.settings.get("fgt", "noAttackRound"))
    && actionKind !== "skill") {
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
 * @returns {string}
 */
function usageRefusal(usage) {
  const d = usage.detail ?? {};
  switch (usage.reason) {
    case "cooldown": return `it is on cooldown for another ${d.remaining} turn(s).`;
    case "round": return `it cannot be used before Round ${d.requiresRound} (this is Round ${d.round}).`;
    case "zon": return "the Servant is outside its Master's ZON.";
    case "masterHealth":
      // The strict comparison is the surprising half, so it is spelled out.
      return `its Master needs MORE than ${usage.cost.amount} Health to pay for it.`;
    case "selfHealth": return `it needs more than ${usage.cost.amount} Health to pay for it.`;
    case "sustainability": return `it needs more than ${usage.cost.amount}◈ of Sustainability.`;
    default: return usage.reason ?? "unknown reason.";
  }
}

/**
 * Does this ability deal no damage at all?
 *
 * An ability that declares **phases** and does not declare a `damage` one is
 * saying what it does, exhaustively. Asterios's *Chaos Labyrinthos* opens with
 * the word *"(Non-damaging)"*; EMIYA's *Unlimited Blade Works* creates a Reality
 * Marble whose toll is an interior event; Semiramis's *Hanging Gardens* is a
 * platform and her *Sikera Ušum* is an area of poison. None of them hits
 * anybody at the moment they are used.
 *
 * All five did. `classifyAbility` routes every Noble Phantasm through
 * `resolveAttack` deliberately -- a non-damaging NP still costs the Servant its
 * Attack -- and the Combat Process always runs its damage stage, where
 * `baseSpecFor` falls back to the caster's **Normal Attack** for an ability with
 * no `damage:` block. So opening the Labyrinth dealt Asterios's full BA(STR) 170
 * plus a crit roll to whichever Unit the fan-out picked. Measured live at 203.
 *
 * The alternative was five content files each carrying
 * `{fixed: true, base: {fixedValue: 0}}`, which is the same statement made five
 * times in a vocabulary that already contains it once, and a sixth author would
 * have had to know to write it.
 *
 * A `damage:` block still wins: Summoning: Bašmu's summon branch selects
 * `{fixed: true, fixedValue: 0}` explicitly, and an ability that declares a
 * damage BLOCK without a damage PHASE (Gáe Bolg Alternative, whose damage is
 * conditional on its Instakill missing) means it.
 *
 * @param {object|null} ability
 * @returns {boolean}
 */
function abilityKind(ability) {
  if (ability.type === "noblePhantasm" || ability.system?.isNP) return "np";
  if (ability.system?.isAttackSkill) return "attackSkill";
  if (ability.system?.isSpell) return "damageSpell";
  // A skill that is not an attack still resolves through this flow when it has
  // phases to run; the budget maps it to a move slot, not an attack slot.
  return classifyAbility(ability).isAttack ? "normal" : "skill";
}

export { abilityKind };
