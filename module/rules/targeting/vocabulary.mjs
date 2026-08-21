/**
 * @file The targeting vocabulary, in the words a GM uses.
 * @see docs/29-user-interface.md §29.6, docs/09-targeting.md
 *
 * Layer 2 (rules). Pure data.
 *
 * §29.6 is blunt about why this exists: *"A GM should never have to know that
 * `selfEdgeAdjacent` is the internal name for 'a 5×5 area in any non-diagonal
 * direction next to the caster' — they should see four little diagrams and
 * click one."* So each entry pairs the internal id with a plain-language label,
 * a one-line description, and a small schematic the picker can draw.
 *
 * The ids here are the **only** ones `expand` and `resolveTargets` implement.
 * `test/unit/targeting.test.mjs` holds the two against each other in both
 * directions, for the same reason the rule-element vocabulary is held against
 * its executors: a shape offered in the picker that the resolver cannot expand
 * produces an ability that authors cleanly and targets nothing.
 *
 * `schematic` is a 5×5 grid of characters — `.` empty, `#` covered, `@` the
 * caster — which the picker renders as a diagram. Deliberately crude: it has to
 * survive being read in a monospace cell, and a GM comparing four of them at a
 * glance needs shape, not fidelity.
 */

/** Where a shape is placed from. */
export const TARGET_ANCHORS = Object.freeze([
  {
    id: "self",
    label: "FGT.Anchor.self",
    hint: "FGT.Anchor.selfHint",
    schematic: ["..... ", "..... ", "..@.. ", "..... ", "....."],
  },
  {
    id: "targetUnit",
    label: "FGT.Anchor.targetUnit",
    hint: "FGT.Anchor.targetUnitHint",
    schematic: ["..... ", "..... ", "..@#. ", "..... ", "....."],
  },
  {
    // `withinRange` is the resolver's name for "a free panel the player picks".
    // The id must be the internal one and the LABEL the friendly one -- §29.6's
    // whole point is that a GM never has to know the former. Calling this
    // `point` in the picker made it authorable and unresolvable: Medea's Rain
    // of Light threw `Unknown targeting anchor "point"`.
    id: "withinRange",
    label: "FGT.Anchor.point",
    hint: "FGT.Anchor.pointHint",
    schematic: ["..... ", ".#... ", "..@.. ", "..... ", "....."],
  },
  {
    id: "selfEdgeAdjacent",
    label: "FGT.Anchor.selfEdgeAdjacent",
    hint: "FGT.Anchor.selfEdgeAdjacentHint",
    schematic: ["..... ", ".###. ", ".#@#. ", ".###. ", "....."],
  },
  {
    id: "zone",
    label: "FGT.Anchor.zone",
    hint: "FGT.Anchor.zoneHint",
    schematic: ["#####", "#####", "##@##", "#####", "#####"],
  },
  {
    id: "movementPath",
    label: "FGT.Anchor.movementPath",
    hint: "FGT.Anchor.movementPathHint",
    schematic: [".....", "..##.", ".#@..", ".#...", "....."],
  },
  {
    id: "platform",
    label: "FGT.Anchor.platform",
    hint: "FGT.Anchor.platformHint",
    schematic: ["#####", "#...#", "#.@.#", "#...#", "#####"],
  },
  {
    id: "global",
    label: "FGT.Anchor.global",
    hint: "FGT.Anchor.globalHint",
    schematic: ["#####", "#####", "##@##", "#####", "#####"],
  },
  {
    // Reaction abilities: the thing that just hit you. Medea's Trofa and Argos
    // are both "used when Attacked", and this is where they point.
    id: "sourceOfAttack",
    label: "FGT.Anchor.sourceOfAttack",
    hint: "FGT.Anchor.sourceOfAttackHint",
    schematic: ["..... ", "..... ", "#..@. ", "..... ", "....."],
  },
]);

/**
 * The shapes the resolver can expand.
 *
 * `needs` names the numeric fields each one requires, so the editor can show
 * exactly those inputs rather than every field on the schema — a `rect` asks
 * for width and height, and a `chebyshevRadius` asks for one radius.
 */
export const TARGET_SHAPES = Object.freeze([
  {
    id: "point", label: "FGT.Shape.point", hint: "FGT.Shape.pointHint", needs: [],
    schematic: [".....", ".....", "..#..", ".....", "....."],
  },
  {
    id: "unit", label: "FGT.Shape.unit", hint: "FGT.Shape.unitHint", needs: [],
    schematic: [".....", ".....", "..#..", ".....", "....."],
  },
  {
    id: "square", label: "FGT.Shape.square", hint: "FGT.Shape.squareHint", needs: ["size"],
    schematic: [".....", ".###.", ".###.", ".###.", "....."],
  },
  {
    id: "rect", label: "FGT.Shape.rect", hint: "FGT.Shape.rectHint", needs: ["w", "h"],
    schematic: [".....", ".....", "#####", "#####", "....."],
  },
  {
    id: "chebyshevRadius", label: "FGT.Shape.chebyshevRadius", hint: "FGT.Shape.chebyshevRadiusHint", needs: ["r"],
    schematic: [".....", ".###.", ".#@#.", ".###.", "....."],
  },
  {
    id: "attackRange", label: "FGT.Shape.attackRange", hint: "FGT.Shape.attackRangeHint", needs: ["r"],
    schematic: ["..#..", ".###.", "##@##", ".###.", "..#.."],
  },
  {
    id: "ring", label: "FGT.Shape.ring", hint: "FGT.Shape.ringHint", needs: ["r"],
    schematic: [".###.", ".#.#.", ".#@#.", ".#.#.", ".###."],
  },
  {
    id: "line", label: "FGT.Shape.line", hint: "FGT.Shape.lineHint", needs: ["length"],
    schematic: [".....", ".....", "@####", ".....", "....."],
  },
  {
    id: "orientedRect", label: "FGT.Shape.orientedRect", hint: "FGT.Shape.orientedRectHint", needs: ["w", "h"],
    schematic: [".....", ".....", "@###.", ".###.", "....."],
  },
  {
    id: "path", label: "FGT.Shape.path", hint: "FGT.Shape.pathHint", needs: [],
    schematic: [".....", "..##.", ".#@..", ".#...", "....."],
  },
  {
    id: "zone", label: "FGT.Shape.zone", hint: "FGT.Shape.zoneHint", needs: ["zoneId"],
    schematic: ["#####", "#####", "##@##", "#####", "#####"],
  },
  {
    id: "banded", label: "FGT.Shape.banded", hint: "FGT.Shape.bandedHint", needs: ["bands"],
    schematic: [".###.", ".#.#.", ".#@#.", ".#.#.", ".###."],
  },
]);

/** Just the ids, for a drift test against the resolver. */
export const SHAPE_IDS = Object.freeze(TARGET_SHAPES.map((s) => s.id));
export const ANCHOR_IDS = Object.freeze(TARGET_ANCHORS.map((a) => a.id));
