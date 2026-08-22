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

The **pure rules core is complete**: the damage pipeline, targeting resolution, checks and the
roll log, movement legality, the effect application pipeline, the turn budget, ability costs and
all twelve requirement kinds, items, copied abilities, setup rolls and the rank/tick domain are
all implemented and carry 1723 tests, and 135 content files.

The last pure-rules gaps closed together: `rules/roll-log.mjs` (§14.8), `rules/setup-rolls.mjs`
(§14.9, §37.6), `rules/items.mjs` (§15.4's full kind list and §15.8) and `rules/copy.mjs`
(§15.7). Each was wired to a reader in the same pass — the log to the Process state and the chat
card, the setup rolls to `engine/summon.mjs`, the requirement kinds to `canUseAbility`, the items
to two new intents, the copies to `effectivePhases` — because this project's dominant defect is a
rule that is right and inert, and a pure module with no caller is exactly that.

**Parts II and III are complete.** All eight resolution-system chapters (13–20) and all ten
Foundry-architecture chapters (21–30).

Part II's four remaining items were §15.4's `supersedes`, §16.2's contracting, §28.8's
preview-time override affordance, and Ch. 20's Scene Level operations. The last of those was
checked against the Foundry v14 source rather than written from the chapter alone, which
surfaced a constraint the chapter did not state: `TokenDocument#level` is required and
non-nullable and Foundry does not re-parent tokens when a Level is deleted, so §20.9's
scatter-before-delete ordering is enforced by the schema rather than merely recommended.

**Part III — Foundry architecture — is complete.** All ten chapters (21–30) are implemented, with
one deliberate exception recorded as a decision rather than a gap: §26.6's shadow-actor pattern
for closed-information play stays deferred to Ch. 40, because that section assesses it and defers
it itself. Its practical half — per-viewer chat cards (§26.7) — is built.

Finishing it turned up three things that were specified and absent rather than merely unfinished:
§16.9's per-Servant Command Spell pools (a flat count could not say which Servant a spell
reached, so Unbound could not be derived at all), and two more registered-but-unread settings,
`masterMode` and `interruptTimeout`.

What is missing is almost entirely in **layer 3 and layer 4** — the orchestration that connects
the rules to the game, and the interfaces that let a player reach them. Concretely:

1. ~~**The Combat Process runs three of its six steps.**~~ — **all six run** as of Phase A.
   Damage resolves, the **Injury Roll** is live (A3), the **AoE fan-out** is real (A2) and the
   **Counter** is offered and resolved (A4). What remains in Ch. 12 is **§12.11 interrupts**,
   which is Command Spells and therefore B1.
2. ~~**Command Spells do not exist as a flow.**~~ — **done (B1)**. Catalogue, spend flow, offer
   filtering and the interrupt protocol; the six commands that rewrite an in-flight resolution
   mutate the Combat Process, and it resumes from wherever they left it.
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
6. ~~**Six of the eight environment subsystems are missing**~~ — **done (C1, C2)**. Home Base,
   Day/Night, Region, the Grail and Terrain are all live, with the Grail owned by `MatchData`
   and terrain areas read from the scene's Regions. Random Events stay GM-driven by design.
7. ~~**Platforms, levels and bounded fields are modelled in the schema and nowhere else.**~~ —
   **done (C3, C4)**. Platforms still lack the Scene Level operations (create, delete, scatter),
   which are logged by name rather than performed; bounded fields still lack the paint tool
   `freeform` needs and the two-phase `markDefined` construction.
8. **Only 7 of 29 reference Servants are authored.**

The system is at the point where **one player can attack another player and the damage is
correct and fully audited**. It is not yet at the point where a match can be played to a finish.

---

## 45.2 Status by chapter

### Part I — the domain model

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 04 | Units | **Done** | Six actor types, schemas, multi-panel footprints read by targeting, and the identity fields — `classContainer`, `concealedIdentity`, `identityRevealed`, `detect`, `defaultImage`. A Servant is publicly its class until revealed. |
| 05 | Ranks and parameters | **Done** | Grade-major ordinals, step arithmetic, `RankField`. |
| 06 | Stats and resources | **Done** | Including derived stat deltas as of `0.2.0`. |
| 07 | Time model (◈) | **Done** | `parseTick`/`resolveTicks`/overrides, and **Delay (§7.8)** — which was already implemented in `computeTurnOrder` when this row was written. The one clause that genuinely was not: a Delay declared against a faction that had already acted was **discarded** rather than deferred to the next round. `carryDelaysForward` fixes it. |
| 08 | Board and geometry | **Done** | Metrics, reachability, movement legality, and **Detect (§8.7)** — range with its 2-panel floor, the Discover chance from the concealed unit's Presence Concealment rank, and attempts marked GM-only and silent so the socket layer cannot leak them. **§8.6 was never a gap:** the chapter's own DECISION is *not* to implement line of sight, because F/GT has no such rule. Fog of war is Foundry's. |
| 09 | Targeting | **Done** | Eleven-step resolver, four anchors interactive, `legalPlacements`. |
| 10 | Effect taxonomy | **Done** | Classification vocabularies enforced by the content validator. |
| 11 | Effect engine | **Done** | Application, stacking, suppression, expiry, periodics, auras (§11.6), **Transfer (§11.8)** — a move that keeps the absolute expiry, rebased when one side has been Stopped — and **visibility (§11.10)**, where a debuff is also visible to whoever inflicted it. |
| 12 | Combat Process | **Done** | All six steps run (Phase A), and interrupts (§12.11) land through B1's Command Spell protocol. |

### Part II — resolution systems

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 13 | Damage pipeline | **Done** | 16 stages, both worked examples are golden fixtures. |
| 14 | Checks and randomness | **Done** | Evade, Luck, chance rolls, `checkPlan`, **the roll log (§14.8)** — records on the Process state, per-viewer filtering, GM re-rolls that keep the original — and **setup rolls (§14.9)**, where a Servant's Health takes no roll and a Master's is a coin-flipped `2d100` over a flat 250. |
| 15 | Abilities | **Done** | Classification, phases, **costs and all twelve requirement kinds (§15.4)** — and `canUseAbility` now *consults* them, which it did not. **Copied abilities (§15.7)** are `rules/copy.mjs` + `engine/copy.mjs`: `copyable` as per-ability data, copies by reference so a content fix propagates, and `effectivePhases` as the single reader. **Items (§15.8)** transfer and consume through their own intents. **The GM curation dialog and the player's pick are built (§36.4)**, and **`supersedes` (§15.4)** now resolves a whole set of pending costs against each other before any is charged — Karna's NP cost overwrites his Act cost, and the Hanging Gardens upkeep overwrites the NP cost the other way, both as authored data. |
| 16 | Relationships | **Done** | Master protection, ZON, **Overpower/Underpower (§16.5)**, **Sustainability on a Master's death (§16.6)** — where `null` is not zero — and **the multi-Servant tax (§16.7)**, flat and as a loss rather than damage, with its at-25-Health prohibition. **Contracting (§16.2)** is built: the adjacency and enemy-clearance gates, the four-row roll table, Independent Action as a *prohibition* at EX/A+ rather than a difficulty, the three namespaced Command Spells, and conquest — which frees and contracts in one descriptor list so the Free state the rules describe is never observable on its own. |
| 17 | Command Spells | **Done** | Catalogue (16), spend flow, cost variants, offer filtering, the interrupt protocol with its timeout, and **§28.8's preview-time "spend to override"** — rendered inline the moment a refusal appears, and only when the command is actually affordable, because an unusable option should never appear (§17.6). |
| 18 | Action economy | **Done** | Budget, per-unit limits, prevention, compulsions, **Confuse's random selector (§18.5)** — fully logged, and it may pick allies — and **Undo (§18.7)**, whose boundary is information disclosure: an unrecognised action is refused rather than rewound. |
| 19 | Environment | **Done** | Day/Night, Home Base E1–E5, the Grail with its runtime owner, Region and its adjacency graph, Civilians, victory conditions and the setup gates (C2). **The Random Event table stays GM-driven by design.** |
| 20 | Platforms and levels | **Done** | Model, movement linkage, cross-level protection, boarding, falling, destruction, the three reference platforms, and **the Scene Level operations** — create, scatter, delete, and the owner-effect reversal — sequenced in §20.9's order. That order is enforced rather than assumed: `TokenDocument#level` is required and non-nullable and Foundry does not re-parent on delete, so `destroyLevel` refuses while anyone is still aboard. |

### Part III — Foundry architecture

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 21 | System skeleton | **Done** | Bootstrap, settings, public API, CI, release workflow. |
| 22 | Data models | **Done** | All schemas present, including the four **Region behaviour** schemas (§22.10) that `system.json` had always declared without a model behind them. |
| 23 | Documents and derived data | **Done** | Preparation order, derived stats, the aura pass, the **spatial `AuraIndex`** (4×4 buckets, held against the linear scan by test) and **§23.9's invalidation table**, driving the canvas index, the overlays and the desync check. One honest correction recorded in the chapter: the table names a *snapshot cache* this system does not have, because `snapshotBoard` runs per resolution from the documents — you cannot serve a stale snapshot you never stored. |
| 24 | Rules engine | **Done** | 33 executors, predicates, explainability, validation, priority bands, and **`@intentional` (§24.6)** — an unmarked `priority` override is a build **error**, a marked one warns and names the band it lands between, and the marker must be prose because `true` explains nothing to the reviewer reading it a year later. |
| 25 | Turn system | **Done** | `FGTCombat`, turn order, scheduler, HUD, **charm/control transfer (§25.7)** — which follows the chain rather than stopping at one hop, with a cycle guard — and **§25.10's round-boundary desync detector**, hashing positions, health and effect ids and nothing else. |
| 26 | Authority and sockets | **Done (§26.6 deferred by decision)** | Typed operations, authorization, hidden rolls, `FGTSocket.ask`, and **per-viewer cards (§26.7)** — redaction by side, with unattributed rows kept because dropping them leaves a breakdown that does not add up. **§26.6's shadow actors stay deferred to Ch. 40 — that is this chapter's own decision, not a gap**: Foundry cannot hide part of a document, and the workaround doubles the document count for a failure mode that leaks the wrong thing. |
| 27 | Reaction protocol | **Done** | Message-chain state, prompts, collapsing, resumption, interrupt injection (§27.9), the counter sub-process (§27.10), and **per-rung timeouts (§27.5)** — GM-clocked, deadline stored on the message so no two clients disagree, and every default asserted to spend nothing as a property over the whole table. |
| 28 | Targeting implementation | **Done** | Canvas layer, four modes, preview, speculative damage, and **all seven §28.9 overlays** — Decoy pull, platform footprints with level badges and the Grail contest ring joined ZON, threat and Master protection. They now redraw from `fgt.invalidate` rather than a hand-maintained hook list. |
| 29 | User interface | **Done** | Unit sheet, ability sheet, turn HUD, chat cards, summon, Wisdom curation, the choice prompt, and the three that were missing: **Master sheet (§29.3)** — which required implementing §16.9's per-Servant spell pools first — **token HUD (§29.5)** and **the ability editor (§29.6)** with its illustrated targeting picker and live validation. |
| 30 | Chat and audit | **Done** | Cards, the damage explainer, **the game log (§30.8)** with its bounded storage and journal overflow, **the export (§30.9)** carrying rolls so replay is exact rather than re-simulation, and **GM overrides (§30.10)** recorded beside what they changed with the reason enforced in the rules layer. |

### Part IV — reference

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 37 | Content pipeline | **Done** | YAML → LevelDB, validator, stable ids, and **the summon operation (§37.6)** — an ordered, inspectable plan that rolls before it grants, keeps Master and Region grants as separate steps, and ends in a re-rollable confirmation — **with the dialog that shows it**, reached from the Actors sidebar and the Servant compendium, and refusing a bare compendium drop that would produce a Servant with the template's numbers. The validator also refuses an undocumented `copyable` refusal and a copy that carries its own phases. |
| 38 | Testing strategy | **Mostly** | 1723 unit and golden tests, plus `check:smoke`, which loads a real world and fails if it does not come up. **Integration tests (§38.6), performance tests (§38.7) and the twelve-Servant playtest (§38.8) missing.** |
| 39 | Migration and versioning | **Missing** | No migration runner; the schema has no version stamp. |
| 42 | Terrain | **Done** | Catalogue, panel model, standing/periodic/on-entry/conversion clauses, the annotation pass and the `Region` behaviour that populates areas from a scene (C1). |
| 43 | Bounded fields | **Mostly** | The six-axis model, NP tag ordering, the escape ladder with its veteran clause, isolation enforced by the resolver, and Chaos Labyrinthos authored (C4) — **and now a writer** (`engine/fields.mjs`): a field is a Region with an `npField` behaviour, created by a `createField` phase, expiring on an absolute tick at the Turn boundary, with `interiorEvents` for rules that fire at a boundary rather than standing. Everything in the chapter had a reader and none of it had ever run. **`freeform` needs a paint tool, `markDefined` a two-phase construction, and §43.9 scheduled detonation.** |
| — | Content | **7 of 29 Servants** | Heracles, Karna, Asterios, Penthesilea, Medea and **Scáthach** — the first Lancer, and the Servant who needed the most engine that did not exist. **All eleven abilities** resolve end to end in a live world, verified individually: *Primordial Rune* (a 2d8 table chosen by relation, duplicates applying twice, and a wildcard row that asks), the three *Primordial Rune Spells* (a PRS Token waiving the cooldown, and the other two gated while the used one runs), *Wisdom of Dún Scáith* (which **had never been able to copy anything**), *Clairvoyance*, *God Slayer* with *Alpi*'s two branches, *Gáe Bolg Alternative*'s Instakill-or-damage fork, and *Gate of Skye*'s per-target Luck Check with `gateOfSkyeSaveModifier`. She is also the first **Resource** pool (§6.10) and the first content to fire §E's `damageStepEnd`. 36 effects of ~152, including Appendix A's **terminal tier**. 5 class skills. 16 of 16 Command Spells. 3 platforms, 3 summons. |
| — | Content (EMIYA) | — | **EMIYA**, the first Archer, and the Servant whose sheet is written almost entirely in terms of **distance** — which nothing emitted. All **seventeen** abilities resolve end to end in a live world, verified individually. `attack:range:gte:N` / `lte:N` are new roll options and half his kit turns on them; `normalAttack.mode: rangeBanded` had been a declared choice since the actor schema was written with nothing implementing it, so his Normal Attack was plain STR at every distance (measured: 40 in melee, 72 at Range 3, and 80 versus 54 against a Rank A Magic Resistance depending on whether the exemption applies). He is the first content to need a **whole-match** budget rather than a cooldown (`timesUsed`/`maxUses`), the first **barrier** with its own Health pool (`Rho Aias`: one 1400 shared across four bearers, overflow passing through, 100 off its owner per completed 200), the first **round-scale** exclusion (`Caladbolg II` / `Hrunting`), the first `createField` (Unlimited Blade Works trapped eight Units and tolled three of them at the Turn boundary), and the second **Resource** pool. 50 effects of ~152. 6 class skills, including **Independent Action**, whose contract rule had shipped in `rules/contract.mjs` with no content to attach to. |
| — | Content (Medea) | — | **Medea**, the first Caster, and the densest sheet at thirteen abilities. **All thirteen** resolve end to end in a live world -- verified individually, including Dragon Tooth Warriors (two nested rolls, 5×5 placement, count-scaled cooldown), Rule Breaker (cuts the Contract, strips the Master's Command Spells, grants three namespaced ones), Rain of Light (a 3×3 AoE that proved the targeting system), Atlas (base 100 reduced to 75 by `target MAG B+ -25`), and Argos and Trofa offered **at the reaction rung** because "used when Attacked" cannot be reached from a sheet button. 21 effects of ~152. 5 class skills. 16 of 16 Command Spells. 3 platforms, 3 summons. |

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
| `applicationChances` | `effect-applier`, both directions | **Live** |
| `suppressions` | — | **Collected only** |

**A third failure mode, subtler than either.** A bucket can be live and its *contents* still be
unreachable. Collection runs per unit with only that unit's options in scope, and until Scáthach
was authored a predicate naming `target:` or `attack:` was **tested there and answered false** —
so the element never reached the bucket at all. Three shipped abilities were affected and none of
them looked broken: Penthesilea's *Goddess of War*, `NP DmUp`, and Scáthach's *God Slayer*. Such
predicates are now deferred onto the modifier for the pipeline to answer (Ch. 24 §24.4).

**A fourth, subtler again: the executor may drop the deferral.** Classification is only half of
it — the executor receives the deferred clause and has to put it somewhere a reader will look.
`OnEvent` ignored the argument entirely, so a handler gated on the attack fired
**unconditionally** (EMIYA's *Kanshou & Bakuya* projected at every distance, twice); and
`CheckModifier`/`TableOverride` had no field for one at all, so no check contribution could be
conditional on the attack (his *Hawkeye* raised his crit rate in melee, where the sheet gives him
nothing). Both repaired while building him.

**And a fifth, at the write boundary.** An intent produced by the effect pipeline has been through
immunity, exclusivity, the chance roll and the stacking rule. One produced by the **scheduler's**
`ApplyEffect` action has not — and `io.createEffects` is a bare create that asks nothing. So every
effect applied by an **event handler** skipped all four: an immune Unit took it, a resisted one
took it at full strength, and a `noneExtend` buff made a second document instead of extending.
Resolved intents are now marked, and `applyIntents` runs any that are not through the pipeline
first (Ch. 11 §11.2).

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
  write keys that nothing in the targeting resolver reads. **Partly repaired (D1):** the new
  `Compulsion` element covers the forced-target case (Berserk's nearest-enemy rule, Decoy's pull,
  Penthesilea's *Hatred of Achilles*) and step 4b of `resolveTargets` narrows a compelled unit's
  candidates to what it is compelled to attack. The other three keys still have no reader.

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

**B1. Command Spells.** *(large)* — **DONE, including the interrupt protocol.**

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

| Applied to the world | Applied to the Process |
|---|---|
| `statChange` (Half/Full Heal), `defeat` (Kill Yourself), `cureDebuffs`, `cooldownDelta`, `teleport` | `modifyDamage`, `escape`, `retarget`, `survive`, `overrideValidation` |

The right-hand column is applied too now. It needed the **interrupt protocol** rather than more
effect code, because those commands change a resolution already in flight — a property of the
state machine, not of the command.

`applyInterrupt` is a **GM-side mutation** (§27.9): it changes a Process another client is
participating in, which is why the GM arbitrates the ladder even though individual rungs are
answered by their owners. `test/unit/interrupts.test.mjs`, 18 tests.

- **Escape** sends the Process to `noDamage`.
- **Damage Block / Damage Up / Halve NP / NP Max** accumulate a damage factor applied to the
  finished total, because each is phrased against "Total Damage". The factors compose
  **multiplicatively** — Halve NP then NP Max must return to x1 in either order, and summing the
  deltas would give +50% both ways round.
- **Teleport Servant** replaces the defender and restarts the ladder at `react`, with
  `forbiddenReactions: [evade, block]` for the reactions the new defender never had a chance to
  declare. It refuses to move anyone without a destination the player chose.
- **Survive Kill** is recorded on the Process and honoured at the moment of defeat, not when
  declared — where it would heal a unit that was never going to die. It outranks the revive
  handlers: three Command Spells beat a skill.
- **Force NP** records an override consulted **per reason**, so it bypasses cooldown and
  uses-exhausted and still cannot bypass the Round gate, as §17.2 requires.

The offer is rendered on the attack card to whichever Masters could actually spend, computed per
viewer. Non-prompting rungs are held open by `awaitInterrupt` for the §17.4 timeout
(`commandSpellTimeout`, 45s, 0 disables) and **only when somebody could actually use a command
there** — a blanket 45-second pause on every rung of every attack would be unplayable. A window
that closes unused says so in the log.

Still absent: the "spend to override" affordance inside the **targeting preview** (§28.8), a
preview-time offer rather than a resolution-time one, and the Grail-destruction confirmation that
shares its shape (§19.4).

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

**C1. Terrain.** *(medium)* — **DONE.**
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

The periodic and event-driven clauses are in too, as three more functions — kept apart from the
standing table so it can stay a pure lookup:

| Kind | Function | When |
|---|---|---|
| Standing | `terrainEffects` | While the unit occupies the panel |
| Periodic | `terrainPeriodics` | At a turn or round boundary |
| On entry | `terrainOnEntry` | The moment a unit steps on |
| Conversion | `terrainConversions` | When an attack changes the ground itself |

Burning's inescapable `Burn` (and its Fire/Burn-resistance exemption), Poison Swamp's
poison-then-stage-roll, Eldritch's turn-start coin flip, Lava's entry damage, Frozen's Agility
Check, Magnetic's immobilization — including the clause that it **bypasses debuff resistance**,
without which it would be quietly cancelled by the units it is aimed at — the Forest→Burning
conversion with its "larger than 3×3" rule, and Meadow consuming itself after a Damage Step.

Chance clauses keep the "caller rolls" contract, keyed `terrain:<type>:<outcome>`. A clause whose
roll is **missing logs itself by name**: "the swamp did not add a stage" and "the swamp was never
asked" are different facts, and this chapter exists because the codebase kept losing that
distinction.

**`Region` behaviours are real** (§22.10). All four types were declared in `system.json` from the
beginning with **no data model behind any of them**, so an `fgt.terrain` behaviour on a Region
carried no type and no duration. `module/data/regions.mjs` supplies them, and `engine/board.mjs`
projects a scene's Regions into `board.terrain.areas` and its home-base zones — keyed by region
id rather than faction, because Semiramis's Hanging Gardens *"counts as a second Home Base"*.

Still empty by design: eight of nineteen types carry no *standing* effects, because their clauses
are entirely periodic or on-entry. The catalogue lists them rather than omitting them.

**C2. Environment.** *(large)* — **DONE.**
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

The rest of Ch. 19 is in too:

- **Region** (§19.3). The war's region grants every Servant from it a parameter step, applied as
  a **rank shift** so it flows through the same derived path as Enkidu's reduction and moves Base
  Attack with it. Matching is `any`, so Van Gogh benefits from a Greek, Dutch or European war. A
  curated, symmetric adjacency graph ships for *"directly next to"* — Semiramis is the only
  consumer, but a one-way edge would make her Construction counter depend on argument order, and
  a test enforces symmetry.
- **Civilians** (§19.5). A Civilian **never enters a Combat Process**: `resolveAttack` resolves
  the kill before one is built, because a ladder whose every rung has one outcome is not a
  ladder. The Good-alignment refusal names `Kill Humans` as its override and B1's
  `overrideValidation` carries it. The Lunatic ≥2 invariant is `civiliansNeeded`.
- **Victory** (§19.4), evaluated at round end. **Destruction is checked first**, so throwing an
  area NP over the Grail can never be a way to win — a player who destroys it while holding it
  has still ended the game with no winners.
- **The setup gates** (§19.7): the region choice, the day/night flip, and Round 1's attack ban,
  refused at declaration with the rule named rather than surfacing as an unexplained targeting
  error.
- **E5**, keyed on where the **owner** stands rather than the target, because the offensive bonus
  applies *"even to attacks out of the base"*.

**The Grail now has a runtime owner.** `MatchData.grailCounter` had sat on the schema since it
was written with **nothing incrementing or reading it**, so the Grail could never materialize;
`MatchData.region` had sat beside it with nothing granting the parameter step it implies. Both
are live: `io.defeat` counts Servants towards the threshold (and not Erase), and
`scheduler-hooks` advances the contest and checks victory at round end.

Genuinely not automated, and correctly so: the **Random Event table** itself. §19.5 says *"the
system provides tooling, not automation"* — the one event the rulebook specifies (Civilians) is
implemented; the rest is a `RollTable` for the GM.

**C3. Platforms and levels.** *(large)* — **DONE.**
*Test gate met:* `test/unit/platforms.test.mjs`, 34 tests — a platform carries its passengers
preserving relative position and marks the carry `forced`, and cross-level melee is refused where
ranged is allowed.

`rules/platforms.mjs` holds the model, `engine/platforms.mjs` performs boarding, knock-offs and
destruction, `snapshotBoard` runs `annotatePlatforms`, and the three reference platforms —
Hanging Gardens, Golden Hind, Storm Border — are authored in `packs/_source/platforms/`.

**The defect this closed is the familiar one.** `resolveTargets` has had a `crossLevelAllows`
step since it was written, keyed on `board.crossLevel[unit.platformId]`, and **nothing ever
supplied that map or set `platformId`**. The rule was implemented, called on every resolution,
and permanently inert — the same shape as `MatchData.grailCounter` and `ctx.resist` before it.

Decisions worth keeping:

- **Passenger membership is a consequence of the level**, not a stored manifest. One Scene Level
  per platform (D20.1) means nothing else occupies it, so there is no list to fall out of step.
- **Protection has two axes, not one.** Shooting *in* is the target platform's rule; shooting
  *out* is the attacker's. A fortress nobody can shoot into may still let its occupants shoot
  out — the Storm Border seals both, the Hanging Gardens only one.
- **The platform itself is always targetable.** The protection is for its occupants, and a
  vehicle nobody can shoot at is not a vehicle.
- **A platform spends no budget**, checked before every other gate: it is equipment its owner
  operates, not a combatant taking a slot.
- The carried moves are flagged `fgtForced`, which also stops the movement hook recursing into
  the moves it is itself making.

Not built, and each needs a **Scene Level operation** rather than more rules: creating a level on
activation, deleting it on destruction, scattering passengers to the ground, and reversing the
owner's effects. Those steps of §20.9 are **logged by name** rather than silently skipped, and
`PlatformBehavior` (Ch. 22 §22.10) is the schema they will hang off. The per-platform *content* —
HGoB Construction, Golden Wild Hunt, Zero Sail — belongs with its Servants in D1.

**C4. Bounded fields.** *(large)* — **DONE.**
*Test gate met:* `test/unit/bounded-fields.test.mjs`, 43 tests across all six axes, including the
Labyrinth escape ladder and its veteran clause.

`module/rules/bounded-fields.mjs` is the model — **one module rather than ten special cases**,
which is Ch. 43's own argument for having a model at all. `NPFieldBehavior` carries the axes on a
Region, `engine/board.mjs` projects them, `snapshotBoard` runs `annotateFields`, and
`resolveTargets` enforces isolation at step 4c.

Decisions worth keeping:

- **`rollRequired` is not a refusal.** It refuses the *free* move and the caller offers
  `escapeAttempt`. Conflating the two would turn a Labyrinth into a wall — the escape ladder is
  the mechanic, not an exception to it.
- **Blocking Command Spells is its own axis**, not an inference from isolation. The duel field is
  the only thing in the game that stops one, and deriving it from "fully isolated" would have
  given every isolating field a power only that one has.
- **`???` never satisfies a tag threshold.** The check surfaces a prompt for the GM rather than
  silently deciding either way.
- **NP tags are an ordered scale plus unordered qualifiers**, listed separately rather than
  inferred, so a new tag is a deliberate decision about which kind it is.

**Chaos Labyrinthos is authored** as the reference point in the model — which also finishes
Asterios, whose Noble Phantasm C4 had been blocking.

Not built, and each is a distinct piece of work rather than a gap in the model: the **paint-style
canvas tool** `freeform` needs (The Mist — targeting mode E, the first interaction outside Ch. 09
§9.9's four modes), the two-phase `markDefined` construction (Blood Fort Andromeda's Bloodmarks,
visible only within 3 panels and destructible only by Masters), and §43.9's scheduled detonation.
§43.11's state history exists only as `state.escapeHistory` — enough for the veteran rule, not
the general log.

### Phase D — content and polish

**D1. The remaining 23 Servants** — **STARTED.** Six authored: Heracles, Karna, **Asterios**,
**Penthesilea**, **Medea** and **Scáthach**.

---

**Scáthach** was the sixth, and the one that most vindicates running this phase continuously.
Eleven abilities, and every one of them needed something the engine did not have — but the
*interesting* result is the other direction. Authoring her found **eleven defects in already-
shipped code**, nine of them in features that had been reported complete.

| Found | What was actually wrong |
|---|---|
| `resolveDefeat` | Read `unit.health?.value` off a **snapshot**, whose `health` is a flat number. `undefined ?? 0` became "no Health left", so **every successful attack defeated its target**, at full Health, in every world. |
| `system.defeated` | Written by `io.defeat` since it was written and declared on **no schema**, so the DataModel dropped it. That is what hid the line above: two silent defects cancelling out to look like working code. |
| *Wisdom of Dún Scáith* | Could never copy **anything**. `copyCandidates` reads the board snapshot, whose ability entries carry no `phases`, so `canCopy` refused every candidate in the game as `notActive`. |
| …and its cooldown | `"4◈−⅓◈"` with a **U+2212 MINUS SIGN**, which `parseTick` rejects, written to `cooldown.value` — a field the schema does not have. Every copy ever granted came back reusable every Turn. |
| Deferred predicates | Collection tested `target:` and `attack:` clauses against a **self-only** option set and dropped the element for ever. Penthesilea's *Goddess of War* never fired on a Normal Attack; `NP DmUp` raised no Noble Phantasm's damage. |
| Crit chance | A flat `1d2`, so **`Crit Up` had no reader at all** — §14.6 says the coin *is* a 50% chance that effects move. |
| `npMagnitude` | Every "if NP, X%" clause in Appendix A. Referenced by the effect definitions as `@npMagnitude`, carried by no instance. |
| `phase.target` | Authored on every ability since phases existed and read by nothing. Invisible until an ability's targeting and its self-phase differed — Primordial Rune's tokens went to the ally. |
| `turnState.abilitiesUsed` | Absent from the snapshot projection, so every snapshot reader of the turn record saw `undefined`. |
| Magic Resistance passive 2 | Authored as a `CheckModifier`, which lands in `checkModifiers`; the applier reads `applicationChances`. The commonest defensive class skill in the game reduced nobody's debuff chance. |
| `uses` | Recorded on every count-stacked effect and **never decremented**, so Medea's Trofa — "1 times" — evaded every attack for the rest of the match. |

What she needed built, all of it general:

| Built for | What it is |
|---|---|
| PRS Tokens | **The `Resource` mechanism** (§6.10), designed when the tables were transcribed and never built because no authored Servant had a pool. `domain/resources.mjs`, a schema field, a clamping writer, and `cooldownWaiver` — one token buys a Rune Spell out of its cooldown entirely. |
| *Primordial Rune* | **Table-driven abilities** (`rules/roll-table.mjs`): two tables chosen by relation, per-die resolution so *"a duplicate applies twice"* is the rule rather than a bug, and a wildcard row that opens a prompt. `ChoiceDialog` grew a `min`, because *"any of the above effect(s)"* is one **or more**. |
| The Rune Spells | **`abilityOffCooldown`** with `excludeSelf`, matching by id, `category` or `exclusionSet` — the three ways her sheet groups abilities, all three present in one Servant. And **`oncePerTurn`**, which is not implied by a cooldown: a token skips Ár's clock entirely. |
| *Gáe Bolg Alternative* | **Pre-damage phases** (`when: beforeDamage`) and **`damage.skipIf`**. *"If Instakill is not inflicted, this NP deals 3.5x damage"* cannot be a rider, because a rider fires after a damage step that should not have happened. |
| Both Noble Phantasms | Appendix A's **terminal tier**. `Instakill` empties the Health pool and lets the ordinary defeat chain run, so Guts still answers; `Death` defeats outright, because damage would be caught by `Endure` and Endure has no business surviving Death. |
| *Gate of Skye* | A **`check` phase**: a save rolled by the *defender*, its difficulty read from a rank table keyed on the defender's own MAG. `gateOfSkyeSaveModifier` had sat in `domain/tables.mjs` since the tables were transcribed with nothing reading it. |
| *God Slayer* / *Alpi* | **§E's `damageStepEnd`**, fired for the first time, with a **`targetPredicate`** evaluated when the event fires — *"if the DU has the Undead or Divine Attribute"* is a question about somebody who does not exist at collection time. Plus `CooldownDelta` with `scope: np`, because she has two Noble Phantasms and the sheet names neither. |
| `Shock`, `Slow` | **Multiplicative stat deltas** (`factor`, `floor`), a **roll gate** on an event action (*"roll d6; on 3 or 4 the unit cannot act"*), and **`onRemove`** clauses — Shock gives back *one* Agility where the maximum regains three, and the asymmetry is the whole clause. |
| Magic Resistance | **Severity lists** and **`attackPredicate`** on a chance contribution, for *"also affects Instakill and Death **unless** … STR damage … Erase is completely unaffected"*. Her own Gáe Bolg Alternative is exactly the exemption: her A-rank Magic Resistance would not save a target from her own spear. |

Fifteen effects were authored with her, including the four that complete Appendix A's crit and
debuff-chance families in both directions, and the two terminal ones.

---

Penthesilea's *Charisma* is the archetypal aura, and the reason `relations` is a list rather
than a boolean: *"all damage dealt by **other** allied Units within a 2 panel area"* means allies
**without** self, so `self` drops from the default `[ally, self]` and she gains nothing from her
own Charisma. Ch. 11 §11.6 cites exactly this case; A5 implements it, and this is the first
content to exercise it.

**She is now fully authored**, and the four gaps below were closed by building what she needed
rather than by working around her. That is the argument for D1 running continuously, made
concrete: none of these four would have been designed up front, and all four are general.

| Built for | What it is |
|---|---|
| *Hatred of Achilles* | **`Compulsion`** (`rules/compulsion.mjs`) — positional, like an aura, because it lifts the instant the Greek Male leaves. **The targeting resolver reads it**, which is the reader §45.4 recorded as missing for the whole targeting-executor family. |
| *Charisma*, *Howl of the War God* | **`skill:`, `skillActive:` and `region:` roll options** (`rules/options.mjs`). `tables.mjs` had predicated on `target:skill:divinity` since the tables were transcribed and **nothing ever emitted a `skill:` option**. |
| *Charisma*'s suppression | **Self-options in `contributionsOf`**, which passed an **empty set** — so every `self:` predicate in the system was unsatisfiable. |
| *Goddess of War* | **Rolled modifiers** — a magnitude rolled per damage event rather than fixed before the attack. Found a second bug on the way: a modifier with no numeric magnitude produced `NaN`, which survived every stage and clamped the final total to **zero**, so one malformed element silently deleted an attack. |

**Re-reviewed and completed.** *"She is now fully authored"* above was written before anything
had been run against a live board, and she was not. Nine further defects, seven of them in
already-shipped engine code:

| Found | What was actually wrong |
|---|---|
| The `not:` prefix | **Never implemented.** `not:self:skillActive:madEnhancement` was looked up as one literal option, which is never in the set, so every such clause was permanently **false**. It gated her *Charisma* (both halves) and all four *Goddess of War* clauses, and Karna's Vasavi Shakti override. |
| Class-skill slugs | Derived **kebab-case** (`mad-enhancement`) where every reference is camelCase. So `skillActive:madEnhancement` matched nothing, `modeActive: madEnhancement` refused *Outrage Amazon* in every state, and Medea's *Atlas* lost its `skillRank:magicResistance` reduction. |
| The compulsion filter | Narrowed **every** target resolution, not just attacks. *Howl of the War God* — "affects all allied Units within a 2 panel area" — refused with "no legal targets" for as long as a Greek Male stood near her, which is exactly when a Berserker wants it. |
| `Goddess of War` | Classified as an **attack**, because every NP did. Clicking a *passive* Noble Phantasm opened a targeting session and offered to spend her Attack. |
| `Charisma`, `Howl` | Authored as `activeRules`, so both classified as **modes** — a free toggle with no cooldown and no duration, where the sheet gives each a 4◈ clock and a 1◈ effect. |
| `needsTargeting` | Asked for a placement for any non-`unit` shape, so a centred circle that catches everyone in it opened a session with one possible answer. |
| The mode toggle | A bare write. Every rule about *when* a mode may be switched — Heracles's "never", the 2◈ lockout, a compulsion holding it on — had nowhere to live. |
| `sustainability` | Stored and snapshotted as the **string** `"2◈"`, and four rules-layer readers do arithmetic on it. `cannotPay` compared `"2◈" > 5`, so a Free Servant could never pay for a Noble Phantasm; `checkRemovals` computed `"2◈" - 1`, so it never ran out of time. |
| Mad Enhancement | Three of its seven clauses were absent: the Master drain with its floor and forced deactivation, the Master's ZON +2, and the 2◈ lockout. `madEnhancementDrain` had been in `domain/tables.mjs` with nothing reading it. |

Built for her, all general: **`rules/modes.mjs`** (the three toggle rules, and the *forced* half —
a compulsion switches Mad Enhancement **on** as well as refusing to let it off);
**`RankShift` aimed at an ability**, which closes Goddess of War's fourth clause — `to: A` names
the destination rather than counting five positions across a grade boundary; a **`subject`** on
event actions, so an effect on the Servant can charge the **Master**; a **value gate**
(`whenValue`) and a **floor** on `StatDelta`; **`SetMode`** as an intent, for the one clause where
an effect turns an ability off; and **`modeInactive`**, which is not the same as "does not have
it" — she always *has* Mad Enhancement.

Three named buffs were authored with her: `Atk Up (Charisma)`, whose behaviour is an aura carried
by an effect on its owner; `Atk Up (STR)`, component-scoped; and `Atk Up (GreekMale)`, whose
predicate is deferred to the damage pipeline.

One detail worth keeping. *Howl of the War God* clause 1 **applies** its buff to each ally rather
than projecting an aura, and the difference is load-bearing: they keep it for 1◈ after walking
out of the radius, which is exactly what an aura would not do. It had been authored as an aura.

The original four findings read:

- **Hatred of Achilles** is a compulsion, and §45.4 already records that the four targeting
  executors write keys **the resolver does not read** — so authoring it would produce a
  compulsion that compels nothing. Its Command Spell counterpart *is* authored (B1) and would
  have had nothing to negate.
- **Goddess of War** rolls `1d4` per damage event, which the pipeline has no expression for, and
  raises her own Divinity rank, which `RankShift` cannot reach.
- **Charisma's own suppression clause** is Heracles's Bravery problem again: an ability disabled
  by its owner's other ability. `Suppress` exists; a predicate naming another ability's active
  state does not.
- **Howl of the War God** needs a target-attribute predicate no content has exercised yet.

---

**Asterios** was the first. `packs/_source/servants/asterios.yml`, converted
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
   surfaced this because his simply cannot be deactivated at all. **Still open**, and it is a
   property of the *skill* rather than of either Servant — Penthesilea's Mad Enhancement EX
   carries the same clause. It is the only unauthored clause left on either of them.

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
B1 ✔                   Command Spells: catalogue, spend flow and the interrupt protocol
C1 ✔ → C2 ✔            terrain then environment; environment reads terrain. Both complete.
D1 ~ (continuous)      author Servants alongside, not after — they are the real test suite.
                       Asterios and Penthesilea done. Between them they found eight engine
                       gaps and closed them; none would have been designed up front
C3 ✔ → C4 ✔            platforms and bounded fields. PHASE C COMPLETE.
D2 → D3 → D4
```

The one ordering constraint that is not obvious: **D1 should run continuously alongside B and C,
not after them.** Every Servant authored so far has found an engine gap — Karna found the
`equality` table kind, Heracles found the Def Dwn family and the mode/attack conflation. Twenty-
seven more Servants is twenty-seven more chances to find a defect while the surrounding code is
still fresh.

---

**Previous:** [44 — Case Studies: the Expanded Roster](44-case-expanded-roster.md)
