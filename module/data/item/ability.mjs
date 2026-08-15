/**
 * @file Ability, Noble Phantasm, Command Spell, Master Essence and Equipment.
 * @see docs/15-abilities.md, docs/22-data-models.md
 */

import { RankField, TickField } from "../fields.mjs";

const fields = foundry.data.fields;

/** Fields every ability-shaped item shares. */
function abilityCommon() {
  return {
    contentId: new fields.StringField({ required: false, blank: true }),
    description: new fields.HTMLField({ required: false, blank: true }),
    source: new fields.StringField({ required: false, nullable: true, initial: null }),
    rank: new RankField(),

    // A stable machine name, independent of the display name. `hasSkill(actor,
    // "riding")` matched on the localized name before this existed, which meant
    // renaming a skill silently disabled the rule that keyed on it.
    slug: new fields.StringField({ required: false, blank: true }),

    // How the ability is used. A DataModel drops fields it does not declare, so
    // every one of these was authored in YAML, compiled into the pack, and then
    // discarded on load -- which is why a mode was indistinguishable from an
    // attack and `system.active` was always undefined.
    isMode: new fields.BooleanField({ initial: false }),
    isAttackSkill: new fields.BooleanField({ initial: false }),
    isSpell: new fields.BooleanField({ initial: false }),

    /** A mode's current state. Meaningless unless `isMode`. */
    active: new fields.BooleanField({ initial: false }),
    /** Heracles cannot switch Mad Enhancement off. */
    cannotDeactivate: new fields.BooleanField({ initial: false }),

    cooldown: new fields.SchemaField({
      max: new TickField(),
      remaining: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      regen: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    }),

    // Rule elements and targeting stay as authored data. Keeping them
    // untyped here is deliberate: the content validator checks their shape at
    // build time, and a rigid schema would reject a rule element added by a
    // module (Ch. 21 §21.4).
    targeting: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    phases: new fields.ArrayField(new fields.ObjectField()),
    rules: new fields.ArrayField(new fields.ObjectField()),
    passiveRules: new fields.ArrayField(new fields.ObjectField()),
    activeRules: new fields.ArrayField(new fields.ObjectField()),
    parameterized: new fields.ArrayField(new fields.StringField()),
  };
}

export class AbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...abilityCommon(),
      isNP: new fields.BooleanField({ initial: false }),
      // "Categorized as NP" is the mechanical dividing line for NP Seal, NP
      // DmUp and the Luck Check exclusions -- distinct from actually being one.
      categorizedAsNP: new fields.BooleanField({ initial: false }),

      // Effect-definition fields. Present only on documents in the effects
      // pack; null elsewhere.
      polarity: new fields.StringField({ required: false, nullable: true, initial: null }),
      volatility: new fields.StringField({ required: false, nullable: true, initial: null }),
      valence: new fields.StringField({ required: false, nullable: true, initial: null }),
      stacking: new fields.StringField({ required: false, nullable: true, initial: null }),
      baseChance: new fields.NumberField({ required: false, nullable: true, initial: null }),
      defaultMagnitude: new fields.NumberField({ required: false, nullable: true, initial: null }),
      defaultDuration: new TickField(),
      unremovable: new fields.BooleanField({ initial: false }),
      blocks: new fields.ArrayField(new fields.StringField()),
      blockedBy: new fields.ArrayField(new fields.StringField()),
      npTags: new fields.ArrayField(new fields.StringField()),
    };
  }
}

export class NoblePhantasmData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...abilityCommon(),
      isNP: new fields.BooleanField({ initial: true }),
      categorizedAsNP: new fields.BooleanField({ initial: false }),
      // Ordered scale plus unordered qualifiers (Ch. 43 §43.8). Stored as
      // authored; comparison uses the highest scale tag present.
      npTags: new fields.ArrayField(new fields.StringField()),
      // A per-ability round gate composes with the global one by max():
      // Ozymandias's Ramesseum Tentyris needs 7 full Rounds.
      npGateRound: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      isPassive: new fields.BooleanField({ initial: false }),
    };
  }
}

export class CommandSpellData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      contentId: new fields.StringField({ required: false, blank: true }),
      description: new fields.HTMLField({ required: false, blank: true }),
      cost: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      /**
       * Kill Yourself costs 1 for a High Rank Master and 2 for a Low Rank one,
       * so cost is not always a scalar. `cost` above stays as the fallback for
       * anything reading the flat field.
       */
      costByMasterRank: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      requiresRank: new fields.StringField({ required: false, nullable: true, initial: null }),
      isInterrupt: new fields.BooleanField({ initial: true }),
      overridesValidation: new fields.ArrayField(new fields.StringField()),

      // Authored data, kept untyped for the same reason rule elements are: the
      // content validator checks the shape at build time, and a rigid schema
      // here would reject a command added by a module — and this catalogue is
      // explicitly open ("feel free to mention it and use it if the GM or
      // majority of players approve").
      requirements: new fields.ArrayField(new fields.ObjectField()),
      timing: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      blockedWhen: new fields.ArrayField(new fields.ObjectField()),
      effect: new fields.ArrayField(new fields.ObjectField()),
      permanentConsequence: new fields.ArrayField(new fields.ObjectField()),

      rules: new fields.ArrayField(new fields.ObjectField()),
    };
  }
}

export class MasterEssenceData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      contentId: new fields.StringField({ required: false, blank: true }),
      description: new fields.HTMLField({ required: false, blank: true }),
      rank: new RankField(),
      oneUse: new fields.BooleanField({ initial: false }),
      rules: new fields.ArrayField(new fields.ObjectField()),
    };
  }
}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      contentId: new fields.StringField({ required: false, blank: true }),
      description: new fields.HTMLField({ required: false, blank: true }),
      equipped: new fields.BooleanField({ initial: false }),
      rules: new fields.ArrayField(new fields.ObjectField()),
    };
  }
}
