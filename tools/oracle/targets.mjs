/**
 * @file The functions the Godot port's oracle records (grail-tact-godot, Ch. 15 of its plan), by module.
 *
 * Each target names a module, the exported functions to wrap with the Godot name each case keys on, and the test
 * files whose calls are recorded. Every call those tests make to a wrapped function becomes a case, the engine's
 * own internal calls included, since a mock replaces the module for every importer. `cap` bounds the cases kept per
 * function; calls with the same arguments are one case.
 *
 * Grow it a module at a time, as the port of that module lands (M2 onwards).
 */

export const TARGETS = [
  {
    module: "module/domain/geometry.mjs",
    layer: "domain/geometry",
    cap: 120,
    fns: {
      chebyshev: "domain.geometry.chebyshev",
      chebyshevBetween: "domain.geometry.chebyshev_between",
      manhattan: "domain.geometry.manhattan",
      inAttackRange: "domain.geometry.in_attack_range",
      inAttackRangeBetween: "domain.geometry.in_attack_range_between",
      attackRangeArea: "domain.geometry.attack_range_area",
      squareBounds: "domain.geometry.square_bounds",
      inBounds: "domain.geometry.in_bounds",
      normalize: "domain.geometry.normalize",
      chebyshevDisc: "domain.geometry.chebyshev_disc",
      attackRangePanels: "domain.geometry.attack_range_panels",
      rect: "domain.geometry.rect",
      centredRect: "domain.geometry.centred_rect",
      adjacentBlock: "domain.geometry.adjacent_block",
      line: "domain.geometry.line",
      panelsBetween: "domain.geometry.panels_between",
      ring: "domain.geometry.ring",
      coneOf: "domain.geometry.cone_of",
      rotateFacing: "domain.geometry.rotate_facing",
      facingToward: "domain.geometry.facing_toward",
      cardinalToward: "domain.geometry.cardinal_toward",
      gridShape: "domain.geometry.grid_shape",
      occupiedPanels: "domain.geometry.occupied_panels",
    },
    tests: [
      "test/unit/geometry.test.mjs", "test/unit/aoe.test.mjs", "test/unit/cast-level.test.mjs",
      "test/unit/bellerophon-shape.test.mjs", "test/unit/duel-enclosure.test.mjs", "test/unit/compulsion.test.mjs",
      "test/unit/field-interior-movement.test.mjs", "test/unit/linked-group.test.mjs",
    ],
  },
  {
    module: "module/domain/tick.mjs", layer: "domain/tick", cap: 80, tests: "importers",
    fns: {
      fractionTicks: "domain.tick.fraction_ticks", roundsToTicks: "domain.tick.rounds_to_ticks",
      parseTick: "domain.tick.parse_tick", resolveTicks: "domain.tick.resolve_ticks", ticks: "domain.tick.ticks",
      expiryReached: "domain.tick.expiry_reached", formatTick: "domain.tick.format_tick",
    },
  },
  {
    module: "module/domain/tables.mjs", layer: "domain/tables", cap: 120, tests: "importers",
    fns: { lookup: "domain.tables.lookup", lookupNumber: "domain.tables.lookup_number" },
  },
  {
    module: "module/domain/health.mjs", layer: "domain/health", cap: 60, tests: "importers",
    fns: {
      currentHealth: "domain.health.current_health", maxHealth: "domain.health.max_health",
      isUndamageable: "domain.health.is_undamageable", clampToMax: "domain.health.clamp_to_max",
      watermarkKey: "domain.health.watermark_key",
    },
  },
  {
    module: "module/domain/base-attack.mjs", layer: "domain/base-attack", cap: 80, tests: "importers",
    fns: { penalizedBaseAttack: "domain.base_attack.penalized", baseAttackFor: "domain.base_attack.base_attack_for" },
  },
  {
    module: "module/domain/resources.mjs", layer: "domain/resources", cap: 60, tests: "importers",
    fns: {
      resourceValue: "domain.resources.resource_value", resourceMax: "domain.resources.resource_max",
      canSpend: "domain.resources.can_spend", afterChange: "domain.resources.after_change",
      resourcePath: "domain.resources.resource_path", resourcePathFor: "domain.resources.resource_path_for",
      resourceLabel: "domain.resources.resource_label",
    },
  },
  {
    module: "module/domain/attributes.mjs", layer: "domain/attributes", cap: 80, tests: "importers",
    fns: { isMagus: "domain.attributes.is_magus", closeAttributes: "domain.attributes.close_attributes" },
  },
  {
    module: "module/domain/revisions.mjs", layer: "domain/revisions", cap: 60, tests: "importers",
    fns: {
      isRevisable: "domain.revisions.is_revisable", effectiveRevision: "domain.revisions.effective_revision",
      revisionOf: "domain.revisions.revision_of",
    },
  },
  {
    module: "module/domain/war-rules.mjs", layer: "domain/war-rules", cap: 80, tests: "importers",
    fns: {
      publishedValue: "domain.war_rules.published_value", coerceWarRule: "domain.war_rules.coerce",
      missingWarRules: "domain.war_rules.missing", warRuleEditable: "domain.war_rules.editable",
    },
  },
];
