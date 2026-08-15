/**
 * @file Attack chat cards — the visible surface of the whole engine.
 * @see docs/30-chat-and-audit.md
 *
 * The card IS the audit record: the process state and the damage breakdown live
 * on message flags, so a match can be replayed from its chat log alone. That is
 * also what lets the reaction ladder resume after a reconnect.
 */

import { explainDamage } from "../../rules/explain.mjs";
import { pendingPrompt, didHit, isComplete, PROMPTS } from "../../engine/combat-process.mjs";

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
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
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
    }),
  );
  await message.update({ content });
}

/**
 * @param {object} args
 * @returns {Promise<object>}
 */
async function cardContext({ state, attacker, ability, targets, result = null }) {
  const prompt = pendingPrompt(state);
  const defender = game.actors.get(state.defenderId);

  return {
    attackerName: attacker?.name ?? "Unknown",
    defenderName: defender?.name ?? "—",
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
          options: promptOptions(prompt),
          isMine: game.actors.get(prompt.unitId)?.isOwner ?? false,
        }
      : null,

    history: state.history.map((h) => ({
      state: h.state,
      event: h.event,
      label: game.i18n.localize(`FGT.Ladder.${h.state}`),
      detail: h.detail ?? null,
    })),

    result: result ? explainDamage(result) : null,
  };
}

/**
 * The buttons offered for a prompting state, with their cost shown.
 * @param {object} prompt
 * @returns {Array<{event: string, label: string, hint: string|null}>}
 */
function promptOptions(prompt) {
  if (prompt.kind === "reaction") {
    return [
      { event: "nothing", label: game.i18n.localize("FGT.Reaction.Nothing"), hint: null },
      { event: "block", label: game.i18n.localize("FGT.Reaction.Block"), hint: game.i18n.localize("FGT.Reaction.BlockHint") },
      { event: "evade", label: game.i18n.localize("FGT.Reaction.Evade"), hint: null },
    ];
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
    for (const toggle of html.querySelectorAll("[data-fgt-toggle]")) {
      toggle.addEventListener("click", () => {
        const target = html.querySelector(`#${toggle.dataset.fgtToggle}`);
        if (target) target.hidden = !target.hidden;
      });
    }
  });
}

export { PROMPTS };
