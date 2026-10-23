/**
 * @file Learning the True Name of a Noble Phantasm used nearby.
 * @see docs/30-concealment-and-identity.md, module/engine/notebook.mjs
 *
 * Layer 3. *"When a NP with the 'Artistic' Attribute is used within a 3 panel
 * area of Gilles, he has a 15% chance of learning the True Name of that NP (the
 * information of that NP is copied to your Notebook)"* (#297, #323 reading 15).
 * The NP's user stands within the radius, on any side. The die and what it
 * learned go to the witness's player alone, on a whispered card: the NP's name
 * and text, never its user's identity.
 */

import { currentBoard, unitActor } from "./board.mjs";
import { publicIdentityOf } from "./public-identity.mjs";
import { notebookHolds, recordInNotebook } from "./notebook.mjs";

/** The NP's page key in a Notebook. */
const npKey = (ability) => `np:${ability.system?.contentId ?? ability.id}`;

/** Whose Notebook a witness learns into: its player's, else the GM's. */
const readerOf = (witness) =>
  (witness.ownerUserId ? game.users.get(witness.ownerUserId) : null) ?? game.users.activeGM ?? null;

/**
 * Every Unit near an NP's user rolls its chance of learning it.
 *
 * @param {object} userActor the NP's user
 * @param {object} ability the NP's Item
 * @param {object} [board]
 * @returns {Promise<Array<{witnessId: string, roll: number, chance: number, learned: boolean}>>}
 */
export async function witnessNP(userActor, ability, board = currentBoard()) {
  const tags = [...(ability?.system?.npTags ?? [])];
  const user = (board?.units ?? []).find((u) => u.id === userActor?.id);
  if (!user?.panel) return [];
  const out = [];
  for (const witness of board.units ?? []) {
    if (witness.id === user.id || witness.defeated || !witness.panel) continue;
    for (const learns of witness.learnsTrueNames ?? []) {
      if (!learns.tags.every((t) => tags.includes(t))) continue;
      const distance = Math.max(Math.abs(witness.panel.i - user.panel.i), Math.abs(witness.panel.j - user.panel.j));
      if (distance > learns.radius) continue;
      // Known already: nothing left to learn, and a miss would say otherwise.
      if (notebookHolds(readerOf(witness), npKey(ability))) continue;
      const roll = (await new Roll("1d100").evaluate()).total;
      const learned = roll <= learns.chance;
      out.push({ witnessId: witness.id, roll, chance: learns.chance, learned });
      await tellWitness(witness, ability, { roll, chance: learns.chance, learned }, board);
    }
  }
  return out;
}

/**
 * The witness's player hears the die, and on a success the NP goes in their
 * Notebook. Whispered to that player and the GM: nobody else learns that it
 * was rolled.
 *
 * @param {object} witness the board Unit
 * @param {object} ability the NP's Item
 * @param {{roll: number, chance: number, learned: boolean}} result
 * @param {object} board
 * @returns {Promise<void>}
 */
async function tellWitness(witness, ability, { roll, chance, learned }, board) {
  const doc = unitActor(witness.id);
  const name = publicIdentityOf(doc, board).name;
  const escape = foundry.utils.escapeHTML;
  const player = witness.ownerUserId ? game.users.get(witness.ownerUserId) : null;
  const reader = readerOf(witness);
  if (learned && reader) {
    await recordInNotebook(reader, {
      key: npKey(ability),
      title: ability.name,
      content: `<p>${escape(String(ability.system?.description ?? ""))}</p>`,
    });
  }
  // A miss names whose NP it was, never the NP: its name is what was not learned.
  const userName = publicIdentityOf(unitActor(ability.parent?.id ?? ability.actor?.id), board).name;
  const line = game.i18n.format(learned ? "FGT.TrueName.Learned" : "FGT.TrueName.Missed", {
    name: escape(name), np: escape(ability.name), user: escape(userName), roll, chance,
  });
  const whisper = game.users.filter((u) => u.isGM || u.id === player?.id).map((u) => u.id);
  await ChatMessage.create({ content: `<div class="fgt-card"><p>${line}</p></div>`, whisper });
}
