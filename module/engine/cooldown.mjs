/**
 * @file Putting an ability on cooldown after it is used.
 * @see docs/07-time-model.md §7.5, docs/15-abilities.md §15.3
 *
 * Layer 3.
 *
 * One implementation, used by **both** use paths. They disagreed: the Skill
 * path set a cooldown and `resolveAttack` never did, so every Attack Skill and
 * every Noble Phantasm in the game was infinitely reusable — limited only by
 * the attack budget, which is a different rule entirely. Medea's Rule Breaker
 * came back off a `5◈+⅓◈` cooldown reading zero, which is how it surfaced.
 *
 * A cooldown is stored as **remaining turns**, counted down by the scheduler.
 * The authored form is a tick expression (`3◈`, `5◈+⅓◈`) or, for one ability in
 * the reference set, a per-unit rate resolved against what the use produced.
 */

import { parseTick, resolveTicks } from "../domain/tick.mjs";

/**
 * The cooldown intents using this ability produces.
 *
 * @param {object} ability the Item document
 * @param {string} actorId
 * @param {object} [ctx]
 * @param {number} [ctx.count] for a per-unit cooldown, what the use produced
 * @param {Array} [ctx.intents] the intent constructors (injected to keep this
 *   free of a circular import with `intents.mjs`)
 * @returns {Array<{abilityId: string, ticks: number}>} what to set
 */
export function cooldownFor(ability, actorId, { count = 0 } = {}) {
  const cd = ability?.system?.cooldown ?? {};

  // A cooldown decided by the use itself: "(Number of Dragon Tooth Warriors x
  // ⅔◈)". Resolved first, because such an ability has no tick expression in
  // `max` and would otherwise fall through to "no cooldown at all".
  if (cd.perUnit) {
    const ticks = Math.ceil(fractionOfRound(cd.perUnit) * turnsPerRound() * count);
    return ticks > 0 ? [{ actorId, abilityId: ability.id, ticks }] : [];
  }

  if (!cd.max) return [];

  try {
    const ticks = resolveTicks(parseTick(String(cd.max)), { turnsPerRound: turnsPerRound() });
    return ticks > 0 ? [{ actorId, abilityId: ability.id, ticks }] : [];
  } catch (err) {
    // Loud: an unreadable cooldown means the ability is reusable immediately,
    // which looks like generosity rather than like a content error.
    console.warn(`FGT | ${ability.name} has an unreadable cooldown "${cd.max}": ${err.message}`);
    return [];
  }
}

/**
 * Abilities this use also puts on cooldown (Ch. 07 §7.6).
 *
 * Scáthach's *Gate of Skye* is the reference case: *"when this NP is used,
 * Primordial Rune and Wisdom of Dún Scáith enter Cooldown."* Note the
 * asymmetry the chapter draws attention to — it is *blocked by* three and
 * *triggers* two.
 *
 * @param {object} ability
 * @param {object} actor
 * @returns {Array<{actorId: string, abilityId: string, ticks: number}>}
 */
export function alsoTriggered(ability, actor) {
  const ids = ability?.system?.alsoTriggers ?? [];
  if (ids.length === 0) return [];

  return ids
    .map((id) => actor.items.find((i) => i.system?.contentId === id || i.id === id))
    .filter(Boolean)
    .flatMap((item) => cooldownFor(item, actor.id));
}

/* -------------------------------------------------------------------------- */

/** @returns {number} */
function turnsPerRound() {
  try {
    return game.settings.get("fgt", "turnsPerRound") ?? 3;
  } catch {
    return 3;
  }
}

/**
 * `⅓`, `⅔`, `½` and plain numbers, as a fraction of a Round.
 * @param {string} raw
 * @returns {number}
 */
function fractionOfRound(raw) {
  const text = String(raw).replace("◈", "").trim();
  if (text.includes("⅔")) return 2 / 3;
  if (text.includes("⅓")) return 1 / 3;
  if (text.includes("½")) return 1 / 2;
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}
