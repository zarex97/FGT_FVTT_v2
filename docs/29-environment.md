# 29 — Environment: day/night, Home Base and the Holy Grail

## What it is

The environment holds three systems that shape the board itself rather than any unit — the day/night cycle, each faction's Home Base zone, and the Holy Grail victory condition. Together with terrain and ZON (the Effective Servant Zone), they are facts about the *field* rather than about any unit, so a unit examined alone can never know them (`module/rules/environment.mjs:8-12`).

**Day/Night** is a pure function of the round number and an opening coin flip. Each round alternates, with no stored state to drift and no way a reconnect can lose the phase.

**Home Base** grants five effects: damage reduction, attack amplification, end-of-round healing, three-round debuff cure, and acts as an anchor for `CS: Escape` and the Grail's exclusion zone. It is also a membership boundary — a unit must stand in its own base to receive any of them.

**The Holy Grail** is the second victory condition. A certain number of Servants must be defeated for it to materialize on a random panel (excluding Home Bases). A unit then holds it for one full round at Chebyshev 1 to claim victory, resetting any contender if an enemy enters the Grail Area (Chebyshev 2).

**ZON** — the Effective Servant Zone — is a Chebyshev disc around a Master. A Servant outside it takes a fixed 5d10 damage penalty and may not use Noble Phantasms. It is a property of the Master–Servant **pair**, not of either unit: one Master with three Servants has three different radii, one per Servant's class.

## Where it lives

| File | Role |
|---|---|
| `module/rules/environment.mjs` | Day/Night, Home Base, Holy Grail, Civilians |
| `module/rules/home-base.mjs` | Home Base zone placement by war shape |
| `module/rules/difficulty.mjs` | Difficulty levels and what they remove |
| `module/rules/zon.mjs` | ZON radius calculation and Servant zone status |
| `module/engine/board.mjs` | Board projection — grail state, phase |
| `module/engine/scheduler-hooks.mjs` | Grail contest and materialization per round |
| `module/engine/io.mjs` | Writing Grail counter and position to the match |

## How it works

### The Day/Night cycle

The phase is a property of the round. *"When the game starts, Flip a Coin. If Heads, the first Round is 'Day'. The next Round will be 'Night' and so on."* One flip, at the start — so the phase is a **pure function of the round number**, with no stored alternation to drift and nothing a reconnect can lose (`module/rules/environment.mjs:35-38`).

Individual panels may override the round's phase through terrain: *"Applies the 'Sol' buff to herself ... The 5x5 panel area around Quetz is 'Day', even if it is during a Night Round."* Indoors has priority — *"there is no Day or Night when Indoors"* — because it is an absence rather than a value and must beat both overrides (`module/rules/environment.mjs:68-74`).

A Dark unit takes symmetric modifiers: *"During a Day Round, all damage received by Units with the 'Dark' Attribute is increased by 25% including NP, while all damage dealt ... is reduced by 25%. Vice versa during a Night Round."* The phrase *Including NP* is load-bearing — an `npValue` here would silently halve it, which is the difference between the rule as written and a rule that looks similar (`module/rules/environment.mjs:93-102`).

### Home Base zones and effects

Home Base panels are placed by war shape. For a Great Holy Grail War, the top 3 rows belong to one faction and the bottom 3 to the other; for a Holy Grail War, the perimeter band is divided into N contiguous blocks, one per faction (`module/rules/home-base.mjs:98-134`). The setup wizard creates Region objects with a `homeBase` behavior pinning each base to a faction (`module/engine/war-setup.mjs`).

A Servant also counts an allied platform as its Home Base if `countsAsHomeBase` is true — for Semiramis, whose Hanging Gardens move with her. Because the base moves, it cannot be a static Region; standing on the platform is the membership test (`module/rules/environment.mjs:139-142`). A field may be a Home Base for exactly two units by role — typically the owner and their Master — because *"The Complex functions as a second Home Base for Ozymandias and his Master only"* (`module/rules/environment.mjs:158-169`).

Five effects depend on Home Base membership:

1. **E3** — "All damage taken by a Unit in its Home Base is reduced by 10% including NP" (`module/rules/environment.mjs:206-208`).
2. **E4** — *"if both Units have to be in the Home Base"* — when both attacker and defender are inside, damage dealt is increased by 20%; if NP, 10% (`module/rules/environment.mjs:210-216`).
3. **E1** — At round end, 100 Health and +1 Agility heal, unless the unit fought combat here (`module/rules/environment.mjs:248-252`).
4. **E2** — Three consecutive rounds in base cure every removable debuff (`module/rules/environment.mjs:254-261`). *Removable* and *debuff* are both real conditions: the sweep skips an instance that is `unremovable` and anything whose `polarity` is not `debuff`. Both are read off the **projected** effect instance, and neither was projected until 2026-09-18 — so the cure took every effect a resident carried, buffs and unremovable statuses included (§46.4-BC). `rules/removal.mjs` and `rules/effect-flow.mjs` ask the same two questions of the same projection.
5. **E5** — Territory Creation's damage bonus applies *"even to attacks out of the base"*, keyed to the owner's own panel, not the target's (`module/rules/environment.mjs:590-593`).

### The Holy Grail

The Grail starts unmaterialized with a `threshold` (default 9) and a `defeatedCount`. When a Servant is defeated or disappears, the count advances; Erase does not count (`module/rules/environment.mjs:298-304`). Once `defeatedCount >= threshold`, the Grail materializes. On the next round, a random panel is chosen from all non-Home-Base panels (`module/rules/environment.mjs:325-340`). A unit standing Chebyshev 1 away claims it after one full round held unopposed (`module/rules/environment.mjs:358-381`). An enemy anywhere in Chebyshev 2 (the Grail Area) resets every contender — turning a footrace into a standoff when two factions are present.

The Grail's destruction is probabilistic: *"The chance is X%, where X = the amount of damage dealt by the NP divided by 20."* A 2,000-damage NP is a guaranteed loss for everyone (`module/rules/environment.mjs:394-396`).

The board projection carries the grail object with `threshold, defeatedCount, materialized, destroyed, position, contest` fields, read from the combat's MatchData (`module/engine/board.mjs:358-365`). At round end, `advanceGrail` rolls for a position if needed, advances the contest, and checks for victory (`module/engine/scheduler-hooks.mjs:466-502`).

### Difficulty levels

Beginner removes both damage modifiers (the `5d10` Attack+/Attack−) and Luck Checks. Intermediate removes only Luck Checks. Expert removes nothing. Lunatic removes nothing but grants a 2-Civilian spawn invariant (`module/rules/difficulty.mjs:22-26`). An unknown level reads as **Expert**, not Beginner, so a corrupt setting fails towards the full rules rather than silently switching two of them off (`module/rules/difficulty.mjs:12-14`).

### ZON — the Effective Servant Zone

ZON is the Chebyshev radius around a Master where a Servant retains its damage and Noble Phantasm. A Servant outside it takes a fixed −5d10 damage penalty and may not use NP; Skills, Spells, movement and defence are untouched (`module/rules/zon.mjs:12-15`).

The radius is: base (by class) + max(class bonus, Independent Action) + Mad Enhancement (stacks) + High Rank Master bonus (stacks), or the Master's stated ZON, whichever is larger (`module/rules/zon.mjs:66-121`). The base is 2 for most classes, 3 for Caster. Assassin and Caster receive a +2 bonus that does not stack with Independent Action. A Servant with no Master, an off-board Master, or the `zonExempt` flag (Semiramis on the Hanging Gardens) has no ZON penalty (`module/rules/zon.mjs:135-157`).

`annotateZon` runs once per board snapshot rather than per query, storing each unit's ZON status and whether it is outside (`module/rules/zon.mjs:189-216`). `masterDistance` holds the Chebyshev distance from Servant to Master, independent of the ZON question, for predicates like Raikou's Mad Enhancement that key on proximity alone (`module/rules/zon.mjs:210-213`).

## Invariants & edge cases

1. **Day/Night alternates by round number only.** No stored phase, no flag, no state to drift (`module/rules/environment.mjs:35-38`). The round is the source of truth.

2. **Indoors suppresses Day/Night overrides.** A unit in an Indoor panel receives neither its Day+Night modifiers nor terrain overrides (`module/rules/environment.mjs:70`).

3. **A panel-local override beats the round's phase.** Quetz's Sol buff makes a 5×5 area Day regardless of the round, and Ozymandias's Pyramid Drop can do the same (`module/rules/environment.mjs:71-72`).

4. **Home Base is faction-scoped for regions, unit-scoped for fields.** The Hanging Gardens belongs to Semiramis's faction; the Complex belongs to Ozymandias and their Master only (`module/rules/environment.mjs:116-117`, `module/rules/environment.mjs:163-166`).

5. **The Grail excludes Home Bases.** It cannot materialize inside any faction's base (`module/rules/environment.mjs:310-330`). Every zone is excluded, not only the enemy's.

6. **Grail claimants reset on ANY faction in the Area.** Two adjacent units from rival factions become a standoff, neither advancing (`module/rules/environment.mjs:371-378`).

7. **ZON is a pair property, not a unit property.** One Master with three Servants has three different zones (`module/rules/zon.mjs:8-10`). The Dioscuri test is `any`, not `all` — one partner inside resets the penalty for both (`module/rules/zon.mjs:149-156`).

8. **Dark modifiers apply to both attack and defence.** A Dark unit struck during the Day takes +25% and deals −25%, symmetrically (`module/rules/environment.mjs:99-101`).

## Traps and anti-patterns

**Grail position materialized but never written.** `MatchData.grailPosition` has been declared and read since the schema was written and **written by nothing**, so `grailContest` short-circuited on `!state.position` for the whole of every match and the Grail could not be obtained (`module/rules/environment.mjs:313-317`). The blocker was the clause itself: a board with no home bases cannot evaluate "excluding Home Bases", and until the setup wizard existed nothing had ever created one. **Call `worldIO().setGrailPosition(panel)` whenever the Grail materializes, and roll for a panel outside Home Bases** (`module/engine/scheduler-hooks.mjs:481`).

**Grail counter incremented nowhere.** `grailCounter` sat on `MatchData` since it was declared, with nothing incrementing it, which meant the Grail could never appear (`module/engine/scheduler-hooks.mjs:244`). Registering defeats is a layer-2 function (`registerDefeat`); writing the result is a layer-3 job. **Create `countTowardsGrail` in the write layer and call it when a unit is defeated, passing the cause** (`module/engine/io.mjs:1182-1205`).

**Difficulty setting consulted by nothing.** The `fgt.difficulty` control was registered but never read by any rule, so changing it silently had no effect (`module/engine/board.mjs:357`). **Read the setting at the board level and pass it to every rule that consumes it**, keyed on the level names ("beginner", "intermediate", "expert", "lunatic") (`module/rules/difficulty.mjs:33-44`, `module/engine/attack.mjs:2430`, `module/rules/damage/pipeline.mjs:302`).

**The war's Region kept in two places, written in one.** A war fought in no Region is a legitimate war, and it is the case the two records cannot agree on: the match stores `null`, `currentWarRegion()` is `match || setting`, and `null` is falsy — so it falls through to the world setting, which `commitSummon` has made sticky since it was written. The wizard wrote only the match, so a neutral war set up after a Greece one played on Greece ground: every Servant a rank up on every parameter, +10 Base Attack per step, and an END step baked into the rolled Max Health for good, with the wizard's own record saying the Region was none (Ch. 46 §46.4-AO). **`commitWar` writes both, before anything is summoned** — a precedence fix alone would not have done, because `prepareSummon` reads the setting too and would have kept granting the wrong Ranks while the board reported the right ones (`module/engine/war-setup.mjs`).

**Semiramis's Hanging Gardens not counted as Home Base.** `HomeBaseBehavior.isSecondary` was declared for this clause and nothing ever created such a Region, so the clause did nothing. **Instead, check `unit.platformId` against platforms where `countsAsHomeBase` is true** — because the base moves, it cannot be a static Region, and standing on the platform is the membership test (`module/rules/environment.mjs:140`).

## Open questions

- **Resolved: there is nothing to survive, because the phase is derived rather than cached.**
  `phase(round, startedAtDay)` is a pure two-line function of the Round number and one boolean
  (`module/rules/environment.mjs:35-38`). Verified live across Rounds 1-5: it alternates
  day/night/day/night from a day start and the mirror from a night start, and repeated calls agree.
  A reconnecting client recomputes it from the Round it already has, so no state crosses the wire and
  none can be lost. (The match also stores a `phase` field; the derivation is what makes it
  reconstructible if that field is ever absent.)

- **What happens to Home Base E1 and E2 when a unit moves in?** A unit that enters its base at the start of a round should it immediately reset `consecutiveRounds` to 1, or accumulate? The tracking is `unit.homeBase.consecutiveRounds`, but the reset logic is unwritten.

- **Confirmed: the two distances are real and different.** `grailContest` filters twice --
  `inArea` at `chebyshev(u.panel, state.position) <= GRAIL_AREA` and `adjacent` at `<= 1`
  (`module/rules/environment.mjs:363-364`) -- and `GRAIL_AREA` is the constant `2`
  (`module/rules/environment.mjs:272`). So a claimant must be *next to* the Grail at Chebyshev 1
  while a blocker need only be *within the Grail Area* at Chebyshev 2, exactly as the two clauses
  read. They are not the same test and the code does not treat them as one.
