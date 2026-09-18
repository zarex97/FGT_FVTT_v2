# 46 — The Roster Re-Audit

**Started 2026-09-16.** Chapter 45 says *"13 of 29 reference Servants are fully authored"* and
then says the claim is unreliable: *"'authored' is a claim only a live board can settle. Asterios
and Karna were both on this list while six of Asterios's clauses had no reader and nine of Karna's
thirteen abilities did not exist."*

This chapter is the re-audit that takes that seriously. One Servant at a time, every paragraph of
the original sheet held against a reader and then pressed in a running world.

It exists because the **first** Servant audited — Heracles, on the "fully authored" list since the
list was written — moved four things, and **only one of the four was his**. The other three were
general defects that his sheet happened to be standing on. A per-Servant audit that records its
findings only in that Servant's case chapter loses exactly the findings that matter most.

So: §46.4 is the register of what is wrong for **everybody**, and §46.5 is the checklist to run
against each Servant. Both are living; each audit appends to them.

---

## 46.1 What an audit is

Two passes, and the second is not optional.

**Pass 1 — the paper trace.** Every paragraph of `char_orig_sheets/Copia de <name>.md` is a claim.
Trace each one: *Character Sheet Clause → rule element in the YAML → the engine reader that consumes
it*. (Elsewhere this chapter says "sheet" where it means the Character Sheet — prose written before
`CONTEXT.md` separated it from the Foundry actor sheet. Those uses are unchanged here; the method
section is the one that has to be unambiguous.)
A clause whose element has no reader is **Collected**, which Ch. 45 defines and which this
project's dominant defect shape. A clause whose reader is asked the *wrong question* looks
identical on paper and is not caught here — which is why there is a second pass.

**Pass 2 — the live board.** Import the Servant **fresh from the compiled pack**, put it in a real
match, and take every Clause to evidence. Read the actor sheet, the chat card and the audit log, not
the return value.

### The five evidence levels

Every Clause carries exactly one. They are ordered: anything below `Observed` is not done.

| Level | What it means |
|---|---|
| **`Pressed (interface)`** | A real click on the real control, the result read from the actor sheet, the chat card or the game log. The strongest evidence: it exercises the interface as well as the rule. |
| **`Pressed (engine)`** | Driven on a live board through the **same function the button calls**. One layer below the mouse. |
| **`Observed`** | A passive Clause in force, its effect read in a case that would read differently without it. Equal in strength to a press, different in kind, because a passive has no control. |
| **`Traced`** | Followed from Character Sheet to rule element to the engine reader that consumes it, and no further. |
| **`Untouched`** | Not examined. |

**Which press a Clause needs.** A Clause a player initiates — a Skill, a Noble Phantasm, an attack, a
move — needs `Pressed (interface)`. A Clause the scheduler or an event fires is satisfied by
`Pressed (engine)`.
[ADR 0004](adr/0004-a-player-initiated-clause-needs-an-interface-press.md) holds the reasoning and
the condition that would merge the two levels.

**`Observed` requires a differential.** A passive stating that damage taken is reduced by 40% is not
proved by reading 60 damage; it is proved by reading 100 without it in force and 60 with it. A
passive has no moment, so a single reading is a number, not a rule. Record both values.

Passives are the ordinary case, not the exception: 228 passive markers against 134 active across the
Character Sheets.

**An Ability with both a passive and an active part carries two evidence records.** They are separate
claims and fail independently: Asterios' Natural Monster has a passive that is the source of his STR
and END and an active that applies two buffs, and either can be inert while the other works.

> Green unit tests are not evidence. Every fixture in `sheet-present.test.mjs` used the document
> shape of `health`, so the code and the tests agreed with each other and not with the system, and
> the defect in §46.4-A survived every one of 4,724 passing tests.

An audit is finished when every clause has been *seen working on a board*, and the findings are
filed: Servant-specific ones in that Servant's case chapter, general ones in §46.4 here.

**By that standard no Servant is finished, and the roster now says so.** Two sections of this chapter
used to record per-Servant progress and they contradicted each other — one marked three Servants
*complete* that the other said were not — so both were deleted rather than reconciled, and every
Servant was reset to `Untouched`. Progress lives on the issue tracker now, computed from each
Servant's clause list rather than maintained by hand. See
[ADR 0005](adr/0005-the-roster-status-is-the-tracker-not-a-table.md).

An audit that reports only its findings reads as a clean bill of health for everything it did not
reach. That is why the Clause list is the unit: a Clause nobody asked about is recorded as unasked.

The section numbering below skips **46.7** and **46.13** — the two deleted records. The gaps are left
rather than closed, for the reason ADR 0005 gives.

### The procedure

Written from the Asterios re-audit of 2026-09-17 — the first Servant taken end to end under this
scheme — rather than from an idea of what an audit ought to look like. An earlier version of this
section described a method that predated the evidence levels and that nobody had followed, which is
the same right-and-inert shape the programme exists to find, expressed in prose instead of code.

Run it in this order. The order is not decoration: steps 1–3 are cheap and catch the errors that
would otherwise invalidate every measurement taken after them.

1. **Get the Clause list.** `node tools/extract-clauses.mjs "<Servant>"` emits it from the Character
   Sheet, grouped by Ability, in the field order the tracker issue uses. It emits everything it
   finds and never drops a line, but it prints to stderr what it could not place — a rule stated
   with neither a number nor a timing marker, a Clause whose ref a human has to name — and settling
   those is step 1's real work. A Clause that goes missing here and is not noticed is the same
   defect as a Clause an auditor skipped, which is the shape this whole programme exists to find.
2. **Check the statblock against the Character Sheet, field by field.** Parameters, Base Health,
   MOV, Range and targets, Base Attack, Sustainability, alignment, region, attributes. Two of those
   are *expected* to disagree with the printed sheet and the engine is right both times — Max Health
   derives from the END table and Base Attack from the STR/MAG table (§46.6). Everything else that
   disagrees is a finding. The statblock is one Clause on the list, `SB`.
3. **Paper trace before the board.** For each Clause: Character Sheet → rule element in
   `packs/_source/servants/<slug>.yml` → the engine reader that consumes it. A Clause whose element
   has no reader is **Collected**, and you have found it for the price of a `grep`. This pass is
   necessary and not sufficient — three defects have survived a complete paper trace that declared
   them correct — so nothing here raises a Clause above `Traced`.
4. **Build the board** (below), import the Servant fresh from the compiled pack, and apply the
   setup rolls by hand before pressing anything.
5. **Press the actives, Ability by Ability, in the order the list has them.** A real click on the
   real control; read the result from the actor sheet, the chat card and the game log. Record the
   observed numbers in the Clause line, not the word "works".
6. **Stage and observe the passives** (below). Each one needs both halves of its differential.
7. **Reach the engine-fired Clauses.** These are the expensive ones, because they have no control:
   an expiry, a Round boundary, a Master's defeat, the owner's own defeat. Build the situation and
   let the scheduler run. `Pressed (engine)` is the bar here — ADR 0004 — and it is the bar because
   there is no button that could be broken.
8. **File as you go.** A Servant-specific finding goes to that Servant's case chapter; a finding
   that reaches anybody else goes to §46.4 and gets a letter. The test of which is the same test as
   for splitting a ticket: would a second Servant need this fix?
9. **Fix, or file a blocking ticket.** A defect whose fix is local to this Servant is fixed inside
   this audit, with a regression test at whatever seam is natural. One a second Servant would need
   becomes its own ticket and the Servant's issue blocks on it. A Clause that cannot be reached
   because the board condition cannot be constructed becomes a blocking ticket naming that
   condition — never a footnote.
10. **Close only when every Clause is `Pressed` or `Observed`.** The tracker counts the ticked
    boxes; it does not know what a thin audit looks like. Nothing else computes this for you.

The two passes are steps 3 and 5–7. Everything else exists so that those two measure the right
thing.

### The world an audit is run on

**Build the board with `commitWar`** — the function the war-setup wizard's Confirm button calls. It
is one call, and it is the only way to get home bases, the Region, faction turns, the first-Round
attack ban and `servantSetupPlan`. A hand-built `Combat.create` with a bumped round skips all of
them, and skipping the last one gives every Servant a Max Health from the wrong derivation (§46.4-K).

**Import the Servant fresh from the compiled pack, by the summon path. Never hand-build one, and
never reuse a previous session's actor.** A hand-built Unit can carry a shape the pack would never
produce, and a stale one carries numbers matching no table — a Heracles at 1600 Health with END A,
where the table says 1500.

**Rebuild the packs only when that Servant's content has changed.** A change under `packs/_source/**`
needs `node tools/fgt-world.mjs rebuild`; a change under `module/**` needs no rebuild at all.
**A rebuild needs the Foundry application fully closed, not merely the world shut down** — the
desktop process holds the LevelDB packs open for its whole lifetime, and a rebuild that fails on
`EBUSY` leaves the *old* packs in place, so the next measurement reports stale content as though it
were new.

**One GM connection.** Two make every scheduled effect tick twice — drains, periodics, cooldowns,
expiries — so a stated 20 measures as 40. The boundary is claimed per connection now (§46.4-D), but
count `/game` pages rather than users to see the situation: `game.users.filter(u => u.active)` shows
one either way.

**Prefer a neutral Region unless the Clause is about a Region.** A Servant whose region matches the
war's gets +1 rank on every parameter and +10 Base Attack per STR/MAG step, so any figure measured
against the sheet's printed number is wrong by that shift. Asterios reads `STR A++ → EX--` and
`BA(STR) 170 → 180` in a Greece war. Where a Clause *is* about the Region — his Labyrinth grows from
9×9 to 11×11 there — that is a second war, and the record says which board each measurement came from.

**Resolve and apply the setup rolls before pressing anything.** Agility and Luck are not authored:
`rules/setup-rolls.mjs#servantSetupPlan` rolls them at war setup, and a pack-fresh import dropped
into a running match arrives at **0/0** with `setupLocked: true`. Every Clause touching either then
measures zero and reads as a defect. Say in the record that you applied them by hand — a Servant
whose Agility you chose is not evidence about a Servant whose Agility was rolled.

### Staging a differential

`Observed` is the level a passive reaches, and it needs two readings, not one. A passive stating that
damage taken is reduced by 40% is not proved by reading 60 damage; it is proved by reading 100
without the Clause in force and 60 with it. Record **both** values in the Clause line.

The board has to be otherwise identical between the two readings. In practice that means holding the
attacker, the defender, the Region, the Round and every other standing effect fixed and moving
exactly one thing:

- **A Clause carried by a mode** is the easy case: toggle the mode. Asterios's `ME.2` was taken as
  **167** with Mad Enhancement off against **100** with it on, same attacker, same board, same Turn —
  and the pipeline printed the reason beside it, `Def Up | Mad Enhancement | −40% | ✕ -40% → ×0.60`,
  against stage 4 `✕ +0% → ×1.00` with the mode off.
- **A Clause with no switch** is staged by removing what it depends on rather than by removing the
  Clause: stand outside the area instead of inside it, attack with a MAG component instead of a STR
  one, use a Normal Attack where the other half says NP. `ME.3`'s two halves were read off one
  contribution list that gained `atkUp 60 [not:attack:component:mag]` and `atkUp 30
  [attack:component:mag]` together.
- **A Clause gated on a die you cannot force** is pressed with the chance staged, and the record
  says so in those words. `AL.3`'s 10% Bleed rider never came up in the attacks actually made; what
  was proved is that the rider fires on every landed Normal Attack and that, with the chance staged
  to certainty, it inflicts Bleed with an expiry exactly 1◈ out. That is an honest press of
  everything except the die.
- **A Clause that states a refusal** needs the positive control on the same board. `CL.6`'s *"cannot
  be used if Health is less than 200"* was staged at 150 and the evidence is an **absence** — no
  prompt at all, the field closed, nobody charged. An absence is only evidence next to the presence:
  the same prompt had appeared twice at full Health on the same board minutes earlier.

**Read the value, then spend it.** A differential taken on the board *projection* proves the number
moved, not that anything binds on it. Asterios's MOV read 10 inside his Labyrinth from the first
audit onward and was still refused by the movement gate, which had never been shown the field's
interior rules at all (§46.4-AP). Wherever a passive moves a stat, spend the stat: walk the panels,
throw the attack, take the hit.

### What an audit costs

Measured on Asterios, the cheapest Servant that exercises every part of the scheme:

| | |
|---|---|
| Clauses | **30** across 5 Abilities, the statblock counting as one of them |
| Rule elements behind them | 12 |
| Boards | **2** — a neutral 15×15 built with `commitWar`, plus a second war on Greece for the one Region-dependent Clause |
| Defects found | **7**, of which **6 were general** (§46.4-AO…AV) and one was his alone |
| Clauses that could not be pressed outright | 2 — one stating no mechanic (`NM.p`), one gated on a 10% die (`AL.3`) |
| Most expensive Clause by wall-clock | the escape ladder, `CL.5` — one attempt per Turn, five Turns for five attempts, because the gate wants movement left and only a Turn restores it |
| Single most expensive mistake | one hour lost to a dialog `ui.windows` cannot see, settled afterwards by one screenshot |

Two figures are worth carrying forward. The **six-of-seven general ratio** is the programme's return:
an audit is a way of auditing the engine, and most of what a Servant finds is not the Servant's.
And **the expensive Clauses are the ones with no control of their own** — `ME.5` needed a Master
killed with the mode active, `CL.8` needed Asterios himself defeated with a field standing. Budget by
counting those, not by counting Clauses.

Scaling is by Clause count and by how many of those Clauses have no control. The roster runs from
Asterios's 30 to roughly a hundred Clauses against fifty-seven rule elements at the largest, so the
biggest Servant is something over three times this. A Servant that proves too large for one sitting
is split on a real boundary once that boundary is known, not pre-split on a guess.

---

## 46.2 Measurement hazards

Every one of these was hit by an audit, and three of them produced a **wrong finding that was
reported before being retracted**. Check them before trusting a number. The first block came from
Heracles; the rows marked *(Asterios)* were added by the re-audit of 2026-09-17 and are the ones
about reading a measurement rather than about taking one.

| Hazard | What it looks like | Guard |
|---|---|---|
| **Two GM connections** | Every scheduled effect ticks **twice** — drains, periodics, cooldowns, expiries. A stated 20 measures as 40 | **Fixed (§46.4-D)**, and the hazard is retired: a boundary is now claimed per connection. Counting `/game` *pages* rather than users is still the way to see the situation, because `game.users.filter(u => u.active)` shows **one** either way |
| **Round boundaries** | A drain reads as a heal. Home Base regeneration fires at round end and can exceed the toll | Record `combat.round` before and after every measured Turn; discard trials where it changed |
| **A hand-built board** | `Combat.create` plus a hand-bumped round skips home bases, the Region, faction turns and the first-Round attack ban — and `servantSetupPlan`, so every Servant's Max Health comes from the other derivation (§46.4-K) | Build it with `commitWar`, the function the wizard's Confirm button calls. It is one call and it is the only way to measure what a table will see |
| **`token.update({x, y})` is silently refused** | Movement legality rejects an engine-external write and returns without throwing, so the token stays put and every later measurement is taken at the old position — which reads as a mysterious *"out of Range"* | `displaceToken(tokenDocument, {x, y})` from `engine/io.mjs` — the engine's own mover. Note the **document**, not the placeable: `token.move` does not exist on the placeable |
| **An AoE fans into one Process per target** | `resolveAttack` returns ONE message id; the rest sit at `react` until advanced. Advancing only the returned one leaves the other targets untouched, which looks exactly like an ability that skipped them — Howl of the War God appeared to miss its ally for three attempts | Read `flags.fgt.process.groupId` and advance every message sharing it |
| **A dialog that `ui.windows` cannot see** | An ApplicationV2 prompt (`askOwner`) is not in `ui.windows`, so a Process legitimately waiting for a click looks exactly like a hung `advanceAttack`. Cost an hour on Asterios, whose Monstrous Strength is offered at every Damage Step | Take a screenshot before concluding anything is stuck. A picture settles in one call what probing settles in ten |
| **Stale test actors** | A Servant with numbers matching no table — a Heracles at 1600 Health with END A, which the table puts at 1500 | Import fresh from the pack for every audit. Never reuse a previous session's actor |
| **Hand-built combats** | `Combat.create` + a hand-bumped `round`/`globalTurn` is not what the war-setup flow produces | Acceptable for isolating a clause; say so when reporting, and re-measure through the real flow before calling something a rules defect |
| **Pack staleness** | Content edits do not reach a running world | `node tools/fgt-world.mjs rebuild`, then re-import the actor |
| **Reading a Combat Process before it finishes** | An attack looks as though it applied nothing | Check `message.flags.fgt.process.state` and its `history`. A Process can be waiting on the **attacker's own** damage-step prompt while the pending panel advertises only the *defender's* reaction, and that dialog can take seconds to render. `advanceProcess` awaits it, so calling the socket directly looks like a hang. This produced a retracted "clause 2 applies nothing" against Asterios |
| **The first `nextTurn` after `startCombat`** | The turn-end sequence does not fire | Discard the first trial; measure from the second |
| **Moving a token to change a positional condition** | Two runs compare identical boards | A long hop is refused by movement legality and the token stays put, silently. Delete the token or move it within its MOV (§46.10) |
| **A resist roll that wins** *(Asterios)* | A Clause applies to one target in the area and not the other, which looks exactly like a targeting bug | It is a die. `CL.2` missed the second enemy once — a 15% resist beating two 85% rolls — and took the same Clause at the next application. Apply again before filing; one trial is not a measurement, and the resist is itself a rule |
| **Reading a stat instead of spending it** *(Asterios)* | The projection shows the number the Clause promises, so the Clause is filed as `Observed` | The gate that consumes the stat may never have been shown the rule. MOV read **10** inside the Labyrinth from the first audit onward while movement still refused the walk (§46.4-AP). Wherever a passive moves a stat, spend it: walk the panels, throw the attack, take the hit |
| **Half an "and vice versa"** *(Asterios)* | The Clause is pressed in the direction the interface makes easy, and reads as proved | `ME.lock` says a mode switched on cannot be switched off for 2◈ *and vice versa*; only the ON direction had ever started the lockout, and the OFF half was a defect (§46.4-AT). Press both directions of any symmetric Clause, separately |
| **An effect that charges nobody** *(Asterios)* | The Clause fires, the log says so, and the number on the sheet does not move | Read the **victim**, not the event. `ME.5` reduced a Sustainability belonging to no one for as long as it had existed (§46.4-AS), and the firing was never in doubt |
| **Evidence that is an absence** *(Asterios)* | A refusal Clause is "proved" by nothing happening — which is also what a dead Clause looks like | Take the positive control on the same board, minutes apart. `CL.6`'s refusal below 200 Health is evidence only because the same prompt had appeared twice above it |
| **One attempt per Turn** *(Asterios)* | A ladder looks stuck: the second attempt is refused immediately after the first | The gate wants movement left and only a Turn restores it — the Clause, not a workaround. `CL.5` cost five Turns for five attempts. Budget the Turns; do not conclude the gate is broken |

**The general rule this produces:** when a measurement disagrees with a sheet, isolate the *pure*
layer first. Call the rules function directly with a hand-built board. If the pure layer is right
and the live board is wrong, the defect is in orchestration or in the harness — and the harness is
the more likely of the two.

---

**Effects are ActiveEffects, not Items.** `CONFIG.ActiveEffect.dataModels.fgtEffect` is where an
effect instance lives. `actor.items.filter(i => i.type === "fgtEffect")` returns `[]` for a Unit
carrying a dozen, and — worse — `createEmbeddedDocuments("Item", [{type: "fgtEffect"}])` **resolves
without error and creates nothing**, because `fgtEffect` is not a registered Item subtype. Four
clauses were briefly believed broken on that basis in one afternoon and all four were working. Read
`actor.effects`.

**`runFieldEvents` returns intents; it does not apply them.** Calling it from the console and then
reading the board shows nothing happening, which is indistinguishable from the event being dead.
The scheduler wraps it in `run(...)`; a probe must too, or must read the returned array.

**Turn state is stale-by-reading, and `acted` is the field that bites.** Writing
`system.turnState.acted = true` does nothing observable unless `turnState.tick` is also the current
`globalTurn` — every reader treats a mismatched tick as an expired Turn. A probe that sets `acted`
and then calls `nextTurn()` has already invalidated it, because the boundary advances the tick.

**`canPassThrough(panel, unit, board)` takes the panel first.** Reversing the first two arguments
returns `true` for everything, which reads as "no movement restriction exists" rather than as a
call-shape error. Panels are `{i, j, k}` — row, column, elevation — and `chebyshev` reads `i`/`j`
only.

**A `SetField` prints as `{}`.** `JSON.stringify` of `attributes`, `servantIds` or any other
`SetField` shows an empty object whatever it holds. Spread it: `[...unit.attributes]`. This one has
now caused a false report twice in this audit.

**`classifyAbility` decides which use path an ability takes.** Driving an ability down the other one
by hand measures a path the sheet's own button never uses. Arrogant King's Poison charges its
3-item cost through `useSkill` (`isAttack: false`) and would not have through `resolveAttack` — a
fact about the probe, not about the ability.

**An override is innocent until the base class is asked.** When a Foundry override looks like it is
over-reaching, get the parent's verdict beside it:
`Object.getOwnPropertyDescriptor(Token.prototype, "isVisible").get.call(token)`. Presence
Concealment's invisibility appeared to hide a Servant from her own owner; the base getter said
`false` too, and the cause was a token still stamped with a **deleted platform's `level`**, which
made her off-level for everyone. Deleting a platform out from under its passengers leaves that
field behind.

**And check which member the version actually has.** Foundry 14 has no `Token#_isVisible`:
`isVisible` is a getter and the ray-casting lives in `CanvasVisibility#testVisibility`. Overriding
a method the current version does not call installs something inert — a fix that tests green and
does nothing on a board.

**A Servant imported fresh from the pack has no Agility and no Luck, and cannot be given any while a
match is running.** This one bites §46.1's own instruction. Neither stat is authored: both are
**rolled at war setup** — `rules/setup-rolls.mjs#servantSetupPlan` gives a Servant Agility from a base
plus `1d2` and Luck from a base plus `1d4` — and the sheet reports `setupLocked: true` once a match
has started, which is a real rule and not a bug. So "import the Servant fresh from the compiled pack"
and drop it into a live match, and you have a Servant at **Agility 0, Luck 0** who cannot Evade and
cannot pass a Luck Check.

Every clause touching either then measures zero and reads as a defect. Found on Asterios: the
pack-fresh import arrived at `0/0` while twenty-four of the twenty-eight Servants already in the world
carried non-zero values, which is what made it visible at all. Resolve the plan and apply it by hand
before pressing anything, and say in the record that you did — a Servant whose Agility you chose is
not evidence about a Servant whose Agility was rolled.

**Ranks and Base Attack move with the war's Region, and the sheet says so quietly.** A Servant whose
`region` matches the war's gets **+1 rank on every parameter** and +10 Base Attack per STR/MAG step —
Asterios reads `STR A++ → EX--` and `BA(STR) 170 → 180` in a Greece war. The actor sheet itemises it,
but a probe reading `system.parameters` sees the authored rank and a probe reading a snapshot sees the
shifted one. Any damage figure measured against a sheet's printed number is wrong by that shift unless
the war Region is neutral.

## 46.3 Recurring defect shapes

Not a list of bugs; a list of *kinds*. Each has been seen at least once, and each is worth
actively looking for rather than waiting to trip over.

| Shape | The question to ask |
|---|---|
| **Collected but unread** | Is there a reader for this field, and is it reached? `grep` the field name and discount the authoring module |
| **Two shapes of the same value** | Does this read `x.health.value` against a **snapshot**, where `health` is a bare number? `domain/health.mjs` exists for this and lists its own casualties |
| **The gate and the display disagree** | Does the rules layer answer this question in one place and the presenter in another? Two readers of one rule always drift, and the player believes the sheet |
| **A shared template that over-grants** | Does every bearer of this class skill actually carry every clause the template authors? Six Mad Enhancement sheets print three different shapes (§46.4-C) |
| **Absolute where the sheet is silent** | Does the sheet state a reach/duration/count for this ability, or is it inheriting the unit's? An authored `range: 1` freezes a number a buff was meant to move. **The most common defect this audit has found** — six instances across five Servants, and the tell is a sheet that says *"Range+N for the Combat Process"* or says nothing at all while the file states a number. Several were invisible because the frozen value happened to equal the unit's Range at the time of writing |
| **Per-resolution vs. per-unit** | Does this counter tick once per *event* where the rule counts *things*? God Hand spent three charges and recorded one use |
| **Name drift across a boundary** | Does the reader spell the field the way the schema does? `alignment.moral` vs `morality`; a kebab-case slug against a camelCase predicate |
| **Two fields, one winner** | Does this element state two settings where the first silently discards the second? `range:` beats `rangeBonus:` in `anchorRange`, with no warning |
| **An event with no firer** | Is anything calling `fireEvent` for the event this handler names? |

---

## 46.4 The cross-cutting register

Findings that are **not one Servant's**. Each entry says who it reaches and whether it is closed.

### A. `abilityCost` read a Master's Health in the wrong shape — **fixed 2026-09-16**

**Reached: every Servant in the game.** `present.mjs#abilityCost` read `master?.health?.value ?? 0`,
and the Master `context.mjs` hands it is the **board's projection**, where `snapshotUnit` flattens
`health` to a bare number. So `.value` was `undefined`, the `?? 0` made every Master destitute, and
every Noble Phantasm reported *"Master cost 40 Health (HT Master has 0) ✗ cannot be paid"* with
that Master standing at 250/250.

Worse than a display bug on its own: `cannotPay` in `rules/costs.mjs` was already correct, so the
**gate allowed the press while the sheet denied it**. The player believes the sheet.

This is the fourth site in `domain/health.mjs`'s own header list and the one that got away — that
module was written *because of* this bug class, and repaired `cannotPay` while missing the
presenter beside it. Ch. 34.

### B. `cannotDeactivate` was bypassed by every forced path — **fixed 2026-09-16**

**Reached: every mode carrying the flag** — Heracles's Mad Enhancement, Mannanán's Holder Mode, and
anything authored with it later. `rules/modes.mjs` has refused a **player's** click on the flag
since it was written; the forced paths (a scheduler `SetMode`, an ability's `setMode` phase, a
Noble Phantasm's) all write through `io.setMode`, which read `system.active` and nothing else.

Nothing re-armed the mode afterwards either: `reconcileForcedModes` only re-arms a mode held on by
a **compulsion** or a **`ForceMode`** rule, and *"cannot be deactivated"* is neither.

The asymmetry to preserve when touching this: `cannotDeactivate` says NEVER and `toggleLock` says
HOW LONG YOU WAIT, so a forcible deactivation still beats the lockout and does not beat the flag.
A Command Spell is unaffected — it spends itself through `suspendSkill`, a different write, which
is what makes the sheets that sell a suspension for one Command Spell work at all. Ch. 17.

### C. The Mad Enhancement template over-granted clause 1 — **fixed 2026-09-16, closed in full**

**Reached: Asterios, Castor, Kingprotea** (and, less exactly, Penthesilea and Raikou).

`class-mad-enhancement.yml` authors **both** halves of clause 1 for every bearer. The six sheets
carrying Mad Enhancement print **three** shapes:

| Sheet | Clause 1 |
|---|---|
| **Heracles** | a floor, **no** forced deactivation — *"its Master's Health cannot drop below 20 in this way"* |
| **Asterios, Castor, Kingprotea** | a forced deactivation, **no** floor — *"when its Master's Health is 20 or less, ME is forcibly deactivated"* |
| **Penthesilea, Raikou** | **both**, with the floor conditional — *"while the Skill does not meet the condition to be deactivated, its Master's Health cannot drop below 30 in this way"* |

§46.4-B makes Heracles correct in outcome, because his own `cannotDeactivate` refuses the forced
half. Asterios, Castor and Kingprotea still receive a floor their sheets do not grant — worth 10
Health on the Turn their Master crosses the threshold. Penthesilea's and Raikou's floor is
unconditional where their sheets make it conditional.

**Fixed as a parameterized template, not as three templates.** `substitute` replaced whole-string
`@name` placeholders only, so a clause could not be omitted per instantiation. It can now:
`onlyIf: "@param"` marks a clause only some bearers carry, and `prune` in `tools/lib/content.mjs`
drops it at **build** time — so the compiled document says what that Servant HAS rather than what
the template could have given it. Splitting the file into three would have meant six numbers
obliged to stay in step, which is the failure `substitute` exists to prevent; a `predicate` would
have been wrong for a different reason — this is not a question about the board, it is a question
about whose sheet it is, and it has an answer at build time.

`floorTable: "@drainFloor"` carries the other half (`null` for a bearer with no floor;
`elements.mjs` reads `if (a.floorTable)` and leaves the deduction unclamped). Both parameters are
**required** rather than defaulted: a default would silently hand a new bearer whichever shape
happened to be commonest, and that is the whole finding.

**Measured live** — Asterios: Master at 30 goes to **10**, and Mad Enhancement forcibly off.
Heracles on the same board: Master at 30 goes to **20**, and the mode holds.

**The residue is closed too**, with Penthesilea's audit (§46.10). Her floor and Raikou's are
*conditional* — *"while the Skill does not meet the condition to be deactivated"* — and needed a
predicate the vocabulary did not have. `self:modeHeld:<slug>` is it: **switched on AND unable to be
switched off**, which is neither of the two questions `self:skill:` and `self:skillActive:` already
answer. It is `heldOn` in `rules/modes.mjs`, built from the two existing refusals (`compelledOn`,
`forcedOn`) so a third reading of "held" cannot drift from the one `canToggleMode` gives. It
deliberately excludes `toggleLock` — which says *not yet* and is carried by all six bearers,
including the three whose sheets grant no floor — and `cannotDeactivate`, which says *never* and
belongs to Heracles, whose floor is unconditional anyway.

Two things that emerged only from building it:

- **It closes a real cycle.** `heldOn` asks `forcedOn`, which tests a `ForceMode`'s condition
  against a fresh option set, which arrives back at `heldOn`. Measured: `RangeError: Maximum call
  stack size exceeded` for any unit with a `ForceMode` rule on a mode that is on — which is Raikou,
  every Turn her Master stands beside her. `rollOptionsFor` takes a `withoutModeHeld` flag, and the
  recursive call passes it; a `ForceMode`'s condition is about the board and never about whether
  the mode it governs is already held.

- **The gate belongs at dispatch, not at collection.** The floor's *value* needs the owning
  ability's rank, which is gone by the time an action runs; its *condition* needs the compulsion,
  which `annotateCompulsions` does not write until every unit on the board exists — strictly after
  contributions are collected. Evaluating the predicate at collection asks a question whose answer
  is always no. Measured on a live board with the first spelling: Achilles two panels away, Mad
  Enhancement forced on, `self:modeHeld:madEnhancement` correctly emitted, and her Master still
  went 40 → 10. The value is resolved at collection and the gate applied in `scheduler.mjs`, where
  `ctx.bearer` now travels with every dispatch — an action's subject may be somebody else while
  its conditions are about the Unit that owns the clause.

**Measured live, all six bearers** — a Master at 30 for the first four, at 40 for the last two:

| | held on | free |
|---|---|---|
| Heracles | floors at 20 | floors at 20 |
| Asterios, Castor, Kingprotea | no floor | no floor |
| Penthesilea, Raikou | floors at 30 | **no floor** |

### D. `isScheduler()` elected a GM *user*, not a connection — **fixed 2026-09-16**

**Reached: every scheduled effect, in any session with two tabs open on one Gamemaster.**

`game.users.activeGM?.isSelf` is true for **every connection that user holds**, so two windows on
one GM each run the whole turn-end sequence: drains, periodics, cooldown advances, expiries all
tick twice. The election is correct against two *different* GM users and does nothing against two
tabs of one.

It matters more here than it would elsewhere because `tools/fgt-world.mjs join` opens a tab and
opening a second is one click — which is exactly how it was found, and it produced a clean ×2 on
Mad Enhancement's Master drain that was reported as a rules defect before the second writer was
traced to a socket update arriving from the other tab.

**It is a measurement hazard before it is a gameplay bug** (§46.2), which is why it was worth
closing before the remaining audits rather than after.

**Closed with a claim rather than a lock.** Foundry hands a system no server-side compare-and-set,
and both connections wake from the *same* broadcast — so a plain *"has this boundary been run?"*
check is read by both before either writes, and both proceed. Instead each writes a random token to
`MatchData.scheduleClaim`, the server serialises the two updates, and after a short settle exactly
one connection still sees its own token. Last write wins, and winning *is* the election. The
per-user election stays as the cheap first half; the claim is taken before the board is built, so a
losing connection does no work.

The settle is the price of not having an atomic, and it is charged once per **boundary** — a
player-driven event, not a hot path.

**Measured live with two tabs open on one Gamemaster**, different socket ids and
`game.users.filter(u => u.active).length === 1`: Mad Enhancement's drain reads **20** on four
consecutive Turns. The same rig measured **40** before.

### E. `forbidCivilians: "ifGoodAligned"` can never fire — **open, inert**

`rules/targeting/resolve.mjs` reads `caster.alignment?.moral`; the schema field is `morality`
(`data/actor/servant.mjs`), which is what `environment.mjs` and the sheet context both read. The
gate is therefore permanently false.

Inert today — **no content uses the limit.** It becomes live the moment a good-aligned Servant with
an area Noble Phantasm is authored, which is a thing several sheets want.

### F. An element that states two settings where one wins — **fixed 2026-09-16**

`anchorRange` returns an absolute `spec.range` immediately and only falls through to
`caster.range + rangeBonus` when `range` is absent. Two ability files state **both**:

- `anastasia-ice-block-launcher.yml` — `range: 3, rangeBonus: 3`
- `anastasia-snegleta.yml` — `range: 3, rangeBonus: 1`

The bonus was discarded in both, silently — and her sheet settles the intent in its own words:
*"Range+3 for the Combat Process"* and *"Range+1 for the Combat Process"*, which is `rangeBonus`
and exactly the idiom `anchorRange`'s docstring names. Both anchors now drop the absolute `range:`.
Her Range is 3, so Ice Block Launcher reached 3 panels rather than 6, and its Instakill ceiling sat
at 15% against the 30% the comment beside it asserted.

**The validator now refuses an anchor carrying both**, which is the half that stops it recurring:
`range:` is for a reach the sheet prints, `rangeBonus:` for one stated relative to the unit's own
Range.

### H. A bounded field's escape ladder was offered by nobody — **fixed 2026-09-16**

**Reached: every field with `enemyExit: rollRequired`** — Asterios's Chaos Labyrinthos today, and
the shape Ch. 28 defines for all of them.

`rules/bounded-fields.mjs#escapeAttempt` implements the whole ladder — base chance, `+N` per
failure, border contact, remaining MOV, relocation on failure, and the veteran clause that lets an
escapee lead adjacent allies out — and **its only callers are its own twelve unit tests**.
`rules/movement.mjs:364` asks `membershipVerdict(field, unit, "exit", board)` and treats a `false`
as a refusal, which is the conflation that module's own docstring warns against in these words:

> `rollRequired` is **not** a refusal — it is a refusal *of the free move*, and the caller is
> expected to offer `escapeAttempt`. **Conflating the two would turn the Labyrinth from a puzzle
> into a wall.**

It was a wall. **Measured before the fix**: an enemy standing on the inner border with 3 MOV left,
where `escapeAttempt` returned `{ok: true, chance: 20}`, was refused by the interface with *"FGT |
Step 1 passes through a panel this Unit may not enter."* Interior movement was allowed; leaving was
impossible by any means short of the field expiring or its owner dying. Clauses 5 and 9 of Chaos
Labyrinthos — roughly half its printed text — could never happen.

**Three seams closed it**, and the shape of the gap is worth keeping:

1. **`canAttemptEscape`**, split out of `escapeAttempt`. The only entry point needed a *die*, and
   nothing in the interface had a reason to roll one — so the ladder could not be offered without
   first being resolved. The action bar asks the gate; the engine rolls.
2. **An `escape` action** (`rules/actions.mjs`), offered to a unit inside a boundary that answers
   `rollRequired`. It bills no ActionKind: the Move it is part of is already paid for, and the
   remaining movement is what buys the roll. It is offered even when the gate refuses, so the
   button can *say* `notAtBorder` — an absent button teaches a player nothing.
3. **`field.state.mayExit`**, the transient pass a success buys, honoured by `membershipVerdict`.
   Without it the roll would be won and then refused by the very gate it beat. It is spent by
   being outside, not by a clock, and is **distinct from the veteran mark**: clause 9 grants a
   re-entering escapee *"Base Success Chance … increased to 100%"* — a better roll, not free
   passage.

**Measured live, end to end**: 20% rolled 12 → failed, relocated to a random interior panel,
*"Next attempt: 25%"*; 25% rolled 14 → failed; 30% rolled 12 → failed; **35% rolled 7 → escaped**;
`escapeHistory` read `{failures: 3, escaped: true}`, the token then moved out of the boundary with
no refusal, the pass cleared itself on the next entry sweep, and a re-entry gate answered
`{ok: true, chance: 100, automatic: true, reason: "veteran"}`.

### I. A field's isolation covered targeting but not effect application — **fixed 2026-09-16**

Clause 10 of Chaos Labyrinthos is *"Units outside the Labyrinth cannot **Attack or apply any
effects** to Units within the Labyrinth and vice versa."* `isolationBlocks` implements the first
half and is called from one place — `rules/targeting/resolve.mjs:220`, the legality filter. The
second half has a field authored for it, `outsideCanApplyEffectsInside`, **which nothing reads**.

`rules/auras.mjs` filtered on distance and relation and never consulted isolation, so an aura
crossed the boundary freely in both directions. Medea's Territory Creation is `scope: "field"` —
explicitly unbounded — so it reached inside a Labyrinth from anywhere on the board, through a wall
the same field refuses every attack.

`isolationBlocksEffect` is the reader the authored field never had, and `anyBoundaryBlocksEffect`
is what `collectAuras` asks. **Both** directions and both keys: the sheet says *"and vice versa"*,
and the Labyrinth only ever authored the inward one — `insideCanApplyEffectsOutside` is now stated
beside it, the way `outsideCanTargetInside` and `insideCanTargetOutside` already sit in a pair.

Targeting and effect application stay **separate keys**, because a field may legitimately seal one
and not the other; a boundary that states neither is unchanged.

**Measured live**: with Medea standing outside an open Labyrinth and an enemy inside,
`anyBoundaryBlocksEffect` reads `true` across the boundary and `false` for a unit on her own side,
and no aura reaches the trapped unit. The unit test is red-green: flipping the gate off lets the
`scope: "field"` aura straight through.

`visibilityAcrossBoundary` is still unread, and stays so deliberately: every authored field states
the permissive value, so it is a completed axis rather than a defect. It becomes one the day a
sheet restricts sight across a boundary.

### G. `recordUse` dropped the charge count — **fixed 2026-09-16**

**Reached: any ability-borne `RevivalSource` with `charges` and `cascading`.** Only God Hand today,
but the shape is general — the ledger is the same `timesUsed` counter every whole-match limit
spends. `resolveRevival` returned the right `chargesUsed` throughout and `spendRevival` threw it
away; the **effect**-borne branch beside it had always passed the count to `consumeUse`. Ch. 45a.

---

### J. An incoming `ApplicationChance`'s SIGN was read as prose, not as arithmetic — **fixed 2026-09-16**

**Reached: five clauses, on four sheets and one effect, in BOTH directions.**

`rules/checks.mjs#applicationChance` computes `base + inflictBonus - resist`, and an **incoming**
contribution is the `resist` term. So a positive incoming value RESISTS and a negative one is a
VULNERABILITY of the same size. `effects/soaked.yml` states that outright — *"a NEGATIVE incoming
ApplicationChance is a VULNERABILITY"* — and `effects/nameless-forest-resistance.yml` restates it.

Five authored clauses still landed on the wrong side of it, because the sheets are written in
prose and the prose reads as a signed delta:

| Clause | Sheet says | Authored | Did |
|---|---|---|---|
| Bravery (class) | *"Chance of being inflicted with Mental Debuffs is reduced by 50%"* | `-50` | **+50% more likely** |
| Heracles's Bravery | the same words | `-50` | the same |
| Jack's Mental Pollution 2 | *"...reduced by 60%"* | `-60` | **+60% more likely** |
| Queen's Poison 2 | *"...being inflicted by volatile debuffs is reduced by 15%"* | `-15` | **+15% more likely** |
| Doomsday Come, MAG branch | its own comment: *"chance of being inflicted by debuffs +50%"* | `+50` | **resisted by 50** |

Four skills that exist to protect their bearer made it *more* vulnerable, and the one plague that
exists to make victims vulnerable protected them. Measured on a live board: **Charm resolved at
150% against Heracles**, where his sheet says 50 — twice as likely as carrying no skill at all.

**Kingprotea's Self-Suggestion is the counterexample that settles it.** Its sheet prints the
identical clause — *"chance of being inflicted by non-volatile debuffs is further reduced by 60%"* —
and it is authored `+60`. The same sentence exists in the corpus authored both ways.

**Why every guard missed it.** `effects/debuff-res-up.yml` and `debuff-res-dwn.yml` carry the
convention correctly, so the applier was never wrong and no engine test could fail. The two tests
that *did* cover Bravery asserted `value: -50` **from the source** — they restated the defect and
agreed with it, so content and test were wrong together and both passed for as long as the files
existed. Nothing anywhere asked the applier what percentage came out.

`test/unit/application-chance-sign.test.mjs` asks exactly that, and adds a corpus scan: any clause
whose prose says *"being inflicted ... reduced by"* and whose incoming value is negative fails the
build. It found Queen's Poison, which no reading of the six Servants would have reached.

### K. Two Max Health derivations, disagreeing — **fixed 2026-09-16**

**Reached: Asterios, Castor, Pollux and Penthesilea** — and only through the war-setup wizard,
which is why six audits missed it.

§46.6 settled that **the END table beats a sheet's stated `baseHealth`**, the same way Base
Attack's table does, and `domain/health.mjs#maxHealthFor` implements it. `rules/setup-rolls.mjs`
kept the opposite rule, stated in its own comment:

```js
// Stated on the sheet where it disagrees with the table.
base: sheet?.baseHealth ?? Number(lookup("baseHealthByEnd", end) ?? 0),
```

Both rules were live at once, and **which Max Health a Servant was played at depended on how it
reached the board**: imported from the pack and prepared by `ServantData#prepareBaseData` it got
the table; summoned through `commitWar` — the path the wizard's Confirm button takes, and the only
one a real table uses — it got the sheet.

Exactly four sheets can tell the difference, and they are the four §46.6 was written about:

| Servant | END | sheet says | table says | summoned as |
|---|---|---|---|---|
| Asterios, Castor, Pollux | A++ | 1500 | **1700** | 1500 |
| Penthesilea | B+ | 1250 | **1350** | 1250 |

Asterios's own YAML says the quiet part outright — *"the sheet's figure, kept for the record and
**NOT what he is played at**"* — and the summon path played him at exactly that figure.

**Measured by building a war through `commitWar` instead of by hand.** Asterios arrived at
**1600** (1500 + 100 for his Greece END grant) where he should be **1800**. Achilles, on the same
board, was correct at 1600 by coincidence — his sheet's 1500 and the table's A both agree, which is
true of the other twenty-one Servants and is why nothing ever looked wrong.

The fix is `maxHealthFor` itself rather than a second spelling of it: two derivations that agree
today are two derivations that can drift, which is the whole of what this entry is about.

**This is the first defect found *because* the board was built properly.** §46.2 has listed
hand-built boards as a hazard since Heracles, and the Max Health override had been recorded as
pressed for Asterios (1700) and Penthesilea (1350) — both hand-imported, both therefore reading
the one derivation that was already right.

### L. `oncePerRound` could not reach the one ability that declares it — **fixed 2026-09-16**

**Reached: Karna's Uncrowned Arms Mastership**, which is the only content in the corpus carrying
the field.

`rules/costs.mjs` has read `oncePerRound` since it was written, and its comment names the ability
it was written for:

> *"Karna's Uncrowned Arms Mastership is 'can only be used once per Round' with no cooldown, so
> without this gate it is a free toggle every Turn and the choice between its two effects stops
> being a choice."*

The gate is on the **ability-use** path. Uncrowned Arms Mastership is a **mode** with no `phases`,
and the sheet's toggle only calls `useSkill` when a mode has phases to run — so this skill never
reached `costs.mjs`, and nothing recorded the press either. The one ability the gate exists for was
the one ability that could not reach it.

Its sheet gives it **no cooldown**, so `oncePerRound` is the *only* thing rationing it. Measured
live: toggled twice in succession, `{ok: true}` both times, `roundState.abilitiesUsed` still empty
— Karna could stand in +20% Crit Chance on his own Turn and +40% Crit Damage on the enemy's, every
Round, for free.

**Two halves, because either alone is inert.** `canToggleMode` now refuses a second switch, and the
toggle **records** the press — a mode with no phases wrote nothing down, so there was nothing for a
gate to read. The record is narrowed to modes that declare a limit, so an ordinary free toggle (Mad
Enhancement, Presence Concealment, Riding) does not start appearing in a list `oncePerTurn` and
`abilityOffCooldown` also consult.

Both **directions** are gated: the active clause is *"switch the effect of this Skill from 1 to 2,
**or 2 to 1**"*, so each press is a use and rationing only the switch ON would leave every other
press free. The Round is compared when the caller supplies one, so a stamp from an earlier Round
does not bite in this one.

**Measured live after the fix**: first switch of Round 7 accepted → Effect 2, crit chance 50 and
crit damage +40; second switch in the same Round **refused with `oncePerRound`** and the state
unchanged; first switch of Round 8 accepted → Effect 1, crit chance 70 and no crit damage.

### M. The attack path flattened an effect rule and dropped everything beside it — **fixed 2026-09-16**

**Reached: eleven phases across eight files** — Karna's *Flash of the Sun God* and *End of Charity*,
Medusa's *Bellerophon*, *Blood Temple* and *Monstrous Snake Metamorphosis*, Semiramis's *Double
Summon*, and the *Riding* variants carried by Drake, Medusa and Pollux.

Two authoring shapes are live at once and both ship. A **bare spec** states everything about
itself; a **wrapper** puts the effect in `effect:` and leaves the duration — and any `chance`,
`predicate`, `times` or `magnitude` — *beside* it, because those describe the application rather
than the effect:

```yaml
- { effect: { id: atkUp, magnitude: 40, npMagnitude: 30 }, duration: "1◈" }
```

`engine/attack.mjs` flattened that with `r.effect ?? r`, which returns the inner object and
**discards every sibling**. `applyDeclaredEffects` then read `spec.duration` as `undefined`, and an
unstated duration is INFINITE — so the buff never expired.

**The Skill path was correct the whole time.** `skill-use.mjs#applyPhaseEffects` reads
`rule.duration ?? spec.duration ?? def.defaultDuration`, so the same ability behaved differently
depending on whether it was used from the sheet or resolved as an attack. That is what made it
findable: Karna's Flash of the Sun God granted **permanent** Atk Up and NP DmUp through
`resolveAttack` and correct 1◈ ones through `useSkill`, on the same board, one minute apart.

The three `Riding` variants lost **`magnitude` as well**, which is worse than a wrong duration:
`{ effect: { id: ridingActive }, duration: "this turn", magnitude: 5 }` applied `ridingActive` at
the definition's default of 0, permanently, instead of 5 for one Turn. A buff that grants nothing
and never leaves.

`rules/ability-use.mjs#effectSpecsOf` is now the one flattener, used by both attack-path sites, and
it merges the siblings down onto the spec with the inner effect winning any name it also states.

**Measured live, before and after**: `expiry: null` on both of Flash's buffs, then `expiry: 11` at
tick 8 — 1◈ at three Turns per Round.

### N. A `CheckModifier` whose magnitude is rolled had no die, no carrier and no reader — **fixed 2026-09-16**

**Reached: Penthesilea's Goddess of War clause 3**, which is the only content in the corpus that
authors one.

`DamageModifier` has carried a `roll:` spec since Goddess of War was written — the caller rolls,
the total arrives keyed by source, and `damage/pipeline.mjs` multiplies it. Her clause 2 works that
way and measured **−10** on a live board. Clause 3 is the same shape:

```yaml
- key: CheckModifier
  check: evade
  roll: { key: goddessOfWarEvade, formula: "1d4", multiplier: -1 }
```

It was inert in **four** places, each of which alone is enough:

1. `rules/elements.mjs`'s `CheckModifier` handler read `resolveValue` and **dropped `el.roll`**, so
   the contribution reached the snapshot with no roll spec and `value: 0`.
2. `rules/checks.mjs#checkPlan` filtered on `value !== 0` and discarded it for being zero.
3. `engine/attack.mjs#rollModifierDice` walked `unit.modifiers` and never `unit.checkModifiers` —
   its own comment names Goddess of War.
4. `pendingCheckRolls` emitted only **chance** rolls (`1d100` for a probable contribution), never
   magnitude rolls, and `rollEvade` built the **defender's own plan with no `rolls` at all**.

So the clause was authored, validated, collected, and asked by nobody — the failure shape §46.4
collects, at its purest: four independent gaps in one path, and the only content that exercises it
is the content that found them.

**Measured live, before and after**: an Evade roll of 18 against a target of 16 with
`modifiers: []` and `total === roll`; then the same roll carrying
`Goddess of War: War God's Military Sash: −1`, with 5 → 4 and 18 → 17. The magnitude's scaling with
the die is covered by `test/unit/check-modifier-roll.test.mjs` rather than by sampling a d4 on a
board.

### O. Every protector in the game was called Bašmu — **fixed 2026-09-16**

**Reached: nine of the ten content files** that author a `TargetabilityModifier` — the three Dragon
Tooth Warriors, Raikou's four retainers, the Sphinx Queen and Tenmokaikai. Only Bašmu itself was
described correctly.

`rules/targeting/resolve.mjs` refused a protected target with a hardcoded sentence:

```js
|| drop(u, "protected by a nearby Bašmu"),
…
warnings.push("A Unit protected by Bašmu was excluded.");
```

The aura entry has carried the real name on `source` since it was written, and the filter ignored
it. Measured live: a Medea ringed by her own **Dragon Tooth Warriors** refused an attack with
*"Medea is protected by a nearby Bašmu"* — a creature belonging to a different Servant, who was not
in the war.

Not a rules error — the protection itself is correct, and the Master-protection rule beside it
correctly gave a different sentence (*"protected by an adjacent Servant"*). It is a defect in the
only thing a player actually sees, on a refusal whose entire job is to say **why**.

Both sentences now name the protector, with a generic fallback for an aura that states no source.
**Verified live**: *"Medea is protected by a nearby Dragon Tooth Warrior (Blade)."*

### P. An ability taken at its own timing window was billed and never cast — **fixed 2026-09-16**

**Reached: four abilities**, three of which did nothing whatsoever — EMIYA's and Kiritsugu's
*Thaumaturgy: Reinforcement* and Achilles's *Runner Comet*; Anastasia's *Watermelon* lost its phase
while its four rules still landed.

`engine/attack.mjs#offerAttackerWindow` offers an attacker its own abilities at the Combat Phase
Start and at the Damage Step. Its comment names **two** answers for what taking one means, and the
corpus has **three**:

| | Means | Example |
|---|---|---|
| `mode` | The switch **is** the use | Karna's Uncrowned Arms Mastership |
| `contribute` | Its rules join the attack in progress | Asterios's Monstrous Strength |
| **`cast`** | **Its effect is its phases, so they must run** | **Reinforcement** |

The third had no implementation. The window charged the Cooldown, recorded the use, announced it in
chat — and ran nothing. An ability offered at the only window its sheet gives it, taken by a player
who watched it appear in the log, doing nothing at all.

**Measured live, before and after.** Taking Reinforcement at its own window left EMIYA with no
`nAtkUp` and a cooldown of 3; the identical Spell through `useSkill` applied `nAtkUp: 30`. After the
fix the window applies it too — **and Magecraft's `rangeUp: 1` rider with it** — with the cooldown
charged exactly once, and the pipeline then shows `atkUp: 30, note: "nAtkUp"` at stage 4.

`rules/ability-use.mjs#windowUseKind` is the three answers, and a `cast` is routed through
`useSkill` whole rather than double-billed. An ability with both phases and rules is cast, because
the window carries its rules separately regardless.

### Q. A shifted Magic Resistance Rank moved only half its clause — **fixed 2026-09-16**

**Reached: EMIYA**, the only Servant whose Magic Resistance Rank is shifted by anything.

Magic Resistance states one Rank and reads it **twice**: *"MAG damage from a MAG Rank of up to
@rank is **negated**, otherwise MAG damage taken is **reduced by the table value**"*. His *Kanshou
& Bakuya* raises that Rank by a whole grade while it is up, and his sheet spells the result out —
*"D to C: MAG damage from a MAG Rank of up to **C** is negated, otherwise MAG damage taken is
reduced by **30%**"*.

The reduction moved and the negation did not. The executor computes

```js
const negates = el.negatesUpToRank ? Rank.parseOrNull(el.negatesUpToRank) : rank;
```

where `rank` is the **shifted** rank. The skill authored `negatesUpToRank: "@rank"`, and `"@rank"`
substitutes to a **literal** at build time — the built item carried `negatesUpToRank: "D"` — so the
threshold was frozen at the authored grade while the table lookup correctly used C.

**Measured live**: with `dualWieldGuard` up, the contribution read `{ rank: "D", percent: 30 }`.

The fix is content, not code: the executor's default is already the shifted rank, which is exactly
what *"up to @rank"* means, so the redundant line is gone. The field stays in the vocabulary for a
skill that negates up to some rank **other** than its own; nothing in the corpus does yet.
**Verified live**: `{rank: "D", percent: 20}` → `{rank: "C", percent: 30}`.

### R. `negatedWhile` cannot reach an effect — **open**

**Reached: EMIYA's `dualWieldGuard`**, and potentially any effect whose sheet negates it on a
condition that is not itself an effect.

His Overedge sheet says *"The effect of '@effect[dualWieldGuard]{Kanshou & Bakuya}' is negated while
'Overedge' is on Cooldown"*, and `emiya-kanshou-and-bakuya.yml` authors
`negatedWhile: { abilityOnCooldown: [emiya-overedge] }`. That silences **the ability's** rules — so
the trigger stops applying the guard — but the Rank shift lives on the **effect instance**, which
keeps working once applied.

**Measured live**: with Overedge on cooldown 9 and `dualWieldGuard` held, Magic Resistance still
read **C / 30%**; the sentence says it should read D / 20%.

Left **open** rather than fixed. `negatedWhile` exists only on the ability schema
(`data/item/ability.mjs`, read by `rules/snapshot.mjs`), no effect in the corpus uses it, and the
two candidate fixes — teaching effects the field, or moving the `RankShift` onto the ability — are
design decisions rather than a repair. The effect's own comment explains why the shift lives where
it does, and Overedge's explains why the negation is filed where it is; both were deliberate. The
window is also narrow in play: the guard lasts ⅓◈ and Overedge's Cooldown begins when Overedge is
used. Worth a decision, not a patch at the end of an audit.

### S. A reaction could never be aimed at the unit raising it — **fixed 2026-09-16**

**Reached: EMIYA's Rho Aias**, and any reaction anchored on a target that its owner may itself be.

When a defender takes a reaction, `engine/attack.mjs` resolves it through `useSkill` with a
placement built from the attack in flight — and it omitted `unitId` whenever the reaction's owner
**was** the unit in peril:

```js
...(owner.id === aimedAt ? {} : { unitId: aimedAt }),
```

Rho Aias is anchored `{ kind: targetUnit, range: 3 }` — *"EMIYA projects Rho Aias to protect the
allied Unit(s)"* — and the ordinary case is EMIYA projecting it in front of himself. With no
`unitId` the anchor had nothing to resolve, so the use was refused with *"Choose a target."*, the
attack carried straight on, and the only second Health pool in the reference set never engaged.

**Measured live**: Heracles's Nine Lives for 1406 against a full-Health EMIYA. Rho Aias was offered,
chosen, and recorded in the Process history as taken — and its `shieldHealth` was still **1400**,
its `timesUsed` still **0**, and EMIYA was dead at **0**, against a clause that reads *"EMIYA's
Health cannot drop below 1"*.

A `self` anchor ignores `unitId`, so naming the unit in peril is safe for every reaction and
necessary for the ones that aim. `rules/ability-use.mjs#reactionPlacement` is the one builder now.

**Verified live, after**: shield **1400 → 0**, `timesUsed: 1`, cooldown **24** (8◈), and EMIYA
losing exactly **745** — **700** from *"for every 200 Health Rho Aias loses, EMIYA loses 100"* plus
the **45** that got through once the 1400 pool was spent.

### T. `additionalCosts` were paid only on the attack path — **fixed 2026-09-16**

**Reached: four abilities across three Servants** — EMIYA's Rho Aias and Unlimited Blade Works,
Drake's *Golden Hind: Wild Hunt*, and Ozymandias's *Ramesseum Tentyris*.

An ability may declare standing per-use costs beyond its Noble Phantasm cost. The expansion lived
inside `engine/attack.mjs`, so only abilities resolved through the attack flow ever paid them —
and those four resolve through `useSkill`.

Rho Aias states it plainly: *"EMIYA's Master loses Health equivalent to if an EX Rank NP is used."*
**Measured live**: the cost log read `cost: Master of Archer of Faction 1 (0)` where
`npCostAt({ rank: "EX" })` returns **100** for that Master.

`rules/costs.mjs#additionalCostsFor` is the one expansion now, and both paths use it.

**Verified live.** Satisfying the recovery clause took the long way round — `lastUsedTick` is what
*"since the last usage"* compares against, and `healthWatermarks` records a **crossing** rather than
a level, so EMIYA had to be taken below half and healed back **through the engine** for the
watermark to move (`{0.5: 10}` → `{0.5: 12}` against a `lastUsedTick` of 10). With the clause
satisfied: `useSkill` returned `ok`, the Master went **209 → 109**, `timesUsed` 0 → 1 and the
cooldown read **24** (8◈). **Exactly 100**, the EX-rank figure for a rank-C Master, where before the
fix it was 0.

### U. ~~A shield absorbs whether or not its ability was used~~ — **retracted, not a defect**

Reported open, and wrong. `engine/shield.mjs#barrierOn` does **not** find a barrier by scanning for
any item with a pool: it iterates the defender's **effect instances** for one whose definition
carries `absorbs`. The barrier exists only while the `rhoAias` effect is held, and that effect is
applied with `duration: "⅓◈"`.

What I measured was a second Noble Phantasm arriving **in the same Turn** as the one Rho Aias had
been raised against — which the barrier is supposed to cover, since ⅓◈ is the rest of that Turn.
The refusal beside it was a second *raising* of a barrier already standing, correctly declined by
the recovery clause. Two right behaviours, read as one wrong one.

**Settled by letting the clock run**: the effect carried `expiry: 11`, two Turns took the match to
tick 12, the effect was gone — and a fresh Noble Phantasm then left the pool **untouched at 275**.
Filed in §46.6.

### V. A timing window could not read a stance — **fixed 2026-09-16**

**Reached: every ability gated on a stance**, which in the reference set is four of Achilles's
(*"can only be used when Unmounted"*) and the mirror on Troias Tragōidia.

`abilitiesAtWindow` filters an offer by the ability's own `requirements`, and `stance` is one of
the kinds a window checks. `engine/attack.mjs#offerAttackerWindow` hand-built the subject it asked:

```js
{ items, effects, turnState, roundState }
```

`rules/stance.mjs#stanceOf` reads `unit.stanceSpec` and returns **null** without it, so the
comparison was `null === "dismounted"` — false for a dismounted Achilles, false for a mounted one,
false always. **Runner Comet was never offered at the only window its sheet gives it.**

The two defects stack neatly: §46.4-P had just made an ability of that shape actually *run* when
taken, and this is what kept it from being offered to take.

**Measured live**: a dismounted Achilles with Runner Comet off cooldown and every other gate
passing — no window opened at all. `abilitiesAtWindow` given his **snapshot** offered it; given the
hand-built shape, nothing.

`rules/reactions.mjs#windowSubject` is the subject now — the snapshot, which can answer every
question a requirement asks, plus the Items the filter reads `system` off.

**Verified live**: the *Start of the Combat Phase* window now offers **Runner Comet**, and taking
it restores Agility **15 → 18**, applies `nAtkUp` 30 and `critDmUp` 30 for that Turn, and charges
its 3◈−⅓◈ cooldown as **8**.

### W. Every effect that speeds a Noble Phantasm's cooldown was inert — **fixed 2026-09-16**

**Reached: six ability files across five Servants** — Drake's *Beyond the Uncharted* and *Blazing
Golden Rule*, Medusa's *Blood Temple*, Penthesilea's *Golden Rule (Beauty)*, Semiramis's *Double
Summon*, and Medea's *Teachings of Circe*.

`scheduler.mjs#cooldownRate` decides how fast a cooldown falls. It knew the three effects that
**slow** a Noble Phantasm — `npLock`, `npDegen`, `npLag` — and neither of the two that **speed it
up**:

| | Says | Carried as | Read by |
|---|---|---|---|
| `npRegen` | *"NP Cooldown is reduced by an extra X per Turn"* | `StatDelta` on `stat: "npRegen"` | nothing |
| `npCooldownRegen` | *"reduced by 1 Turn at the end of every Turn"* | `periodic: { kind: npCooldown }` | nothing |

The first lands in `unit.statDeltas`, which is **not** projected onto the unit as a field — so there
was no `unit.npRegen` to read, and nobody read the bucket either. The second declares a periodic
whose `kind` appears **nowhere in the engine**; `PERIODICS` is damage-over-time only.

**Measured live on Semiramis across four Turn boundaries**: her Noble Phantasm's cooldown fell by
exactly **1** each Turn, whether `npRegen` was held or not. That is the ordinary tick — the buff
added nothing.

This one was hiding behind an easy mistake. A cooldown falls by 1 per Turn anyway, so *"it went
down"* looks like the effect working; only holding the buff and dropping it across two otherwise
identical Turns separates them. NP Regen's reduction had been recorded as untested for Medea and
Penthesilea, and that is exactly why.

Noble Phantasms only — both sheets say *"Noble Phantasm Cooldown"* — and the three effects that slow
one still win outright, `npLock` and `npDegen` included.

**Verified live, before and after**: no regen → **1**; `npRegen` at magnitude 1 → **2**.

### X. A `cooldown` phase ran twice on the attack path — **fixed 2026-09-16**

**Reached: every ability with a `cooldown` phase resolved through `resolveAttack`.**

`resolveAttack` runs an ability's caster-side phases **once, at declaration** — *"everything the
ability does to its USER, which the Combat Process has no rung for"* — and the post-damage loop in
`engine/attack.mjs` then handles what `CASTER_PHASES` deliberately excludes. `cooldown` was in
**both**.

The loop's handling is the richer one, and the reason it must be the owner: `splitCooldownRider`
separates changes aimed at the **defender** (once per Process) from the caster's **own** (once per
Combat Phase, gated on `isFirstOfGroup`). Declaration cannot make that distinction, because no
defender exists yet — so it ran every change, and the loop then ran the caster's again.

The comment standing beside that loop already records the identical bug being fixed for `summon`:
*"Adding a second `case "summon"` here double-conjured Bašmu: one from that call, one from this
loop's own afterDamage pass, found live the moment two appeared from a single cast."*

**Measured live on Semiramis's *Familiar Doves***, whose clause is *"reduce Semiramis' NP Cooldown
by X Turns, where X = number of enemy Units with the 'Dove' effect (max 1◈)"*. Two enemies carried
the Dove, so X = 2 — and her Noble Phantasm's cooldown fell by **2 at declaration and 2 more on the
first advance**, a total of **4**, with no Turn boundary and no fan. The same ability through
`useSkill`, which runs each phase once, reduced it by exactly **2**.

That 4 is what made it findable: it **exceeds the ability's own stated cap** of 1◈, which is 3. A
doubled figure inside the cap would have looked like a generous roll.

`CASTER_PHASES` no longer lists `cooldown`; the Skill path is unaffected, because `runPhases` runs
every kind. **Verified live**: 0 at declaration, **2** in total.

### Y. The resolved summon variant never reached the board — **fixed 2026-09-16**

**Reached: the whole of Semiramis's sheet.** She is the only Servant in the corpus authored with a
`summonVariant` block, and six of her abilities fork on which branch she was summoned as.

Three places agree on where the answer lives:

| | Says |
|---|---|
| the schema | `system.variant` — *"the RESOLVED result of `summonVariant`, once and for ever from summon"*, *"read as a roll option (`self:variant:<id>`)"* |
| the writer | `engine/summon.mjs` sets `patch.variant = variantId` at commit |
| `rules/options.mjs` | `if (unit.variant) options.add(…)` |

`rules/snapshot.mjs` read **`sys.summonVariant?.variant`** — the *authored* block, `{ heads, tails }`,
which has no `variant` key. So the projection was `null` for everyone and **`self:variant:` was
never true for anybody**.

The comment above that line already named the blast radius, having found the bug once before and
moved the read to the wrong side of it: *"the Hanging Gardens' own requirement, both Sikera Ušum
branches, Summoning: Bašmu, Territory Creation's EX-versus-C rank, and Double Summon's clause 3.
With every branch false her signature Noble Phantasm refused itself."*

**Measured live.** A Semiramis summoned onto the `dsc` branch — `system.variant` reading `"dsc"`,
her **Range correctly overridden to 3** by that same branch's `overrides`, so the coin flip plainly
resolved — whose projection carried `variant: null`, emitted **no** `self:variant:` option, and
refused *Summoning: Bašmu* with `reason: "predicate"`.

**A correction this forces.** Earlier in her audit I recorded Double Summon's clause 3 — *"if
Semiramis does **not** have the DSC Skill, she gains the DSC buff"* — as correctly declining to
fire. It did decline, but not for the reason I gave: its gate is `self:variant:noDsc`, and **every**
`self:variant:` test was false. The right answer by accident.

**Verified live**: `variant: "dsc"` on the projection, `self:variant:dsc` emitted, and Summoning:
Bašmu accepted.

### Z. A channelled Noble Phantasm charges its Master and never channels — **fixed 2026-09-16**

**Reached: Semiramis's Hanging Gardens of Babylon**, the only channelled ability in the corpus.

Her sheet is explicit on both halves: *"Semiramis has to be within her Home Base, and cannot Act for
3◈ Turns … the Hanging Gardens of Babylon is activated at the end of the last Turn in that period.
Semiramis' Master only loses Health as per NP usage rules **only when HGoB successfully activates,
not at the start** of the NP activation process."*

`engine/channel.mjs#startChannel` was called from **one** place — `skill-use.mjs`'s phase runner —
and `channel` is not in `CASTER_PHASES`, so `resolveAttack` never ran the phase. `useSkill` also
suppresses the ability's cost when a channel starts (`!applied.channelStarted`); `resolveAttack`
had no equivalent and billed at declaration.

**Measured live, both paths, same ability and same state:**

| | Master | Channel |
|---|---|---|
| `useSkill` | **198 → 198**, charged nothing | started: `ticksRequired: 9` (3◈), `onComplete: activateHangingGardens` |
| `resolveAttack` | **198 → 98**, charged 100 | none |

It is `kind: noblePhantasm`, and the sheet's own button routes every ability through
`resolveAttack` — so a player clicking her signature Noble Phantasm paid 100 of their Master's
Health and got nothing at all. The fourth member of the family §46.4-M, §46.4-P and §46.4-T belong
to: *the two use paths do not do the same thing*.

**Three halves, not two.** The plan recorded here when it was filed — put `channel` in
`CASTER_PHASES`, then teach the cost flow the `channelStarted` suppression — was wrong on the first
and incomplete on the second.

1. **`channel` must NOT join `CASTER_PHASES`.** That pass runs *after* the damage and after
   `payAbilityPrice`, and a channel's entire effect on the cost flow is to defer it — so run there
   it would start a channel that had already been billed for. It needs its own pass **above** the
   price: `runCasterChannel` in `skill-use.mjs`, called from `payAbilityPrice` when
   `hasChannelPhase` says there is one. The suppression then gates both the cost and the cooldown,
   on `channelStarted` rather than on `hasChannelPhase`, because a unit already channelling starts
   nothing and a declaration that earns no deferral pays like any other.

2. **And the declaration interrupted the channel it had just started.** This is the half nothing in
   the paper trace suggested, and it would have made the first fix look like it had failed. The
   Gardens' targeting is `{ anchor: self, shape: unit, selection: { relations: [self],
   includeSelf: true } }` — Semiramis is always in her own `targetIds`. `resolveAttack` fires
   `interruptChannels(targetIds)` at line 375 for *"if Semiramis is **Attacked** during this
   period"*, and `payAbilityPrice` runs at line **268**. So the channel started, and a hundred lines
   later the same declaration wiped it. Measured: cost correctly suppressed, `system.channel` null.
   Being the subject of your own Noble Phantasm is not being Attacked, so
   `interruptedByDeclaration` drops the declarer and keeps everybody else — an area that catches
   three enemies mid-channel still interrupts all three.

**Verified live, end to end, through `resolveAttack`:**

| | |
|---|---|
| At declaration | channel started, `ticksRequired: 9`, `onComplete: activateHangingGardens`; Master **250 → 250**; no cooldown |
| Her Turns 1–8 | `elapsedTicks` climbs 1 per Turn — her faction's own Turn-ends, not the global tick |
| At Turn 9 | channel completes; Master **250 → 150**, exactly the 100 the rank-EX cost says, paid only on success |
| `onComplete` | the `Hanging Gardens of Babylon` platform actor created at her panel, elevation 20, with Semiramis aboard |

**One thing deliberately left as it is.** `canUseAbility` still refuses the declaration when the
Master cannot afford the cost — *"the Servant cannot use its Noble Phantasm if its Master's Health
is equal to or less than the amount that would be lost"* — even though the payment is deferred.
Dropping that gate too would let a Master be killed three Turns later by a channel they could never
have paid for, which is worse than the refusal and is not what the sheet asks for: its clause is
about *when Health is lost*, not about when affordability is checked. Noticed because the rolled
Master in the test war had a maximum of 80 against a rank-EX cost of 100 and could never have fired
her signature Noble Phantasm at all — which is a weak Master, not a defect.

### AA. A summon variant's `overrides` do not survive a world load — **fixed 2026-09-16**

**Reached: Semiramis**, the only Servant with a `summonVariant` block.

`engine/summon.mjs#sheetPatch` merges the chosen branch's `overrides` into the actor at commit
(`Object.assign(patch, branch?.overrides ?? {})`), and for the `dsc` branch those are a **Range of
3**, a **range-banded normal attack** (STR at 1–2, MAG at 3+), and **4◈ Sustainability**.

**The cause is not data preparation**, which is what this entry claimed when it was filed. Two
measurements settled that, and they are worth keeping because the first one is the trap:

- Writing `range.panels: 3` and `sustainability: 4◈` onto the live actor and calling
  `prepareData()` — the values **stayed**, prepared and persisted. Nothing reverts them
  continuously.
- Building a **fresh** Semiramis through `commitWar` — `variant: "dsc"`, Range **3**,
  Sustainability **4◈**, `normalAttack: rangeBanded`, all three correct *and* present in
  `toObject()`. Reloading the page — Range **2**, **2◈**, `fixed`, persisted.

It is the **content sync**. `migration/runner.mjs` reconciles every world actor against its pack
template on every world load, and the template is Semiramis's un-varianted sheet. `reconcileSystem`
already keeps `summonVariant.variant` through that — `SUMMON_VARIANT_OWNED_BY_WORLD` — but the
branch's overrides land on **top-level** keys (`range`, `sustainability`, `normalAttack`), and every
one of those is the pack's. So the flip survived and its entire consequence did not.

| | Branch says | Document held after one reload |
|---|---|---|
| Range | 3 | **2** |
| Normal attack | `rangeBanded`, two bands | **`fixed`**, no bands |
| Sustainability | `4◈` | **`2◈`** |

A Servant claiming a variant while carrying none of it is worse than either honest state, and it was
invisible because the two sheets differ by three fields nobody re-reads after summon. Distinct from
§46.4-Y, which was the *id* not reaching the snapshot; this is the *overrides* not surviving a load.

**The fix** is `applyVariantOverrides` in `migration/content-sync.mjs`: after the pack's keys are
taken, a world actor with a resolved `variant` has that branch's overrides re-applied over them. The
branch spec is read from the **pack**, never from the world's baked copy, so editing what a variant
*does* is still a content update and reaches a summon already standing on a board; only the keys the
branch actually names are touched.

**Verified live.** The already-corrupted Semiramis **healed herself on the next load** — Range 3,
4◈, `rangeBanded`, all persisted — and stayed that way across two further reloads.

### AB. The scheduler's boundary claim could freeze the match permanently — **fixed 2026-09-16**

**A regression introduced by §46.4-D's own fix**, found while waiting for Semiramis's channel to
tick and worth more than the clause that exposed it.

§46.4-D gave each scheduler boundary a claim, because `game.users.activeGM?.isSelf` elects a *user*
and is true for every connection that user holds — two tabs on one Gamemaster both ran the whole
turn-end sequence. That is real, and it was measured as Mad Enhancement draining 40 where the sheet
says 20. The claim was keyed on `system.globalTurn`.

**`globalTurn` is advanced by the very sequence the claim guards**, at `scheduler-hooks.mjs` line
162, a hundred lines below the claim at line 53. So anything throwing in between — and the endTurn
sequence is the most failure-prone path in the system — left the claim written and the counter
where it was. Every later boundary then read the same tick, found `claim.turn >= tick`, and refused.
**Nothing in the match ever ticked again**: no drains, no periodics, no expiries, no cooldown
advances, no channel ticks, no Turn budget reset.

**Measured live**, after fourteen Turn changes on the Semiramis board:

```
globalTurn:    0
scheduleClaim: { turn: 0, token: "PP9RrW7AXI5R3qoc", round: 8 }
channel:       { ticksRequired: 9, elapsedTicks: 0 }
```

— with `combat.round` at **9**, because the round scale has its own key and was still advancing. A
match that looks like it is running and is not.

**The fix** is to stop keying the claim on our own derived counter. `rules/schedule-claim.mjs`
names a boundary by its own identity — `boundaryKey` gives `"r3t1"` for a Turn and `"r3"` for a
Round — from Foundry's `round` and `turn`, which it advances *before* firing `updateCombat` and
which do not depend on our sequence succeeding. The election is unchanged: both connections still
write a token, the server still serialises them, and whichever token survives proceeds.

**No migration is needed**, and this is why the key is a string: `alreadyClaimed` compares with
`===`, a number is never equal to a key, so a world frozen by the old shape thaws on its next
boundary. **Verified live on the frozen world above** — one Turn change and `globalTurn` went
**0 → 1** with the claim rewritten to `{ turn: "r10t0", round: "r9" }`, then the channel ran its
nine Turns to completion.

The general lesson, and the third entry in §46.3's collection: *a guard must not be keyed on state
that only the guarded work produces.* It is a deadlock with a single writer.

### AC. Every field's `actedTurnEnd` event was dead — **fixed 2026-09-16**

**Reached: Semiramis's Sikera Ušum, clause b.** *"When a Unit other than Semiramis or her Master
Acts then ends its Turn within the NP area, it is inflicted with Poison."*

It is authored exactly right — an `interiorEvents` entry on `actedTurnEnd` with `requiresActed:
true`, `relations: [ally, enemy]` and `excludeOwnerMaster: true` — and `runFieldEvent` filters on
`u.acted`. The dispatcher is the problem.

`onTurnChange` builds a board at the top (line 55), runs `scheduler.endTurn` against it (line 83),
and dispatches the field events afterwards (line 101) — and `runFieldEvents` called
`currentBoard()` **again for itself**. By that point the sequence has cleared the turn state, so
the board it built reported `acted: false` for every Unit on the map and the filter matched nobody.

Mad Enhancement's drain fires on the same event and was never affected, which is exactly why this
survived: it is dispatched from *inside* `scheduler.endTurn`, off the `actedUnits` list the hook
captured at line 58 — before the reset. So `actedTurnEnd` looked alive on every board it was ever
watched on.

**Measured**, with a console probe at the dispatch, a live field and a Servant standing in it whose
`acted` and `turnState.tick` had been set a moment earlier:

```
[FGTDBG] actedTurnEnd semiramis-sikera-usum produced 0
         units …:acted=false:f=0, dKYxPs:acted=false:f=1, …
```

`dKYxPs` is Heracles — inside the field (`f=1`), acted, and reported to the filter as idle. After
the fix, the same probe on the same board:

```
[FGTDBG] actedTurnEnd semiramis-sikera-usum produced 1 passedBoard true
         units …, dKYxPs:a=true:f=1, …
```

**Two clauses in the corpus were affected and both were inert**: Sikera Ušum clause b, and the
acted half of Jack's Mist (*"at the end of its Turn **or at the end of a Turn they Act** while
still within the Mist"*) — whose plain `turnEnd` half was the subject of its own earlier fix and
which is dispatched from the same place.

**The fix** is to stop re-deriving the board. `runFieldEvents` takes an optional `board`, and the
boundary hook passes the one it already holds — the same board `endTurn` itself ran against, and
the same one `ctx.actedUnits` came from, so the field's view of who acted and the scheduler's are
now one view instead of two. `currentBoard()` remains the default for the contact path, which is
mid-move and wants the freshest read it can get.

A near relative of §46.4-AB: not a guard keyed on the work it guards, but a *reader* re-deriving
state the work had already consumed. Turn state is documented as stale-by-reading; the cost of
reading it twice is that the second read is of a different Turn.

**What is still unverified** on this Noble Phantasm, and recorded rather than implied: rules a, c, d
and e. All three interior rules (`ImmunityDowngrade`, `VulnerabilityAmplifier`,
`PeriodicOverride`) are present and correctly shaped on the live field and clause b emits its
`applyEffect` intent — but none of the three was ever *observed changing a number*, which is the
only standard §46.1 accepts. They remain unverified, and — like every Clause in the roster — are
`Untouched` until her audit is run.

**A measurement error worth keeping**, because it cost most of an afternoon and would cost it again:
effect instances are **ActiveEffects** (`CONFIG.ActiveEffect.dataModels.fgtEffect`), not embedded
Items. Reading `actor.items.filter(i => i.type === "fgtEffect")` returns `[]` for a Unit carrying a
dozen of them, and `createEmbeddedDocuments("Item", [{type: "fgtEffect"}])` **succeeds silently and
creates nothing**, because `fgtEffect` is not a registered Item subtype. Four separate clauses were
briefly believed broken on that basis — Sikera Ušum's rule b, Arrogant King's Poison's two effects,
and the Hanging Gardens' owner buff — and all four were working the whole time. Read
`actor.effects`. §46.2 has it now.

### AD. `stage: flat` had no reader, so Territory Creation multiplied instead of adding — **fixed 2026-09-16**

**Reached: Semiramis's Territory Creation**, and it belongs to every bearer of the Skill.

> *"When this Unit is in its Home Base, all damage dealt by it is increased by 6d20, including NP."*

Dice **added**, which is stage 7 — where Divinity's +50 goes. Every Territory Creation in the corpus
says exactly that: `DamageModifier` with `stage: flat` and a `rollTable`/`roll` of
`6d20 / 5d20 / 5d10 / 5d8 / 5d6 / 5d4` by rank.

`DamageModifier`'s executor never read `stage`. It always pushed `atkUp`, which the pipeline reads
at **stage 4 as a percentage** — so the dice were rolled, and then applied as a percent.

**Measured live**, Semiramis in her own Home Base at rank C (`5d8`), four Normal Attacks:

```
Atk Up Territory Creation   +25%   +15%   +17%   +16%
```

A varying 5d8 in the percentage bucket. At EX it is `6d20`, so a Servant in her own Territory dealt
up to **+120% damage** where her sheet grants a flat +120 — an error that scales with Base Attack
instead of being constant, and worth roughly double at a 200 Base Attack.

It had never been caught because the clause needs a Home Base, and §46.11 records Medea's two
Territory Creation passives as untested for precisely that reason.

**The fix** gives `stage` a reader: `stage: flat` routes to `flatDamage` (or `flatReduction` when
the clause is about damage *taken*), which are the generic members of the pipeline's own
`FLAT_ATTACK_KEYS`/`FLAT_REDUCTION_KEYS`. An explicit `modifierKey` still wins.

**And one piece of content had to be corrected with it.** `vorpal-blade.yml` carried `stage: flat`
on two rules whose own comments say *"they belong in the same combined-percent bucket, where 3x is
+200%"* — it had the behaviour it wanted only because the field was inert. Both `stage: flat` lines
are gone; the rules are unchanged otherwise, and +50%/+200% stay percentages. A test fixture in
`bounded-fields.test.mjs` had the same shape and was aligned to the Labyrinth's real content, which
authors no `stage` at all.

**Verified live.** Stage 4 no longer mentions Territory Creation; stage 7 now reads
`flatDamage Territory Creation +20 / +30 / +21`, a 5d8 added beside Divinity's +30. Her defensive
half was confirmed on the same board: stage 12 shows `damageNegation Territory Creation −30`, a
3d10+10 for an ally standing in their own Home Base.

### AE. A Shield of 200 that absorbed nothing — **fixed 2026-09-16**

**Reached: Semiramis's Scales of the Sacred Fish**, and the sixth member of §46.4-M/P/T/Z/AB's
family: *the two use paths do not do the same thing*.

> *"Used at the start of a Combat Phase when Semiramis or an allied Unit within a 2 panel area of
> herself is Attacked; the Unit gains the Shield (200) buff for 2◈ Turns."*

Everything about it was right except who called it. `scalesShield` declares
`absorbs: { poolFrom: sourceAbility }`, the ability declares `shield: { health: 200 }`, `barrierOn`
finds the item — and `refreshShield` carries a tested default, *"a fresh 200 on every cast"*, whose
own comment says it was **added for this Servant**.

`refreshShield` had exactly one caller: `engine/attack.mjs`'s `payAbilityPrice`. Scales of the
Sacred Fish is `countsAsAttack: false` on a `whenAllyAttacked` window — deliberately, because an
earlier fix routed it off the attack path so it would stop spending her Attack and opening a Combat
Process against the ally it shields. So it goes through `useSkill`, and the pool was never filled.

**Measured live**: Semiramis cast it on herself, took an ordinary Normal Attack, and went
**750 → 733** while holding the buff, with `system.shieldHealth: **0**` against a declared 200.

**The fix** is one line in `useSkill`, placed where the attack path puts it — before `recordUse`,
because `refreshShield` reads `timesUsed` to tell a first projection from a later one.

**Verified live**: the cast fills the pool `0 → 200`, and the next Normal Attack leaves her Health
at **733 → 726** while the pool goes **200 → 0**. Seven points of overflow past a 207-damage hit,
and 200 absorbed.

### AF. `damageStepEnd` asked the attacker a question only the board could answer — **fixed 2026-09-16**

**Reached: Sikera Ušum rule a.** *"Semiramis' Normal Attacks which use Base Attack (STR) inflict
Poison."*

It is an `OnEvent` on `damageStepEnd` predicated on
`["self:inField:semiramis-sikera-usum", "attack:kind:normal", "attack:component:str"]`, and the
ability's own comment records that `self:inField:` had to be added to `DEFERRED_PREFIXES` because it
is *"a board annotation, unknowable at `contributionsOf`'s actor-only pass."*

Deferring the predicate was right and not enough. `fireDamageStepEnd` built **both** subjects with
`unitSnapshot(actor)` — which is exactly the actor-only pass the comment warns about. A snapshot has
no `fields`, so the deferred predicate was evaluated against an option set that could never contain
`self:inField:`, and the clause failed on every attack she ever made.

**Measured live**, Semiramis standing in her own Throne Room:

| subject | `fields` | emits |
|---|---|---|
| the board's unit | `["semiramis-sikera-usum"]` | `self:inField:semiramis-sikera-usum` |
| `unitSnapshot(actor)` | **absent** | nothing |

**The fix** builds both subjects with `unitFrom(board, doc) ?? unitSnapshot(doc)`, from a board
computed once and reused for the event context — the defender too, because the event fires on the
attacker but half of what a rider asks is about who was hit.

**Verified live**: the same Range-1 `BA(STR)` Normal Attack from inside the Throne Room now leaves
`poison` at stage 1 on the defender. Before: nothing, ever.

The third of a family — §46.4-V (a hand-assembled subject answering `null` for `stance`), §46.4-AC
(a rebuilt board that had forgotten the Turn), and this. *A snapshot is not a board, and a board
question asked of one is answered "no" rather than refused.*

### AG. An immunity that could not be downgraded — **fixed 2026-09-16**

**Reached: Sikera Ušum rule d.** *"When a Unit with Poison Immune effects is in this NP area, the
Poison Immune effect is reduced to a Poison Resist effect, the chance of being inflicted with Poison
is reduced by 75%."*

Every piece existed. `ImmunityDowngrade` produces a suppression, `annotateFields` writes it onto the
units standing in the area, and `effect-applier.mjs`'s `immunityDowngradeFor` reads
`target.suppressions` at the immunity gate and lets the application through when one matches — with
a comment naming this very clause as its reference case.

The intent path built its subject with `unitSnapshot(target)`. Suppressions are a **board**
annotation, a snapshot has none, so the downgrade was never found and the immunity blocked
absolutely. `resistOf` reads `unit.suppressions` for the clause's other half — *"Units with Poison
Resist effects that are not Poison Immune in this area have the magnitude of those Poison Resist
effects halved"* — so both halves were dead for one reason.

**Measured live with real content on both ends.** Hassan of Serenity (*"Serenity is Immune to Poison
and Deadly Poison"*, authored as `Immunity: [poison, deadlyPoison]`) was summoned into the Throne
Room and hit repeatedly by Semiramis's `BA(STR)` Normal Attack, which inflicts Poison inside the area
by rule a:

| | Poison landed |
|---|---|
| before the fix | **0 of 14** |
| after the fix | **3 of 14** (21%) |

The sheet predicts 25%. A run of 0/14 at p=0.25 is a 1.8% outcome, and her board row carried the
suppression in full the whole time while `immunities` still read `["poison", "deadlyPoison"]`.
The suppression is present only while she stands inside: `suppressions: 1` in the Throne Room,
`0` out of it.

**The fix** is the same shape as §46.4-AF, one layer down: `unitFrom(board, target) ?? unitSnapshot(target)`,
with the board built **once per batch** rather than once per intent — `applyIntents` walks every
effect in a batch and `currentBoard()` assembles the whole map.

**Rule e has no content to press.** *"Units in the NP area who are weak to Poison receive double
Poison Damage"* needs a Unit weak to Poison, and nothing in the corpus declares a weakness of any
kind — `weakTo`/`weakness` appear nowhere in `packs/_source`. `VulnerabilityAmplifier` is correctly
shaped on the live field and is recorded as unexercised rather than working.

### AH. An `ApplicationChance` scoped to nothing — **fixed 2026-09-16**

**Reached while authoring content for Sikera Ušum rule e**, by making the same mistake in a new
file and then finding it already in an old one.

`ApplicationChance`'s executor reads `el.effect` — `effectId: el.effect ?? null` — and
`rules/authoring/elements.mjs` offers the same key. An element authored with `effectId:` therefore
resolves to a **null** scope, and `chanceContribution`'s test is
`if (c.effectId && c.effectId !== def.id) continue` — a null scope matches **every** effect rather
than none.

`soaked.yml` had it. Clause (a) is *"when this Unit receives Ice damage, it has a 25% chance of
being inflicted with Freeze"*, and unscoped it raised the chance of **every debuff** landing on a
Soaked Unit under an Ice attack by 25 points. Silent, and generous — the same direction §46.4-J's
sign errors failed in.

Anastasia's own test asserted `r.effectId === "freeze"` against a file that said `effectId`, so the
pair agreed with each other and with nothing else. Both are corrected, and the guard is a corpus
walk rather than one assertion: `application-chance-key.test.mjs` fails if any authored
`ApplicationChance` anywhere in `packs/_source` uses the wrong key again.

### AI. Two contribution buckets that were collected and handed to nobody — **fixed 2026-09-16**

`collectContributions` fills a bucket per element kind and the snapshot projects them onto the unit
— `immunities`, `applicationChances`, `checkModifiers` and the rest are all listed explicitly. Two
were not: **`vulnerabilityAmplifiers`** and **`periodicOverrides`**.

Both reached a unit by exactly one route: `rules/bounded-fields.mjs`'s `annotateFields`, which
appends them from a **field's** interior rules. So the elements worked perfectly inside Sikera
Ušum's Throne Room and did nothing at all anywhere else — an ability or an effect contributing
either one was collected, projected nowhere, and read by no one.

**Van Gogh's *Channel Marker Soul* is the live casualty**:
`{ key: VulnerabilityAmplifier, effectId: curse, factor: 0.5 }` on an ability — a halving of Curse
damage that has never once applied.

Found the moment `weakToPoison` was authored: the new effect's own amplifier was collected and
absent from the board unit, while the field's sat beside it in the same list.

### AJ. A widened periodic ticked twice at a boundary that satisfied both its triggers — **fixed 2026-09-16**

**Reached: Sikera Ušum rule c**, on the second pass over it.

> *"Units inflicted with Poison while within this NP area receive Poison damage **at the end of its
> Turn and at the end of any Turn it Acts**, in addition to at the end of the Round."*

Three occasions, and two of them coincide constantly — a Unit acting on its own Turn is the
ordinary case. `endTurn` makes two `tickPeriodics` calls at one boundary,
`("turnEnd", every unit)` and `("actedTurnEnd", the ones that acted)`, and a widened instance
answers both. The `turnEnd` branch was already gated on `u.factionId === ctx.activeFactionId`,
which is *"the end of ITS Turn"* and correct. The acted branch had no matching gate.

So the **common** case took the tick twice and the **rare** one — acting during an enemy's Turn,
i.e. reacting — took it once, which is the clause upside down. Measured at stage 1: **40** where
§A.12's curve and `periodicDamageFor` both say 20, with a single instance and a single override on
the unit.

The cure reads like the sheet: *"any Turn it Acts"* means any Turn that is **not its own**, because
its own is already the first half of the sentence.

**Verified live**, six boundaries with the same stage-1 Poison inside the Throne Room:

| boundary | damage |
|---|---|
| its own faction's Turn, having Acted | **20** (was 40) |
| another faction's Turn, having Acted | **20** |
| the boundary that also rolls the **Round** | **40** — the round tick *plus* the acted tick, which is exactly what *"in addition to at the end of the Round"* says |

### AK. Presence Concealment hid a Unit from the rules and from nobody else — **fixed 2026-09-16**

> *"This Unit cannot be targeted for an Attack or an enemy Unit's Skill."*

The rules half has worked since the Skill was authored — §46.14.1b records an adjacent, in-range
attacker refused by name, *"Semiramis is concealed — it cannot be targeted directly"*. What nothing
ever did was hide the **token**. A concealed Servant sat on the canvas in plain sight of every
player, who could read its panel, its facing and its Health bar, and simply route around a Skill
they could see perfectly well was there. Concealment the table can see through is a rules footnote
rather than a Skill.

Raised by the game's author, with the reading to use: **invisible to non-allies**, the way
invisibility works in D&D 5e and Pathfinder 2e.

`rules/concealment.mjs#hiddenFromViewer` is the whole decision and is pure — it takes the unit, the
viewer and the faction roster rather than reaching for `game`, because the canvas asks it once per
token per visibility pass. Who still sees a concealed Unit:

- the **GM**, always — a token hidden from the one person who has to move it is a lost token;
- anyone with **OBSERVER** on the actor, which is how a player finds their own Assassin;
- the Unit's **own faction and its declared allies** — your side knows where it put the thing, and
  what concealment buys is that the enemy does not.

`apps/canvas/token.mjs` consumes it, and the shape matters: it overrides the **`isVisible` getter**,
not `_isVisible()`. Foundry 14 has no such method — `isVisible` is a getter on `Token.prototype`
with the ray-casting behind it in `CanvasVisibility#testVisibility` — so overriding the method older
versions had installs something nothing ever calls. It was written that way first and the live world
answered `super._isVisible is not a function`, which is the good failure: a silent one would have
been a fix that tested green and did nothing on a board.

A perception refresh goes with it (`engine/token-vision.mjs`). Foundry only consults visibility
during a pass, and applying an ActiveEffect does not start one — so without it the Servant stayed on
screen until somebody happened to move, and reappeared just as late.

**Verified by logging in as each user in turn**, which is the only way this one can be verified —
the GM sees everything by definition, so a GM-session check would have proved nothing. Semiramis is
faction-1 and owned by Player1; Heracles is faction-2 and owned by Player2; no alliances. Both
Servants adjacent on open ground, Heracles with vision range 2, so she is squarely inside his sight.

| viewer | before concealment | after concealment |
|---|---|---|
| **Player2** (enemy) | visible | **hidden** — and Foundry's own base getter still says `true`, so the override is doing it and not the fog |
| **Player1** (owner, same faction) | visible | **visible** |
| **Gamemaster** | visible | **visible** |

Heracles stayed visible to Player2 throughout, which is the control that says the scene had not
simply gone dark. Looked at on the canvas as well as read off the getter: Player2's board draws
Heracles with the panel beside him — hers — empty and lit.

**One measurement hazard cost a false negative on the way**, and it is in §46.2 now: Player1 first
reported not seeing her own Servant, which looked like the fix over-reaching. It was the test board.
Deleting the Hanging Gardens out from under both Servants left Semiramis's token stamped with the
**deleted platform's `level`**, so she was off-level for everyone and Foundry's own getter — not the
override — was refusing her. Asking `Object.getOwnPropertyDescriptor(Token.prototype, "isVisible")`
for the base verdict beside the override's is what separated them, and is the probe to reach for
whenever an override is suspected.

### AL. The whole `roundEnd` scheduler was dead — **fixed 2026-09-16**

**Mine, from §46.4-D, and the most consequential defect in this audit.**

§46.4-D gave each scheduler boundary a claim so two tabs on one Gamemaster could not both run a
sequence, and §46.4-AB re-keyed it on the boundary's own identity. Both were right. What neither
noticed is that the claim stored **one shared `token`** for two scales — and **a round change is
always also a turn change**, so `onTurnChange` and `onRoundChange` both run `claimBoundary` at the
same instant.

`claimBoundary` writes its token, settles, and reads back to see whether its own survived. The
turn's write lands last. The round's read therefore finds a stranger's token, concludes it lost the
election, and returns false — **so the round sequence never ran at all.**

Measured with a probe at the top of the hook:

```
[FGTDBG-ROUND] ENTER round= 42 sched= true started= true dir= 1 update= {"round":43,"turn":0}
[FGTDBG-ROUND] claim won= false
```

Everything downstream of `scheduler.endRound` was silently inert. That is not a corner: **Poison,
Burn, Freeze and Scald all name `roundEnd` as their own native trigger** (`PERIODICS`), so every
periodic in the game except the three `turnEnd` ones stopped dealing damage. So did HGoB
Construction's per-Round gain, the Round-scaled field upkeep, and every `OnEvent roundEnd` clause in
the corpus.

**How it hid.** The turn scale kept working perfectly, and it is the one that fires three times as
often — drains, cooldowns, expiries, turn budget. A board looks alive. And the audit's own Poison
work had been measuring Sikera Ušum's *widened* Turn-end ticks (§46.4-AJ), which come from the
`turnEnd` call and were never affected; the native Round tick was never separately asked until
Construction source 3 refused to fire.

**The fix** is a token per scale — `turnToken` and `roundToken` — so the two elections cannot
collide. A world holding the old single-`token` shape has neither, so both scales proceed once and
write the new one; no migration.

**Verified live** at a round boundary, with a control on either side of it:

| boundary | Poison (stage 1) | HGoB Construction |
|---|---|---|
| a plain Turn | 0 | 0 |
| a plain Turn | 0 | 0 |
| the Turn that **rolls the Round** | **20** | **+7** |

20 is §A.12's stage-1 figure and 7 is source 3's `1d4+2` plus Greece's adjacency bonus. Both were
**0** at every boundary before the fix.

*The lesson is the one §46.4-AB already stated and this is the second half of: an election needs an
identity per thing being elected. Two scales sharing one token is two elections sharing one ballot
box.*

### AN. Discover was offered to everyone, without limit — **fixed 2026-09-16**

Two rulings from the game's author, both narrowing what the engine did. §46.14.3 had left the first
as an open question and the second had not been noticed at all.

**Only Servants watch.** Presence Concealment clause 6 says *"an enemy **Servant's** Range (or
Detect)"*; Ch. 05 quotes the source's general rule as *"an enemy **Unit's**"*, and
`discoverAttempts` had followed the general one — it filtered on enemy-ness and distance and nothing
else. So a **Master** standing beside a concealed Servant rolled as readily as the Servant hunting
her. Measured live: two watchers at 35% each against a sheet that offers 35%, which is **58%** for
one step. The Skill's own wording governs.

**And a faction gets three attempts per Turn against one concealed Unit.** Not three per Servant —
three for the whole faction, spent in the order its Servants acquired the target, with no Servant
attempting twice against the same target in one Turn. The budgets are **per faction**: a second
faction that has never looked still has all three, however many the first has spent.

Without the cap, concealment was defeated by arithmetic rather than by play. A concealed Servant
walking past six enemies rolled six times, and at Semiramis's 35% that is a **92%** chance of being
found for a single step — so the Skill was worth least exactly where a player would most want it,
in front of a massed enemy line.

**Where the record lives.** `system.discoverBudget` on the **concealed** Unit —
`{tick, spent: {factionId: [watcherId]}, acquiredAt: {watcherId: tick}}`. All three facts are about
a *pair*, this Unit and one watcher, so one document carries them and it is discarded with the
concealment it belongs to. `spent` clears when the tick moves on; **`acquiredAt` does not**, because
*"order of arrival"* is about who found this Unit first and that is a fact across Turns, not within
one. Every enemy Servant in range is recorded, not merely the ones the budget can still afford —
otherwise the fourth watcher of a Turn would be treated as having arrived later than it did and
would keep losing its place in the queue.

An attempt is charged **whether or not it succeeds**: the faction looked.

**And the cap is a table setting**, `discoverAttemptsPerFaction`, asked for by the author and wired
the way `masterProtection` is: registered in `settings.mjs`, carried to Layer 2 on `board.rules`,
never read by the rules layer directly. `??` and not `||` in the fallback, because **0 is a legal
value** and means *"no Discover rolls at all"* — a table that wants Presence Concealment absolute.
Absence falls back to the rule as written, since every board built before the setting existed
carries no value for it. Verified live at 3, 5, 1 and 0 against the same four watchers: **3, 4, 1,
0** offered — 4 at a cap of 5, because the cap is a ceiling and not a quota.

**Verified live**, Semiramis concealed with four enemy Servants ringing her and an enemy Master
adjacent:

| | |
|---|---|
| Attempts offered | **3**, not 5 — and the **Master is not among them** |
| First `runDiscoverChecks` | 3 offered, the first succeeded, so **1** charged |
| Second | **2** offered — the remainder of the faction's three — both charged |
| Third | **0** offered. The faction is out for the Turn |
| `acquiredAt` | all **four** Servants recorded, at the tick they arrived |
| Next Turn | **3** offered again; `spent` cleared, `acquiredAt` kept at its original ticks |
| The setting at 3 / 5 / 1 / 0 | **3 / 4 / 1 / 0** offered — 4 at a cap of 5, because only four enemy Servants were in range |

### AO. A war fought in no Region inherited the previous war's — **fixed 2026-09-17**

**Reached: every war whose draft names no Region**, in any world that has ever run one that did.

`currentWarRegion()` is `game.combat?.system?.region || setting("region")`, and a match that states
no Region stores `null` — which is falsy, so it falls straight through to the world setting.
`commitSummon` has written that setting on every summon since it was written, so once any Region war
has been run the value is sticky, and `commitWar` wrote only the match.

**Measured**: a draft with `region: ""` built a war whose own record said Region *none* and whose
board played **Greece** — Asterios at STR/END **EX--** instead of A++, Max Health **1800** instead
of 1700, Achilles 1600 instead of 1500. Nothing said so; the wizard's record said the Region was
none. Every damage figure measured against a printed sheet number would have been wrong by a rank.

`commitWar` now records the draft's Region through `setWarRegion` **before** anything is summoned,
so the match, the setting and the board agree. Fixing the precedence instead would have been worse:
`prepareSummon` reads the setting too (`region ?? setting`), so a board-only fix would have left the
summon grants wrong while making the Ranks right. One writer, at the one moment the Region is
decided. **Verified**: the same draft now builds A++/A++, 1700, `setting: ""`, `warRegion: null`;
and a draft naming Greece builds all three agreeing on `greece`.

### AP. No bounded field's interior rules reached the movement gate — **fixed 2026-09-17**

**Reached: every field with an `interior` MovDelta** — Ch. 28's whole interior axis.

`engine/movement-hooks.mjs#onPreMove` validated against `unitSnapshot(actor, document)`, which runs
the unit's own contributions and stops. The bounded-field pass belongs to `snapshotBoard`, because
whether a Unit stands inside a field is a fact about the board rather than about the Unit — so the
one gate that rations movement could not see a single field's interior rule.

**Measured live in Asterios's own Chaos Labyrinthos, in both directions:**

- *"Asterios' MOV is increased by 4 while within the Labyrinth"* — the board said **8**, his actor
  sheet said **8**, and a five-panel path was refused: *"This path is 5 panels; 4 remain of MOV 4."*
- *"The MOV of all enemy Units within the Labyrinth is reduced by 2 (minimum MOV=2)"* — EMIYA, whose
  board MOV inside was **2**, walked **3** panels and the mover allowed it.

The second is the one that matters: a trap that does not slow anybody is the whole of what the
clause is for. `movementAllowance`, the HUD's reader, was blind the same way and is fixed with it —
the gate and the display now answer out of one shape, which §46.3 lists as its own defect class.

### AQ. A bounded field trapped its own owner — **fixed 2026-09-17**

**Reached: every field whose `enemyExit` is stricter than `free`.**

`membershipVerdict` split the relation two ways — `relation === "ally" ? "ally" : "enemy"` — and
`relationTo` answers **`self`** for the field's owner. That third relation was added so
`relations: [self]` interior rules could find the one Unit they are written for, and this line was
never updated, so `self` fell to the `enemy` branch.

**Measured live** with `allyExit: free` and `enemyExit: rollRequired` authored: Asterios's **Master**,
standing beside him inside the Labyrinth, walked out free; **EMIYA** was held to the 20% roll; and
**Asterios himself** was refused — `{ok: false, reason: "rollRequired"}`, the step out rejected by
`blockedByFieldExit`, and the action bar offering him the escape ladder his own Noble Phantasm
offers his victims. The only way out of the trap he built was to roll against it.

Sikera Ušum's Throne Room is unaffected: `trappedAtActivation` answers by id above this branch,
which is the whole reason that case is stated separately.

### AR. The veteran clause's MOV exemption had no reader — **fixed 2026-09-17**

**Reached: Chaos Labyrinthos**, the only field authoring `veteranBonus.noMovPenalty`, and the shape
Ch. 28 defines for any that follow.

Clause 9's third part — *"…and its MOV is also no longer halved within the Labyrinth"*, granted to a
Unit that has escaped once and to *"all allied Units directly next to"* it — was authored, carried
through the schema, and read by nobody.

**Measured live**: Achilles, `escapeHistory {escaped: true}`, back inside the Labyrinth, read MOV
**5** against his own 7 — exactly what a first-time prisoner reads. **After**: Achilles **7**, and
EMIYA, standing adjacent to him inside, **4** — both at their base MOV, while a non-adjacent ally
stays slowed and the owner's own `relations: [self]` bonus is untouched.

`veteranStatus` is now the one reading of "veteran", used by the escape ladder and by the interior
rules, so a second spelling cannot drift from the first.

**This settles the ambiguity the clause list flagged.** Clause 3 says *"reduced by 2 (minimum
MOV=2)"* and clause 9 says *"no longer halved"*. No halving is stated anywhere in the Noble Phantasm
and clause 3 is the only MOV penalty it has, so the two sentences are about the same penalty:
clause 9 switches off whatever clause 3 imposed, however the sheet spells the number.

### AS. Mad Enhancement's clause 5 never charged anybody — **fixed 2026-09-17**

**Reached: all six Mad Enhancement bearers.** Two independent faults on one clause, either enough.

**The rule and its only caller passed each other.** `onMasterDefeated` asks *"was Mad Enhancement
active when the Master died?"* by walking `servant.abilities` for a `slug`/`active` pair — it was
moved there because `modes` was a field nothing wrote, and its own comment says so. `engine/io.mjs`
still built `modes` and never started building `abilities`. **Measured live**, the same Servant side
by side: called the way io calls it the function returned `setContract` and `lockModes` and nothing
else; called with `abilities` it returned those and the Sustainability charge.

**And the charge was in the wrong denomination.** `servant.sustainability` is the RESOLVED clock in
**Turns** — 6 for a 2◈ Servant at three Turns to the Round, and the function's own guards exist to
insist on that — while the descriptor carried a bare `delta: -2`. The sheet says *"reduced by 2◈
Turns"*, which is six.

**Measured live, before and after**: before, the Master died with Mad Enhancement active and
`sustainabilityRemaining` stayed `null` with the clock at **6**; after, the descriptor reads `-6`
and a 2◈ Servant reduced by 2◈ reaches exactly **0**.

### AT. A mode's lockout only ever started on the way ON — **fixed 2026-09-17**

**Reached: every mode carrying `toggleLock`** — the six Mad Enhancement bearers and Mannanán's
Holder Mode.

*"…it can only be deactivated 2◈ Turns after it was activated, **and vice versa**"* is two symmetric
waits off one clock that restarts on every flip. Both writers — the sheet's toggle and `io.setMode`
— stamped `toggledAt` on activation only, so the second half was not enforced at all.

`rules/modes.mjs#canToggleMode` has read the lockout correctly since it was written and its unit
tests prove it refuses either direction inside the window. They hand it a `toggledAt` directly,
which is the one thing the writer was getting wrong — the gate was right and the clock it reads was
never wound.

**Measured live**: active since tick 10, switched off at tick 40 (permitted, thirty Turns elapsed),
`toggledAt` still reading **10**, and `canToggleMode` answering `{ok: true}` to switching it straight
back on in the same Turn. Past its first 2◈ the mode was a free toggle for the rest of the match.
**After**: the switch-off restamps the clock and the very next click is refused in the interface —
*"Mad Enhancement was switched too recently — 6 more turn(s)."*

### AU. `@magnitude` was substituted for a value and not for a chance — **fixed 2026-09-17**

**Reached: two shipped effects** — `Bleed Atk` and `Terror` — and any authored the same way.

`rules/snapshot.mjs#resolveRuleValues` resolved `value` and `npValue` against the effect instance and
nothing else. A magnitude is not always a modifier's size: Appendix A's on-hit riders put it on a
**chance**. `Bleed Atk` is the one-line `effect: { id: bleed, chance: "@magnitude" }`, and `Terror`
carries the same reference on the Stun in its `then` list. Both kept the literal string all the way
to the scheduler, which gates on a number and refuses what it cannot read.

**Measured live** with the chance staged to 100: the `damageDealt` event fired, the handler was
present with its `attack:kind:normal` predicate satisfied, `pendingRolls` emitted **no die at all**,
and `fireEvent` returned a log entry and no intent. `engine/attack.mjs#fireDamageDealt` exists
precisely so that *"every on-hit rider in the catalogue"* works, and it was raising the event for
handlers that could not act.

**After**: the chance resolves, `pendingRolls` emits `chance:<unit>:ApplyEffect:bleed` as `1d100`,
the intent is produced, and the Bleed lands on the victim with an expiry exactly 1◈ out. The
substitution reaches `chance` on a rule, on the effect an action applies, and on each entry of a
`then` list — named carriers only, because a general deep walk would start rewriting predicates and
effect ids that merely happen to contain the same text.

### AV. A Region override moved the field and not the area that debuffs it — **fixed 2026-09-17**

**Reached: Chaos Labyrinthos**, the only content with a `regionSizeOverride`, and any ability whose
targeting and field are meant to name one area.

The Noble Phantasm states its area **twice** — `targeting.shape.size: 9`, for the Units its
activation debuffs reach, and `field.geometry.shape.size: 9`, for the Labyrinth those Units are
trapped in — and only the second carried the override. The sheet states it once, and says outright
that they are the same thing: *"Affects a 9x9 panel area around Asterios when used, **this NP area
will now be termed as the 'Labyrinth'**; if the Region is Greece, it affects an 11x11 panel area
instead."*

**Measured through the real control, in a Greece war**: the confirmation dialog read *"1 target(s) ·
**81 panel(s)**"* and the Labyrinth it opened measured **121**, rows and columns 3–13. **After**: the
same dialog on the same board reads *"1 target(s) · **121 panel(s)**"*.

`engine/fields.mjs#regionSizedTargeting` applies the field's own override to a targeting block that
names the field's own area, and refuses to touch one that does not — an ability whose targeting
differs from its field is stating two areas on purpose. Applied at the two Layer 3 call sites that
hold the board rather than inside the pure `targetSpecFor`, which has no war Region and whose
signature every ability in the game shares.

### AW. A refused Attack reaches the console and nobody else — **open, #74**

**Reached: every Unit, on every second attack attempt in a Turn.** `rules/budget.mjs#canConsume`
refuses correctly — *"this unit has already attacked this turn"* — and `engine/attack.mjs:145` turns
that verdict into `throw new Error(...)`. The rejection is logged and swallowed.

Meanwhile the action bar leaves **Attack enabled**, beside slots it correctly greys with a reason,
and the targeting session it opens reports **`✓ Legal — click to confirm`**. Confirming does
nothing: no card, no notification, no change on the board. The only trace is a `console.error`.

The comment ten lines above the throw states the opposite intent — *"a player who has no attacks
left is **told** that rather than being told their target is out of range"* — so this is the case
where the code's own stated purpose is the specification it fails.

Found on Semiramis pressing `HGB.c6`, because Gather is the one action that spends a Unit's Attack
without looking like an attack, which makes pressing Attack afterwards the natural next move. **The
rule itself binds**; only its visibility is broken, which is why the Clause is still proven.

§46.3 shape: **the gate and the display disagree**, in the direction where the player believes the
display.

---

## 46.5 The per-Servant checklist

§46.1's procedure is the *order*; this is the list of things to have looked at while running it.
Run all of it. An item that is obviously inapplicable is still an item you looked at.

**Statblock**
- [ ] Parameters, Base Health, MOV, Range/targets, Base Attack, Sustainability, alignment, region, attributes all match the sheet.
- [ ] Base Health derives from the END table; a sheet figure that disagrees is the table's to win only where the rulebook says so (§46.6).
- [ ] Attributes carry nothing the sheet does not list — and nothing granted twice (an attribute in the base list *and* from a class skill).

**Per ability**
- [ ] Every clause of the description has an element, and every element has a reader that is reached.
- [ ] Rank-table values match the figures the sheet prints for **this Servant's rank**, including the `[normal, vsNP]` pairs.
- [ ] Cooldowns, durations and counts parse to the right number of Turns (`◈` arithmetic, including the `±⅓◈` forms).
- [ ] Anything the sheet does **not** state a number for inherits from the unit rather than freezing a literal (§46.3, "absolute where the sheet is silent").
- [ ] Timing window is the one the sheet describes — a reaction is offered on the ladder, not only on the owner's Turn.
- [ ] Riders fire on the condition the sheet names, not on a proxy (`damageDealt` is "a hit that landed", which is not "inflicts").

**Class skills**
- [ ] The shared template's clauses **all** appear on this sheet. If not, §46.4-C is the pattern.
- [ ] A slug the template states by hand still matches what predicates name (camelCase, not the kebab-case id).

**On the board**
- [ ] Imported fresh from the compiled pack, in a match, with **one** GM connection.
- [ ] Every ability pressed through the interface; refusals read and understood rather than worked around.
- [ ] The sheet's own numbers checked after each press — the counters, the cost lines, the modifier provenance list.
- [ ] Chat card and audit log agree with the sheet. A disagreement between them is §46.3's "gate and display" shape.

---

## 46.6 Not defects

Recorded so they are not filed again.

- **Rho Aias keeps absorbing for the rest of the Turn it was raised in.** Reported as §46.4-U and
  retracted. `shield.mjs#barrierOn` reads the defender's **effect instances** for one whose
  definition carries `absorbs` — so the barrier exists exactly while the `rhoAias` effect does, and
  that effect is applied for **⅓◈**. A second Noble Phantasm inside the same Turn meets the same
  standing barrier, which is what the duration is for; and a second *raising* of it is declined by
  the recovery clause, which is what that clause is for. Two correct behaviours read as one defect.
  Settled by letting the clock run: `expiry: 11`, gone by tick 12, and the next Noble Phantasm left
  the pool untouched at 275.

- **Max Health is derived from END and the table beats the sheet**, as Base Attack's does. This was
  raised by the Asterios audit as an open question — his sheet prints 1500 where END A++ derives
  1700 — and **settled by the game's author: it is overridden.** `domain/health.mjs#maxHealthFor`.
  Four sheets disagree and every one disagrees downward: Asterios, Castor and Pollux print 1500
  against 1700, Penthesilea 1250 against 1350. The authored figure survives only where there is no
  parameter to derive from, which is summons and platforms.

- **An authored `baseAttack` is overwritten by the STR/MAG table.** Deliberate, and
  `domain/base-attack.mjs` quotes the rulebook doing it: *"If you find a value of Base attack that
  differs from this calculation choose the value of this table instead of what is on the character
  sheet."* Three of the eleven authored sheets disagree with the table; the table wins.
- **The revival chain tries only the best available source.** If Undying fires, fails and is spent,
  God Hand's eleven charges are not consulted. That matches Ch. 45's own pseudocode exactly. It is a
  reading of the sheet's priority list, not an oversight — but it is a *reading*, and it is the
  kind of thing to put to the game's author rather than to re-derive per Servant.
- **Overkill is subtracted from every revival source.** Only God Hand's text carries the excess
  clause; `rules/revival.mjs` generalises it and Ch. 31 says so in those words. Same status as
  above.

---

## 46.8 Asterios — what was his own

**Re-audited 2026-09-17 under the clause scheme**, clause by clause, against the list his tracker
issue carries: 30 Clauses across five Abilities plus the statblock, every one taken to `Pressed` or
`Observed`. The first audit of him (2026-09-16, below) predates the evidence levels and found four
defects; this one found **seven more**, and only one of the seven was his.

That ratio is the programme working. Of the seven, six are general — §46.4-AO, AP, AQ, AR, AS, AT,
AU and AV — and reach every war, every bounded field, all six Mad Enhancement bearers, every mode
carrying a lockout, and two shipped effects. Asterios found them because his kit stands on all of
those at once.

**The board.** Built with `commitWar` on a neutral Region, 15×15, one GM connection, all three
Servants imported fresh from the compiled pack by the summon path. He arrived at Max Health
**1700** — his sheet prints 1500 and the END table wins (§46.6) — with Agility and Luck rolled by
`servantSetupPlan`, and BA(STR) 170 / BA(MAG) 125 exactly as printed. A second war on Greece
supplied clause `CL.geom`'s other half and, incidentally, the Region defect that opens the register.

**What the clauses cost to press.** The two that fought hardest were the ones with no control of
their own: `ME.5` needed a Master killed with the mode active, and `CL.8` needed Asterios himself
defeated with a field standing — both scheduler-fired, both satisfied at `Pressed (engine)` under
ADR 0004. The escape ladder was the most expensive by wall-clock: one attempt per Turn, because the
gate wants movement left and only a Turn restores it, which is the clause rather than a workaround.
It measured **20% → 25% → 30% → 35% → 40%**, +5% per failure exactly, each failure relocating the
escapee to a different random interior panel.

**Two things this audit could not settle by pressing.** `NM.p` — *"the source of Asterios' inhuman
STR and END"* — states no mechanic at all; its one mechanical consequence is the `physical` copy
exclusion, which refuses where Avyssos of Labrys allows on the same Servant. And `AL.3`'s 10% is a
die: the rider is proved to fire on every landed Normal Attack and, once §46.4-AU let its chance
resolve, to inflict Bleed for 1◈ on the victim — but the 10% itself did not come up in the attacks
made here, and was pressed with the chance staged instead.

### The findings that were his

- **A Region override moved his Labyrinth and not the area that debuffs it** (§46.4-AV). The only
  finding of the seven that belongs to Asterios alone, because his is the only content carrying a
  `regionSizeOverride` — and it is the clause that gives him his home ground.

### From the first audit, 2026-09-16

The statblock, all seven clauses of Mad Enhancement, Natural Monster, Avyssos of Labrys and eight of
Chaos Labyrinthos's ten clauses held. Measured on a live board: the Labyrinth opened at **81
panels**, Asterios's MOV read **10** inside (4 base, +2 Mad Enhancement, +4 interior), the enemy's
read **5** (7 − 2), the activation debuffs landed, and the Noble Phantasm dealt **0** damage as
*"(Non-damaging)"* requires. All of that still holds; what the re-audit added was that the MOV
numbers were **read** correctly and **spent** wrongly (§46.4-AP), which reading them alone could
never have shown.

Two of his four findings then were general and live in §46.4-H and §46.4-I. The two that were his,
both fixed at the time:

- **The preview promised damage a non-damaging Noble Phantasm would not deal.** The confirmation
  dialog offered *"AT Foe 192 – 264"*; the resolution dealt 0 and the log agreed. `dealsNoDamage`
  was applied in `engine/attack.mjs` when it builds the base spec and **not** by the preview, which
  fell back to the caster's Normal Attack the way the resolver itself used to. The §46.3 shape is
  "the gate and the display disagree", and it is §46.4-A with the sides reversed: there the sheet
  under-promised what the engine allowed, here it over-promised.

  The predicate moved to `rules/ability-use.mjs`, beside `classifyAbility`, because the preview is
  layer 2 and could not reach into the engine to ask. One definition, two readers. **Measured
  live**: the dialog now shows the target with no damage figure at all.

- **Monstrous Strength read *"PASSIVE — ALWAYS IN EFFECT"* on his sheet.** It is *"(Active) Used at
  the start of a Damage Step when performing an Attack"* with a 3◈ Cooldown, and it always **was**
  offered correctly at that window — the Damage Step dialog names it. `classifyAbility` had
  answered `kind: "windowed"` since he needed it; the ability card had no branch for that kind, so
  every non-clickable ability fell through to the passive label.

  It now names the window: **"Active — offered at: Start of the Damage Step"**. The wrong label was
  wrong in the direction that matters — a player reading *"always in effect"* does not go looking
  for the prompt, and does not know a Cooldown is being spent when they answer it.

---

## 46.9 Karna — one clause, and the scale it was hung on

Audited 2026-09-16. Thirteen abilities and four Noble Phantasms, the most of the original twelve,
and Ch. 45 names him beside Asterios as a Servant who was on the "fully authored" list while nine
of his abilities did not exist. They exist now, and all but one clause holds.

**What held**, listed because several of these are the clauses most likely to be wrong and were
not: Vasavi Shakti's *"Base Attack (STR) is increased by 25, STR Rank is increased from B to A"*
lands on **150 and rank A** — the sheet states one change twice and the code applies it once;
Brahmastra's fork takes **2×** against a defender who beats him on any Parameter and **4×** against
one who beats him on none; Vasavi's three Divinity tiers resolve 3.0 / 2.0 / 2.5 against B–EX, E–C
and Divine-without-Divinity; Magic Resistance's Instakill/Death carve-out applies to those two
severities only and leaves **Erase completely unaffected**, because Erase carries its own severity
and neither chance rule matches it; Mana Burst's *"Burn at 50% **instead of** 25%"* is a predicate
on the 25% passive rather than a second roll; and `Fated Rivals` is inert with no Arjuna on the
board, as designed.

**The defect.** `Kavacha and Kundala` charges *"20 Health at the end of every Turn that Karna is
**involved in a Combat Phase**"*, authored as `event: actedTurnEnd` — which fires for a unit that
**Acted**. Being attacked is involvement and is not acting: a defender who answers nothing has done
nothing. `turnState` recorded `acted`, `moved` and `attacked`, and none of the three is the
question, so the clause had nothing to gate on.

`docs/E-event-reference.md` draws this exact distinction and cites Karna as the reason
`combatProcessEnd` exists separately — his *other* upkeep, Vasavi Shakti's, is per **Process** and
was correct. The Phase-scaled half landed on a third thing.

Closed by `turnState.inCombatPhase`, stamped by `engine/attack.mjs` on the same set
`combatPhaseEnd` already fires for, and a matching `involvedTurnEnd` boundary event.

**Measured live**, all three branches:

| Karna's Turn | Master | |
|---|---|---|
| Attacked for 143, did not act | 250 → **230** | was 250 → 250 |
| Acted, no Combat Phase | 250 → **250** | correct, and not over-charged |
| Both acted and was attacked | 250 → **230** | billed once, not twice |

**Not a defect, recorded because it surprises.** Heracles hit Karna through a stated *"all damage
received reduced by 90%"* for 184. Stage 4 of the pipeline puts `atkUp +60` (Mad Enhancement) and
`defUp −90` in the **same additive bucket** — −30% → ×0.70 — which is Ch. 22's composition
rule and the arithmetic `class-skills/mad-enhancement.yml` defends against the multiplicative
alternative. Karna's armour erodes against a large enough attacker bonus rather than flatly
dividing by ten.

---

## 46.10 Penthesilea — the last of the three clause-1 shapes

Audited 2026-09-16, and the reason §46.4-C could be closed: hers is the sheet that prints Mad
Enhancement's clause 1 **in full**, the forced deactivation *and* a floor, with the floor
conditional on the skill being held on. The predicate that says so is §46.4-C's residue, and
building it took her audit to motivate.

**What held.** The statblock (she reads **1350** now, not the 1250 her sheet prints — §46.6's END
override); Divinity B → +40; *Hatred of Achilles* as a `Compulsion` that forces both her target and
her mode, lifting the instant the Greek Male leaves; *Charisma* as an aura over **other** allies
with `self` dropped from the default relations, negated by Mad Enhancement, by her own Atk Up
(Charisma) and by Skill Seal; *Howl of the War God*'s two magnitudes; *Golden Rule (Beauty)*;
and all four clauses of *Goddess of War*, including *"Divinity Rank is increased from B to A"* —
an **ability's** rank rather than a parameter, which `RankShift` grew an `ability:` branch for and
which her file's notes still described as unbuilt.

**Two fixes.**

- **The conditional floor**, §46.4-C. Measured live with Achilles two panels away and then off the
  board entirely: Master at 40 → **30** while the mode is held, → **10** when it is free.

- **`Outrage Amazon` was frozen at her base Range.** Her sheet gives the Noble Phantasm no reach of
  its own, so it swings at whatever her Range is — and it *"can only be used when Mad Enhancement
  is activated"*, whose clause 4 is *"Range is increased by 1"*. So the one state in which she may
  fire it is the one state in which the authored `range: 2` was wrong. It reads **3** now. The same
  shape as Heracles's Nine Lives (§46.3, "absolute where the sheet is silent"), on a Servant where
  the gate guarantees the disagreement rather than merely allowing it.

  **Found in passing and fixed with it:** Karna's *Mana Burst (Flames)* carried the same frozen
  `range: 2`. His sheet says only *"used when performing a Normal Attack"*, so its reach is his
  Range — which is 2, so the two agreed and the defect was invisible. It is inherited now. His
  *Discernment of the Poor* keeps its absolute number, because that sheet prints *"Range=2"*.

**A harness note for §46.2.** Moving a token by fourteen panels to get a unit out of a compulsion's
radius does nothing: the movement gate refuses it and the token stays put, silently, exactly as it
refuses a Labyrinth exit. The first run of this measurement compared two identical boards and read
as "the floor applies either way". Delete the token, or move it within its MOV.

---

## 46.11 Medea — a narrowing nobody wrote down

Audited 2026-09-16. Thirteen abilities, seven of them Spells, and a Noble Phantasm that rewrites
the relationship graph. Her sheet is the densest yet converted and almost all of it holds — but
the one thing that did not is not hers alone.

**`valence: offensive` on a debuff-chance clause excluded a third of the debuff catalogue.** Item
Construction is *"the chance of inflicting **debuffs** is increased by 50%"* and *"the chance of
being inflicted by debuffs is reduced by 50%"* — unqualified, both directions. It was authored with
`valence: offensive` on the normal-severity tiers, and `chanceContribution` skips any contribution
whose valence does not match the effect's.

`valence` is not the buff/debuff axis. `polarity` is, and the same filter already applies it. What
`valence` records is what an effect **does** — so `Def Dwn`, `Slow`, `Freeze`, `Shock`, `Deafen`,
`Debuff ResDwn`, both Decoys and three more `Def Dwn` rank variants are all `valence: defensive`
**and still debuffs**: eleven of the thirty-five authored, and the group includes the commonest
debuff in the game — four Noble Phantasms in the reference set inflict `Def Dwn`.

Measured on a live board with her aura expanded: `Stun` took the full +50 and `Def Dwn` and `Slow`
took **0**, skipped on *"valence offensive vs defensive"*, in both directions. They take 50 now.

**It reaches Van Gogh too.** The same undocumented narrowing sits on his *Item Construction* (35%)
and his *Existence Outside The Domain* (25%), and all three sheets say plainly *"debuffs"*. Every
other deliberate narrowing in this corpus carries a comment saying why; these carried none, which
is what marked them.

**A third instance of "absolute where the sheet is silent" (§46.3).** *Rain of Light* is *"Range+1
for the Combat Process"* — the exact phrasing §46.4-F fixed on two of Anastasia's — and was
authored as an absolute 4. Her Range is 3 and 3+1 agreed with it, so the freeze was invisible. It
is `rangeBonus: 1` now. Her *Teachings of Circe* and *Rule Breaker* keep their absolute numbers,
because those sheets print *"Range=3"* and *"Range=1"*.

**What held**, and several of these are the clauses most likely not to: Item Construction's
non-stacking resolves across the whole group by rank, so a C-rank instance cannot win one severity
tier and lose another; *High-Speed Divine Words* carries no `category: spell` of its own, so
resetting *"all of Medea's Spells"* does not reset the resetter; the Dragon Tooth Warriors' *"enemy
Units cannot Attack Medea or her Master"* is a `TargetabilityModifier` projected onto the summoner
from the warrior, with a past `TargetingModifier` confusion recorded in its own comment; their
cooldown is priced per warrior conjured; *Trofa*'s *"50% chance against a Noble Phantasm"* is a
`chanceWhen` on the effect and is read by `chanceFor` in the attack path; and *Atlas*'s two −25%
reductions are two modifiers, so they stack as the sheet says they do.

---

## 46.12 EMIYA — the Servant whose Range moves

Audited 2026-09-16. Seventeen abilities, and Ch. 45 describes him as *"the Servant whose sheet is
written almost entirely in terms of distance"*. Both findings are about distance, and they
compound.

**What held**, including his signature clause: `normalAttack.mode: rangeBanded` with a `from: 3`
band combining `str × 1` and `mag × 0.2` and carrying `ignoresMagicResistance` — his sheet's
*"75+35=110; not affected by Magic Resistance"*, exactly. The statblock, the 7◈ Sustainability, and
every Projection's Silence gate, which is authored per-ability rather than on the documentary
*Projection Magic* passive that names the rule.

**Two findings.**

- **Magecraft never fired on a Projection.** *"Whenever EMIYA uses a Thaumaturgy Spell, apply Range
  Up"*, with the sheet's own note that *"'Projection' Skills and NP are treated as Thaumaturgy
  Spells"*. The handler read `ofCategory: thaumaturgy` and the five Projections carry
  `category: projection` — which is the right key for them, because *Projection Magic*'s Silence
  gate and *Tracing*'s cooldown reduction both name that group. It is `[thaumaturgy, projection]`
  now; `ofCategory` has always been a list. On `thaumaturgy` alone the buff fired for three Spells
  and never for the five Projections, which is most of what he does.

- **Caladbolg II and Hrunting froze the Range they are stated relative to.** *"Range+2 for the
  Combat Process"* and *"Range+3"* were authored as absolute 6 and 7 — his written 4 with the
  addition already performed. Every previous instance of this shape (§46.3) was invisible because
  the frozen number happened to equal the unit's Range; **his is not**, because he is the one
  Servant in the corpus whose Range genuinely moves, and it moves by the very buff the first
  finding had switched off.

  **Measured live**: at Range 4 both read 6 and 7 correctly; with Range Up in force his Range read
  **5** and they still read 6 and 7, where the sheet grants 7 and 8. They read 7 and 8 now.
  Hrunting's `minRange: 2` was right throughout — *"cannot be used on a Unit directly next to
  EMIYA"* is an absolute floor beside a relative reach, and the two fields say so separately.

**One reading left open.** *Overedge* is authored `range: 3`, taken from *"the effects of 'Kanshou
& Bakuya' extend to Normal Attacks at a Range of 3 or lower"*. But that sentence conditions where
**K&B's effects** apply, not where Overedge may be aimed — and Overedge is *"2 Normal Attacks"*,
whose reach is his Range. Left as authored, because the two readings differ by one panel and the
sentence genuinely supports both; worth putting to the game's author.

**Coverage.** The statblock, the range bands, every anchor, Magecraft, Projection Magic and the
Silence gates were traced and pressed. *Rho Aias*, *Unlimited Blade Works*, *Trace, On* with its
AC/BC branches, *Eye of the Mind (True)*'s B→EX swap and the *Projection: Unlimited Blade Works*
copy spell were read but not individually re-pressed; Ch. 45 records them as verified live when he
was authored, and this pass did not contradict that.

---

## 46.14 Semiramis — the Servant who is two Servants

**All twelve of her documents were pressed on a live board.** She found **eleven** general defects,
more than the rest of the roster put together, and only two of them were hers: the rest were the
engine standing underneath her.

**Why she finds so much.** Almost every clause she owns is the *only* instance of its mechanism in
the corpus — the only `summonVariant`, the only `channel`, the only `itemCost`, the only
`trappedAtActivation`, the only `fixedArea` anchored to a platform centre, the only
`alsoGrantsResource`, the only `singleInjuryRoll`. A mechanism with one user is a mechanism whose
bugs have never been reported.

### 46.14.1 What held

| Clause | Measured |
|---|---|
| **Item Construction** | `1d4` → **4**, granted as one `[Semiramis' Poison]` stack of quantity 4, and HGoB Construction **+6** — the *same* roll, plus Ch. 45's adjacency bonus, because the war Region is Greece and Greece is next to the Middle East. Cooldown 6 ticks |
| **Arrogant King's Poison** | Gate and spend both honoured: 4 → **1**, exactly 3. `Def Dwn` lands at **magnitude 30, npMagnitude 40, expiry 38** against a tick of 35 — precisely 1◈. Cooldown **11** ticks = `4◈-⅓◈` |
| **Summoning: Bašmu**, clause 1 | The off-platform branch selected: cooldown **2◈**, not the on-platform 4◈. BA(MAG) 250, the sheet's **1.25×** at stage 3, and Poison inflicted (stage 11 → 12) |
| **Hanging Gardens**, activation | Channel of 9 ticks, Master billed **only on success** (250 → 150), platform built at her panel at elevation 20 with Semiramis aboard and carrying `hgob-owner-buff` |
| **Aerial Garden of Vanity** | BA(MAG) 250 → crit → **2×** at stage 3 → 528, −50% combined, −30, **234** and an Injury Roll. Cooldown 2◈ |
| **Dragon Wing Warriors** | `1d6+4` → **8** separate Combat Processes, 50 Fixed STR each, the pipeline bypassed entirely (neither the −40% nor the −30 applies), **400** total — and exactly **one** Injury Roll, deferred by seven siblings and performed by the eighth against the sum |
| **Sikera Ušum**, structure | The `dsc` branch chosen (Throne Room, 3◈, sealed) over the 5×5-follows-her branch; anchored to the platform's computed centre `{4,4}` rather than to where she stood; expiry exactly 9 ticks; cost 53 at B+ against a Low Rank Master; cooldown 0 at use, because it is `countFrom: deactivation` |
| **Sikera Ušum**, the seal | `trappedUnitIds` holds **Semiramis alone**. `canPassThrough` allows her every panel inside the 5×5 and refuses her every panel outside it — while Heracles, who walked in *after* activation, is refused nothing. A membership snapshot, not a standing wall, which is what the sheet says |

The stage-4 bucket deserves its own line. Bašmu's card showed `Def Dwn +30%` **three times**, from
three separate applications of Arrogant King's Poison, combining additively with Mad Enhancement's
−40% and a Home Base's −10% to a net **+40% → ×1.40**. Three instances of one debuff stacking, and
an attacker's buff and a defender's Def Up settling in the same additive pass.

### 46.14.1b The rest of her kit

| Clause | Measured |
|---|---|
| **Double Summon** | `npRegen` and an **unremovable** `construction`, both expiring at exactly 1◈; the `dscBuff` clause correctly **withheld** from a Servant already `dsc`. Cooldown 12 ticks. Both resolve: her NP cooldown fell **10 → 8** at the next Turn end (one tick plus npRegen's), and Construction gained a 1d6 |
| **Double Summon: Caster** | The range bands resolved live, not read off a projection: **Range 1 → `BA(STR)` 50**, **Range 3 → `BA(MAG)` 200**. Range 3 panels / 1 target, and `servantClasses` is `["caster", "assassin"]` |
| **Presence Concealment** | Clause 1 refused an adjacent, in-range attacker by name — *"Semiramis is concealed — it cannot be targeted directly"*. Clause 4 landed as `Atk Up presenceConcealment +100%` in the stage-4 bucket. Clause 5 deactivated it at the end of the Combat Process she attacked in. Clause 8's `unremovable` is on the instance. Its cooldown is `countFrom: deactivation` and behaved like it: **0 while active, 3 the moment it ended** |
| **Territory Creation** | Both passives, after §46.4-AD. Offence: `flatDamage Territory Creation` at stage 7 — **5d8 in her ground Home Base**, **6d20 aboard the Gardens**, the branch chosen by `self:onPlatform:`. Defence: `damageNegation Territory Creation −30`, a 3d10+10 for an ally in their own Home Base |
| **Scales of the Sacred Fish** | Offered on the reaction ladder at the right window; `scalesShield` for exactly 2◈; cooldown 9 ticks. After §46.4-AE the pool fills **0 → 200** on cast and **absorbs**: a 207-damage hit left her Health down only 7 while the pool went **200 → 0** |
| **Summoning: Bašmu**, clause 2 | The on-platform branch: a **Bašmu** summoned on the panel **directly next to her**, faction-1, cooldown **4◈** against clause 1's 2◈. *"Counts as her Attack for the Turn"* — `acted` and `attacked` both set — and her own Health untouched, because the summon branch overrides damage to a fixed 0. A second cast is refused: `noAliveSummon` |
| **Sikera Ušum**, rules a and c | Rule a, after §46.4-AF: her Range-1 `BA(STR)` attack from inside the Throne Room inflicts `poison`. Rule c: Poison stage climbs at **every** Turn end inside the area — 1→2→3→4→5 across three different factions' Turns — dealing exactly **20** at stage 1 (§A.12's curve). The control is the proof: moved outside the 5×5, it **stops dead** — 0 damage and the stage frozen for three Turn-ends |
| **Sikera Ušum**, rule d | Pressed with real content on both ends, after §46.4-AG: Hassan of Serenity, *"Immune to Poison and Deadly Poison"*, standing in the Throne Room. Poison landed **3 of 14** (21%) where the sheet predicts 25%, and **0 of 14** before the fix |
| **Divinity** | `Divinity +30` at stage 7 of every card she threw |

### 46.14.2 What she cost the engine

Two of her eleven were her own (§46.4-X's double cooldown, §46.4-Y's unprojected variant). The other
nine were general:

- **§46.4-Z**, the channelled Noble Phantasm — the fourth member of *the two use paths do not do
  the same thing*, plus a half nothing had suggested: the declaration interrupting the channel it
  had just begun.
- **§46.4-AA**, the content sync reverting a summon variant's overrides on every world load.
- **§46.4-AB**, a scheduler claim that could freeze a match permanently — found only because her
  channel needed nine Turns to tick and they would not tick.
- **§46.4-AC**, every field's `actedTurnEnd` interior event, dead for want of the right board.
- **§46.4-AD**, `stage: flat` with no reader — every Territory Creation in the game multiplying
  where its sheet says add, worth up to +120% instead of +120 at rank EX.
- **§46.4-AE**, `refreshShield` on one use path only, so a Shield (200) granted by a Skill absorbed
  nothing.
- **§46.4-AF** and **§46.4-AG**, two subjects built without the board and asked board questions.

**Three of the nine are one shape**, and it is the shape to watch: §46.4-AC, §46.4-AF and §46.4-AG
are all a board question asked of something that is not a board — a rebuilt board that had forgotten
the Turn, and two `unitSnapshot` subjects with no `fields` and no `suppressions`. Each answered
"no" instead of refusing, which is why none of them ever surfaced as an error. §46.4-V, from
Achilles, is the same shape a chapter earlier.

### 46.14.3 Everything pressed

The list this section used to hold is empty. What closed it:

| Clause | Measured |
|---|---|
| **PC clause 2** | Her AGI **D** against Heracles's **A+** refuses nothing — the sheet's own escape. Against a defender at **E** the card offers *Do nothing, Evade* and neither **Block** nor **Counter**. The evade half reads `Presence Concealment C+ **+3**` on the roll card, from the rank table rather than the hardcoded 4 |
| **PC clause 3** | Both halves, each with a control. Targeting: concealed, she lands a Normal Attack on a guarded enemy Master; the same attack unconcealed is refused — *"protected by an adjacent Servant and cannot be targeted"*. Movement: `canPassThrough` a protected panel is **true** concealed and **false** not |
| **PC clause 6** | Two Discover attempts per move at **35%**, which is what Ch. 05 says C+ gives. Second move: *"Discovered. Master of Berserker of Faction 2 found **Caster** (rolled 11 vs 35%)"* — concealment deactivated, and she is named by her **public** name, so a position reveal leaks no identity |
| **PC clause 7** | *Arrogant King's Poison* (enemy-targeting, no damage) refused with reason `presenceConcealment`; *Double Summon* and *Item Construction* (self) allowed; *Summoning: Bašmu* stopped by a **different** gate, which is the *"does not include Attack Skills and Spells that deal damage"* carve-out working |
| **Sikera Ušum's cooldown** | **0** for all nine ticks the Throne Room stood, then **19** (`6◈+⅓◈`) the instant it closed. `countFrom: deactivation`, exactly |
| **HGoB as a second Home Base** | A four-case truth table: aboard at row 7 (outside her ground base) **true**; the same unit on the ground there **false**; on the ground inside her zone **true**; an **enemy** aboard **false** |
| **Construction, all six sources** | 1+2 from a fresh Greece war: **25** = start **10** (adjacent, not the Middle East's 25) plus **15**, which is 3×5 — a *product*, since a 2d6 sum cannot exceed 12. 3: **+7** at a Round boundary (`1d4+2` plus adjacency). 4: **+6** (§46.14.1b). 5: **+4** for a non-Spell Skill. 6: Gather — Semiramis **7**, her Master **6** |
| **Destruction and rebuild** | Construction **88 → 0**, `zonExempt` **true → false**, Sustainability **30 → 24** (the +2◈ reversed), the platform actor gone and `hgob-owner-buff` stripped |

Pressing them cost three more engine defects: §46.4-AK, and — from Construction source 3 refusing to
fire — **§46.4-AL**, the one that mattered most.

**That question is now answered.** Presence Concealment clause 6 says *"an enemy **Servant's**
Range (or Detect)"* while Ch. 05 quotes the source's general rule as *"an enemy **Unit's**"*,
and the engine had followed the general one — so a Master rolled too, 58% per move against a sheet
offering 35%. The author has settled it in favour of the Skill's wording, and added a cap with it:
**three attempts per faction per Turn** against one concealed Unit. §46.4-AN.

**And Bašmu is 3×3.** Its size had never been authored, so it defaulted to a single panel — which
is not decoration for this summon: *"when it Moves to any occupied panels, all Units occupying said
panels are knocked back by 1 panel until the space is free for Bašmu to stand on"* has to clear nine
panels rather than one, and the Attack-denial clause's reach is measured from whatever it occupies.
Verified on a live board: the token places 3×3.

### 46.14.4 A note on the board this was pressed on

`masterProtection` was **off** on the test board, which is why PC clause 3 first appeared to do
nothing — the rule it exempts her from was not running for anybody. It was switched on to press the
clause and switched back afterwards. A clause that exempts you from an optional rule cannot be
tested while the rule is off, and the refusal looks identical to a working exemption.

### 46.14.5 The re-audit, 2026-09-18 — a question nobody asked

Re-audited under the Clause scheme against the 104-Clause list her tracker issue carries. The first
finding is not a rule that computes the wrong answer; it is a **correct rule that nothing ever
asked**.

**`checkSightings` had one call site — a movement hook — so nobody was ever *first seen* on the
opening board.** `unitFirstSeen` is the event half of Detect, and Familiar: Doves is the **only**
consumer of it in the whole corpus: *"Whenever Semiramis sees a Unit for the first time, the 'Dove'
effect is applied to it"*, which is what then lets her track that Unit through Fog of War.

Everything under it was right. `rules/identity.mjs#newlySeenBy` answers correctly and has unit tests
that say so. The `dove` effect exists and applies. `RevealPosition` reads it. The passive is
authored, and `fireEvent` reaches it. What was missing is that `engine/vision.mjs#checkSightings`
was called from `engine/movement-hooks.mjs` and **nowhere else** — so two Units deployed in sight of
one another were never first-seen by anybody until somebody walked.

Measured live: Semiramis stood adjacent to an enemy Servant for **five Rounds**, attacked him
**twice**, and had Dove'd nobody. Driving `checkSightings` by hand on that same board applied the
Dove to both Units her Detect reached, immediately — so the machinery was whole and idle.

Fixed by asking the question at the other moment a Unit can newly be seen: `commitWar` now runs the
check after `deployTokens`. Guarded by `test/unit/vision-callsites.test.mjs`, which reads the source
for the call sites rather than the behaviour — **a unit test of `newlySeenBy` cannot catch this**,
because it answered correctly every time it was asked and the defect was that nothing asked. Red
against the old code.

This is §46.3's *"an event with no firer"* with one letter changed: the firer existed and was
reachable from exactly one of the several places that owe it.

**Kept to her case chapter rather than §46.4** because Familiar: Doves is the only thing in the
corpus that consumes the event, so no second Servant inherits the fix. The *shape* generalises and
is worth carrying to the next audit: an event with a single call site is worth checking against the
list of moments it claims to describe.
