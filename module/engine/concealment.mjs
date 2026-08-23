/**
 * @file Ending Presence Concealment, and everything that falls out of it.
 * @see module/rules/concealment.mjs, docs/44-case-expanded-roster.md §44.4
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

import { CONCEALMENT, CONCEALMENT_SLUG, DEACTIVATION_REASONS } from "../rules/concealment.mjs";
import { discoverAttempts } from "../rules/identity.mjs";
import { lookup } from "../domain/tables.mjs";
import { Rank } from "../domain/rank.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { currentBoard, unitSnapshot } from "./board.mjs";
import * as I from "./intents.mjs";

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
  const actor = game.actors.get(unitId);
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
 * @returns {Promise<void>}
 */
export async function onConcealmentRemoved(unitId, reason = DEACTIVATION_REASONS.expired) {
  const actor = game.actors.get(unitId);
  if (!actor) return;

  const skill = concealmentSkill(actor);
  const ticks = cooldownTicks(skill);
  if (skill && ticks > 0) {
    await applyWorldIntents(
      [
        I.cooldown(unitId, skill.id, ticks, "set"),
        I.log({
          kind: "concealmentEnded", unitId, reason,
          tick: game.combat?.system?.globalTurn ?? 0,
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
    onConcealmentRemoved(unitId, reason)
      .catch((err) => console.error("FGT | Concealment aftermath:", err));
  });
}

/**
 * Reveal every debt this Unit's concealment was hiding.
 *
 * > *"They can be inflicted with **Secret Poison** instead, where the debuff
 * > and total Poison Damage taken is only revealed after Presence Concealment
 * > is deactivated."*
 *
 * Q47's reading, which the whole design turns on: the damage lands **on
 * schedule**, and only its *cause* is deferred. A genuinely deferred pool would
 * mean a Unit's displayed Health and its real Health disagree — a Servant
 * walking around already dead — and every other part of this system works to
 * prevent exactly that.
 *
 * So what is disclosed is the attribution and the tally: the hidden instances
 * become visible, and the running total of unattributed damage is posted and
 * cleared.
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
    const tally = victim.system?.hiddenDamage ?? {};
    const total = Object.values(tally).reduce((a, b) => a + (b ?? 0), 0);
    if (hidden.length === 0 && total === 0) continue;

    if (hidden.length > 0) {
      await victim.updateEmbeddedDocuments("ActiveEffect", hidden.map((e) => ({
        _id: e.id,
        "system.attributionHidden": false,
        "system.visibility": "public",
      })));
    }
    // Key by key. `{"system.hiddenDamage": {}}` MERGES an ObjectField rather
    // than replacing it, so assigning an empty object is a no-op and the tally
    // would be disclosed again -- and again -- on every subsequent concealment.
    // Found live: the card was right and the ledger never cleared.
    if (total > 0) {
      await victim.update(Object.fromEntries(
        Object.keys(tally).map((key) => [`system.hiddenDamage.-=${key}`, null]),
      ));
    }

    disclosed.push({ unitId: victim.id, total });
  }

  if (disclosed.length > 0) await announce(inflicterId, disclosed);
  return disclosed;
}

/**
 * Say what was hidden, now that it can be said.
 *
 * A secret that is never revealed is indistinguishable from a bug, and this one
 * has been taking Health off a player's Servant for several Rounds with an
 * unattributed log entry. §29's standard applies with more force here than
 * anywhere: the state **and its cause**.
 *
 * @param {string} inflicterId
 * @param {Array<{unitId: string, total: number}>} disclosed
 * @returns {Promise<void>}
 */
async function announce(inflicterId, disclosed) {
  const inflicter = game.actors.get(inflicterId);
  const rows = disclosed.map(({ unitId, total }) => {
    const name = game.actors.get(unitId)?.name ?? unitId;
    return total > 0
      ? `<li>${name} — <strong>${total}</strong> Poison damage</li>`
      : `<li>${name} — Poison, revealed</li>`;
  });

  await ChatMessage.create({
    content: `<p><strong>Secret Poison</strong> revealed: ${inflicter?.name ?? "a concealed Unit"}`
      + ` was the source.</p><ul>${rows.join("")}</ul>`,
    speaker: inflicter ? ChatMessage.getSpeaker({ actor: inflicter }) : undefined,
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
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
  });
}

/**
 * Roll for every enemy that could Discover this concealed Unit right now.
 *
 * > *"When This Unit Moves into an enemy Servant's Range (or Detect, if in
 * > use), it has a 5% chance of being discovered."*
 *
 * `discoverAttempts` has produced these since Ch. 04 was implemented and
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

  const board = currentBoard();
  const unit = (board.units ?? []).find((u) => u.id === unitId)
    ?? unitSnapshot(game.actors.get(unitId));
  const attempts = discoverAttempts(unit, board);
  if (attempts.length === 0) return { attempts: 0, discoveredBy: null };

  for (const attempt of attempts) {
    const roll = await new Roll("1d100").evaluate();
    if (roll.total > attempt.chance) continue;

    Hooks.callAll("fgt.discovered", { unitId, byId: attempt.watcherId });
    await ChatMessage.create({
      content: `<p><strong>Discovered.</strong> ${game.actors.get(attempt.watcherId)?.name ?? "A watcher"}`
        + ` found ${game.actors.get(unitId)?.name ?? unitId}`
        + ` (rolled ${roll.total} vs ${attempt.chance}%).</p>`,
    });
    await deactivateConcealment(unitId, DEACTIVATION_REASONS.discovered);
    return { attempts: attempts.length, discoveredBy: attempt.watcherId };
  }
  return { attempts: attempts.length, discoveredBy: null };
}
