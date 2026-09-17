/**
 * @file Putting an ability on cooldown after it is used.
 * @see docs/04-time-model.md, docs/17-abilities.md
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
  // `destroyed` is the same shape with a different trigger: Quetzalcoatl's
  // *"Cooldown: 7◈ Turns AFTER Quetzalcoatlus is defeated"* starts on the
  // mount's death, so the mount may stand for twenty Turns and the clock has
  // not begun. Starting it here would run the cooldown out underneath a
  // platform that is still flying, and she could re-summon the moment it died.
  //
  // Found live: the mount was summoned, and the Noble Phantasm reported 21
  // ticks remaining while its platform was on the board.
  if (cd.countFrom === "deactivation" || cd.countFrom === "destroyed") {
    return { cooldowns: [], spends: [] };
  }

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
    let ticks = resolveTicks(parseTick(String(cd.max)), { turnsPerRound: turnsPerRound() });

    // A cooldown that is LONGER in a stated circumstance. Raikou's Dohatsu
    // Tenshou: *"If used while Goō Shōrai・Tenmōkaikai is Active, it is
    // immediately ended at the end of that Combat Phase, and **its Cooldown is
    // increased by 2◈ Turns (in addition to its original Cooldown)**."*
    //
    // ADDITIVE on top of the base rather than a replacement, because the sheet
    // says so in a parenthesis it did not have to write. 6◈+⅔◈ becomes 8◈+⅔◈.
    //
    // Note which ability is charged: *"it"* is Tenmōkaikai (ended) and *"its
    // Cooldown"* is THIS ability's own. Read the other way the clause would
    // extend the cooldown of something that has already ended, which is a
    // penalty on nothing.
    //
    // Distinct from `branches` above, which SELECTS one cooldown from several;
    // this adds to whichever one was chosen.
    for (const bonus of cd.conditionalBonus ?? []) {
      const options = unit ? rollOptionsFor({ attacker: unit }) : new Set();
      if (!testPredicate(bonus.predicate, { options })) continue;
      ticks += resolveTicks(parseTick(String(bonus.ticks)), { turnsPerRound: turnsPerRound() });
    }

    return { cooldowns: ticks > 0 ? [{ actorId, abilityId: ability.id, ticks }] : [], spends: [] };
  } catch (err) {
    // Loud: an unreadable cooldown means the ability is reusable immediately,
    // which looks like generosity rather than like a content error.
    console.warn(`FGT | ${ability.name} has an unreadable cooldown "${cd.max}": ${err.message}`);
    return { cooldowns: [], spends: [] };
  }
}

/**
 * Abilities this use also puts on cooldown (Ch. 04).
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

/**
 * The same clocks, on the other members of this unit's linked group.
 *
 * > *"When either Castor or Pollux uses a Skill, the Skill enters Cooldown for
 * > both of them."*
 *
 * Matched by **name**, which is the only thing two separately-authored ability
 * documents share. Castor's *Mana Burst* reaches Pollux's; his *Mad
 * Enhancement*, which she does not carry, reaches nothing — and that asymmetry
 * is the sheet's, not an accident of the matching.
 *
 * Returns **additional** entries only, never a copy of the input. Callers
 * spread it beside {@link alsoTriggered} so the shared clocks and the triggered
 * ones go through the same intents, and so a caller that forgets it loses the
 * sharing rather than the cooldown.
 *
 * @param {Array<{actorId: string, abilityId: string, ticks: number}>} cooldowns
 * @param {object} unit the user's snapshot
 * @param {object} board
 * @returns {Array<{actorId: string, abilityId: string, ticks: number}>}
 */
export function sharedAcrossGroup(cooldowns, unit, board = null) {
  if (unit?.linkedGroup?.sharedCooldowns !== "byName") return [];
  // Spread: a caller may hand us a DOCUMENT-shaped unit, where the schema field
  // is still a SetField and `.includes` on one silently answers undefined.
  // Named `partnerIds` rather than `memberIds` deliberately -- the guard in
  // `test/unit/set-fields.test.mjs` is textual and a local shadowing the schema
  // name reads, correctly, as the unspread access it exists to catch.
  const partnerIds = [...(unit.linkedGroup.memberIds ?? [])];
  if (partnerIds.length === 0) return [];

  const members = membersOf(partnerIds, board);
  if (members.length === 0) return [];

  /** @type {Array<{actorId: string, abilityId: string, ticks: number}>} */
  const out = [];
  for (const clock of cooldowns ?? []) {
    const name = (unit.abilities ?? []).find((a) => a.id === clock.abilityId)?.name;
    if (!name) continue;
    for (const member of members) {
      for (const twin of member.abilities ?? []) {
        if (twin.name === name) {
          out.push({ actorId: member.id, abilityId: twin.id, ticks: clock.ticks });
        }
      }
    }
  }
  return out;
}

/**
 * The group's other members, as `{id, abilities: [{id, name}]}`.
 *
 * A board snapshot is preferred and a `game.actors` lookup is the fallback,
 * because the three callers of {@link cooldownFor} do not all have a board:
 * `skill-use.mjs#cooldownIntents` takes the user's snapshot and nothing else.
 * Threading a board through it for this one clause would have meant changing
 * three signatures to reach a list of names, and the names are on the actors.
 *
 * Layer 3, so reaching for `game` is allowed here and would not have been in
 * `rules/`.
 *
 * @param {string[]} partnerIds already spread to an array by the caller
 * @param {object|null} board
 * @returns {Array<{id: string, abilities: Array<{id: string, name: string}>}>}
 */
function membersOf(partnerIds, board) {
  const onBoard = (board?.units ?? []).filter((u) => partnerIds.includes(u.id));
  if (onBoard.length > 0) return onBoard;

  const actors = globalThis.game?.actors;
  if (!actors) return [];
  return partnerIds
    .map((id) => actors.get?.(id))
    .filter(Boolean)
    .map((actor) => ({
      id: actor.id,
      abilities: [...(actor.items ?? [])]
        .filter((i) => i.type === "ability" || i.type === "noblePhantasm")
        .map((i) => ({ id: i.id, name: i.name })),
    }));
}
