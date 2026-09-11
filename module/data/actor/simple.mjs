/**
 * @file Civilian, Summon, Platform and Structure schemas.
 *
 * Grouped in one file because each is a thin specialization; splitting them
 * would be four files of five lines.
 */

import { unitCommon, combatantCommon } from "./_shared.mjs";

const fields = foundry.data.fields;

export class CivilianData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { ...unitCommon() };
  }
}

export class SummonData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...unitCommon(),
      ...combatantCommon(),
      summonerId: new fields.DocumentIdField({ required: false, nullable: true, initial: null }),
      // Summons do not count toward the turn budget, and several persist across
      // their field's deactivation with their stats intact.
      countsTowardBudget: new fields.BooleanField({ initial: false }),
      // Medea's second clause: "The same Dragon Tooth Warrior can only
      // Move/Attack once per Turn." Distinct from the budget exemption -- being
      // outside the Unit limit does not mean acting without limit.
      actsOncePerTurn: new fields.BooleanField({ initial: false }),
      // Stats stated RELATIVE to the summoner. The Kagome Spirits are the
      // first: *"Agility: Pale Rider's plus 2"*, *"Luck: Same as Pale
      // Rider's"* -- numbers that cannot be written on the sheet because they
      // are not numbers, and are resolved at placement from the summoner's
      // live values. Untyped for the same reason rule elements are.
      inherit: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      expiresAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      // Bašmu: "Bašmu cannot leave the HGoB. If HGoB is removed from the
      // field while Bašmu is summoned, it disappears." A Foundry DOCUMENT id
      // (unlike `platformContentId`, which is content-authored and stable) --
      // this is written at summon time, once the real platform actor exists,
      // and matches `engine/scene-levels.mjs#reverseOwnerEffects`'s own
      // `boundToPlatformId` filter, which dismisses unconditionally: nothing
      // in the source states an exception, so there is no separate flag to
      // gate it.
      boundToPlatformId: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
      // Bašmu: "when it Moves to any occupied panels, all Units occupying
      // said panels are knocked back by 1 panel until the space is free."
      // Movement legality otherwise refuses a panel already standing on
      // something; this is the one summon in the reference set that displaces
      // rather than being refused.
      movesOntoOccupiedPanels: new fields.BooleanField({ initial: false }),
    };
  }

  /**
   * Fill Health from `baseHealth`, the same shape `ServantData`'s own
   * override uses minus its END-rank table fallback -- a Summon states its
   * Health directly, it never derives one.
   * @inheritdoc
   */
  prepareBaseData() {
    // The Kagome Spirits: "Health: - (Cannot be damaged)". The same
    // stand-aside `ServantData` makes, for the same reason -- a summon that
    // states no Health must not be given one.
    if (this.undamageable) {
      this.health.value = null;
      this.health.max = null;
      return;
    }
    if ((this.health.max === null || this.health.max === 0) && this.baseHealth) {
      this.health.max = this.baseHealth;
      // `=== null`, not zero: a Summon or a Platform at zero has been
      // destroyed. See `data/actor/servant.mjs` for the defect this closes.
      if (this.health.value === null) this.health.value = this.baseHealth;
    }
  }
}

export class PlatformData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...unitCommon(),
      description: new fields.HTMLField({ required: false, blank: true }),
      // A Platform can Attack (the HGoB's own Dragon Wing Warriors and Aerial
      // Garden of Vanity both read it) but has no Parameters of its own on
      // any reference sheet, so this is declared directly rather than by
      // spreading the whole of `combatantCommon()`.
      baseAttack: new fields.SchemaField({
        str: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        mag: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      }),
      // NULLABLE, because a pocket dimension has no ground presence at all.
      // Ch. 20 §20.6 says so of the Storm Border outright -- *"it is not on the
      // board at all while it is submerged"* -- and a non-nullable SchemaField
      // turned an authored `footprint: null` into the 3x3 default, which is a
      // submarine-shaped hole in the middle of the board.
      footprint: new fields.SchemaField({
        w: new fields.NumberField({ integer: true, initial: 3, min: 1 }),
        h: new fields.NumberField({ integer: true, initial: 3, min: 1 }),
      }, { required: false, nullable: true, initial: { w: 3, h: 3 } }),

      /**
       * A POCKET DIMENSION this platform is, rather than a place on the board
       * (Ch. 20 §20.6). Nemo's Storm Border is the only one.
       *
       * Untyped for the same reason rule elements are: the content validator
       * checks its shape at build time, and a rigid schema here would refuse a
       * dimension a module introduces. It carries who may enter and how, the
       * clock, where it puts everybody on the way out, what its occupants may
       * not do, and what happens if its owner dies inside it.
       */
      dimension: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      /**
       * The panel a dimension submerged FROM, stamped at entry.
       *
       * Its travel allowance is measured from here, and a submerged Unit is on
       * the dimension's own Scene Level rather than in the ground board's unit
       * list -- so there is no live panel to fall back on. Not authored; written
       * once by `engine/dimension.mjs#enterDimension` and read once on the way
       * out.
       */
      submergedFrom: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      capacity: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      /** The Servant that created it, whose effects are reversed on destruction. */
      ownerId: new fields.StringField({ required: false, nullable: true, initial: null }),

      // Stats stated RELATIVE to the summoner, resolved at placement from that
      // Servant's live values. `SummonData` has declared this since the Kagome
      // Spirits (*"Agility: Pale Rider's plus 2"*) and a Platform could not,
      // so `tools/lib/content.mjs` compiled the authored value and the
      // DataModel dropped it on load.
      //
      // Found live: the Quetzalcoatlus's *"Luck: Shared with Quetz's"* placed
      // it at 0 while she stood next to it with 20. The sixth authored key to
      // be lost this way -- `itemCost`, `summonVariant`, `rules`,
      // `itemHandling` and `aftermath` were the others.
      inherit: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      // "During Semiramis' Turn, the HGoB can Move/Attack once per Turn."
      // `rules/budget.mjs#canConsume` reads this the same way `SummonData`'s
      // own field of the same name is meant to -- a platform is exempt from
      // every POOL (D18.1), which is a different rule from the per-unit cap
      // this gates.
      actsOncePerTurn: new fields.BooleanField({ initial: true }),
      /** Its own Scene Level (D20.1). Every active platform gets one. */
      level: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      // The Foundry `Level` document's id, as opposed to `level` above, which is
      // the ordinal the cross-level rules compare. Two different things with
      // almost the same name, so: this one is what `scene.levels.get()` takes.
      levelId: new fields.StringField({ required: false, nullable: true, initial: null }),

      // What a platform costs to keep, in EITHER of the two senses a sheet
      // uses, which is why this is untyped the way `NPFieldBehavior.upkeep` and
      // every rule element are:
      //
      //   `{amount, supersedes}` -- a charge on the owner's Master that REPLACES
      //   another cost rather than adding to it (§15.4). The Hanging Gardens:
      //   *"this effect overwrites the normal Master Health loss when a Servant
      //   uses its NP."* Read by `engine/attack.mjs` when an NP is paid for.
      //
      //   `{every, cost: {kind, amount, payer}, endWhenUnaffordable}` -- a
      //   RECURRING toll, identical in shape to a bounded field's and swept by
      //   the same `engine/fields.mjs#runUpkeep`. Quetzalcoatl's Quetzalcoatlus:
      //   *"after every 1◈ Turns, Quetz's Master's Health is reduced by 25 at
      //   the end of the Turn."*
      //
      // A SchemaField of the first shape could not carry the second, and two
      // fields would let a sheet declare a toll under the name the cost reader
      // watches.
      upkeep: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      // Whether the owner may switch it off, and when. Identical in shape and
      // meaning to a bounded field's, and read through the same
      // `rules/platforms.mjs#deactivationVerdict`, because Quetzalcoatl's two
      // Noble Phantasms carry the same block -- one platform, one field -- and
      // differ only in whether it has a `lockout`.
      deactivation: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      // The tick it was activated on, which a `lockout` counts from, and the
      // tick its upkeep last charged, which a `every` period counts from. Both
      // are stamped at runtime, never authored -- and both must survive a
      // reload, which a counter held by whichever client happens to be the
      // scheduler does not.
      activatedAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      lastUpkeepAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

      // A mount whose RIDER drives it: while aboard, the rider's Move and
      // Normal Attack are the platform's, spending the rider's action rather
      // than the platform's own. Every other platform in the set carries its
      // passengers passively. See `rules/platforms.mjs#actionSourceFor`.
      replacesRiderAction: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      // "The HGoB counts as a second Home Base for Semiramis' Faction."
      // `HomeBaseBehavior.isSecondary` was declared for this clause and nothing
      // ever created such a Region; standing on the platform is the membership
      // test instead, because the base moves.
      countsAsHomeBase: new fields.BooleanField({ initial: false }),

      // Cross-level rules are per-platform, not global (Ch. 20 §20.7): the
      // author confirmed protection is decided case by case, so there is no
      // global rule to derive -- only a four-axis model each platform picks a
      // point in.
      crossLevel: new fields.SchemaField({
        occupantTargeting: new fields.StringField({
          initial: "free", choices: ["forbidden", "rangedOnly", "free"] }),
        requiresBoarding: new fields.BooleanField({ initial: false }),
        aoePassengerFactor: new fields.NumberField({ initial: 1, min: 0 }),
        aoeMastersImmune: new fields.BooleanField({ initial: false }),
        outboundTargeting: new fields.StringField({
          initial: "free", choices: ["forbidden", "rangedOnly", "free"] }),
        forbidDirectlyBelow: new fields.BooleanField({ initial: false }),
      }),
    };
  }

  /**
   * Fill Health from `baseHealth` -- see `SummonData`'s override of the same
   * name. Found live: the Hanging Gardens platform actor had `health: {value:
   * 0, max: 0}` despite `baseHealth: 6000` in its content.
   * @inheritdoc
   */
  prepareBaseData() {
    if ((this.health.max === null || this.health.max === 0) && this.baseHealth) {
      this.health.max = this.baseHealth;
      // `=== null`, not zero: a Summon or a Platform at zero has been
      // destroyed. See `data/actor/servant.mjs` for the defect this closes.
      if (this.health.value === null) this.health.value = this.baseHealth;
    }
  }
}

export class StructureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...unitCommon(),

      // "Only Masters can destroy a Bloodmark, and it is done by simply
      // Attacking it." A list of unit KINDS, empty meaning anybody -- the
      // targeting filter refuses everyone else with a reason.
      destroyableBy: new fields.ArrayField(new fields.StringField({ blank: false })),

      // "Bloodmarks can only be seen from a distance of 3 cells Maximum."
      // Per-viewer and PRESENTATION ONLY, the same ruling D44.9 made for
      // Disguise: a hidden mark is still on the board for every rule, so
      // hiding it can never desynchronize state.
      visibleWithin: new fields.NumberField({
        required: false, nullable: true, initial: null, integer: true, min: 0,
      }),

      // Which field this object belongs to, so tearing the field down takes
      // its marks with it and destroying a mark can end the field.
      fieldId: new fields.StringField({ required: false, nullable: true, initial: null }),

      // Who put it there. NOT `summonerId`, which is declared on `SummonData`
      // alone -- writing to a field this type does not have is how the first
      // four Bloodmarks placed themselves and then could not be found again.
      placedById: new fields.DocumentIdField({ required: false, nullable: true, initial: null }),

      // Where it stands, written at placement rather than read back off the
      // token. A Structure never moves, and the token index lags its own
      // creation -- the fourth Bloodmark completed no square because its token
      // was not yet queryable when the check ran. Note `panels` on a unit is
      // `range.panels`, a NUMBER: this needed a name of its own.
      panel: new fields.SchemaField({
        i: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        j: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      }, { required: false, nullable: true, initial: null }),
    };
  }
}
