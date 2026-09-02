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

/**
 * A bounded field (Ch. 43).
 *
 * Ten fields across nine Servants are points in one six-axis model, so the
 * behaviour carries the axes rather than a per-field flag: geometry, membership,
 * isolation, interior rules, duration/extension and vulnerability. Anything a
 * field does is a value here, and nothing in the schema is named after a Servant.
 */
export class NPFieldBehavior extends Base {
  static defineSchema() {
    return {
      fieldId: new fields.StringField({ required: true, blank: false }),
      ownerUnitId: new fields.StringField({ required: false, nullable: true, initial: null }),
      ownerMasterId: new fields.StringField({ required: false, nullable: true, initial: null }),
      ownerFaction: new fields.StringField({ required: false, nullable: true, initial: null }),
      npTags: new fields.ArrayField(new fields.StringField()),

      // Authored data, untyped for the same reason rule elements are: the
      // content validator checks the shape at build time, and a rigid schema
      // would reject a field shape a module introduces.
      geometry: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      membership: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      isolation: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      interior: new fields.ArrayField(new fields.ObjectField()),
      extension: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      vulnerabilities: new fields.ArrayField(new fields.ObjectField()),
      onEnd: new fields.ArrayField(new fields.ObjectField()),
      // Rules the AREA runs at a time boundary, as opposed to `interior`,
      // which are standing contributions. EMIYA's Unlimited Blade Works is the
      // first: "at the start of every Turn, all enemy Servants within perform
      // an Evade roll; if failed, that Unit receives (25 x 1d4) STR damage."
      // It belongs to the field rather than to the caster's own handlers,
      // because a Servant dragged inside is subject to it.
      interiorEvents: new fields.ArrayField(new fields.ObjectField()),

      // A recurring toll the field charges to keep itself open, as opposed to
      // `duration`, which closes it on a clock. Jack's Mist is the first:
      // "at the end of the Turn after every 1◈ Turns since this NP was
      // activated, Jack's Master loses 15 Health", and it closes INSTEAD of
      // charging when the Master cannot pay — "her Master does not lose Health
      // on the same Turn this NP is deactivated."
      upkeep: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      // Whether the owner may switch it off, and when. Jack's Mist: "can be
      // deactivated at any time … during her Turn or at the start or end of
      // any Turn or Round."
      deactivation: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      // A field that is neither cast nor ended. Pale Rider's Contagion is the
      // first: *"(Passive) The 2 panel area around Pale Rider IS the Contagion
      // area"* -- it exists because he does, has no activation, no duration
      // and no cooldown, and the only thing that closes it is his leaving the
      // board. `engine/fields.mjs#ensurePassiveFields` opens and closes them.
      passive: new fields.BooleanField({ initial: false }),
      // A FREEFORM field stores the panels it was drawn as: there is no shape
      // spec to recompute them from, which is the whole difference between it
      // and `fixedArea`.
      panels: new fields.ArrayField(new fields.ObjectField()),
      // The tick the field opened on, which an `upkeep` period counts from.
      createdAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

      duration: new fields.StringField({ required: false, nullable: true, initial: null }),
      // The ABSOLUTE tick it closes on, resolved at cast time. Durations are
      // stored as expiry ticks everywhere else (§7.5) for the same reason: a
      // countdown needs a hook that can fail to fire, and an expiry cannot.
      expiry: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      // The tick a paid extension was last taken on. `repeatable: false` means
      // "once", and once needs a record — Doomsday Come *"can be repeatedly
      // extended"* and says so, which implies something that cannot.
      lastExtendedAt: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      /** Per-unit escape history, which the veteran rule needs (§43.11). */
      state: new fields.ObjectField({ required: true, initial: () => ({ escapeHistory: {} }) }),
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
