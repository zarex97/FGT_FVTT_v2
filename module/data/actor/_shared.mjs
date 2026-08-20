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

    // A portrait shipped with the system, so a Servant imported from a
    // compendium is not a grey silhouette. Separate from the document's own
    // `img`, which a GM may overwrite freely without losing the default.
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
    }),
    // null = the Sustainability clock does not exist for this unit
    // (Independent Action A+/EX). Not "a very large number".
    sustainability: new TickField(),
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
    }),
  };
}
