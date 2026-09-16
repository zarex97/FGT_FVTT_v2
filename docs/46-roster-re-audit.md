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
Trace each one: *sheet clause → rule element in the YAML → the engine reader that consumes it*.
A clause whose element has no reader is **Collected**, which Ch. 45 defines and which this
project's dominant defect shape. A clause whose reader is asked the *wrong question* looks
identical on paper and is not caught here — which is why there is a second pass.

**Pass 2 — the live board.** Import the Servant **fresh from the compiled pack**, put it in a real
match, and press every ability through the interface. Read the sheet, the chat card and the audit
log, not the return value.

> Green unit tests are not evidence. Every fixture in `sheet-present.test.mjs` used the document
> shape of `health`, so the code and the tests agreed with each other and not with the system, and
> the defect in §46.4-A survived every one of 4,724 passing tests.

An audit is finished when every clause has been *seen working on a board*, and the findings are
filed: Servant-specific ones in that Servant's case chapter, general ones in §46.4 here.

**By that standard no Servant here is finished yet.** §46.13 records, per Servant and per fix, what
was pressed, what was only traced, and what was not looked at — because an audit that reports only
its findings reads as a clean bill of health for everything it did not reach.

---

## 46.2 Measurement hazards

Every one of these was hit during the Heracles audit, and two of them produced a **wrong finding
that was reported before being retracted**. Check them before trusting a number.

| Hazard | What it looks like | Guard |
|---|---|---|
| **Two GM connections** | Every scheduled effect ticks **twice** — drains, periodics, cooldowns, expiries. A stated 20 measures as 40 | **Fixed (§46.4-D)**, and the hazard is retired: a boundary is now claimed per connection. Counting `/game` *pages* rather than users is still the way to see the situation, because `game.users.filter(u => u.active)` shows **one** either way |
| **Round boundaries** | A drain reads as a heal. Home Base regeneration fires at round end and can exceed the toll | Record `combat.round` before and after every measured Turn; discard trials where it changed |
| **A hand-built board** | `Combat.create` plus a hand-bumped round skips home bases, the Region, faction turns and the first-Round attack ban — and `servantSetupPlan`, so every Servant's Max Health comes from the other derivation (§46.4-K) | Build it with `commitWar`, the function the wizard's Confirm button calls. It is one call and it is the only way to measure what a table will see |
| **`token.update({x, y})` is silently refused** | Movement legality rejects an engine-external write and returns without throwing, so the token stays put and every later measurement is taken at the old position — which reads as a mysterious *"out of Range"* | `displaceToken(tokenDocument, {x, y})` from `engine/io.mjs` — the engine's own mover. Note the **document**, not the placeable: `token.move` does not exist on the placeable |
| **A dialog that `ui.windows` cannot see** | An ApplicationV2 prompt (`askOwner`) is not in `ui.windows`, so a Process legitimately waiting for a click looks exactly like a hung `advanceAttack`. Cost an hour on Asterios, whose Monstrous Strength is offered at every Damage Step | Take a screenshot before concluding anything is stuck. A picture settles in one call what probing settles in ten |
| **Stale test actors** | A Servant with numbers matching no table — a Heracles at 1600 Health with END A, which the table puts at 1500 | Import fresh from the pack for every audit. Never reuse a previous session's actor |
| **Hand-built combats** | `Combat.create` + a hand-bumped `round`/`globalTurn` is not what the war-setup flow produces | Acceptable for isolating a clause; say so when reporting, and re-measure through the real flow before calling something a rules defect |
| **Pack staleness** | Content edits do not reach a running world | `node tools/fgt-world.mjs rebuild`, then re-import the actor |
| **Reading a Combat Process before it finishes** | An attack looks as though it applied nothing | Check `message.flags.fgt.process.state` and its `history`. A Process can be waiting on the **attacker's own** damage-step prompt while the pending panel advertises only the *defender's* reaction, and that dialog can take seconds to render. `advanceProcess` awaits it, so calling the socket directly looks like a hang. This produced a retracted "clause 2 applies nothing" against Asterios |
| **The first `nextTurn` after `startCombat`** | The turn-end sequence does not fire | Discard the first trial; measure from the second |
| **Moving a token to change a positional condition** | Two runs compare identical boards | A long hop is refused by movement legality and the token stays put, silently. Delete the token or move it within its MOV (§46.10) |

**The general rule this produces:** when a measurement disagrees with a sheet, isolate the *pure*
layer first. Call the rules function directly with a hand-built board. If the pure layer is right
and the live board is wrong, the defect is in orchestration or in the harness — and the harness is
the more likely of the two.

---

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
presenter beside it. Ch. 29 §29.2.

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
is what makes the sheets that sell a suspension for one Command Spell work at all. Ch. 15 §15.6.

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
the shape Ch. 43 §43.4 defines for all of them.

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
away; the **effect**-borne branch beside it had always passed the count to `consumeUse`. Ch. 31
§31.7a.

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
hand-built boards as a hazard since Heracles, and §46.13.2 recorded the Max Health override as
"pressed for Asterios (1700) and Penthesilea (1350)" — both hand-imported, both therefore reading
the one derivation that was already right.

## 46.5 The per-Servant checklist

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
  God Hand's eleven charges are not consulted. That matches §31.2's own pseudocode exactly. It is a
  reading of the sheet's priority list, not an oversight — but it is a *reading*, and it is the
  kind of thing to put to the game's author rather than to re-derive per Servant.
- **Overkill is subtracted from every revival source.** Only God Hand's text carries the excess
  clause; `rules/revival.mjs` generalises it and Ch. 31 says so in those words. Same status as
  above.

---

## 46.7 Roster status

A ✅ in **Board** means *the findings below were pressed*, not that every clause was. §46.13 is the
per-Servant record of what each audit left untested.

| Servant | Paper | Board | Findings | Filed |
|---|---|---|---|---|
| **Heracles** | ✅ | ✅ **complete** | 6 (1 his, 5 general) | Ch. 31 §31.7a; §46.4-A, B, G, J; §16.5 |
| **Asterios** | ✅ | ✅ **complete** | 5 (4 his, 1 general) | §46.8; §46.4-H, I, K |
| **Karna** | ✅ | ✅ | 1, closed | §46.9 |
| **Penthesilea** | ✅ | ✅ | 2, closed | §46.10; closes §46.4-C |
| **Medea** | ✅ | ✅ | 2, closed | §46.11 |
| **EMIYA** | ✅ | ✅ | 2, closed | §46.12 |
| Hassan of Serenity | — | — | — | |
| Semiramis | — | — | — | |
| Scáthach | — | — | — | |
| Kingprotea | — | — | — | |
| Castor / Pollux | — | — | — | |
| Raikou | — | — | — | §46.4-C's conditional floor now built for her |
| Anastasia & Viy | — | — | — | |
| Achilles | — | — | — | |
| Mannanán mac Lir | — | — | — | carries §46.4-B |
| Medusa | — | — | — | |
| Nemo | — | — | — | |
| Kiritsugu | — | — | — | |
| Francis Drake | — | — | — | |
| Ozymandias | — | — | — | |
| Pale Rider | — | — | — | |
| Quetzalcoatl | — | — | — | |
| Van Gogh | — | — | — | two class skills repaired by §46.11 |
| Jack the Ripper | — | — | — | |
| Nursery Rhyme | — | — | — | |

**Not authored at all** — no `packs/_source/servants/` file exists: Hassan of the Hundred Faces,
Katō Danzō, Proto Gil, Yan Qing. Four sheets, no implementation. They are not audit failures; they
are absent, and Ch. 45's content row should say so.

---

## 46.8 Asterios — what was his own

Audited 2026-09-16. The statblock, all seven clauses of Mad Enhancement, Natural Monster, Avyssos
of Labrys and eight of Chaos Labyrinthos's ten clauses hold. Measured on a live board: the
Labyrinth opens at **81 panels**, Asterios's MOV reads **10** inside (4 base, +2 Mad Enhancement,
+4 interior), the enemy's reads **5** (7 − 2), the activation debuffs land, and the Noble Phantasm
deals **0** damage as *"(Non-damaging)"* requires.

Two of his four findings are general and live in §46.4-H and §46.4-I. The two that were his, both
now fixed:

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
`defUp −90` in the **same additive bucket** — −30% → ×0.70 — which is Ch. 13 §13.4's composition
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

## 46.13 What this audit did **not** test

§46.1 says an audit is finished when every clause has been *seen working on a board*. By that
standard **none of the six Servants below is finished**, and this section is the honest record of
the gap. It exists because the audit's own finding rate argues for it: every defect in §46.4 was
found by pressing something, and three of them survived a complete paper trace that declared them
correct. An untested clause here is not a clause believed good — it is a clause not yet asked.

Four levels are used throughout, and the first two are **both** live — they differ only in where the
push came from:

| | Means |
|---|---|
| **Pressed (interface)** | A real click on the real control, and the result read from the sheet, the chat card or the audit log. The strongest evidence: it exercises the interface as well as the rule |
| **Pressed (engine)** | Driven on a live board through the **same function the button calls** — `performAction`, `attemptEscape`, `endTurn`, `resolveDefeat`, `dispatch` — with the result read from the same places. One layer below the mouse |
| **Traced** | Followed from sheet text to rule element to the engine reader that consumes it, and no further |
| **Untouched** | Not examined in this pass at all |

**Why the second level exists, stated plainly.** Confirming an attack through the interface takes two
canvas clicks and a dialog button, and scripted click sequences drop that handshake often enough
that a single lethal attack cost roughly fifteen attempts without landing. Every clause below marked
*pressed (engine)* was verified on a live board with live documents and a live combat — what it does
**not** prove is that the control a player would use reaches that function. Where the interface
itself is the thing under test — a refusal message, a label, whether a button is offered at all —
*pressed (interface)* is used and nothing else counts.

The distinction is recorded per clause rather than averaged away, because "we drove it from the
console" and "a player can do this" are different claims and this chapter exists to keep such
claims apart.

### 46.13.1 Per Servant

**Heracles — complete.** Every clause on his sheet has now been exercised, and the ones added in
the second pass were driven through the engine's own entry points: `resolveAttack` / `advanceAttack`
(what the attack dialog calls), `spendCommandSpell` (what the Command Spell button calls) and
`applyEffect` (what the damage pipeline calls at the Damage Step).

*Pressed (interface):* the statblock; Mad Enhancement clauses 1 and 4; Bravery's refusal while the
mode is on; Eye of the Mind offered on the reaction ladder; Nine Lives' range refusal; the
Master-cost line.

*Pressed (engine):*

- **Mad Enhancement 2, 3, 5, 6, 7** — the two damage branches at 1000 → 600 normal and 1000 → 800
  NP; STR +60 / MAG +30; `resource:sustainability:-2` present only while the mode is on;
  `forceTable: "unfavourable"` reached on an Evade; and clause 7 leaving no effect instance behind.
- **Battle Continuation Passive 1**, both branches. A normal attack negated **29** and a Noble
  Phantasm negated **48** — decisive, because rank A's table is `2d10+20` and **48 is outside its
  ceiling of 40**, so only the doubled `4d10+20` can produce it. The first pair of samples (24 and
  35) sat in the overlap and proved nothing; the clause needed a number above 40 to be settled.
- **The four-way revival priority**, with all three available sources armed at once. Undying fired
  first at priority 300 for 223 (375 restored, 152 overkill), leaving `godHandUsed: 0` and
  `bcCooldown: 0` — God Hand and Battle Continuation untouched, which is the ordering his sheet
  prints. Indomitable's `unitRevived` payout landed at magnitude **30**. God Hand Passive 2 then
  survived at 1 on a later attack, with the breakdown stage naming itself *"God Hand: Twelve
  Labors: survives at 1"* and the ledger recording two distinct identities
  (`normal:…` and `ability:…`) for the two attacks.
- **Battle Continuation's revival spent for nothing**, which is the §46.6 reading observed rather
  than argued: against 424 overkill its `5d20` cannot reach, so the cooldown was charged (9 turns,
  3◈ at rank A), no Health was restored, **no fallback ran**, and Heracles was defeated with eleven
  God Hand charges unused. Documented behaviour, and considerably sharper seen than read.
- **Nine Lives** end to end — base 160 → crit 187 → ×4+100 = 848 → 898 with Divinity, the Def Dwn
  rider landing and the Master charged 53.
- **Indomitable**, both buffs, cooldown 12.
- **Bravery's mental-debuff resistance**, which is where §46.4-J was found. Now **50%** with Mad
  Enhancement off and **100%** with it on — the second half being his own *"has no effects when Mad
  Enhancement is Active"* — while a non-mental control stays at 100% in both.
- **The Suspend Skill Command Spell**, §46.8's finding 3, never previously run. `active: true →
  false` while `cannotDeactivate` stayed **true** throughout, `suspendedUntil` stamped at tick 18 +
  3, Master charged 3 → 2. This is the first evidence for §46.4-B's standing claim that a Command
  Spell *"spends itself through `suspendSkill`, a different write"* and so beats the flag that
  refuses every click and every forced deactivation.

*Found while pressing:* §16.5's **ZON penalty** never applied (fixed; verified live at −34,
228 → 194) and §46.4-J's **inverted sign** (fixed; five clauses). Both had been traced as correct.


**Asterios — complete.** Every clause on his sheet has been exercised on a war built by
`commitWar`, in a match whose Region is **Greece** so his home-ground clause could be reached at
all. Engine entry points throughout — `resolveAttack`/`advanceAttack`, `attemptEscape`,
`expireFields` — with the real dialogs answered by real clicks where the system asks a question.

*Pressed (interface):* the statblock; Mad Enhancement clause 1 in his shape; Monstrous Strength
offered at the Damage Step, its label and its **Confirm**, which every Process of his stops at; the
**extension prompt** — *"Asterios may pay 200 Health to keep it open for 2◈ longer"* — chosen with
**Pay and extend**; and the weak-point offer against Achilles, declined.

*Pressed (engine):*

- **Natural Monster**, both effects: `offDebuffResUp` **100** and `defUp` **40**, each 1◈. The
  resistance was contested rather than read — three different **offensive** debuffs all resolved at
  **0% and resisted** while a defensive one still landed at 100%, so the −100% is scoped to valence
  as the sheet says. Def Up then reached **stage 4** on a real attack at `-40`, beside a second
  contributor noted **"Home Base"** at −10, additive to −50% → ×0.50.
- **Avyssos of Labrys**: `critUp` 60, `nAtkUp` 40 and `bleedAtk` 10, all 1◈, cooldown **9** (3◈).
  Crit chance measured at **110%** — §14.6's base 50 plus 60 — so Crit Up has a live reader.
- **`regionSizeOverride`**, the clause that *"had no reader at all until Asterios was finished"*:
  the field opened as `shape: {kind: square, size: 11}` where the base is 9, because `warRegion`
  reads `greece`. Anchored at `{6,6}` where he stood, expiry 18 = tick 6 + 4◈.
- **Clause 2** on the right side only: Achilles took `atkDwn` 40 and `defDwn` 40 for 2◈ and
  **Asterios took none** — the `relations: [enemy]` narrowing holding.
- **Clause 4**, the interior: Asterios's MOV **4 → 8** and Achilles's **7 → 5**, both inside.
- **Clauses 6 and 7**, the attrition engine: Asterios paid exactly **200** (1704 → 1504), expiry
  moved **18 → 24** (+2◈), `lastExtendedAt` stamped, and the extension's own riders landed at the
  *smaller* magnitude — `atkDwn` **20** and `defDwn` **20** for 1◈ — distinct from the activation's
  40s.
- **Clause 8**: with Asterios defeated, one Turn later the field was gone — `fields: []`,
  `regions: []`. And the Noble Phantasm's cooldown then read **24** (8◈), started **at the
  deactivation**: the field was cast at tick 6 and closed at tick 20, so a clock counted from the
  cast would long since have run out. `countFrom: deactivation`, observed.
- **Clause 10's attack half**, both directions, at **Range 1** so distance cannot be the cause:
  *"No legal targets: Asterios is separated by asterios-chaos-labyrinthos"* outward-in, and the
  same refusal inward-out.
- **The escape ladder in full**, earned rather than arranged. Achilles rolled from the border at
  **20%**, failed, and `randomRelocate` threw him from `{11,6}` to `{2,7}` — after which every
  attempt answered `notAtBorder`, which is the puzzle the sheet describes. Walked back and retried,
  his chance climbed **20 → 25 → 30 → 35 → 40 → 45 → 50**, exactly `chanceIncreasePerFailure: 5`,
  and he escaped on the eighth attempt with seven failures recorded.
- **The veteran lead-out**, the clause that makes the Labyrinth a puzzle rather than a soft lock.
  With Achilles (`escaped: true`) adjacent, his Master's escape returned `ok: true, reason:
  "ledOut", chance: 100, roll: null` — **no die rolled at all**. The same field and the same unit
  without the adjacent veteran: `chance: 20, automatic: false`.

*Found while pressing:* §46.4-K, his Max Health — **1800**, not the 1600 the summon path gave.

*Seen in passing, and not otherwise tested:* the **first-Round attack ban**, the bar on Noble
Phantasms **before Round 6**, and the **Home Base** 10% reduction. None had ever appeared on a
hand-built board.

**Karna.** *Pressed:* the statblock; Vasavi Shakti's activation landing on 150 and rank A; Kavacha
and Kundala's −90% reaching stage 4 of the pipeline; its upkeep on all three branches. *Traced
only:* Magic Resistance in full, including the Instakill/Death carve-out and Erase's immunity —
argued from the severity routing, never rolled; Riding, and therefore Double Move, Riding Attack
and Passenger Seat; Divinity; Discernment of the Poor; Uncrowned Arms Mastership's toggle and its
once-per-Round limit; End of Charity, including the Noble-Phantasm cooldown chooser; Mana Burst
(Flames); Flash of the Sun God; and all four Noble Phantasms as *resolutions* — Brahmastra's fork
was evaluated against a real board's options but the Noble Phantasm was never fired, and Vasavi
Shakti's active, Brahmastra Kundala and the four remaining permanent Vasavi clauses (the Divinity
ladder, the 50% Burn, the per-Process upkeep) were never resolved.

**Penthesilea.** *Pressed:* the statblock at its derived 1350; Hatred of Achilles' compulsion
forcing the mode on; `self:modeHeld`; the conditional floor in both states; Outrage Amazon's reach.
*Traced only:* Charisma and its three negations; Golden Rule (Beauty); Howl of the War God;
Goddess of War's four clauses including the Divinity rank shift; Outrage Amazon as a *resolution*;
and the compulsion's second half — *"she will constantly Move towards and Attack said Unit"* — which
was never exercised at all.

**Medea.** *Pressed:* the statblock; Item Construction's chance contributions, before and after.
*Traced only:* everything else — Territory Creation's two passives (both need a Home Base, which
the test board did not have); High-Speed Divine Words; Golden Fleece; Teachings of Circe; Aero,
Argos, Keraino, Trofa and Atlas; the Dragon Tooth Warriors, so the summon roll, the type roll, the
adjacency protection and the per-warrior cooldown are all unexercised; Rain of Light; and Rule
Breaker, whose contract cut and Command Spell transfer are the most consequential untested clause
in this audit. Item Construction's non-stacking was read, not contested with a second instance.

**EMIYA.** *Pressed:* the statblock; the two Noble Phantasm reaches before and after Range Up.
*Traced only:* the range bands — read off the projection, never resolved by attacking at Range 3 or
higher; Magecraft, whose `ofCategory` was read rather than fired (Range Up was injected directly
rather than earned by using a Thaumaturgy Spell). *Untouched:* Independent Action, Magic
Resistance, Clairvoyance, Hawkeye, both Eye of the Mind (True) documents and the B→EX swap at 20%
Health, Reinforcement, Tracing, Trace On with its AC and BC branches, Kanshou & Bakuya, Overedge,
Rho Aias, Unlimited Blade Works, and the Projection: Unlimited Blade Works copy spell — thirteen of
his seventeen abilities.

### 46.13.2 Fixes that were never pressed

A fix verified only by a unit test is a fix verified the way §46.1 warns against.

| Fix | Verified by |
|---|---|
| **§46.4-K**, the Max Health split | Unit tests, and **live through `commitWar`** — Asterios 1600 → 1800. Castor, Pollux and Penthesilea are still source-only, and Penthesilea's 1350 was only ever pressed on the *other* derivation |
| **§46.4-C** for Castor, Pollux, Kingprotea and Raikou | Build-time instantiation and unit tests. **Never on a board** — only Heracles, Asterios and Penthesilea were placed |
| **§46.4-F**, Anastasia's two anchors | Unit tests and the validator. **Anastasia was never placed on a board** |
| **§46.11** for Van Gogh's Item Construction and Existence Outside The Domain | Source assertions. **Van Gogh was never placed on a board** |
| Karna's *Mana Burst (Flames)* reach | Source only; his Range does not move, so there is nothing to observe without a buff he does not have |
| Medea's *Rain of Light* reach | Source only, for the same reason |
| The **Max Health override** (§46.6) | Pressed for Asterios and Penthesilea — but **on hand-imported actors**, i.e. on the one derivation that was already right. §46.4-K is what that missed |
| `withoutModeHeld`, the recursion break | Unit test, plus every live board since. Never deliberately re-provoked after the fix |
| `involvedTurnEnd` | Pressed for Karna. **No check that other content on `actedTurnEnd` did not regress** — Mad Enhancement's drain is the only other user and it was re-measured, but not as a deliberate regression test |

### 46.13.3 Subsystems this audit never exercised

Not gaps in the system — gaps in *this pass*. Anything here could be carrying a defect of exactly
the kind §46.4 collects, and nothing in six Servants' worth of pressing would have found it:

- **Command Spells.** Fifteen of the seventeen, and the §12.11 interrupt protocol. **Suspend Skill
  has now been spent** through `spendCommandSpell` and is recorded under Heracles; it is the only
  one, and it was chosen because a standing claim in §46.4-B depended on it.
- **The Counter rung.** Offered repeatedly and declined every single time.
- **Bounded fields** are no longer among these. Asterios's Labyrinth has now been opened twice on a
  proper board, extended for Health, escaped from the hard way and closed by its owner's defeat —
  `createField`, `expireFields`, `offerExtension`, `attemptEscape` and `endField` all driven. What
  remains untested is every *other* field in the corpus.
- **Injury Rolls, Block, Evade and Luck Checks.** Injury Rolls have since been seen resolving in
  the combat log (*"injury: HP Herc (2)"*) as a side effect of pressing Battle Continuation, and an
  Evade was rolled to force Mad Enhancement's unfavourable table — but neither was tested *as* a
  subsystem, and Block and Luck Checks remain untouched.
- **Master actions**, contracting, conquest and the multi-Servant tax.
- **Terrain, the Grail, victory, day/night, Home Base** — Home Base regeneration was seen only as
  noise contaminating a drain measurement, never tested on purpose.
- **Platforms and Scene Levels**, and summons generally.
- **The turn HUD and the action budget**, beyond pressing End Turn.
- **War setup** — *no longer untouched.* A war has now been built through `commitWar`: scene,
  activated global Combat, factions, painted home bases, Masters, summons, reciprocal contracts and
  token deployment. It found §46.4-K immediately, and three rules no hand-built board had ever
  shown: the **first-Round attack ban**, the **Home Base 10% reduction**, and the Region reaching
  `warRegion`. Everything measured *before* Asterios still rests on hand-built boards.

### 46.13.4 The rest of the roster

**Nineteen of the twenty-five authored Servants are untouched by this audit**: Serenity, Semiramis,
Scáthach, Kingprotea, Castor and Pollux, Raikou, Anastasia & Viy, Achilles, Mannanán mac Lir,
Medusa, Nemo, Kiritsugu, Francis Drake, Ozymandias, Pale Rider, Quetzalcoatl, Van Gogh, Jack the
Ripper and Nursery Rhyme. Four of them have had a clause repaired *by* this audit without ever
being audited themselves, which §46.13.2 records.

**Four sheets have no implementation at all** and were not examined beyond noticing that: Hassan of
the Hundred Faces, Katō Danzō, Proto Gil and Yan Qing.

### 46.13.5 The rate this section exists to defend

Six Servants audited, **sixteen defects found**, and **ten of the sixteen were not the audited
Servant's own** — they were general defects their sheets happened to be standing on. §46.4-J alone
reached five clauses across four sheets and one effect, only one of which belongs to Heracles.

**Five survived a complete paper trace** that declared them correct: God Hand's ledger, the
Labyrinth's escape ladder, Item Construction's valence, §16.5's ZON penalty, and Bravery's sign.
The last is the sharpest of them, because two unit tests covered the clause and both **asserted the
defect from the source** — they restated the wrong number and agreed with it, so content and test
were wrong together and neither could fail. Only asking the applier what percentage came out could
separate them, and nothing did until a live board was made to answer.

The honest reading of that is not that the audited six are now clean — only Heracles is finished by
§46.1's standard. It is that pressing finds things tracing does not, that a source assertion is not
a test of behaviour, and that most of the clauses above have only been traced.
