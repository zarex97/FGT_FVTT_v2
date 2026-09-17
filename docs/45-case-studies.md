# 45 — Case Studies: How a Servant's Clauses Become Engine Features

## What it is

A Servant's text is translated into authored rules using a rising cost ladder. Most clauses map directly to existing rule elements; some need new predicates or elements; a few require new intent types; a handful demand whole engine subsystems. This chapter shows each rung: what gets authored where, how the engine executes it, and which traps lie waiting at each level.

The ladder is ordered by cost, cheapest first. Moving up means the authoring vocabulary grows. Staying low means the feature is reusable across the roster; climbing high means a single clause justified building infrastructure that affects a hundred other abilities. Every rung shown here represents a live example from the roster.

## Where it lives

| File | Role |
|---|---|
| `module/rules/authoring/elements.mjs` | Vocabulary of rule element kinds (54 descriptors) |
| `module/rules/authoring/phases.mjs` | Vocabulary of phase kinds (20 dispatch targets) |
| `module/rules/authoring/predicates.mjs` | Predicate collection and validation |
| `module/rules/elements.mjs` | Executors for every rule element — the engine |
| `module/engine/skill-use.mjs` | Phase dispatcher — `runPhases` emits intents |
| `module/engine/intents.mjs` | Intent types (33 frozen), constructors, ordering |
| `module/engine/applier.mjs` | Write choke point, validation, ordering |
| `module/engine/io.mjs` | Concrete writers: `adjustHealth`, `createEffects`, etc. |
| `module/engine/scripts.mjs` | Escape hatch registry — named scripts only |
| `packs/_source/abilities/` | Authored YAML; the source of truth |

## How it works

### Rung 1: Rule Element + Existing Predicate

**The pattern:** A clause wants to apply an effect, move someone, spend a resource. The rule element exists. The predicate you need is already emitted by some subsystem. Authoring stops at the YAML.

**Example: Anastasia's Freezing Summertime, Effect 3**

Sheet clause:
> *"Applies Crit Up for ⅓◈ Turns to all allied Units within a 2 panel area of herself, Crit Chance is increased by 20%."*

Authored as (`packs/_source/abilities/anastasia-freezing-summertime.yml:32-38`):
```yaml
- kind: applyEffects
  targeting:
    anchor: { kind: self }
    shape: { kind: chebyshevRadius, r: 2 }
    selection: { relations: [ally, self], includeSelf: true, chooser: all }
  effects:
    - { id: sCritUp, duration: "⅓◈", magnitude: 20 }
```

The phase dispatcher calls `runPhases` → `applyEffectsPhase` → `resolveTargets` filters by shape and relations (`module/engine/skill-use.mjs:446-447`). No new code. The phase emits `applyEffect` intents, one per target, which flow through the normal effect engine (`module/engine/skill-use.mjs:440`). Cost: zero engine changes.

### Rung 2: New Predicate Facet or Roll Option

**The pattern:** The clause needs a condition that no existing emitter produces. A new predicate facet is born, checked at collection time, its truth value baked into the authored rule.

**Example: Achilles's Heel**

Sheet clause:
> *"Achilles cannot Block Heel Attacks."* And: *"Whenever Achilles participates in a Combat Phase while Unmounted."*

The defence clause is simple; the availability clause is not. Heel Attacks exist only while he is Dismounted, and no `rollOptionFor` emits `"self:stance:dismounted"` — that option name is invented to describe his current state. Where does the predicate check happen?

In `packs/_source/abilities/achilles-heel.yml:43`, the weak point block declares:
```yaml
availableWhen: ["self:stance:dismounted"]
```

This is a new predicate facet the weak point engine reads at decision time (`module/rules/weak-point.mjs:174`). The predicate is checked by the `isAvailable` function against the defender's stance when the weak point chance is computed. Cost: a new facet on an existing rule element, checked by existing infrastructure.

### Rung 3: New Rule Element Kind

**The pattern:** The clause has consequences that no existing element can express. A new element kind is authored and the engine gains an executor for it.

**Example: The Duel Field — Blocking Luck Checks and Suppressing Foreign Buffs**

Sheet clause:
> *"Luck Check cannot be used by the involved Units; all buffs and debuffs that were caused by Units not involved in the duel are negated."*

Two new rule element kinds were authored for the bounded field's interior (`packs/_source/abilities/achilles-diatrekhon-aster-lonkhe.yml:113-119`):
```yaml
interior:
  - key: BlockLuckChecks
    relations: [ally, enemy, self]
  - key: SuppressForeignEffects
    relations: [ally, enemy, self]
```

Each has an executor that contributed to the effect engine. `BlockLuckChecks` adds a suppression with scope `luckCheck` (`module/rules/elements.mjs:1495-1496`). `SuppressForeignEffects` adds a suppression with scope `foreignEffects` (`module/rules/elements.mjs:1507`), and `luckChecksBlocked` checks the suppression at decision time (`module/rules/bounded-fields.mjs:687`). The field is created once; the executors run on every luck check and every effect collection inside the boundary. Cost: two new element kinds, two executors integrated into the effect subsystem.

### Rung 4: New Intent Type + Applier Case

**The pattern:** The clause describes a state change that does not fit existing intents. A new intent type is born, added to the frozen vocabulary, ordered, and an applier case is written to apply it.

**Example: Drake's Galleon Tokens — Per-Resource Damage Scaling**

Sheet clause:
> *"Total damage dealt is further increased by 10% for every Galleon Token on herself."*

This is not a damage modifier contribution — it scales based on a **resource snapshot at the moment of the attack**, and the snapshot is resolved during the attack pipeline, not during ability authoring. The damage block carries the clause (`packs/_source/abilities/drake-golden-wild-hunt.yml:80-88`):
```yaml
totalModifiers:
  - value: 10
    perResource: { resource: galleonTokens, each: 1 }
    source: "Galleon Tokens"
```

`totalModifiersFor` reads `totalModifiers` and resolves any `perResource` clause to a flat percentage (`module/engine/attack.mjs:2908-2931`). The resolver reads the unit's resource value and multiplies the modifier by the factor. Cost: a new damage resolver facet, integrated into the pipeline.

### Rung 5: Engine Subsystem

**The pattern:** The clause describes a system so rich it needs its own lifecycle — memory, creation, updates, removal — and affects so much code that adding it to a local element is wrong. A new subsystem layer is built.

**Example: EMIYA's Unlimited Blade Works — Bounded Fields**

Sheet clause spans six axes:
> *"Affects a 7x7 panel area around EMIYA. All Units within that 7x7 panel area are trapped and unable to leave; Units outside are unable to enter. Within Unlimited Blade Works, EMIYA's Base Attack (STR) is increased by 50. At the start of every Turn, all enemy Servants within perform an Evade roll. If failed, that Unit receives (25 x 1d4) STR damage. Enemy Units outside are unable to Attack Units inside and vice versa."*

The field block in the YAML (`packs/_source/abilities/emiya-unlimited-blade-works.yml:68-114`) declares six independent axes:
1. **Geometry** — shape and anchoring
2. **Membership** — entry/exit rules (sealed both ways, no escape ladder)
3. **Isolation** — cross-boundary targeting rules
4. **Interior** — rules that apply inside the field
5. **Interior Events** — periodic clauses at turn boundaries
6. **Vulnerabilities** — ways the field can end

Each axis is handled by separate systems:
- `module/data/regions.mjs:82-117` types the field schema
- `module/engine/bounded-fields.mjs` implements the six-axis logic
- `module/rules/bounded-fields.mjs` executes interior rules and checks membership
- `module/engine/movement-hooks.mjs:297-339` enforces membership at every move

The `createField` phase writes a field to a Foundry Region, tagged with the ability's ID (`module/engine/skill-use.mjs:123`). Movement, targeting, and effect collection all consult the field subsystem on every decision. Cost: an entire system layer with schema, rule readers, validators, and movement hooks.

### Rung 6: Script — The Escape Hatch

**The pattern:** The clause is an algorithm no composition of elements can express. It is coded as a named script in a closed registry, never `eval`. The registry is finite; adding an entry is a design conversation.

**Example: Nursery Rhyme's Rewind — Restoring an Arbitrary Snapshot**

Sheet clause (simplified):
> *"Restoring an arbitrary historical snapshot across a unit set."*

This is the mechanic of her Noble Phantasm: she walks her unit set at the end of a Round, resolves a death roll for each, and for the ones that fail she rewinds them to a stored historical state. The rewind is not a composition of stat deltas and effect removals — it is a diff between two snapshots emitted as a heterogeneous batch.

The ability authored this in `packs/_source/abilities/nursery-a-tale-for-somebodys-sake.yml` with a `Script` element:
```yaml
- key: Script
  script: "nurseryRhyme.rewind"
```

The engine looks the name up in `SCRIPTS` (`module/engine/scripts.mjs:32-45`). The entry points to `rewindScript`, which takes the context (the unit snapshot, the historical moment to restore) and emits a batch of intents — deltas for every stat, removal intents for every acquired effect, resurrection if needed. The script is the only one of four budgeted in Chapter 44 Ch. 45 that is built; adding a fifth entry requires a design decision. Cost: one new script in a curated list, no general-purpose composition possible.

## Invariants & edge cases

1. **Predicates are frozen at collection time.** A predicate read off a rule element during `collectContributions` is evaluated once; it does not re-evaluate during the attack or phase. A unit that gains `self:effect:invuln` after abilities are collected sees it in future decisions, not in the current turn's already-collected contributions.

2. **Rule elements live in three buckets: `rules`, `passiveRules`, `activeRules`.** All 54 kinds may appear in any bucket. The difference is when they apply, not which are legal — all go through the same `collectContributions` dispatch with no bucket filtering (`module/rules/elements.mjs:95-115`). A picker that filters by bucket invents a restriction the engine does not enforce.

3. **A new intent type needs four edits.** Type in `INTENT_TYPES`, constructor, `ORDER` rank, and applier case — all four, or `applyIntents` rejects the whole batch at validation time (`module/engine/intents.mjs:33-34`). Shipping three of four is silent, found only by a test that actually applies the batch.

4. **Phase targeting overrides ability targeting.** A phase may carry its own `targeting` block; when present, it replaces the ability's (`packs/_source/abilities/anastasia-freezing-summertime.yml:32-36`). This is how Anastasia's Freezing Summertime Effect 3 reaches a different set than Effects 1 and 2 on the same use.

5. **Interior rules on a bounded field are executed on **collection**, not creation.** A unit standing inside a field that adds `MovDelta` sees the movement penalty baked into its computed MOV the instant the field opens, before any phase runs. Interior rules go through the same executor dispatch as normal rules (`module/rules/bounded-fields.mjs:751-760`).

## Traps and anti-patterns

**Authoring `totalModifiers` on the ability instead of the damage block.** Drake's Golden Wild Hunt nearly did this. The damage clause belongs to the damage block because the clause is specific to one attack. Authoring a `DamageModifier` rule element on the ability instead means the penalty applies to her **every** Normal Attack and every other damage-dealing ability she has — a resource scaling meant for one Noble Phantasm becomes one that affects 200+ attacks. **Rule elements on `rules` apply to every invocation of every ability; rule elements on `damage` apply only to that attack.** The lesson: scope matters. Found live.

**Forgetting the `createField` phase.** A field block in the YAML is a data structure until something calls the `createField` phase. Without it, the ability compiles, cooldown is spent, phases run, and nothing happens. This is the only place the six-axis field definition becomes real. Found live: an authored field spent 3 turns of cooldown before a test caught the missing phase.

**Checking a predicate that the emitter never produces.** Writing `predicate: ["self:attack:nonDamaging"]` on a rule element works if some **attack subsystem** path emits that option — but if no attack-triggering code path emits it, the predicate is unreachable. The test `test/unit/options.test.mjs` holds every authored predicate against `isEmittableOption` and catches the mismatch. **The authority is the executor: read `rollOptionsFor` to see what it actually emits.** Confirmed fix: options are now emitted by one central reader.

**Fixing the function instead of the rule.** #32 found that a stale-by-reading record needs a stale-aware writer, wrote `turnWrite` to be exactly that, applied it to `markTurn`, measured it live, and closed. Two writers in the same file — `recordUse` fifteen lines below, `markRoundState` twenty-five — went on doing the thing the issue was about, one of them on every ability use in the game. Nothing failed, because the rule was a convention each writer applied by hand and the fix taught one hand. **A rule that every call site must remember is not fixed by fixing a call site.** The tell is available at the time: if the fix is "use this helper", ask how many places *could* use it and check every one, because the ones that don't are invisible by construction — they look like ordinary code. This is the same shape as the unreached-facility defects in #19, #24, #27 and #32 itself, seen from the other end: there a facility had no caller, here a rule had no enforcement.

## Open questions

- **Four bounded fields or more?** The system supports six independent axes and allows arbitrary compositions (sealed + isolating, permeable + isolated). Today, seven abilities use bounded fields: EMIYA's Unlimited Blade Works, Asterios's Chaos Labyrinth, Achilles's Duel Field, Ozymandias's Ramesseum Tentyris, Jack the Ripper's The Mist, Quetzalcoatl's Piedra del Sol, and Drake's Golden Wild Hunt. Every one is a Noble Phantasm. Is bounded field reserved for NPs, or will other ability kinds use it? If so, do all compositions have meaningful use cases?

- **Answered: it warns, and the warning is console-only.** `runScript` looks the name up with
  `hasOwnProperty`, and on a miss logs `FGT | No script named "<name>"; it did nothing.` before
  returning `[]` (`module/engine/scripts.mjs:54-62`). The comment states the trade deliberately:
  *"Loud but not fatal. A `script:` naming nothing is content that will do less than its text says,
  and silence is how that goes unnoticed -- but a throw here would let one bad compendium entry stop a
  turn."* So it is not silent in the strict sense, but "loud" means the developer console: a GM at the
  table would see a clause quietly do nothing. The registry holds exactly one entry,
  `nurseryRhyme.rewind`, which is the whole corpus's use of the escape hatch.

- **Answered: it can, it did, and the guard covers one case rather than the class.** The incident is
  recorded at the fix site: `add: 3` -- *"a plausible reading of a field the authoring vocabulary
  described as a number"* -- made the executor iterate a number and throw, and because
  `contributionsOf` runs inside **every board snapshot**, *"one mistyped effect took the WHOLE board
  down rather than doing nothing"* (`module/rules/elements.mjs:1153-1159`). The fix is an
  `Array.isArray` test at that site, and the principle it states is the right one: *"A bad magnitude
  should cost its own clause, not the match."* What remains open is scope -- the guard protects this
  executor, not the sixty-odd others, so a different bad shape can still throw out of collection and
  take the board with it. A blanket try/catch per element, with the failure logged against the
  offending clause, would make the principle general.
