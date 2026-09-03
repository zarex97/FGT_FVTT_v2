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
    // "It can only be deactivated 2◈ Turns after it was activated, AND VICE
    // VERSA" -- one clock governing both directions, and `toggledAt` is the
    // tick it last flipped on. The toggle was a bare write until this existed,
    // so the clause had nowhere to live.
    toggleLock: new TickField(),
    toggledAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

    cooldown: new fields.SchemaField({
      max: new TickField(),
      // A cooldown decided by the use itself rather than authored as a fixed
      // tick: Medea's Dragon Tooth Warriors is "(Number of Warriors x ⅔◈)",
      // so the cost is not known until the Skill has resolved. `max` stays null
      // for these, which is why it is nullable rather than required.
      perUnit: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
      countFrom: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
      remaining: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      regen: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      // A cooldown decided by WHICH BEHAVIOUR of a multi-branch ability fired
      // -- Summoning: Bašmu is 2◈ for its damage-spell branch, 4◈ for its
      // summon branch (`engine/cooldown.mjs#cooldownFor`). Untyped for the
      // same reason a requirement is: the content validator checks the shape.
      branches: new fields.ArrayField(new fields.ObjectField()),
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

    // "Requires 3 [Semiramis' Poison] to use" -- a cost on USING the ability,
    // spent by `engine/skill-use.mjs`'s `itemCostIntents` once the matching
    // `itemAtLeast` requirement (`rules/items.mjs`) has already gated it.
    itemCost: new fields.ObjectField({ required: false, nullable: true, initial: null }),

    // A named group of abilities something can act on wholesale. Medea's
    // High-Speed Divine Words resets "all of Medea's Spells", and naming each
    // one would go stale the moment an eighth Spell was written.
    category: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
    // Abilities that may not both be used in the same Turn. Declared on BOTH
    // sides -- a one-sided exclusion is decided by whichever happens to be used
    // first, which is not a rule.
    sameTurnExclusive: new fields.ArrayField(new fields.StringField({ blank: false })),
    // The same declaration at ROUND scale. EMIYA's two projected Noble
    // Phantasms are "cannot be used on the same Round as" each other, and he
    // acts three times a Round -- so a per-Turn exclusion would forbid nothing
    // he would otherwise do.
    sameRoundExclusive: new fields.ArrayField(new fields.StringField({ blank: false })),

    // A budget for the whole MATCH, not for a turn or a cooldown.
    //
    // Three clauses in the reference set need it and none could be written:
    // Heracles's God Hand is *"can only be used 11 times"*, EMIYA's Trace, On
    // charges 5% of his Health *"if this is not the first time EMIYA has used
    // this Skill in this game"*, and his Rho Aias restores half its Health
    // *"every time it is used after its first usage"*.
    //
    // `maxUses` null means unlimited, which is every other ability.
    timesUsed: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    maxUses: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
    // When it was last used, for `healthRestoredSince` -- a gate that has to
    // compare "since" against something.
    lastUsedTick: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

    /**
     * Attacks this ability has recorded — God Hand's *"these recorded Attacks
     * can no longer defeat Heracles"*.
     *
     * A `SetField`, not a Resource. §6.10 draws exactly this line while
     * naming this ability: a pool that stores **identities** rather than a
     * number is a set. It is on the Item so it shows on the sheet, which is
     * not decoration — it is tactical information the opponent needs too.
     */
    recordedAttacks: new fields.SetField(new fields.StringField({ blank: false })),
    /** Whether this ability records the attacks that empty its bearer's Health. */
    recordsAttacks: new fields.BooleanField({ initial: false }),

    /**
     * A second Health pool this ability interposes between an attack and its
     * target (EMIYA's Rho Aias, and nothing else in the reference set).
     *
     * On the ABILITY rather than on the effect instance, because several Units
     * bear one barrier: *"all Units within a 3x3 panel area around the Unit Rho
     * Aias is protecting also receive the effects"*, and *"if the AU's NP deals
     * more than 1400 damage, the remaining damage is dealt to the DUs
     * accordingly"* only makes sense against one shared pool.
     */
    shield: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    shieldHealth: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
    // Effects that switch this ability off entirely while present.
    negatedBy: new fields.ArrayField(new fields.StringField({ blank: false })),
    // The same thing, keyed on a STATE instead of on an effect. EMIYA's
    // Kanshou & Bakuya is "negated while Overedge is on Cooldown", and a
    // cooldown is not an effect anybody carries -- so `negatedBy` had no way
    // to express it and the clause had nowhere to live.
    negatedWhile: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // WHEN it may be used. Only Command Spells had this field, so an ability
    // authored "used when Attacked" -- Medea's Argos and Trofa -- compiled with
    // the window and the DataModel dropped it on load, leaving the reaction
    // rung with nothing to offer.
    timing: new fields.ObjectField({ required: false, nullable: true, initial: null }),
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

    // What KIND of ability this is, and whether it is always on. Both are read
    // by `canCopy` -- "excluding Class Skills", and "must have an Active
    // effect" -- and neither was declared, so every class skill in the game
    // was copyable by Wisdom of Dún Scáith and every passive was too.
    kind: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
    passive: new fields.BooleanField({ initial: false }),

    // §15.3's "unless stated" overrides. NULLABLE rather than false-by-default:
    // `countsAsAttack` derives its answer from the phases when unstated, and a
    // boolean field would make "unstated" indistinguishable from "no".
    countsAsAttack: new fields.BooleanField({ required: false, nullable: true, initial: null }),
    countsAsAct: new fields.BooleanField({ required: false, nullable: true, initial: null }),

    // "Can only be used once per Turn" — Scáthach's Ár. Distinct from a
    // cooldown, and not implied by one: a PRS Token lets her skip Ár's
    // cooldown entirely, leaving this as the only limit on it.
    oncePerTurn: new fields.BooleanField({ initial: false }),

    // The same limit one scale up, and the same argument `sameRoundExclusive`
    // makes against `sameTurnExclusive`: a Servant acts up to three times in a
    // Round, so a per-Turn cap forbids almost nothing. Karna's *Uncrowned Arms
    // Mastership* is *"can only be used once per Round"* and has **no cooldown
    // at all**, which makes this the only limit on it — authored as
    // `oncePerTurn` it would have been a free toggle twice more every Round.
    oncePerRound: new fields.BooleanField({ initial: false }),

    // Presence Concealment clause 7: *"Active Skills targeting/affecting an
    // enemy Unit(s) cannot be used unless stated."* This is the "unless
    // stated". Serenity's Shapeshift is the only instance in the reference set,
    // and it pays for the exemption with the field below.
    usableWhileConcealed: new fields.BooleanField({ initial: false }),

    // The percentage chance that using this ability ends its owner's
    // concealment. *"Can be used when Presence Concealment is Active, has a 20%
    // chance of deactivating Presence Concealment when used."*
    concealmentBreakChance: new fields.NumberField({
      required: false, nullable: true, initial: null, integer: true, min: 0, max: 100,
    }),

    // Abilities this use ALSO puts on cooldown (§7.6). Scáthach's Gate of Skye
    // is the reference case — "when this NP is used, Primordial Rune and Wisdom
    // of Dún Scáith enter Cooldown" — and `engine/cooldown.mjs` has read this
    // field since it was written, against a schema that dropped it.
    // Objects, not strings. An entry may name one ability (`{ability: id}`) or
    // a whole group (`{exclusionSet}` / `{category}`) -- Scáthach's Gate of
    // Skye needs the second, because "Wisdom of Dún Scáith enters Cooldown"
    // means her three Wisdom slots and not the grant, which has no clock. A
    // StringField coerced the group entry to "[object Object]" and matched
    // nothing. The compiler normalises an authored string into `{ability}`.
    alsoTriggers: new fields.ArrayField(new fields.ObjectField()),

    // Per-use requirements (§15.4). Authored at the top level as well as under
    // `targeting.limits`, and the schema declared neither.
    requirements: new fields.ArrayField(new fields.ObjectField()),

    // A resource that buys this use out of its cooldown entirely (§6.10).
    // Scáthach's Primordial Rune Spells: one PRS Token and the Spell "does not
    // enter Cooldown". `{ resource: "prs", amount: 1 }`.
    cooldownWaiver: new fields.ObjectField({ required: false, nullable: true, initial: null }),
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
      // An open tag set: which CATEGORIES this ability also counts as. Jack's
      // Mist exempts "the Instinct Skill of Rank B or higher" and her sheet
      // then names five other skills that count as Instinct, so the list has
      // to live on the abilities rather than in a table in code
      // (`rules/bounded-fields.mjs#hasCategory`).
      categorizedAs: new fields.SetField(new fields.StringField({ blank: false })),
      // "Eye of the Mind (only when Active/its buffs are in effect)" — the
      // effect ids whose presence makes the tag above count.
      categorizedWhile: new fields.SetField(new fields.StringField({ blank: false })),

      // Effect-definition fields. Present only on documents in the effects
      // pack; null elsewhere.
      polarity: new fields.StringField({ required: false, nullable: true, initial: null }),
      volatility: new fields.StringField({ required: false, nullable: true, initial: null }),
      valence: new fields.StringField({ required: false, nullable: true, initial: null }),
      // Appendix A's umbrella names. `Bind` covers ten effects and Medusa's
      // `Dmg Up (Bind)` is the first clause that asks about the umbrella
      // rather than about a member.
      families: new fields.SetField(new fields.StringField({ blank: false })),
      // Petrify's *"buffs, debuffs and other effects have no effect"*. A flag
      // rather than a `Suppress` rule element because it decides what the unit
      // projection CONTAINS, and rule elements are collected from that
      // projection -- `rules/snapshot.mjs#activeEffectIds` answers it.
      suppressesOtherEffects: new fields.BooleanField({ initial: false }),
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
      // What a TERMINAL effect does when it lands. Appendix A's Instakill and
      // Death are consequences rather than conditions, so they carry an action
      // instead of rule elements: `{ kind: "reduceToZero" }` / `{ kind:
      // "defeat" }`.
      terminal: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      // Actions that run when the effect is removed, in the same vocabulary as
      // an `OnEvent` handler's `then:`. Appendix A has several -- Shock's
      // "current Agility +1 when max is restored", Coma's exit damage.
      onRemove: new fields.ArrayField(new fields.ObjectField()),
      defaultMagnitude: new fields.NumberField({ required: false, nullable: true, initial: null }),
      // How many charges an instance starts with, for count-stacked effects.
      // Read by `resolveStacking` since it was written, against a schema that
      // did not declare it -- so `def.uses` was always undefined and every
      // count-limited effect fell back to 1.
      uses: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      // What a barrier effect absorbs, and where its pool lives (§A.3's
      // barrier tier). EMIYA's Rho Aias is the only instance.
      absorbs: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      defaultDuration: new TickField(),
      unremovable: new fields.BooleanField({ initial: false }),
      blocks: new fields.ArrayField(new fields.StringField()),
      blockedBy: new fields.ArrayField(new fields.StringField()),
      // Effects this one REPLACES rather than being refused by.
      //
      // `blocks` and `replaces` are opposite answers to the same question and
      // the difference is a rule, not a nicety: EMIYA's Activated and Blazing
      // Circuits "cannot be held at the same time" AND *"you can choose to swap
      // from AC to BC or vice-versa"*. Declared as `blocks`, the swap is
      // refused; declared as `replaces`, it is the same write as the first pick.
      replaces: new fields.ArrayField(new fields.StringField()),
      npTags: new fields.ArrayField(new fields.StringField()),
      /**
       * A bounded field this ability creates (Ch. 43). Untyped for the same
       * reason rule elements are.
       *
       * Declared on `NoblePhantasmData` alone until Pale Rider, because every
       * field in the corpus so far belonged to a Noble Phantasm — Chaos
       * Labyrinthos, Unlimited Blade Works, Sikera Ušum, The Mist. Nothing in
       * Ch. 43 makes that a rule: a bounded field is an *area*, and what opens
       * it is a separate question.
       *
       * Contagion is the counter-example and it is a **Skill**: *"(Passive)
       * The 2 panel area around Pale Rider is the Contagion area."* Authored
       * on an ability, its whole `field` block was dropped by the schema
       * without complaint — the Item existed, carried a `field` of `null`,
       * and `ensurePassiveFields` found nothing to open.
       */
      field: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    };
  }
}

export class NoblePhantasmData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...abilityCommon(),
      isNP: new fields.BooleanField({ initial: true }),
      categorizedAsNP: new fields.BooleanField({ initial: false }),
      // An open tag set: which CATEGORIES this ability also counts as. Jack's
      // Mist exempts "the Instinct Skill of Rank B or higher" and her sheet
      // then names five other skills that count as Instinct, so the list has
      // to live on the abilities rather than in a table in code
      // (`rules/bounded-fields.mjs#hasCategory`).
      categorizedAs: new fields.SetField(new fields.StringField({ blank: false })),
      // "Eye of the Mind (only when Active/its buffs are in effect)" — the
      // effect ids whose presence makes the tag above count.
      categorizedWhile: new fields.SetField(new fields.StringField({ blank: false })),
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
