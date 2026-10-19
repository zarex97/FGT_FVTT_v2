# 04 — The ◈ Tick Operator and the Time Model

## What it is

F/GT measures durations in **Ticks** and **◈**. A Tick is one Turn taken as a length of time — a fraction of a Round — and the match counts the Ticks that have passed (`combat.system.globalTurn`). **◈** is one Round's worth of Ticks, which resolves to a variable number of Turns depending on the world's `turnsPerRound` setting (`CONTEXT.md`). A **Moment** is a point in the match: a Round, and how many Ticks into it. A **Round** is always an integer number of Turns; the authored form is one Round (*1◈*), fractions of a Round (*⅓◈*), or a mixture (*1◈+⅔◈*). The same content authored once resolves correctly in every variant of the game without re-writing, from the Great Holy Grail War (3 turns per round) through the Holy Grail War (8 turns per round) to post-True-Masters Snowfield (15 turns per round) (`module/domain/tick.mjs:7-9`).

The system has **four duration kinds** besides ◈:

- *Turns* — a literal turn count (e.g. *"2 turns"*).
- *this turn* — expires immediately at turn end, carrying zero remaining turns (`module/domain/tick.mjs:221-222`).
- *permanent*, *until <event>*, *N times* — not time-limited. `permanent` effects stay forever; `until <event>` carry the event on the instance (`endsOn`) and `fireEvent` removes them when it fires on their bearer, so Mannanán's Crit Up *"for that Combat Phase"* is `until combatPhaseEnd` (`module/engine/scheduler.mjs#fireEvent`). An event handler's `ApplyEffect` carries it too (#208 reading 12): the action stamps `duration` for an `until <event>` and `engine/applier.mjs#entryOfIntent` forwards that one form, so EMIYA's Circuits last *"for the rest of the Round"* as `until roundEnd`. It had kept only `expiry` and dropped the duration, and the effect was permanent. A unit hears `combatPhaseEnd` only if the Phase involved it (the attacker and its defenders), so an effect that must end with the Phase is applied to those. The event name keeps its case; use counts are removed by consumption. All resolve to `INFINITE` for comparison purposes (`module/domain/tick.mjs:223-228`).

Fractions **always round down** (`module/domain/tick.mjs:68`), with one published exception: ½◈ at 3 turns per round is 2 turns, not 1. That exception lives in the source's own published table rather than in a rounding hack, so it stays visible (`module/domain/tick.mjs:29-33`).

## Where it lives

| File | Role |
|---|---|
| `module/domain/tick.mjs` | Parse and resolve ◈ expressions to integer turn counts |
| `module/domain/war-rules.mjs` | `turnsPerRound` as a War Rule: each War holds its own ◈ |
| `module/engine/war.mjs` | `warRule("turnsPerRound")`, the one reader of a War's ◈ |
| `module/engine/scheduler.mjs` | Invoke `resolveTicks` for event handler durations and cooldown rewinding |
| `module/engine/cooldown.mjs` | Resolve ability cooldowns from ◈ expressions |
| `module/engine/effect-applier.mjs` | Compute effect expiry as an absolute tick number |
| `module/engine/channel.mjs` | Resolve combat phase duration requirements |
| `test/unit/tick.test.mjs` | Parsing, resolution, and format round-trip tests |
| `module/domain/moment.mjs` | The Moment value, `{round, tick}` |
| `module/engine/board.mjs#currentMoment` | The one reader of the live clock: the active match's Moment, or none before it starts |
| `test/unit/clock-reads.test.mjs` | The guard on direct clock reads, and the one expiry comparison |

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

`turnsPerRound` is a **War Rule** (2026-10-18): each War holds its own (`MatchData.turnsPerRound`, built from `module/domain/war-rules.mjs`), so two Wars on two scenes, played at once, can run at 3 and at 8 Turns a Round. The world setting of the same key only seeds a new War in the setup wizard. Every reader asks `warRule("turnsPerRound")` (`module/engine/war.mjs`), which reads the War of the scene the client is looking at. It is read at runtime by:

- **Scheduler** (`module/engine/scheduler.mjs:19`): Duration gates on turn-end and round-end event handlers (`module/engine/scheduler.mjs:372`, `module/engine/scheduler.mjs:394`).
- **Cooldown flow** (`module/engine/cooldown.mjs:18`): Branch-selected cooldowns and conditional bonus cooldowns are resolved against the world setting (`module/engine/cooldown.mjs:104`, `module/engine/cooldown.mjs:115`, `module/engine/cooldown.mjs:135`).
- **Shared clocks** (`module/engine/scheduler.mjs#advanceCooldowns`, #209 reading 2): a clock a linked group shares by name — the Dioscuri's Noble Phantasm — ticks at ONE rate for every copy, evaluated for a unit holding the effects of both twins, so NP Regen, NP Lag, NP Lock or Stop on either one moves both copies (Ch. 17).
- **Effect applier** (`module/engine/effect-applier.mjs`): Authored expiry becomes an absolute tick number by adding the resolved turn count to the current tick.
- **Combat phases** (`module/engine/channel.mjs`): Required tick counts for phase boundaries.

The `ticks` wrapper function parses and resolves in one call (`module/domain/tick.mjs:249-251`).

### A boundary reads the Moment that ended

Foundry advances `combat.round` before the end-of-Round sequence runs, and the system advances `globalTurn` partway through it (`engine/scheduler-hooks.mjs#onTurnChange`). So anything that reads the live clock while a Turn or a Round is ending reads the NEXT one: Home Base healed a Master who had fought in it, because its Round 9 record read as stale against Round 10 (#199), and the end of Round 9 was filed in the game log under Round 10. A boundary therefore names its Moment and hands it down:

- **The Board and the Unit view.** `currentBoard({moment})` projects every Unit at that Moment — Turn and Round Records alike — and takes the board's `round`, `tick`, `tickForTurnState` and `seed` from it; `unitSnapshot(actor, token, {moment})` the same for one Unit. With none named they read `currentMoment()`. The scheduler's `boardFor` names the ended Moment for the end half and the new one for the start half.
- **The writes.** `applyIntents(intents, {moment})` files its log entries at the Moment named (`engine/game-log.mjs#record`); the scheduler passes the ended Moment for every write of the end half.
- **Expiry.** One comparison, `domain/tick.mjs#expiryReached`, which `test/unit/clock-reads.test.mjs` keeps the only one.

`clock-reads.test.mjs` also counts the lines outside `engine/board.mjs` that read the clock themselves, and the number may only go down: a new reader takes its caller's Moment, or `currentMoment()` when it truly means "now". The Unit view now also passes the world's `turnsPerRound` to the projection; it never had, so a ◈ lock or sustainability on a projected Unit was counted at three Turns a Round in every world.

A Round's end still ends **fields** at the start of the expiry Tick and **effects** at its end (`expireFields(nextTick)` beside `expireEffects(tick)`); whether the rulebook means that is an open question below.

**No boundary lost to a reload (#230).** `ready` migrates the world before it binds the engine's listeners, and that
takes seconds. The Turn and Round hooks are bound before it (`Scheduler.attachBoundaries`) and wait for the engine
(`engine/engine-ready.mjs#whenEngineReady`, resolved by `attachEngineListeners`): a Turn changed in those seconds runs
its boundary late, never not at all, and `globalTurn` cannot stand still under a faction change (§46.4-JY).

## Invariants & edge cases

1. **◈ expressions resolve correctly in all world variants** without re-authoring. The test suite verifies this across 3, 8, and 15 turns per round (`test/unit/tick.test.mjs:53-67`).

2. **Fractions always floor except where the source says otherwise.** The exception table holds the 3×3 deviations and makes them visible (`module/domain/tick.mjs:29-33`).

3. **`resolveTicks(null)` returns 0**, which is a legitimate answer for *"this turn"* — it has no duration to count down (`module/domain/tick.mjs:215`). Code comments read: *"Expires at the end of the current turn — zero remaining turns."* (`module/domain/tick.mjs:221-222`).

4. **Negative fractional adjustments never go below zero.** A cooldown reduction of 2/3 on a 0◈ base is clamped to 0 (`module/domain/tick.mjs:233`).

5. **`until<event>` and `uses` are not time-limited.** Both resolve to `INFINITE` and are removed by a trigger (an event or consumption) rather than by the scheduler's countdown. Comments state: *"Neither counts down, so neither can be given a turn count."* (`module/domain/tick.mjs:226-227`).

6. **A bare ◈ is strictly parsed.** Invalid input throws a `RangeError` naming the expected forms, so typos are caught at content build time rather than at runtime (`module/domain/tick.mjs:121-124`).

7. **The ◈ is locked once its War starts.** Changing a War's `turnsPerRound` after it has started is refused, because it would invalidate every stored absolute tick on that War's board (`locked` in `module/domain/war-rules.mjs`, refused by `module/engine/war.mjs#setWarRules`). A world default may change at any time: it changes no War in play.

## Traps and anti-patterns

**Leaving a table's gaps to fall through to a generic rule.** `TICK_OVERRIDES` covers only the
three published rulesets, and `fractionTicks` fell through to plain `Math.floor` for anything else
— but the table exists specifically because a rounding rule can be *wrong* (its own `3 → "1/2"` cell
overrides `floor` for exactly that reason), so falling back to the rule the table was written to
override was backwards. Worse, `turnsPerRound` accepted any integer ≥ 2 with no `choices`, so an
uncovered value was one GM setting away — measured live, `1/3◈` at `turnsPerRound: 2` resolved to
**0 turns**, not a short duration but no duration at all
(`packs/_source/abilities/semiramis-familiar-doves.yml:22` authors exactly that fraction). Filed and
fixed as [#21](https://github.com/zarex97/FGT_FVTT_v2/issues/21): the rule's controls are now constrained to
`choices: {3, 8, 15}` (`module/domain/war-rules.mjs`), and as a second, independent backstop, `fractionTicks`
floors any stated fraction to a **minimum of one tick**, never zero
(`module/domain/tick.mjs:65-73`). **A stated duration must never round away to nothing — floor it to
the smallest real duration instead of to zero.**

## Open questions

- **Does a field end a Turn before an effect with the same expiry?** `expireFields` is handed the incoming Tick and `expireEffects` the one that ended, so a field and an effect stamped with expiry E end one Turn apart: the field at the start of Turn E, the effect at its end. Effects and terrain were reconciled in #161; no ruling covers fields. Left as it is until the rulebook says ([#200](https://github.com/zarex97/FGT_FVTT_v2/issues/200)).

- **Confirmed live.** Absolute expiry is `currentTick + resolveTicks(...)`, stamped once and stored as an
  absolute tick rather than a countdown (`module/engine/effect-applier.mjs:255`). Verified against real
  instances in the `fgt2026` world: `critDwn` instances carry `appliedTick: 6` and `expiry: 9` — a span of
  **3**, which at `turnsPerRound: 3` is exactly `1◈`. `critDwn` declares no `defaultDuration`
  (`packs/_source/effects/crit-dwn.yml`), so that clock came from the applying ability and still lands where
  the formula says. Storing the absolute tick is what makes Stop's clock freeze and a mid-match ◈ change safe.


- **U+2212 minus sign caught in the wild.** The tick parser accepts only ASCII hyphen (`-`), not U+2212 MINUS SIGN (−). The test `tick-literals.test.mjs` was written specifically to catch this mutation, after an `engine/copy.mjs` cooldown expression written with the Unicode character threw, was caught by `cooldownFor`, and left every copy with no cooldown at all (`test/unit/tick-literals.test.mjs:1-14`).

**Every authored span parses** (#195). The `Raikou` buff's `CooldownDelta` carried `"-⅓◈"`, which `parseTick` refuses: it threw inside the live Damage Step, the Process never saved, and each retry of the reaction applied the hit again. The sign belongs to the action (`CooldownDelta` subtracts), never to the span. `test/unit/content-ticks.test.mjs` parses every `ticks`, `duration` and cooldown span in `packs/_source`, and `fireDamageDealt` reports a handler that throws instead of losing the Process.

### A Master Essence moves the NP gate (#241)

`np-gate.mjs#essenceShift` reads the Unit's own `NpGateShift` contributions, which its copy of its Master's Essence
carries (Kaleidoscope 4, Imaginary Number 3, Leyline 2, Harvest 1), the largest of several. The gate may reach Round 0
(reading 10): it opens from the first Round, where Round 1's no-Attack rule still bars an NP that Attacks. A gate the
ability states itself is not moved.
