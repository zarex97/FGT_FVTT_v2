/**
 * @file Spending a Command Spell.
 * @see docs/33-command-spells.md, Ch. 33, Ch. 33
 *
 * Layer 3. The rules decide *whether* and *what*; this pays and writes.
 *
 * Everything downstream of a spend already existed — the `spendCS` intent, the
 * applier case, `io.spendCommandSpells`, `commandSpells` on the Master schema.
 * What was missing was the middle: nothing decided which command was offerable,
 * so nothing ever constructed the intent and no Command Spell was ever spent.
 */

import { suspendableSkills, availableCommands, canSpend, effectsOf, costOf, teleportLandings, teleportMovers, teleportPanels, servantsForProcess } from "../rules/command-spells.mjs";
import { CommandSpellRegistry } from "../rules/cs-registry.mjs";
import { currentBoard, unitFrom } from "./board.mjs";
import * as I from "./intents.mjs";
import { sharedCooldownIntents } from "./cooldown.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as process from "./combat-process.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";

/**
 * The commands this Master may use at this moment.
 *
 * Offered commands are already filtered to the *usable* ones: Ch. 33 requires
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
 * The Servants contracted to this Master, alive on the board: the only Units a
 * Command Spell may serve (ruled 2026-10-14, #204).
 *
 * @param {string} masterId
 * @param {object} board
 * @returns {object[]}
 */
export function liveServantsOf(masterId, board) {
  return (board?.units ?? []).filter((u) => u.kind === "servant" && u.masterId === masterId && !u.defeated);
}

/**
 * Every Command Spell a Master in the match could spend on this Combat
 * Process, each for one named Servant: the card's buttons, and the question
 * `attack.mjs#awaitInterrupt` asks before holding a rung open.
 *
 * A command that changes the attack is offered only for the Master's Servant
 * in it, on its side (`servantsForProcess`); one that does not is offered for
 * each live Servant, so a Master of three heals the one it means.
 *
 * @param {object} state the Process
 * @param {object} [board]
 * @returns {Array<{command: object, masterId: string, servantId: string, servantName: string, several: boolean}>}
 */
export function processOffers(state, board = currentBoard()) {
  const window = process.windowFor(state);
  if (!window) return [];
  const context = { state: state.state, attack: state.attack ?? null };
  /** @type {object[]} */
  const out = [];
  for (const master of (board.units ?? []).filter((u) => u.kind === "master" && !u.defeated)) {
    const servants = liveServantsOf(master.id, board);
    for (const servant of servants) {
      const ctx = contextFor(master.id, window, { ...context, servantId: servant.id }, board);
      if (!ctx) continue;
      for (const command of availableCommands(CommandSpellRegistry.all(), ctx)) {
        if (!servantsForProcess(command, state, master.id, servants).some((s) => s.id === servant.id)) continue;
        // fgt-name-ok: the Master's own player's Command Spell list
        out.push({ command, masterId: master.id, servantId: servant.id, servantName: servant.name, several: servants.length > 1 });
      }
    }
  }
  return out;
}

/**
 * Where this command's teleport may land, for the player to choose from before
 * it is bought; `null` when the command moves nobody.
 *
 * @param {string} masterId
 * @param {string} commandId
 * @param {string|null} [servantId] the Servant it is spent for
 * @returns {Array<{i: number, j: number}>|null}
 */
export function teleportDestinations(masterId, commandId, servantId = null) {
  const command = CommandSpellRegistry.get(commandId);
  const ctx = command ? contextFor(masterId, null, servantId ? { servantId } : {}) : null;
  if (!ctx) return null;
  const teleport = effectsOf(command, ctx).find((e) => e.kind === "teleport");
  return teleport ? teleportPanels(teleport, ctx) : null;
}

/**
 * Validate, pay for, and apply a Command Spell.
 *
 * The order is deliberate and is Ch. 33's: validate, **then** pay, then apply.
 * Paying before validating would burn a charge on a refusal, and applying
 * before paying would let a failed write leave a free command.
 *
 * @param {object} args
 * When a `messageId` is supplied the command is an **interrupt**: the effects
 * that change an in-flight resolution are applied to that Combat Process
 * instead of to the world, and the ladder resumes from wherever they left it.
 * That is a GM-side mutation by design (Ch. 23) — it changes a Process another
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

  // On a card, only what that card offers, and only while it can still be
  // interrupted: both are asked BEFORE the spend (Ch. 33: validate, then pay).
  // A Process that had moved on took the payment and changed nothing.
  if (messageId) {
    const flag = game.messages.get(messageId)?.getFlag("fgt", "process");
    const state = flag ? process.deserialize(flag) : null;
    if (!state || !process.interruptible(state)) return { ok: false, reason: "notInterruptible" };
    const offered = processOffers(state, ctx.board)
      .some((o) => o.command.id === command.id && o.masterId === masterId && o.servantId === ctx.servant?.id);
    if (!offered) return { ok: false, reason: "notInThisAttack" };
  }

  const cost = costOf(command, ctx.master, ctx.settings);
  const effects = effectsOf(command, ctx);
  // A teleport with nowhere legal to land is refused BEFORE it is paid for
  // (Ch. 33: validate, then pay). Escape and Teleport Servant were bought from
  // an attack card with no destination at all, so each one cost a Command
  // Spell, moved nobody and left the attack running (#204 Q6).
  if (effects.some((e) => e.kind === "teleport" && !teleportLandings(e, ctx, ctx.destination))) {
    return { ok: false, reason: "noDestination" };
  }
  // A Suspend Skill naming a Skill it may not buy off now, refused before it is
  // paid for: Fated Rivals only while it binds (#206 reading 2). The picker
  // lists by the same reader.
  if (effects.some((e) => e.kind === "suspendSkill") && context.abilityId) {
    const items = [...(game.actors.get(ctx.servant?.id)?.items ?? [])];
    const named = items.filter((i) => i.id === context.abilityId);
    if (named.length > 0 && suspendableSkills(named, ctx.servant).length === 0) {
      return { ok: false, reason: "notBound" };
    }
  }
  const intents = [
    I.spendCS(masterId, cost, command.id, ctx.servant?.id ?? null),
    // Ch. 33: the audit trail says who spent what, on whom, and when — a
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
  if (messageId) await interruptProcess(messageId, command, interruptsOf(effects, ctx), masterId);
  // ...and one spent in a Master's own Turn says so on a card. An interrupt
  // shows on the attack card it interrupted; this had nowhere at all (#190).
  else await postCommandSpellCard({ master: ctx.master, servant: ctx.servant, command, cost, abilityId: context.abilityId ?? null });

  return { ok: true, cost };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The card a Command Spell spent outside any Process posts.
 *
 * @param {object} args
 * @param {object} args.master the Master's snapshot
 * @param {object|null} args.servant the contracted Servant's snapshot
 * @param {object} args.command
 * @param {number} args.cost
 * @param {string|null} args.abilityId the Skill it reached, when it reaches one
 * @returns {Promise<void>}
 */
async function postCommandSpellCard({ master, servant, command, cost, abilityId }) {
  const escape = foundry.utils.escapeHTML;
  const skill = abilityId ? game.actors.get(servant?.id)?.items.get(abilityId)?.name ?? null : null;
  // The Servant's public name: a card every player reads said *"on Arjuna's
  // Fated Rivals"* under an Archer the table knew only as Archer (#234, as
  // every engine line since #230 §46.4-NV).
  const { shownName } = await import("./public-identity.mjs");
  const servantDoc = servant?.id ? game.actors.get(servant.id) : null;
  const servantName = servantDoc ? shownName(servantDoc, currentBoard()) : "";
  const text = game.i18n.format(skill ? "FGT.CommandSpell.SpentOn" : "FGT.CommandSpell.Spent", {
    master: escape(master?.name ?? ""), cost, name: escape(command.name),
    servant: escape(servantName), skill: escape(skill ?? ""),
  });
  await ChatMessage.create({
    content: `<div class="fgt-card fgt-card--command-spell"><p>${text}</p></div>`,
    flags: { fgt: { commandSpell: command.id } },
  });
}

/**
 * Build the pure context the rules layer wants from the live world.
 *
 * @param {string} masterId
 * @param {string|undefined} window
 * @param {object} context `servantId` names the Servant it is spent for
 * @param {object} [board] the board to read, when the caller already holds one
 * @returns {object|null}
 */
function contextFor(masterId, window, context, board = currentBoard()) {
  const masterDoc = game.actors.get(masterId);
  if (!masterDoc) return null;

  const master = unitFrom(board, masterDoc);
  // The contracted Servant, from the board so ZON is already settled — the
  // requirement most commands carry is "Servant in ZON", and a Servant
  // re-projected alone always reports "inside", which would pass every time.
  //
  // The one the Master names (ruled 2026-10-14, #204): Drake's Master holds
  // Drake, Castor and Pollux, and every command acted on whichever the board
  // listed first. Alive and on the board, or none at all.
  const servants = liveServantsOf(masterId, board);
  const servant = context.servantId
    ? (servants.find((u) => u.id === context.servantId) ?? null)
    : (servants[0] ?? null);

  return {
    master: { ...master, commandSpells: masterDoc.system?.commandSpells ?? 0 },
    servant,
    board,
    window,
    // The match clock. Every duration in this game is stored as an ABSOLUTE
    // expiry tick (Ch. 04), so a command that lasts a span needs to know
    // where "now" is -- and this context did not carry it. `cs-suspend-skill`
    // is the first command whose effect has a duration at all; without this it
    // stamped `0 + ticks`, which on any tick past the third is a suspension
    // that expired before it was bought. Measured live at tick 4: the Command
    // Spell was spent, the mode switched off, and the reconciler switched it
    // straight back on.
    tick: game.combat?.system?.globalTurn ?? 0,
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
        const cuts = targets.map((a) => (e.mode === "clear"
          ? I.cooldown(e.unitId, a.id, a.cooldownRemaining ?? 0, "reduce")
          : I.cooldown(e.unitId, a.id, ticksFrom(e.delta, ctx), "reduce")));
        // The clock a group shares by name is one clock (#209 reading 2): the
        // Dioscuri's Skill cooled on Castor is cooled on Pollux.
        out.push(...cuts, ...sharedCooldownIntents(cuts, unit, ctx.board));
        break;
      }

      case "suspendSkill": {
        // Switch one named Skill off and bar it from returning for a span.
        //
        // Two sheets buy this and both were prose: Raikou's Mad Enhancement
        // *"can be deactivated for 1◈ Turns by spending a Command Spell (it
        // will reactivate if the aforementioned conditions are still met after
        // those 1◈ Turns)"*, and Penthesilea's Hatred of Achilles *"can be
        // disabled for 1◈ Turns by spending one Command Spell"*.
        //
        // The LAPSE BACK needs no timer. When the span passes, `forcedModes`
        // sees the condition still holding and `reconcileForcedModes` switches
        // it on again -- which is exactly what Raikou's parenthesis describes.
        //
        // The ability is resolved the way `cooldownTargets` resolves
        // `oneSkill`: the player has already named it on the context. Without
        // one this reports rather than guessing, the rule this whole file
        // follows for the most expensive resource in the game.
        const chosen = (unit?.abilities ?? []).find((a) => a.id === ctx.abilityId);
        if (!chosen) {
          out.push(I.log({ kind: "commandNeedsAbility", effect: e.kind, unitId: e.unitId }));
          break;
        }
        out.push(I.suspendSkill(
          e.unitId, chosen.id, (ctx.tick ?? 0) + ticksFrom(e.duration, ctx), "commandSpell",
        ));
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

      case "teleport": {
        // A destination the caller chose. Without one this does nothing and
        // says so, rather than guessing a panel on the player's behalf — a
        // Command Spell that moves you somewhere you did not pick is worse
        // than one that reports it could not. `spendCommandSpell` refuses
        // first, so this is the backstop.
        const landings = teleportLandings(e, ctx, ctx.destination);
        if (!landings) {
          out.push(I.log({ kind: "commandNeedsDestination", effect: e.kind, unitId: e.unitId }));
          break;
        }
        // Escape's pair lands side by side, never on one panel: the Master
        // where the player chose, the Servant on the nearest free panel.
        for (const { unitId, panel } of landings) out.push(I.move(unitId, [panel], true));
        break;
      }

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
 * The interrupts a command's effects make of a Combat Process.
 *
 * A `teleport` that carries the Process's defender away is an **escape**: the
 * attack resolves against nobody (ruled 2026-10-14, #204 Q6 — a Command Spell
 * beats even Gate of Skye, which nothing else avoids). `combat-process.mjs`
 * has had the `escape` interrupt since it was written, and no command made
 * one: Escape authors `teleport`, which the Process recorded as not applied.
 *
 * @param {object[]} effects
 * @param {object} ctx
 * @returns {(defenderId: string) => object[]}
 */
function interruptsOf(effects, ctx) {
  return (defenderId) => effects.flatMap((e) => {
    if (e.kind !== "teleport") return [e];
    return teleportMovers(e, ctx).includes(defenderId) ? [{ kind: "escape" }] : [];
  });
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
async function interruptProcess(messageId, command, effectsFor, masterId) {
  const message = game.messages.get(messageId);
  if (!message) return;

  const first = process.deserialize(message.getFlag("fgt", "process"));
  if (!process.interruptible(first)) return;

  // The card it was bought on, and every sibling of that declaration the
  // teleport carries a defender out of: Gate of Skye over a Master and its
  // Servant is two Processes, and Escape moves them both (#204 Q6).
  const siblings = first.groupId
    ? game.messages.filter((m) => m.id !== messageId && m.getFlag?.("fgt", "process")
      && process.deserialize(m.getFlag("fgt", "process")).groupId === first.groupId)
    : [];

  const { advanceAttack } = await import("./attack.mjs");
  for (const msg of [message, ...siblings]) {
    let state = process.deserialize(msg.getFlag("fgt", "process"));
    if (!process.interruptible(state)) continue;
    const effects = effectsFor(state.defenderId);
    // A sibling only takes what reaches it; the card's own Process takes all.
    if (msg !== message && !effects.some((e) => e.kind === "escape")) continue;
    for (const e of msg === message ? effects : effects.filter((x) => x.kind === "escape")) {
      state = process.applyInterrupt(state, { ...e, command: command.id, masterId });
    }

    await msg.setFlag("fgt", "process", process.serialize(state));
    // Resume: the ladder continues from wherever the interrupt left it, which
    // may be a different rung than the one it was suspended at (Ch. 33).
    if (!process.pendingPrompt(state) && !process.isComplete(state)) {
      await advanceAttack({ messageId: msg.id, event: "done" });
    }
  }
}
