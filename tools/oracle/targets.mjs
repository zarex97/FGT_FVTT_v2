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
];
