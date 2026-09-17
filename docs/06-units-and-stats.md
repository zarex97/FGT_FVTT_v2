# 06 — Units: kinds, stats, health and resources

## What it is

The system knows six unit kinds, and each arrives on the board with a different shape. A Servant is a ranked combatant; a Master is a ranked non-combatant who spends Command Spells; a Civilian has no stats at all. Summons and Platforms are summoned things; Structures are objectives and effects. Most units share three depleting resources — Health, Agility, and Luck — and two others, Base Attack (STR and MAG components) that read from parameters. Some units carry ability-specific pools, a general resource mechanism that holds everything from *PRS Tokens* to *Construction* to uncapped counters.

## Where it lives

| File | Role |
|---|---|
| `module/domain/enums.mjs` | The six unit kinds; Servant classes; parameter names; component list |
| `module/domain/health.mjs` | Reading Health in two shapes; the null convention for undamageable units; deriving max from END |
| `module/domain/resources.mjs` | Ability-specific pools — value, max (or null for uncapped), spend checks |
| `module/domain/base-attack.mjs` | Deriving Base Attack from STR and MAG; permanent penalties; summon/platform fallback |
| `module/domain/attributes.mjs` | The implication table; closing attributes transitively; the Magus description |
| `module/data/actor/_shared.mjs` | Schema fragments: `unitCommon()` (shared by all), `combatantCommon()` (Servants and Summons) |
| `module/data/actor/servant.mjs` | Servant schema: footprint, classes, alignment, identity, contract |
| `module/data/actor/master.mjs` | Master schema: rank, Command Spells, Zon, essences |
| `module/data/actor/simple.mjs` | Civilian, Summon, Platform, Structure schemas |
| `module/engine/io.mjs` | `adjustHealth`: refuses writes to undamageable units |

## How it works

### The six unit kinds

Every actor is exactly one of these (`module/domain/enums.mjs:25-27`):

- **Servant** (`servantData`): combatant with five parameters (STR, END, AGI, MAG, LUC), two base attacks (STR and MAG components), sustain­ability. Keeps contract state and Master link. May have a variant (Semiramis's DSC/NoDSC split).
- **Master** (`masterData`): non-combatant with baseAttack only, plus rank (A–D or blank), three Command Spells, Zon (spent to summon), essences. Masters join factions and hold contracted Servants.
- **Civilian** (`civilianData`): unit with no parameters, no combat stats, no combat item categories. Moves, can hold items. Story and scenario only.
- **Summon** (`summonData`): combatant placed by a Servant, with five parameters, two base attacks, inherit fields for stats relative to the summoner (e.g., *"Agility: Pale Rider's plus 2"*), expiry, and optional bounds to a Platform or field.
- **Platform** (`platformData`): field effect with baseAttack only, footprint (3×3 default, nullable for pocket dimensions), upkeep cost, and owner link. No parameters.
- **Structure** (`structureData`): objective unit with no combat stats. Constraint rules (who can destroy it, visibility range). Bloodmarks are the reference.

### Health: two shapes, three meanings

Health arrives in two shapes in code and all three have meaning (`module/domain/health.mjs`):

- **Document shape**: `{ value, max }` — the current and maximum, stored on-disk. Every write reads it here.
- **Snapshot shape**: a bare number — the current value only; the maximum is stored separately (`healthMax` or `maxHealth` field). `snapshotUnit` flattens documents to snapshots for rules evaluation.
- **Null health**: *not zero, but intrinsically undamageable*. Pale Rider and the Kagome Spirits have `health: null` at authorship, and no damage pipeline ever runs against them (`module/engine/io.mjs:204-210`). `adjustHealth` refuses to write when `health.max === null` rather than creating a health pool.

A unit at zero health is defeated and about to revive or fall; one with `null` health cannot be hurt at all. Six rules files read `unit.health.value` directly, silently wrong against a snapshot shape — `currentHealth` is the one reader to use (`module/domain/health.mjs:36-41`).

### Deriving maximum health

A Servant's maximum health reads from the END parameter (`module/domain/health.mjs:127-135`):

> *"END: E => 500, D => 750, C => 1000, B => 1250, A => 1500, EX => 2000. For every + or - added to the Servant's END increase or decrease that Servant's corresponding Base Health by 100."*

The table beats the sheet — three reference sheets state health below their END derives — so the live figure comes from the parameter, not the authored one (`module/domain/health.mjs:98-108`). Granted steps move the rank, so a Servant at B+ who received one step reads from B++ (`module/domain/health.mjs:127-132`). Summons and Platforms state Health outright and carry no END, so they fall back to `baseHealth` (`module/domain/health.mjs:134`). Undamageable units skip backfill entirely, leaving `health: null` untouched (`module/data/actor/_shared.mjs:40-52`).

### Base Attack: STR and MAG

Every combatant has two Base Attack components — one for STR, one for MAG — derived or stated. Servants and Summons derive from parameters; Masters and Platforms state them directly (`module/data/actor/_shared.mjs:224-227`).

The derivation uses the same table the rulebook does:

> *"If you find a value of Base attack that differs from this calculation choose the value of this table instead of what is on the character sheet."*

Three reference sheets disagree downward. Granted steps move the rank the same way Health's END step does (`module/domain/base-attack.mjs:47-57`). A permanent reduction to Base Attack — from *Nameless Forest Counter* — stores in `baseAttackPenalty` and subtracts at derivation time, because contributions (effects) spring back when removed and this must not (`module/data/actor/_shared.mjs:239-257`).

### Attributes and the implication table

Attributes are an open tag set by design — the expanded roster added Fairytale, Wraith, Liangshan, Gorgon and Demonic Beast without a schema change (`module/data/actor/_shared.mjs:146-149`). The source states attributes as an implication table, not a flat list: a Human is also Humanoid and Living Human; a Servant is also Spirit *unless* it is Demi- or Pseudo-Servant (`module/domain/attributes.mjs:7-20`).

Every sheet authored the closure by hand before this code existed, which meant `spirit` appeared nowhere — so effects keying on Spirit missed every Servant. Mannanán is Pseudo-Servant and Living Human both, which is why the distinction matters (`module/domain/attributes.mjs:19`). The table is transitive and idempotent; closing attributes more than once gives the same result (`module/domain/attributes.mjs:72-106`).

The `Magus` attribute reads three fields to decide: *"Units with the 'Magus' Attribute — Masters, Casters, all Units whose Normal Attacks use Base Attack (MAG)"* (`module/domain/attributes.mjs:52-70`).

### Parameters and their steps

The five Servant parameters are STR, END, AGI, MAG, LUC (`module/domain/enums.mjs:16`). Each has a grade (E through EX) and up to two steps added or subtracted from it (`module/data/actor/_shared.mjs:220-237`). The authored grade and the granted steps are stored separately, so a sheet that prints "B" on a Servant written at C and granted one step keeps both numbers accurate (`module/data/actor/_shared.mjs:228-231`).

### Agility and Luck

Agility and Luck are depleting resources stored in the `{ value, max }` shape like Health, not parameters (`module/data/actor/_shared.mjs:54-55`). They sit at the top level of `system`, not under `system.parameters` or `system.baseAttack`. Agility starts at 0 and Luck starts at 0 on every new unit; each may climb from there via effects, or descend via damage, debuffs, and *Counter* generation (`module/domain/health.mjs:53-55`).

### Ability-specific pools

Eight units in the reference set carry pools of their own: Scáthach's *PRS Tokens* (capped at 2, +2 per *Primordial Rune*), Mannanán's *Fragarach Tokens*, Heracles's recorded attacks (uncapped), and others (`module/domain/resources.mjs:1-19`). Each is a clamped integer with a value and optional maximum. The maximum may be null, which means uncapped; Heracles's counter has no ceiling, Semiramis's Construction is capped at 100 (`module/domain/resources.mjs:31-46`).

Pools live under `system.resources.*`, keyed by name (`module/domain/resources.mjs:84-86`). Both Luck and Agility have the same `{value, max}` shape, so content can name either (`module/domain/resources.mjs:106-111`). A pool's label for UI is derived from its key by splitting camelCase and leaving acronyms (three letters or fewer, lowercase) in capitals (`module/domain/resources.mjs:129-136`).

### Turn and round state

Every combatant has a turn state and round state (`module/data/actor/_shared.mjs:308-360`). Turn state records what this Unit has done *this Turn* — moved, acted, attacked — stamped with the ◈ tick it was written in, so state from an earlier tick is stale by definition and cannot block movement that should be legal (`module/data/actor/_shared.mjs:308-321`). Round state holds a running total: how many panels moved this round, cumulative (`module/data/actor/_shared.mjs:305-307`). `inCombatPhase` records whether the Unit was involved in any combat (as defender or attacker) this turn, which is distinct from `acted` and `attacked` (`module/data/actor/_shared.mjs:325-338`).

### The snapshot unit

Rules evaluate against a **snapshot** — a plain object flattening a document into a single object, with Health flattened to a number (`module/domain/health.mjs:10-11`). The snapshot carries all the fields a rule needs to read, plus the closed attribute set and derived turn state, so a rule never has to reach into the document or re-close attributes itself. Six rules read `unit.health.value` directly, which works against a document and reads as zero against a snapshot — the `?? 0` beside each one turned that into the wrong answer (`module/domain/health.mjs:17-23`). `currentHealth(unit)` is the one reader that handles both shapes.

## Invariants & edge cases

1. **`null` Health is not zero Health.** Undamageable is not dead. `adjustHealth` refuses writes when `max === null` rather than creating a pool that does not exist. `isUndamageable` is the check that distinguishes them (`module/engine/io.mjs:208-210`, `module/domain/health.mjs:70-72`).

2. **Health has two shapes.** Documents carry `{ value, max }`; snapshots carry a bare number plus `healthMax` or `maxHealth` fields. A reader that assumes one shape gets `undefined` against the other and the `?? 0` silently turns it into the wrong answer (`module/domain/health.mjs:1-27`).

3. **The table beats the sheet.** Servants' maximum Health and Base Attack both come from parameter tables, not authored figures, because three reference sheets disagree with their own END and STR/MAG and the table is what the game is played with. The authored figure survives only where there is no parameter to derive from (`module/domain/health.mjs:98-108`, `module/domain/base-attack.mjs:20-29`).

4. **Base Attack penalties are permanent.** *Nameless Forest Counter* reduces Base Attack by 10 per token, but the reduction does not spring back when the effect is removed — only written removal or field healing can raise it again. It stores in `baseAttackPenalty` and subtracts at derivation time, not as a contribution (`module/data/actor/_shared.mjs:239-257`).

5. **Parameters store both authored and granted ranks.** A Servant written at "C" and granted one step prints "B" on sheet, but the schema stores both the original rank and the +1 separately. Deriving Base Attack or Health moves the rank by the granted steps, not by writing the rank field itself (`module/data/actor/_shared.mjs:228-237`).

6. **Summons inherit stats from their summoner.** A Kagome Spirit's *"Agility: Pale Rider's plus 2"* and *"Luck: Same as Pale Rider's"* are authored on the summon's `inherit` field as expressions, resolved at placement from the summoner's live values (`module/data/actor/simple.mjs:31-36`).

7. **Attributes are closed transitively.** Demi-Servant ⟹ Human ⟹ Humanoid and Living Human is three steps deep. Every sheet authored the closure manually; the code now closes them once and re-closes on every preparation, idempotently (`module/domain/attributes.mjs:85-106`).

8. **Masters carry `baseAttack` like any other combatant.** It comes from the shared `combatantCommon()` fragment and is declared on the schema (`module/data/actor/master.mjs:35`, `module/data/actor/master.mjs:41`; the field at `module/data/actor/_shared.mjs:224-227`).

## Traps and anti-patterns

**Reading a unit's Health, Agility or Luck without knowing which projection you hold.** Documents
carry `{value, max}`; the board projection carries a bare number. A reader that assumes one shape
gets `undefined` from the other, and the `?? 0` beside it converts that into a confident zero.
This has produced real, silent mis-scoring — a weak-point clause compared two `undefined`s as
equal and awarded its bonus on every attack. **Read both shapes, or assert which one you have**
(`module/domain/health.mjs:1-27`).

**Assuming a stat exists because the sheet states it.** For Servants, the parameter table beats
the authored figure: three reference sheets disagree with their own END and STR/MAG, and the table
is what the game is played with. The authored number survives only where there is no parameter to
derive from (`module/domain/health.mjs:98-108`, `module/domain/base-attack.mjs:20-29`).

**Authoring an attribute's implications by hand.** Attributes form an implication table — a
Demi-Servant is a Human, therefore Humanoid, therefore a Living Human. Every sheet in the corpus
once wrote that closure out manually, which meant `spirit` appeared nowhere at all and any effect
keying on Spirit missed every Servant in the game. **Declare the leaf attribute and let the table
close it** (`module/domain/attributes.mjs:47`, `module/domain/attributes.mjs:85-106`).

## Open questions

- **Why split Health into two shapes?** `snapshotUnit` flattens Health to a number for rules evaluation, but every write reads the nested shape. Neither is wrong, but the dual representation caught in six reading sites. Worth revisiting whether rules should read through the same accessor Health does.

- **Agility as a resource.** Agility stores as a `{value, max}` pool, suggesting it can be spent and recovered separately from Health — but none of the reference corpus actually does this. Is it declared as a resource for future use, or should it move to a stat the way Luck sits at both the top level and under `resources`?

- **Confirmed live, then fixed — [#20](https://github.com/zarex97/FGT_FVTT_v2/issues/20).** A Master that predated the schema declaring `baseAttack` was stranded at `{str: 0, mag: 0}`. Counted in the `fgt2026` world: eight of nine Masters were healthy, and *Gogh's Master* held `{str: 0, mag: 0}` — a hand-made actor (`contentId: null`), so content sync could not have reconciled it against a pack document even if `Gogh's Master` had one. The repair path was the missing piece: `MIGRATIONS` was empty, so nothing had ever run one. `module/migration/migrations.mjs`'s first entry now backfills `str` to the pack default (50, which nothing ever rolls) and `mag` to its pre-roll default (100) for any Master found holding exactly `{str: 0, mag: 0}` — the true historical roll is gone, so this is the best recoverable value, not a guarantee of the original.
