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
    if ((this.health.max === null || this.health.max === 0) && this.baseHealth) {
      this.health.max = this.baseHealth;
      if (this.health.value === null || this.health.value === 0) this.health.value = this.baseHealth;
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
      footprint: new fields.SchemaField({
        w: new fields.NumberField({ integer: true, initial: 3, min: 1 }),
        h: new fields.NumberField({ integer: true, initial: 3, min: 1 }),
      }),
      capacity: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      /** The Servant that created it, whose effects are reversed on destruction. */
      ownerId: new fields.StringField({ required: false, nullable: true, initial: null }),
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

      // A per-round charge on the owner's Master, which may REPLACE another
      // cost rather than add to it (§15.4's `supersedes`). The Hanging Gardens
      // is the case: "This effect overwrites the normal Master Health loss when
      // a Servant uses its NP."
      upkeep: new fields.SchemaField({
        amount: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        supersedes: new fields.ArrayField(new fields.StringField({ blank: false })),
      }, { required: false, nullable: true, initial: null }),

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
      if (this.health.value === null || this.health.value === 0) this.health.value = this.baseHealth;
    }
  }
}

export class StructureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { ...unitCommon() };
  }
}
