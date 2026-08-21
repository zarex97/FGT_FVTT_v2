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

import { computeDamage } from "../rules/damage/pipeline.mjs";
import { resolveTargets } from "../rules/targeting/resolve.mjs";
import { currentBoard, unitSnapshot, unitFrom } from "./board.mjs";
import { evade as evadeCheck, luckCheck, chance, checkPlan } from "../rules/checks.mjs";
import * as rollLog from "../rules/roll-log.mjs";
import { effectivePhases } from "../rules/copy.mjs";
import { cooldownFor, alsoTriggered } from "./cooldown.mjs";
import { classifyAbility, targetSpecFor as specForAbility } from "../rules/ability-use.mjs";
import { Rank } from "../domain/rank.mjs";
import { inAttackRange } from "../domain/geometry.mjs";
import * as process from "./combat-process.mjs";
import * as I from "./intents.mjs";
import { applyIntents } from "./applier.mjs";
import { worldIO } from "./io.mjs";
import { renderAttackCard, updateAttackCard } from "../apps/chat/cards.mjs";
import { applyEffect, inflictBonusOf } from "./effect-applier.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import * as budget from "./budget.mjs";
import { resolveDefeat, pendingRolls } from "./scheduler.mjs";
import { injuryCheck, INJURY_STAT } from "../rules/injury.mjs";
import { canUseAbility, resolveCosts } from "../rules/costs.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { reactionAbilities, abilityFromOption } from "../rules/reactions.mjs";
import { attacksPermitted, mayAttackCivilian, civilianKill } from "../rules/environment.mjs";
import { resolveOverpower, resolveUnderpower, mayOrderAnotherServant } from "../rules/relationships.mjs";

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
export async function resolveAttack({ attackerId, abilityId, placement }) {
  const attacker = game.actors.get(attackerId);
  if (!attacker) throw new Error(`FGT | Unknown attacker ${attackerId}`);

  const board = boardSnapshot();
  // From the board, not projected alone: ZON is pairwise, so only the board
  // knows whether this Servant is inside its Master's zone -- and that is what
  // `limits.requiresZon` on every Noble Phantasm turns on.
  const self = unitFrom(board, attacker);
  const ability = abilityId ? attacker.items.get(abilityId) : null;

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

  const spec = targetSpecFor(attacker, ability);
  const targets = resolveTargets(spec, self, board, placement);

  if (targets.errors.length > 0) {
    throw new Error(`FGT | Illegal attack: ${targets.errors.join(" ")}`);
  }
  if (targets.needsChoice) {
    return { needsChoice: true, candidates: targets.candidates };
  }

  // Declaring the attack is what spends the budget, not landing it: a Noble
  // Phantasm that misses still consumed the Servant's attack for the turn, and
  // *"non-damaging NPs count as the Unit's Attack for that Turn"* says so
  // explicitly.
  if (combat?.started) {
    await budget.spend({ combat, unit: self, action: actionKind });
    const isAttack = actionKind !== "skill";
    await applyBatch(
      [I.markTurn(attackerId, isAttack ? { attacked: true, acted: true } : { usedActiveSkill: true, acted: true })],
      "attack:declared",
    );
  }

  // Confirmation: targeting is settled and legal, so the costs are now paid.
  //
  // Plural, and resolved against each other first (§15.4). A cost may declare
  // that it `supersedes` another -- Karna's NP cost overwrites the 20 Health his
  // Master loses when he Acts, and the Hanging Gardens upkeep overwrites the NP
  // cost the other way -- and charging both would bill more than the rules say.
  const pending = pendingCosts({ usage, ability, self, master, board });
  const { charged, superseded } = resolveCosts(pending);

  for (const cost of charged) await applyBatch(costIntents(cost), "attack:cost");

  // The cooldown, at the same moment as the cost and for the same reason: the
  // ability has been committed. `resolveAttack` never did this, so every Attack
  // Skill and every Noble Phantasm was infinitely reusable -- limited only by
  // the attack budget, which is a different rule.
  if (ability) {
    const clocks = [...cooldownFor(ability, attackerId), ...alsoTriggered(ability, attacker)];
    if (clocks.length > 0) {
      await applyBatch(
        clocks.map((c) => I.cooldown(c.actorId, c.abilityId, c.ticks, "set")),
        "attack:cooldown",
      );
    }
  }
  if (superseded.length > 0) {
    // Logged, because a Master who paid 50 where they expected 70 needs to see
    // which rule did that; a silently smaller number reads as a bug.
    await applyBatch(
      [I.log({ kind: "cost", event: "superseded", superseded, unitId: master?.id ?? self.id })],
      "attack:cost",
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
  const attackSpec = { abilityId, kind: ability ? abilityKind(ability) : "normal" };
  const targetIds = targets.units.map((t) => t.unitId);

  // A resolution that caught no units is still a resolution — a ground-placed
  // non-damaging NP has a shape and no defenders — so it keeps its single
  // null-defender process rather than becoming an empty fan-out.
  const states = targetIds.length > 0
    ? process.beginFanOut({ attackerId, targetIds, attack: attackSpec })
    : [process.begin({ attackerId, defenderId: null, attack: attackSpec })];

  /** @type {Array<{messageId: string, state: object}>} */
  const processes = [];
  for (const state of states) {
    // What this defender could answer with, beyond Block and Evade. Recorded on
    // the state because `pendingPrompt` is pure and cannot read documents, and
    // recorded ONCE at creation because the offer is decided by the moment the
    // attack is declared (§15.3).
    const withReactions = state.defenderId
      ? { ...state, reactionAbilities: { [state.defenderId]: offeredReactions(state.defenderId) } }
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
    const used = defender?.items?.get(reactionAbilityId);
    if (used) {
      const { useSkill } = await import("./skill-use.mjs");
      const out = await useSkill({ actorId: defender.id, abilityId: used.id });
      if (!out.ok) ui.notifications?.warn(game.i18n.format("FGT.Skill.Refused", { name: used.name, reason: out.reason }));
    }

    // An auto-evade granted by what was just used takes the Evade rung without
    // a roll. Read AFTER the ability resolved, because that is what granted it.
    const auto = autoEvadeFrom(state, defender);
    if (auto.applies) {
      state = process.advance(state, "evade");
      state = process.advance(state, auto.success ? "success" : "fail", auto.outcome);
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
  return state;
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
      const result = await applyDamage(state, message);
      // Riders declared in the ability's phases land only if the damage did.
      // "Deals 4x damage plus 100. Then inflicts Def Dwn" -- the "then" is
      // conditional on the attack connecting.
      const applied = await applyAbilityEffects(state, result);
      await message.setFlag("fgt", "damage", result.total);
      await message.setFlag("fgt", "effects", applied.map((a) => a.summary));
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
  const plan = checkPlan(defender, "evade");
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
  if ((attacker.effects ?? []).includes("presenceConcealment")) {
    mods.push({ source: "Presence Concealment", value: 4 });
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
  if (!ability) return null;
  const sys = ability.system ?? {};
  return {
    id: ability.id,
    rank: sys.rank ?? null,
    isNP: Boolean(sys.isNP),
    cooldown: { remaining: sys.cooldown?.remaining ?? 0 },
    requiresRound: sys.targeting?.limits?.requiresRound ?? null,
    // The rest of §15.4's list, authored beside the targeting limits.
    requirements: sys.targeting?.limits?.requirements ?? sys.requirements ?? [],
  };
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
 * @returns {object[]} intents
 */
function costIntents(cost) {
  const note = I.log({ kind: "cost", cost: cost.kind, amount: cost.amount, unitId: cost.unitId });
  switch (cost.kind) {
    case "masterHealth":
    case "selfHealth":
      return [I.statDelta(cost.unitId, "health.value", -cost.amount), note];
    case "sustainability":
      return [I.resource(cost.unitId, "sustainability", -cost.amount), note];
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
    attackerConcealedAndFaster:
      Boolean(attacker.concealed) && (attacker.agility ?? 0) > (defender.agility ?? 0),
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

  const verdict = injuryCheck({
    exceededThreshold: Boolean(result.flags?.exceededInjuryThreshold),
    damage: result.total,
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
  const remaining = (defender.health?.value ?? 0) - damage;
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
    rolls: {},
  };
  for (const spec of pendingRolls(defender, "unitDefeated")) {
    ctx.rolls[spec.key] = (await new Roll(spec.formula).evaluate()).total;
  }

  return resolveDefeat({ ...defender, health: { ...defender.health, value: remaining } }, ctx);
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
  const attacker = unitFrom(board, attackerDoc);
  const defender = unitFrom(board, defenderDoc);
  const ability = state.attack?.abilityId ? attackerDoc.items.get(state.attack.abilityId) : null;

  // The crit coin flip, then every roll the pipeline will consume — rolled
  // HERE so the pipeline itself stays pure and reproducible.
  const critFlip = await new Roll("1d2").evaluate();
  const isCrit = critFlip.total === 1;
  const attackRoll = await new Roll("5d10").evaluate();

  const ctx = {
    attacker, defender, board,
    attack: {
      kind: state.attack?.kind ?? "normal",
      abilityId: state.attack?.abilityId ?? null,
      rank: Rank.parseOrNull(ability?.system?.rank),
      categorizedAsNP: Boolean(ability?.system?.categorizedAsNP),
      isAoE: state.isAoE,
      element: ability?.system?.element ?? null,
    },
    base: baseSpecFor(attackerDoc, ability),
    multiplier: ability?.system?.damage?.multiplier ?? 1,
    flatBonus: ability?.system?.damage?.flatBonus ?? 0,
    conditionalMultipliers: ability?.system?.damage?.conditionalMultipliers ?? [],
    crit: { isCrit, chanceUsed: 0 },
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
    options: rollOptions(attacker, defender, state),
  };

  const result = computeDamage(ctx);

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
  if (overpower.survivesLethal && result.total >= (defender.health?.value ?? 0)) {
    result.total = Math.max(0, (defender.health?.value ?? 1) - 1);
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

  await applyBatch(
    [
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
async function applyAbilityEffects(state, damageResult) {
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

  // Through `effectivePhases`, because a copy (§15.7) has none of its own --
  // reading `.phases` directly makes Scáthach's copies load and do nothing.
  for (const phase of effectivePhases(ability.system ?? {}, resolveAbilitySource)) {
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
        magnitude: spec.magnitude ?? def.defaultMagnitude ?? 0,
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
          options: rollOptionsFor({
            attacker: unitSnapshot(game.actors.get(state.attackerId)),
            defender,
            attack: state.attack,
          }),
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
 * @returns {object}
 */
function targetSpecFor(attacker, ability) {
  return specForAbility(ability, attacker.system.range?.panels ?? 1);
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
 * @returns {object}
 */
export function targetSpecForAttack(attacker, ability) {
  return targetSpecFor(attacker, ability);
}

/**
 * @param {object} attacker
 * @param {object|null} ability
 * @returns {object}
 */
function baseSpecFor(attacker, ability) {
  if (ability?.system?.damage?.base) return ability.system.damage.base;
  const component = attacker.system.normalAttack?.component ?? "str";
  return { sources: [{ unit: "self", component, factor: 1 }] };
}

/**
 * Build the roll-option set the predicates evaluate against.
 * @param {object} attacker
 * @param {object} defender
 * @param {object} state
 * @returns {Set<string>}
 */
function rollOptions(attacker, defender, state) {
  // Built in the rules layer, where it can be tested without Foundry. It used
  // to be built here, which is why two whole clause families -- `skill:` and
  // `region:` -- went years without ever being emitted.
  return rollOptionsFor({
    attacker,
    defender,
    attack: { kind: state.attack?.kind ?? "normal", isAoE: state.isAoE },
  });
}

/**
 * @param {object} ability
 * @returns {string}
 */
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
 * The reaction abilities a defender may answer with (§15.3).
 *
 * Reduced to what a card needs -- an id and a name -- rather than carrying the
 * documents: the state is serialized into a chat flag and crosses the socket,
 * and an Item document does not survive that trip.
 *
 * @param {string} defenderId
 * @returns {Array<{id: string, name: string}>}
 */
function offeredReactions(defenderId) {
  const actor = game.actors.get(defenderId);
  if (!actor) return [];

  return reactionAbilities({
    items: actor.items,
    effects: actor.effects.map((e) => e.system?.defId).filter(Boolean),
    turnState: actor.system?.turnState ?? {},
  }).map((a) => ({ id: a.id, name: a.name }));
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
