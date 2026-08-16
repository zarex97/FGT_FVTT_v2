# Appendix E — Event Reference

> **Implementation note (Ch. 45 A1).** `OnEvent` handlers are dispatched by
> `scheduler.fireEvent`, which previously read a `handler.intents` array **nothing ever wrote** —
> so every handler in the game contributed a log line and nothing else.
>
> The action vocabulary the `then` list dispatches into is now: `Damage`, `Heal`, `StatDelta`,
> `ApplyEffect`, `RemoveEffect`, `ResourceDelta`, `CooldownDelta`, `Message`, and `Revive` (from
> the `revive:` shorthand). An action the dispatcher does not understand **logs itself by name**
> rather than resolving silently.
>
> `fgt.unitDefeated` deserves a note of its own: it had no reader **and no raiser** — nothing in
> the system emitted a defeat when Health reached zero. `resolveDefeat` is that raiser, and a
> unit that revives is never defeated rather than defeated and then healed.

Every event the engine emits, its payload, its ordering guarantees, and which content subscribes
to it. Content subscribes through the `OnEvent` rule element (Ch. 24 §24.3), never through
`Hooks.on` directly.

The General Notes ask for this explicitly:

> *"There are effects that trigger or cause other effects or things… If something is common
> enough it should be made an event (kinda like onTokenMove, or onReceivingAttack)."*

---

## E.1 Two event systems

| System | Namespace | Purpose | Subscribers |
|---|---|---|---|
| **Engine events** | `fgt.*` | Rule triggers | `OnEvent` rule elements, engine internals |
| **Foundry hooks** | standard | Document lifecycle | Modules, UI |

Engine events are emitted by the orchestration layer and consumed by the rules layer through a
managed subscription list. They carry a full context object and can **return intents**, which
Foundry hooks cannot.

```ts
interface EngineEvent<T = unknown> {
  name: string;
  globalTurn: number;
  round: number;
  actorId: string | null;          // the primary subject
  data: T;
  ctx: ResolutionContext | null;   // present during combat/ability resolution
}

type EventHandler = (event: EngineEvent) => Intent[];
```

Handlers are **pure** — they return intents, they do not write. That keeps event handling inside
the L2 purity boundary and makes triggered effects testable.

---

## E.2 Time events

| Event | Fires | Payload | Ordering |
|---|---|---|---|
| `fgt.turnStart` | Start of every turn, for **all** units | `{combatantId, userId}` | Before any action |
| `fgt.turnEnd` | End of every turn, for the active player's units | `{combatantId}` | Scheduler step 1 |
| `fgt.actedTurnEnd` | End of every turn, for **every unit that Acted**, any faction | `{actedUnitIds}` | Scheduler step 2 |
| `fgt.unitTurnEnd` | End of the **owner's** turn only | `{unitId}` | With step 1 |
| `fgt.roundStart` | Start of every round | `{round, phase}` | After day/night flip |
| `fgt.roundEnd` | End of every round | `{round}` | Before the boundary sequence |
| `fgt.effectExpired` | An effect's duration ran out | `{unitId, effectId, defId}` | Scheduler step 5, **after** step 4's periodic ticks |
| `fgt.cooldownReady` | An ability came off cooldown | `{unitId, abilityId}` | Scheduler step 3 |

**The `acted` distinction is the one to get right.** A unit that reacted (evaded, blocked,
countered, made a Luck Check) during an *opponent's* turn has Acted, so `actedTurnEnd` fires for
it on that opponent's turn. Mad Enhancement's Master drain, Sap/Bleed, Crystallize's fixed
damage, and Kingprotea's GAO decay all depend on this.

Deduplication: when both `unitTurnEnd` and `actedTurnEnd` would fire for the same unit on the
same turn, each *effect* fires **once**, keyed by `(effectId, globalTurn)`.

---

## E.3 Combat events

| Event | Fires | Payload |
|---|---|---|
| `fgt.attackDeclared` | An attack is declared, before any reaction | `{attackerId, targetIds, abilityId, isNP, isAoE}` |
| `fgt.reactionChosen` | A defender picks Evade/Block/nothing | `{defenderId, reaction}` |
| `fgt.evadeSucceeded` | An evade roll (or Dodge) succeeded | `{defenderId, attackerId, roll}` |
| `fgt.evadeFailed` | An evade roll failed | `{defenderId, attackerId, roll}` |
| `fgt.luckCheckResolved` | Any Luck Check resolved | `{unitId, subtype, success, roll}` |
| `fgt.damageStepStart` | Start of Step 3 | `{attackerId, defenderIds, ctx}` |
| `fgt.critDetermined` | The crit coin flip resolved | `{attackerId, isCrit, chance}` |
| `fgt.damageComputed` | The pipeline returned, before application | `{defenderId, result}` |
| `fgt.damageTaken` | Damage applied to a unit | `{unitId, amount, sourceId, packet}` |
| `fgt.damageDealt` | Damage dealt by a unit | `{unitId, amount, targetId}` |
| `fgt.damageStepEnd` | End of Step 3 | `{attackerId, defenderIds, results}` |
| `fgt.injuryRolled` | An Injury Roll resolved | `{unitId, roll, agilityAfter}` |
| `fgt.facingChanged` | Step 5 | `{unitId, from, to, reason}` |
| `fgt.counterOffered` | A counter opportunity was presented | `{defenderId, attackerId}` |
| `fgt.combatProcessEnd` | A Combat Process finished | `{phaseId, processIndex, outcome}` |
| `fgt.combatPhaseEnd` | A Combat Phase finished | `{phaseId, processCount}` |

`fgt.damageStepEnd` is the highest-traffic trigger in the game. Its subscribers in the reference
set: `Def Dwn (A)`, `Def Dwn (C)`, `Queen's Poison`, Castor's *Twin God's Divine Core*,
Scáthach's *Alpi* buff, `Dmged NP Regen`, Kiritsugu's `Suppression`, Van Gogh's `Gogh` buff,
Karna's `Mana Burst (Flames)` Burn rider, Bašmu's Poison rider, and every "apply X at the end of
the Damage Step" clause.

**Critical:** `fgt.damageStepEnd` fires **even when zero damage was dealt** (Ch. 12 §12.5), per
the General Notes and `Invuln`'s own text.

---

## E.4 Effect events

| Event | Fires | Payload |
|---|---|---|
| `fgt.effectApplied` | An effect landed | `{unitId, effectId, defId, sourceId, magnitude}` |
| `fgt.effectBlocked` | Immunity or exclusivity refused it | `{unitId, defId, blockedBy}` |
| `fgt.effectResisted` | The chance roll failed | `{unitId, defId, chance, roll}` |
| `fgt.effectRemoved` | Removed by any means | `{unitId, effectId, defId, reason}` |
| `fgt.effectSuppressed` / `fgt.effectUnsuppressed` | Suppression state changed | `{unitId, effectId, by}` |
| `fgt.curseStageChanged` | Curse gained or lost stages | `{unitId, stageDelta, newStage}` |
| `fgt.poisonStageChanged` | Poison staged | `{unitId, stageDelta, newStage}` |
| `fgt.buffRemovedByEffect` | A dispel succeeded | `{unitId, effectId, byUnitId}` |

`fgt.effectApplied` is what makes Mannanán's `Fragarach` fire on being debuffed (Ch. 33 §33.3) —
one of the few triggers in the game that is not damage-related.

---

## E.5 Unit lifecycle events

| Event | Fires | Payload |
|---|---|---|
| `fgt.healthChanged` | Any health mutation | `{unitId, delta, cause, newValue}` |
| `fgt.healthReachedZero` | Health hit 0, **before** the revival chain | `{unitId, ctx}` |
| `fgt.unitRevived` | A revival source fired | `{unitId, source, restored}` |
| `fgt.unitDefeated` | Defeat after the revival chain resolved | `{unitId, cause}` |
| `fgt.unitErased` | Removed by `Erase` | `{unitId}` — **does not** increment the Grail counter |
| `fgt.unitDisappeared` | Sustainability or NP cost | `{unitId, cause}` |
| `fgt.unitFirstSeen` | A unit entered another's vision for the first time | `{seerId, seenId}` |
| `fgt.resourceChanged` | Any resource delta | `{unitId, key, delta, newValue}` |
| `fgt.modeToggled` | Presence Concealment / Mad Enhancement | `{unitId, abilityId, active}` |
| `fgt.rankChanged` | A parameter rank shifted | `{unitId, parameter, from, to}` |

`fgt.healthReachedZero` firing **before** the revival chain is what lets God Hand record the
attack that killed Heracles even when God Hand then prevents the death (Ch. 31 §31.3).

---

## E.6 Movement and space events

| Event | Fires | Payload |
|---|---|---|
| `fgt.unitMoved` | Voluntary movement completed | `{unitId, from, to, panels, path}` |
| `fgt.unitDisplaced` | Forced movement (knockback, platform, Cover shove) | `{unitId, from, to, cause}` |
| `fgt.zoneEntered` / `fgt.zoneExited` | Region membership changed | `{unitId, zoneId, tags}` |
| `fgt.zonEntered` / `fgt.zonExited` | A Servant crossed its Master's ZON boundary | `{servantId, masterId}` |
| `fgt.levelChanged` | Boarded, jumped, or fell between Scene Levels | `{unitId, from, to, cause}` |
| `fgt.discovered` | A concealed unit was found | `{unitId, byId}` |
| `fgt.sizeChanged` | A unit's footprint changed | `{unitId, from, to}` |

`fgt.zonExited` drives the "your Servant is out of ZON" badge — a small affordance that prevents
a large class of player mistakes (Ch. 16 §16.10).

---

## E.7 Relationship events

| Event | Fires | Payload |
|---|---|---|
| `fgt.contractFormed` | A contract was made | `{masterId, servantId, method, spellsGranted}` |
| `fgt.contractBroken` | A contract ended | `{masterId, servantId, reason}` |
| `fgt.contractStateChanged` | Contracted ↔ Unbound ↔ Free | `{servantId, from, to}` |
| `fgt.commandSpellSpent` | Any spend | `{masterId, command, cost, pool, context}` |
| `fgt.masterProtectionChanged` | A Master gained or lost protection | `{masterId, protected, reason}` |
| `fgt.coverAttempted` | A Servant tried to shove its Master | `{masterId, servantId, success}` |
| `fgt.overpowerRolled` | A Servant attacked a Master | `{servantId, masterId, result, luckCheckUsed}` |
| `fgt.underpowerRolled` | A Master attacked a Servant | `{masterId, servantId, result}` |

`fgt.contractStateChanged` is what triggers Van Gogh's `Kill Humans` resentment consequence
(Ch. 17 §17.7) — content listening for `→ unbound`.

---

## E.8 Match events

| Event | Fires | Payload |
|---|---|---|
| `fgt.matchStarted` | Ruleset locked, round 1 begins | `{ruleset, factions}` |
| `fgt.phaseChanged` | Day ↔ night | `{round, phase}` |
| `fgt.grailMaterialized` | The defeat threshold was reached | `{position}` |
| `fgt.grailContested` | A unit began or continued holding | `{unitId, roundsHeld}` |
| `fgt.grailDestroyed` | The destruction roll succeeded | `{byUnitId, damage, chance}` |
| `fgt.matchEnded` | A victory condition was met | `{outcome, faction}` |
| `fgt.randomEvent` | The GM introduced one | `{eventId}` |

---

## E.9 Ordering guarantees

Explicitly stated, because effects that trigger effects depend on them.

1. **Within a scheduler step**, handlers fire in **priority order**, then by source document id
   (stable across clients).
2. **`effectExpired` fires after the final periodic tick** of that effect, unless the effect
   declares `skipFinalTurn`.
3. **`damageStepEnd` fires after all damage in the step is applied**, so a handler sees the
   post-damage state of every defender in an AoE.
4. **`healthReachedZero` fires before the revival chain**; `unitDefeated` fires after it
   resolves to death.
5. **Cascading events are depth-limited.** An effect triggered by an event may itself emit
   events, to a maximum depth of **8**, after which the chain is truncated and logged as an
   error. This prevents an infinite loop from a content mistake (two effects triggering each
   other) from hanging the client.
6. **Handlers cannot observe their own intents.** Intents returned by a handler are collected and
   applied after all handlers for that event have run, so handler order does not create
   read-after-write hazards within one event.

Point 6 is worth emphasising: it means two handlers on the same event both see the *pre-event*
state, which makes their order irrelevant for reads and is the reason the system is
deterministic across clients despite subscription order varying.

---

## E.10 Subscribing from content

```yaml
- key: OnEvent
  event: damageStepEnd                  # or a list: [damageStepEnd, effectApplied]
  predicate: ["self:wasSuccessfullyAttacked"]
  automatic: true                       # suppressible by Addle
  priority: 50                          # optional
  once: false                           # optional: fire once then remove
  then:
    - { key: StatDelta, stat: agility, delta: -1 }
```

The subscription lives on the rule element, so it is created when the effect or ability is
present and torn down when it is removed. Content **cannot** leak listeners.

`automatic: true` marks it as an automatically-activating effect, which `Addle` negates
(Ch. 11 §11.4). Every reactive content effect should set it; the validator warns when an
`OnEvent` on a *buff* omits it.

---

## E.11 Foundry hooks we emit for module authors

A small, stable surface, separate from the engine events:

| Hook | When |
|---|---|
| `fgt.ready` | The system finished initializing; registries loaded |
| `fgt.preComputeDamage` | Before the pipeline runs; the context is mutable |
| `fgt.computeDamage` | After the pipeline; the result is mutable |
| `fgt.preResolveTargets` | Before targeting resolution; the spec is mutable |
| `fgt.resolveTargets` | After resolution; the target list is mutable |
| `fgt.preApplyIntents` | Before a batch is applied; intents are mutable |
| `fgt.combatProcessStateChanged` | Every ladder transition |

Deliberately few. A module that needs more should add a rule element (Ch. 24 §24.11) rather than
hooking deeper — hooking into internals is what makes systems and modules break each other on
every release.

---

## E.12 Event volume and performance

Measured on a worst case (a 12-defender AoE Noble Phantasm with 4 rider effects each):

| Event | Count |
|---|---|
| `attackDeclared` | 1 |
| `reactionChosen` | 12 |
| `evadeSucceeded` / `evadeFailed` | 12 |
| `damageStepStart` / `End` | 2 |
| `damageComputed` / `damageTaken` | 24 |
| `effectApplied` / `Resisted` | 48 |
| `injuryRolled` | ≤ 12 |
| `healthReachedZero` | ≤ 12 |
| **Total** | **~125** |

At a budget of 0.05 ms per event dispatch (a predicate evaluation plus intent collection), that
is ~6 ms for the largest single action in the game. Comfortable. The dispatcher indexes handlers
by event name so an event with no subscribers costs one map lookup.

---

**End of appendices.** Back to the [index](00-index.md).
