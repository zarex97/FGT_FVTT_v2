# 13 — Checks, randomness and the roll log

## What it is

A **check** is a roll-under comparison: roll at or under a stat to succeed. The system uses three named check types — **Agility Checks** (Evade), **Luck Checks**, and **injury rolls** — plus a generic **percentage roll** that powers effect application, crit chances, and every stated `X%` mechanic (`module/rules/checks.mjs:1-18`).

Two mechanical facts shape how checks work. First, every check is *pure* — it takes a die result as an argument and returns a verdict, with no hidden globals (`module/rules/checks.mjs:5-6`). Second, `tableFor` applies a **4-point penalty** to Luck and Evade checks when a stat comparison says you should lose: contesting a luckier opponent moves you to an unfavourable table (`module/rules/checks.mjs:49-54`, `module/rules/checks.mjs:23`).

The roll log records every roll made: the raw die, every modifier, and chains of replays if a GM re-rolls (`module/rules/roll-log.mjs:1-13`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/checks.mjs` | Agility Checks, Luck Checks, percentage rolls, table selection |
| `module/rules/checks/branches.mjs` | Branch selection for check phases with nested outcomes |
| `module/rules/roll-log.mjs` | Log records, roll chains, visibility filters, rendering |
| `module/rules/roll-table.mjs` | Dice-determined outcomes: table lookup for abilities like Primordial Rune |
| `docs/C-dice-registry.md` | Appendix: every named roll in the system — formulas, modifiers, consumers |

## How it works

### The three check types

**Agility Checks** (Evade) succeed when `roll ≤ agility`. The check has two special branches: a unit holding `Dodge` succeeds without rolling, unless the attacker holds `Aim`, which forces a roll anyway (`module/rules/checks.mjs:231-285`). A unit with an `AutoSucceed` behaves the same way, with a `beatenBy` list that can be arbitrary attack properties (`module/rules/checks.mjs:269-278`).

**Luck Checks** contest one unit's Luck against another's. If the rolling unit's Luck meets or exceeds the opponent's, the check uses the `"favourable"` table (`1d20`); otherwise, `"unfavourable"` (`1d20+4`), applying a flat 4-point penalty (`module/rules/checks.mjs:304-312`). An uncontested Luck Check — one with no opponent — always uses favourable (`module/rules/checks.mjs:49-54`).

**Percentage rolls** for effect application and crit chances use the generic `chance` function: roll is strictly *under* the percentage, so 0% never succeeds and 100% always does, with no off-by-one (`module/rules/checks.mjs:328-330`). The dice registry (Appendix C) names over 20 formulas used in the system; every formula in 0.2.0+ is stated, not inferred (`docs/C-dice-registry.md:1-42`).

### Check modifiers and forcing

The system collects modifiers per check into a `CheckPlan`: numeric deltas, forced tables, automatic successes, and player-adjustable rolls (`module/rules/checks.mjs:57-128`). A unit can force its own checks onto the unfavourable table with `Luck Loss` or onto favourable with `Luck Boost` — debuffs win ties, so a unit holding both forced tables uses unfavourable (`module/rules/checks.mjs:39-43`, `module/rules/checks.mjs:110-123`).

EMIYA's *Clairvoyance* is the system's sole example of an *imposed* check modifier: an ability on one unit that forces another unit's checks onto a table (`module/rules/checks.mjs:130-160`). It is applied through `mergePlans`, which combines the checking unit's own modifiers with those imposed by the opponent.

Some modifiers have a chance of applying — EMIYA's Clairvoyance is 80% likely to impose the unfavourable table. These are resolved through a `1d100` roll keyed by the modifier's source; the roll arrives from the caller (`module/rules/checks.mjs:412-431`).

### Contested checks

A **contested check** compares two stats. When resolving a Luck Check against an opponent, pass `opposingLuck`; the function uses `tableFor` to decide which table applies (`module/rules/checks.mjs:304-312`). An Evade check against an attack is the default case: Agility is compared implicitly to nothing (uncontested, so always favourable), but modifiers from the attack (`attackIsNP: +3`, `fromBehind: +2`) make it harder to succeed.

The attack engine demonstrates this at line 2794–2800: a Luck Check passes both the defender's luck and the attacker's luck (`opposingLuck`) to `luckCheck`, along with a plan describing forced tables and modifiers (`module/engine/attack.mjs:2794-2800`).

### Roll log and audit trail

The roll log is the answer to "why did that miss?". Each record stores the raw die, the total after modifiers, every modifier with its delta and stage, and whether the roll is a reroll (`module/rules/roll-log.mjs:15-62`).

A roll is uniquely identified by `id`, `globalTurn` (the current turn index), and `entryId` (the purpose — `"evade"`, `"luck"`, etc.). When a roll is replayed or interrupted, a new record is appended with a `rerolledFrom` pointer to the original, keeping both in the chain (`module/rules/roll-log.mjs:77-107`). The function `chainOf` walks a log backwards through all rerolls of a single roll (`module/rules/roll-log.mjs:109-125`).

Visibility is checked at read time: only the GM sees hidden rolls; players see only their own `"owner"` rolls and public ones (`module/rules/roll-log.mjs:128-147`). A `Discover` roll by a player would give away an Assassin's position without anyone rolling anything, so such rolls are never visible to non-owners (`module/rules/roll-log.mjs:130-132`).

### Dice, seeds, and replayability

Every roll is made through Foundry's `Roll.evaluate()` in the engine layer (e.g., `module/engine/attack.mjs:2791`). The pure rules layer takes the result as an argument and decides whether it succeeds.

The board projection includes a `seed` derived from the current turn index (`globalTurn`) (`module/engine/board.mjs:319`). When resolving targeting that requires random selection among multiple candidates, `seededShuffle` uses this seed to shuffle deterministically (`module/rules/targeting/resolve.mjs:1087-1099`). A replayed resolution picks the same random targets as the original because the seed is the same.

Modifiers that themselves involve chance — like the 80% forced table — require a rolled die, which is keyed by the modifier's source and passed to `checkPlan` (`module/rules/checks.mjs:412-431`). A replay supplies the same rolled values under the same keys, reproducing the same outcomes.

### Branch selection and nested checks

A check phase can declare branches: different outcomes based on predicates tested against the target (`module/rules/checks/branches.mjs:34-43`). Medusa's Mystic Eyes applies different tables based on whether the target is Human, MAG, or DEF (`module/rules/checks/branches.mjs:1-12`). An empty `when` is a catch-all; branches are tried in order.

A branch can be another check rather than a final outcome — *"if Failed, roll again"* — nesting up to a depth of 3 (`module/rules/checks/branches.mjs:16-17`, `module/rules/checks/branches.mjs:45-56`).

### Table-driven outcomes

Scáthach's *Primordial Rune* rolls `2d8` and looks up the results in a table, applying entries per die (so two 6s produce two applications) (`module/rules/roll-table.mjs:42-67`). A table may be conditional on the target's relation (ally vs. enemy); one table is the common case (`module/rules/roll-table.mjs:23-40`).

A wildcard row — *"your choice of any of the above"* — returns a question to the caller rather than effects. The `choicesIn` function lists all non-wildcard rows so the interface can render choices (`module/rules/roll-table.mjs:69-86`).

## Invariants & edge cases

1. **Success is at or under the target, not just under.** A roll equal to the stat succeeds (`module/rules/checks.mjs:205-211`).

2. **The unfavourable penalty is always 4.** Both Evade and Luck apply the same penalty; this was a documented typo in 0.2.0 and is now live (`module/rules/checks.mjs:23`, `module/rules/checks.mjs:304-312`, `docs/C-dice-registry.md:39-42`).

3. **Debuffs win ties.** If a unit carries both `Luck Boost` and `Luck Loss`, unfavourable applies (`module/rules/checks.mjs:40-42`, `module/rules/checks.mjs:110-123`).

4. **Dodge succeeds without rolling; Aim beats Dodge.** A unit with `Dodge` succeeds unless `attackHasAim` is true, which forces a roll. An `AutoSucceed` from an effect works the same way, with its own `beatenBy` list (`module/rules/checks.mjs:263-278`).

5. **A percentage roll is strictly under, never at-or-under.** `chance(100, 100)` succeeds; `chance(1, 0)` fails (`module/rules/checks.mjs:328-330`).

6. **An evade-blocking restriction (`evadableOnlyBy`) is an array.** Null means no restriction; an empty array means nothing evades at all — this is how Fragarach's clause *"remaining hits cannot be Evaded"* is modelled (`module/rules/checks.mjs:247-261`).

7. **Reroll records preserve both the original and the replacement.** A re-roll appends a new record with `rerolledFrom` set to the original ID (`module/rules/roll-log.mjs:85-107`). Duplicates (same `id`) are dropped to prevent double-logging from replayed sequences (`module/rules/roll-log.mjs:78-82`).

8. **A rolled modifier magnitude (`roll.formula`) is resolved from the caller's roll totals.** A contribution with a rolled magnitude looks up its result keyed by its `roll.key` in the rolls object. No die means the contribution becomes zero, not a certainty (`module/rules/checks.mjs:97-108`).

## Open questions

- **What is a "contested check" exactly?** The term appears in comments but the code uses `opposing` / `opposingLuck` arguments. A Luck Check with a non-null opponent is clearly contested; an Evade against an attack is not. The distinction is load-bearing for table selection but not named consistently (`module/rules/checks.mjs:45`, `module/engine/attack.mjs:194`).

- **Confirmed live: the chain is preserved, and replay is deterministic given the recorded rolls.**
  Exercised against a live board: three records chained `r1 → r2 → r3` with totals `7 → 19 → 3`,
  each replacement carrying its reason (`"Luck Check"`, `"second reroll"`), the original intact at
  `7`, and unchanged fields — the `1d20` formula — inherited down the chain. `chainOf` returns the
  whole history oldest-first (`module/rules/roll-log.mjs:116`). Replay is then deterministic because
  the damage pipeline is pure and consumes its randomness from `ctx.rolls` rather than rolling its
  own; identical inputs produced byte-identical output. Note the seed is *not* what makes this work —
  it governs target selection only (see above), so a faithful replay needs the log's recorded values.

- **A sharp edge: `append` dedupes by `id`, and `reroll` inherits the original's.** `append` is a
  no-op when an entry with that id already exists (`module/rules/roll-log.mjs:80`), and `reroll`
  spreads `...original` — so a caller that does not supply a **fresh `id`** in the replacement gets a
  silently discarded reroll. Idempotence is the right property for a log, but it means the failure
  mode is silence rather than a duplicate.

- **Open: which log owns a GM roll override?** `reroll()` is implemented and unit-tested — with the
  reason *"GM ruled the modifier misapplied"* (`test/unit/roll-log.test.mjs:63-67`) — but **nothing in
  the engine or the interface calls it**. The need it was written for is met at a different layer: the
  *game* log's override is fully wired, from `override` in `module/engine/game-log.mjs` through
  `module/apps/log-viewer.mjs:33` and `module/apps/log-viewer.mjs:118-121`, which requires a reason and
  shows the override as its own entry. Both honour the same principle — never replace, keep both — so
  this is duplication rather than a gap, and `roll-log.reroll()` is either the intended route for
  roll-level overrides that the viewer does not yet offer, or dead code. Worth deciding, because an
  unreached facility is this codebase's most frequent defect shape.

- **Answered: the seed governs random target selection, and nothing else.** The whole path is three hops — `module/engine/board.mjs:319` derives `seed` from `combat.system.globalTurn`, `module/rules/snapshot.mjs:731` carries it onto the board projection, and `module/rules/targeting/resolve.mjs:425` consumes it in `seededShuffle` when a `random` chooser picks targets. That is its **only** consumer: `grep -rn seededShuffle module/` returns the definition and that one call. Dice are **not** seeded — every roll goes through Foundry's `Roll`, so a replay reproduces which targets were chosen but not what was rolled at them. Replaying a whole exchange deterministically would need the roll log's recorded values, not the seed.
