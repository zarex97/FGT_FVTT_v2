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

      // Every class this Servant qualifies for -- Semiramis is Assassin AND
      // Caster -- kept as a set because content and rules both ask "is it a X".
      servantClasses: new fields.SetField(new fields.StringField({ blank: false })),

      // The ONE it is summoned into, and the one it is publicly known by. A
      // Servant is not "Heracles" to its opponents, it is "Berserker" -- or
      // "Berserker of Yellow" once it belongs to a named faction (Ch. 04 §4.2).
      classContainer: new fields.StringField({ required: false, blank: true }),

      // An override for that public name, for a Servant known as something
      // other than its container. Derived when blank, so the common case needs
      // no authoring.
      concealedIdentity: new fields.StringField({ required: false, blank: true }),

      // The true name is hidden until this is set, which is what gives
      // closed-information play (Ch. 26 §26.6) something to conceal.
      identityRevealed: new fields.BooleanField({ initial: false }),
      alignment: new fields.SchemaField({
        order: new fields.StringField({ required: false, blank: true }),
        // Open, not an enum: Anastasia's sheet reads "Chaotic Summer".
        morality: new fields.StringField({ required: false, blank: true }),
      }),
      region: new fields.SetField(new fields.StringField({ blank: false })),

      // A coin flip AT SUMMON that changes this Servant's shape from then on --
      // Semiramis is the only one in the reference set that needs it. An
      // ObjectField for the same reason `resources` is one (Ch. 06 §6.10): this
      // is per-unit content, and a typed schema would have to name every future
      // Servant's branch shape before any of them could ship.
      //
      // Shape: `{ heads: {id, overrides}, tails: {id, overrides} }`.
      // `engine/summon.mjs` rolls it (roll 1 = heads, the same "1d2, heads on 1"
      // convention `masterSetupPlan`'s `coinFlip` mode already uses), applies
      // the chosen branch's `overrides` into the committed sheet patch, and
      // writes the result below.
      summonVariant: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      // The RESOLVED result of `summonVariant`, once and for ever from summon --
      // `"dsc"` or `"noDsc"` for Semiramis. `null` for every Servant without a
      // `summonVariant` block. Read as a roll option (`self:variant:<id>`) by
      // content predicated on which branch this Servant was summoned as.
      variant: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),

      contract: new fields.StringField({
        required: true, initial: "contracted", choices: ["contracted", "free", "unbound"],
      }),
      masterId: new fields.DocumentIdField({ required: false, nullable: true, initial: null }),

      // ZON exceptions, both from the reference set (Ch. 16 §16.3). Semiramis
      // aboard the Hanging Gardens is exempt outright; the Dioscuri satisfy ZON
      // if *either* twin is inside, so the test is `any` across the partners.
      zonExempt: new fields.BooleanField({ initial: false }),
      zonPartnerIds: new fields.SetField(new fields.DocumentIdField()),

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
