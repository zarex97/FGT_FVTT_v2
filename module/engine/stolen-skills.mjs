/**
 * @file A Skill taken from its owner, and a Skill obtained for good.
 * @see module/rules/skill-theft.mjs, CONTEXT.md, docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md
 *
 * Layer 3.
 *
 * **Stolen.** Its owner's Item stays where it is, marked `stolenBy`, and
 * `rules/summon-grants.mjs#grantHeld`, the one door every reader of a Unit's
 * abilities passes, then says it is not theirs: no use and no passive. The thief
 * gets a clone with the running clock. A discard writes the clock back and deletes
 * the clone (readings 26, 27). What it already landed stays.
 *
 * **Obtained.** A clone and nothing taken: a clear clock, its source's Rank, kept
 * for the rest of the game (reading 15).
 */

import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { chooseFor } from "./ask.mjs";
import { currentBoard, unitActor, unitOf } from "./board.mjs";
import { publicRow, shownAbility } from "./public-ability.mjs";
import { publicSpeakerFor, shownName } from "./public-identity.mjs";
import { isTakeableSkill, theftChance, theftTerms } from "../rules/skill-theft.mjs";
import { negatingEffectOf } from "../rules/snapshot.mjs";
import { rollOptionsFor } from "../rules/options.mjs";

/**
 * What a thief holds, by Insect Eater.
 *
 * @param {object} thief
 * @returns {object[]} Items
 */
export function stolenOn(thief) {
  return [...(thief?.items ?? [])].filter((i) => i.system?.stolenFrom?.unitId);
}

/**
 * The clone a Skill becomes on another Unit.
 *
 * @param {object} item
 * @returns {object} Item data
 */
function cloneOf(item) {
  const data = item.toObject();
  delete data._id;
  return data;
}

/**
 * Move a Skill to its thief, its clock with it, its owner's Mode off.
 *
 * @param {object} thief
 * @param {object} owner
 * @param {object} item the owner's Item
 * @returns {Promise<object>} the thief's clone
 */
export async function stealSkill(thief, owner, item) {
  const data = cloneOf(item);
  data.system.stolenFrom = { unitId: owner.id, itemId: item.id };
  data.system.stolenBy = null;
  data.system.grantedBy = theftAbilityOf(thief)?.system?.contentId ?? null;
  if (item.system?.active) await applyWorldIntents([I.setMode(owner.id, item.system?.slug ?? item.id, false, "stolen")], "theft:mode");
  const [clone] = await thief.createEmbeddedDocuments("Item", [data]);
  await item.update({ "system.stolenBy": thief.id });
  return clone;
}

/**
 * Hand a stolen Skill back: the running clock goes with it.
 *
 * @param {object} thief
 * @param {object} clone the thief's Item
 * @returns {Promise<void>}
 */
export async function returnStolen(thief, clone) {
  const from = clone.system?.stolenFrom ?? {};
  const owner = from.unitId ? unitActor(from.unitId) : null;
  const held = owner?.items?.get(from.itemId) ?? null;
  if (held) {
    await held.update({
      "system.stolenBy": null,
      "system.cooldown.remaining": clone.system?.cooldown?.remaining ?? 0,
    });
  }
  await thief.deleteEmbeddedDocuments("Item", [clone.id]);
}

/**
 * Discard every stolen Skill: Atomicros's first door, and her final defeat (reading 28).
 *
 * @param {object} thief
 * @returns {Promise<number>} how many went back
 */
export async function discardAllStolen(thief) {
  const held = stolenOn(thief);
  for (const clone of held) await returnStolen(thief, clone);
  return held.length;
}

/**
 * The thief's own ability that steals, if it is in force.
 *
 * @param {object} thief
 * @returns {object|null} the Item
 */
function theftAbilityOf(thief) {
  return [...(thief?.items ?? [])].find((i) => i.system?.stealsSkills
    && !i.system?.stolenBy && !negatingEffectOf(i, thief)) ?? null;
}

/**
 * Insect Eater, after this DU's last Damage Step: one roll per DU per Attack
 * (reading 22). None on a Unit fallen for good, since *"she can't rob from a fully
 * dead unit"* (reading 47), and no die with nothing to take.
 *
 * @param {object} state the Process
 * @returns {Promise<object[]>} card rows
 */
export async function rollSkillTheft(state) {
  const thief = unitActor(state.attackerId);
  const victim = state.defenderId ? unitActor(state.defenderId) : null;
  if (!thief || !victim || thief.id === victim.id) return [];
  if ((state.attack?.instanceCount ?? 1) - 1 > (state.attack?.instanceIndex ?? 0)) return [];
  const ability = theftAbilityOf(thief);
  if (!ability) return [];
  if (victim.system?.defeated) return [];

  const board = currentBoard();
  const name = shownName(victim, board);
  const offered = [...victim.items].filter((i) => isTakeableSkill(i) && !negatingEffectOf(i, victim));
  if (offered.length === 0) {
    return [{ unitId: thief.id, summary: {
      id: "theftNothing", name: game.i18n.format("FGT.Theft.Nothing", { ability: shownAbility(ability), name }), outcome: "applied", reason: null,
    } }];
  }

  const spec = ability.system.stealsSkills;
  const self = unitOf(thief, board);
  const du = unitOf(victim, board);
  const terms = theftTerms(spec, {
    options: rollOptionsFor({ attacker: self, defender: du, board }),
    magnitudeOf: (id) => (self?.effectInstances ?? []).filter((e) => e.defId === id)
      .reduce((sum, e) => sum + Number(e.magnitude ?? 0), 0),
    // The Rank in force: a board record carries its shifts, and a negated Skill is not held.
    rankOnTarget: (slug) => (du?.abilities ?? []).find((a) => (a.slug ?? a.id) === slug && !a.negated)?.rank ?? null,
  });
  const chance = theftChance(spec, terms);
  const listed = terms.map((t) => `${t.label} ${t.value > 0 ? "+" : ""}${t.value}`).join(", ");
  const words = { ability: shownAbility(ability), name, chance, terms: listed ? ` [${listed}]` : "" };
  // A zero is no die, and neither is a certainty (`effect-applier`'s `automatic`).
  if (chance <= 0) {
    return [{ unitId: thief.id, summary: { id: "theftNone", name: game.i18n.format("FGT.Theft.NoChance", words), outcome: "applied", reason: null } }];
  }
  const roll = chance >= 100 ? null : (await new Roll("1d100").evaluate()).total;
  if (roll !== null && roll > chance) {
    return [{ unitId: thief.id, summary: { id: "theftMissed", name: game.i18n.format("FGT.Theft.Missed", { ...words, roll }), outcome: "applied", reason: null } }];
  }

  // Her pick, by public row (readings 21, 55). Passing is hers too.
  const options = offered.map((item) => {
    const row = publicRow(item, victim);
    return { id: item.id, name: row.tag, subtitle: `${row.rank} · ${row.activity}`, detail: row.detail };
  });
  const picked = await chooseFor(thief, {
    title: game.i18n.localize("FGT.Theft.PickTitle"),
    hint: game.i18n.format("FGT.Theft.PickHint", { name }),
    min: 0,
    count: 1,
    // fgt-offer-ok: picks what to take, which is no use of it
    options,
  });
  const item = victim.items.get((picked ?? [])[0]);
  const rows = [];
  const rolled = roll === null ? game.i18n.format("FGT.Theft.Certain", words) : game.i18n.format("FGT.Theft.Hit", { ...words, roll });
  if (!item) {
    rows.push({ unitId: thief.id, summary: { id: "theftPassed", name: `${rolled} ${game.i18n.localize("FGT.Theft.Passed")}`, outcome: "applied", reason: null } });
    return rows;
  }
  await stealSkill(thief, victim, item);
  rows.push({ unitId: thief.id, summary: {
    id: "theft", name: `${rolled} ${game.i18n.format("FGT.Theft.Taken", { skill: shownAbility(item), name })}`, outcome: "applied", reason: null,
  } });

  // The fourth (reading 28): any of the four, the new one too, and the Token stays.
  const held = stolenOn(thief);
  if (held.length > Number(spec.limit ?? Infinity)) {
    const dropped = await chooseFor(thief, {
      title: game.i18n.localize("FGT.Theft.DiscardTitle"),
      hint: game.i18n.format("FGT.Theft.DiscardHint", { count: spec.limit }),
      min: 1,
      count: 1,
      // fgt-offer-ok: picks what to give back, which is no use of it
      // fgt-name-ok: the thief's own prompt; she holds them
      options: held.map((i) => ({ id: i.id, name: i.name })),
    });
    const clone = thief.items.get((dropped ?? [])[0]) ?? held[held.length - 1];
    const tag = shownAbility(clone);
    await returnStolen(thief, clone);
    rows.push({ unitId: thief.id, summary: { id: "theftDiscard", name: game.i18n.format("FGT.Theft.Discarded", { skill: tag }), outcome: "applied", reason: null } });
  }

  // Passive 2. Clamped to the pool's own maximum by the writer.
  if (spec.tokens) await applyWorldIntents([I.resource(thief.id, `resources.${spec.tokens}.value`, 1)], "theft:token");
  return rows;
}

/**
 * Sakura Eater's Passive: she can choose one non-Class Skill on the Unit she defeated
 * and keep it (reading 15). A window that waits on a person offers a way to pass.
 *
 * @param {string} killerId
 * @param {string} victimId
 * @returns {Promise<void>}
 */
export async function offerObtainedSkill(killerId, victimId) {
  const killer = unitActor(killerId);
  const victim = unitActor(victimId);
  if (!killer || !victim) return;
  const ability = [...killer.items].find((i) => i.system?.obtainsOnKill && !negatingEffectOf(i, killer));
  if (!ability) return;
  const { groupsOf } = await import("../rules/unit-groups.mjs");
  const groups = groupsOf({ kind: victim.type, trueName: victim.system?.trueName });
  if (!(ability.system.obtainsOnKill.groups ?? []).some((g) => groups.includes(g))) return;
  const offered = [...victim.items].filter((i) => isTakeableSkill(i, { classSkills: false }));
  if (offered.length === 0) return;
  const board = currentBoard();
  const picked = await chooseFor(killer, {
    title: game.i18n.localize("FGT.Obtain.Title"),
    hint: game.i18n.format("FGT.Obtain.Hint", { name: shownName(victim, board) }),
    min: 0,
    count: 1,
    // fgt-offer-ok: picks what to keep, which is no use of it
    options: offered.map((item) => {
      const row = publicRow(item, victim);
      return { id: item.id, name: row.tag, subtitle: `${row.rank} · ${row.activity}`, detail: row.detail };
    }),
  });
  const item = victim.items.get((picked ?? [])[0]);
  if (!item) return;
  const data = cloneOf(item);
  data.system.grantedBy = ability.system?.contentId ?? null;
  data.system.stolenFrom = null;
  data.system.stolenBy = null;
  data.system.cooldown = { ...(data.system.cooldown ?? {}), remaining: 0 };
  const [clone] = await killer.createEmbeddedDocuments("Item", [data]);
  await ChatMessage.create({
    content: `<div class="fgt-card"><p>${game.i18n.format("FGT.Obtain.Kept", {
      name: shownName(killer, board), skill: shownAbility(clone), from: shownName(victim, board),
    })}</p></div>`,
    speaker: publicSpeakerFor(killer),
  });
}
