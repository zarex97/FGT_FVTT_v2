/**
 * @file The Master actor schema.
 * @see docs/16-relationships.md
 */

import { unitCommon } from "./_shared.mjs";

const fields = foundry.data.fields;

export class MasterData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      ...unitCommon(),
      // A–D (Ch. 04 §4.5), or blank for Rankless — a real state with rules of
      // its own (Ch. 17 prices an all-Rankless table differently), not a
      // missing value.
      //
      // `choices` is what stops a typo. This was a free-form string, and
      // `Rank.parseOrNull` THROWS on anything it cannot parse rather than
      // returning null — so `rank: "high"` did not read as Rankless, it
      // crashed the Noble Phantasm cost. `rules/master-rank.mjs#tierOf` now
      // catches that too, but the schema is where it should never arise.
      rank: new fields.StringField({
        required: false, blank: true, initial: "",
        choices: ["", "A", "B", "C", "D"],
      }),
      // Three, spendable, and the only pre-emption mechanism in the game.
      // The Master's OWN spells, usable on any contracted Servant (§16.9).
      commandSpells: new fields.NumberField({ required: true, integer: true, initial: 3, min: 0 }),
      // Servant id → spells usable only on that Servant. Added beside the count
      // rather than replacing it with a `{own, perServant}` pair, because the
      // migration runner (Ch. 39) does not exist yet and retyping a live field
      // would break every world that already has one.
      commandSpellsPerServant: new fields.ObjectField({ required: true, initial: () => ({}) }),
      zon: new fields.NumberField({ required: true, integer: true, initial: 2, min: 0 }),
      essences: new fields.SetField(new fields.StringField({ blank: false })),
      servantIds: new fields.SetField(new fields.DocumentIdField()),
    };
  }

  /** @inheritdoc */
  prepareBaseData() {
    // Base Health 250 flat, regardless of anything (Ch. 41 Q1). A Master is
    // roughly one clean Servant hit from death, which is what makes every
    // Master-protection rule load-bearing.
    if (this.health.max === null || this.health.max === 0) {
      this.health.max = 250;
      if (!this.health.value) this.health.value = 250;
    }
  }
}
