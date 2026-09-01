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
import { canSpend, resourcePath } from "../domain/resources.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";

/**
 * The cooldown a use produces, and what paying to avoid it costs.
 *
 * Two outputs rather than one, because a cooldown can be **waived**. Scáthach's
 * Primordial Rune Spells are the case: *"If Scáthach uses a Primordial Rune
 * Spell while she has any PRS Tokens, remove one PRS Token from herself, while
 * the Primordial Rune Spell that she used does not enter Cooldown."* The token
 * and the skipped clock are one decision, so they are one answer — returning
 * only the clocks would leave the caller to re-derive whether a token was
 * spent, and the two could then disagree.
 *
 * The waiver is **automatic, not offered**. The sheet says "if ... while she
 * has any", not "she may"; a prompt would be inventing a choice.
 *
 * @param {object} ability the Item document
 * @param {string} actorId
 * @param {object} [ctx]
 * @param {number} [ctx.count] for a per-unit cooldown, what the use produced
 * @param {object} [ctx.unit] the user's snapshot, for a resource waiver
 * @returns {{cooldowns: Array<{actorId: string, abilityId: string, ticks: number}>,
 *            spends: Array<{unitId: string, key: string, delta: number}>}}
 */
export function cooldownFor(ability, actorId, { count = 0, unit = null } = {}) {
  const cd = ability?.system?.cooldown ?? {};

  // A clock that does not start at the use. Presence Concealment is *"Cooldown:
  // 2◈ Turns AFTER PC is deactivated"* -- the Skill lasts 2◈ and then sits for
  // 2◈ more, which starting the clock here would collapse into one window
  // running under the Skill's own duration. `countFrom` has been on the schema
  // since it was written and nothing has ever read it.
  if (cd.countFrom === "deactivation") return { cooldowns: [], spends: [] };

  const waiver = ability?.system?.cooldownWaiver ?? null;
  if (waiver && unit && canSpend(unit, waiver.resource, waiver.amount ?? 1)) {
    return {
      cooldowns: [],
      spends: [{ unitId: actorId, key: resourcePath(waiver.resource), delta: -(waiver.amount ?? 1) }],
    };
  }

  // A cooldown decided by the use itself: "(Number of Dragon Tooth Warriors x
  // ⅔◈)". Resolved first, because such an ability has no tick expression in
  // `max` and would otherwise fall through to "no cooldown at all".
  if (cd.perUnit) {
    const ticks = Math.ceil(fractionOfRound(cd.perUnit) * turnsPerRound() * count);
    return { cooldowns: ticks > 0 ? [{ actorId, abilityId: ability.id, ticks }] : [], spends: [] };
  }

  // A cooldown decided by WHICH BEHAVIOUR fired, not by a count: Summoning:
  // Bašmu is "Cooldown: 2◈" for its damage-spell branch and "Cooldown: 4◈"
  // for its summon branch, and the two share one ability document. Tested
  // against the SAME predicate grammar `runPhases`'s own phase-level
  // `predicate:` uses, against the caster's board-derived options -- so a
  // branch's cooldown and the condition that ran it can never disagree.
  // First match wins, matching how phase predicates are read in order.
  // `?.length`, NOT truthiness. `branches` is an `ArrayField` on the schema, so
  // the DataModel turns the `null` `compileCooldown` writes for an ordinary
  // string cooldown into `[]` -- and `[]` is truthy. Every ability whose
  // cooldown is a plain tick expression therefore entered this branch, matched
  // nothing, and returned no clock at all.
  //
  // That is EVERY COOLDOWN IN THE GAME: measured live at 49 of 49 abilities
  // across six authored Servants, every one of them infinitely reusable. It
  // arrived with `cooldown.branches` itself (Summoning: Bašmu is the only
  // ability that has any), which is why the Servants verified before that were
  // verified correctly and have been broken ever since.
  if (cd.branches?.length) {
    const options = unit ? rollOptionsFor({ attacker: unit }) : new Set();
    const branch = cd.branches.find((b) => testPredicate(b.predicate, { options }));
    if (!branch?.max) return { cooldowns: [], spends: [] };
    try {
      const ticks = resolveTicks(parseTick(String(branch.max)), { turnsPerRound: turnsPerRound() });
      return { cooldowns: ticks > 0 ? [{ actorId, abilityId: ability.id, ticks }] : [], spends: [] };
    } catch (err) {
      console.warn(`FGT | ${ability.name} has an unreadable branch cooldown "${branch.max}": ${err.message}`);
      return { cooldowns: [], spends: [] };
    }
  }

  if (!cd.max) return { cooldowns: [], spends: [] };

  try {
    const ticks = resolveTicks(parseTick(String(cd.max)), { turnsPerRound: turnsPerRound() });
    return { cooldowns: ticks > 0 ? [{ actorId, abilityId: ability.id, ticks }] : [], spends: [] };
  } catch (err) {
    // Loud: an unreadable cooldown means the ability is reusable immediately,
    // which looks like generosity rather than like a content error.
    console.warn(`FGT | ${ability.name} has an unreadable cooldown "${cd.max}": ${err.message}`);
    return { cooldowns: [], spends: [] };
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
  const entries = ability?.system?.alsoTriggers ?? [];
  if (entries.length === 0) return [];

  return entries
    .flatMap((entry) => triggeredBy(entry, actor))
    // No `unit`, so no waiver: a PRS Token pays for the Spell Scáthach CHOSE to
    // use, not for whatever that use happens to drag onto cooldown with it.
    .flatMap((item) => cooldownFor(item, actor.id).cooldowns);
}

/**
 * The abilities one `alsoTriggers` entry names.
 *
 * A **string** names one ability by content id. An **object** names a group,
 * and Scáthach is why the second form exists: *"Wisdom of Dún Scáith enters
 * Cooldown"* does not mean the grant — the grant has no clock, it is the button
 * that opens the curation dialog. It means her three Wisdom slots, which are
 * the things that have a `4◈-⅓◈` to run. Naming the grant put nothing on
 * cooldown at all, which read as the clause simply not working.
 *
 * @param {string|object} entry
 * @param {object} actor
 * @returns {object[]} ability Items
 */
function triggeredBy(entry, actor) {
  // A bare id, or the `{ability: id}` the compiler normalises it to.
  const named = typeof entry === "string" ? entry : entry?.ability;
  if (named) {
    const item = actor.items.find((i) => i.system?.contentId === named || i.id === named);
    return item ? [item] : [];
  }

  const items = [...actor.items].filter((i) =>
    (entry.exclusionSet && i.system?.exclusionSet === entry.exclusionSet)
    || (entry.category && i.system?.category === entry.category));

  if (items.length === 0) {
    // Loud: a group that matches nothing is either a typo or a Servant who has
    // not been given her copies yet, and the two look identical from here.
    console.warn(`FGT | ${actor.name}: alsoTriggers ${JSON.stringify(entry)} matched no abilities.`);
  }
  return items;
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
