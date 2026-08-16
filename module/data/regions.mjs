/**
 * @file Region behaviour schemas — how the board carries terrain and bases.
 * @see docs/22-data-models.md §22.10, docs/42-terrain.md §42.1, docs/19-environment.md §19.1
 *
 * `system.json` has declared these four behaviour types since the manifest was
 * written, and none of them had a data model — so a GM could add an `fgt.terrain`
 * behaviour to a Region and it would carry no type, no duration and no meaning.
 *
 * Foundry's own `Region` is the right home for both terrain and home bases:
 * membership is maintained natively, `tokenEnter`/`tokenExit` fire natively, and
 * a terrain area *"may be non-contiguous"* — which a Region already is.
 */

const fields = foundry.data.fields;
const Base = foundry.data.regionBehaviors.RegionBehaviorType;

/**
 * A terrain area (Ch. 42).
 *
 * `followsSource` defaults to **false**, and that is the rule rather than a
 * convenience: *"the created Terrain Effect area will not follow its user unless
 * stated."* Quetzalcoatl's `Sol` is one of the few that does, because it is
 * phrased as an area *around her* rather than one placed on the field.
 */
export class TerrainBehavior extends Base {
  static defineSchema() {
    return {
      /** One or more types; areas may overlap and a Region may carry several. */
      types: new fields.ArrayField(new fields.StringField({ blank: false })),
      /** `null` is permanent — map terrain, as opposed to a created area. */
      duration: new fields.StringField({ required: false, nullable: true, initial: null }),
      sourceUnitId: new fields.StringField({ required: false, nullable: true, initial: null }),
      followsSource: new fields.BooleanField({ initial: false }),
      createdOnTurn: new fields.NumberField({ required: false, nullable: true, initial: null }),
    };
  }
}

/**
 * A faction's Home Base (Ch. 19 §19.1).
 *
 * `isSecondary` exists for Semiramis's Hanging Gardens, which *"counts as a
 * second Home Base for Semiramis' Faction"* — which is why membership is
 * "inside **any** region tagged homeBase and owned by my faction" rather than a
 * single-region test.
 */
export class HomeBaseBehavior extends Base {
  static defineSchema() {
    return {
      factionId: new fields.StringField({ required: true, blank: false }),
      isSecondary: new fields.BooleanField({ initial: false }),
    };
  }
}

/** A bounded field (Ch. 43). Declared so content can place one; rules pending C4. */
export class NPFieldBehavior extends Base {
  static defineSchema() {
    return {
      fieldId: new fields.StringField({ required: true, blank: false }),
      ownerUnitId: new fields.StringField({ required: false, nullable: true, initial: null }),
      permeable: new fields.BooleanField({ initial: true }),
      duration: new fields.StringField({ required: false, nullable: true, initial: null }),
    };
  }
}

/** A platform's footprint (Ch. 20). Declared for the same reason. */
export class PlatformBehavior extends Base {
  static defineSchema() {
    return {
      platformId: new fields.StringField({ required: true, blank: false }),
      level: new fields.NumberField({ required: true, integer: true, initial: 1 }),
      carriesOccupants: new fields.BooleanField({ initial: true }),
    };
  }
}
