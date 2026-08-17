# 14 — Checks and Randomness

> **Implemented (Ch. 45, pure rules).** The roll log (§14.8) is `module/rules/roll-log.mjs`:
> `record`, `append`, `reroll`, `chainOf`, `visibleTo` and `renderBreakdown`, plus `fromCheck`
> which turns a check outcome into a record. Records accumulate on the **Combat Process state**
> (`combat-process.mjs` files any `detail.rollRecord` in `advance`), so they survive the socket
> round trip and reach the chat card, which renders them per viewer.
>
> Two decisions worth keeping: a **zero-delta** modifier prints without a sign, because entries
> like "Mad Enhancement B: Evade- forced" changed which table was used rather than the number;
> and a re-roll **keeps the original** and links to it via `rerolledFrom`, so a GM re-roll cannot
> pass unnoticed. A duplicate id is dropped rather than appended — an interrupt that replays part
> of a resolution would otherwise double every roll it re-ran.
>
> Setup rolls (§14.9) are `module/rules/setup-rolls.mjs`, rolled by `module/engine/summon.mjs` and
> shown by the summon dialog (`module/apps/summon-dialog.mjs`). The asymmetry the code encodes: a
> **Servant's Max Health takes no roll** ("Health(S) is not used"), while a Master rolls `2d100`
> with a **coin-flipped sign** over a flat base of 250. **§37.6's worked example disagrees** — it
> rolls the Servant's Health — and the code follows this section, because "NO ROLL" here is an
> instruction and that is an illustration. If the illustration is right, this line is the one to
> change.
>
> The three **Master rank modes** this section ends on are live. `masterMode` had been a registered
> setting that nothing read since the day settings were written, so every Master was ranked by
> essence whatever the world was configured for: `coinFlip` now puts the flip on the Base Attack
> line itself (the coin picks the value, because the rank exists there only to select it), and
> `rankless` gives every Master 100. A Master's lines are rolled from a button on its own sheet —
> five lines and no choices do not warrant an application.
>
> A resolved line reports both `rolled` (what the die showed) and `applied` (what it contributed,
> sign included). A display that used the first for both renders a tails 2d100 of 87 as
> "250 + 87 = 163".

Every random element in F/GT, in one place: the check types, the named roll registry, the
modifier rules, and how randomness is generated, logged, and made auditable across clients.

---

## 14.1 The three kinds of randomness

| Kind | Mechanism | Examples |
|---|---|---|
| **Check** | Roll a die, compare against a stat, succeed if **under** | Agility Check, Luck Check |
| **Named roll** | Roll a formula from the dice registry, use the value | Evade, Block, Injury, Damage Modifier, Health(S) |
| **Chance** | Roll a percentage or flip a coin | Crit, debuff application, Overpower, Discover, Struggle |

They are genuinely different: a Check compares against a depleting resource and *costs* that
resource; a Named roll produces a magnitude; a Chance produces a boolean.

---

## 14.2 Checks

```ts
interface CheckSpec {
  kind: "agility" | "luck";
  subtype: string;                 // "evade", "luckyHit", "coverShove", "boarding"…
  actor: UnitSnapshot;
  opponent: UnitSnapshot | null;   // determines which table is used
  modifiers: CheckModifier[];
  costsResource: boolean;          // Luck Checks always; Agility Checks never
}

interface CheckResult {
  success: boolean;
  rolled: number;
  target: number;                  // the stat value compared against
  table: string;                   // "evade" | "evade-" | "luckCheck" | "luckCheck-"
  modifiers: Array<{ source: string; delta: number }>;
}
```

### The comparison rule

**Success when the rolled value is strictly *lower* than the stat.** Both check types.

> Evade: *"If the value rolled is lower than the DU's Agility, initiative goes to AU."*
> Luck Check: *"If the value rolled is lower than the AU's Luck, the Luck Check is Successful."*

Equal is a **failure** in both cases. This is stated explicitly for Luck Checks
(*"If the value rolled is equal to or higher, the Luck Check has Failed"*) and for Evade
(*"If the value rolled is equal or higher, proceed to Step 2.4"*).

### Table selection

Both checks have a favourable and an unfavourable table, chosen by comparing **current values**
(not ranks):

```ts
const table = actor.stat.value >= opponent.stat.value ? base : `${base}-`;
```

| Check | Favourable | Unfavourable |
|---|---|---|
| Agility (Evade) | `Evade` | `Evade-` |
| Luck | `Luck Check` | `Luck Check-` |

Forced-table effects:

| Effect | Forces |
|---|---|
| `Agility Boost` | Always the favourable Agility table |
| `Agility Loss` | Always the unfavourable Agility table |
| `Luck Boost` | Always the favourable Luck table |
| `Luck Loss` | Always the unfavourable Luck table |
| Mad Enhancement clause 6 | Always `Evade-` |

`Agility Boost` and Mad Enhancement can conflict on the same unit. **DECISION.** Explicit
*loss* effects and Mad Enhancement win over *boost* effects, on the principle that the more
specific restriction applies. Ch. 41.

### Luck Check cost

> *"Every time a Unit performs a Luck Check, reduce the Unit's Luck by 1 **after** resolving the
> effects of the Luck Check."*

One point per check, regardless of outcome. For the double-check cases (Lucky Hit and Lucky
Evasion against an NP require two consecutive successes):

> *"both Luck Checks will reduce the Unit's Luck, but the reduction only occurs **after both**
> Luck Checks have resolved."*

So both rolls compare against the same pre-decrement value, then −2 applies. The check resolver
takes a `count` parameter and handles this natively rather than being called twice.

Agility Checks have no cost. Agility depletes only through Injury Rolls, `Def Dwn (C)`, and
`Shock`.

### The eight named Luck Checks

Six triggered by the DU, two by the AU.

**AU-triggered:**

| Name | When | Effect on success |
|---|---|---|
| `Increased Damage` | AU successfully attacks | +Damage Modifier roll at pipeline stage 10. **Not usable for NP or NP-categorized attacks.** |
| `Lucky Hit` | DU successfully evades | Combat proceeds to the pertinent step. Against an NP, requires 2 consecutive successes. Against AoE, one check affects one DU. |

**DU-triggered:**

| Name | When | Effect on success |
|---|---|---|
| `Strengthen Block` | DU blocks | Roll Block again and add it |
| `Lucky Evasion` | DU fails to evade | The evade is unconditionally successful. Against an NP, 2 consecutive successes required. |
| `Reduced Damage` | DU takes damage | −Damage Modifier roll at stage 13 |
| `Light Wound` | DU would perform an Injury Roll | No Injury Roll |
| `Prevention` | DU is about to be inflicted with a debuff | The debuff is avoided. **One debuff per check. Not for Instakill, Death, or Erase.** |
| `Master's Luck` | A Master is attacked by a Servant and would be Overpowered, **or** would be defeated by that attack's damage | Not instantly defeated; takes normal damage; survives with 1 Health if that damage would kill |

Plus the open clause: *"if you can think of anything else that could use Luck as a factor for a
Luck Check, go ahead if the GM/majority of players approve."* The system supports a GM-invoked
custom Luck Check with a free-text label, logged like any other.

### Once per Combat Process

> *"The same Luck Check can only be used once per Combat Process unless stated."*

Tracked as `luckChecksUsed[unitId] = Set<subtype>`, cleared at Combat Process boundaries — so a
counter-attack (a new Process within the same Phase) gets a fresh set.

---

## 14.3 Agility Checks beyond Evade

> **Note 12:** *"All Evades are Agility Checks, but not all Agility Checks are Evades."*

This distinction is load-bearing because `Dodge` fires on Evades but not on other Agility
Checks. The non-Evade Agility Checks in the reference set:

| Subtype | Where |
|---|---|
| `coverShove` | A Servant shoving its Master out of an AoE NP area |
| `hgobKnockoff` | A unit knocked off the edge of the Hanging Gardens |
| `hgobDestruction` | Units aboard the HGoB when it is destroyed (Agility **or** Luck, roller's choice) |

`Immobilize` adds +4 to *"whenever an Immobilized Unit performs an Agility Check"* — i.e. all
of them, not just Evades. `Crystallize` adds `1d6`. These are `agilityCheck`-scoped modifiers;
`Slow`'s +2 is `evade`-scoped (*"Whenever a Slowed Unit Rolls for Evade"*). The scope is part of
each modifier's declaration.

---

## 14.4 The dice registry

The rulebook references a companion document, *Dice Roll Instructions*, which we do not have.
Every named roll below is referenced by name in the rules; the **formulas are unknown** for
several of them.

**This is the largest gap in our source material.** It is handled by making every named roll a
registry entry with a documented default, a per-world override setting, and a prominent
first-run warning if any roll is still using a placeholder.

```ts
interface DiceEntry {
  id: string;
  formula: string;              // Foundry roll expression
  description: string;
  source: "rulebook" | "inferred" | "placeholder";
  usedBy: string[];
}
```

### Known formulas (stated in the source)

| Roll | Formula | Source |
|---|---|---|
| `luckCheck` | `1d20` | *"checks is rolling a d20 and seeing if you get a value equal or lower than your stat being checked"* |
| `damageModifier` | `5d10` | *"damage dealt is reduced by 5d10 (i.e. the Damage Modifier roll)"* |
| `contractServant` | `1d6` | *"If a 6 is rolled, the Contract is Successful"* |
| `agilityRankEX` | `20+1d4` | Setup table |
| `luckRankEX` | `20+1d4` | Setup table |
| `coinFlip` | `1d2` | Ubiquitous |
| `boardHGoB` | `1d12` | Semiramis |
| `boardHGoBLevitating` | `1d8` | Semiramis |
| `boardGoldenHind` | `1d10` | Drake |
| `enterStormBorder` | `1d20`, success on ≥18 | Nemo |
| `hgobFallDamage` | `10×2d6` | Semiramis |
| `knockbackCollision` | by END rank | Keyword table |
| `territoryCreationAtk` | `Nd20`/`Nd10`/`Nd8`/`Nd6`/`Nd4` by rank | Common Skills |
| `territoryCreationDef` | `3d10+N` by rank | Common Skills |
| `battleContinuationDef` | `2d10+N` by rank | Common Skills |
| `battleContinuationRevive` | `Nd20` by rank | Common Skills |
| `godHandRevive` | `10d20` | Heracles |
| `primordialRune` | `2d8` | Scáthach |
| `hgobConstructionRound` | `1d4+2` | Semiramis |
| `hgobConstructionSummon` | `2d6`, multiplied | Semiramis |
| `itemConstructionSemiramis` | `1d4` | Semiramis |
| `dragonWingWarriorsHits` | `1d6+4` | Semiramis |
| `quickfire` | `6d6`, count ≥X | Nemo |
| `penthesileaGoddess` | `1d4`, ×10% | Penthesilea |
| `shockAction` | `1d6`, fail on 3–4 | Status effects |

### Formulas supplied by the game's author (Ch. 41 Q1)

All previously-unknown rolls have been resolved. **There are no placeholders left.**

| Roll | Formula | Note |
|---|---|---|
| `attack+` | `5d10`, **added** to damage | Pipeline stage 3 |
| `attack-` | `5d10`, **subtracted** from damage | Pipeline stage 3 |
| `evade` | `1d20` | |
| `evade-` | `1d20+4` | |
| `luckCheck` | `1d20` | |
| `luckCheck-` | `1d20+4` | Corrected in `0.2.1` — the earlier `1d20` was a typo (Q40) |
| `injury` | `1d4` | |
| `agilityM` | `4+1d8` | Master Max Agility |
| `luckM` | `8+1d12` | Master Max Luck |
| `healthM` | Master **Base Health = 250**, then ± the coin-flip roll | |
| `healthS` | **Not used** — Servant Max Health has no variance roll | |
| `block` | **Not a roll** — a flat 25% reduction | Pipeline stage 14 |

Three of these change the game's shape and deserve emphasis.

**`Block` is no longer a roll.** It is a flat 25% damage reduction, the same value against
Noble Phantasms as against anything else. See Ch. 13 §13.3 stage 14.

**`Luck Check−` is `1d20+4`**, exactly parallel to `Evade−`. The `0.2.0` documentation printed
it as `1d20`, identical to `luckCheck`, and reasoned at length about the consequences of that
identity. **It was a typo in the source, corrected by the author in `0.2.1` (Q40).** The
favourable/unfavourable distinction is real and symmetric with Evade:

| | Favourable | Unfavourable |
|---|---|---|
| Evade | `1d20` | `1d20+4` |
| Luck Check | `1d20` | `1d20+4` |

Consequences of the correction, all of which restore behaviour `0.2.0` had written off:

- **`Luck Boost` and `Luck Loss` are live effects**, not inert ones. Forcing the favourable
  table is worth a flat 4 on every Luck Check the bearer makes.
- **The current-Luck comparison in `luckCheck()` is load-bearing.** Contesting a luckier
  opponent costs 4, which on a `1d20` against a Luck of 12 is a 20-percentage-point swing.
- **High-Luck Servants are a matchup, not just a budget.** Drake (`LUC EX`), Semiramis,
  Quetzalcoatl and Ozymandias (`A+`) impose the penalty on everyone who contests them, and
  never pay it themselves.

**Servants have no Max Health roll.** `Health(S)` is not used, so a Servant's Max Health is
exactly `baseHealthByEnd[grade] ± 100 per rank step` — fully deterministic. Only Masters roll
for Health, and their base is a flat 250 regardless of anything.

### Registry behaviour

- Every roll goes through `roll(id, modifiers)`, never through an inline formula string.
- A roll whose entry is `source: "placeholder"` logs a one-time console warning per session and
  shows a badge in the GM's settings panel.
- The GM settings UI lists every entry with its formula, editable, with a "reset to default"
  and an import/export for sharing a corrected table between worlds.

---

## 14.5 Modifier application to rolls

Rolls take modifiers, and the source specifies the order precisely:

> **Note 5:** *"Whenever an effect states Evade or Luck Check rolls are doubled or halved,
> double/halve the value rolled **before** any additions and/or subtractions. Basically the
> same way as the order of damage calculation. But if it states that **Total value** of
> Evade/Luck Check roll is doubled, that means double the Total value of the roll, after all
> additions and/or subtractions."*

Same "Total" convention as the damage pipeline (Ch. 13 §13.4). So:

```ts
function resolveRoll(entry: DiceEntry, mods: RollModifier[]): number {
  let v = rollFormula(entry.formula);
  for (const m of mods.filter(m => m.stage === "preScale"))  v = m.apply(v);   // ×2, ÷2
  for (const m of mods.filter(m => m.stage === "additive"))  v += m.delta;
  for (const m of mods.filter(m => m.stage === "postScale")) v = m.apply(v);   // "Total value"
  return v;
}
```

### Evade roll modifiers, collected

| Source | Delta | Scope |
|---|---|---|
| Attack is an NP | **+3** | evade |
| Attack is AoE | **+2** | evade |
| Attacked from left or right | **+1** | evade |
| Attacked from behind | **+2** | evade |
| AU has active Presence Concealment | **+2 to +4** by rank | evade |
| `Slow` | +2 | evade |
| `Immobilize` | +4 | agilityCheck (all) |
| `Blind` | +3 (+2 with Clairvoyance) | evade |
| `Crystallize` | +1d6 | agilityCheck (all) |
| `Deafen(Y)` on the DU | +Y | evade |
| `Deafen(Y)` on the AU | −Y | evade (the DU's roll improves) |
| `TEC Up`/`Focus` on the AU | +X | evade |
| `TEC Dwn`/`Distracted` on the AU | −X | evade |
| `AGL Up` on the DU | −X | agilityCheck |
| `AGL Dwn` on the DU | +X | agilityCheck |
| Mannanán's *Toole Fragarach* | +3 | evade, that ability only |
| Mannanán's *Hallowed Sea God's Sword* | +3 | evade, that ability only |
| Penthesilea's *Goddess of War* | −1d4 | evade (a reduction — it helps her) |
| `Toad` | −3 | evade (helps the toad) |

Note the sign convention: because success is *rolling under*, a **positive** delta makes the
evade **harder**. `AGL Up` therefore has a negative delta, and its description
(*"The value of Agility Check rolls is reduced by X"*) confirms it. This inversion is a
frequent source of bugs; the modifier type carries a `direction: "harder" | "easier"` field and
the sign is derived from it, so authors never write a sign.

### Luck Check modifiers

| Source | Delta |
|---|---|
| `LUC Up` | −X |
| `LUC Dwn` | +X |
| Kiritsugu's *Affection of the Holy Grail* | +4 to everyone within 2 panels **except himself** |
| Kiritsugu under `Skill Seal` | +20 to all his own Luck Check rolls |
| Scáthach's *Gate of Skye* | −2 if the target's MAG is Rank B; −4 if Rank A |

---

## 14.6 Chance rolls

```ts
function chance(percent: number, rng: RNG): boolean {
  if (percent >= 100) return true;      // still logged, as "automatic"
  if (percent <= 0)   return false;
  return rng.d100() < percent;          // 1..100, success if strictly under
}
```

`< percent` rather than `≤` so that a 0% chance never succeeds and a 100% chance always does,
with no off-by-one at the boundaries.

### Coin flips

The game's most common randomizer. Used for: crit determination, Overpower, Underpower, the
Presence Concealment AoE resolution, setup health/agility rolls, the day/night starting phase,
Semiramis's Double Summon: Caster determination, and rankless-Master determination.

Crit chance modifiers turn the coin flip into a percentage roll — *"Since Flip a Coin is used
when determining whether Attack+ or Attack− is used, the normal chance of getting a Crit would
be 50%. Some effects increase and decrease the chance"* — so the implementation is always
`chance(critChance)` with a base of 50, and the UI shows a coin animation when the chance is
exactly 50 for flavour.

Overpower and Underpower have the same treatment: base 50%, `−10` when the relevant buff is
present.

### Application chance above 100%

Covered in Ch. 10 §10.7. The accumulated value is *not* clamped during accumulation, only at
roll time, so a 500% base minus 60% resistance is still automatic.

---

## 14.7 Randomness generation

### Requirements

1. **Auditable.** Every roll appears in the log with its formula, modifiers, and result.
2. **Reproducible in tests.** A seeded RNG so golden-file tests are deterministic.
3. **Non-repudiable in play.** A player must not be able to re-roll until they like the result.
4. **Hidden where required.** The Discover roll must not reveal that it happened.

### Implementation

**In play:** Foundry's `Roll` class, which broadcasts to all clients and cannot be silently
re-run (the roll is created inside the same operation that consumes it, and the resulting
`ChatMessage` is created immediately).

**Hidden rolls:** created on the GM client with `rollMode: "gmroll"` or, for the Discover roll,
with no message at all — only the *outcome* is broadcast, and only when it succeeds. Chapter 26
covers the socket path.

**In tests:** the L1/L2 layers never call `Roll` directly. They receive pre-rolled values in
`ctx.rolls` (Ch. 13 §13.3 stage 8). The orchestration layer performs the rolls and populates
the map. This is the same purity boundary as everything else and it makes seeded testing free.

```
Orchestration (L3)                Rules (L2)
  ├─ determine which rolls          computeDamage(ctx)   ← consumes ctx.rolls
  │  the pipeline will need           (pure, no RNG)
  ├─ roll them all up front
  ├─ build ctx.rolls
  └─ call the pipeline
```

**Determining which rolls are needed up front** requires a *dry run*: the pipeline is called
once in `probe: true` mode, which records which roll ids it would have consumed without
consuming them, then the caller rolls exactly those. Slightly awkward, but it preserves purity
and costs one extra pass over a cheap function.

**Alternative considered and rejected:** passing an RNG *interface* into the pipeline. This
keeps determinism under a seed but makes the pipeline impure in the sense that matters — you
cannot call it twice for a preview without consuming randomness, and the preview is a hard
requirement (Ch. 09 §9.9). The probe approach preserves both.

For the preview specifically, the pipeline runs with `rolls` populated from **expected values**
rather than actual rolls, and the UI shows a range computed from min/max. That is why the
preview in Ch. 09 shows `1,847 – 2,431` rather than a point estimate.

---

## 14.8 The roll log

Every roll produces a `RollRecord`:

```ts
interface RollRecord {
  id: string;                    // unique, referenced from the audit trail
  globalTurn: number;
  entryId: string;               // "evade-", "block", "damageModifier"
  formula: string;               // as evaluated
  raw: number;                   // the die result before modifiers
  modifiers: Array<{ source: string; delta: number; stage: string }>;
  total: number;
  purpose: string;               // "Heracles evades Karna's normal attack"
  actorId: string;
  visibility: "public" | "gm" | "owner";
  rerolledFrom: string | null;   // GM re-roll chain
}
```

Records accumulate on the `CombatProcess` state and are copied into the final chat card, so the
audit trail (Ch. 30) can show:

```
Evade (Heracles)                            FAILED
  Evade-  1d20+4         →  14
  attacked from the left     +1
  Mad Enhancement B: Evade- forced
  ───────────────────────────────
  total                      15   vs Agility 16   ✓ SUCCESS
```

GM re-rolls are permitted (principle P6) and recorded with `rerolledFrom` plus a reason string,
so the log shows both the original and the replacement.

---

## 14.9 Setup rolls

The pre-game procedures are a distinct batch, run once per unit at summon:

```
SERVANT
  maxHealth  = endTable[END.grade]                 NO ROLL — Health(S) is not used
             ± 100 per END step
  maxAgility = agiTable[AGI.grade]
             + (coinFlip ? 2 : 1)                  (or 1d4 for EX)
             ± 1 per AGI step
  maxLuck    = lucTable[LUC.grade] + 1d4
             ± 1 per LUC step
  baseAttack ± 10 per GRANTED parameter step       (not innate steps — Ch. 05 §5.6)

MASTER
  maxHealth  = 250 ± roll("healthM")               (coin flip for sign)
  maxAgility = 4 + 1d8
  maxLuck    = 8 + 1d12
  baseAttackMag = rank ∈ {A,B} ? 125 : 100
  commandSpells = 3
```

Master Base Health is a flat **250** regardless of rank or essence, before the coin-flip roll.
That is between one sixth and one eighth of a Servant's, which is the numerical statement of how
fragile Masters are — and the reason Overpower, ZON, and Master protection exist.

Exposed as a one-click **Summon** operation on the actor sheet, which rolls everything, shows
the results for confirmation, and writes them. Re-rollable by the GM before the game starts,
locked once the first turn begins.

Master rank determination when essences are not used: *"you can still determine High Rank or
Low Rank Masters by Flipping a Coin for each Master; Heads=High Rank, Tails=Low Rank. If not,
all Masters have Base Attack (MAG)=100."* Three modes, exposed as a game setting.

---

## 14.10 Difficulty levels

The rulebook defines four, and they gate randomness subsystems:

| Level | Effect |
|---|---|
| Beginner | Damage modifiers **and** Luck Checks removed |
| Intermediate | Luck Checks removed |
| Expert | Nothing removed |
| Lunatic | Random event rate up; at least 2 Civilians always on the board |

"Damage modifiers removed" means *"just use Base Attack for damage calculation instead of
Attack+/Attack−"* — so stage 3 of the pipeline becomes a no-op and no crit is determined.

"Luck Checks removed" removes the entire contest ladder (steps 2.1–2.5 collapse: a successful
evade means no damage, a failed evade means damage), and removes `Luck Check: Prevention`,
`Master's Luck`, and the rest. This dramatically shortens combat and is worth supporting well —
it is likely the mode most groups will actually play.

```ts
interface DifficultyConfig {
  damageModifiers: boolean;      // stage 3
  luckChecks: boolean;           // ladder steps 2.1–2.5 and all named checks
  randomEventRate: number;
  minimumCivilians: number;
}
```

The state machine reads the config and elides the disabled transitions, so no separate code
path exists for each difficulty.

---

## 14.11 Summary of decisions

| # | Decision |
|---|---|
| D14.1 | Checks succeed on rolling **strictly under** the stat; equal is a failure. |
| D14.2 | Table selection compares **current stat values**, not ranks. |
| D14.3 | Double Luck Checks compare against the same pre-decrement value; the −2 applies after both. |
| D14.4 | Explicit `Loss` effects and Mad Enhancement beat `Boost` effects when both apply. |
| D14.5 | All named rolls live in a registry with per-world overrides; placeholders warn loudly. |
| D14.6 | Roll modifiers declare `direction`, not a sign, to avoid the rolling-under inversion bug. |
| D14.7 | The rules layer never rolls; it consumes a pre-populated roll map determined by a probe pass. |
| D14.8 | Previews use expected values and display a range. |
| D14.9 | Difficulty levels elide state-machine transitions rather than branching the engine. |

---

**Next:** [15 — Abilities](15-abilities.md)
