# 09 — Projection: documents to plain data

## What it is

The system's single projection boundary: documents go in, plain objects come out. Every rule downstream reads from a snapshot, not from a document, and nothing downstream awaits or touches a global. That boundary is what makes the 253 tests possible — hand-built snapshots run through the rules layer without Foundry present (`module/rules/snapshot.mjs:1-14`).

Two snapshots project the document state: **UnitSnapshot**, one actor paired with its placed token, and **BoardSnapshot**, all actors at once. They share no shape — the same field appears differently in each, and code reading only one shape has caused real bugs.

## Where it lives

| File | Role |
|---|---|
| `module/rules/snapshot.mjs` | `snapshotUnit`, `snapshotBoard`, `expressionRefs` — the projection layer |
| `module/engine/board.mjs` | `unitSnapshot` with position resolved; `currentBoard` — the engine's snapshot builder |
| Tests | `test/unit/snapshot.test.mjs` — position projection pinned; `test/unit/contribution-projection.test.mjs` — contribution shape |

## How it works

### One snapshot per operation

A snapshot is built once per *operation* — one attack, one skill use — not per predicate evaluation. Rebuilding 28 units × 30 effects for every check would be pathological (`module/rules/snapshot.mjs:10-14`).

### UnitSnapshot: one actor's projection

**Called by:** `module/engine/board.mjs:unitSnapshot`, `snapshotBoard` (module/rules/snapshot.mjs:655), and anywhere the rules layer needs to read an actor in isolation.

**Key shape decisions:**
- Numeric fields extract the `.value` from `{value, max}` objects: `health: sys.health?.value ?? null` (module/rules/snapshot.mjs:181), `agility: sys.agility?.value ?? 0` (module/rules/snapshot.mjs:183), `luck: sys.luck?.value ?? 0` (module/rules/snapshot.mjs:184). The maximum is stored separately as `maxHealth` and `baseHealth` where needed.
- Resources normalize each one: `Object.fromEntries(Object.entries(sys.resources ?? {}).map(...{value, max}))` (module/rules/snapshot.mjs:354-356).
- Effects are ID lists: `effects: effectIds` (module/rules/snapshot.mjs:342), plus an instance list `effectInstances` that carries `{defId, stage, uses, clock}` shapes per effect.
- Position always comes from the token, not the actor: `panel: footprint[0]` (module/rules/snapshot.mjs:172), resolved by the caller before projection.

### BoardSnapshot: all units with board-wide context

**Called by:** every operation in `engine/` — attacks, movement, skill use — and most sheets.

Created by `snapshotBoard` (module/rules/snapshot.mjs:655) in two phases:

1. **Per-unit:** each actor is projected via `snapshotUnit` (module/rules/snapshot.mjs:658-668).
2. **Board passes:** annotations run once every unit exists, rewriting snapshots to capture positional facts (`annotateZon`, `annotateAuras`, `annotateTerrain`, `annotatePlatforms`, `annotateFields`, `annotateEnvironment`, module/rules/snapshot.mjs:741-829).

**Key board differences from UnitSnapshot:**
- Unit fields rewritten in place: `zonDistance`, `outsideZon`, `platformId`, `platformContentId` (written by `annotatePlatforms`, module/rules/snapshot.mjs:894-902).
- Indices built here: `auraIndex` (module/rules/snapshot.mjs:828), used only on the board.
- Two-unit relationships: `zonBonuses`, `masterId` relationship facts — answered by the board, unanswerable from a unit alone.
- Position assumed already resolved: every unit carries a real `panel`, not the origin.
- **Whose Turn it is**: `actingFactionId`, supplied by `currentBoard` from the combat document's own getter and `null` outside a match. Added for #28, where `rules/nameless-forest.mjs` gated the Forest escape on `board.activeFactionId` — the **scheduler context's** name for the same idea, which `snapshotBoard` has never produced. The read was `undefined`, the guard short-circuited, and the gate refused nobody. The unit tests supplied the scheduler's name by hand, so code and tests agreed with each other and not with the system.

### Expression context: a different shape

**Called by:** contribution collection, damage magnitude resolution. `expressionRefs(actor)` (module/rules/snapshot.mjs:1582) is a facade for `@` expressions authored in content.

**Shape change:** same fields, different nesting. `luck: sys.luck ?? null` (module/rules/snapshot.mjs:1601) — the whole `{value, max}` object — vs. UnitSnapshot's `luck: sys.luck?.value ?? 0`. Same for `health` (module/rules/snapshot.mjs:1595 vs. 181) and `agility` (module/rules/snapshot.mjs:1600 vs. 183).

Why this matters: expressions like `@self.luck.value` read the facade's luck as a whole object, then pull `.value` from it. A rule reading `unit.luck` directly gets the number, not the object, and the same expression computes differently on the two projections.

## Invariants & edge cases

1. **Numeric fields extract `.value` in UnitSnapshot.** `health`, `agility`, `luck` are stored as `{value, max}` on actors but extracted as plain numbers (module/rules/snapshot.mjs:181, 183-184). The separate `maxHealth`, `maxLuck` fields carry the maximum.

2. **BoardSnapshot overwrites unit fields.** `annotatePlatforms` (module/rules/snapshot.mjs:887) writes `u.platformId`, `annotateZon` writes `u.zonDistance`, `annotateAuras` writes `u.modifiers` — the same snapshot object, modified in place. A unit read from the board carries the results of all passes (module/rules/snapshot.mjs:741-829).

3. **Position is caller responsibility.** `snapshotUnit` without a token places the unit at `{0, 0}` (module/rules/snapshot.mjs:172). `snapshotBoard` expects pre-resolved snapshots passed via `actors[].snapshot` (module/rules/snapshot.mjs:658), else it re-projects them with positions from `token`. `module/engine/board.mjs:unitSnapshot` resolves the position first (module/engine/board.mjs:82-94).

4. **A board snapshot carries its own settings.** Round, phase, difficulty, terrain areas, zones, alliances — immutable during one `snapshotBoard` call (module/rules/snapshot.mjs:669-732). Changes to these require a new board snapshot.

5. **Effects are ID lists on the unit, instances on the board.** `effects: [defId, defId, ...]` is what rules consult (module/rules/snapshot.mjs:342). `effectInstances` carries the full state — stage, uses, clock (module/rules/snapshot.mjs:348). The array is built inside `snapshotUnit` and rewritten by the `withoutForeignEffects` filter (module/rules/snapshot.mjs:813).

6. **Multi-panel units carry both `panel` and `panels`.** `panel` is the top-left corner (module/rules/snapshot.mjs:172), `panels` is null for single-panel units and an array otherwise (module/rules/snapshot.mjs:173). Rules consult both: footprint checks use `panels`, distance checks use `panel` and reach it via `chebyshevFromAny` (module/domain/geometry.mjs).

## Open questions

- **Confirmed live: UnitSnapshot's numeric extraction loses the maximum.** `luck: sys.luck?.value ?? 0` (module/rules/snapshot.mjs:184) discards the `max` field. Rules consulting the snapshot cannot ask "is this unit at max luck" without a separate lookup. Verified in the `fgt2026` world: `snapshotUnit` on Heracles returns `health: 1600`, `luck: 19` and `agility` as bare **numbers**, while the document carries `{value, max}` for all three. Whether any rule needs the maximum from a snapshot is still open; that it is absent is now established.

- **When to use UnitSnapshot vs. BoardSnapshot.** The two shapes are used inconsistently across the engine. `rules/resolve.mjs` and `rules/damage.mjs` read from the board, but `rules/options.mjs` predicates consult snapshots passed at predicate-check time — which may be either. Documentation or an invariant would clarify.

- **Confirmed live: expression context disagrees with UnitSnapshot.** `expressionRefs` returns `luck: sys.luck ?? null` (module/rules/snapshot.mjs:1601), UnitSnapshot returns `luck: sys.luck?.value ?? 0` (module/rules/snapshot.mjs:184). An expression `@self.luck.value` would fail if handed a UnitSnapshot, but succeed if handed the expression facade. The disagreement was observed directly against a live board (see above): the projection flattens, the document and the expression facade do not. No test exercises a magnitude expression against a hand-built snapshot, so the failure mode is real but unpinned.

- **Board passes rewrite snapshots in place.** Calling `annotateZon(units)` twice on the same array is not idempotent — the second call reads fields the first wrote. No code documents whether this is safe or which passes depend on which others' outputs. The ordering comment (module/rules/snapshot.mjs:741-829) records the dependencies for reading only.
