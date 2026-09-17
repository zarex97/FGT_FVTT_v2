/**
 * @file Schema fragments shared by every unit kind.
 * @see docs/07-schemas.md
 */

import { RankField, TickField, resourceField } from "../fields.mjs";

const fields = foundry.data.fields;

/**
 * Fields every unit has: position in the faction graph, the three depleting
 * resources, and the open attribute tag set.
 * @returns {object}
 */
export function unitCommon() {
  return {
    contentId: new fields.StringField({ required: false, blank: true }),
    // Which revision of the authored content this document came from
    // (Ch. 41). Written by the pack builder and read by the content
    // sync's report, so it can say what a document moved FROM rather than only
    // that it moved. The pack's entirely and never seeded: a world copy
    // claiming a version the pack never issued is the confusion it exists to end.
    contentVersion: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
    factionId: new fields.StringField({ required: false, nullable: true, initial: null }),

    // Standing rule elements authored directly on the UNIT rather than on an
    // ability item -- a summon with no separate "class skill" to carry its
    // clauses (Bašmu's Normal Attack rider, its Targetability protection),
    // or a Servant-level passive with no natural Item home (HGoB
    // Construction's round-end regen, Ch. 45 source 3). Untyped for
    // the same reason an ability's are (Ch. 02): the content validator
    // checks their shape at build time, and a rigid schema would reject a
    // module-added rule element. Read by `rules/snapshot.mjs`'s
    // `contributionsOf`, folded in as a pseudo-ability alongside the unit's
    // real items.
    rules: new fields.ArrayField(new fields.ObjectField()),
    passiveRules: new fields.ArrayField(new fields.ObjectField()),
    activeRules: new fields.ArrayField(new fields.ObjectField()),

    // `null` health means intrinsically undamageable -- Pale Rider and the
    // Kagome Spirits -- which is why the field is nullable rather than 0.
    //
    // The INITIAL is `null` and not 0, and the difference is a defect this
    // schema carried from the beginning. Each type's `prepareBaseData`
    // backfills an unset pool from the END table, and it recognised "unset" as
    // **zero** -- so a Unit whose Health had been reduced to zero was
    // indistinguishable from one that had never been given any, and the next
    // data preparation refilled it to maximum. Found live: Mannanán was
    // defeated at 0, came back at 1250 before the revival's own heal was
    // written, and the heal then clamped to the maximum she was already at.
    // Every Servant in the game was unkillable by damage unless something had
    // happened to persist its `max`.
    health: resourceField(null),
    agility: resourceField(0),
    luck: resourceField(0),

    // The content-authored starting Health, consumed by each type's own
    // `prepareBaseData` -- a Servant's (servant.mjs) reads it with an
    // END-rank table fallback and no other type needs one, so this field is
    // shared but the derivation is not. `tools/lib/content.mjs#actorSystem`
    // has compiled `doc.baseHealth` for every unit type since it was
    // written; only `ServantData` ever declared a schema field for it, so a
    // Summon or a Platform actor built straight from content had `health:
    // {value: 0, max: 0}` regardless of what its sheet stated. Found live
    // creating Semiramis's Hanging Gardens platform actor (baseHealth: 6000,
    // health.max: 0).
    baseHealth: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

    // Pale Rider and the Kagome Spirits: *"Base Health: —"*, *"cannot take
    // damage"*. `null` Health is already the convention above and the damage
    // pipeline already halts at stage 0 on it; what this flag does is keep
    // each type's `prepareBaseData` from BACKFILLING that null from the
    // END-rank table -- which is exactly what it did to a Servant whose sheet
    // states no Health, quietly giving him 1600 and a health bar.
    undamageable: new fields.BooleanField({ initial: false }),

    // Quetzalcoatl's Piedra Del Sol and her Quetzalcoatlus: *"the panel occupied
    // by Piedra Del Sol can still be Moved onto (replace the Piedra Del Sol on
    // top of any Units which Move onto that panel)"*.
    //
    // NOT `movesOntoOccupiedPanels`, which is Bašmu's and Kingprotea's and means
    // *"all Units occupying said panels will be knocked back"*. That one
    // DISPLACES; this one co-locates and displaces nobody. Two sheets, two
    // sentences, two capabilities -- `engine/movement-hooks.mjs` knocks units
    // back off the first flag and must never see this one.
    sharesPanel: new fields.BooleanField({ initial: false }),

    // A summon that hunts ONE enemy, and one that lives only while a field
    // stands. The Kagome Spirits are both: *"the Kagome Spirit summoned for
    // each enemy Unit will constantly Move towards that Unit and Attack it"*,
    // and *"when Doomsday Come ends, all Kagome Spirits immediately
    // disappear."* `boundToFieldId` generalises Bašmu's `boundToPlatformId`.
    //
    // Both are Foundry document ids stamped at placement, never authored.
    // *"Pale Rider cannot hold Items."* A flag rather than an inference from
    // `undamageable`: the two happen to coincide on him and mean nothing like
    // the same thing.
    cannotHoldItems: new fields.BooleanField({ initial: false }),

    // Where an item this unit would obtain actually goes. *"All Items that
    // would be obtained by Pale Rider are instead obtained by his Master if
    // he/she is within a 2 panel area."* Separate from the refusal above
    // because the clause has two halves and they can be met independently:
    // with no Master in reach the redirect lapses and the refusal stands.
    // Read by `rules/items.mjs#acquisitionTarget`.
    itemHandling: new fields.StringField({
      required: false, initial: "hold", choices: ["hold", "redirectToMaster"],
    }),

    pursuitTargetId: new fields.StringField({ required: false, nullable: true, initial: null }),
    boundToFieldId: new fields.StringField({ required: false, nullable: true, initial: null }),

    mov: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    // Riding's Passenger Seat: *"The Servant's Master CAN Move together with
    // its Servant."* "Can", so it is a choice -- and defaulting to ON, because
    // carrying is the whole point of the clause and a skill that does nothing
    // until you find a switch is a skill nobody uses.
    //
    // A flag rather than a prompt per move: a Servant with Riding up moves
    // several times a Turn, and asking each time would make the grant a
    // nuisance instead of a benefit. `rules/actions.mjs` puts it on the action
    // bar, where its mere presence is what tells a player the skill exists.
    carriesMaster: new fields.BooleanField({ initial: true }),
    range: new fields.SchemaField({
      panels: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      targets: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
    }),

    // Vision range and Detect are the same number (Ch. 05): the radius at
    // which this unit may Discover a Presence-Concealed one. `null` derives it
    // from attack range with a floor of 2 -- the Golden Hind is the case that
    // needs the override, stating "Detect: 4" regardless of its range.
    detect: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true, min: 0 }),

    // The standard image, separate from the document's own `img` (the TRUE
    // portrait) so a GM may overwrite `img` freely without losing it. Only a
    // Servant currently gives this a job: while its identity is unrevealed, a
    // non-GM viewer's sheet shows this instead of the true portrait (Ch. 06
    // Ch. 06), the same way `classContainer` stands in for `trueName`. Every
    // unit kind carries the field regardless, on the same reasoning as
    // `attributes` being open rather than typed per-kind.
    defaultImage: new fields.FilePathField({
      required: false, nullable: true, initial: null, categories: ["IMAGE"],
    }),

    // Attributes are an OPEN tag set by design (Ch. 06): the expanded
    // roster added Fairytale, Wraith, Liangshan, Gorgon and Demonic Beast
    // without a schema change, which is the payoff.
    attributes: new fields.SetField(new fields.StringField({ blank: false })),

    facing: new fields.StringField({
      required: true, initial: "n",
      choices: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
    }),

    // Set when a Servant's Master dies: "it remains in whatever state it was in
    // before its Master died until contracted to another Master" (Ch. 32). A
    // Berserker whose Mad Enhancement was on cannot switch it off while Free.
    modesLocked: new fields.BooleanField({ initial: false }),

    // A summon that cannot outlive the platform that carries it (Ch. 27
    // step 7). Bašmu is the case: "Bašmu cannot leave the HGoB. If HGoB is
    // removed from the field while Bašmu is summoned, it disappears."
    boundToPlatformId: new fields.StringField({ required: false, nullable: true, initial: null }),

    // Whether this Unit has been defeated, and what did it.
    //
    // `io.defeat` has written `system.defeated` since it was written and **no
    // schema declared it**, so the DataModel dropped it: every defeat in the
    // game left a skull on the token, incremented the Grail counter, freed the
    // contracted Servants -- and never marked the Unit. A defeated Servant was
    // still a legal target, still took its turn, and still counted as alive to
    // anything that asked.
    //
    // `defeatCause` matters separately: `Death` "ignores all revival effects",
    // and a revival source has to be able to tell what killed the bearer.
    defeated: new fields.BooleanField({ initial: false }),
    defeatCause: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),

    // Ability-specific pools (Ch. 06): `{ prs: { value: 0, max: 2 } }`.
    //
    // An ObjectField rather than a SchemaField because the pools are per-unit
    // content -- Scáthach has PRS Tokens, Mannanán has Fragarach Tokens,
    // Semiramis has Construction -- and a typed schema would have to name all
    // eight before any of them could ship. Ch. 06's own decision was a general
    // mechanism, and a general mechanism cannot enumerate its instances.
    resources: new fields.ObjectField({ required: false, initial: () => ({}) }),

    // Whether this Unit is under Presence Concealment.
    //
    // Derived from the `presenceConcealment` effect by the snapshot, and
    // declared here so a GM can also set it by hand on a Unit whose concealment
    // comes from somewhere the effect does not cover. The projection read this
    // field, four subsystems consulted the projection, and NO schema declared
    // it -- so a write would have been dropped even if anything had made one.
    concealed: new fields.BooleanField({ initial: false }),

    // Damage this Unit has taken from a cause it is not allowed to see yet,
    // keyed by that cause.
    //
    // Serenity's Secret Poison is the only thing that writes it: the Health
    // comes off on schedule -- Q47's ruling, so displayed and real Health never
    // diverge -- and this is the tally that is disclosed and cleared when her
    // Presence Concealment ends. An object rather than a number because the
    // disclosure names what it was.
    hiddenDamage: new fields.ObjectField({ required: true, initial: () => ({}) }),

    biography: new fields.HTMLField({ required: false, blank: true }),
    notes: new fields.HTMLField({ required: false, blank: true }),

    // Home Base residency (Ch. 29 E1/E2): how many consecutive Rounds this
    // Unit has ended standing in its own base. Unlike `turnState`/`roundState`,
    // this has to survive being read -- it is a STREAK across Rounds, not a
    // per-cycle flag -- so it cannot use their stale-by-reading trick and is
    // written explicitly at each round boundary instead
    // (`rules/environment.mjs#homeBaseResidencyUpdates`). Declared on
    // `unitCommon` rather than `combatantCommon`: residency is a property of
    // standing on a panel, which every Unit kind can do.
    homeBase: new fields.SchemaField({
      consecutiveRounds: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    }),
  };
}

/**
 * Fields shared by Servants and Summons -- anything with parameters and two
 * base attacks.
 * @returns {object}
 */
export function combatantCommon() {
  return {
    parameters: new fields.SchemaField({
      str: new RankField(), end: new RankField(), agi: new RankField(),
      mag: new RankField(), luc: new RankField(),
    }),
    baseAttack: new fields.SchemaField({
      str: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      mag: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    }),
    // Parameter steps this Unit was GRANTED, as opposed to the ones it was
    // written with (Ch. 03). Kept separately because only granted steps
    // move Base Attack, and because a sheet that shows "B" where the Servant
    // was written "C" and granted one step is a sheet nobody can check.
    grantedSteps: new fields.SchemaField({
      str: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      end: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      agi: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      mag: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      luc: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    }),
    // A PERMANENT flat reduction to Base Attack, subtracted by
    // `domain/base-attack.mjs#baseAttackFor`.
    //
    // > *"For every Nameless Forest Counter on a Unit, reduce its Max Health by
    // > 25, **Base Attack (both) by 10**, and Max Luck by 1."*
    // > *"(Health and Luck that are lost from the effects of this NP are not
    // > restored.)"*
    //
    // Not a contribution, because those spring back when their source leaves
    // and this must not. Not a write to `baseAttack` either, because that is
    // derived on every `prepareDerivedData` and would recompute the write away.
    // A stored penalty is the only shape that is both permanent and stable
    // under recomputation.
    //
    // Distinct from `grantedSteps` above: that moves a PARAMETER and this is a
    // flat number the sheet states directly.
    baseAttackPenalty: new fields.SchemaField({
      str: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      mag: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    }),
    // The ◈ this Unit's setup rolls were made on (Ch. 40). The rolls lock once
    // the match starts, and this is what lets anyone check afterwards that they
    // were made before it did.
    summonedAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
    normalAttack: new fields.SchemaField({
      mode: new fields.StringField({ initial: "fixed", choices: ["fixed", "combined", "rangeBanded"] }),
      component: new fields.StringField({ initial: "str", choices: ["str", "mag"] }),
      // What a Normal Attack's damage IS. Every element in the engine is
      // sourced from an ABILITY document, and the pipeline's element stage
      // returns immediately without one -- so a Servant whose ordinary swing
      // has a type had nowhere to state it. Ozymandias's Mesektet is the first:
      // *"All Normal Attacks use Base Attack (MAG) ... Light damage."*
      element: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
      // "...Lightning damage (HALF)". How much of the swing carries that
      // element, for the pipeline's stage 4b. Raikou's four Tenmokaikai copies
      // are the first Normal Attacks in the corpus whose element is a FRACTION
      // -- Ozymandias's Light and Nemo's Water are whole -- and without this
      // field the parenthesis was dropped by the schema and every copy hit
      // for full elemental damage.
      elementFraction: new fields.NumberField({ required: false, nullable: true, initial: null }),
      // What `rangeBanded` bands ON. The mode has been a declared choice since
      // this schema was written with nothing to configure it and nothing
      // reading it, so a Servant authored `rangeBanded` attacked with its flat
      // `component` at every distance. Untyped for the same reason rule
      // elements are; the content validator checks the shape at build time.
      bands: new fields.ArrayField(new fields.ObjectField()),
    }),
    // null = the Sustainability clock does not exist for this unit
    // (Independent Action A+/EX). Not "a very large number".
    //
    // The AUTHORED maximum, as a ◈ expression -- "2◈" is what the sheet prints.
    sustainability: new TickField(),

    // What is LEFT of it, in turns.
    //
    // Every consumer treated `sustainability` itself as a number: `cannotPay`
    // compared `"2◈" > 5`, `checkRemovals` computed `"2◈" - 1`, and
    // `onMasterDefeated` wrote `Math.max(0, NaN)`. A Free Servant could never
    // pay for a Noble Phantasm, never ran out of time, and Mad Enhancement's
    // "-2◈ if its Master is defeated" could not be charged.
    //
    // `null` means "not yet resolved"; the snapshot derives it from the
    // expression, so a Servant summoned before this field existed still works.
    sustainabilityRemaining: new fields.NumberField({
      required: false, nullable: true, initial: null, integer: true, min: 0,
    }),
    // Reset at the start of the owning faction's turn. `movedPanels` is a
    // running total rather than a per-segment count, because Riding's two moves
    // share one MOV allowance (Ch. 19).
    turnState: new fields.SchemaField({
      // The ◈ tick this state was written during. The rule it makes possible --
      // a record stamped with an earlier tick reads as blank, so nothing has to
      // reset it, and a writer must rebuild the whole record rather than
      // re-stamp it -- belongs to `domain/stamped-record.mjs`, which states it
      // once for both scales and owns what it cost to learn.
      //
      // This block and that module's `TURN_RECORD` are two spellings of one
      // field list, held together by a drift test rather than generated from
      // each other: a `SchemaField` carries validation and the prose below on
      // why each field exists, and a spec table would lose both (ADR 0003).
      // Adding a field here means adding it there, and the test says so.
      tick: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      acted: new fields.BooleanField({ initial: false }),
      moved: new fields.BooleanField({ initial: false }),
      attacked: new fields.BooleanField({ initial: false }),
      // Was this Unit in a Combat Phase this Turn — on EITHER side of it?
      //
      // Distinct from `acted`, which is what the Unit *did*, and from
      // `attacked`, which is what it *did to somebody else*. Being the defender
      // is involvement and neither of those records it.
      //
      // Karna's `Kavacha and Kundala` is the clause that needs it: *"Karna's
      // Master loses 20 Health at the end of every Turn that Karna is INVOLVED
      // IN A COMBAT PHASE"*, against `Vasavi Shakti`'s *"at the end of every
      // Combat PROCESS Karna is involved in"*. Ch. E draws that distinction and
      // names him as the reason for it; the Phase-scaled half was authored on
      // `actedTurnEnd`, which is neither, so a Karna who was attacked and did
      // not act cost his Master nothing (Ch. 46 §46.9).
      inCombatPhase: new fields.BooleanField({ initial: false }),
      movedPanels: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      moveSegments: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      usedActiveSkill: new fields.BooleanField({ initial: false }),
      // Riding Attack is terminal for that unit's turn.
      usedRidingAttack: new fields.BooleanField({ initial: false }),
      // Jack's Mist: *"she can Move the Mist and/or change the shape of the
      // Mist ONCE"* per Turn. Its own flag rather than `usedActiveSkill`,
      // because the same sentence says it "does not count as Moving a Unit and
      // is not an Attack" -- so a repaint must spend nothing else.
      reshapedField: new fields.BooleanField({ initial: false }),
      // How many items this Unit has passed this turn (Ch. 17). A count
      // rather than a flag, because `transfersPerTurn` is per item and one of
      // them may allow more than one.
      itemTransfers: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      // Which abilities went this Turn, for `sameTurnExclusive` (Medea's
      // Keraino and Trofa). Stale-by-tick like everything else here.
      abilitiesUsed: new fields.ArrayField(new fields.StringField({ blank: false })),
      // *"Once per Turn during its own Turn it may attempt a Luck Check."*
      // Nursery Rhyme's Nameless Forest, and the reason this is a COUNT rather
      // than a flag is only symmetry with `itemTransfers` -- one is the limit.
      //
      // Undeclared until #28, so `markTurn`'s write was dropped in silence and
      // the counter read 0 immediately after an escape. Measured live: the
      // once-per-Turn limit did not exist, and a caught Unit could roll until
      // it got out.
      namelessForestAttempts: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    }),

    /**
     * The same record at ROUND scale, for exclusions a Turn cannot express.
     *
     * *"Caladbolg II cannot be used on the same Round as Hrunting and vice
     * versa"* is the only clause in the reference set that needs it, and the
     * distinction is real: EMIYA acts up to three times in a Round, so a
     * same-Turn exclusion would let him fire both in one Round on consecutive
     * Turns — which is exactly what the sheet forbids.
     *
     * Stamped with the round and stale-by-reading, exactly like `turnState`:
     * `domain/stamped-record.mjs#ROUND_RECORD`, same rule, same drift test.
     */
    /**
     * The last tick at which Health was at or above a given fraction of its
     * maximum, keyed by that fraction as a string.
     *
     * Two clauses in the reference set ask a question about HISTORY rather than
     * about the current bar -- EMIYA's Rho Aias and Battle Continuation's
     * revival both need Health to *"have been restored back to above half its
     * maximum value at least once since"* the last use. A snapshot of the
     * present cannot answer that, and Battle Continuation's half of it has
     * never been enforced because there was nowhere to record it.
     *
     * Only the fractions some ability on this actor actually asks about are
     * stamped, so this stays a two-key object rather than a log.
     */
    healthWatermarks: new fields.ObjectField({ required: true, initial: () => ({}) }),

    /**
     * Unit ids this unit has ever seen, for `unitFirstSeen` (`engine/vision.mjs`).
     *
     * "Whenever Semiramis sees a Unit for the FIRST time" is a question about
     * history the same way `healthWatermarks` is -- a snapshot of the present
     * board only says who is in Detect range *right now*, not who is new. A
     * set rather than a log, since only membership is ever asked.
     */
    seenUnitIds: new fields.SetField(new fields.StringField({ blank: false }), { initial: () => [] }),

    /**
     * This Unit's Discover budget while it is concealed.
     *
     * `{tick, spent: {factionId: [watcherId]}, acquiredAt: {watcherId: tick}}`.
     *
     * A faction gets **three** attempts per Turn against one concealed Unit,
     * spent in the order its Servants acquired the target, and no Servant
     * attempts twice in a Turn (Ch. 46 §46.4-AN). All three facts are about a
     * PAIR -- this Unit and one watcher -- so the record lives on the Unit
     * being hunted rather than on each hunter: one document to read, and it is
     * discarded with the concealment it belongs to.
     *
     * `spent` is cleared whenever `tick` moves on; `acquiredAt` is not, because
     * "order of arrival" is about who found this Unit first and that is a fact
     * across Turns, not within one.
     *
     * Runtime state, never authored.
     */
    discoverBudget: new fields.ObjectField({ required: false, initial: () => ({}) }),

    // `null` defers to the ordinary rules; `false` overrides them. Read
    // (`!== false`) by `rules/budget.mjs`, `rules/targeting/resolve.mjs`,
    // `engine/attack.mjs` and `apps/canvas/overlay-layer.mjs` since each was
    // written, and declared by NONE of their schemas until now -- a write
    // to it (a GM's manual override, or `engine/channel.mjs`'s "cannot Act
    // for 3◈ Turns" while the Hanging Gardens activation channels) was
    // silently dropped by the DataModel before it ever reached a reader.
    canAct: new fields.BooleanField({ required: false, nullable: true, initial: null }),

    // A multi-Turn activation in progress -- Semiramis's Hanging Gardens of
    // Babylon is the only clause in the reference set that needs one:
    // "cannot Act for 3◈ Turns... if Attacked during this period, the
    // period is interrupted and she has to restart." `null` when nothing is
    // channelling. Untyped past the top level for the same reason a rule
    // element's own shape is (Ch. 02).
    channel: new fields.ObjectField({ required: false, nullable: true, initial: null }),

    roundState: new fields.SchemaField({
      round: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      abilitiesUsed: new fields.ArrayField(new fields.StringField({ blank: false })),
      // Was this Unit in a Combat Phase, inside its own Home Base, at any
      // point this Round? Stale-by-reading against `round` like the rest of
      // this SchemaField -- a new Round needs no explicit reset write, unlike
      // `homeBase.consecutiveRounds` above, which has to survive one.
      combatInBaseThisRound: new fields.BooleanField({ initial: false }),
    }),
  };
}
