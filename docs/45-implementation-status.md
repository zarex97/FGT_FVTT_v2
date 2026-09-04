# 45 — Implementation Status and Completion Plan

**As of `0.3.5`.** This chapter audits the 44 specification chapters against the ~38,400 lines
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
all implemented and carry 2089 tests, and 189 content files.

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

   ~~One clause of that skill is still open~~ — **closed while finishing Heracles.**
   `requiresHealthRestoredSince: 0.5` now has the history it was waiting for:
   `system.healthWatermarks` stamps the tick at which Health last crossed a fraction somebody
   asks about, on the way up, and only for the fractions that actor's own abilities name. The
   original note read: *"needs a health-peak history that nothing records. Adding the gate
   against a field no code writes would recreate the exact defect this step repaired, so the gate
   waits for the history."* EMIYA's Rho Aias carries the identical clause and shares it.
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
8. **Only 9 of 29 reference Servants are authored** — and "authored" is a claim only a
   live board can settle. Asterios and Karna were both on this list while six of Asterios's
   clauses had no reader and nine of Karna's thirteen abilities did not exist.

The system is at the point where **one player can attack another player and the damage is
correct and fully audited**. It is not yet at the point where a match can be played to a finish.

---

## 45.2 Status by chapter

### Part I — the domain model

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 04 | Units | **Done** | Six actor types, schemas, multi-panel footprints read by targeting, and the identity fields — `classContainer`, `concealedIdentity`, `identityRevealed`, `detect`, `defaultImage`. A Servant is publicly its class until revealed. |
| 05 | Ranks and parameters | **Done** | Grade-major ordinals, step arithmetic, `RankField`. |
| 06 | Stats and resources | **Done** | Including derived stat deltas as of `0.2.0`, and **every stat now derives from its parameter** (Ch. 41 Q50): Health from END, Agility and Luck from AGI and LUC with their coin and `1d4`, and **Base Attack from STR and MAG** — the last of the five, where the table overrides four figures the sheets stated. |
| 07 | Time model (◈) | **Done** | `parseTick`/`resolveTicks`/overrides, and **Delay (§7.8)** — which was already implemented in `computeTurnOrder` when this row was written. The one clause that genuinely was not: a Delay declared against a faction that had already acted was **discarded** rather than deferred to the next round. `carryDelaysForward` fixes it. |
| 08 | Board and geometry | **Done** | **Riding Attack and Passenger Seat** are built — both had been in `GRANTS` since grants were written with no engine reading either. A Riding Attack is a Move that is also an Attack; Passenger Seat displaces the Master by the Servant's own delta. Metrics, reachability, movement legality, and **Detect (§8.7)** — range with its 2-panel floor, the Discover chance from the concealed unit's Presence Concealment rank, and attempts marked GM-only and silent so the socket layer cannot leak them. **§8.6 was never a gap:** the chapter's own DECISION is *not* to implement line of sight, because F/GT has no such rule. Fog of war is Foundry's. |
| 09 | Targeting | **Done** | Eleven-step resolver, four anchors interactive, `legalPlacements`. **`requiresFacing` and `requiresClearPath`** are the game's only sight rules, per-ability and opt-in (D44.8), and `coneOf`'s first readers. The direction picker offers eight for a shape that asks (`directions: "all"`), which is all a diagonal line ever needed. |
| 10 | Effect taxonomy | **Done** | Classification vocabularies enforced by the content validator. |
| 11 | Effect engine | **Done** | Application, stacking, suppression, expiry, periodics, auras (§11.6), **Transfer (§11.8)** — a move that keeps the absolute expiry, rebased when one side has been Stopped — and **visibility (§11.10)**, where a debuff is also visible to whoever inflicted it. |
| 12 | Combat Process | **Done** | All six steps run (Phase A), and interrupts (§12.11) land through B1's Command Spell protocol. |

### Part II — resolution systems

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 13 | Damage pipeline | **Done** | 16 stages, both worked examples are golden fixtures. |
| 14 | Checks and randomness | **Done** | A **check phase branches, nests and may change a stat** rather than only applying effects (Medusa's Mystic Eyes). Evade, Luck, chance rolls, `checkPlan`, **the roll log (§14.8)** — records on the Process state, per-viewer filtering, GM re-rolls that keep the original — and **setup rolls (§14.9)**, where a Servant's Health takes no roll and a Master's is a coin-flipped `2d100` over a flat 250. |
| 15 | Abilities | **Done** | Classification, phases, **costs and all twelve requirement kinds (§15.4)** — and `canUseAbility` now *consults* them, which it did not. **Copied abilities (§15.7)** are `rules/copy.mjs` + `engine/copy.mjs`: `copyable` as per-ability data, copies by reference so a content fix propagates, and `effectivePhases` as the single reader. **Items (§15.8)** transfer and consume through their own intents, and every route by which a unit comes to *hold* one passes `acquisitionTarget` first — the seam Pale Rider's redirect needed, and the one a drop or a kill reward would inherit. **The GM curation dialog and the player's pick are built (§36.4)**, and **`supersedes` (§15.4)** now resolves a whole set of pending costs against each other before any is charged — Karna's NP cost overwrites his Act cost, and the Hanging Gardens upkeep overwrites the NP cost the other way, both as authored data. |
| 16 | Relationships | **Done** | Master protection — all four rules, and §16.4's **negation clause** now bites: `canAct` reads the effect definitions through `preventsAction`, where it used to answer only the channelling flag, so a Stunned Servant protected its Master through all four. Also, **Cover (§16.4 rule 4)** included, the last to be built and the only one spanning two Combat Processes; building it exposed rule 1 filtering an area's *splash* as well as its chosen targets, which had made rule 4 unreachable. ZON, **Overpower/Underpower (§16.5)**, **Sustainability on a Master's death (§16.6)** — where `null` is not zero — and **the multi-Servant tax (§16.7)**, flat and as a loss rather than damage, with its at-25-Health prohibition. **Contracting (§16.2)** is built: the adjacency and enemy-clearance gates, the four-row roll table, Independent Action as a *prohibition* at EX/A+ rather than a difficulty, the three namespaced Command Spells, and conquest — which frees and contracts in one descriptor list so the Free state the rules describe is never observable on its own. |
| 17 | Command Spells | **Done** | Catalogue (16), spend flow, cost variants, offer filtering, the interrupt protocol with its timeout, and **§28.8's preview-time "spend to override"** — rendered inline the moment a refusal appears, and only when the command is actually affordable, because an unusable option should never appear (§17.6). |
| 18 | Action economy | **Done** | Budget, per-unit limits, prevention, compulsions, **Confuse's random selector (§18.5)** — fully logged, and it may pick allies — and **Undo (§18.7)**, whose boundary is information disclosure: an unrecognised action is refused rather than rewound. |
| 19 | Environment | **Done** | Day/Night, Home Base E1–E5, the Grail with its runtime owner, Region and its adjacency graph, Civilians, victory conditions and the setup gates (C2). **The Random Event table stays GM-driven by design.** |
| 20 | Platforms and levels | **Done** | Model, movement linkage, cross-level protection, boarding, falling, destruction, the three reference platforms, and **the Scene Level operations** — create, scatter, delete, and the owner-effect reversal — sequenced in §20.9's order. That order is enforced rather than assumed: `TokenDocument#level` is required and non-nullable and Foundry does not re-parent on delete, so `destroyLevel` refuses while anyone is still aboard. **Everything above was true and none of it worked**, until the Hanging Gardens was driven on a live board: the platform's own token was never assigned to the level it had just been given; our own `preMoveToken` hook refused the assignment, because Foundry counts `level`/`elevation` as movement and `validatePath` sees a path with no orthogonal step (this broke boarding too); the `fgtForced` escape hatch had never once fired, because Foundry passes the update options as the hook's **third** argument and we read `movement.options`; the elevation bands overlapped the ground, so `inferLevelFromElevation` pulled every passenger back down; orphan levels accumulated because nothing sweeps a level whose platform is gone; `occupantAt` ignored `k`, so a flying platform collided with the board; and `movePlatform`'s delta was computed against a document that has not yet moved, so **§20.8's movement linkage had never carried a passenger**. All seven fixed and measured live (§20.2). |

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
| 29 | User interface | **Done** | Unit sheet, ability sheet, turn HUD, chat cards, summon, Wisdom curation, the choice prompt, **Master sheet (§29.3)** — which required implementing §16.9's per-Servant spell pools first — **token HUD (§29.5)** and **the ability editor (§29.6)**. The actor sheet is now **four tabs** (§29.2) on ApplicationV2's native `TABS`, one `PART` each, rendering everything an actor holds rather than the five fields it showed before: Base Attack and its range bands, MOV, Range, Detect, Sustainability, alignment, region, attributes, contract and ZON, the §6.10 resource pools, the turn budget, biography, and every effect in force with its stage damage, source and remaining duration. Presentation arithmetic lives in a **pure** module (`present.mjs`, 45 unit tests); ability state and cost come from `canUseAbility` / `npCost`, the same calls `engine/attack.mjs` makes. The editor gained the fields it lacked — including the ability's **name** — and typed per-phase editors that merge rather than replace. Still missing: §29.6's dropdown predicate builder, and the §29.8 dialogs beyond those listed. |
| 30 | Chat and audit | **Done** | Cards, the damage explainer, **the game log (§30.8)** with its bounded storage and journal overflow, **the export (§30.9)** carrying rolls so replay is exact rather than re-simulation, and **GM overrides (§30.10)** recorded beside what they changed with the reason enforced in the rules layer. |

### Part IV — reference

| Ch. | Subsystem | Status | Notes |
|---|---|---|---|
| 37 | Content pipeline | **Done** | YAML → LevelDB, validator, stable ids, and **the summon operation (§37.6)** — an ordered, inspectable plan that rolls before it grants, keeps Master and Region grants as separate steps, and ends in a re-rollable confirmation — **with the dialog that shows it**, reached from the Actors sidebar and the Servant compendium, and refusing a bare compendium drop that would produce a Servant with the template's numbers. The validator also refuses an undocumented `copyable` refusal and a copy that carries its own phases. |
| 38 | Testing strategy | **Mostly** | 2089 unit and golden tests, plus `check:smoke`, which loads a real world and fails if it does not come up. **Integration tests (§38.6), performance tests (§38.7) and the twelve-Servant playtest (§38.8) missing.** |
| 39 | Migration and versioning | **Missing** | No migration runner; the schema has no version stamp. |
| 42 | Terrain | **Done** | Catalogue, panel model, standing/periodic/on-entry/conversion clauses, the annotation pass and the `Region` behaviour that populates areas from a scene (C1). |
| 43 | Bounded fields | **Mostly** | **`markDefined` and `Structure` are now built** (Blood Fort Andromeda): a field assembled over four Turns from destructible objects, with no duration at all — Ch. 43's `expiry: onOwnerDefeat` exists for it alone. So is a field that **drains one set of Units to heal another**, with the pool cap enforced in `rules/fields/pool.mjs`. Previously: The six-axis model, NP tag ordering, the escape ladder with its veteran clause, isolation enforced by the resolver, and Chaos Labyrinthos authored (C4) — **and now a writer** (`engine/fields.mjs`): a field is a Region with an `npField` behaviour, created by a `createField` phase, expiring on an absolute tick at the Turn boundary, with `interiorEvents` for rules that fire at a boundary rather than standing. Everything in the chapter had a reader and none of it had ever run. **`freeform` needs a paint tool, `markDefined` a two-phase construction, and §43.9 scheduled detonation.** |
| — | Content | **9 of 29 Servants** | Heracles, Karna, Asterios, Penthesilea, Medea, EMIYA, Serenity, Semiramis and **Scáthach** — the first Lancer, and the Servant who needed the most engine that did not exist. **All eleven abilities** resolve end to end in a live world, verified individually: *Primordial Rune* (a 2d8 table chosen by relation, duplicates applying twice, and a wildcard row that asks), the three *Primordial Rune Spells* (a PRS Token waiving the cooldown, and the other two gated while the used one runs), *Wisdom of Dún Scáith* (which **had never been able to copy anything**), *Clairvoyance*, *God Slayer* with *Alpi*'s two branches, *Gáe Bolg Alternative*'s Instakill-or-damage fork, and *Gate of Skye*'s per-target Luck Check with `gateOfSkyeSaveModifier`. She is also the first **Resource** pool (§6.10) and the first content to fire §E's `damageStepEnd`. 36 effects of ~152, including Appendix A's **terminal tier**. 5 class skills. 16 of 16 Command Spells. 3 platforms, 3 summons. |
| — | Content (Heracles) | — | **Heracles is finished.** He shipped with four of eight abilities; the four that were missing were the four Ch. 31 was written about. **Revival is now a priority-ordered query** (`rules/revival.mjs`) rather than "whichever handler heals first" — with one source those are indistinguishable, and with his four the old behaviour burns a God Hand charge while `Undying` sits unused. `RevivalSource` is the element, and Battle Continuation's second condition — *"Health must have been restored back to above half its maximum at least once since the last activation"* — is **enforced for the first time**, against the `healthWatermarks` history §45.1 named as missing rather than faking. God Hand's cascade and its ledger of attack identities both work; measured live. |
| — | Content (EMIYA) | — | **EMIYA**, the first Archer, and the Servant whose sheet is written almost entirely in terms of **distance** — which nothing emitted. All **seventeen** abilities resolve end to end in a live world, verified individually. `attack:range:gte:N` / `lte:N` are new roll options and half his kit turns on them; `normalAttack.mode: rangeBanded` had been a declared choice since the actor schema was written with nothing implementing it, so his Normal Attack was plain STR at every distance (measured: 40 in melee, 72 at Range 3, and 80 versus 54 against a Rank A Magic Resistance depending on whether the exemption applies). He is the first content to need a **whole-match** budget rather than a cooldown (`timesUsed`/`maxUses`), the first **barrier** with its own Health pool (`Rho Aias`: one 1400 shared across four bearers, overflow passing through, 100 off its owner per completed 200), the first **round-scale** exclusion (`Caladbolg II` / `Hrunting`), the first `createField` (Unlimited Blade Works trapped eight Units and tolled three of them at the Turn boundary), and the second **Resource** pool. 50 effects of ~152. 6 class skills, including **Independent Action**, whose contract rule had shipped in `rules/contract.mjs` with no content to attach to. |
| — | Content (Serenity) | — | **Hassan of Serenity**, the first Assassin, and the Servant whose sheet is written almost entirely in terms of **information**. All **seven** abilities resolve end to end in a live world, verified individually. Presence Concealment is eight clauses touching targeting, the reaction ladder, the damage pipeline, movement legality, Master protection and what a player may press — and **every one of those readers already existed**. What did not exist was anything that made a Unit concealed: `system.concealed` was projected by the snapshot, consulted by four subsystems, written by no code and declared by no schema, so all four asked a question whose answer was always `false`. It rides the `presenceConcealment` effect now, with `cooldown.countFrom: deactivation` — another declared field with no reader — and six deactivation paths converging on one function. She is also the Servant who made the **on-hit rider** work: `damageDealt` had never been fired and the `effect:` shorthand every rider in Appendix A is written in desugared to no action at all, so `Bleed Atk` and `Queen's Poison` were inert twice over. **Secret Poison** is built on Q47's reading — the Health comes off on schedule, the debuff and the running tally are hidden, and both are disclosed when her concealment ends. First staged effect (`Poison`, 20 × 2^(N−1)), first `stages: N` application, first `target: nearby` handler. 59 effects of ~152. 7 class skills. |
| — | Content (Asterios) | — | **Asterios is finished**, and he is the clearest case in the project of content that was *authored, validated, compiled, loaded — and unreachable*. All five abilities resolve end to end in a live world. **Six clauses had no reader at all**, and none announced itself: *Monstrous Strength* shipped as `activeRules` on an ability that is not a mode, so nothing could ever switch it on (it needed the **attacker's own timing window**, which did not exist — every window in the system described a moment inside somebody *else's* Combat Process); *Chaos Labyrinthos* declared six field axes and carried **no `createField` phase**, so the Labyrinth was never opened; its anchor was `{kind: selfCentred}`, which `resolveAnchor` **throws** on, so the largest bounded field in the corpus could not be used at all; its cooldown was a bare `8◈` where the sheet says *"after the NP ends"*; its activation debuffs were aimed at `[enemy, ally, self]`, so he debuffed his own team and himself every cast; and `regionSizeOverride: {greece: 11}` had no reader anywhere. Measured live after: Monstrous Strength 406 accepted versus 201 declined, a 9×9 / 81-panel Labyrinth (11×11 / 121 in Greece) catching seven Units with both debuffs on the enemy and neither on him, and **0 damage** from an NP whose description opens with the word "Non-damaging". |
| — | Content (Mad Enhancement) | — | Three wrong numbers in the commonest class skill in the game, all reaching Penthesilea too. `madEnhancementDefence` is an `[normal, vsNP]` **pair** and `scalar()` took index 0, so every Mad Enhancement reduced Noble Phantasm damage by its full normal figure — 40% instead of 20% at B. *"Halved for Attacks which use Base Attack (MAG)"* was **not implemented at all**; it is now a predicated pair in the additive bucket rather than Ch. 13 §13.5's stage-4/5 split, which gets the STR case wrong whenever anything else is in the bucket (×0.60 by §13.4's own worked form, ×0.39 by the split). And the drain floor and the forced-deactivation threshold were both the literal `30` — `madEnhancementDrain`'s **EX** value — at every rank; Asterios's Rank B is 20 in all three places, as his sheet says three times. Clause 5 read `servant.modes`, a field **nothing has ever written**, and its unit test passed because the fixture supplied it by hand. |
| — | Content (Karna) | — | **Karna is finished** — thirteen abilities, four Noble Phantasms, the most of the original twelve, and nine of the thirteen were unauthored (including both that define him). All thirteen resolve end to end in a live world. **Six clauses could not be written at all** before this pass, and each needed something general: `target:paramVsSelf:` for *Brahmastra*'s 4×/2× fork (the existing rank ladder is grade-coarse and would have mis-paid the 4× branch to any `+`-stepped defender — measured, the `+` step decides three of six matchups on the authored roster); `attack:element:` for *"All Total Fire Damage taken is reduced by 50%"*, which the pipeline had read as `ctx.attack.element` since stage 0 was written while no predicate could ask; §E's **`combatProcessEnd`**, listed since the reference was written and never raised, for *Vasavi Shakti*'s per-Process upkeep; `unlessUsedThisTurn` for Note 2, which is §15.4's supersession in the wrong scope; `target:contentId:` for *Fated Rivals*, backing §36.1's own DECISION that nothing emitted; and `oncePerRound`, the only limit on *Uncrowned Arms Mastership*, which has no cooldown. **Vasavi Shakti is two documents**, not §36.1's proposed `modes:` schema — an `isNP` document cannot be free, and `canUseAbility` would have gated a free activation behind 75 Master Health the sheet says it does not cost. |
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
| `suppressions` | `resolve.mjs` for `scope: masterProtection` | **Partly live** — one scope of several |

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

**A sixth, and it is the plainest: a writer that does not mention the field.** `io.createEffects`
builds the document data for a new effect instance by naming each field it copies — and it named
ten of twelve. `visibility` and `attributionHidden` had been on the schema since `0.2.0`, so an
effect could be *constructed* hidden by a correct pipeline and was *created* public every time.
This is the mirror of the schema defect the project started with (a DataModel silently dropping a
field it does not declare); here the schema declares it and the writer forgets it, and the symptom
is identical — the value is simply not there afterwards, with nothing raised.

Found building Secret Poison. The same pass turned up two more of the shape:
`suppressions.masterProtection` and `caster.bypassesMasterProtection` (a reader with no writer, so
Presence Concealment's clause 3 could not be authored), and `state.forbiddenReactions` (a writer
with no reader, so §27.9's Command Spell retarget let a Servant Block and Evade an attack it never
saw coming).

**A seventh, which is not about fields at all: a default that is a legal answer.**
`resolveTicks(null)` is `0`, which is correct for *"this turn"* and disastrous for *"unstated"* —
the expiry lands on the current tick, so an effect with no authored duration is swept by the very
next boundary, **before it has ticked once**. Poison exposed it (Appendix A gives it no duration,
because it runs until it is cured): it applied, staged to 1, and was removed at the end of the same
Round having dealt nothing. An unstated duration now means permanent. The shape is worth naming
separately because nothing was missing and nothing was inert — a real value was computed, and it
was the wrong one.

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

### ~~§5.6's granted steps never reach the Parameter~~ — **repaired**

Found while building the Overview tab's parameter tiles, left open at the time because it was an
engine change and the sheet work was scoped to render what existed. Reported again independently
by a GM as a live bug and fixed.

Ch. 05 §5.6 specifies `effective = base shifted by granted`. `engine/summon.mjs` writes
`system.grantedSteps` and adjusts Base Attack from it, and **nothing shifted the Parameter
itself** — the only other reader of the field was `baseAttackAdjustment`. A Servant granted a
STR step by a High Rank Master got the +10 Base Attack and kept its written Rank, so anything
comparing Ranks — Magic Resistance, the damage table rows, `Rank.gte` gates — saw the unmodified
one.

This entry originally claimed the war Region's bonus "does reach the rank, via a different
route" (`annotateRegionBonus` emitting a `rankShift` statDelta). Re-investigating while fixing the
Master-grant path found that claim was **wrong**: `applyStatDeltas` (`rules/derived.mjs`) is only
ever called from `FGTActor#prepareDerivedData`, over an actor's own ability/effect contributions —
never over a board snapshot's `statDeltas`. The Region's `rankShift` entry was pushed onto
`u.statDeltas` and then read by nothing; a snapshot's `u.parameters` never moved for it either. Both
grant sources were silently inert for Rank comparisons, not just the Master's — confirmed with a
throwaway probe test before either fix landed (Ch. 05 documents the reproduction).

**Fix**, in `rules/snapshot.mjs`:
- `snapshotUnit` now folds `system.grantedSteps` into its own copy of `parameters` via the new
  `applyGrantedSteps`, and records a matching trace entry in `statDeltas` via `grantedStepDeltas`.
  This is a permanent, per-unit fact, so it settles at single-unit projection time and is visible
  to every caller — `snapshotBoard` and the direct `unitSnapshot` calls `engine/attack.mjs` makes
  for checks and reaction gating alike. `system.parameters` itself is never written to; the sheet
  keeps showing the authored Rank.
- `annotateRegionBonus` now actually mutates `u.parameters` (via `Rank#step`) and `u.baseAttack`
  (via `baseAttackAdjustment`, the same ±10-per-STR/MAG-step helper the Master-grant path already
  used at summon), instead of only appending a statDelta nobody consumed. This only reaches units
  projected through `snapshotBoard` — a single-unit `unitSnapshot` call has no board and therefore
  no current war Region to apply, which stays a known, narrower gap (see below).
- The two sources stack normally: a Master's `+1 STR` plus a matching Region's `+1 STR` step the
  Rank twice, same as if either had granted `+2` alone.

**Still open, smaller:** a direct `unitSnapshot(actor)` call (no board) cannot pick up the war
Region's bonus, because `rules/snapshot.mjs` is a pure layer that never touches `game` and the
Region setting is not threaded through that call path. `engine/attack.mjs`'s check-phase and
reaction-gating snapshots are built this way, so a Region-only bonus (no Master grant) is not yet
visible to those two call sites specifically — everything reached through `currentBoard()` /
`snapshotBoard` is unaffected. Threading `warRegion` into `board.mjs#unitSnapshot` would close it;
scoped out here to keep this fix to what was reported.

The sheet still does not paper over any of this. The parameter tile shows the Rank the field
holds and reports the granted steps beside it as the separate fact they are, rather than
rendering a "written C ▸ now B" arrow.

### One localization key took down all 591

Found while building the ability editor, and the most expensive small mistake in the project so
far — because nothing failed.

Foundry expands the flat dotted keys in `lang/en.json` into a tree. `FGT.Editor.Kind` was the
label on a field whose options were `FGT.Editor.Kind.classSkill`, `…skill` and `…noblePhantasm`.
That asks one node of the tree to hold a **string and an object at the same time**:
`expandObject` throws, the merge of the whole file is abandoned, and every FGT string in the
system falls back to rendering its own name. Not one string — all of them, across every sheet,
dialog, HUD and chat card.

There was no error in the console. `game.system.languages` still listed the file, the file still
served with a 200, and it still parsed as valid JSON. The only symptom was an interface full of
`FGT.Editor.Title`.

`test/unit/i18n.test.mjs` now fails on any key that is the prefix of another key. It is a
four-line check for a failure that is invisible at every other layer.

### Periodic damage had one implementation and no way to read it

`tickPeriodics` computed Poison's `20 × 2^(stage−1)` and applied `AMPLIFIERS` — Deadly Poison's
doubling — behind a module-private `amplify`. The Effects tab (§29.2) has to print that number,
and the only route to it was to write Appendix A §A.12 out a second time.

Extracted as `periodicDamageFor(instance, unit)` and exported, with `tickPeriodics` now calling
it. Pure, so layer 4 may use it. The registry's own `periodic` field is *not* what ticks — the
scheduler's `PERIODICS` table is — which is worth knowing before reading either.

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

### ~~A Free Servant's Sustainability collapsed to zero after one Turn~~ — **repaired**

Reported by a GM as "Sustainability ticks down even while contracted" — a live symptom that turned
out to have a different cause than the report guessed. `checkRemovals` (Ch. 06 §6.8, Ch. 16 §16.6)
was already, correctly, gated on `contract === "free" || "unbound"`; a contracted Servant's clock
never moved, confirmed against the actual world state (`system.contract: "contracted"`) and by
calling `checkRemovals` directly against it — it returned `[]`, as it should. What was live was the
next Turn end for a Servant that HAD just gone Free.

`sustainabilityRemaining` is `null` in storage until its first write — by design, so a Servant
summoned before the field existed, or one that has simply never lost a Master, falls back to its
full authored clock rather than to zero (`rules/snapshot.mjs`'s `sustainabilityTurns`). Every write
to it went through `io.adjustResource`, which read the current stored value with
`foundry.utils.getProperty(actor, path) ?? 0` — coercing that meaningful `null` to `0` **before**
its own guard (`if (current === null) return;`) ever ran. The guard was dead code, exactly the
shape Ch. 45 keeps finding elsewhere: written once, never able to fire again once the line above it
changed.

The consequence: the FIRST decrement a newly-Free Servant's clock ever received —
`checkRemovals`'s per-Turn `-1`, or a Free Servant's first Noble-Phantasm-by-Sustainability
payment in either `engine/attack.mjs` or `engine/skill-use.mjs` — read the phantom `0` and wrote
`max(0, 0 - 1)`, or `0 - cost`, back to storage. A Servant with a stated 6-Turn clock disappeared
on its second Turn as a Free unit, regardless of the number on its sheet, and every subsequent
report of "it disappeared instantly" would have looked like a different bug each time depending on
which write path got there first.

**Fix, in three parts:**

1. **`io.adjustResource` gained an `absolute` mode.** `null` still means "does not apply" and a
   relative delta against it is still refused — that guard now actually runs, which is a
   correctness fix on its own for any future resource with the same nullable-until-first-write
   shape. `absolute: true` writes the given number directly, for a caller that has already
   resolved what the field should hold and does not need a "current" to add to.
2. **`I.setResource(unitId, key, value)`** (`engine/intents.mjs`) is the constructor for that mode,
   alongside the existing relative `I.resource`.
3. **Every Sustainability writer switched to it**, using the number already resolved on the
   caller's own snapshot rather than the raw stored field: `checkRemovals`'s per-Turn decrement
   (`scheduler.mjs`) and the Noble-Phantasm-by-Sustainability cost in both `attack.mjs` and
   `skill-use.mjs`. All three now write `resolvedRemaining - amount` outright, which is correct
   whether the stored field was `null`, freshly initialized by a Master's death, or already
   mid-countdown.

Reproduced and verified live before and after, against the actual `Heracles` actor in a running
world: a freshly-Free Servant with a resolved 6-Turn clock decremented `null → 5 → 4` instead of
`null → 0`, and a contracted Servant still produced no intents at all.

### ~~A player assigned to a faction had no Foundry permission on its units~~ — **repaired**

Reported live, while testing the identity-concealment fix above: a player, told they controlled
Faction 1, could not see either of a Servant's images correctly, could not drag its token without
Foundry rejecting the write, and saw the concealed standard image on their OWN sheet.

`apps/faction-config.mjs` lets a GM assign a controlling user to a faction and has fired
`Hooks.callAll("fgtFactionsChanged", ...)` since it was written — **nothing ever listened for
it.** `game.settings.get("fgt", "factions")` held the assignment exactly as configured; every
actor's Foundry `ownership` stayed `{default: 0}` regardless, contradicting Ch. 26 §26.1's stated
design outright: *"A player owns their own Servants and Master."* Confirmed on the actual world,
from the actual assigned player's own client: `game.actors.getName("Heracles").isOwner === false`,
`permission: 0`, for a Servant on the faction they had just been told was theirs.

That single missing sync explained every symptom at once:

- **The sheet showed the standard image, not the true one, to the Servant's own controller.**
  `context.mjs`'s concealment check exempts the Servant's owner — the same exemption
  `rules/identity.mjs#publicNameOf` already states for the name (*"the concealment is from
  opponents, not from the player running it"*) — and `actor.isOwner` was structurally false for
  a "controller" with no real ownership, so the exemption could never fire. Fixed alongside this:
  `context.mjs`'s `concealed` now also checks `actor.isOwner`.
- **Token drags failed with a permission error and looked unconstrained doing it.** Foundry's own
  write permission gate (a player needs OWNER to move a token they do not own) rejected the
  position update; the client-side drag preview and ruler, which run before that gate is ever
  consulted, showed no limit because this system's own MOV/budget legality in
  `movement-hooks.mjs`'s `preMoveToken` hook never got the chance to matter — the write was
  always going to fail regardless of what it computed.

**Fix.** `engine/faction-ownership.mjs`, attached GM-side alongside `Scheduler`/`Movement` in
`fgt.mjs`'s `ready` hook: on `fgtFactionsChanged` (a roster edit) and on `updateActor` /
`createActor` for an actor's own `factionId` (a Servant reassigned, or created with one already
set), every actor's `ownership` is rewritten so the current owner of its faction — and only that
user — holds OWNER. Reassigning a faction to a different player revokes the previous one's
ownership in the same pass, rather than only ever adding.

Verified live, from the assigned player's own client, before and after: `isOwner` went
`false → true` for a Servant on their faction after the sync ran, the sheet's portrait switched
from the standard image to the true one, and `TokenDocument#canUserModify(user, "update")` went
`false → true`, followed by an actual successful move.

**A second, separate gap surfaced alongside this one, and is now also closed:** a Servant's
placed token and `prototypeToken` texture did not follow `img` or `system.defaultImage` at all —
verified live, changing either left both the prototype and the already-placed token showing
whatever they were set to before. Foundry does not propagate an actor's portrait to already-placed
tokens on its own, and this system had never synced the two.

Ch. 26 §26.6 is the reason this could not simply mirror what the sheet does: it deliberately
defers full per-viewer closed-information play (the shadow-actor pattern) to Ch. 40, and a placed
token's texture is one shared field every viewer sees identically — there is no per-viewer render
the way `context.mjs`'s `concealed` branch gives the sheet. `engine/token-image.mjs` (new, GM-side,
attached beside `FactionOwnership`) resolves this the same way the sheet's non-owner view already
does: the token shows the standard image (`system.defaultImage`) while `identityRevealed` is
unset, and the true portrait once it is set, for every viewer identically. Revealing a Servant's
identity is therefore also what puts its real face on the board. Verified live: setting the true
`img` and a standard `defaultImage` while unrevealed updated both the prototype token and an
already-placed one to the standard image; setting `identityRevealed` moved both to the true
portrait; unsetting it moved both back.

### A token showed neither the right picture nor the right size — **repaired**

Reported from play: "changing the standard or true image of a token that is already placed does
not update it on the board", and "why is the Hanging Gardens a 1-cell token in the compendium?"
Two independent defects, both confirmed live in `fgt2026` before any code changed.

**The image.** The sync above ran under `if (actor.type !== "servant") return`. Measured on the
live board: setting a Platform's `img` and `defaultImage` left its placed token on
`icons/svg/mystery-man.svg` while the sheet showed its own art, and a Master's did the same. The
guard was wrong in scope, not in principle — only a Servant has an identity to **conceal**, but
every unit type has a portrait that ought to reach the board. `publicImageOf` now applies the
concealment branch to an unrevealed Servant and returns `img` for everything else, mirroring
`context.mjs`'s `portraitImg` minus its viewer-dependent half. Two further faults in the same
fifteen lines came out of the re-measurement, both invisible to inspection:

1. `Actor#getActiveTokens()` passes `scenes: canvas.scene`, so the sweep covered **only the open
   scene** — under a comment that claimed the opposite.
2. `getDependentTokens()`, its replacement, reads an `IterableWeakSet` that a **deleted** token
   stays in until collection. Updating a ghost throws, and one sequential loop meant a single
   ghost aborted the pass, leaving the real token behind it unchanged. This is precisely the
   guard Foundry's own `getActiveTokens` carries, and dropping it re-broke the case the change
   was meant to fix. `engine/token-sync.mjs#placedTokensOf` now owns both corrections for the
   two callers that need them.

**The size.** A platform declares `system.footprint: {w, h}`; a Foundry token's size lives in
`TokenDocument#width`/`#height`; nothing joined them, so `prototypeToken` compiled at the 1×1
default. Worse than cosmetic: `rules/snapshot.mjs#gridFootprint` reads occupancy off the
**token**, while `rules/platforms.mjs#isUnderPlatform` reads `system.footprint` — a 1×1 token for
a 9×9 platform makes the board see a one-panel obstacle sheltering 81 panels. `engine/hgob.mjs`
alone escaped, sizing its token by hand at activation, which is why an HGoB *raised in play* was
9×9 and one *dragged from the compendium* was not. Fixed at build time
(`tools/lib/content.mjs` compiles the prototype size from the footprint) and at runtime
(`engine/token-footprint.mjs`, a `preCreateToken` guard for prototypes that predate the fix plus
an `updateActor` sync). See Ch. 20 §20.3 and Ch. 04 §4.2.

The runtime resize needed `{fgtForced: true}`: `width` and `height` are Foundry v14
**`MOVEMENT_FIELDS`**, so a resize routes through the movement pipeline and our own
`onPreMove` refused it — arriving at `preUpdateToken` as a bare `{_id}`, with no throw and no
rejection. **The third silent-failure-by-movement-field in this codebase**, after `level` and
`elevation` in `scene-levels.mjs`. The pattern is now worth stating as a rule: *any* engine-side
`token.update()` touching `x`, `y`, `elevation`, `depth`, `shape`, `level`, `width` or `height`
must carry `fgtForced`, or it will do nothing and say nothing.

Verified live in `fgt2026` after a cold reload: a Platform, a Master and a Summon each pushed a
changed portrait to their placed tokens (the HGoB's token moved from `mystery-man` to
`assets/grail/HGoB.jpeg`); a Servant still showed `defaultImage` while concealed and swapped to
`img` on reveal; the compendium entry read `prototypeToken 9×9`; a compendium drop and a drop
from the *stale* 1×1 world actor both produced a 9×9, 81-panel token; and editing
`system.footprint` to 5×7 and back moved the prototype **and** the placed token both ways.

### Jack the Ripper, and three UI repairs — **built**

Her seven abilities plus Presence Concealment are authored and verified in the live world; Ch. D
§D.18 has the clause-by-clause table of what each one needed. Nine engine additions, and the
striking thing about them is the ratio: **four were repairs to machinery that already existed
and had never once run.** `annotateFields` merged every contribution bucket except
`checkModifiers`; `board.startedAtDay` had a reader and no writer, so every Round was Day on the
odd ones; a `predicate` requirement naming `target:` was unsatisfiable in every case because the
option set was built from the attacker alone; and `SustainabilityGain` put its value on an event
handler that nothing read back. None of the four would have been found by inspection — each was
found by measuring the clause that depended on it.

**Reaction pre-emption** is the genuinely new mechanism, and the design decision worth recording
is that it is *not* a Counter. A Counter resolves at the end of the Process it answers, after the
damage has landed (§12.8's `counter` rung). *"Attack first instead of the opposing Unit"*
replaces the order instead, so the attacker's declaration is **deferred onto the pre-empter's own
Combat Process** and re-entered with `resume: true` when that finishes — skipping the budget, the
costs and the cooldown, all paid at the first declaration. "If she kills them, their Attack never
happens" then falls out of re-resolving the targeting rather than needing a case of its own.

Verified live, end to end: the Mist opened with 25 freeform panels; an enemy Servant inside had
MOV 8 → 4, Detect 2 → 1 and a +3 Evade penalty, and an EMIYA carrying Eye of the Mind's buffs was
exempt from all three and lost the exemption the moment they were stripped; an enemy Master was
Poisoned on entry and **not** re-poisoned stepping further in; a Civilian's contact produced the
defeat plus the kill credited to Jack; the upkeep charged 15 at one 1◈ and no sooner, and at 15
Health it closed the field **instead** of charging, starting the 5◈ cooldown at closure; the
Murderer active gave 30%/20% and 3◈ outside the fog and 50%/30% and 4◈ inside it; Information
Erasure stripped both buffs and left the debuff; Maria's gate refused by day naming `roundPhase`
and opened at night; its damage bands selected ×5 vs a Female, ×2.5 otherwise, ×7+200 at range
1–2 and a fixed zero at 3–4; and the pre-emption prompted, parked the original attack, and cost
a point of Luck by day and none at night.

**Three interface repairs** shipped alongside, all found by measurement rather than report:

- **Every token's artwork rotation is locked.** Facing is `system.facing`, an eight-point compass
  the Combat Process reads; Foundry's own `rotation` is artwork orientation and nothing in this
  system touches it — so an unlocked token let a player spin the picture away from the direction
  the rules were using. Enforced on every compiled prototype, on creation, and by a GM-side sweep
  over existing tokens.
- **The facing control was unusable.** It was a `<select>` inside Foundry's fixed 35px
  `.control-icon`, measured at **25px wide with 16px of that spent on padding** — nine pixels of
  content box for "South-west", plus a dropdown arrow wider than that. It rendered as an empty
  grey sliver. Replaced by the thing the box is shaped for: one arrow pointing the way the unit
  faces, left-click clockwise and right-click anticlockwise.
- **Facing was invisible on the board.** The field the rules read appeared nowhere except that
  dropdown, one unit at a time — the same defect as a stat with no display. `FGTToken` now draws
  a chevron on the token itself, sized so its tip lands on the token's own boundary and never
  crosses into the next panel.

### Master rank, and painting a bounded field — **built**

Spec: `docs/superpowers/specs/2026-09-02-master-rank-and-field-painting-design.md`. Four commits,
each leaving the system working.

**The spec's first draft was wrong, and correcting it is the lesson.** It reported
`if (!rank) return true` in the two cost readers as a defect that priced every Master as High.
It is not a defect — it is Ch. 15 §15.4 (*"Rankless Masters use the left column"*), stated in
twelve lines of comment directly above the nine lines of code, which the first pass did not read.
Rankless was already representable and Ch. 17's all-Rankless Kill Yourself rule was already
implemented **and tested**. The design was rewritten around what was actually missing before any
of it was built, and the de-duplication that followed is explicitly behaviour-preserving: its
regression tests were written and passing *before* the refactor, so they capture today's prices
rather than tomorrow's.

What was actually missing:

- **Nothing could set a rank.** A free-form string with no vocabulary and no control on any
  sheet. Worse, `Rank.parseOrNull` **throws** rather than returning null for what it cannot
  parse, so `rank: "high"` did not read as Rankless — it crashed `npCostAt`.
- **The coin flip discarded the rank it determined.** §14.9's `coinFlip` mode mapped its `1d2`
  straight onto Base Attack (MAG) 125/100, with a comment saying *"the rank exists here only to
  select it"*. It does not: the rank also decides ZON, Sustainability, the parameter grant and
  the Kill Yourself price. A table that flipped Heads got a Master with 125 who was **Rankless
  for every other rule in the game**. The coin now picks the rank and Base Attack derives from it.
- **All three grants were unwired.** `zonRadius` had no rank term at all despite Ch. 06's formula
  listing one; `relationships.mjs` had no Sustainability term; and the summon dialog offered the
  *choice* of which Parameter to raise while nothing limited *how many*.

`masterTier` on the snapshot then let Jack's Mist state its Advanced Note — and the live test
caught a gap the unit tests could not: `isExempt` was wired into `interiorModifiers` only, so an
interior **event** could author an exemption, compile it, and fire anyway. The contact clause is
an event.

**The painter** is Ch. 43's mode E, and it rested on a defect underneath it. `fields.mjs#shapeOf`
stored a field's Region as the **bounding rectangle** of its panels while `boundedFieldsOf` read
the panels back off the Region — so a freeform footprint was squared off on the next board read.
Invisible while every field in the corpus was a square, where the two are the same set. That fix
landed first and alone.

Three defects surfaced only by driving the painter with a **real pointer** rather than calling
its handlers:

1. `turnStateAt` copies a fixed key list, so `reshapedField` was written to the document and
   invisible to every snapshot reader — the once-per-Turn gate never closed. The same
   authored-with-no-reader trap this project keeps finding, one layer up.
2. A PIXI 7 federated event sets `data` to *itself*, so `data.originalEvent.shiftKey` is
   undefined and every stroke read as paint. The tell was a counter sitting at exactly 25/25: it
   *was* painting, over panels already down.
3. The HUD's empty-state hint is hard-coded to mode B's controls, which is a lie in a session
   where `Enter` confirms.

Verified live: ZON 4 → 5 and Sustainability 6 → 7 for a High Rank Master, with the Sustainability
bonus lapsing on the Master's death and ZON not — matching a sheet that says "while alive" of one
and not the other; a High Rank Master walks into the Mist unpoisoned and is poisoned at the end of
their Turn; and through a real pointer, the HUD button opens the painter at 3/25, a drag paints it
to 6/25, `Enter` commits exactly those six — a **non-contiguous** set a bounding rectangle would
have made twenty — the button then disappears for the rest of the Turn, and `Escape` after a drag
leaves both the field and the flag untouched.

**One gesture is unverified by machine.** The test harness applies modifier keys to clicks but not
to synthesised drags, so shift-drag *erase* was confirmed only by reading `event.shiftKey` as
`true` on a real shift-click. The code path is otherwise identical to paint.

### Pale Rider — **in progress**

Spec: `docs/superpowers/specs/2026-09-02-pale-rider-design.md`.
Plan: `docs/superpowers/plans/2026-09-02-pale-rider.md`. Eight commits, each leaving the system
working.

He is the strongest argument in the corpus for the snapshot/intent boundary (Ch. D §D.26):
almost nothing on his sheet is an attack. Everything he does happens *around* him, which is why
the bounded-field model of Ch. 43 is what makes him buildable without a special case per line.

#### Commit 1 — the unit shape, two grants, ZON from a stat, three effects

| Piece | What it repairs |
|---|---|
| `undamageable` on `unitCommon()` | `null` Health was already the convention and the pipeline already halted on it, but **nothing could reach it**: `ServantData#prepareBaseData` backfills a null max from the END table, so a Servant whose sheet says "Base Health: —" quietly acquired 1600. The flag makes the backfill stand aside; `SummonData` gets the same, for the Kagome Spirits. |
| `GRANTS.noNormalAttack` / `noReactions` | The first two grants that take a capability away rather than adding one (Ch. 04). |
| `ZonBonus fromStat` | The first ZON clause whose size is a **stat**, not a number (Ch. 06 §6.9). |
| `Heal percentOfMax` | Regen restores *"10% of its maximum value"*; the event action could only heal a rolled or literal amount. |
| `charm`, `regen`, `dmgCut` | Three catalogued effects with no content file. `charm` is the sharper one: `rules/control.mjs#isCharmed` has looked for exactly this id since it was written, so the whole control subsystem pointed at a definition that did not exist. |

**A defect found while building it, which the spec had not predicted.** `DamageNegation` has
carried `mode: "flat"` as its **executor default** since it was written, and
`engine/attack.mjs#rollNegation` opened with `if (n.mode !== "dice") continue`. Every negation
in the corpus happens to be dice-mode — Battle Continuation, both Territory Creations — so the
gap never showed: a flat negation authored cleanly, collected cleanly into `damageNegation`,
and reduced **nothing**. Dmg Cut is the first flat one, and it would have silently done nothing
at all. `rollNegation` now emits flat entries with their resolved value and no roll.

`uses` is the other half. A `DamageNegation` had no charge count, so *"3 times"* had nowhere to
live. It now carries the same three fields `AutoSucceed` already carried for the same reason —
`defId`, `uses`, `consumesUse` — and a charge is spent **only when stage 12 had damage to
reduce**, because a charge burned against an attack that already dealt nothing would make three
uses mean fewer than three.

**Measured live in `fgt2026`** (a Pale Rider stand-in; the Servant file lands in commit 8):

| Clause | Measured |
|---|---|
| *"Base Health: —"*, END A | `health: {value: null, max: null}` — the END table stood aside |
| *"cannot take damage"* | 900 STR at him → **0**, stage 0 `negated by invulnerable-by-nature` |
| *"cannot perform Normal Attacks"* | Bare attack refused: `FGT \| Pale Rider (test) cannot perform Normal Attacks.` |
| *"cannot Evade, Block, or Counter"* | Both grants collected on his snapshot; `offeredReactions` returns nothing |
| *"Master's ZON +X, X = MOV"* | ZON **8** = base 2 (Rider) + MOV 6, at distance 2 from his Master |
| …with Riding's Active (+6 MOV) | ZON **14**. Read literally; flagged in §6.9 rather than capped |
| Dmg Cut, flat −100, 3 times | Real attack: stage 12 `flatReductions` 280.4 → 180.4, contributor `damageNegation −100 (dmgCut)`; 180 dealt (4940 → 4760); uses **3 → 2** |

#### Commit 2 — the machinery those effects turned out to need

Commit 1 landed Charm and Regen with three clauses recorded as unmodelled. Building them
instead surfaced **four more defects**, three of them in code that had been shipping, tested and
inert for as long as it had existed. This is the same pattern as Jack's nine additions: what
looks like a missing feature is usually a wired-up-looking subsystem with a severed wire.

**1. Charm transferred no control at all.** `rules/control.mjs` — 130 lines, fully unit-tested,
computing exactly the right answers — **had no consumer anywhere in the system**. Its only
import was `fgt.mjs`, which never called it. Underneath sat two more failures, either of which
alone was fatal:

- `unit.ownerUserId`, which `controllerOf` reads, was **projected by nothing**. Every unit
  answered `undefined` and the whole control map collapsed to the GM. It is resolved now in
  `engine/board.mjs`, because the rules layer may not touch `game`, and it skips Gamemasters:
  Foundry grants a GM `OWNER` on everything, so "the first owner" names a GM for every unit in
  the world.
- `charmSource` searched `unit.effects` — a list of **bare defIds** — for an object carrying
  `source.unitId`, **a shape the projection has never produced**. The source lives on
  `effectInstances.sourceUnitId`. The file's own tests were written against the same invention,
  so the suite was green and the feature did nothing; the fixtures now build what a real board
  builds.

Wiring it needed one new question the module did not answer: `controllerOf` says who may act
with a unit, and nothing said **whose Turn** it acts on. `actingFactionOf` does, `annotateControl`
settles both once per board, and the two consumers are the movement gate and the action budget.
The two answers differ deliberately in one case: with the charmer off the board, control falls
back to the GM and the *Turn* falls back to the unit's own faction — a unit that can never be
activated is a softlock, not a rule.

**2. An effect-borne handler never knew when its own effect ended.** Ch. 11 §11.9's *"does not
fire on the turn it ends"* was enforced in the periodic pass and nowhere else, because the effect
pseudo-ability passed `defId` and `uses` and not `expiry`. Regen's three intervals are a handler,
not a periodic, so it would have healed one extra 10% on its way off the unit — as would every
future effect written this way.

**3. Regen subscribed to nothing.** The handler field is `event`, which *may hold an array*;
authored as `events:` — the plural reads naturally, and Regen is the corpus's first multi-event
handler — it compiled, validated, loaded, and listened for `undefined`. Caught by a unit test
written for defect 2. The content validator now refuses an `OnEvent` that names no event.

**4. Charm's removal needed a per-bearer condition on a boundary event.**
`requiresDamagedThisPhase`: `fireCombatPhaseEnd` reports which units the phase actually damaged,
read off the sibling messages' results. The **Phase**, not the Process (Ch. 12 §12.1) — a Charm
broken by the opening attack must not be broken again by the counter it provoked — and an Evade,
a fully-absorbed Block, or being the attacker all leave it standing.

**Measured live in `fgt2026`:**

| Clause | Measured |
|---|---|
| Charm moves control | A faction-2 unit charmed a faction-1 Servant: `factionId` stayed `faction-1`, `actingFactionId` became `faction-2`, `controllerUserId` moved from Player1 to Player2 |
| …and the unit lists | It left `unitsControlledBy(Player1)` and joined `unitsControlledBy(Player2)` — both halves, since a unit in two lists acts twice |
| …and the budget | A Move spent came off **faction-2's** `servantMove` (0 → 1) with faction-1's untouched |
| Charm removal | Fires only for a unit in `damagedIds`; silent for an undamaged participant and for an untracked phase |
| Charm immunity | `berserk`, `confuse` on the bearer's `immunities` |
| Regen's three intervals | One handler listening on `turnEnd`, `actedTurnEnd`, `roundEnd` — the proof the `event:` fix took |
| Regen heals of maximum | 150 on a 1500-max unit |
| Regen's final turn | Fires at tick 11 with expiry 12; **silent** at tick 12 |

Still unauthored, and now the only thing left: **Berserk and Confuse** as effect definitions.
Charm declares immunity to both, so the relationship is expressed and switches on the moment
either exists. Neither is a Pale Rider clause, and Ch. 18 §18.5 lists Confuse's random action
selector as an open item of its own.

#### Commit 3 — passive fields, geometry that reads the board, Contagion

Contagion is the first **passive** bounded field: *"(Passive) The 2 panel area around Pale Rider
is the Contagion area."* No cast, no duration, no cooldown — `ensurePassiveFields()` reconciles
it with the board at `ready` and at every Turn start, idempotently, so a Servant summoned
mid-match or a reloaded world repairs itself at the next boundary.

| Piece | What it is for |
|---|---|
| `field.passive` | a field nothing casts and nothing expires |
| `geometry.overrides` | one area measured differently while an effect stands or another field is open (§43.3) |
| `HealthLoss` | a deduction that is explicitly **not damage** (§43.6) |
| `chance` / `duration` on `ApplyEffect` | the probability and the clock belong to the field, not to the effect |
| event `branches` | the same trigger, different numbers **per victim** |
| `self:withinOfOwnerMaster:<n>` | a distance to a third party neither side of the clause is |
| `unitTurnEnd` dispatch | §E's last undispatched time event |

**Three defects found building it**, two of them older than Pale Rider:

1. **A bounded field could only belong to a Noble Phantasm.** `field` was declared on
   `NoblePhantasmData` alone — every field in the corpus so far is an NP, so nothing had ever
   noticed. Contagion is a **Skill**, and its whole six-axis block was dropped by the schema
   in silence: the Item loaded, its `field` read `null`, and the passive sweep found nothing to
   open. `test/unit/item-schema-coverage.test.mjs` now fails the build when any authored key is
   missing from the model its document compiles to.
2. **`medea-rule-breaker.yml` authored `npType: antiUnit`** — a key no schema declares and
   nothing anywhere reads. The field is `npTags`. Caught by that same new guard on its first
   run. It matters immediately: §43.8's vulnerabilities and Doomsday Come's `piercedBy` both
   compare scale through `meetsTagThreshold(npTags, …)`, and an NP with an empty tag list clears
   no threshold and triggers no vulnerability.
3. **A `followsUnit` field's drawn Region never followed anything.** Membership was always
   right — `panelsOf` recomputes from the anchor every time — but the Region was drawn once at
   cast time and left there, so the area a player could *see* was in the wrong place for every
   field of that kind, Sikera Ušum's 5×5-follows-Semiramis branch included. Foundry v14 answers
   this natively: a Region carries `attachment.token` and the core translates its offsets as the
   token moves. Fields are created attached to their anchor's token — the **Master's** for
   Doomsday Come. Resizing is the half the core cannot do, so `syncDerivedFields()` redraws a
   field whose computed panels no longer match its drawn ones, on effect changes and at Turn
   start.

**Measured live in `fgt2026`:**

| Clause | Measured |
|---|---|
| The area exists without being cast | `ensurePassiveFields` opened a 25-panel field owned by him; a second pass left exactly one |
| *"The 2 panel area around Pale Rider"* | 5×5, drawn centred on him |
| Active → *"9x9 panel area"* | live and drawn both 81, still centred |
| It follows him | moved 3 west; drawn area moved with him, still centred, no redraw needed |
| Active expires | back to 25, centred |
| *"Health is reduced by 100 … does not count as 'damage'"* | one `statDelta` intent, **100** lost against a standing Def Up of 50%; twenty firings, all exactly −100 |
| *"50% chance of Poison"* / *"10% chance of Charm"* | 9 and 3 out of 20 |
| *"Charm for 1◈ Turns"* | expiry = tick + 1◈ |
| *"Affects all enemy Units within"* | Pale Rider stands inside his own field and is untouched; only the enemy is affected |

#### Commit 4 — Doomsday Come's axes, the rolled radius, and the extension runner

Doomsday Come is the corpus's only field whose **size is rolled** (`shape.radiusRoll`, evaluated
once at cast and stored — a field that re-rolled on every read would breathe, and membership
would depend on who asked last) and the only one anchored on a unit that is **not its creator**.

**`extensionFor` had no caller.** Authored on Chaos Labyrinthos from the day Asterios was
written, it was a pure function nothing invoked, so a field with a paid extension simply closed
on schedule and the whole attrition cycle — the owner burning their own Health to keep the trap
shut while the trapped burn theirs escaping — was decoration. `expireFields` now offers it, and
only when the **clock** is what is closing the field: one ended by its owner's defeat is not for
sale. Building it forced three things into the spec:

- **`payer`** — Doomsday Come charges Pale Rider's *Master*, Chaos Labyrinthos charges Asterios.
- **`minimum`, which is not the price** — *"cannot be used if the Master's Health is less than
  100"*: at exactly 100 they may pay it down to zero, at 99 they are **never asked**. Defaults to
  the price where no floor is stated, and the two refusals stay distinguishable.
- **`sideEffects`** — Asterios's re-apply `Atk Dwn`/`Def Dwn` to every enemy *currently* inside,
  read from the board rather than remembered from cast time.

**One defect in the new code, found by testing the second author rather than the first.** The
payer was resolved with `game.actors.get(id)` and charged through the applier, which resolves
the **token's** actor. For an *unlinked* token those are two different documents with two
different Healths — so the affordability question was put to the prototype nobody is playing
while the charge landed on the token. It cost an hour of chasing a phantom "payment not applied"
before the two Asterios tokens on the board explained themselves. The payer now comes from the
board.

**Measured live:**

| Clause | Measured |
|---|---|
| *"X = (2 + number rolled on a four-sided die)"* | five casts: radii 6, 3, 6, 3, 4 — range 3–6, every size `2r+1`, every panel count `size²` |
| *"an X panel area around Pale Rider's **Master**"* | centred on the Master at (10,1) while Pale Rider stood at (10,14), Region attached to the Master's token |
| *"enemy Units within cannot leave"* | exit refused, `sealed` |
| *"enemy Units outside can enter it"* | entry allowed |
| *"allied Units can freely Move in and out"* | ally exit allowed |
| *"Units outside cannot Attack Units within it and vice versa"* | both directions blocked; inside-to-inside allowed |
| *"extend … by reducing its Health by 100"* | prompt named the Master and the price; 150 → 50; expiry 10 → 13 |
| *"can be repeatedly extended"* | a second payment charged another 100 |
| *"cannot be used if the Master's Health is less than 100"* | at 99: **zero prompts**, field closed, Health untouched |
| *"Cooldown: 8◈ Turns **after** Doomsday Come ends"* | 24 ticks, stamped at closure |
| Chaos Labyrinthos, `payer: owner` | Asterios paid **200 of his own**, expiry +2◈, and every enemy inside gained `Atk Dwn` and `Def Dwn` while he did not |

#### Commit 5 — the Anti-World escape and the drag-in

One clause read three ways (isolation opens, interior halves, vulnerability ends) plus the
drag-in, and the pass turned up **four defects, three of them older than Pale Rider**.

1. **A bounded field's interior rules had never been validated.** `ruleElements` walks an
   ability's `rules`/`passiveRules`/`activeRules` and its phases — and not `field.interior`. So no
   field's interior has ever been checked for unknown keys, unknown tables, malformed predicates
   or anything else, Jack's Mist and Sikera Ušum included. It now is.
2. **A `modifierKey` outside the damage pipeline's closed buckets is silently unread.** The
   shelter shipped as `modifierKey: doomsdayShelter`, was collected onto every unit inside, and
   was never consulted — a "reduced by 50%" that authored cleanly and reduced nothing. The
   pipeline now exports `MODIFIER_KEYS` and the validator refuses one it does not read.
3. **An interior rule's `predicate` was dropped.** `annotateFields` called the executors with
   `ctx: {}` and no `deferred`, so the predicate never reached the contribution. The shelter
   therefore applied to *every* attack of every scale rather than the [Anti-World] one that earned
   it. `deferredPredicate` — the mechanism `collectContributions` has used for ability rules all
   along — is now used here too.
4. **An unknown `chooser` throws at resolution rather than failing the build.** The drag-in was
   authored `chooser: caster`, a word that reads perfectly and has never existed. Now refused by
   the validator, alongside the anchors and shapes it already checked.

Two more in the new code, both the same mistake made twice: **reading a bare `unitSnapshot`
where a board-annotated unit was needed.** Which fields a unit stands in is a board-wide
annotation, so `closeFieldsPiercedBy` asked `undefined` and the area never came down; and
`randomFreePanelIn` did not clip to the board's bounds, so a drag could land a Unit on an
off-board panel and thus outside the area it was dragged into.

**Measured live:**

| Clause | Measured |
|---|---|
| *"cannot Attack Units within it and vice versa"* | Normal attack, Anti-Army and Anti-Country NPs all refused `separated by pale-rider-doomsday-come` |
| *"a Noble Phantasm of [Anti-World] or higher can be used on"* | the same attack, tagged `antiWorld`, resolved |
| *"its Total Damage is reduced by 50%"* | `defUp −50 (pale-rider-doomsday-come)` present for the Anti-World NP and **absent** for the Anti-Army one |
| *"forcibly ended at the end of that Combat Process"* | field open before, gone after, with the 8◈ cooldown stamped at closure |
| *"within a 2 panel area of the Doomsday Come area"* | at 2 legal; at 3 *"is 3 panels from the area; Range is 2"*; already inside refused by name |
| *"the DU is forcibly dragged into the area"* | dragged from outside to a free panel inside, its `fields` then naming the area; the Attack spent |
| *"if the Evade succeeded, nothing happens"* | six evades at AGI 60, all `resisted`, all leaving him outside |

#### Commit 6 — Innocent World

Six numbered clauses, seven interior rules (clause 4 is two mechanisms), all of them authored on
**Doomsday Come's area** rather than on the Skill — because *"constantly affects all enemy Units
**within** 'Doomsday Come'"* is a fact about the area, which is what makes it apply to a Unit
dragged in by somebody else and stop applying the moment it leaves.

Three option families, none of them Pale-Rider-shaped:

- `self:highestParameter:<p>`, emitted once per Parameter **tied** for the top, so *"if the Unit
  has two or more Parameters of the same Rank, it is affected by all related effects"* falls out
  of set membership rather than needing a clause of its own. An unranked Parameter is skipped
  rather than counted as lowest.
- `self:npAboveAllParameters` — *higher*, not equal.
- `self:stableDie:d6:<n>`, a **hash** of the Unit's id folded to 1–6 rather than a stored roll.
  *"That Unit will receive the same effect every time"* then costs nothing: identical on every
  read, survives a reload, agreed by every client without anybody persisting it. It satisfies the
  clause's intent rather than its letter — no die is ever rolled, so a GM cannot reroll one.

Every clause is authored as `{or: [highestParameter, stableDie]}`, so the sheet's two halves are
one predicate rather than two rule sets: a Unit **with** Parameters never emits a face, and a Unit
without emits exactly one.

**Two engine pieces beyond the options:**

- **An interior rule's predicate is split per clause** — the unit half answered at annotation, the
  attack half carried to the pipeline, and the answered half **stripped**. Stripping is a
  correctness requirement, not tidiness: `self:` in the pipeline's option set means the
  *attacker*, so a carried `self:highestParameter:agi` on a defender-side modifier would be
  re-tested against the wrong Unit entirely.
- **A standing suppression can prevent an action.** `preventedBy` reads `unit.suppressions`
  against the same `PREVENTS` table it reads held effect ids against, so `Suppress scope: npSeal`
  refuses a Noble Phantasm exactly as the effect does — and *"cannot be prevented or removed as
  long as a Unit is within"* is then free, because an interior annotation has nothing for Dispel
  to find.

**Measured live**, with thirteen Units standing inside a 13×13 Doomsday Come:

| Clause | Measured |
|---|---|
| 1. STR highest | Heracles (foe) → `atkDwn` alone |
| 1 + 2, tied | Asterios (foe), STR = END → `atkDwn` **and** `defDwn` |
| 3. AGI highest | Karna (foe) → `evade +4` |
| 4. MAG highest | both halves: `ApplicationChance incoming 50` **and** `VulnerabilityAmplifier debuff ×1.5` |
| all five tied | Dummy (test) → every clause at once |
| 6. NP above all | Karna and Asterios sealed; Semiramis (an ally, also NP-above) not |
| no Parameters | Foe Master → die face 1 → clause 1; Our Master → face 4 |
| *"the same effect every time"* | both faces identical across a world reload, with nothing stored |
| *"cannot be prevented or removed"* | NP refused `by: npSeal` with **no `npSeal` effect held**; the seal vanished when the area closed and returned when it reopened |
| *"all **enemy** Units within"* | every faction-1 ally inside carried only the Anti-World shelter |

#### Commit 7 — Guidance of the Netherworld, and the GotN discharge

Two small field-event additions: **`requiresEffect`**, the mirror of `kinds:` — a filter on what
the Unit is *carrying* rather than on what it *is* — and a **`RemoveEffect`** action, the only
one in the table that takes something away.

**GotN stores nothing.** The bundle it discharges is authored on the one field that will ever
discharge it, because an effect carrying an unapplied payload has no second consumer in the
corpus and would be a subsystem built for a single clause. `contact` fires on walking in **and**
on the field opening over you, which is what *"enters the area"* has to mean for an area that
appears around you.

The second phase carries its **own targeting** rather than an `includeSelf` flag: *"applies GotN
to all affected Units excluding itself"* reaches a different set from the Skill's, which is
neither `self` nor `reuse`. `test/unit/phase-targets.test.mjs` was demanding a `target` on every
phase of a non-attack ability; a phase with its own `targeting` has answered that question more
precisely, and the guard now says so.

**Measured live:** Guidance applied its three buffs to Pale Rider and both adjacent allies (nine
applications), then GotN to the two allies and **not** to him; a GotN-bearing ally standing where
Doomsday Come opened received Atk Up, Regen and Dmg Cut (3 charges) and lost the marker in the
same breath.

#### Commit 8 — the Kagome Spirits

The largest single piece of Pale Rider, and six general additions:

| Piece | For |
|---|---|
| `inherit` on a summon | *"Agility: Pale Rider's plus 2"* — a stat that is not a number, resolved at placement from the summoner's live values |
| `normalAttack.shape` | *"Range: 3 panels, 3×3 panel area"* — until now **every Normal Attack in the game hit exactly one panel**, because the targeting fallback said `{kind: "unit"}` and nothing could say otherwise |
| `SummonBound` | one summon per enemy, bound to it, with the type **remembered on the owner** so a reactivation returns the same Spirit to the same enemy |
| `pursuitVerdict` | *"constantly Move towards that Unit"* as a **constraint**, not an automaton |
| `fgt.attacked` | the defender-side declaration event the corpus had never had |
| `Banish` | the only thing in the game that leaves the board and comes back |

**Two more silent gaps closed on the way.** `ForceTarget` had been in the executor table since it
was written with **no reader anywhere** — Decoy's pull, Karna's *Fated Rivals* and a Spirit's prey
all pushed a suppression into a bucket nothing consulted. And `suppressions` was **never projected
onto a unit snapshot at all**: only `bypassesMasterProtection`, which reads the contributions
directly, ever escaped. So every `Suppress`, `Decoy` and `WeakPoint` an ability contributed was
invisible downstream. (A *field's* suppression worked, because `annotateFields` writes to that key
itself — which is why Innocent World's NP Seal functioned in commit 6 while an ability's identical
clause would not have.)

`attack:vsAttribute:<a>` is worth its own line: *"an Attack that deals extra damage to Units with
the 'Dark' or 'Spirit' Attribute"* is not a property an ability declares — it is a property of the
attacker's own active damage modifiers, read off the predicates they carry. Nobody has to remember
to tag anything.

**Measured live:**

| Clause | Measured |
|---|---|
| one Spirit per enemy inside | five enemies → five Spirits, each with a distinct prey and all bound to the area |
| *"Agility: Pale Rider's plus 2"* etc. | Sword +2, Beast +1, Famine −1 (floored at 0), Death equal; Luck equal; Health `null` |
| *"when Doomsday Come ends, all Kagome Spirits immediately disappear"* | all five actors **and** their tokens gone |
| *"the same Kagome Spirit ... for the same enemy Unit"* | reopened at a re-rolled radius of 5: the three enemies still inside got back their **exact** prior types, and the memory kept all five |
| *"constantly Move towards that Unit"* | a step away refused by name; a step closer allowed |
| …and *"Attack it"* | its prey selectable; an equally adjacent enemy refused *"the attacker is forced to attack another unit"* |
| *"a Light attack … Flip a Coin"* | token hidden, `state.banished` recording tick 16 = 10 + 2◈ (heads) |
| *"then it reappears on a random panel within"* | still hidden at tick 15; at 16 visible again, on a free panel **inside the area**, the record cleared |

#### Commit 9 — the relationship proxy, the Servant, and the close

`guardsOf` is the first reader `RelationshipProxy` has ever had. Both Master-protection rules
that exist — the targeting immunity and the zone denial — ask it instead of scanning for a
Servant of the right faction, so Pale Rider's Kagome Spirits stand in for him and **he does not
protect his own Master**, which is the clause's own first half.

`packs/_source/servants/pale-rider.yml` closes it: eight abilities, `baseHealth: null`,
`undamageable`, `cannotHoldItems`, and the proxy.

**Measured live**, dragging the finished Servant out of the compendium: Health `{null, null}`
with an END of A; both grants collected; ZON **8** = base 2 + MOV 6; Contagion opening itself the
moment he was placed; Doomsday Come summoning a Spirit for the enemy inside; and the Master's
guard list containing **Kagome: Sword and not Pale Rider**.

---

### Pale Rider — what the eight commits cost, and what they bought

Fourteen general engine pieces, and **eleven defects found**, nine of them in machinery that had
shipped, been tested, and never once run:

| Found | Had been broken since |
|---|---|
| A flat `DamageNegation` reduced nothing | the element was written; every negation in the corpus is dice-mode |
| `rules/control.mjs` had **no consumer**; `ownerUserId` was projected by nothing; `charmSource` read a shape the projection never produced | Charm existed |
| An effect's event handlers never knew their own expiry | `periodic:` got the rule and handlers did not |
| An `OnEvent` authored `events:` listens for `undefined` | no content had ever needed a multi-event handler |
| A bounded field could only belong to a Noble Phantasm | every field so far was one |
| `medea-rule-breaker.yml` had **no NP scale** (`npType`, a key nothing reads) | Medea was written |
| A `followsUnit` field's drawn Region never followed anything | `followsUnit` existed |
| `extensionFor` had **no caller** | Asterios was written |
| A field's `interior` rules were **never validated** | fields were authored |
| An unread `modifierKey` is silently inert; an interior `predicate` was dropped | `annotateFields` was written |
| `ForceTarget` had **no reader**; `suppressions` was **never projected** onto a snapshot | the executor table was written |

Six of those were found by *writing a test for something else*, and three by testing the **second**
author of a feature rather than the first — Asterios's extension exposed the unlinked-token payer
bug that Doomsday Come's linked-token Master had hidden completely.

Four new guards now fail the build on the classes of error that produced them: an `OnEvent` with
no event, an unknown `chooser`, an unknown `modifierKey`, and any authored key missing from the
DataModel its document compiles to.

### Shipped artwork — **built**

Every image field existed and nothing filled one: the compendium had no pictures because no
Servant file carried an `img:` line, and the repository had no directory to carry one from. The
build now indexes `assets/` and derives all three image fields from ids the content already has
— `img` from `assets/servants/<id>.*`, `defaultImage` from `assets/classes/<classContainer>.*`,
and the prototype token's texture from whichever of the two is public (Ch. 37 §37.3, D37.9).
`assets/` was also absent from the release zip, so a shipped path would have resolved to nothing
in an installed system; the workflow copies it now.

The token texture was the finding. `Actor#_preCreate` copies `img` onto a token whose texture is
unset, and a Servant is unrevealed when it is imported — so the first drop of a concealed Servant
put its true portrait on the board for every opponent, before `engine/token-image.mjs` (whose
sync runs on *update*, not create) had anything to react to. The compiled texture is the class
image, the same value `publicImageOf` would compute; the sync inherits a correct starting point
rather than repairing a wrong one.

The validator warns per missing file, naming the path it expected, and once for an empty
`assets/`; two files differing only by extension fail the build. Thirteen tests in
`content.test.mjs`.

**The artwork is in.** Twelve Servant portraits and all fourteen class images, verified in the
compiled pack: every Servant carries its portrait as `img`, its container's image as
`defaultImage`, and the container's image — not the portrait — as its prototype token texture.

Committing them found the one image miss no source file can reveal, and the check now runs in
both directions. `Class-Shielder-Gold.webp` arrived with the downloaded icon set; no
`classContainer` will ever ask for it, because Shielder is not a class this system defines
(`domain/enums.mjs`). It was inert, it would have shipped in the release zip, and by inspection
it was indistinguishable from a class image that works — a directory listing shows fifteen files
either way. The validator names it and lists the fourteen ids that would work.

### Medusa's first live summon — four defects, one of them three years old in shape

Reported from play after summoning Medusa into a Greek war as a **Free Servant**: every Parameter
tile read `+1 granted`, the Combat tab credited all five steps to a *"High Rank Master grant"*
when she had no Master, the Status panel said **Contracted**, and using Riding raised her MOV by
nothing. Four separate defects, and the first three share a cause.

**The war Region was baked into `grantedSteps`.** `summonPlan` keeps the Master's grant and the
Region's apart as separate steps — it always has, and `setup-rolls.test.mjs` pins it — but
`mergeGrants` folded them into one map and `commitSummon` wrote the whole thing to the sheet.
Everything downstream of that field says "Master", because until now that is all it held:
`grantedStepDeltas` labels it, `baseAttackFor` reads it, `applyGrantedSteps` shifts by it. So a
Free Servant was told a Master granted her five steps.

Worse, and invisible on the sheet: `annotateRegionBonus` applies the Region **live**, and says in
its own header that it is kept live *"instead of baked into the sheet"*. So on a board the Region
moved every Rank a second time and added its ±10 to Base Attack twice. `snapshot.test.mjs` already
had a test asserting a Master grant and a Region bonus stack to `C++` — it passed only because it
hand-built `grantedSteps` with the Master's step alone, which is the shape the summon never
produced. The integration between the two was never tested, and that is where the bug lived.

Now `grantedSteps` holds the Master's steps and nothing else; the rolled maxima still take both,
because those are rolled once and locked and the Region is part of that roll. The Region's effect
on Ranks is `applyRegionBonus`, which is idempotent per unit — the sheet projects with the Region
known so a player can see it before a board exists, and the board pass skips any unit already
carrying it. The tile prints the grant as the rank ladder writes it: `+ granted`, not `+1`.

**Contract state was specified as derived and implemented as stored.** §16.2 gives the
derivation and its first clause is `if (!m) return "free"`; the field initialises to
`"contracted"` and `commitSummon` never wrote it. Fixed at both ends — written at summon, and
derived in the projection whenever there is no `masterId`, so a compendium drop is right too.

**Riding's Active MOV was collected by nothing.** Medusa's Riding has `phases` (it applies the
`ridingActive` marker that unlocks Riding Attack and Passenger Seat), so `classifyAbility` calls
it `active` rather than a mode — correctly, it is used, not toggled. But `contributionsOf` reads
`activeRules` only while `system.active` is set, and nothing sets that for a used ability. Her +5
MOV was authored on the skill, shipped in the pack, printed in the tooltip, and applied by
nothing. It lives on the `ridingActive` effect now, which is in force for exactly as long as the
Active lasts.

That is the third time this shape has shipped — Monstrous Strength and Hatred of Achilles were
the first two, and both are recorded above. So it is a build failure now (D37.11) rather than a
fourth entry in this list: `activeRules` on an ability that classifies as neither a mode nor
windowed fails `validate:content`, naming what to do instead.

**Verified live, and it found three more.** The fixes above were confirmed in `fgt2026` on a
cold load: Medusa summoned into a Greek war as a Free Servant reads `B ▸ B+` on every Parameter,
`Region: greece` on all five trace lines, `Contract: Free`, and MOV 12 with Riding's Active up.
Getting there took three further repairs, and none of them would have been found by testing.

1. **The war Region had no writer at all.** Un-baking the grant made the *first* re-summon
   produce nothing, because the dialog's Region went into that summon and nowhere else while
   `fgt.region` — what every reader consults — still said `middleEast` from some earlier
   session. A war has one Region and `commitSummon` records it now (Ch. 19).
2. **Base Attack was the Parameter tile's fault a second time.** The Combat panel read
   `system.baseAttack` while every field beside it read the projection, so her sheet said 125
   and every attack she made used 135.
3. **Every `rules:`-based effect was inert on a cold load.** `EffectRegistry` is filled in the
   `setup` hook, behind an `await`, and Foundry prepares every Actor before that — so derived
   data was computed against an empty registry and effects contributed nothing until something
   touched the actor. Medusa's +5 MOV showed in the sheet's explainer, which reads a
   render-time snapshot, and not in her MOV, which did not. `fgt.mjs` re-prepares every unit
   once the registries are loaded (Ch. 23 §23.2).

**One thing this does not fix.** A Servant summoned into a matching Region *before* this change
has the Region baked into her stored `grantedSteps`, and no migration can tell those steps from a
Master's after the fact. Her Ranks were already double-counted on a board; they now double-count
on her sheet too, which is the same defect made visible. **Re-summon her.** Ch. 39's migration
framework is still specification-only, which is the honest reason there is no automatic repair.

### The action bar, and the three actions nobody could reach — **built**

Reported from play: *"I don't like how the current hud on the token is done, it seems ugly,
specially because the actions overflow."* The overflow was structural rather than cosmetic. The
F/GT column appended one vertical `col` to Foundry's token HUD and packed into it a budget pip,
Attack, Move, a facing dial, six abilities, one toggle per mode, two buttons per open field and
effect pips. Foundry sizes that column for about four controls. Medusa produces twelve, and a
list with **no upper bound** cannot be styled into a fixed height.

Auditing the action economy to rebuild it found the real defect. `rules/budget.mjs` defines eight
`ActionKind`s, and **three had no caller anywhere in the repository**:

| Action | Engine | State |
|---|---|---|
| `mark` | `engine/marks.mjs#placeMark` | complete, never called |
| `gather` | `engine/gather.mjs#gather` | complete, never called |
| `ridingAttack` | `engine/riding.mjs#performRidingAttack` | complete, never called |

Every one of them was finished — budget checks, turn bookkeeping, intents, chat output.
`placeMark` detects the completed Bloodmark square and opens the field. `riding.mjs`'s header
says outright that `GRANTS.ridingAttack` *"has been declared since grants were written and no
engine ever read it"*. The consequence in play was that **Blood Fort Andromeda could not be
built**, Semiramis's Construction could not be fed by Gather, and no Servant could perform a
Riding Attack. This is the authored-and-inert shape this chapter keeps recording, one layer up:
the rule-element version is above, and this is the action version.

`rules/actions.mjs` declares every unit action as data with an availability predicate over a unit
snapshot and the board, `engine/actions.mjs` maps each id to its engine, and a drift test holds
the two against the `ActionKind` union in **both** directions. A ninth kind now fails the build
until somebody decides how a player reaches it. The guard was checked by adding a fake `teleport`
kind and watching the suite go red.

**Verified live in `fgt2026`.** Four Bloodmarks placed from the bar onto the corners of a 5×5;
Blood Fort Andromeda opened; the Mark slot then withdrew itself, because *"Medusa cannot place
new Bloodmarks while Bloodfort Andromeda is Active"*. That sequence had never been possible.

The live pass found two defects that inspection would not have:

1. The bar's template wrote `data-row="{{../row.id}}"`, which renders **empty** under Handlebars
   block params — a block parameter stays in scope inside the nested `each`, and `../` walks past
   it to nothing. Every click read a blank row, matched no branch, and returned without a word:
   precisely the silent dead control the bar exists to abolish.
2. Refusals were localized blindly, and the engines disagree about what `reason` is. `placeMark`
   and `gather` return ids that key a translation; `budget.affordable` returns a finished English
   sentence. The screen read `FGT.Action.Refusal.Servant attacks exhausted (2/2)`.

`apps/hud/token-hud.mjs` is deleted and `turn-hud.mjs` is now `turn-panel.mjs`, a context builder
and three handlers that the bar renders at its right-hand end. The turn panel stays
faction-scoped beside a unit-scoped bar, because the End Turn gate is about the faction's whole
budget. `FACINGS` turned out to be declared twice; `domain/enums.mjs` had always exported it.

### Clickable rules in every description — **built**

Asked for directly: *"if someone is reading the description of an NP that applies burn, that they
are able to see 'burn' as clickable compendium entry"*. The question came with a premise about
the actor and item architecture, and the premise turned out not to be where the problem was.

**Three facts, checked rather than assumed.** `@UUID[...]` is Foundry **core**, not a pf2e
invention: `TextEditor.enrichHTML` runs `_enrichContentLinks`, whose accepted types are
`CONST.DOCUMENT_LINK_TYPES.concat(["Compendium", "UUID"])`. Foundry's Actor document declares
`embedded: {ActiveEffect: "effects", Item: "items"}`, so pf2e's items sit on an actor exactly
where ours do and "embedded versus standalone" was never a choice for actor-owned items. And an
embedded document has a resolvable UUID, so a Servant's own abilities are addressable without
shipping anything standalone.

**What was actually missing was one call.** Searching all of `module/` for `enrichHTML` returned
nothing. 195 linkable documents already shipped; the templates printed descriptions raw.

Markers are authored (`@effect[burn]`), resolved to real links at build time, and rendered by
Foundry's own enricher. Actions are rules rather than documents, so they got the `fgt.rules`
JournalEntry pack — **declared in `system.json` since `0.1.0` and never populated** — and eight
pages, one per action kind. `master-essences` is the second such pack and is still empty;
`docs/Master Essences.md` is the source its 35 essences will be built from.

**The retrofit, measured rather than estimated.** 197 unmarked mentions across the corpus, all
marked, ending at zero. Verified in `fgt2026`: Karna's sheet carries 23 content links and no raw
marker, Burn opens the effect, and Gate of Skye's *Primordial Rune* opens Scáthach's own embedded
ability from inside her.

**Three defects the work found, each invisible until something exercised it:**

1. **Embedded abilities were never rewritten.** `compileEmbeddedAbility` does not pass through
   `compileDocument`'s rewrite, so every Servant ability — the descriptions players actually read
   — shipped with `@effect[burn]` printed on the sheet. Caught by the first live check.
2. **The warning demanded what the convention forbade.** It asked for a marker on the *second*
   occurrence of a name already linked in the same description, 61 times, when the rule is to
   mark the first and leave repetitions as prose.
3. **Actions cannot be found by name.** Indexing them raised the warning count from 214 to 365,
   because "Attack", "Move", "Skill" and "Spell" are ordinary words in this prose. An action must
   be marked explicitly; it is excluded from the name index entirely.

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

**D1. The remaining 23 Servants** — **STARTED.** Nine authored: Heracles, **Karna**,
**Asterios**, Penthesilea, Medea, Scáthach, EMIYA, Serenity and Semiramis.

---

### Asterios and Karna — and the argument for live testing, made twice

Both were on the "authored" list before this pass. Asterios had all five abilities and Karna had
four of thirteen, and **the four included neither of the two that define him**. Finishing them
found seven defects in shipped code, and the two most serious were not in either Servant.

**Every cooldown in the game was broken.** `cooldownFor` gated its branch lookup on
`if (cd.branches)`. `branches` is an `ArrayField`, so the DataModel turns the `null` the compiler
writes for an ordinary string cooldown into `[]` — and `[]` is truthy. Every ability whose
cooldown is a plain tick expression entered the branch path, matched nothing, and got no clock.
Measured before the fix: **49 of 49 abilities** across six authored Servants returned no cooldown.
It arrived with `cooldown.branches` itself (Summoning: Bašmu, still the only ability that has
any), so every Servant verified before that was verified correctly and had been wrong since.

**`board.warRegion` was permanently `null` in every world.** It reads `combat.system.region`, a
field declared on `MatchData` that **nothing in this system has ever written** — no setup flow, no
sheet, no API — while the Region a GM actually picks lives in the `fgt.region` setting, read only
by `engine/summon.mjs`. So §5.6's Region Parameter grant, the Hanging Gardens' Construction
multiplier and Asterios's Greece clause were all inert. Two sources, one written and one read.

The other five: non-damaging Noble Phantasms dealing their caster's Normal Attack (five shipped
NPs; Chaos Labyrinthos measured at 203 damage); `RankShift`'s parameter branch silently dropping
`to:`, so *"STR B → A"* would have produced `B+`; `negatedBy` read only on the use path, leaving
an ability's rules contributing under a refused button; `Ward` dropping `npValue`; and the damage
pipeline losing a point to binary floating point at large percentages (1030 into Kavacha and
Kundala floored to 102 instead of 103).

**Two unit-test fixtures described shapes no document ever has**, and each hid one of the two
worst findings: `onMasterDefeated`'s test supplied a `modes` array nothing writes, and
`cooldownFor`'s omits a `branches` key the DataModel always supplies. Both tests passed. The
lesson is worth stating as a rule, because it landed twice in one pass: **a fixture is only
evidence if it is the shape the caller actually gets.**

Four new validator checks came out of it, each because something had already gone wrong silently:
targeting anchors and shapes (an unknown anchor *throws*), requirement kinds **and selector
fields** (an unknown kind refuses, which is loud — a misnamed field on a known kind **passes**,
which is not), rank tables named inside an event action, and `applyEffects` phase entries
classified as the effect specs they are rather than as rule elements.

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
                       Nine done. Asterios and Karna were both already ON that list and both
                       were unfinished; finishing them found seven defects in shipped code,
                       and the two worst -- every cooldown in the game, and a war Region
                       nothing ever set -- were in neither Servant
C3 ✔ → C4 ✔            platforms and bounded fields. PHASE C COMPLETE.
D2 → D3 → D4
```

The one ordering constraint that is not obvious: **D1 should run continuously alongside B and C,
not after them.** Every Servant authored so far has found an engine gap — Karna found the
`equality` table kind, Heracles found the Def Dwn family and the mode/attack conflation. Twenty
more Servants is twenty more chances to find a defect while the surrounding code is still fresh.

And a second constraint the Asterios/Karna pass established: **"authored" is not a status a
static check can award.** Both were listed as authored. Asterios had five abilities of which
*six clauses* had no reader; Karna had four of thirteen. What separated the two states was not
more content but a **live board** — the cooldown regression, the null war Region, the
non-damaging Noble Phantasms and the vacuously-passing requirement gates were each invisible to
2 000 passing unit tests and obvious within minutes of a real world. A Servant counts as done
when every clause on its sheet has been *measured*, individually, in `fgt2026`.

---

**Previous:** [44 — Case Studies: the Expanded Roster](44-case-expanded-roster.md)
