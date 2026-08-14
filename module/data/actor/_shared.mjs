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

    // Attributes are an OPEN tag set by design (Ch. 04 §4.5): the expanded
    // roster added Fairytale, Wraith, Liangshan, Gorgon and Demonic Beast
    // without a schema change, which is the payoff.
    attributes: new fields.SetField(new fields.StringField({ blank: false })),

    facing: new fields.StringField({
      required: true, initial: "n",
      choices: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
    }),

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
    }),
  };
}
