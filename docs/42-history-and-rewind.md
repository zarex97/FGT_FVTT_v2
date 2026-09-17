# 42 — History, state rewind and desync detection

## What it is

History is a per-match ring buffer of unit state snapshots, held on the Combat document. It records what each unit looked like at each turn, but only when something on the board reads it — a match without Nursery Rhyme pays nothing (`module/engine/state-history.mjs:67`). A rewind takes a unit's snapshot from some turn in the past, filters it to exclude what must not change (position, facing, contract state), and restores it wholesale: stats, parameters, effects, cooldowns and modes all at once (`module/engine/io.mjs:891`). The desync detector is a cheap insurance policy: once per round boundary, the GM broadcasts a checksum of positions, health values and effect ids, and any client that disagrees re-renders from the documents (`module/engine/invalidation-hooks.mjs:133-156`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/history.mjs` | Whether history is recorded, the snapshot shape, and shallow diff/patch for compression |
| `module/engine/state-history.mjs` | The ring buffer on Combat, retention size, recording and rewind intent generation |
| `module/rules/desync.mjs` | Checksum computation and comparison, FNV-1a 32-bit hash |
| `module/engine/invalidation-hooks.mjs` | Round-boundary detector, GM broadcast, client refresh on disagreement |
| `module/rules/glass-game.mjs` | The Queen's Glass Game's clock and target ring |
| `module/engine/glass-game.mjs` | `rewindScript`, the corpus's first and only Script, driving the rewind intent batch |
| `module/engine/scripts.mjs` | Script registry, including `nurseryRhyme.rewind` |
| `module/engine/intents.mjs` | The `rewind` intent type, `ORDER` rank 8, and constructor (`module/engine/intents.mjs:253-254`) |
| `module/engine/applier.mjs` | The `rewind` case, calling `io.rewind` with the state payload (`module/engine/applier.mjs:526-528`) |

## How it works

### The snapshot shape

A `UnitStateSnapshot` holds seven things: `globalTurn`, `stats` (health, agility, luck), `parameters`, `grantedSteps`, `baseAttackPenalty`, `effects` (full instances with source tracking), `cooldowns`, `resources` and `modes` (`module/rules/history.mjs:39-48`). **Position, facing, turn budget and contract state are not here**, and excluded from the buffer rather than filtered by the applier (`module/rules/history.mjs:56-59`). Q45 settled it: *"Units are not teleported back."* Effects are stored as full instances, not ids, because an id alone cannot restore magnitude or expiry, and each records the source unit id so the applier can drop orphans when the effect's creator has since been removed (`module/rules/history.mjs:62-63`).

### The ring buffer

The buffer lives on Combat and is initialized empty; `recordTurn` is called at turn end if anything on the board reads history (`module/engine/state-history.mjs:63-67`). The oldest retained entry is a full snapshot and every later one is a patch against its predecessor, so a lookup replays forward from the base (`module/engine/state-history.mjs:77-81`). The buffer holds `6 * turnsPerRound + 2` turns of history: six because that is how far back effect 2 reaches, and the +2 margin is the chapter's own (`module/engine/state-history.mjs:32-33`). When a new turn is recorded, entries older than the cutoff are trimmed, and the new oldest entry becomes a full snapshot because a patch whose base has been discarded reconstructs nothing (`module/engine/state-history.mjs:186-201`). A `stateAt` lookup that asks for a turn that has fallen off the end returns `null`, never the oldest entry still held (`module/engine/state-history.mjs:100-111`).

### The rewind operation

`rewindIntents` produces one `rewind` descriptor per unit that has a state to restore (`module/engine/state-history.mjs:122-162`). It drops effects whose source unit has since been removed — recorded as log intents so the drop is audited (`module/engine/state-history.mjs:140-150`). It filters out `namelessForestTokens` — *"Does not affect Nameless Forest Tokens"* — because the rewind excludes that pool and merging would blank what the unit holds right now (`module/engine/state-history.mjs:131-132`, `module/engine/io.mjs:904-912`). The rewind is applied by the `io.rewind` function, which updates every stat, parameter, cooldown, mode and effect at once (`module/engine/io.mjs:891-937`). Effects are replaced wholesale: the snapshot is the answer to "what was on this Unit", and identity-based reconciliation would need tracking the buffer does not carry (`module/engine/io.mjs:927-936`). **What it cannot restore**: position, facing, turn budget, contract state and Nameless Forest tokens. The rewind is a parting shot from a defeated unit, not a resurrection — `clearsDefeat` is always false (`module/engine/state-history.mjs:155-158`).

### The scripted escape hatch

`nurseryRhyme.rewind` is the corpus's first Script — data could not generalise *its* behaviour, and a rule element inventing "rewind" from a single example would be premature (`module/engine/glass-game.mjs:8-17`). The Script walks a unit set, resolves a historical index, diffs two states and emits a heterogeneous batch in one function. It identifies all units within 3 panels of Nursery (allies and enemies, including herself), looks up their state at `tick - rewindTurns` turns, and emits a `rewind` intent per unit (`module/engine/glass-game.mjs:36-46`). The targets come from `glassGameTargets`, which filters by Chebyshev distance and checks `includesSelf` — effect 2 adds that she is included in her own radius (`module/rules/glass-game.mjs:84-91`). This is why Scripts exist: a second rewind would trigger generalisation; until then, one specialised function beats a vocabulary for a shape nothing else has (`module/engine/glass-game.mjs:16-17`).

### The desync detector

The detector runs once per round boundary. The GM computes `boardChecksum(currentBoard())` and broadcasts it; a client that disagrees calls `compareChecksums`, logs a warning and re-renders from the documents (`module/engine/invalidation-hooks.mjs:133-156`). The checksum hashes positions (as `"i,j"`), health values (or `"null"` for undamageable units), and effect ids (sorted at both levels so order differences do not trigger false alarms) (`module/rules/desync.mjs:32-45`). The hash is FNV-1a 32-bit because `crypto` is a Node import the rules layer cannot take and `SubtleCrypto` is async (`module/rules/desync.mjs:82-89`). A missing broadcast is treated as agreement — it is a client that connected after the round boundary, not evidence of drift (`module/rules/desync.mjs:58-62`). **What it compares**: positions, health and effect ids only. Every field added that can legitimately differ between clients turns the detector into a false alarm (`module/rules/desync.mjs:12-16`).

## Invariants & edge cases

1. **History is opt-in.** A match records nothing unless something declares `requiresHistory: true` (`module/rules/history.mjs:27-29`). A defeated unit still counts — the Queen's Glass Game fires on defeat and needs six Rounds of history (`module/rules/history.mjs:21-22`).

2. **Snapshots store full effect instances, not ids.** An id alone cannot restore magnitude, expiry or source tracking, and the buffer would lose all three (`module/rules/history.mjs:62-63`).

3. **Patches are shallow diffs.** Only top-level keys are tested for change, because these are small objects and a deep structural diff would cost more to compute than it saves (`module/rules/history.mjs:126-128`).

4. **The buffer survives a rewind's own application.** The glass game's effect 2 resets the clock but not the buffer: the history must outlast the rewind that reads it, because the same query might ask for six Rounds back twice (`module/rules/glass-game.mjs:48-52`).

5. **A rewind never clears defeat.** Even if health is restored to full, the unit stays defeated — the rewind is a parting shot, not a resurrection (`module/engine/state-history.mjs:155-158`).

6. **Nameless Forest tokens are preserved across a rewind.** Every other resource comes back; this one is carved out by name (`module/engine/state-history.mjs:49`).

7. **The desync checksum ignores field order.** Units and effects are sorted before hashing, so two clients receiving effects in different creation orders still agree (`module/rules/desync.mjs:42`, `test/unit/desync.test.mjs:42-47`).

8. **Rewind does not go before the oldest snapshot.** `stateAt` returns `null` for a turn that has fallen off the buffer, and the applier drops the rewind rather than silently restoring a stale turn (`module/engine/state-history.mjs:100-111`).

## Traps and anti-patterns

**Storing identity-based effect reconciliation in the buffer.** The first rewind implementation planned to record effect ids only and reconcile by matching `defId`; this would have lost magnitude, expiry and per-instance metadata on restore. **Store full instances instead, with source tracking so orphans can be audited.** The snapshot is the answer to "what was on this Unit", and Foundry effect identity is not stable across deletion and re-creation (`module/rules/history.mjs:62-63`, `module/engine/io.mjs:927-936`).

**Reading a buffer that never existed on older Combat documents.** Early matches did not carry a history flag, so the first rewind on a match that predated the feature would read `undefined`, call `recordTurn`, and lose the entire game state to a null return (`module/engine/state-history.mjs:63-67`). **Initialize history as `{}` and check for `history?.[unitId]` rather than assuming a complete record; a missing unit is not an error** (`module/engine/state-history.mjs:74`).

**Trimming before checking retention.** An off-by-one in the cutoff calculation would drop the turn the rewind was trying to restore. **Store the cut-off calculation in a named constant, test round-boundary parity (the edge at turn 6 Rounds back), and verify the oldest entry survives the first trim** (`module/engine/state-history.mjs:32-34`, `module/engine/state-history.mjs:186-201`).

## Open questions

- **Answered: it is expected, and the detector is built to ignore it.** `boardChecksum` sorts at
  **both** levels -- the effect ids within each unit, and the unit rows themselves
  (`module/rules/desync.mjs:33-43`) -- and the header says why: *"Units arrive in whatever order the
  canvas enumerated its tokens, and effects arrive in creation order -- which differs per client when
  two are applied in one batch. Neither is a desync, and an order-sensitive hash would report one on
  every board."* The checksum also covers only id, panel, health and effect ids, on the same
  reasoning: *"every field added that can legitimately differ between clients turns the detector into
  a false alarm, and a detector that cries wolf is turned off."* So drift is common by design and
  invisible by construction.

- **Still open; it needs an induced mid-rewind failure.** A rewind deletes effects and re-creates
  them, and there is no transaction spanning the two halves -- the same shape as the summon
  cross-link in Chapter 31. Settling it means forcing a failure between the delete and the create,
  which needs fault injection rather than observation.

- **Why is history opt-in?** Snapshotting a full board every turn, storing it for six Rounds, and diffing it costs tokens and storage. Nursery Rhyme is the only ability that reads history; every other unit in both rosters reads the present or schedules the future (`module/rules/history.mjs:10-14`).

- **Why not exclude position in the rewind applier instead of the buffer?** A filter at apply time would rebuild the logic on every restore, and a buffer that stored what no one would restore is dead weight. **Exclusion is cheaper to keep — nothing to filter, on every restore, for ever — and expensive to reverse, the correct asymmetry for a ruling this settled** (`module/rules/history.mjs:56-59`).
