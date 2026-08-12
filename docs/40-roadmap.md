# 40 — Roadmap

Sequencing, milestones, and what "done" means at each stage. The ordering is driven by one
principle: **build the layers bottom-up, and get something playable as early as possible.**

---

## 40.1 The sequencing principle

The dependency graph (Ch. 01 §1.7) dictates the order — L1 before L2 before L3 before L4. But
building all of L1, then all of L2, would mean nothing is playable for months.

**DECISION.** Build **vertical slices** through all four layers, each ending in something a human
can do at a table, while respecting the layer dependencies *within* each slice.

```
M1  ─────▶  Two Servants can attack each other on a grid
M2  ─────▶  Effects, durations, and the full ladder work
M3  ─────▶  All twelve reference Servants are playable
M4  ─────▶  Platforms, environment, and the Grail — a complete match
M5  ─────▶  Polish, content tooling, and the second GM
```

---

## 40.2 M1 — The Vertical Slice

**Goal:** two Servants, on a board, exchanging normal attacks with correct damage, driven by two
player clients.

| Work | Chapters |
|---|---|
| System skeleton, manifest, bootstrap | 21 |
| `Rank`, `TickExpr`, geometry (L1) | 05, 07, 08 |
| Actor/Item data models for `servant` and `ability` | 22 |
| Snapshot construction | 03, 23 |
| The damage pipeline, all 16 stages | 13 |
| Checks and the dice registry | 14 |
| The Combat Process ladder | 12 |
| The reaction protocol, minimal | 27 |
| The GM proxy | 26 |
| Targeting: `targetUnit` and `attackRange` only | 09, 28 |
| A minimal Servant sheet | 29 |
| A basic chat card with the damage breakdown | 30 |

**Done when:** Karna attacks Heracles from another client, the defender is prompted, evades or
blocks, the luck ladder runs, damage lands, the injury roll fires, and the breakdown explains
every number. Two Servants exist as content: Karna and Heracles, with normal attacks only.

**Explicitly deferred:** effects, durations, skills, NPs, turns, movement.

**Why this slice:** it exercises L1→L4 end to end and forces the Snapshot/Intent boundary, the
socket layer, and the ladder to be real. Everything after is additive.

**Estimate:** the largest milestone. Roughly 40% of total engine work.

---

## 40.3 M2 — Effects and Time

**Goal:** the effect engine, the scheduler, and the turn system.

| Work | Chapters |
|---|---|
| `EffectDefinition` / `EffectInstance`, the registry | 10, 11 |
| The rule element engine, predicates, roll options | 24 |
| Stacking, suppression, removal, transfer | 11 |
| Auras and the aura index | 11, 23 |
| The scheduler: turn and round boundaries | 07, 25 |
| Player-based `Combat`, turn order, `Delay` | 25 |
| Action economy and the turn budget | 18 |
| Movement with legality validation | 08, 23 |
| The full effect catalogue (~120 definitions) | Appendix A |
| The turn HUD | 29 |
| Ability phases: `damage`, `applyEffect`, `statChange`, `cooldown` | 15 |

**Done when:** a full turn cycle runs — units move within budget, skills apply effects with
correct durations, effects tick and expire on the right turn boundaries, cooldowns advance, and
Curse/Poison stage correctly at 3 and 8 turns per round.

**Acceptance:** SC-3 (the duration test) and SC-4 (the stacking test).

---

## 40.4 M3 — The Twelve

**Goal:** all twelve reference Servants playable with full automation.

| Work | Chapters |
|---|---|
| The complete targeting catalogue and all four preview modes | 09, 28 |
| The remaining ability phase kinds | 15 |
| Modes (Presence Concealment, Mad Enhancement) | 15 |
| Resources and resource triggers | 06 |
| Command Spells and the interrupt machinery | 17 |
| Relationships: contracts, ZON, Cover, Overpower | 16 |
| `LinkedUnitGroup` (the Dioscuri) | 16, 34 |
| Revival sources | 04, 31 |
| The remaining ~25 rule elements | 24 |
| Content: all twelve Servants | 31–36, Appendix D |
| The content pipeline and validation | 37 |

**Done when:** SC-7 — the twelve-Servant playtest scenario (Ch. 38 §38.8) runs to completion
with no manual arithmetic and no GM intervention beyond adjudication.

**Acceptance:** SC-1 (the one-attack test), SC-2 (the AoE test), SC-5 (the audit test).

This is the milestone that proves the design. Everything before it is infrastructure;
everything after is scope.

---

## 40.5 M4 — A Complete Match

**Goal:** a match can be played from setup to victory.

| Work | Chapters |
|---|---|
| Platforms and Scene Levels | 20 |
| The Hanging Gardens, Golden Hind, Storm Border | 20, 32 |
| Home bases, day/night, regions, terrain tags | 19 |
| The Holy Grail: materialization, contest, destruction | 19 |
| Civilians and random events | 19 |
| Setup: summon rolls, deployment, turn-order roll | 19, 37 |
| Victory conditions and match lifecycle | 19, 25 |
| The game log and export | 30 |
| Undo journal | 18 |

**Done when:** a three-player Great Holy Grail War runs from setup to a Grail acquisition, with
platforms deployed and destroyed, without the GM touching a rulebook.

---

## 40.6 M5 — Polish and Scale

**Goal:** the system is pleasant to use and cheap to extend.

| Work | Chapters |
|---|---|
| The ability editor with the visual targeting picker | 29, 37 |
| Zone overlays and the tactical HUD | 28, 29 |
| Chat card collapsing and the full explainer | 30 |
| Localization: Spanish | 29 |
| Performance tuning against the budgets | 23, 38 |
| Migration infrastructure | 39 |
| The 8-turns-per-round (Holy Grail War) variant | 07 |
| Master essences and the draft | 04, 19 |
| Documentation for GMs and content authors | — |

**Done when:** SC-6 — a GM with no JavaScript authors a Karna-complexity Servant in under an
hour, using only sheets.

---

## 40.7 Beyond M5

Ordered by expected value, not by ease.

| Item | Rationale | Cost |
|---|---|---|
| **The real dice tables** | The single highest-impact unknown (Ch. 14 §14.4). Blocked on the game's author, not on us. | Trivial once supplied |
| **Closed-information play** | Shadow actors (Ch. 26 §26.6). A rulebook-supported mode we currently defer. | High |
| **Servant draft UI** | Master essence selection, d20 pick order, d4 allocation. | Medium |
| **The 15-turn Snowfield variant** | The ◈ system already supports it; needs validation. | Low |
| **More Servants** | The real measure of success. Target: 50 by the end of year one. | ~1 hr each |
| **Grand Order rule deltas** | Gated behind a ruleset flag (Ch. 01 §1.4). | Medium |
| **Visual replay** | Deterministic replay already exists (Ch. 30 §30.9); this adds the canvas. | Medium |
| **Balance telemetry** | Aggregate exported logs to answer "is Heracles too strong?" with data. | Low |
| **Full Campaign mode** | Persistent rosters across matches. | High |

---

## 40.8 Risk register

The things most likely to go wrong, with their mitigations.

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **The Attack+/Attack−/Block formulas never arrive** | Every damage number is provisional | The registry makes them a settings change. Ship with documented placeholders and a visible banner. Ask early (Ch. 41 Q1). |
| R2 | **The additive-bucket reading of stage 4 is wrong** | Every damage number is wrong by a large factor | Only one worked example supports it. Ask (Ch. 41 Q2). The stage is isolated, so switching to multiplicative is a contained change. |
| R3 | **Reaction ladder latency makes play tedious** | The core loop feels bad | Auto-decline settings, fast paths when no options exist, parallel AoE collection. Measure in M1 and adjust before M3. |
| R4 | **Aura performance at 28 units** | Unplayable at full roster | Spatial index and version gating designed in from the start (Ch. 23 §23.3); budgets asserted in CI. |
| R5 | **Scene Levels change in a Foundry release** | Platforms break | The platform abstraction is thin (Ch. 39 §39.7); an elevation-band fallback is a contained change. |
| R6 | **Content authoring turns out to need scripts constantly** | The declarative model failed | Measured at ~3% on the reference set (Ch. 36 §36.8). Re-measure at Servant #25; if it exceeds 15%, add rule elements rather than accepting scripts. |
| R7 | **Ambiguities in the source multiply** | Endless adjudication | Chapter 41 collects them; the game's author resolves them in batches. Every one has a shipped default so nothing blocks. |
| R8 | **Closed-info expectations** | Users expect it and it is deferred | Documented clearly as deferred, with the chat-card redaction shipping in M3 as a partial. |
| R9 | **Solo maintainer bus factor** | The project stalls | Documentation-first (this set), declarative content, and a test suite that runs without Foundry are all bus-factor mitigations. |

R1 and R2 are the two that would require rework rather than adjustment. Both are questions for
one person, and both should be asked before M1 completes.

---

## 40.9 What "done" means for the whole project

Not "every Servant implemented" — that is unbounded. Done is:

1. **The seven success criteria** from Ch. 01 §1.5 are met.
2. **A group plays a full Great Holy Grail War** without opening the rulebook.
3. **Adding a Servant costs an hour** and does not require the maintainer.
4. **Every number is explicable** from the chat log.
5. **The test suite is green** and the performance budgets hold at full roster.

Everything past that is content and refinement.

---

## 40.10 Immediate next actions

For whoever picks this up:

1. **Ask the game's author Chapter 41's Q1 and Q2.** Both are one-sentence questions with
   large consequences. Nothing else should start before they are sent.
2. **Scaffold the repository** per Ch. 21 §21.2, with the lint rule enforcing layer boundaries
   in place from commit one — retrofitting it later is painful.
3. **Implement `Rank` and `TickExpr` with their full test tables** (Ch. 38 §38.3). They are
   small, exhaustively testable, and everything depends on them.
4. **Implement the damage pipeline against the two hand-traced fixtures** from Chapter 13. If
   those two pass, the hardest arithmetic in the system is correct.
5. **Then** start M1's vertical slice.

Steps 3 and 4 are deliberately ahead of the skeleton: they are pure functions with no Foundry
dependency, they can be written and tested in an afternoon, and getting them right first
removes the largest source of downstream uncertainty.

---

**Next:** [41 — Open Questions](41-open-questions.md)
