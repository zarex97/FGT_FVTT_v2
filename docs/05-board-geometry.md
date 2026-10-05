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

Facing is stored as one of eight compass directions but only ever *read* as one of four cones — front/side/back — because every rule that cares (Evade modifiers, Achilles' Heel) is expressed that way (`module/domain/geometry.mjs#coneOf`). `coneOf(facing, self, other)` classifies an attacker by its bearing.

**Of the eight panels around a Unit, 3 are front, 2 are sides, 3 are back** (ruled 2026-10-04, #184 reading 10, for every facing rule). The front cone is the 90° around the facing with both edges in, the back the same behind, and the sides are what lies strictly between, so a diagonal is always front or back. It had been a half-open quadrant: the front-left diagonal read front and the front-right one side, the same attack two ways by mirror image. Medusa's *"facing the targeted Unit"* reads the same front cone, so it is three panels wide.

**Read at the declaration.** `rules/targeting/facing.mjs#attackCone` is stamped on each Combat Process as `state.cone` when it is declared; the Evade and the Heel both read the stamp. An attack with no direction (no attacker on the board, or one on the defender's panel) is from the front. After a single-target attack the defender turns to face the attacker, to the **nearest of the eight** (`facingToward`; it had been four), and that turn comes after the damage, so it never changes the cone of the attack that caused it. Moving does not turn a Unit; the player turns it on its own Turn.

Four-directional placement — Raikou's clones on front/back/left/right — is derived from the facing by rotation, not tabulated, because four of the eight facings are diagonals. `orthogonalPanels` finds one free panel per direction, displaced outward where blocked (`module/rules/targeting/orthogonal.mjs:45-94`).

### Targeting prerequisites

Two opt-in prerequisites guard abilities. **Facing check:** `facingAllows` returns true only if the target is in the caster's front quadrant, or if the caster targets itself (`module/rules/targeting/facing.mjs:36-40`). **Path clear:** `pathClear` walks the panels between caster and target and returns false if any Servant or summon stands in the way. Civilians and defeated units do not obstruct (`module/rules/targeting/facing.mjs:63-75`).

### Riding Attack

*"Can Attack all Units in its path while Moving in a straight line as its Normal Attack."* A ride is a Move that is also an Attack, and "straight" means the eight lines a grid has: a shared row, a shared column or an exact diagonal (`module/rules/movement.mjs#ridingAttackPath`, measured Chebyshev). The eight lines are the default; a GM may hold a ride to rows and columns with the `ridingAttackLines` world setting (ruled 2026-10-02, #65, ruling 18). `engine/board.mjs` carries it on `board.rules`, where `ridesDiagonally` reads it, and absent reads as the eight lines. A diagonal under the setting is refused as `notStraight`, and `ridingDestinations` offers the four axes only. The allowance is MOV minus the panels already Moved this Turn, or the ability's own reach when it states one — Troias Tragōidia's `ridingAttack.distance: 13`.

**A body is passed through, not stopped on** (ruled 2026-10-02, #65, ruling 25). `canPassThrough` blocks a step only on a living enemy Unit; a defeated one lying there until it leaves the board (Ch. 25) does not block, so a drag or a ride crosses it. `canStopOn` still counts it as an occupant, so no Unit ends a Move on it. Before this a defeated Nemo still blocked a drag through (13,5).

**What a ride is held to (#114).** One ride, judged by the rules a drag and an attack already have, and not by a copy of them. The line must stay on the board (`offBoard`); every panel it covers must pass `canPassThrough` — an enemy Master's zone, a bounded field's exit — with the one exemption that is the point of the clause: an enemy standing in the line, but not on the destination, is not in the way, it is hit (`canPassThrough(…, { throughEnemies: true })`, `blocked`). The destination must pass `canStopOn`, so an enemy or an ally standing on it, a platform's held edge and a linked partner's leash refuse it (`cannotStop`). The Kagome Spirit's pursuit and Decoy's pull are asked of the ride as of a drag, and Immobilize prevents a ride because `ridingAttack` is in its row of `PREVENTS` (it is a Move). A rider whose mount replaces her Move (`actionSourceFor(...).movesAsPlatform`, Quetzalcoatl aboard the Quetzalcoatlus) is refused with `mounted` until the author rules what a Riding Attack is then; the ride moved only her token and left her mount behind. Who is hit is chosen from the rider's own Level and kept to Units (a platform or a Structure is terrain a ride crosses), a multi-panel Unit is caught by any panel of its footprint, and the candidates then go through `resolveTargets` with a `movementPath` anchor and a `path` shape, so a field's isolation, the targetability aura and every other survivor filter apply to this attack as to any other (Ch. 20).

**One rule, two readers.** `ridingDestinations(unit, board, { distanceOverride })` lists every panel a ride may end on, and it offers a candidate only if `ridingAttackPath` accepts it, so the overlay a player picks from and the engine that judges the ride cannot disagree (two readers of one rule drift, §46.3). A line stops where the board does. The destination is picked on the canvas with `pickDestination` (Ch. 36, mode F) and performed by `performAction("ridingAttack", { destination })` (Ch. 34). The Move button, by contrast, names no destination: dragging the token is the Move, so the button says so (`dragToMove`) instead of raising a hook nobody listens for (#113).

### Passenger Seat

*"The Servant's Master can Move together with its Servant; after Moving, both must be in the same relative position as before. Counts as only Moving one Unit."* One carry, `carryMasterAlong({ servantId, from, to })` in `module/engine/passenger-seat.mjs`, which takes two panels rather than a movement operation and has two callers: a voluntary drag (`movement-hooks.mjs#carryMaster`, a thin wrapper that reads the movement's origin and destination, on the `moveToken` hook) and a Riding Attack (`performRidingAttack`, right after its displacement, with `from` the rider's panel and `to` the destination). The sheets say the ride "can be combined with Passenger Seat", and until #115 it could not be: the hook returns for any forced move before it reaches the carry, a ride is a forced displacement, and nothing else called it.

Both callers ask the same things: the `passengerSeat` grant, the Servant's own `carriesMaster` switch (on by default; the action bar's Carry Master, Ch. 34), a living Master with a panel, and a landing on the board and on a free panel. The Master is displaced (`displaceToken`, forced), by exactly the Servant's delta; spends no pool (*"counts as only Moving one Unit"*); and leaves one `passengerSeat` entry in the log. A carry that cannot happen is reported, never dropped.

**The landing is judged after her move (#118).** `passengerLanding(servant, master, origin, destination, board)` in `rules/movement.mjs` is the one judge, and it treats the Servant as already standing on `destination` (her footprint translated to it) before it asks who holds the landing. At `moveToken` Foundry still reports her at her origin until the animation ends (§46.4-BZ recorded the same timing for knockback), so the board still stands her there, and a Master exactly one move behind her, which includes the ordinary 1-panel follow, lands on that very panel: the old `occupantAt` found her and the carry refused with "the landing panel is occupied". A board that has already caught up, as after a ride, gives the same answer. Off the board and a panel held by somebody else still refuse.

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
