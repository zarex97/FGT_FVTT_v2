/**
 * @file Ending Presence Concealment, and everything that falls out of it.
 * @see module/rules/concealment.mjs, docs/45-case-studies.md
 *
 * Layer 3. `rules/concealment.mjs` decides; this is the half that writes.
 *
 * There are **six** ways concealment ends and they arrive from six unrelated
 * places — the Combat Process, the movement hooks, a coin flip inside the
 * damage step, a Skill's own 20%, the effect clock, and a player pressing the
 * button. Each of them owes the same four things: remove the state, start the
 * skill's own cooldown *from the deactivation* rather than from the use, tell
 * everyone, and **disclose any Secret Poison the concealed Unit inflicted**.
 *
 * That last one is why this is one function rather than six removals. Serenity's
 * Zabaniya inflicts Poison whose cause is hidden *"until Presence Concealment
 * is deactivated"* — a debt that comes due at a moment five of the six callers
 * have no reason to know about.
 */

import { isUntouchable } from "../rules/untouchable.mjs";
import { CONCEALMENT, CONCEALMENT_SLUG, DEACTIVATION_REASONS } from "../rules/concealment.mjs";
import { discoverAttempts, sees } from "../rules/identity.mjs";
import { lookup } from "../domain/tables.mjs";
import { Rank } from "../domain/rank.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { currentBoard, unitOf, unitActor } from "./board.mjs";
import * as I from "./intents.mjs";
import { publicSpeakerFor } from "./public-identity.mjs";
import { publicIdentityOf } from "./public-identity.mjs";
import { warRule, currentWar } from "./war.mjs";

/**
 * End a Unit's concealment.
 *
 * Safe to call on a Unit that is not concealed: it returns `false` and writes
 * nothing, which is what lets every caller ask without first checking.
 *
 * @param {string} unitId
 * @param {string} reason one of `DEACTIVATION_REASONS`
 * @returns {Promise<boolean>} whether anything was actually switched off
 */
export async function deactivateConcealment(unitId, reason) {
  const actor = unitActor(unitId);
  if (!actor) return false;

  const instance = actor.effects.find((e) => e.system?.defId === CONCEALMENT && !e.disabled);
  if (!instance) return false;

  pending.set(unitId, reason);
  await applyWorldIntents([I.removeEffect(unitId, CONCEALMENT, reason)], `concealment:${reason}`);
  // The aftermath runs from the document hook rather than from here, so the
  // **clock** and the **disclosure** happen on every removal path -- including
  // the one nothing in this file calls: the 2◈ simply running out.
  return true;
}

/**
 * Why concealment is being removed, when something in this file asked for it.
 *
 * The delete hook cannot see a reason, and "the duration expired" and "an enemy
 * found you" produce the same document deletion. One entry, consumed by the
 * hook that follows it.
 *
 * @type {Map<string, string>}
 */
const pending = new Map();

/**
 * Everything that follows a Presence Concealment instance going away.
 *
 * Driven from the document deletion rather than from the six callers, because
 * the sixth caller is the effect clock and there is nothing there to call. It
 * owes two things a bare removal does not do:
 *
 *   1. **The cooldown.** *"2◈ Turns after PC is deactivated"* — a clock that
 *      starts at the end of the Skill, not at its use.
 *   2. **The disclosure.** Every Secret Poison this Unit inflicted comes due.
 *
 * @param {string} unitId
 * @param {string} [reason]
 * @param {{granted?: boolean}} [opts] `granted`: the instance carried its own Rank (Dongyū)
 * @returns {Promise<void>}
 */
export async function onConcealmentRemoved(unitId, reason = DEACTIVATION_REASONS.expired, { granted = false } = {}) {
  const actor = unitActor(unitId);
  if (!actor) return;

  // A GRANTED concealment (Dongyū's, with its own Rank on the instance) was not
  // the Unit's Skill used, so its end starts no clock on that Skill (#249
  // reading 4). The disclosure and the announcement below still run.
  const skill = concealmentSkill(actor);
  const ticks = granted ? 0 : cooldownTicks(skill);
  if (skill && ticks > 0) {
    await applyWorldIntents(
      [
        I.cooldown(unitId, skill.id, ticks, "set"),
        I.log({
          kind: "concealmentEnded", unitId, reason,
          tick: currentWar()?.system?.globalTurn ?? 0,
        }),
      ],
      `concealment:${reason}`,
    );
  }

  await discloseSecretPoison(unitId);
  Hooks.callAll("fgt.modeToggled", { unitId, abilityId: skill?.id ?? null, active: false });
  Hooks.callAll("fgt.concealmentEnded", { unitId, reason });
}

/**
 * Watch for a Presence Concealment instance leaving an actor.
 *
 * GM only: the aftermath writes a cooldown and reveals hidden effects on other
 * people's Servants, and every connected client watching the same deletion
 * would otherwise race to do it.
 *
 * Called from `ready`.
 */
export function attachConcealment() {
  Hooks.on("deleteActiveEffect", (effect) => {
    if (effect.system?.defId !== CONCEALMENT) return;
    const unitId = effect.parent?.id;
    if (!unitId || !game.user?.isGM) return;

    const reason = pending.get(unitId) ?? DEACTIVATION_REASONS.expired;
    pending.delete(unitId);
    // Not awaited: this reacts to a document change and blocking the hook would
    // block the write that fired it, exactly as `attachForcedModes` does.
    onConcealmentRemoved(unitId, reason, { granted: Boolean(effect.system?.params?.rank) })
      .catch((err) => console.error("FGT | Concealment aftermath:", err));
  });

  // Skill Seal ending it at once is its Revised clause 8, read with Mad
  // Enhancement's twin in `engine/seal-ends.mjs` (#226 reading 16, #260 reading 3).
}

/**
 * Reveal every debt this Unit's concealment was hiding, and make it land.
 *
 * > *"They can be inflicted with **Secret Poison** instead, where the debuff
 * > and total Poison Damage taken is only revealed after Presence Concealment
 * > is deactivated."*
 *
 * Ruled on #199, and it replaces Q47's reading. The user's words: *"secret
 * poison damage should 'explode' (thereby apply the accumulated rightful
 * deductions that it would have done if it was a normal poison) when it is
 * revealed only."* So the ticks were banked, not taken
 * (`scheduler.mjs#tickPeriodics`, `I.bankSecret`), and here they land:
 *
 *   - every Secret Poison she inflicted, at once, one card per victim
 *     (reading 14);
 *   - the bank's total as ONE hit of Poison damage, through the ordinary
 *     defeat chain so Guts and revivals answer, with nothing recomputed
 *     (reading 15);
 *   - a bank Pois Heal has netted below zero heals instead (reading 16);
 *   - a bank survives a cleanse, which stopped only the later ticks. A victim
 *     defeated before the reveal has none: `io.defeat` drops it (reading 16).
 *
 * @param {string} inflicterId the Unit whose concealment just ended
 * @returns {Promise<Array<{unitId: string, total: number}>>}
 */
export async function discloseSecretPoison(inflicterId) {
  /** @type {Array<{unitId: string, total: number}>} */
  const disclosed = [];

  for (const victim of game.actors) {
    const hidden = victim.effects.filter(
      (e) => e.system?.attributionHidden && e.system?.sourceUnitId === inflicterId,
    );
    const banked = victim.system?.hiddenDamage?.[inflicterId];
    if (hidden.length === 0 && banked === undefined) continue;
    const total = banked ?? 0;

    if (hidden.length > 0) {
      await victim.updateEmbeddedDocuments("ActiveEffect", hidden.map((e) => ({
        _id: e.id,
        "system.attributionHidden": false,
        "system.visibility": "public",
      })));
    }
    // Key by key. `{"system.hiddenDamage": {}}` MERGES an ObjectField rather
    // than replacing it, so assigning an empty object is a no-op and the bank
    // would be revealed again on every later concealment. Only HER key: a
    // second concealed Unit's bank waits for its own reveal.
    if (banked !== undefined) {
      await victim.update({ [`system.hiddenDamage.-=${inflicterId}`]: null });
    }

    disclosed.push({ unitId: victim.id, total });
  }

  // Each card before its hit, so a defeat reads after the reason for it.
  for (const { unitId, total } of disclosed) {
    await announce(inflicterId, unitId, total);
    const victim = unitActor(unitId);
    if (!victim || victim.system?.defeated) continue;
    if (total > 0) {
      await applyWorldIntents([I.damage(unitId, total, null, {
        periodic: true, defId: "poison", bypassModifiers: true, secretReveal: true,
      })], "concealment:secretPoison");
    } else if (total < 0) {
      await applyWorldIntents([I.heal(unitId, -total, "poison")], "concealment:secretPoison");
    }
  }
  return disclosed;
}

/**
 * Say what was hidden, now that it can be said: one card per victim.
 *
 * The PUBLIC name. Revealing the SOURCE of the poison is the point of this
 * card; revealing who the Servant actually is, is a separate fact the rules
 * never said this reveals.
 *
 * @param {string} inflicterId
 * @param {string} unitId the victim
 * @param {number} total the bank, signed
 * @returns {Promise<void>}
 */
async function announce(inflicterId, unitId, total) {
  const inflicter = unitActor(inflicterId);
  const victim = unitActor(unitId);
  const name = victim ? publicIdentityOf(victim, currentBoard()).name : unitId;
  const source = inflicter ? publicIdentityOf(inflicter, currentBoard()).name : "a concealed Unit";
  const t = (key, data) => game.i18n.format(`FGT.SecretPoison.${key}`, data);
  let line;
  if (victim?.system?.defeated) line = t("Dropped", { name });
  else if (total > 0) line = t("Damage", { name, amount: total });
  else if (total < 0) line = t("Heal", { name, amount: -total });
  else line = t("Nothing", { name });

  await ChatMessage.create({
    content: `<div class="fgt-card"><h3>${game.i18n.localize("FGT.SecretPoison.Title")}</h3>`
      + `<p>${t("Source", { source })}</p><p>${line}</p></div>`,
    speaker: inflicter ? publicSpeakerFor(inflicter) : undefined,
  });
}

/**
 * The Presence Concealment item on this actor, if it has one.
 *
 * By **slug**, because the class skill is instantiated per Servant at eight
 * different Ranks and the document id differs on every one of them.
 *
 * @param {object} actor
 * @returns {object|null}
 */
export function concealmentSkill(actor) {
  return [...(actor?.items ?? [])].find((i) => i.system?.slug === CONCEALMENT_SLUG) ?? null;
}

/**
 * How long the skill sits on cooldown once it switches off.
 *
 * From the rank table, so `A+` and `C` differ without either being authored —
 * `presenceConcealmentCooldown` has been in `domain/tables.mjs` since the
 * tables were transcribed with nothing reading it.
 *
 * @param {object|null} skill
 * @returns {number} turns
 */
function cooldownTicks(skill) {
  if (!skill) return 0;
  // `||` rather than `??`, so a TickField that arrives blank rather than null
  // still falls through to the rank table. An authored expression wins; without
  // one, `presenceConcealmentCooldown` answers -- A+ is 2◈, which is six turns
  // at this world's three per Round.
  const authored = skill.system?.cooldown?.max || null;
  const rank = Rank.parseOrNull(skill.system?.rank);
  const expression = authored || (rank ? lookup("presenceConcealmentCooldown", rank) : null);
  if (!expression) return 0;
  return resolveTicks(parseTick(expression), {
    turnsPerRound: warRule("turnsPerRound"),
  });
}

/**
 * Roll for every enemy that could Discover this concealed Unit right now.
 *
 * > *"When This Unit Moves into an enemy Servant's Range (or Detect, if in
 * > use), it has a 5% chance of being discovered."*
 *
 * `discoverAttempts` has produced these since Ch. 06 was implemented and
 * **nothing ever called it** — because `unit.concealed` was never true, so it
 * returned an empty list even where it was reachable at all.
 *
 * Every roll is GM-only and silent unless it succeeds, and that is not
 * decoration: *"if either Player performs the roll, that would mean that they
 * would already know there is a Unit with Active Presence Concealment in the
 * area."* One roll per watcher, not per panel entered.
 *
 * @param {string} unitId the Unit that just moved
 * @returns {Promise<{attempts: number, discoveredBy: string|null}>}
 */
export async function runDiscoverChecks(unitId) {
  if (!game.user?.isGM) return { attempts: 0, discoveredBy: null };

  const actor = unitActor(unitId);
  const board = currentBoard();
  const unit = unitOf(actor, board);
  // A ghost is not looked for: the table believes it defeated, and only its
  // own Attack ends its Presence Concealment (#249 reading 18).
  if (isUntouchable(unit)) return { attempts: 0, discoveredBy: null };

  // The per-Turn budget, and the arrival order it is spent in. Both are read
  // before the attempts are computed and written after, because a Discover that
  // fails still costs the watcher its go for the Turn (Ch. 46 §46.4-AN).
  const tick = currentWar()?.system?.globalTurn ?? 0;
  const budget = budgetFor(actor, tick);
  const acquiredAt = { ...(budget.acquiredAt ?? {}) };
  recordArrivals(unit, board, acquiredAt, tick);

  const attempts = discoverAttempts(unit, board, { spent: budget.spent, acquiredAt });
  if (attempts.length === 0) {
    await saveBudget(actor, { ...budget, acquiredAt });
    return { attempts: 0, discoveredBy: null };
  }

  const spent = { ...budget.spent };
  for (const attempt of attempts) {
    // Charged whether or not it succeeds: the faction looked.
    spent[attempt.faction] = [...(spent[attempt.faction] ?? []), attempt.watcherId];
    await saveBudget(actor, { tick, spent, acquiredAt });

    const roll = await new Roll("1d100").evaluate();
    if (roll.total > attempt.chance) continue;

    Hooks.callAll("fgt.discovered", { unitId, byId: attempt.watcherId });
    await ChatMessage.create({
      // A Discover reveals a concealed unit's POSITION, not its identity.
      content: `<p><strong>Discovered.</strong> ${publicNameFor(attempt.watcherId) ?? "A watcher"}`
        + ` found ${publicNameFor(unitId) ?? unitId}`
        + ` (rolled ${roll.total} vs ${attempt.chance}%).</p>`,
    });
    await deactivateConcealment(unitId, DEACTIVATION_REASONS.discovered);
    return { attempts: attempts.length, discoveredBy: attempt.watcherId };
  }
  return { attempts: attempts.length, discoveredBy: null };
}

/**
 * This Unit's Discover budget, cleared if it belongs to an earlier Turn.
 *
 * `acquiredAt` survives the clearing and `spent` does not: *"in order of
 * arrival"* is about who found this Unit first, which is a fact across Turns,
 * while *"three per Turn"* obviously is not.
 *
 * @param {object|null} actor
 * @param {number} tick
 * @returns {{tick: number, spent: Record<string, string[]>, acquiredAt: Record<string, number>}}
 */
function budgetFor(actor, tick) {
  const stored = actor?.system?.discoverBudget ?? {};
  const acquiredAt = { ...(stored.acquiredAt ?? {}) };
  if (stored.tick !== tick) return { tick, spent: {}, acquiredAt };
  return { tick, spent: { ...(stored.spent ?? {}) }, acquiredAt };
}

/**
 * Note the first tick at which each current watcher held this Unit in Detect.
 *
 * Mutates `acquiredAt`, which is this function's whole job: an entry is written
 * ONCE and never overwritten, so a Servant that has been watching since Turn 4
 * keeps its place in the queue when a second arrives on Turn 9.
 *
 * Every enemy Servant currently in range is recorded, not merely the ones the
 * budget can afford — otherwise the fourth watcher of a Turn would be treated
 * as having arrived later than it did, and would keep losing its place.
 *
 * @param {object} unit the concealed unit's snapshot
 * @param {object} board
 * @param {Record<string, number>} acquiredAt
 * @param {number} tick
 */
function recordArrivals(unit, board, acquiredAt, tick) {
  for (const watcher of board?.units ?? []) {
    if (watcher.id === unit.id) continue;
    if (watcher.kind !== "servant" || watcher.defeated) continue;
    if ((watcher.faction ?? watcher.factionId) === (unit.faction ?? unit.factionId)) continue;
    if (!watcher.panel || !unit.panel) continue;
    if (!sees(watcher, unit, board)) continue;
    if (acquiredAt[watcher.id] === undefined) acquiredAt[watcher.id] = tick;
  }
}

/**
 * @param {object|null} actor
 * @param {object} budget
 * @returns {Promise<void>}
 */
async function saveBudget(actor, budget) {
  if (!actor) return;
  await actor.update({ "system.discoverBudget": budget });
}

/**
 * One unit's public name, by id.
 *
 * @param {string} unitId
 * @returns {string|null}
 */
function publicNameFor(unitId) {
  const actor = unitActor(unitId);
  return actor ? publicIdentityOf(actor, currentBoard()).name : null;
}
