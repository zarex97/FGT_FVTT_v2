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

    // Standing per-use costs beyond the Noble Phantasm cost (§15.4). Each
    // carries an `id` so another cost can name it in `supersedes`, which is how
    // Karna's NP cost overwrites the 20 Health his Master loses when he Acts
    // rather than stacking with it.
    additionalCosts: new fields.ArrayField(new fields.ObjectField()),

    // A named group of abilities something can act on wholesale. Medea's
    // High-Speed Divine Words resets "all of Medea's Spells", and naming each
    // one would go stale the moment an eighth Spell was written.
    category: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
    // Abilities that may not both be used in the same Turn. Declared on BOTH
    // sides -- a one-sided exclusion is decided by whichever happens to be used
    // first, which is not a rule.
    sameTurnExclusive: new fields.ArrayField(new fields.StringField({ blank: false })),
    // Effects that switch this ability off entirely while present.
    negatedBy: new fields.ArrayField(new fields.StringField({ blank: false })),
    // "Only the highest Rank takes effect" (§10.6): a group and what to compare.
    nonStacking: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    damage: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    element: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),

    // Whether Scáthach may copy this (§15.7). Authored per ability because
    // "Skills a Servant is physically born with" is a judgement the author
    // makes and the engine cannot infer -- there is no field on Natural Body
    // that distinguishes it from any other passive.
    copyable: new fields.SchemaField({
      allowed: new fields.BooleanField({ initial: true }),
      reason: new fields.StringField({
        required: false, nullable: true, initial: null, blank: false,
        choices: ["physical", "unique", "classSkill", "rankEX"],
      }),
    }),
    // A GM/player setup dialog this ability opens instead of targeting. The
    // choices are a closed set, because an unknown value would render a button
    // that opens nothing.
    opensDialog: new fields.StringField({
      required: false, nullable: true, initial: null, blank: false, choices: ["copy"],
    }),
    // Set on a COPY: the content id of what it copies. A copy carries no phases
    // of its own, so a later fix to the source reaches every copy of it.
    copiedFrom: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
    // The grant that produced it, and the set every copy from one grant shares.
    grantedBy: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
    exclusionSet: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
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
      // Appendix A's Instakill/Death ladder. `Debuff ChUp` and `Debuff Immune`
      // both "do not affect Instakill/Death/Erase unless stated", so this is
      // what a chance modifier filters on -- and Medea's Item Construction is
      // the first content to state otherwise.
      severity: new fields.StringField({
        required: false, initial: "normal", choices: ["normal", "instakill", "death", "erase"],
      }),
      // Whether bearing this effect stops the Unit acting. Read by §23.9's
      // Master-protection invalidation, which had to guess from a hard-coded
      // list before any effect could say so itself.
      preventsAction: new fields.BooleanField({ initial: false }),
      periodic: new fields.ObjectField({ required: false, nullable: true, initial: null }),
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
      /**
       * A bounded field this Noble Phantasm creates (Ch. 43). Untyped for the
       * same reason rule elements are: ten fields are points in one six-axis
       * model, and a rigid schema would reject the eleventh.
       */
      field: new fields.ObjectField({ required: false, nullable: true, initial: null }),
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

      // "Items are an ability with a quantity" (§15.8), and the default is that
      // they CANNOT be passed: "Items cannot be traded/given/passed to other
      // Units unless stated." Only [Semiramis' Poison] states otherwise, so a
      // permissive default would be wrong for everything except the exception.
      quantity: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      transferable: new fields.BooleanField({ initial: false }),
      transferRange: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      transfersPerTurn: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      consumeEffect: new fields.ArrayField(new fields.ObjectField()),

      rules: new fields.ArrayField(new fields.ObjectField()),
    };
  }
}
