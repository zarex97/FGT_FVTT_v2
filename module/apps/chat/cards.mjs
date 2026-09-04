/**
 * @file Attack chat cards — the visible surface of the whole engine.
 * @see docs/30-chat-and-audit.md
 *
 * The card IS the audit record: the process state and the damage breakdown live
 * on message flags, so a match can be replayed from its chat log alone. That is
 * also what lets the reaction ladder resume after a reconnect.
 */

import { explainDamage } from "../../rules/explain.mjs";
import { visibleTo, renderBreakdown } from "../../rules/roll-log.mjs";
import { cardFor, skillEffectsFor } from "../../rules/card-visibility.mjs";
import { countdownFor } from "../../engine/await-timeout.mjs";
import { pendingPrompt, didHit, isComplete, PROMPTS, windowFor } from "../../engine/combat-process.mjs";
import { offerCommands } from "../../engine/command-spells.mjs";
import { publicIdentityOf, publicSpeakerFor } from "../../engine/public-identity.mjs";
import { currentBoard } from "../../engine/board.mjs";

/**
 * Create the card for a newly declared attack.
 * @param {object} args
 * @returns {Promise<object>} the ChatMessage
 */
export async function renderAttackCard({ state, attacker, ability, targets }) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/fgt/templates/chat/attack.hbs",
    await cardContext({ state, attacker, ability, targets }),
  );

  return ChatMessage.create({
    speaker: publicSpeakerFor(attacker, currentBoard()),
    content,
    flags: { fgt: { kind: "attack", attackerId: attacker.id, defenderId: state.defenderId } },
  });
}

/**
 * Re-render a card after the process advanced.
 * @param {object} message
 * @param {object} state
 */
export async function updateAttackCard(message, state) {
  const attacker = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attacker?.items.get(state.attack.abilityId) : null;
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/fgt/templates/chat/attack.hbs",
    await cardContext({
      state, attacker, ability,
      targets: state.defenderId ? [{ unitId: state.defenderId }] : [],
      result: message.getFlag("fgt", "result") ?? null,
      // The countdown needs the message it lives on -- the deadline is stored
      // there rather than computed per client, so two clients cannot disagree
      // by the drift between their clocks.
      message,
    }),
  );
  await message.update({ content });
}

/**
 * @param {object} args
 * @returns {Promise<object>}
 */
async function cardContext({ state, attacker, ability, targets, result = null, message = null }) {
  const prompt = pendingPrompt(state);
  const defender = game.actors.get(state.defenderId);
  // For the public names below: `publicNameOf` reads a unit's faction to say
  // "Rider of Red", and only the board knows the factions.
  const board = currentBoard();

  return {
    // The PUBLIC names. A card is one document every client reads, so it must
    // not print a concealed Servant's true name -- the same reason its token
    // shows a class image rather than its face.
    attackerName: attacker ? publicIdentityOf(attacker, board).name : "Unknown",
    defenderName: defender ? publicIdentityOf(defender, board).name : "—",
    abilityName: ability?.name ?? game.i18n.localize("FGT.Chat.NormalAttack"),
    abilityRank: ability?.system?.rank ?? null,
    isNP: ability?.type === "noblePhantasm",
    targetCount: targets?.length ?? 0,

    state: state.state,
    complete: isComplete(state),
    hit: didHit(state),

    // Which side is being asked, and for what. The prompt is rendered as
    // buttons on the card itself rather than as a popup dialog, so a player who
    // tabs away can still find it.
    prompt: prompt
      ? {
          ...prompt,
          label: game.i18n.localize(`FGT.Prompt.${prompt.kind}`),
          options: promptOptions(prompt, state),
          isMine: game.actors.get(prompt.unitId)?.isOwner ?? false,
        }
      : null,

    history: state.history.map((h) => ({
      state: h.state,
      event: h.event,
      label: game.i18n.localize(`FGT.Ladder.${h.state}`),
      detail: h.detail ?? null,
    })),

    // §27.5: the GM's "waiting for X (0:23)" indicator, and the button that
    // decides for an absent player. Shown from the start rather than after the
    // clock runs out -- a GM who can see the table knows somebody has left
    // before the timer does.
    countdown: message ? countdownFor(message) : null,

    // Command Spells offerable right now, to the Masters who could spend them.
    // Computed per viewer, because "which commands can I use" is a different
    // question for every player at the table.
    commandSpells: offerableCommands(state),

    result: result ? explainDamage(result) : null,

    // §26.7: what THIS viewer may see. A bystander gets the header and a count
    // of effects; the attacker gets their own contributing modifiers; the
    // defender gets what was applied to them; the GM gets everything.
    //
    // This is the part of closed-information play worth building. §26.6 assesses
    // shadow actors honestly and defers them -- Foundry cannot hide part of a
    // document, and the workaround doubles the document count for a failure mode
    // that leaks the wrong thing. The card covers most of the benefit at a
    // fraction of the cost, which §26.6 says outright.
    visibility: result
      ? cardFor(visibilityInput(state, result), {
        id: game.user.id, isGM: game.user.isGM,
      })
      : null,

    // The roll log (§14.8), filtered per viewer -- a hidden Discover roll on a
    // card everyone can read would give away the Assassin's panel.
    rolls: visibleTo(state.rolls ?? [], {
      isGM: game.user.isGM,
      ownedActorIds: game.actors.filter((a) => a.isOwner).map((a) => a.id),
    }).map((r) => ({ ...r, lines: renderBreakdown(r) })),
  };
}

/**
 * The Command Spells this viewer could spend on this Process right now.
 *
 * Offered only at an interruptible rung, and only what `availableCommands`
 * says is actually usable — §17.6 requires an unusable command's option to
 * never appear, and the same argument covers cost.
 *
 * @param {object} state
 * @returns {Array<{id: string, name: string, cost: number, masterId: string}>}
 */
function offerableCommands(state) {
  const window = windowFor(state);
  if (!window) return [];

  /** @type {Array<{id: string, name: string, cost: number, masterId: string}>} */
  const out = [];
  for (const master of game.actors.filter((a) => a.type === "master" && a.isOwner)) {
    for (const command of offerCommands({ masterId: master.id, window, context: attackContext(state) })) {
      out.push({ id: command.id, name: command.name, cost: command.cost, masterId: master.id });
    }
  }
  return out;
}

/**
 * The slice of the Process a command's requirements need to see.
 * @param {object} state
 * @returns {object}
 */
function attackContext(state) {
  return { state: state.state, attack: state.attack ?? null };
}

/**
 * The buttons offered for a prompting state, with their cost shown.
 * @param {object} prompt
 * @param {object} [state] the Combat Process, for the reactions it refuses
 * @returns {Array<{event: string, label: string, hint: string|null}>}
 */
function promptOptions(prompt, state = null) {
  if (prompt.kind === "reaction") {
    // `forbiddenReactions` has been written by the `retarget` interrupt since
    // Command Spells shipped and read by NOTHING, so a Servant pulled into an
    // attack it never saw coming could still Block and Evade it -- §27.9's own
    // rule, inert. Presence Concealment writes the same field.
    const refused = state?.forbiddenReactions ?? [];
    return [
      { event: "nothing", label: game.i18n.localize("FGT.Reaction.Nothing"), hint: null },
      { event: "block", label: game.i18n.localize("FGT.Reaction.Block"), hint: game.i18n.localize("FGT.Reaction.BlockHint") },
      { event: "evade", label: game.i18n.localize("FGT.Reaction.Evade"), hint: null },
    ].filter((o) => !refused.includes(o.event));
  }
  if (prompt.kind === "acceptOrEscape") {
    return [
      { event: "accept", label: game.i18n.localize("FGT.Reaction.Accept"), hint: null },
      { event: "cs", label: game.i18n.localize("FGT.Reaction.CommandSpell"), hint: null },
    ];
  }
  // The counter is a free choice — it costs no budget, only the risk of
  // standing in range. Named explicitly rather than left to fall through to
  // the Luck Check branch below, which would have offered a "Contest" button
  // that emits an event this rung has no transition for.
  if (prompt.kind === "counter") {
    return [
      { event: "counter", label: game.i18n.localize("FGT.Reaction.Counter"), hint: game.i18n.localize("FGT.Reaction.CounterHint") },
      { event: "declined", label: game.i18n.localize("FGT.Reaction.Decline"), hint: null },
    ];
  }
  // Every Luck Check rung is optional, because Luck is spent whether or not
  // the check succeeds. The cost is shown on the button.
  const unit = game.actors.get(prompt.unitId);
  const luck = unit?.system?.luck?.value ?? 0;
  return [
    {
      event: "contest",
      label: game.i18n.format("FGT.Reaction.Contest", { luck }),
      hint: luck < 1 ? game.i18n.localize("FGT.Reaction.NoLuck") : null,
      disabled: luck < 1,
    },
    { event: "declined", label: game.i18n.localize("FGT.Reaction.Decline"), hint: null },
  ];
}

/**
 * Wire the card's buttons. Registered once at `ready`.
 */
export function activateChatListeners() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    fillSkillEffects(message, html);

    for (const button of html.querySelectorAll("[data-fgt-event]")) {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        button.disabled = true;
        const { advanceAttack } = await import("../../engine/attack.mjs");
        try {
          await advanceAttack({ messageId: message.id, event: button.dataset.fgtEvent });
        } catch (err) {
          button.disabled = false;
          ui.notifications.error(err.message);
          throw err;
        }
      });
    }
    // Command Spell interrupts. Routed through the socket to the GM, because a
    // spend changes a Process other clients are participating in (Ch. 27 §27.9).
    for (const button of html.querySelectorAll("[data-fgt-cs]")) {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        button.disabled = true;
        const { FGTSocket } = await import("../../net/socket.mjs");
        try {
          const result = await FGTSocket.request("spendCommandSpell", {
            masterId: button.dataset.fgtMaster,
            commandId: button.dataset.fgtCs,
            messageId: message.id,
          });
          if (!result?.ok) {
            button.disabled = false;
            ui.notifications.warn(`FGT | Command Spell refused: ${result?.reason ?? "unknown"}`);
          }
        } catch (err) {
          button.disabled = false;
          ui.notifications.error(err.message);
          throw err;
        }
      });
    }
    // §27.5's "decide for them". GM-only, and it applies the SAME default the
    // timeout would -- so a GM who is tired of waiting cannot accidentally make
    // a costlier choice than the clock would have.
    for (const button of html.querySelectorAll("[data-fgt-decide]")) {
      button.addEventListener("click", async () => {
        const { applyExpiry } = await import("../../engine/await-timeout.mjs");
        await applyExpiry(message);
      });
    }

    for (const toggle of html.querySelectorAll("[data-fgt-toggle]")) {
      toggle.addEventListener("click", () => {
        const target = html.querySelector(`#${toggle.dataset.fgtToggle}`);
        if (target) target.hidden = !target.hidden;
      });
    }
  });
}

export { PROMPTS };

/**
 * The shape `cardFor` wants, from a Process state and its damage result.
 *
 * Attribution by **side** is what makes the redaction work: a row nobody
 * claimed is a fact about the board -- a facing bonus, terrain -- and stays
 * visible to both, because dropping it would leave a breakdown whose numbers do
 * not add up.
 *
 * @param {object} state
 * @param {object} result
 * @returns {object}
 */
function visibilityInput(state, result) {
  const attacker = game.actors.get(state.attackerId);
  const defender = game.actors.get(state.defenderId);

  return {
    summary: `${attacker?.name ?? "?"} → ${defender?.name ?? "?"}`,
    attackerId: state.attackerId,
    defenderIds: [state.defenderId],
    attackerControllers: ownersOf(attacker),
    defenderControllers: ownersOf(defender),
    controllersByActor: {
      [state.attackerId]: ownersOf(attacker),
      [state.defenderId]: ownersOf(defender),
    },
    total: result.total ?? 0,
    breakdown: (result.rows ?? result.contributions ?? []).map((row) => ({
      source: row.source ?? row.label ?? "",
      value: row.value ?? row.amount ?? 0,
      side: sideOf(row, state),
    })),
    effects: (state.appliedEffects ?? []).map((e) => e.defId ?? e),
    rolls: state.rolls ?? [],
  };
}

/**
 * Which side a breakdown row belongs to.
 *
 * Unattributed rows return `null` rather than guessing a side: guessing wrong
 * either leaks a source or removes a number the viewer needs to check the sum,
 * and `null` is the only answer that does neither.
 *
 * @param {object} row
 * @param {object} state
 * @returns {string|null}
 */
function sideOf(row, state) {
  const owner = row.sourceUnitId ?? row.unitId ?? null;
  if (!owner) return null;
  if (owner === state.attackerId) return "attacker";
  if (owner === state.defenderId) return "defender";
  return null;
}

/** @param {object} actor @returns {string[]} */
function ownersOf(actor) {
  if (!actor) return [];
  return game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

/**
 * Fill a Skill card's effect list for whoever is looking at it.
 *
 * §26.7's `filtered` mode: one message, rendered differently per client. The
 * card ships with a count and the hook replaces it with the rows this viewer
 * is entitled to read — everything for the caster's controller and the GM, and
 * for everyone else only what landed on a unit they control.
 *
 * A Servant buffing itself is the case that prompted this: the card listed
 * every buff to the whole table, which tells an opponent exactly what that
 * Servant just gained.
 *
 * @param {object} message
 * @param {HTMLElement} html
 */
function fillSkillEffects(message, html) {
  const flags = message.getFlag?.("fgt", "kind") === "skill" ? message.flags.fgt : null;
  const list = html.querySelector("[data-fgt-effects]");
  if (!flags || !list) return;

  const { names, hidden } = skillEffectsFor(flags.rows, {
    id: game.user.id,
    isGM: game.user.isGM,
    casterControllers: flags.casterControllers ?? [],
  });

  const rows = names.map((n) => `<li>${foundry.utils.escapeHTML(n)}</li>`);
  // A count rather than silence: "something happened" is public, "what" is not.
  if (hidden > 0) {
    rows.push(
      `<li class="fgt-card__hidden">${game.i18n.format("FGT.Skill.HiddenEffects", { n: hidden })}</li>`,
    );
  }
  list.innerHTML = rows.join("");
}
