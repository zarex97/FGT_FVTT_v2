# 03 — Ranks, parameters and the rank-indexed tables

## What it is

A **Rank** is a grade from `E` to `EX` with an optional modifier (`+` or `-`), representing a character parameter's strength. The gradient `E < D < C < B < A < EX` is the scale; `A+` is stronger than `A`, and `A-` is weaker. A **parameter** is an attribute of a character — `STR` (Strength), `MAG` (Magic), `AGI` (Agility), `LUC` (Luck), `END` (Endurance) — each has its own Rank.

A character may have **no** rank for a given parameter, marked as "unranked". This is `null` in code, not a sentinel value like `E--`. The distinction matters: unranked and `E` are not the same, and every rule that treats unranked specially states its own fallback (`module/domain/rank.mjs:191-196`).

The system uses **rank-indexed tables** — data structures that take a rank and return a value: health formula by END rank, damage reduction by MAG rank, cooldown expressions by skill rank. There are 43 such tables in the engine (`module/domain/tables.mjs:39-433`), authored once and referenced by id. This keeps rank-dependent logic data-driven, making corrections one edit rather than a search.

## Where it lives

| File | Role |
|---|---|
| `module/domain/rank.mjs` | The `Rank` value object: parsing, comparison, and step arithmetic |
| `module/domain/tables.mjs` | Every rank-indexed table and the `lookup` function |
| `module/domain/attributes.mjs` | The attribute implication table for closures and the `Magus` predicate |

Ranks are used heavily across `module/engine/` and `module/rules/`, which call `Rank.parse`, `Rank.parseOrNull`, and `lookup` to interpret sheet data and compute game values.

## How it works

### Rank representation and parsing

A Rank is an immutable, interned value object (`module/domain/rank.mjs:34-49`). The constructor is private; ranks are always created via `Rank.of` or `Rank.parse`.

`Rank.parse(s)` accepts a string like `"A"`, `"D+"`, `"C++"`, `"B-"`. The grammar is strict: *"a grade (E D C B A EX) with optional + or - modifiers"* (`module/domain/rank.mjs:76-98`). It rejects mixed modifiers (`A+-`), unknown grades (`F`, `S`), and empty input. Parsing is case-insensitive on the grade, so `ex` and `EX` both parse to the same interned Rank.

Because Ranks are interned, `Rank.parse("A") === Rank.parse("A")` — the same object is returned on repeated parses (`module/domain/rank.mjs:24-70`). This makes identity comparison safe and is verified by test (`test/unit/rank.test.mjs:26-29`).

`Rank.parseOrNull(s)` treats the unranked markers — `null`, `undefined`, empty string, and the dash characters `"-"`, `"—"`, `"–"` — as `null` rather than parsing them. The source writes unranked abilities as `Rank: -`, which is not a minus modifier but a absence marker (`module/domain/rank.mjs:109-114`).

### Ordinal: grade-major, step-minor

Ranks sit on a dense, ordinal scale. `E` is 0, `B` is 300, `A` is 400, `A+` is 401, `A-` is 399 (`module/domain/rank.mjs:117-123`). The formula is:

```
ordinal = grade_index × 100 + steps
```

where `STEP_WEIGHT = 100` (`module/domain/rank.mjs:22`). This spacing is generous — the observed maximum step count is 2 — so no realistic rank can cross a grade boundary by stepping. The ordinal scale is used for comparison and for threshold tables.

### Comparison and the unranked case

`Rank.compare(a, b)` returns `-1`, `0`, `1`, or `null`. The `null` return is critical: when either rank is unranked, the function returns `null` rather than ordering `null` below `E` (`module/domain/rank.mjs:191-205`). Every rank-dependent rule states its own unranked fallback, and silently treating unranked as lowest would implement the wrong one on many paths.

`Rank.gte(a, b, whenIncomparable)` compares with an explicit fallback: it returns `whenIncomparable` (default `false`) if either side is unranked (`module/domain/rank.mjs:207-217`). Magic Resistance at rank `A+` negates up to `A+`, not just up to `A`, because the `+` and `-` participate in comparison as sub-steps between grades — they are not discarded (`test/unit/rank.test.mjs:61-66`).

`Rank.equals(a, b)` is exact rank equality, not grade equality. Scáthach's *Gate of Skye* keys on the target's MAG being **exactly** `B` or **exactly** `A`; a `MAG EX` or `MAG A+` target receives no bonus (`module/domain/rank.mjs:219-233`). The equality table exists to make this distinction visible in the data.

### Step and stepGrade: two different movements

`step(n)` walks the dense ladder (`module/domain/rank.mjs:131-154`). The ladder has 5 positions per grade: `--`, `-`, `.`, `+`, `++`. Moving one step from `D` yields `D+`, and from `D++` yields `C--` — the boundary is crossed. A Region bonus (`D` → `D+`, `B-` → `B`, `C+` → `C++`) is one step. Stepping clamps at the ends: nothing goes above `EX++` or below `E--`.

`stepGrade(n)` moves whole **grades** and keeps the modifier (`module/domain/rank.mjs:166-178`). *"EMIYA's Magic Resistance Rank is increased by one Rank"* means `D` → `C`, which is five steps on the dense ladder but one grade-step. If authored as `step(1)` it would produce `D+`, a rank the resistance table has no row for, so it would fall back to `D` and the clause would do nothing (`test/unit/rank.test.mjs:124-131`). The difference is a real rule, not a nicety.

### Tables: four kinds

Every rank-indexed table is an entry in `TABLES` (`module/domain/tables.mjs:39-433`). All are looked up by `lookup(id, rank)`, which handles the four table kinds (`module/domain/tables.mjs:455-493`):

**Scaled** tables have a value per grade and a per-step delta. `baseHealthByEnd` for Servants is: `{ kind: "scaled", byGrade: { EX: 2000, A: 1500, B: 1250, C: 1000, D: 750, E: 500 }, perStep: 100 }` (`module/domain/tables.mjs:47-51`). A Servant with END `B+` gets `1250 + 100 = 1350` health. Steps can be negative: `A-` gets `1500 - 100 = 1400`.

Arrays and dice-formula strings are stepped element-wise or with a separate bonus term (`module/domain/tables.mjs:495-513`). Mad Enhancement Defence at `B-` is `[35, 15]`, and at `A+` is authored as an override `[55, 25]` rather than derived, because the sheet says so — a published exception (`module/domain/tables.mjs:323-344`).

**Banded** tables group grades; steps are ignored. Independent Action Sustainability has one band for `["EX", "A+"]` (null, no clock), another for `["A"]` (8 turns) (`module/domain/tables.mjs:196-205`). The lookup checks exact rank first (`A+` matches the first band), then bare grade, so a banded table can distinguish `A+` from `A`.

**Threshold** tables use ordinal cut points. Andreias Amarantos gives a value for any rank at or above a threshold. An attacker with Divinity `C` gets 100, `D` gets 75, `E` gets 50, and no Divinity (unranked) gets the default of 0 (`module/domain/tables.mjs:385-401`).

**Equality** tables match **exact** ranks only. Gate of Skye gives a save modifier for `MAG` exactly `B` or exactly `A`, with a default of 0 for everything else — including `A+`, `A-`, and unranked (`module/domain/tables.mjs:423-432`).

When a rank is `null` (unranked), `lookup` returns the table's `fallback` field (if present) or its `default` field (`module/domain/tables.mjs:455-459`). Some tables have neither; they return `undefined`.

## Invariants & edge cases

1. **Unranked is `null`, never a sentinel Rank.** This forces callers to branch explicitly rather than silently implementing the wrong fallback (`module/domain/rank.mjs:191-196`).

2. **The dense ladder is the scale.** Stepping crosses grade boundaries — `C++` + 1 step = `B--`. The ladder has 5 positions per grade and clamps at the ends (`module/domain/rank.mjs:144-154`).

3. **`stepGrade` is not `step` scaled.** Moving one grade is five steps on the dense ladder. The difference has produced bugs (`module/domain/rank.mjs:166-178`, `test/unit/rank.test.mjs:124-131`).

4. **Interning makes identity comparison safe.** `Rank.parse("A") === Rank.parse("A")` is guaranteed (`module/domain/rank.mjs:24-70`).

5. **Comparison with unranked returns `null`.** Neither `gte`, `lte`, nor `compare` will order `null`; callers must branch (`module/domain/rank.mjs:191-217`).

6. **An override in a scaled table is checked before arithmetic.** Mad Enhancement Defence at `A+` is `[55, 25]`, not `[50+5, 25]`, because the sheet says so. Overrides are matched on exact rank string (`module/domain/tables.mjs:461-473`).

7. **Bands can name exact ranks and bare grades.** Independent Action Sustainability lists `A+` in one band and `A` in another. Lookup checks exact first, then bare (`module/domain/tables.mjs:475-481`).

8. **Equality tables are strict.** Gate of Skye gives nothing for `A+`, `A-`, or EX, only for `A` and `B` exactly (`module/domain/tables.mjs:486-489`).

## Open questions

- **Audited: every `step`/`stepGrade` call site is correct.** There are seven, and they fall into two
  shapes. Five branch on which the author wrote — `d.rankGrades ? current.stepGrade(d.rankGrades) : current.step(d.rankShift)`
  (`module/rules/derived.mjs:73`), and `shift.grades ? rank.stepGrade(shift.grades) : rank` followed by
  `.step(shift.steps)` (`module/rules/elements.mjs:249-250`), which composes both in the right order.
  The other two apply steps only, where steps are what the caller holds
  (`module/rules/snapshot.mjs:999`, `module/rules/snapshot.mjs:1177`). The single site that hardcodes a
  grade-step explains itself: *"One Rank lower is one letter GRADE, not one `+`/`−` step … B+ against an A
  is not 'one Rank lower'; a B is"* (`module/rules/targeting/resolve.mjs:1051-1053`).
- **Audited: both `Rank.equals` call sites are correct.** There are exactly two.
  `module/rules/predicate.mjs:105` implements the `rankEq` predicate operator, which is what equality is for.
  `module/rules/concealment.mjs:148-150` builds *strictly greater* out of
  `Rank.gte(theirs, ours, false) && !Rank.equals(theirs, ours)` — the correct idiom, since `gte` alone would
  let an equal Rank refuse the ladder. No site confuses equality with `gte`.
- What should happen when a rule calls `lookup` with an unranked rank but the table has no `fallback` or `default`? The returned `undefined` may percolate and cause a type error downstream. No safeguard is documented.
- The comment in `module/domain/rank.mjs:7-12` names `Ch. 03` and `Ch. 03`, which are not yet published chapters. These citations are placeholders pending the Ranks & Parameters chapter.
