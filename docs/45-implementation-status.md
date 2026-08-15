# 45 — Implementation Status and Completion Plan

**As of `0.2.11`.** This chapter audits the 44 specification chapters against the ~10,500 lines
of code in `module/`, names what is missing, and lays out a step-by-step plan to finish it.

It is written to be **acted on**, so it is blunt about three distinctions that a status table
usually blurs:

| Status | Means |
|---|---|
| **Done** | Implemented, tested, and reachable from the interface. |
| **Collected** | The data exists and is projected into the snapshot, but **nothing reads it**. The content loads and does nothing. |
| **Stubbed** | There is a code path with the right name that unconditionally does nothing. |
| **Missing** | No code at all. |

**Collected** and **stubbed** are the dangerous ones. A missing feature announces itself; a
stub resolves silently and looks like it worked. Every entry below is classified honestly, and
where something is a stub the exact line is named.

---

## 45.1 Executive summary

The **pure rules core is essentially complete**: the damage pipeline, targeting resolution,
checks, movement legality, the effect application pipeline, the turn budget and the rank/tick
domain are all implemented and carry 806 tests, and 41 content files.

What is missing is almost entirely in **layer 3 and layer 4** — the orchestration that connects
the rules to the game, and the interfaces that let a player reach them. Concretely:

1. ~~**The Combat Process runs three of its six steps.**~~ — **all six run** as of Phase A.
   Damage resolves, the **Injury Roll** is live (A3), the **AoE fan-out** is real (A2) and the
   **Counter** is offered and resolved (A4). What remains in Ch. 12 is **§12.11 interrupts**,
   which is Command Spells and therefore B1.
2. **Command Spells are spendable, but cannot interrupt.** The catalogue, the spend flow and the
   offer filtering are done (B1); the interrupt protocol (Ch. 17 §17.4) is not, so the six
   commands that rewrite an in-flight resolution log themselves rather than applying.
3. ~~**Events do not fire into anything.**~~ — **done (A1)**, see the Unreleased changelog.
   `OnEvent` now normalizes to `{events, actions}` at collection time, `fireEvent` dispatches
   those actions through an action table, and `resolveDefeat` gives `unitDefeated` the reader it
   never had. Battle Continuation revives. The original finding read: `OnEvent` elements are
   collected, and `fireEvent` reads a field (`handler.intents`) that the executor never writes —
   so Battle Continuation's revive, the single most-cited event in the reference set, is inert.

   One clause of that skill is still open and is **named rather than silently dropped**:
   `requiresHealthAbove: 0.5` — *"requires its Health to have exceeded half its maximum at least
   once since the last activation"* — needs a health-peak history that nothing records. Adding
   the gate against a field no code writes would recreate the exact defect this step repaired,
   so the gate waits for the history. The cooldown gate, which is the rule that actually stops a
   revive loop, is implemented and tested.
4. ~~**Auras apply to the wrong unit.**~~ — **done (A5)**, see the Unreleased changelog.
   `rules/auras.mjs` expands each aura onto the units in range that match its relation list, and
   `snapshotBoard` runs the pass once every unit exists. The original finding read: `Aura` writes
   a modifier carrying `radius` and `relations` into its *owner's* modifier bag, and the pipeline
   reads the modifier while ignoring both fields — so an aura buffs its own owner at unlimited
   range instead of the units around it.

   **That finding was half wrong, and the half matters.** Reaching the owner is *correct*: in
   F/GT "every allied unit" includes the unit itself unless the text says otherwise, which is why
   `relations` defaults to `["ally", "self"]`. The auras that exclude their bearer — Penthesilea's
   *Charisma* ("other allies"), Kiritsugu's *Affection of the Holy Grail* ("everyone except
   himself") — say so explicitly, and drop `"self"`. The defect was never self-inclusion; it was
   that the aura reached the owner **and stopped**, at unlimited range, regardless of relation.
5. ~~**ZON is checked but never computed**~~ — **done**, see the Unreleased changelog.
   `rules/zon.mjs` derives it, `snapshotBoard` annotates it once every unit exists (it is a
   property of the Master–Servant *pair*), and the attack flow reads its combatants from the
   annotated board. Both consumers now fire. The rest of B4 — Health costs, cooldown gates, the
   NP round gate — is still open. The original finding read:
   The rule is implemented twice and fed
   by an input no code writes.
6. **Two of the eight environment subsystems are missing**: Region and Random Events. Day/Night,
   Home Base and the Grail's rules landed in C2; terrain's standing modifiers in C1. What the
   Grail lacks is a runtime state owner, and what terrain lacks is a `Region` behaviour to
   populate areas from a scene.
7. **Platforms, levels and bounded fields are modelled in the schema and nowhere else.**
8. **Only 2 of 29 reference Servants are authored.**

The system is at the point where **one player can attack another player and the damage is
correct and fully audited**. It is not yet at the point where a match can be played to a finish.

---

## 45.2 Status by chapter

### Part I — the domain model

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 04 | Units | **Done** | Six actor types, schemas, multi-panel footprints read by targeting. |
| 05 | Ranks and parameters | **Done** | Grade-major ordinals, step arithmetic, `RankField`. |
| 06 | Stats and resources | **Done** | Including derived stat deltas as of `0.2.0`. |
| 07 | Time model (◈) | **Mostly** | `parseTick`/`resolveTicks`/overrides done; **Delay (§7.8) missing**. |
| 08 | Board and geometry | **Mostly** | Metrics, reachability, movement legality done. **Line of sight and cover (§8.6), fog of war and Detect (§8.7) missing.** |
| 09 | Targeting | **Done** | Eleven-step resolver, four anchors interactive, `legalPlacements`. |
| 10 | Effect taxonomy | **Done** | Classification vocabularies enforced by the content validator. |
| 11 | Effect engine | **Partly** | Application, stacking, suppression, expiry, periodics and **auras (§11.6, A5)** done. **Transfer (§11.8) missing. Visibility (§11.10) collected-only.** |
| 12 | Combat Process | **Mostly** | All six steps run (Phase A). **Interrupts (§12.11) missing — they are Command Spells, so B1.** |

### Part II — resolution systems

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 13 | Damage pipeline | **Done** | 16 stages, both worked examples are golden fixtures. |
| 14 | Checks and randomness | **Mostly** | Evade, Luck, chance rolls, `checkPlan` done. **The roll log (§14.8) and setup rolls (§14.9) missing.** |
| 15 | Abilities | **Mostly** | Classification, phases and **costs/requirements (§15.4, B4)** done — Master Health, Sustainability, cooldown, round and ZON gates. **The remaining requirement kinds, granted/copied abilities (§15.7) and items (§15.8) missing.** |
| 16 | Relationships | **Partly** | Master protection is enforced by movement. **ZON is derived and both consumers fire**, including the Semiramis exemption and the Dioscuri's `any`-across-twins test. **Contracting, Overpower/Underpower, Sustainability drain and the multi-Servant tax are missing.** |
| 17 | Command Spells | **Partly** | Catalogue (16 commands), spend flow, cost variants and offer filtering done (B1). **The interrupt protocol (§17.4) — suspend/resume, the non-blocking offer and its timeout — is missing, and with it the six commands that rewrite an in-flight resolution.** |
| 18 | Action economy | **Mostly** | Budget, per-unit limits, prevention, compulsions done. **Undo (§18.7) and Confuse's random selector (§18.5) missing.** |
| 19 | Environment | **Partly** | Day/Night, Home Base E1–E4 and the Grail's rules done (C2). **Region, Random Events, Civilians, the board setup sequence and E5 are absent, and the Grail has no runtime state owner.** |
| 20 | Platforms and levels | **Missing** | `PlatformData` exists; no linkage, no cross-level rules, no lifecycle. |

### Part III — Foundry architecture

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 21 | System skeleton | **Done** | Bootstrap, settings, public API, CI, release workflow. |
| 22 | Data models | **Mostly** | All schemas present. **Region behaviour schemas (§22.10) missing.** |
| 23 | Documents and derived data | **Mostly** | Preparation order, derived stats and **the aura pass (§23.3)** done. **Cache invalidation and the spatial `AuraIndex` (§23.9) missing — the pass is a linear scan today, correct but unbucketed.** |
| 24 | Rules engine | **Mostly** | 30 executors, predicates, explainability, validation. **Priority and ordering (§24.6) not implemented — elements apply in collection order.** |
| 25 | Turn system | **Mostly** | `FGTCombat`, turn order, scheduler, HUD done. **Charm/control transfer (§25.7) and reconnection (§25.10) missing.** |
| 26 | Authority and sockets | **Mostly** | Typed operations, authorization, hidden rolls. **Closed-information play (§26.6) and per-viewer cards (§26.7) missing.** |
| 27 | Reaction protocol | **Mostly** | Message-chain state, prompts, collapsing, resumption done. **Timeouts (§27.5) and interrupt injection (§27.9) missing.** |
| 28 | Targeting implementation | **Mostly** | Canvas layer, four modes, preview, speculative damage done. **Zone overlays (§28.9) missing.** |
| 29 | User interface | **Partly** | Unit sheet, ability sheet, turn HUD, chat cards done. **Master sheet (§29.3), token HUD (§29.5) and the ability editor (§29.6) missing.** |
| 30 | Chat and audit | **Mostly** | Cards and the damage explainer done. **The game log (§30.8), export/replay (§30.9) and GM overrides (§30.10) missing.** |

### Part IV — reference

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 37 | Content pipeline | **Done** | YAML → LevelDB, validator, stable ids. **The summon operation (§37.6) missing.** |
| 38 | Testing strategy | **Mostly** | 806 unit and golden tests, plus `check:smoke`, which loads a real world and fails if it does not come up. **Integration tests (§38.6), performance tests (§38.7) and the twelve-Servant playtest (§38.8) missing.** |
| 39 | Migration and versioning | **Missing** | No migration runner; the schema has no version stamp. |
| 42 | Terrain | **Partly** | Catalogue, panel model, MOV/Evade/damage modifiers and the annotation pass done (C1). **The periodic clauses and the `Region` behaviour that would populate areas from a scene are missing.** |
| 43 | Bounded fields | **Missing** | Named in the enums only. |
| — | Content | **3 of 29 Servants** | Heracles, Karna, **Asterios (D1)**. 12 effects of ~152. 5 class skills. 16 of 16 Command Spells (B1). |

---

## 45.3 The Combat Process, step by step

This is the single most important gap, because it is the part that *looks* finished. The state
machine has all six steps and drives through them; **two** of them still do nothing, down from
three.

| Step | Spec | Code | Status |
|---|---|---|---|
| 1 — Declaration | §12.2 | `resolveAttack` | **Done** |
| 2 — Reaction ladder | §12.4 | `advanceAttack`, `combat-process.mjs` | **Done** — five rungs, Luck contests, collapsing |
| 3 — Damage | §12.5 | `applyDamage` | **Done** — full 16-stage pipeline |
| 4 — Injury Roll | §12.6 | `rules/injury.mjs`, `attack.mjs` `applyInjury` | **Done (A3)** — `injuryCheck` reads `flags.exceededInjuryThreshold`, 1d4 off Agility |
| 5 — Facing | §12.7 | `applyFacing` | **Done** |
| 6 — Counter | §12.8 | `process.canCounter`/`beginCounter`, `attack.mjs` | **Done (A4)** — offered when eligible, resolved as a full nested Process |
| AoE fan-out | §12.10 | `process.beginFanOut`, `resolveAttack` | **Done (A2)** — one Process, one card and one ladder per defender, sharing a `groupId` |
| Interrupts | §12.11 | — | **Missing** |

The AoE case deserved the emphasis it got: a Noble Phantasm that hit seven units damaged one of
them, and nothing reported it — the card showed a correct calculation against a correct target
and the other six were silently dropped. The comment above the code even said *"One Combat
Process per target"*, which is what made it so easy to read past.

As of A2 that is what it does. Each defender gets its own Process, its own card and its own
ladder, and they share a `groupId` so the fan-out is still recoverable as one attack — needed
because the attacker's budget is spent once for the group (it always was: `budget.spend` runs
before the fan-out, unchanged) and because counters resolve across the whole group *"sequentially
in turn order"* rather than per-card.

---

## 45.4 Rule elements: collected versus consumed

Thirty executors exist. Their output lands in eleven buckets, of which **four have no reader**.

| Bucket | Consumed by | Status |
|---|---|---|
| `modifiers` | damage pipeline, checks | **Live** |
| `statDeltas` | `FGTActor#prepareDerivedData` | **Live** |
| `checkModifiers` | `checkPlan` → Evade, Luck | **Live** |
| `autoSucceeds` | `evade` | **Live** |
| `immunities` | `effect-applier` | **Live** |
| `damageNegation` | `attack.mjs`, stage 12 | **Live** |
| `attributes` | targeting relations, pipeline predicates | **Live** |
| `magicResistance` | stage 11 | **Live** |
| `eventHandlers` | `scheduler.fireEvent` | **Live** — as of A1; see below |
| `grantedAbilities` | `rules/granted.mjs` → movement, budget | **Live** — as of B3 |
| `suppressions` | — | **Collected only** |

Two more that are subtler than "collected only", because they *look* wired:

- ~~**`Aura` writes into `modifiers`**~~ — **repaired (A5).** It wrote into the owner's
  `modifiers` bag carrying `radius` and `relations` fields the damage pipeline does not read, so
  the contribution reached its own owner at any distance regardless of relation. It was a live
  wrong answer rather than an inert one, which is why it was the most urgent defect here.

  `Aura` now fills its own `auras` bucket, and `rules/auras.mjs` expands it. Writing into
  `modifiers` is what made the defect look plausible in the first place: the value landed in a
  bag the pipeline reads, so it appeared wired, and the two fields riding along with it were
  silently dropped. The bound modifier no longer carries `radius` or `relations` at all —
  addressing is answered before the pipeline ever sees it.
- **The four targeting executors** — `TargetingModifier`, `ForceTarget`, `Decoy`, `WeakPoint` —
  write keys that nothing in the targeting resolver reads.

### The layer rule was documented, computed and unenforced

Found while writing C2, and the same shape as everything else in this chapter.

`eslint.config.mjs` has computed a `zones` table since the project started. Its header calls the
layer boundary *"the rule that matters here"* and says a violation *"is a lint failure rather
than a code review comment"*. It was neither: `zones` was exported and **nothing consumed it**,
because enforcing it needs `eslint-plugin-import`, which is not a dependency.

It surfaced honestly — `rules/environment.mjs` imported `engine/intents.mjs`, and lint passed.

`tools/check-layers.mjs` now enforces `ALLOWED` and runs as part of `npm run lint`. It found
**three pre-existing violations**, which are recorded as named exceptions with the reason each
exists rather than waved through by widening the table:

| File | Imports | Why |
|---|---|---|
| `documents/combat.mjs` | `engine` | Turn order is pure and belongs in `rules`; moving it clears this. |
| `engine/attack.mjs` | `apps` | The Process state lives on a chat message flag (Ch. 27), so orchestrator and card are genuinely coupled. The fix is an event, not a re-parenting. |
| `net/operations.mjs` | `engine` | The static `validate` import; the engine entry points are dynamically imported on purpose. |

A **stale** exception fails the check too, so the list shrinks as the debt is paid instead of
ossifying.

### The `fireEvent` defect — **repaired (A1)**

`scheduler.fireEvent` used to collect `handler.intents`:

```js
for (const handler of u.eventHandlers ?? []) {
  if (handler.event !== event) continue;
  out.push(...(handler.intents ?? []));      // ← never present
  out.push(I.log({ kind: "event", ... }));
}
```

The `OnEvent` executor stored the element's own shape — `{event, revive: {table, …}}` — and never
an `intents` array. So every event handler in the game contributed **a log line and nothing
else**.

Three changes close it:

1. **`normalizeHandler` (L2).** `OnEvent` now produces `{events, actions, automatic, abilityId,
   source}`. `events` is always a list, so Fragarach's two-event subscription is the ordinary
   case rather than a special one. Every rank-dependent lookup is resolved *here*, because rank
   is in scope at collection time and nowhere downstream — a `4d20` that is not settled now can
   never be settled.
2. **An action table in `fireEvent` (L3).** Ch. 24 §24.5's action vocabulary — `Damage`, `Heal`,
   `StatDelta`, `ApplyEffect`, `RemoveEffect`, `ResourceDelta`, `CooldownDelta`, `Message`, plus
   `Revive` from the `revive:` shorthand. An **unknown action logs itself by name** instead of
   doing nothing quietly, which is the specific failure this whole chapter is about.
3. **`resolveDefeat` (L3), the reader `unitDefeated` never had.** Nothing in the system emitted
   a defeat when Health reached zero, so the event that Battle Continuation is written against
   was never raised by anybody. `applyDamage` now calls it, and a unit that revives is never
   defeated in the first place rather than being defeated and then healed.

Still inert, and now on the list rather than buried: **the Sustainability drain** (Ch. 16) has no
`OnEvent` authored against it at all, so it is a content gap rather than an engine one.

Dice keep the "caller rolls" contract the rest of layer 3 uses: `fireEvent` is pure and reads
totals from `ctx.rolls`, and `pendingRolls(unit, event)` tells the impure caller which formulas
to roll first — so the attack flow does not have to know what Battle Continuation is.

---

## 45.5 The completion plan

Ordered so that **each step is independently testable and leaves the system working**. Steps
1–4 are correctness repairs to things that already appear to work, and should come first for
that reason: a silent stub is worse than a missing feature.

Each step names its **test gate** — what must pass before it is considered done.

### Phase A — finish what is already half-built

**A1. Fix `fireEvent` and make events real.** *(small)* — **DONE.**
The `OnEvent` executor stores a normalized handler and `fireEvent` dispatches it through an
action table. *Test gate met:* `test/unit/events.test.mjs` — a unit with Battle Continuation B at
0 Health produces a revive for the rolled `battleContinuationRevive` value (plus the per-step
bonus at B+), sets `battleContinuationCooldown` on the skill itself, and is defeated rather than
revived while that cooldown is running. 13 tests.

Two things came out of the work that were not in the plan. The first is that **nothing emitted a
defeat when Health hit zero** — the event had no raiser, not just no reader — so `resolveDefeat`
had to be written and called from `applyDamage` before the revive could be reached at all. The
second is that `◈` is a *Round*: `battleContinuationCooldown`'s `3◈` is nine turns of
`cooldownRemaining` at three turns to the Round, not three. The first test written asserted `3`
and was wrong.

**A2. The AoE fan-out.** *(medium)* — **DONE.**
`process.beginFanOut` builds one Process per target and `resolveAttack` gives each its own card
and ladder.
*Test gate met:* `test/unit/aoe.test.mjs`, 9 tests — four defenders produce four processes with
their own defenders in target order; states are values, so advancing one leaves the others
untouched, which is what "reacts independently" means here; and the budget is spent once because
`budget.spend` runs before the fan-out begins and is not part of it.

Three things worth recording. A **single** caught unit is deliberately *not* an AoE resolution —
facing still applies and a card claiming a fan-out over one defender would be a lie. A resolution
that caught **nobody** keeps its single null-defender Process, because a ground-placed
non-damaging NP is a real resolution with no defenders. And the `groupId` exists for A4: counters
resolve across the group in turn order, which per-card state cannot express.

Not yet done from §12.10's sketch: the **batched** damage pass. Damage is still computed and
applied per Process rather than as one synchronous pure batch across all defenders. That is a
performance shape, not a correctness one — each defender's number is right — so it is left for
when 12-defender NPs actually exist to measure.

**A3. The Injury Roll.** *(small)* — **DONE.**
`rules/injury.mjs` decides, `attack.mjs` `applyInjury` rolls the `1d4` and takes it off Agility.
*Test gate met:* `test/unit/injury.test.mjs` — damage over 100 triggers the roll, and damage over
100 that is *only* over because of Def Crk does not, because the check reads the pipeline's
pre-stage-16 flag rather than comparing the total to 100 itself. Also covers survival, zero
damage, Light Wound, and the Golden Hind NP-only override. 7 tests.

Two clauses of §12.6 are **named rather than quietly skipped**. `Light Wound` is a parameter the
check honours, but no rung of the reaction ladder offers it yet, so nothing sets it — that rung
is D3 work. Multi-hit attacks should perform *one* roll on the total; today one Combat Process
means one roll, which is right until A2 makes multi-hit real.

**A4. The Counter.** *(medium)* — **DONE.**
`beginCounter` builds the nested Process with the roles swapped, and `attack.mjs` decides
eligibility, offers the choice on the card, and runs it.
*Test gate met:* `test/unit/counter.test.mjs`, 21 tests — `beginCounter` swaps attacker and
defender and marks `isCounter`; `canCounter` refuses a marked process, which is the property that
actually stops the recursion; and the counter runs a full ladder from `declare` with its own
history rather than inheriting the original's.

`canCounter` already existed and **was never called** — step 6 advanced past it unconditionally.
It was also missing four clauses of §12.8, all now present and all derived from the board by the
caller rather than taken on faith: Berserk, Fragarach (Mannanán trades the normal counter for an
automatic one), Presence Concealment against a slower defender, and the no-counter-of-a-counter
rule itself.

The rung is **conditionally prompting**, which is new: `pendingPrompt` returns a counter prompt
only when the orchestrator has recorded `counterAvailable`, so an ineligible defender is never
stopped to be asked a question with one answer. `promptOptions` needed a `counter` branch of its
own — without it the card fell through to the Luck Check branch and would have rendered a
"Contest" button emitting an event this rung has no transition for.

Not done: `sleepRemovedThisPhase` from §12.8's sketch. It is Process-scoped state that nothing
tracks, and adding the clause against a field nobody writes is the defect Phase A spent its time
removing. Counters also do not yet resolve *"sequentially in turn order"* across an AoE group —
each card offers independently. The `groupId` A2 added is what that will hang off.

**A5. Auras.** *(medium)* — **DONE.** *(Taken out of order, ahead of A2 and A4: this was the
only defect in Phase A producing a wrong number rather than no number, and this chapter's own
ranking puts a wrong answer above a silent stub.)*

`rules/auras.mjs` expands each aura onto the units in range whose relation matches, and
`snapshotBoard` runs the pass once every unit is projected — the same place and for the same
reason as `annotateZon`. Collecting for all units against the untouched board before writing any
of it back is what stops an aura feeding an aura, and makes the result independent of visit
order.

*Test gate met:* `test/unit/auras.test.mjs`, 13 tests — reach and non-reach by radius, self
included by default and excluded when the relation list says so, ally/enemy filtering,
nearest-panel distance for multi-panel sources, `highestOnly` resolved across all sources against
one that stacks, provenance recorded for the explainer, and `radius`/`relations` proven absent
from what the pipeline receives.

### Phase B — the missing player-facing systems

**B1. Command Spells.** *(large)* — **catalogue and spend flow DONE; the interrupt OFFER is not.**

*Test gate met on two of three clauses:* `test/unit/command-spells.test.mjs`, 22 tests — a spend
is refused when the Master lacks the charges, and the audit log records who spent what, on whom,
at which window and on which tick (§17.8). The third clause, "each command in the catalogue
resolves", is **partly** met: see the effect table below.

- **The catalogue is content.** All 16 commands from §17.2 are authored in
  `packs/_source/command-spells/` and compile into the `command-spells` pack. `CommandSpellData`
  and the content compiler now carry `requirements`, `timing`, `blockedWhen`, `effect`,
  `costByMasterRank` and `permanentConsequence` — without which the catalogue built into items
  that knew their name and cost and nothing about when they could be used or what they did.
- **The spend flow works end to end.** `rules/command-spells.mjs` decides, `engine/command-spells.mjs`
  pays and writes, and a `spendCommandSpell` socket operation authorizes it to the Master's owner.
  Order is validate → pay → apply, because paying first burns a charge on a refusal.
- **Cost varies correctly.** Kill Yourself is 1 for a High Rank Master, 2 for a Low Rank one, and
  1 for everyone when the whole table is Rankless.
- **Unusable commands are never offered.** §17.6 requires Van Gogh's immunity to be checked at
  offer time "so the option never appears"; the same argument covers cost and every other
  requirement, so `availableCommands` returns only what can actually be spent.

**A test caught a real defect while this was being written**, and it is the reason the guard
exists: the authored catalogue used two requirement kinds (`notInZone`, `noOtherRevival`) that
`meets()` did not implement. Unknown kinds refuse — the safe direction — so **Escape and Survive
Kill would have compiled, loaded, appeared in the pack and been unusable by anybody, silently.**
`REQUIREMENT_KINDS` is now exported and a test holds the shipped catalogue against it.

Effect kinds, honestly:

| Applied | Logged by name, not applied |
|---|---|
| `statChange` (Half/Full Heal), `defeat` (Kill Yourself), `cureDebuffs`, `cooldownDelta` (Reduce/Full/All), `survive` (Survive Kill) | `modifyDamage` (Damage Block/Up, Halve NP, NP Max), `teleport` (Teleport Servant, Escape), `overrideValidation` (Force NP, Kill Humans) |

The right-hand column needs the **interrupt protocol** rather than more effect code: those
commands change a resolution that is already in flight, which means suspend/serialize/resume
around a Combat Process, a non-blocking offer with §17.4's 45-second timeout, and a
"spend to override" affordance in the targeting preview (§28.8). The window logic and
`offerCommands` are in place and tested; what is missing is the UI that asks and the Process
plumbing that suspends. An unapplied effect **logs itself by name** rather than resolving
silently, because a Command Spell that quietly does nothing is the worst outcome for the most
expensive resource in the game.

*(There is no B2. The labels drifted at some point — A5 was filed under Phase B, and the gap
was left behind. A5 is back in Phase A above; the B numbers are kept as they are so that
references to B3 and B4 elsewhere still resolve.)*

**B3. Granted and copied abilities.** *(medium)* — **grants DONE, copies open.**
*Test gate met:* `test/unit/granted.test.mjs`, 10 tests — Riding contributes its three passives,
a Servant without Riding has none, and the double move is granted or refused **by reading the
grant**.

The plan's framing ("real items on the actor, or virtual entries on the sheet") turned out to be
the wrong question for the Riding case, and the reason is worth recording. `doubleMove`,
`ridingAttack` and `passengerSeat` **have no content anywhere** — they are not ability documents
waiting to be granted, they are *capabilities* the engine asks about. And the double move already
worked, through a completely separate `hasSkill(actor, "riding")` name-match.

So the defect was not "the grant does nothing". It was **two mechanisms for one rule, one of them
inert**: a Servant granted the double move by a Master Essence, by Semiramis's *Double Summon*,
or by one of Scáthach's copies would not have got it, and every future granted capability would
have needed its own bespoke check somewhere in the engine. `rules/granted.mjs` makes the grant
the input, and `planMovement` and `canConsume` now read it. The old `hasRiding` flag stays as a
fallback so a world whose Riding item predates the rule element does not silently lose its second
move.

`passengerSeat` is granted and **nothing reads it**, which is honest rather than hidden: it needs
platforms (Ch. 20 / C3).

Still open — the **copy** half of §15.7: Scáthach's *Wisdom of Dún Scáith*, the `copyable` field
with its four refusal reasons, and the GM-facing selection dialog. That is a real feature, not a
wiring gap, and it is the part §15.7 spends its length on.

**B4. Ability costs and requirements.** *(medium)* — **DONE.**
`rules/costs.mjs` answers "can this be used, and what does it cost" in one call, and
`resolveAttack` validates at declaration and pays at confirmation — §15.4's own decision, so that
cancelling during targeting costs nothing.
*Test gate met:* `test/unit/costs.test.mjs`, 17 tests — the Master Health cost by both columns
and by rank step, the rankless-Master case, Free Servants paying Sustainability instead, Free
Servants with no clock paying double in their own Health, the cooldown gate, the NP round gate,
the ZON gate, and the strict-comparison boundary.

`npCostByRank` and `freeServantNPSustainabilityCost` had been sitting in `domain/tables.mjs`
since the tables were transcribed with **nothing reading either of them**: using a Noble Phantasm
cost its Master nothing at all. The same shape as ZON and `fireEvent` — data that loads
correctly and is never asked a question.

Two details worth keeping. The Health comparison is **strict** — *"cannot use its NP if its
Master's Health is equal to or less than the amount that would be lost"* — so a Master at exactly
50 cannot pay a 50-cost NP, and the refusal message says "MORE than 50" because that is the half
people get wrong. And the cost is paid with `statDelta`, never `damage`: it is Health *loss*, not
damage, so it must not trigger `Dmged NP Regen` or an Injury Roll. Paying it as damage would make
every Noble Phantasm feed its own Master's triggers.

`requiresRound` is authored in `targeting.limits`, the same untyped object `requiresZon` already
lives in — a gate content can write today rather than a schema field waiting to be invented.

Not done from §15.4's type list: `hasSkill`, `inZone`/`notInZone`, `modeActive`,
`counterpartAdjacent`, `targetHasEffect` and the `predicate` escape hatch, plus Karna's
`supersedes` override. The three the plan named are in.

What follows is kept because the shape of the defect is worth remembering.

The ZON case was the instructive one: the *check* was fully implemented in two places —
`resolve.mjs` refuses an NP when `caster.outsideZon`, and the damage pipeline applies the stage-9
ZON penalty on the same flag — but **nothing ever computed `outsideZon` or `zonDistance`**. Both
were projected straight from actor fields that no code wrote, so both read `false`/`null`
forever. Two correct implementations of a rule, fed by an input that did not exist.

That is the failure mode to keep looking for: not a rule that is wrong, but a rule that is right
and inert. `fireEvent` (A1) is the same shape, and so was every defect found while play-testing —
a projection that produced a value nothing could act on.

### Phase C — the world

**C1. Terrain.** *(medium)* — **standing modifiers DONE; the periodic clauses are not.**
*Test gate met:* `test/unit/terrain.test.mjs`, 24 tests, including the table test the gate asks
for — MOV and Evade for every type that changes them, with the attribute gates (`Swimsuit!`,
`Santa`, `Levitating`) that a third of the catalogue turns on.

`rules/terrain.mjs` holds the catalogue and `snapshotBoard` runs `annotateTerrain` beside
`annotateAuras`. That placement is the chapter's own observation: terrain is *"mechanically a
positional aura whose source is a region rather than a unit"*, so it is the A5 pass with a
different source. It is also why terrain cannot be dispelled, cured or resisted, and why leaving
ends it instantly — a unit never carried it.

`effectiveMov` applies the terrain delta **after** Slow and additively: Slow halves what the unit
has, while a Forest costs a panel of whatever is left. Halving after the terrain penalty would
make difficult ground twice as expensive to a Slowed unit, which no rule says.

**Absent rather than half-present**, and this is deliberate: every *periodic and event-driven*
clause. Burning's inescapable `Burn`, Poison Swamp's end-of-turn stage roll, the Forest→Burning
coin flip, Lava's and Frozen's and Magnetic's on-entry consequences, Eldritch's Horrors, Meadow
reverting after a Damage Step, Underworld's `Near-Death`. Those need the scheduler and the
movement hooks, not the catalogue table, and a half-entry in the table would look implemented.
Six of the nineteen types are therefore registered with **no** standing effects at all
(Poison Swamp, Thunderstorm, Dead Zone, Magnetic, Underworld, Universe, Halloween, Labyrinth) —
which the catalogue says out loud rather than omitting them.

Also not done: terrain as **`Region` documents** with a `fgt.terrain` behaviour (§42.1, §22.10).
The rules read `board.terrain.areas`; nothing yet populates it from the scene, so this is live
for any caller that supplies areas and dormant in a real world until the region behaviour
exists.

**C2. Environment.** *(large)* — **Day/Night, Home Base and the Grail DONE; Region and Random
Events are not.**
*Test gate met:* `test/unit/environment.test.mjs`, 33 tests — the cycle alternates from either
opening flip, the `Dark` effects apply and lift with it, and the Grail's contest state is tracked
through materialization, acquisition and destruction odds.

`rules/environment.mjs` holds all three and `snapshotBoard` runs `annotateEnvironment` beside
terrain and auras — same place, same reason: these are facts about the *field*, and a unit
projected alone cannot know which Round it is or whose ground it is standing on. `endRound` maps
the Home Base descriptors into intents.

Details worth keeping:

- **The phase is a pure function of the round number**, not stored state. One coin flip at the
  start, so nothing can drift and a reconnect cannot lose it.
- **The `Dark` rule carries no `npValue`.** Both clauses are "including NP", and an `npValue`
  would silently halve them. None of the 12 reference Servants carry `Dark`, so this is inert in
  play today — implemented anyway, because a rule that looks implemented and is not is the
  failure this chapter exists to prevent.
- **E1's exclusion is narrower than it reads.** Only combat *within the base* disqualifies, so a
  unit that sortied out, fought and came home still regenerates.
- **The Grail's two distances differ.** A claimant must be adjacent (Chebyshev 1); a blocker need
  only be in the 2-panel Area. Conflating them would let a unit claim the Grail with an enemy two
  panels away. Two adjacent rivals are a standoff, which is intended.

Not done: **Region** (§19.3), **Random Events and Civilians** (§19.5), the **board setup
sequence** (§19.7), **E5** Territory Creation amplification, and the victory conditions. The
Grail functions are pure and complete but **have no runtime owner** — nothing on the Combat
document holds a `GrailState` yet, so materialization is reachable only by a caller that keeps
the state itself. That is named here rather than left to be discovered.

**C3. Platforms and levels.** *(large)* Ch. 20 — the three reference platforms, movement linkage,
cross-level targeting.
*Test gate:* a unit on a platform moves with it; cross-level melee is refused and cross-level
ranged is not.

**C4. Bounded fields.** *(large)* Ch. 43 — membership, permeability, escape.

### Phase D — content and polish

**D1. The remaining 26 Servants** — **STARTED.** `packs/_source/servants/asterios.yml`, converted
from `char_orig_sheets/Copia de Asterios.md`, with three new abilities and four new effects.

It found four gaps in one Servant, which is the argument for running this phase continuously
rather than last:

1. **`ApplicationChance` had no executor.** It is named in Ch. 24 Group 6 and accepted by the
   content validator, and nothing implemented it — so `Off.Debuff ResUp` compiled and did
   nothing. Worse, `effect-applier` read `ctx.resist` and **no caller ever supplied it**, so the
   whole resistance path was dead at both ends. The executor now fills an `applicationChances`
   bucket, the snapshot carries it, and `applyEffect` reads it off the target.
2. **Four effects did not exist**: `critUp`, `nAtkUp`, `bleedAtk`, `offDebuffResUp` — and
   `bleed`, which `scheduler.PERIODICS` has always known how to tick without there being any
   definition to inflict. All five are authored.
3. **The rule-element vocabulary is maintained twice** — `RULE_ELEMENT_KEYS` in
   `tools/lib/content.mjs` and `EXECUTORS` in `module/rules/elements.mjs`. The paired tests in
   `elements.test.mjs` caught the drift the moment the new executor was added, which is exactly
   what they are for.
4. **Mad Enhancement has no lockout field.** Asterios' cannot be deactivated until 2◈ after it
   was activated, and vice versa; the class-skill template has nowhere to say so. Heracles never
   surfaced this because his simply cannot be deactivated at all.

`Chaos Labyrinthos` is **deliberately not authored**. It is a 9×9 bounded field with membership,
an escape check whose chance climbs 5% per failure, per-unit escape history, allies led out by
someone who has escaped before, and a hard rule that units inside and outside cannot affect one
another — which is Ch. 43 almost in its entirety, and therefore C4. A stub applying its Atk Dwn
and Def Dwn without the containment would be worse than nothing: it would look like the
Labyrinth worked.

**D2. The remaining ~145 effects** from Appendix A.

**D3. Undo** (§18.7), the **game log** (§30.8), **zone overlays** (§28.9), the **Master sheet**,
the **token HUD** and the **ability editor**.

**D4. Migration** (Ch. 39) — needed before the first release that changes a schema in a way that
invalidates existing worlds. Not before.

---

## 45.6 Suggested order, with reasoning

```
A1 ✔ A2 ✔ A3 ✔ A4 ✔ A5 ✔    PHASE A COMPLETE. Order run: A1, A3, A5, A2, A4 -- A5 pulled
                         forward because a wrong number outranks a silent stub, which outranks
                         a missing feature
B4 ✔ → B3 ✔              costs after auras, because a cost may read an aura-modified value;
                         B3's grants are done, its COPY half (Scathach) is not
B1 ~                   Command Spells: catalogue and spend flow done; the interrupt protocol
                       is what remains, and it is the harder half
C1 ~ → C2 ~            terrain then environment. C1's standing modifiers are done, its periodic
                       clauses need the scheduler; C2 has Day/Night, Home Base and the Grail,
                       and still wants Region and Random Events
D1 ~ (continuous)      author Servants alongside, not after — they are the real test suite.
                       Asterios done; he found four gaps on his own
C3 → C4                platforms and bounded fields; the most self-contained, the least urgent
D2 → D3 → D4
```

The one ordering constraint that is not obvious: **D1 should run continuously alongside B and C,
not after them.** Every Servant authored so far has found an engine gap — Karna found the
`equality` table kind, Heracles found the Def Dwn family and the mode/attack conflation. Twenty-
seven more Servants is twenty-seven more chances to find a defect while the surrounding code is
still fresh.

---

**Previous:** [44 — Case Studies: the Expanded Roster](44-case-expanded-roster.md)
