# 08 — Board and Geometry

Everything spatial. Distance metrics (there are three, used in different places), the
Range shape with its diagonal-reduction rule, movement legality, occupancy, zones, and
knockback. Chapter 09 builds the targeting type system on top of this.

---

## 8.1 The board

| Property | Regular | Large |
|---|---|---|
| Dimensions | 13 × 13 | 25 × 25 |
| Home base depth | 2 rows (inferred) | 3 rows (inferred) |
| HGoB footprint | 9 × 9 | 11 × 11 |
| HGoB MOV | 2 | 3 |

Gameplay is identical on both. Board size is a `Scene` property; a handful of abilities
declare board-size-dependent values (HGoB above), read from `board.size`.

Chess algebraic notation is suggested by the rulebook for referring to panels. We keep it as a
**display** convention — the debug overlay and chat cards label panels `a1`–`m13` — with
internal coordinates being Foundry `GridOffset` (`{i: row, j: column}`, zero-based, i
increasing southward). The mapping is:

```ts
const toAlgebraic = (o: GridOffset, h: number) =>
  String.fromCharCode(97 + o.j) + (h - o.i);
```

Red's home base is the "White" side, per the rulebook.

---

## 8.2 Three distance metrics

Using the wrong one is the single most common geometry bug. F/GT uses all three.

### Chebyshev (`max(|di|, |dj|)`) — "N panel area"

The rulebook's default. *"Within a 2 panel area"* means the 5×5 block centred on the unit:
Chebyshev distance ≤ 2. Diagonals count as 1.

```ts
const chebyshev = (a: GridOffset, b: GridOffset) =>
  Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
```

Used by: ZON, Party area, "directly next to" (Chebyshev 1 — the source says explicitly
*"'Directly next to' means within a 1 panel Range including diagonal"*), Master protection
radius, Decoy, Detect, contract adjacency, aura skills.

### Manhattan (`|di| + |dj|`) — movement

Movement is orthogonal only. *"Units are not allowed to Move diagonally."* So path cost is the
number of orthogonal steps, and the reachable set at MOV `m` is the diamond
`|di| + |dj| ≤ m` — subject to obstacles.

```ts
const manhattan = (a: GridOffset, b: GridOffset) =>
  Math.abs(a.i - b.i) + Math.abs(a.j - b.j);
```

**DECISION.** Set `core.gridDiagonals = ILLEGAL` (`CONST.GRID_DIAGONALS.ILLEGAL = 6`) at the
scene level. Foundry v14's `grid.measurePath()` and `TokenDocument.move()` then natively
enforce orthogonal-only pathing and cost, and the ruler shows correct distances without custom
code. This is a substantial win over hand-rolling movement.

### Attack range (Chebyshev with diagonal reduction) — the special one

The rulebook:

> *"When Attacking, panels are counted diagonally also. However, when the Range is 3 panels or
> higher, the diagonal range is reduced by 1."*
>
> - AU (Range 1): 3×3 area
> - AU (Range 2): 5×5 area
> - AU (Range 3): 7×7 area **EXCEPT the twelve corner panels**

For Range 1 and 2, it is plain Chebyshev. For Range ≥ 3, the corners are clipped by 1.

**"The twelve corner panels"** of a 7×7 is the decisive clue. A 7×7 ring has 4 corners; twelve
panels means the 3-panel L at each corner: the `(±3,±3)` cell plus `(±3,±2)` and `(±2,±3)`.
4 corners × 3 = 12. ✓

So the rule is: a panel is in range iff

```
chebyshev ≤ R   AND   (chebyshev + min(|di|,|dj|)) ≤ ... 
```

Let us derive it properly. Write `d = max(|di|,|dj|)` and `s = min(|di|,|dj|)`. The clipped
cells at R=3 are those with `d = 3` and `s ≥ 2`. Equivalently `d + s ≥ 5`, i.e. `d + s > R + 1`.

Check against R=3:
- `(3,0)`: d+s = 3 ≤ 4 → in ✓
- `(3,1)`: 4 ≤ 4 → in ✓
- `(3,2)`: 5 > 4 → **out** ✓
- `(3,3)`: 6 > 4 → **out** ✓
- `(2,2)`: 4 ≤ 4 → in ✓

That gives exactly 12 excluded cells. ✓

**DECISION.** The range predicate is:

```ts
function inAttackRange(from: GridOffset, to: GridOffset, R: number): boolean {
  const di = Math.abs(from.i - to.i), dj = Math.abs(from.j - to.j);
  const d = Math.max(di, dj), s = Math.min(di, dj);
  if (d > R) return false;
  if (R < 3) return true;                 // pure Chebyshev for R = 1, 2
  return d + s <= R + 1;                  // diagonal reduction
}
```

### Verification against the source's R=4 and R=5 figures

The rulebook includes diagrams for Range 4 and Range 5 (images we cannot read). Our formula
predicts:

**R = 4** (9×9 minus clipped): excluded are cells with `d = 4, s ≥ 2` and `d = 3, s = 3`.
- `d=4`: s ∈ {2,3,4} excluded → per quadrant 3 cells on each of two arms… counting the full
  ring: cells with d=4 and s≥2 number 4 corners × 3 per arm-pair × ... precisely, the excluded
  set is `{(4,2),(4,3),(4,4),(3,3)}` and their symmetries.
- Total excluded: `(4,2)`→8 (sign and swap), `(4,3)`→8, `(4,4)`→4, `(3,3)`→4 = **24 panels**.
- Range 4 area = 81 − 24 = **57 panels**.

**R = 5**: excluded `{(5,2),(5,3),(5,4),(5,5),(4,3),(4,4)}`
= 8 + 8 + 8 + 4 + 8 + 4 = **40**; area = 121 − 40 = **81 panels**.

This produces an octagonal footprint that grows smoothly, which is the visual shape the
rulebook's diagrams show. **RISK.** We cannot read the source images. The formula is derived
from the one case stated in words (R=3, twelve corners) and is self-consistent. Flagged in
Ch. 41 for verification against the diagrams; the implementation reads the shape from a
lookup table for R ≤ 8 so a correction is a data edit.

An alternative reading — "diagonal range reduced by 1" meaning the diagonal *arm* is 1 shorter,
i.e. exclude only `d = R, s = R` — gives only 4 excluded panels at R=3, contradicting "twelve
corner panels". Rejected.

### The range shape, drawn (R = 3)

```
      . . X X X . .          X = in range
      . X X X X X .          . = out of range
      X X X X X X X          @ = attacker
      X X X @ X X X
      X X X X X X X
      . X X X X X .
      . . X X X . .
```
37 panels (49 − 12). ✓

---

## 8.3 Movement

### Legality

A movement path is legal iff every step satisfies:

1. **Orthogonal.** No diagonal steps.
2. **In bounds.**
3. **Not through an enemy-occupied panel.** *"With the exception of Rider using its 'Riding
   Attack', all Units are not allowed to Move through a panel occupied by an enemy Unit unless
   stated."* Note: *through*, so allied-occupied panels are passable but not stoppable.
4. **Not into an enemy Master's protection zone.** *"Units are not allowed to enter a 1 panel
   area of enemy Masters if that Master's Servant is within 2 panels of its Master."*
   Asymmetric: Masters *may* stop next to enemy units.
5. **Not away from a Decoy source.** A unit within the Decoy radius may only move *toward* the
   Decoy'd unit.
6. **Within budget.** `movedPanels + pathLength ≤ mov`.
7. **Terminal panel unoccupied** (except Kingprotea's `Huge Scale` and Platforms).

Exceptions that bypass 3 and 4: active Presence Concealment (*"able to Attack Masters and Move
anywhere regardless of the enemy Master-Servant positions"*), Kingprotea's `Huge Scale`, and
Bašmu.

### Implementation via Foundry v14 movement

v14's `TokenDocument.move(waypoints, options)` with a custom **movement cost function** gives
us most of this natively:

```ts
function fgtMovementCost(unit: UnitSnapshot, board: BoardSnapshot) {
  return (from: GridOffset, to: GridOffset, baseCost: number) => {
    if (!isOrthogonalStep(from, to)) return Infinity;
    if (isEnemyOccupied(to, unit, board) && !unit.flags.ignoresOccupancy) return Infinity;
    if (inEnemyMasterProtection(to, unit, board)) return Infinity;
    if (violatesDecoy(from, to, unit, board)) return Infinity;
    return baseCost;
  };
}
```

`Infinity` cost makes a panel unreachable, which is exactly the semantics we want and drives
Foundry's native reachability highlight for free. The `preMoveToken` hook performs final
validation (a cost function can be bypassed by a direct `update()`), and the `moveToken` hook
fires our `onUnitMoved` event.

**Slow** halves MOV (rounding down) rather than doubling cost, per its text.

### Movement segments and Riding

`Riding` Passive 1 (Double Move) allows moving twice in a turn *if the unit attacks that turn*,
once before and once after, with the total capped at MOV.

```ts
interface MovementBudget {
  total: number;              // = mov.value
  used: number;
  segments: number;           // 0, 1, 2
  maxSegments: number;        // 1 normally, 2 with Riding
  requiresAttackBetween: boolean;    // Riding: the two segments must bracket an attack
}
```

The second segment is only unlocked once `turnState.attacked` is true. The UI greys the move
button between the two states accordingly.

### Riding Attack

*"the Servant is able to attack all enemies in his path while Moving in a straight line"* — a
movement and an attack fused into one action. Constraints:
- Straight line only (single direction, orthogonal).
- Cannot attack after stopping; cannot move a second time afterwards.
- May pass through enemy-occupied panels (the sole exception to rule 3).
- If the unit already moved this turn, the riding-attack distance is `mov − movedPanels`.
- Counts as a Normal Attack.
- Combinable with Passenger Seat (the Master rides along).

Modelled as targeting shape `line` with `origin: self`, `direction: chosen`, `length: budget`,
`width: 1`, hitting **every enemy** on the path. See Ch. 09 §9.4.

### Passenger Seat

*"the Servant's Master can Move together with its Servant; after Moving, both Servant and
Master must be in the same orientation/position prior to the Move. Counts as only Moving one
Unit."*

So the Master's relative offset from the Servant is preserved. Implemented as a linked move:
compute the Servant's delta, apply the same delta to the Master, validate the Master's
destination independently, and charge one servant-move against the turn budget (not a
master-move).

### Forced movement and knockback

> **Keyword: Knockback.** *"forcibly Moved in the direction of the Attack or effect. If a Unit
> would be knocked back into an occupied panel, that Unit instead stops Moving and takes STR
> damage depending on its END Rank."*

| END Rank | Collision damage |
|---|---|
| EX | 1d12 |
| A | 1d20 |
| B | 2d12 |
| C | 3d12 |
| D | 2d20 |
| E | 3d20 |
| (none) | 5d10 |

Note the table is *non-monotonic in dice count but monotonic in expectation*: EX 6.5, A 10.5,
B 13, C 19.5, D 21, E 31.5, none 27.5. Tougher units take less. ✓ (Except "none" sitting
between D and E, which is fine.)

Knockback ignores movement legality — it is displacement, not movement — but respects board
bounds (a unit knocked into a wall stops and takes the collision damage) and does not trigger
movement-based effects (`onUnitMoved` fires with `forced: true`, and region `tokenMoveIn` is
distinguished from `tokenEnter`, which v14 gives us natively).

Kingprotea's `Huge Scale` produces **cascading** knockback: she moves onto occupied panels and
occupants are pushed 1 panel "until Kingprotea has space to stand on". This is a
breadth-first displacement that can chain. The algorithm:

```
1. Compute Kingprotea's target footprint F.
2. Collect displaced = units with any panel in F.
3. For each displaced unit, in order of distance from her centre (nearest first):
     push 1 panel directly away from her centre (orthogonally, ties broken toward
     the larger open space)
     if the destination is occupied → recurse (that unit is now displaced too)
     if the destination is off-board → the unit stops and takes collision damage
4. Detect cycles; if a cycle occurs, the innermost unit takes collision damage and stops.
```

**RISK.** The source does not specify tie-breaking or cascade order. The above is our
construction; it is deterministic and terminating, which is what matters for multiplayer
consistency. Flagged in Ch. 41.

---

## 8.4 Occupancy

```ts
type PanelKey = number;                   // i * width + j, for Map efficiency
type Occupancy = Map<PanelKey, string[]>; // panel → unit ids (usually length 0 or 1)
```

Lists rather than scalars, because:
- Platforms overlay the board (units stand under the Golden Hind).
- Scene Levels mean two units can share `(i, j)` at different elevations.
- Mid-cascade knockback transiently doubles up.

Occupancy is maintained incrementally by the movement system, and rebuilt from scratch only on
scene load and on desync detection (a checksum compared at round boundaries).

### Multi-panel footprints

A unit with footprint `w × h` anchored at `(i, j)` occupies
`{(i + di, j + dj) : 0 ≤ di < h, 0 ≤ dj < w}`. Foundry's
`token.getOccupiedGridSpaceOffsets()` returns exactly this and handles the odd-size cases.

Consequences (repeating §4.12 because geometry is where they bite):
- `distanceTo(unit)` = min over its occupied panels.
- `distanceFrom(unit)` = min over its occupied panels (so a 3×3 unit at Range 1 threatens a
  5×5 ring).
- AoE inclusion: **any** occupied panel inside the area.
- Bearing for facing: from the nearest occupied panel.

---

## 8.5 Zones

A **zone** is a named panel set with associated rules. Four kinds:

| Kind | Examples | Backed by |
|---|---|---|
| **Static** | Home bases | `Scene.regions`, authored per-scene |
| **Anchored** | ZON, Party area, Decoy radius, Detect | Computed from a unit's position; never persisted |
| **Placed** | Semiramis's `Sikera Ušum` 5×5 (which follows her), NP fields | `Scene.regions`, created and destroyed at runtime |
| **Platform** | HGoB, Golden Hind, Storm Border | `Scene.levels` + a Platform actor footprint |

### Static zones — home bases

Two per game (or one per faction). Membership drives:
- +100 HP / +1 AGI at round end (if not in combat there that round)
- Debuff cure after 3 consecutive full rounds
- −10% damage taken including NP
- +20% damage dealt (10% NP) when **both** combatants are inside
- Territory Creation's two passives
- Restriction: Nemo's Zero Sail cannot resurface into an enemy home base
- The Grail never spawns in a home base

Foundry `Region` documents give us `tokenEnter`/`tokenExit` events natively and a live
`RegionDocument#tokens` set, so membership is a read, not a computation.

Note the HGoB *"counts as a second Home Base for Semiramis' Faction"* — so home-base
membership is a predicate over a set of regions, not a single region check.

### Anchored zones

Never persisted; computed on demand from the snapshot. ZON is the important one:

```ts
function inZon(servant: UnitSnapshot, board: BoardSnapshot): boolean {
  const master = board.units.get(servant.contract.masterId);
  if (!master) return false;                          // Free Servant: no ZON
  const zon = effectiveZon(master, servant);
  return minPanelDistance(servant, master) <= zon;    // Chebyshev
}
```

with the Dioscuri override (`any(castor, pollux)`) and the Semiramis-aboard-HGoB exemption
handled as rule elements that replace the predicate rather than special cases in this
function.

### Placed zones — NP fields

Semiramis's `Sikera Ušum` creates a 5×5 area *around her that moves with her* for 2◈ turns.
That is an anchored zone with a lifetime — a hybrid. Implemented as a `Region` whose shape is
updated on the owner's movement (v14 regions support geometry updates), or, when the ruleset
config prefers it, as a pure anchored zone with a duration. **DECISION.** Use a real `Region`,
because the rules inside it apply to *any* unit entering (`"When a Unit other than Semiramis or
her Master Acts then ends its Turn within the NP area, it is inflicted with Poison"`), and
region events give us that for free.

Her alternate form — bound to the HGoB Throne Room and *preventing units from leaving* — is a
static sub-region of the platform with a movement-blocking behaviour.

---

## 8.6 Line of sight and cover

F/GT has **no line-of-sight rule**. There are no walls in the rulebook, no cover, no
obstruction of ranged attacks. Attacks are geometric only.

**DECISION.** Do not implement LOS for targeting. Foundry's wall/vision system is still used
for **visibility** (fog of war, Detect, closed-info play), but targeting legality never
consults it.

**Exception:** platform separation. Units on the ground cannot target units aboard a platform
and vice versa, with specific carve-outs (Ch. 20). That is a *level* check, not an LOS check.

This is a meaningful simplification and worth stating loudly, because a reviewer coming from
D&D-shaped systems will look for it.

---

## 8.7 Fog of war and Detect

Two related but distinct systems.

**Fog of war** is Foundry's, driven by `TokenDocument.sight`. The prototype's template had a
`visionRange` field; we map it to Foundry-native vision so the canvas does the work.

**Detect** is F/GT's own: the radius at which a unit may Discover a Presence-Concealed unit.

> *"When a Unit with activated Presence Concealment Moves into an enemy Unit's Range (Detect),
> the enemy Unit has a chance of 'Discovering' said Unit."*
> *"…(minimum 2 panels)"*

So `detect = max(2, range.panels)` by default, modifiable (Nemo's `Deafen` reduces the target's
Detect by 1; Golden Hind has an explicit `Detect: 4 panels`).

The Discover check fires on the *concealed unit's* movement, once per entering unit, with the
probability drawn from the concealed unit's Presence Concealment rank (EX 0%, A 10%, B 20%,
C 40%, D 60%, E 80%, ∓5% per step). Van Gogh has no PC; Kiritsugu's A+ gives 5%; Semiramis's
C+ gives 35%.

Critical UX note from the source:

> *"The Overseer will perform the Discover rolls, since if either Player performs the roll,
> that would mean that they would already know there is a Unit with Active Presence Concealment
> in the area."*

So the roll is **GM-client-only and silent** unless it succeeds. This is a genuine
information-leak concern and the socket protocol (Ch. 26) must not broadcast the attempt.

---

## 8.8 Direction and bearing

For anchored directional shapes ("in any non-diagonal direction next to X") we need a
**direction** type distinct from facing:

```ts
type Cardinal = "N" | "E" | "S" | "W";
type Octal    = Cardinal | "NE" | "SE" | "SW" | "NW";
```

- **Facing** (§4.2) is octal, stored on the token's rotation, used for the front/side/back
  determination.
- **Placement direction** for directional AoE is **cardinal only** — the source consistently
  says "non-diagonal direction".
- **Golden Hind's bow direction** is the platform's facing, and its NP fires a `7×3` or `3×7`
  area depending on whether the bow points along the row or column axis — i.e. cardinal, with
  the rectangle's long axis aligned to it.

```ts
const DELTA: Record<Cardinal, GridOffset> = {
  N: { i: -1, j: 0 }, S: { i: 1, j: 0 }, E: { i: 0, j: 1 }, W: { i: 0, j: -1 },
};
```

Bearing from A to B, for the relative-side calculation, uses `atan2` on panel centres and is
continuous (not snapped), so a unit attacked from a knight's-move offset resolves to the
correct 90° cone.

---

## 8.9 Grid configuration summary

| Foundry setting | Value | Reason |
|---|---|---|
| `grid.type` | `SQUARE` (1) | F/GT is a square-grid game |
| `grid.distance` | 1 | One panel = one unit of distance |
| `grid.units` | `"panels"` | Matches rulebook vocabulary in the ruler |
| `core.gridDiagonals` | `ILLEGAL` (6) | Movement is orthogonal-only; makes native pathing correct |
| `grid.size` | 100 px (default) | Arbitrary; scene-authored |
| Token `lockRotation` | `false` | Facing is stored in rotation |

**Note the tension:** `gridDiagonals = ILLEGAL` is correct for *movement* but wrong for
*distance* — ZON and "N panel area" are Chebyshev, where diagonals cost 1. So we cannot use
`grid.measurePath()` for those; we use our own `chebyshev()`. The Foundry setting governs
movement and the ruler; our functions govern rules. This split is documented at every call
site, and the geometry module exports no function named `distance` — only `chebyshev`,
`manhattan`, and `inAttackRange` — so that no one can pick the wrong one by accident.

---

## 8.10 The geometry module API

L1, pure, no Foundry globals:

```ts
// distances
chebyshev(a, b): number
manhattan(a, b): number
inAttackRange(from, to, R): boolean
attackRangePanels(from, R, bounds): GridOffset[]

// footprints
footprintPanels(anchor, w, h): GridOffset[]
minDistanceBetween(unitA, unitB): number       // footprint-aware
nearestPanel(from: GridOffset, unit): GridOffset

// areas
chebyshevArea(centre, radius, bounds): GridOffset[]
rect(anchor, w, h, align): GridOffset[]
orthogonalAdjacentRect(origin, w, h, dir): GridOffset[]    // §9.3
line(origin, dir, length, width): GridOffset[]
ring(centre, inner, outer): GridOffset[]

// direction
bearing(from, to): number                      // degrees
relativeSide(facing, bearing): RelativeSide
cardinalTowards(from, to): Cardinal

// legality
isOrthogonalStep(a, b): boolean
reachable(origin, budget, costFn, bounds): Map<PanelKey, number>
pathTo(origin, dest, costFn, bounds): GridOffset[] | null

// utility
clampToBounds(o, bounds): GridOffset
toAlgebraic(o, height): string
```

Every function is total (no throws), deterministic, and bounds-aware. `reachable` is a
uniform-cost search; on a 25×25 board with MOV ≤ 12 that is at most 625 nodes, which is
trivially fast and is memoized per unit per turn.

---

## 8.11 Testing geometry

Geometry is the easiest subsystem to test exhaustively and the most damaging to get wrong, so:

- `inAttackRange` is verified against a **hand-authored fixture** of the R=1..5 panel sets,
  transcribed from the rulebook's stated cases and our derivation, including the exact count
  assertions (R=3 → 37 panels, R=4 → 57, R=5 → 81).
- `chebyshev`/`manhattan` are property-tested for symmetry, identity, and triangle inequality.
- `orthogonalAdjacentRect` is tested for all four directions × odd and even dimensions
  (§9.3 covers the even-width alignment question).
- Knockback cascade is property-tested for termination and for conservation (no unit vanishes,
  no two units end on the same panel).
- `reachable` is compared against a brute-force BFS reference implementation on random boards.

---

**Next:** [09 — Targeting](09-targeting.md)
