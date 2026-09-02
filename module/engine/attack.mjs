/**
 * @file The attack flow — declaration through to applied damage.
 * @see docs/12-combat-process.md, docs/27-reaction-protocol.md
 *
 * Layer 3. This is the orchestrator: it drives the Combat Process state
 * machine, asks humans for their rungs, runs the pure pipeline, and applies the
 * result. It does not decide anything the rules layer can decide.
 *
 * The process state is stored on a **chat message flag** rather than in memory,
 * because the ladder spans up to five prompts across two clients and has to
 * survive a reconnect (Ch. 27). Every rung re-reads it, advances it, and writes
 * it back.
 */

import { computeDamage, INJURY_THRESHOLD } from "../rules/damage/pipeline.mjs";
import { resolveTargets } from "../rules/targeting/resolve.mjs";
import { currentBoard, unitSnapshot, unitFrom } from "./board.mjs";
import { evade as evadeCheck, luckCheck, chance, checkPlan, critChance, mergePlans, pendingCheckRolls } from "../rules/checks.mjs";
import * as rollLog from "../rules/roll-log.mjs";
import { effectivePhases } from "../rules/copy.mjs";
import { cooldownFor, alsoTriggered } from "./cooldown.mjs";
import { classifyAbility, targetSpecFor as specForAbility, usageSpecFor } from "../rules/ability-use.mjs";
import { Rank } from "../domain/rank.mjs";
import { lookup } from "../domain/tables.mjs";
import { inAttackRange, chebyshev } from "../domain/geometry.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { collectContributions } from "../rules/elements.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import { normalAttackAt } from "../rules/normal-attack.mjs";
import { absorb, refreshShield } from "./shield.mjs";
import { attackIdentity, recordedAttack } from "../rules/revival.mjs";
import { currentHealth } from "../domain/health.mjs";
import * as process from "./combat-process.mjs";
import * as I from "./intents.mjs";
import { applyIntents } from "./applier.mjs";
import { worldIO } from "./io.mjs";
import { renderAttackCard, updateAttackCard } from "../apps/chat/cards.mjs";
import { applyEffect, inflictBonusOf } from "./effect-applier.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import * as budget from "./budget.mjs";
import { resolveDefeat, pendingRolls, fireEvent } from "./scheduler.mjs";
import { injuryCheck, INJURY_STAT } from "../rules/injury.mjs";
import { canUseAbility, resolveCosts, npCostAt } from "../rules/costs.mjs";
import {
  reactionAbilities, allyReactions, abilityFromOption, abilitiesAtWindow,
} from "../rules/reactions.mjs";
import { attacksPermitted, mayAttackCivilian, civilianKill } from "../rules/environment.mjs";
import { resolveOverpower, resolveUnderpower, mayOrderAnotherServant } from "../rules/relationships.mjs";
import { reactionsRefused, aoeOutcome, isConcealed } from "../rules/concealment.mjs";

/**
 * Declare an attack. Runs on the GM client (Model B — contested outcomes are
 * computed where the authoritative snapshot lives).
 *
 * @param {object} args
 * @param {string} args.attackerId
 * @param {string} args.abilityId  `null` for a normal attack
 * @param {object} args.placement  the player's targeting choices
 * @returns {Promise<{messageId: string, state: object}>}
 */
export async function resolveAttack({ attackerId, abilityId, placement, resume = false }) {
  const attacker = game.actors.get(attackerId);
  if (!attacker) throw new Error(`FGT | Unknown attacker ${attackerId}`);

  const board = boardSnapshot();
  // From the board, not projected alone: ZON is pairwise, so only the board
  // knows whether this Servant is inside its Master's zone -- and that is what
  // `limits.requiresZon` on every Noble Phantasm turns on.
  const self = unitFrom(board, attacker);
  const ability = abilityId ? attacker.items.get(abilityId) : null;
  // The caster's own options, for `targeting.branches`/`cooldown.branches`/
  // `damage.branches` (Summoning: Bašmu) -- computed once here rather than
  // per call site, since `self` does not change across this declaration.
  const options = rollOptionsFor({ attacker: self });

  // The budget is checked before the targeting is resolved, so a player who
  // has no attacks left is told that rather than being told their target is
  // out of range. Refusals are cheap; a half-resolved attack is not.
  const combat = game.combats.active;
  const actionKind = budgetActionFor(ability ? abilityKind(ability) : "normal");
  if (combat?.started) {
    const verdict = budget.affordable(combat, self, actionKind);
    if (!verdict.ok) throw new Error(`FGT | Cannot attack: ${verdict.reason}`);
  }

  // Costs are **validated** at declaration and **paid** at confirmation
  // (§15.4): cancelling during targeting must cost nothing, and no rule
  // requires otherwise. So this refuses early, and the payment is below.
  const master = self.masterId ? unitFrom(board, game.actors.get(self.masterId)) : null;
  const usage = canUseAbility({
    ability: abilityUsageSpec(ability),
    unit: self,
    master,
    round: combat?.round ?? 1,
    // The rest of §15.4's requirement kinds need more than the unit: a
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
  if (!usage.ok && !overridden) throw new Error(`FGT | Cannot use this ability: ${usageRefusal(usage)}`);

  // §16.7: at 25 Health or less a Master cannot order more than one of its
  // Servants to Act. Enforced here, where it composes with the ordinary budget.
  if (master && combat?.started) {
    const siblings = board.units.filter((u) => u.masterId === master.id && u.id !== self.id);
    const allowed = mayOrderAnotherServant(master, siblings, { grandOrder: game.settings.get("fgt", "grandOrder") });
    if (!allowed.ok) {
      throw new Error("FGT | This Master is at 25 Health or less and cannot order a second Servant to Act.");
    }
  }

  // "During the first Round, neither Player/Faction is allowed to Attack"
  // (§19.7 step 12). A hard gate at declaration, so the refusal names the rule
  // instead of letting a player discover it as an unexplained targeting error.
  if (combat?.started && !attacksPermitted(combat.round ?? 1) && actionKind !== "skill") {
    throw new Error("FGT | No attacks are permitted during the first Round.");
  }

  const spec = targetSpecFor(attacker, ability, options);
  const targets = resolveTargets(spec, self, board, placement);

  if (targets.errors.length > 0) {
    throw new Error(`FGT | Illegal attack: ${targets.errors.join(" ")}`);
  }
  if (targets.needsChoice) {
    return { needsChoice: true, candidates: targets.candidates };
  }

  // A barrier is refreshed on the way up, BEFORE the use is recorded: *"every
  // time Rho Aias is used after its first usage, its Health is restored by half
  // of its current Health"*, and `refreshShield` decides first-versus-later
  // from the same counter `recordUse` is about to increment.
  if (ability?.system?.shield) await refreshShield(ability);

  // Declaring the attack is what spends the budget, not landing it: a Noble
  // Phantasm that misses still consumed the Servant's attack for the turn, and
  // *"non-damaging NPs count as the Unit's Attack for that Turn"* says so
  // explicitly.
  // `resume` is the second half of a PRE-EMPTED declaration (see
  // `offerPreemption`): the budget, the costs and the cooldown were all paid
  // when the attack was first declared, before the defender swung first.
  // Charging them again would bill a Servant twice for one attack.
  if (combat?.started && !resume) {
    await budget.spend({ combat, unit: self, action: actionKind });
    const isAttack = actionKind !== "skill";
    await applyBatch(
      [
        I.markTurn(attackerId, isAttack ? { attacked: true, acted: true } : { usedActiveSkill: true, acted: true }),
        // The record every use gate reads. `resolveAttack` kept none, so
        // `oncePerTurn`, both exclusion scales and the whole-match budget were
        // enforced for Skills and quietly ignored for Noble Phantasms.
        ...(ability ? [I.recordUse(attackerId, ability.id, ability.system?.contentId ?? null)] : []),
      ],
      "attack:declared",
    );
  }

  // Confirmation: targeting is settled and legal, so the costs are now paid.
  //
  // Plural, and resolved against each other first (§15.4). A cost may declare
  // that it `supersedes` another -- Karna's NP cost overwrites the 20 Health his
  // Master loses when he Acts, and the Hanging Gardens upkeep overwrites the NP
  // cost the other way -- and charging both would bill more than the rules say.
  const pending = resume ? [] : pendingCosts({ usage, ability, self, master, board });
  const { charged, superseded } = resolveCosts(pending);

  for (const cost of charged) await applyBatch(costIntents(cost, self), "attack:cost");

  // The cooldown, at the same moment as the cost and for the same reason: the
  // ability has been committed. `resolveAttack` never did this, so every Attack
  // Skill and every Noble Phantasm was infinitely reusable -- limited only by
  // the attack budget, which is a different rule.
  if (ability && !resume) {
    const plan = cooldownFor(ability, attackerId, { unit: self });
    const clocks = [...plan.cooldowns, ...alsoTriggered(ability, attacker)];
    const intents = [
      ...clocks.map((c) => I.cooldown(c.actorId, c.abilityId, c.ticks, "set")),
      // A waived cooldown is PAID for -- Scáthach's PRS Token. Her damaging
      // Rune Spells come through this path rather than `useSkill`, so the
      // waiver has to be honoured in both places or it works for Ár and not
      // for Þurs.
      ...plan.spends.map((sp) => I.resource(sp.unitId, sp.key, sp.delta)),
    ];
    if (intents.length > 0) await applyBatch(intents, "attack:cooldown");
  }
  if (superseded.length > 0) {
    // Logged, because a Master who paid 50 where they expected 70 needs to see
    // which rule did that; a silently smaller number reads as a bug.
    await applyBatch(
      [I.log({ kind: "cost", event: "superseded", superseded, unitId: master?.id ?? self.id })],
      "attack:cost",
    );
  }

  // "Used during your Turn OR at the start of a Combat Phase" -- the attacker's
  // second window, offered once for the whole Phase rather than per Process,
  // because a Combat Phase is one exchange however many defenders it catches
  // (§E, `combatPhaseEnd`). Karna's Uncrowned Arms Mastership is the only
  // ability in the reference set that names it, and it had no moment to be used
  // at: the sheet button covers "during your Turn" and nothing covered the rest.
  //
  // After the cost and the cooldown, so an attack that was refused never opens
  // the window, and before any Process exists, so the switch is in force for the
  // crit coin it is about to change.
  const phaseWindow = resume
    ? { windowAbilities: [] }
    : await offerAttackerWindow({ attackerId }, "combatPhaseStart", null);
  if ((phaseWindow.windowAbilities ?? []).length > 0) {
    // Loud, because the alternative is this project's signature defect. A
    // non-mode ability at this window would contribute rules that only
    // `applyDamage` can fold in, and there is no Process yet to carry them to --
    // so they would be collected, discarded, and look like they had applied.
    console.warn(
      "FGT | combatPhaseStart offered a non-mode ability; its rules reach no Combat Process:",
      phaseWindow.windowAbilities,
    );
  }

  // Civilians never enter a Combat Process: "the Civilian is instantly killed"
  // -- no damage calculation, no reaction ladder, no Overpower (Ch. 04 §4.6).
  // Resolved here, before any Process exists, because a Process that always
  // ends the same way is a ladder with one rung.
  const civilians = targets.units
    .map((t) => board.units.find((u) => u.id === t.unitId))
    .filter((u) => u?.kind === "civilian");
  if (civilians.length > 0) {
    const verdict = mayAttackCivilian(self, { overrides: placement?.overrides ?? [] });
    if (!verdict.ok) {
      throw new Error(
        "FGT | A Good-aligned Servant will not kill Civilians. " +
        "Spend a Command Spell (Kill Humans) to override.",
      );
    }
    const descriptors = civilians.flatMap((c) => civilianKill(self, c));
    await applyBatch(civilianIntents(descriptors), "civilianKill");
  }

  // One Combat Process per target — which is what the comment here has always
  // said, and what the code did not do. It took `targets.units[0]` and dropped
  // the rest, so a Noble Phantasm over seven units damaged one of them.
  const attackSpec = {
    abilityId,
    kind: ability ? abilityKind(ability) : "normal",
    // Which Base Attack this uses, and whether Magic Resistance sees it at all.
    // Both are read by Magic Resistance's Instakill/Death ladder, which is
    // exempted for *"an Attack/Attack Skill/Spell/NP that deals STR damage or
    // that is not affected by Magic Resistance"* -- a property of the attack,
    // so it has to travel with the attack.
    component: componentOf(attacker, ability, options),
    // Appendix A treats `Aim` and `Pierce` as properties of the ATTACK, and
    // `evade`/the pipeline have read both by name since they were written --
    // against a spec that carried neither, so no authored Noble Phantasm could
    // ever have one. EMIYA's Hrunting is Aim and his Caladbolg II is Pierce.
    aim: Boolean(resolvedDamage(ability, options)?.aim),
    pierce: Boolean(resolvedDamage(ability, options)?.pierce),
    // The damage TYPE, carried on the attack for the same reason `component` is.
    // The pipeline has read `ctx.attack.element` at stage 0 since it was written
    // -- Fire breaks Freeze, `flamHeal` converts it -- and the attack spec never
    // carried one, so `element:` on an ability document reached the pipeline
    // only through `damageContext` and never through the predicate vocabulary.
    // Karna's Mana Burst (Flames) resists by type in both directions.
    element: resolvedDamage(ability, options)?.element ?? ability?.system?.element ?? null,
    ignoresMagicResistance: Boolean(
      resolvedDamage(ability, options)?.ignoresMagicResistance ?? ability?.system?.ignoresMagicResistance,
    ),
  };
  // "EMIYA performs 2 Normal Attacks in a row." Two Combat PROCESSES against
  // the same defender, inside ONE Combat Phase -- which is the distinction that
  // matters, because a Combat Phase is what pays him his Aria and two phases
  // would pay twice for one action.
  //
  // Bašmu's Dragon Wing Warriors: "X times, where X = a d6 roll + 4" -- a
  // repeat count decided once per declaration rather than a fixed number, so
  // `repeat` accepts `{roll}` alongside the plain integer EMIYA uses. Each
  // repeat is still its own Combat Process and so still its own Injury Roll;
  // "Damaged Units only perform an Injury Roll once regardless of number of
  // hits taken" is a known, unmodelled simplification -- see basmu.yml.
  const repeatSpec = resolvedDamage(ability, options)?.repeat ?? 1;
  const repeat = Math.max(
    1,
    repeatSpec && typeof repeatSpec === "object" && repeatSpec.roll
      ? (await new Roll(repeatSpec.roll).evaluate()).total
      : repeatSpec,
  );
  const targetIds = targets.units.flatMap((t) => Array.from({ length: repeat }, () => t.unitId));

  // The Hanging Gardens' activation: "If Semiramis is Attacked during this
  // period, the period... is interrupted." Declared against, not necessarily
  // hit -- fired here, at declaration, rather than after the damage step.
  if (targetIds.length > 0) {
    const { interruptChannels } = await import("./channel.mjs");
    await interruptChannels(targetIds);
  }

  // "Whenever Jack is Attacked by an enemy Unit, and the AU is within Jack's
  // Range, Jack can Attack first INSTEAD of the opposing Unit."
  //
  // Offered after the declaration is fully paid for and before any Process
  // exists, because the pre-emption replaces the ORDER of this exchange rather
  // than any part of its cost: a pre-empted attacker has still spent its
  // attack for the Turn whether or not it survives to swing.
  if (!resume && targetIds.length > 0) {
    const preempted = await offerPreemption({
      attackerId, abilityId, placement, targetIds, board, self,
    });
    if (preempted) return { preempted: true, messageId: preempted.messageId };
  }

  // A resolution that caught no units is still a resolution — a ground-placed
  // non-damaging NP has a shape and no defenders — so it keeps its single
  // null-defender process rather than becoming an empty fan-out.
  // "Has the Pierce effect ON THE TARGETED UNIT" -- the anchor of the area, not
  // everyone in it. Pierce ignores Invuln and the Block action, so spreading it
  // across the splash would hand the Noble Phantasm a property the sheet gives
  // to one panel.
  const primaryId = attackSpec.pierce && ability?.system?.damage?.pierceOn === "primary"
    ? (placement?.unitId ?? placement?.targetId ?? null)
    : null;
  const states = targetIds.length > 0
    ? process.beginFanOut({
      attackerId,
      targetIds,
      attack: attackSpec,
      // DISTINCT defenders, not processes. Overedge's two swings are two
      // processes against one Unit and are not an area attack; deriving it from
      // the process count would have flipped `attack:isAoE` on for them and
      // suppressed the defender's facing change into the bargain.
      isAoE: new Set(targetIds).size > 1,
    }).map((state) => (primaryId === null
      ? state
      : { ...state, attack: { ...state.attack, pierce: state.defenderId === primaryId } }))
    : [process.begin({ attackerId, defenderId: null, attack: attackSpec })];

  /** @type {Array<{messageId: string, state: object}>} */
  const processes = [];
  for (const state of states) {
    // What this defender could answer with, beyond Block and Evade. Recorded on
    // the state because `pendingPrompt` is pure and cannot read documents, and
    // recorded ONCE at creation because the offer is decided by the moment the
    // attack is declared (§15.3).
    const withReactions = state.defenderId
      ? {
        ...state,
        reactionAbilities: { [state.defenderId]: offeredReactions(state.defenderId, state.attack) },
        // Presence Concealment clause 2: *"This Unit's Attacks cannot be
        // Blocked or Countered unless the DU's current AGI Rank is equal to or
        // higher than it."* Decided once, at declaration, alongside the offer --
        // the same moment and for the same reason.
        forbiddenReactions: concealmentRefusals(attackerId, state.defenderId),
      }
      : state;
    const advanced = process.advance(withReactions, "done");
    const target = targets.units.find((t) => t.unitId === advanced.defenderId);
    const message = await renderAttackCard({
      state: advanced,
      attacker,
      ability,
      targets: target ? [target] : [],
    });

    // A defender with no Luck, no Command Spells and no automatic evasion has
    // exactly one possible outcome at every rung past step 2, so the whole
    // ladder collapses into a single prompt (Ch. 12 §12.3). Asked per defender,
    // because one of four may collapse while the others do not.
    const defenderDoc = game.actors.get(advanced.defenderId);
    const collapse = defenderDoc ? process.laddersCollapse(unitSnapshot(defenderDoc)) : true;

    await message.setFlag("fgt", "process", process.serialize(advanced));
    await message.setFlag("fgt", "collapse", collapse);
    processes.push({ messageId: message.id, state: advanced });

    // §E.3's `attackDeclared`, raised for the first time. It is the moment
    // EMIYA's Kanshou & Bakuya asks about -- "used when EMIYA performs a Normal
    // Attack at a Range of 2 or lower" -- which is a question about the SWING
    // rather than about whether it landed, so `damageStepEnd` would be the
    // wrong rung: a Servant who projected the swords and then missed still
    // projected them.
    await fireAttackDeclared(advanced);
  }

  // Everything the ability does to its USER, which the Combat Process has no
  // rung for: spending a Resource, opening a bounded field, conjuring a squad,
  // asking the player a question. A Noble Phantasm silently did none of it --
  // Unlimited Blade Works consumed no Aria and created no Reality Marble while
  // charging its Master in full.
  if (ability) {
    const { runCasterPhases } = await import("./skill-use.mjs");
    await runCasterPhases(ability, attacker, board);
  }

  // The event two of EMIYA's passives listen for. On the ATTACK path as well as
  // the Skill path, because a Projection Noble Phantasm is a Thaumaturgy Spell
  // by his own sheet's note -- and firing it in only one place is exactly how
  // `abilitiesUsed` came to be recorded by half the game.
  if (ability) {
    const { fireAbilityUsed } = await import("./skill-use.mjs");
    await fireAbilityUsed(attacker, ability);
  }

  return {
    groupId: states[0].groupId,
    processes,
    // The first process, for callers that predate the fan-out.
    messageId: processes[0].messageId,
    state: processes[0].state,
  };
}

/**
 * Advance a waiting Combat Process by one human decision.
 *
 * @param {object} args
 * @param {string} args.messageId
 * @param {string} args.event  the ladder event: `"evade"`, `"success"`, `"declined"`, …
 * @returns {Promise<object>} the new state
 */
export async function advanceAttack({ messageId, event }) {
  const message = game.messages.get(messageId);
  if (!message) throw new Error(`FGT | Unknown attack message ${messageId}`);

  let state = process.deserialize(message.getFlag("fgt", "process"));

  // A reaction ABILITY is used before the ladder moves on, and what it did then
  // shapes the rungs below: Medea's Trofa applies an AutoSucceed on Evade, and
  // Argos applies Def Up that the damage pipeline reads a moment later. So it
  // resolves here rather than being recorded and applied afterwards.
  const reactionAbilityId = abilityFromOption(event);
  if (state.state === "react" && reactionAbilityId) {
    const defender = game.actors.get(state.defenderId);
    // The ability may belong to somebody else entirely -- Rho Aias is projected
    // by a third party standing up to three panels away -- so the owner is read
    // off the offer rather than assumed to be the defender.
    const offer = (state.reactionAbilities?.[state.defenderId] ?? [])
      .find((a) => a.id === reactionAbilityId) ?? null;
    const owner = game.actors.get(offer?.ownerId ?? state.defenderId) ?? defender;
    const used = owner?.items?.get(reactionAbilityId);
    if (used) {
      const { useSkill } = await import("./skill-use.mjs");
      const out = await useSkill({
        actorId: owner.id,
        abilityId: used.id,
        // The Unit in peril is what a third-party reaction points at: Rho Aias
        // is projected in front of the ally who is about to be hit, not in
        // front of its projector.
        placement: owner.id === state.defenderId ? undefined : { unitId: state.defenderId },
      });
      if (!out.ok) ui.notifications?.warn(game.i18n.format("FGT.Skill.Refused", { name: used.name, reason: out.reason }));
    }

    // An auto-evade granted by what was just used takes the Evade rung without
    // a roll. Read AFTER the ability resolved, because that is what granted it.
    const auto = autoEvadeFrom(state, defender);
    if (auto.applies) {
      // A count-limited automatic evasion is SPENT here. `uses` was recorded on
      // every such effect and never decremented, so Medea's Trofa -- authored
      // "1 times" -- evaded every attack for the rest of the match.
      if (auto.consumes) await applyBatch([I.consumeUse(defender.id, auto.consumes)], "autoEvade");

      state = process.advance(state, "evade");
      state = process.advance(state, auto.success ? "success" : "fail", auto.outcome);
      if (auto.success) await fireEvadeSucceeded(state);
      await message.setFlag("fgt", "process", process.serialize(state));
      await updateAttackCard(message, state);
      return state;
    }
  }

  // A reaction choice resolves into a roll before the machine moves on.
  if (state.state === "react" && event === "evade") {
    state = process.advance(state, "evade");
    const outcome = await rollEvade(state);
    state = process.advance(state, outcome.success ? "success" : "fail", outcome);
    if (outcome.success) await fireEvadeSucceeded(state);
  } else if (state.state.startsWith("s2") && event === "contest") {
    const outcome = await rollLuck(state);
    state = process.advance(state, outcome.success ? "success" : "fail", outcome);
  } else if (state.state === "counter" && event === "counter") {
    // Declaring the counter starts a second Process in the opposite direction
    // and finishes this one. The new Process drives itself from here through
    // the same machinery, and cannot be countered in turn.
    const counter = await runCounter(state);
    state = process.advance(state, "counter", { counterMessageId: counter?.messageId ?? null });
  } else {
    state = process.advance(state, event);
  }

  // Drive through every state that needs no human input — pausing at any rung
  // where somebody could interrupt with a Command Spell.
  while (!process.isComplete(state) && !process.pendingPrompt(state)) {
    const interrupted = await awaitInterrupt(message, state);
    if (interrupted) {
      // Somebody spent. Re-read: the interrupt may have moved the Process to a
      // different rung entirely (§17.4, "RESUME, possibly at a different state").
      const reread = process.deserialize(message.getFlag("fgt", "process"));
      // Guard against re-reading BACKWARDS. The flag is only written at the end
      // of this function, so a spurious interrupt would otherwise restore the
      // rung we started from and lose everything since -- which is exactly the
      // freeze this pair of comments describes.
      if (reread.history.length >= state.history.length) state = reread;
      continue;
    }
    state = await runAutomaticStep(state, message);
  }

  await message.setFlag("fgt", "process", process.serialize(state));
  await updateAttackCard(message, state);
  if (process.isComplete(state)) {
    await endConcealmentAfterAttack(state);
    await fireCombatProcessEnd(state);
    await fireCombatPhaseEnd(state);
    // Last, so the deferred half sees a board on which this Process has fully
    // settled -- including a defeat it caused.
    await resumeDeferredAttack(state, message);
  }
  return state;
}

/**
 * Raise `combatProcessEnd` on both combatants, once per Process.
 *
 * §E has listed the event since the reference was written and **nothing ever
 * raised it**, so the one clause in the set that is priced per *Process* rather
 * than per *Phase* had no trigger.
 *
 * The distinction is the whole point and Karna states both halves himself.
 * `Kavacha and Kundala` charges his Master *"at the end of every Turn that Karna
 * is involved in a Combat Phase"*; `Vasavi Shakti` charges the same 20 *"at the
 * end of every Combat Process Karna is involved in"*. A Noble Phantasm over
 * seven Units is one Phase containing seven Processes, so trading the armour
 * away multiplies the bill — which is the cost the sheet is describing, and
 * collapsing the two events would erase it.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireCombatProcessEnd(state) {
  const units = [...new Set([state.attackerId, state.defenderId].filter(Boolean))]
    .map((id) => game.actors.get(id))
    .filter(Boolean)
    .map((a) => unitSnapshot(a));
  if (units.length === 0) return;

  const intents = fireEvent("combatProcessEnd", units, {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: new Set(),
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "combatProcessEnd");
}

/**
 * Raise `attackDeclared` on the attacker, once per Combat Process.
 *
 * Per process rather than per Combat Phase, because the option set describes
 * one defender at one distance -- and every handler in the reference set that
 * listens for it is predicated on exactly those two facts.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireAttackDeclared(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!attacker || !defender) return;

  const intents = fireEvent("attackDeclared", [attacker], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: rollOptions(attacker, defender, state),
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "attackDeclared");
}

/**
 * Reactions a concealed attacker denies this defender.
 *
 * @param {string} attackerId
 * @param {string} defenderId
 * @returns {string[]}
 */
function concealmentRefusals(attackerId, defenderId) {
  const attacker = game.actors.get(attackerId);
  const defender = game.actors.get(defenderId);
  if (!attacker || !defender) return [];
  return reactionsRefused(unitSnapshot(attacker), unitSnapshot(defender));
}

/**
 * Raise `damageDealt` on the attacker, with the victim in reach.
 *
 * §E.5 has listed it since the reference was written and nothing raised it, so
 * every **on-hit rider** in the catalogue was inert: `Bleed Atk`, `Queen's
 * Poison`, and both halves of Serenity's poisoned daggers. All of them are
 * *"Normal Attacks inflict X on the DU"*, which needs two things this is the
 * only place that has together — that the attack landed, and who it landed on.
 *
 * The victim travels as `ctx.victim` rather than in the unit list: a handler on
 * the ATTACKER is what pays out, and putting the defender in the list would run
 * the defender's own handlers for somebody else's attack.
 *
 * @param {object} state
 * @param {object} result the finished damage result
 * @returns {Promise<void>}
 */
async function fireDamageDealt(state, result) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!attacker || !defender) return;

  const intents = fireEvent("damageDealt", [attacker], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    // `attack:crit` is in the set only here, which is right: a clause that asks
    // whether the attack crit is by definition asking about a resolved one.
    options: rollOptions(attacker, defender, state, { crit: Boolean(result?.flags?.isCrit ?? result?.isCrit) }),
    victim: { unitId: state.defenderId },
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "damageDealt");
}

/**
 * Presence Concealment clause 5, at the end of the Combat Process.
 *
 * > *"After performing an Attack while PC is Active, PC is deactivated at the
 * > end of the Combat Process."*
 *
 * At the END, not at the declaration, and the difference is the whole point of
 * the skill: the attack itself is made from concealment, at +100% damage,
 * unblockable and uncounterable. What it costs is the concealment.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function endConcealmentAfterAttack(state) {
  // A counter is the defender attacking; it ends the counterer's concealment on
  // the same terms, so this asks about whoever swung rather than about roles.
  if (!process.didHit(state) && !state.evaded && state.state !== "done") return;
  const { deactivateConcealment } = await import("./concealment.mjs");
  const { DEACTIVATION_REASONS } = await import("../rules/concealment.mjs");
  await deactivateConcealment(state.attackerId, DEACTIVATION_REASONS.attacked);
}

/**
 * Raise `evadeSucceeded` on the unit that evaded.
 *
 * §E.3 has listed this event since the reference was written and nothing ever
 * raised it, so the three abilities in the reference set that pay out for a
 * successful Evade -- EMIYA's *Eye of the Mind (True)* at both Ranks and
 * Heracles's *Eye of the Mind (False)* -- each carried a clause that could not
 * fire. All three are *"upon a successful Evade, reduce the Cooldown of this
 * Skill"*, which is the reward for the defensive read and the reason the Skill
 * is reusable at all.
 *
 * Fired for an automatic Evade as well as a rolled one: `Dodge` is a
 * *"successful Evade"*, and the sheets do not distinguish.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireEvadeSucceeded(state) {
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!defender) return;
  const attacker = unitSnapshot(game.actors.get(state.attackerId));

  const intents = fireEvent("evadeSucceeded", [defender], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    // From the EVADER's point of view: `self` is the unit that dodged and
    // `target` is whoever it dodged, so a clause can pay out differently
    // against a Noble Phantasm than against a Normal Attack.
    options: rollOptionsFor({
      attacker: defender, defender: attacker, attack: attackFacts(attacker, defender, state),
    }),
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "evadeSucceeded");
}

/**
 * Raise `combatPhaseEnd`, once, when every Process in the fan-out has finished.
 *
 * A Combat **Phase** is the whole exchange; a Combat **Process** is one
 * attacker against one defender, and a Noble Phantasm over seven Units is one
 * phase containing seven processes. EMIYA's *Unlimited Blade Works* is *"at the
 * end of every Combat Phase involving EMIYA, he gains 1 Aria"* -- so firing per
 * process would hand him a full charge for one area attack.
 *
 * Completeness is read back off the sibling chat messages rather than counted
 * in memory, because the ladder can span a reconnect and a counter can add a
 * process to the group after the first one finished.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireCombatPhaseEnd(state) {
  // The flag holds a JSON STRING -- `process.serialize` stringifies -- so it has
  // to be parsed before anything can be read off it. Reaching for `.groupId`
  // straight off the flag gave `undefined` for every message, which silently
  // made every fan-out look like a group of one.
  const siblings = state.groupId
    ? game.messages.filter((m) => {
      const raw = m.getFlag("fgt", "process");
      if (!raw) return false;
      try {
        return process.deserialize(raw).groupId === state.groupId;
      } catch {
        return false;
      }
    })
    : [];
  const others = siblings.filter((m) => !process.isComplete(process.deserialize(m.getFlag("fgt", "process"))));
  if (others.length > 0) return;

  // Once per phase. The flag lives on the message rather than in memory so a
  // second `advanceAttack` on an already-finished process -- which the card's
  // buttons make easy -- cannot pay out twice.
  const marker = siblings[0] ?? null;
  if (marker?.getFlag("fgt", "phaseEnded")) return;
  if (marker) await marker.setFlag("fgt", "phaseEnded", true);

  const involved = [
    state.attackerId,
    state.defenderId,
    ...siblings.map((m) => process.deserialize(m.getFlag("fgt", "process")).defenderId),
  ].filter(Boolean);
  const units = [...new Set(involved)]
    .map((id) => game.actors.get(id))
    .filter(Boolean)
    .map((a) => unitSnapshot(a));
  if (units.length === 0) return;

  const intents = fireEvent("combatPhaseEnd", units, {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: new Set(),
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "combatPhaseEnd");
}

/**
 * Execute one state that resolves without asking anybody.
 * @param {object} state
 * @param {object} message
 * @returns {Promise<object>}
 */
async function runAutomaticStep(state, message) {
  switch (state.state) {
    case "damage": {
      // "Used at the start of a Damage Step when performing an Attack" -- the
      // attacker's own window, asked before anything is computed, because what
      // it grants is an input to the computation. Recorded on the state so
      // `applyDamage` can fold the chosen abilities' rules into this one
      // attack and nothing else (§15.3).
      state = await offerAttackerWindow(state, "damageStep", message);

      // Phases that resolve BEFORE the damage, because the damage depends on
      // them. Scáthach's Gáe Bolg Alternative is the case: *"has a 75% chance
      // of inflicting Instakill. **If Instakill is not inflicted**, this NP
      // deals 3.5x damage plus 100."* The branch cannot be expressed as a
      // rider, because a rider fires after a damage step that should not have
      // happened.
      const before = await applyAbilityEffects(state, { flags: {} }, { when: "beforeDamage" });
      const skipped = damageSuppressedBy(state, before);

      // A pre-damage phase can empty a Health bar without any damage being
      // dealt: `Instakill` is "Health reduced to 0", and the damage step that
      // would normally notice is the one it just suppressed. Without this the
      // Servant sits at 0 Health, undefeated, and takes its next turn.
      //
      // Through the same defeat chain damage uses, so `Guts` and God Hand get
      // their say -- which is the difference between Instakill and Death, and
      // the reason the two are separate effects.
      if (skipped) await resolveEmptiedDefender(state);

      const result = skipped
        ? { total: 0, flags: { suppressedBy: skipped }, breakdown: [] }
        : await applyDamage(state, message);

      // Riders declared in the ability's phases land only if the damage did.
      // "Deals 4x damage plus 100. Then inflicts Def Dwn" -- the "then" is
      // conditional on the attack connecting.
      // "If Heads, no damage AND EFFECTS are received." The riders are refused
      // by the same coin that refused the damage; applying them anyway would
      // make a complete negation the strongest debuff delivery in the game.
      const veiled = result.flags?.concealmentVeil?.effects === false;
      const applied = (skipped || veiled) ? [] : await applyAbilityEffects(state, result);

      // §E's `damageStepEnd`, fired for the first time. It has been in the
      // event reference since the reference was written and nothing ever
      // raised it, so a handler authored against it could not fire -- which
      // stayed invisible only because no content used it. Scáthach's Alpi is
      // the first: *"NP Cooldown is reduced by ½◈ Turns at the end of the
      // Damage Step when a successful Attack is performed."*
      if (!skipped && result.total > 0) await fireDamageStepEnd(state);
      // Riders, which need the victim as well as the fact that it landed.
      if (!skipped && result.total > 0) await fireDamageDealt(state, result);

      await message.setFlag("fgt", "damage", result.total);
      await message.setFlag("fgt", "effects", [...before, ...applied].map((a) => a.summary));
      return process.advance(state, "done", { total: result.total });
    }
    case "injury":
      await applyInjury(state, message);
      return process.advance(state, "done");
    case "noDamage":
    case "facing":
      // Facing: the defender turns to face the attacker, but not for AoE.
      if (state.state === "facing" && process.shouldUpdateFacing(state)) {
        await applyFacing(state);
      }
      return process.advance(state, "done");
    case "counter": {
      // Step 6 used to `advance(state, "done")` unconditionally — the rung was
      // reached and never asked anybody anything. Deciding eligibility here is
      // what turns it into a real offer: an eligible defender stops the ladder
      // and is asked, an ineligible one drives straight through as before.
      if (state.counterAvailable !== undefined) return process.advance(state, "done");

      const available = counterAvailable(state);
      await message.setFlag("fgt", "counter", { available });
      const marked = { ...state, counterAvailable: available };
      return available ? marked : process.advance(marked, "done");
    }
    default:
      return process.advance(state, "done");
  }
}

/* -------------------------------------------------------------------------- */
/*  Steps                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Roll the `1d100` for every probabilistic check contribution this unit has.
 *
 * The caller-rolls contract, one more time: `checkPlan` is pure and reads
 * totals out of a map keyed by the contribution's source. Without this the
 * chance would have to be rolled inside the rules layer, and an 80% forced
 * table would stop being reproducible from a recorded roll.
 *
 * @param {object} unit
 * @param {string} check
 * @returns {Promise<Record<string, number>>}
 */
async function rollCheckChances(unit, check) {
  /** @type {Record<string, number>} */
  const rolls = {};
  for (const spec of pendingCheckRolls(unit, check, { direction: "imposed" })) {
    rolls[spec.key] = (await new Roll(spec.formula).evaluate()).total;
  }
  return rolls;
}

/**
 * Roll the Evade. The table is chosen by comparing current Agility, and Mad
 * Enhancement forces the unfavourable one regardless.
 * @param {object} state
 * @returns {Promise<object>}
 */
async function rollEvade(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = unitSnapshot(game.actors.get(state.defenderId));
  const roll = await new Roll("1d20").evaluate();

  // Everything the defender's own abilities have to say about Evade -- Mad
  // Enhancement's forced table, an Agility check penalty, a granted
  // auto-evasion -- arrives through the plan rather than being named here.
  //
  // Plus what the ATTACKER imposes on it. EMIYA's Clairvoyance forces the
  // defender onto the unfavourable table 80% of the time, which is a rule on
  // his sheet and not on theirs, so it can never come from their own plan.
  const options = rollOptions(attacker, defender, state);
  const plan = mergePlans(
    checkPlan(defender, "evade", { options }),
    checkPlan(attacker, "evade", {
      direction: "imposed", options, rolls: await rollCheckChances(attacker, "evade"),
    }),
  );
  const attackProperties = [];
  if (state.attack?.aim) attackProperties.push("aim");
  if (state.attack?.kind === "np") attackProperties.push("np");

  const outcome = evadeCheck({
      roll: roll.total,
      agility: defender.agility,
      hasDodge: (defender.effects ?? []).includes("dodge"),
      attackHasAim: Boolean(state.attack?.aim),
      forceUnfavourable:
        plan.forceTable === "unfavourable" || defender.agility < attacker.agility,
      autoSucceed: plan.autoSucceed,
      attackProperties,
      modifiers: [...evadeModifiers(state, attacker, defender), ...plan.modifiers],
  });

  return {
    ...outcome,
    formula: roll.formula,
    // §14.8: every roll files a record, so a failed Evade can be read back as
    // "the die was low" or "the wrong table was used" instead of one number.
    rollRecord: rollLog.fromCheck(outcome, {
      id: `${state.attackerId}:${state.defenderId}:evade:${game.combat?.system?.globalTurn ?? 0}`,
      globalTurn: game.combat?.system?.globalTurn ?? 0,
      entryId: "evade-",
      formula: roll.formula,
      purpose: `${defender.name} evades ${attacker.name}`,
      actorId: state.defenderId,
    }),
  };
}

/**
 * @param {object} state
 * @param {object} attacker
 * @param {object} defender
 * @returns {Array<{source: string, value: number}>}
 */
function evadeModifiers(state, attacker, defender) {
  const mods = [];
  if (state.attack?.kind === "np") mods.push({ source: "attack is an NP", value: 3 });
  if (state.isAoE) mods.push({ source: "attack is AoE", value: 2 });
  if ((defender.effects ?? []).includes("slow")) mods.push({ source: "Slow", value: 2 });
  if ((defender.effects ?? []).includes("blind")) mods.push({ source: "Blind", value: 3 });
  if ((defender.effects ?? []).includes("immobilize")) mods.push({ source: "Immobilize", value: 4 });
  // "If the DU Evades, the Evade Roll is increased by 4" -- at A+. From the RANK
  // TABLE, not the literal: `presenceConcealmentEvade` has been in
  // `domain/tables.mjs` since the tables were transcribed with nothing reading
  // it, and the corpus uses the skill at five different ranks. Serenity's A+ is
  // 4 and would have been right by accident; Yan Qing's C is 3.
  if (isConcealed(attacker)) {
    const skill = (attacker.abilities ?? []).find((a) => a.slug === "presenceConcealment");
    const rank = skill?.rank instanceof Rank ? skill.rank : Rank.parseOrNull(skill?.rank ?? null);
    const value = rank ? Number(lookup("presenceConcealmentEvade", rank) ?? 4) : 4;
    mods.push({ source: `Presence Concealment ${rank ?? ""}`.trim(), value });
  }
  return mods;
}

/**
 * @param {object} state
 * @returns {Promise<object>}
 */
async function rollLuck(state) {
  const prompt = process.pendingPrompt(state);
  const unit = unitSnapshot(game.actors.get(prompt.unitId));
  const opponentId = prompt.side === "attacker" ? state.defenderId : state.attackerId;
  const opponent = unitSnapshot(game.actors.get(opponentId));
  const roll = await new Roll("1d20").evaluate();

  const plan = checkPlan(unit, "luck");
  const outcome = luckCheck({
    roll: roll.total,
    luck: unit.luck,
    opposingLuck: opponent.luck,
    hasBoost: (unit.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
    hasLoss: (unit.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
    modifiers: plan.modifiers,
  });

  // A Luck Check costs 1 Luck whether or not it succeeds.
  await applyBatch([I.statDelta(prompt.unitId, "luck.value", -1)], "luckCheck");
  return {
    ...outcome,
    formula: roll.formula,
    rollRecord: rollLog.fromCheck(outcome, {
      id: `${prompt.unitId}:luck:${game.combat?.system?.globalTurn ?? 0}:${state.history.length}`,
      globalTurn: game.combat?.system?.globalTurn ?? 0,
      entryId: "luck",
      formula: roll.formula,
      purpose: `${unit.name} contests ${opponent.name}`,
      actorId: prompt.unitId,
    }),
  };
}

/**
 * Turn Civilian-kill descriptors into intents.
 * @param {object[]} descriptors
 * @returns {object[]}
 */
function civilianIntents(descriptors) {
  return descriptors.map((d) => {
    switch (d.kind) {
      case "defeat": return I.defeat(d.unitId, d.cause);
      case "heal": return I.heal(d.unitId, d.amount, d.source);
      case "statDelta": return I.statDelta(d.unitId, d.stat, d.delta);
      default: return I.log({ kind: "unappliedCivilianEffect", effect: d.kind, unitId: d.unitId });
    }
  });
}

/**
 * The ability as the cost rules want to see it.
 *
 * `requiresRound` is read from `targeting.limits`, the same untyped authored
 * object `requiresZon` already lives in — so a round gate is something content
 * can write today, rather than a schema field waiting to be invented.
 *
 * @param {object|null} ability an ability item
 * @returns {object|null}
 */
function abilityUsageSpec(ability) {
  return usageSpecFor(ability);
}

/**
 * Every cost this use would incur, before supersession.
 *
 * The Noble Phantasm cost is the one the rules layer computes; the rest are
 * standing charges the ability or an active platform declares. They arrive here
 * as a flat list precisely so `resolveCosts` can see all of them at once --
 * supersession is a relation between costs, and a cost paid before its
 * supersessor is known has already been paid wrongly.
 *
 * @param {object} args
 * @returns {object[]}
 */
function pendingCosts({ usage, ability, self, master, board }) {
  /** @type {object[]} */
  const out = [];

  if (usage.cost) out.push({ ...usage.cost, id: "npCost" });

  // Standing per-use costs the ability declares, each with its own id so
  // something else can name it in `supersedes`.
  for (const extra of ability?.system?.additionalCosts ?? []) {
    // `masterHealthByNPRank` charges the Noble Phantasm table at a STATED Rank
    // rather than at the ability's own, and through the same rule `npCost`
    // uses -- so a Free Servant pays in Sustainability instead of producing an
    // intent aimed at a Master who does not exist.
    if (extra.kind === "masterHealthByNPRank") {
      out.push({ ...npCostAt({ rank: extra.rank, unit: self, master }), id: extra.id, supersedes: extra.supersedes ?? [] });
      continue;
    }
    out.push({
      kind: extra.kind ?? "masterHealth",
      amount: extra.amount ?? 0,
      unitId: extra.chargesMaster === false ? self.id : master?.id ?? null,
      id: extra.id,
      supersedes: extra.supersedes ?? [],
    });
  }

  // A platform this Servant owns may replace the NP cost outright (Ch. 20).
  const platform = (board.units ?? []).find(
    (u) => u.kind === "platform" && u.ownerId === self.id && u.upkeep,
  );
  if (platform?.upkeep) {
    out.push({
      kind: "masterHealth",
      amount: platform.upkeep.amount ?? 0,
      unitId: master?.id ?? null,
      id: `upkeep:${platform.id}`,
      supersedes: platform.upkeep.supersedes ?? [],
    });
  }

  return out;
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
 * Pay a cost.
 *
 * `statDelta`, never `damage`: this is Health *loss* rather than damage, so it
 * must not trigger damage-keyed effects like `Dmged NP Regen` or an Injury Roll
 * (Ch. 06). Getting that wrong would make every Noble Phantasm feed its own
 * Master's triggers.
 *
 * @param {object} cost
 * @param {object} self the paying unit's snapshot, for a sustainability cost
 * @returns {object[]} intents
 */
function costIntents(cost, self) {
  const note = I.log({ kind: "cost", cost: cost.kind, amount: cost.amount, unitId: cost.unitId });
  switch (cost.kind) {
    case "masterHealth":
    case "selfHealth":
      return [I.statDelta(cost.unitId, "health.value", -cost.amount), note];
    case "sustainability":
      // An ABSOLUTE write, from `self.sustainability` -- the already-resolved
      // remaining figure -- not a relative delta against the raw stored field.
      // That field is `null` until its first write, and a Free Servant's FIRST
      // Noble Phantasm read that `null` as 0 and set the clock to 0 regardless
      // of how much it actually had (same defect `checkRemovals` had; see its
      // comment in `scheduler.mjs`).
      return [I.setResource(cost.unitId, "sustainabilityRemaining", self.sustainability - cost.amount), note];
    default:
      return [note];
  }
}

/**
 * Hold a non-prompting rung open long enough for a Command Spell.
 *
 * §17.4: *"An offer that blocks resolution indefinitely is unacceptable in a
 * game with seven players."* So the wait is bounded by a setting (45s by
 * default, 0 to disable) and ends the moment somebody spends.
 *
 * It costs nothing in the common case: if no Master at the table could
 * actually use a command here, this returns immediately without waiting. That
 * matters, because most rungs of most attacks have no offer at all and a
 * blanket 45-second pause on each would be unplayable.
 *
 * Only the GM waits. The spend arrives over the socket and mutates the Process
 * from that side, which is what `interruptProcess` does.
 *
 * @param {object} message
 * @param {object} state
 * @returns {Promise<boolean>} whether an interrupt landed
 */
async function awaitInterrupt(message, state) {
  if (!game.user.isGM) return false;
  if (!process.interruptible(state)) return false;

  const seconds = game.settings.get("fgt", "commandSpellTimeout") ?? 45;
  if (seconds <= 0) return false;

  const { offerCommands } = await import("./command-spells.mjs");
  const window = process.windowFor(state);
  const anyOffer = game.actors.some((a) =>
    a.type === "master" && offerCommands({ masterId: a.id, window, context: { state: state.state, attack: state.attack } }).length > 0);
  if (!anyOffer) return false;

  // The baseline is the FLAG's current value, not the in-memory state.
  //
  // Comparing against `serialize(state)` compared two different things: the
  // flag still holds the state this call started from, while `state` has
  // already advanced past it. So the very first poll saw a difference, reported
  // "somebody spent" when nobody had, and the caller then re-read the flag --
  // restoring the pre-advance state and discarding the advance.
  //
  // The effect was that any attack reaching an interruptible rung with a Master
  // able to offer a Command Spell froze there permanently. It needed a Master
  // ON THE BOARD to appear at all, which is why it survived every earlier test.
  const before = message.getFlag("fgt", "process");
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (message.getFlag("fgt", "process") !== before) return true;
  }

  // Timed out. Said out loud rather than silently continuing: a player who was
  // disconnected should see that they missed the opportunity.
  await applyBatch(
    [I.log({ kind: "commandSpellWindowClosed", messageId: message.id, atState: state.state })],
    "commandSpell:timeout",
  );
  return false;
}

/**
 * Whether the defender of `state` may counter its attacker (§12.8).
 *
 * Every clause `canCounter` takes is derived here from the board, so the pure
 * check never has to guess and never reads a field nobody writes.
 *
 * @param {object} state
 * @returns {boolean}
 */
function counterAvailable(state) {
  const board = boardSnapshot();
  const attackerDoc = game.actors.get(state.attackerId);
  const defenderDoc = game.actors.get(state.defenderId);
  if (!attackerDoc || !defenderDoc) return false;

  const attacker = unitFrom(board, attackerDoc);
  const defender = unitFrom(board, defenderDoc);
  if (!attacker?.panel || !defender?.panel) return false;

  const held = defender.effects ?? [];
  return process.canCounter(state, {
    defenderAlive: (defenderDoc.system?.health?.value ?? 0) > 0,
    // The DU's range, not the AU's: the counter is the DU attacking.
    attackerInRange: inAttackRange(defender.panel, attacker.panel, defender.range ?? 1),
    attackerHasAccel: (attacker.effects ?? []).includes("accel"),
    defenderCanAct: defender.canAct !== false,
    defenderHasBerserk: held.includes("berserk"),
    defenderHasFragarach: held.includes("fragarach"),
    // AGI **Rank**, not the Agility pool. The pool is a spendable resource that
    // two Servants of the same Rank disagree about constantly, so a Servant who
    // had paid for a few Evades became blockable mid-match for no stated reason.
    attackerConcealedAndFaster: reactionsRefused(attacker, defender).includes("counter"),
  });
}

/**
 * Run the counter as its own Combat Process, roles reversed (§12.8, §27.10).
 *
 * A full Process, not a bare damage roll: Ch. 41 rules that the source's
 * *"Steps 1 and 4 are repeated"* is a typo for "1 **to** 4", because a counter
 * that cannot be evaded and deals no damage is nonsense and Instant Counter's
 * *"skip straight to Step 3"* is only a special property if the normal counter
 * does not skip.
 *
 * No budget is spent — a counter is a reaction, and `budget.spend` lives in
 * `resolveAttack`, which this path does not go through.
 *
 * @param {object} state the process being countered
 * @returns {Promise<{messageId: string, state: object}|null>}
 */
async function runCounter(state) {
  const counterer = game.actors.get(state.defenderId);
  const target = game.actors.get(state.attackerId);
  if (!counterer || !target) return null;

  const counter = process.advance(process.beginCounter(state), "done");
  const message = await renderAttackCard({
    state: counter,
    attacker: counterer,
    ability: null,
    targets: [{ unitId: state.attackerId }],
  });

  await message.setFlag("fgt", "process", process.serialize(counter));
  await message.setFlag("fgt", "collapse", process.laddersCollapse(unitSnapshot(target)));
  return { messageId: message.id, state: counter };
}

/**
 * Combat Process step 4 — the Injury Roll (§12.6).
 *
 * Reached after the damage has already been written, so the defender's Health
 * on the document is the post-damage value the rule wants.
 *
 * @param {object} state
 * @param {object} message
 * @returns {Promise<void>}
 */
async function applyInjury(state, message) {
  const result = message.getFlag("fgt", "result");
  const defenderDoc = game.actors.get(state.defenderId);
  if (!result || !defenderDoc) return;

  // Dragon Wing Warriors: "1d6+4 instances... each can be separately Evaded
  // or Blocked. Damaged Units only perform an Injury Roll ONCE regardless of
  // number of hits taken" — "on the total" (docs/12 §12.6's own reading,
  // matching the reference set's other multi-hit attacks), not "using
  // whichever hit happens to run the check first". Each instance is its own
  // Combat Process and so reaches this step once per hit; naively checking
  // the FIRST hit alone against the 100-damage threshold would mean Dragon
  // Wing Warriors (50 Fixed damage per hit) could never trigger an Injury
  // Roll at all, hit count notwithstanding.
  //
  // `singleInjuryRoll` therefore waits until every sibling process (same
  // `state.groupId`, same defender) has resolved its own damage step, sums
  // them, and performs the one check against the total -- on whichever
  // process turns out to be the LAST to have a `result` recorded, since
  // that is the only point the full total is known. Earlier siblings defer
  // (`singleInjuryRollPending`); later ones find the real verdict already
  // recorded and skip (`singleInjuryRoll`).
  const attackerDoc = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attackerDoc?.items.get(state.attack.abilityId) : null;
  let damage = result.total;
  let exceededThreshold = Boolean(result.flags?.exceededInjuryThreshold);

  if (ability?.system?.damage?.singleInjuryRoll) {
    if (alreadyInjuryRolled(state, message)) {
      await message.setFlag("fgt", "injury", { roll: false, reason: "singleInjuryRoll" });
      return;
    }
    const siblings = siblingInjuryTotals(state);
    if (siblings.pending > 0) {
      await message.setFlag("fgt", "injury", { roll: false, reason: "singleInjuryRollPending" });
      return;
    }
    damage = siblings.total;
    // NOT `siblings.anyExceeded` (whether any ONE hit individually exceeded
    // 100) -- each of Dragon Wing Warriors' hits is 50 Fixed damage, so no
    // single one ever does, and reusing the per-hit flags here would make
    // the "once, on the total" roll never fire regardless of hit count. The
    // pipeline's own Def-Crk-exclusion reasoning for NOT re-deriving this
    // from `damage` (`rules/injury.mjs`'s own comment) is about a single
    // hit's stage-16 addition; a `singleInjuryRoll` attack's total is a sum
    // of already-settled `result.total` values with nothing further to add,
    // so comparing the sum directly is the correct fresh threshold check.
    exceededThreshold = siblings.total > INJURY_THRESHOLD;
  }

  const verdict = injuryCheck({
    exceededThreshold,
    damage,
    healthAfter: defenderDoc.system?.health?.value ?? 0,
    defender: unitFrom(boardSnapshot(), defenderDoc),
    isNP: state.attack?.kind === "np",
    // NOTE: no rung of the reaction ladder offers `Light Wound` yet (Ch. 45
    // D3), so this is always false today. It is read rather than hard-coded so
    // that adding the rung is the only change needed — but it is a gap, and it
    // is recorded as one rather than left to look implemented.
    lightWound: Boolean(state.luckChecks?.lightWound),
  });

  await message.setFlag("fgt", "injury", verdict);
  if (!verdict.roll) return;

  const roll = await new Roll("1d4").evaluate();
  await applyBatch(
    [
      I.statDelta(state.defenderId, INJURY_STAT, -roll.total),
      I.log({ kind: "injury", unitId: state.defenderId, amount: roll.total, tick: game.combat?.system?.globalTurn ?? 0 }),
    ],
    "injury",
  );
  await message.setFlag("fgt", "injury", { ...verdict, amount: roll.total });
}

/**
 * Has a SIBLING process -- the same declaration (`groupId`), the same
 * defender, a different message -- already recorded the REAL Injury Roll
 * verdict for this defender?
 *
 * `singleInjuryRollPending` does not count: that is a sibling saying "I could
 * not tell yet", not "it has been decided" -- counting it would let the
 * decision be skipped forever if this process happened to run before the one
 * that actually resolves it.
 *
 * @param {object} state
 * @param {object} message the current process's own message, excluded from the search
 * @returns {boolean}
 */
function alreadyInjuryRolled(state, message) {
  return game.messages.some((m) => {
    if (m.id === message.id) return false;
    const raw = m.getFlag("fgt", "process");
    if (!raw) return false;
    const sibling = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (sibling.groupId !== state.groupId || sibling.defenderId !== state.defenderId) return false;
    const injury = m.getFlag("fgt", "injury");
    return Boolean(injury) && injury.reason !== "singleInjuryRollPending";
  });
}

/**
 * The combined picture across every sibling process against one defender --
 * total damage taken (each already-settled `result.total`) and how many
 * siblings have not resolved their own damage step yet.
 *
 * @param {object} state
 * @returns {{total: number, pending: number}}
 */
function siblingInjuryTotals(state) {
  let total = 0;
  let pending = 0;
  for (const m of game.messages) {
    const raw = m.getFlag("fgt", "process");
    if (!raw) continue;
    const sibling = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (sibling.groupId !== state.groupId || sibling.defenderId !== state.defenderId) continue;

    const result = m.getFlag("fgt", "result");
    if (!result) {
      pending += 1;
      continue;
    }
    total += result.total;
  }
  return { total, pending };
}

/**
 * Roll for, and then resolve, a defender's defeat.
 *
 * `resolveDefeat` is pure and takes its dice through `ctx.rolls`, so the dice
 * are rolled here — and only the ones the defender's own handlers ask for, via
 * `pendingRolls`. A defender with no revive rolls nothing.
 *
 * @param {object} defender the defender's snapshot, taken *before* the damage
 * @param {number} damage
 * @returns {Promise<object[]>} intents: a revive, or a defeat, or neither
 */
async function resolveDefeatOf(defender, damage, state = {}) {
  // `defender` is a SNAPSHOT, whose `health` is a flat number. Reading
  // `.value` off it gave `undefined`, the `?? 0` made every defender look
  // empty, and the early return never fired -- so a 500-damage hit on a
  // Servant at 3000 went through the whole defeat chain.
  const remaining = currentHealth(defender) - damage;
  if (remaining > 0) return [];

  // CS: Survive Kill, declared earlier in this Process. "The Servant survives
  // with 5% of its Health" — so it is never defeated, and the revive handlers
  // below are not consulted at all. Three Command Spells outrank a skill.
  if (state.survive) {
    const restored = Math.max(1, Math.floor((defender.health?.max ?? 0) * state.survive));
    return [
      I.statDelta(defender.id, "health.value", -remaining + restored, true),
      I.log({ kind: "surviveKill", unitId: defender.id, restored }),
    ];
  }

  const combat = game.combat;
  const ctx = {
    tick: combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound") || 3,
    // How much damage was left over once the Health ran out. God Hand's first
    // passive spends charges against it -- "if the damage of the Attack that
    // defeated Heracles exceeds his current Health, the excess damage is
    // reduced from his newly restored Health, and so on" -- so a very large
    // Noble Phantasm can burn several charges in one resolution.
    overkill: Math.max(0, -remaining),
    rolls: {},
  };
  for (const spec of pendingRolls(defender, "unitDefeated")) {
    ctx.rolls[spec.key] = (await new Roll(spec.formula).evaluate()).total;
  }

  // "Whenever an Attack reduces Heracles' Health to 0 FOR THE FIRST TIME,
  // record that Attack under this Skill." Recorded at the moment the Health
  // runs out and before the revival query -- a recorded Attack is one he
  // survived, and he survives this one or he does not.
  const recording = recordIntents(defender, state);

  // Rebuilt in the SNAPSHOT's shape -- a flat number -- because that is what
  // `resolveDefeat` is given everywhere else and what `currentHealth` reads.
  return [...recording, ...resolveDefeat({ ...defender, health: remaining }, ctx)];
}

/**
 * Record the attack that just emptied this unit's Health, if anything asks.
 *
 * God Hand is the only ability in the reference set that does, and what counts
 * as "that Attack" is a judgement §31.3 makes explicitly: the **ability**, with
 * a per-attacker pseudo-id for Normal Attacks. Recording the attacking *unit*
 * would mean Karna could never kill him again by any means; recording the
 * instance is vacuous, because an instance never recurs.
 *
 * @param {object} defender
 * @param {object} state
 * @returns {object[]}
 */
function recordIntents(defender, state) {
  if (!state.attackerId) return [];

  const identity = attackIdentity(state.attack ?? {}, state.attackerId);
  const doc = game.actors.get(defender.id);
  /** @type {object[]} */
  const out = [];

  for (const item of doc?.items ?? []) {
    if (!item.system?.recordsAttacks) continue;
    // "For the FIRST time" -- a second kill by the same ability records nothing
    // new, which a Set makes free.
    if ([...(item.system.recordedAttacks ?? [])].includes(identity)) continue;
    out.push(I.recordAttack(defender.id, item.id, identity));
  }
  return out;
}

/**
 * Build the damage context, run the pure pipeline, and apply the result.
 * @param {object} state
 * @param {object} message
 * @returns {Promise<object>}
 */
async function applyDamage(state, message) {
  const attackerDoc = game.actors.get(state.attackerId);
  const defenderDoc = game.actors.get(state.defenderId);
  const board = boardSnapshot();
  // Stage 9 subtracts 5d10 when the attacker is outside its Master's ZON, which
  // only the board can answer.
  const attacker = windowAugmented(unitFrom(board, attackerDoc), attackerDoc, state);
  const defender = unitFrom(board, defenderDoc);
  const ability = state.attack?.abilityId ? attackerDoc.items.get(state.attack.abilityId) : null;

  // Once, and shared: the option set the predicates read and the context the
  // pipeline reads have to be describing the same attack.
  const facts = attackFacts(attacker, defender, state);
  const options = rollOptionsFor({ attacker, defender, attack: facts });

  // The crit roll, then every roll the pipeline will consume — rolled HERE so
  // the pipeline itself stays pure and reproducible.
  //
  // A PERCENTAGE, not a `1d2`. §14.6: "the normal chance of getting a Crit
  // would be 50%. Some effects increase and decrease the chance." The coin
  // flip encoded the 50 and made every crit modifier in the game inert --
  // `Crit Up` applied, showed on the sheet, and changed nothing.
  // Hawkeye's crit clauses are predicated on the distance, so the plan cannot
  // be read without the attack in scope.
  const critSpec = critChance(attacker, defender, { options });
  const critRoll = await new Roll("1d100").evaluate();
  const isCrit = critSpec.blocked
    ? false
    : (critSpec.automatic || critRoll.total <= critSpec.percent);
  const attackRoll = await new Roll("5d10").evaluate();

  const ctx = {
    attacker, defender, board,
    attack: {
      // SPREAD, not rebuilt. `component`, `pierce` and `ignoresMagicResistance`
      // are all read by the pipeline and all three were dropped here, which is
      // why Magic Resistance could not be bypassed and Pierce did nothing.
      ...facts,
      abilityId: state.attack?.abilityId ?? null,
      rank: Rank.parseOrNull(ability?.system?.rank),
      categorizedAsNP: Boolean(ability?.system?.categorizedAsNP),
      // The branch-resolved element first, then the ability's own. Rebuilding it
      // from `ability.system` alone would drop a `damage.branches` element the
      // way this block used to drop `component` and `pierce` -- Karna's
      // Brahmastra Kundala is Fire and his Brahmastra is not, and both are the
      // same Servant's Noble Phantasms.
      element: resolvedDamage(ability, options)?.element ?? ability?.system?.element ?? facts.element ?? null,
      // Dragon Wing Warriors: "50 Fixed STR damage". The pipeline has read
      // `ctx.attack.isFixedDamage` (stages 1 and 2, `rules/damage/pipeline.mjs`)
      // since it was written; nothing ever set it from content, so an authored
      // `damage.fixed` was always computed as a normal, modifiable attack.
      //
      // Summoning: Bašmu's summon branch: `resolvedDamage` picks the matching
      // `damage.branches` entry (`{fixed: true, base: {fixedValue: 0}}`) so
      // this Combat Process -- which still runs, she resolves as her own
      // defender -- deals nothing rather than her own Base Attack.
      isFixedDamage: Boolean(resolvedDamage(ability, options)?.fixed) || dealsNoDamage(ability),
    },
    base: dealsNoDamage(ability)
      ? { fixedValue: 0 }
      : baseSpecFor(attackerDoc, ability, facts.range, options),
    multiplier: resolvedDamage(ability, options)?.multiplier ?? 1,
    flatBonus: resolvedDamage(ability, options)?.flatBonus ?? 0,
    conditionalMultipliers: resolvedDamage(ability, options)?.conditionalMultipliers ?? [],
    crit: { isCrit, chanceUsed: critSpec.percent },
    reaction: { kind: state.reaction ?? "none" },
    luckChecks: {},
    rolls: {
      [isCrit ? "attackPlus" : "attackMinus"]: attackRoll.total,
      negation: await rollNegation(defender, state.attack?.kind === "np"),
      // Modifiers whose magnitude is rolled per damage event. Rolled here,
      // once, for both sides, so the pipeline stays pure and a replay of the
      // same rolls reproduces the same number.
      ...(await rollModifierDice([attacker, defender])),
    },
    options,
  };

  const result = computeDamage(ctx);
  // Whether it crit belongs ON the result, not only on the chat flag. Every
  // rider fired after the Damage Step reads its predicate off the option set,
  // and `attack:crit` can only be in that set if the resolved attack says so --
  // Serenity's `Macabre` is *"Normal Attack **Crits** inflict an additional
  // Stage of Poison"* and had no way to ask.
  result.flags = { ...result.flags, isCrit };

  // §16.5. Overpower can end the Master outright before damage matters;
  // Underpower halves a Master's own Total Damage. Both are Master-Servant
  // asymmetries and neither fires between two units of the same kind.
  const overpower = resolveOverpower({
    attacker, defender, roll: (await new Roll("1d100").evaluate()).total,
    luckCheckPassed: Boolean(state.luckChecks?.overpower),
  });
  const underpower = resolveUnderpower({
    attacker, defender, roll: (await new Roll("1d100").evaluate()).total,
  });
  if (underpower.underpowered) {
    const before = result.total;
    result.total = Math.max(0, Math.round(result.total * underpower.factor));
    result.breakdown = [
      ...(result.breakdown ?? []),
      { stage: "underpower", label: "Underpowered (x0.5)", from: before, to: result.total },
    ];
  }
  // The Luck Check that prevents the Overpower also saves the Master from
  // lethal damage -- one success buys both (§16.5).
  if (overpower.survivesLethal && result.total >= currentHealth(defender)) {
    result.total = Math.max(0, currentHealth(defender, 1) - 1);
    result.breakdown = [...(result.breakdown ?? []), { stage: "luckCheck", label: "Survives at 1 Health" }];
  }

  // Command Spell interrupts that changed the number rather than avoiding the
  // attack: Damage Block, Damage Up, Halve Noble Phantasm, NP Max. Applied to
  // the finished total, after every pipeline stage, because each is phrased
  // against "Total Damage" (Ch. 17 §17.2).
  const csFactor = process.damageFactorOf(state);
  if (csFactor !== 1) {
    const before = result.total;
    result.total = Math.max(0, Math.round(result.total * csFactor));
    result.breakdown = [
      ...(result.breakdown ?? []),
      { stage: "commandSpell", label: `Command Spell x${csFactor}`, from: before, to: result.total },
    ];
  }

  // Presence Concealment clause 1, and the reason concealment does not simply
  // make a Unit untargetable:
  //
  //   "This Unit cannot be targeted for an Attack or an enemy Unit's Skill. If
  //    it is caught in an AoE Attack and fails to Evade, Flip a Coin. If Heads,
  //    no damage and effects are received; if Tails, Total Damage taken from
  //    that Attack is reduced by 50% & PC is deactivated."
  //
  // Targeting already drops a concealed Unit from anything *chosen* (§9.7); an
  // area still reaches it, and this is the compensation. On **Total Damage**,
  // so it lands after every pipeline stage and after the Command Spell factor,
  // and before the barrier -- a shield in front of a Unit that took no damage
  // has nothing to absorb.
  if (state.isAoE && isConcealed(defender)) {
    const coin = await new Roll("1d2").evaluate();
    const veil = aoeOutcome(coin.total);
    const before = result.total;
    result.total = Math.max(0, Math.round(result.total * veil.factor));
    result.flags = { ...result.flags, concealmentVeil: veil };
    result.breakdown = [
      ...(result.breakdown ?? []),
      {
        stage: "concealment",
        label: veil.heads
          ? "Presence Concealment: Heads — nothing is received"
          : "Presence Concealment: Tails — Total Damage halved",
        from: before,
        to: result.total,
      },
    ];
    if (veil.deactivates) {
      const { deactivateConcealment } = await import("./concealment.mjs");
      const { DEACTIVATION_REASONS } = await import("../rules/concealment.mjs");
      await deactivateConcealment(defender.id, DEACTIVATION_REASONS.aoe);
    }
  }

  // A barrier standing in front of the defender takes the damage first, and
  // charges its owner for what it took. LAST, after every stage and every
  // Command Spell interrupt, because the sheet says it "will take the damage of
  // the enemy's NP" -- the finished number, not an intermediate one.
  const barrier = absorb(defender, result.total, { options });
  if (barrier.absorbed > 0) {
    result.total = barrier.through;
    result.breakdown = [
      ...(result.breakdown ?? []),
      { stage: "barrier", label: `${barrier.source} absorbed ${barrier.absorbed}`, to: barrier.through },
    ];
  }

  // "These recorded Attacks can no longer defeat Heracles -- whenever a recorded
  // Attack would reduce his Health to 0, his Health will remain at 1 instead."
  // A floor rather than a negation: the damage still lands, it just cannot be
  // the last of it.
  const recorded = recordedAttack(defender, attackIdentity(facts, state.attackerId));
  if (recorded.floored && result.total >= currentHealth(defender)) {
    const before = result.total;
    result.total = Math.max(0, currentHealth(defender) - 1);
    result.breakdown = [
      ...(result.breakdown ?? []),
      { stage: "recorded", label: `${recorded.source}: survives at 1`, from: before, to: result.total },
    ];
  }

  await applyBatch(
    [
      ...barrier.intents,
      I.damage(state.defenderId, result.total, result.breakdown),
      ...(result.flags.defeatedOutright ? [I.defeat(state.defenderId, "petrify")] : []),
      I.log({ kind: "damage", attackerId: state.attackerId, defenderId: state.defenderId, total: result.total }),
      // Damage that empties a Health bar is where `unitDefeated` fires, and
      // until now nothing fired it — so Battle Continuation, which is authored
      // entirely as an `OnEvent: unitDefeated`, could never trigger. The revive
      // is decided *here*, before the defeat is written, because a unit that
      // comes back was never defeated.
      ...(overpower.defeated ? [I.defeat(state.defenderId, "overpowered")] : []),
      ...(result.flags.defeatedOutright || overpower.defeated
        ? [] : await resolveDefeatOf(defender, result.total, state)),
    ],
    "attack",
  );

  await message.setFlag("fgt", "result", {
    total: result.total, magical: result.magical, physical: result.physical,
    breakdown: result.breakdown, flags: result.flags, isCrit,
  });

  return result;
}

/**
 * Roll every rolled modifier the given units carry.
 *
 * Keyed by the modifier's own roll key, so two units carrying the same effect
 * roll separately only if the content gives them separate keys — which is the
 * right default: Goddess of War is hers, and a second copy on somebody else is
 * a different die.
 *
 * @param {object[]} units
 * @returns {Promise<Record<string, number>>}
 */
async function rollModifierDice(units) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const unit of units) {
    for (const m of unit?.modifiers ?? []) {
      if (!m.roll?.formula || out[m.roll.key] !== undefined) continue;
      out[m.roll.key] = (await new Roll(m.roll.formula).evaluate()).total;
    }
  }
  return out;
}

/**
 * Roll every dice-mode `DamageNegation` the defender carries.
 *
 * Battle Continuation is the archetype: `2d10+15` at rank B, and against a
 * Noble Phantasm *the number of dice is doubled* rather than the total — a
 * distinction that matters by about seven points on average, and one the
 * per-Servant sheets are explicit about (Ch. 41 Q16).
 *
 * @param {object} defender the defender's snapshot
 * @param {boolean} isNP
 * @returns {Promise<Array<{source: string, value: number, formula: string}>>}
 */
async function rollNegation(defender, isNP) {
  const out = [];
  for (const n of defender.damageNegation ?? []) {
    if (n.mode !== "dice" || !n.formula) continue;
    const formula = isNP && n.npDiceDoubled ? doubleDice(n.formula) : n.formula;
    const roll = await new Roll(formula).evaluate();
    out.push({ source: n.source, value: roll.total + (n.bonus ?? 0), formula });
  }
  return out;
}

/**
 * Double the dice count of every term in a formula, leaving flat bonuses alone.
 * `2d10+15` becomes `4d10+15`.
 * @param {string} formula
 * @returns {string}
 */
function doubleDice(formula) {
  return String(formula).replace(/(\d+)d(\d+)/gi, (_, n, faces) => `${Number(n) * 2}d${faces}`);
}

/**
 * Apply the effect riders an ability declares in its `phases`.
 *
 * Every application goes through the seven-step pipeline in
 * `effect-applier.mjs`, so immunity, exclusivity, the chance roll and stacking
 * are all honoured -- and every step's outcome is recorded, so the card can say
 * "Burn resisted (rolled 78 vs 65%)" rather than silently doing nothing.
 *
 * @param {object} state
 * @param {object} damageResult
 * @returns {Promise<Array<{summary: object, result: object}>>}
 */
async function applyAbilityEffects(state, damageResult, { when = "afterDamage" } = {}) {
  const attackerDoc = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attackerDoc?.items.get(state.attack.abilityId) : null;
  const defenderDoc = game.actors.get(state.defenderId);
  if (!ability || !defenderDoc) return [];

  // Nothing rides on an attack that dealt nothing. Invuln explicitly does NOT
  // prevent rider debuffs, but it also does not zero the damage to zero via
  // this path -- negation is what matters here.
  if (damageResult.flags?.negatedBy) return [];

  const defender = unitSnapshot(defenderDoc);
  const applied = [];

  // The CASTER's own options, for a phase-level `predicate:` -- the same
  // vocabulary `engine/skill-use.mjs#runPhases` already reads, extended to
  // this loop for Summoning: Bašmu's summon branch (a `summon` phase gated
  // off from the damage-spell branch's `damage`/`applyEffects` pair).
  const attackerUnit = unitFrom(boardSnapshot(), attackerDoc);
  const casterOptions = rollOptionsFor({ attacker: attackerUnit });

  // Through `effectivePhases`, because a copy (§15.7) has none of its own --
  // reading `.phases` directly makes Scáthach's copies load and do nothing.
  for (const phase of effectivePhases(ability.system ?? {}, resolveAbilitySource)) {
    // WHEN this phase runs relative to the damage. Unstated means after, which
    // is what every phase written before this window existed meant.
    if ((phase.when ?? "afterDamage") !== when) continue;
    if (phase.predicate && !testPredicate(phase.predicate, { options: casterOptions })) continue;
    // Medea's Rule Breaker: "removes all buffs from the DU", and then cuts the
    // Contract if the DU is a Servant that FAILED to Evade.
    if (phase.kind === "removeEffect") {
      await applyBatch(removalIntents(phase, defenderDoc), "np:removeEffect");
      continue;
    }
    if (phase.kind === "cutContract") {
      applied.push(...await cutContract(phase, state, defenderDoc));
      continue;
    }
    // A CHECK the defender makes, which branches the Noble Phantasm. Scáthach's
    // Gate of Skye: *"All targeted Units perform a Luck Check ... If the
    // targeted Unit's Luck Check fails, it is inflicted with Death. If the
    // Unit's Luck Check Succeeds, it receives 4x damage plus 100."*
    if (phase.kind === "check") {
      applied.push(...await runCheckPhase(phase, ability, state, defender));
      continue;
    }
    // NOT `summon` (nor `resource`/`statChange`/etc): those are "everything
    // the ability does to its USER, which the Combat Process has no rung
    // for" and already run exactly once, at declaration, through
    // `resolveAttack`'s own `runCasterPhases` call -- `CASTER_PHASES`
    // (engine/skill-use.mjs) lists `summon` explicitly. Adding a second
    // `case "summon"` here double-conjured Bašmu: one from that call, one
    // from this loop's own "afterDamage" pass, found live the moment two
    // appeared from a single cast. This loop's whole job is the two kinds
    // `CASTER_PHASES` deliberately excludes -- `damage` IS the Combat
    // Process, and `applyEffects` is its post-damage rider step, both of
    // which resolve per DEFENDER rather than once per caster.
    if (phase.kind !== "applyEffects" && phase.kind !== "applyEffect") continue;
    // Both authored shapes. §15.2's own is `effects: [{id, ...}]`; the earlier
    // content wrapped each in an `OnEvent` rule element, and both still ship.
    // Reading only `rules` silently dropped every rider on the newer shape --
    // Medea's Aero dealt its damage and inflicted no Bleed.
    for (const rule of phase.rules ?? phase.effects ?? []) {
      const spec = rule.effect ?? rule;
      if (!spec?.id) continue;

      const def = EffectRegistry.get(spec.id);
      if (!def) {
        // Loud, because a missing definition means the ability silently does
        // less than its text says.
        console.warn(`FGT | ${ability.name} applies unknown effect "${spec.id}"`);
        ui.notifications?.warn(`FGT | Unknown effect "${spec.id}" on ${ability.name}`);
        continue;
      }

      const roll = await new Roll("1d100").evaluate();
      const outcome = applyEffect({
        def,
        target: defender,
        chanceModifiers: spec.chanceModifiers ?? rule.chanceModifiers ?? [],
        // The ability's own stated chance, overriding the effect's default.
        chance: spec.chance ?? rule.chance ?? null,
        magnitude: spec.magnitude ?? def.defaultMagnitude ?? 0,
        npMagnitude: spec.npMagnitude ?? rule.npMagnitude ?? null,
        // How many stages one application is worth. *"Inflicts Stage 3 Poison
        // on the DU"* is one application, not three -- three would roll the
        // chance three times and be improved three times by a Debuff ChUp.
        stages: spec.stages ?? rule.stages ?? 1,
        duration: rule.duration ?? spec.duration ?? def.defaultDuration,
        source: { unitId: state.attackerId, abilityId: ability.id },
        ctx: {
          turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
          currentTick: game.combat?.system?.globalTurn ?? 0,
          roll: roll.total,
          // The attacker's own outgoing `ApplicationChance` contributions.
          // Hardcoded to 0 until Medea's Item Construction needed it, which
          // made every outgoing contribution in the game inert.
          inflictBonus: inflictBonusOf(unitSnapshot(game.actors.get(state.attackerId)), def),
          options: rollOptions(unitSnapshot(game.actors.get(state.attackerId)), defender, state),
          resist: 0,
        },
      });

      if (outcome.intents.length > 0) await applyBatch(outcome.intents, "abilityEffect");
      applied.push({
        summary: { id: spec.id, name: def.name, outcome: outcome.outcome, reason: outcome.reason },
        result: outcome,
      });
    }
  }
  return applied;
}

/**
 * Defeat a defender left at zero Health by something other than damage.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function resolveEmptiedDefender(state) {
  const doc = game.actors.get(state.defenderId);
  if (!doc) return;

  const defender = unitFrom(boardSnapshot(), doc);
  if (currentHealth(defender) > 0) return;

  // Zero damage: the Health is already gone. This asks "is it defeated", not
  // "take this much more".
  const intents = await resolveDefeatOf(defender, 0, state);
  if (intents.length > 0) await applyBatch(intents, "terminal");
}

/**
 * Raise `damageStepEnd` on the **attacker**.
 *
 * On the attacker, because the clause that needs it is about attacking: *"when
 * a successful Attack is performed"*. The Defending Unit travels in the option
 * set rather than in the unit list, so a handler can pay out differently
 * against an Undead or Divine target — the second half of Alpi — without the
 * defender's own handlers firing for somebody else's attack.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireDamageStepEnd(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!defender) return;

  const intents = fireEvent("damageStepEnd", [attacker], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: rollOptions(attacker, defender, state),
    rolls: {},
  });

  if (intents.length > 0) await applyBatch(intents, "damageStepEnd");
}

/**
 * A check the DEFENDER makes, and what failing it costs.
 *
 * Scáthach's Gate of Skye is the only one in the reference set, and every part
 * of it is unusual. The check is rolled by the target rather than by the
 * attacker; its difficulty is read from a rank table keyed on the target's own
 * MAG; and failing it is worse than succeeding, because success only means
 * taking 4x damage.
 *
 * `gateOfSkyeSaveModifier` is an **equality** table, not a threshold: *"if
 * their MAG is Rank B, reduce the value rolled by 2; if their MAG is Rank A,
 * reduce it by 4"*, and a `MAG A+` target gets nothing. It has sat in
 * `domain/tables.mjs` since the tables were transcribed with nothing reading
 * it.
 *
 * @param {object} phase
 * @param {object} ability
 * @param {object} state
 * @param {object} defender the defender's snapshot
 * @returns {Promise<object[]>}
 */
async function runCheckPhase(phase, ability, state, defender) {
  const attackerDoc = game.actors.get(state.attackerId);
  const attacker = unitSnapshot(attackerDoc);
  const roll = await new Roll("1d20").evaluate();

  // The table modifier, keyed on the SUBJECT's parameter rather than on the
  // attacker's rank -- which is what makes it a save rather than a to-hit.
  /** @type {Array<{source: string, value: number}>} */
  const tableModifiers = [];
  if (phase.modifierTable) {
    const rank = Rank.parseOrNull(defender.parameters?.[phase.modifierRank ?? "mag"] ?? null);
    const value = Number(lookup(phase.modifierTable, rank) ?? 0);
    if (value !== 0) {
      tableModifiers.push({ source: `${(phase.modifierRank ?? "mag").toUpperCase()} ${rank}`, value });
    }
  }

  const plan = checkPlan(defender, phase.check ?? "luck");
  const outcome = luckCheck({
    roll: roll.total,
    luck: defender.luck,
    opposingLuck: attacker.luck,
    hasBoost: (defender.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
    hasLoss: (defender.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
    modifiers: [...plan.modifiers, ...tableModifiers],
  });

  // A Luck Check costs 1 Luck whether or not it succeeds (Ch. 14).
  await applyBatch([
    I.statDelta(state.defenderId, "luck.value", -1),
    I.log({
      kind: "check", check: phase.check ?? "luck", unitId: state.defenderId,
      roll: outcome.roll, total: outcome.total, target: outcome.target, success: outcome.success,
      modifiers: outcome.modifiers,
    }),
  ], "np:check");

  const branch = outcome.success ? phase.onSuccess : phase.onFail;
  if (!branch?.effects?.length) return [];

  return applyDeclaredEffects(branch.effects, ability, state, defender);
}

/**
 * Apply a list of authored effect specs to the defender.
 *
 * Extracted so the check phase and the ordinary rider path build the same
 * application with the same context — two constructions of `applyEffect`'s
 * argument object is two places for `inflictBonus` or the option set to go
 * missing, which is how outgoing contributions were inert once already.
 *
 * @param {object[]} specs
 * @param {object} ability
 * @param {object} state
 * @param {object} defender
 * @returns {Promise<object[]>}
 */
async function applyDeclaredEffects(specs, ability, state, defender) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  /** @type {object[]} */
  const out = [];

  for (const spec of specs) {
    const def = EffectRegistry.get(spec.id);
    if (!def) {
      console.warn(`FGT | ${ability.name} applies unknown effect "${spec.id}"`);
      continue;
    }

    const roll = await new Roll("1d100").evaluate();
    const outcome = applyEffect({
      def,
      target: defender,
      magnitude: spec.magnitude ?? def.defaultMagnitude ?? 0,
      npMagnitude: spec.npMagnitude ?? null,
      duration: spec.duration ?? def.defaultDuration,
      chanceModifiers: spec.chanceModifiers ?? [],
      chance: spec.chance ?? null,
      source: { unitId: state.attackerId, abilityId: ability.id },
      ctx: {
        turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
        currentTick: game.combat?.system?.globalTurn ?? 0,
        roll: roll.total,
        inflictBonus: inflictBonusOf(attacker, def),
        options: rollOptions(attacker, defender, state),
        resist: 0,
      },
    });

    if (outcome.intents.length > 0) await applyBatch(outcome.intents, "npCheckEffect");
    out.push({
      summary: { id: spec.id, name: def.name, outcome: outcome.outcome, reason: outcome.reason },
      result: outcome,
    });
  }
  return out;
}

/**
 * Which effect, having landed before the damage, cancels it.
 *
 * `damage.skipIf.effectApplied` names it. Gáe Bolg Alternative: *"If Instakill
 * is not inflicted, this NP deals 3.5x damage plus 100"* — so a **successful**
 * Instakill is what suppresses the damage, and a failed one lets it through.
 *
 * Only `applied` counts. A `resisted` or `blocked` Instakill did not happen,
 * and the Noble Phantasm falls back to its damage exactly as the sheet says.
 *
 * @param {object} state
 * @param {object[]} before the results of the pre-damage phases
 * @returns {string|null} the effect that suppressed it
 */
function damageSuppressedBy(state, before) {
  const attackerDoc = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attackerDoc?.items.get(state.attack.abilityId) : null;
  const skipIf = ability?.system?.damage?.skipIf ?? null;
  if (!skipIf?.effectApplied) return null;

  const landed = before.some(
    (a) => a.summary.id === skipIf.effectApplied && a.summary.outcome === "applied",
  );
  return landed ? skipIf.effectApplied : null;
}

/**
 * @param {object} state
 */
async function applyFacing(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = unitSnapshot(game.actors.get(state.defenderId));
  const di = attacker.panel.i - defender.panel.i;
  const dj = attacker.panel.j - defender.panel.j;
  const facing = Math.abs(di) >= Math.abs(dj)
    ? (di < 0 ? "n" : "s")
    : (dj > 0 ? "e" : "w");
  await applyBatch([I.setFacing(state.defenderId, facing)], "facing");
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @param {object[]} intents
 * @param {string} source
 */
async function applyBatch(intents, source) {
  return applyIntents(intents, {
    io: worldIO(),
    canWrite: (unitId) => game.actors.get(unitId)?.isOwner ?? false,
    isGM: game.user.isGM,
    source,
  });
}

/** @returns {object} */
function boardSnapshot() {
  return currentBoard({ region: game.settings.get("fgt", "region") || null });
}

/**
 * A normal attack targets one unit inside the attack-Range shape; an ability
 * declares its own targeting.
 * @param {object} attacker
 * @param {object|null} ability
 * @param {Set<string>|null} [options] the caster's own roll options, for
 *   `targeting.branches`
 * @returns {object}
 */
function targetSpecFor(attacker, ability, options = null) {
  return specForAbility(ability, attacker.system.range?.panels ?? 1, options);
}

/**
 * The targeting spec for an attack, exported so the canvas preview resolves the
 * same declaration the resolution will.
 *
 * Two implementations of "what does this ability target" is the fastest route
 * to a preview that lies, so there is one.
 *
 * @param {object} attacker an `FGTActor`
 * @param {object|null} ability
 * @param {Set<string>|null} [options]
 * @returns {object}
 */
export function targetSpecForAttack(attacker, ability, options = null) {
  return targetSpecFor(attacker, ability, options);
}

/**
 * @param {object} attacker
 * @param {object|null} ability
 * @returns {object}
 */
function baseSpecFor(attacker, ability, range = null, options = null) {
  const dmg = resolvedDamage(ability, options);
  if (dmg?.base) return dmg.base;

  // A DECLARED component, which decides the arithmetic and not only what the
  // attack counts as.
  //
  // `componentOf` has read `damage.component` since it was written -- so an
  // ability declaring `mag` was correctly exempt from the wrong half of Magic
  // Resistance and correctly matched `attack:component:mag` -- while the number
  // was still built from the Servant's *Normal Attack* component. Every Noble
  // Phantasm in the corpus that states a Base Attack without spelling out a
  // `base` block was therefore computed from the other one: Serenity's Zabaniya
  // multiplied BA(STR) 65 where her sheet says BA(MAG) 100, and EMIYA's
  // Hrunting and Caladbolg II, Medea's Aero and Rain of Light, and three of
  // Scáthach's four all did the same. Found live.
  const declared = dmg?.component ?? null;
  if (declared) return { sources: [{ unit: "self", component: declared, factor: 1 }] };

  // Through the same rule the option set used, so the number the pipeline adds
  // up and the component a predicate tests cannot disagree.
  return { sources: normalAttackAt({ normalAttack: attacker.system.normalAttack }, range).sources };
}

/**
 * Build the roll-option set the predicates evaluate against.
 * @param {object} attacker
 * @param {object} defender
 * @param {object} state
 * @returns {Set<string>}
 */
function rollOptions(attacker, defender, state, extra = {}) {
  // Built in the rules layer, where it can be tested without Foundry. It used
  // to be built here, which is why two whole clause families -- `skill:` and
  // `region:` -- went years without ever being emitted.
  return rollOptionsFor({
    attacker, defender, attack: { ...attackFacts(attacker, defender, state), ...extra },
  });
}

/**
 * Everything about THIS attack that a predicate may ask about.
 *
 * One builder, because there were four call sites and each spread a different
 * subset. Three of them rebuilt `attack` from scratch and dropped
 * `component`, `ignoresMagicResistance` and `pierce` on the way -- fields the
 * damage pipeline reads by name -- so Magic Resistance's own exemption clause
 * and every `Pierce` in the game were decided against a spec that never
 * carried them.
 *
 * @param {object} attacker attacker snapshot
 * @param {object} defender defender snapshot
 * @param {object} state the Combat Process state
 * @returns {object}
 */
export function attackFacts(attacker, defender, state) {
  const range = attackDistance(attacker, defender);
  const kind = state.attack?.kind ?? "normal";
  const facts = { ...(state.attack ?? {}), kind, isAoE: Boolean(state.isAoE), range };

  // A Normal Attack that changes shape with distance decides two of these
  // fields itself, and only here -- the declaration cannot, because the
  // distance is not known until there is a defender. EMIYA at Range 3 is a
  // combined STR/MAG shot that Magic Resistance does not see; at Range 2 the
  // same button is a plain STR attack.
  if (kind !== "normal") return facts;
  const normal = normalAttackAt(attacker, range);
  return {
    ...facts,
    component: normal.component,
    ignoresMagicResistance: facts.ignoresMagicResistance || normal.ignoresMagicResistance,
  };
}

/**
 * How many panels apart the two units are, or `null` when either has no panel.
 *
 * Chebyshev, which is what "at a Range of 3 or higher" counts: the attack-range
 * shape clips the outer ring's corners at R >= 3 (§8.2), but that is about
 * which panels are *reachable*, not about how far away the one you hit is.
 *
 * @param {object} attacker
 * @param {object} defender
 * @returns {number|null}
 */
function attackDistance(attacker, defender) {
  const from = attacker?.panel;
  const to = defender?.panel;
  if (!from || !to) return null;
  if (![from.i, from.j, to.i, to.j].every((n) => typeof n === "number")) return null;
  return chebyshev(from, to);
}

/**
 * @param {object} ability
 * @returns {string}
 */
/**
 * Which Base Attack an attack draws on.
 *
 * The ability may state it — Medea's Rule Breaker is a Caster's Noble Phantasm
 * that uses Base Attack (STR), and Scáthach's two Noble Phantasms use one each
 * — otherwise the Unit's own normal attack decides.
 *
 * @param {object} attacker the actor document
 * @param {object|null} ability
 * @returns {"str"|"mag"}
 */
function componentOf(attacker, ability, options = null) {
  const dmg = resolvedDamage(ability, options);
  const declared = dmg?.component ?? dmg?.base?.sources?.[0]?.component;
  return declared ?? attacker?.system?.normalAttack?.component ?? "str";
}

/**
 * The ability's `damage:` block, resolved for whichever behaviour is
 * actually firing.
 *
 * Summoning: Bašmu's `damage:` differs by branch the same way its
 * `cooldown:` and `targeting:` do (`cooldown.branches` in
 * `engine/cooldown.mjs`, `targeting.branches` in
 * `rules/ability-use.mjs#targetSpecFor`) -- its summon branch has a real
 * Combat Process (she resolves as her own defender, same as any self-cast
 * Spell) but deals no damage at all, and the Combat Process ladder always
 * runs the damage stage regardless of which phase is conceptually active.
 * `{fixed: true, base: {fixedValue: 0}}` is the existing "deals no damage"
 * vocabulary, selected per branch rather than invented per ability.
 *
 * Recomputed at every call site rather than resolved once and threaded
 * through, because the Combat Process is stateful across chat-message
 * advances (`advanceAttack` re-fetches the ability fresh each time) --
 * exactly how `ctx.attack.isFixedDamage` already works, extended to the rest
 * of the `damage:` block.
 *
 * @param {object|null} ability
 * @param {Set<string>|null} options the caster's own roll options
 * @returns {object|null}
 */
function resolvedDamage(ability, options) {
  const dmg = ability?.system?.damage ?? null;
  if (!dmg?.branches?.length || !options) return dmg;
  const match = dmg.branches.find((b) => testPredicate(b.predicate, { options }));
  return match ?? dmg;
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
function dealsNoDamage(ability) {
  if (!ability) return false;
  const sys = ability.system ?? {};
  if (sys.damage) return false;
  const phases = sys.phases ?? [];
  return phases.length > 0 && !phases.some((p) => p.kind === "damage");
}

function abilityKind(ability) {
  if (ability.type === "noblePhantasm" || ability.system?.isNP) return "np";
  if (ability.system?.isAttackSkill) return "attackSkill";
  if (ability.system?.isSpell) return "damageSpell";
  // A skill that is not an attack still resolves through this flow when it has
  // phases to run; the budget maps it to a move slot, not an attack slot.
  return classifyAbility(ability).isAttack ? "normal" : "skill";
}

/**
 * Map an ability kind onto the action the budget and the prevention table know.
 *
 * The distinction that matters is `damageSpell` → `spell`: `Seal` spares Spells
 * and `Silence` hits only them, so collapsing the two would make both effects
 * wrong in opposite directions.
 *
 * @param {string} kind
 * @returns {string}
 */
function budgetActionFor(kind) {
  // A non-attack skill draws from the MOVE pool (D18.2), so it must not fall
  // through to the attack default -- that would cost the Servant its attack.
  return { np: "np", damageSpell: "spell", attackSkill: "attack", normal: "attack", skill: "skill" }[kind]
    ?? "attack";
}

/** Re-exported so a macro can roll a raw chance without importing the rules layer. */
export { chance };

/**
 * A copied ability's source, by content id.
 *
 * Searched across every actor on the board rather than in the packs: a copy
 * points at the *instance* on the field, and the field is where a rank shift or
 * a suppression applied to that instance is visible.
 *
 * @param {string} contentId
 * @returns {object|null}
 */
function resolveAbilitySource(contentId) {
  for (const actor of game.actors ?? []) {
    const found = actor.items?.find(
      (i) => i.system?.contentId === contentId || i.id === contentId,
    );
    if (found) return found;
  }
  return null;
}

/**
 * Strip effects a Noble Phantasm removes.
 *
 * By **polarity** when a selector says so, because "removes all buffs" has to
 * cover buffs authored after the ability was written. Unremovable effects stay:
 * Appendix A marks a few that no cleanse reaches, and a blanket removal must
 * not be the exception that does.
 *
 * @param {object} phase
 * @param {object} doc the defender
 * @returns {object[]}
 */
function removalIntents(phase, doc) {
  const named = (phase.effects ?? [phase.effect]).filter(Boolean).map((e) => e.id ?? e);
  const selector = phase.selector ?? null;

  const ids = named.length > 0
    ? named
    : doc.effects
      .filter((e) => {
        const def = EffectRegistry.get(e.system?.defId);
        if (!def) return false;
        if (selector?.polarity && def.polarity !== selector.polarity) return false;
        return !def.unremovable;
      })
      .map((e) => e.system.defId);

  return ids.map((id) => I.removeEffect(doc.id, id, "ruleBreaker"));
}

/**
 * Cut a Servant's Contract and take its Master's Command Spells.
 *
 * Medea's Rule Breaker, and the only ability in the reference set that rewrites
 * the relationship graph as an attack rider. Two conditions from the sheet, and
 * both matter:
 *
 *   - **the DU must be a Servant.** A Master or a summon has no Contract to cut.
 *   - **it must have FAILED to Evade.** A successful Evade keeps the Contract,
 *     which is why this cannot be an unconditional phase after damage -- it has
 *     to read the ladder's outcome, and `state.evaded` is where that lives.
 *
 * The Contract and the spells move in ONE batch, for §16.2's reason: no
 * intermediate state where the Servant is Free and unclaimed may be observable.
 *
 * @param {object} phase
 * @param {object} state the Combat Process
 * @param {object} defenderDoc
 * @returns {Promise<object[]>}
 */
async function cutContract(phase, state, defenderDoc) {
  const requires = phase.requires ?? {};

  if (requires.targetKind && defenderDoc.type !== requires.targetKind) {
    return [{ summary: { id: "cutContract", name: "Rule Breaker", outcome: "blocked", reason: "notAServant" } }];
  }
  if (requires.evadeFailed && state.evaded) {
    // The Evade succeeded, so the Contract survives. Recorded rather than
    // silent: "why did Rule Breaker not steal it" is the first question asked.
    return [{ summary: { id: "cutContract", name: "Rule Breaker", outcome: "blocked", reason: "evaded" } }];
  }

  const oldMaster = defenderDoc.system?.masterId ? game.actors.get(defenderDoc.system.masterId) : null;
  const caster = game.actors.get(state.attackerId);
  const newMaster = caster?.type === "master" ? caster : game.actors.get(caster?.system?.masterId);

  if (!newMaster) {
    // A Free Medea has no Master to receive the Contract. The Servant is still
    // cut loose -- the NP destroyed the talisman either way.
    await applyBatch([I.markContract(defenderDoc.id, "free", null)], "np:cutContract");
    return [{ summary: { id: "cutContract", name: "Rule Breaker", outcome: "applied", reason: "freedOnly" } }];
  }

  const stripped = phase.stripMasterCommandSpells && oldMaster
    ? oldMaster.system?.commandSpells ?? 0
    : 0;

  await applyBatch([
    I.markContract(defenderDoc.id, "contracted", newMaster.id),
    // "removes the Master's Command Spells" -- all of them, not the three that
    // move. The three Medea receives are granted separately and are namespaced
    // to the Servant she just took (§16.9).
    ...(stripped > 0 ? [I.spendCS(oldMaster.id, stripped, "ruleBreaker", defenderDoc.id)] : []),
    I.grantCommandSpells(newMaster.id, defenderDoc.id, phase.grantToCaster?.commandSpells ?? 0),
    I.log({
      kind: "contract", event: "ruleBreaker",
      servantId: defenderDoc.id, fromMasterId: oldMaster?.id ?? null,
      toMasterId: newMaster.id, spellsStripped: stripped,
    }),
  ], "np:cutContract");

  return [{ summary: { id: "cutContract", name: "Rule Breaker", outcome: "applied", reason: null } }];
}

/**
 * The attacker's snapshot with any window ability's rules folded in.
 *
 * *"STR Damage dealt by **that Attack** is increased by 100%"* — by that
 * attack, so the contribution belongs to this one damage computation and to
 * nothing else. An effect applied to Asterios would be the wrong shape twice
 * over: it would survive into his next attack, and it would be strippable by
 * buff removal, which the sheet does not say.
 *
 * The ability is collected with `active: true` because that is what using it
 * means. Monstrous Strength shipped as `activeRules` on an ability with no
 * `isMode`, and `collectContributions` reads `activeRules` only while
 * `ability.active` is true — a flag nothing could ever set on it. The rules were
 * authored, compiled, loaded, and unreachable.
 *
 * Folded in **before** the option set and the crit plan are built, so a window
 * ability that changes the crit chance is counted by the coin it is supposed to
 * change rather than after it.
 *
 * @param {object} attacker the board snapshot
 * @param {object} attackerDoc
 * @param {object} state
 * @returns {object}
 */
function windowAugmented(attacker, attackerDoc, state) {
  const ids = state.windowAbilities ?? [];
  if (ids.length === 0) return attacker;

  const abilities = ids
    .map((id) => attackerDoc.items.get(id))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.system?.slug ?? item.id,
      rank: item.system?.rank ?? null,
      active: true,
      rules: item.system?.rules ?? [],
      passiveRules: [],
      activeRules: item.system?.activeRules ?? [],
    }));
  if (abilities.length === 0) return attacker;

  const extra = collectContributions(abilities, {
    options: rollOptionsFor({ attacker, defender: null }),
    refs: { self: attackerDoc },
  });

  return {
    ...attacker,
    modifiers: [...(attacker.modifiers ?? []), ...extra.modifiers],
    checkModifiers: [...(attacker.checkModifiers ?? []), ...extra.checkModifiers],
  };
}

/**
 * Offer the **attacker** its own abilities at a timing window inside its attack.
 *
 * The mirror of the reaction rung, and it did not exist. Every window in
 * `rules/reactions.mjs` describes a moment inside somebody else's Combat
 * Process; an ability whose text places it inside *your own* — Asterios's
 * *Monstrous Strength*, Karna's *Uncrowned Arms Mastership* — had no moment at
 * which it could be reached, so both shipped inert.
 *
 * Asked **inline** rather than through the Combat Process's own prompt table,
 * and the distinction is deliberate. `PROMPTS` exists because the reaction
 * ladder is answered by the *other* client and has to survive being serialized
 * into a chat flag between rungs (Ch. 27). This question is answered by the
 * player who is already driving this resolution, so a round trip through a card
 * would add a rung and a re-entry to ask somebody something they are looking at.
 * `FGTSocket.ask` still routes it to the ability's actual owner, because the
 * arbiter running this is the GM and the choice is not theirs.
 *
 * Declining is a real answer: these cost a cooldown, and a player may rationally
 * keep it. Nothing is spent unless something is picked.
 *
 * @param {object} state the Combat Process state
 * @param {string} window
 * @param {object} message the process's chat message
 * @returns {Promise<object>} the state, with `windowAbilities` recorded
 */
async function offerAttackerWindow(state, window, message) {
  // Asked once per Process. Re-entry after a Command Spell interrupt would
  // otherwise offer the same cooldown twice for one attack.
  if (state.windowAbilities !== undefined) return state;

  const actor = game.actors.get(state.attackerId);
  if (!actor) return { ...state, windowAbilities: [] };

  const offers = abilitiesAtWindow({
    items: actor.items,
    effects: actor.effects.map((e) => e.system?.defId).filter(Boolean),
    turnState: actor.system?.turnState ?? {},
    roundState: actor.system?.roundState ?? {},
  }, window);
  if (offers.length === 0) return { ...state, windowAbilities: [] };

  const picked = await askOwner(actor, {
    kind: "choose",
    title: game.i18n.localize(`FGT.Window.${window}`),
    hint: game.i18n.format("FGT.Window.Hint", { name: actor.name }),
    // `min: 0` -- keeping the cooldown is a legitimate play, and a dialog that
    // forces a pick would make "at the start of a Damage Step" mandatory.
    min: 0,
    count: offers.length,
    options: offers.map((a) => ({
      id: a.id,
      name: a.name,
      detail: a.system?.description ?? "",
    })),
  });

  const chosen = (picked ?? []).filter((id) => offers.some((a) => a.id === id));
  if (chosen.length === 0) return { ...state, windowAbilities: [] };

  // Paid for at the moment it is taken. `cooldownFor` is the same planner both
  // use paths run through, so a window use and a sheet click cannot disagree
  // about what the ability costs -- the disagreement `engine/cooldown.mjs` was
  // written to end.
  //
  // What "using it" MEANS depends on what the ability is, and the two in the
  // reference set are the two answers. Monstrous Strength contributes rules to
  // the attack in progress (`windowAugmented`); Uncrowned Arms Mastership is a
  // MODE, and using it is the switch itself -- *"switch the effect of this Skill
  // from 1 to 2, or 2 to 1"*. Folding a mode's rules into one attack would apply
  // the state it is leaving rather than the one it is entering.
  const intents = chosen.flatMap((id) => {
    const item = actor.items.get(id);
    const plan = cooldownFor(item, actor.id, { unit: unitSnapshot(actor) });
    const toggles = classifyAbility(item).toggles;
    return [
      ...plan.cooldowns.map((c) => I.cooldown(c.actorId, c.abilityId, c.ticks, "set")),
      ...(toggles
        ? [I.setMode(actor.id, item.system?.slug ?? id, !item.system?.active, `window:${window}`)]
        : []),
      I.recordUse(actor.id, id, item?.system?.contentId ?? null),
      I.log({
        kind: "ability", event: "windowUsed", window,
        unitId: actor.id, abilityId: id, name: item?.name ?? id,
      }),
    ];
  });
  await applyBatch(intents, `window:${window}`);

  // A mode's switch is its whole effect, so it is not carried forward as a
  // contribution: `contributionsOf` will read the new state off the document on
  // the next snapshot, which is every snapshot after this batch.
  const carried = chosen.filter((id) => !classifyAbility(actor.items.get(id)).toggles);

  await ChatMessage.create({
    content: `<p><strong>${actor.name}</strong> uses `
      + `${chosen.map((id) => actor.items.get(id)?.name ?? id).join(", ")}.</p>`,
    speaker: ChatMessage.getSpeaker({ actor }),
  });

  void message;
  return { ...state, windowAbilities: carried };
}

/**
 * Ask the player who owns this actor, or answer it here when nobody does.
 *
 * A GM-run resolution must not put a Servant's decision in the GM's hands when
 * the Servant belongs to somebody: `FGTSocket.ask` is the primitive for exactly
 * that, and it short-circuits to a local dialog when the owner *is* this client.
 * An unowned actor (a summon, an NPC) falls back to whoever is arbitrating.
 *
 * A timeout or a disconnected owner resolves to **null**, which every caller
 * reads as "declined" — the attack must not stall because somebody walked away.
 *
 * @param {object} actor
 * @param {object} spec a prompt spec (`module/apps/prompt.mjs`)
 * @returns {Promise<unknown>}
 */
async function askOwner(actor, spec) {
  const owner = game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
    ?? game.user;
  try {
    const { FGTSocket } = await import("../net/socket.mjs");
    return await FGTSocket.ask(owner.id, spec);
  } catch (err) {
    console.warn(`FGT | ${actor.name}'s window prompt was not answered:`, err);
    return null;
  }
}

/**
 * The reaction abilities a defender may answer with (§15.3).
 *
 * Reduced to what a card needs -- an id and a name -- rather than carrying the
 * documents: the state is serialized into a chat flag and crosses the socket,
 * and an Item document does not survive that trip.
 *
 * @param {string} defenderId
 * @returns {Array<{id: string, name: string}>}
 */
function offeredReactions(defenderId, attack = null) {
  const actor = game.actors.get(defenderId);
  if (!actor) return [];

  const own = reactionAbilities({
    items: actor.items,
    effects: actor.effects.map((e) => e.system?.defId).filter(Boolean),
    turnState: actor.system?.turnState ?? {},
  }).map((a) => ({ id: a.id, name: a.name, ownerId: defenderId }));

  // Plus anything a nearby ALLY could interpose. EMIYA's Rho Aias is the only
  // one, and it is the only ability in the game whose user is neither the
  // attacker nor the defender.
  //
  // Offered at the defender's rung because Ch. 27's ladder prompts one side per
  // rung; the option is labelled with the projector's name so whoever answers
  // knows whose Health it is about to cost.
  const board = boardSnapshot();
  const ally = allyReactions({
    defender: board.units.find((u) => u.id === defenderId) ?? unitSnapshot(actor),
    board,
    attack: attack ?? {},
    actorFor: (id) => game.actors.get(id),
  }).map((a) => ({
    id: a.ability.id,
    name: `${a.ability.name} (${a.ownerName})`,
    ownerId: a.ownerId,
  }));

  return [...own, ...ally];
}

/**
 * An automatic Evade granted by an effect the defender is now carrying.
 *
 * Medea's Trofa: *"Automatically Evades the Attack. If the Attack was a Noble
 * Phantasm, Medea has a 50% chance of automatically Evading it. If Failed, the
 * Combat Process proceeds as normal."*
 *
 * The NP case is a **roll**, not a refusal, which is why `chance` exists at all
 * — and a failed roll must leave the ladder able to continue, so it reports a
 * failed Evade rather than declining to have happened.
 *
 * @param {object} state
 * @param {object|null} defender
 * @returns {{applies: boolean, success?: boolean, outcome?: object}}
 */
function autoEvadeFrom(state, defender) {
  if (!defender) return { applies: false };

  const plan = checkPlan(unitSnapshot(defender), "evade");
  const auto = plan.autoSucceed;
  if (!auto) return { applies: false };

  const attackProperties = [];
  if (state.attack?.aim) attackProperties.push("aim");
  if (state.attack?.kind === "np") attackProperties.push("np");
  if ((auto.beatenBy ?? []).some((p) => attackProperties.includes(p))) return { applies: false };

  // A per-property chance: certain against anything ordinary, a coin against a
  // Noble Phantasm.
  const chance = chanceFor(auto, attackProperties);
  const success = chance >= 100 || (Math.random() * 100) < chance;

  return {
    applies: true,
    success,
    // Which effect this came from, so the caller can spend a charge of it.
    // `AutoSucceed` records the count on the effect INSTANCE, and the plan
    // carries the defId through -- without it the caller would have to guess
    // which of the defender's effects had just fired.
    consumes: auto.uses ? (auto.defId ?? null) : null,
    outcome: {
      success, automatic: true, roll: null, total: 0,
      table: null, modifiers: [{ source: auto.source ?? "automatic evasion", value: 0 }],
      chance,
    },
  };
}

/**
 * The chance an automatic success actually fires, given the attack.
 * @param {object} auto
 * @param {string[]} attackProperties
 * @returns {number}
 */
function chanceFor(auto, attackProperties) {
  for (const entry of auto.chanceWhen ?? []) {
    const wanted = [entry.predicate ?? []].flat();
    if (wanted.some((p) => attackProperties.includes(String(p).replace("attack:kind:", "")))) {
      return entry.chance ?? 100;
    }
  }
  return auto.chance ?? 100;
}

/* -------------------------------------------------------------------------- */
/*  Pre-emption — attacking first, instead of the Unit attacking you           */
/* -------------------------------------------------------------------------- */

/**
 * Offer any defender who may swing first the chance to do so.
 *
 * Jack the Ripper's *Murderer of the Misty Night* is the only clause in the
 * corpus that does this, and it is **not** a Counter. A Counter happens at the
 * end of the Process it answers (§12.8's `counter` rung), after the damage has
 * already landed; this happens *instead*, before the attacker's Process exists
 * at all. So it cannot reuse `beginCounter`: a counter cannot be countered and
 * ends the counterer's concealment on different terms, and neither is true of
 * an attack that is simply early.
 *
 * The original declaration is not discarded — it is **deferred onto the
 * pre-emptive Process**. When that Process completes, `resumeDeferredAttack`
 * re-enters `resolveAttack` with `resume: true`, which re-resolves targeting
 * (so a defender who died drops out) while skipping the budget, the costs and
 * the cooldown, all of which were already paid at the first declaration. If the
 * pre-empter killed the attacker, the deferred attack never happens: that is
 * what "instead of" buys, and it falls out of re-resolving rather than needing
 * a special case of its own.
 *
 * Only ONE pre-emption per declaration. A Noble Phantasm over seven Units that
 * caught two pre-empters would otherwise open two exchanges the sheet never
 * describes, and there is no stated order between them.
 *
 * @param {object} args
 * @returns {Promise<{messageId: string}|null>}
 */
async function offerPreemption({ attackerId, abilityId, placement, targetIds, board, self }) {
  const attackerDoc = game.actors.get(attackerId);
  if (!attackerDoc) return null;

  for (const defenderId of new Set(targetIds)) {
    if (defenderId === attackerId) continue;
    const defenderDoc = game.actors.get(defenderId);
    const defender = defenderDoc ? unitFrom(board, defenderDoc) : null;
    const rule = (defender?.preemptions ?? [])[0];
    if (!rule) continue;

    // "…and the AU is within JACK'S Range." The pre-empter's range, not the
    // attacker's: she is the one about to swing, so a sniper hitting her from
    // outside her own reach is exactly the case the clause does not cover.
    if (rule.withinOwnRange) {
      // `range` on a BOARD unit is the resolved number of panels, not the
      // `{panels, targets}` shape the document carries -- `rules/snapshot.mjs`
      // flattens it. Reading `.panels` here gave `undefined`, which fell to a
      // reach of 0, which refused every pre-emption at every distance. Both
      // shapes are accepted rather than assuming the caller's.
      const reach = typeof defender.range === "number"
        ? defender.range
        : (defender.range?.panels ?? 0);
      if (chebyshev(defender.panel, self.panel) > reach) continue;
    }

    const picked = await askOwner(defenderDoc, {
      kind: "choose",
      title: game.i18n.localize("FGT.Preempt.Title"),
      hint: game.i18n.format("FGT.Preempt.Hint", {
        name: defenderDoc.name, attacker: attackerDoc.name, source: rule.source,
      }),
      min: 0,
      count: 1,
      options: [{ id: "preempt", name: game.i18n.localize("FGT.Preempt.Take"), detail: rule.source }],
    });
    if (!(picked ?? []).includes("preempt")) continue;

    // "If it is a Day Round, the activation of this effect requires a
    // Successful Luck Check. Luck Check is not required during Night Rounds."
    // The Round phase is a COST modifier here rather than a damage one: the
    // same clause costs a point of Luck and a die by day, and nothing at night.
    if ((rule.requiresLuckCheckIn ?? []).includes(board.phase)) {
      const ok = await preemptionLuckCheck(defenderDoc, attackerId);
      if (!ok) continue;
    }

    return runPreemption({ preempterId: defenderId, attackerId, abilityId, placement, targetIds });
  }
  return null;
}

/**
 * The Luck Check a Day Round charges for a pre-emption.
 *
 * Uncontested: the clause asks whether Jack got the drop on somebody, not
 * whether she is luckier than they are. Costs 1 Luck whether or not it
 * succeeds, like every other Luck Check.
 *
 * @param {object} defenderDoc
 * @param {string} attackerId
 * @returns {Promise<boolean>}
 */
async function preemptionLuckCheck(defenderDoc, attackerId) {
  const unit = unitSnapshot(defenderDoc);
  const roll = await new Roll("1d20").evaluate();
  const plan = checkPlan(unit, "luck");
  const outcome = luckCheck({
    roll: roll.total,
    luck: unit.luck,
    hasBoost: (unit.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
    hasLoss: (unit.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
    modifiers: plan.modifiers,
  });
  await applyBatch([
    I.statDelta(defenderDoc.id, "luck.value", -1),
    I.log({
      kind: "check", event: "preemptLuck", unitId: defenderDoc.id,
      against: attackerId, success: outcome.success, roll: roll.total,
    }),
  ], "preempt:luck");
  return outcome.success;
}

/**
 * Open the pre-empter's own Combat Process, carrying the deferred attack.
 *
 * @param {object} args
 * @returns {Promise<{messageId: string}|null>}
 */
async function runPreemption({ preempterId, attackerId, abilityId, placement, targetIds }) {
  const preempter = game.actors.get(preempterId);
  const target = game.actors.get(attackerId);
  if (!preempter || !target) return null;

  // A NORMAL Attack. The clause says "Attack", and a Servant's Attack with no
  // ability named is its Normal Attack everywhere else in this engine.
  const state = process.advance(
    process.begin({
      attackerId: preempterId,
      defenderId: attackerId,
      attack: {
        abilityId: null,
        kind: "normal",
        component: componentOf(preempter, null, rollOptionsFor({ attacker: unitSnapshot(preempter) })),
      },
      isAoE: false,
      isPreemption: true,
    }),
    "done",
  );

  const message = await renderAttackCard({
    state, attacker: preempter, ability: null, targets: [{ unitId: attackerId }],
  });
  await message.setFlag("fgt", "process", process.serialize(state));
  await message.setFlag("fgt", "collapse", process.laddersCollapse(unitSnapshot(target)));
  // The other half of the exchange, parked until this one finishes.
  await message.setFlag("fgt", "deferredAttack", {
    attackerId, abilityId, placement: placement ?? null, targetIds,
  });
  return { messageId: message.id };
}

/**
 * Re-enter the attack a pre-emption interrupted, if its attacker still lives.
 *
 * Called from the Process completion point, so *"Jack killed him and his attack
 * never happened"* needs no special case: a defeated attacker cannot
 * re-declare, and a target the pre-emption killed drops out of the re-resolved
 * targeting on its own.
 *
 * @param {object} state
 * @param {object} message
 * @returns {Promise<void>}
 */
async function resumeDeferredAttack(state, message) {
  const deferred = message.getFlag("fgt", "deferredAttack");
  if (!deferred) return;
  // Cleared FIRST. A Process re-read after a Command Spell interrupt can reach
  // this point twice, and the second pass would launch the deferred attack a
  // second time.
  await message.unsetFlag("fgt", "deferredAttack");

  const attacker = game.actors.get(deferred.attackerId);
  if (!attacker) return;
  if (attacker.system?.defeated?.at || currentHealth(unitSnapshot(attacker)) <= 0) {
    await applyBatch([I.log({
      kind: "attack", event: "preemptCancelled", unitId: deferred.attackerId,
      by: state.attackerId,
    })], "preempt:cancelled");
    return;
  }

  try {
    await resolveAttack({ ...deferred, resume: true });
  } catch (err) {
    // Loud, not silent: the deferred half failing leaves a half-resolved
    // exchange, and the players need to know which half is missing.
    console.error("FGT | The attack a pre-emption deferred could not resume:", err);
    ui.notifications?.warn(game.i18n.localize("FGT.Preempt.ResumeFailed"));
  }
}
