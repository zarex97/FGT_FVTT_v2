# 04 — The ◈ Tick Operator and the Time Model

## What it is

F/GT measures durations in a unit called **◈** (the tick operator), which resolves to a variable number of Turns depending on the world's `turnsPerRound` setting. A **Round** is always an integer number of Turns; the authored form is one Round (*1◈*), fractions of a Round (*⅓◈*), or a mixture (*1◈+⅔◈*). The same content authored once resolves correctly in every variant of the game without re-writing, from the Great Holy Grail War (3 turns per round) through the Holy Grail War (8 turns per round) to post-True-Masters Snowfield (15 turns per round) (`module/domain/tick.mjs:7-9`).

The system has **four duration kinds** besides ◈:

- *Turns* — a literal turn count (e.g. *"2 turns"*).
- *this turn* — expires immediately at turn end, carrying zero remaining turns (`module/domain/tick.mjs:221-222`).
- *permanent*, *until <event>*, *N times* — not time-limited. `permanent` effects stay forever; `until <event>` are removed by an external trigger; use counts are removed by consumption. All resolve to `INFINITE` for comparison purposes (`module/domain/tick.mjs:223-228`).

Fractions **always round down** (`module/domain/tick.mjs:68`), with one published exception: ½◈ at 3 turns per round is 2 turns, not 1. That exception lives in the source's own published table rather than in a rounding hack, so it stays visible (`module/domain/tick.mjs:29-33`).

## Where it lives

| File | Role |
|---|---|
| `module/domain/tick.mjs` | Parse and resolve ◈ expressions to integer turn counts |
| `module/settings.mjs` | Register the `turnsPerRound` game setting |
| `module/engine/scheduler.mjs` | Invoke `resolveTicks` for event handler durations and cooldown rewinding |
| `module/engine/cooldown.mjs` | Resolve ability cooldowns from ◈ expressions |
| `module/engine/effect-applier.mjs` | Compute effect expiry as an absolute tick number |
| `module/engine/channel.mjs` | Resolve combat phase duration requirements |
| `test/unit/tick.test.mjs` | Parsing, resolution, and format round-trip tests |

## How it works

### Parsing

`parseTick` is the entry point (`module/domain/tick.mjs:91-125`). It accepts:

```
"1◈"  "3◈"  "⅓◈"  "1◈+⅔◈"  "4◈-⅓◈"  "1/3◈"  "1+2/3◈"
"2 turns"  "1 turn"  "this turn"  "permanent"
"3 times"  "1 time"  "until zeroSailEnds"
```

A bare number is a literal turn count (`module/domain/tick.mjs:95-99`). Anything else throws, so the content build fails loudly on a typo rather than silently accepting zero (`module/domain/tick.mjs:96-97`).

The return type is `TickExpr`, a discriminated union with six variants: `kind: "ticks"` (a turn count), `"rounds"` (a whole and optional fraction), `"thisTurn"`, `"permanent"`, `"untilEvent"`, and `"uses"` (`module/domain/tick.mjs:49-55`).

### Resolution

`resolveTicks` converts a parsed expression to an integer using the world's `turnsPerRound` setting (`module/domain/tick.mjs:214-241`). The logic is:

- `ticks`: return the turn count as-is.
- `thisTurn`: return 0 (expires at turn end with zero remaining).
- `permanent`, `untilEvent`, `uses`: return `INFINITE` — these don't count down.
- `rounds`: multiply the whole number by `turnsPerRound`, then add the fractional part via `fractionTicks`.

The fraction resolution calls `TICK_OVERRIDES` first — the source's own exception table (`module/domain/tick.mjs:29-33`) — and falls back to floor division (`module/domain/tick.mjs:65-69`). The negative fractional adjustments are clamped: `0◈-2/3◈` at 3 turns per round resolves to 0, not negative (`module/domain/tick.mjs:233`).

### Setting and consumers

The `turnsPerRound` setting is registered as a world-scoped, integer-valued number field with a minimum of 2 and default of 3 (`module/settings.mjs:23-26`). It is read at runtime by:

- **Scheduler** (`module/engine/scheduler.mjs:19`): Duration gates on turn-end and round-end event handlers (`module/engine/scheduler.mjs:372`, `module/engine/scheduler.mjs:394`).
- **Cooldown flow** (`module/engine/cooldown.mjs:18`): Branch-selected cooldowns and conditional bonus cooldowns are resolved against the world setting (`module/engine/cooldown.mjs:104`, `module/engine/cooldown.mjs:115`, `module/engine/cooldown.mjs:135`).
- **Effect applier** (`module/engine/effect-applier.mjs`): Authored expiry becomes an absolute tick number by adding the resolved turn count to the current tick.
- **Combat phases** (`module/engine/channel.mjs`): Required tick counts for phase boundaries.

The `ticks` wrapper function parses and resolves in one call (`module/domain/tick.mjs:249-251`).

## Invariants & edge cases

1. **◈ expressions resolve correctly in all world variants** without re-authoring. The test suite verifies this across 3, 8, and 15 turns per round (`test/unit/tick.test.mjs:53-67`).

2. **Fractions always floor except where the source says otherwise.** The exception table holds the 3×3 deviations and makes them visible (`module/domain/tick.mjs:29-33`).

3. **`resolveTicks(null)` returns 0**, which is a legitimate answer for *"this turn"* — it has no duration to count down (`module/domain/tick.mjs:215`). Code comments read: *"Expires at the end of the current turn — zero remaining turns."* (`module/domain/tick.mjs:221-222`).

4. **Negative fractional adjustments never go below zero.** A cooldown reduction of 2/3 on a 0◈ base is clamped to 0 (`module/domain/tick.mjs:233`).

5. **`until<event>` and `uses` are not time-limited.** Both resolve to `INFINITE` and are removed by a trigger (an event or consumption) rather than by the scheduler's countdown. Comments state: *"Neither counts down, so neither can be given a turn count."* (`module/domain/tick.mjs:226-227`).

6. **A bare ◈ is strictly parsed.** Invalid input throws a `RangeError` naming the expected forms, so typos are caught at content build time rather than at runtime (`module/domain/tick.mjs:121-124`).

7. **The setting is guarded.** Changing `turnsPerRound` mid-match is refused because it would invalidate every stored absolute tick on the board (`module/settings.mjs:26`).

## Traps and anti-patterns

**Leaving a table's gaps to fall through to a generic rule.** `TICK_OVERRIDES` covers only the
three published rulesets, and `fractionTicks` fell through to plain `Math.floor` for anything else
— but the table exists specifically because a rounding rule can be *wrong* (its own `3 → "1/2"` cell
overrides `floor` for exactly that reason), so falling back to the rule the table was written to
override was backwards. Worse, `turnsPerRound` accepted any integer ≥ 2 with no `choices`, so an
uncovered value was one GM setting away — measured live, `1/3◈` at `turnsPerRound: 2` resolved to
**0 turns**, not a short duration but no duration at all
(`packs/_source/abilities/semiramis-familiar-doves.yml:22` authors exactly that fraction). Filed and
fixed as [#21](https://github.com/zarex97/FGT_FVTT_v2/issues/21): the setting is now constrained to
`choices: {3, 8, 15}` (`module/settings.mjs`), and as a second, independent backstop, `fractionTicks`
floors any stated fraction to a **minimum of one tick**, never zero
(`module/domain/tick.mjs:65-73`). **A stated duration must never round away to nothing — floor it to
the smallest real duration instead of to zero.**

## Open questions

- **Confirmed live.** Absolute expiry is `currentTick + resolveTicks(...)`, stamped once and stored as an
  absolute tick rather than a countdown (`module/engine/effect-applier.mjs:255`). Verified against real
  instances in the `fgt2026` world: `critDwn` instances carry `appliedTick: 6` and `expiry: 9` — a span of
  **3**, which at `turnsPerRound: 3` is exactly `1◈`. `critDwn` declares no `defaultDuration`
  (`packs/_source/effects/crit-dwn.yml`), so that clock came from the applying ability and still lands where
  the formula says. Storing the absolute tick is what makes Stop's clock freeze and a mid-match ◈ change safe.


- **U+2212 minus sign caught in the wild.** The tick parser accepts only ASCII hyphen (`-`), not U+2212 MINUS SIGN (−). The test `tick-literals.test.mjs` was written specifically to catch this mutation, after an `engine/copy.mjs` cooldown expression written with the Unicode character threw, was caught by `cooldownFor`, and left every copy with no cooldown at all (`test/unit/tick-literals.test.mjs:1-14`).
