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
import { snapshotUnit } from "../rules/snapshot.mjs";
import { currentBoard } from "./board.mjs";
import { evade as evadeCheck, luckCheck, chance, checkPlan } from "../rules/checks.mjs";
import { classifyAbility, targetSpecFor as specForAbility } from "../rules/ability-use.mjs";
import { Rank } from "../domain/rank.mjs";
import * as process from "./combat-process.mjs";
import * as I from "./intents.mjs";
import { applyIntents } from "./applier.mjs";
import { worldIO } from "./io.mjs";
import { renderAttackCard, updateAttackCard } from "../apps/chat/cards.mjs";
import { applyEffect } from "./effect-applier.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import * as budget from "./budget.mjs";

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
  const self = snapshotUnit(attacker);
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

  // One Combat Process per target. AoE fans out (Ch. 12 §12.10) and each
  // defender reacts independently.
  const state = process.begin({
    attackerId,
    defenderId: targets.units[0]?.unitId ?? null,
    attack: { abilityId, kind: ability ? abilityKind(ability) : "normal" },
    isAoE: targets.units.length > 1,
  });

  const advanced = process.advance(state, "done");
  const message = await renderAttackCard({
    state: advanced,
    attacker,
    ability,
    targets: targets.units,
  });

  // A defender with no Luck, no Command Spells and no automatic evasion has
  // exactly one possible outcome at every rung past step 2, so the whole ladder
  // collapses into a single prompt (Ch. 12 §12.3).
  const defender = game.actors.get(advanced.defenderId);
  const collapse = defender ? process.laddersCollapse(snapshotUnit(defender)) : true;

  await message.setFlag("fgt", "process", process.serialize(advanced));
  await message.setFlag("fgt", "collapse", collapse);

  return { messageId: message.id, state: advanced };
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

  // A reaction choice resolves into a roll before the machine moves on.
  if (state.state === "react" && event === "evade") {
    state = process.advance(state, "evade");
    const outcome = await rollEvade(state);
    state = process.advance(state, outcome.success ? "success" : "fail", outcome);
  } else if (state.state.startsWith("s2") && event === "contest") {
    const outcome = await rollLuck(state);
    state = process.advance(state, outcome.success ? "success" : "fail", outcome);
  } else {
    state = process.advance(state, event);
  }

  // Drive through every state that needs no human input.
  while (!process.isComplete(state) && !process.pendingPrompt(state)) {
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
    case "noDamage":
    case "injury":
    case "facing":
      // Facing: the defender turns to face the attacker, but not for AoE.
      if (state.state === "facing" && process.shouldUpdateFacing(state)) {
        await applyFacing(state);
      }
      return process.advance(state, "done");
    case "counter":
      return process.advance(state, "done");
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
  const attacker = snapshotUnit(game.actors.get(state.attackerId));
  const defender = snapshotUnit(game.actors.get(state.defenderId));
  const roll = await new Roll("1d20").evaluate();

  // Everything the defender's own abilities have to say about Evade -- Mad
  // Enhancement's forced table, an Agility check penalty, a granted
  // auto-evasion -- arrives through the plan rather than being named here.
  const plan = checkPlan(defender, "evade");
  const attackProperties = [];
  if (state.attack?.aim) attackProperties.push("aim");
  if (state.attack?.kind === "np") attackProperties.push("np");

  return {
    ...evadeCheck({
      roll: roll.total,
      agility: defender.agility,
      hasDodge: (defender.effects ?? []).includes("dodge"),
      attackHasAim: Boolean(state.attack?.aim),
      forceUnfavourable:
        plan.forceTable === "unfavourable" || defender.agility < attacker.agility,
      autoSucceed: plan.autoSucceed,
      attackProperties,
      modifiers: [...evadeModifiers(state, attacker, defender), ...plan.modifiers],
    }),
    formula: roll.formula,
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
  const unit = snapshotUnit(game.actors.get(prompt.unitId));
  const opponentId = prompt.side === "attacker" ? state.defenderId : state.attackerId;
  const opponent = snapshotUnit(game.actors.get(opponentId));
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
  return { ...outcome, formula: roll.formula };
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
  const attacker = snapshotUnit(attackerDoc);
  const defender = snapshotUnit(defenderDoc);
  const ability = state.attack?.abilityId ? attackerDoc.items.get(state.attack.abilityId) : null;

  // The crit coin flip, then every roll the pipeline will consume — rolled
  // HERE so the pipeline itself stays pure and reproducible.
  const critFlip = await new Roll("1d2").evaluate();
  const isCrit = critFlip.total === 1;
  const attackRoll = await new Roll("5d10").evaluate();

  const ctx = {
    attacker, defender, board: boardSnapshot(),
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
    },
    options: rollOptions(attacker, defender, state),
  };

  const result = computeDamage(ctx);

  await applyBatch(
    [
      I.damage(state.defenderId, result.total, result.breakdown),
      ...(result.flags.defeatedOutright ? [I.defeat(state.defenderId, "petrify")] : []),
      I.log({ kind: "damage", attackerId: state.attackerId, defenderId: state.defenderId, total: result.total }),
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

  const defender = snapshotUnit(defenderDoc);
  const applied = [];

  for (const phase of ability.system?.phases ?? []) {
    if (phase.kind !== "applyEffects") continue;
    for (const rule of phase.rules ?? []) {
      const spec = rule.effect;
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
        magnitude: spec.magnitude ?? def.defaultMagnitude ?? 0,
        duration: rule.duration ?? spec.duration ?? def.defaultDuration,
        source: { unitId: state.attackerId, abilityId: ability.id },
        ctx: {
          turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
          currentTick: game.combat?.system?.globalTurn ?? 0,
          roll: roll.total,
          inflictBonus: 0,
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
  const attacker = snapshotUnit(game.actors.get(state.attackerId));
  const defender = snapshotUnit(game.actors.get(state.defenderId));
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
  const options = new Set([`self:type:${attacker.kind}`, `target:type:${defender.kind}`]);
  for (const a of attacker.attributes ?? []) options.add(`self:attribute:${a}`);
  for (const a of defender.attributes ?? []) options.add(`target:attribute:${a}`);
  for (const e of attacker.effects ?? []) options.add(`self:effect:${e}`);
  for (const e of defender.effects ?? []) options.add(`target:effect:${e}`);
  options.add(`attack:kind:${state.attack?.kind ?? "normal"}`);
  if (state.isAoE) options.add("attack:isAoE");
  return options;
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
