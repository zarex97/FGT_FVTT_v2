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
import { snapshotUnit, snapshotBoard } from "../rules/snapshot.mjs";
import { evade as evadeCheck, luckCheck, chance } from "../rules/checks.mjs";
import { Rank } from "../domain/rank.mjs";
import * as process from "./combat-process.mjs";
import * as I from "./intents.mjs";
import { applyIntents } from "./applier.mjs";
import { worldIO } from "./io.mjs";
import { renderAttackCard, updateAttackCard } from "../apps/chat/cards.mjs";

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

  const spec = targetSpecFor(attacker, ability);
  const targets = resolveTargets(spec, self, board, placement);

  if (targets.errors.length > 0) {
    throw new Error(`FGT | Illegal attack: ${targets.errors.join(" ")}`);
  }
  if (targets.needsChoice) {
    return { needsChoice: true, candidates: targets.candidates };
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
      await message.setFlag("fgt", "damage", result.total);
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

  return {
    ...evadeCheck({
      roll: roll.total,
      agility: defender.agility,
      hasDodge: (defender.effects ?? []).includes("dodge"),
      attackHasAim: Boolean(state.attack?.aim),
      forceUnfavourable:
        (defender.effects ?? []).includes("madEnhancement") || defender.agility < attacker.agility,
      modifiers: evadeModifiers(state, attacker, defender),
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

  const outcome = luckCheck({
    roll: roll.total,
    luck: unit.luck,
    opposingLuck: opponent.luck,
    hasBoost: (unit.effects ?? []).includes("luckBoost"),
    hasLoss: (unit.effects ?? []).includes("luckLoss"),
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
    rolls: { [isCrit ? "attackPlus" : "attackMinus"]: attackRoll.total },
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
  return snapshotBoard({
    scene: canvas?.scene,
    actors: (canvas?.tokens?.placeables ?? []).map((t) => ({ actor: t.actor, token: t.document })),
    settings: {
      boardSize: game.settings.get("fgt", "boardSize"),
      turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
      round: game.combat?.round ?? 1,
      tick: game.combat?.system?.globalTurn ?? 0,
      phase: game.combat?.system?.phase ?? "day",
      region: game.settings.get("fgt", "region") || null,
      seed: game.combat?.system?.globalTurn ?? 0,
    },
  });
}

/**
 * A normal attack targets one unit inside the attack-Range shape; an ability
 * declares its own targeting.
 * @param {object} attacker
 * @param {object|null} ability
 * @returns {object}
 */
function targetSpecFor(attacker, ability) {
  if (ability?.system?.targeting) return ability.system.targeting;
  return {
    anchor: { kind: "targetUnit", range: attacker.system.range?.panels ?? 1 },
    shape: { kind: "unit" },
    selection: { relations: ["enemy"], chooser: "all", count: 1 },
  };
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
  if (ability.type === "noblePhantasm") return "np";
  if (ability.system?.isAttackSkill) return "attackSkill";
  if (ability.system?.isSpell) return "damageSpell";
  return "normal";
}

/** Re-exported so a macro can roll a raw chance without importing the rules layer. */
export { chance };
