/**
 * @file Schema fragments shared by every unit kind.
 * @see docs/22-data-models.md
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
    factionId: new fields.StringField({ required: false, nullable: true, initial: null }),

    // Standing rule elements authored directly on the UNIT rather than on an
    // ability item -- a summon with no separate "class skill" to carry its
    // clauses (Bašmu's Normal Attack rider, its Targetability protection),
    // or a Servant-level passive with no natural Item home (HGoB
    // Construction's round-end regen, Ch. 32 §32.2 source 3). Untyped for
    // the same reason an ability's are (Ch. 21 §21.4): the content validator
    // checks their shape at build time, and a rigid schema would reject a
    // module-added rule element. Read by `rules/snapshot.mjs`'s
    // `contributionsOf`, folded in as a pseudo-ability alongside the unit's
    // real items.
    rules: new fields.ArrayField(new fields.ObjectField()),
    passiveRules: new fields.ArrayField(new fields.ObjectField()),
    activeRules: new fields.ArrayField(new fields.ObjectField()),

    // `null` health means intrinsically undamageable -- Pale Rider and the
    // Kagome Spirits -- which is why the field is nullable rather than 0.
    health: resourceField(0),
    agility: resourceField(0),
    luck: resourceField(0),

    mov: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    range: new fields.SchemaField({
      panels: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      targets: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
    }),

    // Vision range and Detect are the same number (Ch. 08 §8.7): the radius at
    // which this unit may Discover a Presence-Concealed one. `null` derives it
    // from attack range with a floor of 2 -- the Golden Hind is the case that
    // needs the override, stating "Detect: 4" regardless of its range.
    detect: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true, min: 0 }),

    // The standard image, separate from the document's own `img` (the TRUE
    // portrait) so a GM may overwrite `img` freely without losing it. Only a
    // Servant currently gives this a job: while its identity is unrevealed, a
    // non-GM viewer's sheet shows this instead of the true portrait (Ch. 04
    // §4.2), the same way `classContainer` stands in for `trueName`. Every
    // unit kind carries the field regardless, on the same reasoning as
    // `attributes` being open rather than typed per-kind.
    defaultImage: new fields.FilePathField({
      required: false, nullable: true, initial: null, categories: ["IMAGE"],
    }),

    // Attributes are an OPEN tag set by design (Ch. 04 §4.5): the expanded
    // roster added Fairytale, Wraith, Liangshan, Gorgon and Demonic Beast
    // without a schema change, which is the payoff.
    attributes: new fields.SetField(new fields.StringField({ blank: false })),

    facing: new fields.StringField({
      required: true, initial: "n",
      choices: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
    }),

    // Set when a Servant's Master dies: "it remains in whatever state it was in
    // before its Master died until contracted to another Master" (§16.6). A
    // Berserker whose Mad Enhancement was on cannot switch it off while Free.
    modesLocked: new fields.BooleanField({ initial: false }),

    // A summon that cannot outlive the platform that carries it (Ch. 20 §20.9
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

    // Ability-specific pools (§6.10): `{ prs: { value: 0, max: 2 } }`.
    //
    // An ObjectField rather than a SchemaField because the pools are per-unit
    // content -- Scáthach has PRS Tokens, Mannanán has Fragarach Tokens,
    // Semiramis has Construction -- and a typed schema would have to name all
    // eight before any of them could ship. §6.10's own decision was a general
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
    // written with (Ch. 05 §5.6). Kept separately because only granted steps
    // move Base Attack, and because a sheet that shows "B" where the Servant
    // was written "C" and granted one step is a sheet nobody can check.
    grantedSteps: new fields.SchemaField({
      str: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      end: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      agi: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      mag: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      luc: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    }),
    // The ◈ this Unit's setup rolls were made on (§37.6). The rolls lock once
    // the match starts, and this is what lets anyone check afterwards that they
    // were made before it did.
    summonedAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
    normalAttack: new fields.SchemaField({
      mode: new fields.StringField({ initial: "fixed", choices: ["fixed", "combined", "rangeBanded"] }),
      component: new fields.StringField({ initial: "str", choices: ["str", "mag"] }),
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
    // share one MOV allowance (Ch. 18 §18.4).
    turnState: new fields.SchemaField({
      // The ◈ tick this state was written during.
      //
      // Turn state used to be cleared by *writing* a blank one at each turn
      // boundary, which meant a single hook that did not fire — for any reason,
      // on any client — left a Unit with no movement left for the rest of the
      // match, and nothing on screen said why. Stamping the tick makes the
      // reset a property of *reading*: state from an earlier tick is stale by
      // definition, so it cannot fail to expire. The write still happens, to
      // keep the stored data tidy, but nothing depends on it any more.
      //
      // `null` means "written before this field existed", which is stale
      // against every tick — the safe direction.
      tick: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      acted: new fields.BooleanField({ initial: false }),
      moved: new fields.BooleanField({ initial: false }),
      attacked: new fields.BooleanField({ initial: false }),
      movedPanels: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      moveSegments: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      usedActiveSkill: new fields.BooleanField({ initial: false }),
      // Riding grants a second segment, but only around an attack.
      mayMoveAgain: new fields.BooleanField({ initial: false }),
      // Riding Attack is terminal for that unit's turn.
      usedRidingAttack: new fields.BooleanField({ initial: false }),
      // How many items this Unit has passed this turn (Ch. 15 §15.8). A count
      // rather than a flag, because `transfersPerTurn` is per item and one of
      // them may allow more than one.
      itemTransfers: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      // Which abilities went this Turn, for `sameTurnExclusive` (Medea's
      // Keraino and Trofa). Stale-by-tick like everything else here.
      abilitiesUsed: new fields.ArrayField(new fields.StringField({ blank: false })),
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
     * Stamped with the round and stale-by-reading, exactly like `turnState`.
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

    roundState: new fields.SchemaField({
      round: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      abilitiesUsed: new fields.ArrayField(new fields.StringField({ blank: false })),
    }),
  };
}
