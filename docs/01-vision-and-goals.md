# 01 — Vision and Goals

## 1.1 What we are building

A Foundry VTT **system** (not a module) that runs *Fate/Grail Tactics* end to end, with the
computer performing every rules computation that the rules define deterministically, and
prompting a human only where the rules define a *choice*.

The distinction matters, so state it precisely:

| Category | Example | Who decides |
|---|---|---|
| **Deterministic computation** | Total damage after 11 modifiers; whether Magic Resistance A negates a Rank B MAG attack; which panels a 5×5 orthogonal AoE covers | **The engine, silently** |
| **Randomness** | Attack+/Attack− coin flip; Evade roll; Injury roll | **The engine, visibly** (rolled, logged, auditable) |
| **Rules-defined choice** | Do you Block, Evade, or do nothing? Which two of the eight Primordial Rune effects? Spend a Command Spell? | **A human, prompted** |
| **Placement** | Where do I put the 7×7 area? Where do I move? | **A human, with a live preview and legality validation** |
| **Adjudication** | "Does this homebrew Skill count as Divinity?" | **The GM, with tooling** |

"Full automation" means every row 1 and 2 item happens without a human doing arithmetic or
consulting a table, and every row 3 and 4 item is a single, unambiguous, well-presented
prompt.

## 1.2 Why this is hard

It is worth being honest about the scale before designing for it. This is not a
"d20 + modifier vs DC" game.

**The rules are deeply interlocking.** Consider a single normal attack by Penthesilea, with
Mad Enhancement active, against Van Gogh, at night, while Van Gogh is in her home base and
has a Def Dwn (C) debuff, and Penthesilea is outside her Master's ZON. Resolving that one
attack correctly touches: base attack selection (STR vs MAG), Mad Enhancement's +100%
STR/+50% MAG split, Van Gogh's Existence Outside The Domain clause 2 (−40% from
Mad Enhancement units) *and* clause 5 (negate Mad Enhancement's damage boost entirely —
which contradicts clause 2's premise and must be ordered), Divinity flat bonuses on both
sides, home-base −10%, ZON penalty (−5d10), Def Dwn (C) +20%, the crit coin flip with
accumulated crit-chance modifiers, the injury roll threshold at 100 damage, then Def Dwn (C)'s
secondary agility reduction, then facing update, then the counter opportunity. That is one
attack. A human doing it by hand takes minutes and gets it wrong.

**Durations are unusual.** Everything is measured in ◈ — "number of turns in a round" — which
is a *runtime constant* that changes with the game variant (3, 8, or 15 turns per round).
`1◈+⅔◈` is a real duration that appears on real cards. Fractional ◈ always rounds *down*,
including cases where normal rounding would go up. A duration system that assumes integer
rounds is unusable here.

**Effects modify the rules, not just the numbers.** `Addle` doesn't reduce a stat; it
*negates all automatically-triggering effects*. `Petrify` makes buffs and debuffs stop
applying entirely. `Presence Concealment` changes what can be targeted, what can counter,
where you can move, and how much damage you deal, and it is explicitly neither a buff nor a
debuff so removal effects can't touch it. `Decoy` constrains *legal moves and legal targets*
for the opponent. An effect system that can only add numbers to stats cannot express half
the catalogue.

**Combat is a negotiation, not a roll.** Steps 2 through 2.5 of the Combat Process form a
contest ladder: defender evades → attacker may contest with a Luck Check → defender may
contest that → defender may burn a Command Spell to escape. Each rung is a decision by a
*different player*, potentially on a different client, potentially the GM. This is an
asynchronous, multi-party, resumable protocol.

**Targeting is genuinely varied.** "An area of M×N in a non-diagonal direction adjacent to
the caster" is a distinct shape from "an M×N area anywhere within range R", which is distinct
from "a straight line along the movement path" (Riding Attack), which is distinct from
"all allied units within a 2-panel area of the caster" (Party), which is distinct from
"targets of your choice within a 5×5 orthogonal area" (Gate of Skye). Plus the range rule
where diagonal reach shrinks by 1 at range ≥3.

**Scale.** Seven Servants and seven Masters *per faction*, on a board up to 25×25, with up to
seven players plus a GM. Turn resolution has to stay responsive with 28+ actors carrying
dozens of effects each.

## 1.3 Why start over rather than extend the prototype

The prototype (`fate-grail-hollow`) is a genuinely useful artefact and several of its ideas
are carried forward wholesale. But its foundations block the target.

**What we keep (and why):**

- **The GM proxy socket pattern.** The insight that `actor.isOwner` is not a safe fast path —
  because an `ActorDelta` on an unlinked token can still block writes even when the base
  actor reports OWNER — is hard-won and correct. Chapter 26 generalizes it into a typed
  operation protocol with request/response and error propagation.
- **Player-based turns.** Modelling combatants as *users* rather than tokens is exactly right
  for a game where a player commands 14 units. Chapter 25 builds on this.
- **Step-per-message chat state.** Serialising combat state into message flags and creating a
  *new* message per step, so no client ever writes a document it doesn't own, is the correct
  shape for the reaction ladder. Chapter 27 formalizes it into a resumable protocol with
  explicit ownership of each decision point.
- **The damage-calculation skeleton.** Splitting damage into magical/physical portions,
  tracking a modifier bag per side, and separating flat from multiplicative is right.
  Chapter 13 replaces the ad-hoc ordering with a specified, testable 14-stage pipeline.

**What we discard (and why):**

- **FGO vocabulary in the data model.** `busterUp` / `artsUp` / `quickUp` are Fate/Grand Order
  card-type concepts. F/GT has no card types. These fields encode a mental model that does
  not match the game and mislead content authors. Replaced by explicit
  `damageComponent: "str" | "mag" | "both"` scoping.
- **Effects as `Item` documents.** The prototype stores every buff as an embedded Item. That
  gives you a document per effect instance, which is heavyweight for something like Curse
  Stage 7, and it does not integrate with Foundry's `ActiveEffect` duration machinery,
  status icons, or transfer semantics. Chapter 11 uses `ActiveEffect` with a typed
  `system` payload, and a rule-element layer on top.
- **Manual, module-dependent AoE targeting.** `region-targeting.mjs` requires the third-party
  *Mass Edit* module, spawns a scene Region document, waits two animation frames for
  Foundry to populate `RegionDocument#tokens`, then deletes it via the GM proxy. It works,
  but it is a hard external dependency, it is racy by construction, and it cannot express
  "in a non-diagonal direction adjacent to me" without a hand-authored preset per shape.
  Foundry v14's grid shape generators make all of this unnecessary. See Chapter 28.
- **Foundry v11 targeting.** The prototype's manifest declares `"minimum": "11"`. v14 changed
  the canvas, movement, template, and application layers substantially. Targeting v11 in 2026
  means writing against three deprecated APIs.
- **Additive-only modifier collection.** `combinedMultiplier = multiplierAttack −
  multiplierDefense` collapses every percentage in the game into one additive bucket. The
  real rules have modifiers that are explicitly multiplicative against each other, modifiers
  that apply only to the MAG portion, modifiers with a separate reduced magnitude "if NP",
  and modifiers that are computed *on total damage after all others* (e.g. Damage Cut).
  One bucket cannot represent that.
- **No time model.** The prototype has no ◈ arithmetic, no duration expiry, no cooldown
  ticking. This is the single largest missing subsystem and it touches everything.

**DECISION.** Start from an empty repository. Port the four ideas above as *designs*, not as
code, so they can be rebuilt against v14 APIs and the full rule set.

## 1.4 Non-goals

Explicitly out of scope, to keep the scope honest:

1. **AI opponents.** The GM's turn is driven by a human. `Confuse` (which makes a unit act
   randomly) is automated because the rules specify random action selection, but there is no
   tactical AI.
2. **Character creation / draft UI.** The pre-game Master-essence draft and Servant selection
   (Rulebook, "Master and Servant Selection") is a tool we may build later; v1 assumes
   Servants arrive from a compendium with the pre-game rolls already resolved. The rolls
   themselves (`Determining Max Health`, `Determining Agility`, `Determining Luck`) *are*
   automated as a one-click "summon" operation — see Chapter 37.
3. **Every Grail War variant.** v1 targets the **Great Holy Grail War** (3 turns per round,
   2 factions + GM) and the **Holy Grail War** (8 turns per round). The ◈ system is built so
   other variants are a configuration value, not a code change, but only these two are
   validated.
4. **Full Campaign / Grand Order-specific rule deltas.** Noted where the source calls them
   out (e.g. Penthesilea's Hatred of Achilles behaves differently in a Grand Order HGW), but
   gated behind a ruleset flag and not implemented in v1.
5. **Replacing GM judgement.** The rules repeatedly say "if the GM/majority of players
   approve". The system provides a GM override for every automated decision rather than
   pretending the rules are closed.
6. **Mobile/touch optimization.** Desktop Foundry only.

## 1.5 Success criteria

These are the tests by which the design succeeds or fails. They are deliberately concrete.

**SC-1 — The one-attack test.**
A player selects their Servant, clicks "Attack", clicks an enemy token, and the entire
resolution — evade prompt to the defender's client, luck-check ladder, damage, injury roll,
facing update, counter prompt — completes with no player performing arithmetic and no GM
intervention. Total clicks for a simple uncontested attack: 3 (attacker) + 1 (defender).

**SC-2 — The AoE test.**
Karna's *Brahmastra Kundala* ("Range=5. Hits a 7×7 panel area within Range") is used by
placing one preview and confirming. The engine correctly excludes Karna himself, applies
4× damage plus 100 to every unit in the area, applies Burn for 3◈ turns and Def Dwn (B) for
1◈ turns to each, rolls debuff resistance *separately per unit*, and puts both Brahmastra
Kundala and Mana Burst (Flames) on cooldown.

**SC-3 — The duration test.**
An effect applied with duration `1◈+⅔◈` on turn 4 of a 3-turns-per-round game expires at
exactly the right turn (1×3 + floor(⅔×3) = 3 + 2 = 5 turns later, i.e. at the end of turn 9),
and the same effect in an 8-turns-per-round game expires after 8 + 5 = 13 turns. No content
change required between the two.

**SC-4 — The stacking test.**
A unit under Territory Creation EX from one ally and Territory Creation C from another
receives only the EX effect. A unit with both `TrplAtk Up` and `DblAtk Up` rolls triple
first and only rolls double if triple fails. A unit defeated while holding both a Guts buff
and Battle Continuation consumes Guts first. All three follow from declared metadata, not
from special-case code.

**SC-5 — The audit test.**
Any damage number in the chat log expands into an ordered list of every stage, showing the
value before and after, the effect that caused it, and the roll that produced any random
component. A GM can point at a number and answer "why?" in under 10 seconds.

**SC-6 — The content test.**
A GM with no JavaScript knowledge can author a new Servant with 6 skills and 2 Noble
Phantasms, of the complexity of Karna or Scáthach, entirely through sheets and dropdowns,
in under an hour. Complexity of the order of Semiramis's Hanging Gardens requires a script
element and is expected to.

**SC-7 — The twelve test.**
All 12 reference Servants are playable with full automation. This is the acceptance gate;
they were chosen because between them they exercise nearly every mechanism in the game.
Appendix D specifies each of them as system data.

## 1.6 Design principles

**P1 — The rulebook's vocabulary is the code's vocabulary.**
If the rules say "Combat Process", the class is `CombatProcess`, not `AttackResolution`. If
the rules say "◈", the field is `ticks` with a documented ◈ relationship, and the UI shows ◈.
Translation layers between rule language and code language are where bugs hide.

**P2 — Declarative first, imperative as escape hatch.**
An effect is data. A skill is data. Targeting is data. Roughly 85% of the reference Servants'
content should be expressible without a line of JavaScript; the remaining 15% (Hanging
Gardens, God Hand, Fragarach) gets a scripted rule element with a documented API.

**P3 — Everything that happens is an event.**
`onAttackDeclared`, `onDamageStepEnd`, `onUnitDefeated`, `onTurnEnd`, `onRoundEnd`,
`onEffectApplied`, `onMovementCompleted`. The general notes explicitly ask for this
("If something is common enough it should be made an event"). Effects subscribe to events;
they do not patch the engine. See Appendix E.

**P4 — Fail loud, never silent.**
If an effect declares a predicate the engine cannot evaluate, or a targeting shape it does
not know, the system throws a visible error naming the offending content document. A silently
skipped modifier is worse than a crash, because it produces a wrong number that looks right.

**P5 — Separate computation from mutation.**
The damage pipeline is a pure function: `(context) → DamageResult`. It performs no writes.
Applying the result is a separate, permission-checked, socket-routed operation. This makes
the pipeline unit-testable without a Foundry instance, which is the only way a system of this
complexity stays correct.

**P6 — The GM can always override.**
Every prompt has a GM override. Every automated decision can be manually corrected. Every
roll can be re-rolled by the GM with a reason recorded in the log.

**P7 — Optimize for the second year.**
The content set will grow to dozens or hundreds of Servants. The cost that matters is not
building the engine; it is adding Servant #47. Every architectural choice is judged by what
it does to that cost.

## 1.7 The layered architecture

The system is designed in four layers with a strict dependency direction. Nothing in a lower
layer may import from a higher one.

```
┌───────────────────────────────────────────────────────────────┐
│ L4  PRESENTATION                                              │
│     Sheets · Tactical HUD · Chat cards · Dialogs · Previews   │
│     Depends on: L3, L2, L1                                    │
├───────────────────────────────────────────────────────────────┤
│ L3  ORCHESTRATION                                             │
│     Combat Process driver · Turn scheduler · Reaction protocol│
│     Socket proxy · Effect application · Persistence           │
│     Depends on: L2, L1.  Owns ALL writes.                     │
├───────────────────────────────────────────────────────────────┤
│ L2  RULES                                                     │
│     Damage pipeline · Check resolver · Targeting resolver     │
│     Rule-element evaluation · Predicates · Stacking           │
│     Depends on: L1.  PURE — no I/O, no document writes.       │
├───────────────────────────────────────────────────────────────┤
│ L1  DOMAIN                                                    │
│     Rank algebra · ◈ arithmetic · Grid geometry · Enums       │
│     Effect taxonomy · Value objects                           │
│     Depends on: nothing. No Foundry globals.                  │
└───────────────────────────────────────────────────────────────┘
```

L1 and L2 have **no dependency on Foundry at all** — they take plain data structures. This is
the single most important structural decision in this document, because it is what makes
SC-5 (audit) and the testing strategy in Chapter 38 possible. A combat resolution test is a
plain function call with a JSON fixture; no `game`, no `canvas`, no world.

The bridge between L1/L2 and Foundry is a **snapshot**: before any resolution, the
orchestration layer projects the relevant documents into plain `UnitSnapshot` /
`BoardSnapshot` objects (Chapter 03). The rules layer consumes snapshots and returns
*intents*; the orchestration layer converts intents into document writes.

```
Documents ──project──▶ Snapshot ──rules──▶ Intents ──apply──▶ Documents
   (L3)                  (L1)               (L2)      (L3)
```

## 1.8 What "the same game" means

A recurring temptation when automating a tabletop game is to "clean up" rules that are
awkward to implement. Resist it. The players of this game have years of shared expectation
built on these exact numbers. Two specific commitments:

1. **No silent rebalancing.** If a rule is implemented differently from the text, it is
   listed in [Chapter 41](41-open-questions.md) with a rationale, and gated behind a setting
   where feasible.
2. **Ambiguity is surfaced, not resolved by fiat.** Where the source text genuinely admits
   two readings — and there are a number of these, e.g. whether Burn reduces both STR and MAG
   base attack ("Burn reduces the affected Unit's Base Attack (STR & MAG?) by 30" — the
   question mark is in the source) — the system implements a default, exposes a setting, and
   records the question for the game's author to rule on.

---

**Next:** [02 — Glossary](02-glossary.md)
