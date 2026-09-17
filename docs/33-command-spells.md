# 33 — Command Spells

## What it is

A Command Spell is the single most consequential action a Master may take: an interrupt paid for in a rare resource that breaks a flow to impose an immediate change. The system supports an open catalogue (`module/rules/cs-registry.mjs:9`), so new commands may be added by modules — the rules state this explicitly: *"feel free to mention it and use it if the GM or majority of players approve."* The reference set holds 17 commands, ranging from utility (cooldown reduction, teleportation, debuff cure) to desperate (spending three spells to revive a defeated Servant) (`packs/_source/command-spells/`).

**Namespacing: per relationship, not per Master.** A Command Spell is tracked not in a flat counter, but **per relationship**: a Master holds two pools. The first is "own" spells usable on any contracted Servant, the original three. The second is per-Servant grants — spells that work only for the pair they were given to (`module/rules/cs-namespacing.mjs:6-20`). This distinction is load-bearing and creates genuinely different states: a Master with zero own spells and three borrowed for Servant B has Servant A Unbound (zero available) and Servant B contracted (borrowed spells still reach it), a state no flat counter can express (`module/rules/cs-namespacing.mjs:42-47`). When a Servant is stolen, its grant pool follows it; when a contract ends, the grant outlives it. Unbound is derived from `availableFor(master, servantId) === 0`, never stored as a flag, because a stored flag would need updating from four separate places — spending, granting, inheriting, and the Master dying — and the one that got missed would leave a Servant permanently Unbound with a full pool (`module/rules/cs-namespacing.mjs:36-47`).

**The spend order.** Spending takes from the per-Servant pool first (`module/engine/io.mjs:656`), because restricted pools are more valuable: they do not expire when the contract ends, and keeping the flexible own spells back is strictly better for the player. The rules project the plan rather than performing it, so the caller can show the cost before committing and the engine can turn both decrements into one write (`module/rules/cs-namespacing.mjs:50-81`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/command-spells.mjs` | Which command is usable now, its cost, and what it does as effect data |
| `module/engine/command-spells.mjs` | Offering commands to the UI, spending one and cascading its effects |
| `module/rules/cs-registry.mjs` | The catalogue: loading from documents, and lookup by ID |
| `module/rules/cs-namespacing.mjs` | Tracking pools per Servant, deriving Unbound state, planning spends |
| `module/data/item/ability.mjs` | `CommandSpellData` schema — cost, timing, requirements, effects, rules |
| `module/engine/io.mjs` | Writing the spend (updating both pools) |
| `packs/_source/command-spells/` | Authored commands: Kill Yourself, Damage Block, Survive Kill, and 14 others |

## How it works

### The catalogue and registry

Commands are items with `type: commandSpell` and a `contentId`, loaded into a Map at startup by `CommandSpellRegistry.load()` (`module/rules/cs-registry.mjs:24-47`). A document carrying no `timing` field is not a command and is silently dropped, making the same pack discriminator-safe for multiple item types. The registry is hand-kept: the schema enforces a base set of fields (`cost`, `requirements`, `timing`, `blockedWhen`, `effect`, `permanentConsequence`), but authored data is kept untyped so a module can add new effect kinds and requirement types (`module/data/item/ability.mjs:596-631`). A command that compiles, loads, and appears in the pack but declares an unknown requirement kind will be offered but refuse at every gate — the safe direction, but making the command impossible to use silently (`module/rules/command-spells.mjs:217-221`).

### Offering commands

`offerCommands({ masterId, window, context })` projects the live world into a pure rules-layer context (board state, units, tick, settings) and filters the catalogue to usable ones (`module/engine/command-spells.mjs:35-39`). A command is offered if its `timing.window` is "anyTime" or matches the caller's window, AND it passes both `requirements` and `blockedWhen` checks (`module/rules/command-spells.mjs:161-167`). An unusable command is never offered — Van Gogh's immunity is checked at offer time "so the option never appears" (`module/rules/command-spells.mjs:21-22`), and the same argument covers cost: stopping a resolution to ask a question with one answer is worse than not asking. The payload carries the cost so the UI can show it.

### Cost and requirements

The flat `cost` field is the default; `costByMasterRank` overrides it. Kill Yourself costs 1 for a High Rank Master and 2 for a Low Rank one; when every Master on the table is Rankless, all cost variants collapse to the High path (`module/rules/command-spells.mjs:53-59`). Requirements are a closed vocabulary (`REQUIREMENT_KINDS`, line 217-221): `servantInZon`, `attackIsNotNP`, `targetNotImmune`, `servantWithin`, `servantNotWithin`, `highRankMaster`, `inZone`, `notInZone`, `noOtherRevival`. An unrecognised kind returns false, not true — a command whose gate nobody implemented cannot silently become usable (`module/rules/command-spells.mjs:201-205`).

`blockedWhen` states a different kind of gate: a list of state-scoped vetoes that apply right now, not in general (`module/rules/command-spells.mjs:86-89`). Half Heal is legal most of the time but blocked `during a Damage Step that would defeat the Servant` — a fact about this moment, not about the pair. The veto checks both the state and a condition (e.g., "incoming damage >= current health"), so the same command can be open or closed depending on context.

The requirement `noOtherRevival` is unique: it checks whether a Servant would revive anyway through Battle Continuation or God Hand (`module/rules/command-spells.mjs:251-263`). Survive Kill reads the `unitDefeated` handlers from the Servant's sheet and filters for Revive actions, checking whether each ability's cooldown is still running. If any revival is available, the requirement fails — spending three spells to save a Servant who would have come back anyway is not meaningful.

### Spending and applying effects

`spendCommandSpell` validates, then pays, then applies effects, in that order (`module/engine/command-spells.mjs:63-100`). Validating before paying avoids burning a charge on a refusal. Applying after paying avoids leaving a failed write with a free command in flight. The spend writes two updates: one to `system.commandSpells` for the own pool, and one to `system.commandSpellsPerServant[servantId]` for the grant, drawing from the grant pool first (`module/engine/io.mjs:648-666`).

A spend batch contains the `spendCS` intent (amount and servant ID), a `log` intent for audit (command name, Master, Servant, cost, window, and global turn), and effects-derived intents. Effects are never world-applied during an interrupt — modifyDamage, escape, retarget, survive, and overrideValidation land on the Combat Process instead, applied by `interruptProcess` after world intents finish (`module/engine/command-spells.mjs:75-100`).

The rules layer produces effect data as plain objects (`effectsOf`, line 120-150); the engine layer turns effect data into intents (`effectIntents`, line 169-269). Effect kinds the engine understands are `statChange`, `defeat`, `cureDebuffs`, `cooldownDelta`, `suspendSkill`, and `teleport`. Effects the engine does not recognise are logged by name rather than dropped — a Command Spell that silently does nothing is the worst possible outcome for the most expensive resource in the game (`module/engine/command-spells.mjs:261-265`). `suspendSkill` and `cooldownDelta` effects that name `oneSkill` require the player to choose on the context; without one they produce a log intent and do nothing (`module/engine/command-spells.mjs:196-232`). `teleport` effects require a destination on the context for the same reason — the command does not guess a panel on the player's behalf.

### Architecture: rules vs. engine split

Command Spells follow the system's core split: the rules layer (`module/rules/command-spells.mjs`) is pure, taking snapshots and answering verdicts and effects as data (`module/rules/command-spells.mjs:1-8`). The engine layer (`module/engine/command-spells.mjs`) takes the rules layer's output and turns it into intents, writes, and Process mutations. This split makes `canSpend` and `effectsOf` testable without Foundry present (`module/rules/command-spells.mjs:5-8`). The same division that `OnEvent` actions use — rules produce data, engine produces intents — is applied here (`module/engine/command-spells.mjs:8-10`).

### The pre-existence problem

Everything downstream of a spend — the `spendCS` intent, the applier case, `io.spendCommandSpells`, and `commandSpells` on the Master schema — already existed and was reachable end to end before this feature shipped. What did not exist was anything that decided *which* command a Master may use, *when*, or *what it does*. So nothing ever constructed the intent and no Command Spell was ever spent by anybody (`module/engine/command-spells.mjs:7-10`). The fix was to write the rules layer: `costOf`, `canSpend`, `availableCommands`, and `effectsOf`. These made the offer flow possible and built intents that the engine could apply.

## Invariants & edge cases

1. **Cost can depend on Master Rank.** `costByMasterRank` pairs High and Low values; the rules layer reads `paysHighColumn(master)` and selects one (`module/rules/command-spells.mjs:53-59`). When every Master is Rankless (rank unstated), all commands follow the High path, making Kill Yourself uniformly 1 cost (`module/rules/command-spells.mjs:53-59`).

2. **Unusable commands are never offered.** A requirement that fails, a cost that is not affordable, or a `blockedWhen` state that holds produces no UI button. The filter runs `canSpend` with full context, returning `{ ok: false, reason, cost }` on any gate, so the offer knows what blocked the command (`module/engine/command-spells.mjs:35-39`).

3. **An unrecognised requirement refuses rather than passes.** `meets()` returns false for unknown `kind` values (`module/rules/command-spells.mjs:201-205`). A command whose gate nobody implemented will load, compile, and appear in the pack but refuse at every offer — the safe direction.

4. **Pools are per relationship, not per Master.** A Master's `commandSpells` (own) works on any Servant; `commandSpellsPerServant[servantId]` (grant) works only on that Servant ID. `availableFor(master, servantId)` sums both, returning the total spells that reach the pair (`module/rules/cs-namespacing.mjs:30-32`).

5. **Unbound is derived, never stored.** `isUnbound(master, servantId)` reads true when `availableFor === 0`. A stored flag would need updating from spending, granting, inheriting, and Master death — and missing one would leave a Servant permanently Unbound with a full pool (`module/rules/cs-namespacing.mjs:42-47`).

6. **Spending draws from the restricted pool first.** `spendPlan` calculates how much comes from per-Servant first, then own (`module/rules/cs-namespacing.mjs:60-81`). Borrowed spells are more valuable because they survive the contract ending; keeping own spells back is strictly better for the player.

7. **An effect with no caller choice reports rather than guesses.** `cooldownDelta` with `scope: oneSkill`, `suspendSkill`, and `teleport` all require a player choice on the context (ability ID or destination panel); without one they produce a `log` intent and do nothing (`module/engine/command-spells.mjs:196-259`).

8. **Audit logging carries Master, Servant, cost, window, and global turn.** Every spend produces a `log` intent named `commandSpell`, because Command Spells are the most argued-about resource after the match ends — the audit trail says who spent what, on whom, at which moment (`module/engine/command-spells.mjs:80-89`).

## Traps and anti-patterns

**Offering a command without checking cost at offer time.** When a Command Spell offer flow checked requirements but not cost, the UI offered "use this" buttons that led to a refusal after the fact, and a charge was wasted on a command that could not be spent. Cost is part of the gate, not a post-offer discovery. **Validate cost inside `offerCommands` before returning the button** (`module/engine/command-spells.mjs:35-39`). Fixed: `offerCommands` filters with `canSpend(...).ok`, which checks both `availableFor(master, servantId) >= cost` and every requirement and state.

**Keeping the Unbound state as a stored boolean.** The temptation is to set a flag when a Master's spells for a Servant reach zero, but the flag would need updating from four separate places: spending a spell, granting new spells, inheriting a Servant with a grant, and the Master dying. The one place that gets missed leaves a Servant permanently Unbound with a full grant pool. **Derive it from pool state at read time instead** (`module/rules/cs-namespacing.mjs:42-47`). Fixed: `isUnbound(master, servantId)` returns `availableFor(master, servantId) === 0`, which always reflects the current state and requires no flag updates anywhere.

**Treating all pools as a flat per-Master counter.** Before per-Servant grants, Command Spells were tracked as one number. A stolen Servant inheriting a grant brings its pool along (`commandSpellsPerServant[servantId]`), but there is no Master-level tracking that knows the grant is incoming — only the receiving Master's document knows. Any code reading `actor.system.commandSpells` when it needs to know "can I act on this Servant" reads the wrong number. **Always check `availableFor(master, servantId)`** (`module/rules/cs-namespacing.mjs:30-32`). Fixed: every caller that needs to know available spells now calls `availableFor`, which sums both pools atomically.

**Treating interrupt effects like world effects.** Survive Kill is an interrupt because it is decided inside the Combat Process at the moment of defeat; applying it to the world before the Process finishes would heal a unit that was never going to die, breaking the whole flow. `effectIntents` deliberately produces no intents for the interrupt kinds (`modifyDamage`, `escape`, `retarget`, `survive`, `overrideValidation`); only `interruptProcess` applies them to the Combat Process flag (`module/engine/command-spells.mjs:240-245`). Fixed: world intents and interrupt effects are separate — world intents apply first via `applyWorldIntents`, then interrupts land on the Process if present.

## Open questions

- **Still open.** `availableCommands` projects units through the board, so a world with no active
  combat has nothing to project. It is not an error path by construction, but what the offering UI
  renders in that state was not reproduced -- the live world has an active combat, and tearing it
  down to check a cosmetic case was not worth the disruption.

- **Answered: it does re-enable, because the suspension lapses at read time.** `suspendSkill` writes
  **both** halves -- `system.active = false` and `system.suspendedUntil = <tick>`
  (`module/engine/io.mjs:467`). Nothing ever clears `suspendedUntil`; instead every reader compares
  it against the clock (`tick < sys.suspendedUntil`), so the suspension simply stops being true
  (`module/rules/modes.mjs:86`, `module/rules/modes.mjs:225`). While it holds, `forcedModes` excludes
  the ability, and the comment states why: *"Bought off for a span. Switching it back on here is
  precisely what the Command Spell was spent to prevent."* Once the tick passes, that filter stops
  excluding it, and because `reconcileForcedModes` runs on **every invalidation** the mode is
  re-applied via `setMode(..., true)` as soon as its condition still holds
  (`module/engine/modes.mjs:89-95`). A *voluntarily* held mode is not restored -- only a compelled or
  rule-forced one -- which is the correct asymmetry: nothing else knows the player wanted it on.

- **Should `overridesValidation` affect anything?** Authored on commands but never read, this field names what a command can override — presumably validation rules that would normally refuse a resolve. The shape is there but the engine does not consult it (`module/engine/command-spells.mjs:244`). This is tracked for content completeness, not runtime necessity.

- **Should per-Servant grants survive a Servant's death and re-contract?** When a Servant is revived, the grant pool outlives the death (it is on the Master, not the Servant), but whether the UI should show it as available before re-forming the contract is undefined. The Master keeps the spells in `commandSpellsPerServant[servantId]` whether or not the Servant is contracted, but poolsOf() only returns pools for contracted Servants or those with grants (`module/rules/cs-namespacing.mjs:94-109`).
