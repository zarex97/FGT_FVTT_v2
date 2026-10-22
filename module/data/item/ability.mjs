/**
 * @file Ability, Noble Phantasm, Command Spell, Master Essence and Equipment.
 * @see docs/17-abilities.md, docs/07-schemas.md
 */

import { RankField, TickField } from "../fields.mjs";
import { COPY_REASONS } from "../../domain/enums.mjs";

const fields = foundry.data.fields;

/** Fields every ability-shaped item shares. */
function abilityCommon() {
  return {
    contentId: new fields.StringField({ required: false, blank: true }),
    // Which revision of the authored content this document came from
    // (Ch. 41). Written by the pack builder and read by the content
    // sync's report, so it can say what a document moved FROM rather than only
    // that it moved. The pack's entirely and never seeded: a world copy
    // claiming a version the pack never issued is the confusion it exists to end.
    contentVersion: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
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
    // *"Counts as both Castor and Pollux's Attack for the Turn."* Using this
    // ability marks the named relation's units as having attacked and charges
    // their weight too, so the pair spends ONE of the faction's two Servant
    // attacks (0.5 + 0.5) and neither twin may swing again.
    //
    // On the ABILITY rather than on the unit: it is a property of the joint
    // Noble Phantasm, and the twins' other attacks charge one twin each.
    alsoCountsAsAttackFor: new fields.StringField({
      required: false, blank: true, initial: "", choices: ["", "partner"],
    }),
    isSpell: new fields.BooleanField({ initial: false }),

    /** A mode's current state. Meaningless unless `isMode`. */
    active: new fields.BooleanField({ initial: false }),
    /** Heracles cannot switch Mad Enhancement off. */
    cannotDeactivate: new fields.BooleanField({ initial: false }),
    // ...and its mirror: a mode no hand switches ON. Gilles de Rais (Saber)'s
    // Mad Enhancement *"cannot be used/Activated unless specific conditions are
    // met"*: only Prelati's Encouragement's die turns it on (#260 reading 2).
    cannotActivate: new fields.BooleanField({ initial: false }),
    /**
     * Quetzalcoatl's three Spells each end *"Cannot be used as a Counter"*.
     * `timing.window: ownTurn` does not say it -- it is documentary, and the
     * author has ruled that Noble Phantasms authored `ownTurn` CAN be Counters --
     * so the ability says it itself. Read by `rules/counter.mjs#answersACounter`.
     */
    cannotCounter: new fields.BooleanField({ initial: false }),
    // "It can only be deactivated 2◈ Turns after it was activated, AND VICE
    // VERSA" -- one clock governing both directions, and `toggledAt` is the
    // tick it last flipped on. The toggle was a bare write until this existed,
    // so the clause had nowhere to live.
    toggleLock: new TickField(),
    // WHO may switch this mode off, and WHEN. Distinct from `toggleLock`, which
    // says how long they must wait, and from `cannotDeactivate`, which says
    // never: this says at which moments the offer exists at all.
    //
    // Raikou's Tenmōkaikai: *"Raikou can deactivate this NP during her Turn and
    // at the start or end of any Turn or Round"* -- a wider window than the
    // sheet button alone, and one a mode with no bounded field had no way to
    // state. Ozymandias's Complex says the same thing about a FIELD
    // (`field.deactivation`), which is where the shape comes from.
    deactivation: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // WHEN the owner may switch it, both ways. `any`: on anybody's Turn, at any
    // moment -- Arturia's Invisible Air (#230). Unset is her own Turn only.
    // Usable ON its Cooldown, at a price, without restarting it: `{masterHealth,
    // withinZon}` (Arturia's Mana Burst, #230). Read by `rules/costs.mjs`.
    cooldownOverride: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // *"Using this NP does not reduce her Master's Health as a cost"* (Arturia's
    // Avalon, #230). Read by `rules/costs.mjs#npCost`.
    noMasterCost: new fields.BooleanField({ initial: false }),
    // What a FREE Servant pays to use this NP, when its sheet states it rather
    // than the Rank table: the Normal ruleset's *"When a Free Servant uses its
    // Noble Phantasm, it immediately disappears after use"* (`{kind:
    // "disappear"}`), and its Archer's and Caster's NP (a), *"Sustainability is
    // reduced by 2◈ Turns"* (`{kind: "sustainability", rounds: 2}`), #241.
    // Read by `rules/costs.mjs#npCost`.
    freeServantCost: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // No Round gate (`rules/np-gate.mjs#isGated`): the Master's Avalon (#230).
    ignoresNPGate: new fields.BooleanField({ initial: false }),
    toggleWindow: new fields.StringField({ required: false, blank: true, initial: "", choices: ["", "any"] }),
    toggledAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
    // HOW the mode last ended: `manual` (its owner's press), `hit`, or a forced
    // switch's own word. Written with `active: false`; read by `onModeEnded`,
    // which pays `onDeactivate[endedBy]` (#253 reading 14).
    endedBy: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
    // What a mode's END pays, by how it ended: Doppelganger's *"When
    // Doppelganger is manually deactivated by Yan Qing, apply the following
    // effects to himself"* is `{manual: [phases]}` (#253). Phases run on the
    // owner, as a self-targeted Skill's would.
    onDeactivate: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // The tick a Command-Spell suspension lifts at; null when nothing has
    // suspended this ability. Read by `rules/modes.mjs#canToggleMode`, which
    // gives it precedence over `ForceMode` -- and that precedence IS Raikou's
    // clause: *"Mad Enhancement can be deactivated for 1◈ Turns by spending a
    // Command Spell"*. Read the two the other way round and the most expensive
    // resource in the game buys nothing.
    suspendedUntil: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

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
      // How much this ability's cooldown was increased WHILE ITS NOBLE
      // PHANTASM GATE WAS STILL SHUT.
      //
      // > "If a Unit has its NP Cooldown increased before its NP would be
      // > available, then its NP would only be usable X Turns after its NP
      // > would be available, X being the number of Turns its NP Cooldown was
      // > increased by." (Ch. 04)
      //
      // A permanent shift of the availability turn, never a countdown and never
      // reset -- the same argument every duration in this system makes. Zero
      // for every ability in every world until something increases a cooldown
      // early.
      gatedDelay: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      // A cooldown decided by WHICH BEHAVIOUR of a multi-branch ability fired
      // -- Summoning: Bašmu is 2◈ for its damage-spell branch, 4◈ for its
      // summon branch (`engine/cooldown.mjs#cooldownFor`). Untyped for the
      // same reason a requirement is: the content validator checks the shape.
      branches: new fields.ArrayField(new fields.ObjectField()),
      // A cooldown that is LONGER in a stated circumstance, ADDED to whichever
      // one was chosen. Raikou's Dohatsu Tenshou: *"its Cooldown is increased
      // by 2◈ Turns (in addition to its original Cooldown)"* when it is used
      // while Tenmōkaikai is Active. Where `branches` selects one cooldown from
      // several, this adds to the selected one.
      conditionalBonus: new fields.ArrayField(new fields.ObjectField()),
    }),

    // Rule elements and targeting stay as authored data. Keeping them
    // untyped here is deliberate: the content validator checks their shape at
    // build time, and a rigid schema would reject a rule element added by a
    // module (Ch. 02).
    targeting: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    phases: new fields.ArrayField(new fields.ObjectField()),
    rules: new fields.ArrayField(new fields.ObjectField()),
    passiveRules: new fields.ArrayField(new fields.ObjectField()),
    activeRules: new fields.ArrayField(new fields.ObjectField()),
    parameterized: new fields.ArrayField(new fields.StringField()),

    // Standing per-use costs beyond the Noble Phantasm cost (Ch. 17). Each
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
    // Structure ids this ability has already placed, for a `once: true`
    // `createStructure` phase.
    //
    // > *"When the Jabberwock is summoned FOR THE FIRST TIME, the [Vorpal
    // > Blade] Item appears on a random panel."*
    //
    // Once per MATCH, not once per summoning, and recorded on the ability
    // because that is the only thing that outlives both the structure (which
    // is removed when the item is picked up) and the summon. A second Blade
    // every 5<> is a different game, and so is replacing the one that broke.
    placedStructures: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: () => [] }),
    // This ability reads the PAST, so the match must record one.
    //
    // > *"…the Stats, Parameters, Buffs, Debuffs, Cooldowns, and other existing
    // > effects of all Units within a 3 panel area of Nursery are returned to
    // > what they were 3◈ Turns ago."*
    //
    // Ch. 28's load-bearing optimisation: recording is OFF by default
    // and switched on only when something declaring this enters play, so *"a
    // match without Nursery Rhyme pays nothing"*. Read by
    // `rules/history.mjs#historyWanted`.
    requiresHistory: new fields.BooleanField({ initial: false }),
    // When it was last used, for `healthRestoredSince` -- a gate that has to
    // compare "since" against something.
    lastUsedTick: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

    /**
     * Attacks this ability has recorded — God Hand's *"these recorded Attacks
     * can no longer defeat Heracles"*.
     *
     * A `SetField`, not a Resource. Ch. 06 draws exactly this line while
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
    // What this ability does to an incoming Noble Phantasm it CANCELS.
    //
    // One ability in the corpus (Ch. 45) and the only thing in the game besides
    // a Command Spell that interrupts somebody else's resolution. Untyped for
    // the same reason rule elements are: the two branches -- "the strongest, so
    // Instakill" and "not the strongest, so reflect what it would have dealt"
    // -- are a shape the content validator checks, and a rigid schema here
    // would refuse a third that a module adds.
    cancelsNP: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // WHEN it may be used. Only Command Spells had this field, so an ability
    // authored "used when Attacked" -- Medea's Argos and Trofa -- compiled with
    // the window and the DataModel dropped it on load, leaving the reaction
    // rung with nothing to offer.
    timing: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // What a reaction rung MEANS against this attack, when the attack redefines
    // one. Nemo's Quickfire is the only holder: *"The enemy Unit Evades
    // (instead of performing an Evade roll)"* -- the rung stays on the ladder,
    // the defender still chooses it, and choosing it raises his dice threshold
    // rather than avoiding the attack.
    //
    // Distinct from `ForbidReaction` and `evadableOnlyBy`, which remove the
    // rung or narrow who may use it. A defender who COULD NOT evade would also
    // not worsen the threshold, so the difference is a rule and not a nicety.
    // WHAT this ability brings into existence, by Attribute. Read by
    // `rules/costs.mjs#canUseAbility` against a `ForbidCreating` suppression --
    // Nemo's Storm Border refuses *"any ability that creates a Unit/Item/object
    // that has the 'Large' or 'Giant' Attribute"* while its passengers are
    // inside.
    //
    // DECLARED rather than derived: what a summon's own content document says
    // about itself is not reachable from the ability at gate time, and a gate
    // that has to load another document to decide whether a button is pressable
    // is a gate that runs on every render.
    creates: new fields.SetField(new fields.StringField({ blank: false })),
    reactionOverride: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    damage: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // A second, UNCONDITIONAL resolution the same ability declares, with its own
    // targeting, damage and riders. Quetzalcoatl's Xiuhcoatl is the first:
    // *"then (regardless of whether the NP hits the DU or not), deals normal
    // damage to all Units within a 2 panel area of Quetzalcoatl except herself
    // and the previously targeted Unit."*
    //
    // Untyped for the same reason `damage` above is: the content validator
    // checks its shape at build time (it must carry a `targeting` and a
    // `damage`, or it catches nobody / inherits the primary's numbers), and a
    // rigid schema would reject a shape a module introduces.
    aftermath: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    // A Noble Phantasm that LANDS LATER: `{after, mark}`. Proto Gil's Enki is
    // the first -- *"7◈ Turns after Enki was Activated, it hits a 13x13 panel
    // area centered on the 'Utnapishtim' panel"* (#232). Read by
    // `engine/attack.mjs#resolveAttack`, which records the strike instead of
    // declaring it (`engine/schedule.mjs`).
    schedule: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    element: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),

    // Whether Scáthach may copy this (Ch. 17). Authored per ability because
    // "Skills a Servant is physically born with" is a judgement the author
    // makes and the engine cannot infer -- there is no field on Natural Body
    // that distinguishes it from any other passive.
    copyable: new fields.SchemaField({
      allowed: new fields.BooleanField({ initial: true }),
      reason: new fields.StringField({
        required: false, nullable: true, initial: null, blank: false,
        // `named`: a family the copier's own sheet lists by name, as Wisdom of
        // Dún Scáith lists Mana Burst (#204 reading 11).
        choices: [...COPY_REASONS],
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
    // Set on a copy a SUMMON inherited from its summoner (`inherit.passives`).
    // Raikou's clones are *"unable to use Mad Enhancement, Riding and the
    // Active effects of Raikou's Skills (Passive effects are still present)"*,
    // and the copies arrive as documents with their Actives stripped so each
    // rule keeps its owning ability's RANK -- a flattened `passiveRules` block
    // collects at `rank: null` and would resolve Divinity C to the table's
    // fallback. Documentary: it is what lets the copy's sheet say where the
    // row came from.
    inheritedFrom: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
    exclusionSet: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),

    // What KIND of ability this is, and whether it is always on. Both are read
    // by `canCopy` -- "excluding Class Skills", and "must have an Active
    // effect" -- and neither was declared, so every class skill in the game
    // was copyable by Wisdom of Dún Scáith and every passive was too.
    kind: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
    passive: new fields.BooleanField({ initial: false }),

    // Ch. 17's "unless stated" overrides. NULLABLE rather than false-by-default:
    // `countsAsAttack` derives its answer from the phases when unstated, and a
    // boolean field would make "unstated" indistinguishable from "no".
    countsAsAttack: new fields.BooleanField({ required: false, nullable: true, initial: null }),
    countsAsAct: new fields.BooleanField({ required: false, nullable: true, initial: null }),

    // "Can only be used once per Turn" — Scáthach's Ár. Distinct from a
    // cooldown, and not implied by one: a PRS Token lets her skip Ár's
    // cooldown entirely, leaving this as the only limit on it.
    oncePerTurn: new fields.BooleanField({ initial: false }),

    // Exempts this use from its CATEGORY's per-Turn cap (`CategoryUseLimit`).
    // Kiritsugu's Lethal Gunfire Suppression grants a Thaumaturgy cast inside
    // its trigger that *"does not count towards the one Thaumaturgy Spell
    // usage per Turn, but it will still enter Cooldown"* -- exempt from the
    // count, not from the consequence.
    bypassesCategoryLimit: new fields.BooleanField({ initial: false }),

    // An attack that COSTS NOTHING. `countsAsAttack` conflates two questions --
    // "does this bill an Attack" and "does this resolve through the attack
    // flow" -- and Kiritsugu's Lethal Gunfire Suppression needs opposite
    // answers: *"Kiritsugu can INSTANTLY perform a Normal Attack"*, free and
    // uncapped, but still a Normal Attack that deals damage. Setting
    // `countsAsAttack: false` to make it free routed it to `useSkill`, which
    // refuses a `damage` phase outright and says so.
    freeAction: new fields.BooleanField({ initial: false }),

    // "…which cannot be Reacted to unless the AU's AGI Rank is higher than
    // Kiritsugu's." A narrowing of the reaction ladder decided by a RANK
    // COMPARISON rather than by a fixed list, which is why it is a flag here
    // and not a `ForbidReaction` on an effect: the rungs it removes depend on
    // who is being shot at.
    refusesReactionsUnlessFaster: new fields.BooleanField({ initial: false }),

    // A category of ability the owner is OFFERED before this one resolves.
    // Kiritsugu's Lethal Gunfire Suppression: *"Kiritsugu can use a Thaumaturgy
    // Spell once before performing this Normal Attack."* The offered use is
    // exempt from its category's per-Turn cap and still enters Cooldown.
    offersSpellCategory: new fields.StringField({
      required: false, nullable: true, initial: null, blank: false,
    }),

    // A reaction ability that is NOT the reaction. Medea's Argos is *"used
    // during your Turn or when Attacked"*: cast at the reaction rung it applies
    // Def Up, and she then still Blocks, Evades or takes it (#193 reading 8).
    // Trofa, which IS her Evade, leaves this false.
    reactionFree: new fields.BooleanField({ initial: false }),
    // Kawarimi: the user and the Unit it is aimed at trade places at the
    // reaction rung, and the Attack goes on against whoever stands where it
    // struck (`engine/attack.mjs#swapIntoAttack`, #249).
    swapsPositions: new fields.BooleanField({ initial: false }),
    // Kirihanasu: used at an Attack's fatal hit, IN PLACE of the damage -- it
    // and its riders are not received, and the Attack ends for its user
    // (`engine/feigned-defeat.mjs#offerFeignedDefeat`, #249).
    insteadOfDamage: new fields.BooleanField({ initial: false }),

    // A reaction that takes its user OUT of the Attack. Hundred-Faced Hassan's
    // Battle Retreat: *"The enemy Unit's Attack is canceled"* -- a targeted
    // Attack whole, an AoE for him alone (#226 reading 12). Read by
    // `engine/attack.mjs#answerRung` once the ability's phases have run.
    withdrawsFromAttack: new fields.BooleanField({ initial: false }),

    // A Skill that Skill Seal ends at once UNDER ITS REVISED TEXT: *"if this
    // Unit is inflicted with Skill Seal while PC/ME is Active, it is immediately
    // deactivated"*. Hundred-Faced Hassan's and Sasaki's Presence Concealment,
    // Darius III's Mad Enhancement: the Revised wording of both (#260 reading
    // 3d), so both templates carry it and the War picks whether it holds
    // (`engine/concealment.mjs#attachSealEnds`).
    endsOnSkillSeal: new fields.BooleanField({ initial: false }),

    // Which text of a revisable shared Skill this bearer's sheet prints:
    // Classic or Revised (`domain/revisions.mjs`). Read under a War's *As
    // printed*; under Classic or Revised the War's pick wins (#260 reading 3b).
    printedRevision: new fields.StringField({
      required: false, nullable: true, initial: null, choices: ["classic", "revised"],
    }),

    // *"…cannot be negated once Activated"*: Skill Seal does not end it, even
    // under a Revised text that says it would. Gilles de Rais (Saber)'s Mad
    // Enhancement, his sheet's own sentence (#260 reading 3j).
    unsealable: new fields.BooleanField({ initial: false }),

    // The Revised wording of the ability's description, printed on the sheet
    // when the War plays the Revised text (#260 reading 3f).
    descriptionRevised: new fields.StringField({ required: false, nullable: true, initial: null }),

    // A price in bodies, paid once the Combat Phase is over: Zabaniya's
    // *"Then, reduce the number of Hassans by 4d6"* (#226 reading 19). A dice
    // formula; `engine/legion.mjs#payLegionPrice` pays it.
    legionCost: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),

    // The attack this ability makes IS its user's Normal Attack, powered up:
    // every clause about "Normal Attacks" hears it, while its own Skill
    // mechanics (cooldown, Skill Seal) stay. All four Mana Bursts: Karna's, so
    // Vasavi Shakti's Divinity bonus reaches it (ruled 2026-10-14, #206
    // reading 5), then Raikou's and the Dioscuri's, whose sheets say the same.
    // None is offered on a Riding Attack (ruled 2026-10-14, #206). The field
    // that offered Raikou's there, `usedWithNormalAttack`, is gone with it.
    countsAsNormalAttack: new fields.BooleanField({ initial: false }),

    // A mode whose STARTING state its player chooses when the war starts, or
    // right after the summon: `{off, on}`, a label for each state. Karna's
    // Uncrowned Arms Mastership, *"at the start of the game, choose either
    // Effect 1 or 2"* (ruled 2026-10-14, #206 reading 3). Read by
    // `engine/opening-choice.mjs`.
    openingChoice: new fields.ObjectField({ required: false, nullable: true, initial: null }),

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

    // Abilities this use ALSO puts on cooldown (Ch. 04). Scáthach's Gate of Skye
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

    // Per-use requirements (Ch. 17). Authored at the top level as well as under
    // `targeting.limits`, and the schema declared neither.
    requirements: new fields.ArrayField(new fields.ObjectField()),

    // A resource that buys this use out of its cooldown entirely (Ch. 06).
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
      // An ability that IS this Unit's Normal Attack while some condition
      // holds. *"Can be used by Ozymandias as his Normal Attack while within
      // Ramesseum Tentyris."* The same substitution a driven mount performs
      // (`replacesRiderAction`), minus the mount and plus a predicate --
      // `{predicate: [...]}`, answered against the board by `actionSourceFor`.
      replacesNormalAttack: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      // A per-ability Round gate, which OVERRIDES the global one (Ch. 04).
      // Declared here as well as on `NoblePhantasmData` because a SKILL may be
      // `categorizedAsNP` and therefore inside the gate's scope -- the Magic
      // Crest is exactly that, and its own "from Round 3" is the row that keeps
      // a Master usable before Round 6.
      npGateRound: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      // "Categorized as NP" is the mechanical dividing line for NP Seal, NP
      // DmUp and the Luck Check exclusions -- distinct from actually being one.
      categorizedAsNP: new fields.BooleanField({ initial: false }),
      // Blocked by NP Seal and not by Skill Seal, without being an NP or counting
      // as one anywhere else. Karna's Vasavi Shakti Activation is a free Skill
      // that is part of a Noble Phantasm (ruled 2026-10-14, #206 reading 9). The
      // editor offered the checkbox and nothing kept it.
      countsForNPSeal: new fields.BooleanField({ initial: false }),
      // An open tag set: which CATEGORIES this ability also counts as. Jack's
      // Mist exempts "the Instinct Skill of Rank B or higher" and her sheet
      // then names five other skills that count as Instinct, so the list has
      // to live on the abilities rather than in a table in code
      // (`rules/bounded-fields.mjs#hasCategory`).
      categorizedAs: new fields.SetField(new fields.StringField({ blank: false })),
      // "Eye of the Mind (only when Active/its buffs are in effect)" — the
      // effect ids whose presence makes the tag above count.
      categorizedWhile: new fields.SetField(new fields.StringField({ blank: false })),
      // The War this ability exists in, as a predicate on its bearer (#287, #314).
      // Gawain: *"If playing without Day or Night Rounds, the effect of this Skill
      // is (Active)…"*: two abilities, one `["war:phase:none"]`, the other
      // `["not:war:phase:none"]`. Failing, the ability is hidden and refused, and
      // a passive's rules do not apply.
      availableWhen: new fields.ArrayField(new fields.StringField({ blank: false })),

      // A weak point the ATTACKER may aim at (Ch. 45). Achilles' Heel is
      // the only one; `rules/weak-point.mjs` holds the schema in prose.
      weakPoint: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      // An ability that IS a Riding Attack rather than one that benefits from
      // one. Troias Tragōidia is the only one: *"used in the form of a Riding
      // Attack, with a distance of 13 panels"* — and 13 is the NP's reach, not
      // the rider's MOV, which is why it is stated here at all.
      ridingAttack: new fields.SchemaField({
        distance: new fields.NumberField({ integer: true, required: false, nullable: true, initial: null }),
      }),

      // Spent for the rest of the game rather than put on a cooldown.
      // Akhilleus Kosmos is the only one: *"After that, Akhilleus Kosmos is
      // broken; all its effects are lost and cannot be used for the rest of the
      // game."* There is no number of Turns after which it comes back, so a
      // cooldown cannot say it.
      expendsPermanently: new fields.BooleanField({ initial: false }),
      // Set when it has been. Written once and never cleared.
      expended: new fields.BooleanField({ initial: false }),

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
      // Whether bearing this effect stops the Unit acting. Read by Ch. 08's
      // Master-protection invalidation, which had to guess from a hard-coded
      // list before any effect could say so itself.
      preventsAction: new fields.BooleanField({ initial: false }),
      // An effect that lands PAST the target's defences. The 'Kiritsugu' debuff
      // *"ignores Debuff Resist and Debuff Immune effects"*: the registry and
      // the applier read both, and no schema kept either, so the Mark never
      // passed an immunity in a live world (#98).
      bypassesImmunity: new fields.BooleanField({ required: false, initial: false }),
      bypassesResistance: new fields.BooleanField({ required: false, initial: false }),
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
      // Actions that run once, when an instance is CREATED -- not when it is
      // refreshed. Shock's "current Agility -3": a current value is stored, so
      // a clause that changes it pays once rather than deriving (#106).
      onApply: new fields.ArrayField(new fields.ObjectField()),
      // ...or every time it LANDS, a refresh included: the Nameless Forest's
      // marker lands each Round, and each landing is a new Token and a new loss,
      // gated by the one chance the escape resistance lowers (#247 D3).
      onApplyEachLanding: new fields.BooleanField({ initial: false }),
      defaultMagnitude: new fields.NumberField({ required: false, nullable: true, initial: null }),
      // How many charges an instance starts with, for count-stacked effects.
      // Read by `resolveStacking` since it was written, against a schema that
      // did not declare it -- so `def.uses` was always undefined and every
      // count-limited effect fell back to 1.
      uses: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      // A ceiling on how many instances of a `magnitudeStacks` effect one Unit
      // may hold. Ch. 45 sketches it beside the stacking rule and Kingprotea's
      // Proliferation is the first to state one: *"Kingprotea can only have a
      // maximum of 10 Proliferation stocks."*
      maxStacks: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true, min: 1 }),
      // The definition's `rules` are collected ONCE for a bearer however many
      // instances it holds, so a `perStack` element may live on the stock it
      // counts. Kingprotea's Proliferation: a stock's effects belong to the
      // stock, and a Skill Seal on Huge Scale does not take them (#198 reading 8).
      rulesOncePerBearer: new fields.BooleanField({ required: false, initial: false }),
      // What a barrier effect absorbs, and where its pool lives (§A.3's
      // barrier tier). EMIYA's Rho Aias is the only instance.
      absorbs: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      defaultDuration: new TickField(),
      unremovable: new fields.BooleanField({ initial: false }),
      // Ch. 14: *"Decoy is not affected by Debuff Resist or Immune
      // effects when a Unit applies it on itself or on another allied Unit."*
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
       * A bounded field this ability creates (Ch. 28). Untyped for the same
       * reason rule elements are.
       *
       * Declared on `NoblePhantasmData` alone until Pale Rider, because every
       * field in the corpus so far belonged to a Noble Phantasm — Chaos
       * Labyrinthos, Unlimited Blade Works, Sikera Ušum, The Mist. Nothing in
       * Ch. 28 makes that a rule: a bounded field is an *area*, and what opens
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
      // The War this ability exists in, as a predicate on its bearer (#287, #314).
      // Gawain: *"If playing without Day or Night Rounds, the effect of this Skill
      // is (Active)…"*: two abilities, one `["war:phase:none"]`, the other
      // `["not:war:phase:none"]`. Failing, the ability is hidden and refused, and
      // a passive's rules do not apply.
      availableWhen: new fields.ArrayField(new fields.StringField({ blank: false })),

      // A weak point the ATTACKER may aim at (Ch. 45). Achilles' Heel is
      // the only one; `rules/weak-point.mjs` holds the schema in prose.
      weakPoint: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      // An ability that IS a Riding Attack rather than one that benefits from
      // one. Troias Tragōidia is the only one: *"used in the form of a Riding
      // Attack, with a distance of 13 panels"* — and 13 is the NP's reach, not
      // the rider's MOV, which is why it is stated here at all.
      ridingAttack: new fields.SchemaField({
        distance: new fields.NumberField({ integer: true, required: false, nullable: true, initial: null }),
      }),

      // Spent for the rest of the game rather than put on a cooldown.
      // Akhilleus Kosmos is the only one: *"After that, Akhilleus Kosmos is
      // broken; all its effects are lost and cannot be used for the rest of the
      // game."* There is no number of Turns after which it comes back, so a
      // cooldown cannot say it.
      expendsPermanently: new fields.BooleanField({ initial: false }),
      // Set when it has been. Written once and never cleared.
      expended: new fields.BooleanField({ initial: false }),
      /**
       * A bounded field this Noble Phantasm creates (Ch. 28). Untyped for the
       * same reason rule elements are: ten fields are points in one six-axis
       * model, and a rigid schema would reject the eleventh.
       */
      field: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      // Ordered scale plus unordered qualifiers (Ch. 28). Stored as
      // authored; comparison uses the highest scale tag present.
      npTags: new fields.ArrayField(new fields.StringField()),
      // A per-ability round gate composes with the global one by max():
      // Ozymandias's Ramesseum Tentyris needs 7 full Rounds.
      npGateRound: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      // An ability that IS this Unit's Normal Attack while some condition
      // holds. *"Can be used by Ozymandias as his Normal Attack while within
      // Ramesseum Tentyris."* The same substitution a driven mount performs
      // (`replacesRiderAction`), minus the mount and plus a predicate --
      // `{predicate: [...]}`.
      replacesNormalAttack: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      isPassive: new fields.BooleanField({ initial: false }),
    };
  }
}

export class CommandSpellData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      contentId: new fields.StringField({ required: false, blank: true }),
      // Ch. 41, and it must be here rather than only on `abilityCommon`:
      // the pack builder emits `contentVersion` for EVERY item, and a model
      // that cannot hold it makes the content sync non-convergent -- it would
      // rewrite the document on every world load, for ever.
      contentVersion: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      description: new fields.HTMLField({ required: false, blank: true }),
      cost: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      /**
       * Kill Yourself costs 1 for a High Rank Master and 2 for a Low Rank one,
       * so cost is not always a scalar. `cost` above stays as the fallback for
       * anything reading the flat field.
       */
      costByMasterRank: new fields.ObjectField({ required: false, nullable: true, initial: null }),
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
      // Ch. 41, and it must be here rather than only on `abilityCommon`:
      // the pack builder emits `contentVersion` for EVERY item, and a model
      // that cannot hold it makes the content sync non-convergent -- it would
      // rewrite the document on every world load, for ever.
      contentVersion: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      description: new fields.HTMLField({ required: false, blank: true }),
      rank: new RankField(),
      // The passive half: what the Essence does to its Master's Servant. Read
      // off the COPY the Servant holds (`engine/master-essence.mjs`), never off
      // the Master, so the sheet's maxima, the damage pipeline and the NP gate
      // all read it as any passive of their own.
      rules: new fields.ArrayField(new fields.ObjectField()),
      // The one-use half (*"1 use only, Player decides when it's used"*), in a
      // Command Spell's own vocabulary so the same offer and spend read it:
      // `timing.window`, `requirements`, `effect`. Empty on a passive Essence.
      timing: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      requirements: new fields.ArrayField(new fields.ObjectField()),
      effect: new fields.ArrayField(new fields.ObjectField()),
      maxUses: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true, min: 0 }),
      // World state on the Master's own Essence: spent once, gone (#241).
      timesUsed: new fields.NumberField({ required: true, initial: 0, integer: true, min: 0 }),
      // On a Servant's copy: the Master whose Essence it is. Null on the
      // Master's own. The copy is the Contract's, and goes when it does.
      grantedBy: new fields.StringField({ required: false, nullable: true, initial: null }),
    };
  }
}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      contentId: new fields.StringField({ required: false, blank: true }),
      // Ch. 41, and it must be here rather than only on `abilityCommon`:
      // the pack builder emits `contentVersion` for EVERY item, and a model
      // that cannot hold it makes the content sync non-convergent -- it would
      // rewrite the document on every world load, for ever.
      contentVersion: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      description: new fields.HTMLField({ required: false, blank: true }),
      equipped: new fields.BooleanField({ initial: false }),
      // Its rules run while it is HELD, equipped or not: Avalon is not worn, it
      // is placed inside its holder (#230). Each rule says whom it is for.
      worksWhenHeld: new fields.BooleanField({ initial: false }),
      // Abilities its holder gains while holding it: `{kinds, abilities}`, the
      // holder's types it reaches and the content ids it grants. Avalon gives a
      // Master its own Avalon and the right to pass it on (#230).
      grants: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      // The Unit that bound it to its holder (Avalon: Arturia, who placed it).
      // Read by the board's bond pass (`rules/bonds.mjs`).
      bondUnitId: new fields.StringField({ required: false, nullable: true, initial: null, blank: true }),
      // ...and whose Master that Unit was when it did, so the bond outlives her
      // leaving the board.
      bondMasterId: new fields.StringField({ required: false, nullable: true, initial: null, blank: true }),
      // The clocks of the abilities it grants, as the Tick each is ready at:
      // `{ "avalon-master": 41 }`. The Master's Avalon Cooldown is the Item's,
      // carried from holder to holder and running wherever it is (#230
      // readings 26, 28). Written as it moves, never authored.
      grantClocks: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      // "Items are an ability with a quantity" (Ch. 17), and the default is that
      // they CANNOT be passed: "Items cannot be traded/given/passed to other
      // Units unless stated." Only [Semiramis' Poison] states otherwise, so a
      // permissive default would be wrong for everything except the exception.
      quantity: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      transferable: new fields.BooleanField({ initial: false }),
      transferRange: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      transfersPerTurn: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      consumeEffect: new fields.ArrayField(new fields.ObjectField()),

      // *"Cannot be obtained by Nursery or her Master."* Whom this item refuses
      // to be held by, as a ROLE PAIR against a content id -- `{ofUnit, roles}`
      // -- because an actor id is random per world and would not survive the
      // Servant being placed twice. Read by `rules/items.mjs#acquisitionTarget`.
      barredFrom: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      rules: new fields.ArrayField(new fields.ObjectField()),
    };
  }
}
