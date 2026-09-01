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
| `fgt.attackDeclared` | An attack is declared, before any reaction | `{attackerId, targetIds, abilityId, isNP, isAoE}` — **fired**, once per Combat Process, on the *attacker*, with the defender and the distance in the option set. It is the moment a swing happens rather than the moment it lands, which is what EMIYA's `Kanshou & Bakuya` asks about: a Servant who projected the swords and then missed still projected them. |
| `fgt.reactionChosen` | A defender picks Evade/Block/nothing | `{defenderId, reaction}` |
| `fgt.evadeSucceeded` | An evade roll (or Dodge) succeeded | `{defenderId, attackerId, roll}` — **fired**, on the evader, for an automatic Dodge as well as a rolled evasion (the sheets do not distinguish). Three abilities in the reference set pay out for it — EMIYA's `Eye of the Mind (True)` at both Ranks and Heracles's `Eye of the Mind (False)` — and none of them could. |
| `fgt.evadeFailed` | An evade roll failed | `{defenderId, attackerId, roll}` |
| `fgt.luckCheckResolved` | Any Luck Check resolved | `{unitId, subtype, success, roll}` |
| `fgt.damageStepStart` | Start of Step 3 | `{attackerId, defenderIds, ctx}` |
| `fgt.critDetermined` | The crit coin flip resolved | `{attackerId, isCrit, chance}` |
| `fgt.damageComputed` | The pipeline returned, before application | `{defenderId, result}` |
| `fgt.damageTaken` | Damage applied to a unit | `{unitId, amount, sourceId, packet}` |
| `fgt.damageDealt` | Damage dealt by a unit | `{unitId, amount, targetId}` — **fired**, on the *attacker*, once the damage has landed, with the Defending Unit reachable as `ctx.victim` and `attack:crit` in the option set. This is the rung every **on-hit rider** in Appendix A hangs from — *"Normal Attacks inflict X on the DU"* — and until Serenity nothing raised it, so `Bleed Atk`, `Queen's Poison` and both halves of her poisoned daggers were all inert. See §E.9b. |
| `fgt.damageStepEnd` | End of Step 3 | `{attackerId, defenderIds, results}` — **fired**, on the *attacker*, once damage has landed. The Defending Unit travels in the option set rather than in the unit list, so a handler can pay out differently against them without the defender's own handlers firing for somebody else's attack. Scáthach's `Alpi` is the first content to use it. |
| `fgt.injuryRolled` | An Injury Roll resolved | `{unitId, roll, agilityAfter}` |
| `fgt.facingChanged` | Step 5 | `{unitId, from, to, reason}` |
| `fgt.counterOffered` | A counter opportunity was presented | `{defenderId, attackerId}` |
| `fgt.combatProcessEnd` | A Combat Process finished | `{phaseId, processIndex, outcome}` — **fired**, on both combatants, once per Process. It had been listed here since this reference was written and nothing ever raised it, so the one clause in the set priced per *Process* rather than per *Phase* had no trigger at all. Karna states both scales himself and the difference is the point: `Kavacha and Kundala` charges his Master 20 *"at the end of every **Turn** that Karna is involved in a Combat Phase"*, and `Vasavi Shakti` charges the same 20 *"at the end of every **Combat Process** Karna is involved in"*. A Noble Phantasm over seven Units is one Phase containing seven Processes, so trading the armour away multiplies the bill — which is the cost the sheet is describing, and collapsing the two events would erase it. |
| `fgt.combatPhaseEnd` | A Combat Phase finished | `{phaseId, processCount}` — **fired**, once per exchange, on the attacker and every defender in the fan-out. Per *Phase*, not per Process: an area attack is one exchange containing several Processes, and paying per Process would hand EMIYA a full six-charge Aria pool for one Noble Phantasm. Completeness is read back off the sibling chat messages, so it survives a reconnect and a counter joining the group late. |

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
| `fgt.unitRevived` | A revival source fired | `{unitId, source, restored}` — **fired**, once, from the defeat resolution, which is the only place that knows a revival happened *and* which of the four paid for it. Heracles's `Indomitable` is the one clause that listens: *"whenever Heracles is defeated and revived through **any** effect"* — so it cannot hang off one source, and firing it from each would fire it four times. |
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
| `fgt.discovered` | A concealed unit was found | `{unitId, byId}` — **fired**, from the movement hooks, once per watcher whose Detect radius the mover entered. Every roll is GM-only and silent unless it succeeds: *"if either Player performs the roll, that would mean that they would already know there is a Unit with Active Presence Concealment in the area."* |
| `fgt.concealmentEnded` | Presence Concealment switched off, for any of its six reasons | `{unitId, reason}` — `attacked`, `discovered`, `aoe`, `skillUse`, `expired`, `manual`. Raised from the one function every removal path converges on, because the aftermath (the cooldown that counts from *here*, and the Secret Poison that becomes visible) is owed by all six. |
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

## E.9a `abilityUsed`

| Event | When | Payload |
|---|---|---|
| `fgt.abilityUsed` | A Unit finished using a Skill, Spell or Noble Phantasm | `{unitId, abilityId, contentId, category, isNP}` |

Fired on **both** use paths, after the phases have resolved — "uses" is the sheet's word, and a
Skill refused mid-resolution has not been used. It is the only event with a **subject**, so a
handler may filter on it:

```yaml
- key: OnEvent
  event: abilityUsed
  ofCategory: [thaumaturgy, projection]
  then:
    - { key: ExtendEffect, effect: atkUpTrace, ticks: "⅓◈" }
```

A category rather than a list of ids, for the reason Medea's *High-Speed Divine Words* names one:
a list goes stale the moment an eighth Spell is written. Both handlers in the reference set are
EMIYA's — *Magecraft* widens his Range on any Thaumaturgy Spell, and *Atk Up (Trace)* lengthens
itself on a Thaumaturgy **or** Projection.

---

## E.9b `damageDealt` and the on-hit rider

| Event | When | Payload |
|---|---|---|
| `fgt.damageDealt` | Damage landed | `{unitId, amount, targetId}`, plus `ctx.victim` |

The **second** event with something other than its owner in scope, and the shape is deliberately
different from `damageStepEnd`'s. `damageStepEnd` puts the Defending Unit in the *option set*, so
a handler can pay out **differently** against them; this puts them in `ctx.victim`, so a handler
can pay out **onto** them.

```yaml
- key: OnEvent
  event: damageDealt
  predicate: ["attack:kind:normal"]     # answered when the event fires
  target: victim                        # NOT the default
  chance: 25
  duration: "1◈"
  effect: { id: deadlyPoison }
```

Two traps, both of which shipped:

1. **`target` defaults to `self`.** A rider that omits it inflicts its debuff on the *attacker*.
   `Bleed Atk` omitted it, which was invisible only because the event never fired.
2. **`effect:` beside `event:` is a shorthand that had no desugaring.** `normalizeActions` read
   `then` and `revive` and no third thing, so a handler written this way produced an empty action
   list and did nothing when it fired. Two shipped effects were written that way.

`target` takes three values: `self` (the default), `victim`, and `nearby` with a `radius` and a
`relations` list. The third is Serenity's Zabaniya — *"any Unit within a 2 panel area … at the end
of her Turn"* — and it is **not** an `Aura`: an aura contributes a modifier to whoever stands in
it, and this applies something, once, at a moment.

---

## E.10 Subscribing from content

```yaml
- key: OnEvent
  event: damageStepEnd                  # or a list: [damageStepEnd, effectApplied]
  predicate: ["self:wasSuccessfullyAttacked"]
  targetPredicate: ["target:attribute:divine"]   # answered when the event FIRES
  automatic: true                       # suppressible by Addle
  consumesUse: true                     # spend a charge each time it pays out
  priority: 50                          # optional
  once: false                           # optional: fire once then remove
  then:
    - { key: StatDelta, stat: agility, delta: -1 }
```

The subscription lives on the rule element, so it is created when the effect or ability is
present and torn down when it is removed. Content **cannot** leak listeners.

`predicate` and `targetPredicate` are answered at **different moments**, and the distinction is
the same one Ch. 24 §24.4 draws. `predicate` gates the element at *collection* time, where only
the owner is in scope; `targetPredicate` is carried through and answered when the event fires,
where the other unit exists. Scáthach's *Alpi* needs the second — *"if the DU has the 'Undead' or
'Divine' Attribute, it is reduced by 1◈ instead"* is a question about somebody who does not exist
when the contribution is collected. It is authored as **two handlers with opposite target
predicates** rather than one with a conditional magnitude, which keeps each payout a flat fact.

`consumesUse` spends one charge of a count-limited effect each time the handler pays out — *Alpi*
is *"for 1◈ Turns, **3 times**"*, and both limits apply: whichever ends first.

### Whose action it is

An action acts on its handler's bearer by default. `subject: master` resolves through the
bearer's contract instead:

```yaml
- key: StatDelta
  subject: master
  stat: health.value
  table: madEnhancementDrain
  direction: down
  floor: 30
```

Mad Enhancement's first clause is *"this Servant's **Master** loses Health at the end of every
Turn it Acts"* — an effect on the bearer whose cost lands on somebody else — and every action
acted on `u.id`, so a Master who could not be named could not be charged. A Free Servant returns
no subject and the action does nothing, which is right: there is nobody to drain, and charging
the Servant instead would be inventing a rule.

`floor` limits **that deduction**, not the pool: *"its Master's Health cannot drop below 30 in
this way"*, so ordinary damage may still take them under it.

### Actions in one handler see each other

The actions in one `then:` list are dispatched in order against a running view of what the
earlier ones produced. Mad Enhancement drains its Master and then asks whether that Master is now
at or below the floor; computing both against the same starting value made the forced
deactivation lag a full Turn behind the drain that caused it.

### Action gates

An action inside `then:` may carry its own roll and a gate on it:

```yaml
- key: ApplyEffect
  roll: { key: shockJolt, formula: "1d6" }
  when: { in: [3, 4] }                  # or { gte, lte }
  duration: "1 turns"
  effect: { defId: stun }
```

`Shock` is the case: *"at the start of every turn, roll d6; on 3 or 4 the unit cannot act."* That
is a **face test**, not an application chance — the Stun it applies has a chance of its own, and
folding the two together would let `Debuff ResUp` shorten odds the sheet does not describe as a
debuff roll. A gate whose die never arrived **refuses**, which is the safe direction: an action
that was not rolled has not rolled a 3.

`ApplyEffect` computes its own expiry from `duration`, because durations are stored as absolute
ticks (Ch. 07 §7.5) and only the scheduler knows what tick it is. An authored `expiry` would be a
turn count masquerading as an absolute one, and would expire either immediately or never.

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
