# 25 — Turn order, the scheduler and round boundaries

## What it is

The scheduler runs the game's clock. A **match** is a sequence of **Rounds**, each comprising a fixed number of **Turns** (the ◈ value from `module/settings.mjs:23`). On each turn boundary, the active unit's temporary effects end or tick forward, handlers listening to `turnEnd` or `roundEnd` fire to charge abilities and resolve standing rules, and the **next faction** in turn order is elected.

Turn order is **rolled per Round**, not once at setup (`module/documents/combat.mjs:126-128`). Ties are re-rolled among the tied factions only, for the contested positions only. The GM always takes the last slot and does not roll. A faction may **delay** its own turn to reorder itself within the pending queue without losing its turn entirely (`module/engine/turn-order.mjs:63-81`).

**Writing the order is not applying it.** `system.turnOrder` is the stored order and `combat.turns` is the order actually played; Foundry derives the second from the first in `setupTurns`, which it calls for `round`, `turn` and `combatants` changes and **not** for a change to `system`. `FGTCombat#_onUpdate` re-derives the turns when `system.turnOrder` changes **and** `turn` is 0 — every client, top of the Round. Until 2026-09-18 nothing re-derived them at all and each Round was played in the order rolled for the Round before it (§46.4-BB). The `turn === 0` condition is load-bearing: `turn` is an index, so re-sorting mid-Round moves whoever sits at it and hands the turn to another faction with no turn-change event. `delayFaction` and `markTurnTaken` therefore write their recomputed order for the bookkeeping that reads it and do not touch the played order, which is why a Delay does not reorder the Round it is declared in (#82).

Two **boundary scales** — turn and round — fire different sequences and must not double-run. Both wake every client at the same moment. Only the **active GM client** runs the sequences, decided by a per-boundary **election** that uses random tokens and a settle delay to avoid a write race (`module/rules/schedule-claim.mjs:15-69`, `module/engine/scheduler-hooks.mjs:395-413`).

## Where it lives

| File | Role |
|---|---|
| `module/engine/scheduler.mjs` | Four boundary sequences (endTurn, beginTurn, endRound, beginRound) and event firing |
| `module/engine/scheduler-hooks.mjs` | Binding sequences to Foundry hooks; election and settler |
| `module/engine/turn-order.mjs` | Turn order resolution, tie-breaking, and Delay reordering |
| `module/documents/combat.mjs` | `FGTCombat`; turn ownership and per-Round re-roll |
| `module/rules/schedule-claim.mjs` | Boundary naming and election token management |
| `module/apps/combat/tracker.mjs` | The UI — a match is a list of factions, not tokens |

## How it works

### Turn and round boundaries

When Foundry's combat advances to the next turn, it fires `combatTurnChange` after the turn has already advanced (`module/engine/scheduler-hooks.mjs:40-42`). The hook runs two sequences back-to-back: **end the turn we just left**, then **begin the one we just entered**. The boundary is named with both `round` and `turn` numbers so it cannot repeat on a later boundary (`module/rules/schedule-claim.mjs:35-38`).

Round boundaries fire similarly on `combatRound`, unfiltered but only on forward changes — rewinding is a GM correction (`module/engine/scheduler-hooks.mjs:210-214`).

### The end-of-turn sequence

`endTurn` runs ten steps (`module/engine/scheduler.mjs:56-141`):

1. Fire `turnEnd` for units of the active faction.
2. Fire `actedTurnEnd` for units that **acted** this turn (of any faction).
3. Fire `involvedTurnEnd` for units in a Combat Phase this turn (attacked or defending).
4. Fire `anyTurnEnd` for every unit in the match.
5. Advance cooldowns at each ability's own rate.
6. Tick periodic effects that trigger on `turnEnd` and `actedTurnEnd`.
7. Expire effects ending this turn.
8. Run terrain's own boundary clauses.
9. Charge multi-Servant tax (25 Health per Master with multiple Servants acted).
10. Check effect sustainability and resolve removals.

Effect expiry runs **after** the final periodic tick so an effect ending this turn still ticks once more (`module/engine/scheduler.mjs:114-115`). The `acted` state tracks which units took an action in the current phase — it is not turn-wide (`module/engine/scheduler.mjs:71-73`).

### The begin-of-turn sequence

`beginTurn` logs the boundary once and fires `turnStart` for every unit in the match (Shock can roll on anyone's turn start, not just its owner's) (`module/engine/scheduler.mjs:149-167`). It also fires `turnStart` for terrain.

It resets nothing, and neither does the turn boundary above it. The Turn Record expires by being **read**: advancing `system.globalTurn` is the whole reset ([Ch. 09](09-projection.md)). Two pieces of machinery used to pretend otherwise and both are gone. `clearTurnState` wrote a blank record to every actor of the incoming faction, once per turn, for no read-side effect — the schema said as much in its own comment — and it created a real hazard doing it: a board re-derived after the clear saw `acted: false` on every unit, which killed every `actedTurnEnd` field dispatch (`test/unit/field-acted-turn-end.test.mjs`). `beginTurn` then logged a `resetTurnState` entry per unit, naming an operation that reset nothing even before `clearTurnState` was deleted. **The `turnStart` entry is the boundary, and there is one of it.**

Between the two sequences, the global turn counter advances and the budget is reset for the incoming faction (`module/engine/scheduler-hooks.mjs:160-170`).

### The round-end sequence

`endRound` runs once per Round (`module/engine/scheduler.mjs:179-211`):

1. Tick periodics on `roundEnd` (Burn, Poison, Freeze, etc.).
2. Fire `roundEnd` event handlers.
3. Expire effects expiring on round end.
4. Apply Home Base regeneration and three-Round debuff cures.
5. Run terrain periodics on `roundEnd`.
6. Dismiss summons whose stay has ended.

The **begin-of-round sequence** increments Poison's **stage** (`module/engine/scheduler.mjs:230-235`), applying it fresh rather than at cast time, so a round it lands does not double-count.

### The claim mechanism

When a boundary fires, the active GM client claims it by writing a random token to `combat.system.scheduleClaim` under a key (e.g. `r3t7` for round 3, turn 7) (`module/rules/schedule-claim.mjs:35-38`). Both scales — turn and round — maintain separate tokens (`turnToken` and `roundToken`), so a round change (which is always also a turn change) does not block the round sequence (`module/rules/schedule-claim.mjs:77-79`). The client waits 120ms, then reads back to see if its token is still there. If it is, it won the race and runs the sequence. If not, another connection won it (`module/engine/scheduler-hooks.mjs:407-412`).

A boundary is named by **Foundry's own counters** (`round` and `turn`), not by `system.globalTurn`. If something threw between the claim and the counter advance, the claim was already written and the counter still pointed at the old boundary; every later client would read the same tick, find it already claimed, and freeze the scheduler for the life of the world (`module/rules/schedule-claim.mjs:19-29`).

## Invariants & edge cases

1. **Only the active GM client runs sequences.** Two browser tabs on one Gamemaster are two **connections**, and both pass `game.users.activeGM?.isSelf` until the token settler runs (`module/engine/scheduler-hooks.mjs:358-360`, `module/engine/scheduler-hooks.mjs:370`).

2. **Turn order is a faction list, not a token list.** A Combatant is a faction; adding tokens to the tracker does nothing useful (`module/documents/combat.mjs:26-30`). The match must be populated through `addFaction` or `syncFactions` (`module/documents/combat.mjs:34-91`).

3. **An expiring effect ticks on its last turn.** `fireEvent` gates on `handler.expiry`, comparing against the current tick, so an effect expiring at tick T still fires on tick T (`module/engine/scheduler.mjs:263-264`).

4. **Delay is applied in declaration order.** If two factions each delay by 1 past each other, they end up back where they started (what happens at the table), not in turn order (`module/engine/turn-order.mjs:97-101`).

5. **Delays survive round end only for factions that have not acted.** `carryDelaysForward` filters by the `taken` set, so a delay on a faction that just took its turn is spent (`module/engine/turn-order.mjs:149-157`).

## Traps and anti-patterns

**The round scheduler never ran because both scales shared one election token.** The turn change fires `claimBoundary` for the turn scale; a round change fires it for the round scale. Both wake on the same boundary — and with one shared `token` field, the turn's write landed last, the round's token comparison found a stranger's, and the round sequence read that it had lost. Poison, Burn, Freeze and Scald all tick only on `roundEnd` as their native trigger, so the entire round-end pass never ran (`module/rules/schedule-claim.mjs:51-60`). **Each scale now reads its own token field** (`tokenField(kind)` at `module/rules/schedule-claim.mjs:77-79`), and both proceed. `Scheduler.attach` in `module/engine/scheduler-hooks.mjs:32-37` writes both `turnToken` and `roundToken` on each boundary.

## Open questions

- **Resolved, and the chapter had it backwards: an effect ending at tick T does *not* fire on T.**
  The handler pass skips any handler whose `expiry <= ctx.tick`
  (`module/engine/scheduler.mjs:263-264`), and the comment above it states the rule and its source:
  *"an effect does not act on the Turn it ends. Enforced for `periodic:` effects since the periodic
  pass was written, and nowhere for the handlers an effect contributes -- Regen's three intervals are
  handlers, not a periodic, so it would have healed once more on its way out."* The removal sweep
  uses the mirror comparison, `expiry > ctx.tick` to skip
  (`module/engine/scheduler.mjs:1893`), so an instance whose expiry equals the current tick neither
  acts nor survives. The two halves agree, and equality means expired.
- **Does Delay ever get lost mid-Round?** `carryDelaysForward` (called once, at round end) filters out delays on factions that have acted. But if a faction delays backward (negative), then acts before its delayed tick, the delay is discarded at round end. Whether this ever happens in authored content is unknown.
- **Turn ownership on the GM slot.** The GM combatant returns `null` for faction id (`factionOfCombatant` at `module/engine/turn-order.mjs:58`), so the budget resets to an empty set and nothing happens on its turn. Is the GM slot intended to be playable, or is it purely ceremonial?
