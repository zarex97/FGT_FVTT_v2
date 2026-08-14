# Changelog

All notable changes to the F/GT Foundry VTT system — its specification and its code — are
recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html), interpreted as follows:

| Bump | Means |
|---|---|
| **MAJOR** | A change that invalidates work already built against the previous version. |
| **MINOR** | New chapters, new subsystems, new content — additive. |
| **PATCH** | Corrections, clarifications, typos. Nothing an implementer would have to redo. |

Two categories deserve their own headings and get them:

- **`Corrected`** — we had it *wrong*, not merely incomplete. Every entry names the superseded
  reading, so that anyone who read the old text can recognise what they absorbed.
- **`Answered`** — an open question in [Chapter 41](docs/41-open-questions.md) was resolved by
  the game's author. These are the highest-confidence changes in the document.

Chapter numbers refer to files in [`docs/`](docs/00-index.md).

### Two version lines

Before any code existed, this file tracked the **specification**: `0.1.0`, `0.2.0` and `0.2.1`
below are documentation versions, and they are labelled as such.

From **`0.1.0` onward** the numbered releases are **system releases** — the version in
`system.json` and the tag Foundry installs from. The two lines are separate and the numbers
coincide by accident; the headings say which is which.

---

## [Unreleased]

**Making the content actually run.** `0.1.0` shipped a rules engine and a compendium of content
that the engine collected and then ignored. Every entry here closes one of those gaps.

### Added

- **`module/rules/elements.mjs`** — the rule-element executor table. Thirty keys, each turning a
  data declaration on a compendium document into a contribution the engine consumes. Elements
  with no executor are surfaced in `contributions.unhandled` rather than dropped, because a rule
  element that silently does nothing is the single worst failure mode in a data-driven system.
- **`module/rules/registry.mjs`** — `EffectRegistry`, loaded from the `fgt.effects` pack at
  `setup`, so an ability's `applyEffects` phase can resolve `{id: defDwn}` to a real definition.
- **`module/rules/derived.mjs`** — `applyStatDeltas`, folding collected `StatDelta`, `MaxDelta`,
  `MovDelta`, `RangeDelta` and `RankShift` contributions into the actor's derived data. Mad
  Enhancement's `MOV +2, Range +1` now shows on the sheet and reaches the movement planner, not
  only a damage calculation.
- **`checkPlan(unit, check)`** — the bridge from `CheckModifier`, `TableOverride`, `AutoSucceed`
  and `RollAdjustment` contributions to the arguments an Evade or Luck Check actually takes.
  Mad Enhancement clause 6 is no longer a hard-coded effect id in the attack orchestrator.
- **`module/engine/turn-order.mjs`**, **`module/documents/combat.mjs`** — `FGTCombat` with the
  global turn counter, ◈-aware `turnsPerRound`, and tie-breaking rerolls.
- **`module/engine/scheduler-hooks.mjs`** — the scheduler bound to `combatTurnChange` and
  `combatRound`, guarded so only the active GM writes.
- **Content**: `Mad Enhancement` (all seven clauses), the `Def Dwn` effect family.
- **`module/rules/budget.mjs`** — the turn budget: four independent pools, the per-unit
  once-each limits, the prevention table, and the compulsion check. The unit-counting rule
  (D18.3) is implemented as stated: a Servant that moves and then uses an Active Skill has
  consumed **one** `servantMove`, and an Active Skill draws from the move pool (D18.2).
- **`module/engine/budget.mjs`** — the budget stored per faction on a Combat flag, spent through
  the GM proxy, with a `setBudget` operation whose authorizer refuses any write to a faction the
  caller does not control **or** whose turn it is not.
- **`TurnHUD`** — the panel from §18.9: pool pips, a per-unit move/attack/movement-left row, and
  the compulsion warnings, with **End Turn disabled while any compulsion is unmet** and the
  reason shown inline. Compulsions are turn-scoped constraints that can only be violated in
  retrospect, so they are displayed from the moment they apply rather than raised as an error
  after the fact.
- **`markTurn` intent** and the `turnState` fields it writes — `movedPanels`, `moveSegments`,
  `usedActiveSkill`, `mayMoveAgain`, `usedRidingAttack` — so Riding's two-segment move and
  Riding Attack's terminality are representable.
- Declaring an attack now spends the budget and marks the unit, and the start of each faction's
  turn resets both. A non-damaging Noble Phantasm costs the Servant's attack, as the source
  states explicitly.

### Fixed

- **Rule elements were collected and never executed.** `snapshot.mjs` now runs
  `collectContributions` over every owned item and unsuppressed effect, so Divinity A produces
  its `+50` at stage 7 instead of nothing at all.
- **Stage 12 ignored dice-mode `DamageNegation`.** The defender's negation formulas are rolled
  by the orchestrator and consumed by the pipeline; Battle Continuation's doubled *dice* against
  a Noble Phantasm (not doubled *total*, per the per-Servant sheets) is honoured.
- **The immunity gate read only carried statuses.** An immunity granted by a rule element now
  blocks at exactly the same point as the equivalent status effect.
- **`heracles-nine-lives`** applied `Def Up` at magnitude −30. Def Dwn is a distinct family with
  its own stacking rule; the ability now applies `Def Dwn 30`.

### Corrected

- **`TableOverride` used `table:` for a check table.** Every other rule element uses `table:` to
  name a **rank table** from Appendix B, so the two collided and the validator rejected valid
  content with an unreadable message. `TableOverride` now takes **`forceTable:`**, the validator
  enforces the split in both directions, and a check-table name in the `table:` field produces a
  message that names the fix. Superseded reading: `- key: TableOverride, table: unfavourable`.

---

## [0.1.0] — 2026-08-14

**The first installable release.** Everything below `Documentation 0.2.1` describes the
specification this was built from; this entry describes the system itself.

### Added

**The rules engine, complete and tested.** Four layers with a strict dependency direction,
enforced by ESLint rather than convention:

- **L1 domain** (pure, no Foundry): the `Rank` value object with grade-major ordinals, the ◈
  operator with the published fraction table as data, the three distance metrics with the
  corrected `8R − 12` attack-range shape, and Appendix B's rank tables.
- **L2 rules** (pure, consumes snapshots): the 16-stage damage pipeline over a pre-rolled dice
  map, the eleven-step targeting resolver, Agility and Luck Checks, the data-grammar predicate
  evaluator, the document→snapshot projection, and the damage explainer.
- **L3 engine**: intents as the decide/write boundary, the seven-step effect applier, the
  Combat Process as a resumable reducer, the turn and round scheduler, and the write adapter.
- **Foundry layer**: the v14 manifest, `TypeDataModel` schemas for every actor and item
  subtype, document subclasses, ApplicationV2 sheets, and the bootstrap.

**The GM proxy socket.** Typed operations with request/response and timeouts, so a failed
application surfaces as a rejected promise rather than a silent no-op. Authorization refuses a
batch in which even one intent targets a unit the caller does not own.

**A working attack flow.** Open a Servant sheet, target a token, click an ability: the attack
resolves through the real Combat Process, the defender is prompted on the chat card, the Luck
Check ladder runs across both clients, and the card expands into the full stage-by-stage damage
breakdown. Process state lives on a message flag, so the ladder survives a reconnect and a match
can be replayed from its log.

**The content pipeline.** YAML under `packs/_source/` compiled to LevelDB packs, with a
validator that catches unknown effect ids, unparseable ranks and durations, unregistered
rule-element keys, refs that do not resolve, and one-sided mutual exclusions.

**Content:** 6 effects, 4 class-skill templates, and Heracles and Karna with their Noble
Phantasms.

**324 tests**, none of which require Foundry. They pin behaviour to the *documentation*: the
R = 4 attack-range diagram is asserted character for character, all six Mad Enhancement sheets
are checked against the rank table, and both worked examples from Chapter 13 are golden
fixtures.

### Known limitations

This release is honest about being early:

- **No canvas targeting preview.** Targets come from Foundry's own targeting (select a token,
  press `T`). The declarative targeting engine is complete and tested; only its preview layer
  is missing.
- **No turn HUD, action budgets or Delay.** The scheduler exists and is tested; nothing drives
  it from the interface yet.
- **Abilities do not yet apply their effect phases automatically.** Damage resolves; riders
  declared in an ability's `phases` do not.
- **Two Servants of twenty-nine.** The remaining twenty-seven are fully specified in Appendix D
  and not yet authored as YAML.
- **Not yet exercised in a live world.** Every Foundry API used here was verified against the
  v14.364 sources, and the manifest check confirms every declared path resolves — but this is
  the first build to be installed, and the interface layer has had no runtime testing.

---

## Documentation `0.2.1` — 2026-08-14

Two more answers from the game's author, both of which **correct readings `0.2.0` had reasoned
its way into** — plus a third correction found while implementing the pipeline against the
reference calculation supplied with the Q39 answer. Together they have the largest numerical
consequence of any release so far.

### Corrected

- **Crit-damage percentages scale the `Attack+` roll, and only that roll.** `0.2.0` placed
  `Crit DmUp`, `Crit DmDwn`, `Crit ResUp`, `Crit ResDwn` and `Over Crit` in the **stage-4
  bucket**, gated on `attack:crit`, so they multiplied the whole attack. They do not. They
  multiply the `5d10` at **stage 3**:

  ```
  crit:      total += 5d10 × max(0, 1 + critPct/100)
  non-crit:  total -= 5d10                              // never scaled
  ```

  `Crit DmUp +100%` is therefore worth about **27 points at stage 3** (which downstream
  multipliers then amplify), not a doubling of the finished number. On a Karna `4×` NP with
  `+40%` crit damage and a roll of 31, `0.2.0` produced 743 where the correct figure is 543.

  The author supplied the pre-`0.2.0` reference calculation to settle it, ending: *"35 was the
  5d10 of the crit damage; if this was duplicated the damage increase would be felt."*

  **If you implemented `predicate: ["attack:crit"]` `DamageModifier` rule elements for crit
  damage, delete them.**

  *Where:* Ch. 13 §13.2 (stage list) and §13.3 stage 3, which carries the superseded reading
  and a side-by-side numeric comparison. *Answered by:* Q39.

  **Our reasoning for the wrong answer, recorded.** We argued that a 27-point mean roll was too
  small for the game's many `Crit DmUp +100%` effects to be meaningful, so they *must* scale the
  attack. That inference was backwards: crits are a small consistent bonus, and crit-damage
  effects are a small bonus on a small bonus. Wanting a mechanic to matter is not evidence about
  what it does. This is the second time in three releases that a confident derivation lost to a
  direct answer — the first being the Range formula in `0.2.0`.

- **The `5d10` applies to Base Attack, before the ability multiplier.** Found while
  implementing the pipeline against the reference calculation the author supplied with the Q39
  answer. `0.2.0` ran the multiplier at stage 2 and added the roll at stage 3; the formula
  brackets it the other way:

  ```
  [(Base Attack ± 5d10) × (Skill/Spell/NP multiplier) ± … ] × …
  ```

  Only that placement reproduces the author's stated total. Their worked case is
  `[(200+35) × 4 × 2 + 100] = 1980`; our order gave 1,735.

  **Stages 2 and 3 have swapped.** Stage 2 is now *Crit*, stage 3 is *Ability multiplier*.
  Crit-damage effects therefore act at **stage 2** in Appendix A, not stage 3.

  Consequences compound with the Q39 fix, because the roll is now multiplied by the ability's
  multiplier as well:

  | | `0.2.0` | `0.2.1` |
  |---|---|---|
  | Worked example 2 (Karna's *Brahmastra Kundala*) | 1,076 | **1,151** |
  | Worked example 1 on a crit (Penthesilea) | 537 | **536** |
  | Karna `4×` NP, `+40%` crit damage, roll 31 | 743 | **673** |

  Worked example 1's headline figure of **409 is unchanged**, because its multiplier is 1.

  *Where:* Ch. 13 §13.2 (stage list), §13.3 stages 2 and 3, and both worked examples in §13.5
  and §13.6, fully retraced. Appendix A §A.1–A.2 and §A.9 stage column.

- **`Luck Check−` is `1d20+4`, not `1d20`.** The identical formulas in the `0.2.0` source were a
  **typo**. Everything `0.2.0` concluded from that identity is reversed:

  | `0.2.0` said | `0.2.1` |
  |---|---|
  | `Luck Boost` and `Luck Loss` are **inert** | Both are **live**, each worth a flat 4 |
  | The Luck comparison in `luckCheck()` is **cosmetic** | It is **load-bearing** |
  | Luck is a *budget*, not a *matchup* | Luck is **both** |

  Luck Checks are now exactly symmetric with Evade: `1d20` favourable, `1d20+4` unfavourable.
  High-Luck Servants — Drake (`EX`), Semiramis, Quetzalcoatl, Ozymandias (`A+`) — impose the
  penalty on every contest and never pay it, which makes them stronger in the reaction ladder
  than `0.2.0` assessed.

  *Where:* Ch. 14 §14.4, Appendix A §A.3 and §A.9, Appendix C §C.1 and §C.5.
  *Answered by:* Q40.

### Changed

- **Ability-stated conditional multipliers apply at stage 3**, inside the bracket, before the
  flat bonus — not in the stage-4 bucket. An ability that says *"deals 100% extra damage to
  units with `[Sky]`"* multiplies at stage 3; a **buff** that says *"damage dealt is increased
  by X%"* joins the bucket at stage 4. The dividing line is where the text lives — on the
  ability, or on an effect. Ch. 13 §13.3 stage 3.

### Open

- **Q49** — the reference calculation supplied with the Q39 answer reads
  `[(200+35) × 4 × 2 + 100] × (100+100+20−30)%`, and the second `+100` has no stated source once
  the `× 2` is accounted for as the `[Sky]` clause. We implement the clause as multiplying once,
  at stage 2, and have asked whether the bucket term is a separate bonus. Nothing in the engine
  changes either way, so this ships rather than blocks.

Q41–Q48 remain open, unchanged.

---

## Documentation `0.2.0` — 2026-08-13

The game's author returned an annotated copy of Chapter 41 answering **Q1–Q38**, supplied the
**Terrain Effects** document, and supplied **seventeen additional Servant sheets**. This release
applies all three.

It is a `MINOR` bump by the letter of SemVer — nothing in the architecture changed shape — but
it contains eight **corrections**, three of which (the Range geometry, Block, and the crit
roll's position in the damage pipeline) would invalidate an implementation built against
`0.1.0`. Read `Corrected` first.

### Corrected

- **The attack Range shape was wrong.** `0.1.0` derived the diagonal reduction as
  `d + s ≤ R + 1` from the rulebook's single stated case (*"at Range 3, the twelve corner
  panels are excluded"*). That formula reproduces R = 3 exactly and is wrong from R = 4 upward:
  it clips one ring too far inward, giving 57 panels at R = 4 where the correct count is 61,
  and 81 at R = 5 where the correct count is 93.

  The actual rule excludes **only the outer ring's corner region**:

  ```
  in range  ⟺  d ≤ R  and  not (d = R and s ≥ 2)
      where d = max(|Δi|, |Δj|)  and  s = min(|Δi|, |Δj|)
  ```

  Excluded panel count is `8R − 12` for R ≥ 3, and pure Chebyshev applies at R = 1 and R = 2.
  Panel counts: R1 → 9, R2 → 25, R3 → 37, R4 → 61, R5 → 93, R6 → 133.

  *Where:* Ch. 08 §8.2 (with R = 3 and R = 4 diagrams and the superseded reading recorded
  in place at §8.2), Ch. 28 §28.3 (`attackRangePanels`), and the test-count assertions in
  Ch. 28 §28.12.
  *Answered by:* Q7.

  **Why this matters beyond the numbers.** The `0.1.0` formula fit every piece of evidence
  available when it was written. It was still wrong. That is the argument for the Chapter 41
  process — asking rather than deriving — and it is why this entry is longer than the fix
  deserves.

- **Block is a flat 25% reduction, not a roll.** `0.1.0` modelled Block as a dice roll (a
  registry entry, `block`) subtracted from damage, and further assumed it was halved against
  Noble Phantasms. Both were wrong. Block reduces **Total Damage by a flat 25%**, it is
  **undiminished against Noble Phantasms**, `Block Up` adds percentage points, and the
  *Strengthen Block* Luck Check adds another 25 points rather than granting a second roll.

  The practical consequence is large: under the old model, blocking a 2,000-damage NP saved
  about 55 points; it now saves 500. Block becomes the strongest routine defensive action in
  the game, and `Pierce` and `Break` — which bypass it — rise correspondingly in value.

  *Where:* Ch. 12 §12.4 (`blockReduction`), Ch. 13 §13.2 and §13.3 stage 14, Appendix C §C.1.
  *Answered by:* Q1.

- **`Attack+` / `Attack−` are a flat `5d10`, applied at pipeline stage 3.** `0.1.0` treated
  crit damage percentages as multipliers of this roll. They are not: the roll is a flat
  `±5d10` on the base attack, and crit-damage percentages are ordinary **stage-4 bucket**
  entries gated on the `attack:crit` roll option.

  Both worked examples in Ch. 13 were fully retraced. Example 1 now yields **409** where
  `0.1.0` printed 473; example 2 now yields **1,076** where `0.1.0` printed 2,071. If you
  memorised either figure, discard it.

  *Where:* Ch. 13 §13.3 (stages 3 and 4) and the worked examples in §13.5 and §13.6,
  Appendix C §C.1. *Answered by:* Q1.

- **Servant Max Health has no variance roll.** `Health(S)` is unused. Two Servants of the same
  END rank and steps have **identical** Max Health, and setup variance is confined to Agility
  and Luck. This removes an entire source of pre-game variance the rulebook's phrasing implied.

  *Where:* Ch. 05 §5.6, Appendix B §B.1, Appendix C §C.2. *Answered by:* Q1.

- **Faction turn order is re-rolled every Round**, not once at setup. `1d100` per faction,
  highest first, GM last; ties are re-rolled **only among the tied factions and only for the
  contested positions**.

  *Where:* Ch. 19 §19.8, Ch. 25 §25.3 (`rollTurnOrder`, called from `beginRound` in §25.4),
  decision D25.3. *Answered by:* Q32.

- **The Dioscuri's linked death fires on *true* defeat**, after every revival effect has been
  exhausted — trigger `unitDefeated`, not `unitHealthZero` — and the effect on the survivor is
  `mode: ignoresRevival`. `0.1.0` had the twins dying to each other's *first* death, which
  would have made Battle Continuation and Guts useless on them.

  *Where:* Ch. 34 §34.4. *Answered by:* Q11.

- **`Kill Yourself` (Command Spell) bypasses revival.** *Where:* Ch. 17 §17.6, decision D17.7. *Answered by:*
  Q35.

- **Cross-level protection is case-by-case, not a general rule.** `0.1.0` proposed a single
  policy for whether passengers on a platform can be hit. The author's answer is that each
  platform states its own, so `0.2.0` replaces the rule with a four-axis `CrossLevelRules`
  model and a table covering the Hanging Gardens, the Golden Hind, the Storm Border, the
  Quetzalcoatlus and Ramesseum Tentyris.

  *Where:* Ch. 20 §20.7. *Answered by:* Q37.

### Answered

Q1–Q38 are resolved. Chapter 41 was restructured into **Part 1 — Answered** (condensed, each
with its resolution and where it is implemented) and **Part 2 — Open**. The eight answers that
changed the design are listed under `Corrected` above. Of the rest:

- **Every dice formula is now stated.** Appendix C contains no placeholders; `DiceRegistry
  .placeholders()` returns empty and the provisional-formulas banner is dormant. The registry
  remains settings-backed so that a future gap is a settings change, not a code change.
- **`Luck Check−` is identical to `Luck Check`.** The favourable/unfavourable distinction has
  no mechanical effect for Luck, which makes `Luck Boost` and `Luck Loss` **inert**. Both ship
  implemented and marked inert in Appendix A so they become live the instant the formulas
  diverge. Whether this is intended is now **Q40**.
- **Master setup values:** Base Health **250**; Max Agility `4+1d8`; Max Luck `8+1d12`. A
  Master is roughly one clean Servant hit from death, evades poorly, and contests Luck Checks
  respectably — which is exactly the profile that makes Overpower, ZON and Master protection
  load-bearing.
- Q17–Q19, Q21–Q23, Q25–Q28, Q30, Q31, Q33, Q34, Q36 and Q38 were **confirmed as already
  implemented**. No text changed.

### Added

- **Ch. 42 — Terrain.** The 21 terrain types (Burning, Waterside, Forest, Dead Zone, Poison
  Swamp, Thunderstorm, Eldritch, Snowfield, City, Indoors, Sunlight, Darkness, Lava, Frozen,
  Magnetic, Meadow, Underworld, Airspace, Universe, Labyrinth, Halloween) and the **directional
  overlap matrix** with its five verbs (`coexist`, `overwrite`, `extendExisting`, `replaceWith`,
  `cancel`). Overlap is directional: what happens when Fire meets Water is not what happens
  when Water meets Fire.

- **Ch. 43 — Bounded Fields.** A third area family, distinct from platforms (which are about
  *elevation*) and terrain (which is about *panel properties*). Six axes — footprint,
  membership, permeability, duration, escape, termination — covering ten fields across nine
  Servants. Includes the ordered NP tag scale, paid duration extension, `kind: schedule`
  phases, and the state-history ring buffer that Nursery Rhyme's rewind reads from.

- **Ch. 44 — Case Studies: The Expanded Roster.** Everything the seventeen new Servants
  demanded, grouped by mechanism rather than by Servant, with twelve numbered decisions
  (D44.1–D44.12).

- **Seventeen Servants** in Appendix D §D.15–D.32: Nursery Rhyme, Hassan of Serenity, Jack the
  Ripper, Yan Qing, Katō Danzō, Hundred-Faced Hassan, Medea, Achilles, Ozymandias, Medusa, Pale
  Rider, Anastasia & Viy, Quetzalcoatl, EMIYA, Proto Gil, Asterios, Raikou. Twenty-nine
  Servants total; §D.33 is the combined aggregate.

- **Twenty-six effects, statuses and resources** in Appendix A §A.17, and the effect-visibility
  model in §A.18. Notably: **no new debuffs were needed** — the debuff vocabulary catalogued in
  `0.1.0` turned out to be complete, and every addition is a buff, a status or a resource.

- **Day and night became a per-panel property.** `phaseAt(panel)` consults terrain first —
  `Indoors` yields neither, `Sunlight` forces Day, `Darkness` forces Night — and falls back to
  the Round's phase. Three Quetzalcoatl abilities and one of Ozymandias's create local Day.

- **New rank tables and table kinds** in Appendix B: `Divinity` (scaled, ±5 per step), the
  `Divine Core = 2 × Divinity` identity, `Independent Action` Sustainability, Achilles's
  `andreiasAmarantosByAttackerDivinity` (a threshold table whose *default* case is total
  immunity), Proto Gil's `enkiduByDivinity`, `masterBaseHealth`, and Magic Resistance's new
  `mode: dice`.

- **Twenty-two rule elements**, all general-purpose: `stance`, `weakPoint`, `Disguise`,
  `membership: pool`, `relationshipProxy`, `health: null`, `Resistance mode: dice`,
  `shieldScope`, `bleedThrough`, `reactionLock`, `requiresClearPath`, `requiresFacing`,
  `RollAdjustment`, `SwapPositions`, `FakeDefeat`, `OptionalCost` extended to Agility,
  `ResetCooldownGroup`, `AttackerPropertyTier`, `commandSpellCost`, `kind: schedule`,
  `deferredUntil`, `SustainabilityGain`.

- **Four script elements**, bringing the total to six: `nurseryRhyme.rewind`,
  `emiya.brokenPhantasm`, `paleRider.innocentWorld`, `achilles.heel`. Six scripts across ~202
  abilities is **3.0%**, against a 15% budget — the ratio held across a roster substantially
  more exotic than the one the architecture was designed against.

- **This changelog.**

### Changed

- Targeting gained **diagonal lines** (`allowDiagonal`), **bidirectional projection** (a line
  extending both ways from the caster on the 13×13 board and one way on the 25×25), and
  **diagonal length shortening** (Danzō's 1×5 becomes 1×4 on the diagonal).

- **Line of sight remains absent from the game.** Medusa's Mystic Eyes is the sole exception
  and is implemented as a per-ability `requiresClearPath` predicate rather than as a general
  LOS system, so the global rule stays intact and the exception stays visible.

- `Alignment.moral` is now an **open string** with a suggested enumeration rather than a closed
  enum. Anastasia's sheet reads *"Chaotic Summer"*.

- Presence Concealment is now a **parameterized template with per-Servant clause overrides**
  rather than one shared effect document. Hundred-Faced Hassan's sheet carries a ninth clause
  no other bearer has.

- `Sustainability: null` is a first-class value meaning *the clock does not exist for this
  unit*, not *a very large number*. Two of the new Servants have it.

- Ch. 19 §19.6 (the old two-paragraph terrain sketch) is **superseded** by Ch. 42 and marked
  as such in place rather than deleted.

### Validation

Adding seventeen Servants required **zero rank-table value changes** and **one** new table
kind. Asterios (B) and Raikou (EX) reproduce the Mad Enhancement table — derived months
earlier from Heracles and Penthesilea — exactly, including the Master drain floor. Medusa's
`Divinity E−`, the first sub-E rank in the corpus, reproduces from the Divinity scale without a
special case.

Four of the eight "mechanisms the twelve do not exercise" closed: `Dark`, `Charm`, `Petrify`
and `Drowning` now have content validating them end to end.

### Known risks

- **Katō Danzō's fake death is the only mechanic in the corpus that requires the system to
  lie to a client.** It is implemented as a GM-mediated shadow state with a `provisional: true`
  public log entry that is later **annotated, never rewritten**, a desync-detector exemption,
  and a per-world disable. It carries a `requiresGmComfort` flag. See Ch. 44 §44.1 and D44.2.

- **Jack the Ripper's Information Erasure is not automated.** It depends on the closed-info
  knowledge model, which is deferred past v1. Until then it posts a GM-facing reminder to chat
  — honest about being unautomated rather than silently doing nothing. It has no D44 number
  because it is a deferral, not a decision. See Ch. 44 §44.4.

### Open

Ten new questions, **Q39–Q48**: whether crit-damage percentages scale the whole attack or only
the `Attack+` roll (Q39); whether `Luck Check−`'s identity with `Luck Check` is intended (Q40);
what a "Dead panel" is (Q41); what `Style Change` is (Q42); whether day/night is evaluated at
the attacker's or the defender's panel now that phase is per-panel (Q43); whether the NP tag
scale is ordered as we assume (Q44); whether Nursery Rhyme's rewind restores *position* (Q45);
Hundred-Faced Hassan's bracketed alternatives (Q46); how much of Secret Poison should be hidden
(Q47); and whether Rule Breaker overrides absolute Independent Action (Q48).

---

## Documentation `0.1.0` — 2026-08-12

Initial design specification. Forty-one chapters and five appendices, written from the F/GT
rulebook, the Common Skills and Status Effects documents, the ◈-notation note, the General
Notes, and twelve reference Servant sheets.

### Added

**Part 0 — Orientation.** Ch. 00 (index and reading paths), Ch. 01 (scope of automation, seven
success criteria SC-1…SC-7, the four-layer architecture, and the case for replacing the
existing prototype), Ch. 02 (glossary).

**Part I — Domain model.** Ch. 03 (object graph, aggregate roots, the eight subsystems, and the
Snapshot/Intent boundary), Ch. 04 (units, facing, factions, attribute closure, multi-panel
units), Ch. 05 (rank grammar and ordinal-vs-step arithmetic), Ch. 06 (resources, derived
scalars, counters, health loss vs damage), Ch. 07 (the ◈ operator, `TickExpr`, absolute expiry
storage, cooldown rates, the scheduler), Ch. 08 (three distance metrics, Range shape derivation,
movement legality, knockback), Ch. 09 (**the targeting type system** — four orthogonal axes of
anchor × shape × selection × limits), Ch. 10–11 (effect taxonomy and the effect engine), Ch. 12
(the Combat Process state machine and the Luck Check contest ladder).

**Part II — Resolution.** Ch. 13 (the 16-stage damage pipeline as a pure function over a
pre-rolled roll map), Ch. 14 (checks and the dice registry), Ch. 15 (abilities), Ch. 16
(contracts, ZON, Sustainability, Cover, Overpower/Underpower), Ch. 17 (Command Spells as the
only pre-emption mechanism), Ch. 18 (action economy), Ch. 19 (environment), Ch. 20 (platforms
as scene levels).

**Part III — Foundry architecture, targeting Foundry VTT v14.** Ch. 21–22 (skeleton and
`TypeDataModel` schemas), Ch. 23 (derived-data pipeline), Ch. 24 (rule elements, predicates,
roll options, and a **closed script registry** — no `eval`), Ch. 25 (player-based `Combat`),
Ch. 26 (the GM proxy socket with typed operations, request/response and timeouts), Ch. 27 (the
message-chain reaction protocol), Ch. 28 (v14 grid shape generators), Ch. 29 (ApplicationV2
sheets), Ch. 30 (chat and audit).

**Part IV — Case studies and reference.** Ch. 31–36 (Heracles, Semiramis, Mannanán mac Lir, the
Dioscuri, Van Gogh, and the remaining seven), Ch. 37–40 (content pipeline, testing, migration,
roadmap), Ch. 41 (38 open questions), and Appendices A (126 effects), B (rank tables), C (dice
registry), D (twelve Servant data sheets), E (event reference).

### Notable decisions in `0.1.0`

- **Foundry v14, not v11.** This removed the prototype's Mass Edit module dependency for
  targeting (v14 ships grid shape generators) and provided Scene Levels for flying platforms.
- **Four layers with a strict dependency direction:** Domain (pure, no Foundry) → Rules (pure,
  consumes snapshots) → Orchestration (owns all writes) → Presentation.
- **Rules return `Intent[]`; they never write.** Documents are projected into plain
  `UnitSnapshot` / `BoardSnapshot` values at the boundary.
- **Additive vs multiplicative** in the damage pipeline was settled from the rulebook's own
  worked example, `(100 + 30 − 100)% = 30%`, and the phrase *"Total Damage"* was adopted as the
  textual marker dividing the stage-4 additive bucket from the stage-15 multiplicative one.
  The author confirmed both in `0.2.0`.
- **Kept from the prototype:** the GM proxy, player-based turns, step-per-message chat state,
  the damage-modifier bag. **Discarded:** FGO vocabulary, effects-as-Items, racy Region-based
  targeting, and additive-only modifier collection.

---

[0.1.0]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.1.0
