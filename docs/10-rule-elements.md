# 10 — Rule elements, scripts and priority bands

## What it is

A **rule element** is authored data that declares what contribution an ability should make. *"A percentage into the stage-4 bucket"* (`DamageModifier`), *"an umbrella name for a set of effects"* (`Immunity`), *"a magnitude that scales with how many of an effect the bearer holds"* (`PerStack`). Something has to turn that data into a number, a flag, or a modification that a system somewhere downstream can consume (`module/rules/elements.mjs:1-20`).

The execution layer is a **dispatch table keyed by `key`**, not a class hierarchy. Sixty-two functions, one per element type, each push contributions into a `out` object. A rule element's key determines which function runs; that function resolves any literal values, table lookups, or `@`-expressions, validates the result, and routes it to the appropriate bucket in the `Contributions` structure (`module/rules/elements.mjs:811-813`). Without this layer, authored content loads into a compendium where it sits doing nothing — which is the failure mode the content validator exists to prevent, one layer up.

Priority **bands** make elements deterministic. Authored content sometimes declares elements in a different sequence on different clients, depending on when documents loaded. Bands sort elements into execution windows before lexicographic source id tie-breaks, so every client computes the same result from the same board (`module/rules/ordering.mjs:1-10`). The two that matter most are 30 and 35: an aura must be **collected** before anything **reads** it — *"Clarity doubles the Area CritUp it receives"* — and running it first would double nothing (`module/rules/ordering.mjs:12-15`).

**Scripts** are a closed registry — entries written in code, never `eval`. A compendium is data other people wrote; a `script:` naming something outside this object runs nothing and logs a warning. It does not throw — a malformed magnitude must not take the whole turn down, and the same holds here — and it certainly does not `eval` (`module/engine/scripts.mjs:1-24`). The corpus uses exactly one: `nurseryRhyme.rewind`, for Nursery Rhyme's Glass Game rewind mechanic. Ch. 45 budgets four across ~130 abilities; adding a fifth entry is a design conversation, not a merge (`module/engine/scripts.mjs:36-44`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/elements.mjs` | Dispatch table (`EXECUTORS`), `collectContributions`, predicate deferral, value resolution |
| `module/rules/ordering.mjs` | Priority bands (`PRIORITY_BANDS`), element sorting (`orderElements`) |
| `module/engine/scripts.mjs` | Named script registry (`SCRIPTS`), execution (`runScript`) |
| `module/rules/effects/count-targets.mjs` | Magnitude computed from a phase's resolved target set |
| `module/rules/effects/families.mjs` | Effect families — umbrella groupings, e.g. *Bind* for all stun-class effects |
| Consumers | Damage pipeline, ability targeting, aura reading, effect application, stat resolution |

## How it works

### Collection

`collectContributions(abilities, ctx)` iterates each ability and its rules, passives, and active abilities (`module/rules/elements.mjs:95-161`). Elements are ordered by `orderElements` before execution (`module/rules/elements.mjs:117`), so two clients holding the same documents in different load order compute the same result (`module/rules/ordering.mjs:109-120`). If an element has no executor function in `EXECUTORS`, it is collected into `unhandled` — a bug surfaced (`module/rules/elements.mjs:152-156`).

Predicates are tested per-unit, against only that unit's options (`module/rules/elements.mjs:95-98`). An element naming `target:` or `attack:` or board state like `self:inHomeBase` cannot be answered yet — the target does not exist, the attack is not yet built, the board is not yet snapshotted. These predicates travel to whoever can answer them, marked by `deferredPredicate` (`module/rules/elements.mjs:217-223`). A deferred predicate travels on the modifier and is re-tested by the consumer (damage pipeline, effect application) with the full option set. A predicate naming `self:attribute:outsider` inside a defensive clause means *"whoever is hitting the bearer"*, but answering it against the bearer's own options reads "false" for ever — so `defer: true` forces deferral even when the logic suggests otherwise (`module/rules/elements.mjs:193-211`). The board annotations a unit only holds once the board pass has run are deferred by prefix (`DEFERRED_PREFIXES`): `self:inHomeBase`, `self:onPlatform:`, `self:inField:` — and **`self:fieldActive:`** (#65), because `ownedFields` is written by `annotateFields`, after collection. That last one is what lets a Noble Phantasm's own passive rule hold *wherever its owner stands while its field exists*: Piedra Del Sol's *"all damage dealt is increased by 180; all damage taken by Quetz is reduced by 50%"* is `FlatDamage` gated on `self:fieldActive:quetz-piedra-del-sol` (the attacker, in the pipeline) and `Ward` on `target:fieldActive:quetz-piedra-del-sol` (the defender), and not a rule of the 7×7 — ruled **"on the field means on the board"**.

### Bands and ordering

Nine bands execute in order: `base` (10), `additive` (20), `auraCollection` (30), `auraConsumers` (35), `multiplicative` (40), `applicationChance` (50), `absoluteSet` (60), `immunity` (70), `bounds` (80), `suppression` (90) (`module/rules/ordering.mjs:18-29`). Each element key belongs to one band; an unknown key defaults to `additive` rather than sorting to either end, so new elements never silently run before everything or after everything (`module/rules/ordering.mjs:90-96`). Within a band, elements sort by source id lexicographically, then by their original order in the array (test: `module/unit/ordering.test.mjs:42-70`).

The `consumesAuras` flag overrides band assignment: an element that reads aura magnitudes runs in the consumer band, whatever its key, because the dependency (reading auras) decides the order, not the name (`module/rules/ordering.mjs:94-95`).

### Value resolution

An element's value may be a literal, a `table:` key looked up against the owning ability's rank, or an `@`-expression. `resolveValue` unpacks all three and handles scale adjustments (`module/rules/elements.mjs:319-321`). `perStack` scales a magnitude by how many of a named effect the bearer holds: `base + value × floor(count / each)`, returning 0 if the bearer holds none — a distinction that matters (Ch. 45: Kingprotea's Max Health per stock pays nothing at zero) (`module/rules/elements.mjs:323-350`).

Magnitude factors — `magnitudeFactor` and `magnitudeRoundTo` — are applied here, in one place, so every element gains them without re-implementing the logic. Mad Enhancement is *"all damage dealt is increased by X% ... this effect is halved for Attacks which use Base Attack (MAG)"*, and `magnitudeFactor` lets the single table value be multiplied by 0.5, avoiding a second ladder. `magnitudeRoundTo` applies the author's own rounding; Kingprotea's A+ halves to 42.5 and rounds DOWN to 40 (`module/rules/elements.mjs:832-853`).

### Scripts

`runScript(name, ctx)` looks up a name in `SCRIPTS` and calls it if it exists, or logs a warning and returns `[]` if it does not. Every script in the registry is a function taking a context object and returning an array of intents. `nurseryRhyme.rewind` restores an arbitrary historical snapshot across a unit set by walking the board, resolving an index, diffing two states, and emitting a heterogeneous batch. Why this one is not data: every other ability is a composition of named mechanisms. This one produces something no other rule element can describe — it would be inventing vocabulary for a shape nothing else has (`module/engine/scripts.mjs:54-64`, `module/engine/scripts.mjs:32-44`).

## Invariants & edge cases

1. **A new element key needs an `EXECUTORS` entry.** A missing entry surfaces the problem in `unhandled` rather than silently doing nothing (`module/rules/elements.mjs:152-156`).

2. **Unknown keys default to `additive`, not the ends.** A new element must not sort to the front or the back of execution order simply by not being listed (`module/rules/ordering.mjs:83-96`, test: `module/unit/ordering.test.mjs:32-35`).

3. **Aura collection precedes aura consumption.** Band 30 < 35, and Clarity reads the Area CritUp aura in band 35, so it must collect Aura elements (band 30) first (`module/rules/ordering.mjs:12-15`, test: `module/unit/ordering.test.mjs:17-22`).

4. **Suppression runs last.** Band 90 is the highest, so suppression sees every contribution and can erase anything that came before (`module/rules/ordering.mjs:28`, test: `module/unit/ordering.test.mjs:24-26`).

5. **Collection runs per-unit with the unit's own options only.** A predicate naming a target cannot be answered at collection time — there is no target. Board state like `self:inHomeBase` reads as "false" until the snapshot is built (`module/rules/elements.mjs:139-148`, history: `module/rules/elements.mjs:176-180`).

6. **`PerStack` must live on something collected once.** An effect's rules are collected per instance, so authoring a `perStack` on the effect itself would be collected `n` times and scaled `n` times (`module/rules/elements.mjs:342-344`).

7. **Scripts never throw.** A malformed script entry logs a warning and returns `[]`; it does not stop the turn (`module/engine/scripts.mjs:56-62`).

## Traps and anti-patterns

**Describing an element's keys without describing its fields.** `stage` on a `DamageModifier` is
**not** a pipeline stage number — it is a two-valued selector that picks the modifier key, and the
pipeline stage follows from that key (`module/rules/elements.mjs:871-875`): `direction: "taken"`
with `stage: "flat"` routes to `flatReduction` and otherwise to `defUp`; dealt damage routes to
`flatDamage` or `atkUp` the same way. An explicit `modifierKey` overrides both. The distinction is
load-bearing — a flat +120 and a +120% are different numbers, and
`packs/_source/abilities/vorpal-blade.yml:50-53` comments on getting it wrong once. Seven authored
files set `stage: flat`, yet the field was absent from the `DamageModifier` descriptor, so the
editor could not offer it — and the drift test in Chapter 39 could not see the gap, because it
compares element **ids**, never element **fields**. Fixed in
[#22](https://github.com/zarex97/FGT_FVTT_v2/issues/22) by adding
`{ key: "stage", type: "select", choices: ["flat", "percent"] }` to the descriptor
(`module/rules/authoring/elements.mjs`). **A drift test over ids alone only catches half the
vocabulary; an executor's field reads can still diverge from its descriptor's field list** — worth
a general field-level drift test as a follow-up, since this fix closed the one instance rather than
the class.

**Copying a fixed list of fields out of an authored rule.** Seven Silent Drops had this shape:
`r.effect ?? r` dropped the `duration` and `magnitude` beside a nested effect (f0bfedf, ed4a77b);
an `Aura` copied a list without `check` (8037d25); `CheckModifier` dropped `roll` (75713bb);
`CritModifier` had no `component` (46a26a8). Every executor builds its contribution field by field,
so any key it does not name is gone. **This is now enforced.** `test/unit/rule-survival.test.mjs`
runs every rule element in the real corpus through the real `collectContributions`, and every phase
through `effectSpecsOf`, inside a Proxy that records each authored path anything reads. A leaf that
nothing read, and that did not travel into the contribution inside an object carried whole, fails,
naming the file, the element and the key. Keys consumed off this Route are exempt per element type
with the reason (a bounded field's `relations`/`kinds`/`exemptIf` are read by
`rules/bounded-fields.mjs#interiorModifiers`; `direction` beside a `modifierKey` restates it). The
first run found Pollux's Magic Resistance aura for Castor authored as `rules:` where the executor
reads `elements:` (#102), and seventeen more unread keys (#103), listed as known drops that may only
shrink. It also closes the follow-up the entry above asked for: a field-level check of what an
executor actually reads, rather than of its descriptor's ids.

#103's keys, closed one executor at a time, each pinned in `test/unit/rule-keys-103.test.mjs`:

- **`FlatDamage`** carries `npValue` (Vorpal Blade's +50 is 0 against a Noble Phantasm) and
  `supersedes`, a list of Skill content ids whose flat bonus it replaces. Every flat bonus now carries
  `sourceContentId`, so stage 7 can drop a superseded one: the Sun Stone's 180 stands in for Goddess's
  Divine Core's 120. The id is read off the record the collector is handed
  (`rules/snapshot.mjs#abilityRecordOf`, shared by `contributionsOf` and an Attack's window abilities),
  and that record dropped `contentId` for as long as it was written by hand: the executor was right, the
  Hop before it discarded the key, and the two stacked to +300 on a board while #103's test, which passed
  `contentId` in itself, stayed green (#126). The route is pinned in `test/unit/supersedes-projection.test.mjs`
  and, as a Hop of its own, in `CONTRIBUTION_ROUTES` of `test/unit/survival.test.mjs`.
- **`CritModifier`** carries `npValue`, and its `aspect: chance` now lands where crit chance is read:
  `checkModifiers` with `check: "crit"`. It had produced a `critUp` modifier that nothing reads since
  the coin flip was replaced, so six clauses raised nobody's crit chance: Oblivion Correction,
  Existence Outside the Domain, Independent Action (Viy), Pollux's Twin God's Divine Core, Area Crit
  Up and Crit Up (Viy). An aura's `CritModifier` payload runs through the executor too.
- **`Aura`** carries `npValue` when the aura is its own modifier: Atk Up (Charisma) is 20%, and 10%
  against a Noble Phantasm.
- **`Immunity`** reads `scope: debuffs` and `except`. Debuff Immune's rule is now the only thing that
  makes it block: the applier's check on the held effect's id is gone, and the file's exceptions
  (Instakill, Death, Erase) are what keep the terminal effects on their own ladder.
- **`ForbidReaction`** reads `direction`. `incoming` takes the rungs from whoever the bearer attacks,
  the same convention as an incoming check modifier; the snapshot carries them as `refusesReactions`,
  and the attack folds them into the ladder and the counter check. Normal Presence Concealment's
  *"cannot be Blocked or Countered"* had forbidden the Assassin's own Block and Counter instead.
- **`RangeDelta`** carries `isBuff`, as `StatDelta` and `MovDelta` do. Eight sites said `isBuff:
  false` (Mad Enhancement on seven Servants, Kingprotea's Huge Scale) and only their MOV halves kept
  it. The flag is declarative today: no engine path removes or blocks a Skill's stat delta.
- **`MaxDelta`**'s `perStack` was never dropped. Huge Scale's magnitude is `0.2 * @self.baseHealth`,
  which resolves only against a Unit's refs, and the survival test's exemption for that case matched an
  expression starting with `@` and not one containing it. It scales 0, 200, 600 for 0, 1, 3 stocks.
- **`DamageModifier`** has no `mode`. Avenger's `mode: flat` was read by nothing: `modifierKey:
  avenger` is what makes the +80 flat, and `stage` is the executor's spelling when no key names a
  bucket. The line is gone and the validator refuses the key.
- **`RevivalSource`** counts its budget in `charges`. Normal Lancer's Battle Continuation said `uses:
  1`, so *"can only be used once"* had no limit. The content now says `charges: 1`, and the validator
  refuses `uses`.
- **`SustainabilityGain`** carries `targetPredicate` and listens for `unitKilled`, a new event fired on
  the killer (Appendix E). It had listened on `unitDefeated`, which the victim hears, and dropped the
  predicate: Jack and Medusa gained Sustainability when they themselves died, for anybody, and never
  when they killed a Human or a Civilian.
- **`OnEvent`**, first of three: a handler names its targets on each action. `target: nearby` now takes
  `includeSelf` and `alsoIncludes: partner` (the linked partner wherever it stands), which is the
  Dioscuri's 'Pollux' buff; its handler-level `targeting` block was read by nobody, so S.Crit Up only
  ever reached the bearer. The validator refuses `targeting` on an OnEvent.
- **`OnEvent`**, second: a `chance` belongs on the action, where `chanceGatePasses` reads it and the
  caller rolls a d100 (the `effect:` shorthand keeps its own, which it hands to the ApplyEffect it
  desugars to). Castor's 5% NP-cooldown clause had fired on every Normal Attack; `damageStepEnd` now
  rolls for its actions. The Normal Archer's coin needed three things that did not exist: the
  `masterDefeated` event (raised on a defeated Master's Servants at the tail of `resolveDefeat`), a
  `SustainabilityGain` action, and the chance on it. Sustainability gains are now written as the
  result from the snapshot's figure, because the stored one is `null` until first written.
- **`OnEvent`**, third: `at: turnEnd` defers the actions. `fireEvent` writes a `deferred` log entry
  carrying them, `io.defer` keeps it on the match, and the turn hook pays it through
  `scheduler.runDeferred` once `endTurn` has run. Raikou's Tenmōkaikai now ends at the close of the
  Turn she falls, not the instant she falls. The validator refuses any `at` but `turnEnd`, the only
  boundary drained.

With that, `KNOWN_RULE_DROPS` is empty: every key inside every rule element reaches a reader.

## Open questions

- **Answered: the count is not fixed, but it cannot drift.** Measured live, `EXECUTORS` holds **62**
  entries and the authoring vocabulary holds **62** descriptors, and the two sets are exactly equal — no
  executor without a GM-facing descriptor, no descriptor without an executor. That correspondence is
  enforced in both directions by `test/unit/authoring-elements.test.mjs:18-35`, whose failure messages say
  what each direction means: *"the engine executes X and no GM can author it"* and *"the picker offers X
  and nothing executes it"*. So the table is expected to grow; what it may not do is diverge from the
  vocabulary. (The third assertion compares the two lengths, so it holds at any count — its title said
  "covers all 54" long after the count reached 62, and now says what it actually checks.)

- **Multi-client determinism via source id has never been tested in a live world with changing load order.** The code is correct by reading, but a test of two clients loading documents in reverse order and computing the same contributions would confirm it (`module/rules/ordering.mjs:102-105`).
