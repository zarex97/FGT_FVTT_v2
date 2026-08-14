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
      rank: new fields.StringField({ required: false, blank: true }),
      // Three, spendable, and the only pre-emption mechanism in the game.
      commandSpells: new fields.NumberField({ required: true, integer: true, initial: 3, min: 0 }),
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
