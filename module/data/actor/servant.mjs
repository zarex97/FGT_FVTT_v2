/**
 * @file The Servant actor schema.
 * @see docs/22-data-models.md, docs/04-units.md
 */

import { unitCommon, combatantCommon } from "./_shared.mjs";
import { RankField } from "../fields.mjs";
import { lookup } from "../../domain/tables.mjs";
import { Rank } from "../../domain/rank.mjs";
import { baseAttackFor } from "../../domain/base-attack.mjs";
import { maxHealthFor } from "../../domain/health.mjs";

const fields = foundry.data.fields;

export class ServantData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      ...unitCommon(),
      ...combatantCommon(),
      trueName: new fields.StringField({ required: false, blank: true }),

      /**
       * How many panels this Servant stands on (Ch. 04 §4.12).
       *
       * `1x1` for every Servant in the corpus but one. Kingprotea's *Huge
       * Scale* grows her from 1x1 to 4x4 as Proliferation stocks accumulate, and
       * the growth is a DERIVED delta (`SizeStep`, `rules/derived.mjs`) rather
       * than a write — so the stored value is the size she starts at and the
       * live one is the size she is.
       *
       * A Summon or a Platform has carried this field since they existed
       * (`data/actor/simple.mjs`); a Servant could not, which is why she is the
       * first Servant a token has ever had to resize for.
       */
      footprint: new fields.SchemaField({
        w: new fields.NumberField({ integer: true, initial: 1, min: 1 }),
        h: new fields.NumberField({ integer: true, initial: 1, min: 1 }),
      }),

      // Every class this Servant qualifies for -- Semiramis is Assassin AND
      // Caster -- kept as a set because content and rules both ask "is it a X".
      servantClasses: new fields.SetField(new fields.StringField({ blank: false })),

      // A stance (Ch. 44 §44.1), and only Achilles has one. Blank means "the
      // spec's default", so an actor imported before the field existed reads
      // correctly rather than as an unknown state. `stanceSpec` is authored on
      // the sheet and compiled by `tools/lib/content.mjs`; `rules/stance.mjs`
      // is the only thing that interprets either.
      stance: new fields.StringField({ required: false, blank: true }),
      stanceSpec: new fields.ObjectField({ required: false, nullable: true, initial: null }),

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
      // Which summon type is bound to which enemy, by enemy id. Kagome Kagome:
      // *"if Doomsday Come is activated again, the SAME Kagome Spirit will be
      // summoned for the same enemy Unit if that enemy Unit was previously
      // within Doomsday Come."* The memory outlives the field, so it lives on
      // the Servant rather than on the area.
      summonAssignments: new fields.ObjectField({ required: false, initial: () => ({}) }),
      // What a field's own summons looked like when their field last closed.
      // *"If Ramesseum Tentyris is reactivated, the Sphinxes will respawn
      // within the Complex, but with the same Stats as when they disappeared."*
      //
      // Written on the OWNER because that is where the memory has to live: the
      // field is about to stop existing, and `summonAssignments` beside it
      // already sets the precedent for a summon fact that outlives its area.
      // Runtime state, never authored, so it is not in `actorSystem()`.
      fieldSummonStats: new fields.ObjectField({ required: false, initial: () => ({}) }),
      // The Queen's Glass Game's second effect, spent.
      //
      // > *"Can only be used once during the entire game."*
      //
      // On the ACTOR rather than on an effect instance, because *"the entire
      // game"* spans her defeat and any revival: a Nursery brought back by a
      // Command Spell and defeated again gets nothing. World state, so it is
      // not an authored key.
      glassGameSpent: new fields.BooleanField({ initial: false }),

      // ZON exceptions, both from the reference set (Ch. 16 §16.3). Semiramis
      // aboard the Hanging Gardens is exempt outright; the Dioscuri satisfy ZON
      // if *either* twin is inside, so the test is `any` across the partners.
      zonExempt: new fields.BooleanField({ initial: false }),
      zonPartnerIds: new fields.SetField(new fields.DocumentIdField()),

      // Ch. 16 §16.8's `LinkedUnitGroup` (D16.7) — a general mechanism, not a
      // Dioscuri special case: the shape recurs for a Servant with a permanent
      // summon, and for a Master-Servant pair moving under Passenger Seat.
      //
      // The SETTINGS are authored in YAML; `memberIds` is resolved at summon,
      // the way `masterId` and `zonPartnerIds` are. An empty `id` means no
      // group at all — a Servant document that never authored one still gets a
      // SchemaField, and `{id: ""}` must not read as membership.
      linkedGroup: new fields.SchemaField({
        id: new fields.StringField({ required: false, blank: true, initial: "" }),
        // CONTENT ids, authored. Distinct from `memberIds` below, which holds
        // ACTOR ids and is resolved at summon -- the same translation
        // `masterId` gets, and for the same reason: content cannot know the
        // id of an actor that does not exist yet.
        partners: new fields.ArrayField(new fields.StringField({ blank: false })),
        memberIds: new fields.SetField(new fields.DocumentIdField()),
        // Maximum Chebyshev distance between members. `null` = unleashed.
        leash: new fields.NumberField({
          required: false, nullable: true, initial: null, integer: true, min: 0,
        }),
        // "" = a member's death is its own business. `ignoresRevival` is the
        // Dioscuri's reading (Ch. 41 Q11): the survivor's own revival chain is
        // SKIPPED, because a one-sided revival would leave one twin alive with
        // a dead partner, which the binding forbids.
        // `blank: true` is REQUIRED, not decorative. A `StringField` carrying
        // `choices` defaults to `blank: false`, so an `initial: ""` fails its
        // own validation -- and because that made the whole `system` invalid,
        // EVERY actor in a world without a linked group failed to initialize.
        // Found on a live board; the twins hid it, because both carry non-blank
        // values and the compendium reads fine.
        linkedDeath: new fields.StringField({
          required: false, blank: true, initial: "", choices: ["", "ignoresRevival", "ownChain"],
        }),
        sharedCooldowns: new fields.StringField({
          required: false, blank: true, initial: "", choices: ["", "byName"],
        }),
        // What one member counts as wherever the rules count Units: the four
        // turn-budget pools, the multi-Servant tax, and the roster allowance.
        // *"each one counts as 0.5 Units"* qualifies none of them.
        unitWeight: new fields.NumberField({ initial: 1, min: 0 }),
        zonSatisfaction: new fields.StringField({
          required: false, initial: "all", choices: ["all", "any"],
        }),
        // `union` makes a damage resolution read BOTH members' modifier bags.
        // Only the joint Noble Phantasm asks for it, and it double-counts by
        // design (Ch. 41 Q12).
        modifierCombination: new fields.StringField({
          required: false, initial: "separate", choices: ["separate", "union"],
        }),
        summonTogether: new fields.BooleanField({ initial: false }),
      }),

      // "Before play, select only one Noble Phantasm, either (a) or (b). The
      // unselected Noble Phantasm is unusable." Normal's Archer, Caster and
      // Berserker each offer two; the setup wizard writes the GM's pick and
      // marks the loser `expended`, which is what "unusable" already means.
      // Empty for every Servant that offers no such choice.
      npChoice: new fields.ArrayField(new fields.StringField({ blank: false })),

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
    // Base Attack is DERIVED from STR and MAG, and the table beats the sheet:
    // *"if you find a value of Base attack that differs from this calculation
    // choose the value of this table instead of what is on the character
    // sheet."* Max Health below now reads the same way — see the note there.
    //
    // Here rather than at summon so a Servant dragged straight onto the board
    // is right too, and because it reads `grantedSteps` — which the summon
    // patch writes — so the two compose instead of double-counting. Ch. 41 Q50.
    //
    // ABOVE the `undamageable` return: Pale Rider cannot be damaged but he
    // still deals damage, and BA(MAG) 200 is what Contagion is priced from.
    this.baseAttack = baseAttackFor(this);

    // Pale Rider: "Base Health: —". A Servant who cannot be damaged has no
    // Max Health to derive, and the END table would have given him one.
    if (this.undamageable) {
      this.health.value = null;
      this.health.max = null;
      return;
    }
    if (this.health.max === null || this.health.max === 0) {
      // The TABLE beats the sheet, the same way Base Attack's does — see
      // `domain/health.mjs#maxHealthFor`, which holds the rule and the four
      // sheets that disagree with it. Pure and injected for the same reason
      // `baseAttackFor` is: a data model may import from `domain` only.
      const max = maxHealthFor(this, lookup, Rank);
      this.health.max = max;
      // `=== null` and NOT `=== 0`. A stored zero is a Unit that has been
      // emptied; only `null` is one that has never been given Health at all.
      // Reading the two as the same thing refilled a defeated Servant to
      // maximum on the very next data preparation.
      if (this.health.value === null) this.health.value = max;
    }
  }
}
