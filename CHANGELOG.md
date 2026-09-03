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

- **A unit can be intrinsically undamageable.** `null` Health has been the convention since
  Ch. 04 and the damage pipeline has halted at stage 0 on it for as long — but nothing could
  ever *reach* that state, because each type's `prepareBaseData` backfills a null Max Health
  from the END-rank table. A Servant whose sheet reads *"Base Health: —"* silently acquired
  1600 and a health bar. The `undamageable` flag makes the backfill stand aside; it is a flag
  rather than a rule element because `prepareBaseData` runs long before any rule is collected.
- **Two grants that take a capability away** — `noNormalAttack` and `noReactions`, the first
  in `GRANTS` that subtract rather than add. Refused where the rule can be named: a bare
  Normal Attack is refused ahead of the budget and cost checks, and the defender's reaction
  rung offers only *nothing* (which also covers an **ally's** Rho Aias, projected at the same
  rung — the reason this is a grant and not an empty ability list).
- **A ZON bonus may name a stat rather than a number.** `ZonBonus fromStat: mov` is the first
  ZON clause in the corpus whose size is not a constant. Read literally, so Riding's own
  +6 MOV Active swells the zone by six for that Turn; §6.9 records the reading rather than
  capping it.
- **`Charm`, `Regen` and `Dmg Cut`** as content, with every clause of their Appendix A entries
  working rather than three of them deferred. Charm removes itself at the end of a Combat
  **Phase** that damaged its bearer (`requiresDamagedThisPhase` — an Evade, a fully-absorbed
  Block, or being the attacker all leave it standing) and declares its immunity to Berserk and
  Confuse, which switches on when either of those is authored.
- **A handler can be conditioned on what a boundary did to its own bearer.** The boundary
  reports; the handler asks whether it happened to *it*. `combatPhaseEnd` now carries the ids
  the phase actually damaged.
- **Passive bounded fields** (Ch. 43) — an area nothing casts and nothing expires, reconciled
  with the board at `ready` and every Turn start. Pale Rider's Contagion is the first: *"the 2
  panel area around Pale Rider **is** the Contagion area."*
- **A field's geometry can read the board.** `whileOwnerHas` measures the same area differently
  while its owner carries an effect; `whileFieldOpen` / `sameAs` borrows another open field's
  panels. Tested in authored order, because *"instead of its usual Range"* is a precedence claim.
- **`HealthLoss`, `chance`, `duration` and `branches` on a field's interior events.** A
  deduction that is explicitly not damage; a probability and a clock that belong to the field
  rather than to the effect; and the same trigger resolving to different numbers **per victim**.
- **`fgt.unitTurnEnd` is dispatched**, scoped to the fields whose owner's faction just ended its
  Turn. It had been listed in Appendix E since that reference was written and raised by nothing.
- **A `followsUnit` field's drawn Region follows its anchor**, using Foundry v14's native
  `attachment.token`. Membership was always computed correctly; the *drawn* area was left where
  it was cast, so what a player could see had been wrong for every field of that kind.
- **A bounded field's size can be rolled.** `shape.radiusRoll` is evaluated once at cast and
  stored as a concrete size — a field that re-rolled on every read would breathe, and membership
  would depend on who asked last. Doomsday Come opens as a 7×7 through a 13×13.
- **A bounded field's isolation can have a hole, and a Noble Phantasm can break the field.**
  `piercedBy` lets an NP of a stated scale or higher across a sealed boundary in both
  directions; `npScaleUsedOn` ends the field at the end of that Combat Process. Doomsday Come
  reads one sentence three ways — the NP crosses, the interior halves it for everyone inside,
  and the area comes down afterwards, in that order, because the damage has to land inside the
  shelter that halves it.
- **`attack:npScale:gte:<tag>`**, a ladder up the Noble Phantasm scale, so *"[Anti-World] or
  higher"* can be written as a predicate. The attack now carries its own `npTags`, for the same
  reason it carries `element` and `pierce`: three rules ask and none can reach the ability.
- **A `fieldEdge` targeting anchor**, measured from the nearest panel of a bounded field rather
  than from the caster — the area may be anchored on somebody else and nowhere near them — and a
  **`dragInto` phase**, an attack in every structural sense except that it deals no damage.
- **A `fieldOpen` ability requirement**, for a clause that exists only while an area does.
- **Three roll-option families for asking about a Unit's own Parameters** —
  `self:highestParameter:<p>` (one per Parameter *tied* for the top, so "affected by all related
  effects" is set membership rather than a tie-break), `self:npAboveAllParameters`, and
  `self:stableDie:d6:<n>` for a Unit with no Parameters at all. The die is a **hash** of the
  Unit's id rather than a stored roll, so "the same effect every time" survives a reload and is
  agreed by every client without anybody persisting it.
- **An interior rule's predicate is split per clause** — the part about the Unit answered where
  the Unit is known, the part about the attack carried to the damage pipeline, and the answered
  part stripped rather than carried. Stripping matters: `self:` in the pipeline's option set means
  the *attacker*, so a carried unit-clause would be re-tested against the wrong Unit.
- **A standing suppression can prevent an action**, not only a held effect. `Suppress scope:
  npSeal` refuses a Noble Phantasm exactly as the effect does — which is what makes Innocent
  World's *"cannot be prevented or removed as long as a Unit is within"* free rather than a
  feature: an interior annotation is present exactly while the Unit stands inside, and there is
  nothing for Dispel to find.
- **Pale Rider**, the fourteenth Servant — eight abilities, four summons and five effects,
  verified clause by clause in a live world (Ch. D §D.26). Almost nothing on his sheet is an
  attack, which is why he took fourteen general engine additions and turned up eleven
  long-standing defects, nine of them in machinery that had shipped, been tested, and never once
  run.
- **`RelationshipProxy` has a reader.** Both Master-protection rules ask `guardsOf`, so a Servant
  may hand the Servant–Master relationship rules to its own bound summons — and stops satisfying
  them itself, which is the clause's own first half.
- **The Kagome Spirits**, and the six general pieces they needed: `inherit` (a summon's stat stated
  relative to its summoner), `normalAttack.shape` (an area Normal Attack — until now every Normal
  Attack in the game hit exactly one panel), `SummonBound` (one summon per enemy, bound to it, with
  the type remembered so a reactivation returns the same Spirit to the same enemy), a pursuit
  constraint, the `fgt.attacked` defender-side declaration event, and `Banish` — the only thing in
  the game that leaves the board and comes back.
- **`attack:vsAttribute:<a>`** — *"an Attack that deals extra damage to Units with the 'Dark'
  Attribute"* is not a property an ability declares but one of the attacker's own damage
  modifiers, read off the predicates they carry.
- **`requiresEffect` and `RemoveEffect` on a bounded field's interior events** — a filter on what
  a Unit is carrying rather than on what it is, and the one action in that table that takes
  something away. Guidance of the Netherworld's marker discharges on contact with Doomsday Come
  and is removed in the same breath.
- **`VulnerabilityAmplifier` can name a polarity** instead of one effect id, for
  *"Total Debuff Damage taken is increased by 50%"* — every debuff at once, which no list of ids
  would keep up with.
- **Paid extension of a bounded field actually runs.** `extensionFor` had been authored on Chaos
  Labyrinthos since Asterios was written and **had no caller**, so every field with an extension
  simply closed on schedule and its whole attrition cycle was decoration. The cost now names who
  pays (`payer`), may state a floor distinct from the price (`minimum` — *"cannot be used if the
  Master's Health is less than 100"* means a Master on 99 is never asked, rather than asked and
  refused), and may carry `sideEffects`, which is what makes Asterios's extension tighten the
  trap rather than merely postpone it.
- **Masters carry a rank that means something.** The letter (`A`–`D`, or blank for Rankless) is
  settable from the Master's sheet for the first time — it was a free-form string with no
  vocabulary and no control anywhere, so the only way to rank a Master was to hand-edit the
  document. `rules/master-rank.mjs` derives the `high｜low｜rankless` tier every rule actually
  asks for, replacing two duplicated copies of that derivation.
- **The setup coin flip keeps the rank it determines.** §14.9's `coinFlip` mode mapped its `1d2`
  straight onto Base Attack (MAG) 125/100 and threw the rank away, so a table that flipped Heads
  got a Master with 125 who was **Rankless** for ZON, Sustainability, the parameter grant and the
  Kill Yourself price. The coin now picks the rank and Base Attack derives from it, so the two
  cannot disagree.
- **The three things High Rank is supposed to grant, wired.** `ZON +1` (stacking onto the derived
  radius, not the stated-ZON floor), `Sustainability +1◈` while the Master lives, and the
  parameter step — which the summon dialog always offered as a *choice* while nothing limited how
  many could be spent.
- **Jack's Mist spares High Rank Masters on contact**, the Advanced Note left unmodelled when she
  was built because nothing carried a Master rank. Contact only: the turn-end Poison still lands.
- **A freeform bounded field can be redrawn on the canvas** — Ch. 43's "mode E", the fifth
  interaction on the targeting layer and the first outside Ch. 09's anchor-and-shape grammar.
  Drag paints, shift-drag erases, `Enter` confirms, `Escape` or right-click cancels, with a live
  panel counter and the leash drawn rather than enforced after the fact. Offered as a HUD button
  during the owner's Turn and as a prompt at the end of any Turn they Act.
- **`upkeep` and `deactivation` on a bounded field**, and a `contact` interior event — the entry
  half of axis 4, which had only Turn boundaries to fire on.


- **Jack the Ripper**, the thirteenth Servant — seven abilities plus Presence Concealment,
  verified in a live world. Ch. D §D.18 has the clause-by-clause table. Nine engine additions,
  of which **four were repairs to machinery that already existed and had never once run**:
  `annotateFields` merged every contribution bucket except `checkModifiers`; `board.startedAtDay`
  had a reader and no writer, so every Round was Day on the odd ones regardless of what the match
  said; a `predicate` requirement naming `target:` was unsatisfiable in every case, because the
  option set was built from the attacker alone; and `SustainabilityGain` put its value on an
  event handler nothing read back, so the one clause in the corpus whose Sustainability *grows*
  had no payer.
- **Reaction pre-emption** (`AttackFirst`) — *"Jack can Attack first instead of the opposing
  Unit."* Deliberately not a Counter: a Counter resolves at the end of the Process it answers,
  after the damage has landed, and this replaces the order. The attacker's declaration is
  deferred onto the pre-empter's own Combat Process and re-entered when it finishes, so "if she
  kills them, their Attack never happens" falls out of re-resolving the targeting. The Round
  phase is a **cost** here rather than a damage modifier: a Luck Check by day, free at night.
- **`freeform` bounded fields** (Ch. 43), with two new axes they needed: `upkeep`, a recurring
  toll that keeps a field open as opposed to a `duration` that closes it on a clock, closing it
  *instead* of charging when the payer cannot pay; and `deactivation`, for a field its owner may
  switch off. Plus a `contact` event — the entry half of axis 4, which had only Turn boundaries
  to fire on — and a `Defeat` action for fields that kill on contact.
- **Ability categories** (`categorizedAs`, `categorizedWhile`), the first rule anywhere keyed on
  a category *asserted at the bottom of a character sheet* rather than on a named ability. Jack's
  Mist exempts anyone holding "the Instinct Skill of Rank B or higher", and her sheet then names
  five other skills that count as Instinct — an open list that has to live on the abilities.
- **A `roundPhase` requirement kind** and `DetectOverride`, plus `factor` and `maximum` on a
  field's interior stat rules: "halved" cannot be a delta, and "reduced to 1 panel" is a ceiling.
- **Artwork rotation is locked on every token.** Facing is `system.facing`, an eight-point
  compass the Combat Process reads; Foundry's own `rotation` is artwork orientation and nothing
  in this system touches it, so an unlocked token only let a player point the picture somewhere
  the rules disagreed with.
- **A facing indicator on the token itself.** The field the rules read appeared nowhere except a
  dropdown, one unit at a time.
- **A field switch on the token HUD**, one per open bounded field its owner may close at will —
  the control Jack's Mist needed, and the only way a `deactivation` spec can be reached.


- **Enemy Master protection is now an optional rule** (`fgt.masterProtection`, default **on**).
  §8.3 clause 4 is the one movement clause that refuses a step onto a panel which looks empty, so
  a table can switch it off; it then stops applying everywhere at once, reachability included.
  The flag travels on the board snapshot under `board.rules`, read as `=== false`, so absence can
  never disable a rule.

- **Cover** (Ch. 16 §16.4 rule 4) — the last of the four Master-protection rules, and the only
  one that spans two Combat Processes: an AoE Noble Phantasm fans out into one Process per
  defender, so the Master's decides and the Servants' are what the decision changes. A failed
  Master Evade sends each Servant within 2 panels *and inside the area* to an Agility Check; one
  success shoves the Master to the nearest free panel outside, and total failure hands the Master
  a stage-15 `×0` plus an effect-rider veto while the Servants split a `×(1 + 1/N)` between them
  and lose the right to Evade. `rules/cover.mjs` is pure and asks `guardsOf`, so Pale Rider's
  Kagome Spirits inherit the duty the other three rules already redirect. Verified live in
  `fgt2026` across all four branches.

- **Effect families** (Ch. 11, §A). `Bind` is not an effect anybody applies — Appendix A defines
  it as an umbrella over ten that are — and Medusa's `Dmg Up (Bind)` is the first clause that has
  to ask about the umbrella. Declared on each member rather than as a central list, projected
  once as `effectFamilies`, and emitted as `self:`/`target:effectFamily:<id>`.
- **`Petrify` has a definition.** The damage pipeline has enforced its *">200 damage in one
  attack ⇒ defeat"* rule at stage 16 since it was written, and `budget.mjs` has listed it among
  the effects that stop a unit acting for just as long — both against a definition that did not
  exist, so nothing could ever inflict it. Its *"buffs, debuffs and other effects have no
  effect"* is a projection-level blanket negation rather than a rule element, because rule
  elements are collected **from** the projection.
- **Medusa's statline and her four passive skills** — Riding A+, Magic Resistance B, Divinity
  **E−** and Independent Action C. `E−` is the first sub-E rank in the corpus and needed no new
  content: the `divinity` table is scaled at ±5 a step and already answered 5 there.

- **Base Attack is derived from STR and MAG, and the table beats the sheet** (Ch. 06 §6.7,
  Appendix B §B.1). `domain/base-attack.mjs`, read by `ServantData#prepareBaseData` so a Servant
  dragged straight onto the board is right without being summoned. Four authored figures across
  three sheets disagreed with the author's own table and were being played with: Jack the Ripper
  (85 at STR C → 100), Semiramis (45 at STR E → 50) and Hassan of Serenity (65/100 at STR D
  MAG C → 75/150). The sheets keep the transcribed number — they are faithful records — and
  `validate:content` names each divergence.
- **`ensureSetupRolls`, a safety net for a Servant that never passed through `commitSummon`.**
  Agility and Luck need dice, so unlike Health and Base Attack they are rolled once and stamped
  rather than derived on demand. The ordinary routes were covered; one duplicated, built by a
  macro or imported kept the template's zeroes — and a maximum of 0 is a number no d20 can roll
  under, so that Servant auto-failed every Evade in silence. Idempotent, GM-gated, announced.
- **An item acquisition seam** (Ch. 15 §15.8). The rulebook describes one way to obtain an item
  — being handed one — and "Items held" is blank on all 29 Servant sheets, so this is a seam
  rather than a subsystem: the two writers that can put an item on a unit both ask
  `acquisitionTarget` first, and a drop or a kill reward would inherit the answer. It exists
  because Pale Rider redirects: *"All Items that would be obtained by Pale Rider are instead
  obtained by his Master if he/she is within a 2 panel area"* — two halves, independently
  satisfiable, with the redirect lapsing back to the refusal when no Master is in reach.
- **A content guard that an authored unit key actually reaches the compiled actor.**
  `actorSystem` is an explicit allowlist and a key it does not name is dropped in silence: the
  document builds, the pack builds, the validator passes, the sheet loads, and the clause does
  nothing. That had happened to `itemCost`, `summonVariant` and `rules` before, each found only
  by reading a live value and wondering why it was the default — and the allowlist's own comment
  named the failure mode without preventing it. `unitKeyCoverage` compares the authored keys
  against the compiler's own output, so it covers a field added tomorrow.

### Corrected

- **We reported that every Servant auto-fails every Evade and Luck Check. It was narrower than
  that.** `Agility: XX/XX` on a Servant sheet is not a blank the author forgot; it is a value
  derived at summon, and `rules/setup-rolls.mjs` had been deriving it correctly since it was
  written. A Servant summoned through the dialog or dropped from the compendium has always had
  the right numbers. Only one that reached the world by another route — duplicated, built by a
  macro, imported — kept the zeroes, and only that Servant auto-failed.

### Answered

- **Q50 — Agility, Luck and Base Attack are all derived from parameters.** The author supplied
  the conversion table: Agility and Luck from AGI and LUC with a coin flip and a `1d4`
  respectively (±1 per step), Base Attack from STR and MAG (±10 per step), alongside the Health
  table already implemented. Two things follow, and one of them corrects us.

### Fixed

- **§16.4's negation clause was inert: a Stunned Servant still protected its Master.** All four
  Master-protection rules — targeting immunity, counter redirect, zone denial and Cover — read
  `canAct`, and `canAct` answered only `system.canAct`, which nothing but `engine/channel.mjs`
  ever writes. So *"while a Servant is affected by Charm, Confuse, Berserk, Stun, Stop, Petrify,
  Freeze, Sleep, or any other effect that prevents a Servant from Acting, the effects in the
  above paragraphs are negated"* negated nothing. Now read off the effect **definitions** via
  `preventsAction` — the field whose own schema comment says §23.9 *"had to guess from a
  hard-coded list before any effect could say so itself"*.
- **`self:free` could never hold, so the only two clauses that ask it had never fired.**
  `options.mjs` emits it from `unit.contract` and its own comment names Jack the Ripper's
  *"every time Jack kills a Human **when she is a Free Servant**"* as the reason it exists —
  but `snapshot.mjs` built a unit's self-option set without carrying `contract`, so the
  predicate was unsatisfiable and the handler never collected. The same omission hid the
  `self:rank:<parameter>:gte:<grade>` ladder. Found building Medusa's narrower version of
  Jack's clause; it is the same partial fix an adjacent comment already describes one layer out.
- **A granted parameter step was moving Base Attack twice.** `engine/summon.mjs` added ±10 per
  granted step on the reasoning — written into `rules/setup-rolls.mjs`'s own header — that *"the
  sheet's Base Attack already accounts for the parameters it was written with"*. True while the
  sheet was the base; a double count now that the rank picks the row. The adjustment is gone and
  granted steps reach Base Attack the same way innate ones do.
- **Every summon's and platform's stated Agility and Luck were being dropped.** Found by the new
  guard on its first run. Bašmu's sheet says *"Agility: 14 / Luck: 7"* and it compiled to 0 and
  0, as did the four Dragon Tooth Warriors and the Hanging Gardens — so each of them has evaded
  and Luck-Checked against a target no d20 can roll under since it shipped.
- **§16.4 rule 1 was filtering an area's splash, which made rule 4 unreachable.** *"Masters cannot
  be **targeted** for an Attack"* is a rule about picking a target; rule 4 then describes a Master
  who *"gets **caught in** an AoE Noble Phantasm"* with a Servant within those same 2 panels — a
  state the filter removed from existence by dropping every protected Master out of every area.
  Step 8 of `targeting/resolve.mjs` is now gated on the same `isChosen` step 7 uses for
  concealment, whose comment had drawn the line years earlier; aiming an area *at* a protected
  Master is still refused, at the anchor. Found by building Cover, wiring it end to end, watching
  its tests pass, and casting Caladbolg II over a Master and its adjacent Servant in `fgt2026` to
  get a fan-out with no Master in it.
- **Stage 15 of the damage pipeline had no supplier.** `totalDamageModifiers` has been read since
  the pipeline was written — and unit-tested — while every caller left the array empty; Cover is
  the first thing to put anything in it.
- **Writing a flag to a Combat Process's own chat message re-enters `advanceAttack`.**
  `attachAwaitTimeouts` re-arms that message's prompt clock on every `updateChatMessage`, and
  mid-Process the clock re-reads a process flag that has not been written back yet, so the
  timeout answers the rung the caller is still resolving. Cover broadcasts its record to the
  group's *other* messages only — an AoE always has a second defender — and returns early if the
  group already carries one. Found live: a Master shoved twice, (6,4) to (5,3) to (4,2).
- **`ForceTarget` had no reader anywhere.** Decoy's pull, Karna's *Fated Rivals* and a bound
  summon's prey all pushed a `{scope: "targeting", forceTarget}` suppression into a bucket nothing
  consulted, so no compulsion of that shape has ever narrowed a target list.
- **A unit snapshot never carried `suppressions` at all.** They were collected by the executor
  table and projected nowhere, so every `Suppress`, `Decoy` and `WeakPoint` an *ability*
  contributed was invisible to every consumer — only `bypassesMasterProtection`, which reads the
  contributions directly, escaped. A *field's* suppression worked, because the field annotation
  writes that key itself, which is exactly why the gap was invisible.
- **A bounded field's interior rules had never been validated.** The content validator walks an
  ability's rule elements and its phases, and not its `field.interior` — so no field's interior
  has ever been checked for unknown keys, unknown tables or malformed predicates, Jack's Mist and
  Sikera Ušum included.
- **A `DamageModifier` whose `modifierKey` is not one the pipeline reads was silently inert.**
  The buckets are closed sets, so an unrecognised key is collected onto the unit, carried through
  the snapshot, and never consulted — a percentage that authors cleanly and does nothing. The
  pipeline now exports the keys it reads and the validator refuses the rest.
- **A bounded field's interior rule lost its `predicate`.** `annotateFields` ran the executors
  with no `deferred`, so a predicated interior rule became an unconditional one — the opposite of
  the authored intent, and silent. Doomsday Come's anti-Anti-World shelter applied to every attack
  of every scale until this was fixed.
- **An unknown targeting `chooser` threw at resolution instead of failing the build**, unlike the
  anchors and shapes beside it, which the validator had always checked.
- **A bounded field could only belong to a Noble Phantasm.** `field` was declared on
  `NoblePhantasmData` and not on `AbilityData`, because every field in the corpus so far is an
  NP. Contagion is a **Skill**, and Foundry dropped its entire six-axis block on load without a
  word: the Item existed, its `field` read `null`, and nothing opened. A new guard,
  `test/unit/item-schema-coverage.test.mjs`, fails the build when any key content authors is
  missing from the DataModel its document compiles to.
- **Rule Breaker had no Noble Phantasm scale.** `medea-rule-breaker.yml` authored
  `npType: antiUnit` — a key no schema declares and nothing anywhere reads; the field is
  `npTags`. Found by the guard above on its first run. It matters: Ch. 43's vulnerabilities and
  isolation exceptions both compare scale through `npTags`, and an empty tag list clears no
  threshold.
- **Charm transferred no control whatsoever.** `rules/control.mjs` computed the right answers,
  was fully unit-tested, and **had no consumer anywhere in the system** — its only import was
  `fgt.mjs`, which never called it. Two defects sat underneath, either fatal on its own:
  `unit.ownerUserId`, which `controllerOf` reads, was projected by nothing (so every unit
  answered `undefined` and the control map collapsed to the GM); and `charmSource` searched the
  bare-defId `effects` list for an object carrying `source.unitId`, a shape the projection has
  never produced. The module's own tests were written against that same invented shape, which is
  why a green suite hid an inert feature. A charmed unit now moves to its charmer's Turn, spends
  the charmer's action budget, leaves its owner's controllable-unit list and joins the charmer's
  — while its own `factionId` stays put, so the token keeps its colour.
- **An effect's event handler never knew when its own effect ended.** Ch. 11 §11.9 — *"does not
  fire on the turn it ends"* — was enforced for `periodic:` effects and for nothing else,
  because the pseudo-ability an effect contributes passed `defId` and `uses` and not `expiry`.
  Regen, whose three intervals are a handler rather than a periodic, would have paid out one
  extra tick on its way off the unit; so would every effect written that way after it.
- **An `OnEvent` authored as `events:` listened for nothing, silently.** The field is `event`
  and it may hold an array. No content had ever needed a multi-event handler, so nothing caught
  it until Regen — which shipped, in the same session, subscribed to `undefined`. The validator
  now refuses an `OnEvent` that names no event, and says so by name when it finds an `events:`.
- **A flat `DamageNegation` reduced nothing.** `mode: "flat"` has been the executor's own
  default since the element was written, and `engine/attack.mjs#rollNegation` opened with
  `if (n.mode !== "dice") continue` — so a flat negation authored cleanly, collected cleanly
  into the `damageNegation` bucket, and was then skipped in silence. It stayed invisible
  because every negation in the corpus is dice-mode (Battle Continuation, both Territory
  Creations); Pale Rider's Dmg Cut is the first flat one and would have done nothing at all.
  Flat entries now contribute their resolved value with no roll. A negation can also carry a
  charge count for the first time (`uses`/`consumesUse`, the same three fields `AutoSucceed`
  already carried), spent only when the negation stage had damage to reduce.
- **A bounded field stored the bounding rectangle of its panels, not the panels.**
  `fields.mjs#shapeOf` built the Region as one rectangle while `boundedFieldsOf` reads the panels
  back *off* the Region — so the stored set was discarded on every board read and replaced by its
  own bounding box. Invisible while every field in the corpus was a square, where the two agree;
  it fills in the notch the moment anything is painted as an L. Fields now store a grid shape,
  which `target-region.mjs` has always used for transient targeting areas.
- **The once-per-Turn repaint gate never closed.** `rules/snapshot.mjs#turnStateAt` copies a fixed
  key list, so `reshapedField` was written to the document and invisible to every rule reading a
  snapshot.
- **Shift-drag never erased.** A PIXI 7 federated pointer event sets `data` to *itself* and
  `originalEvent` to the federated event it came from — not the DOM event — so
  `data.originalEvent.shiftKey` was `undefined` and every stroke read as paint.
- **A field's interior EVENTS ignored their own exemptions.** `isExempt` was wired into
  `interiorModifiers` alone, so a clause could author an exemption, compile it, and fire anyway.
- **`Rank.parseOrNull` throws rather than returning null** for what it cannot parse, so a Master
  whose rank was junk crashed the Noble Phantasm cost instead of being priced. `tierOf` reads
  unparseable as Rankless, and the schema's `choices` stops it arising.


- **The token HUD's facing control was unusable.** A `<select>` inside Foundry's fixed 35px
  `.control-icon`, measured live at **25px wide with 16px of that spent on padding** — nine
  pixels of content box for "South-west", and a native dropdown arrow is wider than that. It
  rendered as an empty grey sliver: the current facing could not be read and neither could any
  option. The write path was fine; nothing about it was visible. Replaced by one arrow rotated
  to the heading, left-click clockwise and right-click anticlockwise.


- **A placed token followed neither its actor's portrait nor its declared footprint.** Two
  independent defects reported from play and confirmed live before anything changed; Ch. 04 §4.2
  and Ch. 20 §20.3 carry the full accounts.

  - **Only a Servant's token followed its image.** The sync ran under
    `if (actor.type !== "servant") return`, so a Master, Summon, Civilian, Structure or Platform
    whose portrait changed kept its old texture with no way to shift it short of deleting the
    token — the Hanging Gardens sat on the board as a mystery man while its sheet showed its own
    art. Only a Servant has an identity to *conceal*, so the concealment branch stays
    Servant-only and the sync itself now covers every unit type. `defaultImage` is inert on
    anything but an unrevealed Servant, matching what the sheet actually displays.
  - **The sweep covered only the scene currently open**, under a comment claiming the opposite:
    `Actor#getActiveTokens()` passes `scenes: canvas.scene`. A token on any other scene kept its
    old texture indefinitely.
  - **One deleted token stopped the whole pass.** `getDependentTokens()` reads an
    `IterableWeakSet` a deleted token stays in until collection; `await token.update()` on a
    ghost throws, and a single sequential loop meant the real token behind it was never reached.
    Foundry's own `getActiveTokens` carries that liveness guard, which is why losing it went
    unnoticed. `engine/token-sync.mjs#placedTokensOf` now owns both corrections.
  - **A 9×9 platform placed a 1×1 token.** `system.footprint` and `TokenDocument#width`/`#height`
    are the same fact in two places and nothing joined them, so `prototypeToken` compiled at
    Foundry's default: the Hanging Gardens showed as one cell in the compendium and dropped onto
    a scene as one cell. Not cosmetic — `snapshot.mjs#gridFootprint` reads occupancy off the
    **token** while `platforms.mjs#isUnderPlatform` reads the footprint, so the board saw a
    one-panel obstacle sheltering 81 panels. Only `engine/hgob.mjs` escaped, sizing its token by
    hand, which is why an HGoB *raised in play* was 9×9 and one *dragged from the compendium* was
    not. Fixed at build time (`tools/lib/content.mjs`) and at runtime
    (`engine/token-footprint.mjs`, covering prototypes that predate the fix).
  - **The runtime resize needed `fgtForced`, and said nothing without it.** `width` and `height`
    are Foundry v14 `MOVEMENT_FIELDS`, so a resize routes through the movement pipeline and
    `onPreMove` refused it — arriving at `preUpdateToken` as a bare `{_id}`, with no throw and no
    rejection. The third silent-failure-by-movement-field here after `level` and `elevation`.

- **The Hanging Gardens could not fly, could not carry anybody, and left a Scene Level behind
  every time it was raised.** Seven defects, found by driving it on a live board; §20.2 has the
  full account.

  - **The platform's own token was never assigned to its level.**
    `activateHangingGardens` creates the token and *then* calls `activatePlatform`, which moved
    only the initial passengers. So the Gardens flew at elevation 0 on the ground, where it
    collided with every unit on the board and `passengersOf` counted all **21** of them as
    passengers — moving it would have dragged the entire match sideways.
  - **…and it could not have been, because our own movement hook refused it.** Foundry counts
    `elevation` and `level` among `TokenDocument.MOVEMENT_FIELDS`, so a level assignment reaches
    `preMoveToken` as a movement with no horizontal step and `validatePath` rejected it:
    *"Step 1 is not an orthogonal move."* **This broke boarding by the same route.**
  - **`fgtForced` had never worked.** Foundry calls the hook as
    `Hooks.call("preMoveToken", document, move, options)` — the options are the **third**
    argument, and `move` carries none. Our two-parameter hook read `movement.options.fgtForced`,
    so every forced displacement in the system was re-validated as a voluntary move.
  - **Elevation bands overlapped the ground.** `bottom = levelCount × 10` assumes a 10-tall
    ground; Foundry's default Level is `{bottom: 0, top: 20}`, so the first platform landed
    *inside* it — and `inferLevelFromElevation` prefers a strictly-interior level to a
    bottom-edge one, pulling every passenger back down. Bands now start at the highest existing
    `top`.
  - **Nothing swept a level whose platform was gone.** `teardown` runs only from
    `destroyPlatform`, so a hand-deleted platform stranded its level and the next activation
    stacked another. Measured at **three** orphaned "Hanging Gardens" levels on one scene — what
    a GM sees as four sub-scenes. A GM should see exactly one level per active platform, plus
    the ground.
  - **`occupantAt` ignored the level**, comparing `i` and `j` only, so every unit in a scene
    shared one 2D grid whatever its elevation and a flying platform was blocked by the ground.
    §20.2 lists "separate occupancy" as the first thing a Scene Level buys; it was the one thing
    it did not.
  - **§20.8's movement linkage had never carried a passenger.** `carryPassengers` computed its
    delta as `platform.panel − movement.origin`, and at `moveToken` the document still reports
    the origin — so the delta was always `{0, 0}` and it returned before moving anybody. It now
    uses the operation's own `origin` and `destination`, neither of which depends on document
    propagation.

  Measured live after the fixes: two levels (0–20 and 20–30, non-overlapping), the platform on
  its own level at elevation 20 with its owner aboard, one passenger instead of 21, free movement
  across ground-occupied panels, and a two-passenger formation carried two panels with both
  relative offsets preserved.

- **…and you could not click anything near it either.** A platform is a **9×9 token**, and
  `Token#hitArea` is the token's whole shape, so its hit area covers eighty other panels.
  `PlaceablesLayer` sorts by `elevation → sort → zIndex → insertion order` and PIXI picks the
  topmost, so clicking a Servant standing *on* the Gardens selected the Gardens, and so did
  clicking one standing *under* it. Two causes, two fixes:

  - **A passenger** shares the platform's elevation, so the tie fell to `sort` — both were `0`,
    and insertion order gave it to the platform. Platforms now take `sort: -1000`, which is the
    field Foundry uses in the other direction (`_onDropActorData` drops new tokens at
    `getMaxSort() + 1`). A platform is scenery you stand on; it belongs at the bottom of its own
    elevation.
  - **A unit below** is genuinely lower, so no `sort` can help. `FGTToken#isInteractable` adds
    the clause levels imply and Foundry never applied to interaction: **only the level you are
    viewing accepts clicks.** Foundry already scopes vision and fog that way
    (`_isVisionSource`, `_isFogExplorationSource`) and badges off-level tokens; it just never
    scoped picking. Overriding the getter rather than assigning `eventMode` from a hook is what
    makes it survive — `_refreshState` re-reads it on every refresh.

  Single-level scenes are unaffected. Measured live: viewing the ground, a unit under the 9×9
  platform resolves to that unit; viewing the garden, a passenger sharing the platform's centre
  panel resolves to the passenger.

- **The overlay layer wedged itself permanently after any canvas redraw**, throwing
  `Cannot read properties of null (reading 'off')` on every `hoverToken`, `controlToken` and
  `fgt.invalidate` — and silently drawing nothing.

  `OverlayLayer#refresh` destroys its text badges by hand (`Graphics.clear()` does not remove
  Text). The badges are children of the layer, and `_tearDown` did not clear `#labels` — so after
  a level switch or any `canvas.draw()` the array held Text objects Foundry had already destroyed
  with the rest of the layer's children. `PIXI.Text#destroy` nulls `_style` and then reads
  `_style.off(...)` on a second call.

  The throw happened **before** `this.#labels = []`, so the stale array was never cleared and
  every later refresh threw again — a one-off turned permanent. `_tearDown` now clears the list
  (the root cause), and `refresh` replaces it *before* destroying anything and skips a label that
  reports `destroyed`, so a single bad element can no longer prevent the bookkeeping that would
  have recovered from it. Verified from a cold load: zero errors across a battery of hovers,
  selection, five invalidation targets and a level switch, with the badges still rendering.

- **Orphan level sweep now scatters stranded passengers first.** It skipped an occupied orphan,
  which meant it could never clean up the case it exists for — the riders are exactly why the
  level outlived the platform. Measured: a second "Hanging Gardens" level accumulated on the very
  next activation.

- **Asterios and Karna are finished.** Both were already on the "authored" list. Asterios had all
  five abilities and **six of their clauses had no reader**; Karna had four of thirteen, and the
  four included neither of the two that define him. All eighteen abilities now resolve end to end
  in a live world, verified individually.

  **Asterios — six clauses that were authored, validated, compiled, loaded and unreachable:**

  - *Monstrous Strength* shipped as `activeRules` on an ability that is not a mode, so nothing
    could ever switch it on. It needed **the attacker's own timing window**, which did not exist —
    every window in the system described a moment inside somebody *else's* Combat Process.
    `abilitiesAtWindow` + `offerAttackerWindow` add `damageStep` and `combatPhaseStart`; the
    chosen ability's rules are folded into that one attack, because the sheet says *"that Attack"*.
    Measured: 406 accepted, 201 declined, cooldown untouched when declined.
  - *Chaos Labyrinthos* declared six field axes and carried **no `createField` phase**, so the
    Labyrinth was never opened; its anchor was `{kind: selfCentred}`, which `resolveAnchor`
    **throws** on; its cooldown was a bare `8◈` where the sheet says *"after the NP ends"*; and its
    activation debuffs were aimed at `[enemy, ally, self]`, so he debuffed his own team and himself
    every cast.
  - `regionSizeOverride: {greece: 11}` had no reader anywhere. `regionSizedShape` is its first.

  **Karna — six clauses that could not be written at all**, each closed with something general:
  `target:paramVsSelf:` (Brahmastra's 4×/2× fork), `attack:element:` (his Fire resistance),
  §E's **`combatProcessEnd`** (Vasavi Shakti's per-Process upkeep), `unlessUsedThisTurn` (Note 2),
  `target:contentId:` (Fated Rivals, backing §36.1's own DECISION), and `oncePerRound` (the only
  limit on Uncrowned Arms Mastership, which has no cooldown).

  **Vasavi Shakti is two documents**, not §36.1's proposed `modes:` schema: an `isNP` document
  cannot be free, and `canUseAbility` would have gated a free activation behind 75 Master Health
  the sheet says it does not cost.

- **Four new content-validator checks**, each added because something had already gone wrong
  silently: targeting **anchors and shapes** (an unknown anchor throws, so the ability cannot be
  used at all); requirement **kinds and selector fields** (an unknown kind refuses, which is loud —
  a misnamed field on a known kind **passes**, which is not); rank tables named inside an event
  action; and `applyEffects` phase entries classified as the effect specs they are.

### Fixed

- **Every cooldown in the game.** `cooldownFor` gated its branch lookup on `if (cd.branches)`.
  `branches` is an `ArrayField`, so the DataModel turns the `null` the compiler writes for an
  ordinary string cooldown into `[]` — and `[]` is truthy. Every ability whose cooldown is a plain
  tick expression entered the branch path, matched nothing, and got no clock. Measured live:
  **49 of 49 abilities** across six authored Servants were infinitely reusable. It arrived with
  `cooldown.branches` itself, so every Servant verified before that was verified correctly and had
  been wrong since.

- **`board.warRegion` was permanently `null` in every world.** It reads `combat.system.region`, a
  field declared on `MatchData` that **nothing has ever written** — no setup flow, no sheet, no
  API — while the Region a GM picks lives in the `fgt.region` setting, read only by
  `engine/summon.mjs`. §5.6's Region Parameter grant, the Hanging Gardens' Construction multiplier
  and Asterios's Greece clause were all inert. `currentBoard` falls back to the setting.

- **Non-damaging Noble Phantasms dealt their caster's Normal Attack.** Every NP resolves through
  `resolveAttack` and the Combat Process always runs its damage stage, so an NP with no `damage:`
  block fell through to the Normal Attack fallback. Five were affected; Chaos Labyrinthos measured
  at **203** damage from an ability whose description opens with "(Non-damaging)". An ability that
  declares phases and no `damage` phase now deals none.

- **`RankShift`'s parameter branch dropped `to:`.** *"STR Rank is increased from B to A"* would
  have made Karna `B+`; Kiritsugu's `E → EX` would have made him `E+`. The ability branch honoured
  `to:` and the parameter branch never did.

- **`negatedBy` was read only on the use path**, so it refused the button and left the ability's
  rules contributing underneath. EMIYA carries it on eight abilities, one of them `isPassive` and
  therefore never used at all; Medea's *"cannot be used **and its effects are negated**"* had only
  its first half built.

- **Mad Enhancement contributed three wrong numbers**, all reaching Penthesilea too: the
  `[normal, vsNP]` table pair collapsed to its first half, so NP damage was reduced by 40% instead
  of 20% at B; *"halved for Base Attack (MAG)"* was not implemented at all; and the drain floor and
  forced-deactivation threshold were both the literal `30`, `madEnhancementDrain`'s **EX** value,
  at every rank.

- **Mad Enhancement's Sustainability clause read a field nothing writes.** `onMasterDefeated`
  tested `servant.modes`, which no snapshot, applier or schema has ever produced.

- **The damage pipeline lost a point to binary floating point.** A 90% reduction is
  `1 + (-90)/100 = 0.09999999999999998`, so 1000 damage floored to 99. `Ward` also dropped
  `npValue`, so a type resistance could not state an NP figure.

### Corrected

- **Ch. 13 §13.5's stage-5 DECISION is superseded.** Contributing `min(str, mag)` to the additive
  bucket and the difference to stage 5 gets the STR case wrong whenever anything else is in the
  bucket, because stages 4 and 5 compose multiplicatively while §13.4's rule is additive. Mad
  Enhancement B against 100% Def Up is ×0.60 by the rulebook's own worked form and ×0.39 by the
  split. A **predicated pair in the bucket** is exact, and only became possible when deferred
  predicates arrived. Stage 5 keeps a real user in Monstrous Strength, which names one component
  and gives no magnitude for the other.

- **Ch. 15 §15.3's `modifyAttack` phase was never built and is not needed.** The `damage:` block
  already expresses everything `BaseAttackOverride`, `IgnoreMagicResistance`, `ElementTag` and
  `OnHit` were invented for. A Skill "used when performing a Normal Attack" *is* the attack:
  `isAttackSkill: true`, one button, one Combat Process.

- **Two unit-test fixtures described shapes no document has**, and each hid one of the two worst
  findings above. Stated as a rule because it landed twice in one pass: *a fixture is only evidence
  if it is the shape the caller actually gets.*

- **Known simplification, recorded rather than faked:** Karna's *Mana Burst (Flames)* declares
  `Fire Damage (half)` and the "(half)" is not modelled — `ctx.attack.element` is a single value
  and every reader of it is all-or-nothing. It is the only clause on either sheet that is not
  exact.

- **Hassan of Serenity is built** — all seven abilities resolve end to end in a live world,
  verified individually. The eighth Servant, the first Assassin, and the one whose sheet is
  written almost entirely in terms of **information**.

  **Presence Concealment did nothing at all before this.** Eight clauses touching targeting, the
  reaction ladder, the damage pipeline, movement legality, Master protection and what a player may
  press — and every one of those readers already existed. `system.concealed` was projected by the
  snapshot, consulted by four subsystems, **written by no code and declared by no schema**, so all
  four asked a question whose answer was always `false`. The state rides the `presenceConcealment`
  effect now, which is also what clause 8 asks for (*"neither a buff or a debuff, and are
  Unremovable"*).

  New engine:

  - **`rules/concealment.mjs` and `engine/concealment.mjs`** — the eight clauses as answerable
    questions, and the one function the six deactivation paths converge on. Each owes the same
    three debts: the cooldown that starts at deactivation, the announcement, and the Secret Poison
    that becomes visible.
  - **`cooldown.countFrom: deactivation`** — a declared schema field with no reader. Without it
    the 2◈ cooldown runs *underneath* the Skill's own 2◈ duration.
  - **The `damageDealt` event**, with the victim reachable as `ctx.victim`, plus **`target:
    victim | nearby`** on the `ApplyEffect` action and a desugaring for the **`effect:`
    shorthand**. All three were needed by every on-hit rider in Appendix A, and none existed:
    `Bleed Atk` and `Queen's Poison` were inert twice over — nothing raised the event, and the
    shorthand compiled to an empty action list.
  - **The poison family**: `Poison` (staged, 20 × 2^(N−1)), `Deadly Poison` (a multiplier on
    somebody else's periodic tick, which no rule element can express), `Macabre`, `Skill Seal`,
    `Death ChUp`. `scheduler.PERIODICS` had carried Poison's formula since it was written with no
    document to key on.
  - **`stages: N`** — one application worth N stages, for *"inflicts Stage 3 Poison"*, and a
    batch-level merge so two riders staging the same effect in one breath produce one instance at
    stage 2 rather than two at stage 1.
  - **Secret Poison** — `visibility` and `attributionHidden` on the instance finally written and
    read, plus `system.hiddenDamage` as the tally the sheet promises to reveal. Follows **Q47**:
    the Health comes off on schedule and only the cause is deferred.
  - **`state.forbiddenReactions` is honoured**, in the card and at the transition. It had been
    written by the Command Spell retarget since Command Spells shipped and read by nothing, so
    §27.9's own rule was inert.
  - **`Suppress { scope: masterProtection }`**, for the reader `resolve.mjs` has consulted since
    Master protection was written with nothing ever setting it.
  - **A cooldown `increase` direction**, `scope: np` on a cooldown phase, and ◈ expressions in
    cooldown changes — Shapeshift's *"increase its NP Cooldown by 1◈ Turns"* was the one cooldown
    operation the system could not perform.
  - **`attack:crit`** as a roll option, and the crit flag put on the damage **result** rather than
    only on the chat card.
  - **`usableWhileConcealed` and `concealmentBreakChance`** on the ability, for clause 7's
    "unless stated" and what stating it costs.

- **EMIYA is finished** — all seventeen abilities resolve end to end in a live world, verified
  individually. The seventh Servant, the first Archer, and the one whose sheet is written almost
  entirely in terms of **distance**, which nothing in the engine emitted.

  New engine, in rough order of how much of his kit depends on it:

  - **`attack:range:*` roll options**, as a ladder in both directions (`gte`/`lte`), because a
    predicate can only test set membership. An unknown distance emits nothing rather than 0.
  - **`normalAttack.mode: rangeBanded`**, one of three declared choices in the actor schema since
    it was written, with nothing implementing it. Three things move together at the band edge —
    the sources, what the attack counts *as*, and whether Magic Resistance sees it.
  - **`attackFacts`**, one builder for the attack context. Four call sites each rebuilt it and
    each dropped a different subset, so `component`, `pierce` and `ignoresMagicResistance` were
    never set — three fields the damage pipeline reads by name.
  - **Barriers** (`engine/shield.mjs`): a second Health pool in front of a defender, shared by
    several bearers, charging its owner for what it absorbs.
  - **Bounded field creation** (`engine/fields.mjs`). Everything in Ch. 43 had a reader and none
    of it had ever run, because nothing created a field.
  - **Three events that had never fired**: `attackDeclared`, `evadeSucceeded`, `combatPhaseEnd`,
    plus `abilityUsed` with an `ofCategory` filter.
  - **`sameRoundExclusive`, `timesUsed`/`maxUses`, `lastUsedTick`, `healthWatermarks`** — three
    scales of "already used" beyond the Turn, and the history that `healthRestoredSince` needs.
  - **`replaces`** on an effect definition: mutual exclusion that resolves by replacement rather
    than by refusal, which is the only way to say "cannot hold both" and "may swap" at once.
  - **Phase kinds** `choose` and `createField`, phase-level `targeting`, `afterFirstUse`, and a
    cooldown phase that offers the player a shape.
  - **`Rank#stepGrade`**, `negatedWhile`, `casterOutsideArea`, `minRange` on a unit anchor, and
    `masterHealthByNPRank`.

- **Heracles is finished** — he shipped with four of his eight abilities, and the four that were
  missing were the four Ch. 31 was written about: *Indomitable*, *Bravery*, *Eye of the Mind
  (False)* and *God Hand: Twelve Labors*.

  **Revival is now a priority-ordered query** (`rules/revival.mjs`, `RevivalSource`) rather than
  "whichever handler heals first". His sheet states the order — *"Undying > normal Guts > Battle
  Continuation > God Hand"* — and with one source the old behaviour is indistinguishable from
  correct, while with four it burns a God Hand charge with `Undying` sitting unused.

  God Hand needed two things nothing else does: a **cascading** revival that can spend several of
  its eleven charges against one very large attack, and a **ledger of attack identities** — a
  `SetField`, which is the line §6.10 draws while naming this exact ability — whose members can
  never take him below 1 Health again.

  Battle Continuation's second condition is enforced for the first time. It shipped as
  `requiresHealthAbove` against a field no code wrote, which §45.1 named rather than faking;
  `system.healthWatermarks` is the history it was waiting for.

### Fixed

- **An ability that stated its Base Attack was computed from the other one.** `damage.component`
  was read by `componentOf` — which answers the Magic Resistance question and feeds
  `attack:component:` — and ignored by the **base spec**, which fell through to the Servant's own
  Normal Attack component. So every Noble Phantasm in the corpus that names a Base Attack without
  spelling out a `base:` block used the wrong one: Serenity's *Zabaniya* multiplied BA(STR) 65
  where her sheet says BA(MAG) 100, and EMIYA's *Hrunting* and *Caladbolg II*, Medea's *Aero* and
  *Rain of Light*, and three of Scáthach's four did the same. Abilities with an explicit `base:`
  block — Karna, Penthesilea, Heracles's *Nine Lives* — were unaffected.
- **An effect with no stated duration expired before it ticked once.** `resolveTicks(null)` is 0,
  which is right for *"this turn"* and disastrous for *"unstated"*: the expiry landed on the
  current tick and the instance was swept by the very next boundary. Poison, which Appendix A gives
  no duration because it runs until cured, was applied, staged to 1, and removed at the end of the
  same Round having dealt nothing. An unstated duration now means permanent.
- **`io.createEffects` dropped `visibility` and `attributionHidden`.** Both have been on the
  instance schema since `0.2.0`; the writer named ten of twelve fields, so an effect could be
  constructed hidden by a correct pipeline and was created public every time.
- **A retargeted defender could still Block and Evade.** `state.forbiddenReactions` was written by
  the Command Spell retarget and read by nothing, so §27.9's own rule was inert.
- **`Debuff ChUp` improved the chance of applying a buff.** An outgoing `ApplicationChance` now
  applies only to debuffs unless it names one effect outright — which is what every clause of that
  shape in the corpus says. Serenity's *Silent Dance* was raising her own self-buffs to 110%.
- **Independent Action granted a flat 2 panels of ZON at every Rank.** The class skill carried a
  literal where a rank table belongs; right for EMIYA's B, wrong for Serenity's A, which her sheet
  states as 3.
- **The Presence Concealment Evade bonus was hardcoded to 4.** Right for A+ by accident, wrong for
  every other Rank the corpus uses; it reads `presenceConcealmentEvade` now.
- **The Block/Counter refusal compared Agility pools, not AGI Ranks.** Two Servants of identical
  Rank disagree about the spendable resource constantly, so a concealed attacker who had paid for
  a few Evades became blockable mid-match with nothing on screen to explain it.
- **Every effect applied by an event handler bypassed the effect pipeline.** `io.createEffects` is
  a bare create, and the scheduler's `ApplyEffect` action emitted a bare intent — so immunity,
  exclusivity, the chance roll and the stacking rule were all skipped for every `OnEvent` rider in
  the game. Resolved intents are now marked and `applyIntents` runs the rest through the pipeline.
- **`OnEvent` dropped a deferred predicate**, so a handler gated on the attack fired
  unconditionally.
- **`CheckModifier` and `TableOverride` could not be conditional on the attack** at all.
- **`resolveAttack` recorded no ability use**, so `oncePerTurn`, `sameTurnExclusive` and the rest
  were enforced for Skills and ignored by Noble Phantasms and Attack Skills.
- **A non-damaging Noble Phantasm lost every phase that was not an effect** — it could not spend a
  Resource, open a field, conjure a squad or ask a question, while charging its Master in full.
- **`ResourceDelta` wrote to a bare pool name** rather than a path, so the write was dropped.
- **`resourceAtLeast` never read a §6.10 pool** — the mechanism it exists for.
- **Interior rules of a bounded field all went into `modifiers`**, where a stat-shaped one does
  nothing; and the field's **owner was not its own relation**, so every `relations: [self]` interior
  clause in the reference set matched nobody.
- **Three shipped effects were written against roll options nothing emits** — `N.Atk Up`,
  `Bleed Atk` and `NP Seal`. `isEmittableOption` now holds the content against the vocabulary.
- **`Independent Action` had no content file**, so the contract rule that looks it up by slug had
  never found one.
- **A revival heal applied before the damage that caused it**, so a revived Unit ended the
  exchange at 0 Health, alive, having spent a charge for nothing.
- **A revival source borne by an effect was never consumed**, which makes a one-use `Guts` buff
  permanent.
- **`unitRevived` had never fired**, so Heracles's *Indomitable* — the only clause that listens —
  could not pay out.
- **Nine Lives' cooldown was `7◈` where the sheet prints `7◈+⅓◈`.**

- **Medea is finished** — all thirteen abilities resolve end to end in a live world. The last
  four needed: **reaction-window abilities** offered at the react rung (`rules/reactions.mjs`),
  **rank-comparison roll options** (`target:rank:mag:gte:B`, `self:skillRank:...:gte:B`), **per
  effect `chanceModifiers`** that stack, **multi-element auras** resolved by group and rank rather
  than by element value, and **`scope: field`** auras with a `requiresRecipient` condition — which
  Territory Creation needs, because "allied Units who are in *their* Home Base" cannot be a
  predicate evaluated against the source.
- **Dragon Tooth Warriors and Rule Breaker.** The `summon` phase (two nested rolls, placement on
  free panels only, a cooldown scaled by the first roll) and the `cutContract` phase, which reads
  the ladder's outcome because a successful Evade keeps the Contract. Both verified in a live
  world: 1d6 → 5 Warriors of mixed types with a 10-turn cooldown, and a Contract cut with the
  loser's three Command Spells stripped and three granted to the winner, namespaced.
- **The character sheet scrolls.** The scroll is on the part root so ApplicationV2 restores the
  position across re-renders, and §29.3's Master block became a partial rather than a second part
  so there is one scroll container instead of two.
- **Medea**, the fifth Servant and the first Caster — thirteen abilities, seven of them Spells.
  Verified end to end in a live world: Golden Fleece (30% of maximum Health, +3 Agility),
  Keraino, Argos, Teachings of Circe (cleanse by polarity, 10% heal, NP Cooldown Regen),
  High-Speed Divine Words (resets all seven Spell cooldowns by **category**, not by name), and
  Trofa correctly refused by `sameTurnExclusive` after Keraino.
- **Engine features her sheet required**: effect `severity` (Appendix A's Instakill/Death ladder,
  which chance modifiers filter on), the outgoing `inflictBonus` reader, `sameTurnExclusive`,
  `negatedBy`, an ability `category`, cooldown changes by category, `removeEffect` by polarity
  selector, `heal` by percent of maximum, `resource` with `clampToMax`, and the `self:inHomeBase`
  roll option.
- **`tools/fgt-eval.mjs`** — evaluate an expression inside the running Foundry tab over CDP.
  The document-touching layers have no unit tests because they need a live world, and every bug
  reported from the table so far has been in one of them.
- Three effects (`movUp`, `stun`, `npCooldownRegen`) and three Dragon Tooth Warrior statblocks,
  in a new `packs/_source/summons/` directory.

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

- **Every effect whose behaviour is expressed as rule elements did nothing.** `contributionsOf`
  resolved the definition from `effect.system.def` — a field nothing has ever populated and which
  is not on the schema — so the collection beneath it never ran. Medea's MOV Up granted no MOV
  and her automatic evasion granted no evasion, and both looked perfectly applied on the sheet,
  which is what let it survive. Resolved from the registry by `defId` now.
- **Aura-delivered contributions went into `modifiers` regardless of their reader.** The effect
  applier reads `applicationChances`, so Item Construction's six-element severity ladder was
  collected on every snapshot and consulted by nobody.
- **`timing.window` was only on the Command Spell schema**, so an ability authored "used when
  Attacked" compiled with its window and the DataModel dropped it on load — leaving the reaction
  rung with nothing to offer.
- **The attack path read only `phases[].rules`**, silently dropping every rider authored in
  §15.2's own `effects:` shape: Aero dealt its damage and inflicted no Bleed.
- **`AutoSucceed` discarded `chance` and `chanceWhen`**, so a conditional automatic success was
  unconditional — Trofa would have evaded a Noble Phantasm outright rather than on a coin.

- **No Noble Phantasm has ever been payable, and no second Servant has ever been orderable.**
  A document stores `health: {value, max}`; `snapshotUnit` flattens it to a **number**. Six rules
  files read `unit.health.value` directly, so against a real snapshot they saw `undefined`, took
  the `?? 0` beside them, and compared zero. `cannotPay` then refused every NP (strictly greater),
  and `mayOrderAnotherServant` refused every second Servant. Every fixture in the unit tests used
  the document shape, so the code and the tests agreed with each other and not with the system.
  `module/domain/health.mjs` is the only reader now, with a guard.
- **No Attack Skill or Noble Phantasm has ever gone on cooldown.** `resolveAttack` never set one;
  the Skill path did. `module/engine/cooldown.mjs` is now the single implementation for both,
  applied at confirmation beside the cost, and `alsoTriggers` (§7.6) rides it.
- **An attack froze permanently at its first interruptible rung** whenever a Master could offer a
  Command Spell. `awaitInterrupt` compared the process flag against the **in-memory** state, which
  had already advanced past it — so the first poll reported "somebody spent" when nobody had, and
  the caller re-read the flag, restoring the pre-advance state and discarding the advance. It
  needed a Master *on the board* to appear at all.
- **Tokens are linked at the document level**, not only for compendium content. An actor a GM
  creates by hand is just as much one unit, and the compiled default did not reach it.
- **The targeting picker offered an anchor the resolver does not have.** It called `withinRange`
  "point", which authored cleanly, validated, and threw the first time Medea's Rain of Light was
  aimed. The drift test guarded shapes and not anchors; it now guards both, which immediately
  found an invented anchor and an unreachable one.

- **Every `noneRefresh` effect duplicated instead of refreshing.** `resolveStacking` decided
  `refresh` / `extend` / `stage` and the emit step **ignored the action**, always emitting a bare
  `applyEffect` — which always creates. So Bleed, Burn, Stun and most of Appendix A grew a second
  document on every reapplication. Found in a live world when Medea's NP Cooldown Regen appeared
  twice with the same expiry.
- **A granted END step did nothing to a Servant who states its own `baseHealth`.** The step was
  applied by re-reading the Health table at the shifted rank, which looks equivalent and is not:
  `servantSetupPlan` prefers a stated figure, so the shifted lookup returned the same number.
  §14.9 says "± 100 per END step" literally, and it now does. Medea is the first Servant to
  state one, and her Greece Region grant silently missed her Health.
- **Servant, Master and platform tokens are now LINKED by default.** Foundry defaults
  `actorLink` to false, so a skill resolved from the board wrote to the token's copy while the
  sheet showed the world actor — "the heal applied and the Health did not change". Summons stay
  unlinked, which is the reason the default is per type rather than global: Medea conjures up to
  six Dragon Tooth Warriors from one statblock, and six linked tokens would share one pool of
  Health.
- **`summonServant` handed a live document's `system` to the pure layer**, whose contract is that
  it takes a snapshot. `region` is a `SetField`, so `region.includes(...)` threw on the first real
  summon. The engine normalizes at that boundary now, and the SetField guard covers the one
  pure-layer file that is knowingly handed document data.
- **`inflictBonus` was a parameter every caller passed 0.** Outgoing `ApplicationChance`
  contributions were collected on every snapshot and read by nothing; Medea's Item Construction
  is the first content that needs them.

- **A Skill was resolved as an Attack.** Using Asterios's *Avyssos of Labrys* — three buffs
  applied to Asterios, touching nobody — opened a targeting session listing Asterios as a target,
  priced him at "120–165" damage, offered a button labelled **Attack**, and on confirmation
  started a Combat Process that asked him to Evade or Block. *Natural Monster* did the same.

  `resolveAttack` was the only route into using an ability. Every layer already had what was
  needed to prevent this: `classifyAbility` returned `isAttack: false`, and `targetSpecFor`
  returned a self/self spec. The sheet's click handler read neither — the signature defect of
  this project, a rule that is right and inert.

  A non-attacking Skill now has its own path (`module/engine/skill-use.mjs`): no Combat Process,
  because there is no defender and a ladder whose every rung is skipped is not a ladder; a plain
  card instead of a reaction card; the **skill** budget rather than an attack; and no targeting
  session at all unless something is genuinely being chosen.

  Two rules the code had never expressed, both from §15.1 and both now honoured. **"Attack Skills
  deal damage" means *directly***: a skill whose only effect is a debuff that costs Health over
  time is not an Attack Skill, however much Health the poison eventually removes. And **"unless
  stated"** — `countsAsAttack` and `countsAsAct` appear in this chapter's own worked example and
  nothing had ever read them.

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
