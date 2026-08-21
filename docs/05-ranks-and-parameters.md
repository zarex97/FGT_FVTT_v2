# 05 — Ranks and Parameters

Ranks are the game's universal ordinal scale. Nearly every table in the rulebook is indexed by
rank, and several combat rules compare ranks at runtime. This chapter specifies the rank
algebra precisely, because a subtly wrong `compare()` silently breaks Magic Resistance,
Presence Concealment's counter clause, HGoB boarding, and Karna's Brahmastra.

---

## 5.1 The rank scale

Six base grades, ascending:

```
E  <  D  <  C  <  B  <  A  <  EX
```

Each may carry modifiers:
- Zero or more `+` (the source contains `A+`, `A++`, `B+`, `C++`, `EX` with none observed
  above `++`, but the grammar allows any count).
- Zero or one `-` (the source contains `B-`, `C-`, `EX-` is not observed but is grammatical).

`+` and `-` never appear together on the same rank in the source. The parser rejects mixed
modifiers.

### Grammar

```
rank      := grade modifier*
grade     := "E" | "D" | "C" | "B" | "A" | "EX"
modifier  := "+" | "-"
```

Valid: `E`, `D+`, `C++`, `B-`, `A`, `A+`, `EX`.
Invalid: `A+-`, `F`, `S`, `A3`, `EX+++` (allowed by grammar, rejected by the content
validator as almost certainly a typo — see §5.8).

### Special value: `-` (no rank)

Several skills in the reference set are written `Rank: -` (Scáthach's *Primordial Rune*,
Karna's *Uncrowned Arms Mastership* and *End of Charity*). This is **not** a rank; it means
*this ability is unranked*. It must be a distinct value, because rank-dependent effects behave
differently against unranked sources:

- Magic Resistance's negation clause compares against the attack's rank. An unranked MAG
  ability has no rank to compare, so the fallback (§5.5) applies.
- Petrify's cure clause: *"a debuff removal effect from a Skill/NP whose Rank is equal or
  higher than that of the Skill/NP which caused the Petrify debuff (if the Skill/NP which
  caused Petrify has no Rank, then a debuff removal effect from a Skill/NP of Rank A or higher
  is required)"* — an explicit unranked fallback.

**DECISION.** `Rank` is `Rank | null`. Never a sentinel string. `null` means unranked and is
handled by explicit branches, not by comparison.

---

## 5.2 The `Rank` value object

```ts
const GRADES = ["E", "D", "C", "B", "A", "EX"] as const;
type Grade = typeof GRADES[number];

class Rank {
  readonly grade: Grade;
  readonly steps: number;        // +n for n plusses, -n for n minuses, 0 for bare

  private constructor(grade: Grade, steps: number) { … }

  /** Parse "A+", "B-", "EX", "C++". Throws on malformed input. */
  static parse(s: string): Rank;

  /** Parse, returning null for "-" / "" / null / undefined. */
  static parseOrNull(s: string | null | undefined): Rank | null;

  toString(): string;            // "A+", round-trips exactly

  /** Ordinal position for comparison. See §5.3. */
  get ordinal(): number;

  /** Number of + (positive) or - (negative) modifiers. */
  get stepCount(): number { return this.steps; }
}
```

Immutable, interned (`Rank.parse("A")` returns the same instance every time) so identity
comparison is safe and there is no allocation churn in hot loops.

---

> **Implementation note.** Rank **comparisons** are emitted as roll options, one per grade a unit
> clears: `target:rank:mag:gte:B`, `self:skillRank:magicResistance:gte:B`, and so on. A predicate
> can only test set membership, so a comparison has to become one — an equality option
> (`rank:mag:A`) would make a clause written for "B or higher" miss every A. A `+` step clears its
> own grade, which is the reading "Rank B or higher" needs.

## 5.3 Ordinal comparison

This is the operation that decides "is the defender's Magic Resistance rank ≥ the attack's
rank?".

**The question that must be answered explicitly:** is `A+` a distinct rank above `A`, or is
`A+` still "rank A with a bonus"?

Evidence from the source:

> **Magic Resistance:** "Rank A: MAG damage dealt with a MAG Rank of A or lower is completely
> negated." … "For every + in Rank, the MAG damage negation affects a MAG Rank of an
> additional +."

That last clause is decisive. Magic Resistance `A+` negates up to `A+`, not up to `A`. So the
`+` participates in the comparison, and modifiers are **sub-steps between grades**.

> **Region bonus:** "all Servants from the corresponding Region receives a + to all Parameters
> (D to D+, B- to B, C+ to C++, etc)."

Confirms `-` → bare → `+` → `++` is a single ordered ladder, and that `B-` + 1 step = `B`.

**DECISION.** Ordinal is grade-major, step-minor, with a step weight large enough that no
realistic step count crosses a grade boundary:

```ts
const STEP_WEIGHT = 100;      // generous; observed max |steps| is 2

get ordinal(): number {
  return GRADES.indexOf(this.grade) * STEP_WEIGHT + this.steps;
}
```

Yielding:

| Rank | ordinal |
|---|---|
| `E-`  | −1 |
| `E`   | 0 |
| `E+`  | 1 |
| `D`   | 100 |
| `C`   | 200 |
| `B-`  | 299 |
| `B`   | 300 |
| `B+`  | 301 |
| `A`   | 400 |
| `A+`  | 401 |
| `A++` | 402 |
| `EX`  | 500 |

```ts
function compare(a: Rank, b: Rank): -1 | 0 | 1 {
  return Math.sign(a.ordinal - b.ordinal) as -1 | 0 | 1;
}
```

**Consequence to be aware of:** `A++` (402) < `EX` (500). Castor's `END: A++` is below an `EX`
END. This is intended — `EX` is a grade, not "A with lots of plusses".

**Consequence 2:** `E-` has ordinal −1, below `E`. The rulebook never states a floor. The
system permits it and does not clamp, because Kiritsugu's `Phantasm Punishment` halves base
attack and other effects reduce ranks; an artificial floor would silently swallow a legitimate
value. The stat derivation tables (§5.6) clamp at their own boundaries instead.

### Where ordinal comparison is used

| Site | Comparison |
|---|---|
| Magic Resistance negation | `defenderMR.rank ≥ attack.magRank` ⇒ full negation |
| Presence Concealment counter clause | `du.agiRank ≥ pcUnit.agiRank` ⇒ may Block/Counter |
| HGoB boarding roll | `unit.agiRank` in bands (`C..B` → −1, `≥A` → −2); same for LUC |
| Karna's Brahmastra | *any* DU parameter > Karna's ⇒ 2× instead of 4× |
| Petrify cure | `cureAbility.rank ≥ petrifySource.rank` |
| Scáthach's Gate of Skye | DU `MAG == B` → −2 to roll; `MAG == A` → −4 |
| Vasavi Shakti bonus | DU Divinity rank in `B..EX` → ×3; `E..C` → ×2 |
| Knockback damage | die size by END rank |
| Sap/Bleed | `STR ≥ B` improves Struggle chance (Advanced) |

Note that Scáthach's Gate of Skye uses **equality** on the bare grade (`MAG is Rank B`), not
`≥`. That is a different operation and the content model must be able to express it:
predicates support `eq`, `gte`, `lte`, `in` over ranks, and the author picks.

**RISK.** It is very easy to write `>=` where the source says "is Rank B". The content
validator flags any rank predicate authored with `gte` against a *mid-scale* grade with a
warning, requiring an explicit `@intentional` marker. Cheap, and catches a real class of bug.

---

## 5.4 Step arithmetic

The second, distinct operation: *"For every + in Rank, X is increased by N."*

```ts
/** Signed count of modifiers. A++ → 2, B- → -1, C → 0. */
function stepCount(r: Rank): number { return r.steps; }

/** Apply a table with a per-step delta. */
function rankScaled<T extends number>(
  r: Rank,
  table: Record<Grade, T>,
  perStep: number
): number {
  return table[r.grade] + r.steps * perStep;
}
```

Worked example — Magic Resistance's debuff-resistance clause:

```
Rank EX: 30%   A: 25%   B: 20%   C: 15%   D: 10%   E: 5%
```

No per-step clause is given for that table, so `perStep = 0` and `A+` gives 25%. But the
*negation* clause explicitly says `+` extends the negated rank, so that clause uses ordinal
comparison, not step scaling. **The same skill uses both operations on the same rank.** This
is exactly why they must be separate functions with separate names.

Worked example — Item Construction, which does have a per-step clause:

```
Rank EX: 75%  A: 50%  B: 40%  C: 30%  D: 20%  E: 10%
"For every + in Rank, X is increased by 5. For every - in Rank, X is reduced by 5."
```

Van Gogh has `Item Construction — Rank: B-`, and her sheet says **35%**. Check:
`table[B] + (−1 × 5) = 40 − 5 = 35`. ✓ The model reproduces the authored value.

Worked example — Riding's cooldown, which uses *fractional ◈* per step:

```
Rank EX: MOV+6 (CD 3◈)   A: +5 (3◈)   B: +4 (2◈)   C: +3 (2◈)   D: +2 (1◈)   E: +1 (1◈)
"For every + in Rank, Cooldown is reduced by ⅓◈ Turns."
```

So the per-step delta is a *duration expression*, not a number. `rankScaled` is therefore
generic over an additive type, with `TickExpr` implementing the interface (Ch. 07).

### Tables where + has no defined meaning

Several tables give no per-step clause (Independent Action's ZON bands group ranks:
`EX, A: +3`, `B, C: +2`, `E, D: +1`). These are **band tables**, not scaled tables:

```ts
type RankTable<T> =
  | { kind: "scaled"; byGrade: Record<Grade, T>; perStep: T }
  | { kind: "banded"; bands: Array<{ grades: Grade[]; value: T }> }
  | { kind: "threshold"; thresholds: Array<{ minOrdinal: number; value: T }> };
```

Banded tables ignore steps entirely. Threshold tables (used by boarding rolls, Vasavi Shakti's
Divinity scaling) compare ordinals against cut points. All three live in Appendix B, authored
once, referenced by rank-dependent rule elements.

---

## 5.5 Ranks in combat

### Which rank does an *attack* have?

Magic Resistance needs "the MAG Rank of the attack". Three cases, in priority order:

1. **The ability declares a rank** — an NP or ranked Skill. Use it.
   > *"If a Unit uses a Base Attack (MAG) Skill or NP against a DU with Magic Resistance and
   > that Skill/NP has a Rank, use the Rank of that Skill/NP."*
2. **Normal attack** — use the attacker's own MAG Parameter rank.
3. **Unranked ability** — falls through to case 2 (the attacker's parameter). This is an
   inference; recorded in Ch. 41.

```ts
function attackMagRank(ctx: AttackContext): Rank | null {
  if (ctx.ability?.rank) return ctx.ability.rank;
  return ctx.attacker.parameters.mag;
}
```

### Which rank does the *defence* have?

The rank of the Magic Resistance skill itself — **not** the defender's MAG parameter. This is
a common misreading. Pollux has `MAG: C` but `Magic Resistance — Rank: A`, and negates up to
Rank A. The prototype's `getDefenseRankForResistance()` falls back to the defender's MAG
parameter when the effect has no `sourceLetterRank`, which is wrong for normal attacks. Fixed
here: the Magic Resistance rule element carries its own rank, always.

### Attacks with no MAG component

`processResistance` must early-out when the attack has zero MAG proportion, otherwise a pure
STR attack gets negated by Magic Resistance. The prototype does this correctly
(`if (relevantProportion === 0) return`) and it is preserved.

> *"When a Unit with Magic Resistance receives an Attack that uses both Base Attack (STR) and
> Base Attack (MAG), Magic Resistance only reduces damage from the Base Attack (MAG) portion
> of the Attack, unless stated."*

Several abilities state otherwise — Karna's `Mana Burst (Flames)` and Mannanán's
`Hallowed Sea God's Sword` are explicitly *"Not affected by Magic Resistance"* even though
they use combined base attack. That is a per-ability flag `ignoresMagicResistance: true`,
checked before the resistance stage.

---

## 5.6 Parameters → Stats derivation

Parameters are Ranks; Stats are numbers. The conversion happens **once, at summon**, and the
results are stored. It is not a derived-data recomputation, because it involves dice.

### Max Health

```
Base by END rank:  A 1500   B 1250   C 1000   D 750   E 500
```

Procedure:
1. Take base from END grade.
2. `+100` per `+` step, `−100` per `-` step.

**There is no variance roll.** The rulebook describes a `Health(S)` coin-flip roll, but the
game's author has confirmed that `Health(S)` is not used (Ch. 41 Q1), so Servant Max Health is
fully deterministic from END. Only Masters roll for Health.

The table has no `EX` row. Kingprotea has `END: EX` and a stated `Base Health: 2000`, so the
table is extended: `EX 2000`, inferred from her sheet. Asterios has `END: A++` and a stated
`Base Health: 1500` — bare `A`, with the `++` not applied — which is the same pattern as
Castor's, and confirms the rule below.

Also note that several reference sheets state `Base Health` directly (Castor `END: A++`,
`Base Health: 1500` — matching bare `A`, with the `++` presumably folded into the +200 that
step scaling would give, or simply not applied). **DECISION.** When a sheet states
`Base Health` explicitly, that value is authoritative and the END-derivation is not run; the
step adjustment is assumed already included. The content validator warns when a stated
`Base Health` disagrees with `table[grade]` by anything other than a multiple of 100.

### Max Agility

```
Rank EX: 20 + 1d4
Rank A:  18 + X       where X = 2 on Heads, 1 on Tails
Rank B:  16 + X
Rank C:  14 + X
Rank D:  12 + X
Rank E:  10 + X
```
Then `±1` per step.

### Max Luck

```
Rank EX: 20 + X       where X = 1d4
Rank A:  16 + X
Rank B:  12 + X
Rank C:   8 + X
Rank D:   4 + X
Rank E:   0 + X
```
Then `±1` per step. (The source's `-` clause reads "decrease the Servant's Max Luck by." with
the value missing; `1` is the obvious reading and is what we implement — Ch. 41.)

### MOV

Derived from AGI rank, but the rulebook never gives the table. Every reference sheet states
MOV directly (Van Gogh 5 with `AGI: C`; Scáthach 7 with `AGI: A`; Karna 7 with `AGI: A`;
Penthesilea 4 with `AGI: C`; Semiramis 4 with `AGI: D`; Kingprotea 7 with `AGI: A`).

`AGI: C` gives both 5 (Van Gogh) and 4 (Penthesilea), so MOV is **not** a pure function of AGI
rank in the reference data.

**DECISION.** MOV is an authored per-Servant value, not derived. The AGI rank derivation is
recorded as a designer guideline in the content docs, not enforced. Ch. 41.

### Base Attack

Authored per-Servant. Modified at setup by:
> *"For every + or - added to the Servant's STR/MAG through High Rank Masters and/or Region
> (i.e. any + or - that is not already present on the Servant's Parameters), increase or
> decrease that Servant's corresponding Base Attack by 10."*

Critical subtlety: only **added** steps count, not steps the Servant already has. Penthesilea
starts at `STR: A+` and her Base Attack (STR) of 160 already accounts for it; if a Region
bonus pushes her to `A++`, she gains **+10**, not +20.

**Implication for the data model:** a Servant must store *base parameters* and *granted
parameter steps* separately.

```ts
interface Parameters {
  base:    Record<ParamKey, Rank>;      // as printed on the sheet
  granted: Record<ParamKey, number>;    // steps added post-summon (master, region)
  get effective(): Record<ParamKey, Rank>;   // base shifted by granted
}
```

`baseAttackAdjustment = granted.str * 10` and `granted.mag * 10`. Clean, and it makes the
Region rule ("+ to all Parameters") a single `granted[k] += 1` loop.

### Semiramis's rank-up

Aboard the Hanging Gardens, *all* of Semiramis's Parameters go up one rank, with explicit
stat consequences listed on her sheet:

```
STR: E → D,  Base Attack (STR) +25
END: D → C,  Max & current Health +500
AGI: D → C,  MOV +1, Max & current Agility +2
MAG: A → EX, Base Attack (MAG) +50
LUC: A → EX, Max & current Luck +4
```

Note these deltas are **not** what the generic derivation tables would produce (END D→C is
+250 base health by table, not +500; LUC A→EX is +4 by table ✓; AGI D→C is +2 by table ✓).

**DECISION.** Rank-shift effects declare their stat consequences explicitly rather than
re-running derivation. Re-running derivation would re-roll dice, which is unacceptable.
The rule element is:

```yaml
- key: RankShift
  parameters: [str, end, agi, mag, luc]
  steps: 1
  statDeltas:
    baseAttackStr: 25
    health: { max: 500, current: 500 }
    mov: 1
    agility: { max: 2, current: 2 }
    baseAttackMag: 50
    luck: { max: 4, current: 4 }
```

Reversible: when the HGoB is destroyed, the deltas are subtracted and current values clamped.

---

## 5.7 Runtime rank changes

Several effects change a rank mid-game:

| Source | Change |
|---|---|
| Kiritsugu's *Affection of the Holy Grail* | LUC `E → EX` (passive); under Skill Seal, reverts and instead applies +20 to all Luck Check rolls |
| Karna's *Vasavi Shakti* activation | STR `B → A`, Base Attack (STR) +25, permanent |
| Penthesilea's *Goddess of War* | Divinity `B → A` while Mad Enhancement is off |
| Semiramis aboard HGoB | all parameters +1 |
| Region bonus | all parameters +1 |
| High Rank Master | one parameter +1 |

Two of these are conditional and reversible (Kiritsugu under Skill Seal, Penthesilea's
Mad Enhancement state), so rank must be a **derived** value with a base and an ordered list of
active modifiers — the same shape as every other stat.

```ts
get effectiveRank(key: ParamKey): Rank {
  let r = this.base[key];
  for (const m of this.rankModifiers(key).sort(byPriority))
    r = m.apply(r);            // shift steps, or set absolute
  return r;
}
```

Two modifier kinds:
- `shift(n)` — move n steps along the ladder (Region, HGoB, Master).
- `set(rank)` — replace outright (Kiritsugu's `E → EX`, Karna's `B → A`).

`set` wins over `shift` and is applied last, matching the intent of both cases (Kiritsugu is
EX regardless of anything else; Karna is A regardless).

**RISK.** Rank changes invalidate cached derived data across many systems (Magic Resistance
tables, ZON, boarding rolls). Rank is included in the `derivedVersion` counter that
invalidates unit snapshots (Ch. 03).

---

## 5.8 Validation

The content pipeline enforces:

1. Every rank string parses. Unparseable ⇒ build failure with document name and field path.
2. `steps` in `[-2, +2]` ⇒ pass; outside ⇒ warning (probably a typo, but legal).
3. No mixed `+`/`-`.
4. Every rank-indexed table used by a rule element covers every grade the content can produce,
   or declares a default.
5. A stated `Base Health` that disagrees with the END table by a non-multiple of 100 ⇒ warning.
6. A rank predicate using `gte` on grades `C`, `B`, or `A` without `@intentional` ⇒ warning
   (see §5.3 RISK).

---

## 5.9 Reference: the ranks in the reference set

Distribution across the 12 reference Servants, as a sanity check on the model's coverage:

| Rank string | Appears as |
|---|---|
| `EX` | Mannanán MAG, Kingprotea STR/END, Drake LUC, Kiritsugu LUC(derived), many skills |
| `A++` | Castor END, Pollux END |
| `A+` | Kiritsugu AGI, Penthesilea STR, Heracles STR, many NPs and skills |
| `A` | very common |
| `B+` | Penthesilea END, several skills/NPs |
| `B` | very common |
| `B-` | Van Gogh Item Construction, Castor Mad Enhancement |
| `C++` | Nemo *Voyager of the Storm*, *Journey's Guidance* |
| `C+` | Semiramis Presence Concealment |
| `C` | common |
| `D` | common |
| `E` | Van Gogh STR, Semiramis STR, Drake MAG, Kingprotea NP `Airavata King Size` |
| `-` (unranked) | Scáthach *Primordial Rune*, Karna *Uncrowned Arms Mastership*, *End of Charity* |

Every form in the grammar is exercised by the reference set. Good — it means the parser is
validated by the acceptance content rather than by synthetic tests alone.

---

**Next:** [06 — Stats and Resources](06-stats-and-resources.md)
