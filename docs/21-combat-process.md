# 21 — The Combat Process state machine

## What it is

The **Combat Process** is an explicit state machine that resolves one attack from declaration through defeat or recovery. It is **pure and serializable**: `advance()` takes a state and an event, produces a new state, and never writes or awaits (`module/engine/combat-process.mjs:1-18`). That shape is essential because the reaction ladder spans up to five prompts across two clients, so the state must survive serialization into a chat-message flag between rungs (`module/engine/combat-process.mjs:9-12`).

The attack flow is **one process per defender** in an area attack, not one process per attack. A Noble Phantasm over seven units damages one Servant from the attacker's perspective but opens seven independent ladders — each defender reacts, evades, and contests separately (`module/engine/combat-process.mjs:185-201`).

## Where it lives

| File | Role |
|---|---|
| `module/engine/combat-process.mjs` | The state machine: states, transitions, and pure reducers |
| `module/engine/attack.mjs` | Orchestration: declaration, card rendering, advancing through prompts |
| `module/rules/miss.mjs` | Step 1.5: whether the attack misses before reaction — asked with the Attack Description against this defender, so a `Suppress` on `attack:range:lte:2` (Anastasia's Watermelon Splitting Master) can answer; it was asked with neither (Wave B) |
| `module/rules/injury.mjs` | Step 4: whether damage triggers an Agility roll |
| `module/rules/normal-attack.mjs` | Step 1: resolving which stat a Normal Attack uses |
| `module/engine/weak-point.mjs` | Step 3 (override): offering Achilles' Heel and rolling it |
| `module/engine/shield.mjs` | Step 3: barrier absorption before damage reaches the target |

## How it works

### The six steps and the ladder

The rulebook's six steps are implemented as a state machine with automatic and prompted transitions (`module/engine/combat-process.mjs:24-30`).

**Step 1 — Declaration.** The attacker offers the action, names the target, and pays the ability's cost (`module/engine/attack.mjs:93-149`). A weak-point attack is offered here: the attacker chooses whether to aim for Achilles' Heel, and choosing costs Luck if a bonus is available (`module/engine/weak-point.mjs:51-100`). The process enters `declare` and immediately advances to `missCheck` (`module/engine/combat-process.mjs:99-100`). **A field the use spends ends before any Process is declared (#189).** Pyramid Drop's `expend` phase names Ramesseum Tentyris, and *"Ramesseum Tentyris ends first, then the Pyramid Drop occurs."* The caster pass runs after the fan-out, and a Process with no reaction to wait for resolves inside the declaration: live, the Drop defeated a Master under the Complex's interior rules and hit a Sphinx that then vanished with its Process open. `declareProcesses` now calls `engine/skill-use.mjs#endExpendedFields` first, re-reads the board, and drops a defender the field took with it. **An `aftermath` is its own resolution, and reads only its own block (#136).** Xiuhcoatl's splash is a second, unconditional resolution declared beside the primary under the same group, with its own targeting, its own `damage` block and its own riders. `aftermathSpecFor` builds its attack spec from that block (`buildAttackSpec` with `aftermath: true`) and sets `areaPanels` to the panels the splash caught, and `applyDamage` reads every damage key through `damageBlockFor(ability, options, state.attack)`, which answers the aftermath's block for a splash and the primary's otherwise. It was the primary's spec with a few keys painted over it, so the splash inherited the hit's `elementFraction` (*Fire damage (half)* where the sheet says plain *Fire damage*), its `ignoresMagicResistance` (the author ruled the splash *is* affected, and only the hit on the DU is exempt) and an `areaPanels` of one panel. **It is a second resolution inside the same declaration, not a second use (#137).** `declareProcesses` takes `declaresUse` (default true); `declareAftermath` passes `false`, so the caster phases (Xiuhcoatl's `zone`) and `abilityUsed` run once, from `resolveAttack`'s own call. The splash still gets its fan-out, cards and the `attackDeclared` / `attacked` events, and before declaring its defenders `declareAftermath` runs the same `interruptedByDeclaration` + `interruptChannels` the primary path does, so a Semiramis the splash catches mid-channel has the Gardens interrupted. What it still does not do for the splash's defenders: Civilian instant kill, Jack's pre-emption and Mannanan's cancellation, which wait on the author's answer (does a Good-aligned splash spare a Civilian; do those offers reach a Unit only the splash caught). **Its riders run once, after its damage (#65).** `applyAbilityEffects` is asked twice per resolution, `beforeDamage` and then `afterDamage`, and the aftermath branch answered both: on a live board the splash rolled its 25% NP Seal twice and laid Burn before the damage it rides on. The branch now returns nothing outside `afterDamage`.

**Step 1.5 — Miss Check.** Rolled automatically, not prompted. `Blind` is the only source: 80% chance unless the attacker has `Eye of the Mind` or `Clairvoyance` (`module/rules/miss.mjs:29-89`). A miss is **terminal** — it skips reaction, Luck ladder, damage, Injury Roll, facing change, and counter (`module/engine/combat-process.mjs:103-110`). The ability's budget is still spent because the swing was declared (`module/engine/combat-process.mjs:108-109`).

**The preflight reads the aimed Unit from either key (#185).** The canvas names it `placement.unitId`, and `attackPreflight` read only `targetId`, so every `target:` requirement failed from the interface: Maria the Ripper's Method 2 was refused on a Female inside the Mist at Night. A failed requirement is worded from `FGT.Ability.Refused.<kind>`, as the sheet and the bar word it; it printed the raw kind (*"roundPhase"*).

**A pre-emptive strike is a Process like any other (#185).** Jack's Murderer of the Misty Night lets her Attack first when declared on: `offerPreemption` defers the attacker's declaration, and `runPreemption` opens her own Process. That Process goes through `runMissCheck` before its card, as every declaration does; it was advanced to `missCheck` and left there, so her strike sat with no buttons. When it finishes, the deferred attack resumes with `resume: true`, which `attackPreflight` reads to skip the budget gate: the declaration paid its budget before she struck, and asking again refused it as *"already attacked this turn"*. The Luck Check it requires by day reads her own phase (`defender.phase`), not the board's.

**Step 2 — Reaction.** The defender chooses Block, Evade, or nothing at the `react` state (`module/engine/combat-process.mjs:114`). Certain effects forbid reactions — `Accel` forbids all three, `Presence Concealment` forbids Block and Counter, and an attack's `unblockable` field forbids Block alone (`module/engine/attack.mjs:950-972`). Block does not avoid damage; it reduces it at step 3 (`module/engine/combat-process.mjs:42`).

The reaction opens a **Luck ladder** if the defender chose Evade (`module/engine/combat-process.mjs:45-62`):
- **Steps 2.1–2.2:** Evade succeeded. Attacker rolls Lucky Hit (defender loses 1 Luck). If it succeeds, defender rolls Counter-Contest (defender loses 1 Luck). Both are contested rolls with `declined` edges; declining costs 1 Luck whether or not it succeeds (`module/engine/combat-process.mjs:115-116`, `module/engine/combat-process.mjs:48-50`).
- **Steps 2.4–2.5:** Evade failed. Defender rolls Lucky Evasion (defender loses 1 Luck). If it fails, attacker rolls Counter-Contest (attacker loses 1 Luck). Again, both can be declined for 1 Luck (`module/engine/combat-process.mjs:118-119`, `module/engine/combat-process.mjs:56-62`).

Both paths terminate at **Step 2.3 — Accept or Escape.** The defender accepts the hit, or its Master spends the Escape Command Spell the card offers at this window, which moves the pair to their Home Base (`engine/command-spells.mjs#interruptsOf`). The rung's own `cs` option escaped for free and is gone (ruled 2026-10-14, §46.4-LM).

**An Evade the attack says is not rolled goes straight to damage (#191).** Quickfire's *"The enemy Unit Evades (instead of performing an Evade roll)"* advances `evadeRoll` on its own `overridden` edge (`evadeRoll:overridden → damage`), not on `fail`: there was no die, so neither Lucky Evasion nor the Accept-or-Escape Command Spell is offered. On `fail` the ladder offered both, and a passed Lucky Evasion leads to `noDamage`.

**Step 3 — Damage.** Resolved automatically, not prompted. The pipeline computes the total (`module/engine/attack.mjs:2418-2490`). A declared Heel Attack redirects to `heelResolve` instead of `damage` and rolls in place of it; a failed Heel is an evade (`module/engine/combat-process.mjs:275-300`). Before the roll, a barrier may absorb some or all of it (`module/engine/shield.mjs:50-85`). Damage riders fire only if the attack connects and is not fully negated (`module/engine/attack.mjs:2489-2510`). **A complete negation is Anti-Purge or Substitution at stage 0** (#184): the ability's riders were refused for any `negatedBy`, the event-declared ones (`ridersFire`) now for these two as well, and since #206 the ability's riders ask `ridersFire` too, so a hit Magic Resistance or Invuln negates still tries its debuffs (Þurs on Karna rolled no Shock), and neither flips the Overpower coin on a Master (Ch. 32). Akhilleus Kosmos negated Bellerophon on Achilles's Master and the coin defeated him anyway. **What an ability does to its user before its damage is paid by the first Process to strike** (`isFirstToStrike`, #184), not the first declared: defenders answer in any order, and Troias's Atk Up had landed with the last of three hits. After-damage self effects stay on the first declared. **A rider that empties a Health bar defeats (#185).** Instakill is *Health reduced to 0*, and only a phase before the damage was followed by `resolveEmptiedDefender`, the walk through the same defeat chain damage takes. Maria the Ripper's *"Then, has a 50% chance of inflicting Instakill"* is after the damage: at Range 3 it dealt 0, the Instakill landed, and Medusa sat at 0 Health, undefeated, on the board. The check now follows the after-damage riders too, and returns at once for a defender the damage already defeated.

**Step 4 — Injury Roll.** Automatic. If damage exceeded 100 and the defender survives, they lose Agility equal to the damage taken, unless `Light Wound` succeeded or the unit has the `injuryOnlyFromNP` attribute (`module/rules/injury.mjs:32-58`). Does not occur if the target was defeated (`module/rules/injury.mjs:37`).

**Step 5 — Facing.** The defender faces the attacker, unless the attack was area (`module/engine/combat-process.mjs:487-489`). Automatic, no prompt.

**Step 6 — Counter.** **What may answer one, and the server's check (#156).** An ability says it cannot be a Counter with `cannotCounter: true` (a Silent Drop route: declared on `AbilityData`, listed in `AUTHORED_ITEM_KEYS`, an editor field, read by `rules/counter.mjs#answersACounter`, which then answers `false` and so `counterOffer` and the action bar never offer it). Quetzalcoatl's three Spells each end *"Cannot be used as a Counter"* and author it. `timing.window: ownTurn` does not say it: that window is documentary, 89 of the 117 window authorings are `ownTurn`, and the author ruled that Noble Phantasms authored `ownTurn` can be Counters. `runCounter` re-checks the use gate before it spends anything: `canUseAbility` **with a `testPredicate`** (a `predicate` requirement refuses without one on purpose, so a bare `!usage.ok` refusal would refuse every predicate-gated Counter, `self:onPlatform` and `self:fieldActive` among them), read through the pure `counterRefusal(item, verdict)`: `"notACounter"` for an ability that does not answer a Counter, otherwise the gate's own reason (`"cooldown"`, `"round"`, `"prevented"`). The `declareCounter` authorizer checks the rung and the owner and nothing about the ability, so this is the only server-side gate. A refusal names its reason (`FGT.Counter.NotACounter`, `FGT.Counter.Refused`) and leaves the rung open; `FGT.Counter.MustIncludeAttacker` is now only for a placement that misses the attacker. A Normal Attack is not refused by the gate, which reads an ability-less use as a Skill. The defender may counter if they survived or evaded, the attacker is in range, and counter-specific blocks do not apply (`module/engine/combat-process.mjs:387-428`). "Counters cannot be Countered again": a bystander an area counter caught may not counter it in turn, unless the setting `fgt.counterChain` is enabled (`module/engine/combat-process.mjs:395-402`). A counter is a fresh `processState` with its own ladder, sharing only the parent's `groupId` (`module/engine/combat-process.mjs:466-480`). **A Counter is an Act** (ruled by the game's author, #107): `runCounter` stamps `acted: true` on the counterer's Turn Record, so every clause keyed on Acting — Bleed and Sap's ticks, Sikera Ušum's *"Acts then ends its Turn"* and *"any Turn it Acts"*, Mad Enhancement's drain, the multi-Servant tax — reaches a Unit that countered on an enemy's Turn. It stamps `acted` and never `attacked`, and the record carries this Turn's tick, so the counterer's own Turn is not charged. Evade and Block are outside this ruling. Being attacked is *involvement* (`involvedTurnEnd`), a different event from Acting.

**A Counter is not a reaction (#191).** `target:reaction:<x>` comes from `state.reaction`, the react rung; a Counter is declared at the `counter` rung and never changes it. `runAfterProcessPhases` adds `target:reaction:counter` itself when the history holds the `counter` rung's `counter` event, so Quickfire's after-Process refund — *"if the enemy Unit does not perform a Counter"* — is withheld after one.

### Early termination

A **miss** ends the process at step 1.5. No ladder, no damage, no response from the defender. The attack is declared spent.

A **defended dodge** (evade succeeds on every rung or Lucky Evasion succeeds) ends the process at step 2. No damage, no Injury Roll.

A **Command Spell escape** at step 2.3 ends the process. Both units leave the board; no damage is applied.

A **successful Heel Attack** is a special: the attacker gambles declaring it. If it succeeds, damage ignores all defensive buffs. If it fails, the defender evades instead (`module/engine/combat-process.mjs:67-79`).

A **Civilian an attack kills is no defender** (#189). Civilians are killed at declaration, before any Process exists; they are left out of the fan-out too, where an area attack had also given each one a Process whose card read *"0 — Negated by invulnerable-by-nature"*.

A **Structure defender answers nothing** (#188). A Structure takes no action at all (`rules/actions.mjs`), so a Master's Attack on a Bloodmark has nobody to ask. The Process records `defenderInert`, `pendingPrompt` shows no prompt for the defender's rungs, and `combat-process.mjs#inertAnswer` answers them as a player who did nothing would: *nothing* on the reaction, *accept* on the escape, *declined* on a Luck rung. Before this the ladder stopped to ask the Bloodmark to Block or Evade, and waited on it.

The process is **complete** when it reaches the `done` state (`module/engine/combat-process.mjs:368-370`).

**The `withdrawn` rung (#226).** `react:withdraw` → `withdrawn` → `done`: a defender who leaves the Attack,
by a reaction with `withdrawsFromAttack` (Battle Retreat). Terminal like a miss: no damage, no effects, no Injury,
no facing, no Counter; the attacker's Attack is still spent. Against a targeted Attack every other Process of the
declaration still at its reaction rung leaves too; against an AoE (`caughtByArea`) he alone does. A bare `withdraw`
event is refused unless the Process was marked by `withdrawFromAttack`.

**`attackPerformed`, once per Attack (#230).** Raised at the Combat Phase's end on each Unit that made an Attack in
it -- the declaration's or a Counter's -- with `unitsHit`: a Unit whose Process reached its Damage Step un-negated, a
Block included. Utopia and Excalibur cut Cooldown per Unit by it (`CooldownDelta.times`), each cut a line on the attacker's last card of
the Phase (`applyWithCooldownLines`, as the Damage Step's); Dmg Boost (Utopia) counts by
it. **Survival floors cap the damage** (`attack.mjs#survivalFloor`): CS Survive Kill and `SurviveLethal` (Avalon's
10%/5%) leave the Unit standing by taking the blow down, because a restore beside the damage lands first (§46.4-NR).

## Invariants & edge cases

**A rung is answered once.** `advanceAttack` stores the next rung only after the answer has run — a question, a roll, a write later — so for that whole time the card still shows the rung being answered. The first press of a rung with a question pending claims it in memory (`messageId`, history length, state) before anything awaits; a second press of the same rung (the GM's card and the player's both carry the button, or a reaction timeout firing while the player's answer is running) waits for the first and runs nothing. A call with no question pending — the engine resuming the Process after a Command Spell interrupt, or a declaration driving itself — is not an answer and claims nothing. Pressed live in Wave A, Kiritsugu's Return Fire was declared twice; in the arena a doubled "nothing" dealt a Normal Attack's damage twice (`test/unit/rung-pressed-twice.test.mjs`).

**A failed automatic Evade may still Block** (#193 reading 9). When an `autoEvade` fails — Trofa's 50% against a Noble Phantasm — the state carries `blockAfterAutoEvade`, and after Lucky Evasion the escape rung offers Block beside accepting: `s23_acceptOrEscape:block` → `damage`, with `reaction: block` for stage 14.

**One Counter per target after a multi-instance attack** (#195 reading 17). `counterAvailable` is false for every instance but the last (`instanceIndex < instanceCount - 1`), so Dohatsu Tenshou's five Processes offer one Counter, after the Noble Phantasm.

**A Counter is its own fan-out** (#195). A Counter shares its parent's `groupId` (one Combat Phase), and `siblingMessages` now also matches the attacker. Grouped by `groupId` alone, the parent's first message was the counter's "first of group": Raikou's Mana Burst Counter never paid its own Dodge, and the counter could have read the parent's Cover and window picks.

**A Mana Burst is a Counter, whoever's it is** (#209 reading 4, ruled 2026-10-14; the ticket read "own Turn only" and the code never did). `answersACounter` takes every Attack Skill, and the use gate lifts "used during your Turn" for a Counter and for nothing else (`costs.mjs`, `isCounter`), so Castor's and Pollux's Mana Bursts are offered beside the Normal Attack on the enemy's Turn exactly as Raikou's is. The Counter is its own Process, aimed back at the attacker: the `choose` is asked once, Pollux's Evade rider lands, and Castor's Avenger +80 counts and his Noble Phantasm cut falls on both twins. `test/helpers/process.mjs#playProcess` plays a Counter's Process; a press that carries a choice is `{event: "counter", abilityId}`.

**A Counter against a joint attack answers the twin who declared it** (#209 reading 11, ruled 2026-10-14; already built). The Dioscuri's Noble Phantasm "counts as both twins' Attack", but only for the budget (`alsoCountsAsAttackFor`): the Process it opens has ONE attacker, the declaring twin, and both questions a Counter asks read it. `counterAvailable` tests the defender's Range to `state.attackerId`, and `runCounter` aims at `state.counterRedirectId ?? state.attackerId`, so a foe that reaches Pollux (who used it) is offered a Counter aimed at Pollux, a placement that holds only Castor is refused (`FGT.Counter.MustIncludeAttacker`, the rung stays open and nothing is spent), and a foe the NP reached through Castor's Range (ch. 20, `alsoFrom`) but who cannot reach Pollux is not asked at all. The declarer's reach is the Counter's, the pair's is the NP's.

**A Process opened to measure damage is not an Attack** (`placement.plainDamage`, #184 reading 8, #223). Akhilleus Kosmos's sidestep *"receives damage equivalent to a Normal Attack"* runs a Combat Process for the arithmetic, with no Evade, Block or Counter and no cost. `buildAttackSpec` stamps `plainDamage` on the declaration and `rollOptionsFor` emits `attack:plainDamage`, so a Clause about damage received *from an Attack* can say it is not: Def Dwn (A)'s Luck −1 and (C)'s Agility −1 do (Appendix A). The damage itself, and everything else the Process fires, is unchanged.

**A fan-out's Processes run side by side, and three things wait on purpose** (#198, `engine/attack.mjs`). Airavata's three Processes reached the Damage Step together. The attacker's window (Monstrous Strength) is asked once: the group's first Process asks and its siblings await that answer (`openWindowPicks`). A **before-damage** self rider (*"First, apply NP DmUp"*) is paid by the first Process to strike, claimed in memory, and its siblings await the payment before computing their own damage (`selfPayments`). An **after-damage** self rider (*"Then, apply Atk Up"*) waits until every sibling is past its damage (`siblingsPastDamage`, bounded at two minutes). Without the three waits the window opened three times, NP DmUp landed three times and then counted on one card, and the Atk Up landed between hits.

1. **One process per distinct defender.** A fan-out over five units opens five processes (`module/engine/combat-process.mjs:212-236`). EMIYA's Overedge is two swings against one unit and is two processes against one defender, not an area attack (`module/engine/attack.mjs:922-926`). Each of them is declared as a Normal Attack (`countsAsNormalAttack`), and `attackDeclared` fires per Process, so each swing has its own Kanshou & Bakuya use (#208 readings 5 and 7). **`combatProcessEnd` is the attacker's too** (reading 10): `fireCombatProcessEnd` raises it on the attacker with the attack's options and `attack:performed`, and on the defender with none, hit or miss; firings queue per attacker so two Processes of one declaration read the board each other left. EMIYA's Circuits cut the NP Cooldown and spend their "next NP" charge there, and `circuitsPending` (until the Combat Phase ends) keeps the cut and the +20% off the NP that opened them.

2. **Weak-point offers at declaration, but only when possible.** Achilles' Heel is offered to the attacker before any ladder prompt, because the offer decides what Block will forbid (`module/engine/attack.mjs:991-1002`). The weak-point chance is pure and computed twice per offer — once plain, once with Luck bonus (`module/engine/weak-point.mjs:60-62`).

3. **A ladder with no options is not a ladder.** If every reaction is forbidden (Block, Evade, and Counter all refused), the rung has no buttons and no player can dismiss it. The orchestrator skips it and advances to `nothing` automatically (`module/engine/attack.mjs:1003-1025`).

4. **Damage riders fire only on hit.** The damage total must be greater than zero and not fully negated by concealment or other effects. "Hit" and "hurt" are distinct: a rider on-hit fires even if a Block reduced it; on-damage fires only if it got through (`module/engine/attack.mjs:2487-2510`, `module/rules/damage/riders.mjs`).

4b. **A debuff landing inside a Process may be prevented.** Every rider of the Process — the ability's own, a check's outcome, and a handler's (`damageDealt`, `damageTaken`, `damageStepEnd`, through `applyBatch(..., {process: state})`) — lands through `engine/landing.mjs` with the Process state, which offers its target the Prevention Luck Check once per Process ([Ch. 15](15-effect-application.md), [Ch. 13](13-checks-and-randomness.md)). The targets that made one are kept on `state.prevented` and serialised with the Process.

5. **Injury Roll reads the pipeline's threshold, not damage > 100.** `Def Crk` adds bonus damage that does not count toward Injury. The check reads `flags.exceededInjuryThreshold` from the pipeline, not a fresh comparison, so Def Crk does not trigger it (`module/rules/injury.mjs:40-44`).

6. **A counter carries the parent's group but is a fresh ladder.** The counter process shares `groupId` with the parent to keep the Combat Phase intact while the counter resolves. All other state is new: it has its own history, its own Luck ladder, and its own facing change (`module/engine/combat-process.mjs:470-475`).

7. **The history is the audit trail.** Every state transition is recorded with its source state, event, and optional detail. A roll record passed via detail is appended to the state's `rolls` array so that every roll the Process made stays with it across serialization (`module/engine/combat-process.mjs:288-292`).

## Open questions

- **Ladder collapse into a single prompt is unquantified.** When a defender has no Luck, no Command Spells, and no automatic evasion, the entire ladder resolves in one step. The orchestrator detects and flags this per-defender, but the latency impact in multi-defender attacks is not measured (`module/engine/combat-process.mjs:503-510`, `module/engine/attack.mjs:1003-1025`).

- **Resolved, and why it is written that way is the interesting part.** The redirect fires only on
  `next === "damage" && s.state !== "heelResolve" && s.heel?.declared && !s.heel?.resolved`
  (`module/engine/combat-process.mjs:275`). It is guarded on the **source state** rather than on
  `heel.resolved`, and the file says why: the resolved flag is written into the *outgoing* state, so
  at the moment of the test, leaving `heelResolve` still reads as unresolved and the rung *"would
  redirect into itself for ever"*. The source-state test is what makes the loop impossible; testing
  the flag alone would not.

### An attack only its own check avoids (#204 reading 15)

`damage.unavoidable` (Gate of Skye) closes the Evade rung at declaration, which also closes Lucky Evasion and the
Command Spell escape that follow a failed Evade; an automatic evasion and Dodge meet an empty permit; Substitution does
not halt it at stage 0; Presence Concealment's area coin is not flipped. A Block still answers, and cuts the damage of
a passed check. A guarded Master's shove is offered when it answers the rung. A Command Spell bought on the card still
beats it (ruled 2026-10-14): Escape or Teleport Servant carries the defender out, and the Process ends in `noDamage`.

### An Aim attack cannot be Evaded (#206 §46.4-MB)

`attack.aim` closes the Evade rung at declaration the same way, and `evadePermit` answers an empty permit, so Dodge,
the Evade buff and Medea's Trofa evade nothing. Unlike `unavoidable`, Aim leaves the rest alone: Substitution still
halts it at stage 0, and a Block still answers (ruled 2026-10-14). Pinned in `karna-206-arena.test.mjs`.

### `damageTaken` comes before the riders (#209 §46.4-NE)

The damage was received as it landed, before anything the attack inflicts "then". The Damage Step raises `damageTaken` on
the defender before `applyAbilityEffects`, so a rider that listens for damage received (Def Dwn (A) and (C)) hears the next
hit and not the one that inflicted it. `damageStepEnd` returns its cooldown rows and its chance dice for the card
(§46.4-ND); `applyWithCooldownLines` is the one reader for the attack path's cuts.
