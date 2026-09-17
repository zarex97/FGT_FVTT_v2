# 10 — Rule elements, scripts and priority bands

## What it is

A **rule element** is authored data that declares what contribution an ability should make. *"A percentage into the stage-4 bucket"* (`DamageModifier`), *"an umbrella name for a set of effects"* (`Immunity`), *"a magnitude that scales with how many of an effect the bearer holds"* (`PerStack`). Something has to turn that data into a number, a flag, or a modification that a system somewhere downstream can consume (`module/rules/elements.mjs:1-20`).

The execution layer is a **dispatch table keyed by `key`**, not a class hierarchy. Sixty-two functions, one per element type, each push contributions into a `out` object. A rule element's key determines which function runs; that function resolves any literal values, table lookups, or `@`-expressions, validates the result, and routes it to the appropriate bucket in the `Contributions` structure (`module/rules/elements.mjs:811-813`). Without this layer, authored content loads into a compendium where it sits doing nothing — which is the failure mode the content validator exists to prevent, one layer up.

Priority **bands** make elements deterministic. Authored content sometimes declares elements in a different sequence on different clients, depending on when documents loaded. Bands sort elements into execution windows before lexicographic source id tie-breaks, so every client computes the same result from the same board (`module/rules/ordering.mjs:1-10`). The two that matter most are 30 and 35: an aura must be **collected** before anything **reads** it — *"Clarity doubles the Area CritUp it receives"* — and running it first would double nothing (`module/rules/ordering.mjs:12-15`).

**Scripts** are a closed registry — entries written in code, never `eval`. A compendium is data other people wrote; a `script:` naming something outside this object runs nothing and logs a warning. It does not throw — a malformed magnitude must not take the whole turn down, and the same holds here — and it certainly does not `eval` (`module/engine/scripts.mjs:1-24`). The corpus uses exactly one: `nurseryRhyme.rewind`, for Nursery Rhyme's Glass Game rewind mechanic. Ch. 45 budgets four across ~130 abilities; adding a fifth entry is a design conversation, not a merge (`module/engine/scripts.mjs:36-44`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/elements.mjs` | Dispatch table (`EXECUTORS`), `collectContributions`, predicate deferral, value resolution |
| `module/rules/ordering.mjs` | Priority bands (`PRIORITY_BANDS`), element sorting (`orderElements`) |
| `module/engine/scripts.mjs` | Named script registry (`SCRIPTS`), execution (`runScript`) |
| `module/rules/effects/count-targets.mjs` | Magnitude computed from a phase's resolved target set |
| `module/rules/effects/families.mjs` | Effect families — umbrella groupings, e.g. *Bind* for all stun-class effects |
| Consumers | Damage pipeline, ability targeting, aura reading, effect application, stat resolution |

## How it works

### Collection

`collectContributions(abilities, ctx)` iterates each ability and its rules, passives, and active abilities (`module/rules/elements.mjs:95-161`). Elements are ordered by `orderElements` before execution (`module/rules/elements.mjs:117`), so two clients holding the same documents in different load order compute the same result (`module/rules/ordering.mjs:109-120`). If an element has no executor function in `EXECUTORS`, it is collected into `unhandled` — a bug surfaced (`module/rules/elements.mjs:152-156`).

Predicates are tested per-unit, against only that unit's options (`module/rules/elements.mjs:95-98`). An element naming `target:` or `attack:` or board state like `self:inHomeBase` cannot be answered yet — the target does not exist, the attack is not yet built, the board is not yet snapshotted. These predicates travel to whoever can answer them, marked by `deferredPredicate` (`module/rules/elements.mjs:217-223`). A deferred predicate travels on the modifier and is re-tested by the consumer (damage pipeline, effect application) with the full option set. A predicate naming `self:attribute:outsider` inside a defensive clause means *"whoever is hitting the bearer"*, but answering it against the bearer's own options reads "false" for ever — so `defer: true` forces deferral even when the logic suggests otherwise (`module/rules/elements.mjs:193-211`).

### Bands and ordering

Nine bands execute in order: `base` (10), `additive` (20), `auraCollection` (30), `auraConsumers` (35), `multiplicative` (40), `applicationChance` (50), `absoluteSet` (60), `immunity` (70), `bounds` (80), `suppression` (90) (`module/rules/ordering.mjs:18-29`). Each element key belongs to one band; an unknown key defaults to `additive` rather than sorting to either end, so new elements never silently run before everything or after everything (`module/rules/ordering.mjs:90-96`). Within a band, elements sort by source id lexicographically, then by their original order in the array (test: `module/unit/ordering.test.mjs:42-70`).

The `consumesAuras` flag overrides band assignment: an element that reads aura magnitudes runs in the consumer band, whatever its key, because the dependency (reading auras) decides the order, not the name (`module/rules/ordering.mjs:94-95`).

### Value resolution

An element's value may be a literal, a `table:` key looked up against the owning ability's rank, or an `@`-expression. `resolveValue` unpacks all three and handles scale adjustments (`module/rules/elements.mjs:319-321`). `perStack` scales a magnitude by how many of a named effect the bearer holds: `base + value × floor(count / each)`, returning 0 if the bearer holds none — a distinction that matters (Ch. 45: Kingprotea's Max Health per stock pays nothing at zero) (`module/rules/elements.mjs:323-350`).

Magnitude factors — `magnitudeFactor` and `magnitudeRoundTo` — are applied here, in one place, so every element gains them without re-implementing the logic. Mad Enhancement is *"all damage dealt is increased by X% ... this effect is halved for Attacks which use Base Attack (MAG)"*, and `magnitudeFactor` lets the single table value be multiplied by 0.5, avoiding a second ladder. `magnitudeRoundTo` applies the author's own rounding; Kingprotea's A+ halves to 42.5 and rounds DOWN to 40 (`module/rules/elements.mjs:832-853`).

### Scripts

`runScript(name, ctx)` looks up a name in `SCRIPTS` and calls it if it exists, or logs a warning and returns `[]` if it does not. Every script in the registry is a function taking a context object and returning an array of intents. `nurseryRhyme.rewind` restores an arbitrary historical snapshot across a unit set by walking the board, resolving an index, diffing two states, and emitting a heterogeneous batch. Why this one is not data: every other ability is a composition of named mechanisms. This one produces something no other rule element can describe — it would be inventing vocabulary for a shape nothing else has (`module/engine/scripts.mjs:54-64`, `module/engine/scripts.mjs:32-44`).

## Invariants & edge cases

1. **A new element key needs an `EXECUTORS` entry.** A missing entry surfaces the problem in `unhandled` rather than silently doing nothing (`module/rules/elements.mjs:152-156`).

2. **Unknown keys default to `additive`, not the ends.** A new element must not sort to the front or the back of execution order simply by not being listed (`module/rules/ordering.mjs:83-96`, test: `module/unit/ordering.test.mjs:32-35`).

3. **Aura collection precedes aura consumption.** Band 30 < 35, and Clarity reads the Area CritUp aura in band 35, so it must collect Aura elements (band 30) first (`module/rules/ordering.mjs:12-15`, test: `module/unit/ordering.test.mjs:17-22`).

4. **Suppression runs last.** Band 90 is the highest, so suppression sees every contribution and can erase anything that came before (`module/rules/ordering.mjs:28`, test: `module/unit/ordering.test.mjs:24-26`).

5. **Collection runs per-unit with the unit's own options only.** A predicate naming a target cannot be answered at collection time — there is no target. Board state like `self:inHomeBase` reads as "false" until the snapshot is built (`module/rules/elements.mjs:139-148`, history: `module/rules/elements.mjs:176-180`).

6. **`PerStack` must live on something collected once.** An effect's rules are collected per instance, so authoring a `perStack` on the effect itself would be collected `n` times and scaled `n` times (`module/rules/elements.mjs:342-344`).

7. **Scripts never throw.** A malformed script entry logs a warning and returns `[]`; it does not stop the turn (`module/engine/scripts.mjs:56-62`).

## Open questions

- **Answered: the count is not fixed, but it cannot drift.** Measured live, `EXECUTORS` holds **62**
  entries and the authoring vocabulary holds **62** descriptors, and the two sets are exactly equal — no
  executor without a GM-facing descriptor, no descriptor without an executor. That correspondence is
  enforced in both directions by `test/unit/authoring-elements.test.mjs:18-35`, whose failure messages say
  what each direction means: *"the engine executes X and no GM can author it"* and *"the picker offers X
  and nothing executes it"*. So the table is expected to grow; what it may not do is diverge from the
  vocabulary. (The third assertion compares the two lengths, so it holds at any count — its title said
  "covers all 54" long after the count reached 62, and now says what it actually checks.)

- **Answered, and it exposed a vocabulary gap — [#22](https://github.com/zarex97/FGT_FVTT_v2/issues/22).**
  `stage` on a `DamageModifier` is **not** a pipeline stage number. It is a two-valued selector that picks
  the modifier key, and the pipeline stage follows from that key (`module/rules/elements.mjs:871-875`):
  `direction: "taken"` with `stage: "flat"` routes to `flatReduction` and otherwise to `defUp`; dealt
  damage routes to `flatDamage` or `atkUp` the same way. An explicit `modifierKey` overrides both. The
  distinction is load-bearing — a flat +120 and a +120% are different numbers, and
  `packs/_source/abilities/vorpal-blade.yml:50-53` comments on getting it wrong. Seven authored files set
  `stage: flat`, yet the field is absent from the `DamageModifier` descriptor, so the editor cannot offer
  it and the drift tests cannot see it: they compare element **ids**, never element **fields**.

- **Multi-client determinism via source id has never been tested in a live world with changing load order.** The code is correct by reading, but a test of two clients loading documents in reverse order and computing the same contributions would confirm it (`module/rules/ordering.mjs:102-105`).
