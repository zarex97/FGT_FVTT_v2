/**
 * @file Playing a Combat Process the way the table does, inside a test world.
 * @see module/engine/attack.mjs, module/engine/combat-process.mjs, docs/21-combat-process.md, docs/44-testing.md
 *
 * A declared attack stops at its first question to a person, the defender's
 * reaction, with its state in a chat message's `flags.fgt.process`. At the
 * table the defender's player presses a button on that card, and the GM's
 * client runs `advanceAttack({messageId, event})` (`apps/chat/cards.mjs` →
 * `OPERATIONS.advanceProcess` → `advanceAttack`). This file presses those
 * buttons: it reads the pending question off each open Process and answers it
 * from the test's script, every Process of a fan-out at once, because a
 * Process can wait on its siblings (`attack.mjs#siblingsPastDamage`).
 *
 * A question the script does not answer fails the play, the same rule the
 * world applies to a dialog: an unexpected question is often the bug.
 */

import * as process from "../../module/engine/combat-process.mjs";

/**
 * Declare an attack and play every Process it opens to the end.
 *
 * @param {object} w the test world
 * @param {object} play
 * @param {string} play.attacker the attacking Unit's id
 * @param {string|null} [play.ability] the ability's item id; `null` for a Normal Attack
 * @param {object} [play.placement] the targeting choices; built from `target` when absent
 * @param {string} [play.target] one target Unit's id, as the sheet sends a targeted token
 * @param {Record<string, string|string[]>} [play.react] by Unit id, the button(s) that Unit presses, in order
 * @returns {Promise<{declared: object, processes: object[]}>}
 */
export async function playAttack(w, { attacker, ability = null, placement = undefined, target = undefined, react = {} }) {
  const { resolveAttack, advanceAttack } = await import("../../module/engine/attack.mjs");
  const presses = Object.fromEntries(Object.entries(react).map(([id, e]) => [id, [e].flat()]));
  const declared = await resolveAttack({
    attackerId: attacker,
    abilityId: ability,
    placement: placement ?? (target ? { unitId: target, chosenIds: [target] } : {}),
  });
  const ids = (declared.processes ?? [{ messageId: declared.messageId }]).map((p) => p.messageId).filter(Boolean);

  const stateOf = (id) => process.deserialize(w.messages.get(id).getFlag("fgt", "process"));
  const play = async (id) => {
    for (let step = 0; step < 50; step += 1) {
      const state = stateOf(id);
      if (process.isComplete(state)) return state;
      const prompt = process.pendingPrompt(state);
      if (!prompt) return state;
      const event = presses[prompt.unitId]?.shift();
      if (!event) {
        throw new Error(`Process ${id} asks ${prompt.unitId} (${prompt.kind}: ${JSON.stringify(prompt.options)}) and the script has no answer.`);
      }
      await advanceAttack({ messageId: id, event });
    }
    throw new Error(`Process ${id} did not finish in 50 presses.`);
  };
  const processes = await Promise.all(ids.map(play));
  return { declared, processes };
}

/**
 * Use a Skill as the sheet does: `useSkill` on the GM's client (`OPERATIONS.useSkill`).
 *
 * @param {object} _w the test world
 * @param {{caster: string, ability: string, placement?: object}} use
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function castSkill(_w, { caster, ability, placement = {} }) {
  const { useSkill } = await import("../../module/engine/skill-use.mjs");
  return useSkill({ actorId: caster, abilityId: ability, placement });
}
