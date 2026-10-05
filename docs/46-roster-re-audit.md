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

1. **Build the Clause list by hand, from the Character Sheet.** Read it line by line and write one
   Clause per rule that can fail on its own — a different mechanism, number, trigger or subject is
   a different Clause — under the Unit or Ability that owns it. A summon, a mount or a platform with
   a statblock of its own is its own group, with **one** statblock Clause. Name every line that is
   deliberately not a Clause, and put every sentence the sheet leaves open under *Readings to
   settle*, with the reading the authored content took. The Servant's audit issue is opened then,
   with that list, and added to the roster tracker, #112. A Clause that goes missing here and is
   not noticed is the same defect as a Clause an auditor skipped, which is the shape this whole
   programme exists to find.

   `node tools/extract-clauses.mjs "<Servant>"` still prints a first draft, and its stderr is worth
   reading, but **its output is never the list**. On both sheets held against it by hand it dropped
   rules in silence, filed prose as rules, split a summon's statblock into one Clause per line,
   filed a Unit's rules under whichever Ability was open, filed a paragraph shared by three Spells
   under the last of them, and bundled sentences whose halves fail independently (#73) —
   Quetzalcoatl's generated 56 Clauses became 113 by hand. The twenty-four generated issues still
   waiting were deleted, unworked, on 2026-09-30.
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
| **A Unit on a platform cannot be clicked** *(Semiramis)* | The token is visible, the layer is active, `control()` does nothing and `canvas.tokens.hover` stays `null`. Indistinguishable from a dead canvas | **The viewed Scene Level is not the token's.** `apps/canvas/token.mjs` refuses interaction unless `document.level === canvas.level.id`, so a Servant aboard the Hanging Gardens is inert while the ground level is shown. Switch levels in the scene controls first. `canvas.scene.cycleLevel()` did not move it; the control does — it is the scene navigation's level menu, `[data-action="viewLevel"][data-level-id="…"]`, and clicking that row moves `canvas.level` in one step |
| **Controlling a summon hides the rest of the board** *(Semiramis)* | Every other token reads `visible: false` and none of them is hit-testable, so a click on the Servant standing beside it selects nothing and leaves the summon selected — indistinguishable from a canvas that has stopped responding | It is Fog of War doing what Fog of War does: the view is computed from the **controlled** token, and a summon with no sight sees nothing. `canvas.tokens.releaseAll()` restores every token to `visible: true` in one call. Release before selecting, and check `placeable.visible` before concluding a click was lost |
| **A big token swallows the panel underneath it** *(Semiramis)* | A click aimed at a Unit selects the neighbour that is standing on top of it | The Bašmu's token is **3×3**, so it covers nine panels and intercepts every one. Read `token.width`/`height` before blaming the coordinate; moving the big token away is quicker than fighting the hit test |
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

The same double reads as a fault from outside, and did once. #108's *"second 160"*: Heracles at
stage 4 lost **320** at a Round boundary where a dry run of `endRound` alone gave 160. The Round's
last Turn was his own Faction's, so `endTurn` ticked him for *"the end of its Turn"* and `endRound`
for *"the end of the Round"*. A live dry run at stage 2 gives **40** for his own Turn's end, **40**
for the Round's, and nothing for another Faction's. Pinned in `test/unit/periodic-double-tick.test.mjs`.

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

### AW. A refused Attack reached the console and nobody else — **fixed 2026-09-18**

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

**Fixed** by calling `budget.affordable` where its own docstring always said it belonged — *"the
attack button is disabled with the refusal as its tooltip rather than failing after the click"* — and
by surfacing the verdict at the throw site before it throws. Both carry `canConsume`'s **own
sentence**, so the control and the gate cannot drift into two spellings of one rule.

It turned out to hide a second rule as well: *"this unit has attacked and cannot move again"* was
equally invisible, and the Move control is now greyed with it. Verified live after a Gather: **"Attack
— this unit has already attacked this turn"** and **"Move — this unit has attacked and cannot move
again"**, both dimmed, where before both were lit and did nothing.

---

### AX. Every predicate-gated ability displayed as permanently unusable — **fixed 2026-09-18**

**Reached: ten abilities across five Servants**, including **Karna's Vasavi Shakti** and **four of
Quetzalcoatl's** — and both of Semiramis' that carry one, which is how it was found.

A `kind: "predicate"` requirement **refuses** when `ctx.testPredicate` is absent. That is
deliberate, and `rules/items.mjs` says why in as many words: *"a gate nobody can answer is not an
open gate."* For the execution path it is plainly right — running an ability whose conditions
nobody checked is worse than refusing it.

It is exactly the wrong default for a **display**, and only two call sites in the system ever
supplied an evaluator: `engine/attack.mjs` and `engine/skill-use.mjs`. Both are execution. The two
display paths — `apps/hud/action-bar.mjs` and `apps/actor-sheet/context.mjs` — omitted it, so every
predicate-gated ability was greyed out and captioned **"Its conditions are not met right now"**,
permanently, whether or not they were met.

Measured on a live board, the same call twice with nothing else changed:

| | verdict |
|---|---|
| `canUseAbility({ability, unit, master, board, …gateContext()})` | `{ok: false, reason: "predicate"}` |
| the same, plus `testPredicate` | **`{ok: true, cost: {masterHealth: 100}}`** |

Semiramis was standing in her Home Base, at Construction 100/100, on the Round her gate opens, with
`self:inHomeBase` and `self:variant:dsc` both emitted onto her option set — and her Noble Phantasm
said its conditions were not met. Her Summoning: Bašmu said the same thing for the same reason, and
that refusal had already been read and believed twice earlier in this audit before the cause was
found.

Fixed by supplying the evaluator at both display sites, built the way `skill-use.mjs` builds it.
Guarded by `test/unit/can-use-ability-callsites.test.mjs`, which reads the source: the defect is in
what a caller **omitted**, not in what any function computed, so there is no behaviour to assert on.
Red against the old code.

§46.3 shape: **the gate and the display disagree** — the third instance this audit has found, and
the only one where the display is stricter than the gate. The other two hid a refusal from the
player; this one hid a working Noble Phantasm.

**Worth carrying to the next audit:** an argument that is optional in a signature and load-bearing in
one branch is invisible at every call site that forgets it. `grep` for the parameter name rather
than for the function.

---

### AY. An attack-shaped ability billed to a pool that does not exist — **fixed 2026-09-18**

**Reached: every attack-shaped ability that resolves through `useSkill`.** Two in the corpus, and one
of them is a Noble Phantasm: **Raikou's Goō Shōrai・Tenmōkaikai**, which `classifyAbility` calls a
*mode* rather than an attack, and **Pale Rider's Doomsday Come: Drag**. Both cost nothing to use.

An ability's **kind** (`normal`, `attackSkill`, `damageSpell`) and the **action** a budget understands
(`attack`, `spell`) are two different vocabularies. `ACTION_KINDS` has held the second since it was
written and `test/unit/actions.test.mjs` guards it in both directions. `budgetActionFor` is the
bridge — and it lived inside `engine/attack.mjs`, where the other caller could not see it.

So `engine/skill-use.mjs` passed the **kind** `"normal"` straight to the budget, twice: once to check
and once to spend. `poolFor` does not know `"normal"`, answered `null`, and `canConsume` turns a null
pool into `{ok: true, free: true}`:

| | |
|---|---|
| `poolFor(unit, "attack")` | `"servantAttack"` |
| `poolFor(unit, "normal")` | **`null`** |
| `canConsume(exhaustedPool, unit, "normal")` | **`{ok: true, free: true}`** |

A full pool and an empty one gave the same answer, because neither was consulted.

**It failed open**, which is why it survived: the symptom is a Servant who can act slightly more than
they should, and nobody counts. A null pool is also *legitimate* — a platform and a reaction really do
cost nothing — so the `null` carried no information about whether it was meant.

Fixed by moving `budgetActionFor` to `rules/budget.mjs`, beside the vocabulary it translates into, and
having both engine callers use it. `engine/budget.mjs#affordable` and `#spend` now warn when handed an
action outside `ACTION_KINDS`, naming the known set and pointing at the translator.

**The warning is in the engine, not in `poolFor`.** The rules layer is pure and silent — there is not
one `console` call under `module/rules/` — and a bad action name arrives from a caller, which is the
engine's side of the boundary. Guarded by `test/unit/budget-vocabulary.test.mjs`, which asserts both
callers translate before they bill and that only one copy of the translation exists.

**Worth carrying forward:** a function that answers `null` for *"not applicable"* and `null` for
*"I have never heard of this"* cannot tell a caller which it meant. The two needed separating by a
vocabulary, not by a comment.

---

### AZ. A Noble Phantasm raised on somebody else's Turn still cost its owner's Attack — **fixed 2026-09-18**

**Reached: every reaction-window Noble Phantasm.** EMIYA's Rho Aias and Achilles' Akhilleus Kosmos in
the reference set, and every one authored after them.

The game's author states the rule in one line:

> *"Every Noble Phantasm consumes the attack budget if it is used on its owner's own Turn, and none
> does otherwise."*

The first half held. `poolFor` bills `np` to `servantAttack`, and a Unit that has attacked cannot then
use a Noble Phantasm. The exception did not exist anywhere:
`rules/ability-use.mjs#countsAsAttack` answers from the ability alone —

```js
if (item?.type === "noblePhantasm" || sys.isNP) return true;
```

— and has no notion of whose Turn it is.

**Why it bites, and it is not the charge.** A faction's budget is cleared at the **start** of its own
Turn, not the end (`engine/budget.mjs#reset`, and its comment says why). So during an enemy's Turn the
flag still holds what that faction spent on its own last Turn. A Servant who attacked a Turn ago met
an exhausted pool when trying to raise a **shield**. The spend itself is harmless — the reset wipes it
before the owner acts again — so **the refusal was the defect**.

**The obvious fix is the wrong one.** Two reaction abilities in the corpus carry
`countsAsAttack: false` — Kiritsugu's Suppression Shot, whose sheet says it is free outright, and
Semiramis' Scales, which is not an attack at all. Copying that onto Rho Aias would exempt it on
EMIYA's **own** Turn too, which the author's clarification explicitly rules out: *"Rho Aias also
consumes attack budget — just that… when it is used on someone else's turn, it does not consume
budget."* The exemption is a property of **the moment**, not of the ability.

So it is derived, once, in `engine/budget.mjs#attackOutsideOwnTurn`: an action drawing from an attack
pool, by a unit whose acting faction is not the one taking the Turn, is neither checked nor charged.
Both `affordable` and `spend` ask the **same** predicate — two spellings there is how an ability gets
waved through by one and billed by the other. Only the attack pools: a reaction drawing from the move
pool is already free for the ordinary reason. `actingFactionOf` rather than `unit.factionId`, so a
**charmed** unit acting on the charmer's Turn is still on "its own" Turn for this purpose.

**Ordering mattered.** This was invisible until §46.4-AY was fixed: `useSkill` was passing an action
name no pool recognised, so the attack pool was never consulted and the refusal never happened.
Fixing AY first made the defect appear for the first time, which is why the two were done in that
order and in that sitting.

**A test that only checked the reaction case would have passed against the wrong fix**, so
`test/unit/reaction-attack-budget.test.mjs` asserts both directions and that neither content file has
gained the flag.

**And it caught a defective fixture.** The first version of that test built its pools as
`{used, max}`; the real shape is `{usedHalves, maxHalves}`, so `undefined + 2 > undefined` is false
and the "exhausted" pool was empty. Both directions passed for the wrong reason. The world model now
carries `actingFactionId` and seeds `flags`, so the scenario can be stated at all.

---

### BA. Gather could be repeated without limit, so HGoB Construction was unbounded — **fixed 2026-09-18**

**Reached: Semiramis, and any allied Unit on her board.** Reported by the game's author while reading
§46.4-AW's fix: *"Using gather dims attacks and move, but it doesn't dim itself — it doesn't make
sense, as it consumes attack and move budget."*

The observation was about a lit icon. The consequence was that **the Hanging Gardens of Babylon could
be opened on Round 1.** Its gate is Construction 100, which her sheet reaches through six sources over
many Rounds; Gather is worth +5 to Semiramis herself. Measured live before the fix: four
`gather()` calls in a single Turn, every one `{ok: true, amount: 5}`, Construction **10 → 30**. Any
allied Unit may Gather, so a faction could stack it.

Two causes, and neither was the one the icon suggested:

1. **The post-attack guard named one action.** `canConsume` read `if (action === "move" && …)`.
   `poolFor` bills `gather` to the **move** pool, so Gather was a Move for costing and not a Move for
   refusing. *"Counts as a Unit's Move"* was enforced against Move and not against Gather.
2. **`alreadyCounted` makes every later non-attack action free.** That is D18.3 and it is right for
   Skills — *"a second non-attack action by the same unit is free"* — and it removed the pool as a
   brake on Gather entirely.

The author settled the two readings and added a second rule with it:

> *"Let's go with the Strict reading. Also, remember that strict reading or not, **a unit can only use
> Gather once per turn**."*

So **two** rules, and the first has to hold on its own. Gather now writes a `gathered` flag on the
Turn Record, and `canConsume` refuses on it directly — not on `moved`, because resting rule 1 on rule
2 would leave it at the mercy of the free-second-action rule that caused this. The strict reading is
written in both directions: Moved refuses Gather, Gathered refuses Move.

`gathered` is a Turn Record field, so it is **stale-by-reading** like every other: a record stamped
with an earlier tick reads blank and nothing has to reset it. `test/unit/master-data.test.mjs` — ADR
0003's guard, that the schema and the record spec do not drift — caught the new field on the first
run and required the spec updated with it, which is the guard doing exactly its job.

**It composed with §46.4-AW for free.** That fix had taught the action bar to consult the budget, so
with no HUD change at all the bar now reads:

> Attack — *this unit has already attacked this turn* · Move — *this unit gathered and cannot move
> again* · Gather — *this unit has already gathered this turn*

all three greyed, each naming its own rule. The reported symptom disappeared as a consequence of
fixing the cause.

**What was measured and what was not.** Only Semiramis' own +5 was pressed. The allied Unit (+3) and
Master (+4) cases share the code path and are covered by the unit tests, but were never put on a
board.

### BB. Every Round was played in the order rolled for the Round before it — **fixed 2026-09-18**

**Reached: every match in the game.** Found on the Semiramis audit board while reading whose Turn it
was, and it is the largest-reaching finding this audit has produced.

Turn order is a `1d100` per faction **re-rolled every Round** — Ch. 41 Q32, answered that way for a
stated reason: *a faction cannot be locked into last place for the whole match*. `rollTurnOrder`
rolls it, breaks ties, and writes `system.turnOrder`. `_sortCombatants` reads that field and orders
the tracker by it. Both are correct, and both have unit tests.

**Nothing re-ran the sort.** Foundry derives `combat.turns` in `setupTurns`, which `_onUpdate` calls
for `round`, `turn` and `combatants` changes only. `rollTurnOrder` writes to `system`, so the order
it rolled reached the sort no earlier than the *next* round boundary — and that boundary sorts with
whatever was current before its own re-roll. Each Round was therefore played in the order rolled for
the Round before it, permanently one Round behind.

Measured live, Round 3, a fresh read of each:

| | |
|---|---|
| `system.turnOrder` | `["faction-1", "faction-2", GM]` |
| `combat.turns` | `["Faction 2", "Faction 1", "GM"]` |
| acting | **Faction 2** |

and `combat.setupTurns()` called by hand on that same combat re-sorted it to `["Faction 1",
"Faction 2", "GM"]` and moved the acting faction to Faction 1 — the arithmetic was never wrong.

`system.turnOrder` has **three** writers, and all three had the same hole: `rollTurnOrder`,
`delayFaction` — where it means a declared `Delay+X` did not move anybody until something unrelated
re-rendered — and `markTurnTaken`. `delayFaction` alone announced its change, with
`Hooks.callAll("fgtTurnOrderChanged")`, and **that hook has never had a listener anywhere in the
system**: the one signal that the order had moved was sent to nobody. Ch. 46's own list of shapes
has both halves of this: *an event with no firer*, and its mirror, an event with no consumer.

**Where the re-sort goes is the whole of the fix, and the first attempt got it wrong twice.**
Calling `setupTurns` beside each of the three writers was reviewed and rejected:

1. *It fixes one screen.* `setupTurns` mutates the instance it is called on, and `rollTurnOrder`
   runs on the **active GM alone**. A player's client takes the `system` change and — by this
   defect's own premise — still never re-derives. Player-side code reads the result:
   `engine/movement-hooks.mjs` gates dragging on `combat.actingFactionId`, so the faction the roll
   really put first would be told it is not its turn.
2. *`this.turn` is an index, not an identity.* Re-sorting **mid-Round** moves whoever sits at that
   index — handing the turn to another faction with no `combatTurnChange`, no budget reset and no
   turn-start effects, while the faction that really held it never gets a turn-end. `markTurnTaken`
   recomputes the order at every boundary and `delayFaction` at every declaration, so applying
   either mid-Round *is* that bug.

So the re-derivation lives in `_onUpdate` — which runs wherever the change lands, on every client —
and only when `this.turn` is 0, which is the top of a Round and the one moment the rolled order can
be applied without moving anybody. `delayFaction` and `markTurnTaken` write their recomputed order
for the bookkeeping that reads it and no longer touch the played order.

Guarded by `test/unit/turn-order-callsites.test.mjs`, which reads the **source**: a test of the sort
cannot catch this, because the sort answered correctly every time it was asked and the defect was
that nothing asked. Two of its five assertions guard against the rejected shape.

**Verified live**, across the Round 17 → 18 boundary: at `turn: 0` the order reads
`[faction-1, faction-2, GM]`, `combat.turns` agrees, and Faction 1 acts. At `turn: 1`,
`markTurnTaken` has recomputed `system.turnOrder` to `[faction-2, faction-1, GM]` and `combat.turns`
is correctly **unchanged** — Faction 2 acts, which is the second slot of the order that was rolled.

**One thing this deliberately does not fix**, filed as #82: `computeTurnOrder` re-applies
`system.delays` against a *shrinking* `pending` list, so a `Delay+1` applied at every boundary
compounds into `Delay+N` — the declaration has to be **spent** before it can be applied. Delay
therefore still does not move anybody within the Round it is declared in, which is unchanged
behaviour rather than a new hole.

---

### BC. The Home Base's three-Round cure took every effect, not every debuff — **fixed 2026-09-18**

**Reached: every Unit in the game that stands in its own Home Base for three Rounds**, which is the
ordinary case for a Master and for any Servant defending.

Ch. 29 E2: *"a Unit that has spent three full Rounds in its own Home Base is cured of every removable
debuff."* `rules/environment.mjs#endOfRoundHomeBase` states it correctly and always has:

```js
if (e.unremovable) continue;
if (e.polarity && e.polarity !== "debuff") continue;
```

**Neither field was ever projected onto an effect instance.** `rules/snapshot.mjs#effectInstances`
carried `id`, `defId`, `magnitude`, `stage`, `uses`, `expiry`, three source ids, `visibility`,
`attributionHidden` and `suppressed` — and neither `unremovable` nor `polarity`. Both guards read
`undefined`, so neither could ever fire, and the sweep removed **everything the resident carried**:
buffs, neutral statuses and unremovable effects alike.

The same two fields are read by `rules/removal.mjs` and `rules/effect-flow.mjs` — Cure and Dispel —
wherever those are handed a projected instance, so the reach is wider than E2 alone.

Found on the Semiramis audit board, and it took a day to see because of where it hid. Her Hanging
Gardens **counts as her Faction's second Home Base**, so standing aboard her own Noble Phantasm makes
her a permanent resident; three Rounds after activating it she lost `hgob-owner-buff` —
`unremovable: true`, `polarity: status`, `expiry: null` — and every one of `HGB.ranks`, `HGB.str`,
`HGB.end`, `HGB.agi`, `HGB.mag` and `HGB.luc` quietly came off with it. The audit's *first* garden
board had shown exactly that state and it had been written off as debris from a hand-driven session.

**Measured, re-applying the buff and advancing:** it survived the Turn boundary and was gone at the
Round boundary, every time. `scheduler.endRound(board, ctx)` asked directly returned
`{t: "removeEffect", effectId: "…", reason: "Home Base"}` for it — the rule naming itself.

The projection now carries both fields, the instance's own `unremovable` winning over the
definition's where they differ (the owner buff is landed unremovable by the intent, and its
definition says nothing). Guarded by `test/unit/home-base-cure.test.mjs`, which runs the projection
and the rule **together**: either half alone passes, because the rule is right and the projection
looks complete until you ask it the two questions the rule asks. Six of its seven assertions are red
against the old code.

**Verified live** across the Round 15 → 16 boundary after the fix: the buff stands, her STR stays
`D` and her Health stays 1250/1250.

---

### BD. A successful boarding left the boarder standing on the ground — **fixed 2026-09-18**

**Reached: every platform in the game** — the Hanging Gardens and the Golden Hind alike.

Membership of a platform **is** the Scene Level: `rules/platforms.mjs#passengersOf` returns the units
on the platform's level, and every aboard-only rule reads it. `engine/platforms.mjs#boardPlatform`
moved a successful boarder with `I.move`, which changes x and y and nothing else. So a Unit that
passed its boarding roll was moved to the platform's anchor **panel** and left on the ground
underneath it: `onPlatform` false, every cross-level rule inapplicable, and the game log recording
`ok: true`.

Measured live, twice, from the action bar's own **Board** control:

| roll | target | die | log | where he ended |
|---|---|---|---|---|
| 4 | 8 | 12 | `ok: false` | (3,3) `k: 0` |
| 11 | 8 | 12 | **`ok: true`** | (0,0) **`k: 0`** — the garden flying at `k: 20` |

The arithmetic beside it is right and is the reason this was worth pressing at all: `target: 8` is
12 − 2 for Heracles' AGI Rank A − 2 for his LUC Rank A, which is `HG.board`, `HG.board.agi` and
`HG.board.luc` in one reading.

`activatePlatform` has assigned its initial riders to the level since the platform's own token was
found flying at elevation 0 (§46.4 C3's neighbourhood); boarding is the same operation and was never
given the same step. A `comeAboard` helper now does it for the boarder and for a Master carried up
with its Servant, reading the level off the platform **actor** — `levelOf` wants `system.levelId`,
which the board projection does not carry.

**Verified live** after the fix: roll 12 against target 8 took Heracles from `k: 0` to **`k: 20`**.

---

### BE. Every Combat Process card offered the Command Spells of every Master in the world — **fixed 2026-09-18**

**Reached: every card, in every match.** Found on the Semiramis audit board while reading a reaction
card for something else.

`apps/chat/cards.mjs#offerableCommands` assembled the offer from the actor directory and filtered it
on **ownership alone**:

```js
for (const master of game.actors.filter((a) => a.type === "master" && a.isOwner)) {
```

A GM owns every actor in the world. So a two-faction board with **two** Masters on it offered
Command Spells from **twenty** — Drake's Master, Gogh's Master, an Archer's Master from a war that
was over, two test Masters from a Heracles setup. Spending one would have charged a Master standing
outside the fight, and Ch. 33's *"an unusable command's option must never appear"* was being read as
being about cost alone.

The template's own comment beside the block says *"only shown when this viewer owns a Master that can
actually spend one"*, which is where the ownership test came from and how it passed review: it is the
right sentence with one condition missing. Ownership is not membership.

The offer now intersects the directory with the Masters the board projection holds.

**Verified live** on the same board after the fix: the card offers **2** Masters, both in the match,
against **20** owned in the world.

### BF. One source carrying two ranks of a group kept both — **fixed 2026-09-30**

**Reached: Semiramis's Territory Creation, TC.stack / TC.1.** Read off a counter Heracles landed on
her aboard the Hanging Gardens: stage 12 carried **two** `Territory Creation` damage negations, **−48**
and **−24** — EX's 3d10+30 and C's 3d10+10 on the same hit.

Both wards are her own auras in the one `territoryCreation` group, EX scoped to the garden and C to
any Home Base, and the garden **is** a Home Base (HG.home), so a Unit aboard qualified for both.
`rules/auras.mjs#resolveStacking` resolved a group by **source**: it found the best-ranked source and
kept every element that source contributed. Two ranks from one source were both "the winner". *"Only
the Territory Creation with the highest Rank takes effect"*, and the sheet's own TC.1 puts EX on the
garden and C on the ground. The winner is now the source **at** its winning rank.

### BG. Every field-wide aura stopped two panels from its bearer — **fixed 2026-09-30**

**Reached: Semiramis's Territory Creation, TC.c.p2, and every other *"while this Unit is on the
field"* aura in the corpus.** With BF fixed, her Master, standing in the ground Home Base three panels
from her, still held **no** Rank C ward, where `collectAuras` asked directly returned it.

`snapshotBoard` resolves auras through the spatial index (`rules/aura-index.mjs`). A field-scoped aura
carries the Aura executor's default `radius: 2`, and the index filed it under that radius, so it was a
candidate only within two panels of its bearer. `collectAuras` skips the distance test for
`scope: "field"`, but it never saw the candidate. Every Territory Creation (Medea, Kingprotea,
Semiramis, the Normal Caster's) reduced damage only near its bearer. The unit tests call
`collectAuras` without an index, which is why they all passed. Field auras now sit on an `unbounded`
list the index returns for every panel.

### BH. Sikera Ušum halved every resistance to Poison, not only one that names it — **fixed 2026-09-30**

**Reached: SIK.d.** *"Units with Poison Resist effects that are not Poison Immune in this area have the
magnitude of those Poison Resist effects halved. Only applies to effects that specify Poison."*
`engine/effect-applier.mjs#chanceContribution` halved every incoming contribution that matched Poison
while the field's downgrade stood, and Poison matches a great deal: Queen's Poison's resistance to
volatile debuffs, Magic Resistance's to debuffs. A Unit holding Queen's Poison in the Throne Room
resisted a 50% Poison at 7.5 rather than 15. Only a contribution that names Poison is halved now.

### BI. A bounded field reached every level above and below it — **fixed 2026-09-30**

**Reached: SIK.d, and every field anywhere near a platform.** Measuring the downgrade with a
differential across two Units, the one meant to be *outside* the Throne Room -- the enemy Master,
standing on the ground at (4,4) under the Hanging Gardens -- was downgraded too. He was a member of the
field: `rules/bounded-fields.mjs#contains` compared `i` and `j` and never the level, so the Throne
Room, twenty levels up, held him, and would equally have let a ground Reality Marble hold a Unit aboard
a platform over it. `openField` now stamps the caster's level on the anchor, `contains` checks it, and
an unstamped field takes its owner's level.

### BJ. A Unit brought into sight by a forced move was never seen — **fixed 2026-09-30**

**Reached: FD.p / FD.a.** Staging Familiar: Doves' active half needed Doves on the enemies, and neither
carried one, though Heracles had fought Semiramis for rounds. Her `seenUnitIds` held **only her own
Master**. `engine/movement-hooks.mjs#onMove` ran the sighting check at its very end, below the early
return for a forced move and the one for a level-only change -- and Heracles had come aboard by
boarding, a level change, and every staging move was forced. *"Whenever Semiramis sees a Unit for the
first time"* does not ask how the Unit got there. Both returns now check sightings first.

### BK. A Bašmu Moved after its Attack — **fixed 2026-09-30**

**Reached: BS.econ.** Bašmu attacked Heracles, and the bar still offered it a Move; `affordable` said
yes. *"A Bašmu can only Move/Attack once per Turn"* is a cap on top of the per-unit limit, and Ch. 19
says exempt units *"still obey their per-unit limits"*. The once-per-Turn branch of
`rules/budget.mjs#canConsume` returned before the no-Move-after-Attack guard, so every
`actsOncePerTurn` summon and every platform skipped it. The branch now applies the same guard, with the
same Riding and `doubleMove` exceptions.

### BL. A Bašmu could Jump off the garden — **fixed 2026-09-30**

**Reached: BS.bound.** Bašmu, standing on the garden's edge, was offered Jump Off. *"Bašmu cannot leave
the HGoB."* `summoning.mjs` stamps `boundToPlatformId` so the teardown can dismiss it, and the teardown
reads it from the document, but `snapshotUnit` never projected it, so nothing in `rules/` could see the
bond. It is projected now, `canUnboard` refuses `boundToPlatform` -- ahead of the edge rung, since the bar
still shows a Jump blocked `notOnEdge` -- and a knockback that would push a bound summon past the edge
holds it instead.

### BM. A 3x3 Bašmu was summoned on top of Semiramis — **fixed 2026-09-30**

**Reached: BS.bound, re-summoning.** A Bašmu summoned through the spell's own phase appeared with its
token anchored at (3,3), diagonally beside Semiramis at (4,4) -- and, being 3x3, covering her panel.
`engine/summoning.mjs#freePanels` tested only the anchor panel for occupancy. The whole footprint must
be free, on the board, and on the platform a bound summon is tied to; *"directly next to her"* is
measured from the footprint's nearest panel. `summonPhase` now reads the largest footprint among the
summons it is about to place, and two summons from one call do not overlap each other.

### BN. A pack rebuild unbound Bašmu from its garden — **fixed 2026-09-30**

**Reached: BS.bound.** After BL's projection, the live Bašmu still read `boundToPlatformId: null`,
though the spell's own summon phase, run again, stamped it correctly. The key is in
`AUTHORED_ACTOR_KEYS` and was not in `SEEDED_THEN_OWNED`, so the content sync put the pack's null back
on every world load after a rebuild -- and this session rebuilt the packs after each issue. The sweep in
`content-sync.test.mjs` looks for `"system.X": value` writes, and `summoning.mjs` writes its stamps with
`Object.assign(data.system, plain)`, which the sweep cannot see. It is world-owned now, like
`summonerId` beside it.

### BO. Bašmu's protection never reached anyone past its corner — **fixed 2026-09-30**

**Reached: BS.guard.** Bašmu moved to stand with its footprint directly next to Semiramis, and she
carried no `untargetableBy`. *"Enemy Units cannot Attack Semiramis or her allied Units if a Bašmu is
next to them."* `rules/aura-index.mjs` bucketed and measured every aura from its source's ANCHOR panel,
the top-left corner of a 3x3, and queried with the recipient's anchor only. `collectAuras`' own
distance test is footprint to footprint, but it never saw the candidate. Only Bašmu itself, inside its
own radius, was protected. The index now measures from both footprints.

### BP. A radius aura reached through the garden's floor — **fixed 2026-09-30**

**Reached: BS.guard.** Auras measured i and j only. A Bašmu on the garden's deck guarded any ally
standing on the ground beneath its footprint, twenty feet down, and every radius aura aboard reached the
ground the same way. The project already reads a Unit below as not beside anybody: `freePanels` for a
summon's placement, `bounded-fields.mjs#contains` since BI. `collectAuras` now refuses a radius aura
across levels. A `scope: "field"` aura stays unbounded, so Territory Creation's C still reaches her
Master in the ground Home Base.

### BQ. The garden's once-per-Turn cap read a record it could not keep — **fixed 2026-09-30**

**Reached: HG.econ.** The garden Moved by drag, and its bar offered Move, Dragon Wing Warriors and
Aerial Garden of Vanity again. `budget.mjs`'s cap reads the platform's `turnState`, and
`PlatformData` declared none: it spreads `unitCommon()` only, and `turnState` lived in
`combatantCommon()`. Every `system.turnState` write to the garden was pruned by its model -- a Hop 3
drop (Ch. 07) that the loud prune would have named, had any test written to a platform in the test
world. The unit test of the cap handed it an in-memory record. The field is now `turnStateField()`,
shared by both. Measured after: one Move, then *"Move — this unit has already acted this Turn"*.

### BR. Aerial Garden of Vanity hit Units standing on the garden — **fixed 2026-09-30**

**Reached: HG.agv.** Aimed so its 7x7 covered part of the deck, the preview read *"2 target(s)"*: Foe
Alpha on the ground, and Heracles, aboard. *"Range=7. Cannot hit under or above the HGoB."* The file's
comment read both halves as the platform's `forbidDirectlyBelow`, which is only "under". Dragon Wing
Warriors, beside it, reaches *"the area under the HGoB and the area of the HGoB"*, so "above" is the
deck. `targeting.forbidAboard` is authored on Aerial Garden of Vanity, and `resolve.mjs` step 4e drops a
Unit standing on the caster's platform.

### BS. Nothing could attack the Hanging Gardens — **fixed 2026-09-30**

**Reached: HG.noreact.** Heracles, aboard, could not target the garden, and a ground archer at Range 3
could not either: *"a platform"*. *"Enemy Units on the ground can only Attack the HGoB with ranged
Attacks"* says they can, and *"its Health drops to 0"* is how it is destroyed. Step 5 of the resolver
drops platforms unless an ability names `kinds`, and no Normal Attack does, so `hullTargeting` (built in
69a4771) was reached by nothing. A platform with Health to lose is now a legal target; the Storm
Border, with none, is still excluded.

### BT. A Unit's Range was measured to a 3x3 target's corner — **fixed 2026-09-30**

**Reached: HG.noreact.** With BS fixed, Heracles beside the garden's middle was told it was *"out of Range
(2)"*: the `targetUnit` anchor measured to the target's anchor panel, the garden's (0,0). Bašmu, 3x3,
had the same blind side, and `counterAvailable` measured a Counter anchor to anchor. Both now measure
footprint to footprint (`geometry.mjs#inAttackRangeBetween`). The garden itself stays unattackable while
a Bašmu stands on it: *"Enemy Units cannot Attack Semiramis or her allied Units if a Bašmu is next to
them"*, and the garden *"counts as a separate Unit"*.

### BU. Bašmu could not knock anybody back on the garden — **fixed 2026-09-30**

**Reached: BS.move.** Bašmu moved onto Heracles and he did not move. `knockbackPanel` asked `occupantAt`
whether each landing was free, and `occupantAt` counts the platform, whose footprint covers every panel
of its own deck. Bašmu only ever moves on the garden, so every landing was taken and every push failed
quietly. Landings are now judged free of Units: a platform or a structure is stood on, as `canStopOn` and
`freePanels` already say. Measured after: a Bašmu moved onto Semiramis and she was pushed from (4,4) to
(5,4).

### BV. Every turn-end step ran for the faction about to act — **fixed 2026-09-30**

**Reached: the audit board itself.** A reload turned Faction 1's Turn into Faction 2's, mid-Turn.
`takenThisRound` read `[faction-1]` though Faction 2 had just acted, and `turnOrder` had been re-sorted
to match, so a client that sorted afresh found Faction 2 at the current turn index. The cause is
Foundry's: `combatTurnChange` receives `combat.previous`, and `Combat#_onUpdate` refills that object with
the current state on every update. `onTurnChange` awaited `claimBoundary`, which writes to the Combat,
and read `prior.combatantId` afterwards. Since `claimBoundary` arrived on 2026-09-16, every turn-end step
-- the ending faction's `turnEnd` handlers, `advanceChannels`, `markTurnTaken` -- ran for the incoming
faction. Evidence gathered since then on turn-end Clauses deserves a second look. The combatant is now
copied before the first await; the board's corrupted order was repaired by hand.

### BW. The Jump offered landings it could not pay for, off the board's edge — **fixed 2026-09-30**

**Reached: HG.jump.** Heracles on the garden's edge with 6 panels left was offered landings 6 panels
away. The jump costs the distance plus one, so a 6-panel landing costs 7: `jumpLandings` reached the
full allowance and `jumpOff` then wrote a `movedPanels` past his MOV. The reach is now one short, and
`jumpVerdict` refuses a Unit with a single panel left. The bounds check read `rows`/`cols`, which a real
board's `{iMin, iMax, jMin, jMax}` does not carry, so nothing clipped the far edges.

### BX. Every boarder appeared in the garden's corner — **fixed 2026-09-30**

**Reached: HG.board.dww.** Foe Alpha boarded from under the garden's eastern edge at (4,8) and appeared at
(0,0), its north-west corner. `boardPlatform` moved the boarder, and a Master it carried, to
`platform.panel`, the anchor; two boarders shared one panel. `boardingLanding` puts the boarder directly
above where it stood, or on the nearest free deck panel, and a carried Master beside its Servant on a
panel of its own.

### BY. Nobody saw a boarding roll — **fixed 2026-09-30**

**Reached: HG.board.master.** Heracles rolled 1 against 8 and the player read *"That cannot be used right
now"*. `boardPlatform` wrote the roll to the scheduler log only, and a failure came back with no reason,
which the action bar filled with its generic refusal. A success was visible only as a token moving. The
attempt is now announced in chat, die, roll, target and any relief, and a failure returns
`boardFailed`. The allied walk-on path of a `byRelation` platform took the anchor corner as well, and
now lands through `boardingLanding` too.

### BZ. A knockback pushed each Unit once per level layer, from where the mover had been — **fixed 2026-09-30**

**Reached: HG.knock.** A Bašmu dragged over Heracles, on the garden's edge, and his Master knocked
Heracles off three times: the log held three `knockedOff` entries and his Health went 866 → 576. The
board lists each panel of a Unit once per level layer it occupies -- k 20, 21 and 22 for a Bašmu -- and
`knockBackOccupants` visited every entry. It also read the mover's footprint off the token, which at
`moveToken` still reports where it came from, so the Master was pushed into the square the Bašmu then
stood on. `rules/movement.mjs#knockbackPlan` now plans every push before any is made: each Unit once, from
the footprint in the movement's destination, each landing judged against the pushes already planned.
Platforms, structures and panel-sharing Units are stood on, not pushed.

### CA. Nobody saw a fall's Agility Check — **fixed 2026-09-30**

**Reached: HG.knock.** Heracles fell off the garden with no card; the check was rolled in
`engine/platforms.mjs#knockOff` and only his Health showed it. The fall is announced now: the d20, the
target, and whether the Unit kept its footing, chose to drop, was caught by its Servant, or fell and took
the Platform's damage.

### CB. A Servant was offered to bring a Master who was already aboard — **fixed 2026-09-30**

**Reached: HG.knock.save.** Heracles boarded from the ground with his Master on the deck above him and
was asked *"Bring your Master aboard?"*. `mayBringMaster` measured i and j and nothing else. It now
requires the Master on the Servant's own level, which is also what the Jump's *"Master directly next to
it"* means.

### CC. A Master caught by its Servant stayed on the panel the Bašmu had taken — **fixed 2026-09-30**

**Reached: HG.knock.save.** The Bašmu moved onto Heracles's Master on the garden's edge; the Master failed
its Agility Check, Heracles caught it, and the Master stayed on its panel -- inside the Bašmu's new
square. `fallOff` reads *"its Master is not knocked off"* as not moved, and in general that holds; but a
knockback must still clear the mover's space. A Unit left aboard by a knock -- caught, or kept its
footing -- is now moved off the mover's footprint to the nearest free deck panel, which also covers the
passed check's own landing, chosen from a board on which the mover had not yet arrived.

### CD. A fall rolled a constant, and a landing Master's Overpower was never rolled — **fixed 2026-09-30**

**Reached: HG.knock.master.** Heracles's Master was knocked off the garden; the log recorded
`overpowerRequired` and nothing else. *"A Master knocked onto the Game Board performs an Overpower roll,
as though Attacked by a Servant"* -- `engine/platforms.mjs#toIntents` turned the descriptor into a log
line nobody read. The same function rolled a hard-coded `10*2d6` for every fall, whatever the Platform
authored in `knockOff.damage`. The fall now rolls the Platform's own formula (`fallFormula` reads the
sheets' `10x2d6`) and a landing Master flips the attack path's own Overpower coin, announced in chat; a
lost flip defeats it. A missed rescue is shown too. Not built: the Luck Check that saves a Master from
Overpower -- `state.luckChecks.overpower` has no writer on the attack path either, which is a wider defect
than this Servant's and is filed as #111.

### CE. Damage from outside an attack could not defeat anyone — **fixed 2026-09-30**

**Reached: HG.knock.** Heracles was knocked off the garden at 0/1500 Health, not defeated, and the fall
dealt him more. Only the attack path ever ran the defeat chain (`attack.mjs#resolveDefeatOf`); a Poison
tick, Mad Enhancement's drain, a fall off a Platform or the garden's destruction damage lowered Health
through the applier and stopped there. Semiramis's Poison, the weapon her whole kit is built around,
could take a Unit to 0 and leave it standing. The applier now asks `io.defeatIfLethal` after any damage
intent without a breakdown, which runs the same chain an attack does -- revivals included -- with nobody
as the killer. Heracles, still at 0, was not defeated retroactively; the board was left as found.

### CF. No Master could attack once the budget had been saved — **fixed 2026-09-30**

**Reached: HG.knock.master.** Heracles's Master's bar read *"Attack — Master attacks exhausted (0/0)"*.
`masterAttack`'s maximum is `Infinity`; the budget lives on a Combat flag, JSON stores `Infinity` as
`null`, and `usedHalves + cost > null` compares against 0. Every faction's budget is written at its Turn
start, so from then on no Master in any match could attack. Not a Semiramis Clause -- found on her board,
and fixed: `canConsume` reads a `null` maximum as unlimited.

### CG. A Servant on the ground could catch its Master falling off the deck — **fixed 2026-09-30**

**Reached: HG.knock.master.** `rescuerFor` found the Master's Servant by i and j alone, so Heracles,
standing on the ground below the garden's edge, would have caught his Master falling from the deck above
him. *"A Master who is directly next to its Servant"* means beside it on the same level; the search now
requires it, as `mayBringMaster` does (§46.4-CB).

### CH. Nothing destroyed the garden: not its Health, not her defeat — **fixed 2026-09-30**

**Reached: HG.destroy.** *"The HGoB is destroyed when Semiramis is defeated or its Health drops to 0."*
`destroyPlatform` had three callers: an effect on the owner (`deactivateOn`), an unpaid upkeep, and a
field's closing. A platform taken to 0 Health ran the ordinary defeat chain and stayed in the air; a
defeated Semiramis left her garden flying. Neither mattered while nothing could attack a platform
(§46.4-BS). The applier's `defeat` case now asks `io.destroyPlatformsOf`: a defeated platform is
destroyed, and so is one authoring `destroyedWithOwner` when its owner is -- declared on `PlatformData`,
projected, routed in the survival test, and authored on the Hanging Gardens.

### CI. The garden's destruction rolled nobody's check — **fixed 2026-09-30**

**Reached: HG.destroy.** *"All Units on it perform either an Agility Check or a Luck Check roll. If the
roll fails, the Unit takes 100 Fixed STR damage. A Master who was within a 2 panel area of its Servant
does not need to roll if its Servant succeeded."* `destructionSequence` takes the saves from its caller,
and `destroyPlatform` passed none: every passenger took the 100, unrolled and unannounced, and the
Master's exemption had nowhere to apply. Each passenger now rolls the better of the two checks -- the one
its player would choose -- `destructionSaves` spares a Master whose Servant passed within 2 panels, and
the outcome is posted as one card.

### CJ. The garden's passengers were not scattered — **fixed 2026-09-30**

**Reached: HG.destroy.** Semiramis and Foe Alpha landed at (5,3) and (0,0) on the ground, the panels they
had stood on aboard. *"All Units onboard the HGoB are randomly scattered below it."* The `scatter`
descriptor reached `toIntents`' default branch and was logged; `scatterToGround` only changed the level.
`scatterPanels` now draws a random free ground panel under the footprint for each passenger, no two
alike, and the engine moves them there before the level goes.

### CK. Every Noble Phantasm opened an attack card, damage or not — **fixed 2026-09-30, ruled by the user**

**Reached: HGB.act, re-activation.** Pressing the Hanging Gardens opened a Combat Process against
Semiramis herself: *"Choose a reaction — Do nothing / Block / Evade / Scales of the Sacred Fish /
Interrupt with a Command Spell"*, resolving to 0. `classifyAbility` called every Noble Phantasm an attack.
The user ruled: *"It doesn't make sense for these kind of thing to open an attack card, as it doesn't
have a damage phase, same with effect application-only abilities"*, and then *"NPs (even non-damaging
ones) consume the Attack budget, and they can be used as a counter. But yes, they technically aren't an
attack in the sense that you wouldn't walk through the ladder/rung."* So:

- `classifyAbility` calls an ability an attack only when it deals damage. Twenty-one Noble Phantasms in
  the corpus moved to the Skill path (fields, platforms, summons, effect-only NPs); none of the Attack
  Skills or Spells did, since every one deals damage.
- `countsAsAttack` keeps every used NP on the Attack budget, and `useSkill` bills it `np`, so NP Seal
  still refuses it -- the Skill path used to bill everything attack-shaped as `attack`.
- A non-damaging NP still answers a Counter (`answersACounter`), resolved by `resolveWithoutProcess` with
  no ladder; one that touches only its user need not catch the attacker.
- Two NPs authored `passive: true` with nothing to use were clickable attacks; they are passives now.
- A Unit that is the harmless subject of its own ability skips its reaction rung even on the attack path
  (`harmlessToSelf`), for a branch that resolves to `fixedValue: 0`.

### CL. The Hanging Gardens' 3◈ took nine Rounds — **fixed 2026-09-30**

**Reached: HGB.act.** The re-activation opened `{ticksRequired: 9}`, and `advanceChannels` added one
only at the end of the bearer's own Turns -- nine Rounds, where *"cannot Act for 3◈ Turns"* is three:
1◈ is a Round of Turns (Ch. 04), and an effect's `expiresAt`, a cooldown and Nemo's dimension clock all
count the global Turn. The channel's comment claimed Sustainability's scale for the choice. It now runs at
every Turn's end, for every channelling unit, from the Turn it began in (`channelProgress`). The previous
session's HGB.act evidence -- *"nine of her own Turns of `elapsedTicks`"* -- measured the defect. Measured
before §46.4-BV the count also fired on the wrong faction's boundary, which happened to land once a Round
as well.

### CM. Every targeting review confirmed with "Attack" — **fixed 2026-09-30**

**Reached: HGB.act, PC.6, CK's live check.** The review dialog's confirm button read *Attack* for the
Hanging Gardens' activation aimed at Semiramis herself and for De Sterrennacht's five effects. It now reads
*Use* for an ability `classifyAbility` does not call an attack, which since §46.4-CK is every ability
that deals no damage.

### CN. A defeated Unit was still ticked at every boundary — **fixed 2026-09-30**

**Reached: SIK.1, on the noDsc board.** The noDsc Semiramis, summoned without a Master, paid Sikera Ušum's
4 Sustainability and was defeated with 0 left. From then on the log held `disappear` at every Turn, and
her Construction kept rising at every Turn's and Round's end (35 → 41 → 53 → 59 → 69) under a
**Defeated** effect. A defeat never removes the token, and the scheduler's four boundaries walked every
Unit on the board. They now act on the living only, and `checkRemovals` skips a Unit already defeated.

### CO. The Dragon Wing Warriors boarding relief could never apply — **fixed 2026-09-30, ruled by the user**

**Reached: HG.board.dww.** *"If the Unit attempts to board the HGoB on the same Turn it was Attacked by
the HGoB's Dragon Wing Warriors, the roll value required is reduced by 2."* The attack is made on
Semiramis's Turn and a boarding on the boarder's own, so the per-Turn `turnState.attackedBy` was always
stale by the time it was read: Foe Alpha, hit at tick 56, boarded at tick 58 needing 8. Ruled: *"for now
let's say HG.board.dww is 'same Round' instead of turn"*. `attackedBy` moved to the Round Record
(`roundState`), written with `markRoundState` and read by `boardPlatform` against the current Round.

### CP. A defeated Unit still projected its auras and was still offered as a target — **fixed 2026-10-01** (#168)

**Reached: the Quetzalcoatl paper trace (#65).** Medea was defeated at tick 18, and at tick 25 Ehecatle's Sap
on Nemo, two panels from her body, read *resisted — rolled 97 vs 50%*: the 50 was her Item Construction. The
same preview listed "Medea 520–610" as a checked target. §46.4-CN's other half: a defeat never removes the
token, so every reader that walks `board.units` meets the corpse. `collectAuras` now skips a defeated
source, and `resolveTargets` drops a defeated Unit with the reason `defeated`, so the preview lists it under
NOT TARGETED. The sweep that followed found the same gap in `guardsOf` (a dead Servant protected its Master,
redirected a Counter, denied the zone and covered), in the Decoy and Compulsion readers (a dead Decoy or Greek
Male would now have left the attacker no legal target), in `allyReactions`, in the Discover watchers, in
`rescuerFor`, and in the contract's enemy-clearance test. `test/unit/defeated-readers.test.mjs` holds them.

### CQ. A Riding Attack could not be started from the interface — **fixed 2026-10-01** (#113)

**Reached: RI.p2, RI.p2.stop and RI.p2.left.** The action bar handed every targeted action but Attack to
`Hooks.callAll("fgtEnterMovement")`, which nothing listened for, so `performRidingAttack` ran from the
console only, and `ridingAttackPath`, the only writer of `turnState.usedRidingAttack`, and Troias
Tragōidia's `ridingAttack` block were dead with it. `rules/movement.mjs#ridingDestinations` now lists
every panel `ridingAttackPath` accepts, so the overlay and the engine are one rule, and
`apps/canvas/targeting-layer.mjs#pickDestination` paints them for the bar and for an ability that
classifies as `ridesAsAttack`. Measured after: the slot opened the overlay and the ride ran, 12 panels
north at tick 43 and 5 panels through W1, which took 229, at tick 61. Ten other `fgt…` hook names still
have no `Hooks.on` (listed in #113, not looked at).

### CR. A Riding Attack skipped every gate a drag and an attack both pass — **fixed 2026-10-01, pressed live 2026-10-04** (#114)

**Reached: the Quetzalcoatl paper trace (#65).** `ridingAttackPath` tested straightness and the MOV
allowance and nothing else, so a ride could end off the board, on an occupied panel or beside a guarded
enemy Master, leave a field it may not leave, run from a Decoy, and hit Units on other Levels, platforms
and Structures, because its path targets never reached `resolveTargets`. `performRidingAttack` also moved
the token and stamped the Turn Record before `resolveAttack` ran its own gates and threw. The ride now
goes through `canPassThrough` (an enemy in the line is hit, not in the way), `canStopOn` and the pursuit
and Decoy verdicts; Immobilize prevents it; its hits come from the rider's Level through `resolveTargets`;
and `engine/attack-preflight.mjs#attackPreflight`, extracted from `resolveAttack`, runs before anything
moves. Found by reading the code; not seen on a board.

### CS. A Riding Attack never carried the Master — **fixed 2026-10-01** (#115)

**Reached: RI.combo.** Every Riding sheet says the ride *"can be combined with Passenger Seat"*. The carry
was `movement-hooks.mjs#carryMaster`, which runs from `moveToken` and returns for any forced move, and
`performRidingAttack` moves the token with `displaceToken`, which is forced: the Master stayed behind and
nothing was logged. The body moved to `engine/passenger-seat.mjs#carryMasterAlong`, which takes two panels
instead of a movement operation; the drag's hook is a wrapper and the ride calls it right after its
displacement, with the same grant, `carriesMaster` switch and log entry and no pool spent. Measured after:
her Master rode (13,4) → (1,4) at the same offset, tick 43.

### CT. Riding's Active was a free toggle whose +MOV outlasted "this Turn" — **fixed 2026-10-01** (#116)

**Reached: RI.a and RI.cd.** The Active has `activeRules` and no `phases`, so it classifies as a mode, and
the toggle called `useSkill` only for a mode with phases: the sheet's 3◈ cooldown was never gated, billed
or started, and the MovDelta's `duration: "this turn"` stopped at `statDeltas`, since a derived delta
lasts as long as its source (`system.active`), which nothing switched off. Seen live: MOV 13 into Round 2,
and a toggle off and on again in one Turn with `cooldown.remaining` 0 throughout.
`rules/modes.mjs#pricedOnEntry` now sends the switch-on through `useSkill`, and `endsWithTurn` lets the
end-of-Turn step in `scheduler-hooks.mjs` switch the mode off. Measured after: cooldown 9 (3◈) and MOV 7 →
13 at tick 43, MOV 7 again at the Turn's end, tick 44.

### CU. Double Move was decided by an item's name, not by the doubleMove grant — **fixed 2026-10-01, pressed live 2026-10-04** (#117)

**Reached: the Quetzalcoatl paper trace (#65).** The drag gate was handed `unit.hasRiding`, an item slug
or name match, and `canConsume` ORed it with the grant, so the grant was neither necessary nor sufficient:
Pollux and Drake, whose sheets unlock Double Move only on the Turn of the Active, and Pale Rider, whose
Riding grants none, could Move after an Attack every Turn. `rules/movement.mjs#segmentCheck` and
`rules/budget.mjs#canConsume` now ask `hasGranted(unit, doubleMove)` and nothing else; the `hasRiding`
projection, `hasSkill` and the option on `validatePath` and `planMovement` are deleted. Quetzalcoatl's
RI.p1 had been right by accident of the item's name.

### CV. Passenger Seat refused a Master who stood one move behind the Servant — **fixed 2026-10-01, pressed live 2026-10-04** (#118)

**Reached: the Quetzalcoatl paper trace (#65).** The carry runs from `moveToken`, where Foundry still
reports the Servant at her origin until the animation ends, and the landing is the Master's panel plus her
delta. A Master exactly one move behind her, which is the ordinary 1-panel follow, landed on her origin,
`occupantAt` found her there and the carry refused: *"could not ride along: the landing panel is
occupied"*. `rules/movement.mjs#passengerLanding` treats her as already standing on her destination, and
`passenger-seat.mjs#carryMasterAlong` asks it; off the board and a panel held by somebody else still
refuse. The same stale-board timing as §46.4-BZ.

### CW. Riding's Active was refused by No Buff and by a buff immunity — **fixed 2026-10-01, pressed live 2026-10-04** (#119)

**Reached: the Quetzalcoatl paper trace (#65).** For Medusa, Drake and Pollux the Active is a used ability
that applies `ridingActive`, the MOV Up and the marker their Riding Attack and Passenger Seat ask for. The
effect was `polarity: buff`, and `applyEffect` gates every buff on No Buff and on a buff-scoped immunity,
so under either the Active applied nothing and the grants went with it, though the sheets say the MOV Up
is not a buff and Appendix A lists it among the statuses No Buff never blocks. It is `polarity: status` in
`packs/_source/effects/riding-active.yml`. Quetzalcoatl was never affected: her Active is a mode. See
§46.4-DJ for the same question about S.Crit Up.

### CX. Drake's Riding carried the literal cooldown "@cooldown", and the build guard stripped it before it checked — **fixed 2026-10-01, pressed live 2026-10-04** (#120)

**Reached: the Quetzalcoatl paper trace (#65).** `drake.yml` passed no `cooldown` beside
`class-riding-drake`, so her compiled Riding held `"@cooldown"`, which Foundry's `TickField` refuses:
strict construction refuses the Item, a lenient load falls back to `null`, and either way her Riding had
no cooldown. `npm run validate:content` printed 0 Silent Drops because `model-check.mjs` stripped every
whole-string `@name` from every document, embedded Items included, and the duration validators skipped any
`@` value. `drake.yml` now passes `cooldown: "2◈"`; `tools/lib/content.mjs#resolveRef` refuses a rank,
cooldown or duration still holding a placeholder, naming the ref and the parameter; the model check strips
slots only from a standalone template.

### CY. The summon dialog's Region list omitted three Regions that Servants carry — **fixed 2026-10-01, pressed live 2026-10-04** (#121)

**Reached: SB.** The dialog offers `Object.keys(REGION_ADJACENCY)`, thirteen ids, and Quetzalcoatl's
`centralAmerica` and `southAmerica` and Anastasia's `russia` were not among them, so a war that gives
either her +1 rank could be made only by typing the exact camelCase id into the wizard's free-text field.
The three ids join `rules/environment.mjs#REGION_ADJACENCY`, with the edges
`centralAmerica`-`southAmerica` and `russia`-`europe` in both directions and none touching `middleEast`,
so Semiramis's counter is unchanged. A guard holds every `region` id in `packs/_source/servants` to being
a key of the graph.

### CZ. The shared Riding text printed none of the rules it grants — **fixed 2026-10-01, pressed live 2026-10-04** (#122)

**Reached: the Quetzalcoatl paper trace (#65).** No behaviour changed. `class-skills/riding.yml` printed
the names of its grants and none of the rules they switch on (the straight line, the stop, MOV minus the
panels already Moved, the relative position, one Unit) and no cooldown, and linked `@effect[movUp]` inside
the sentence that says the MOV Up is not a buff. Comments said that nothing reads Passenger Seat
(`rules/granted.mjs`), that `mayMoveAgain` holds the mutual exclusion, that the engine "already performs"
a ride, and that her Riding is word-for-word the shared document. Pale Rider's MOV now reads `ridingMov`
at EX instead of a flat 6 under a comment that said EX is not a row of that table.

### DA. A debuff from a Skill that deals no damage ignored the target's resistance — **fixed 2026-10-01, pressed live 2026-10-04** (#123)

**Reached: the Quetzalcoatl paper trace (#65).** `applyPhaseEffects` handed `applyEffect` a context with
`resist: 0`, and the applier reads the target's own resistance with `ctx.resist ?? resistanceOf(target)`;
`0 ?? x` is `0`. Every incoming `ApplicationChance` was skipped on the Skill path: Jack's Information
Erasure read `100% (automatic)` on Quetzalcoatl where the attack path gives `rolled 99 vs 25%`, and
Medea's Atlas ignored her Magic Resistance. The attack path had already fixed exactly this. The context
literal is now `engine/skill-use.mjs#skillEffectContext`, exported, and carries no `resist`; a corpus
guard fails on a literal `resist:` key anywhere in `module/engine` outside the applier.

### DB. The targeting preview tested Magic Resistance against the user's MAG, the resolution against the ability's Rank — **fixed 2026-10-01, pressed live 2026-10-04** (#124)

**Reached: the Quetzalcoatl paper trace (#65).** Stage 11 takes `ctx.attack.rank ?? attacker.mag`. The
resolution set the ability's Rank and the preview built its attack with none, so Karna's Brahmastra (A+,
MAG B) at her Magic Resistance A read *"negated: MR A >= attack B"* in the preview and was halved by the
card, and A Tale for Somebody's Sake (C, MAG A) was halved by the preview and negated by the card: nine
abilities and 44 ability-and-defender pairs disagreed. The preview also sent no `npTags`.
`engine/attack.mjs#attackIdentityOf` now builds Rank, scale tags, NP category and element in one place for
the resolution, the counterfactual and `previewContext`, which moved into `attack.mjs`. The gate and the
display disagreeing, §46.3.

### DC. A Skill that counts as Divinity was invisible to skill:divinity — **fixed 2026-10-01** (#125)

**Reached: GDC.div.** `rollOptionsFor` emitted `skill:<slug>` and `skillRank:<slug>:gte:<grade>` from each
ability's own slug and never read `categorizedAs`, while `hasCategory` and `categoryRankOf` did, so
Goddess's Divine Core was Divinity to Achilles's and Ozymandias's clauses and "no Divinity" to Vasavi
Shakti, which paid ×2.5 against it where ×3.0 is meant. `rules/items.mjs#categoriesOf` is now the one
reader of "has Skill X at Rank R" for all three, and a Unit's own collection pass hands `rollOptionsFor`
`rank`, `categorizedAs` and `categorizedWhile`. Measured after: her options as a defender carry
`target:skill:divinity` and `target:skillRank:divinity:gte:EX`, tick 40.

### DD. A flat bonus's supersedes never fired, so Piedra Del Sol stacked +180 on Divine Core's +120 — **fixed 2026-10-01** (#126)

**Reached: GDC.p1 and PDS.1.** `FlatDamage` stamps `sourceContentId` and stage 7 drops a bonus another one
supersedes, but `contributionsOf` built the ability record without `contentId`, so the bonus always
carried `null` and Core plus the stone added +300 where the ruling is +180. #103's test passed `contentId`
in by hand and agreed with itself, not with the projection: a Silent Drop.
`rules/snapshot.mjs#abilityRecordOf` builds the record in one place for `contributionsOf` and for
`attack.mjs`'s `windowAugmented`, which wrote the same shape by hand and dropped the id too, and
`survival.test.mjs` routes the record as a Hop of its own. Measured after: *"Goddess's Divine Core
(superseded by Piedra Del Sol) 0 · Piedra Del Sol +180"*, tick 39.

### DE. An effect delivered by an event rider was tested against an empty option set — **fixed 2026-10-01, pressed live 2026-10-04** (#127)

**Reached: the Quetzalcoatl paper trace (#65).** Latent: no content is wrong today. `resolveEffects`, the
path every `OnEvent`, scheduler and field `ApplyEffect` takes, called `applyEffect` with `options: new
Set()`, so Magic Resistance's Instakill and Death exemption (`not attack:component:str`, `not
attack:ignoresMagicResistance`) passed both tests and could never apply to a rider-delivered Death:
`rolled 99 vs 75%` where the attack path gives `100% (automatic)`. The `ApplyEffect` action in
`scheduler.mjs` now copies the event's `attack:*` options onto the effect as `attackOptions`, and
`engine/applier.mjs#riderOptions` builds the set from them; the key is read once and not stored.

### DF. Guts revived nobody — **fixed 2026-10-01** (#128)

**Reached: GGW.1.** `guts.yml` authors `restore: {percentOfMax: "@magnitude"}`, and `resolveRuleValues`
substituted the instance magnitude into `value`, `npValue` and the named carriers, never into `restore`,
so the literal string resolved to 0%: every Guts spent itself, restored nothing and left its bearer
defeated (Quetzalcoatl's Good God's Wisdom, Nemo's Indomitable, Van Gogh's Imaginary Numbers Arts). The
same shape as §46.4-AU. `rules/snapshot.mjs#resolveRuleValues` now treats `restore.percentOfMax` as a
named carrier. Her projection carried `revivals [{guts, percentOfMax 10}]` at tick 40; the revival itself
waited on §46.4-ER.

### DG. A chooser: chosen ability could never be used from the interface — **fixed 2026-10-01** (#129)

**Reached: GGW.scope, GGW.1, GGW.2 and every Xiuhcoatl press.** The targeting session built `chosenIds`
from `resolved.units`, which a `chosen` selection leaves empty, and the resolver read the empty list as
"the player chose nobody": 23 abilities were refused. Seen live at tick 7: Xiuhcoatl previewed *"0
target(s) · 1 panel(s) — Legal"* and then *"Nothing is in the area. Aim again?"*.
`rules/targeting/resolve.mjs#validate` now settles a choice among one candidate (21 of the 23 name their
Unit with the anchor); two or more open the review as a pick, whatever `targetingReview` says; a choice
that survives to the engine is refused, so a macro no longer pays and resolves against nobody. Measured
after: the choose dialog listed her allies and refused the enemy, ticks 18 and 33.

### DH. A Skill used from a player's client could not write what it paints, raises or buffs — **fixed 2026-10-01, pressed live from a Player client 2026-10-04** (#130, #144)

**Reached: the Quetzalcoatl paper trace (#65).** A non-attacking ability, and every damage-less Noble
Phantasm since §46.4-CK, ran `useSkill` on the client that pressed it. A Player cannot create a Region
with a Behavior, an Actor, a Token or a Level (no permission can be given for a Level), and is refused a
buff on another player's Unit: a player's Charisma of the Sun would apply its own buffs, throw, paint no
Day and set no cooldown. `net/operations.mjs#OPERATIONS.useSkill` runs it on the GM, and the questions a
Skill asks go to the owning player through `engine/ask.mjs#chooseFor`; `OPERATIONS.deactivateField` does
the same for the End control; `onMove` repaints a following area from the active GM only. Nobody has
pressed it from a Player client: a single-GM board cannot show it.

### DI. Crit Up, S.Crit Up and Crit DmUp raised a Noble Phantasm's crit at full value — **fixed 2026-10-01, pressed live 2026-10-04** (#131)

**Reached: CS.2, LL.1 and LL.2, ruled by the user.** Appendix A says the crit family is *"Not NP unless
stated"*, and both readers fell back to the full value: `checks.mjs#critModifiers` returned `npValue` only
when stated, and stage 2's `sumCritMods` went through `magnitudeOf`, which does the same. After Lucha
Libre her Xiuhcoatl crit automatically and with +50% crit damage. Against an NP a crit modifier now
contributes its `npValue` and 0 where none is stated (Crit Up (Viy)'s 20 against 50 still wins). Crit
chance also asked `attack:kind:np` where the pipeline asks `isNPAttack`, so an attack categorized as an NP
was an NP in stage 2 and a Normal Attack in the coin. The `G.Crit` and `No Crit` short-circuits are left
alone.

### DJ. S.Crit Up's "application cannot be prevented" loses to No Buff and Buff Immune — **open, needs a ruling** (#132)

**Reached: CS.2.** `s-crit-up.yml` models *"application cannot be prevented"* as `baseChance: 500`, which
beats resistance at the chance step and nothing else; `findImmunity` runs before it and refuses any buff
to a Unit holding `noBuff` or a buff-scoped immunity. Probe on the real projection: a plain ally
`applied`, an ally with `noBuff` `blocked`, an ally with a scoped immunity `blocked`, and `applied` for
both with `bypassesImmunity: true`. Nobody applies No Buff today, so the difference is latent. The
question for the author: does No Buff, or a buff-scoped immunity, count as preventing it? Yes is one line
of content; no is a reworded catalogue row. Decide with §46.4-CW, which has the same gate.

### DK. A concealed ally could not be chosen by an allied Skill — **fixed 2026-10-01, pressed live 2026-10-04** (#133)

**Reached: the Quetzalcoatl paper trace (#65).** Step 7 of `resolveTargets` dropped every concealed Unit
from a chosen or counted selection whatever its relation, but Presence Concealment clause 1 forbids less:
*"cannot be targeted for an Attack or an enemy Unit's Skill"*. A concealed ally could not be healed,
guarded or buffed by Teachings of Circe, Scapegoat, Surgical Procedure, AR or Primordial Rune, nor, once
§46.4-DG landed, by Good God's Wisdom. `ability-use.mjs#targetSpecFor` now says whether the use is an
Attack (`limits.forAttack`) and step 7 keeps a concealed ally for a use that is not; a spec that does not
say is an Attack. §46.4-AK fixed the token-visibility half of concealment; this is the targeting half.

### DL. "Day Round" was read from the Round clock in one clause and from the panel in four — **open, needs a ruling** (#134)

**Reached: CS.3.** Jack's Murderer of the Misty Night reads `board.phase` (`attack.mjs`); Maria the Ripper
(`roundPhase`), Ozymandias's Pharaoh of the Hot Sands (`self:phase:day`), Soaked clause c and the Dark
modifiers read `phaseAt`, the panel, which Quetzalcoatl's Sol repaints to Day. On a Night Round inside
Sol, Jack cannot use Maria the Ripper and Ozymandias's Crit Up clauses fire while Jack's pre-emption stays
free. The spend of Sol is Observed (§46.15.3): Ozymandias's clauses 2 and 3 applied during a Night Round.
The question for the author: does *"Day Round"* mean the Round clock or the panel? Option B, the panel for
all five, moves one reader (Misty Night to `phaseAt`) and keeps Ch. 26 and Ch. 29's model.

### DM. A top-level damage.sources on a primary damage block was never read — **fixed 2026-10-01** (#135)

**Reached: XI.ba.** Xiuhcoatl authored *"BA(STR) plus half of BA(MAG)"* as two sources at the top of the
damage block; `baseSpecFor` read `damage.base`, failed, and built one source from `component: str`, so she
dealt 500 at ×4 where her sheet says 1000. The block reaches the Combat Process and is read only for an
aftermath, so the key dropped at a Hop and nothing failed; the card, the sheet preview and the NP ranking
all read the same way and agreed. `rules/damage/instances.mjs#damageBaseOf` is now the one reader for all
four, and the validator refuses a block that declares both spellings or a key outside `DAMAGE_BLOCK_KEYS`.
Measured after: stage 1 *"BA(STR) × 1 +125 · BA(MAG) × 0.5 +125 = 250"*, tick 79.

### DN. An aftermath was the primary's attack spec with a few keys painted over it, and declared the ability a second time — **fixed 2026-10-01** (#136, #137)

**Reached: XI.splash.** `declareAftermath` overlaid four keys on the primary's spec and `applyDamage`
re-read the rest from the primary's block, so Xiuhcoatl's splash inherited *"Fire damage (half)"* where
the sheet says plain Fire (187 against 125 on a Waterside defender), its Magic Resistance exemption, the
DU's single panel as `areaPanels`, and the primary's Total Damage. It also called `declareProcesses` with
the same ability, so the caster phases and `abilityUsed` ran twice and the Units the splash caught skipped
the Hanging Gardens' interrupt. `engine/attack.mjs#damageBlockFor` answers the aftermath's own block and
`aftermathSpecFor` builds its spec from the panels it caught; `declareProcesses` takes `declaresUse`.
Measured after: BA(MAG) ×1, whole Fire, Magic Resistance applied (ruling 2), and one Xiuhcoatl charged her
Master 60 once, ticks 39 and 69.

### DO. Xiuhcoatl's splash applied its riders twice, before the damage they ride on — **fixed 2026-10-01** (#65)

**Reached: XI.splash.seal.** At tick 39 each splash target ran its riders twice: W1 *"NP Seal resisted 94
vs 25% · Burn applied · NP Seal resisted 30 vs 25% · Burn already present"*, her Master *"NP Seal resisted
47 vs 25% · Burn applied · NP Seal applied · Burn noop"*. `applyAbilityEffects` is called twice per
resolution, `beforeDamage` and then the default `afterDamage`, and the aftermath branch ignored `when` and
answered both. It now answers only `afterDamage` (89362b9); Xiuhcoatl is the only ability with aftermath
effects. Measured at tick 69: one roll each, NP Seal *"resisted 65 vs 25%"* and Burn applied on the Sphinx
Queen, *"resisted 35 vs 25%"* on her Master.

### DP. A platform's occupants were dropped from every cross-level resolution — **fixed 2026-10-01** (#138)

**Reached: QZ.aoe, QZ.aoe.m, QZ.aoe.m.fx and QZ.untgt.** Step 4d refused every occupant of a platform
authoring `occupantTargeting: forbidden` for every caster and every kind of resolution, so an ally's buff
on a rider was refused, an enemy Skill was barred where her sheet bars only an Attack, and an area reached
nobody aboard: `aoePassengerFactor`, the sheets' *"50% Total Damage"*, and `aoeMastersImmune` were read by
tests alone. `rules/platforms.mjs#crossLevelLegal` takes the resolution's reach and shape, with
`crossLevel.protectedFrom` and `protectedAgainst` authored per platform; an area catches an occupant,
drops a Master whose platform spares him, and keeps the rest with a `platformFactor` that stage 15
multiplies in. Measured after: mount 656, Quetzalcoatl 123 (stage 11 493 → 246.5, then stage 15 ×0.50 →
123.25), her Master untouched, tick 16.

### DQ. Every platform's end rolled the Hanging Gardens' destruction check — **fixed 2026-10-01** (#139)

**Reached: WS.deact, WS.force and the mount's defeat (ruling 12).** `destroyPlatform` rolled a check for
every passenger and `destructionSequence` dealt 100 Fixed STR to each who failed, whatever ended any
platform, though only the Hanging Gardens' sheet states the ladder. The Quetzalcoatlus's forced close
fires with her Master at 25 Health or less, so it could kill him. Following ADR 0001, a platform now
authors a `collapse` block (`{damage, component}`) to have the ladder, declared beside `knockOff`,
projected, routed and authored on `hanging-gardens.yml`; one without it rolls nothing, deals nothing and
still scatters its riders. Three ends of the mount (owner end at tick 13, defeat at tick 37, forced end at
the Round 19 end) ran no check card and dealt the riders nothing.

### DR. A destroyed platform scattered its passengers only onto its own footprint — **fixed 2026-10-01** (#140)

**Reached: the mount's defeat (ruling 12).** `rules/platforms.mjs#scatterPanels` drew one free ground
panel per passenger from under the footprint and stopped when they ran out, so a 1x1 mount or an occupied
footprint left the rest standing where they were: two Units on one panel when the Quetzalcoatlus, which
`sharesPanel`, fell over an enemy. The surplus now lands on the nearest free ground panels by Chebyshev
distance from the footprint, ring by ring and random within a ring, inside the board and never on a panel
an earlier passenger took. Measured after, on the 2x2 footprint: Quetzalcoatl (12,3) → (13,3) and her
Master (12,4) → (13,4), tick 37.

### DS. No control let an owner deactivate a platform, and a deactivation window was read for Modes and for nothing else — **fixed 2026-10-01** (#141, #150)

**Reached: WS.deact, WS.deact.edge, PDS.deact and PDS.deact.edge.** The action bar built its End slots
from `board.fields` and a platform is a Unit, so the Quetzalcoatlus and the Golden Hind, which author
`deactivation {byOwner: true, window: any}`, could end only by defeat, an unpaid toll, an effect on the
owner or a GM at the console. `platforms.mjs#deactivatablePlatforms` lists them, greyed with the moment it
opens while a lockout runs, and `OPERATIONS.deactivatePlatform` asks the GM, who re-checks the lockout
before `destroyPlatform`; forced closes never meet the lock (ruling 8). `deactivationVerdict` now reads
`window`, so a block that states none means the owner's own Turn; every shipped block states `any`, and
Achilles's duel is authored `any` to keep what its control did. Pressed: ended on her Turn at tick 13,
off-Turn at tick 78 (the mount), at tick 83 (the stone).

### DT. A platform Noble Phantasm, and a bounded field, could be cast again while the first stood — **fixed 2026-10-01** (#142, #148)

**Reached: WS.cd and PDS.cd.** `countFrom: destroyed` and `countFrom: deactivation` start no clock at the
cast, and nothing else refused the next one. A second Winged Serpent raised a second Quetzalcoatlus,
charged the Master again and left two mounts each charging a toll; a second Piedra Del Sol went through
`openField`'s bare `delete`, which skipped `endField`: the first stone stayed, the 8◈ never started and
the new `createdAt` restarted the toll. `rules/costs.mjs#canUseAbility` now refuses `platformStands`
(derived from the ability's `summonPlatform` phases) and `fieldAlreadyOpen` (read off the ability's own
field, so a field authored later is covered). Six fields carry the clock. Measured: *"Its platform is
still standing"* and *"Its area is already open: end it, or wait for it"*, tick 33.

### DU. A rider's Move and Normal Attack were replaced by her mount's in the damage path only — **fixed 2026-10-01** (#143)

**Reached: WS.move, WS.atk, TH.atk.qz, EH.atk.qz and TQ.atk.qz, ruling 10.** `replacesRiderAction` had one
reader that ran, the damage source. The movement gate validated her own snapshot, so the platform's edge
hold refused her drag as an occupied destination; a Move or an Attack stamped only the Turn Record of the
unit that acted, so the mount kept a free Move and Attack; and targeting read her Range.
`rules/movement.mjs#gateMovement` measures a driving rider as the mount;
`rules/platforms.mjs#turnPartnersOf` names the unit whose Turn Record an action is also written to, and
`attackRangeOf` the Range of the swing. Measured after: her drag drove the mount and her Attack was
*"mount BA(STR) × 1 +150"*, one shared Move and Attack, ticks 18 and 21.

### DV. A field's turnEnd interior event fired at every Turn's end, not at the end of the victim's own — **fixed 2026-10-01** (#145)

**Reached: PDS.2.** `onTurnChange` dispatched the field `turnEnd` at every Turn's end and `runFieldEvent`
never asked whose Turn it was, so Piedra Del Sol's 50, Contagion's trigger 2a and Jack's Mist's Poison on
enemy Masters were charged at every faction's Turn end instead of once, at the end of the victim's own.
`fields.mjs#runFieldEvents` now takes the faction whose Turn ended and scopes `turnEnd` to its Units; the
clauses that mean every Turn, Blood Fort Andromeda's and Ramesseum Tentyris's Civilian tiers, say
`anyTurnEnd`, and Blood Fort's two *"every Turn it Acts"* tiers say `actedTurnEnd`. Measured after: W1
took 50 Fire and Burn at the end of its own Turn, tick 60, and at no other Turn's end.

### DW. A field that painted Burning terrain also ran Burning's own Turn-end toll on everyone inside — **fixed 2026-10-01** (#146)

**Reached: PDS.burning.** Piedra Del Sol paints real Burning over its 7x7 and `terrainPeriodics` gave
every Unit inside a Burn and 25 Fixed Fire at every Turn end, so her own Noble Phantasm drained her and
her Master and hit each enemy on top of clause 2's 50. The author ruled *"categorized as Burning"* a label
only. A `zone` spec can now say `labelOnly`: it rides `zonePaintArgs`, `terrainDataOf` and
`repaintFollowing` onto `TerrainBehavior`, `terrainAreasOf` projects it and
`rules/terrain.mjs#terrainPeriodics` skips an area that carries it, while `terrainAt` and `terrainEffects`
still say what the ground is. Measured after: W1 took only the stone's 50, ticks 58–64.

### DX. An applyEffect intent could not say permanent or unremovable, and a terrain's or field's effect never ended on leaving — **fixed 2026-10-01** (#147)

**Reached: PDS.2.perm and PDS.2.exit.** An emitted `expiry: null` reads as *"nobody stated a duration"*,
so Burn's own 2◈ default won over a field action that authored `duration: null`, and the action never read
`unremovable`: Piedra Del Sol's Burn lasted 2◈ and could be cleansed, and Burning terrain's
`sourceTerrain` tie had no reader. The intent's effect now carries `permanent` and `unremovable` through
`engine/effect-applier.mjs#mergeEmitted`, a field `ApplyEffect` reads both, and `sourceTerrain` is
declared, written, projected and swept like `sourceFieldId`. Measured after: W1's Burn inside had `expiry
null` and `unremovable true`, tick 60; it ended when W1 left, tick 64, which is an unruled reading
(§46.15.5).

### DY. A field's forced end was tested only when its toll fell due — **fixed 2026-10-01** (#149)

**Reached: PDS.force, PDS.force.any and WS.force.** `runUpkeep` tested the payer's Health only after
`upkeepDue`, so Piedra Del Sol's *"50 or less at any time → deactivated at the end of the Turn"* waited
out its 1◈ period, and the Quetzalcoatlus's *"25 or less → at the end of the Round"* was never asked: its
toll is a tick period, which `upkeepDue` refuses at a Round boundary. `upkeep.closeWhen
{payerHealthAtMost, at: turnEnd | roundEnd}` is the new authored key, `platforms.mjs#forcedEndDue` answers
it and `upkeepPlan` orders a sweep as the sheets state it: the threshold first, then the toll.
`endWhenUnaffordable` stays for Jack's Mist. Measured: the stone forced off at a Turn's end with her
Master at 45, tick 64; the mount at a Round's end with him at 20, tick 56.

### DZ. Painted terrain had no Level, so a ground area applied to Units aboard a platform above it — **fixed 2026-10-01** (#151)

**Reached: PDS.burning and CS.3.** `terrainAreasOf` projected no Level, `paintTerrain` stamped none and
`terrainAt` compared `i` and `j` only: a ground Burning area burned a Unit at `k: 0`, at `k: 1` and at `k:
20`, the Hanging Gardens. §46.4-BI fixed exactly this for fields (`contains` compares `panel.k`) and not
for terrain. An area now carries a Level, stamped from the caster's, the Fortress's or the DU's;
`rules/terrain.mjs#terrainAreasAt` matches it only when the panel names none, the area names none or they
agree, so a hand-drawn area still covers every Level; and a following area follows its source's Level,
including a change of Level alone (boarding). Measured after: the deck's Burning area (level 20) reached
the mount and Quetzalcoatl aboard and not a ground Unit; a ground area did not reach the deck, ticks 34
and 58.

### EA. Xiuhcoatl treated an antiFortress field as a Fortress NP, and its Burning was never cleared — **fixed 2026-10-01** (#152)

**Reached: XI.fort and XI.fort.end.** `fortressPanels` skipped a field only when its `npTags` held neither
`fortress` nor `antiFortress`, so Xiuhcoatl used beside Piedra Del Sol (`antiArmy, antiFortress,
boundedField`) painted Burning over the 9x9 for ever; and *"until the Fortress NP is deactivated"* had no
reader, so the Burning outlived its Fortress and a second use moved the one area off the first Fortress
while it stood. The author ruled that a [Fortress] NP is one tagged `fortress`, which today is Ramesseum
Tentyris. `skill-use.mjs#fortressesNearby` tests that tag alone and gives each Fortress its own area under
`TerrainBehavior.boundToFieldId`, and `fields.mjs#endField` erases what is bound to the field it closes.
Measured: Burning over the 13x13 Fortress and ring, cleared when the Fortress ended, tick 69.

### EB. A bounded field's interior events still acted on defeated Units — **fixed 2026-10-01, pressed live 2026-10-04** (#153)

**Reached: the Quetzalcoatl paper trace (#65).** The other half of §46.4-CN and the sibling of §46.4-CP:
`runFieldEvent` had no `defeated` test, and a defeat never removes the token, so every interior event kept
acting on the corpse. For damage that is debris; where an action pays someone else it is more: Blood Fort
Andromeda's Civilian tier (a Defeat, then a Heal of 100 and +1 Agility to Medusa or her Master) would pay
the owner again for every corpse at every Turn end, and Ozymandias's Complex would log a fresh `fieldKill`
for it. `engine/fields.mjs#runFieldEvent` now filters on `!u.defeated`; contact events share the filter.
Every author of `interiorEvents` is reached.

### EC. A field's Damage action dropped its element and its fixed flag, and nothing read an element on bare damage — **fixed 2026-10-01, pressed live 2026-10-04** (#154)

**Reached: PDS.2.** The `Damage` branch of `runFieldEvent` read `roll`, `amount` and `component`, so
Piedra Del Sol's `{amount: 50, element: fire, fixed: true}` became 50 damage with no element; and the
applier's `damage` case only subtracted, so what an element does at stage 0 never reached a bare intent: a
Frozen enemy in the stone took the 50 Fire and stayed Frozen where Appendix A says any Fire damage removes
Freeze, and Burn, Poison and Curse damage did not turn into healing under their Heal effects. Stage 0's
two rules are now `pipeline.mjs#elementalEarlyExit`, which stage 0 and `applier.mjs#resolveElements` both
ask; the field action passes its element on, and the build refuses a field Damage with `fixed: false`,
which it can never honour. Two readers of one rule, §46.3.

### ED. usageSpecFor dropped three keys the use gate reads — **fixed 2026-10-01** (#155)

**Reached: TH.gate, EH.gate, TQ.gate and QSP.pds.** `usageSpecFor` is what both use paths and the sheet's
cards hand `canUseAbility`, and it did not carry `isSpell`, `categorizedAs` or `creates`; the action bar
alone passed the raw `item.system`. Seal and Silence met the sixteen Spells backwards at the declaration,
Blind's Mystic Eye clause never refused Medusa's Mystic Eyes, and a Storm Border never refused the five
abilities that create a Large or Giant Unit, while the bar read each the other way.
`rules/ability-use.mjs#usageSpecFor` carries the three keys and the bar passes it; a guard reads the gate
and fails if it names a key the spec does not write. Measured: the Spells refused on the ground and usable
aboard, ticks 1 and 7, and refused while Piedra Del Sol stood, tick 33.

### EE. The Counter path never re-checked canUseAbility and had no way to say an ability cannot be a Counter — **fixed 2026-10-01** (#156)

**Reached: TH.ctr, EH.ctr and TQ.ctr.** The three Spells end *"Cannot be used as a Counter"* and the
content said it with `timing.window: ownTurn`, which is documentary (89 of the 117 window authorings), so
they were offered as one. `cannotCounter` is a new Authored Key with its full route
(`module/data/item/ability.mjs`, `AUTHORED_ITEM_KEYS`, the editor field, a route in `survival.test.mjs`)
that `answersACounter` reads. `runCounter` also computed `canUseAbility` only to price the use and never
refused on it, and the `declareCounter` authorizer checked nothing about the ability:
`rules/counter.mjs#counterRefusal` now refuses before anything is spent, with a `testPredicate` so
predicate-gated Counters stay legal. Measured: `answersACounter` false for all three and `counterOffer`
leaving them out, tick 30.

### EF. A rider and the sheet's ability cards were applied or gated on a bare snapshot, not the board's Unit — **fixed 2026-10-01; the sheet half pressed live 2026-10-04 (#158), the rider half waits for a field with an incoming ApplicationChance on the board (#157)**

**Reached: the Quetzalcoatl paper trace (#65).** The shape §46.4-AF and §46.4-AG fixed at two other sites.
`applyAbilityEffects` built both sides from `unitSnapshot`, so a bounded field's incoming
`ApplicationChance` and Sikera Ušum's Immunity downgrade, written only by `snapshotBoard`, never reached a
rider: a 50% rider rolled at 60 was resisted on the snapshot and applied on the board's Unit.
`engine/attack.mjs#riderSubjects` takes both from the board, once per call. The sheet's `abilitiesContext`
gated every card on the bare snapshot, so `self:onPlatform`, `self:fieldActive` and the like were never
emitted: while she rides, her Spells read *"conditions not met"* and Xiuhcoatl read usable. It now takes
the caster from the board.

### EG. An ability's kind was a free string nobody validated, so the three Quetzalcoatlus Spells resolved as STR Normal Attacks — **fixed 2026-10-01** (#159)

**Reached: TH.1, EH.1 and TQ.1.** `kind` is a free `StringField` read in three places, and the corpus
authored `activeSkill` and `spell`, which nothing reads. The three Spells authored `kind: spell` instead
of `isSpell: true`, so `abilityKind` returned `normal` and they were billed `attack` and resolved as STR
Normal Attacks: no Def Dwn (MAG), STR Reflect, the wrong prevention. The number was unaffected, since
`baseSpecFor` reads the declared component first. They author `kind: skill` plus `isSpell: true`;
`ABILITY_KINDS` in `rules/authoring/ability.mjs` is the one list the editor and `tools/lib/content.mjs`
read, and Semiramis's two `activeSkill` become `skill`. Measured: Tlahuitequiliztli `{kind damageSpell,
component mag, element lightning}` with her BA(MAG), tick 18.

### EH. A Skill marked "Used during your Turn" could be used on any Player's Turn — **fixed 2026-10-01** (#160)

**Reached: LL.when, CS.when and GGW.when.** Seen live at tick 2: Lucha Libre pressed from her bar on
Faction 2's Turn resolved, *"2 effect(s) applied"*, cooldown 12. `timing.window: ownTurn` was read in
exactly one place, `canToggleMode`, so it gated Modes and nothing else. `rules/costs.mjs#canUseAbility`
now refuses an ability whose only window is `ownTurn` when the faction whose Turn is running is not the
Unit's, with the reason `notOwnTurn`; an ability that names another window as well, a use made as a
Counter, and a table with no acting faction are not asked. Measured after: every Skill on her bar read
*"Only during your Turn."*, tick 12.

### EI. A painted terrain area ended a Turn before the effect that painted it — **fixed 2026-10-01, pressed live 2026-10-04** (#161)

**Reached: CS.3.** Seen live at tick 4: Charisma of the Sun stamped the Sol buff, Atk Up and the sunlight
Region with one expiry, 4, and the Region was gone at the start of the Turn while Sol and Atk Up stood.
The terrain sweep was handed the next tick and removed `expiry <= tick` when the Turn began; the effect
sweep is handed the tick that just ended. Both now ask `domain/tick.mjs#expiryReached` of the tick of the
Turn that just ended, so an area and an effect stamped with one expiry are present through that Turn and
gone at its end, together.

### EJ. A platform's "Luck: Shared with" was a copy of its owner's maximum Luck, not one pool — **fixed 2026-10-01** (#162)

**Reached: QZ.luck, ruling 7.** `summonPlatform` resolved `inherit.luck {from: summoner}` once, at the
cast, into a copy of the owner's maximum, and every Luck Check spends 1 from the checking unit's own id,
so the two pools drifted apart. The projection carries `luckFromSummoner`,
`snapshot.mjs#annotatePlatforms` reads the owner's current Luck onto a platform that shares it, and
`io.mjs#adjustStat` writes a spend on such a platform to the owner's pool; `summonPlatform` copies no
Luck. The Golden Hind's *"Shared with Drake"* is the same clause. Measured: a spend charged to the mount
came off her pool, 20 → 19, tick 31.

### EK. The content sync merged a pack item into the world's, so a key the pack removed survived — **fixed 2026-10-01** (#163)

**Reached: the audit board itself, after the lane fixes.** After a pack rebuild and a world load,
Xiuhcoatl's world item still held `anchor.range: 2`, which the pack no longer carried, though every other
change in the item arrived. `migration/runner.mjs#syncContent` wrote each item's whole `system` with a
recursive update, which merges, where the actor write beside it already passed `recursive: false`. The
item write now does too. Invisible in tests, which never run the sync, and on a fresh import; it reaches
every content change that removes a key or a list entry. Measured: after the sync the anchor was `{kind:
withinRange, metric: chebyshev}`, tick 12.

### EL. Ending a platform while its Scene Level was viewed left the canvas blank — **open** (#164)

**Reached: WS.deact and WS.force.** Seen at tick 13 and again at the forced end at the Round 19 end: the
GM was viewing the Quetzalcoatlus's Scene Level, the platform, its token and its Level were removed
correctly, and the client was left with `canvas.scene` null and a black board; the level menu still listed
the deleted Level, and only `scene.view()` brought the board back. Nothing moves a client off a Level that
no longer exists. It reaches every client viewing a platform's Level when the platform ends. The fix
proposed in #164: `scene-levels.mjs#removePlatform`, or a `deleteLevel` hook on every client, moves any
viewer to the scene's default Level first. Not fixed.

### EM. A targeting session left the canvas on the targeting layer — **fixed 2026-10-01** (#165)

**Reached: GGW.scope, seen at tick 18 and after every session.** After Good God's Wisdom's unit picker
`canvas.activeLayer.name` was `TargetingLayer`, `canvas.tokens.active` was false, no token could be
controlled and the action bar was gone; only switching to another control group and back restored
`TokenLayer`. `activate()` deactivates every other layer, and `pick` and the destination session never
handed the canvas back, while the paint session's plain `deactivate()` left no layer at all. Every session
now takes the canvas through `targeting-layer.mjs#takeCanvas` and returns it in its `finally`; a session
superseded by a newer one does not hand back. A source guard fails on any `activate()` without the pairing
(Ch. 36 invariant 8). Measured: `TokenLayer` active after the picker, tick 46.

### EN. No reaction prompt ever timed out — **fixed 2026-10-01** (#166)

**Reached: the audit board, at tick 19 and tick 21.** A Counter rung opened on Faction 2's Turn was still
open two Turns later and armed the bar for the mount on Faction 1's next Turn.
`await-timeout.mjs#policyForMessage` passed the `fgt.process` flag, a JSON string, straight to
`pendingPrompt`, which returned `null` for every card, so no reaction, Luck Check, Command Spell, Counter
or facing prompt ever got a deadline or a countdown, and Ch. 23's rule that an absent player never blocks
the table held for none. It now deserializes, failing closed; a source guard checks every reader of the
flag. Measured: an unanswered Counter rung was declined by the timer about 45 s after `promptStartedAt`,
tick 49.

### EO. The targeting preview and the Range of a rider's replaced Normal Attack read the rider, where her mount's replaces it — **fixed 2026-10-01** (#167, #171)

**Reached: WS.atk.** Both seen live. The preview read *"Nemo 195–240"*, her own BA(STR) 125, where the
card dealt 247 off the mount's 150 (tick 21): `previewContext` built its base from her Normal Attack and
filled no `ctx.units`. Her attack on Nemo at (13,6) was refused *"out of Range (2)"* with the 2x2 mount's
footprint 2 panels away and her own panel 3: targeting swapped the mount's Range number and measured it
from her one panel (tick 36). The third builder of the attack drifting from the resolution, after
§46.4-DB. `previewContext` builds its base through `normalAttackBase`, as `baseSpecFor` does, and
`rules/platforms.mjs#attackSourceOf` answers the footprint and Range together for the preview, resolver,
Counter rung and threat overlay. Measured: a target 3 from her panel and 2 from the footprint read
*"Legal"*, tick 51.

### EP. A platform that shares its summoner's Luck showed 0 Luck and its Luck Check buttons were disabled — **fixed 2026-10-01** (#169)

**Reached: QZ.luck.** The engine routed the shared pool (§46.4-EJ) but three readers took
`actor.system.luck`, the mount's stored 0, where the board's projection carries the owner's: the action
bar's Luck row, the chat card's Luck rung, whose Contest button rendered disabled with
`FGT.Reaction.NoLuck`, and the `luckCheck` dialog in `apps/prompt.mjs`. The shared pool could not be spent
from the interface. All three now ask `engine/board.mjs#luckOf`, and a source guard fails any
`module/apps` file that reads `system.luck` directly. Measured: the mount's bar reads *"Luck 20 / 20"*,
her pool, tick 72.

### EQ. A field raised from a platform's deck put its structure on the ground and its area on the deck — **open, needs a ruling** (#170)

**Reached: PDS.place and PDS.2.** Seen at tick 33, cast from the Quetzalcoatlus at (14,8), elevation 20:
the stone is a `structure` token at (14,8) on the ground Level, the field's `geometry.anchor` is `{i:14,
j:8, k:20}` and the `burning` area is level 20, 49 panels. Nemo ended his Turn at (13,6) on the ground
inside the 7x7 and took no 50 Fire and no Burn (Health 566 → 566; `contains` false for him, true for
Quetzalcoatl on the deck), while the deck's Burning gave the mount *"elementDefUp Burning (water) −50
×0.50"*, 164 → 82. Cast from the ground at tick 58 the anchor is `{5,4,k0}` and W1 inside took the clause.
The question: which Level owns an area raised from a deck? Every self-anchored field raised from a deck
splits the same way (Golden Hind, Hanging Gardens). Not fixed.

### ER. Guts, Undying and every other revival lost the killing blow's overkill — **fixed 2026-10-01** (#172)

**Reached: GGW.1.** `rules/revival.mjs#resolveRevival` subtracted the overkill from what every source
restores, generalising Heracles's God Hand clause, the only sheet that says *"the excess damage is reduced
from his newly restored Health"*. Seen at tick 40: Guts 10 on a 1250-Health Servant at Health 60, hit for
227 (overkill 167), defeated with the Guts spent; `resolveRevival({overkill: 167})` gave `revived: false`,
`restored: 0`, and with `overkill: 0` 125. #128's test had used `overkill: 0`. Only a `cascading` source
carries the excess now; Guts, Undying, Battle Continuation, Divine Protection and Holder Mode restore
their stated amount, and `ignoresOverkill`, Mannanán's alone, is retired. Measured: the mount at 50 took
228 (overkill 178) and Guts revived it with 100, tick 49.

### ES. At a Round boundary the first Turn started for the old order's faction, and the Round numbers ran one ahead — **fixed 2026-10-01** (#173)

**Reached: the audit board, every Round.** At tick 41 the Combat went 14 → 15 while the log read `roundEnd
15 · roundStart 16 · turnStart faction-1 tick 42`, and Faction 2 held tick 42 after the order was
re-rolled. `combatRound` fires before Foundry writes the new Round and is not awaited, so `onRoundChange`
read `combat.round` after an await, and `onTurnChange` took the incoming faction from the order before
`rollTurnOrder` re-sorted it: `budget.reset` ran for the faction not acting. The boundary is now one
ordered sequence in `engine/scheduler-hooks.mjs#onTurnChange`: end the Turn, end the Round (old number),
roll, begin the Round (new number), begin the first Turn for `combat.combatant` after the re-sort.
Measured: `roundEnd 24 · roundStart 25 · turnStart faction-1 tick 72`, matching the Combat.

### ET. Overpower flipped its instant-defeat coin for a Servant's own Master, silently — **open, needs a ruling** (#174)

**Reached: XI.splash, RI.p3 and XI.fort.** Xiuhcoatl's splash hits everyone within 2 panels, and her ZON
is 2, so her own Master is always under it. At tick 39 the card read *400, Injury Roll required* and
nothing else, and he stood at 1540/2000 with `defeated: true`, `defeatCause: "overpowered"` and the skull;
it defeated him three times on this board (ticks 39, 69 and 79) and made her Master's carry at tick 43
look like a failed RI.p3. `relationships.mjs#overpowerCheck` tests kinds only, with no relation test, and
`I.defeat(…, "overpowered")` is written with no card line. For the author: an allied Servant should not
flip it; whether a Master merely caught in an area does needs a ruling against Ch. 32's Cover ladder. Not
fixed.

### EU. The Quetzalcoatlus was never forced off at a Round's end while its Master was home — **open, needs a ruling** (#175)

**Reached: WS.force.** Round 18 → 19: the mount's own toll took her Master 40 → 15 at the end of tick 52,
then the Home Base heal took him to 115 and the mount stood, no `forcedEnd` in the log; `upkeepPlan(…,
payerHealth 15, atRoundBoundary true)` returns `{close: forcedEnd}`, so the rule is right and never saw
15. Two things need a ruling: `scheduler-hooks.mjs#onRoundChange` runs `endRound`, with its +100 heal,
before `runUpkeep` reads `closeWhen` at `roundEnd` (which comes first?); and Home Base membership ignores
Level, so Quetzalcoatl and her Master aboard at `k: 20` read `inHomeBase: true` (is a Unit flying over its
Home Base inside it?). Observed outside a Home Base: forced off at the Round 19 end with the Master at 20,
tick 56. Not fixed.


### EV. An undamageable sheet kept the Health its END table wrote — **fixed** (6376e1a, #180)

**Reached: SB, RI.1.** Pale Rider's header read Health 1500 / 1500: commitWar wrote the END A figure and
`derived.mjs#restoreModifiable` put it back over the null `prepareBaseData` sets, so `isUndamageable` was
false for every Unit authored `undamageable: true`. `restoreModifiable` now skips `health.*` on such a
sheet, and `summon.mjs#sheetPatch` writes null.

### EW. A field's "or" between its own-Turn and acted triggers fired both halves — **fixed** (76406b4, ed711c9, #180)

**Reached: CO.t2.** Medea cast Atlas on her own Turn inside Contagion and lost 200 where the sheet says 100.
The acted half now carries `notOnOwnTurn` (Contagion and Jack's Mist). The fix did not reach the live
board: `ensurePassiveFields` skipped any passive field already open, so the field opened at tick 0 kept
its old `interiorEvents`. A standing passive field now takes its ability's current rule axes
(`staleRuleAxes`). Ruled with it: trigger 1 and the acted half are two triggers, charged twice.

### EX. A field's Health loss that emptied a bar did not defeat — **fixed** (999b92c, #180)

**Reached: CO.dc.poison.** Contagion took Medea 122 → 0 and she stood on, undefeated: a `HealthLoss` is a
stat write and nothing asked whether it was lethal. It now carries `defeatsAtZero`.

### EY. A hit on a Unit with no Health defeated it — **fixed** (3b5f93f, #180)

**Reached: RI.1.** Asterios's attack on Pale Rider was negated to 0 and defeated him:
`resolveDefeatOf` read his null Health as 0. Hidden until EV, because a stale 1500 sat there.

### EZ. A forced target that was gone forced the attacker to attack nobody — **fixed** (e952fe3, #180)

**Reached: KF.SB.** Asterios's body was cleared and his Famine, still forced towards him, refused every
target. A forced target off the board, or a Spirit's prey outside its field, now forces nothing; ruled
2026-10-04, a pursuing Spirit's area hits every enemy in it (d252511).

### FA. Attacking a guarded Master was "an adjacent guard refuses" — **fixed** (25a4b7d, #181)

**Reached: KK.rel.untgt.** The rulebook's three cases (a guard in Range, an adjacent guard, an Agility
Check) were one refusal. Built as ruled 2026-10-04; pressed live, Castor stepped in on a 15 against 17.

### FB. Field events, rider chances and Round-end ticks left no record — **fixed** (3f73b71, #182)

**Reached: every chance Clause.** Contagion's losses and rolls, a Spirit's Death die and Poison's
Round-end damage were invisible. One card per field per Turn end, rider rolls in the attack card, a
Round-end card, and a log entry for each and for every defeat.

### FC. A charmed Unit kept its side — **ruled and built** (35c9621, #180)

**Reached: CO.t2, IW.scope.** Ruled 2026-10-04: a charmed Unit is its charmer's ally and its own side's
enemy for every rule, and its own Turn is its charmer's. `rules/relations.mjs#sideOf`.

### FD. A choice on an Attack Skill was asked twice — **fixed** (441e0b1)

**Reached: KK.banish, on Castor's Mana Burst.** The declaration's caster pass asked the restoration and
the rider step asked again, the first time in raw lang keys.

### FE. A passive ability's card showed a cost it can never pay — **fixed** (f8793fe)

**Reached: KK.hdr.** Kagome Kagome read "The Master cannot pay the Health cost … cannot be paid".

### FF. Facing's cones were lopsided — **ruled and built** (#184)

**Reached: HE.front, HE.side, HE.back, on reading.** A half-open 90° quadrant put the front-left
diagonal in the front and the front-right one in a side. Ruled 2026-10-04: of the eight panels around a
Unit 3 are front, 2 sides, 3 back, for every facing rule, read at the declaration; the defender then
turns to the nearest of eight, not four. Ch. 05.

### FG. Directional Evade was in the table and never applied — **ruled and built** (#184)

**Reached: HE.side, on reading Appendix C.** *"Attacked from the left or right +1"*, *"from behind +2"*
had no reader. Built with the cones, single-target attacks only. Ch. 13.

### FH. "Restored above half since the last use" was never recorded — **fixed** (#184)

**Reached: BC.p2.half, on reading.** Two Silent Drops, one under the other. The writer watched a key
no content writes, and the key it would have stamped, `0.5`, is split by Foundry at its dot. Battle
Continuation revived once a match and Rho Aias was usable once. Ch. 10.

### FI. A stance transition was never offered — **built** (#184)

**Reached: ST.dismount, on reading.** Achilles's Dismount at the start of a Combat Phase had a rule
and no offer. The Turn record now remembers a Mounted Turn, for the toll. Ch. 45.

### FJ. A shove that deals damage was a real Attack — **ruled and built** (#184)

**Reached: AK.kb.side, on reading.** Akhilleus Kosmos's sidestep ran a Normal Attack mid-Move: it spent
the budget, offered reactions and was refused once he had attacked. Ruled 2026-10-04: damage measured
as his Normal Attack, not an Attack.

### FK. A complete negation still flipped the Overpower coin — **fixed** (#184)

**Reached: AK.neg.** Akhilleus Kosmos's Anti-Purge took Bellerophon to 0 on Achilles's Master, and the
coin defeated him. Anti-Purge and Substitution now stop the coin and the event riders. Ch. 21, Ch. 32.

### FL. An expended ability kept its passives — **fixed** (#184)

**Reached: AK.broken.** The barrier spent, his shove still walked him through people. Ch. 17.

### FM. A Noble Phantasm on an empty ride was free — **fixed** (#184)

**Reached: TT.cd.** Troias ridden onto an empty line: Agility and Atk Up, no cost, no cooldown, no card.
Ch. 05.

### FN. A ride re-ran its gates after it moved — **fixed** (#184)

**Reached: TT.ride.** Troias carried Achilles out of his Master's ZON, and `resolveAttack` asked the gates
again and refused the Noble Phantasm with the ride already spent. The ride's own preflight, asked before
the move, is now the declaration's. Ch. 05.

### FO. A before-damage self-buff waited for the first-declared defender — **fixed** (#184)

**Reached: TT.atk.np.** Three defenders answered in reverse, and Troias's Atk Up landed with the last
hit. The first Process to strike pays it now. Ch. 21.

### FP. A tier table read Medusa's E- as no Divinity — **fixed** (#184)

**Reached: AA.2.** Andreias Amarantos's cut points were ordinals; E- fell below E's to the zero tier.
`threshold` tables may read by grade. Ch. 03.

### FQ. Nothing emitted `attack:kind:ridingAttack` — **fixed** (#184)

**Reached: TT.p.** Troias's *"Riding Attack damage +25%"* never applied to any ride. Ch. 11.

### FR. Movement never asked a field's entry policy — **fixed** (#184)

**Reached: DA.noenter.** Karna walked into the duel; UBW's `forbidden` entry was as unenforced.
`rules/movement.mjs#blockedByFieldEntry` beside the exit check. Ch. 28.

### FS. Command Spells crossed a field that blocks them — **fixed** (#184)

**Reached: DA.nointerfere.** `blocksCommandSpells` was read by nothing that spends one. `canSpend` asks
`isolationBlocks` with `isCommandSpell`. Ch. 33.

### FT. The Heel's Luck option inside the duel, and no record of its roll — **fixed** (#184)

**Reached: DA.noluck, HE.miss.** The offer read a bare snapshot, without the field's suppression; and a
failed Heel left a card with nothing but "noDamage". The roll is now on the card. Ch. 45.

### FU. A negated effect's contributions stayed — **fixed** (#184)

**Reached: DA.foreign.** The duel took Karna's Atk Up off Achilles's board and its +10% still reached his
hit. Every contribution an effect makes carries its instance (`EFFECT_INSTANCE`), and the duel drops
them with it. Ch. 10.

### FV. A rule's own options carried no Turn record — **fixed** (#184)

**Reached: TT.toll.** `self:stance:mountedThisTurn` was tested at collection with the stance alone, so a
Turn he Dismounted in charged his Master nothing. `contributionsOf` reads the record at its tick. Ch. 45.

### FW. A post-pipeline row printed "Stage undefined" — **fixed** (#184)

**Reached: DA.end.** God Hand's survives-at-1 took 71 to 0 under that label. Ch. 22.

### FX. The shove reached only the panel he stopped on, and leapt — **ruled and built** (#184)

**Reached: AK.kb, AK.kb.side.** Units he walked through were passed; the one where he stopped was set down
past whoever stood behind it. Ruled 2026-10-05 (readings 14, 15): carried ahead along his path, one panel a
step; a taken panel means a sidestep and the hit. Ch. 45.
---

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
- **Overkill is subtracted only by God Hand.** *Corrected (#172):* this bullet used to read
  *"subtracted from every revival source"*, on the reasoning that `rules/revival.mjs` generalised
  God Hand's clause. Nothing but God Hand's text states it, and the generalisation left a Guts 10
  Servant dead to a 167 overkill. Only a `cascading` source carries the excess now; Ch. 10 records it.

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

### 46.14.6 The garden that never seated its owner — **fixed 2026-09-18**

> *"When HGoB is activated, place the HGoB token on the panel where Semiramis was standing; **and she
> is Moved to the middle panel of HGoB**, and all allied Units of your choice are transported to any
> panel within the HGoB."*

She was not moved. She stayed on the panel the token was anchored to — for a top-left-anchored
footprint, its **corner**, which is the one panel guaranteed to be on the rim and outside the Throne
Room. Measured twice before the fix: activated at (0,0) she was at (0,0); at (5,5), still (5,5).

**It made her own Noble Phantasm unreachable.** `SIK.2` is *"can only be used within the 'Throne
Room'"*, the middle 5×5, gated by a `withinPlatformCentre` requirement. Seated on the rim she was
never in it, and the action bar said so: *"Sikera Ušum: Arrogant King's Alcohol — Must be on its
Platform's centre."*

**The arithmetic was never wrong.** `seatRiders` computed the middle correctly and always had. It
then looked the rider's token up through `getActiveTokens()`, which reads the canvas **placeable**
layer — and it runs immediately after a 9×9 token has been created and every rider reassigned to a
new Scene Level, so the layer is mid-redraw and answers `[]` for a Unit whose token plainly exists.
A falsy-`token` guard then skipped the owner **in silence**.

Three separate things had to be true for this to survive: the lookup read the wrong collection, the
guard was silent, and the failure looked exactly like a Servant who had simply not moved.

The fix reads `canvas.scene.tokens`, the document collection, which does not depend on anything being
drawn — the same reason §46.2 tells an auditor to move a token through its document rather than its
placeable. `seatRiders` now warns on both failure paths, and the seating **decision** is extracted as
the pure `seatingPlan`, so where each rider goes can be asserted without a canvas at all
(`test/unit/hgob-seating.test.mjs`). Verified live: activated from (3,3), the platform's centre is
(7,7) and she now stands on (7,7); the action bar offers Sikera Ušum with no refusal.

**The comment above that call already said all of this.** It read *"Neither half happened… Found
live: activated at (11,11), she was still at (11,11) afterwards"* — describing a repair that had been
written and had never reached the board. A fix for this project's dominant defect shape, exhibiting
this project's dominant defect shape.

### 46.14.7 The riders the garden was never asked for — **fixed 2026-09-18**

The other half of the sentence §46.14.6 repaired.

> *"When HGoB is activated, place the HGoB token on the panel where Semiramis was standing; and she
> is Moved to the middle panel of HGoB, **and all allied Units of your choice are transported to any
> panel within the HGoB**."*

`activateHangingGardens` has taken an `allyIds` option since it was written. `seatingPlan` seats
those allies, gives each one the panel the caller chose, and falls back to the free panel nearest the
middle when it chose none. All of it correct, all of it tested.

**Its one caller passed nothing.** `onChannelComplete` — the channel finishing, which is the only way
the garden ever goes up — called `activateHangingGardens(actorId)`, so `allyIds` defaulted to `[]`
every time. Semiramis always boarded alone.

Measured live: the activation's confirmation dialog reads **"1 target(s) · 1 panel(s)"** and the only
name in it is hers, and after activation her Master was still standing on the ground at (0,1) — under
a garden that had just taken her out of his ZON.

The activation now asks. Eligible is everyone allied and on the board and not already aboard
something: the sheet puts no reach on the clause, and a flying fortress that cannot carry your
Faction is not the thing the sheet describes. The question goes to the **Servant's owner** through
`engine/ask.mjs#askOwner`, not to whoever is arbitrating — a GM-run activation must not put a
player's choice in the GM's hands — and the answer is filtered against what was offered, because it
crosses a socket from a client the GM does not control. Declining is an answer: a dismissed dialog
leaves her boarding alone, which is the old behaviour, now reached by choosing it.

`askOwner` was a private function in `engine/attack.mjs` with a copy in `apps/copy-dialog.mjs`. The
third caller is what moved it to `engine/ask.mjs`; attack.mjs imports it now and the copy-dialog's
own — which routes from a unit id on layer 4 — is left with a comment saying where the shared one is.

**The panel each ally lands on is now offered** (#68). After the riders are chosen, the Servant's owner
is asked, one ally at a time, for a panel of the footprint that will open where she stands -- less the
middle, which is hers, and less what an earlier ally took, the Throne Room listed first
(`engine/hgob.mjs#chooseRiderPanels`, `riderPanelOptions`). Declining leaves that ally to
`seatingPlan`'s nearest free panel, which used to be the only answer.

---

## 46.15 Quetzalcoatl — the Servant who rides her own Noble Phantasm

**All 113 of her Clauses were Pressed or Observed on a live board** (#65, 2026-09-30 to 2026-10-01): 60
`Pressed (interface)`, 16 `Pressed (engine)`, 1 `Pressed (projection)`, 2 `Pressed`, 1 `Observed (interface)`
and 33 `Observed`. They span three Units — Quetzalcoatl, the Quetzalcoatlus she summons and rides, and the
Piedra Del Sol, a Structure — and the audit put **57 entries into §46.4 (CQ to EU)**, so this chapter is the
case for her and the register is where the findings live.

**Why she finds so much.** Her kit leans on mechanisms that have one user each. The Quetzalcoatlus is the
only mount that replaces a *Move* (`replacesRiderAction`; the Golden Hind replaces only a Normal Attack), and
Xiuhcoatl is the only ability with an `aftermath`. Piedra Del Sol is the only `supersedes` in the corpus,
and Magic Resistance's Instakill and Death exemption is the only `attackPredicate`. Her three Spells are
the only sheet that says *"Cannot be used as a Counter"*. Each is a mechanism with one user, which is
§46.14's reason too, and a mechanism with one user has never had a bug report.

**How this audit was built differently.** The Clause list was written by hand, line by line, from the
Character Sheet, after a generated list of 56 was found wrong in five ways (#65; d18db76). The paper
trace ran first: seven agents, then a second pass that tried to refute each claimed defect against the code.
*"None was refuted. Two were merged into others."* It filed #113 to #162, fifty issues. The live
presses found the rest: #160 and #161 on the first board, and #163 to #175 once the lane fixes were in.

### 46.15.1 What held

| Clause | Measured |
|---|---|
| **Statblock** (SB) | Header *RIDER · LAWFUL GOOD · CENTRAL AMERICA, SOUTH AMERICA*; Health 1250/1250, Agility 19/19, Luck 20/20; STR B, END B, AGI B+, MAG EX, LUC A+; BA(STR) 125, BA(MAG) 250, MOV 7, RANGE 2, TARGETS 1, DETECT 2 (derived), Sustainability 2◈. END B's table gives 1250, STR B 125, MAG EX 250, no override. The setup rolls ran in `servantSetupPlan` at `commitWar`, not by hand: Agility 17 + 1d2 (rolled 2), Luck 17 + 1d4 (rolled 3). *Kukulkan* is not carried; the True Name is display only |
| **Magic Resistance**, passive 1 | Nemo (MAG A): base BA(MAG) 200, crit ×1.10 → 218.7, Divinity +50 → 268.7, ZON −24 → 244.7, stage 11 *"negated: MR A ≥ attack A × 0.00"* → **0**. Medea (MAG A+), same defender, same board: BA(MAG) +210, Attack− 5d10 = 27 → 183, *"−50% MAG (MR A < attack A+) × 0.50"* → 91.5, clamped **91**; Health 1250 → 1159. `MR.np`: EMIYA's Caladbolg (NP Rank A, MAG B) negated, 700 → 0; Hrunting (*"not affected by MR"*) bypassed, 700 stays |
| **Magic Resistance** and **Divine Core**, passive 2 | Her `applicationChances`: incoming normal **25** (MR), incoming Instakill and Death **25** (MR, predicated `not attack:component:str` and `not attack:ignoresMagicResistance`), incoming normal **50** (Divine Core). `applyEffect` dry runs, roll 99: Burn from a MAG NP *"rolled 99 vs 25%"* (100 − 25 − 50); Burn from a STR Skill also 25%; Instakill and Death from a MAG NP **75%**, from a STR NP or an ignores-MR NP **100%**; Erase **100%**. Divine Core's 50 does not reach Instakill or Death (Appendix A: normal only) |
| **Goddess's Divine Core**, passive 1 | +120 at stage 7: Normal Attack on Medea, BA(STR) 125, Attack+ 5d10 = 22 → 147, Atk Up ×1.30 → 191.1, Divinity +120 → **311.1**. Its Divinity: her options carry `target:skill:divinity` and `target:skillRank:divinity:gte:EX` (and A…E), so Vasavi Shakti's predicates see her |
| **Charisma of the Sun** | Atk Up (30, NP 15) and S.Crit Up 25 on her and her Master at Chebyshev 1, expiries 4 and 2 against tick 1 (1◈ and ⅓◈); Medea at 18 got nothing. Sol on her, expiry 4, and a 5x5 `sunlight` Region following her. Cooldown 12 = 4◈. Spent on her own attack at stage 4 (*"Atk Up atkUp +30% ×1.30"*), and +15% on the NP: 944 → **1085.6**. Round 2 (Night): `phaseAt (10,0)` day inside the 5x5, `phaseAt (10,5)` night outside |
| **Good God's Wisdom** | The choose dialog read *"3 target(s) · 25 panel(s)"*: Quetzalcoatlus, her Master, Quetzalcoatl; the enemy *NOT TARGETED "this ability targets ally or self"*. Her Master: Guts magnitude 10, Atk Up 40 (NP 30), both expiry 21 (tick 18 + 3), gone at tick 22. Cooldown **11** = 4◈−⅓◈ |
| **Lucha Libre** | Crit Up 60, Crit DmUp 50, expiry 3 against tick 2 (⅓◈ = 1 tick). Cooldown 12 = 4◈. Xiuhcoatl's cooldown 21 → **18** |
| **Xiuhcoatl** | Her Master −60 (Rank A). Stage 1 *"BA(STR) × 1 +125 · BA(MAG) × 0.5 +125 = 250"* at tick 79, and *"+95 · +110 = 205"* at tick 39 with Burn's −30 on each. *"4× damage"* 236 → 944, NP Seal expiry 42 (1◈), Burn expiry 45 (2◈); +15% → 1085.6; Piedra Del Sol *"+180"* → 1265.6, Nemo defeated. Against Ozymandias (MR B): stage 11 *"bypassed"*, 4× → 1132, Divine Core +120 → 1252, Block −25% → **939**. The splash: BA(MAG) ×1, whole Fire, MR applied; W1 card 334, her Master 2000 → 1540 including the −60. Cooldown 21 = 7◈. Refused while aboard (*"Its conditions are not met right now."*), usable on the ground |
| **Winged Serpent** | A 2x2 mount on its own Level, she on that Level at elevation 20 (*"+20 panels"*), her adjacent Master placed **on** the deck at (12,13). Her Master −60 (321 → 261). Upkeep −25 per 1◈ (3 ticks), at the ends of ticks 10, 16, 19, 22, 25, 28, 31, 34, 49, 52 and 55, and none at the ends of 7, 8 and 9. At tick 12 the Fields row read *"cannot be ended yet — it opens in ⅓◈"*. Cooldown **21** (7◈) after an owner end, a defeat and a forced end |
| **The mount** | Health 1000, Agility 16, MOV 7, Range 2/1, BA(STR) 150, 2x2. It drove across Nemo's panel and stood over Medea's; she was not targetable aboard (*"aboard a platform that cannot be attacked into"*). Medea's Rain of Light (3x3, MAG A+): mount **656**, no stage 15 entry; she **123** (stage 11 493 → 246.5, stage 15 *"platformAoe ×0.50"* → 123.25); her Master not targeted, 261 → 261, effects `[]` |
| **The three Spells** | BA(MAG) 250 ×2 + Divine Core 120: Tlahuitequiliztli **568** (Medea 439 → 0), Ehecatle **664**, Tlaelquiyahuitl **680**, `{kind damageSpell, component mag}` with the elements lightning, wind and water. Shock expiry 36 = 30 + 6 (Agility 7 → 4), Slow expiry 33 = 27 + 6 (MOV 6 → 3, Agility 10 → 7), Sap expiry 78 (1◈). Cooldown 6 (2◈) on all three at once, the others reading *"Cooldown 2◈ (6 turns)"*; her Turn Record and the mount's `attacked: true` |
| **Piedra Del Sol** | Her Master −100 (406 → 306). The stone a `structure` token, field `quetz-piedra-del-sol`, `fixedArea` square 7 (rows 11–17, cols 5–11). Upkeep −50 per 1◈ (281 → 231, 306 → 256). Ward ×0.50 outside the area: Barrel Bombing card **28** (150 fixed, Crit +37 → 187, ward ×0.50 → 93.5, ZON −36 → 57.5, stage 15 ×0.50 → 28.75). W1 at the end of its own Turn: 971 → **921** and a Burn `{expiry null, unremovable true}`; her Master, inside on the stone's panel, took nothing |
| **Riding** | MOV 7 → 13, back to 7 at the Turn's end, ticks 43–44; cooldown 9 (3◈). Move 1, Attack, Move 12 accepted; the same second Move at 13 refused *"13 panels; 12 remain of MOV 13"*. After a 1-panel Move the overlay offered 12 panels, not 13; the ride ended the Turn (*"Move — Riding Attack ends this unit's turn"*, a drag of 2 refused, *"0 remain of MOV 13"*). 5 panels through W1 for **229**, W1 921 → 692; her Master carried at the same offset |

### 46.15.2 What she cost the engine

**Hers.** Four fixes went in with no issue of their own, all local to her and tagged #65: the Quetzalcoatlus is
2x2, not 1x1 (e506119, ruling 16); Winged Serpent seats her adjacent Master on the mount and only her own
Master boards it freely, where he had been left standing beside it on nothing and then needed a natural 12
(7f7afc3); Xiuhcoatl no longer freezes her statblock Range into its anchor (fd974ad); and Piedra Del Sol's
+180 and −50% hold wherever she stands while the stone exists, where the content scoped both to the 7x7
(4514b19, ruling 5). The three Spells' `kind: spell` is hers in the YAML and general in the reader
(§46.4-EG).

**The sixteen rulings of 2026-10-01**, each settled by the user, and what each changed:

| # | Ruling | What it changed |
|---|---|---|
| 1 | The Spells use her BA(MAG) 250, ×2 | As authored |
| 2 | Xiuhcoatl's splash is affected by Magic Resistance; only the hit on the DU is exempt | Content: `ignoresMagicResistance` deleted from the aftermath; §46.4-DN |
| 3 | Magic Resistance compares an NP by the NP's own Rank | The resolution was right; the preview was not, §46.4-DB |
| 4 | Piedra Del Sol's +180 replaces Divine Core's +120 | On a live board both counted (+300), §46.4-DD |
| 5 | "On the field" means on the board | Content: the two interior rules became `fieldActive` passives (4514b19) |
| 6 | "Categorized as 'Burning'" is a label | §46.4-DW |
| 7 | The Quetzalcoatlus shares one Luck pool with her | §46.4-EJ, §46.4-EP |
| 8 | A forced deactivation is not held off by the 2◈ lock | Held: a forced end never calls `deactivationVerdict`; §46.4-DS kept it so |
| 9 | Winged Serpent's 7◈ Cooldown starts from any end of the mount | Held; Pressed after a voluntary end, a defeat and a forced end |
| 10 | She and the Quetzalcoatlus share one Move and one Attack per Turn | §46.4-DU |
| 11 | The Spells' 3x3 hits enemies only | Content (c3199a7) |
| 12 | When the mount falls, its riders drop to the ground | §46.4-DQ, §46.4-DR |
| 13 | Crit Up, S.Crit Up and Crit DmUp do not affect Noble Phantasms | §46.4-DI |
| 14 | Riding Attack hits enemies only | As the engine does |
| 15 | A [Fortress] NP is one tagged Fortress | §46.4-EA |
| 16 | The Quetzalcoatlus is 2x2 panels | Content (e506119), not printed on the sheet |

**What was general** (§46.4-CQ to §46.4-EU, issues #113 to #175 except #168, which §46.4-CP records, and the
splash riders, filed under #65). Of the 63 issues, **60 are closed**, each with the fix looked at on a board. Eighteen of them were pressed live on 2026-10-04, two of those from a Player client (#130, #144). The rest were ruled and built (#170, #174, #175) or duplicated (#164). **One is fixed in code and not yet pressed**: #157, which needs a field with an incoming `ApplicationChance` on the board, and the only one authored is Pale Rider's Doomsday Come. **Two wait for a ruling**: #132 and #134. By family:

- **Riding**, nine entries: CQ (#113, no interface path), CR (#114, the gates), CS (#115, the Master),
  CT (#116, the free toggle), CU (#117, Double Move by name), CV (#118, the stale landing), CW (#119, No Buff),
  CX (#120, Drake's `"@cooldown"`), CZ (#122, the text).
- **Platforms and the rider and mount pair**, twelve: DP (#138), DQ (#139), DR (#140), DS (#141, #150),
  DT (#142, #148), DU (#143), EJ (#162), EL (#164), EO (#167, #171), EP (#169), EQ (#170), EU (#175).
- **Fields and terrain**, nine: DV (#145), DW (#146), DX (#147), DY (#149), DZ (#151), EA (#152), EB (#153),
  EC (#154), EI (#161).
- **Effects, resistance, crit and revival**, nine: DA (#123), DB (#124), DC (#125), DD (#126), DE (#127),
  DF (#128), DI (#131), DJ (#132), ER (#172).
- **Use gates and targeting**, seven: DG (#129), DK (#133), ED (#155), EE (#156), EF (#157, #158), EG (#159),
  EH (#160).
- **One Noble Phantasm resolving**, three: DM (#135), DN (#136, #137), DO (the splash riders, found live).
- **Plumbing**, eight: CY (#121), DH (#130, #144), DL (#134), EK (#163), EM (#165), EN (#166), ES (#173),
  ET (#174).

**Shapes worth carrying to the next audit.**

- **A rule one sheet states, applied to every Servant.** §46.4-ER: `resolveRevival` subtracted the overkill from
  every source, *"generalised to every source because every source in the corpus had it until now"*, and only
  God Hand's sheet says it. §46.4-DQ is the same shape: the Hanging Gardens' destruction ladder ran on every
  platform. Both are the opposite of a Silent Drop, a rule that fires too widely, and neither failed a test.
- **The same attack built in several places.** §46.4-DB (the preview against the resolution), §46.4-EO (the
  preview and the Range, *"a third builder of the attack"*) and §46.4-DM (the card, the preview and the NP
  ranking all reading the damage block the same wrong way, so they agreed).
- **A timing key whose only reader was the Mode toggle.** §46.4-EH (`ownTurn`), §46.4-DS (`deactivation.window`)
  and §46.4-EE (`ownTurn` read as documentary) are one shape: an authored window that gates Modes and nothing
  else.
- **A value dropped at a Hop of its own.** §46.4-DD (`contentId` missing from the contribution record, which
  `#103`'s test had passed in by hand), §46.4-DF (`@magnitude` never substituted into `restore`) and §46.4-EG (a
  free `kind` string).
- **A board question asked of a snapshot.** §46.4-EF is §46.4-AF and §46.4-AG at two more call sites.
- **A defeated Unit is still on the board.** §46.4-CP, and its sibling §46.4-EB.

### 46.15.3 Everything pressed

Evidence level and tick for each of the 113 Clauses, as #65 records them.

| Family | Clause · evidence level · tick |
|---|---|
| **SB** | SB · Pressed (interface) · 0 |
| **Riding** (13) | RI.p1, RI.p1.cap · Pressed (interface) · 4. RI.p2 · **Observed (interface)** · 61. RI.p2.stop, RI.p2.left, RI.combo · Pressed (interface) · 43. RI.p3, RI.p3.one · Pressed (interface) · 1. RI.when · Pressed (interface) · 43, refused off-Turn at 40. RI.a · Pressed (interface) · 43–44. RI.notbuff · Pressed (engine) · 72. RI.notbuff.block · Pressed (interface) · 72. RI.cd · Pressed (interface) · 43 |
| **Magic Resistance** (8) | MR.p1, MR.p1.over · Observed · 3. MR.np, MR.p2, MR.death, MR.death.x, MR.erase, MR.str · Pressed (engine) · 40 |
| **Divine Core** (3) | GDC.p1 · Observed · 4 and 39. GDC.p2, GDC.div · Pressed (engine) · 40 |
| **Charisma of the Sun** (6) | CS.when · Pressed (interface) · 1, refused off-Turn at 12. CS.1 · Observed · 4. CS.1.np · Observed · 39. CS.2, CS.cd · Pressed (interface) · 1. CS.3 · Observed · 70 |
| **Good God's Wisdom** (6) | GGW.when, GGW.scope, GGW.2, GGW.2.np, GGW.cd · Pressed (interface) · 18, refused off-Turn at 12. GGW.1 · Observed · 49 |
| **Lucha Libre** (5) | LL.when · Pressed (interface) · 12, refused off-Turn after #160. LL.1, LL.2, LL.cd · Pressed (interface) · 2. LL.3 · Pressed (interface) · 39 |
| **Xiuhcoatl** (12) | XI.hdr, XI.ba, XI.du, XI.fire · Observed · 39. XI.mr · Observed · 79. XI.splash · Observed · 39 and 69. XI.splash.miss · Observed · 69 and 79. XI.splash.seal · Observed · 69. XI.ride · Pressed (interface) · 7 and 39. XI.fort, XI.fort.end · Observed · 69. XI.cd · Pressed (interface) · 39 |
| **Winged Serpent** (15) | WS.hdr · Pressed (interface) · 7, 13 and 46. WS.summon, WS.seat, WS.deact · Pressed (interface) · 13. WS.master · Pressed (interface) · 13, a distant Master stays at 46. WS.board · Pressed (interface) · 51, enemies refused by the engine. WS.move · Pressed (interface) · 18. WS.atk · Observed · 21. WS.spells · Pressed (interface) · 1 and 7. WS.upkeep · Observed · 10, 16, 19, 22, 25, 28, 31, 34, 49, 52 and 55. WS.upkeep.x · Pressed (engine) · 64. WS.force · Observed · 56. WS.deact.edge · Pressed (interface) · 78. WS.lock · Pressed (interface) · 12, ruling 8 by the engine. WS.cd · Pressed · 13, 37 and 56 (ruling 9) |
| **The mount** (9) | QZ.SB · Pressed (projection) · 13. QZ.luck · Pressed (engine) · 72. QZ.obst · Pressed (interface) · 21. QZ.occupy · Pressed (interface) · 18. QZ.untgt · Pressed (interface) · 12 and 19. QZ.untgt.m · Pressed (interface) · 19. QZ.aoe, QZ.aoe.m · Observed · 16 and 37. QZ.aoe.m.fx · Observed · 37 |
| **The three Spells** (15) | TH.gate, EH.gate, TQ.gate · Pressed (interface) · 1 and 7. TH.1 · Observed · 18 and 30. EH.1 · Observed · 25 and 75. TQ.1 · Observed · 27. TH.atk, TH.atk.qz · Pressed (interface) · 18. EH.atk, EH.atk.qz · Pressed (interface) · 25. TQ.atk, TQ.atk.qz · Pressed (interface) · 27. TH.ctr, EH.ctr, TQ.ctr · Pressed (engine) · 30 |
| **Shared by the Spells** (3) | QSP.cd · Pressed (interface) · 18 and 25. QSP.lock · Pressed (interface) · 18. QSP.pds · Pressed (interface) · 33 |
| **Piedra Del Sol** (16) | PDS.hdr · Pressed (interface) · 33 and 58. PDS.place · Pressed (interface) · 58; from the deck it splits, #170. PDS.1 · Observed · 39 and 61. PDS.1.def · Observed · 37. PDS.2, PDS.2.perm · Observed · 60. PDS.2.exit · Observed · 64, an unruled reading. PDS.burning · Pressed (interface) · 33 and 58. PDS.out · Pressed (interface) · 36. PDS.upkeep · Observed · 36 and 61. PDS.upkeep.x, PDS.force · Pressed (engine) · 64. PDS.force.any · Observed · 64. PDS.deact · Pressed (interface) · 39. PDS.deact.edge · Pressed (interface) · 83. PDS.cd · Pressed · 39 and 64 |
| **The Structure** (1) | PS.share · Pressed (interface) · 58 |

`XI.fort` and `XI.fort.end` needed a [Fortress] Noble Phantasm on the board, and were reached once Ozymandias's
Ramesseum Tentyris was (§46.15.4). `CS.3` was Observed twice, as a
projection at tick 3 (the Night Round, `phaseAt` day inside her 5x5 and night outside) and as a *spend* at tick
70, which needed a clause that reads the phase.

### 46.15.4 A note on the board this was pressed on

The board is *"Quetzalcoatl Audit — Neutral"*, built by `commitWar`: neutral Region, 21x21,
`greatHolyGrailWar`, 3 Turns per Round. Faction 1 is Quetzalcoatl at (0,0) and her Master at (0,1); Faction 2 is
Medea (18,0), her Master (18,1), Nemo (18,2) and his Master (18,3). Everything below is **staging**, and
none of it is a measurement:

- **`npGateRound` was set 6 → 2** as a world setting before `commitWar`, so the Noble Phantasms could be cast
  early, and restored to 6 at tick 72.
- **The GM displaced tokens** with `displaceToken` so the enemy stood in range: Medea (18,0) → (13,0) and Nemo
  (18,2) → (13,2) at Chebyshev 3 from her at (10,0), then Nemo to (12,1), because a Normal Attack's Range uses
  `inAttackRange` and not Chebyshev (*"out of Range (3)"*). Viewing the mount's Scene Level, for her bar
  while she is aboard, is done through the scene level control, as §46.2 says.
- **Cooldowns were staged to 0** whenever the Clause under test was not the cooldown: Winged Serpent 21 → 0 at
  tick 13 to re-summon at the new 2x2 size, and again at ticks 46 and 72; the three Spells, 6 → 0 at tick 27 to
  cast a second Spell without waiting 2◈, and 3 → 0 at ticks 30, 33 and 75; Good God's Wisdom 8 → 0 at tick
  39; Piedra Del Sol at ticks 58 and 82; Xiuhcoatl at tick 79; Riding's, for `RI.notbuff.block`.
- **Health was staged** to reach a threshold or to survive one. Nemo back to 1250 after each Spell (339, 570
  and 566 → 1250). Her Master to his maximum 406 at tick 33 *"to afford Piedra Del Sol and its tolls"*. At tick
  39 his Health max went 406 → 2000 and its value to 2000, because her ZON (2) equals the splash radius (2), so
  Xiuhcoatl's splash always catches him. Her own Health 958 → 60 at tick 40
  to set up the `GGW.1` revival. The mount 1000 → 50 at tick 49, her Master 406 → 40 at tick 51 for `WS.force`,
  and 256 → 45 at tick 64 for `PDS.force.any`.
- **Ozymandias was imported** from `fgt.servants` at tick 65 (actor `tuSn2P3C6SKEVnYJ`), faction 2, with
  `masterId` of Nemo's Master, whose Servant was defeated, and contracted; his Agility and Luck were set to
  15/15 by hand, because an import skips the setup roll. His Ramesseum Tentyris is the [Fortress] Noble Phantasm
  that `XI.fort` and `XI.fort.end` needed (ruling 15), and his Pharaoh of the Hot Sands has the Day-only clauses
  that the spend of `CS.3` needed.
- **W1**, a Berserker test dummy (actor `TMZfs3UckBESEsvU`, faction 2, Health 1500) at (11,3), was the second
  enemy in her splash and the enemy a ride could hit. A staged dummy has no Master: at a boundary it was
  defeated with cause `sustainabilityExhausted`, with no skull, which is why `RI.p2` was not Observed at tick
  43 and was redone at tick 61 after W1 was given a `masterId`.
- **Restored after a probe**: the Defeated effect and a probe Guts instance after `GGW.1` at tick 40 (Health back
  to 958); her Master's Defeated effect at ticks 43, 69 and 79 (§46.4-ET); a staged No Buff effect document
  after `RI.notbuff.block`.

**What the board cost to read.** The stone token (sort 100) sits on top of hers (sort 0): a click selects the
stone, which has no actions, and Tab and the turn panel do not reach her either. A GM-only obstacle, worked
around by selecting her through `token.control()` and raising her sort. The canvas went blank when a viewed Level
was deleted (§46.4-EL) and stayed on the targeting layer after a picker (§46.4-EM). Passing ticks 47 and 48 with `nextTurn`
lost Faction 1's Turn at tick 48. Her Master's Health rose 240 → 340 and 315 → 406 across Round boundaries with
no log entry, which a `preUpdateActor` stack traced to the Faction 1 Home Base heal (+100): not a defect, but the
same heal that later hid the Quetzalcoatlus's forced end (§46.4-EU).

**Seen and not filed.** The reaction card listed each Command Spell twice at tick 3, and *"Teleport Servant"*
twice on the mount's at tick 19. A 25% roll that succeeded on her at tick 37 (Barrel Bombing's Burn) shows only
*"applied"* on the card. While she was aboard at tick 7, Attack and Riding Attack read *"already attacked this
turn"* and the three Spells, which count as her Attack, showed no refusal. Riding's slot tooltip says nothing
about turn ownership beforehand, where a Skill's reads *"Only during your Turn."* None was run to ground.

**Fixes landed during the audit**, code only, and the world was reloaded after each group: 89362b9, 4c45ba3,
b109bd1, e5ef1b5, bb2c505, e17e08f and 95f0628, with the suite at 296 files and 6140 tests green; then badffbd
(#169) and dda9579 (#173), with 298 files and 6154 tests green and lint clean.

### 46.15.5 The readings, ruled

These came up while pressing: each was the sheet being silent, or the engine choosing a reading nobody had ruled
on. The user ruled them on 2026-10-02 (#65, rulings 17–28), and each was built and pressed live one at a time
(W1–W8):

| Reading | Ruling | Built | Pressed live |
|---|---|---|---|
| `PDS.2.exit`, the Burn on leaving | an ordinary Burn, 2◈ from leaving and removable; re-entry makes it permanent again (17) | 9aaea35 | ticks 91–96 |
| Riding Attack's "straight line" | the eight grid lines stay the default; a GM world setting, `ridingAttackLines`, allows rows and columns only (18) | e0cec6e | tick 106 |
| The deactivation window | an End outside the owner's Turn, the GM's slot included, is queued for that Turn's end; Achilles's duel, which states no window, is his own Turn only (19) | 3850b45 | ticks 111–112 |
| #170, which Level owns a deck-cast area | the stone, its field and its Burning label all go on the ground (20) | 9a24d10 | ticks 100–103 |
| #174, Overpower on her own Master | any Servant's Attack on a Master flips, hers included, and the card shows the flip (21) | 6285c5e, f88e168 | ticks 106–108 |
| Xiuhcoatl's reach and splash | the user's change: Range+2, a splash 2 panels around the target's footprint, the [Fortress] measured from the target (22) | b6c1f1e | ticks 84–85 |
| #175, first half: the Round-end order | the Home Base heal runs before the forced-end threshold, as built (23) | nothing to build | — |
| #175, second half: Home Base and Levels | left open, #177 (24) | — | — |
| A defeated Unit's panel | a body leaves the board at the end of the next Turn, token removed and actor kept; until then it is passed through and not stopped on (25) | 9e3c620, 8f6f3a8 | ticks 108–110 |
| Double Move and Riding's +6 aboard | both carry to the mount she drives: 7 + 6 = 13, split around the Attack (26, 27) | 925e1e2 | tick 103 |

Pressing them found three more, fixed or filed. A Master the Overpower flip defeated keeps his Health, and the
card then offered him a Counter (`counterAvailable` read Health only; f88e168). A drag across a Turn could not
find the body's clock, because no defeat recorded its tick (`defeatedAt`, 9e3c620). Ending a platform while the
GM viewed its Level left the canvas on no scene (#176, open).

Two entries in §46.4 still wait on the author: §46.4-DJ (does No Buff prevent S.Crit Up?) and §46.4-DL (does
*"Day Round"* mean the Round or the panel?).

## 46.16 Pale Rider — the Servant who cannot be hurt and is never alone

**All 115 of his Clauses were Pressed or Observed on a live board** (#180, 2026-10-02 to 2026-10-04). The five Anti-World Clauses were pressed with a test
Servant built for them (#183): **Test Heracles (Anti-World)**, Heracles's statblock carrying one Noble
Phantasm, Nine Lives: Shooting the Hundred Heads at [Anti-World] and Range 3 (`test-anti-world-heracles`).
Three more were ruled not Clauses on him (reading 11): Magic Resistance's damage half can change nothing on a
Unit every hit negates to 0. The Clauses span five Units: Pale Rider and the four Kagome Spirits his Noble
Phantasm summons. His Doomsday Come carries the rules of three other abilities.

**Why he finds so much.** Almost nothing he does is an Attack. He has no Health, no Normal Attack and no
reactions; his damage is a field's Health loss; his Noble Phantasm is a prison that summons allies who chase
one enemy each. Each of those is a path the attack-shaped engine walks rarely, and several had never run:
a null Health reaching the defeat chain (§46.4-EY), a passive field outliving a content change (§46.4-EW),
a banished Unit, and a Drag that is neither an Attack nor a Skill.

### 46.16.1 What he cost the engine

His own, fixed and tested:

| Commit | Finding |
|---|---|
| 4567c06, 9e81120, 741b6fd | The Drag could not be aimed from the interface (the `fieldEdge` picker, and its own isolation) |
| a5e228e | A Kagome Spirit could appear outside Doomsday Come, where isolation forbade its Attack |
| 92feffc | "Cannot Evade, Block, or Counter" left Block and Evade on the rung; he Evaded |
| e04c31c | His sheet offered a Normal Attack the bar hides |
| fa21d57 | The Drag ran field contact twice: two Spirits for one dragged Master |
| 4d107bb | A banished Kagome Spirit stayed on the board: it held its panel, guarded and could be targeted |
| 2dfc34e | An Item he could not hold was refused outright; ruled (reading 12), it is left on the floor |
| 1f58d37 | A pickup asked about the panel the token had just left, so nothing was picked up |
| 216b59c | The aiming session dropped an NP's scale, so no Anti-World NP could be aimed across the boundary |
| f60bbfc | The area closed after the first of an NP's Processes, taking later defenders out of its halving |

What was general is §46.4-EV to §46.4-FE, issues #181 and #182 among them.

### 46.16.2 The readings, ruled 2026-10-04

| Question | Ruling |
|---|---|
| Triggers 1 and 3 on his Turn | Two triggers: an enemy that Acts inside on his Turn is charged twice |
| Famine's 3×3 | Must contain its enemy, and hits every enemy in it |
| The Drag | An action Doomsday Come grants, neither an Attack nor a Skill: no budget slot, he has Acted, no ZON or NP Seal, only general Evade bonuses |
| Charm | The charmer's ally and its own side's enemy, for every rule; its own Turn is the charmer's; its Master's Command Spells still reach it |
| A guarded Master (#181) | The rulebook's three cases, for every targeted Attack, with `guardsOf` |
| Records (#182) | A card per field per Turn end, rider rolls in the attack card, a Round-end card, a log entry for each |
| The Anti-World Clauses (#183) | Pressed with a test Servant built for them |
| Magic Resistance's damage half (reading 11) | Not Clauses on him: no outcome can change |
| Breaking Doomsday Come (reading 7) | Every Unit inside at the declaration takes the NP at −50%, its user excepted, each in its own Combat Process with the riders; no cover; the area closes after the last Process |
| An Item he cannot hold (reading 12) | Left on the giver's panel, or his own with no giver; a ground Item stays; moving onto a panel takes every Item there, whole |

### 46.16.3 A note on the board

One board, `Pale Rider Audit — Neutral`, ran 35 ticks. Doomsday Come was cast three times; its cooldown,
his Master's Health and three defeated or out-of-place Units were staged to do it, and each staging is in
#180's record. The chance Clauses before §46.4-FB were read from their outcomes; after it, from the card.

## 46.17 Achilles — the Servant whose sheet turns on a stance

**119 of his 122 Clauses were Pressed or Observed on a live board** (#184, 2026-10-04 to 2026-10-05). Three
wait on readings the sheet leaves open: the shove through a panel he passes (14), the shove that meets a Unit
standing behind (15), and Troias Tragōidia's *"both directions"* for a ride (16). Ruled first, in one
grilling: facing's cones (3 front, 2 sides, 3 back, for every rule), directional Evade, the duel's default end
and who it encloses, the stance across a Turn, Double Move's two sources, and Akhilleus Kosmos's trigger.

**Why he finds so much.** Every clause is gated on Mounted or Dismounted, and the stance changes mid-Turn at a
moment nothing had ever offered. His Noble Phantasms are a ride, a prison and a barrier, each a path the
attack-shaped engine walks rarely: a ride re-asked its gates after moving, a duel let Units walk in and
Command Spells cross, and a spent barrier kept its passive. Two Silent Drops sat under Battle Continuation's
second revive.

### 46.17.1 What he cost the engine

| Commit | Finding |
|---|---|
| ab6567c | The rulings built: cones, directional Evade, the duel's push-out and default end, the Dismount offer, the Mounted record, Double Move's sources, the barrier's floor, the shove as plain damage, the half-Health watermark (§46.4-FF to FJ) |
| 5c8eb4e | Overpower after a complete negation; an expended ability's passives; an NP on an empty ride was free (§46.4-FK to FM) |
| b9d467e | A ride re-asked its gates after moving; a before-damage self-buff paid by the first declared; Divinity tiers by ordinal; no `attack:kind:ridingAttack` (§46.4-FN to FQ) |
| 6d784b1 | Field entry never asked; Command Spells across a seal; the Heel's Luck and roll; a negated effect's contributions (§46.4-FR to FU) |
| 63f2ca8 | The toll's options had no Turn record; "Stage undefined" (§46.4-FV, FW) |

### 46.17.2 What was staged

A precondition the board could not reach in time was staged and named in its evidence line: his Agility
lowered to see Troias restore it, Medusa's Divinity set to D for Andreias's middle tier, No Buff and the two
Seals laid on him, a foreign buff and debuffs for the duel to negate, Heracles's revivals spent to end it, the
barrier re-armed to press the shove, and Masters moved into ZON. Clauses no Unit on the board could reach were
pressed through the real projection instead (Magic Resistance against a Rank C attack, the three-Parameters
refusal) and say so.
