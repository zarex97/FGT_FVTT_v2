# Nursery Rhyme, Part 4 — The Queen's Glass Game — design

**Date:** 2026-09-16
**Source:** `char_orig_sheets/Copia de Nursery Rhyme.md`
**Part 4 of 4.** Depends on Part 1 (`2026-09-16-nursery-1-core-design.md`) and, for its one
exclusion, on Part 3 (`2026-09-16-nursery-3-nameless-forest-design.md`).
**Chapters affected:** [07 — Time Model](../../07-time-model.md),
[11 — Effect Engine](../../11-effect-engine.md), [24 — Rules Engine](../../24-rules-engine.md),
[30 — Chat and Audit](../../30-chat-and-audit.md),
[43 — Bounded Fields](../../43-bounded-fields.md) §43.11,
[44 — Case Studies: the Expanded Roster](../../44-case-expanded-roster.md),
[45 — Implementation Status](../../45-implementation-status.md), [E — Event Reference](../../E-event-reference.md)

---

## 1. The problem

> **1.** Activates at the end of the Turn, **3◈ Turns after Nursery enters Combat**, if there are
> still enemy Units within a 3 panel area of Nursery at the end of that Turn; the Stats, Parameters,
> Buffs, Debuffs, Cooldowns, and other existing effects of all Units within a 3 panel area of Nursery
> are returned to what they were **3◈ Turns ago**. Does not affect Nameless Forest Tokens.
> At the end of every Round, if there are no enemy Units within a 3 panel area of Nursery, the
> effect of / duration of time passed for this NP is **reset**.
>
> **2.** Activates when Nursery is **defeated**. …returned to what they were **6◈ Turns before**
> Nursery was defeated (**includes herself**). Does not affect Nameless Forest Tokens.
> **Can only be used once during the entire game.**

**The engine has never had to remember the past.** Every other ability in either roster reads the
present or schedules the future. This one reads history, and Ch. 43 §43.11 — which designs it —
opens by saying so: *"This is a time rewind over an arbitrary set of units, and it is by a wide
margin the most demanding mechanic in either roster. Nothing else requires the engine to remember
the past."*

It is also the reason Ch. 44 §44.6 budgets `nurseryRhyme.rewind` as one of only **four** `Script`
elements across ~130 abilities. **There are currently zero** — Ch. 34 and Ch. 36 both close their
tallies with *"Script elements: zero."* She would be the first.

---

## 2. The design already written

Ch. 43 §43.11 is not a sketch; it is a specification. This spec adopts it and adds what implementing
it requires.

**The snapshot shape**, from the chapter:

```ts
interface UnitStateSnapshot {
  globalTurn: number;
  stats: { health: Resource; agility: Resource; luck: Resource };
  parameters: Record<ParamKey, { base: string; granted: number }>;
  effects: EffectInstanceSnapshot[];        // full instances, not ids
  cooldowns: Record<string, CooldownState>;
  resources: Record<string, Resource>;
  modes: Record<string, ModeState>;
  // NOT included: position, facing, turn budget, contract state
}
```

**The storage decision**, from the chapter: a **ring buffer of per-turn snapshots**, one per unit per
turn, retained for `max(6◈) + 2` turns, **diffed against the previous entry and stored as patches**.
Budget ≈ 280 KB at 28 units × 50 turns, on the `Combat` document.

**The gate**, from the chapter, and it is the load-bearing optimisation: `historyRecording` is **off
by default** and switched on only when an ability declaring `requiresHistory: true` enters play.
*"A match without Nursery Rhyme pays nothing."*

**The ordering**, from the chapter: the rewind fires at **end of turn, after all other end-of-turn
processing** (Ch. 07 §7.7), so it undoes that turn's events too.

---

## 3. Rulings

**R1 — Position and facing are not restored.** Already settled as **Q45**: *"The source lists 'Stats,
Parameters, Buffs, Debuffs, Cooldowns, and other existing effects' — not location. Units are not
teleported back."* Turn budget and contract state are excluded on the same reading. This spec does
not reopen it; it records that the history buffer therefore **does not store positions**, which is
what makes Q45 cheap to keep and expensive to reverse.

**R2 — Nameless Forest Tokens are excluded, by the ability's own text.** Stated twice, once per
effect. Since Part 3 stores tokens in `resources` and the snapshot stores `resources`, the exclusion
is a **named carve-out** rather than an emergent property — it must be written down, or the rewind
will restore them and silently undo Part 3.

**R3 — Effect 1's clock starts when Nursery *enters Combat*, not when the match starts.** *"3◈ Turns
after Nursery enters Combat."* Recorded because *"enters Combat"* is a distinct moment from being
summoned or from the Round counter starting, and reading it as either would fire the rewind at the
wrong time for the whole game.

**And the engine has no such moment.** (Corrected before planning.) There is no `enterCombat` event,
no combat-lock flag, and no `inCombat` state anywhere in `module/` — the phrase appears exactly once
in the whole repository, in Ch. 43 §43.11's own quotation of this sheet.

**DECISION.** *"Enters Combat"* is **the first Turn end at which an enemy Unit stands within her
3-panel ring**, and the clock runs from there. The derivation is the clause's own second sentence:
*"At the end of every Round, if there are **no enemy Units within a 3 panel area** of Nursery, the
duration of time passed for this NP is reset."* The reset is keyed on that predicate, so the start
must be too — a clock that begins on one condition and resets on another is a clock that can never
be reasoned about. Reading it as "when the match starts" would also make the reset clause
meaningless for the first three Rounds of every game.

So there is one predicate, read at one boundary, doing both jobs: enemies in the ring advance the
clock, and their absence at Round end returns it to zero.

**R4 — The reset is a reset of the clock, not of the buffer.** *"At the end of every Round, if there
are no enemy Units within a 3 panel area of Nursery, the effect of / duration of time passed for this
NP is reset."* So the 3◈ countdown returns to zero and starts again the next time an enemy closes.
The recorded history is untouched — it must be, because effect 2 still needs 6◈ of it.

**R5 — Effect 2 fires on final defeat and includes her.** *"Activates when Nursery is defeated…
(includes herself)."* It must fire **after the revival chain has resolved to a defeat**, not when her
Health touches zero: a Nursery who is revived has not been defeated and must not spend her
once-per-game rewind.

**Corrected before planning: that is NOT the `unitDefeated` rung.** `engine/scheduler.mjs#resolveDefeat`
fires `unitDefeated` **first**, *before* the revival query — its own comment says why: *"Handlers
first: `unitDefeated` is where content that is not a revival hangs."* A handler there fires on a
Nursery whom Guts is about to save.

The right seam is the **tail of `resolveDefeat`**, beside `linkedDeathIntents`, whose docstring
states this exact distinction for the Dioscuri: *"This is the tail of `resolveDefeat`, reached only
once the revival chain has resolved TO a defeat."* The spec's instinct — "the same place the
Dioscuri's linked death hangs" — was right; the rung it named was wrong.

**R6 — Effect 2's rewind restores her too, but does not undo her defeat.** She is *"within a 3 panel
area"* of herself and the sheet says *"includes herself"*, so her Stats are restored — but nothing in
the clause says she comes back. Ch. 43 §43.11 makes the same distinction: *"a rewind that restores
health undoes a kill (though not a defeat — a unit already removed is not within 3 panels to be
restored)."* **DECISION.** Her state is restored and she stays defeated. The rewind is a parting
shot, not a resurrection.

**R7 — Once per game means once per game, across both her defeat and any revival.** *"Can only be
used once during the entire game."* A Nursery revived by a Command Spell and defeated again does not
get a second rewind. The spent flag lives on the actor, not on the effect instance.

**R8 — An effect whose source no longer exists is dropped, loudly.** Ch. 43 §43.11's own RISK:
*"What must not happen is the rewind restoring an effect whose source has since been removed,
producing an orphaned instance. Effect snapshots therefore record the source unit id and the applier
drops instances whose source no longer exists, logging each drop."* Adopted verbatim.

---

## 4. The engine work

**Five changes**, once the `Script` registry E4 assumed is counted. This is the largest single subsystem in either roster.

### E1 — The history recorder

A per-unit ring buffer on the `Combat` document, written once per turn at the end-of-turn boundary,
storing the §2 shape as a patch against the previous entry, retained `max(6◈) + 2` turns.

**Gated.** `historyRecording` is a flag switched on when a unit declaring `requiresHistory: true`
enters play and off when none remains. A match without her pays nothing — no writes, no storage, no
diffing.

### E2 — `requiresHistory` on an ability, and the gate that reads it

A declaration in the ability schema, the allowlists (**both** — `itemSystem()` in
`tools/lib/content.mjs` **and** `AUTHORED_ITEM_KEYS` in `module/content/authored-fields.mjs`), and a
reader that flips the recorder on. This project has now lost six fields to those allowlists; this one
is declared in both from the start.

### E3 — The `rewind` intent and its applier

One intent per affected unit, applied as a single batch per actor: restore stats, parameters, effect
instances, cooldowns, resources and modes from the named snapshot — excluding position, facing,
budget and contract (R1), excluding Nameless Forest Tokens (R2), and dropping source-orphaned effect
instances with a log line each (R8).

### E4 — `nurseryRhyme.rewind`, the corpus's first `Script`

Ch. 44 §44.6 budgets it: *"Restoring an arbitrary historical snapshot across a unit set."*

**Why a Script and not a rule element.** Every other ability in the corpus is data because its
behaviour is a *composition* of named mechanisms. This one has to walk a unit set, resolve a
historical index, diff two states and emit a heterogeneous batch — and it has **exactly one
customer**. Ch. 24's own position is that *"Scripts are the escape hatch, not the norm."* A rule
element generalising "rewind" from a single example would be inventing a vocabulary for a shape
nothing else has.

**DECISION.** `Script` it, and say so in the tally. If a second rewind ever appears, generalise then
— which is the rule Ch. 44 already applies to `innocentWorld` and `heel`.

**And the registry does not exist.** (Corrected before planning.) `rules/elements.mjs:1834` collects
a `Script` element into `eventHandlers` as `{event, script, source}`, and **nothing in the engine
reads `handler.script`** — `grep -rn "\.script" module/engine module/rules` returns that one
writing line and no reader. The element's own comment promises *"named entries in a closed registry,
never `eval`"*; there is no registry.

That is consistent rather than surprising: the corpus has zero Scripts, so the hatch has never been
opened. But it means E4 is **two** pieces of work — the registry and its dispatch, then the one entry
in it — and the registry is the half that has to be right, because it is the seam every future
Script inherits. Being closed and name-keyed is the security property: compendia are shared, and
content must never be able to execute.

---

## 5. The clause inventory

~10 numbered goals, and each one is heavier than it reads.

| # | Clause | Verdict |
|---|---|---|
| G1 | Rank C, NP, `[Anti-Self/Anti-World]`, **(Passive)** | FREE |
| G2 | Effect 1 fires **at the end of the Turn, 3◈ after Nursery enters Combat** (R3) | **ENGINE — E1, E4**, and "enters Combat" is defined by R3 rather than found |
| G3 | …only if enemy Units remain within 3 panels at the end of that Turn | CONTENT — a targeting predicate |
| G4 | Restores Stats, Parameters, Buffs, Debuffs, Cooldowns and other effects of all Units within 3 panels, to **3◈ ago** | **ENGINE — E3, E4** |
| G5 | Position, facing, turn budget and contract are **not** restored (R1 / Q45) | **ENGINE — E1** (by omission from the buffer) |
| G6 | Nameless Forest Tokens are **not** restored (R2) | **ENGINE — E3** (a named carve-out) |
| G7 | At the end of every Round with no enemy within 3 panels, the **clock** resets (R4) | CONTENT |
| G8 | Effect 2 fires when Nursery is **finally** defeated (R5) | **ENGINE — E4**, in the tail of `resolveDefeat` and **not** on `unitDefeated` |
| G9 | …rewinding **6◈**, including herself, without undoing her defeat (R6) | **ENGINE — E3, E4** |
| G10 | Effect 2 is usable **once per game** (R7) | CONTENT — a spent flag on the actor |

**Tally: 1 FREE, 3 CONTENT, 6 ENGINE.** By clause count the smallest part; by engineering the
largest.

---

## 6. The content

**One new content file; one new engine module; five modified.**

- **New** — `packs/_source/abilities/nursery-queens-glass-game.yml`
- **New** — `module/engine/state-history.mjs`, the recorder and the ring buffer (E1)
- **Modified** — `packs/_source/servants/nursery-rhyme.yml` (its last ability ref);
  `module/data/item/ability.mjs` (`requiresHistory`); `tools/lib/content.mjs` and
  `module/content/authored-fields.mjs` (**both** allowlists, from the start);
  `docs/41-open-questions.md` (**Q45** marked settled in code)

---

## 7. Verification

**Unit and golden tests.** The recorder is pure enough to test without Foundry: a synthetic unit
mutated across ten turns, snapshotted, and restored to turn 4 — asserting that stats, cooldowns and
effect instances come back and that **position does not** (R1); that a Nameless Forest token survives
the rewind (R2); that an effect whose source has been removed is dropped and logged (R8); that the
clock resets when the ring empties of enemies but the **buffer does not** (R4); and that effect 2
fires from `unitDefeated` rather than from `healthReachedZero` (R5) and marks itself spent (R7).

**The storage budget is itself a test.** Ch. 43 §43.11 claims ≈280 KB at 28 units × 50 turns. A test
builds that worst case and asserts the serialized size is within an order of the claim — because a
buffer that quietly grows unbounded on a long match is the failure mode this design's diffing exists
to prevent.

**The live board.** Nursery and two enemies inside her ring; three rounds of ordinary play — damage,
buffs, a spent cooldown; then the rewind at the end of the turn, and the enemies' sheets showing the
Health, the effects and the cooldown they had three rounds earlier, **standing where they are now**.
Then a Nameless Forest token still on them. Then her defeat, and the 6◈ rewind, once — and refused
the second time.

---

## 8. Risks

**This is the first `Script` in the game, and the tally that says "zero" is load-bearing.** Ch. 34
closes with *"Script elements: zero. The Dioscuri look exotic but decompose into ten small, general
mechanisms. That is the strongest evidence the architecture is right."* Writing the first one is a
claim that this shape genuinely cannot be data — and it should be written so a reader can check that
claim, not merely accept it.

**A rewind restores things players have already spent.** A cooldown comes back, so does an ability
already used; Health comes back, so does a kill. Ch. 43 §43.11 says both are intended. What is *not*
intended is an orphaned effect instance (R8), and that is the one the applier must actively refuse.

**The gate is the whole performance story.** If `historyRecording` is ever on by default, every match
in the game pays for a feature one Servant uses. The flag must be tested as a flag — a match with no
`requiresHistory` ability present should write **nothing**, and that assertion is worth more than any
of the restore tests.

**Both allowlists, from the start.** `requiresHistory` is exactly the shape of field this project has
now silently dropped six times — in the schema, in the YAML, absent from `itemSystem()`, compiled to
its default. The last two occurrences were caught only on a live board.

**Part 4 depends on Parts 1 and 3** — on 1 for the Servant, and on 3 only for R2's carve-out. If
Part 3 is not built when Part 4 is, the carve-out is inert rather than wrong, and becomes live the
moment tokens exist.
