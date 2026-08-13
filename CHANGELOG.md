# Changelog

All notable changes to the F/GT Foundry VTT system — **documentation now, code later** — are
recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html), interpreted for a design document
as follows:

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

---

## [0.2.0] — 2026-08-13

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

## [0.1.0] — 2026-08-12

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

[0.2.0]: https://github.com/zarex97/FGT_FVTT_v2/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.1.0
