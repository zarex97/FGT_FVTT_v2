/**
 * @file The Servant actor schema.
 * @see docs/22-data-models.md, docs/04-units.md
 */

import { unitCommon, combatantCommon } from "./_shared.mjs";
import { RankField } from "../fields.mjs";
import { lookup } from "../../domain/tables.mjs";
import { Rank } from "../../domain/rank.mjs";

const fields = foundry.data.fields;

export class ServantData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      ...unitCommon(),
      ...combatantCommon(),
      trueName: new fields.StringField({ required: false, blank: true }),
      servantClasses: new fields.SetField(new fields.StringField({ blank: false })),
      alignment: new fields.SchemaField({
        order: new fields.StringField({ required: false, blank: true }),
        // Open, not an enum: Anastasia's sheet reads "Chaotic Summer".
        morality: new fields.StringField({ required: false, blank: true }),
      }),
      region: new fields.SetField(new fields.StringField({ blank: false })),

      // Stated on the sheet where it disagrees with the END table; null means
      // "derive it".
      baseHealth: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

      contract: new fields.StringField({
        required: true, initial: "contracted", choices: ["contracted", "free", "unbound"],
      }),
      masterId: new fields.DocumentIdField({ required: false, nullable: true, initial: null }),

      classSkills: new fields.SchemaField({
        magicResistance: new fields.SchemaField({
          rank: new RankField(),
          mode: new fields.StringField({ initial: "rank", choices: ["rank", "dice"] }),
          formula: new fields.StringField({ required: false, blank: true }),
        }, { required: false, nullable: true, initial: null }),
      }, { required: false }),
    };
  }

  /**
   * Derive Max Health from the END rank when the sheet does not state it.
   *
   * There is **no variance roll** — `Health(S)` is unused (Ch. 41 Q1) — so two
   * Servants of the same END rank and steps have identical Max Health. Verified
   * against all 29 reference sheets.
   * @inheritdoc
   */
  prepareBaseData() {
    if (this.health.max === null || this.health.max === 0) {
      const end = Rank.parseOrNull(this.parameters?.end);
      const derived = end ? lookup("baseHealthByEnd", end) : null;
      const max = this.baseHealth ?? (typeof derived === "number" ? derived : 0);
      this.health.max = max;
      if (this.health.value === null || this.health.value === 0) this.health.value = max;
    }
  }
}
