# 05 — Board geometry: distance, shapes, reachability

## What it is

The system uses **three distance metrics**, and picking the wrong one is the single most common geometry bug. Each measures differently and each is correct for its use case.

The rulebook speaks of panels — grid squares, addressed as `{i, j}` offsets (row, column) — and three rules recur throughout: units measure distance from their owned panels, not from a single anchor; Chebyshev distance includes diagonals; and movement must respect obstacles, not assume a simple diamond. These rules are implemented as primitives in the `domain` layer and consumed across the rules and engine layers to produce accurate game mechanics without Foundry being present.

## Where it lives

| File | Role |
|---|---|
| `module/domain/geometry.mjs` | The three metrics, shape generation, reachability, and facing |
| `module/rules/targeting/shapes.mjs` | Anchor → panel set expansion for ability targeting |
| `module/rules/targeting/orthogonal.mjs` | Orthogonal panel placement relative to a unit's facing |
| `module/rules/targeting/facing.mjs` | Facing-based targeting prerequisites (cone checks, line of sight) |
| Consumers | Auras, movement, bounded fields, ZON, summoning, all use these primitives |

## How it works

### The three metrics

**Chebyshev distance** — diagonals cost 1 — is the rulebook's default (`module/domain/geometry.mjs:48-50`). *"Within a 2 panel area"* is the 5×5 block centred on the unit; *"directly next to"* is Chebyshev 1, explicitly including diagonals. It generates circular zones: `chebyshevDisc(centre, r)` returns every panel in the `(2r+1)²` block (`module/domain/geometry.mjs:213-230`).

**Manhattan distance** — orthogonal steps only — governs movement (`module/domain/geometry.mjs:102-104`). Units cannot move diagonally; `reachablePanels` uses a breadth-first flood to find all panels reachable within `mov` steps while respecting obstacles, because the reachable set is *not* simply the Manhattan diamond once anything blocks a path (`module/domain/geometry.mjs:435-475`).

**Attack Range** is Chebyshev with a twist. The rule states: *"When Attacking, panels are counted diagonally also. However, when the Range is 3 panels or higher, the diagonal range is reduced by 1."* Formally, in range iff `d ≤ R`, **excluding** panels where `d = R` and `s ≥ 2`, where `d` is the Chebyshev distance and `s` is how far off-axis the panel sits. Only the outermost ring loses its corners; everything inside is untouched (`module/domain/geometry.mjs:106-134`).

### Multi-panel units

A multi-panel unit (e.g., a nine-panel platform) measures distance from **any panel it occupies**, not from a corner anchor alone (`module/domain/geometry.mjs:52-72`). *"Range=4 plus the area under the HGoB and the area of the HGoB"* was a real bug: measured from the top-left corner, Range 4 did not even cover its own deck. Found and fixed by testing against a live world (`module/domain/geometry.mjs:58-62`).

### Shape expansion

Targeting uses a two-axis system: Axis 1 resolves the anchor (caster, target, direction chosen), and Axis 2 expands the shape around it (`module/rules/targeting/shapes.mjs:1-10`). The `expand` function handles 13 shape kinds:

- `chebyshevRadius` unions multiple discs where needed — *"within a 2 panel area of Kiritsugu OR THE TARGET"* (Scapegoat) is one area, not two applications, so `normalize` dedupes the result (`module/rules/targeting/shapes.mjs:71-86`).
- `attackRange`, `rect`, `line`, and others delegate to domain primitives.
- Directional anchors project blocks outward: `orthogonalAdjacentRect` places an M×N area flush against the caster on one cardinal side, centred on the perpendicular axis. **The caster is not inside it.** Even dimensions bias toward negative offsets via the floor; the preview renders the player's actual target (`module/rules/targeting/shapes.mjs:173-211`).

### Facing and cones

Facing is stored as one of eight compass directions but only ever *read* as one of four cones — front/side/back — because every rule that cares (Evade modifiers, Achilles' Heel) is expressed that way (`module/domain/geometry.mjs:481-504`). `coneOf(facing, self, other)` classifies an attacker into a quadrant using bearing arithmetic.

Four-directional placement — Raikou's clones on front/back/left/right — is derived from the facing by rotation, not tabulated, because four of the eight facings are diagonals. `orthogonalPanels` finds one free panel per direction, displaced outward where blocked (`module/rules/targeting/orthogonal.mjs:45-94`).

### Targeting prerequisites

Two opt-in prerequisites guard abilities. **Facing check:** `facingAllows` returns true only if the target is in the caster's front quadrant, or if the caster targets itself (`module/rules/targeting/facing.mjs:36-40`). **Path clear:** `pathClear` walks the panels between caster and target and returns false if any Servant or summon stands in the way. Civilians and defeated units do not obstruct (`module/rules/targeting/facing.mjs:63-75`).

## Invariants & edge cases

1. **Panels are always measured from the whole footprint, not the anchor alone.** `chebyshevFromAny` and `inAttackRangeFromAny` check all panels a unit occupies and return the minimum distance or a boolean (`module/domain/geometry.mjs:68-89`). Single-panel units still use these; they are correct whether the unit occupies one panel or nine.

2. **Even-dimensioned self-centred shapes are unspecified.** `centredRect` throws rather than silently picking a corner, because Ch. 41 Q27 gives no ruling and content never uses one (`module/domain/geometry.mjs:289-298`).

3. **A line stops at the board edge.** `line` breaks the loop when a panel goes out of bounds; it does not skip across and continue (`module/domain/geometry.mjs:363-379`).

4. **`panelsBetween` only works on shared axes.** Panels that are off-axis (not on the same row, column, or exact diagonal) return `[]` — the conservative reading of what "between" means on a grid with no line of sight (`module/domain/geometry.mjs:381-408`).

5. **Board-size-dependent shapes read `bounds` rather than a setting.** A bidirectional line that switches to one-way on the Large Board reads the scene's actual board size from the bounds object, not a flag (`module/rules/targeting/shapes.mjs:100-113`).

6. **Placement search ends at the board edge, not past it.** `orthogonalPanels` breaks when a panel goes out of bounds instead of skipping to the next direction. There is nothing further out (`module/rules/targeting/orthogonal.mjs:67-80`).

## Open questions

- **`chebyshevFromAny` uses `Math.min` over all panels.** For multi-panel units measuring from a disc (ZON), the minimum distance to any panel of the target is correct for determining if the target is "in" the zone, but the source never explicitly says so. It is correct by reading but worth an ADR.

- **`inAttackRangeFromAny` uses `some`, not `min`.** Two panels at different distances to a single target have different Range values. The code uses `some`, which asks "does any panel of the attacker reach the target?", not "what is the closest panel?". This is correct (a multi-panel unit reaches further), but the reasoning is not stated (`module/domain/geometry.mjs:75-89`).

- **Confirmed live.** A unit always faces itself for targeting. `facingAllows` was called against a
  live board: caster-as-target returns `true`, a unit directly behind a north-facing caster returns `false`,
  and one in front returns `true` (`module/rules/targeting/facing.mjs:36-40`). A self-targeting ability is
  never refused by a facing rule.

- **Confirmed live, and the formula above was wrong.** Even-width blocks do bias toward the negative
  axis, but via `Math.floor(across / 2)` (`module/rules/targeting/shapes.mjs:197`), not `Math.floor((w-1)/2)`
  — the latter would bias the *other* way. Measured on a 13×13 board from `{i:5, j:5}` facing north:
  w=3 → columns 4,5,6 (1 either side); **w=4 → 3,4,5,6 (two negative, one positive)**; w=5 → 3–7 (2 and 2);
  **w=6 → 2–7 (three negative, two positive)**. Odd widths are symmetric; even widths take the extra panel
  on the negative side. The block never contains the caster's own panel.
