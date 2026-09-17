# 21 — The Combat Process state machine

## What it is

The **Combat Process** is an explicit state machine that resolves one attack from declaration through defeat or recovery. It is **pure and serializable**: `advance()` takes a state and an event, produces a new state, and never writes or awaits (`module/engine/combat-process.mjs:1-18`). That shape is essential because the reaction ladder spans up to five prompts across two clients, so the state must survive serialization into a chat-message flag between rungs (`module/engine/combat-process.mjs:9-12`).

The attack flow is **one process per defender** in an area attack, not one process per attack. A Noble Phantasm over seven units damages one Servant from the attacker's perspective but opens seven independent ladders — each defender reacts, evades, and contests separately (`module/engine/combat-process.mjs:185-201`).

## Where it lives

| File | Role |
|---|---|
| `module/engine/combat-process.mjs` | The state machine: states, transitions, and pure reducers |
| `module/engine/attack.mjs` | Orchestration: declaration, card rendering, advancing through prompts |
| `module/rules/miss.mjs` | Step 1.5: whether the attack misses before reaction |
| `module/rules/injury.mjs` | Step 4: whether damage triggers an Agility roll |
| `module/rules/normal-attack.mjs` | Step 1: resolving which stat a Normal Attack uses |
| `module/engine/weak-point.mjs` | Step 3 (override): offering Achilles' Heel and rolling it |
| `module/engine/shield.mjs` | Step 3: barrier absorption before damage reaches the target |

## How it works

### The six steps and the ladder

The rulebook's six steps are implemented as a state machine with automatic and prompted transitions (`module/engine/combat-process.mjs:24-30`).

**Step 1 — Declaration.** The attacker offers the action, names the target, and pays the ability's cost (`module/engine/attack.mjs:93-149`). A weak-point attack is offered here: the attacker chooses whether to aim for Achilles' Heel, and choosing costs Luck if a bonus is available (`module/engine/weak-point.mjs:51-100`). The process enters `declare` and immediately advances to `missCheck` (`module/engine/combat-process.mjs:99-100`).

**Step 1.5 — Miss Check.** Rolled automatically, not prompted. `Blind` is the only source: 80% chance unless the attacker has `Eye of the Mind` or `Clairvoyance` (`module/rules/miss.mjs:29-89`). A miss is **terminal** — it skips reaction, Luck ladder, damage, Injury Roll, facing change, and counter (`module/engine/combat-process.mjs:103-110`). The ability's budget is still spent because the swing was declared (`module/engine/combat-process.mjs:108-109`).

**Step 2 — Reaction.** The defender chooses Block, Evade, or nothing at the `react` state (`module/engine/combat-process.mjs:114`). Certain effects forbid reactions — `Accel` forbids all three, `Presence Concealment` forbids Block and Counter, and an attack's `unblockable` field forbids Block alone (`module/engine/attack.mjs:950-972`). Block does not avoid damage; it reduces it at step 3 (`module/engine/combat-process.mjs:42`).

The reaction opens a **Luck ladder** if the defender chose Evade (`module/engine/combat-process.mjs:45-62`):
- **Steps 2.1–2.2:** Evade succeeded. Attacker rolls Lucky Hit (defender loses 1 Luck). If it succeeds, defender rolls Counter-Contest (defender loses 1 Luck). Both are contested rolls with `declined` edges; declining costs 1 Luck whether or not it succeeds (`module/engine/combat-process.mjs:115-116`, `module/engine/combat-process.mjs:48-50`).
- **Steps 2.4–2.5:** Evade failed. Defender rolls Lucky Evasion (defender loses 1 Luck). If it fails, attacker rolls Counter-Contest (attacker loses 1 Luck). Again, both can be declined for 1 Luck (`module/engine/combat-process.mjs:118-119`, `module/engine/combat-process.mjs:56-62`).

Both paths terminate at **Step 2.3 — Accept or Escape.** The defender accepts the hit, or uses a Command Spell to remove both units from the board (`module/engine/combat-process.mjs:64-65`).

**Step 3 — Damage.** Resolved automatically, not prompted. The pipeline computes the total (`module/engine/attack.mjs:2418-2490`). A declared Heel Attack redirects to `heelResolve` instead of `damage` and rolls in place of it; a failed Heel is an evade (`module/engine/combat-process.mjs:275-300`). Before the roll, a barrier may absorb some or all of it (`module/engine/shield.mjs:50-85`). Damage riders fire only if the attack connects and is not fully negated (`module/engine/attack.mjs:2489-2510`).

**Step 4 — Injury Roll.** Automatic. If damage exceeded 100 and the defender survives, they lose Agility equal to the damage taken, unless `Light Wound` succeeded or the unit has the `injuryOnlyFromNP` attribute (`module/rules/injury.mjs:32-58`). Does not occur if the target was defeated (`module/rules/injury.mjs:37`).

**Step 5 — Facing.** The defender faces the attacker, unless the attack was area (`module/engine/combat-process.mjs:487-489`). Automatic, no prompt.

**Step 6 — Counter.** The defender may counter if they survived or evaded, the attacker is in range, and counter-specific blocks do not apply (`module/engine/combat-process.mjs:387-428`). "Counters cannot be Countered again": a bystander an area counter caught may not counter it in turn, unless the setting `fgt.counterChain` is enabled (`module/engine/combat-process.mjs:395-402`). A counter is a fresh `processState` with its own ladder, sharing only the parent's `groupId` (`module/engine/combat-process.mjs:466-480`).

### Early termination

A **miss** ends the process at step 1.5. No ladder, no damage, no response from the defender. The attack is declared spent.

A **defended dodge** (evade succeeds on every rung or Lucky Evasion succeeds) ends the process at step 2. No damage, no Injury Roll.

A **Command Spell escape** at step 2.3 ends the process. Both units leave the board; no damage is applied.

A **successful Heel Attack** is a special: the attacker gambles declaring it. If it succeeds, damage ignores all defensive buffs. If it fails, the defender evades instead (`module/engine/combat-process.mjs:67-79`).

The process is **complete** when it reaches the `done` state (`module/engine/combat-process.mjs:368-370`).

## Invariants & edge cases

1. **One process per distinct defender.** A fan-out over five units opens five processes (`module/engine/combat-process.mjs:212-236`). EMIYA's Overedge is two swings against one unit and is two processes against one defender, not an area attack (`module/engine/attack.mjs:922-926`).

2. **Weak-point offers at declaration, but only when possible.** Achilles' Heel is offered to the attacker before any ladder prompt, because the offer decides what Block will forbid (`module/engine/attack.mjs:991-1002`). The weak-point chance is pure and computed twice per offer — once plain, once with Luck bonus (`module/engine/weak-point.mjs:60-62`).

3. **A ladder with no options is not a ladder.** If every reaction is forbidden (Block, Evade, and Counter all refused), the rung has no buttons and no player can dismiss it. The orchestrator skips it and advances to `nothing` automatically (`module/engine/attack.mjs:1003-1025`).

4. **Damage riders fire only on hit.** The damage total must be greater than zero and not fully negated by concealment or other effects. "Hit" and "hurt" are distinct: a rider on-hit fires even if a Block reduced it; on-damage fires only if it got through (`module/engine/attack.mjs:2487-2510`, `module/rules/damage/riders.mjs`).

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
