# 08 — Document subclasses and derived data

## What it is

Foundry VTT layers a **data preparation cycle** across every document: first `prepareBaseData`, then
the model's schema derivations, then `prepareDerivedData`. F/GT's document subclasses are deliberately
thin — *"Everything interesting lives in `rules/` and `engine/`"* — and use the cycle to fold two
kinds of changes into live values (`module/documents/index.mjs:5`):

1. **Model schema derivations**, run by Foundry itself, compute values like Max Health from ranks
2. **Stat deltas** from rule elements, applied in a three-pass ordering to keep Max Health
   clamping and rank shifts in the right order

The key is **restoration between phases**. Each preparation reads from stored values, not from
what the previous preparation left behind, so a `MOV +2` from Mad Enhancement does not
double-apply across multiple preparations (`module/documents/index.mjs:73-79`).

## Where it lives

| File | Role |
|---|---|
| `module/documents/index.mjs` | Actor, Item, Effect, Combatant, Token subclasses and the `prepareBaseData` / `prepareDerivedData` flow |
| `module/documents/combat.mjs` | `FGTCombat` — faction-based turn order, not token-based (Ch. 25) |
| `module/rules/derived.mjs` | `applyStatDeltas`, `writeDerived`, `restoreModifiable` — the stat delta pipeline |
| `module/rules/snapshot.mjs` | `contributionsOf` — collecting rule-element contributions for derivation |
| `module/rules/elements.mjs` | Rule-element execution, builds the `Contributions` object |
| `module/rules/granted.mjs` | Granted capabilities — the `grantedAbilities` bucket |
| `module/data/actor/*.mjs` | Schema `prepareBaseData` implementations for Servant, Master, Summon, Platform |
| `module/fgt.mjs` | Document class registration (`CONFIG.Actor.documentClass`, etc.) |

## How it works

### Document subclasses

Six Foundry classes are subclassed; each is registered once at init (`module/fgt.mjs:107-112`):

- **FGTActor.** Routes to `rules/snapshot.mjs#snapshotUnit` for plain-data projections consumed by the
  engine. Collects rule elements from owned items (`module/documents/index.mjs:60-70`).
- **FGTItem, FGTCombatant, FGTToken.** Empty. They exist for type identity and possible future use.
- **FGTEffect.** Supplies `isExpired(tick)` to check absolute expiry against the combat's global turn
  (`module/documents/index.mjs:111-114`).
- **FGTCombat.** *"Turns belong to players, not tokens."* Tracks faction turn order, re-rolled every
  Round, rather than initiative-driven token order (`module/documents/combat.mjs:2-12`). Supplies
  `rollTurnOrder` (`module/documents/combat.mjs:132-171`), `delayFaction` (`module/documents/combat.mjs:188-202`),
  `markTurnTaken` (`module/documents/combat.mjs:213-225`), and accessors for the acting faction
  (`module/documents/combat.mjs:246-248`).

### The preparation cycle

Foundry calls two hooks in sequence. **Before `prepareBaseData`**, restore stored values into live fields,
so schema derivations read true values rather than accumulated changes (`module/documents/index.mjs:73-79`):

```javascript
restoreModifiable(this.system, this._source?.system);
super.prepareBaseData();
```

Every field in `MODIFIABLE_PATHS` — MOV, Range, Parameters, Health, Agility, Luck — is put back from
`_source`. This is necessary because *"Foundry prepares data **in place**, and `prepareDerivedData` reads
the field it is about to write"* (`module/rules/derived.mjs:219-223`). Without restoration, a `MOV +2`
landing in one preparation would still be there when the next runs, and the delta would apply twice.

**After schema derivations**, `prepareDerivedData` folds stat deltas and exposes rule elements
(`module/documents/index.mjs:84-100`):

```javascript
const contributions = contributionsOf(this);
const derived = applyStatDeltas(this.system, contributions.statDeltas);
writeDerived(this.system, derived);
this.system.derivedTrace = derived.trace;
```

### Collecting contributions

`contributionsOf(actor)` walks every owned item (filtering equipped equipment), executes its rule
elements, and returns a `Contributions` object — a plain container holding `statDeltas`,
`grantedAbilities`, `modifiers`, and 20+ other buckets (`module/rules/snapshot.mjs:1355-1380`).

A rule element is a dispatch key and data — *"when Equipped, increase the Unit's Base Attack (STR) by
50…"* is `{key: "FlatDamage", table: "divinity"}`. The executor (`module/rules/elements.mjs`) turns
it into numbers and destinations: a `statDeltas` entry with `{stat: "parameters.str", value: 50, source:
...}`. All 60+ element kinds are routed this way (`module/rules/elements.mjs:1-80`).

A stat delta **names the stat and one kind of change** — numeric add/subtract, absolute value, rank
shift, multiplicative factor, or floor. The stat names are authored (`"MOV"`, `"Luck"`, `"Divinity"`)
and normalized to schema paths (`"mov"`, `"luck.value"`, `"parameters.div"`)
(`module/rules/derived.mjs:253-256`).

### Applying deltas

Deltas are applied in **three passes**, and the order is load-bearing:

**Pass 1: Rank shifts** on Parameters. A rank shift reads the current value, moves it up/down a step,
and writes back the new Rank. A named destination (`rankTo: "B"`) applies only upward, so a rank shift
does not undo a debuff landed earlier in the same batch (`module/rules/derived.mjs:53-76`).

**Pass 2: Numeric deltas and factors.** Additive changes (`MOV +2`, `Health -1`) land first
(`module/rules/derived.mjs:78-119`). Then multiplicative factors like Slow's *"MOV halved (round down)"*
apply to the **already-modified** value, not the original (`module/rules/derived.mjs:132-137`). Floors
(`"cannot reduce MOV below 1"`) apply last in this pass (`module/rules/derived.mjs:139-145`).

**Pass 3: Clamps.** A `value < 0` is clamped to `0` for any stat in `NON_NEGATIVE` — MOV, Range,
Agility, Luck (`module/rules/derived.mjs:147-152`). Health has a ceiling: current Health is clamped to
Max Health (even when no delta named `health.value`), because lowering Max Health drags current Health
down with it (`module/rules/derived.mjs:153-164`).

The result is a `{changes, trace}` object. `trace` records every change and its source for the sheet's
tooltip; `changes` is a flat path → value map that `writeDerived` applies to the live `system`
(`module/rules/derived.mjs:39-47`, `module/rules/derived.mjs:179-182`).

### Granted capabilities

After stat deltas, `contributions.grantedAbilities` holds ids like `"doubleMove"`, `"noReactions"`,
`"ignoresOccupancy"`. These are the **names of capabilities**, not data. The engine reads them at
decision points — *"can this unit move twice?"* is `hasGranted(unit, "doubleMove")`
(`module/rules/granted.mjs:93-95`). The grant is the input; the capability lives in the code that
asks about it (`module/rules/granted.mjs:1-18`).

## Invariants & edge cases

1. **Stored values are restored before `prepareBaseData` runs.** The restoration puts back every field
   listed in `MODIFIABLE_PATHS` from `_source.system`, so schema derivations see true base values
   (`module/rules/derived.mjs:196-244`).

2. **Stat deltas are applied in three passes for a reason.** Rank shifts resolve before numeric
   deltas; numeric deltas resolve before multiplicative factors; factors resolve before clamps. This
   order keeps Max Health clamping from interfering with a `Max HpUp` in the same batch
   (`module/rules/derived.mjs:13-21`).

3. **A `detect` stat delta is never written.** Detect is read-time only, derived from a class table
   that depends on position. Writing it would stick a value in place and ignore the base on every
   future preparation (`module/rules/derived.mjs:82-94`).

4. **An absolute delta names the resulting number, not a change.** `{stat: "range.panels", value: 1, absolute: true}`
   means "Range is 1", not "Range +1". Every previous delta is a change; an absolute overrides the
   computed value (`module/rules/derived.mjs:98-109`).

5. **Health has a null maximum means undamageable.** `null` is not zero; it is a Pale Rider state.
   Adjusting health refuses the write rather than creating a pool (`module/engine/io.mjs:210`).

6. **`grantedAbilities` is read-time only.** It lives on the snapshot, and the engine reads it as a
   boolean question (`hasGranted`). New ids are not auto-discovered; they must be coded into the
   engine where they are asked about (`module/rules/granted.mjs:29-84`).

7. **The trace is kept for sheet tooltips.** Every change in `derived.trace` records the path, new
   value, and source (ability name or "Max Health cap"). The sheet reads this to display *"MOV: 6
   (base 4 + Mad Enhancement +2)"* (`module/documents/index.mjs:99`).

## Open questions

- **How many times do `prepareBaseData` and `prepareDerivedData` run?** The Foundry lifecycle calls
  them at creation, update, and sometimes during other workflows. The restoration is designed to be
  idempotent, but the number of invocations per game action is not documented here. Worth measuring
  against a running world.

- **Answered by the mechanism.** A delta with a `duration` always counts now; duration governs when
  the *source* disappears, not whether the delta applies — the file says so at
  `module/rules/derived.mjs:22-24`. The disappearance is the scheduler's: an effect stores an
  **absolute** expiry tick (verified live — see Chapter 04), the boundary sweep removes the instance,
  and the next preparation simply does not see the element. So there is no "expired but still
  applied" state to test for: expiry deletes the source, and derivation reads only what is present.

- **Confirmed live, and rank deltas are order-sensitive.** `applyStatDeltas` was exercised directly
  against a live board. A `rankTo: "A"` on a C gives **A**; a `rankTo: "E"` on a C gives **C**, so the
  upward-only guard holds. But a grant and a debuff in one batch do *not* commute:

  | deltas, in order | result |
  |---|---|
  | `rankTo: A`, then `rankShift: -2` | `A--` |
  | `rankShift: -2`, then `rankTo: A` | `A` |

  The cause is `read`, which consults the accumulated `changes` before the document
  (`module/rules/derived.mjs:51`), so each delta composes on the previous one rather than on the
  original value. That is deliberate — it is what lets a debuff bite on a granted rank — and it means
  **element ordering is load-bearing for rank arithmetic**, not merely tidy. The order is fixed by the
  priority bands in `module/rules/ordering.mjs` (Chapter 10), so it is deterministic; it is not
  arbitrary, but it is also not commutative, and authored content cannot assume otherwise.

- **How do data models' own `prepareBaseData` implementations interact?** Servant, Master, Summon,
  and Platform each have one (`module/data/actor/servant.mjs:204`, etc.), and they run before
  `FGTActor#prepareDerivedData`. Their behaviour with stat deltas is not fully mapped.
