/**
 * @file Projection from Foundry documents to plain data.
 * @see docs/02-architecture.md
 *
 * Layer 2 (rules). Pure in the sense that matters: it takes documents as
 * **arguments** and reads their fields. It never touches a global, never
 * writes, and never awaits — so the whole rules layer downstream of it can be
 * tested with hand-built objects, which is exactly what the 253 tests do.
 *
 * A snapshot is built once per *operation* — one attack, one skill use — not
 * per predicate evaluation. Rebuilding 28 units × 30 effects for every
 * predicate would be pathological, and the memoization key is the actor's
 * `_stats.modifiedTime` plus a system-maintained `derivedVersion` counter that
 * the effect engine bumps.
 */

import { stacksHeld } from "./count.mjs";
import { tallyHandler } from "./modes.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { TURN_RECORD, ROUND_RECORD } from "../domain/stamped-record.mjs";
import { remainingMovement } from "./movement.mjs";
import { Rank } from "../domain/rank.mjs";
import { collectContributions, EFFECT_INSTANCE, EXECUTORS, empty } from "./elements.mjs";
import { baseAttackAdjustment } from "./setup-rolls.mjs";
import { annotateZon, waiveZon } from "./zon.mjs";
import { annotateLinkedGroups, annotateLegions } from "./linked-group.mjs";
import { annotateAllies } from "./named-units.mjs";
import { annotateAuras } from "./auras.mjs";
import { EffectRegistry } from "./registry.mjs";
import { magnitudeOf, polarityOf } from "./effect-instance.mjs";
import { familiesPresent } from "./effects/families.mjs";
import { buildAuraIndex } from "./aura-index.mjs";
import { annotateTerrain } from "./terrain.mjs";
import { annotateBonds } from "./bonds.mjs";
import {
  roundPhase, phaseAt, darkModifiers, homeBaseModifiers, regionBonusFor, inOwnHomeBase,
} from "./environment.mjs";
import { annotateCompulsions } from "./compulsion.mjs";
import { annotateControl } from "./control.mjs";
import { tierOf } from "./master-rank.mjs";
import { isUnbound } from "./cs-namespacing.mjs";
import { closeAttributes } from "../domain/attributes.mjs";
import { formOf, formOverrides, formSheet, keptByForm } from "./form.mjs";
import { grantHeld } from "./summon-grants.mjs";
import { rollOptionsFor } from "./options.mjs";
import { platformsOn, luckOwnerOf } from "./platforms.mjs";
import { annotateFields, withoutForeignEffects } from "./bounded-fields.mjs";
import { CONCEALMENT } from "./concealment.mjs";

/**
 * @typedef {object} UnitSnapshot
 * @property {string} id
 * @property {string} kind
 * @property {import("../domain/geometry.mjs").GridOffset} panel
 * @property {number|null} health `null` means intrinsically undamageable
 */

/**
 * Project one actor into a `UnitSnapshot`.
 *
 * @param {object} actor an `FGTActor`
 * @param {object} [opts]
 * @param {object} [opts.token] the placed token, for position and facing
 * @param {number|null} [opts.tick] the current ◈ tick. Turn state stamped with
 *   an earlier one is stale and projects blank — see {@link turnStateAt}.
 * @param {number} [opts.turnsPerRound] for resolving ◈ expressions to turns.
 * @param {number|null} [opts.round] the current Round, for `roundState`.
 * @returns {UnitSnapshot}
 */
export function snapshotUnit(actor, {
  token = null, panel = null, tick = null, turnsPerRound = 3, round = null, ownerUserId = null,
  warRegion = null, terrain = [], roundPhase: warPhase = null,
} = {}) {
  const sys = actor.system ?? {};
  const doc = token ?? actor.token ?? null;
  const contributions = contributionsOf(actor, { terrain, tick, turnsPerRound, war: { region: warRegion ?? null, phase: warPhase ?? null } });
  const footprint = gridFootprint(doc, panel);
  const turnState = turnStateAt(sys.turnState, tick);
  const effectIds = activeEffectIds(actor);
  const roundState = roundStateAt(sys.roundState, round);
  // A temporary `VariantOverride` contribution (Semiramis's `Double Summon`
  // buff granting the 'DSC' shape for 1◈ Turn) reads the SAME
  // `summonVariant.<branch>.overrides` block the permanent, summon-time
  // variant uses (`rules/summon-variant.mjs`) -- one set of numbers for both
  // the permanent and the temporary grant, rather than re-authoring Range,
  // Normal Attack and Sustainability a second time on the buff itself.
  // A FORM taken (Gilles's Gigantic Horror, #323) overrides the same fields a
  // variant does, and more: MOV, Base Attack, Attributes, Detect.
  const variantOverride = formOverrides(actor) ?? (contributions.variantOverride
    ? sys.summonVariant?.[contributions.variantOverride]?.overrides ?? null
    : null);

  // The war Region's grant is applied on the way out rather than inline,
  // because it shifts Ranks that the object literal below is still building.
  // `applyRegionBonus` is the SAME function `snapshotBoard`'s pass runs, and it
  // refuses to fire twice on one unit -- a caller with a canvas
  // (`engine/board.mjs#unitSnapshot`) projects with the Region already known so
  // the SHEET can show it, and hands that finished snapshot to the board.
  // Nested rather than sequenced, and the ORDER is the rule: the Region's ±10
  // is part of the "original value" Kiritsugu's mark halves, so the bonus lands
  // first and the halving takes the total. Both are idempotent, so the board
  // pass re-running them on a pre-projected unit changes nothing.
  return applyBaseAttackModifiers(applyRegionBonus({
    // The War this Unit stands in, as `war:` options read it (#314): its Region,
    // and the Round's phase (`roundPhase`), not this Unit's panel's.
    // `annotateEnvironment` rewrites it from the board's own facts.
    war: { region: warRegion ?? null, phase: warPhase ?? null },
    id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    kind: actor.type,
    // The STABLE, content-authored id -- `unitCommon()` declares it on every
    // unit type, and nothing ever projected it. `platformContentId` below is
    // its first real consumer: a Foundry document id is random per world and
    // content cannot predicate on one.
    contentId: sys.contentId ?? null,
    factionId: sys.factionId ?? null,
    faction: sys.factionId ?? null,
    // The player who owns this unit, which is what Charm transfers control
    // AWAY from. `rules/control.mjs#controllerOf` has read `unit.ownerUserId`
    // since it was written and nothing projected it, so every unit answered
    // `undefined` and the whole control map resolved to the GM.
    //
    // A NON-GM owner: `Actor#ownership` grants the GM everything, so taking
    // the first owner would name a Gamemaster for every unit in the world and
    // make Charm a no-op in the other direction.
    ownerUserId,
    // Who conjured this unit, and whether it still counts as alive. Neither
    // was ever projected: `system.defeated` has been read and written by
    // `io.defeat`/`resolveDefeat` since they existed, but nothing in `rules/`
    // could ask a unit's own SNAPSHOT whether it was defeated -- a defeat
    // never removes the token, so "still on the board" is not "still alive".
    // First real consumer: Bašmu's "only one summoned by this Spell can exist
    // on the field" (`noAliveSummon` requirement, rules/items.mjs).
    summonerId: sys.summonerId ?? null,
    // Both halves of a summon's action economy, and neither was projected.
    // `budget.mjs` tests `actsOncePerTurn` on the BOARD unit, so it read
    // `undefined` for every summon in every world and Bašmu's *"can only
    // Move/Attack once per Turn"* never applied -- a platform is caught by its
    // `kind` instead, which is why the cap looked implemented.
    //
    // `countsTowardBudget` had no reader at all. Its effect was the
    // unconditional one -- `poolFor` exempted every summon whatever its sheet
    // said -- so the flag could only ever have gone wrong in the other
    // direction, on a summon that counts. Projected as `=== true` so an absent
    // field keeps today's exemption.
    actsOncePerTurn: sys.actsOncePerTurn === true,
    countsTowardBudget: sys.countsTowardBudget === true,
    // Which enemy this summon hunts, and which field it dies with. Both are
    // Kagome Spirit clauses and both are read by rules that cannot reach the
    // document: the movement constraint and the field teardown.
    pursuitTargetId: sys.pursuitTargetId ?? null,
    boundToFieldId: sys.boundToFieldId ?? null,
    // Wisdom of Dún Scáith's pick still owed: no Turn ends while it is
    // (`rules/budget.mjs#unmetCompulsions`, #204 reading 8).
    copyPickDue: sys.copyPick?.due === true,
    // An opening choice still owed (#206 reading 3), read the same way.
    openingChoiceDue: (sys.openingChoices?.due ?? []).length > 0,
    // Bašmu's *"cannot leave the HGoB"*. Stamped at the summons and read by
    // the teardown from the document, but never projected, so `canUnboard`
    // could not see it and the bar offered Bašmu a Jump (Ch. 46 §46.4-BL).
    boundToPlatformId: sys.boundToPlatformId ?? null,
    summonAssignments: sys.summonAssignments ?? {},
    // Both halves of Pale Rider's Items line. Projected because
    // `acquisitionTarget` is pure and decides from the BOARD -- it has to see
    // the would-be holder, its Master, and the distance between them at once.
    cannotHoldItems: Boolean(sys.cannotHoldItems),
    itemHandling: sys.itemHandling ?? "hold",
    // Structure-only (Ch. 28). Who may break this object, and how near
    // a viewer must be to see it -- the first is a targeting filter and the
    // second is presentation, never state.
    destroyableBy: [...(sys.destroyableBy ?? [])],
    visibleWithin: sys.visibleWithin ?? null,
    placedById: sys.placedById ?? null,
    // The field a Bloodmark is a corner of. Projected so targeting can refuse a
    // corner while its Fort stands (#188 reading 14).
    fieldId: sys.fieldId ?? null,
    // An item lying on this object's panel, waiting to be walked onto.
    //
    // > *"the [Vorpal Blade] Item appears on a random panel on the game board,
    // > this Item can be picked up by a Unit walking onto its panel."*
    //
    // `carriesItem` carries the item's own `barredFrom` clause, COPIED onto the
    // cache when it was placed (`engine/skill-use.mjs#createStructure`) rather
    // than looked up here: `rules/items.mjs#itemPickupIntents` is pure and
    // cannot load a pack, and there is no item registry to ask.
    carriesItemId: sys.carriesItemId ?? null,
    // How many lie here: a dropped stack lands whole (#180).
    carriesItemCount: sys.carriesItemCount ?? 1,
    carriesItem: sys.carriesItemId
      ? { contentId: sys.carriesItemId, barredFrom: sys.carriesItemBarredFrom ?? null }
      : null,
    defeated: Boolean(sys.defeated),
    // When it fell, for the body's removal one tick later (#65, ruling 25).
    defeatedAt: sys.defeatedAt ?? null,
    // The Queen's Glass Game's once-per-game rewind, spent. Projected because
    // `resolveDefeat` reads it off the snapshot it is handed, and a flag the
    // board cannot see is a flag that clause would spend twice.
    glassGameSpent: Boolean(sys.glassGameSpent),
    // ...and effect 1's clock, which its Script advances (#247 D1).
    glassGameClock: sys.glassGameClock ?? 0,
    // When a summon's stay runs out. Read by the Round end's dismissal
    // (`rules/summons.mjs`) and by Alice Eater's `DurationDelta` off this
    // board unit, and the board never carried it: the Jabberwock never left
    // and its stay could not be extended (#247, live).
    expiresAt: sys.expiresAt ?? null,

    // GRID OFFSETS, never pixels. `doc.x`/`doc.y` are pixel coordinates, and
    // reading them as offsets made two adjacent tokens a hundred panels apart.
    panel: footprint[0],
    panels: footprint.length > 1 ? footprint : (sys.panels ?? null),
    level: footprint[0].k ?? doc?.elevation ?? 0,
    platformId: sys.platformId ?? null,
    // The Scene Level document the token stands on -- not `level`, which is a
    // height -- so a pocket dimension can be told from a deck at the same
    // height (#177).
    levelId: doc?.document?.level ?? doc?.level ?? null,
    // A platform that is a pocket dimension, not a deck above the board: who
    // is aboard it is in no Home Base (#177). The block itself is read off the
    // document by `engine/dimension.mjs`.
    isDimension: Boolean(sys.dimension),
    facing: sys.facing ?? "n",

    // `null` is a legal health value meaning "cannot be damaged and cannot be
    // healed" — Pale Rider and the Kagome Spirits. Distinct from Invuln, which
    // is a removable buff halved against NPs.
    health: sys.health?.value ?? null,
    maxHealth: sys.health?.max ?? null,
    agility: sys.agility?.value ?? 0,
    // The maximum beside it, for a restore stated as a share of it: Half Heal
    // and Full Heal restore "Agility by 50% of maximum" (#193).
    maxAgility: sys.agility?.max ?? 0,
    luck: sys.luck?.value ?? 0,
    // ...and its maximum, as Agility's: a rewind writes the pool back whole,
    // and a pool recorded from its value alone came back with its maximum cut
    // to what was left (#247, live).
    maxLuck: sys.luck?.max ?? 0,
    mov: variantOverride?.mov ?? sys.mov ?? 0,
    // The NUMBER of panels, not the `{panels, targets}` schema object. Every
    // consumer compares it against a distance, and comparing a distance to an
    // object is silently false rather than an error.
    range: variantOverride?.range?.panels
      ?? sys.range?.panels ?? (typeof sys.range === "number" ? sys.range : 1),
    maxTargets: variantOverride?.range?.targets ?? sys.range?.targets ?? 1,
    shield: sys.shield ?? 0,

    // `null` means the Sustainability clock does not exist for this unit
    // (Independent Action A+/EX), not that it is very large.
    // A NUMBER of turns, or `null` for a Unit with no clock at all. The rules
    // layer does arithmetic on this in four places and the document holds a ◈
    // expression, so resolving it is the snapshot's job -- exactly as it is
    // for `health`, and for the same reason.
    // `none`: *"Sustainability: None"*, no clock at all (#323).
    sustainability: variantOverride?.sustainability === "none" ? null
      : variantOverride?.sustainability
        ? sustainabilityTurns({ ...sys, sustainability: variantOverride.sustainability }, turnsPerRound)
        : sustainabilityTurns(sys, turnsPerRound),
    // The authored maximum, for the sheet.
    sustainabilityMax: sys.sustainability ?? null,
    // Turns lost at each Turn's end beyond the clock's own one: Revised Mad
    // Enhancement's clause 5 (#260 reading 3), read by `checkRemovals`.
    sustainabilityDecay: sys.sustainabilityDecay ?? 0,
    // Ch. 32: *"State is derived, not stored"* -- `if (!m) return "free"`. The
    // stored field exists because the contract OPERATIONS write it, but it
    // initialises to `"contracted"` and a Servant summoned with no Master had
    // nothing to overwrite it, so every Free Servant's sheet claimed a contract
    // it never had. With no `masterId` there is no Master to derive anything
    // else from, and the stored value is not evidence of one.
    contract: sys.masterId ? (sys.contract ?? "contracted") : "free",
    commandSpells: sys.commandSpells ?? 0,
    // A Servant can hold them too, as a Master (#193 reading 18).
    commandSpellsPerServant: sys.commandSpellsPerServant ?? {},

    // Ch. 03: `effective = base shifted by granted`. `grantedSteps` holds the
    // MASTER's grant and only that -- it is a permanent, per-unit fact this
    // projection can settle alone, and `grantedStepDeltas` names the Master as
    // its source. The war Region's grant is applied by `applyRegionBonus` on
    // the way out of this function instead, because it is a fact about the
    // WAR: it has to move when the Region does, without rewriting a sheet.
    //
    // The summon used to bake the Region into this field as well
    // (`engine/summon.mjs#commitSummon`), which counted it twice on a board and
    // labelled it as the Master's on a sheet.
    // A form that is another Servant's sheet has its Parameters, the steps he
    // was granted carried over: *"Any + or - to Sieg's Parameters are carried
    // over"* (#345).
    parameters: applyGrantedSteps(parseParameters(formSheet(actor).parameters), sys.grantedSteps),
    // ...and the letters the sheet stores, for the one reader that writes them
    // back: a rewind (`rules/history.mjs#snapshotUnit`). The Ranks above carry
    // the granted steps and clone to {} in a flag (#247, live).
    storedParameters: { ...(sys.parameters ?? {}) },
    baseAttack: {
      str: variantOverride?.baseAttack?.str ?? sys.baseAttack?.str ?? 0,
      mag: variantOverride?.baseAttack?.mag ?? sys.baseAttack?.mag ?? 0,
    },
    // The AUTHORED maximum Health, which is not `health.max` once anything has
    // grown it. Kingprotea's Proliferation pays *"20% of Kingprotea's ORIGINAL
    // Max Health"* per stock, and reading the live maximum there compounds.
    baseHealth: formSheet(actor).baseHealth,
    // Abilities can grant attributes -- Divinity grants `divine`, which is what
    // Karna's Vasavi Shakti and Scathach's God Slayer key on.
    //
    // Then CLOSED over CONTEXT.md's implication table (`domain/attributes.mjs`),
    // which had never been applied anywhere: `Servant => Spirit` unless the
    // Servant is a Demi- or Pseudo-Servant, `Human => Humanoid, Living Human`,
    // and the derived `Magus` that Mannanan's Sealing Designation Enforcer
    // defines. Closed HERE rather than at authoring time so `Pseudo Servant`
    // means something -- it is the only attribute in the game whose whole job
    // is to withhold an implication.
    // A form REPLACES them: the Gigantic Horror is *"Dark (Outsider), Large"*
    // and nothing else (#323 reading 11c).
    attributes: attributesOf(actor, {
      contributed: contributions.attributes,
      removed: contributions.attributesRemoved,
      override: variantOverride?.attributes ?? null,
    }),
    // Where the unit is from. Predicates name it -- "damage dealt to Male Units
    // from the Greece region" -- and nothing carried it before.
    region: formSheet(actor).region,
    // A resolved summon-time variant (`rules/summon-variant.mjs`) -- `null` for
    // every Servant but the ones authored with a `summonVariant` block.
    //
    // `sys.variant` is where it lives, and three places agree on that: the
    // schema calls it *"the RESOLVED result of `summonVariant`, once and for
    // ever from summon"* and documents it as read via `self:variant:<id>`;
    // `engine/summon.mjs` writes `patch.variant = variantId` at commit; and
    // `rules/options.mjs` emits the option from `unit.variant`.
    //
    // This read `sys.summonVariant?.variant`, which is the AUTHORED block --
    // `{ heads, tails }` -- and has no `variant` key at all. So the projection
    // was `null` for everybody and **`self:variant:` was never true for
    // anyone** (Ch. 46 §46.4-Y). Measured live on a Semiramis summoned onto the
    // `dsc` branch: `system.variant` read `"dsc"` and her Range was correctly
    // overridden to 3, while her projection carried `variant: null`, emitted no
    // `self:variant:` option, and refused Summoning: Bašmu with
    // `reason: "predicate"`.
    //
    // That is the spine of Semiramis's sheet, the way the stance is Achilles's.
    // Six of her abilities fork on it: the Hanging Gardens' own requirement
    // (`self:variant:dsc`), both Sikera Ušum branches, Summoning: Bašmu,
    // Territory Creation's EX-versus-C rank, and Double Summon's clause 3. With
    // every branch false her signature Noble Phantasm refused itself, and the
    // Double Summon: Caster fork resolved to *neither* side rather than one.
    //
    // Distinct from `variantOverride` above, which is a runtime CONTRIBUTION
    // that swaps a Unit's numbers for a while (her `DSC` buff); this is the
    // record of the coin flip. Found live driving Semiramis.
    variant: sys.variant ?? sys.summonVariant?.variant ?? null,
    // The stance and the rules for changing it (Ch. 45). Both travel,
    // because `rules/stance.mjs` answers "may this change now" from the
    // projection and never from the document.
    // Weak points the ATTACKER may aim at (Ch. 45). Collected from the
    // Unit's own abilities, because it is a property of the Unit rather than a
    // technique it uses -- which is also why nothing here checks a cooldown.
    weakPoints: [...(actor.items ?? [])]
      .filter((i) => keptByForm(actor, i))
      .map((i) => i.system?.weakPoint)
      .filter(Boolean),
    // How this Unit shoves whoever it walks into (Ch. 05). `null` for
    // everyone but Achilles; Kingprotea's outward push is the default.
    knockback: contributions.knockback ?? null,
    // Riding's Passenger Seat, as the player left it. Read by
    // `engine/movement-hooks.mjs#carryMaster` and by the action bar's own
    // button, which shows its state.
    carriesMaster: sys.carriesMaster !== false,
    stance: sys.stance ?? "",
    stanceSpec: sys.stanceSpec ?? null,
    // The unit's OWN auras, unexpanded. `snapshotBoard` runs `annotateAuras`
    // once every unit exists and appends what each unit actually stands in to
    // its `modifiers`. A unit snapshotted alone receives only its own auras --
    // correct, because an ally aura includes its bearer.
    auras: contributions.auras ?? [],
    // Read by `effect-applier` when it computes an incoming effect's chance.
    applicationChances: contributions.applicationChances ?? [],
    // Modifier sources this Unit drops from its OPPONENT's bag, whichever side
    // of the exchange it is on. A bag the snapshot does not carry cannot be
    // read by the pipeline, however carefully it is authored.
    excludesOpponentSources: contributions.excludesOpponentSources ?? [],
    // Health floors scoped to one damage source. A bag the snapshot does not
    // carry cannot be read by the pipeline, however carefully it is authored.
    damageFloors: contributions.damageFloors ?? [],
    // Expanded by `annotateCompulsions` once the board exists.
    compulsionRules: contributions.compulsions ?? [],
    // Modes this Unit is HELD ON in, and the condition each waits on. Read by
    // `rules/modes.mjs#forcedOn` -- late, every time the question is asked,
    // because the conditions are positional (Ch. 17).
    forcedModeRules: contributions.forcedModeRules ?? [],
    // Scalings applied to an incoming effect's MAGNITUDE, read at step 4b of
    // the application pipeline (`engine/effect-applier.mjs`). Distinct from
    // `applicationChances` above, which changes how likely it is to land at all.
    magnitudeScales: contributions.magnitudeScales ?? [],
    // Terrains whose penalties this Unit does not take (Arturia's Vivian's
    // Blessing on Waterside, #230), read by `rules/terrain.mjs#terrainEffects`.
    terrainPenaltyImmunities: contributions.terrainPenaltyImmunities ?? [],
    // Shares of the maximum at or above which a lethal blow leaves 1 Health
    // (Avalon, #230), read by `engine/attack.mjs#resolveDefeatOf`.
    lethalFloors: contributions.lethalFloors ?? [],
    // Curse of Separation's chance to cancel a lethal Attack (#347).
    lethalCancels: contributions.lethalCancels ?? [],
    // Changes to the healing this Unit receives (Heal Dwn, Drowning, #232),
    // read by `engine/applier.mjs#resolveHealing`.
    healingReceived: contributions.healingReceived ?? [],
    // More off every cut to a named Cooldown (Merlin, Barghest, #299), read by
    // `engine/applier.mjs#resolveCooldownCuts`.
    cooldownCutBonus: contributions.cooldownCutBonus ?? [],
    // A named cut made longer while held (Rheingold, #341), read by
    // `engine/scheduler.mjs`'s `CooldownDelta` through its `overriddenBy`.
    cooldownCutOverrides: contributions.cooldownCutOverrides ?? [],
    // Attacks that go through every reduction on this Unit (Armor of Fafnir from
    // behind, #341 ruling 6), read by `rules/damage/pipeline.mjs#bypassesDefence`.
    defenceless: contributions.defenceless ?? [],
    // Attacks whose damage lowers its Max Health too (#341 ruling 7), read by
    // `engine/attack.mjs#applyDamage`.
    woundsMaxHealth: contributions.woundsMaxHealth ?? [],
    // Chances that a use fails outright (Charlotte, Merlin, #300), read by
    // `rules/use-failure.mjs#failureFor`.
    useFailures: contributions.useFailures ?? [],
    // Chances of learning an NP's True Name used near this Unit (#297), read by
    // `engine/true-name.mjs#witnessNP`.
    learnsTrueNames: contributions.learnsTrueNames ?? [],
    // An additional Normal Attack after one of this Unit's (Bab-ilu, #232),
    // read by `engine/follow-up.mjs#offerFollowUp`.
    followUps: contributions.followUps ?? [],
    // How many Attacks it may make this Turn, and whether it bars its allied
    // Servants' (Unparalleled, #328 ruling 11). Read by `rules/budget.mjs` and
    // `rules/named-units.mjs#annotateAllies`.
    attacksPerTurn: Math.max(1, ...(contributions.attackAllowances ?? []).map((a) => a.value)),
    bansAlliedServantAttacks: contributions.bansAlliedServantAttacks ?? [],
    // Attacks that have no effect on it (Gravity Manipulation, #328 ruling 9),
    // read by `rules/miss.mjs#nullifiedBy`.
    attackNullifiers: contributions.attackNullifiers ?? [],
    // Noble Phantasms that ride its Normal Attacks (Four Elements, #328),
    // read by `engine/attack-riders.mjs#offerAttackRiders`.
    attackRiders: contributions.attackRiders ?? [],
    // Read by `engine/attack.mjs` before the Combat Processes are built, to
    // ask whether this unit may swing first at whoever just declared on it.
    preemptions: contributions.preemptions ?? [],
    // Adjustments to the clock of an effect being applied TO this Unit, read at
    // step 6 of the application pipeline (`engine/effect-applier.mjs`).
    durationExtensions: contributions.durationExtensions ?? [],
    // Spends this Unit may be OFFERED at a timing window, rather than charged
    // (`engine/optional-costs.mjs`).
    optionalCosts: contributions.optionalCosts ?? [],
    // Shifts aimed at an ability's own Rank, for a reader after collection:
    // Espionage raises Presence Concealment from C to A (#253 reading 4).
    abilityRankShifts: contributions.abilityRankShifts ?? [],
    // How hard this Unit's buffs are to dispel (`rules/removal.mjs`).
    buffRemovalResist: contributions.buffRemovalResist ?? [],
    // Counters this Unit performs without being asked, and what provokes each
    // (`engine/auto-counter.mjs`). Mannanán's `Fragarach` is the only holder.
    autoCounters: contributions.autoCounters ?? [],
    // Rungs of the reaction ladder something has taken away. `canCounter` had
    // one of these as a named special case (`defenderHasFragarach`); the
    // general list is what lets the ladder say WHICH effect refused.
    //
    // ...and every rung an effect that prevents Acting takes: Evading, Blocking
    // and Countering are Acting (#232 reading 10), and Disable, which leaves
    // only Move, takes them too (#247 readings 4, 17, 18). One door, read off the
    // definitions as `canAct` below is: only `cannotAct` said so, by a line of
    // its own, and a Stunned Unit still Evaded.
    forbiddenReactions: [...new Set([
      ...(contributions.forbiddenReactions ?? []),
      ...(effectIds.some((id) => EffectRegistry.get(id)?.preventsAction) ? ["evade", "block", "counter"] : []),
    ])],
    // ...and the rungs this Unit takes from whoever it attacks (#103).
    refusesReactions: [...new Set(contributions.refusesReactions ?? [])],
    alignment: formSheet(actor).alignment,
    // A Master's stored letter (Ch. 06). `masterTier` is derived from it
    // by `annotateMasterRank`, which needs the board: a Servant's tier is its
    // MASTER's, and only the board knows who that is.
    rank: sys.rank ?? null,
    // How many Master Essence uses this Master has left (#241): its OWN
    // Essence, not a Servant's copy, with a use still unspent. The bar offers
    // the Essence button on it.
    essenceUsesLeft: [...(actor.items ?? [])].filter((i) => i.type === "masterEssence"
      && !i.system?.grantedBy && (i.system?.effect?.length ?? 0) > 0
      && (i.system?.timesUsed ?? 0) < (i.system?.maxUses ?? 1)).length,

    effects: effectIds,
    // The FAMILIES those effects put the unit in (§A). Computed once here
    // because this is the only layer holding both the live ids and the
    // registry; `Bind` is an umbrella over ten effects and Metamorphosis is
    // the first clause that has to ask about the umbrella.
    effectFamilies: familiesPresent(effectIds, EffectRegistry),
    effectInstances: effectInstances(actor),
    modifiers: contributions.modifiers,
    abilities: collectAbilities(actor, { tick, turnsPerRound }),
    // What a form dropped, still his documents: the Gigantic Horror's Spells
    // read Prelati's Spellbook *itself*, open while it stands and rests (#323
    // reading 11i). Read only where a requirement names an ability
    // (`rules/items.mjs#gatedAbilities`); nothing here can be used.
    formDropped: collectAbilities(actor, { tick, turnsPerRound, dropped: true }),
    // Ch. 06's pools, so a gate or a cooldown waiver can ask what the Unit
    // holds without reaching for the document. Copied one level deep, because
    // this layer is pure and must not hand a live document's object to a rule.
    resources: Object.fromEntries(
      Object.entries(sys.resources ?? {}).map(([k, v]) => [k, { value: v?.value ?? 0, max: v?.max ?? null }]),
    ),
    // Bašmu: "the HGoB can move onto occupied panels" and Bašmu itself "when
    // it Moves to any occupied panels, all Units occupying said panels are
    // knocked back" -- `rules/movement.mjs`'s `ignoresBlocking` already reads
    // this generic flag, unset until now because nothing needed it.
    ignoresOccupancy: Boolean(sys.movesOntoOccupiedPanels),
    // ...or granted it: a Feigned Defeat's ghost (#249 reading 19).
    sharesPanel: Boolean(sys.sharesPanel) || (contributions.grantedAbilities ?? []).includes("sharesPanels"),
    // Nothing a ghost does spends its side's budget (#249 reading 35). Read by
    // `rules/budget.mjs#poolFor` since it was written; projected now.
    exemptFromBudget: (contributions.grantedAbilities ?? []).includes("offBudget"),
    eventHandlers: contributions.eventHandlers,
    immunities: contributions.immunities,
    grantedAbilities: contributions.grantedAbilities,
    autoSucceeds: contributions.autoSucceeds,
    // Ways back from zero Health, with the charges each has left folded in --
    // the contribution declares the budget and the Item holds what is spent.
    revivals: (contributions.revivals ?? []).map((r) => ({
      ...r,
      charges: chargesLeft(actor, r),
    })),
    checkModifiers: contributions.checkModifiers,
    // Two buckets that were collected and handed to nobody. Both reached a unit
    // by exactly ONE route -- `rules/bounded-fields.mjs`'s `annotateFields`,
    // appending them from a FIELD's interior rules -- so they worked perfectly
    // inside Sikera Usum's Throne Room and did nothing anywhere else. An
    // ability or an effect contributing either was collected, projected
    // nowhere, and read by no one (Ch. 46 §46.4-AI).
    //
    // Van Gogh's `Channel Marker Soul` is the live casualty: a
    // `VulnerabilityAmplifier` halving Curse damage, on an ability, which has
    // never once applied. Found authoring `weakToPoison` for Sikera Usum clause
    // e -- the new effect's own amplifier was absent from the board unit while
    // the field's sat beside it.
    vulnerabilityAmplifiers: contributions.vulnerabilityAmplifiers ?? [],
    periodicOverrides: contributions.periodicOverrides ?? [],
    // Properties of the ATTACK contributed by the attacker's own buffs, folded
    // into the spec by `engine/attack.mjs#buildAttackSpec`. Projected here
    // because a contribution the snapshot does not carry is one the engine
    // cannot read -- which is how `system.concealed` sat unanswered through
    // four subsystems that all consulted it.
    attackProperties: contributions.attackProperties ?? [],
    // Per-category Turn caps, read by `rules/costs.mjs#canUseAbility`. The
    // categories themselves are already on `abilities` above, so the gate can
    // tell what a recorded use WAS without any further projection.
    categoryUseLimits: contributions.categoryUseLimits ?? [],
    // Multipliers on Base Attack itself, folded in by
    // `applyBaseAttackModifiers` below rather than read by the pipeline: BOTH
    // components have to move, and an attack only ever reads one of them.
    baseAttackModifiers: contributions.baseAttackModifiers ?? [],
    damageNegation: contributions.damageNegation,
    // `contributions.statDeltas` is informational: `FGTActor#prepareDerivedData`
    // has ALREADY folded those into `mov`, `range`, `agility` and friends above
    // -- this list is here so a sheet can explain the number, not so a consumer
    // can apply it again. `grantedStepDeltas` is the opposite: it explains a
    // shift `parameters` above has ALREADY received (from `applyGrantedSteps`),
    // for the same "why is my Rank B" trace `annotateRegionBonus` feeds too.
    statDeltas: [...contributions.statDeltas, ...grantedStepDeltas(sys.grantedSteps)],

    magicResistance: withVariants(contributions.magicResistance ?? magicResistanceOf(actor),
      contributions.magicResistanceVariants),

    // Which component a normal attack draws on. The preview reads this to build
    // the same base spec the real attack will; without it a MAG attacker was
    // previewed as a STR one.
    normalAttack: {
      mode: variantOverride?.normalAttack?.mode ?? sys.normalAttack?.mode ?? "fixed",
      // An Item's word first: the Vorpal Blade's *"Normal Attacks with this Item
      // Equipped use Base Attack (STR)"* (#247 D4).
      component: contributions.normalAttackComponent
        ?? variantOverride?.normalAttack?.component ?? sys.normalAttack?.component ?? "str",
      // The damage TYPE. Declared on the schema, authored on the sheet, stored
      // on the document -- and dropped HERE, because this projection rebuilds
      // `normalAttack` field by field rather than spreading it. Ozymandias's
      // Mesektet is *"Light damage"* on every Normal Attack he makes, and the
      // pipeline reads the element off the projection, so it arrived as `null`
      // and the swing had no type at all. Found live, one field after adding it.
      element: variantOverride?.normalAttack?.element ?? sys.normalAttack?.element ?? null,
      // ...and how much of the swing carries it. `engine/attack.mjs` says why
      // the two must travel together: an element without its fraction is
      // silently a whole-element attack. Raikou's four copies are *"Lightning
      // (half)"*; the real attack read the fraction off the document, and a
      // caller handed this projection -- the preview -- saw none. Found by
      // `test/unit/survival.test.mjs` on its first run.
      elementFraction: variantOverride?.normalAttack?.elementFraction ?? sys.normalAttack?.elementFraction ?? null,
      // EMIYA's Normal Attack changes what it is made of at Range 3. Without
      // the bands here the projection reports the flat component, so the
      // preview and the resolution would disagree about his damage at every
      // distance -- which is the exact failure the one-projection rule above
      // exists to prevent.
      bands: [...(variantOverride?.normalAttack?.bands ?? sys.normalAttack?.bands ?? [])],
      // A Normal Attack with an AREA. Kagome: Famine is *"Range: 3 panels,
      // 3x3 panel area"* -- the first in the corpus, and until now every
      // Normal Attack in the game hit exactly one panel because the targeting
      // fallback said `{kind: "unit"}` and nothing could say otherwise.
      shape: variantOverride?.normalAttack?.shape ?? sys.normalAttack?.shape ?? null,
      // Whom that area hits. A form's own word: the Gigantic Horror's 3x3 hits
      // *"every Unit in it but himself"* (#323 reading 11g), his Horrors too.
      relations: variantOverride?.normalAttack?.relations ?? null,
      // The Rank Magic Resistance meets it at (#187 reading 8).
      attackRank: variantOverride?.normalAttack?.attackRank ?? sys.normalAttack?.attackRank ?? null,
      // Ranged, Melee or Special, as the sheet states it (#281).
      delivery: variantOverride?.normalAttack?.delivery ?? sys.normalAttack?.delivery ?? null,
      // Its own stage-3 multipliers (#189 readings 3, 18).
      conditionalMultipliers: [...(variantOverride?.normalAttack?.conditionalMultipliers ?? sys.normalAttack?.conditionalMultipliers ?? [])],
    },

    // ZON belongs to the Master-Servant pair, so a per-unit projection cannot
    // finish it: `snapshotBoard` runs `annotateZon` once the other units exist
    // and overwrites the three fields below. A unit snapshotted alone reports
    // "inside", which is the safe answer -- the penalty applies to a Servant
    // provably outside its Master's zone, not to one we could not measure.
    servantClasses: formSheet(actor).servantClasses,
    masterId: sys.masterId ?? null,
    zonBonuses: contributions.zonBonuses ?? [],
    npGateShifts: contributions.npGateShifts ?? [],
    zonExempt: Boolean(sys.zonExempt),
    zonPartnerIds: [...(sys.zonPartnerIds ?? [])],
    // The linked group, flattened. `memberIds` becomes an array because every
    // reader iterates it and a `Set` does not survive the socket.
    linkedGroup: linkedGroupOf(sys),
    // A legion body's pool and number. The pool itself is the Master's
    // (`legions`), so `annotateLegions` finishes `legion` on the board.
    legionKey: sys.legionKey || null,
    legionNumber: sys.legionNumber ?? null,
    // A Master's legion pools, as stored (`engine/legion.mjs`).
    legions: sys.legions ? structuredClone(sys.legions) : null,
    zon: sys.zon ?? null,
    // Board annotations, not document fields: `annotateZon` and
    // `annotateEnvironment` fill them. Read off the actor they were always
    // absent, and a per-unit caller that never reached the board read those
    // absences as facts (#104).
    zonDistance: null,
    outsideZon: false,
    zones: [],
    // Platform fields; harmless on anything that is not one.
    footprint: sys.footprint ?? null,
    capacity: sys.capacity ?? null,
    ownerId: sys.ownerId ?? null,
    // Whether the Luck is STATED relative to the summoner -- the authored fact,
    // of any kind of Unit. *"Luck: Shared with Quetz's"* / *"…with Drake"*: for a
    // PLATFORM that means no Luck of its own, one pool with its owner's, which
    // `annotatePlatforms` reads onto it (`rules/platforms.mjs#luckOwnerOf`) and
    // `engine/io.mjs#adjustStat` spends from (#162). A Summon's is only a
    // starting value, resolved once at placement, and `luckOwnerOf` leaves it be.
    luckFromSummoner: sys.inherit?.luck?.from === "summoner",
    crossLevel: sys.crossLevel ?? null,
    boardingReliefAfter: [...(sys.boardingReliefAfter ?? [])],
    // Read by `rules/platforms.mjs#platformsDestroyedBy` (§46.4-CH).
    destroyedWithOwner: sys.destroyedWithOwner === true,
    // `upkeep` was NEVER PROJECTED, so `engine/attack.mjs`'s platform cost
    // replacement -- `units.find(u => u.kind === "platform" && u.upkeep)` --
    // could not match a platform in any world: the Hanging Gardens' clause
    // overwriting a Servant's NP Master-Health cost has been inert since it was
    // written. The recurring-toll reader (`fields.mjs#runUpkeep`) needs the
    // same field, so both are fixed by projecting it once.
    upkeep: sys.upkeep ?? null,
    deactivation: sys.deactivation ?? null,
    activatedAt: sys.activatedAt ?? null,
    lastUpkeepAt: sys.lastUpkeepAt ?? null,
    lastUpkeepRound: sys.lastUpkeepRound ?? null,
    // The three per-platform rules Drake's ship is the first to state. Projected
    // here because a field the snapshot does not carry cannot be read by the
    // board, however carefully it is authored -- which is how the Hanging
    // Gardens' own `upkeep` sat inert until it was added two lines above.
    boarding: sys.boarding ?? null,
    // ADR 0001 / #29. Without this the rules layer never sees the opt-in and
    // every Platform holds its edge -- the exact "authored and unread" failure
    // this projection keeps producing.
    knockOff: sys.knockOff ?? null,
    // The same opt-in for the platform's END (#139): only a Platform that
    // authors the ladder rolls it, so a projection that drops it makes every
    // platform's riders safe, silently.
    collapse: sys.collapse ?? null,
    lockAboard: sys.lockAboard ?? [],
    deactivateOn: sys.deactivateOn ?? [],
    replacesRiderAction: sys.replacesRiderAction ?? null,
    countsAsHomeBase: Boolean(sys.countsAsHomeBase),
    // Concealment is a STATE, and until now nothing produced it. `sys.concealed`
    // was projected here, consulted by targeting, by the counter gate, by
    // movement legality and by the Evade ladder -- and written by no code and
    // declared by no schema, so all four asked a question whose answer was
    // always `false`. The whole of Presence Concealment was inert.
    //
    // It rides the effect instead, which is what clause 8 asks for anyway:
    // *"the effects of Presence Concealment are neither a buff or a debuff, and
    // are Unremovable"*. `sys.concealed` is still honoured so a GM can set it by
    // hand on a Unit whose concealment comes from somewhere else.
    concealed: Boolean(sys.concealed) || effectIds.includes(CONCEALMENT),
    // Ch. 32: a Servant whose Master died *"remains in whatever state it was
    // in"*. Written at the death (`io.mjs`, `lockModes`) and shown as a badge,
    // and no switch read it: Vlad III (Berserker) switched Mad Enhancement off
    // after his Master fell (#333, live). `rules/modes.mjs#canToggleMode` reads it.
    modesLocked: sys.modesLocked === true,
    // "This Unit is able to Attack Masters ... regardless of enemy
    // Master-Servant positions." `resolve.mjs` has consulted
    // `caster.bypassesMasterProtection` since Master protection was written and
    // NOTHING set it, so the exemption could not be authored at all.
    bypassesMasterProtection: (contributions.suppressions ?? [])
      .some((s2) => s2.scope === "masterProtection"),
    // What this Unit switches OFF. Collected since the executor table was
    // written and **never projected**, so every `Suppress`, `ForceTarget`,
    // `Decoy` and `WeakPoint` an ability contributed reached a bucket nothing
    // downstream could see -- only `bypassesMasterProtection` above, which
    // reads the contributions directly, ever escaped. `annotateFields` writes
    // to this same key for a field's interior rules, which is why a field's
    // suppression worked and an ability's did not.
    //
    // A summon that hunts one enemy is FORCED onto it here, which is the
    // attack half of *"constantly Move towards that Unit and Attack it"*. Not
    // an authored `ForceTarget`, because the id is a Foundry document stamped
    // at placement and content cannot name one.
    suppressions: sys.pursuitTargetId
      ? [...(contributions.suppressions ?? []), {
        scope: "targeting", forceTarget: sys.pursuitTargetId, source: "pursuit",
      }]
      : (contributions.suppressions ?? []),
    // Identity and Detect (Ch. 06, Ch. 05).
    trueName: formSheet(actor).trueName,
    classContainer: sys.classContainer ?? [...(sys.servantClasses ?? [])][0] ?? null,
    concealedIdentity: sys.concealedIdentity || null,
    identityRevealed: Boolean(sys.identityRevealed),
    // *"Detect: Same as Range"* (#323): a form's `detect: range`.
    detect: variantOverride?.detect === "range"
      ? (variantOverride?.range?.panels ?? null)
      : (variantOverride?.detect ?? sys.detect ?? null),
    // The form taken, and what it keeps (#323): `self:form:` and the use gate.
    form: formOf(actor)?.id ?? null,
    // ...who drives it, and how (#323 reading 12): the GM, at the nearest Unit,
    // its Range growing while none is in reach.
    formController: formOf(actor)?.spec?.controller ?? null,
    attacksNearest: formOf(actor)?.spec?.controller === "gm",
    rangeGrows: Boolean(formOf(actor)?.spec?.rangeGrows),
    // "While a Servant is affected by Charm, Confuse, Berserk, Stun, Stop,
    // Petrify, Freeze, Sleep, **or any other effect that prevents a Servant
    // from Acting**, the effects in the above paragraphs are negated"
    // (Ch. 32). The flag alone answered only `engine/channel.mjs`, which is the
    // one thing that writes it — so a Stunned Servant still protected its
    // Master, still redirected a Counter, still denied the zone and still
    // covered against an AoE, and Ch. 32's negation clause was inert for all
    // four rules.
    //
    // Read off the DEFINITIONS rather than a hard-coded list, which is what
    // `preventsAction` was added for: its own schema comment says Ch. 08 "had
    // to guess from a hard-coded list before any effect could say so itself".
    canAct: sys.canAct !== false
      && !effectIds.some((id) => EffectRegistry.get(id)?.preventsAction),
    // The Hanging Gardens' multi-Turn activation (`engine/channel.mjs`).
    channel: sys.channel ?? null,
    // When Health was last at or above a fraction somebody asks about. Read by
    // the `healthRestoredSince` requirement, which is a question about history
    // and cannot be answered from the current bar.
    healthWatermarks: { ...(sys.healthWatermarks ?? {}) },
    // For `unitFirstSeen` (`engine/vision.mjs`) -- SetFields arrive as `Set`,
    // spread for the same reason every other one on this projection is.
    seenUnitIds: [...(sys.seenUnitIds ?? [])],
    // Familiar: Doves' `RevealPosition` -- the effect id this unit can see
    // the position of, regardless of Fog of War (`apps/canvas/overlay-layer.mjs`).
    revealsEffect: contributions.revealsEffect ?? null,
    // Consumable `equipment` items and how many, for an `itemAtLeast`
    // requirement (`rules/items.mjs`) -- "Requires 3 [Semiramis' Poison] to
    // use" is a gate on the CASTER's own held quantity, and nothing before
    // Arrogant King's Poison needed to answer that question from a pure
    // snapshot. Keyed by the STABLE content id, the same reason
    // `platformContentId` is: a Foundry item id is random per world.
    items: [...(actor.items ?? [])]
      .filter((i) => i.type === "equipment")
      // `consumable` is whether USING it does anything -- Ch. 18's
      // `consumeEffect`. The action registry decides from the snapshot alone
      // whether to offer the button, and an item with no consumeEffect is
      // equipment rather than a consumable: `[Vorpal Blade]` works through its
      // `rules` while equipped and is never "used" (#30).
      .map((i) => ({
        contentId: i.system?.contentId ?? i.id,
        quantity: i.system?.quantity ?? 0,
        consumable: Boolean((i.system?.consumeEffect ?? []).length),
        // *"Items cannot be traded/given/passed to other Units unless
        // stated"*, so the default is false and only `[Semiramis' Poison]`
        // says otherwise in the reference set. The range is the item's own --
        // her clause is *"directly next to"* -- and the registry needs both to
        // decide whether a give is on offer (#32).
        transferable: Boolean(i.system?.transferable),
        transferRange: i.system?.transferRange ?? 1,
        // Who bound it to this holder, if anyone (Avalon, #230): the board's
        // bond pass reads it (`rules/bonds.mjs#annotateBonds`).
        bondUnitId: i.system?.bondUnitId || null,
        bondMasterId: i.system?.bondMasterId || null,
      })),
    acted: turnState.acted,
    // Hoisted beside `acted` for the same reason `acted` is: `scheduler#endTurn`
    // filters the whole board on it once per boundary, and reaching into
    // `turnState` for that is a different shape from every other filter there.
    inCombatPhase: turnState.inCombatPhase,
    turnState,
    roundState,
    // `consecutiveRounds` is persistent (world state, not stale-by-reading);
    // `combatInBaseThisRound` rides `roundState`'s own staleness, so a new
    // Round reads it as false without anyone writing a reset
    // (`rules/environment.mjs#endOfRoundHomeBase`).
    homeBase: {
      consecutiveRounds: sys.homeBase?.consecutiveRounds ?? 0,
      combatInBaseThisRound: roundState.combatInBaseThisRound,
    },
  }, warRegion));
}

/**
 * The four record projections, bound to `domain/stamped-record.mjs`.
 *
 * The rule these obey -- a record stamped with an earlier cycle reads as blank,
 * and a writer must rebuild the whole record rather than re-stamp it -- lives in
 * that module, along with why, what it cost to learn twice, and the two records'
 * field declarations. These are the names ~25 call sites already use; they stay
 * because the names are right, not because the logic is here.
 *
 * @see module/domain/stamped-record.mjs
 */

/**
 * A unit's turn state, or a blank one when it belongs to an earlier tick.
 *
 * @param {object} raw `system.turnState`
 * @param {number|null} tick the current ◈ tick, or `null` to apply no staleness
 * @returns {object} the projected turn state
 */
export function turnStateAt(raw, tick) {
  return TURN_RECORD.at(raw, tick);
}

/**
 * The full turn record to WRITE when patching some of its fields.
 *
 * @param {object|null} raw the stored `turnState`
 * @param {number|null} tick now
 * @param {object} [patch] the fields being set
 * @returns {object} every field to write
 */
export function turnWrite(raw, tick, patch = {}) {
  // The moment the Attack is recorded is the one moment that knows whether a
  // Move came before it (#189 reading 15). Here, in the one writer every
  // stamp goes through, so no attack path can forget it.
  const now = TURN_RECORD.at(raw, tick);
  const first = patch.attacked === true && !now.attacked && patch.movedBeforeAttack === undefined;
  return TURN_RECORD.write(raw, tick, first ? { movedBeforeAttack: Boolean(now.moved || patch.moved), ...patch } : patch);
}

/**
 * A unit's round state, or a blank one when it belongs to an earlier Round.
 *
 * @param {object} raw `system.roundState`
 * @param {number|null} round the current Round, or `null` to apply no staleness
 * @returns {{round: number|null, abilitiesUsed: string[], combatInBaseThisRound: boolean}}
 */
export function roundStateAt(raw, round) {
  return ROUND_RECORD.at(raw, round);
}

/**
 * The full round record to WRITE when patching some of its fields.
 *
 * @param {object|null} raw the stored `roundState`
 * @param {number|null} round now
 * @param {object} [patch] the fields being set
 * @returns {object} every field to write
 */
export function roundWrite(raw, round, patch = {}) {
  return ROUND_RECORD.write(raw, round, patch);
}

/**
 * Project the board.
 *
 * @param {object} args
 * @param {object} args.scene
 * @param {object[]} args.actors
 * @param {object} [args.settings]
 * @returns {object}
 */
/** The four the rulebook names (Ch. 29). Anything else reads as Intermediate. */
const DIFFICULTIES = Object.freeze(["beginner", "intermediate", "expert", "lunatic"]);

export function snapshotBoard({ scene, actors, settings = {} }) {
  // A banished Kagome Spirit is not on the board. *"That Kagome Spirit
  // DISAPPEARS for 1◈ Turns"* -- and `io.banish` only hid its token, so the
  // board went on reading it: it held its panel, guarded his Master, could be
  // targeted and could act (#180). The field keeps who is away until when
  // (`state.banished`), and `returnBanished` brings it back.
  const banished = new Set((settings.fields ?? []).flatMap((f) => Object.keys(f.state?.banished ?? {})));
  // A caller that has a canvas resolves each unit's panel first and passes the
  // finished snapshot; anything else is projected here.
  const units = actors.filter((a) => !banished.has(a.snapshot?.id ?? a.actor?.id ?? a.id)).map((a) => a.snapshot
    ?? snapshotUnit(a.actor ?? a, {
      token: a.token,
      tick: settings.tickForTurnState ?? null,
      // Sustainability is authored as a ◈ expression and consumed as a number
      // of turns, so the projection needs the world's ◈ to resolve it.
      turnsPerRound: settings.turnsPerRound ?? 3,
      // Round-scale turn state is stale-by-reading like the per-Turn kind, so
      // the projection needs to know which Round it is looking at.
      round: settings.round ?? null,
    }));
  const board = {
    bounds: boundsFor(scene, settings),
    units,
    // `homeBaseZonesOf` (engine/board.mjs) computes this into `settings.zones`;
    // reading `scene.zones` instead -- a property no Scene document has -- meant
    // `board.zones` was always `{}`, so `ownBaseOf` (rules/environment.mjs),
    // `newlySeenBy` (rules/identity.mjs) and the `requiresRecipient: {zoneId}`
    // Aura path (rules/targeting/resolve.mjs) never saw a Home Base or a named
    // zone exist. Found live setting up a Home Base region to test Semiramis's
    // Hanging Gardens activation, which gates on `self:inHomeBase`.
    zones: settings.zones ?? {},
    alliances: settings.alliances ?? {},
    roundPhase: settings.phase ?? "day",
    // The `dayNightCycle` War Rule and the Round's override, for `roundPhase` (#314).
    dayNightCycleRule: settings.dayNightCycle ?? true,
    phaseOverride: settings.phaseOverride ?? null,
    // Whose Turn it is, as a BOARD fact (#28). The scheduler has carried this
    // on its own context as `activeFactionId` since it was written, but the
    // board never had it -- so a rules-layer gate asking "is it this Unit's
    // Turn" had nothing to read, and `rules/nameless-forest.mjs` asked exactly
    // that and silently answered yes for everybody.
    //
    // Named for the combat document's own `actingFactionId` getter, which is
    // the term `engine/movement-hooks.mjs`, `engine/budget.mjs` and
    // `rules/control.mjs` all already use.
    actingFactionId: settings.actingFactionId ?? null,
    // A Grand Order war, which spares allies from Hatred of Achilles (#190).
    grandOrder: Boolean(settings.grandOrder),
    round: settings.round ?? 1,
    turnsPerRound: settings.turnsPerRound ?? 3,
    tick: settings.tick ?? 0,
    region: settings.region ?? null,
    warRegion: settings.warRegion ?? null,
    // Normalized, not taken as given. The setting offered "standard" for the
    // whole of this system's life and `MatchData` never accepted it, so a
    // world that ran on the old vocabulary would otherwise carry a
    // difficulty no rule matches -- silently switching nothing off and
    // nothing on. Anything unrecognised reads as Intermediate, the schema's
    // own initial.
    difficulty: DIFFICULTIES.includes(settings.difficulty) ? settings.difficulty : "intermediate",
    // The war's shape, chosen once at setup and read for the rest of the
    // match -- the same argument `region` above carries.
    warType: settings.warType ?? "greatHolyGrailWar",
    ruleset: settings.ruleset ?? "advanced",
    drawPolicy: settings.drawPolicy ?? "duplicates",
    homeBaseDepth: settings.homeBaseDepth ?? 3,
    grail: settings.grail ?? null,
    fields: settings.fields ?? [],
    // The Scene Level ids that are pocket dimensions (#177).
    dimensionLevels: settings.dimensionLevels ?? [],
    // Each pocket dimension's Level and centre (#191 reading 3).
    dimensions: settings.dimensions ?? [],
    // `terrainAreasOf` (engine/board.mjs) computes this into `settings.terrain`,
    // exactly as `homeBaseZonesOf` does for `zones` immediately above -- and
    // this line read `scene.terrain`, a property no Scene document has, so
    // `board.terrain` was ALWAYS `{}` in a live world.
    //
    // The same bug as `zones`, in the same object, missed when that one was
    // fixed. Everything downstream is affected: `terrainAt` found no areas, so
    // every standing modifier, every periodic, `phaseAt` and the whole Ch. 26
    // catalogue answered for empty ground. A GM's hand-drawn terrain has never
    // done anything, and Ch. 46 has recorded terrain as **Done** throughout.
    //
    // Found live, painting Quetzalcoatl's `Sol`: the Region existed with 25
    // shapes and the right tag, and `phaseAt` reported Night standing in it.
    terrain: settings.terrain ?? scene?.terrain ?? {},
    // OPTIONAL RULES the table has switched off. A block rather than loose
    // fields, so the next one is a line of data instead of a new board
    // property every consumer has to learn about.
    //
    // Defaults are the rules as written: absence must never disable a rule,
    // because every board built before an entry existed has no value for it.
    rules: {
      masterProtection: settings.rules?.masterProtection ?? true,
      ...(settings.rules ?? {}),
    },
    // Seeded so a replayed combat picks the same random targets.
    seed: settings.seed ?? 0,
  };

  // ZON is a pairwise property, so it can only be settled once every unit is
  // projected. Done here, once per board, because the damage pipeline, the
  // targeting resolver and the canvas overlay all ask the same question.
  // Partner facts first, because `zonSatisfaction: "any"` is delivered by
  // unioning the group's members into `zonPartnerIds` -- which is the field
  // `annotateZon` reads on the very next line. Running these the other way
  // round would settle ZON against a partner list that did not exist yet.
  annotateLinkedGroups(units, board);
  // The legion count each body reads: the Master's pool, from the world
  // (`settings.legions`, `engine/board.mjs`), and who of it stands here.
  annotateLegions(units, settings.legions ?? {});
  // Items bound to their holder by another Unit (Avalon, #230): who, how far,
  // whether she still stands.
  annotateBonds(units);

  annotateZon(units, board, settings.zon ?? {});

  // What a Servant's Master's rank gives it. After `annotateZon`, because ZON
  // reads the rank through `zonRadius` and takes the Master snapshot directly
  // rather than this annotation.
  annotateMasterRank(units);

  // Who acts with each unit, and on whose Turn. Board-wide for the same reason
  // ZON is: a charm points at ANOTHER unit, so a unit projected alone cannot
  // answer either question. Before the positional passes because nothing
  // downstream of here depends on it and everything upstream of the movement
  // gate does.
  annotateControl(units, board);
  // Which allies stand on this board, by True Name and Attribute, and how far
  // (Gilles de Rais (Saber)'s Jeanne d'Arc and [Star] clauses, #260).
  annotateAllies(units, board);

  // Auras are the same shape of problem as ZON and get the same answer: a
  // property of the board, settled once every unit is projected. Doing it here
  // rather than per-unit is what stops the cycle in Ch. 08 -- every unit
  // is expanded against the same untouched board, so an aura cannot feed an
  // aura and the result does not depend on visit order.
  // Terrain, for the same reason and in the same place: it is positional, so
  // it can only be settled once every unit has a panel. Before auras, because
  // an aura's own modifiers should sit after the ground the unit stands on in
  // the explainer's reading order.
  annotateTerrain(units, board);
  // RE-COLLECT for anybody now standing in terrain.
  //
  // `contributionsOf` runs inside `snapshotUnit`, per actor, before this board
  // pass exists -- so a clause gated on `self:terrain:` was answered against an
  // option set that could not contain the answer, and was dropped for good.
  // Only units actually in terrain pay for this, which is nobody on open
  // ground.
  //
  // Nemo's *Poseidon's Protection* is the clause that found it: its 50/100
  // reduction is collected only while he is in water, and it never was.
  recollectForTerrain(units, actors, settings.tickForTurnState ?? null, settings.turnsPerRound ?? 3);
  // ...and for a twin, whose partner distance `annotateLinkedGroups` settled
  // above. *"If Castor is directly next to Pollux ... his Master's Health lost
  // ... are halved"* compiled against an option set with no distance in it, so
  // the drain was 20 beside Pollux too (#209, found live). Terrain units were
  // re-collected with the distance already.
  recollectForPartner(units, actors, settings.tickForTurnState ?? null, settings.turnsPerRound ?? 3);
  // Which platform each unit is aboard, and the protection model the targeting
  // resolver enforces. Positional, so it settles here with the other passes.
  //
  // BEFORE `annotateEnvironment`, because one of the Home Bases is a platform:
  // *"The HGoB counts as a second Home Base for Semiramis' Faction."*
  // `ownBaseOf` reads `unit.platformId`, which is written here — run the other
  // way round it read `undefined` for everybody and the clause was silently
  // dead. Measured live: Semiramis on the middle panel of her own garden,
  // `platformId` correctly stamped, `inHomeBase: false`.
  annotatePlatforms(units, board);
  // Bounded fields, and BEFORE `annotateEnvironment` for exactly the reason
  // `annotatePlatforms` is: one of the Home Bases is a FIELD. *"The Complex
  // functions as a second Home Base for Ozymandias and his Master only."*
  // `ownBaseOf` reads `board.fields` and each unit's membership, and this pass
  // is what settles membership -- run the other way round it reads an empty
  // list for everybody and the clause is silently dead, which is the third
  // time this ordering has bitten (platforms, then terrain, now fields).
  //
  // Nothing this pass needs comes from the two below it: interior rules are
  // addressed by relation and by kind, both of which `annotateControl` has
  // already settled.
  annotateFields(units, board);
  // A ZON a field waives whole, now that its interior is on the Units inside:
  // Wallachia's *"his Master's ZON is ignored"* (#330 ruling 29).
  waiveZon(units);
  // Day/Night and Home Base are facts about the FIELD, so they settle here for
  // the same reason terrain and auras do: a unit projected alone cannot know
  // which Round it is or whose ground it is standing on.
  annotateEnvironment(units, board);
  // The war's Region grants every Servant from it "+ to all Parameters"
  // (Ch. 29). Applied here rather than at setup so that changing the region
  // mid-configuration does not need every sheet rewritten.
  annotateRegionBonus(units, board);
  // ...and the one interior rule that takes something AWAY. Achilles's duel
  // negates "all buffs and debuffs that were caused by Units not involved" for
  // as long as it stands, so the projection is filtered after the fields have
  // said who is inside and before anything reads the effects back.
  for (const u of units) {
    const kept = withoutForeignEffects(u, u.effectInstances ?? [], board);
    if (kept.length === (u.effectInstances ?? []).length) continue;
    const gone = new Set((u.effectInstances ?? []).filter((e) => !kept.includes(e)).map((e) => e.id));
    u.effectInstances = kept;
    u.effects = kept.map((e) => e.defId);
    // ...and what those effects CONTRIBUTED. Filtering the list alone left
    // Karna's Atk Up adding +10% to Achilles's hit inside the duel (#184).
    // Every contribution an effect made is stamped with its instance
    // (`rules/elements.mjs#EFFECT_INSTANCE`).
    for (const [k, v] of Object.entries(u)) {
      if (!Array.isArray(v) || k === "effectInstances" || k === "effects") continue;
      if (!v.some((x) => x && typeof x === "object" && gone.has(x[EFFECT_INSTANCE]))) continue;
      u[k] = v.filter((x) => !(x && typeof x === "object" && gone.has(x[EFFECT_INSTANCE])));
    }
  }
  // Positional, like auras: it holds while somebody is standing nearby.
  annotateCompulsions(units, board);

  annotateLastOfSummonGroup(units);
  annotateSummonsActed(units);
  annotateSummoner(units);
  // Built here rather than cached across calls: `snapshotBoard` is where the
  // board's positions are already in hand, and an index built anywhere else
  // would need the invalidation table (Ch. 08) to keep it honest. The engine
  // holds a longer-lived one for the canvas; this is the resolution path, and
  // Ch. 08 requires that one to be synchronous and current.
  board.auraIndex = buildAuraIndex(board);
  annotateAuras(units, board, board.auraIndex);

  return board;
}

/**
 * Tell each unit which platform it is aboard, and give the board the
 * cross-level map its targeting resolver has always read.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void}
 */
/**
 * Re-run the contribution pass for units whose terrain is now known.
 *
 * A positional clause cannot be answered by the per-actor pass that runs before
 * any unit has been placed against the board's terrain areas. Deferring it is
 * not an option for defensive clauses -- see the note in `contributionsOf` --
 * so the pass is simply run again, for the few units it can change.
 *
 * Only the buckets a terrain-gated element can write are replaced; everything
 * already annotated onto the unit by earlier passes is left alone.
 *
 * @param {object[]} units
 * @param {object[]} actors
 * @returns {void}
 */
function recollectForTerrain(units, actors, tick = null, turnsPerRound = 3) {
  for (const u of units) {
    if ((u.terrain ?? []).length === 0) continue;
    // `actors` entries are `{actor, token, snapshot?}` wrappers, not Actors --
    // `currentBoard` hands finished snapshots through the same list. Matching
    // on the wrapper's own `id` found nothing at all, which is how this pass
    // came to run and change nothing.
    const entry = actors.find((a) => (a.actor ?? a)?.id === u.id) ?? null;
    const actor = entry?.actor ?? entry ?? null;
    if (!actor?.items) continue;

    const again = contributionsOf(actor, { terrain: u.terrain, tick, turnsPerRound, partnerDistance: u.partnerDistance ?? null, war: u.war ?? null });
    // The terrain pass has already pushed its own modifiers onto `u.modifiers`
    // (Waterside's element bonuses), so the re-collected list is merged rather
    // than assigned -- assigning would drop the ground the unit is standing on
    // in favour of what its abilities say about standing there.
    const fromTerrain = (u.terrainEffects?.modifiers ?? []);
    u.modifiers = [...again.modifiers, ...fromTerrain];
    u.damageNegation = again.damageNegation;
    u.eventHandlers = again.eventHandlers;
    u.suppressions = again.suppressions;
  }
}

/**
 * Re-run the contribution pass for a twin standing on open ground, now that its
 * partner distance is known.
 *
 * Only `eventHandlers` is replaced: the one clause that reads the distance at
 * compile time is a handler action's `tableFactor` (Mad Enhancement's drain,
 * its floor and its threshold). Magic Resistance's *"Castor also receives it"*
 * is an aura, settled on the board, and needs nothing here.
 *
 * @param {object[]} units
 * @param {object[]} actors
 * @param {number|null} [tick]
 * @returns {void}
 */
function recollectForPartner(units, actors, tick = null, turnsPerRound = 3) {
  for (const u of units) {
    if (typeof u.partnerDistance !== "number") continue;
    if ((u.terrain ?? []).length > 0) continue;
    // Only a twin whose compiled handlers ask the distance pays for the second
    // pass: Castor with Mad Enhancement on, today (#209 review).
    const asks = (u.eventHandlers ?? []).some((h) => (h.actions ?? []).some((a) =>
      (a.tableFactor?.predicate ?? []).some((p) => String(p).includes("withinOfPartner"))));
    if (!asks) continue;
    const entry = actors.find((a) => (a.actor ?? a)?.id === u.id) ?? null;
    const actor = entry?.actor ?? entry ?? null;
    if (!actor?.items) continue;
    u.eventHandlers = contributionsOf(actor, { tick, turnsPerRound, partnerDistance: u.partnerDistance, war: u.war ?? null }).eventHandlers;
  }
}

function annotatePlatforms(units, board) {
  // Aboard a POCKET DIMENSION, by Level: it has no token for the footprint test
  // below to find, so nobody inside carried its `platformId` (#178) and every
  // rule keyed on being aboard the Storm Border -- S.Crit Up's
  // `requiresRecipient: { platformContentId }` first -- reached nobody (#191).
  for (const u of units) {
    if (u.kind === "platform") continue;
    const dimension = (board?.dimensions ?? []).find((d) => d.levelId && d.levelId === u.levelId);
    if (!dimension) continue;
    u.platformId = dimension.id;
    u.platformContentId = dimension.contentId ?? null;
    // ...and what being inside it forbids: the Storm Border's `restrictions`,
    // *"Units within the Storm Border cannot use ... any ability that creates a
    // Unit/Item/object that has the 'Large' or 'Giant' Attribute"* (ruling R1).
    // Authored as rule elements and read by nobody, so a Giant-creating Noble
    // Phantasm was usable inside (#191). Run through the same executors every
    // other element is, and only their suppressions kept -- that is where
    // `rules/costs.mjs#forbiddenCreation` looks.
    for (const el of dimension.spec?.restrictions ?? []) {
      const run = EXECUTORS[el?.key];
      if (!run) continue;
      const out = empty();
      run(el, { source: "The Storm Border", out, rank: null, ctx: {} });
      u.suppressions = [...(u.suppressions ?? []), ...(out.suppressions ?? [])];
    }
  }

  const platforms = platformsOn(board);
  if (platforms.length === 0) return;

  for (const u of units) {
    if (u.kind === "platform") continue;
    // Never the ground (level 0). A platform that has not been given a level of
    // its own would otherwise claim every unit standing on the board, and
    // `self:onPlatform:<contentId>` would be true for all of them — including
    // Semiramis's opponents, and including the predicates her own Sikera Ušum
    // and Territory Creation branch on.
    const level = u.level ?? 0;
    const aboard = level === 0 ? null : platforms.find((p) => (p.level ?? 0) === level);
    if (aboard) {
      u.platformId = aboard.id;
      // The STABLE content id, not the world's random Foundry document id --
      // `self:onPlatform:<id>` (`rules/options.mjs`) is authored content, and
      // content cannot predicate on an id that only exists once a GM's world
      // has actually created one.
      u.platformContentId = aboard.contentId ?? null;
    }
  }

  // One Luck pool, hers: the platform's own number is never read (#162).
  for (const p of units) {
    const owner = luckOwnerOf(p, units);
    if (owner) p.luck = owner.luck;
  }
}

/**
 * Apply the war Region's parameter step.
 *
 * A **rank shift**, not a numeric delta, so it moves Base Attack by 10 per
 * step with it (Ch. 03) — the same rule a High Rank Master's grant
 * applies via `applyGrantedSteps` above, kept live here instead of baked into
 * the sheet, because *"changing the region mid-configuration does not need
 * every sheet rewritten"*.
 *
 * The statDelta this used to only RECORD and never apply — `u.parameters` kept
 * the written Rank regardless of the Region, so a Servant fielded in a war
 * fought in its own Region got the trace entry and nothing else. Both
 * `u.parameters` and `u.baseAttack` are mutated directly here, the same way
 * `applyGrantedSteps` mutates the projection rather than the source document.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void}
 */
function annotateRegionBonus(units, board) {
  const warRegion = board.warRegion ?? null;
  if (!warRegion) return;
  for (const u of units) applyRegionBonus(u, warRegion);
}

/**
 * Apply the war Region's step to ONE unit, at most once.
 *
 * The guard is the point. `snapshotBoard` accepts a snapshot a caller already
 * projected — that is how `engine/board.mjs#unitSnapshot` gets the Region onto
 * the actor SHEET, which has no board to run a pass over — and without the
 * flag the board pass then shifted the same Ranks a second time. A Servant
 * fielded in her own Region read one thing on her sheet and another on the
 * board, and her Base Attack carried the Region's +10 twice.
 *
 * Idempotence rather than "only one caller may do it" because both callers are
 * legitimate: the sheet needs it before any board exists, and the board needs
 * it for units nobody pre-projected.
 *
 * @param {object} unit
 * @param {string|null} warRegion
 * @returns {object} the same unit, mutated
 */
/**
 * Fold every Base Attack multiplier into the projection.
 *
 * Kiritsugu's Mystery Bisection is the only source: *"the Unit's Base Attack
 * (both STR and MAG) are reduced by half of their original value."*
 *
 * **In the projection, not in damage pipeline stage 1.** Stage 1 reads
 * `unit.baseAttack[src.component]` — the one component the current attack uses
 * — so a hook there would never apply the MAG half against a STR attacker, and
 * would pass every single-attack test while being half wrong. Here, the
 * pipeline reads the snapshot and gets both for free, and
 * `present.mjs#baseAttackTiles` renders written-against-effective so the marked
 * Unit's own sheet shows `175 → 87`. For a mark that is permanent and
 * unremovable, being legible is most of the point.
 *
 * Idempotent, with the same guard and for the same reason as
 * `applyRegionBonus`: two callers legitimately project the same unit — the
 * actor sheet before any board exists, and the board pass for units nobody
 * pre-projected — and without the flag a marked Servant would be halved twice.
 * The sheet says so outright too: *"half of their ORIGINAL value"*, and *"the
 * 'Kiritsugu' debuff does not stack."*
 *
 * Runs AFTER `applyRegionBonus`, because the Region's ±10 is part of the
 * original value the mark halves.
 *
 * @param {object} unit
 * @returns {object} the same unit, mutated
 */
export function applyBaseAttackModifiers(unit) {
  const mods = unit?.baseAttackModifiers ?? [];
  if (mods.length === 0 || unit.baseAttackModifiersApplied) return unit;

  for (const m of mods) {
    for (const c of m.components ?? []) {
      if (typeof unit.baseAttack?.[c] !== "number") continue;
      const before = unit.baseAttack[c];
      unit.baseAttack[c] = Math.floor(before * (m.factor ?? 1)) + (m.add ?? 0);
      // What a Noble Phantasm gives back: the Blade's +50 is not its (#247
      // reading 12). Read by stage 1 of the pipeline for an NP's own Base Attack.
      if (m.exceptNP) {
        unit.npBaseAttackOffset = { ...(unit.npBaseAttackOffset ?? {}) };
        unit.npBaseAttackOffset[c] = (unit.npBaseAttackOffset[c] ?? 0) + before - unit.baseAttack[c];
      }
    }
  }
  unit.baseAttackModifiersApplied = true;
  return unit;
}

export function applyRegionBonus(unit, warRegion) {
  if (!warRegion || !unit || unit.regionBonusApplied) return unit;
  const steps = regionBonusFor(unit, warRegion);
  if (steps === 0) return unit;

  for (const p of ["str", "end", "agi", "mag", "luc"]) {
    if (!unit.parameters?.[p]) continue;
    unit.parameters[p] = unit.parameters[p].step(steps);
  }
  const ba = baseAttackAdjustment({ str: steps, mag: steps });
  unit.baseAttack = { str: unit.baseAttack.str + ba.str, mag: unit.baseAttack.mag + ba.mag };

  unit.statDeltas = [
    ...(unit.statDeltas ?? []),
    ...["str", "end", "agi", "mag", "luc"].map((p) => ({
      stat: `parameters.${p}`, rankShift: steps, target: "self",
      source: `Region: ${warRegion}`,
    })),
  ];
  unit.regionBonusApplied = true;
  return unit;
}

/**
 * What a Servant's Master's rank gives it, and the tier every predicate reads.
 *
 * A board pass rather than a per-unit projection because it needs the OTHER
 * unit: *"High Rank Masters: +1◈ while alive"* (Ch. 06, Ch. 32) turns on
 * whether the Master is still standing, and only the board knows that. The
 * bonus therefore lapses at the same instant the Free-Servant clock starts,
 * which is what the two rules together describe.
 *
 * `masterTier` is recorded on every unit — on a Master it is its own tier —
 * because `rules/options.mjs` emits it as a predicate and Jack's Mist exempts a
 * High Rank Master from its contact Poison.
 *
 * @param {object[]} units
 * @returns {void}
 */
function annotateMasterRank(units) {
  for (const u of units) {
    if (u.kind === "master") {
      u.masterTier = tierOf({ rank: u.rank });
      continue;
    }
    const master = u.masterId ? units.find((m) => m.id === u.masterId) : null;
    u.masterTier = master ? tierOf({ rank: master.rank }) : null;
    // Unbound, derived from its Master's pools and never stored (Ch. 33): the
    // Contract rule reads it. A separate flag, not `contract: "unbound"`: the
    // readers of that word price an NP and run a clock as for a Free Servant,
    // and an Unbound Servant's Master still pays and still stands (#241, live:
    // no Unbound Servant could ever be contracted).
    u.unbound = Boolean(master) && u.kind === "servant" && isUnbound(master, u.legionKey || u.id);
    // The High Rank's +1◈ Sustainability is NOT added here: it was +1 Turn,
    // only while the Master lived, so no Free clock ever saw it. It is added at
    // the Master's death, to the clock that death starts (#241 reading 4,
    // `relationships.mjs#onMasterDefeated`).
  }
}

/**
 * Give every unit what the Round and the ground it stands on do to it.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void}
 */
function annotateEnvironment(units, board) {
  // The opening coin flip, read from the match. `board.startedAtDay` had ONE
  // reader — this line — and no writer anywhere in the system, so every Round
  // this game has ever played was Day on the odd ones regardless of what the
  // match said. `MatchData.phase` has carried `day|night|none` since the
  // schema was written with nothing consuming it; it is the flip's result, so
  // it is what seeds the alternation.
  //
  // `none` is the sheet's *"playing without Day-Night cycle"*: not a third
  // lighting condition but the absence of the axis, which is why it is
  // reported as-is rather than resolved to one of the two.
  //
  // Asked of `roundPhase`, the one deriver: it also knows the `dayNightCycle`
  // War Rule and a `setRoundPhase` override for the Round in progress (#314).
  board.phase = roundPhase({
    round: board.round ?? 1, opening: board.roundPhase ?? "day",
    cycle: board.dayNightCycleRule !== false, override: board.phaseOverride ?? null,
  });
  board.dayNightCycle = board.phase !== "none";
  for (const u of units) {
    // Recorded on the unit as well as folded into modifiers: Medea's Territory
    // Creation predicates on it, and a predicate cannot read a modifier list.
    u.inHomeBase = inOwnHomeBase(u, board);
    // `phaseAt(u.panel)`, not `board.phase`: a Dark unit standing inside
    // Quetzalcoatl's `Sol` is in daylight while the rest of the board is at
    // Night (Ch. 26). Reading it at this unit's OWN panel satisfies decision Q43
    // in both directions at once -- `darkModifiers` returns a dealt modifier
    // and a taken one, and Q43 wants the attacker's panel for the first and the
    // defender's for the second, which for this unit is the same panel.
    // The phase AT THIS UNIT'S PANEL, recorded so a predicate can ask. There
    // was no day/night roll option at all, so Ozymandias's *"If used during a
    // Day Round"* clauses could not be written -- and per panel rather than per
    // Round for the same reason `darkModifiers` reads it that way below: a unit
    // inside Quetzalcoatl's `Sol`, or inside Pyramid Drop's own daylight, is in
    // Day while the Round is Night.
    u.phase = board.dayNightCycle ? phaseAt(u.panel, board) : "none";
    u.war = { region: board.warRegion ?? null, phase: board.phase };
    const mods = [...darkModifiers(u, u.phase), ...homeBaseModifiers(u, board)];
    if (mods.length > 0) u.modifiers = [...(u.modifiers ?? []), ...mods];
  }
}

/**
 * The board's panel bounds.
 *
 * The rules say 13x13 or 25x25 and the setting says which, but the *scene* is
 * what the tokens are standing on: a 20x20 scene with `boardSize` left at 13
 * clips every panel past row 12 out of every shape, so a unit placed in the
 * lower half of the map becomes untargetable with no error anywhere. The scene
 * wins when it can answer, and the setting is the fallback.
 *
 * @param {object|null} scene
 * @param {object} settings
 * @returns {import("../domain/geometry.mjs").Bounds}
 */
function boundsFor(scene, settings) {
  const rows = scene?.dimensions?.rows ?? null;
  const columns = scene?.dimensions?.columns ?? null;
  if (Number.isFinite(rows) && Number.isFinite(columns) && rows > 0 && columns > 0) {
    return { iMin: 0, jMin: 0, iMax: Math.round(rows) - 1, jMax: Math.round(columns) - 1 };
  }
  const size = settings.boardSize ?? 13;
  return { iMin: 0, jMin: 0, iMax: size - 1, jMax: size - 1 };
}

/* -------------------------------------------------------------------------- */

/**
 * The grid spaces a token occupies, as `{i, j}` offsets.
 *
 * A token's `x`/`y` are **pixels**. Converting them needs the scene's grid,
 * which this layer may not touch — so the caller passes `panel`, or the token
 * document converts for itself through `getOccupiedGridSpaceOffsets`, which
 * also handles a multi-panel unit's whole footprint.
 *
 * @param {object|null} doc a `TokenDocument`
 * @param {object|null} explicit a panel the caller already resolved
 * @returns {Array<{i: number, j: number, k?: number}>} never empty
 */
function gridFootprint(doc, explicit) {
  if (explicit) return [explicit];

  if (typeof doc?.getOccupiedGridSpaceOffsets === "function") {
    const offsets = doc.getOccupiedGridSpaceOffsets();
    // One entry per PANEL. A v14 token has a depth, and a 4x3 platform of
    // depth 3 reports 36 offsets: each panel once per elevation layer (k 20,
    // 21, 22). Every reader compares `i`/`j`, so the Golden Hind stood on each
    // of its panels three times (#187). The lowest layer is kept, which is the
    // one `level` is read from.
    if (offsets?.length) {
      const seen = new Map();
      for (const o of offsets) {
        const key = `${o.i},${o.j}`;
        const prior = seen.get(key);
        if (!prior || (o.k ?? 0) < (prior.k ?? 0)) seen.set(key, { i: o.i, j: o.j, k: o.k });
      }
      return [...seen.values()];
    }
  }

  // No token, or a gridless scene. `{0, 0}` is wrong for anything on a board,
  // which is why every caller that has a canvas resolves the panel first.
  return [{ i: 0, j: 0 }];
}

/**
 * @param {object} raw
 * @returns {Record<string, Rank|null>}
 */
function parseParameters(raw) {
  /** @type {Record<string, Rank|null>} */
  const out = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    out[key] = Rank.parseOrNull(value);
  }
  return out;
}

/**
 * Shift parsed parameters by a High Rank Master's grant (Ch. 03).
 *
 * `system.grantedSteps` was, until now, read only by `baseAttackAdjustment`
 * at summon time -- the Parameter itself kept its written Rank forever, so a
 * Servant granted a STR step got +10 Base Attack and nothing else: every Rank
 * comparison (Magic Resistance, the damage table rows, `Rank.gte` gates) saw
 * the unmodified Rank. `system.parameters` is left untouched -- it is still
 * "what the Servant was written with", exactly as the sheet's parameter tile
 * needs it to be -- and only this projection's copy moves.
 *
 * @param {Record<string, Rank|null>} parameters
 * @param {Record<string, number>} [grantedSteps]
 * @returns {Record<string, Rank|null>}
 */
function applyGrantedSteps(parameters, grantedSteps) {
  if (!grantedSteps) return parameters;
  const out = { ...parameters };
  for (const [key, steps] of Object.entries(grantedSteps)) {
    if (!steps || !out[key]) continue;
    out[key] = out[key].step(steps);
  }
  return out;
}

/**
 * Trace entries explaining a Master grant's Rank shift, in the same shape
 * `annotateRegionBonus` produces for the Region's.
 *
 * @param {Record<string, number>} [grantedSteps]
 * @returns {object[]}
 */
function grantedStepDeltas(grantedSteps) {
  return Object.entries(grantedSteps ?? {})
    .filter(([, steps]) => steps)
    .map(([key, steps]) => ({
      stat: `parameters.${key}`, rankShift: steps, target: "self",
      source: "High Rank Master grant",
    }));
}

/**
 * Active, unsuppressed effect ids. Suppressed effects are deliberately absent
 * rather than flagged: every consumer wants "what is in force", and a consumer
 * that wants the full list can read `effectInstances`.
 * @param {object} actor
 * @returns {string[]}
 */
function activeEffectIds(actor) {
  const live = fgtEffects(actor)
    .filter((e) => !e.disabled && !e.isSuppressed)
    .map((e) => e.system.defId);

  // Petrify: *"Buffs, debuffs and other effects have no effect."* A blanket
  // negation that has to be answered HERE rather than by a rule element,
  // because it decides what the projection contains and rule elements are
  // collected from the projection -- the same argument `undamageable` made for
  // being a flag rather than a rule.
  //
  // Blanket effects do not negate each other: two of them are both in force,
  // and neither the corpus nor Appendix A describes a precedence between them.
  const blanket = live.filter((id) => EffectRegistry.get(id)?.suppressesOtherEffects);
  return blanket.length > 0 ? blanket : live;
}

/**
 * The actor's F/GT effects: the ones that name a definition.
 *
 * A core status is an ActiveEffect too -- the defeat skull is one (#96) -- and
 * it names no `defId`. These readers fell back to its `name`, so it would have
 * arrived as an effect called "Defeated" in every list, cure and sheet.
 *
 * @param {object} actor
 * @returns {object[]}
 */
function fgtEffects(actor) {
  return [...(actor.effects ?? [])].filter((e) => Boolean(e.system?.defId));
}

/**
 * @param {object} actor
 * @returns {object[]}
 */
function effectInstances(actor) {
  return fgtEffects(actor)
    .filter((e) => !e.disabled)
    .map((e) => {
      const defId = e.system.defId;
      const def = EffectRegistry.get(defId) ?? null;
      return {
      id: e.id,
      defId,
      // What every removal rule in the system asks about an instance, and what
      // none of them was ever told. `rules/environment.mjs#endOfRoundHomeBase`
      // skips `e.unremovable` and anything whose `e.polarity` is not `debuff`;
      // `rules/removal.mjs` and `rules/effect-flow.mjs` ask the same two
      // questions. Neither field was projected, so both guards read `undefined`
      // and neither could ever fire: the Home Base's three-Round cure took
      // **every effect a resident carried**, buffs and unremovable statuses
      // included.
      //
      // Found live (§46.4-BC): Semiramis aboard her own Hanging Gardens — which
      // counts as her Faction's second Home Base — lost `hgob-owner-buff`, an
      // `unremovable: true`, `polarity: status` effect with no expiry, three
      // Rounds after activating it. Her Parameters, Health, Base Attack, MOV,
      // Agility and Luck all fell back to their unbuffed values in silence.
      //
      // The instance's own flag wins over the definition's: an effect can be
      // applied as unremovable by the intent that lands it (the owner buff is),
      // where the definition says nothing.
      unremovable: Boolean(e.system?.unremovable ?? def?.unremovable),
      // What it LANDED as (`rules/effect-instance.mjs`, #315).
      polarity: polarityOf(e.system, def),
      magnitude: e.system?.magnitude ?? 0,
      // When it landed and how far it has decayed, for `magnitudeOf` (#296).
      appliedTick: e.system?.appliedTick ?? null,
      decayCount: e.system?.decayCount ?? 0,
      stage: e.system?.stage ?? 0,
      uses: e.system?.uses ?? 0,
      expiry: e.system?.expiry ?? null,
      sourceUnitId: e.system?.sourceUnitId ?? null,
      sourceAbilityId: e.system?.sourceAbilityId ?? null,
      // What `annotateFields`' sweep reads. Declared on `EffectData` and
      // projected here, because a field-tied effect that the board cannot see
      // as field-tied is an ordinary permanent debuff.
      sourceFieldId: e.system?.sourceFieldId ?? null,
      // What `annotateTerrain`'s sweep reads, for the same reason (#147).
      sourceTerrain: e.system?.sourceTerrain ?? null,
      // What `fireEvent` removes it on, for an `until <event>` duration.
      endsOn: e.system?.endsOn ?? null,
      // Deferred disclosure. Projected because the periodic tick has to know
      // that this instance's damage is not to be attributed -- the tally it
      // feeds is the "total Poison Damage taken" Serenity's sheet reveals when
      // her concealment ends.
      visibility: e.system?.visibility ?? "public",
      attributionHidden: Boolean(e.system?.attributionHidden),
      // A granted Presence Concealment's own Rank and Evade (#249).
      params: e.system?.params ?? null,
      suppressed: Boolean(e.isSuppressed),
      };
    });
}

/**
 * Run every rule element the actor owns and collect what it contributes.
 *
 * This is where a `{key: "FlatDamage", table: "divinity"}` on a compendium
 * document becomes `+50` in the damage pipeline. Before this existed the
 * content loaded and did nothing.
 *
 * Predicates that depend on the *attack* cannot be evaluated here — the attack
 * is not known yet — so they are carried through on the modifier and evaluated
 * inside the pipeline. Predicates that depend only on the unit's own state are
 * evaluated now.
 *
/**
 * What is left of a Unit's Sustainability, in turns.
 *
 * `null` means the clock does not exist at all — Independent Action A+/EX —
 * and is emphatically not "a very large number" (Ch. 32).
 *
 * The stored `sustainability` is the authored MAXIMUM as a ◈ expression;
 * `sustainabilityRemaining` is what is left. A Servant summoned before the
 * second field existed has `null` there and falls back to a full clock, which
 * is the right answer for a Servant nobody has charged yet.
 *
 * @param {object} sys the actor's system data
 * @param {number} turnsPerRound
 * @returns {number|null}
 */
function sustainabilityTurns(sys, turnsPerRound) {
  const authored = sys?.sustainability ?? null;
  if (authored === null || authored === undefined) return null;

  if (typeof sys.sustainabilityRemaining === "number") return sys.sustainabilityRemaining;

  try {
    return resolveTicks(parseTick(authored), { turnsPerRound });
  } catch {
    // A malformed expression must not take the whole board snapshot down; the
    // content validator is where a bad tick is supposed to be loud.
    return null;
  }
}

/**
 * Substitute an instance reference, with an optional leading minus.
 *
 * `"-@magnitude"` is what an effect needs when its magnitude is authored
 * positive -- as every magnitude on a sheet is -- and its reader sums rather
 * than subtracts. `Crit Dwn` is the case: it shares the `check: crit` channel
 * with `Crit Up`, so "reduced by 25%" has to arrive as `-25`.
 *
 * An exact-match substitution could not express that, and the alternative --
 * authoring the magnitude negative on the effect -- would show "-25" wherever
 * the sheet says 25.
 *
 * @param {unknown} raw
 * @param {string} ref
 * @param {number|undefined} value
 * @returns {unknown}
 */
function instanceValue(raw, ref, value) {
  if (raw === ref) return value ?? 0;
  if (raw === `-${ref}`) return -(value ?? 0);
  return raw;
}

/**
 * Resolve one effect rule's `@magnitude`/`@npMagnitude` against its instance.
 *
 * An `Aura` comes in two shapes and only one of them used to work. The FLAT
 * form puts its payload on the rule itself (`modifierKey` + `value`), which is
 * what Charisma uses; the NESTED form carries an `elements:` list, which is
 * what Item Construction and Area CritUp use. Resolution read `rule.value`
 * alone, so a nested element kept the literal string `"@magnitude"` and the
 * aura reached every correct recipient carrying a value that was never a
 * number.
 *
 * One level of nesting, deliberately: `elements` is the only nested carrier in
 * the grammar, and a general deep walk would start rewriting predicates and
 * effect ids that merely happen to contain the same text.
 *
 * @param {object} rule
 * @param {number|undefined} magnitude
 * @param {number|null|undefined} npMagnitude
 * @returns {object}
 */
/**
 * The handler a definition's event `decay` makes (#296): Merlin's Crit DmUp
 * (Illusion), *"loses 5% per successful Crit"*, is `decay: {on: damageDealt,
 * when: [attack:crit], by: 5}`, and each such event counts once
 * (`scheduler.mjs` `DecayEffect`). A `decay: {on: turn}` makes none: its
 * magnitude is read off the clock.
 *
 * @param {object} def
 * @returns {object[]}
 */
function decayHandlers(def) {
  const decay = def?.decay ?? null;
  if (!decay?.on || decay.on === "turn") return [];
  return [{
    key: "OnEvent", event: decay.on, automatic: true,
    ...(Array.isArray(decay.when) && decay.when.length ? { predicate: [...decay.when] } : {}),
    then: [{ key: "DecayEffect" }],
  }];
}

/**
 * An instance's magnitude, now, asked of `magnitudeOf`. Its definition's default
 * stands in when it states none: Regen is the one definition with a default (10,
 * #234 reading 6), and an instance landed before it had one carries 0. A Regen
 * of 0% heals nothing, so a 0 there reads as "none stated".
 *
 * @param {object} effect the ActiveEffect
 * @param {object} def its definition
 * @param {{tick?: number|null, turnsPerRound?: number}} [now]
 * @returns {number}
 */
function instanceMagnitude(effect, def, now = {}) {
  // Asked of the one reader, which also knows a magnitude that falls while the
  // Effect stands (`decay`, #296): Tomoe's Nightowl by the ◈ Turn, Merlin's
  // Illusion by the Crit.
  return magnitudeOf({
    magnitude: effect.system?.magnitude,
    appliedTick: effect.system?.appliedTick ?? null,
    decayCount: effect.system?.decayCount ?? 0,
  }, def, now);
}

export function resolveRuleValues(rule, magnitude, npMagnitude) {
  const mine = (raw) => instanceValue(raw, "@magnitude", magnitude ?? 0);

  /**
   * The fields that may name the instance and are NOT `value`, substituted
   * only where they exist.
   *
   * A magnitude is not always a modifier's size. Appendix A's on-hit riders put
   * it on a CHANCE — `Bleed Atk` is *"Normal Attacks have an X% chance of
   * inflicting Bleed"*, authored `effect: { id: bleed, chance: "@magnitude" }`
   * — and `Terror` puts it on the chance of the Stun in its `then` list. Both
   * kept the literal string `"@magnitude"` all the way to the scheduler, which
   * gates on a number and refuses what it cannot read. Measured live with the
   * chance staged to **100**: the `damageDealt` event fired, the handler was
   * present with its `attack:kind:normal` predicate satisfied, and `fireEvent`
   * returned a log entry and no intent at all. Both riders were inert, and the
   * comment on `fireDamageDealt` names the family it was raised for.
   *
   * @param {object} node
   * @returns {object}
   */
  const carriers = (node) => {
    const out = { ...node };
    if (node.chance !== undefined) out.chance = mine(node.chance);
    // The effect an action applies states its own chance and magnitude, and
    // both may name the instance that is applying it.
    if (node.effect && typeof node.effect === "object") {
      out.effect = { ...node.effect };
      if (node.effect.chance !== undefined) out.effect.chance = mine(node.effect.chance);
      if (node.effect.magnitude !== undefined) out.effect.magnitude = mine(node.effect.magnitude);
    }
    // A `RevivalSource` states how much it restores, and `Guts` makes that the
    // instance's own size -- `restore: { percentOfMax: "@magnitude" }`. Left as
    // authored the literal string reached the executor, resolved to nothing
    // against the unit's refs and became 0%: every Guts spent itself and
    // defeated its bearer (#128). A named carrier, copied before it is touched.
    if (node.restore && typeof node.restore === "object" && node.restore.percentOfMax !== undefined) {
      out.restore = { ...node.restore, percentOfMax: mine(node.restore.percentOfMax) };
    }
    // ...or Health itself, `gutsHealth`'s `restore: { amount: "@magnitude" }` (#347).
    if (node.restore && typeof node.restore === "object" && node.restore.amount !== undefined) {
      out.restore = { ...(out.restore ?? node.restore), amount: mine(node.restore.amount) };
    }
    // A `Heal` action's percent may be the instance's too: Regen is *"restored
    // by X% of its maximum"*, 15 on Arjuna's Awarded Hero and 5 on Van Gogh's
    // (#234 reading 6). Left as authored, the string reached `Heal`, which
    // reads a number, and healed nothing.
    if (node.percentOfMax !== undefined) out.percentOfMax = mine(node.percentOfMax);
    return out;
  };

  const one = (node) => carriers({
    ...node,
    value: instanceValue(node.value, "@magnitude", magnitude ?? 0),
    // An instance with no NP figure has no reduced one: the sheet stated a
    // single number, and it holds against a Noble Phantasm too (Scáthach #204
    // reading 5). Read as 0 it made Def Dwn 25% add nothing to an NP on eight
    // Servants. `undefined` lets every reader fall back to `value`; the crit
    // reader still treats a missing NP figure as none (#131).
    npValue: npMagnitude === null || npMagnitude === undefined
      ? (typeof node.npValue === "string" && node.npValue.endsWith("@npMagnitude") ? undefined : node.npValue)
      : instanceValue(node.npValue, "@npMagnitude", npMagnitude),
  });

  const out = one(rule);
  // Only when there is something to descend into -- `one` would otherwise
  // stamp `value: 0` onto a rule that never carried one.
  if (Array.isArray(rule.elements)) out.elements = rule.elements.map(one);
  // `then` is an `OnEvent`'s action list, and `carriers` alone rather than
  // `one`: an action is not a rule element and has no `value` of its own to
  // stamp a zero onto.
  if (Array.isArray(rule.then)) out.then = rule.then.map(carriers);
  return out;
}

/**
 * What the rule collector is handed for one Ability: the Item as the executors
 * read it, in one place.
 *
 * Two callers build this record -- the Unit's own collection (`contributionsOf`)
 * and an Attack's window abilities (`engine/attack.mjs#windowAugmented`) -- and
 * they wrote it by hand twice. The first copy dropped `contentId`, so a flat
 * bonus always carried `sourceContentId: null` and another bonus's `supersedes`
 * had nothing to match: Piedra Del Sol stacked its +180 on Goddess's Divine
 * Core's +120 instead of replacing it (#126, which #103's test missed by
 * handing `contentId` in).
 *
 * @param {object} item
 * @param {object} [overrides] fields the caller states instead of the Item's own
 * @returns {object}
 */
export function abilityRecordOf(item, overrides = {}) {
  return {
    id: item.id,
    name: item.name,
    // The stable machine name. Without it a cross-ability reference has only
    // the Foundry document id to match on, which content cannot know --
    // Goddess of War's "Divinity Rank is increased from B to A" names
    // `divinity` and matched nothing.
    slug: item.system?.slug ?? item.id,
    // The content id, which is what `supersedes` names and what a flat bonus
    // stamps as its `sourceContentId`.
    contentId: item.system?.contentId ?? null,
    rank: item.system?.rank ?? null,
    // The text its sheet prints, for a rule whose effect the War's Classic or
    // Revised pick decides (`domain/revisions.mjs`, #260 reading 3).
    printedRevision: item.system?.printedRevision ?? null,
    // A mode's activeRules apply only while it is switched on. This defaulted
    // to `true` while `active` was a field the DataModel silently dropped,
    // which quietly applied every mode's active clauses at all times.
    active: Boolean(item.system?.active),
    rules: item.system?.rules ?? [],
    passiveRules: item.system?.passiveRules ?? [],
    activeRules: item.system?.activeRules ?? [],
    // The War it exists in (#314): `collectContributions` ANDs it into every rule.
    availableWhen: [...(item.system?.availableWhen ?? [])],
    ...overrides,
  };
}

/**
 * @param {object} actor
 * @returns {object}
 */
/**
 * A Unit's Attributes, closed: the one reader the board and its own passives'
 * gates share.
 *
 * A form or variant that names Attributes REPLACES the set, and nothing is
 * derived beside it: the Gigantic Horror is exactly *"Dark (Outsider), Large"*,
 * where a Caster's closure would add Magus (#323 reading 11c, live).
 *
 * @param {object} actor
 * @param {{contributed?: string[], removed?: string[], override?: string[]|null}} [args]
 *   `override` defaults to the actor's form's own
 * @returns {string[]}
 */
export function attributesOf(actor, { contributed = [], removed = [], override = formOverrides(actor)?.attributes ?? null } = {}) {
  const sys = actor?.system ?? {};
  const withheld = [...(sys.withheldAttributes ?? [])];
  if (override) return closeAttributes([...override], null, { withheld });
  const closed = closeAttributes([...(sys.attributes ?? []), ...contributed], {
    kind: actor?.type, servantClasses: sys.servantClasses ?? [], normalAttack: sys.normalAttack ?? null,
  }, { withheld });
  // Taken away AFTER the closure, or an implication would put it back.
  return removed.length ? closed.filter((a) => !removed.includes(a)) : closed;
}

export function contributionsOf(actor, { terrain = [], tick = null, partnerDistance = null, war = null, turnsPerRound = 3 } = {}) {
  const sys = actor.system ?? {};
  const abilities = [...(actor.items ?? [])]
    .filter((item) => !negated(item, actor))
    // *"When Equipped, increase the Unit's Base Attack (STR) by 50…"*
    //
    // `equipped` has been on `EquipmentData` since it was written and the only
    // thing that read it was the actor sheet, which draws a checkbox. An Item's
    // rules were collected from the moment it was HELD.
    //
    // Nothing noticed because `[Semiramis' Poison]` is the only Item in the
    // corpus and carries no `rules` at all -- it is a consumable with a
    // `consumeEffect`. The Vorpal Blade is the first Item in this system that
    // does anything while worn, and every one of its five stat clauses opens
    // with "When Equipped".
    //
    // Gated on the item TYPE, not on every item: an ability has no `equipped`
    // field, and reading one off it would switch off every passive in the game.
    // ...or HELD, for an Item whose rules run while it is held: Avalon is placed
    // inside its holder, not worn (#230), and each of its rules names its holder.
    .filter((item) => item.type !== "equipment" || Boolean(item.system?.equipped) || Boolean(item.system?.worksWhenHeld))
    // An EXPENDED ability contributes nothing. Akhilleus Kosmos: *"After that,
    // Akhilleus Kosmos is broken; ALL ITS EFFECTS ARE LOST and cannot be used
    // for the rest of the game"* -- found live (#184): the barrier was spent and
    // his shove (`ignoresOccupancy`, `Knockback`) still walked him through
    // people. The war setup's unselected NP choice is the same word, and *"is
    // unusable"* does not leave its passives running either.
    .filter((item) => !item.system?.expended)
    // ...nor one a FORM took away (#323 reading 11f): the Gigantic Horror keeps
    // what the sheet names, and Territory Creation's passives go with the rest.
    .filter((item) => keptByForm(actor, item))
    // A Master's OWN Essence is its Servant's passive, never the Master's: its
    // rules reach the Servant through the copy the Servant holds
    // (`engine/master-essence.mjs`). Collected here, Pendant raised the Master's
    // own Magic Crest and Black Keys (R) its own Health (#241, live).
    .filter((item) => item.type !== "masterEssence" || Boolean(item.system?.grantedBy))
    // ...nor a Skill SUSPENDED by a Command Spell, until its span has passed.
    // `suspendedUntil` was read only for a Mode, which it also switches off; a
    // passive bought off the same way kept every rule running -- Hatred of
    // Achilles *"can be disabled for 1◈ Turns by spending one Command Spell"*
    // and its compulsion held on regardless (#190).
    .filter((item) => !(typeof item.system?.suspendedUntil === "number" && typeof tick === "number"
      && tick < item.system.suspendedUntil))
    .map((item) => {
      const record = abilityRecordOf(item);
      // A Mode's tally handler, among its active rules (#288).
      const tally = tallyHandler(item);
      return tally ? { ...record, activeRules: [...record.activeRules, tally] } : record;
    });

  // Rule elements authored directly on the unit -- a summon with no separate
  // ability item to carry them (Bašmu's Normal Attack rider), or a
  // Servant-level passive with no natural Item home (HGoB Construction's
  // round-end regen). One pseudo-ability, always active, so it collects
  // exactly like an ordinary passive class skill would.
  if ((sys.rules?.length ?? 0) + (sys.passiveRules?.length ?? 0) + (sys.activeRules?.length ?? 0) > 0) {
    abilities.push({
      id: actor.id, name: actor.name, slug: "self", rank: null, active: true,
      rules: sys.rules ?? [], passiveRules: sys.passiveRules ?? [], activeRules: sys.activeRules ?? [],
    });
  }

  // Effects on the actor carry rule elements too, and they are active by
  // definition -- an effect that is present is in force.
  const onceDefs = new Set();
  for (const effect of actor.effects ?? []) {
    if (effect.disabled || effect.isSuppressed) continue;
    // Resolved from the REGISTRY. This read `effect.system.def` -- a field
    // nothing has ever populated and which is not on the schema -- so the
    // collection below never ran, and every effect whose behaviour is expressed
    // as `rules:` did nothing at all. Medea's MOV Up granted no MOV and her
    // automatic evasion granted no evasion; both looked applied on the sheet.
    const def = EffectRegistry.get(effect.system?.defId) ?? null;
    // An event `decay` is a rule too, made from the definition (#296).
    if (!def?.rules?.length && !decayHandlers(def).length) continue;
    // Once per bearer, for a definition that scales its own rules by how many
    // instances there are (`perStack`): ten Proliferation stocks are ten
    // documents and one set of rules (#198 reading 8).
    if (def.rulesOncePerBearer) {
      if (onceDefs.has(def.id)) continue;
      onceDefs.add(def.id);
    }
    abilities.push({
      id: effect.id, name: effect.name, rank: null, active: true,
      // WHICH definition this is, and that it is an effect at all. A
      // `RevivalSource` from an effect is spent with `consumeUse` and one from
      // an ability with `recordUse`, and without this the executor could not
      // tell them apart -- so `Undying` revived Heracles and was never
      // consumed, which makes a one-use buff permanent.
      defId: effect.system?.defId ?? null,
      fromEffect: true,
      // What this instance was applied with (`params`): an Aura's reach among
      // them. Triumphal Return's S.Crit Up reaches 3 panels beside an allied
      // Jeanne d'Arc, 2 otherwise (#260 reading 7).
      params: effect.system?.params ?? null,
      // What an Aura it carries needs of its holder (#132): a buff's aura is
      // refused by a recipient with No Buff, and one cast's auras on two
      // holders reach a Unit once (`rules/auras.mjs`).
      polarity: polarityOf(effect.system, def),
      sourceUnitId: effect.system?.sourceUnitId ?? null,
      sourceAbilityId: effect.system?.sourceAbilityId ?? null,
      // WHEN this instance runs out, so a handler it contributes can honour
      // Ch. 15 ("an effect does not act on the Turn it ends") the way the
      // periodic pass already does. Carried here because the instance is the
      // only thing that knows: the definition has no clock, and the handler is
      // built from the definition's rules.
      expiry: effect.system?.expiry ?? null,
      // ...and when it ARRIVED, for a handler that must not act on the Turn it
      // was applied. Kingprotea's `NP DmUp (GAO)` is the only clause that
      // states it, and it is the exact mirror of the line above.
      appliedTick: effect.system?.appliedTick ?? null,
      // The INSTANCE's remaining charges. A count-limited effect's rule
      // elements have to know how many uses are left, or the consumer cannot
      // tell a spent Trofa from a fresh one.
      uses: effect.system?.uses ?? 0,
      // What a magnitude scale read live needs to resolve this instance again
      // (`readTimeScaled` below): the definition and the stamped magnitudes.
      scaleBasis: {
        def, magnitude: instanceMagnitude(effect, def, { tick, turnsPerRound }), npMagnitude: effect.system?.npMagnitude,
      },
      // "@magnitude" on an effect definition resolves against the instance,
      // and "-@magnitude" against its negation -- at the top level of a rule
      // AND inside an Aura's nested `elements`, which is where Area CritUp
      // puts its Crit Chance and where the resolution used not to reach.
      rules: [...def.rules, ...decayHandlers(def)].map((r) => resolveRuleValues(
        r, instanceMagnitude(effect, def, { tick, turnsPerRound }), effect.system?.npMagnitude,
      )),
    });
  }

  // Self-options, so an element can be gated on its own owner's state. It used
  // to be an EMPTY set, which made every `self:` predicate unsatisfiable --
  // Penthesilea's Charisma is "negated when Mad Enhancement is activated", and
  // that clause could never have fired.
  const options = rollOptionsFor({
    attacker: {
      kind: actor.type,
      // Spread for the same reason the unit snapshot spreads them: these are
      // SetFields, and every consumer downstream is entitled to an array.
      // `rollOptionsFor` only iterates today, so this is consistency rather
      // than a fix -- but the next reader who reaches for `.includes` should
      // not have to check.
      // Closed, for the same reason the unit projection above is: a predicate
      // naming `self:attribute:spirit` must see the same set the board does.
      attributes: attributesOf(actor),
      effects: [...(actor.effects ?? [])].map((e) => e.system?.defId).filter(Boolean),
      // The form it has taken, for a clause gated on it (#323).
      form: sys.formTaken ?? null,
      // ...and their FAMILIES, as the board projects them, so a `self:effectFamily:`
      // clause can be answered from the bearer's own contributions. Charisma is
      // *"negated if this Unit has Atk Up (Charisma)"*, asked by family (#230):
      // the collection asked a set with no family in it, and the aura never went off.
      effectFamilies: familiesPresent(
        [...(actor.effects ?? [])].filter((e) => !e.disabled && !e.isSuppressed).map((e) => e.system?.defId).filter(Boolean),
        EffectRegistry,
      ),
      region: formSheet(actor).region,
      // The War it stands in, so an ability's `availableWhen` and a `war:` clause
      // answer at collection (#314). Absent, `war:` options are simply not there.
      war,
      // Its Classes, so `self:class:` and `self:classGroup:` answer from its own
      // contributions as they do on the board (#286, #314).
      servantClasses: formSheet(actor).servantClasses,
      variant: sys.variant ?? null,
      // `self:free`, and the `self:rank:<parameter>:gte:<grade>` ladder. Both
      // emitters read a field this object did not carry, so both were
      // unsatisfiable from a unit's own contributions -- the same partial fix
      // the comment above describes, one layer further in. Jack the Ripper's
      // *"every time Jack kills a Human WHEN SHE IS A FREE SERVANT"* is named
      // in `options.mjs` as the clause `self:free` exists for, and it had never
      // once collected; Medusa's narrower version of it is the second.
      contract: sys.contract ?? null,
      parameters: formSheet(actor).parameters,
      // The stance, and the third entry in this comment's own list of fields
      // this object did not carry. Achilles's whole sheet is gated on it, so
      // without these two every "while Mounted" clause was unsatisfiable from
      // his own contributions: MOV stayed 7 while Mounted and Riding Attack was
      // never granted. Found live, on the first toggle.
      stance: sys.stance ?? "",
      stanceSpec: sys.stanceSpec ?? null,
      // ...and the Turn record, for `self:stance:mountedThisTurn`: Troias
      // Tragoidia's Master toll is "any Turn where Achilles Acts while
      // Mounted", and a Turn he Dismounted in had only the stance to go on
      // here, so it charged nothing (#184, found live). Read at the tick the
      // caller names and blank without one, so a record from an earlier Turn
      // cannot answer for this one.
      turnState: tick === null ? null : turnStateAt(sys.turnState, tick),
      // WHICH TERRAIN the bearer is standing in, threaded in by the board pass.
      //
      // The fourth entry in this comment's own list of fields this projection
      // did not carry, and it arrives the same way the other three did: a
      // clause that could never be satisfied from a Unit's own contributions.
      // Nemo's *Poseidon's Protection* is *"when Nemo is within a 'Waterside'
      // or 'Imaginary Numbers Space' area, all damage taken is reduced by 50;
      // if NP, 100"* -- collected against an option set with no terrain in it,
      // so the reduction was never collected at all.
      //
      // It cannot simply be DEFERRED like `self:inHomeBase`: this is a
      // `direction: taken` clause, and in the damage pipeline `self:` is the
      // ATTACKER -- so a deferred `self:terrain:waterside` would ask whether
      // whoever is hitting Nemo is standing in water. `rollNegation` does not
      // test predicates at all, so it would simply always apply.
      terrain: [...terrain],
      // How far the other twin stands, threaded in by the board pass like the
      // terrain above: `self:withinOfPartner:N` is a board fact, and Mad
      // Enhancement's drain halves on it when the rules compile (`tableFactor`).
      // `null` from `snapshotUnit`, which projects one actor and knows no
      // partner; `recollectForPartner` asks again once the board does (#209, live).
      partnerDistance,
      // What `rollOptionsFor` reads off an ability: its slug and whether it is on,
      // and -- for a Skill that COUNTS AS another -- the tags it is categorized
      // under, the Rank it holds them at and the effects that gate them. Without
      // those a `self:skill:divinity` clause was false from a Divine Core
      // holder's own contributions, as `target:skill:divinity` was on the board
      // (#125). The board's own `abilities` carry the same four (`collectAbilities`).
      abilities: [...(actor.items ?? [])].map((i) => ({
        id: i.id, slug: i.system?.slug ?? i.id, active: Boolean(i.system?.active),
        rank: i.system?.rank ?? null,
        categorizedAs: [...(i.system?.categorizedAs ?? [])],
        categorizedWhile: [...(i.system?.categorizedWhile ?? [])],
      })),
    },
    defender: null,
  });

  const collectOptions = {
    options,
    refs: expressionRefs(actor),
    // Rules this Unit has had switched off BY NAME and permanently -- the
    // Vorpal Blade taking the Jabberwock's lifesteal away. Written by the
    // `Suppress` action, carried home on `fieldSummonStats` when the summon
    // disappears, and applied again when it is re-summoned.
    suppressedScopes: [...(sys.suppressedScopes ?? [])],
    // How many of each effect the Unit holds, for `perStack` magnitudes
    // (`rules/elements.mjs`). Kingprotea's Proliferation is the reason it
    // exists and her NP DmUp (GAO) is the reason it counts two shapes.
    stacks: stacksHeld(actor),
  };
  return collectContributions(readTimeScaled(abilities, collectOptions), collectOptions);
}

/**
 * Resolve the held effects again under the magnitude scales read live.
 *
 * Arturia's Invisible Air halves Crit Dwn on her while it is active and
 * un-halves it when it is not (#230 reading 10). A stamped magnitude cannot
 * follow a mode, so a scale authored `timing: read` is asked of the Unit's own
 * rules -- by the one collector, over its abilities alone, because an effect's
 * rules cannot scale another effect -- and each held effect it names is
 * resolved again at the scaled magnitude. Rounded down, as the stamp is.
 *
 * Nothing to do, and no second collection, for a Unit with no such scale.
 *
 * @param {object[]} abilities the records, effects included
 * @param {object} collectOptions
 * @returns {object[]}
 */
function readTimeScaled(abilities, collectOptions) {
  const authorsOne = (a) => [a.rules, a.passiveRules, a.activeRules].some((list) =>
    (list ?? []).some((r) => r?.key === "EffectMagnitudeScale" && r.timing === "read"));
  if (!abilities.some((a) => !a.fromEffect && authorsOne(a))) return abilities;

  const scales = collectContributions(abilities.filter((a) => !a.fromEffect), collectOptions)
    .magnitudeScales.filter((s) => s.timing === "read" && (s.direction ?? "incoming") === "incoming");
  if (scales.length === 0) return abilities;

  return abilities.map((record) => {
    const basis = record.scaleBasis;
    if (!record.fromEffect || !basis) return record;
    const factor = scales
      .filter((s) => (s.effects ? s.effects.includes(basis.def.id) : Boolean(s.family) && s.family === basis.def.family))
      .reduce((f, s) => f * s.factor, 1);
    if (factor === 1) return record;
    const magnitude = Math.floor(basis.magnitude * factor);
    const npMagnitude = typeof basis.npMagnitude === "number" ? Math.floor(basis.npMagnitude * factor) : basis.npMagnitude;
    return { ...record, rules: basis.def.rules.map((r) => resolveRuleValues(r, magnitude, npMagnitude)) };
  });
}

/**
 * What an `@` expression resolves against (`rules/elements.mjs`).
 *
 * A facade rather than the raw document, so content can write
 * `@self.resources.fragarachTokens.value` -- the form Ch. 10 documents
 * and the form a unit SNAPSHOT already has -- instead of threading `.system`
 * through every path and being wrong on the projections that flatten it.
 *
 * Exported because the two places that resolve an authored magnitude are the
 * contribution pass and the effect-application phase, and a second, subtly
 * different facade in the second is how the same expression comes to mean two
 * numbers.
 *
 * @param {object} actor
 * @returns {object}
 */
export function expressionRefs(actor, extras = {}) {
  const sys = actor?.system ?? {};
  // Held out of the spread below: it parameterises the facade rather than
  // appearing in it, and `@tick` is not a path any content authors.
  const { tick = null, ...refs } = extras;
  return {
    // Values that do not exist until the action is under way. Troias Tragōidia
    // is the first to need any: *"X = the amount of remaining MOV Achilles has
    // divided by 2"* and *"Y = number of Units successfully hit by this NP"*
    // are both read AFTER the ride, so neither can come off the document.
    ...refs,
    self: {
      ...(extras.self ?? {}),
      document: actor,
      system: sys,
      resources: sys.resources ?? {},
      health: sys.health ?? null,
      // The AUTHORED maximum, before anything grew it. Kingprotea's
      // Proliferation pays *"20% of Kingprotea's original Max Health"* per
      // stock, and `health.max` is not that number once she has one.
      baseHealth: formSheet(actor).baseHealth,
      agility: sys.agility ?? null,
      luck: sys.luck ?? null,
      parameters: sys.parameters ?? {},
      // What is left of his allowance this Turn. Read here rather than
      // recomputed by each caller, so "remaining MOV" means the same thing to
      // a magnitude as it does to the movement planner -- which is what this
      // comment claimed while the line below it did the opposite twice over. It
      // subtracted a RAW `movedPanels`, so a Servant who walked seven panels on
      // tick 3 had no MOV left at tick 9, and it read a RAW `mov`, so Slow did
      // not halve it. Troias Tragōidia is *"remaining MOV divided by 2"*: both
      // errors land in an authored damage figure.
      //
      // `movement.mjs#remainingMovement` is the planner's own answer and this
      // is now a call to it. `rules/snapshot.mjs` may import `rules/movement.mjs`
      // -- nothing in `rules/` imports this file, so there is no cycle here; the
      // one that exists is `movement -> platforms`, and it never reached this far.
      //
      // TERRAIN is the half still missing. `effectiveMov` also reads
      // `terrainEffects.movDelta`, which `annotateTerrain` writes during
      // `snapshotBoard` -- so it is a property of where a Unit stands and cannot
      // be derived from its document. A caller holding a board snapshot should
      // override `self.remainingMov` through `extras`, the way a ride already does.
      // `extras.self` FIRST, so a caller holding facts the document cannot
      // carry can override it. That is how terrain has to arrive, and it is
      // what `engine/attack.mjs`'s ride comment has always said happens -- it
      // did not, twice over. This key sat below the spread above, so the
      // computed value won every time; and once that was righted, the ride
      // still passed nothing to override WITH -- its facts went to a top-level
      // `@ride` ref and `self` was never touched. A rider phase therefore read
      // the POST-ride allowance, which is zero for a full-MOV ride, because
      // `performRidingAttack` awaits its `markTurn` before the attack resolves.
      // Both halves are closed now; `authoredMagnitude` passes
      // `self: { remainingMov: ride.remainingMov }`.
      remainingMov: extras.self?.remainingMov ?? remainingMovement({
        mov: sys.mov ?? 0,
        effects: [...(actor?.effects ?? [])].map((e) => e.system?.defId).filter(Boolean),
        turnState: turnStateAt(sys.turnState, tick),
      }),
    },
  };
}

/**
 * @param {object} actor
 * @returns {object[]}
 */
/**
 * Is a mode inside its toggle lockout at this tick?
 *
 * @param {object} sys
 * @param {number|null} tick
 * @param {number} turnsPerRound
 * @returns {boolean}
 */
function lockedAt(sys, tick, turnsPerRound) {
  if (!sys?.toggleLock || sys.toggledAt === null || sys.toggledAt === undefined || typeof tick !== "number") return false;
  return tick - sys.toggledAt < resolveTicks(parseTick(sys.toggleLock), { turnsPerRound });
}

/**
 * The `healthRestoredSince` an ability states on itself, as `{fraction}`.
 *
 * @param {object[]|undefined} requirements
 * @returns {{fraction: number}|null}
 */
function restoreGateOf(requirements) {
  const req = (requirements ?? []).find((r) => r?.kind === "healthRestoredSince");
  return req ? { fraction: req.fraction ?? 0.5 } : null;
}

function collectAbilities(actor, { tick = null, turnsPerRound = 3, dropped = false } = {}) {
  return [...(actor.items ?? [])]
    .filter((i) => i.type === "ability" || i.type === "noblePhantasm")
    // One his summon roll never gave him is not his at all, kept or dropped (#347).
    .filter((i) => grantHeld(actor, i))
    .filter((i) => keptByForm(actor, i) !== dropped)
    .map((i) => ({
      id: i.id,
      name: i.name,
      isNP: i.type === "noblePhantasm",
      rank: Rank.parseOrNull(i.system?.rank),
      cooldownRemaining: i.system?.cooldown?.remaining ?? 0,
      // Its full length, for a Passive whose handler starts its own clock
      // (`scheduler.mjs#ownCooldownStart`, #328).
      cooldownMax: i.system?.cooldown?.max ?? null,
      regen: i.system?.cooldown?.regen ?? 0,
      categorizedAsNP: Boolean(i.system?.categorizedAsNP),
      // An open TAG SET, and the first rule keyed on one is Jack's Mist:
      // *"Skills that are also categorized as 'Instinct': …"* is a list
      // asserted at the bottom of a character sheet, so it belongs on the
      // abilities it names rather than in a table in code
      // (`rules/bounded-fields.mjs#hasCategory`). `category` above is a
      // different, single-valued field naming an ability's own family.
      categorizedAs: [...(i.system?.categorizedAs ?? [])],
      // "Eye of the Mind (only when Active/its buffs are in effect)" — the
      // effect ids whose presence makes the tag above count.
      categorizedWhile: [...(i.system?.categorizedWhile ?? [])],
      // The War it exists in, asked by the use gate (`rules/costs.mjs`, #314).
      availableWhen: [...(i.system?.availableWhen ?? [])],
      // A Mode's tally and the count it ends at (#288): read by `TallyMode`,
      // and shown on the bar as "4/7".
      tally: i.system?.tally ?? 0,
      endsAfter: i.system?.endsAfter ?? null,
      // What a cross-ability gate matches on. Scathach's Gate of Skye "cannot
      // be used if Primordial Rune, Wisdom of Dun Scaith and/or Gae Bolg
      // Alternative are on Cooldown", and a gate that can only see `id` cannot
      // name a content id, a whole category, or a copy's exclusion set --
      // which is all three of the ways her sheet groups abilities.
      contentId: i.system?.contentId ?? null,
      // Ch. 28's gate. `rules/history.mjs#historyWanted` asks the BOARD
      // whether anything on it reads the past, so a field the projection drops
      // is a recorder that never starts -- and both of The Queen's Glass
      // Game's effects then do nothing at all, silently. Found on a live board:
      // the field compiled, the item carried it, and the board said no.
      requiresHistory: Boolean(i.system?.requiresHistory),
      // An ability that IS this Unit's Normal Attack while its condition holds
      // (`rules/platforms.mjs#actionSourceFor`). Projected because the
      // substitution is decided from the BOARD -- the condition is *"while
      // within Ramesseum Tentyris"*, and only the board knows where anybody is.
      replacesNormalAttack: i.system?.replacesNormalAttack ?? null,
      // What that substitution swings with, since the ability's own damage
      // block is the Normal Attack's for as long as it stands in for one.
      damage: i.system?.damage ?? null,
      // The geometry of the field this ability BUILDS, if any. `rules/actions.mjs`
      // offers the Mark action from the snapshot alone and cannot reach the item
      // document to ask -- and "markDefined" is the whole test for whether this
      // Noble Phantasm is assembled rather than cast (Ch. 28).
      fieldGeometryKind: i.system?.field?.geometry?.kind ?? null,
      category: i.system?.category ?? null,
      exclusionSet: i.system?.exclusionSet ?? null,
      // The whole-match budget, so a gate can ask without a document.
      timesUsed: i.system?.timesUsed ?? 0,
      maxUses: i.system?.maxUses ?? null,
      lastUsedTick: i.system?.lastUsedTick ?? null,
      // The restore half of its own Cooldown line, for another ability's
      // "while X is on Cooldown" (`rules/items.mjs#isCooling`, #249 reading 20).
      restoreGate: restoreGateOf(i.system?.requirements),
      // Its own gates, for an ability another one ALLOWS: a Spell is usable
      // while its Spellbook's requirements pass (`rules/items.mjs`,
      // `abilityAllows`, #260 reading 11).
      requirements: [...(i.system?.requirements ?? [])],
      // God Hand's ledger. A pool that stores IDENTITIES rather than a number
      // is a set field, not a Ch. 06 Resource -- which is the line Ch. 06 draws
      // and names this ability while drawing it.
      recordedAttacks: [...(i.system?.recordedAttacks ?? [])],
      // Both needed by `rules/options.mjs`: `slug` is what a predicate names,
      // and `active` is what separates "has Mad Enhancement" from "has Mad
      // Enhancement switched on" -- two different questions, and content asks
      // both.
      slug: i.system?.slug ?? i.id,
      active: Boolean(i.system?.active),
      // Inside its two-way lockout, when it can be switched neither on nor
      // off: Mad Enhancement's Master-health floor holds then too (#190
      // reading 12), as `self:modeLocked:<slug>`.
      locked: lockedAt(i.system, tick, turnsPerRound),

      // What `canCopy` asks about (Ch. 17). None of it was projected, so
      // `copyCandidates` -- which reads the BOARD -- saw abilities with no
      // phases and refused every one of them as `notActive`. Wisdom of Dún
      // Scáith could not copy a single Skill in the game.
      //
      // `hasPhases` rather than the phases themselves: the question is "does it
      // have an Active effect", and copying a Servant's whole phase list into
      // every board snapshot to answer a boolean is a great deal of data for
      // one bit.
      kind: i.system?.kind ?? null,
      passive: Boolean(i.system?.passive),
      hasPhases: (i.system?.phases ?? []).length > 0,
      copyable: i.system?.copyable ?? null,
      // A Spell is not a Skill, so a copy may not take one (#204, ruled
      // 2026-10-14). `category` above carries the other half of the answer.
      isSpell: Boolean(i.system?.isSpell),
      // Classic or Revised (#260 reading 3): the text its sheet prints, whether
      // the Revised text ends it on Skill Seal, and the bearer's own exemption.
      printedRevision: i.system?.printedRevision ?? null,
      endsOnSkillSeal: Boolean(i.system?.endsOnSkillSeal),
      unsealable: Boolean(i.system?.unsealable),
    }));
}

/**
 * Is this ability switched off by the state of another one?
 *
 * *"The effect of 'Kanshou & Bakuya' is negated while 'Overedge' is on
 * Cooldown."* Filtered out of the collection entirely rather than having each
 * of its elements gated, because "has no effects" is what the sheet says --
 * and gating element by element is how a clause comes to be half-applied.
 *
 * @param {object} item
 * @param {object} actor
 * @returns {boolean}
 */
function negated(item, actor) {
  // Negated by an EFFECT the bearer is carrying. `negatedBy` was read only by
  // `rules/ability-use.mjs#isNegated`, which sits on the **use** path -- so it
  // refused the button and left the ability's rules contributing underneath.
  //
  // Both halves are stated in the source and only one was built. Medea's
  // High-Speed Divine Words is *"cannot be used **and its effects are negated**
  // while inflicted with Silence"*; EMIYA carries `negatedBy: [silence]` on
  // eight abilities, one of which (Kanshou & Bakuya) is `isPassive` and is
  // therefore never used at all, so its clause could not be checked anywhere;
  // and Karna's Kavacha and Kundala -- a -90% damage reduction, the largest
  // single defensive modifier in the game -- is *"lost when Vasavi Shakti is
  // used/Activated"*.
  const byEffect = item.system?.negatedBy ?? [];
  if (byEffect.length > 0) {
    const carried = new Set(
      [...(actor.effects ?? [])]
        .filter((e) => !e.disabled && !e.isSuppressed)
        .map((e) => e.system?.defId)
        .filter(Boolean),
    );
    if (byEffect.some((id) => carried.has(id))) return true;
  }

  const spec = item.system?.negatedWhile ?? null;
  if (!spec) return false;

  const named = new Set(spec.abilityOnCooldown ?? []);
  if (named.size === 0) return false;

  return [...(actor.items ?? [])].some(
    (other) => (named.has(other.system?.contentId) || named.has(other.id))
      && (other.system?.cooldown?.remaining ?? 0) > 0,
  );
}

/**
 * How many charges a revival source has left.
 *
 * The rule element declares the budget -- God Hand is *"can only be used 11
 * times"* -- and the Item holds what has been spent, in the same `timesUsed`
 * counter every other whole-match limit uses. Two counters for one number would
 * be two places to get it wrong.
 *
 * @param {object} actor
 * @param {object} revival
 * @returns {number|null} `null` for an unlimited source
 */
function chargesLeft(actor, revival) {
  if (revival.charges === null || revival.charges === undefined) return null;
  const item = [...(actor.items ?? [])].find((i) => i.id === revival.abilityId);
  return Math.max(0, revival.charges - (item?.system?.timesUsed ?? 0));
}

/**
 * @param {object} actor
 * @returns {object|null}
 */
/**
 * Carry the thresholds that replace a Magic Resistance against one kind of
 * attack on the resistance itself, so a reader holding the resistance holds
 * them too (stage 11, `rules/damage/pipeline.mjs`). Without a resistance to
 * replace there is nothing to carry.
 * @param {object|null} mr
 * @param {object[]} variants
 * @returns {object|null}
 */
function withVariants(mr, variants) {
  if (!mr || !(variants ?? []).length) return mr;
  return { ...mr, variants };
}

function magicResistanceOf(actor) {
  const mr = actor.system?.classSkills?.magicResistance;
  if (!mr) return null;
  if (mr.mode === "dice") return { mode: "dice", formula: mr.formula, npDiceDoubled: mr.npDiceDoubled ?? true };
  return { mode: "rank", rank: Rank.parseOrNull(mr.rank), percent: mr.percent };
}

/**
 * What a summon knows of its summoner: the effects it holds and how far away it
 * stands.
 *
 * Gilles (Caster)'s Gazing: *"Normal Attacks from all Horrors within a 2 panel
 * area of himself have a 50% chance of inflicting Curse"* (#323). A handler
 * fires from the Unit that dealt the damage, so the Horror asks about him
 * (`self:summonerEffect:<id>`, `self:withinOfSummoner:<n>`). A defeated summoner
 * holds nothing and stands nowhere.
 *
 * @param {object[]} units
 * @returns {object[]} the same units, annotated
 */
export function annotateSummoner(units) {
  const byId = new Map((units ?? []).map((u) => [u.id, u]));
  for (const u of units ?? []) {
    const summoner = u.summonerId ? byId.get(u.summonerId) : null;
    if (!summoner || summoner.defeated) {
      u.summonerEffects = [];
      u.summonerDistance = null;
      continue;
    }
    u.summonerEffects = [...(summoner.effects ?? [])];
    u.summonerDistance = summoner.panel && u.panel
      ? Math.max(Math.abs(summoner.panel.i - u.panel.i), Math.abs(summoner.panel.j - u.panel.j))
      : null;
  }
  return units;
}

/**
 * Mark the summons that are the **last** of their summoner's group standing.
 *
 * Raikou's Tenmōkaikai: *"Cooldown: 7◈+⅓◈ Turns after this NP is deactivated
 * **or after the last Raikou copy is defeated**."* The last copy dying ENDS the
 * Noble Phantasm — which is not the same as the Noble Phantasm merely having no
 * copies left — so the clause fires from the copy that died, and that copy has
 * to know it was the last one.
 *
 * A board fact, computed here beside ZON and the auras rather than in the
 * defeat path, for the reason those two are: whether a Unit is the last of its
 * group is a property of everybody else's existence, and the defeat handler
 * reads the board it is handed.
 *
 * Grouped by `summonerId`, so two Servants' summons never count each other.
 *
 * @param {object[]} units
 * @returns {object[]} the same units, annotated
 */
/**
 * Mark every Unit that **acted this Turn, or whose summons did**.
 *
 * Raikou's Tenmōkaikai: *"At the end of Raikou's Turn and at the end of any
 * Turn Raikou **or any of her copies** Acts, Raikou's Master loses 25 Health."*
 *
 * **25 per Turn, not per copy**, and this is what makes that true. `fireEvent`
 * runs a handler on the unit the event fired for, so a handler on *her* Noble
 * Phantasm cannot see a copy's `actedTurnEnd`, and one handler per copy would
 * charge her Master 25 for every copy that swung — 125 a Round with four of
 * them out, which makes the Noble Phantasm unusable and is the reading easiest
 * to write by accident.
 *
 * So the clause is ONE handler, on her, listening at `turnEnd` and gated on
 * this flag. Her Turn ends once, so the Master is charged once, whether she
 * acted, one copy acted, or all five did.
 *
 * @param {object[]} units
 * @returns {object[]} the same units, annotated
 */
export function annotateSummonsActed(units) {
  /** @type {Set<unknown>} */
  const actedSummoners = new Set();
  for (const u of units ?? []) {
    if (u.kind === "summon" && u.summonerId && u.acted) actedSummoners.add(u.summonerId);
  }
  for (const u of units ?? []) {
    u.selfOrSummonsActed = Boolean(u.acted) || actedSummoners.has(u.id);
  }
  return units;
}

/**
 * Mark the summons that are the **last** of their summoner's group standing.
 *
 * (See the block below; this JSDoc belongs to `annotateLastOfSummonGroup`.)
 *
 * @param {object[]} units
 * @returns {object[]} the same units, annotated
 */
export function annotateLastOfSummonGroup(units) {
  /** @type {Map<unknown, number>} */
  const alive = new Map();
  for (const u of units ?? []) {
    // A defeated copy's body stays on the board until `clearBody`, a Turn
    // later, and counted it kept the last one standing from being the last:
    // all four of Raikou's copies down and Tenmōkaikai still running (#195).
    if (u.kind !== "summon" || !u.summonerId || u.defeated) continue;
    alive.set(u.summonerId, (alive.get(u.summonerId) ?? 0) + 1);
  }
  for (const u of units ?? []) {
    u.lastOfSummonGroup = u.kind === "summon"
      && Boolean(u.summonerId)
      && alive.get(u.summonerId) === 1;
  }
  return units;
}

/**
 * A Servant's linked group, or `null`.
 *
 * An empty `id` is not a group. `data/actor/servant.mjs` gives every Servant the
 * SchemaField whether or not its content authored one, so the object always
 * exists and the id is what says whether it means anything.
 *
 * `null` rather than an empty object for an ungrouped Servant: every reader
 * branches on presence, and `{unitWeight: 1}` would make each of them
 * re-derive "is this actually a group?" from a field that is not the answer.
 *
 * @param {object} sys a Servant document's system data
 * @returns {object|null}
 */
function linkedGroupOf(sys) {
  const g = sys?.linkedGroup;
  if (!g?.id) return null;
  return {
    id: g.id,
    partners: [...(g.partners ?? [])],
    memberIds: [...(g.memberIds ?? [])],
    leash: g.leash ?? null,
    linkedDeath: g.linkedDeath ?? "",
    sharedCooldowns: g.sharedCooldowns ?? "",
    unitWeight: g.unitWeight ?? 1,
    zonSatisfaction: g.zonSatisfaction ?? "all",
    modifierCombination: g.modifierCombination ?? "separate",
    summonTogether: Boolean(g.summonTogether),
    ownCooldowns: [...(g.ownCooldowns ?? [])],
    // Always an object: `size: 0` is no legion, and every reader asks the size.
    legion: {
      size: g.legion?.size ?? 0, fieldCap: g.legion?.fieldCap ?? null,
      openingMax: g.legion?.openingMax ?? 1, label: g.legion?.label ?? "",
    },
  };
}
