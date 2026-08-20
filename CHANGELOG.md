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

### Added

- **Part II of Ch. 45 is complete** — all eight resolution-system chapters (13–20).
- **Cost supersession (§15.4).** `resolveCosts` resolves a whole set of pending costs against
  each other *before any is charged*, because supersession is a relation between costs and one
  paid before its supersessor is known has already been paid wrongly. Karna's NP cost overwrites
  the 20 Health his Master loses when he Acts; the Hanging Gardens upkeep overwrites the NP cost
  in the other direction. Both are authored data (`additionalCosts`, `upkeep`), not named in
  code. A cycle collapses to one survivor rather than none — none would make a Noble Phantasm
  free.
- **Contracting (§16.2)**, with its dialog. The enemy-clearance check excludes the target, which
  is itself an adjacent enemy — a naive reading refuses every enemy contract in the game.
  Independent Action at EX or A+ returns `Infinity` rolls, because it is a prohibition rather
  than a difficulty and a number is a rule enough attempts can beat. Conquest frees and contracts
  in one descriptor list, so the Free state the rules describe is never observable.
- **§28.8's legality rendering**, with three kinds that are genuinely different decisions:
  `hard` refuses, `overridable` offers the Command Spell inline *only when it is affordable*,
  and `confirm` does not refuse at all — the Grail placement is legal and catastrophic, so it
  takes a second deliberate click.
- **The Scene Level operations (§20.2, §20.9)** — create, scatter, delete, owner-effect reversal
  and the teardown that sequences them. Previously logged by name; now performed.
- Two new intents, `markContract` and `grantCommandSpells`, with their writers.


- **Part III of Ch. 45 is complete** — all ten Foundry-architecture chapters (21–30).
- **The spatial `AuraIndex` and §23.9's invalidation table.** The index does spatial narrowing and
  nothing else: relations stay in `collectAuras`, which already decided them correctly, because a
  second implementation would be two answers to one question. Held against the linear scan by a
  24-unit, mixed-radius equivalence test. The table drives the canvas index, the overlays and the
  desync check — and the chapter now records honestly that it names a *snapshot cache* this system
  does not have, because snapshots are computed per resolution.
- **`@intentional` (§24.6).** An unmarked `priority` override is now a build error; a marked one
  warns and names the band it lands between. The marker must be prose.
- **Charm and control transfer (§25.7)**, following the chain rather than one hop — if A charms B
  and B charms C, C answers to whoever holds B — with a cycle guard, because an unguarded cycle
  hangs the turn HUD.
- **The round-boundary desync detector (§25.10)**, hashing positions, health and effect ids and
  deliberately nothing else: any field that can legitimately differ between clients turns it into
  a false alarm, and a detector that cries wolf is turned off.
- **Per-viewer chat cards (§26.7)**, redacting by side. A row with no side is kept — unattributed
  is a board fact, and dropping it leaves a breakdown whose numbers do not add up.
- **Per-rung reaction timeouts (§27.5).** GM-clocked, with the deadline stored on the message so
  no two clients disagree, and every default asserted to spend nothing as a property over the
  whole table rather than reviewed row by row.
- **The last three §28.9 overlays** — Decoy pull, platform footprints with level badges, and the
  Grail contest ring. The overlays now redraw from `fgt.invalidate` instead of a hand-maintained
  hook list that had gone stale in both directions.
- **The Master sheet (§29.3), the token HUD (§29.5) and the ability editor (§29.6).** The editor's
  targeting picker shows diagrams rather than internal names, and a drift test holds its shape
  list against `expand()` in both directions.
- **The game log (§30.8), export (§30.9) and GM overrides (§30.10)**, with a viewer that filters by
  round, kind, actor and text. An override is recorded beside what it changed, with the original
  struck through and the reason enforced in the rules layer.
- **§16.9's per-Servant Command Spell pools**, which §29.3 needed and which were specified and
  absent: a flat count could not say which Servant a spell reached, so Unbound could not be
  derived. Added beside the existing field rather than replacing it — Ch. 39's migration runner
  does not exist, and retyping a live field would break every world that has one.


- **The summon dialog (§37.6)**, `module/apps/summon-dialog.mjs`. Pick a Servant, a Master, the
  war Region and the Master's parameter grants; roll; see every line with its arithmetic and a
  per-line re-roll; then commit. Nothing is written until the last step, which is why the engine
  operation is `prepareSummon` → `rerollSummonLine` → `commitSummon` rather than one call.
  Changing a dropdown does **not** re-roll — grants apply after the rolls, so nothing about a
  Master or a Region can change a die already thrown. Re-rolls lock once the match starts, as a
  disabled button with its reason on screen. Reached from a **Summon** button on the Actors
  sidebar and a context entry in the Servant compendium; a bare compendium drop onto the canvas is
  refused and redirected here, because the actor it makes carries the template's numbers rather
  than this Servant's rolled ones and nothing on the sheet would say so.
- **The Wisdom of Dún Scáith setup flow (§36.4)**, as **two** dialogs, because the section gives
  its two decisions to two different people: the GM curates what to offer
  (`module/apps/copy-dialog.mjs`) and Scáthach's player picks two
  (`module/apps/choice-dialog.mjs`). The rank band is a toggle rather than a filter, and
  `canCopy` is re-checked when the player answers — the offer and the pick are separated by a
  human. An ability reaches its dialog through `opensDialog` on its own document, so the next one
  needs content and not code.
- **`FGTSocket.ask(userId, spec)`** — a question routed to **one named user**, awaiting their
  answer, alongside `request` (always the GM) and `broadcast` (nobody in particular). Answers are
  rendered by `module/apps/prompt.mjs`, a kind table rather than a dialog class per question.
- **A Master's setup rolls**, from a button on its own sheet: five lines and no choices do not
  warrant an application of their own.
- **`test/unit/i18n.test.mjs`** holds every literal `localize` key in the templates and modules
  against `lang/en.json`, and **`test/unit/module-graph.test.mjs`** resolves every relative
  import, every `PARTS` template and every `system.json` entry point. Neither defect throws
  anywhere a test could see it: a missing key renders as the key, and a mistyped import path is a
  black screen with one 404 in a console nobody has open — which is how `v0.2.10` shipped.


- **The roll log (§14.8)**, `module/rules/roll-log.mjs`. Every Evade and Luck Check files a
  record carrying its formula, the raw die, each modifier with its source and stage, and the
  total; records accumulate on the Combat Process state and render on the attack card, filtered
  per viewer so a hidden roll stays hidden. A GM re-roll **keeps the original** and links to it,
  because a replacement that erased its predecessor would let a re-roll pass unnoticed.
- **Setup rolls and the summon operation (§14.9, §37.6)**, `module/rules/setup-rolls.mjs` and
  `module/engine/summon.mjs`. `summonPlan` returns an ordered, inspectable sequence — rolls
  first, then Master grants, then the war Region's, ending in a re-rollable confirmation. A
  Servant's Max Health takes **no roll**; a Master's is a coin-flipped `2d100` over a flat 250.
  Granted parameter steps are stored separately (`system.grantedSteps`) and move Base Attack by
  ±10 each, for STR and MAG only.
- **Items (§15.8)**, `module/rules/items.mjs` and `module/engine/items.mjs`, with two new
  intents (`itemQuantity`, `itemGrant`) and their writers. `transferable` defaults to **false**,
  and a consumed item is spent **before** its effect runs so a consumable that kills its bearer
  is still gone.
- **The remaining §15.4 requirement kinds** — all twelve, with `REQUIREMENT_KINDS` exported so
  content can be held against it. An unrecognised kind refuses.
- **Copied abilities (§15.7)**, `module/rules/copy.mjs` and `module/engine/copy.mjs`. Copies are
  by reference (`copiedFrom`, no phases of their own), take the copier's rank and cooldown, and
  are read through `effectivePhases` — the single reader, so no phase consumer can forget.


- **Penthesilea**, the second Servant of the D1 pass, with two new effects (`debuffImmune`,
  `npRegen`). Her *Charisma* is the archetypal aura and the first content to exercise A5's
  relation filtering: *"all damage dealt by **other** allied Units within a 2 panel area"* means
  allies **without** self, so `self` drops from the default `[ally, self]` and she gains nothing
  from her own Charisma. Ch. 11 §11.6 cites this exact case.

  Four of her features are deliberately unauthored, each named in Ch. 45 rather than stubbed:
  *Hatred of Achilles* (the targeting executors write keys the resolver does not read, so the
  compulsion would compel nothing — and its Command Spell counterpart from B1 would have had
  nothing to negate), *Goddess of War* (per-damage-event `1d4` rolls and a rank-raising passive),
  Charisma's own suppression clause (Heracles's Bravery problem — an ability disabled by its
  owner's other ability), and *Howl of the War God* (a target-attribute predicate no content has
  exercised yet).
- **Penthesilea is fully authored**, and four engine additions came with her (Ch. 45 D1). None
  would have been designed up front; all four are general. This is the argument for authoring
  content continuously rather than last, made concrete.

  - **`Compulsion`** (`rules/compulsion.mjs`), for *Hatred of Achilles*. Positional like an aura,
    because it lifts the instant the Greek Male leaves — an applied effect would need a
    position-watcher writing on every move. Two halves that had never met: `unmetCompulsions`
    read a `hatred` effect **nothing applied**, and §45.4 records that the targeting executors
    write keys **nothing reads**. `resolveTargets` now narrows a compelled unit's candidates,
    because the compulsion does not make the attack illegal — it makes the *choice* illegal.
  - **`skill:`, `skillActive:` and `region:` roll options** (`rules/options.mjs`). `tables.mjs`
    has predicated on `target:skill:divinity` since the tables were transcribed and **nothing
    ever emitted a `skill:` option**, so the Divinity-versus-Divinity clause could not fire in
    either direction. Option-building moved out of the attack flow into the rules layer, where it
    can be tested without Foundry — which is the only reason the gap lasted this long.
  - **Self-options in `contributionsOf`**, which passed an **empty set**. Every `self:` predicate
    in the system was unsatisfiable, so *Charisma*'s "negated when Mad Enhancement is activated"
    could never have fired.
  - **Rolled modifiers**, for *Goddess of War*: a magnitude rolled per damage event rather than
    fixed before the attack, with the dice kept on the caller like every other roll here. This
    turned up a separate bug — a modifier with no numeric magnitude produced `NaN`, which
    survived every pipeline stage and clamped the final total to **zero**. One malformed element
    silently deleted an attack.

  One clause is left: Goddess of War's *"Divinity Rank is increased from B to A"*. `RankShift`
  moves a parameter; this moves another ability's rank, a different operation no other Servant
  needs yet. Her Divinity is authored at B.
- **Command Spells can interrupt a resolution in flight** (Ch. 45 B1, completed). Six of the
  sixteen commands shipped logging their own names, because changing an in-flight resolution
  needs the ladder to be interruptible — a property of the state machine, not of the command.

  `applyInterrupt` is a GM-side mutation (§27.9): it changes a Process another client is
  participating in. Escape sends it to `noDamage`; Damage Block, Damage Up, Halve NP and NP Max
  accumulate a damage factor applied to the finished total; Teleport Servant replaces the
  defender and restarts the ladder with the reactions it never had a chance to declare
  forbidden; Survive Kill is honoured at the moment of defeat rather than when declared; and
  Force NP records an override consulted **per reason**, so it bypasses cooldown and still cannot
  bypass the Round gate.

  The damage factors compose **multiplicatively**. Halve NP followed by NP Max must come back to
  ×1 in either order, and summing the deltas would give +50% both ways round — a test worth
  having precisely because both commands sit in the same catalogue.

  The offer is rendered on the attack card to whichever Masters could actually spend, per viewer.
  Non-prompting rungs are held open for the §17.4 timeout (`commandSpellTimeout`, 45s, 0 to
  disable) **only when somebody could actually use a command there** — a blanket pause on every
  rung would be unplayable. A window that closes unused says so, so a disconnected player sees
  the opportunity they missed rather than silently losing it.
- **The environment** (Ch. 45 C2) — the Day/Night cycle, the Home Base and the Holy Grail.
  `snapshotBoard` runs `annotateEnvironment` beside terrain and auras, for the same reason: these
  are facts about the *field*, and a unit projected alone cannot know which Round it is or whose
  ground it is standing on. `endRound` maps the Home Base descriptors into intents.

  The phase is a **pure function of the round number** — one coin flip at the start, so nothing
  drifts and a reconnect cannot lose it. The `Dark` rule carries no `npValue`, because both its
  clauses are "including NP" and an `npValue` would silently halve them. E1's exclusion is
  narrower than it reads: only combat *within* the base disqualifies, so a unit that sortied out,
  fought and came home still regenerates. And the Grail's two distances differ — a claimant must
  be adjacent, a blocker need only be in the 2-panel Area — which makes two adjacent rivals a
  standoff, as intended.

  Not done: Region, Random Events, Civilians, the board setup sequence and E5. The Grail's rules
  are complete but **have no runtime owner** — nothing holds a `GrailState` yet.

- **`tools/check-layers.mjs`**, and the finding behind it. `eslint.config.mjs` has computed a
  `zones` table since the project started; its header calls the layer boundary *"the rule that
  matters here"* and says a violation *"is a lint failure rather than a code review comment"*. It
  was neither — `zones` was exported and **nothing consumed it**, because enforcing it needs
  `eslint-plugin-import`, which is not a dependency. So the project's central architectural rule
  was documented, computed and unchecked.

  It surfaced the honest way: `rules/environment.mjs` imported `engine/intents.mjs` and lint
  passed. The checker now enforces `ALLOWED` as part of `npm run lint`, and found three
  pre-existing violations, recorded as named exceptions with the reason each exists rather than
  waved through by widening the table. A stale exception fails too, so the list shrinks as the
  debt is paid.

### Fixed

- **Every Servant sheet threw on open.** `canContract` called `.includes` on
  `system.servantClasses`, which is a `SetField` and therefore arrives as a `Set` — and a `Set`
  has `.has`, not `.includes`. The `?? []` beside it reads like a guard and defended against
  nothing: the field is required, so it is always present and always a Set. Not a data or
  migration problem; a brand-new Servant failed identically.

  A guard test now pins the whole class: in the layers that read documents, a `SetField` must be
  spread before `.includes`. It immediately found a **second** instance — `io.setContract`
  testing `master.system.servantIds`, which would have thrown the first time anyone formed a
  contract and which nothing had exercised. Two reasons no existing test caught either: the rules
  layer works on snapshots, where `snapshotUnit` has always spread these into arrays, so the
  pattern looks safe when read; and the document-touching layers have no unit tests because they
  need a live world.

- **`destroyLevel` refuses while passengers are still aboard.** Verified against the Foundry v14
  source: `TokenDocument#level` is `required` and non-nullable, and `Level._onDeleteOperation`
  fixes only the *view* — it does not re-parent tokens. A level deleted under its passengers
  leaves every one of them pointing at an id that no longer resolves, which survives a reload
  and which nothing on screen explains. §20.9's scatter-before-delete order is therefore enforced
  by the schema, not merely recommended.
- **`visibility.levels` is one-way per level**, so creating a platform level now sets the
  reference on both sides. Setting only the platform's left the board unable to see what was
  hovering over it.
- **`masterMode` and `interruptTimeout` were registered settings that nothing read.** Both are
  live now: §14.9's three Master rank modes, and §27.5's configurable prompt deadlines.
- **`io.prompt` emitted an operation that did not exist.** It has asked for `"prompt"` since
  intents were written and `OPERATIONS` has never had that key, so every prevention Luck Check
  threw `UNKNOWN_OP` where a player should have been asked a question. The operation exists now,
  and forwards to the named user through `ask`.
- **The `masterMode` setting was registered and read by nothing**, so every Master was ranked by
  essence whatever the world was configured for. §14.9's other two modes work: `coinFlip` puts
  the flip on the Base Attack line itself, and `rankless` gives every Master 100.
- **A resolved setup line reported the die where it meant the contribution**, so a tails `2d100`
  of 87 would have displayed as "250 + 87" for a result of 163. `rolled` and `applied` are now
  separate.
- **Spending a Command Spell threw, and so did every platform write.** Four call sites passed
  `applyIntents` its io adapter *positionally* with a third `{ reason }` argument no signature
  accepts, so `canWrite` came out `undefined` and the first non-log intent died on
  `canWrite is not a function`. B1's whole spend flow and C3's board, fall and destruction
  writes were dead on arrival. Fixed by a single `applyWorldIntents` helper plus
  `test/unit/applier-callsites.test.mjs`, which reads the source — a unit test cannot catch this,
  because the broken calls only run inside a live world.
- **`canUseAbility` ignored an ability's `requirements`.** The list was implemented and consulted
  by nothing, so an ability could carry a requirement that never refused anything. It is now
  checked after the cooldown, round and ZON gates, which stay first because those are the
  refusals a player can act on.
- **The multi-Servant tax charged every Master at turn end**, not the one whose faction had just
  acted — seven players billed for one player's turn.
- **`ctx.grandOrder` was read by the scheduler and populated by nothing**, so the Grand Order
  exemption never applied on that path.

### Changed

- **The specification chapters are back in step with the code.** Ch. 45 had been kept current all
  along; the other 44 had not, and a specification the code has overtaken is worse than none —
  the next implementer builds to the stale text. Twenty chapters now carry implementation notes
  naming the modules, what is live, and **what is not**.

  The substantive one is Ch. 24, which gains three vocabulary additions in their proper group
  tables rather than a footnote: `Compulsion`, the `ApplicationChance` executor, and `roll:` on
  `DamageModifier`. It also records that `Appendix B` has predicated on `target:skill:divinity`
  since the tables were transcribed with **nothing ever emitting a `skill:` option**.


- **The changelog is split into per-version sections.** Everything from `0.2.2` onward had
  accumulated under `[Unreleased]`. Attribution is by first appearance in a tagged changelog, so
  it survives entries having been reordered and rewritten between releases; all 44 entries
  attributed, 389 content lines preserved.

  `[Unreleased]` is deliberately **empty**: `release-notes.mjs` skips an empty section and falls
  through to the commit log, whereas a placeholder line would be published verbatim as the
  release notes for any version lacking its own section.
  `test/unit/release-notes.test.mjs` pins the whole fallback chain — notes are produced and the
  exit code is 0 for a version with no section, and no version ever yields an empty file.

---

## [0.2.12] — 2026-08-15

### Added

- **Asterios**, the first Servant of the D1 pass, converted from the original tabletop sheet in
  `char_orig_sheets/`. Three abilities and five new effects (`critUp`, `nAtkUp`, `bleedAtk`,
  `offDebuffResUp`, `bleed`) come with him.

  One Servant found four gaps, which is the argument for authoring content continuously rather
  than last:

  - **`ApplicationChance` had no executor.** Named in Ch. 24 Group 6, accepted by the content
    validator, implemented nowhere — so `Off.Debuff ResUp` compiled and did nothing. And
    `effect-applier` read `ctx.resist` that **no caller ever supplied**, so the resistance path
    was dead at both ends. Now: an `applicationChances` bucket, carried on the snapshot, read off
    the target by `applyEffect`.
  - **`bleed` had no definition**, despite `scheduler.PERIODICS` having always known how to tick
    it. Nothing could inflict it.
  - **The rule-element vocabulary is maintained twice**, in the validator and the executor. The
    paired tests in `elements.test.mjs` caught the drift the moment the new executor landed.
  - **Mad Enhancement has no lockout field.** Asterios' cannot be deactivated until 2◈ after
    activation and vice versa; Heracles never surfaced this because his cannot be deactivated at
    all.

  His Noble Phantasm is **deliberately absent**: `Chaos Labyrinthos` is a bounded field with
  membership, a climbing escape check, per-unit escape history and hard containment — Ch. 43
  almost entire, which is C4. A stub applying its debuffs without the containment would look
  like the Labyrinth worked.
- **Detect is per class container**, not derived from attack range. Master 1, Saber/Lancer/Rider/
  Berserker 2, Archer/Assassin 4, Caster 5 inside its own Home Base and 3 outside — the only
  position-dependent sight line in the game. This supersedes Ch. 08 §8.7's `max(2, range)`
  reading, which gave a Caster the same sight as a Saber and could not express a Master at all:
  1 is *below* the old floor.

- **Overpower, Underpower, Sustainability and the multi-Servant tax** (Ch. 16 §16.5–16.7).
  Overpower and Underpower are direction-scoped and report `applies: false` rather than a zero
  chance when the pair is wrong — "the rule does not apply" and "it cannot happen" are different
  facts. The Luck Check that prevents an Overpower **also** saves the Master from the lethal
  damage that would follow; one success buys both.

  On a Master's death, `null` Sustainability is **not** zero: one has no clock and stays
  indefinitely, the other disappears immediately. The multi-Servant tax is **flat** — two
  Servants acting costs 25 and five costs 25 — and is a *loss*, so nothing reduces it. A new
  `grandOrder` setting switches it and its at-25-Health prohibition off.

- **Transfer, effect visibility, Confuse's selector and Undo.** `transferEffect` **moves** an
  instance and keeps its absolute expiry, rebasing only when one side has been Stopped — a
  re-application would restart the clock, which is what "duration maintained" forbids. A debuff
  is visible to whoever **inflicted** it as well as its bearer: they applied it and already know.
  Confuse logs every roll, because it is the only place the system decides for a player. And
  `canUndo`'s boundary is information disclosure — an action kind it does not recognise is
  **refused**, never rewound.

- **Servant identity, and Detect.** A Servant is publicly its **class**, not its name:
  "Berserker", or "Berserker of Yellow" once it belongs to a named faction, and its true name
  only once `identityRevealed` is set — which is what gives closed-information play something to
  conceal. New sheet fields: `classContainer` (the class it was summoned into, alongside the
  `servantClasses` set it qualifies for), `concealedIdentity` for a Servant publicly known as
  something else, `identityRevealed`, `detect`, and `defaultImage`.

  `publicNameOf` always shows the true name to the unit's own owner — the concealment is from
  opponents, not from the player running it.

  **Detect** (Ch. 08 §8.7) is the same number as vision range. It defaults to attack range with a
  floor of 2 applied *after* every modifier, so Deafen cannot take a unit below two panels —
  which makes it useless against short-ranged units rather than merely weak. Every Discover
  attempt is marked GM-only and silent, because broadcasting the *attempt* leaks the presence it
  is checking for.

- **Rule elements apply in priority bands** (Ch. 24 §24.6). They previously applied in collection
  order, which is document **load** order — so two clients could compute two different numbers
  from the same board. Bands fix the what; a stable sort on source id fixes the tie. An unknown
  key lands in the additive band rather than sorting to either end, so a new element cannot gain
  the power to run before or after everything simply by not being listed.

- **A Delay against a faction that had already acted was discarded** (Ch. 07 §7.8). It is meant
  to apply *next* round, and because `system.delays` is cleared at round start it was being
  dropped instead. The one clause the rule spells out was the one that did nothing.

- **Bounded fields** (Ch. 45 C4) — **Phase C is complete.** Ten fields across nine Servants are
  points in one six-axis model rather than ten special cases, which is Ch. 43's own argument for
  having a model: geometry, membership, isolation, interior rules, duration/extension and
  vulnerability. `NPFieldBehavior` carries the axes on a Region, `snapshotBoard` runs
  `annotateFields`, and `resolveTargets` enforces isolation.

  Decisions worth keeping. **`rollRequired` is not a refusal** — it refuses the *free* move and
  the caller offers the escape roll; conflating the two would turn a Labyrinth into a wall.
  **Blocking Command Spells is its own axis**, not an inference from isolation, because the duel
  field is the only thing in the game that stops one and deriving it would have given every
  isolating field a power only that one has. **`???` never satisfies a tag threshold**, so the
  check surfaces a prompt rather than silently deciding. And NP tags are an **ordered scale plus
  unordered qualifiers**, listed separately rather than inferred.

  **Asterios is now fully authored.** *Chaos Labyrinthos* was the clause C4 had been blocking,
  and it lands as the reference point in the model — including §43.4's escape ladder and the
  veteran clause that lets an escapee lead adjacent allies out, which is what makes a Labyrinth a
  puzzle rather than a soft lock.

  Not built: the paint-style canvas tool `freeform` needs (The Mist), the two-phase `markDefined`
  construction (Blood Fort Andromeda), and §43.9's scheduled detonation.

- **Platforms and levels** (Ch. 45 C3). The model, the movement linkage, the cross-level
  protection rules, boarding, falling, destruction, and the three reference platforms — the
  Hanging Gardens, the Golden Hind and the Storm Border.

  The defect this closed is the familiar one: `resolveTargets` has had a `crossLevelAllows` step
  since it was written, keyed on `board.crossLevel[unit.platformId]`, and **nothing ever supplied
  that map or set `platformId`**. The rule was implemented, called on every resolution, and
  permanently inert.

  Decisions worth keeping. Passenger membership is a **consequence of the level**, not a stored
  manifest — one Scene Level per platform means nothing else occupies it, so there is no list to
  fall out of step with the board. Protection has **two axes**: shooting *in* is the target
  platform's rule, shooting *out* is the attacker's, and a fortress nobody can shoot into may
  still let its occupants shoot out. The platform **itself** is always targetable, because a
  vehicle nobody can shoot at is not a vehicle. And a platform spends **no budget**, checked
  before every other gate: it is equipment its owner operates, not a combatant taking a slot.

  Not built, and logged by name rather than skipped: the Scene Level operations themselves —
  creating a level on activation, deleting it on destruction, scattering passengers to the
  ground, reversing the owner's effects. Those need a level API rather than more rules.
- **The environment is finished** (Ch. 45 C2). Region, Civilians, victory conditions, the setup
  gates and E5 join the Day/Night cycle, the Home Base and the Grail.

  Two fields had sat on `MatchData` since the schema was written with **nothing incrementing or
  reading either**: `grailCounter`, so the Grail could never materialize, and `region`, so the
  parameter step it implies was never granted. Both are live — `io.defeat` counts Servants
  towards the threshold (and not Erase), and `scheduler-hooks` advances the contest and checks
  victory at round end.

  Details worth keeping. The Region bonus is applied as a **rank shift**, so it flows through the
  same derived path as Enkidu's reduction and moves Base Attack with it. A Civilian **never
  enters a Combat Process** — the kill resolves before one is built, because a ladder whose every
  rung has one outcome is not a ladder. Victory checks **destruction first**, so throwing an area
  Noble Phantasm over the Grail can never be a way to win. E5 is keyed on where the *owner*
  stands, not the target, because the bonus applies "even to attacks out of the base". And the
  region adjacency graph is **symmetric by test**, because a one-way edge would make Semiramis's
  Construction counter depend on which region was named first.

  Still GM-driven, correctly: the Random Event table. §19.5 asks for "tooling, not automation",
  and the one event the rulebook actually specifies — Civilians — is implemented.
- **Terrain is finished** (Ch. 45 C1). The snapshot had carried a `terrain` field since it was
  written and nothing ever populated or read it. Now: standing modifiers, periodic clauses,
  on-entry consequences and attack-driven conversions, plus the `Region` behaviour schemas that
  `system.json` had declared from the beginning **with no data model behind any of them** — so an
  `fgt.terrain` behaviour on a Region carried no type, no duration and no meaning.

  `rules/terrain.mjs` holds the §42.2 catalogue and `snapshotBoard` runs `annotateTerrain` beside
  `annotateAuras` — which is the chapter's own observation, that terrain is *"mechanically a
  positional aura whose source is a region rather than a unit"*. It is also why terrain cannot be
  dispelled, cured or resisted, and why leaving ends it instantly with no removal step: a unit
  never carried it in the first place.

  MOV, Evade, Agility Check, attack range, healing and the damage modifiers are all live, with
  the attribute gates a third of the catalogue turns on (`Swimsuit!`, `Santa`, `Levitating`,
  `Dark (Outsider)`). Overlapping areas **sum**: two MOV −1 areas cost two panels, because they
  are two pieces of difficult ground rather than one status applied twice. `effectiveMov` applies
  terrain after Slow and additively — Slow halves what the unit has, a Forest costs a panel of
  what is left; halving after would make difficult ground twice as expensive to a Slowed unit,
  which no rule says.

  **Absent rather than half-present:** every periodic and event-driven clause — Burning's
  inescapable `Burn`, Poison Swamp's stage roll, the Forest→Burning coin flip, Lava's and
  Frozen's and Magnetic's on-entry consequences, Eldritch's Horrors, Meadow reverting after a
  Damage Step, Underworld's `Near-Death`. Those need the scheduler and the movement hooks rather
  than the catalogue table, and a half-entry would look implemented. Eight of the nineteen types
  are registered with no standing effects at all, which the catalogue states rather than omits.

  Also not done: the `Region` behaviour that would populate areas from a scene (§42.1, §22.10).
  The rules read `board.terrain.areas`, so this is live for any caller that supplies areas and
  dormant in a real world until that behaviour exists.
- **Command Spells can be spent** (Ch. 45 B1). The schema, the `spendCS` intent, the applier case
  and `io.spendCommandSpells` all existed and were reachable end to end. What was missing was the
  middle: nothing decided *which* command a Master may use, *when*, or *what it does* — so nothing
  ever constructed the intent and no Command Spell was ever spent by anybody.

  All 16 commands of §17.2 are now authored in `packs/_source/command-spells/` and compile into
  the `command-spells` pack. `CommandSpellData` and the content compiler carry `requirements`,
  `timing`, `blockedWhen`, `effect`, `costByMasterRank` and `permanentConsequence` — without
  which the catalogue built into items that knew their name and cost and nothing about when they
  could be used or what they did.

  `rules/command-spells.mjs` decides and `engine/command-spells.mjs` pays and writes, in that
  order: validate → pay → apply, because paying first burns a charge on a refusal. A
  `spendCommandSpell` socket operation authorizes it to the Master's owner. Kill Yourself costs 1
  for a High Rank Master, 2 for a Low Rank one, and 1 for everybody when the whole table is
  Rankless. Unusable commands are **never offered** — §17.6 requires Van Gogh's immunity to be
  checked at offer time "so the option never appears", and the same argument covers cost.

  **A test caught a real defect while this was being written.** The authored catalogue used two
  requirement kinds (`notInZone`, `noOtherRevival`) that the rules did not implement. Unknown
  kinds refuse, which is the safe direction — and it means Escape and Survive Kill would have
  compiled, loaded, appeared in the pack and been **unusable by anybody, silently**. Exactly this
  project's recurring defect. `REQUIREMENT_KINDS` is now exported and a test holds the shipped
  catalogue against it.

  Applied today: `statChange`, `defeat`, `cureDebuffs`, `cooldownDelta`, `survive`. Not yet:
  `modifyDamage`, `teleport` and `overrideValidation` — the six commands that rewrite a
  resolution already in flight. Those need the **interrupt protocol** (§17.4) rather than more
  effect code: suspend/resume around a Combat Process, a non-blocking offer with its 45-second
  timeout, and the "spend to override" affordance in the targeting preview. An unapplied effect
  **logs itself by name** rather than resolving silently.

### Fixed

- **Granted capabilities were granted to nothing** (Ch. 45 B3). `GrantedAbility` collected
  ability ids into `grantedAbilities` and no code read the bucket. Riding's double move did
  work — but through a completely separate `hasSkill(actor, "riding")` name-match.

  So the defect was not "the grant does nothing"; it was **two mechanisms for one rule, one of
  them inert**. A Servant granted the double move by a Master Essence, by Semiramis's *Double
  Summon*, or by one of Scáthach's copies would not have got it, and every future granted
  capability would have needed its own bespoke check somewhere in the engine.

  `rules/granted.mjs` makes the grant the input, and `planMovement` and `canConsume` read it.
  The old `hasRiding` flag stays as a fallback, so a world whose Riding item predates the rule
  element does not silently lose its second move.

  Worth recording for anyone reading Ch. 45's plan: `doubleMove`, `ridingAttack` and
  `passengerSeat` **have no content anywhere**. They are not ability documents waiting to be
  granted — they are capabilities the engine asks about, which is why "make them real items on
  the actor" was the wrong shape for this half. `passengerSeat` is granted and nothing reads it
  yet; it needs platforms (Ch. 20).
- **Using a Noble Phantasm cost its Master nothing** (Ch. 45 B4). `npCostByRank` and
  `freeServantNPSustainabilityCost` had been in `domain/tables.mjs` since the tables were
  transcribed, with **nothing reading either of them**. The same shape as ZON and `fireEvent`:
  data that loads correctly and is never asked a question.

  `rules/costs.mjs` answers "can this be used, and what does it cost" in one call — Master Health
  by rank column and rank step, Sustainability for a Free Servant, double self-Health for a Free
  Servant with no clock at all, the cooldown gate, the Noble Phantasm round gate and the ZON
  gate. `resolveAttack` **validates at declaration and pays at confirmation**, which is §15.4's
  own decision and means cancelling during targeting costs nothing.

  Two details worth stating. The Health comparison is **strict** — *"cannot use its NP if its
  Master's Health is equal to or less than the amount that would be lost"* — so a Master at
  exactly 50 cannot pay a 50-cost NP, and the refusal says "MORE than 50" because that is the
  half people misread. And the cost is paid with `statDelta`, never `damage`: it is Health *loss*,
  not damage, so it must not trigger `Dmged NP Regen` or an Injury Roll. Paying it as damage
  would make every Noble Phantasm feed its own Master's triggers.

  `requiresRound` is authored in `targeting.limits`, the same untyped object `requiresZon`
  already lives in — a gate content can write today rather than a schema field waiting to exist.

  Not done, and listed rather than implied: §15.4's other requirement kinds (`hasSkill`,
  `inZone`, `modeActive`, `counterpartAdjacent`, `targetHasEffect`, `predicate`) and Karna's
  `supersedes` override.
- **Combat Process step 6, the Counter, did nothing** (Ch. 45 A4) — and with it, **Phase A of
  Ch. 45 is complete**: all six steps of the Combat Process now run.

  `case "counter": return process.advance(state, "done")`. The rung was reached and advanced
  past, unconditionally. `canCounter` existed and **was never called from anywhere**, which is
  the more interesting half: the rule was written, exported and tested, and no code path
  consulted it.

  It was also missing four clauses of §12.8. All are present now and all are derived from the
  board by the caller rather than assumed: Berserk, Fragarach (Mannanán trades the normal
  counter for an automatic one), Presence Concealment against a slower defender, and
  *"Counters cannot be Countered again"* — the last being a safety property rather than a rules
  detail, since without it two Servants in range of each other counter until something gives out.

  `beginCounter` builds the nested Process with the roles swapped, `isCounter` set and no budget
  cost, running the **full** ladder rather than a bare damage roll (Ch. 41's ruling that the
  source's *"Steps 1 and 4 are repeated"* is a typo for "1 **to** 4").

  The rung is **conditionally prompting**, which is new for this machine: `pendingPrompt` offers
  the counter only when the orchestrator has recorded that one is available, so an ineligible
  defender is never stopped to answer a question with one answer. `promptOptions` needed a
  `counter` branch of its own — without it the card fell through to the Luck Check branch and
  rendered a "Contest" button emitting an event this rung has no transition for.

  Named rather than skipped: `sleepRemovedThisPhase` is Process-scoped state nothing tracks, so
  that clause waits. And counters do not yet resolve *"sequentially in turn order"* across an
  AoE group — each card offers independently. The `groupId` from A2 is what that will hang off.
- **An area attack damaged one unit** (Ch. 45 A2). `resolveAttack` took `targets.units[0]` and
  discarded the rest, keeping them only long enough to set an `isAoE` flag. A Noble Phantasm
  over seven units resolved against one of them and nothing anywhere said so — the card showed
  a correct calculation against a correct target and the other six vanished. The comment above
  the code read *"One Combat Process per target"*, which is exactly what it did not do.

  `process.beginFanOut` now builds one Process per defender, and each gets its own card and its
  own reaction ladder, because each defender reacts independently: prompted in parallel, evading
  separately, contested separately. Process states are plain values, so one advancing cannot
  disturb another.

  They share a `groupId`, which is what remembers they were one attack — the attacker's budget
  is spent once for the group (it always was; `budget.spend` runs before the fan-out), and
  counters will resolve across the group *"sequentially in turn order"* rather than per-card.

  Two deliberate edges: a **single** caught unit is not an AoE resolution, so facing still
  applies and no card claims a fan-out over one defender; and a resolution that caught **nobody**
  keeps its single null-defender Process, because a ground-placed non-damaging NP is a real
  resolution with no defenders.

  Not done: §12.10's *batched* damage pass. Damage is computed and applied per Process rather
  than as one pure batch across all defenders. Each defender's number is right, so this is a
  performance shape rather than a correctness one.
- **An aura reached its own bearer and stopped there** (Ch. 45 A5). `Aura` wrote its modifier
  into the owner's `modifiers` bag carrying `radius` and `relations` fields that the damage
  pipeline does not read, so the contribution applied **to the bearer, at any distance,
  regardless of relation** and to nobody else. A live wrong answer rather than an inert one,
  which is why it was pulled ahead of A2 and A4 in the plan.

  Worth stating precisely, because the audit in Ch. 45 had it half wrong: **reaching the bearer
  was correct.** In F/GT "every allied unit" includes the unit itself unless the text says
  otherwise, which is why `relations` defaults to `["ally", "self"]`. The auras that exclude
  their bearer — Penthesilea's *Charisma* ("other allies"), Kiritsugu's *Affection of the Holy
  Grail* ("everyone except himself") — say so, and drop `"self"`. The bug was the aura stopping
  at the bearer, not starting there.

  `Aura` now fills its own `auras` bucket and `rules/auras.mjs` expands it: radius by
  nearest-panel distance, relation filtering, and `highestOnly` resolved across every source that
  reached the recipient — which is the whole reason auras resolve at evaluation time instead of
  being applied as effects (*"only the highest-rank Territory Creation takes effect"* is a
  comparison you cannot make from an applied instance). `snapshotBoard` runs the pass once every
  unit is projected, in the same place and for the same reason as `annotateZon`, and collects for
  all units against the untouched board so an aura cannot feed an aura.

  Writing into `modifiers` is what made the defect look plausible: the value landed in a bag the
  pipeline reads, so it appeared wired, and the two fields riding along were silently dropped.
  The bound modifier no longer carries `radius` or `relations` at all.

  Still simpler than §23.9 asks for: the pass is a linear scan, not the spatially-bucketed
  `AuraIndex`. Correct, and 28 units is not a performance problem yet.
- **Combat Process step 4, the Injury Roll, did nothing** (Ch. 45 A3). `attack.mjs` advanced
  straight through `case "injury"` with `"done"`, and the damage pipeline's
  `flags.exceededInjuryThreshold` — computed correctly, at the right point, for the right
  reason — had no reader anywhere in the system. A surviving unit hit for 250 lost no Agility.

  `rules/injury.mjs` decides and `applyInjury` rolls the `1d4`. The decision reads the
  pipeline's flag rather than comparing the total to 100 itself, which matters more than it
  looks: `Def Crk`'s bonus damage *"does not count towards the amount required for an Injury
  Roll"*, and stage 16 adds it **after** the threshold snapshot — so a fresh `damage > 100`
  would have fired on hits the rules exclude. Survival, zero damage, `Light Wound` and the
  Golden Hind *"only performs Injury Roll when damaged by NP"* override are all covered.

  That override is carried as a granted **attribute** rather than a new schema field, because
  the `attributes` bucket is already read by targeting and the pipeline — this adds a reader to
  a live input instead of introducing another one nothing writes.

  Named, not skipped: no rung of the reaction ladder offers `Light Wound` yet, so the parameter
  that honours it is always false today.
- **Every event handler in the game did nothing** (Ch. 45 A1). `OnEvent` stored the element as
  authored and `scheduler.fireEvent` dispatched `handler.intents` — a field no executor and no
  content ever wrote. So a handler contributed one log line and stopped. Battle Continuation, the
  most-cited event in the reference set, has always been authored as `OnEvent: unitDefeated` and
  has never once revived anybody.

  `OnEvent` now normalizes to `{events, actions, automatic, abilityId, source}` at collection
  time, with every rank-dependent table already resolved — rank is in scope there and nowhere
  downstream, so a `4d20` that is not settled then can never be settled. `fireEvent` dispatches
  the actions through Ch. 24 §24.5's action vocabulary (`Damage`, `Heal`, `StatDelta`,
  `ApplyEffect`, `RemoveEffect`, `ResourceDelta`, `CooldownDelta`, `Message`, and `Revive` from
  the `revive:` shorthand). `events` is always a list, so Fragarach's two-event subscription is
  the ordinary case rather than a special one. **An unknown action logs itself by name** rather
  than resolving silently, which is the failure mode this whole repair is about.

  Finding it turned up a second, larger hole: **nothing emitted a defeat when Health reached
  zero.** `unitDefeated` had no reader *and no raiser* — the question "is this unit dead" was
  answered without ever asking the one rule that exists to answer it differently. `resolveDefeat`
  is that raiser, called from `applyDamage`, and a unit that revives is never defeated in the
  first place rather than defeated and then healed. The revive is gated on the skill's own
  cooldown, which reuses the clock `advanceCooldowns` already turns and shows the window on the
  sheet where a player can see it.

  Still open, and named rather than quietly dropped: Battle Continuation's `requiresHealthAbove`
  clause needs a health-peak history that nothing records. Gating on a field no code writes is
  precisely the defect just repaired, so it waits for the history.

---

## [0.2.11] — 2026-08-15

### Added

- **A smoke check that actually loads a world** — `npm run check:smoke -- --world=<id>`
  ([`tools/smoke-world.mjs`](tools/smoke-world.mjs)). Every other gate here runs without Foundry,
  which is right for L1 and L2 and leaves exactly one thing uncovered: whether the system still
  boots. `0.2.10` proved what that costs. Lint passed, 629 tests passed, the content validator
  passed, and every world rendered a black page, because nothing in the repository had ever
  loaded one. This drives a real browser at a real Foundry over the DevTools Protocol, launches
  the world, joins it, and waits for `game.ready`; an uncaught exception fails the run and is
  printed with its stack. Verified against the `0.2.10` defect itself — restored the broken
  schema, and the check exits 1 naming the throw.

  It needs a running Foundry and a Chrome started with `--remote-debugging-port`, so it is not in
  CI — GitHub's runners have neither. It is a local gate, to run before tagging, next to
  `npm run check:release`.
- **`CONFIG.debug.hooks` is on.** F/GT is driven almost entirely by hooks — the scheduler,
  movement, budget and turn order all hang off them — so when a rule does not fire, the first
  question is whether its hook was reached at all. This is what answers it. Verbose by design;
  the console is where this system is debugged.

### Fixed

- **`EffectData` declares `changes`, by inheriting core's own field.** Core requires every
  ActiveEffect subtype to carry it. F/GT drives effects through rule elements rather than
  Foundry's change system, but the field being unused is not the same as it being absent — core
  UI and modules both read it.

  The first attempt at this hand-rolled the field with a v13-style numeric `mode`, and that
  **black-screened every world on `0.2.10`**. The two failure modes are not symmetric: when
  `changes` is *missing* core patches it in and logs, but when it is *present and misshapen*
  `#verifyActiveEffectModels` throws — `Class EffectData must define a string type in its
  EffectChangeData schema` — and it throws inside `Game.setupGame`, where nothing catches it, so
  the world never renders at all. In v14 a change carries string `type` and `phase`
  (`CONST.ACTIVE_EFFECT_CHANGE_TYPES`), not a numeric `mode`. `EffectData` now extends
  `foundry.data.ActiveEffectTypeDataModel` and spreads `super.defineSchema()`, so the one shape
  that cannot drift out of sync with core's contract is core's own.

---

## [0.2.10] — 2026-08-15

### Fixed

- **Writes went to a different actor than reads.** Every rule reads its units from
  `canvas.tokens.placeables` via `t.actor`, which for an *unlinked* token is a synthetic actor
  backed by the token's own `ActorDelta` — a different document from `game.actors.get(id)`, which
  is what the write adapter resolved first. Damage was computed, applied, and landed somewhere
  the board never looks at, which on screen is indistinguishable from damage that was never
  applied. The adapter now prefers the token's actor and falls back to the world actor, so reads
  and writes address the same document; for a linked token they are the same document already and
  nothing changes.
- **A targeting Region's offsets are `{i, j}` objects, not `[i, j]` pairs.** `GridShapeData`
  rejected the pairs with *"i: may not be undefined"* the moment a placement was confirmed. Pinned
  by `test/unit/target-region.test.mjs`, because the failure only surfaces inside Foundry.

---

## [0.2.9] — 2026-08-14

### Fixed

- **The turn state now expires by tick rather than by being cleared.** It was reset by *writing*
  a blank state at each turn boundary, so a single boundary hook that did not fire — for any
  reason, on any client — left a Unit reporting "0 remain of MOV 7" for the rest of the match,
  with nothing on screen to explain it. Each write is stamped with the ◈ tick it happened on, and
  a state from an earlier tick projects blank: the reset is a property of *reading*, so no write
  has to succeed for a turn to end. The boundary write is kept, but only to keep the stored data
  tidy — nothing depends on it. State with no stamp at all, written before the field existed,
  counts as stale, which also un-sticks any Unit already caught by the old bug.

---

## [0.2.8] — 2026-08-14

### Added

- **`hasRiding` is projected onto the unit snapshot.** Three places each decided it for
  themselves, two of them by reaching into `game.actors` from a layer that may not.

### Fixed

- **Every data preparation of a Combat threw**, which took `turns` with it and left the tracker
  showing nothing at all. `setupTurns` sorts with
  `this.combatants.contents.sort(this._sortCombatants)` — the method is passed **unbound**, so
  `Array#sort` calls it with no receiver and `this` is `undefined`. Core's own comparator never
  notices because it only touches `a` and `b`; ours read `this.system.turnOrder`. The order now
  comes from the combatants' parent. This is also why no factions appeared in the tracker, and
  why the turn state was still never being cleared.

### Corrected

- **Movement is limited by MOV, not by a count of moves.** The superseded reading was *one Move
  per Turn*, with Riding granting a second — so every drag after the first was refused with
  "This Unit has already Moved this Turn", or, with Riding, "Riding's second Move requires an
  Attack between the two segments". The rule is that a Unit may Move as many times as it likes
  until the total reaches its MOV; what fixes it in place is **Attacking**, and Riding is the one
  exception, its two phases sharing the single allowance. `segmentCheck` now has exactly three
  refusals — Riding Attack is terminal, the allowance is spent, or it has Attacked without Riding
  — and the drag count gates nothing. See Ch. 18 §18.4.

---

## [0.2.7] — 2026-08-14

### Added

- **A combat tracker that can create the combatants F/GT needs.** A combatant here is a
  **faction**, not a token, and nothing could make one — so a match ran with zero turns and four
  separate symptoms followed. `FGTCombatTracker` adds "Add Faction" and "Add Every Faction",
  creating a combat offers to populate it, and starting an empty one is refused with the fix
  named. The affordance is borrowed from the Universal Tabletop System's
  `CombatTracker#addPlayer`, which solves the same problem for the same reason. The GM gets a
  slot of its own, flagged rather than given a reserved faction id, because it takes a turn but
  owns no units and has no budget.
- **Grid-shape Regions for the committed targeting area, and a confirmation step** (§28.14).
  `GridShapeData` is *"any arbitrary set of grid squares, defined by their grid offset"*, which
  is exactly what `resolveTargets` returns. Aiming stays on the PIXI layer; a *committed*
  placement is drawn as a real Region, proxied so a player can do it, discarded in a `finally`,
  and swept at `ready`. The review window then lists every unit that will be hit with its damage
  range, and every unit the area caught that the rules excluded, with the reason — the pattern
  from `isaacsHBPF2e`, whose three outcomes (confirm, re-aim, cancel) have to stay distinct
  values because an empty confirmation and a cancellation are both legal and mean opposite
  things.
- **`placement.chosenIds` narrows any chooser**, so unchecking a unit in that window actually
  spares it. It can only remove: the dialog runs on the player's client, so a crafted id naming
  an ally must not make that ally a target.
- **Exclusion reasons in the targeting resolver.** `ResolvedTargets.excluded` records, for every
  unit an area caught and a filter then dropped, the reason it was dropped — captured where the
  decision is made rather than reconstructed afterwards. The preview HUD renders them as
  struck-through rows, which is the layout §28.6 has specified since it was written; the
  "no legal targets" error names the first exclusion instead of stating only that there were
  none; and a session with nothing to offer lists the resolver's distinct reasons rather than
  discarding them, after the roster check that already told a factionless world what to do.
  Adapted from the area-targeting flow in `isaacsHBPF2e`, whose review dialog lists every
  rejected token with its reason *"so a target going missing is never a mystery the caster has
  to debug mid-turn"*.
- **Delay** (§25.3). The field existed on the combatant schema and nothing read it.
  `computeTurnOrder` derives the played order from the rolled one rather than mutating it, so a
  delay cannot compound; it reorders only the factions that have not yet acted; and delays apply
  in declaration order, so two factions each delaying one place past each other end up where
  they began. Declared through the GM proxy, with the resulting order shown in the HUD.
- **ZON** (§6.9, §16.3). `unit.outsideZon` had two consumers — pipeline stage 9's 5d10 reduction
  and the `requiresZon` limit gating every Noble Phantasm — and no producer, so both rules had
  always been inert. `rules/zon.mjs` derives it; because the zone belongs to the Master–Servant
  *pair*, `snapshotBoard` annotates once every unit exists and the attack flow takes its
  combatants from the board through `unitFrom` rather than re-projecting them. The class split
  follows §6.9's reading, with a max-not-sum bonus channel shared with Independent Action, from
  a config table rather than arithmetic because that reading is flagged for an authorial ruling.
  Both reference-set exceptions are modelled: Semiramis's exemption and the Dioscuri's
  `any`-across-twins test. Content declares its own bonuses through a new `ZonBonus` element.
- **The persistent overlay layer** (§28.9): the ZON ring around a selected Servant's Master, red
  when the Servant is outside it; an enemy's threat range on hover, in the clipped-corner
  octagon their attack will actually use; and a Master's protection radius, drawn only while a
  Servant is standing in it, because the rule is conditional.
- **`game.user.targets` mirroring** (D28.8) — written after a resolution, never read.
- **The targeting controls are announced** when the canvas is taken over.
- **`test/unit/zon.test.mjs`** and **`test/unit/targeting-boundary.test.mjs`** — 35 tests
  covering the ZON derivation, both of its consumers, and every exclusion reason.

### Fixed

- **The turn state was never reset**, so a unit had no movement left for the rest of the match
  after one move. `clearTurnState` early-returned on the acting faction being `undefined`, which
  it always was in a match with no combatants.
- **The Round counter advanced on every turn.** Foundry's `nextTurn`, finding no turns to
  advance through, fell straight into `nextRound`.
- **The HUD showed the ◈ tick where the position in the Round belonged**, so a two-faction match
  announced "Turn 2 of 3". They are different numbers and are now shown as such.
- **A player assigned to a faction was not recognised as controlling it**: `controlsFaction`
  checked actor ownership only and ignored the roster's `userId`, which is where the GM had just
  assigned them.
- **Moving on another faction's turn now says so**, naming whose turn it is, instead of the drag
  silently reverting.
- **The budget is no longer written under the key `null`** on the GM's turn.
- **Board bounds were pinned to the `boardSize` setting**, so on a scene larger than the setting
  every unit past the last row was clipped out of every shape and became untargetable, silently.
  The scene's own dimensions answer when it has them; the setting is the fallback.
- **The preview attacked with the wrong stat.** `normalAttack.component` was missing from the
  unit snapshot, so a MAG attacker was previewed as a STR one.

### Corrected

- **D28.9 is revised, not reversed.** The superseded reading was that transient targeting never
  creates a document. Aiming still does not — that half stands, and it is what keeps the preview
  frame-rate cheap — but a committed placement now creates a grid-shape Region. The two
  objections that were about lifecycle rather than geometry are answered by *when* it exists:
  nothing is ever read back from it, so the raciness that killed the prototype's approach cannot
  recur, and one document per commit is not one per pointer move. See §28.14 for D28.10–D28.13.

---

---

## [0.2.6] — 2026-08-14

### Fixed

- **Every attack reported its target out of range.** Two position bugs compounding:
  - **`snapshot.panel` read a token's `x`/`y` as grid offsets. They are pixels.** Two tokens
    standing next to each other were projected a hundred panels apart, so nothing was ever in
    range of anything. Positions now come from `getOccupiedGridSpaceOffsets`, which also gives a
    multi-panel unit its whole footprint.
  - **Most callers passed no token at all.** `snapshotUnit` is layer 2 and cannot look one up —
    the canvas is a global — so `snapshotUnit(attacker)` placed the attacker at `{0, 0}` while
    the defender stood wherever it actually was. `engine/board.mjs#unitSnapshot` resolves the
    token and the panel first, and every call site in the engine and the interface now uses it.

---

## [0.2.4] — 2026-08-14

### Added

- **`tools/check-templates.mjs`** — static checks over `templates/`, wired into CI and
  `npm run check:templates`. Template defects are invisible to ESLint and to every other test,
  and surface as a stack trace inside Foundry at render time; two have already shipped. It
  catches both: a helper Foundry v14 does not register (`array`, `upper`), and a bare context
  name passed to a helper that throws on `undefined` from inside an `{{#each}}` — tracking block
  params so `{{#each xs as |x|}}{{selectOptions x.choices}}{{/each}}` is correctly left alone.

### Fixed

- **The faction editor crashed on open.** `{{selectOptions players …}}` sat inside
  `{{#each factions}}`, where a bare name resolves against the **item** rather than the template
  context — so the helper received `undefined` and threw. Fixed with `@root.players`, and the
  class of defect is now caught statically.

---

## [0.2.3] — 2026-08-14

### Added

- **A GM-managed faction roster.** Settings → F/GT → **Manage Factions**: create a faction, name
  and colour it, assign a player to it, and tick which other factions it is allied with. Unit
  sheets now pick from that list with a `<select>` instead of accepting free text — two units
  whose faction strings differed by a typo were enemies, silently, with nothing on screen to
  explain it.
  - Ids are **generated from the name and never change**, so renaming a faction does not orphan
    its units.
  - Alliances are stored per faction but **normalized to be symmetric and reflexive** on read: a
    roster where red allies blue but blue does not ally red is a half-finished edit, and the safe
    reading of one is where nobody is surprised by an attack from an ally.
  - Deleting a faction says how many units it will leave unaligned before it does it.

### Fixed

- **No edit on either sheet was ever saved.** Both templates had a `<form>` as their root
  element. ApplicationV2 renders a document sheet's frame **as** the form (`tag: "form"`), and a
  part's HTML is parsed detached — so the inner `<form>` really was created, every input's form
  owner was the inner form, and `FormDataExtended(outerForm)` collected nothing. The change event
  bubbled, the submit ran, and it submitted an empty object. Both roots are now `<div>`.
  This is why typing a faction did nothing; it is also why typing a Health value did nothing.
- **`alliances` was never passed to any board snapshot.** Four call sites each built their own
  snapshot and not one of them included it, so `relationOf` saw an empty map and every faction
  was an island. There is now one board builder, `engine/board.mjs#currentBoard`, and it fills in
  the alliance graph from the roster.

---

## [0.2.1] — 2026-08-14

### Fixed

- **Nothing on a Servant sheet could be used.** Three separate faults, each of which alone was
  enough to make the system untestable:
  - **There was no Normal Attack button.** `resolveAttack` had always accepted `abilityId: null`;
    nothing in the UI ever called it. The sheet now has one.
  - **Every ability was treated as an attack.** The targeting default handed a single-enemy spec
    to anything with no declaration of its own, so clicking a class skill — Mad Enhancement,
    Divinity — opened an enemy targeting session and then reported no legal targets.
    `classifyAbility` now separates the four kinds: an attack opens targeting, a **mode** toggles,
    an active skill resolves against its own spec, and a **passive is not a button at all**.
  - **The DataModel was silently discarding the fields that distinguish them.** `isMode`,
    `active`, `cannotDeactivate`, `slug`, `isAttackSkill` and `isSpell` were authored in YAML and
    compiled into the packs, but the schema never declared them, so Foundry dropped every one on
    load. A mode was indistinguishable from an attack, `system.active` was permanently
    `undefined`, and `hasSkill(actor, "riding")` could only ever match on the display name.
- **A Unit with no faction is neutral to everyone**, which is correct — but the sheet had no
  faction field, so a freshly imported Servant could never be given one and nothing on the board
  could target anything. The sheet now has a Faction input with an inline explanation, and
  "No legal targets" now names this cause when it is the cause.
- **`snapshot.range` projected the `{panels, targets}` schema object** where every consumer
  compares it against a distance. Comparing a number to an object is silently `false`, so any
  range check that fell back to the caster's own Range failed rather than erroring.
- **Riding's Active MOV Up applied at all times.** With `system.active` undefined, the collector's
  `?? true` fallback treated every mode as switched on.

### Added

- **[Chapter 45 — Implementation Status and Completion Plan](docs/45-implementation-status.md)**
  — an audit of all 44 specification chapters against the code, and a phased plan to finish it.
  It distinguishes **missing** from **stubbed** from **collected but unread**, because the last
  two resolve silently and look like they worked. Findings worth naming here:
  - The Combat Process runs three of its six steps; the **Injury Roll**, the **Counter** and the
    **AoE fan-out** are stubs — an area attack on seven units currently damages one of them.
  - `scheduler.fireEvent` reads `handler.intents`, which the `OnEvent` executor never writes, so
    every event handler contributes a log line and nothing else. Battle Continuation's revive is
    inert.
  - **`Aura` applies to the wrong unit**: it writes a modifier carrying `radius` and `relations`
    into its own owner's bag, and the pipeline ignores both fields.
  - **ZON is checked in two places and computed in none** — `outsideZon` and `zonDistance` are
    projected from actor fields no code writes.

### Changed

- **The changelog no longer gates a release.** `tools/release-notes.mjs` used to exit non-zero
  when it found no `## [x.y.z]` section, which made a heading a release blocker: the workflow
  reads the file at the tagged commit, a tag cannot be edited, so the fix required deleting and
  re-pushing the tag. It now falls back to the `## [Unreleased]` section, then to the commit
  subjects since the previous tag, then to a one-line placeholder — and never fails. The build
  still fails on lint, content and test failures; it no longer fails on prose.

---

## [0.2.0] — 2026-08-14

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
- **`legalPlacements` / `validate`** in the targeting resolver — one pure function behind all
  four targeting modes. Illegal placements are returned rather than filtered, because a player
  needs to see that a direction exists and why it cannot be chosen (D28.6).
- **`module/rules/preview.mjs`** — speculative damage. Two runs of the **real** pipeline, one
  with every die at the end that minimises damage and one at the end that maximises it, giving
  an exact range rather than an estimate. The bounds are not symmetric: `attackMinus` subtracts,
  so its maximum is the low end.
- **`TargetingLayer` and the preview panel** — the canvas interaction from Ch. 28. Mode A draws
  all four directions simultaneously, tinted by legality, and one click chooses; Mode B dims the
  reachable panels and previews on pointer-move; Mode C cycles legal units with Tab. Arrow keys,
  Enter, Escape and right-click all work. The layer draws and never decides — every panel it
  fills came from `legalPlacements`.
- Clicking an ability on a sheet now opens the targeting session instead of reading
  `game.user.targets`, which carries no shape, band or relation information. Foundry's target set
  remains the fallback when no canvas is available.
- **`module/rules/movement.mjs`** — the seven legality clauses, reachability over the Manhattan
  diamond (*"Units are not allowed to Move diagonally"*), and Riding's two segments. Clause 3
  says **through**, not *onto*: an allied panel is passable but not stoppable, and an enemy
  panel is neither, so passability and stoppability are separate predicates. `Slow` halves MOV
  rounding down rather than doubling step cost, per its text.
- **`module/engine/movement-hooks.mjs`** — `preMoveToken` rejects an illegal drag before
  anything is written, and `moveToken` records what it cost and spends the pool slot. The veto
  lives on the hook rather than on a movement cost function because a cost function can be
  bypassed by a direct `update()`. Forced movement — knockback, Gather — is displacement and is
  exempt from both.
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

[0.2.12]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.12
[0.2.11]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.11
[0.2.10]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.10
[0.2.9]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.9
[0.2.8]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.8
[0.2.7]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.7
[0.2.6]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.6
[0.2.4]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.4
[0.2.3]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.3
[0.2.1]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.1
[0.2.0]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.2.0
[0.1.0]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v0.1.0
