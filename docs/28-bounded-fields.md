# 28 — Bounded fields: the six-axis model

## What it is

A bounded field is a Noble Phantasm that encloses part of the board with its own membership rules, interior modifiers, escape mechanics, upkeep costs, and destruction conditions. Ten fields across nine Servants exist in the corpus — more than a third of the expanded roster — and all of them operate in one unified space: six independent axes that compose every field's ruleset.

A field is defined by its value on each of these axes: **geometry** (the panels it covers), **membership** (who can enter, exit, or escape), **isolation** (what interactions cross the boundary), **interior rules** (modifiers that apply inside), **duration and extension** (upkeep costs and paid renewal), and **vulnerability** (what breaks it). Everything each field does reduces to a choice along one of these six dimensions. Nothing is named after a Servant because the ruleset is shared; each field is an instance parameterized by its ability data.

The system existed incomplete: six layers of authored data with no write path. `panelsOf`, `membershipVerdict`, `escapeAttempt`, `isolationBlocks`, and `interiorModifiers` were all written, tested, and wired to each other — and the one thing that creates a field had never existed, so no boundary had ever trapped anybody (`module/engine/fields.mjs:6-9`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/bounded-fields.mjs` | The six axes as pure predicates. Answers "does this unit stand in the field?", "may they leave?", "what interior rules apply?", "has the field been destroyed?" |
| `module/engine/fields.mjs` | Creating, closing, and maintaining fields. The upkeep sweep. Paid extension. Contact events and field events. |
| `module/engine/escape.mjs` | Rolling the escape ladder: attempting one rung and landing the outcome. `canAttemptEscape` screens for legality before rolling. |
| `module/rules/fields/pool.mjs` | Blood Fort Andromeda's one-way drain: splitting a drained pool between beneficiaries, capped at the pool. |
| `module/rules/bloodmarks.mjs` | Blood Fort Andromeda's four Bloodmarks, and the square they define when complete. |
| `module/engine/hgob.mjs` | Activating Semiramis's Hanging Gardens of Babylon. One-shot writes: owner buff, `zonExempt`, Sustainability bonus. |

## How it works

### Axis 1: Geometry

The panels a field covers are computed from a specification (`module/rules/bounded-fields.mjs:43-85`). Four kinds exist:

- **Fixed area.** A square or rectangle anchored at a panel, with optional clipping to the board edge and to enemy home bases.
- **Follows unit.** Anchored to a unit's position (or a unit's Master, for Doomsday Come) and recomputed on each board read. May have conditional overrides: Contagion under Doomsday rewrites its own area.
- **Freeform.** Painted by the player on the canvas. Stored as a panel list because the shape is not derived from a spec.
- **Mark-defined.** Computed from four objects the player placed over four Turns. Blood Fort Andromeda's square is built this way.

A unit-following field is attached to its anchor's token in Foundry v14, so the drawn area and the rules' `panelsOf` agree without a hook or a write (`module/engine/fields.mjs:299-312`).

### Axis 2: Membership

A field partitions units into relations: **self** (owner), **ally**, or **enemy** (`module/rules/bounded-fields.mjs:246-260`). Each relation has entry and exit policies: free, trapped (no exit), or requiring a successful escape roll.

**The escape ladder** (`module/rules/bounded-fields.mjs:342-408`) has four rungs, tested in order:

1. **Border contact.** Unless `requiresBorderContact` is false, the unit must stand on the field's inner edge.
2. **Remaining movement.** Unless `requiresRemainingMove` is false, the unit must have Movement left after that turn.
3. **The roll.** The unit rolls against `spec.formula` (default 1d20) at a chance computed from `spec.baseChance` plus `spec.chanceIncreasePerFailure` per prior failure.
4. **Veteran clause.** A unit that has escaped once always escapes. It can lead adjacent allies out with it, bypassing the roll entirely.

Escape is attempted by rolling (`module/engine/escape.mjs:45-88`). The ladder stays pure and testable in `rules/bounded-fields.mjs`; the engine caller rolls the die and writes the verdict. On failure, the unit is relocated to a random free panel inside the field (`module/rules/bounded-fields.mjs:189-204`). On success, the unit is marked with transient `mayExit` (the immediate pass to the boundary) and permanent `escaped` (the veteran mark for re-entry).

### Axis 3: Isolation

A boundary may block **attacks and effects** crossing it (`module/rules/bounded-fields.mjs:434-462`), block **Attacks only** (`module/rules/bounded-fields.mjs:502-534`), or block **Command Spells** (`module/rules/bounded-fields.mjs:509-512`). The first two are bidirectional: `outsideCanTargetInside`, `insideCanTargetOutside`, `outsideCanApplyEffectsInside`, and `insideCanApplyEffectsOutside` each govern one direction.

Doomsday Come's isolation is pierced by Anti-World Noble Phantasms: `meetsTagThreshold` on the attacker's NP tags lets a high-enough-scale ability through (`module/rules/bounded-fields.mjs:523-524`).

### Axis 4: Interior Rules

A unit standing inside the field applies a set of modifier rules keyed on its relation to the owner, its unit kind, and optional predicates about itself (`module/rules/bounded-fields.mjs:548-586`). Jack's Mist is the reference: *"A Servant ignores effects 3, 4 and 5 if they have the Instinct Skill of Rank B or higher"* — so the `exemptIf` clause references abilities by a **category asserted on the character sheet** rather than by name (`module/rules/bounded-fields.mjs:618-638`).

**Interior events** are triggered on contact or at turn end, distinct from modifiers (`module/engine/fields.mjs:838-1100`). They scale by the unit's relation and highest parameter; their predicates split into unit-side (answered here with the unit's roll options) and attack-side (carried through for the targeting pipeline).

### Axis 5: Duration and Extension

A field has an expiry tick, absolute like every other expiry in the system (`module/engine/fields.mjs:235-238`). At the expiry, the field closes unless paid extension buys more time (`module/engine/fields.mjs:680-691`).

**Upkeep** is a recurring toll charged at turn or round boundaries (`module/engine/fields.mjs:1155-1231`). Two sweeps run: one at every turn end for period-based tolls (default, ticked every 1◈), and one at every round end for round-period tolls (the Golden Hind's *"at the end of every full Round"*). `upkeepDue` (`module/rules/platforms.mjs:334`) screens each toll so none is charged twice (`module/engine/fields.mjs:1157-1159`). The payer is named in the spec (`ownerMaster` or `owner`); if they cannot afford the toll and `endWhenUnaffordable` is true, the field closes immediately instead of charging (`module/engine/fields.mjs:1213-1223`).

**Paid extension** is offered only when a clock-expiry closes the field, not when it ends by defeat (`module/engine/fields.mjs:683-684`). The owner is asked to burn Health or another resource to extend for a named duration (`module/rules/bounded-fields.mjs:777-810`). Doomsday Come charges the Master with a stated floor; Chaos Labyrinthos charges Asterios himself. Both fields have side effects on extension: Chaos Labyrinthos applies Atk/Def debuffs to all enemies still inside (`module/engine/fields.mjs:765-782`).

### Axis 6: Vulnerability

A field is destroyed when a listed **vulnerability** is triggered (`module/rules/bounded-fields.mjs:823-889`):

- `ownerDefeat` — field ends immediately when its owner is defeated.
- `masterDefeat` — field ends after an optional delay when the owner's Master falls.
- `npScaleUsedOn` — an Anti-World NP used on this field (attacks crossing the boundary or originating inside).
- `npTagAtLeast` — an NP of that scale used anywhere on the board.
- `npCount` — two or more NPs of a threshold scale in the same round.
- `damageThreshold` — the field receives more than a set amount of damage in a round.
- `markDestruction` — all marks (e.g., Bloodmarks) have been destroyed.

When an `ownerMaster` vulnerability triggers with a delay, the delay is stamped once as an absolute tick and counted down by a cleanup phase, not by a decremented counter (`module/engine/fields.mjs:1311-1335`).

### Passive fields

Pale Rider's Contagion is cast neither at an ability's use nor ended by a cooldown. It exists because he does. A passive field opens when its owner joins the board and closes when they leave (`module/engine/fields.mjs:399-430`). The pass runs idempotently at `ready` and at every turn start, so a reloaded world repairs itself without a hook being required to fire first (`module/engine/fields.mjs:391-392`).

## Invariants & edge cases

1. **A field's panels are clipped to board bounds and enemy home bases.** `panelsOf` clips the output of shape expansion to the board and to the panels forbidden by opposing bases — the whole field is never refused, just the part that violates the boundary (`module/rules/bounded-fields.mjs:87-104`).

2. **Membership snapshots are taken at creation.** A field opening over units records `enteredAt` for each unit on the panels at that moment and `trappedUnitIds` for fields with `trappedAtActivation`. These are not recomputed; later entries get their own `enteredAt` stamps when they step in (`module/engine/fields.mjs:268-290`).

3. **Upkeep periods are absolute, not relative.** `lastUpkeepAt` and `lastUpkeepRound` are written onto the field Region behaviour for persistence across reloads. A period that fails to fire and is never reset would eventually cross the threshold — so round-based periods reset at round boundaries by hygiene, not by necessity (`module/engine/fields.mjs:1244-1267`).

4. **The escape history is per-field, per-unit.** `escapeHistory[unitId].failures` counts failed attempts (incremented on each failure); `escaped` is a permanent veteran mark set once and never cleared (`module/engine/escape.mjs:79-85`).

5. **Interior rules split on unit-side and attack-side predicates.** A rule about the unit is answered at the field pass; one about the attack is carried through to the pipeline. This split is per-clause, not all-or-nothing, because `self:` in the pipeline means the attacker, and re-testing it against the defender would give the wrong answer (`module/rules/bounded-fields.mjs:559-585`).

6. **Freeform fields start with a default opening shape.** When a freeform field is cast with no user-drawn panels, `panelsOf` derives them from the shape spec as the opening footprint (`module/engine/fields.mjs:261-264`).

7. **Contact happens before the Region is visible to the board.** When a field's shape closes around units at cast time, they are caught by `interiorEvents` with `event: "contact"` before `boundedFieldsOf` has seen the field and before units are annotated with their standing fields. So a contact event writes intents off a board projection that does not yet know the field exists (`module/engine/fields.mjs:338-348`).

## Traps and anti-patterns

**Author six axes but write none of them.** The rules layer contained every axis fully authored and unit-tested: `panelsOf`, `membershipVerdict`, `escapeAttempt`, `isolationBlocks`, `interiorModifiers`, and every schema already existed. The field's Region did not. No call to `createField` existed, so `board.fields` was only ever populated from Regions that nothing created, and every bounded field ever cast held none of its own ruleset. Asterios's *Chaos Labyrinthos* was authored to trap units and escaped nobody; EMIYA's *Unlimited Blade Works* would have done the same. **Complete the write path first, even if it takes adding a new file.**

**Author a feature and leave it unread.** Asterios's *Chaos Labyrinthos* specifies `regionSizeOverride` — *"if the Region is Greece, it affects an 11x11 panel area instead"* — authored in the data since the Servant was written and never read by anything. The `regionSizedShape` function did not exist, so the home-ground clause on the largest bounded field in the corpus did nothing (`module/engine/fields.mjs:48-50`). **Wire authorship to its reader before moving on** (`module/engine/fields.mjs:204`).

**Call `currentBoard()` from inside a hook that has one cached.** A boundary's dispatcher runs after `scheduler.endTurn`, which clears every Unit's turn state. If `runFieldEvents` calls `currentBoard()` again for itself, the board reports `acted: false` for the whole map and any `actedTurnEnd` interior event with `requiresActed` matches nobody. Sikera Ušum's clause b (*"when a Unit other than Semiramis or her Master Acts then ends its Turn within the NP area"*) and Jack's Mist's acted half were both dead on every live board this way; the fix is to pass the caller's `board` as an optional parameter with `currentBoard()` as the default (`module/engine/fields.mjs:828-856`).

## Open questions

- **Answered, and the premise was too strong.** `contact` is authored **five times** in the corpus,
  not on every field -- the common interior events are `damageDealt` (35 uses), `damageStepEnd` (14)
  and `turnEnd` (13). Contact is dispatched from **three** sites, not one: when a field's Region first
  closes over units already standing inside (`module/engine/fields.mjs:346`), from
  `module/engine/fields.mjs:1617`, and from the mover side when a unit walks in
  (`module/engine/movement-hooks.mjs:783`). The comment explains why both halves exist: *"'caught in'
  plainly covers the fog rolling over you, not only walking into it."*

- **Answered: incapacity is never consulted -- only affordability is.** The gate is
  `!payer || (upkeep.endWhenUnaffordable && currentHealth(unitSnapshot(payer)) <= amount)`
  (`module/engine/fields.mjs:1213`). Nothing reads stun, paralysis, or any held effect; a payer who
  cannot act still pays, and the field ends only when the toll would take them to or below zero *and*
  the field declares `endWhenUnaffordable`. That is defensible -- a toll is a drain rather than an
  action -- but it is a design decision the code makes silently rather than one the rules state, so
  it is worth an explicit ruling if a paralysed owner is ever meant to stop paying.

- **What happens to a field with no Region.** A field whose Region is deleted by hand exists on the projection (`board.fields`) but has an empty shape from `panelsOfRegion`. Its interior rules still apply to units at the cached location. Worth an ADR.
