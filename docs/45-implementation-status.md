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
domain are all implemented and carry 663 tests.

What is missing is almost entirely in **layer 3 and layer 4** — the orchestration that connects
the rules to the game, and the interfaces that let a player reach them. Concretely:

1. **The Combat Process runs four of its six steps.** Damage resolves, and the **Injury Roll**
   is live as of A3. The **Counter** and the **AoE fan-out** are still stubs.
2. **Command Spells do not exist as a flow.** The intent, the schema and the resource all exist;
   nothing spends them, and the interrupt protocol (Ch. 17 §17.4) is unimplemented.
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
6. **Six of the eight environment subsystems are missing**: Home Base, Day/Night, Region, the
   Grail, Random Events, and Terrain as a live rule (the snapshot carries a `terrain` field that
   nothing populates).
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
| 12 | Combat Process | **Partly** | See §45.3 — two of six steps are stubs (Counter, AoE fan-out). |

### Part II — resolution systems

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 13 | Damage pipeline | **Done** | 16 stages, both worked examples are golden fixtures. |
| 14 | Checks and randomness | **Mostly** | Evade, Luck, chance rolls, `checkPlan` done. **The roll log (§14.8) and setup rolls (§14.9) missing.** |
| 15 | Abilities | **Partly** | Classification, phases (`damage`, `applyEffects`) done. **Costs and requirements (§15.4), granted/copied abilities (§15.7), items (§15.8) missing.** |
| 16 | Relationships | **Partly** | Master protection is enforced by movement. **ZON is derived and both consumers fire**, including the Semiramis exemption and the Dioscuri's `any`-across-twins test. **Contracting, Overpower/Underpower, Sustainability drain and the multi-Servant tax are missing.** |
| 17 | Command Spells | **Missing** | Schema and `spendCS` intent exist; no flow, no interrupt protocol, no catalogue content. |
| 18 | Action economy | **Mostly** | Budget, per-unit limits, prevention, compulsions done. **Undo (§18.7) and Confuse's random selector (§18.5) missing.** |
| 19 | Environment | **Missing** | Home Base, Day/Night, Region, Grail, Random Events all absent. |
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
| 38 | Testing strategy | **Mostly** | 663 unit and golden tests, plus `check:smoke`, which loads a real world and fails if it does not come up. **Integration tests (§38.6), performance tests (§38.7) and the twelve-Servant playtest (§38.8) missing.** |
| 39 | Migration and versioning | **Missing** | No migration runner; the schema has no version stamp. |
| 42 | Terrain | **Missing** | The snapshot has a `terrain` field; nothing writes or reads it. |
| 43 | Bounded fields | **Missing** | Named in the enums only. |
| — | Content | **2 of 29 Servants** | Heracles, Karna. 7 effects of ~152. 5 class skills. |

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
| 6 — Counter | §12.8 | `attack.mjs` `case "counter"` | **Stub** — `case "counter": return process.advance(state, "done")` |
| AoE fan-out | §12.10 | `resolveAttack` | **Stub** — `defenderId: targets.units[0]` resolves the **first target only**; the rest are counted for the `isAoE` flag and then discarded |
| Interrupts | §12.11 | — | **Missing** |

The AoE case deserves emphasis: a Noble Phantasm that hits seven units currently damages one of
them. Nothing reports this — the card shows a correct calculation against a correct target, and
the other six are silently dropped.

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
| `grantedAbilities` | — | **Collected only** |
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

**A2. The AoE fan-out.** *(medium)*
`resolveAttack` creates one Combat Process **per target**, each with its own reaction ladder and
its own card, sharing one damage roll where the rules say so (§12.10).
*Test gate:* a 5×5 NP over four defenders produces four processes; each defender may react
independently; the attacker's budget is spent once.

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

**A4. The Counter.** *(medium)*
Implement step 6: the counter sub-process from §27.10, which is a nested attack with the
attacker and defender swapped, no counter-of-a-counter, and no budget cost.
*Test gate:* a successful counter-check produces a second damage resolution in the opposite
direction, and that resolution cannot itself be countered.

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

**B1. Command Spells.** *(large)*
The catalogue as content, the spend flow, and the interrupt protocol (§17.4) — including the
inline "spend to override" affordances the targeting preview already has a slot for (§28.8).
*Test gate:* each command in the catalogue resolves; a spend is refused when the Master lacks
the charges; the audit card shows who spent what and when.

*(There is no B2. The labels drifted at some point — A5 was filed under Phase B, and the gap
was left behind. A5 is back in Phase A above; the B numbers are kept as they are so that
references to B3 and B4 elsewhere still resolve.)*

**B3. Granted and copied abilities.** *(medium)*
`grantedAbilities` becomes real items on the actor, or virtual entries on the sheet.
*Test gate:* Riding's `doubleMove`, `ridingAttack` and `passengerSeat` appear on a Servant with
Riding and disappear when it is removed.

**B4. Ability costs and requirements.** *(medium)*
§15.4 — Health costs, cooldown gates and the NP round gate. **The ZON input is done** and its
test gate is met; what follows is kept because the shape of the defect is worth remembering.

The ZON case was the instructive one: the *check* was fully implemented in two places —
`resolve.mjs` refuses an NP when `caster.outsideZon`, and the damage pipeline applies the stage-9
ZON penalty on the same flag — but **nothing ever computed `outsideZon` or `zonDistance`**. Both
were projected straight from actor fields that no code wrote, so both read `false`/`null`
forever. Two correct implementations of a rule, fed by an input that did not exist.

That is the failure mode to keep looking for: not a rule that is wrong, but a rule that is right
and inert. `fireEvent` (A1) is the same shape, and so was every defect found while play-testing —
a projection that produced a value nothing could act on.

### Phase C — the world

**C1. Terrain.** *(medium)* Ch. 42 — the panel model, the movement cost hook, and the damage
modifiers. The snapshot field already exists; populate it from the scene.
*Test gate:* each terrain type's documented effect on movement and damage, as a table test.

**C2. Environment.** *(large)* Ch. 19 — Home Base, Day/Night, Region, the Grail, Random Events.
*Test gate:* the day/night cycle advances on the documented schedule and its effects apply and
lift; Grail contest state is tracked.

**C3. Platforms and levels.** *(large)* Ch. 20 — the three reference platforms, movement linkage,
cross-level targeting.
*Test gate:* a unit on a platform moves with it; cross-level melee is refused and cross-level
ranged is not.

**C4. Bounded fields.** *(large)* Ch. 43 — membership, permeability, escape.

### Phase D — content and polish

**D1. The remaining 27 Servants**, in the order of the case-study chapters (31–36, 44), each with
its own regression fixture. This is the phase that finds engine gaps, so it should not be last.

**D2. The remaining ~145 effects** from Appendix A.

**D3. Undo** (§18.7), the **game log** (§30.8), **zone overlays** (§28.9), the **Master sheet**,
the **token HUD** and the **ability editor**.

**D4. Migration** (Ch. 39) — needed before the first release that changes a schema in a way that
invalidates existing worlds. Not before.

---

## 45.6 Suggested order, with reasoning

```
A1 ✔ → A3 ✔ → A5 ✔ → A2 → A4  correctness repairs first; a stub that resolves silently outranks
                         a missing feature, and a WRONG number outranks both -- which is why A5
                         was pulled forward ahead of A2 and A4
B4 → B3                  costs after auras, because a cost may read an aura-modified value
B1                     Command Spells; large, and depends on the interrupt protocol
C1 → C2                terrain then environment; environment reads terrain
D1 (continuous)        author Servants alongside, not after — they are the real test suite
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
