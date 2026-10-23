/**
 * @file Ability costs and requirements.
 * @see docs/17-abilities.md, docs/32-relationships.md
 *
 * Layer 2 (rules). Pure — takes snapshots, returns a verdict and a price.
 *
 * `npCostByRank` and `freeServantNPSustainabilityCost` sat in
 * `domain/tables.mjs` from the day the tables were transcribed, and nothing
 * ever read either of them: using a Noble Phantasm cost its Master nothing.
 * Same shape as the ZON defect and the `fireEvent` defect — data that loads
 * correctly and is never asked a question.
 *
 * One call answers "can this be used", because a refusal that names the *first*
 * problem is actionable and a refusal that names four is a wall of text.
 */

import { unknownCountKindsIn, countedValue } from "./count.mjs";
import { pursuitOf } from "./compulsion.mjs";
import { hasGranted, GRANTS } from "./granted.mjs";
import { lookup } from "../domain/tables.mjs";
import { currentHealth } from "../domain/health.mjs";
import { availableFor } from "./cs-namespacing.mjs";
import { Rank } from "../domain/rank.mjs";
import { meetsRequirements, SELF_REQUIREMENTS } from "./items.mjs";
import { isGated, gateRoundFor, npAvailableTurn, NP_GATE } from "./np-gate.mjs";
import { isConcealed, canUseWhileConcealed } from "./concealment.mjs";
import { ghostMayUse } from "./untouchable.mjs";
import { paysHighColumn } from "./master-rank.mjs";
import { preventedBy } from "./budget.mjs";
import { usedOnlyDuringOwnTurn, usedOnlyAtWindows, windowsOf } from "./windows.mjs";
import { standingPlatformOf } from "./platforms.mjs";
import { ownerOptionsOf } from "./options.mjs";
import { test as testPredicate } from "./predicate.mjs";

/**
 * What using this ability costs, or `null` when it is free.
 *
 * Only Noble Phantasms have a cost today. The shape is a discriminated `Cost`
 * so the caller pays it without re-deriving who is charged — which matters,
 * because *who* is charged changes with the Servant's contract and the payer
 * is not always the user.
 *
 * @param {object} args
 * @param {object} args.ability
 * @param {object} args.unit the Servant using it
 * @param {object|null} args.master its Master, if it has one
 * @returns {{kind: string, amount: number, unitId?: string}|null}
 */
export function npCost({ ability, unit, master, turnsPerRound = 3 }) {
  if (!ability?.isNP) return null;
  // *"Using this NP does not reduce her Master's Health as a cost"* (Avalon, #230).
  if (ability.noMasterCost) return null;
  // A Free Servant's price its sheet states instead of the Rank table: every
  // Normal Noble Phantasm (#241). `disappear` is paid by the Servant itself,
  // which leaves the board when the Combat Phase that used it ends.
  const stated = ability.freeServantCost;
  if (stated && isFree(unit)) {
    if (stated.kind === "disappear") return { kind: "disappear", amount: 0, unitId: unit.id };
    if (stated.kind === "sustainability") {
      return { kind: "sustainability", amount: Number(stated.rounds ?? 0) * turnsPerRound, unitId: unit.id };
    }
  }
  return npCostAt({ rank: ability.rank, unit, master, turnsPerRound });
}

/**
 * The same cost, for a Noble Phantasm charged at a Rank it does not have.
 *
 * Two of EMIYA's need it and neither could state the cost any other way: Rho
 * Aias prints "?" for a Rank and charges *"equivalent to if an EX Rank NP is
 * used"*, and Unlimited Blade Works prints the range `E~A++` and charges as B.
 * Derived from the ability's own `rank`, both read null and cost nothing.
 *
 * Routed through here rather than looked up at the call site so the **Free
 * Servant** branch below applies to them too. A Servant whose Master has just
 * been defeated has nobody to charge, and an `additionalCosts` entry that
 * named a Master anyway produced an intent with no target — which aborts the
 * whole batch rather than falling back to Sustainability the way Ch. 32 says.
 *
 * @param {object} args
 * @param {string|null} args.rank
 * @param {object} args.unit
 * @param {object|null} args.master
 * @returns {{kind: string, amount: number, unitId?: string}}
 */
export function npCostAt({ rank, unit, master, turnsPerRound = 3 }) {
  const npRank = Rank.parseOrNull(rank);
  const [high, low] = columnsFor(npRank);

  // A Free Servant has no Master to charge, so the cost moves onto the Servant
  // itself — first as Sustainability, and if it has no clock at all, as double
  // the High Rank Master figure in its own Health (Ch. 32).
  if (isFree(unit)) {
    if (unit.sustainability === null || unit.sustainability === undefined) {
      return { kind: "selfHealth", amount: high * 2, unitId: unit.id };
    }
    return {
      kind: "sustainability",
      // In TURNS, like the clock it is charged against: the table is ◈
      // (Appendix B, *"EX 6◈ ... E 1◈"*), and the bare number charged an EX
      // NP 6 Turns where its sheet says 6 Rounds (#241).
      amount: Number(lookup("freeServantNPSustainabilityCost", npRank) ?? 0) * turnsPerRound,
      unitId: unit.id,
    };
  }

  return {
    kind: "masterHealth",
    amount: paysHighColumn(master) ? high : low,
    unitId: master?.id ?? null,
  };
}

/**
 * The standing per-use costs an ability declares beyond its Noble Phantasm cost.
 *
 * These belong to the ABILITY, not to one of its two use paths. The expansion
 * lived inside `engine/attack.mjs`, so only abilities resolved through the
 * attack flow ever paid them — and four declare costs and resolve through
 * `useSkill` instead: EMIYA's Rho Aias (*"EMIYA's Master loses Health
 * equivalent to if an EX Rank NP is used"*) and Unlimited Blade Works, Drake's
 * Golden Hind: Wild Hunt, and Ozymandias's Ramesseum Tentyris. Measured live:
 * Rho Aias taken as a reaction charged its Master **0** where `npCostAt` at
 * rank EX returns 100 (Ch. 46 §46.4-T).
 *
 * Each entry keeps its own `id` so another cost can name it in `supersedes`.
 *
 * @param {object} args
 * @param {object} args.ability the ability Item
 * @param {object} args.self the user's snapshot
 * @param {object|null} args.master the user's Master, if any
 * @returns {object[]} costs, ready for `resolveCosts`
 */
export function additionalCostsFor({ ability, self, master = null, turnsPerRound = 3, use = {} }) {
  /** @type {object[]} */
  const out = [];

  for (const extra of ability?.system?.additionalCosts ?? []) {
    // A FRACTION of the Master's maximum rather than a stated number.
    // *"The Master's Health is reduced by 50% of its maximum value"* -- the
    // first cost in the corpus whose size is not on the sheet, because it
    // depends on whose Master it is.
    if (extra.kind === "masterHealthFractionOfMax") {
      const max = master?.maxHealth ?? master?.health?.max ?? 0;
      out.push({
        kind: "masterHealth",
        amount: Math.floor(max * (extra.fraction ?? 0)),
        unitId: master?.id ?? null,
        id: extra.id,
        supersedes: extra.supersedes ?? [],
      });
      continue;
    }

    // Charges the Noble Phantasm table at a STATED Rank rather than at the
    // ability's own, and through the same rule `npCost` uses -- so a Free
    // Servant pays in Sustainability instead of producing an intent aimed at a
    // Master who does not exist.
    if (extra.kind === "masterHealthByNPRank") {
      out.push({
        ...npCostAt({ rank: extra.rank, unit: self, master, turnsPerRound }),
        id: extra.id,
        supersedes: extra.supersedes ?? [],
      });
      continue;
    }

    out.push({
      kind: extra.kind ?? "masterHealth",
      // A number, or one sized by a Count: Excalibur Proto's *"his Master loses an
      // additional 5 Health"* per criterion met (#283), `use.criteriaMet`.
      amount: countedValue(extra.amount ?? 0, { use }),
      unitId: extra.chargesMaster === false ? self?.id : master?.id ?? null,
      id: extra.id,
      supersedes: extra.supersedes ?? [],
    });
  }

  return out;
}

/**
 * Whether an ability can be used right now, and what it will cost.
 *
 * Gates are checked in the order a player can act on them: something they can
 * fix by waiting, then something they can fix by moving, then something they
 * cannot fix at all. The **first** failure is reported, not all of them.
 *
 * @param {object} args
 * @param {object} args.ability
 * @param {object} args.unit
 * @param {object|null} [args.master]
 * @param {number} [args.round]
 * @param {boolean} [args.clockRunning] whether a started match is keeping time
 * @param {string|null} [args.actingFactionId] the faction whose Turn it is, from
 *   `engine/board.mjs#gateContext`; `null` when none is (no match, the GM's slot)
 * @param {boolean} [args.isCounter] this use answers an attack, which is made on
 *   somebody else's Turn by definition
 * @param {boolean} [args.atWindow] the engine is casting this at one of its own windows
 *   (a reaction, a Damage Step, the start of a Combat Phase); never claimed by a client
 * @returns {{ok: boolean, reason?: string, detail?: object, cost: object|null}}
 */
/**
 * Whether an ability exists in the War its bearer stands in: its `availableWhen`
 * against the bearer's own options, the War's `war:` facts among them (#314).
 *
 * @param {object|null} ability a projected ability
 * @param {object|null} unit its bearer's snapshot
 * @returns {boolean}
 */
export function availableInThisWar(ability, unit) {
  const when = ability?.availableWhen;
  if (!when?.length) return true;
  return testPredicate(when, { options: new Set(ownerOptionsOf(unit)) });
}

export function canUseAbility({
  ability, unit, master = null, round = 1, turn = null,
  gates = NP_GATE, turnsPerRound = 3, clockRunning = true, ...ctx
}) {
  const cost = npCost({ ability, unit, master, turnsPerRound });

  // A defeated Unit is a body: it is passed through, it projects no reaction
  // (`rules/reactions.mjs`), and it does nothing of its own. Its body stays on
  // the board a Tick before it is cleared, and in that Tick a masterless
  // Serenity, her Sustainability spent, declared a Normal Attack that resolved,
  // and with her token gone cast Presence Concealment. Neither path asked.
  // FIRST: every other refusal invites a fix -- wait, move, begin the match --
  // and there is nothing a defeated Unit can wait for.
  if (unit?.defeated) {
    return { ok: false, reason: "defeated", detail: {}, cost };
  }

  // An ability that does not exist in this War: Gawain's no-cycle form in a War
  // with Day and Night, or his Day form in one without (#287, #314). Refused, and
  // the bar and the sheet hide what is refused for this reason alone
  // (`isHiddenInThisWar`): it is not a use that waits on anything.
  if (!availableInThisWar(ability, unit)) {
    return { ok: false, reason: "notInThisWar", detail: {}, cost };
  }

  // A Count it cannot read (#319, Q19). The build refuses such content first;
  // one made in the editor or by a script reaches here, and is refused by name
  // rather than used with its number sized at zero. The usage spec carries the
  // kinds; the bar hands the Item's own system, which is walked.
  const unknownKinds = ability ? (ability.unknownCountKinds ?? unknownCountKindsIn(ability)) : [];
  if (unknownKinds.length > 0) {
    return { ok: false, reason: "unknownCountKind", detail: { kind: unknownKinds[0] }, cost };
  }

  // No match, no clock -- and therefore no use. Every duration and every
  // cooldown in this game is measured against the match's tick, and the tick
  // only moves inside a started Combat: `engine/scheduler-hooks.mjs` bails on
  // `!combat.started`, and every reader falls back to `?? 0`. So a use out of
  // a match WRITES a cooldown that nothing can ever count down, and the
  // ability is gone for the life of the world.
  //
  // Found live: abilities used before the match was begun sat at their full
  // clock forever, which reads as the cooldown being broken rather than as
  // the match not having started.
  //
  // FIRST, above `expended`, for the reason `expended` is above cooldown: the
  // refusal underneath is not merely a lesser one, it is a WRONG one. "On
  // cooldown for 22 Turns" invites a player to wait for a Turn that is never
  // coming, when what they need to do is start the match.
  //
  // Defaults to `true`: this layer cannot read `game`, and the seven call
  // sites all spread `engine/board.mjs#gateContext`, which supplies it.
  // A suppression naming this ability's CATEGORY. Blind's clause 3 is the
  // first: *"'Mystic Eye' and 'Glam Sight' Skills cannot be used."*
  //
  // Keyed on `categorizedAs` rather than on a slug, because the clause names a
  // FAMILY of skills and not two documents -- the same reading `hasCategory`
  // takes of *"Skills that are also categorized as 'Instinct'"*. A second
  // Mystic Eye authored later is covered without touching this.
  //
  // Above the cooldown refusals for the reason `expended` is: "on cooldown for
  // 4 Turns" invites a player to wait, when what has happened is that they
  // cannot use it at all right now.
  const suppressedCategory = (ability?.categorizedAs ?? [])
    .find((tag) => (unit?.suppressions ?? []).some((sup) => sup.scope === tag));
  if (suppressedCategory) {
    return { ok: false, reason: "suppressedCategory", detail: { category: suppressedCategory }, cost };
  }

  // Every ability barred but the ones a lock names. Doppelganger: *"Skills and
  // Noble Phantasms except Presence Concealment cannot be used while
  // Doppelganger is Active"* (#253 reading 6). A Normal Attack is no ability
  // and is never asked; a passive is never used.
  // The gate is asked with no ability for a Normal Attack: nothing to bar.
  const lock = ability ? (unit?.suppressions ?? []).find((sup) => sup.scope === "abilityUse"
    && !(sup.except ?? []).some((slug) => slug === ability.slug || slug === ability.contentId)) : null;
  if (lock) {
    return { ok: false, reason: "abilityLocked", detail: { by: lock.source ?? "" }, cost };
  }

  if (clockRunning === false) {
    return { ok: false, reason: "noMatch", detail: {}, cost };
  }

  // *"(Active) Used during your Turn."* A Skill whose only window is `ownTurn`
  // cannot be used on another Player's Turn. The window was read in exactly one
  // place, `canToggleMode`, so it gated Modes and nothing else: Lucha Libre was
  // pressed from the action bar on the enemy's Turn and resolved (#160).
  //
  // Which Turn a Unit acts on is its `actingFactionId` -- a charmed Unit acts on
  // its CHARMER's -- falling back to its own faction. Asked of nothing when no
  // faction's Turn is running, which is what `canToggleMode` answers too. A
  // Counter is exempt: it is made on the enemy's Turn by definition, and every
  // Noble Phantasm answers one (§46.4-CK).
  //
  // Above the cooldown: "on cooldown for 4 Turns" would invite a player to wait
  // for a Turn on which the Skill still could not be used.
  const acting = ctx.actingFactionId ?? null;
  // A use granted at another ability's moment answers to that moment instead
  // (`ctx.anyMoment`, #243 reading 9): the free Spell inside Kiritsugu's shot.
  if (acting && !ctx.isCounter && !ctx.anyMoment && usedOnlyDuringOwnTurn(ability)) {
    const side = unit?.actingFactionId ?? unit?.factionId ?? null;
    if (side && side !== acting) return { ok: false, reason: "notOwnTurn", detail: {}, cost };
  }

  // *"Used at the start of a Combat Phase"*, *"when attacked"*: an ability whose
  // windows exclude `ownTurn` is cast by the ENGINE at its moment (`ctx.atWindow`),
  // and is not a sheet button. Without this the bar and the sheet offered it any
  // time -- Reinforcement in the middle of his Turn, with no Combat Phase in
  // sight (#208 reading 8, ruled 2026-10-14). A Counter is exempt for the reason
  // above: it is made on the enemy's Turn by definition.
  if (!ctx.atWindow && !ctx.anyMoment && !ctx.isCounter && usedOnlyAtWindows(ability)) {
    return { ok: false, reason: "windowOnly", detail: { windows: windowsOf(ability.timing) }, cost };
  }

  // *"The clones ... can only perform Normal Attacks."* Raikou's copies inherit
  // her passives as real ability documents, several of which have Actives on
  // her own sheet, so the refusal has to be here and not in the authoring: the
  // documents exist on the copy and would otherwise be pressable.
  //
  // The mirror of `noNormalAttack` (Pale Rider), and in the same spirit --
  // `rules/actions.mjs` withholds the button and this refuses the use, so a
  // player is never offered something the rules have already taken away.
  //
  // **Only when there IS an ability.** A Normal Attack arrives here with
  // `ability: null` -- `abilityUsageSpec(null)` is what `resolveAttack` passes
  // for a bare swing -- and refusing that refuses the one thing the grant
  // exists to permit. Measured live: a Sakata copy could not attack at all.
  if (ability && hasGranted(unit, GRANTS.normalAttacksOnly)) {
    return { ok: false, reason: "normalAttacksOnly", detail: {}, cost };
  }

  // Hatred of Achilles: *"she will ignore all orders/Player commands; she
  // will constantly Move towards and Attack said Unit"*. The Move and the
  // Attack, Outrage Amazon among Attacks, and no Skill (ruled 2026-10-06,
  // #190 reading 3).
  if (ability && !ability.isNP && pursuitOf(unit)) {
    return { ok: false, reason: "compelled", detail: {}, cost };
  }

  // Spent for the rest of the game, and ABOVE the cooldown gate rather than
  // beside `maxUses`. `expended` has been written since Akhilleus Kosmos was
  // authored and read only by `rules/reactions.mjs`, so the ordinary use route
  // never refused one -- an NP broken for the rest of the match was still on
  // the sheet and still pressable.
  //
  // First because the cooldown underneath is not merely a lesser refusal here,
  // it is a WRONG one: breaking Ramesseum Tentyris also starts its 8◈
  // deactivation clock, so a player pressing it would be told to wait
  // twenty-four Turns for something that is never coming back. Measured
  // exactly that way before this moved.
  if (ability?.goneInForm) {
    return { ok: false, reason: "goneInForm", detail: {}, cost };
  }
  if (ability?.expended) {
    return { ok: false, reason: "expended", detail: {}, cost };
  }

  // Cooldown first: it is the most common refusal and the easiest to
  // understand, and every other gate is irrelevant while it is running.
  const remaining = ability?.cooldown?.remaining ?? 0;
  // ...unless it may be used ON its Cooldown, at a price. Arturia's Mana Burst:
  // *"Can be used while on Cooldown, but she has to be within her Master's
  // Servant Range and her Master loses 20 Health; using it in this way does
  // not reset Cooldown"* (#230; the Servant Range is the ZON, reading 2). The
  // price is a cost like any other, paid with the rest (`overCooldown`), and
  // the clock it leaves alone is the caller's to skip.
  let overCooldown = null;
  if (remaining > 0) {
    const over = ability?.cooldownOverride ?? null;
    if (!over) return { ok: false, reason: "cooldown", detail: { remaining }, cost };
    if (!master || (over.withinZon !== false && unit?.outsideZon)) {
      return { ok: false, reason: "cooldownOutsideZon", detail: { remaining }, cost };
    }
    overCooldown = {
      kind: "masterHealth", amount: over.masterHealth ?? 0, unitId: master.id ?? null, id: "overCooldown",
    };
    const unpayable = cannotPay(overCooldown, unit, master);
    if (unpayable) return { ok: false, reason: unpayable, detail: { remaining }, cost };
  }

  // A field whose clock counts FROM DEACTIVATION starts no cooldown at the cast
  // -- `cooldownFor` writes none -- so nothing above stops a second cast while
  // the first still stands. That cast REPLACED the open field with a bare
  // delete: its stone, its on-end actions and its field-tied effects stayed
  // where they were, the 8◈ was never paid, and the upkeep period restarted.
  // Refused instead (#148).
  //
  // Read off the ability itself, so a field authored later is covered with no
  // content change. `unit.ownedFields` is the open fields this Unit owns, by
  // content id, as `annotateFields` writes it. Named `fieldAlreadyOpen` and not
  // `fieldOpen`: that is the REQUIREMENT "its field must be open", whose
  // sentence says the opposite.
  const holdsField = ability?.field && ability?.cooldown?.countFrom === "deactivation"
    ? (ability.contentId ?? ability.id ?? null)
    : null;
  if (holdsField && (unit?.ownedFields ?? []).includes(holdsField)) {
    return { ok: false, reason: "fieldAlreadyOpen", detail: { field: holdsField }, cost };
  }

  // The whole-match budget. Before the Round gate because it is permanent:
  // "can only be used 11 times" is never going to become true again by waiting.
  const maxUses = ability?.maxUses ?? null;
  if (maxUses !== null && (ability?.timesUsed ?? 0) >= maxUses) {
    return { ok: false, reason: "exhausted", detail: { maxUses, timesUsed: ability.timesUsed ?? 0 }, cost };
  }

  // Ch. 04's availability gate. An ability's OWN gate wins outright -- Ozymandias
  // states Round 8 and the Magic Crest states Round 3, and BOTH must hold. The
  // global gate covers only abilities that state neither.
  //
  // This replaces the `max()` composition Ch. 45 recorded: `max()` cannot
  // express a stated gate EARLIER than the global one, which is exactly what the
  // Magic Crest's own row in Ch. 04's table is. `max()` still applies BETWEEN an
  // ability's two ways of stating a gate (`npGateRound` and
  // `targeting.limits.requiresRound`, folded by `usageSpecFor`), because both
  // are the ability speaking.
  //
  // `gates` defaults to the published numbers rather than to nothing, because
  // there are seven call sites and "silently skipped" is precisely the defect
  // this gate was built to close.
  const stated = ability?.requiresRound ?? null;
  const requiresRound = stated !== null
    ? stated
    : (isGated(ability) ? gateRoundFor(unit, master, gates) : null);

  if (requiresRound !== null && round < requiresRound) {
    return { ok: false, reason: "round", detail: { requiresRound, round }, cost };
  }

  // ...and the Turn-level half, which only a cooldown increase taken before the
  // gate opened can trigger. Skipped entirely when nothing has delayed this
  // ability, which is every ability in every world until one does -- so the
  // common path never needs the turn plumbing.
  //
  // `turn` falls back to the FIRST turn of the current Round. Every call site
  // passes the real one; the fallback is for a console query, and erring to the
  // start of the Round errs towards refusing, which is the safe direction for a
  // gate.
  const delay = ability?.cooldown?.gatedDelay ?? 0;
  if (delay > 0 && stated === null && isGated(ability)) {
    const availableTurn = npAvailableTurn(unit, ability, master, { gates, turnsPerRound });
    const now = turn ?? ((round - 1) * turnsPerRound + 1);
    if (now < availableTurn) {
      return {
        ok: false,
        reason: "round",
        detail: {
          requiresRound: Math.ceil(availableTurn / turnsPerRound), round, delayedBy: delay,
        },
        cost,
      };
    }
  }

  // "Can only be used once per Turn." A field on the ability rather than a
  // requirement, because the question is about the ability ITSELF and a
  // requirement has no way to name its own declarer without repeating the id.
  //
  // Not redundant with the cooldown gate above, and Scathach is why: a
  // Primordial Rune Spell used while she holds a PRS Token does not enter
  // Cooldown at all, so Ar's `3◈` never runs and this clause is the only thing
  // standing between her and using it every Turn for free.
  if (ability?.oncePerTurn && usedThisTurn(unit).some(
    (id) => id === ability.id || id === ability.contentId,
  )) {
    return { ok: false, reason: "oncePerTurn", cost };
  }

  // A Seal. `rules/budget.mjs`'s prevention table has gated Skills, Spells and
  // Noble Phantasms since it was written, and `canConsume` honours it -- but
  // only at the moment an action is BILLED, which is after the player has
  // committed. So a Skill-Sealed Servant's buttons all read as available, and
  // pressing one opened a targeting session that said "Legal -- click to
  // confirm" for an ability the rules forbid.
  //
  // Six effects reach this table -- Stun and its blanket kin, Disable, Seal,
  // Silence, Skill Seal, NP Seal -- and none of them were visible on a button
  // before this. Asked HERE for the reason the block below already gives: a
  // player who presses something and watches nothing happen has been shown a
  // bug, not told a rule.
  // Every action the ability IS: the Magic Crest is a Damage Spell categorized
  // as NP, so Silence and NP Seal each stop it (#241 reading 14). One answer,
  // `np`, let Silence through (#241, live).
  const sealed = useClassesOf(ability)
    .map((action) => preventedBy(unit, action, {
      categorizedOnly: !ability?.isNP && Boolean(ability?.categorizedAsNP),
    }))
    .find((v) => v.prevented) ?? { prevented: false };
  if (sealed.prevented) {
    return { ok: false, reason: "prevented", detail: { by: sealed.by }, cost };
  }

  // Switched off by an effect its owner carries: Medea's High-Speed Divine
  // Words *"cannot be used ... while inflicted with Silence"*. Asked by
  // `useSkill` alone, so the bar and every offer, which ask this, lit what the
  // press refused (#244). Below the Seals, so a Silenced Spell still says
  // which effect prevents it.
  const negatedBy = (ability?.negatedBy ?? []).find((id) => (unit?.effects ?? []).includes(id));
  if (negatedBy) {
    return { ok: false, reason: "negated", detail: { by: negatedBy }, cost };
  }

  // The same question one scale WIDER: a cap on a whole CATEGORY rather than on
  // one ability. Kiritsugu's Magecraft is *"Only one Thaumaturgy Spell can be
  // used per Turn"*, which no per-ability field can say -- and which
  // `sameTurnExclusive` cannot say either, because the sheet grants an
  // exemption from it and an id list has nowhere to put one.
  //
  // Refused HERE rather than at resolution, so the button greys out with a
  // reason: a player who presses a Spell and watches nothing happen has not
  // been told the rule, they have been shown a bug.
  const categoryLimit = categoryLimitFor(ability, unit);
  if (categoryLimit) {
    return { ok: false, reason: "categoryUseLimit", detail: categoryLimit, cost };
  }

  // A capability the Unit's SURROUNDINGS refuse, rather than one its own state
  // does. Nemo's Storm Border is the only source: *"Units within the Storm
  // Border cannot use ... any ability that creates a Unit/Item/object that has
  // the 'Large' or 'Giant' Attribute."*
  //
  // Refused HERE, so the button greys out with a reason, rather than at
  // resolution -- a player who presses a Noble Phantasm and watches it summon
  // nothing has been told the rule by its absence.
  //
  // Read off `suppressions`, which is where every other positional refusal in
  // the game already lives (Decoy's targeting, Jack's Mist capping Detect,
  // `ForbidReaction`'s rungs).
  const forbidden = forbiddenCreation(ability, unit);
  if (forbidden) {
    return { ok: false, reason: "forbidCreating", detail: { attribute: forbidden }, cost };
  }

  // A platform Noble Phantasm cannot be cast again while its platform stands
  // (#142). Above the cost check, so a player is told why before being asked to
  // pay for a cast that would have raised a second mount.
  const standing = standingPlatformOf(ability, unit, ctx.board ?? null);
  if (standing) {
    return { ok: false, reason: "platformStands", detail: { platform: standing.name ?? standing.contentId ?? standing.id }, cost };
  }

  // The same question one scale up, and for the same reason `sameRoundExclusive`
  // exists beside `sameTurnExclusive`: a Servant acts up to three times in a
  // Round. Karna's Uncrowned Arms Mastership is *"can only be used once per
  // Round"* with no cooldown, so without this gate it is a free toggle every
  // Turn and the choice between its two effects stops being a choice.
  if (ability?.oncePerRound && usedThisRound(unit).some(
    (id) => id === ability.id || id === ability.contentId,
  )) {
    return { ok: false, reason: "oncePerRound", cost };
  }

  // Mutual exclusion, at both scales. Checked here rather than only on the
  // Skill path, which is where it used to live -- so Medea's Keraino/Trofa pair
  // was enforced and EMIYA's Caladbolg/Hrunting pair, both Noble Phantasms,
  // would not have been.
  // A use that failed this Turn and locks itself until the next (#300).
  if ((unit?.turnState?.failedAbilities ?? []).some((id) => id === ability?.id || id === ability?.contentId)) {
    return { ok: false, reason: "failedThisTurn", cost };
  }

  const turnPartner = firstUsed(ability?.sameTurnExclusive, usedThisTurn(unit));
  if (turnPartner) return { ok: false, reason: "sameTurnExclusive", detail: { partner: turnPartner }, cost };

  const roundPartner = firstUsed(ability?.sameRoundExclusive, usedThisRound(unit));
  if (roundPartner) return { ok: false, reason: "sameRoundExclusive", detail: { partner: roundPartner }, cost };

  // Presence Concealment clause 7:
  //
  //   "Active Skills targeting/affecting an enemy Unit(s) cannot be used unless
  //    stated. Note: Does not include Attack Skills and Spells that deal damage."
  //
  // The one gate in the reference set whose subject is the USER'S OWN STATE
  // rather than the ability's -- concealment refuses a Skill that would give
  // the position away, and refuses it by category rather than by a list.
  if (isConcealed(unit)) {
    const veiled = canUseWhileConcealed(ability);
    if (!veiled.ok) return { ok: false, reason: "presenceConcealment", cost };
  }
  // A Feigned Defeat's ghost: its Attacks, which reveal it, and Skills that
  // touch it alone (#249 reading 27).
  if (!ghostMayUse(unit, ability)) return { ok: false, reason: "feignedDefeat", cost };

  // A Noble Phantasm needs its user inside its Master's ZON. The targeting
  // resolver has always refused this; asking here too means one call answers
  // the whole question rather than half of it.
  if (ability?.isNP && unit?.outsideZon) {
    return { ok: false, reason: "zon", cost };
  }

  // Everything else Ch. 17 lists. Checked after the gates above because those
  // three are the common refusals and this is the long tail.
  // An offer whose target is not known yet (a window, Scapegoat's pick) judges
  // only what the Unit can answer alone: a requirement about a target must not
  // refuse for want of one (`ctx.selfOnly`, #244).
  const requirements = (ability?.requirements ?? [])
    .filter((r) => !ctx.selfOnly || SELF_REQUIREMENTS.has(r.kind));
  const met = meetsRequirements(requirements, {
    unit, master, target: ctx.target ?? null, board: ctx.board ?? null,
    round, testPredicate: ctx.testPredicate,
    // The declaring ability, so `abilityOffCooldown` can exclude it. Without
    // this a Spell gates on its own cooldown, which the gate above already
    // checked -- so the requirement would never say anything new.
    ability,
  });
  if (!met.ok) return { ok: false, reason: met.reason, detail: met.detail ?? {}, cost };

  // What the use will CHARGE, which is not always the table's NP cost: an
  // ability's own cost may supersede it. Enki's Master pays half his maximum
  // *"instead of the normal Master's Health cost"*, and this asked whether a
  // Master on 95 could pay an EX Rank's 100 (#232, found live). The same
  // resolution the payment makes (`resolveCosts`), so the gate and the price
  // cannot disagree.
  const ownCosts = additionalCostsFor({
    ability: { system: { additionalCosts: ability?.additionalCosts ?? ability?.system?.additionalCosts ?? [] } },
    self: unit, master, turnsPerRound,
  });
  const charged = ownCosts.length > 0
    ? resolveCosts([...(cost ? [{ ...cost, id: "npCost" }] : []), ...ownCosts]).charged
    : (cost ? [cost] : []);
  const unpayable = chargedUnpayable(charged, unit, master);
  if (unpayable) return { ok: false, reason: unpayable, cost };

  return { ok: true, cost, ...(overCooldown ? { overCooldown } : {}) };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Which abilities this Unit has already used this Turn.
 *
 * Stale-by-tick like the rest of turn state, and the snapshot has already
 * applied that rule -- `turnStateAt` blanks a list stamped with an earlier
 * tick, so a missed reset cannot leave a Servant permanently unable to act.
 *
 * @param {object} unit
 * @returns {string[]}
 */
function usedThisTurn(unit) {
  return unit?.turnState?.abilitiesUsed ?? [];
}

/**
 * Which abilities this Unit has used this ROUND. Stale-by-round, like the above.
 * @param {object} unit
 * @returns {string[]}
 */
function usedThisRound(unit) {
  return unit?.roundState?.abilitiesUsed ?? [];
}

/**
 * The per-category Turn cap this use would break, if any.
 *
 * `bypassesCategoryLimit` is the sheet's stated exemption and is checked FIRST:
 * the free Spell inside Lethal Gunfire Suppression's trigger still enters
 * Cooldown, so it is exempt from the COUNT and not from the consequence.
 *
 * The Turn record holds whatever `recordAbilityUse` stamped -- an Item id and a
 * content id -- so both are matched against the Unit's own projected abilities,
 * which already carry `category` (`snapshot.mjs#collectAbilities`). Matching
 * only one of the two would count half the uses, which is the drift that made
 * `oncePerTurn` silently ignore every Noble Phantasm before the record was
 * unified.
 *
 * @param {object} ability
 * @param {object} unit
 * @returns {{category: string, perTurn: number, source: string}|null}
 */
export function categoryLimitFor(ability, unit) {
  if (!ability?.category || ability.bypassesCategoryLimit) return null;
  const limit = (unit?.categoryUseLimits ?? []).find((l) => l.category === ability.category);
  if (!limit) return null;

  const sameFamily = new Set(
    (unit?.abilities ?? [])
      .filter((a) => a.category === ability.category)
      .flatMap((a) => [a.id, a.contentId])
      .filter(Boolean),
  );
  // Not the uses the cap was told to skip: the free Spell *"does not count
  // towards the one Thaumaturgy Spell usage per Turn"* (#243 reading 9). It
  // refused the Reinforcement after it on the board.
  const exempt = new Set(unit?.turnState?.categoryExempt ?? []);
  const used = usedThisTurn(unit).filter((id) => sameFamily.has(id) && !exempt.has(id));

  return used.length >= limit.perTurn ? limit : null;
}

/**
 * Which entry of the prevention table an ability answers to.
 *
 * The three the table separates, and it separates them on purpose: `Seal`
 * spares Spells, `Silence` hits only them, and `Skill Seal` takes both while
 * leaving Noble Phantasms alone. Collapsing any two makes a different effect
 * wrong in each direction.
 *
 * @param {object} ability
 * @returns {string} `"np"`, `"spell"` or `"skill"`
 */
export function useClassesOf(ability) {
  // NO ability is a Normal Attack, the one press with no Item: an `attack`,
  // which Seal and Disable stop and Skill Seal does not. Read as a Skill, a
  // Skill-Sealed Karna could not swing at all: *"Cannot use this ability:
  // Prevented"*, live after Anastasia's Snegleta sealed him (#258).
  if (!ability) return ["attack"];
  const out = [];
  // `countsForNPSeal`: a Skill that is part of a Noble Phantasm. Karna's Vasavi
  // Shakti Activation is stopped by NP Seal and not by Skill Seal (#206
  // reading 9).
  if (ability?.isNP || ability?.categorizedAsNP || ability?.countsForNPSeal) out.push("np");
  // `category: spell` is a Spell too. Medea's Argos, Keraino, Trofa, Atlas and
  // Dragon Tooth Warriors carry the category and not `isSpell`, which her two
  // Damage Spells and EMIYA's Thaumaturgy carry, so Silence stopped Aero and
  // let the other five through (#193). High-Speed Divine Words already finds
  // "all of Medea's Spells" by the category.
  // ...and a Spell that is ALSO categorized as an NP is both: the Magic Crest
  // (#241 reading 14).
  if (isSpellAbility(ability)) out.push("spell");
  return out.length > 0 ? out : ["skill"];
}

/**
 * Is this ability a Spell? `isSpell`, or the `spell` category: Medea's Argos,
 * Keraino, Trofa, Atlas and Dragon Tooth Warriors carry only the category
 * (#193). One reader, for Silence and for what a copy may take (#204).
 *
 * @param {object} ability an ability spec or a board snapshot's ability
 * @returns {boolean}
 */
export function isSpellAbility(ability) {
  return Boolean(ability?.isSpell) || ability?.category === "spell";
}

/**
 * The first partner in an exclusion list that has already gone.
 * @param {string[]|undefined} exclusive
 * @param {string[]} used
 * @returns {string|null}
 */
function firstUsed(exclusive, used) {
  if (!exclusive?.length) return null;
  const seen = new Set(used);
  return exclusive.find((id) => seen.has(id)) ?? null;
}

/**
 * Why the cost cannot be met, or `null` when it can.
 *
 * Health is **strictly** greater: *"the Servant cannot use its Noble Phantasm
 * if its Master's Health is equal to or less than the amount that would be
 * lost."* A Master at exactly 50 cannot pay a 50-cost NP, which is the kind of
 * boundary that is wrong in half the implementations that meet it.
 *
 * @param {object|null} cost
 * @param {object} unit
 * @param {object|null} master
 * @returns {string|null}
 */
/**
 * Why the costs a use will charge cannot be met together, or `null`.
 *
 * Summed per pool: two costs on one Master are one Health loss.
 *
 * @param {object[]} charged
 * @param {object} unit
 * @param {object|null} master
 * @returns {string|null}
 */
function chargedUnpayable(charged, unit, master) {
  const totals = new Map();
  for (const c of charged ?? []) {
    if (!c?.kind) continue;
    totals.set(c.kind, (totals.get(c.kind) ?? 0) + (c.amount ?? 0));
  }
  for (const [kind, amount] of totals) {
    const why = cannotPay({ kind, amount }, unit, master);
    if (why) return why;
  }
  return null;
}

function cannotPay(cost, unit, master) {
  if (!cost) return null;
  switch (cost.kind) {
    case "masterHealth":
      return currentHealth(master) > cost.amount ? null : "masterHealth";
    case "selfHealth":
      // Never refused: a Free Servant with no clock pays in its own Health, and
      // *"Reaching 0 means disappearance at the end of the Combat Process"*
      // (Appendix B §B.2, #241). It was refused at or below the cost.
      return null;
    case "sustainability":
      return (unit?.sustainability ?? 0) > cost.amount ? null : "sustainability";
    case "commandSpell":
      // *"Can only be used by expending a Command Spell"* (Yuugao, #249 reading
      // 24): one from its Contract, the pools `availableFor` sums. No Master, or
      // none left, and the button stays off.
      return availableFor(master, unit?.id) >= (cost.amount ?? 1) ? null : "commandSpell";
    default:
      return null;
  }
}

/**
 * The `[highRankMaster, lowRankMaster]` pair for a Noble Phantasm rank.
 * @param {Rank|null} npRank
 * @returns {[number, number]}
 */
function columnsFor(npRank) {
  const v = lookup("npCostByRank", npRank);
  return Array.isArray(v) ? [v[0], v[1]] : [0, 0];
}

/** @param {object} unit @returns {boolean} */
function isFree(unit) {
  return unit?.contract === "free" || unit?.contract === "unbound";
}

/**
 * Resolve a set of pending costs against each other (Ch. 17).
 *
 * A `Cost` may carry `supersedes: string[]`, naming other costs it **replaces
 * rather than stacks with**. Karna is the reference case: *"his Master's Health
 * loss from him using the NP overwrites the 20 Health loss from when Karna
 * would normally Act/Attack"* — charging both would bill 70 where the rules say
 * 50. Ch. 27's Hanging Gardens upkeep uses the same mechanism in the other
 * direction: the 50/round replaces the NP cost rather than adding to it.
 *
 * Supersession is resolved in **one pass over the original set**, not
 * transitively. A cost that was itself superseded still suppresses what it
 * names, which keeps the result independent of arrival order and makes a cycle
 * of mutual supersession collapse to one survivor rather than to none — and
 * "none" would make a Noble Phantasm free, which is the one outcome no reading
 * of the rule supports.
 *
 * @param {object[]} costs each optionally with `id` and `supersedes`
 * @returns {{charged: object[], superseded: Array<{id: string, by: string}>}}
 */
export function resolveCosts(costs) {
  const all = (costs ?? []).filter(Boolean);

  /** @type {Array<{id: string, by: string}>} */
  const superseded = [];
  const dropped = new Set();

  for (const cost of all) {
    for (const target of cost.supersedes ?? []) {
      // Only against costs actually being charged: a `supersedes` naming
      // something absent is content describing a case that did not arise.
      if (!all.some((c) => c.id === target)) continue;
      // A cycle would otherwise drop both. The first to be examined wins, and
      // the survivor is deterministic because the input order is.
      if (dropped.has(cost.id)) continue;
      if (dropped.has(target)) continue;
      dropped.add(target);
      superseded.push({ id: target, by: cost.id });
    }
  }

  return { charged: all.filter((c) => !dropped.has(c.id)), superseded };
}

/**
 * The Attribute, if any, that this Unit's surroundings refuse to let it create.
 *
 * Reads what the ABILITY would bring into existence -- a `summon` phase, a
 * `summonPlatform`, a `createStructure` -- against the `ForbidCreating`
 * suppressions the Unit is standing under.
 *
 * The attributes of the thing being created are not knowable from the ability
 * alone (they live on the summon's own content document), so the ability
 * declares them: `creates: [large]`. An ability that creates nothing declares
 * nothing and is never refused, which is every ability in the corpus but a
 * handful.
 *
 * @param {object} ability
 * @param {object} unit
 * @returns {string|null} the offending attribute, or null
 */
function forbiddenCreation(ability, unit) {
  const declared = ability?.creates ?? ability?.system?.creates ?? [];
  if (declared.length === 0) return null;
  for (const s of unit?.suppressions ?? []) {
    if (s.scope !== "creating") continue;
    const hit = declared.find((a) => (s.attributes ?? []).includes(a));
    if (hit) return hit;
  }
  return null;
}
