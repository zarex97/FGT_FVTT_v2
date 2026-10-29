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

/* -------------------------------------------------------------------------- */
/*  An enemy Servant's page, learned on first sight                            */
/* -------------------------------------------------------------------------- */

/** What hides a Servant's information from True Name Discernment (#351 reading 3). */
const HIDING_EFFECTS = Object.freeze(["presenceConcealment", "disguise", "feignedDefeat"]);

/**
 * Does this Unit hide its information? Presence Concealment held as a Skill or
 * an effect, a Disguise, a Feigned Defeat (#351 reading 3).
 *
 * @param {object} unit a board Unit
 * @returns {boolean}
 */
export function hidesInformation(unit) {
  if ((unit?.effects ?? []).some((id) => HIDING_EFFECTS.includes(id))) return true;
  return (unit?.abilities ?? []).some((a) => a?.slug === "presenceConcealment");
}

/**
 * True Name Discernment, Passive 1: *"When you meet an enemy Servant for the
 * first time, record all information about it from its Notebook page to your
 * Notebook page. If that enemy Servant has Skills or effects that hide its
 * information, a successful Luck Check is required for this effect to
 * activate."* (#351 readings 2, 3).
 *
 * Heard on `unitFirstSeen`, which fires once a pair (`engine/vision.mjs`), so a
 * failed Check is final. An enemy Servant only. Its whole page goes into the
 * reader's Notebook; the die, when there is one, and the result are whispered to
 * the reader's player and the GM.
 *
 * @param {{unitId: string, targetId: string}} entry
 * @param {object} [board]
 * @returns {Promise<{learned: boolean, roll: number|null}|null>}
 */
export async function learnServantPage(entry, board = currentBoard()) {
  const reader = (board.units ?? []).find((u) => u.id === entry.unitId);
  const seen = (board.units ?? []).find((u) => u.id === entry.targetId);
  if (!reader || !seen || reader.defeated) return null;
  if (seen.kind !== "servant" || !reader.faction || seen.faction === reader.faction) return null;
  const user = readerOf(reader);
  const key = `servant:${seen.id}`;
  if (!user || notebookHolds(user, key)) return null;

  const { luckCheck, checkPlan } = await import("../rules/checks.mjs");
  const { luckChecksApply } = await import("../rules/difficulty.mjs");
  const { applyWorldIntents } = await import("./applier.mjs");
  const I = await import("./intents.mjs");

  let roll = null;
  let check = null;
  if (hidesInformation(seen) && luckChecksApply(board.difficulty)) {
    roll = (await new Roll("1d20").evaluate()).total;
    const plan = checkPlan(reader, "luck");
    check = luckCheck({
      roll,
      luck: Number(reader.luck ?? 0),
      opposingLuck: Number(seen.luck ?? 0),
      hasBoost: (reader.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
      hasLoss: (reader.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
      modifiers: plan.modifiers,
    });
    await applyWorldIntents([I.statDelta(reader.id, "luck.value", -1)], `trueName:luck:${reader.id}`);
  }
  const learned = !check || check.success;
  const doc = unitActor(seen.id);
  if (learned && doc) {
    await recordInNotebook(user, { key, title: doc.system?.trueName || doc.name, content: servantPage(doc) });
  }
  const escape = foundry.utils.escapeHTML;
  const name = publicIdentityOf(unitActor(reader.id), board).name;
  const seenName = publicIdentityOf(doc, board).name;
  const line = game.i18n.format(learned ? "FGT.TrueName.PageLearned" : "FGT.TrueName.PageMissed", {
    name: escape(name), seen: escape(seenName), trueName: escape(String(doc?.system?.trueName || doc?.name || "")),
    check: check ? game.i18n.format("FGT.TrueName.PageCheck", { total: check.total, target: check.target }) : "",
  });
  const player = reader.ownerUserId ? game.users.get(reader.ownerUserId) : null;
  const whisper = game.users.filter((u) => u.isGM || u.id === player?.id).map((u) => u.id);
  await ChatMessage.create({ content: `<div class="fgt-card"><p>${line}</p></div>`, whisper });
  return { learned, roll };
}

/**
 * A Servant's Notebook page: everything its sheet records.
 *
 * @param {object} doc the Servant's actor
 * @returns {string} HTML
 */
function servantPage(doc) {
  const escape = (v) => foundry.utils.escapeHTML(String(v ?? ""));
  const sys = doc.system ?? {};
  const params = Object.entries(sys.parameters ?? {}).map(([k, v]) => `${k.toUpperCase()} ${escape(v)}`).join(", ");
  const rows = [
    `<p><strong>${escape(sys.trueName || doc.name)}</strong> (${escape([...(sys.servantClasses ?? [])].join(", "))})</p>`,
    `<p>${params}</p>`,
    `<p>${escape([...(sys.attributes ?? [])].join(", "))}</p>`,
    ...[...(doc.items ?? [])].filter((i) => i.type === "ability").map((i) =>
      `<p><strong>${escape(i.name)}</strong>${i.system?.rank ? ` (${escape(i.system.rank)})` : ""}: ${escape(i.system?.description ?? "")}</p>`),
  ];
  return rows.join("");
}
