/**
 * @file Spending a Command Spell.
 * @see docs/17-command-spells.md §17.3, §17.4, §17.8
 *
 * Layer 3. The rules decide *whether* and *what*; this pays and writes.
 *
 * Everything downstream of a spend already existed — the `spendCS` intent, the
 * applier case, `io.spendCommandSpells`, `commandSpells` on the Master schema.
 * What was missing was the middle: nothing decided which command was offerable,
 * so nothing ever constructed the intent and no Command Spell was ever spent.
 */

import { availableCommands, canSpend, effectsOf, costOf } from "../rules/command-spells.mjs";
import { CommandSpellRegistry } from "../rules/cs-registry.mjs";
import { currentBoard, unitFrom } from "./board.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as process from "./combat-process.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";

/**
 * The commands this Master may use at this moment.
 *
 * Offered commands are already filtered to the *usable* ones: §17.6 requires
 * Van Gogh's immunity to be checked at offer time "so the option never
 * appears", and the same argument covers cost — stopping a resolution to ask a
 * question with one answer is worse than not asking.
 *
 * @param {object} args
 * @param {string} args.masterId
 * @param {string} [args.window] one of `rules/command-spells.mjs` `WINDOWS`
 * @param {object} [args.context] attack, state and damage, when inside a Process
 * @returns {object[]}
 */
export function offerCommands({ masterId, window, context = {} }) {
  const ctx = contextFor(masterId, window, context);
  if (!ctx) return [];
  return availableCommands(CommandSpellRegistry.all(), ctx);
}

/**
 * Validate, pay for, and apply a Command Spell.
 *
 * The order is deliberate and is §17.4's: validate, **then** pay, then apply.
 * Paying before validating would burn a charge on a refusal, and applying
 * before paying would let a failed write leave a free command.
 *
 * @param {object} args
 * When a `messageId` is supplied the command is an **interrupt**: the effects
 * that change an in-flight resolution are applied to that Combat Process
 * instead of to the world, and the ladder resumes from wherever they left it.
 * That is a GM-side mutation by design (§27.9) — it changes a Process another
 * client is participating in.
 *
 * @param {object} args
 * @param {string} args.masterId
 * @param {string} args.commandId
 * @param {string} [args.window]
 * @param {string} [args.messageId] the Combat Process being interrupted
 * @param {object} [args.context]
 * @returns {Promise<{ok: boolean, reason?: string, cost?: number}>}
 */
export async function spendCommandSpell({ masterId, commandId, window, messageId, context = {} }) {
  const command = CommandSpellRegistry.get(commandId);
  if (!command) return { ok: false, reason: "unknownCommand" };

  const ctx = contextFor(masterId, window, context);
  if (!ctx) return { ok: false, reason: "noMaster" };

  const verdict = canSpend(command, ctx);
  if (!verdict.ok) return verdict;

  const cost = costOf(command, ctx.master, ctx.settings);
  const effects = effectsOf(command, ctx);
  const intents = [
    I.spendCS(masterId, cost, command.id),
    // §17.8: the audit trail says who spent what, on whom, and when — a
    // Command Spell is the most consequential thing a Master can do and the
    // one most likely to be argued about afterwards.
    I.log({
      kind: "commandSpell",
      command: command.id,
      name: command.name,
      masterId,
      servantId: ctx.servant?.id ?? null,
      cost,
      window: window ?? null,
      tick: game.combat?.system?.globalTurn ?? 0,
    }),
    ...effectIntents(effects, ctx),
  ];

  await applyWorldIntents(intents, `commandSpell:${command.id}`);

  // Interrupts land on the Process, not on the world. `effectIntents` above
  // already skipped them, so nothing is applied twice.
  if (messageId) await interruptProcess(messageId, command, effects, masterId);

  return { ok: true, cost };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build the pure context the rules layer wants from the live world.
 *
 * @param {string} masterId
 * @param {string|undefined} window
 * @param {object} context
 * @returns {object|null}
 */
function contextFor(masterId, window, context) {
  const masterDoc = game.actors.get(masterId);
  if (!masterDoc) return null;

  const board = currentBoard();
  const master = unitFrom(board, masterDoc);
  // The contracted Servant, from the board so ZON is already settled — the
  // requirement most commands carry is "Servant in ZON", and a Servant
  // re-projected alone always reports "inside", which would pass every time.
  const servant = board.units.find((u) => u.masterId === masterId && u.kind === "servant") ?? null;

  return {
    master: { ...master, commandSpells: masterDoc.system?.commandSpells ?? 0 },
    servant,
    board,
    window,
    settings: { allMastersRankless: allMastersRankless(board) },
    ...context,
  };
}

/**
 * *"If all Masters are Rankless, the Kill Yourself command only costs one."*
 *
 * A property of the table, not of the Master, so it is answered from the board.
 *
 * @param {object} board
 * @returns {boolean}
 */
function allMastersRankless(board) {
  const masters = (board.units ?? []).filter((u) => u.kind === "master");
  return masters.length > 0 && masters.every((m) => !m.rank);
}

/**
 * Turn the rules layer's effect data into intents.
 *
 * The same division `OnEvent` actions use: the rules layer never constructs an
 * intent, because an intent is how layer 3 writes. An effect this does not
 * understand is **logged by name** rather than dropped — a Command Spell that
 * silently does nothing is the worst possible outcome for the most expensive
 * resource in the game.
 *
 * @param {object[]} effects
 * @returns {object[]}
 */
function effectIntents(effects, ctx) {
  /** @type {object[]} */
  const out = [];
  for (const e of effects) {
    const unit = ctx.servant?.id === e.unitId ? ctx.servant : ctx.master;
    switch (e.kind) {
      case "statChange":
        out.push(I.statDelta(e.unitId, `${e.stat}.value`, e.delta, e.clamp));
        break;

      case "defeat":
        out.push(I.defeat(e.unitId, "commandSpell"));
        break;

      case "cureDebuffs":
        // "Cures all debuffs except Unremovable ones." Unremovable is a
        // property of the instance, so the filter is on what the unit is
        // actually carrying rather than on a list of names.
        for (const inst of unit?.effectInstances ?? []) {
          if (inst.unremovable) continue;
          if (inst.polarity && inst.polarity !== "debuff") continue;
          out.push(I.removeEffect(e.unitId, inst.id ?? inst.defId, "commandSpell"));
        }
        break;

      case "cooldownDelta": {
        // `oneSkill` needs the player to say which, so it arrives on the
        // context; without a choice this does nothing rather than guessing.
        const targets = cooldownTargets(unit, e, ctx);
        for (const a of targets) {
          out.push(e.mode === "clear"
            ? I.cooldown(e.unitId, a.id, a.cooldownRemaining ?? 0, "reduce")
            : I.cooldown(e.unitId, a.id, ticksFrom(e.delta, ctx), "reduce"));
        }
        break;
      }

      // Interrupts change a Combat Process rather than the world, so they are
      // deliberately not intents -- `interruptProcess` applies them. Survive
      // Kill is in this group for a sharper reason: it is decided at the
      // moment of defeat, inside the Process that is about to kill the
      // Servant, not here, where it would heal a unit that was never going
      // to die.
      case "modifyDamage":
      case "escape":
      case "retarget":
      case "survive":
      case "overrideValidation":
        break;

      case "teleport":
        // A destination the caller chose. Without one this does nothing and
        // says so, rather than guessing a panel on the player's behalf — a
        // Command Spell that moves you somewhere you did not pick is worse
        // than one that reports it could not.
        if (!ctx.destination) {
          out.push(I.log({ kind: "commandNeedsDestination", effect: e.kind, unitId: e.unitId }));
          break;
        }
        for (const id of e.target === "pair" ? [ctx.master?.id, ctx.servant?.id] : [e.unitId]) {
          if (id) out.push(I.move(id, [ctx.destination], true));
        }
        break;

      default:
        // Named, never silent. A Command Spell that quietly does nothing is the
        // worst outcome for the most expensive resource in the game.
        out.push(I.log({ kind: "unappliedCommandEffect", effect: e.kind, unitId: e.unitId }));
        break;
    }
  }
  return out;
}

/**
 * Which abilities a cooldown command touches.
 *
 * @param {object|null} unit
 * @param {object} effect
 * @param {object} ctx
 * @returns {object[]}
 */
function cooldownTargets(unit, effect, ctx) {
  const abilities = (unit?.abilities ?? []).filter((a) => (a.cooldownRemaining ?? 0) > 0);
  switch (effect.scope) {
    case "allSkills":
      return effect.excludeNP ? abilities.filter((a) => !a.isNP) : abilities;
    case "theNP":
      return abilities.filter((a) => a.isNP);
    case "oneSkill":
    default: {
      const chosen = abilities.find((a) => a.id === ctx.abilityId);
      if (!chosen) return [];
      return effect.excludeNP && chosen.isNP ? [] : [chosen];
    }
  }
}

/**
 * `"-1◈"` in turns. Rounds, not turns — see `scheduler.mjs`.
 * @param {string|number} delta
 * @param {object} ctx
 * @returns {number}
 */
function ticksFrom(delta, ctx) {
  if (typeof delta === "number") return Math.abs(delta);
  const parsed = parseTick(String(delta).replace(/^-/, ""));
  return Math.abs(resolveTicks(parsed, { turnsPerRound: ctx.board?.turnsPerRound ?? 3 }));
}

/**
 * Apply a command's interrupt effects to a Combat Process in flight.
 *
 * @param {string} messageId
 * @param {object} command
 * @param {object[]} effects
 * @param {string} masterId
 * @returns {Promise<void>}
 */
async function interruptProcess(messageId, command, effects, masterId) {
  const message = game.messages.get(messageId);
  if (!message) return;

  let state = process.deserialize(message.getFlag("fgt", "process"));
  if (!process.interruptible(state)) return;

  for (const e of effects) {
    state = process.applyInterrupt(state, { ...e, command: command.id, masterId });
  }

  await message.setFlag("fgt", "process", process.serialize(state));
  // Resume: the ladder continues from wherever the interrupt left it, which
  // may be a different rung than the one it was suspended at (§17.4).
  const { advanceAttack } = await import("./attack.mjs");
  if (!process.pendingPrompt(state) && !process.isComplete(state)) {
    await advanceAttack({ messageId, event: "done" });
  }
}
