# 19 — The action economy and the turn budget

## What it is

A **turn belongs to one faction, and the faction acts as a unit.** One turn allows up to four Servants and three Masters to move, up to two Servants to attack, and any number of Masters to attack. The **turn budget** enforces these limits and also prevents action by holding effects and compels action by enforcing secondary goals at turn end.

Three rules compose the budget and are easy to conflate:

1. **The faction budget** — four independent pools (`module/rules/budget.mjs:26-31`). The maxima are fixed: `servantMove` = 4, `masterMove` = 3, `servantAttack` = 2, `masterAttack` = Infinity.

2. **The per-unit limit** — a unit may move once and attack once (`module/rules/budget.mjs:17-18`), whatever the pools allow. A unit that has attacked may move only in specific cases: Riding gives a second segment, and a grant named `doubleMove` overrides the block.

3. **The unit-counting rule** — the budget counts *units*, not actions (`module/rules/budget.mjs:19-22`). A Servant that moves and then uses an Active Skill has consumed **one** move slot, not two. Attacks are the sole exception: they draw from `servantAttack` in addition to the unit being counted.

Prevention and compulsion run separately. A unit whose turn is blocked by an effect (stun, stop, silence, etc.) never gets to spend budget. A unit unmet by a compulsion at turn end (Berserk, Decoy, Hatred) blocks the End Turn button.

## Where it lives

| File | Role |
|---|---|
| `module/rules/budget.mjs` | Four pools, per-unit limits, prevention, and compulsion — pure arithmetic |
| `module/engine/budget.mjs` | Budget storage (Combat flag), read/write, and affordance checks for the UI |
| `module/rules/actions.mjs` | UNIT_ACTIONS registry — what a selected unit may DO, as data |
| `module/rules/stance.mjs` | Stance declaration windows and transitions (Achilles' Mounted/Dismounted state) |
| `module/apps/hud/turn-panel.mjs` | Budget pips, compulsion warnings, and the End Turn gate |
| `module/rules/linked-group.mjs` | Twin mechanics: unitWeight (0.5 per member) and shared pools |

## How it works

### The four pools and allocation

The budget lives on a single flag of the Combat document, keyed by faction (`module/engine/budget.mjs:19-20`). It is reset at the start of each faction's turn, not at the end — a budget the player can see after their turn is the one they want to inspect (`module/engine/budget.mjs:98-100`).

Each pool tracks `usedHalves`, `maxHalves`, and the displayed `used` and `max` (`module/rules/budget.mjs:116-121`). Pools are stored in halves, not floats, to avoid floating-point accumulation when a linked pair (twins) splits one slot as 0.5 + 0.5 (`module/rules/budget.mjs:111-113`). At the boundary, an odd result is exact: at 3.5 of 4, a twin may still move (7 + 1 ≤ 8) and a whole Servant may not (7 + 2 > 8) (`module/engine/budget.mjs:141-142`).

An action routes to its pool by action kind and unit type (`module/rules/budget.mjs:138-170`). Attack, NP, Spell, Riding Attack, and Mark all draw from the attack pool. Move, Gather, and Active Skill all draw from the move pool — `skill` draws from move, not attack, by decision D18.2 (`module/rules/budget.mjs:163-166`).

### Per-unit limits

Each unit's Turn Record carries `moved`, `attacked`, and `usedRidingAttack` flags (`module/rules/budget.mjs:244-265`). A unit that has attacked cannot move again, except under Riding's grant or `doubleMove` (`module/rules/budget.mjs:258-259`). Riding Attack is terminal: once used, the unit's turn ends (`module/rules/budget.mjs:263-265`).

The record carried a fourth flag, `mayMoveAgain`, from the day Riding was written. Three sites wrote it — the movement hook recomputed it after every move, the Riding Attack path cleared it, the turn boundary blanked it — and **nothing ever read it**. Riding's second segment is decided by `GRANTS.doubleMove` and `hasRiding` in `module/rules/movement.mjs:63,94` and by the gate at `module/rules/budget.mjs:258`, none of which consult the flag. It has been deleted. **A per-Turn flag with writers and no readers is indistinguishable from a working feature**, which is the same shape as a reader with no writer ([Ch. 44](44-testing.md)) seen from the other end, and neither the schema nor the projection can tell you which you have.

Movement is measured separately: `segmentCheck` compares the unit's remaining movement allowance against remaining MOV (`module/apps/hud/turn-panel.mjs:68`).

**There is one answer to "how far can it still move", and it is `rules/movement.mjs#remainingMovement`.** There were four. Only that one went through `effectiveMov`, which halves MOV under Slow and then applies the terrain delta; the other three subtracted `movedPanels` from a raw `mov`, so a Slowed Unit was credited with twice the movement it had. `rules/platforms.mjs` carried its own copy with a comment explaining that importing `movement.mjs` would close an import cycle — true of that file, and reproduced at two sites where it was not true of anything. `jumpVerdict` and `jumpLandings` receive the allowance now rather than computing it, so the Jump is measured against the same number that would carry the Unit. `rules/budget.mjs#movementRemaining` was a fourth copy with no caller at all, exercised only by its own test, and is deleted. **Where a module cannot reach the authority, the fix is to accept the value, not to restate the arithmetic** — the cycle was never the obstacle; computing instead of receiving was.

### Exemptions

Platforms act once per turn free (`module/rules/budget.mjs:243-249`). Summons are exempt from pools entirely unless they opt into counting via `countsTowardBudget: true` (`module/rules/budget.mjs:147`). Units marked `exemptFromBudget` are also free (`module/rules/budget.mjs:139`). All three still obey their per-unit limits where applicable.

Masters have an unlimited attack pool but are capped at one attack per turn by the per-unit limit (`module/rules/budget.mjs:276-279`).

### Linked units (twins)

A linked pair counts as one unit for move slots, each member spending 0.5 halves (`module/rules/budget.mjs:286`). *"Counts as both Castor and Pollux's Attack for the Turn"* — if a joint attack is declared, both twins are marked as having attacked and their combined weight (1.0 halves) is deducted once from the attack pool (`module/rules/budget.mjs:314-327`).

### Prevention: effects that stop action

Held effects in PREVENT_ALL block every action (`module/rules/budget.mjs:34-36`): stun, stop, freeze, petrify, sleep, nightmare, coma, webbed, crystalfreeze. The PREVENTS table lists action kinds each remaining effect blocks — immobilize prevents move; disable prevents everything but move; seal prevents attack/skill/np; silence prevents spell; skillSeal prevents skill and spell; npSeal prevents np only (`module/rules/budget.mjs:39-52`). Suppressions (like NP Seal from Innocent World) are checked alongside held effects (`module/rules/budget.mjs:204-207`).

`preventedBy` is consulted first, before budget is spent, because a prevented action costs nothing (`module/rules/budget.mjs:221-223`).

### Compulsion: effects that force action

At turn end, the engine checks for unmet compulsions over the whole faction (`module/rules/budget.mjs:368-417`). Berserk requires Move and Attack if able, or (if multiple units exist and the player attacked at all) this unit must be one of the attackers (`module/rules/budget.mjs:389-406`). Decoy and Hatred require attack if the player attacked with anyone (`module/rules/budget.mjs:409-414`). A unit already defeated, prevented from acting, or without `canAct: true` is excused (`module/rules/budget.mjs:385-387`).

The HUD shows unmet compulsions immediately, even mid-turn, so the player can plan around them (`module/apps/hud/turn-panel.mjs:14-16`).

### Stance declaration

Setting facing is free and does not cost a budget slot: its action entry declares `kind: null`, so it bills no ActionKind at all and cannot end the turn (`module/rules/actions.mjs:196-202`). Achilles alone carries a stanceSpec with Mounted/Dismounted states and transition windows (`module/rules/stance.mjs:38-40`). The declaration window — when the unit's action is chosen — permits switching between any two states. Once the unit has acted, only transition rules fire (`module/rules/stance.mjs:81-99`). Achilles is forced Dismounted when it is not his turn (`module/rules/stance.mjs:118`).

## Invariants & edge cases

1. **Budget reads/writes go through the GM.** A player owns their Servants but not the Combat document, so budget writes are proxied to the GM (`module/engine/budget.mjs:163-169`).

2. **Charmed units spend from the charmer's faction budget.** A Charm moves a unit into the charmer's `currentUnits` and its budget is the charmer's pool, not its owner's — the owner's pool is not reset during another faction's turn (`module/engine/budget.mjs:53-69`).

3. **A new ActionKind needs two data tables plus an engine caller.** The registry at `UNIT_ACTIONS` is a drift test against `ACTION_KINDS` and `ACTION_EXEMPT_KINDS`. Three actions shipped with complete engines and no affordance (mark, gather, ridingAttack) because the registry was missing (`module/rules/actions.mjs:8-19`).

4. **The half-pool hint appears only in the HUD.** The display logic names CSS classes "full", "half", and "empty", which the view understands; the budget module is pure and returns numeric pips (`module/engine/budget.mjs:137-147`).

5. **Facing costs no budget slot.** Ch. 34 is explicit: the Facing button must not end the turn (`module/rules/actions.mjs:202`).

## Open questions

- **Resolved: the boundary is exact by representation, not by careful arithmetic.** Pools are stored
  as **integer halves** -- `usedHalves`, and `maxHalves: max * 2` (`module/rules/budget.mjs:111-118`)
  -- and the file says why: *"Ch. 45 names floating-point accumulation as the risk of a 0.5-weight
  unit; halves remove it rather than manage it."* So 3.5 of 4 is seven halves of eight: a twin costs
  one half and fits, a whole Servant costs two and does not. Nothing can drift, and `Infinity * 2`
  stays `Infinity`, so an unlimited pool survives the doubling.

- **Still open; it needs a live charm across two factions.** `reset` fires at faction-turn-start,
  and a charmed unit acts on the charmer's turn from the charmer's pool -- so the question is whether
  the reset that fires for the charmer's faction reaches a unit whose own faction is different. The
  path is consistent by reading, but settling it requires an actual cross-faction charm in a running
  match, which this world does not contain.

- **Two sources of compulsion, one not applied.** Held effects (Berserk, Decoy) are checked in `unmetCompulsions`. Suppressions (like NP Seal from Innocent World) are checked in `preventedBy` so they stop actions immediately. Positional compulsions written by `rules/compulsion.mjs` are read but no fixture applies one; Hatred (Penthesilea) is annotated as a field-sourced compulsion, not as a held effect (`module/rules/budget.mjs:377-383`). It is correct in principle but never exercised in the test suite.
