# 19 — The action economy and the turn budget

## What it is

A **turn belongs to one faction, and the faction acts as a unit.** One turn allows up to four Servants and three Masters to move, up to two Servants to attack, and any number of Masters to attack. The **turn budget** enforces these limits and also prevents action by holding effects and compels action by enforcing secondary goals at turn end.

Three rules compose the budget and are easy to conflate:

1. **The faction budget** — four independent pools (`module/rules/budget.mjs:26-31`). The maxima are fixed: `servantMove` = 4, `masterMove` = 3, `servantAttack` = 2, `masterAttack` = Infinity.

2. **The per-unit limit** — a unit may move once and attack once (`module/rules/budget.mjs:17-18`), whatever the pools allow. A unit that has attacked may move only if it holds the `doubleMove` grant, which overrides the block. The grant is the only question asked: Riding authors it (permanently for the six `class-riding` bearers, Medusa, Achilles and the Normal Rider; only on the Turn of the Active, `self:effect:ridingActive`, for Pollux and Drake; not at all for Pale Rider), and so can anything else that grants it (#117).

3. **The unit-counting rule** — the budget counts *units*, not actions (`module/rules/budget.mjs:19-22`). A Servant that moves and then uses an Active Skill has consumed **one** move slot, not two. Attacks are the sole exception: they draw from `servantAttack` in addition to the unit being counted.

**Whose Turn.** An ability authored `timing: { window: ownTurn }` (*"Used during your Turn"*, 142 content files) is refused by `canUseAbility` on another faction's Turn, so the action bar's slot is dimmed with "Only during your Turn." and `useSkill` and `resolveAttack` refuse it (Ch. 17, #160). The budget itself is the acting faction's, so this is the same "whose Turn" the pools are kept by.

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

Each unit's Turn Record carries `moved`, `attacked`, and `usedRidingAttack` flags (`module/rules/budget.mjs:244-265`). **Move then Attack, or Attack then Move — never Move, Attack and Move again** unless the `doubleMove` grant allows it (ruled 2026-10-06, #189 reading 15). The Turn Record stamps `movedBeforeAttack` at the moment `attacked` turns true (`rules/snapshot.mjs#turnWrite`, the one writer every stamp goes through), and `rules/budget.mjs#mayMoveAfterAttack` is the one rule the budget and `segmentCheck` both ask. Several drags in one Move are one Move, within MOV. The engine had held every Unit in place once it Attacked, so a Unit that stood still to Attack could not walk away; a Bašmu, a Sphinx and a platform follow the same rule under their once-per-Turn cap. Riding Attack is terminal: once used, the unit's turn ends (a ride can be started from the interface since #113, so `usedRidingAttack` has a writer on a played board and `segmentCheck` and `canConsume` refuse every later Move). **The order of a ride's gates:** `performRidingAttack` asks `ridingAttackPath` and then `attackPreflight` (`module/engine/attack-preflight.mjs`: the Normal Attack ban, the budget, `canUseAbility`, the 25-Health Master order limit, the first-Round ban) BEFORE it displaces the token or stamps `moved`, `acted` and `usedRidingAttack`. `resolveAttack` calls the same function, so a refused ride changes nothing instead of leaving the token on its destination with the Turn spent and no attack made (#114). (`module/rules/budget.mjs:263-265`).

The record carried a fourth flag, `mayMoveAgain`, from the day Riding was written. Three sites wrote it — the movement hook recomputed it after every move, the Riding Attack path cleared it, the turn boundary blanked it — and **nothing ever read it**. Riding's second segment is decided by `GRANTS.doubleMove` in `module/rules/movement.mjs` and by the gate in `module/rules/budget.mjs`, none of which consult the flag. (A `hasRiding` projection, an item-name match, used to be a second question at the drag gate and the budget; it disagreed with the grant for Pollux, Drake and Pale Rider and is gone, #117.) It has been deleted. **A per-Turn flag with writers and no readers is indistinguishable from a working feature**, which is the same shape as a reader with no writer ([Ch. 44](44-testing.md)) seen from the other end, and neither the schema nor the projection can tell you which you have.

Movement is measured separately: `segmentCheck` compares the unit's remaining movement allowance against remaining MOV (`module/apps/hud/turn-panel.mjs:68`).

**There is one answer to "how far can it still move", and it is `rules/movement.mjs#remainingMovement`.** There were four. Only that one went through `effectiveMov`, which halves MOV under Slow and then applies the terrain delta; the other three subtracted `movedPanels` from a raw `mov`, so a Slowed Unit was credited with twice the movement it had. `rules/platforms.mjs` carried its own copy with a comment explaining that importing `movement.mjs` would close an import cycle — true of that file, and reproduced at two sites where it was not true of anything. `jumpVerdict` and `jumpLandings` receive the allowance now rather than computing it, so the Jump is measured against the same number that would carry the Unit. `rules/budget.mjs#movementRemaining` was a fourth copy with no caller at all, exercised only by its own test, and is deleted. **Where a module cannot reach the authority, the fix is to accept the value, not to restate the arithmetic** — the cycle was never the obstacle; computing instead of receiving was.

### Exemptions

Platforms act once per turn free (`module/rules/budget.mjs:243-249`), which needs a record to count against: `PlatformData` carries the same `turnState` as a combatant (`_shared.mjs#turnStateField`), and without it every write was pruned and the cap never held ([Ch. 46 §46.4-BQ](46-roster-re-audit.md)). Summons are exempt from pools entirely unless they opt into counting via `countsTowardBudget: true` (`module/rules/budget.mjs:147`). Units marked `exemptFromBudget` are also free (`module/rules/budget.mjs:139`). All three still obey their per-unit limits where applicable.

**An action a Noble Phantasm grants costs nothing** (ruled 2026-10-04, #180). Doomsday Come's Drag has no damage, so it is not an Attack, and it is not a Skill either. It authors `freeAction: true`: `engine/skill-use.mjs` neither asks nor charges a pool for it, so neither an Attack-side nor a Skill-side Seal refuses it, and the Turn Record gets `acted` and nothing else, so Pale Rider may still Move after it. Its only condition is the area being open; it is an `ability`, not a Noble Phantasm, so the ZON and NP Seal gates never read it. The target's Evade takes the board unit's general Evade modifiers (Innocent World's +4) and none of the kind-of-Attack bonuses. A target that fails is displaced inside, and the displacement runs field contact once, through the move hook; `dragInto` ran it a second time, and live a dragged Master got two Kagome Spirits on one panel (`test/unit/drag-contact-once.test.mjs`).

**A rider and the mount that replaces her action share one Move and one Attack a Turn** (#143, ruled 2026-10-01). *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack is replaced with Quetzalcoatlus'."* `replacesRiderAction` had one reader that ran — the damage source — so three things were wrong at once. The movement gate validated her own snapshot, and `canStopOn`'s edge-hold refused any destination off the footprint she stands on, so her drag was refused as *"the destination panel is occupied"* and the carry (`carryDrivenPlatform`) never fired; the mount kept its own free once-per-Turn Move and Attack, because a Move or an Attack stamped only the Turn Record of the unit that acted; and `targetSpecFor` read her Range where the damage reads the mount's. Now: (1) `rules/movement.mjs#moverFor` measures a driving rider as the mount — its MOV and its own effects; its obstacle rules, so the edge-hold does not hold it; her Turn State and the panel the drag starts from, which are hers — and `gateMovement` is what `onPreMove` calls, which also refuses a drag that would carry the mount's far panels off the board; her Master, who does not drive (`roles`), is still held. Two of her Riding clauses carry to the mount (ruled 2026-10-02, #65, rulings 26 and 27): her Double Move, so the drive may be split around the Attack as her own Move may, within the one MOV; and her Active's *"MOV +6 for this Turn"*, so the mount moves 7 + 6 = 13. The +6 carries because the shared `class-riding.yml` authors its `MovDelta` with `carriesToMount: true`; `moverFor` adds every such delta to the mount's MOV and nothing else, so a buff on her, or her Slow, stays on her own feet. (2) `rules/platforms.mjs#turnPartnersOf` names the unit whose Turn Record an action is also written to — the mount for a driving owner, the owner for a mount that carries its driver, nobody otherwise, and per action, because the Golden Hind replaces Drake's Normal Attack and not her Move — and the three writers stamp the same patch on both: `attack:declared` (which covers the Spells, so *"counts as Quetz's & Quetzalcoatlus' Attack"* needs no new `alsoCountsAsAttackFor` value), the move tail (`movedPanels` included) and Riding Attack. The mount's existing once-per-Turn cap then trips on the shared record, in either order, with no new refusal rule. (3) `attackRangeOf` is the mount's Range for a bare Normal Attack while she rides, and `targetSpecFor` uses it, so the preview and the resolution agree. The once-per-Turn cap that platforms and `actsOncePerTurn` summons carry sits on top of those limits: a Bašmu that has attacked cannot Move afterwards, exactly as a Servant cannot ([Ch. 46 §46.4-BK](46-roster-re-audit.md)).

Masters have an unlimited attack pool but are capped at one attack per turn by the per-unit limit (`module/rules/budget.mjs:276-279`). The pool's maximum is `Infinity`, which the Combat flag stores as `null`; `canConsume` reads `null` as unlimited, where it once compared against 0 and refused every Master's attack after the first write (§46.4-CF).

### Linked units (twins)

A linked pair counts as one unit for move slots, each member spending 0.5 halves (`module/rules/budget.mjs:286`). *"Counts as both Castor and Pollux's Attack for the Turn"* — if a joint attack is declared, both twins are marked as having attacked and their combined weight (1.0 halves) is deducted once from the attack pool (`module/rules/budget.mjs:314-327`).

### The first Round: no Attack of any kind

*"During the first Round, neither Player/Faction is allowed to Attack."* The ban reaches every action that **counts as an Attack**, which is every action billed to an Attack pool: `rules/environment.mjs#COUNTS_AS_ATTACK` (`attack`, `np`, `spell`, `ridingAttack`, `mark`), tested equal to what `poolFor` bills there so the two cannot drift. `attackForbiddenThisRound` is asked by the attack preflight and by `engine/marks.mjs#placeMark`. Before this only a declared Attack asked, so Medusa's Mark, which *"counts as her Attack for the Turn"*, was placed on Turn 1 (ruled, #188 readings 16 and 18). A Skill draws a Move slot and is never refused.

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
