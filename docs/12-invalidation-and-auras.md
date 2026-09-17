# 12 — Invalidation, auras and the aura index

## What it is

The system caches derived data — overlays, board positions, aura coverage — and keeps it fresh
through a **table**, not a hand-maintained hook list. Each time a document changes, the table
says what is now stale; the engine clears those caches and broadcasts the news so consumers can
re-render. A second layer, **auras**, reaches units around a source without applying effects to
them, and a spatial index narrows the candidates from O(n²) to a bucket lookup.

The distinction that makes auras necessary is load-bearing: leaving the radius has to remove the
benefit instantly; `highestOnly` resolution compares every source at evaluation time; and a
modifier living on the recipient instead of the source is not dispellable from the recipient
(`module/rules/auras.mjs:7-13`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/invalidation.mjs` | The table: what each change invalidates |
| `module/engine/invalidation-hooks.mjs` | Foundry hooks → invalidations; maintains the canvas aura index |
| `module/rules/auras.mjs` | Expanding a source's aura onto its recipients; stacking and roles |
| `module/rules/aura-index.mjs` | Spatial bucketing: 4×4 panels, version-stamped rebuilds |

## How it works

### Invalidation

The **invalidation table** (`module/rules/invalidation.mjs:77-131`) is closed: each event name
maps to a set of targets, and every target is pre-declared (`module/rules/invalidation.mjs:28-37`).
An unknown change invalidates nothing — the alternative, invalidating everything to be safe, is a
permanent rebuild that degrades silently (`module/rules/invalidation.mjs:65-67`).

Nine events drive the table:

- **`actorField`**: unit property change → `["board"]` and `snapshot:${actorId}` (`module/rules/invalidation.mjs:81-82`)
- **`effectChanged`** and **`itemChanged`**: create, delete, or update → `["board"]`, plus `["auraIndex"]` only if it grants an aura
  (`module/rules/invalidation.mjs:84-95`). Rebuilding on every effect would rebuild on every burn tick.
- **`modeToggled`**: mode activation toggled → invalidates `["auraIndex"]` and, if the mode changes `canAct`, also
  `masterProtection:${actorId}` for Masters within 2 panels (`module/rules/invalidation.mjs:97-101`). The rule: *anything that
  changes `canAct` invalidates Master protection for Masters within 2 panels* (`module/rules/invalidation.mjs:15-18`).
- **`tokenMoved`**: position changed → `["board", "auraIndex", "decoy", "compulsions"]`, plus `zon` for both the mover and its ZON partner
  (`module/rules/invalidation.mjs:103-110`)
- **`tokenDeleted`** and **`createToken`**: → `["all"]` (`module/rules/invalidation.mjs:112-113`)
- **`turnAdvanced`** and **`roundAdvanced`**: → `["board", "cooldowns", "effectActivity", "compulsions"]`, plus `["phase"]` on round
  (`module/rules/invalidation.mjs:114-121`)

The engine attaches hooks in `attachInvalidation` (`module/engine/invalidation-hooks.mjs:65-118`),
which runs from `ready` and translates each Foundry event into an `invalidationsFor` call. The
`invalidate` function clears the named caches and broadcasts `Hooks.callAll("fgt.invalidate",
targets)` so consumers subscribe to what they care about (`module/engine/invalidation-hooks.mjs:51-59`).

The aura index is cached separately: `canvasAuraIndex()` rebuilds it on demand, while resolution
paths build synchronously because the impact system requires current data before reading
(`module/engine/invalidation-hooks.mjs:42-45`).

### Auras and collection

An **aura** is a rule element on unit A that affects units around it without creating effects on
them. Every collected aura carries: a source, radius, relations (allies/enemies/self), distance
checks, boundary checks, recipient roles, and a stacking rule (`module/rules/auras.mjs:47-90`).

The collection runs in two passes (`module/rules/auras.mjs:128-143`): collect all auras against
the untouched board, then write them back. This breaks the dependency cycle — unit A's modifiers
depend on unit B's position, and vice versa. No unit can observe another's freshly-received auras,
so *an aura cannot feed an aura* and the result is order-independent.

For each recipient:
1. **Find candidates** — all units with auras, or from the index if available (`module/rules/auras.mjs:105-112`)
2. **Filter by relation** — `relationOf(source, unit, board)` must be in `relations` (`module/rules/auras.mjs:52-53`)
3. **Filter by distance** — either `scope: "field"` (unbounded) or within `radius` Chebyshev distance, measured from the
   nearest panel of multi-panel units (`module/rules/auras.mjs:58-61`, `module/rules/auras.mjs:256-262`)
4. **Boundary check** — isolated fields that seal effect application seal auras too (`module/rules/auras.mjs:63-67`)
5. **Recipient predicate** — a condition on the RECIPIENT, e.g., "in their Home Base" (`module/rules/auras.mjs:69-73`)
6. **Recipient roles** — named roles relative to the source (summoner, summonerMaster, linkedPartner) (`module/rules/auras.mjs:75-78`)
7. **Stacking** — `highestOnly` keeps the highest value per key; `group` resolves entire auras by rank as one unit
  (`module/rules/auras.mjs:275-311`)

After binding (recording the source and stripping address fields), modifiers are routed to the
correct reader field: `ApplicationChance` → `applicationChances`, `DamageNegation` →
`damageNegation`, `Compulsion` → `compulsions`, etc. (`module/rules/auras.mjs:139-141`,
`module/rules/auras.mjs:151-180`).

### The spatial index

The aura index divides the board into 4×4 panel buckets (`module/rules/aura-index.mjs:35`) and
indexes each aura into every bucket its radius touches (`module/rules/aura-index.mjs:96-112`).
`candidatesAt(index, panel)` looks up one bucket and returns the (source, aura) pairs
(`module/rules/aura-index.mjs:76-81`), avoiding an O(n²) sweep.

Three properties make it work:
1. **Units with no auras cost nothing** — skipped before any geometry (`module/rules/aura-index.mjs:49-52`)
2. **Spatial narrowing only** — `candidatesAt` is an optimization; `collectAuras` still applies relation rules
  (`module/rules/aura-index.mjs:23-25`). A stale index can never add an aura the geometry does not support.
3. **Version gating** — the index carries a version so callers detect staleness without comparing contents
  (`module/rules/aura-index.mjs:19`)

The rebuild is one-frame stale on display but acceptable: *any resolution rebuilds synchronously before reading*
(`module/rules/aura-index.mjs:29`). The index is rebuilt whenever `auraIndex` appears in an invalidation target
(`module/engine/invalidation-hooks.mjs:54`).

## Invariants & edge cases

1. **Invalidation is a closed list.** Unknown events invalidate nothing; the failure mode is silent if
   too little is invalidated, but catching too much (everything) is worse (`module/rules/invalidation.mjs:65-67`).

2. **`grantsAura` is checked explicitly.** Invalidation rebuilds only on aura-bearing effects,
   not on every effect. The cost of rebuilding on every burn is what the index exists to avoid
   (`module/engine/invalidation-hooks.mjs:75`, `test/unit/aura-index.test.mjs:147-153`).

3. **A mode toggle invalidates Master protection.** Mode changes do not move anyone, but
   `canAct` changes affect nearby Masters' protection status (`module/rules/invalidation.mjs:14-18`,
   `test/unit/aura-index.test.mjs:164-170`).

4. **The aura index narrows candidates; `collectAuras` judges them.** Two relation implementations
   would be two answers to one question (`module/rules/aura-index.mjs:24-25`).

5. **Auras measure from the nearest panel of multi-panel units.** A nine-panel platform reaches further
   than a single panel at the same distance (`module/rules/auras.mjs:250-262`). Both source and recipient
   are measured this way.

6. **Unbounded auras still respect boundaries.** `scope: "field"` makes an aura reach anywhere on the board,
   but it cannot cross a boundary that seals effect application (`module/rules/auras.mjs:54-67`,
   `test/unit/auras.test.mjs:400-415`).

7. **Relations default to `["ally", "self"]`.** An aura reaches its own bearer unless the text excludes it;
   `relations: ["ally"]` skips the source itself (`module/rules/auras.mjs:52`, `test/unit/auras.test.mjs:50-65`).

8. **Grouped auras resolve by rank as a whole.** Item Construction has six elements, and a C-rank instance with
   a larger number still loses to an A-rank. Comparing per-element would blend two Skills (`module/rules/auras.mjs:285-294`,
   `test/unit/auras.test.mjs:209-216`).

9. **The index does not detect its own staleness.** It carries a version but the caller must rebuild it;
   a stale index is one-frame old on canvas and current once a synchronous resolution runs
   (`module/rules/aura-index.mjs:19-20`).

## Open questions

- **Confirmed live.** A `scope: "field"` aura reaches any panel. Built on a 13×13 board with the source
  at `{0,0}`: a recipient at `{12,12}` — Chebyshev **12**, the maximum separation — received it, while a
  radial aura from the same source obeyed its radius exactly (radius 0 excluded a neighbour at distance 1;
  radii 1, 2 and 3 included it). The distance test is skipped outright for field scope
  (`module/rules/auras.mjs:58`). Unbounded is not unconditional, though: a bounded field that seals effect
  application seals a field-scoped aura too (`module/rules/auras.mjs:67`).
- **Confirmed live, and the hazard is real.** `Rank.parseOrNull("not-a-rank")` genuinely **throws**
  — *"Cannot parse rank"* — so without the guard a single bad value inside `snapshotBoard` would blank every
  unit on the field. `outranks` catches it and reads an unparseable rank as unranked, identically to `null`:
  `outranks(bad, "A")` is `false` and `outranks("A", bad)` is `true`, matching the `null` results exactly
  (`module/rules/auras.mjs:326`).
- **The table cites Ch. 08, which is a plan-era reference now archived.** Both `invalidation.mjs:3` and `invalidation-hooks.mjs:3`
  refer to docs being rebuilt. The intent is clear from code, but the original reasoning lives elsewhere.
