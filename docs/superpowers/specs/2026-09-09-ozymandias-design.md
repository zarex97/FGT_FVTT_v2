# Ozymandias — design

**Date:** 2026-09-09
**Chapters affected:** [04 — Units](../../04-units.md), [08 — Board and Geometry](../../08-board-and-geometry.md),
[09 — Targeting](../../09-targeting.md), [13 — Damage Pipeline](../../13-damage-pipeline.md),
[15 — Abilities](../../15-abilities.md), [16 — Relationships](../../16-relationships.md),
[18 — Action Economy](../../18-action-economy.md), [19 — Environment](../../19-environment.md),
[42 — Terrain](../../42-terrain.md), [43 — Bounded Fields](../../43-bounded-fields.md),
[44 — Case: Expanded Roster](../../44-case-expanded-roster.md),
[45 — Implementation Status](../../45-implementation-status.md)

**Source:** `char_orig_sheets/Copia de Ozymandias.md`

---

## 1. The problem

Ozymandias is **entirely unauthored** — no `packs/_source/servants/ozymandias.yml`, no ability, no
summon. His only presence in the codebase is two prose comments and two test fixtures named
`tentyris` (`test/unit/bounded-fields.test.mjs:382-402`), which were written against his sheet and
have never had a document to resolve.

He is also load-bearing for somebody else. `packs/_source/abilities/quetz-xiuhcoatl.yml:116` records
it plainly:

> *"NO LIVE REFERENT: the only [Fortress] NP in either roster is Ozymandias's."*

and Ch. 45 lists Quetzalcoatl's acceptance test as incomplete for the same reason: *"**Not
demonstrable:** Xiuhcoatl's `[Fortress]` clause alone, because Ozymandias is unauthored."*

**Most of his kit is already expressible.** The three class skills resolve at his ranks against
existing parameterized documents; his three active skills have working templates; and inside
Ramesseum Tentyris, Divine Protection, Divine Curse (a–c) and God's Curse are all shapes Pale
Rider's Doomsday Come already uses. What is missing is a specific, enumerable list, and it is what
this design is about.

### 1.1 The chapters designed this and stopped short

Ch. 43 §43.8 already settles the hard part — NP tags form an ordered scale, and *"Two
[Anti-Fortress] or higher NPs in the same Round … or more than 3000 damage in one Round. Either
result: cannot be used again for the rest of the game"* is written out as a vulnerability. Ch. 44
§44.6 settles the Round-7 gate as `npGateRound` composing with the global gate by `max()`. Ch. 42
§42.5 prints Pyramid Drop's daylight clause as a worked authoring example, with his name on it.

The pure predicate exists (`rules/bounded-fields.mjs:682` `vulnerabilityTriggered`) and handles both
of his kinds. **It has one caller in production**, `engine/attack.mjs:1463` `closeFieldsPiercedBy`,
which only ever passes `kind: "npUsedOn"`. Nothing anywhere emits `npUsed` or `damage`, there is no
per-Round accumulator, and `result: "endPermanently"` appears nowhere outside the test file. This is
the project's dominant defect shape — a rule collected, correct, and inert — and Ozymandias is the
unit that makes it matter.

---

## 2. Four rulings

The sheet is ambiguous in four places. Settled by the author:

| # | Question | Ruling |
|---|---|---|
| R1 | His Riding lists two passives and mentions a third | **He has all three.** `class-riding` unchanged at `A+`; the omission is a transcription slip, and *"can be combined with Passenger Seat"* cannot refer to something he lacks. |
| R2 | The Complex *"cannot intersect the Home Base of enemy Players"* | **Clip it.** The field opens as the 11×11 minus any panel inside an enemy Home Base. Free, because `engine/fields.mjs:559 shapeOf` already emits a grid shape rather than a bounding rectangle. |
| R3 | *"if any Sphinxes are next to them"* | **Next to Ozymandias or his Master.** A Sphinx adjacent to either makes that unit untargetable — Bašmu's `TargetabilityModifier` at radius 1, narrowed from "all allies" to those two. |
| R4 | Pyramid Drop's *"Skill Cooldown is reduced by 1◈"* | **His Skills, not his Noble Phantasms.** Pharaoh, Imperial Privilege and Protection from Ra each drop 1◈; Mesektet and Ramesseum are untouched. The sheet uses "Skill" precisely elsewhere. |

---

## 3. Three architectural choices

### 3.1 The Curse that leaves when he does

> *"All Units are inflicted with permanent Stage 1 Curse as long as they are within the Complex. It
> is automatically removed after leaving the Complex."*

Three ways to say it, and the difference matters:

| Option | Why not |
|---|---|
| A standing interior rule that deals the damage | Loses *"is inflicted with Curse"*. Nothing reading the effect list — Dispel, `self:effect:curse` predicates, the sheet — would see it. Curse is a **staged periodic** (`packs/_source/effects/curse.yml`), and no interior rule element emits a periodic. |
| A new `exit` / `leave` interior event | Only fires for departures the movement hook observes. A unit teleported out, knocked back out, or standing still while the field **closes under it** keeps the Curse for ever. |
| **`sourceFieldId` on the effect instance, swept wherever membership is recomputed** | **Chosen.** |

**DECISION.** `EffectData` gains `sourceFieldId`. `annotateFields` already recomputes membership on
every board build; the sweep removes any instance whose `sourceFieldId` names a field the bearer is
no longer inside, or which no longer exists. Departure by any route is covered because the test is
*membership*, not *movement*.

This generalizes: Ch. 42 §42.4 names the same shape for Quetzalcoatl's Piedra Del Sol Burn
(`unremovableWhileInTerrain` / `lingering`, neither of which exists), so the field version is the
first of two.

### 3.2 An end that arrives two Turns late

> *"When Ozymandias' Master is defeated, Ramesseum Tentyris will be forcefully ended after 2◈ Turns,
> at the end of the Turn."*

`shouldClose` (`engine/fields.mjs:731`) is immediate-or-never, and no vulnerability carries a delay.
Ch. 43 §43.9 proposes a general `kind: schedule` phase; it is unbuilt and is a larger piece of work
than this clause needs.

**DECISION.** A vulnerability gains an optional `delay` (a ◈ expression). When one triggers, the
field records an **absolute expiry tick** in `field.state.forcedEnd` and `expireFields` — which
already runs at every Turn boundary — closes it when the tick arrives. This is the convention every
other duration in the system keeps, for the reason `data/regions.mjs` gives about `expiry`: *"a
countdown needs a hook that can fail to fire, and an expiry cannot."*

A new vulnerability kind `masterDefeat` sits beside the existing `ownerDefeat`.

### 3.3 A Normal Attack that changes inside the field

> *"Ramesseum Tentyris: Dendera Electric Bulb — Can be used by Ozymandias as his Normal Attack while
> within Ramesseum Tentyris."*

The only replacement mechanism in the system is `replacesRiderAction` — a **Platform** field
(`data/actor/simple.mjs:164`), read by `rules/platforms.mjs:262 actionSourceFor`, gated on nothing
but the platform's roles, and consumed by `rules/normal-attack.mjs:51` and three sites in
`engine/attack.mjs`.

**DECISION.** Generalize it. `actionSourceFor` gains a second source: an ability on the unit itself
carrying `replacesNormalAttack: { predicate }`. Quetzalcoatl's mount is the same shape minus the
condition, so this is one branch rather than a new path, and every consumer already reads through
that one function.

Rejected: `GrantedAbility` plus Pale Rider's `noNormalAttack`. That makes his Normal Attack
*disappear* rather than change, and Riding Attack — *"as its Normal Attack during its Turn"* — still
has to have something to fire.

---

## 4. Engine additions

Grouped by the file they land in. Everything here is either **inert today** (a rule collected and
never read) or **absent**.

### 4.1 Fields

| # | Addition | Why |
|---|---|---|
| F1 | Per-Round accumulator on `field.state`: `npsThisRound`, `damageThisRound`, reset at the Round boundary | `npCount` and `damageThreshold` are dead branches for want of a window |
| F2 | Emit `kind: "npUsed"` and `kind: "damage"` into `vulnerabilityTriggered` | Its only caller passes `npUsedOn`; nothing supplies the other two |
| F3 | `result: "endPermanently"` — set a lock-out **and enforce it** | Handled nowhere; `attack.mjs:1487` tests `=== "end"` and drops the rest. `expended` is written in two places and read only by `rules/reactions.mjs`, never by `canUseAbility` |
| F4 | `masterDefeat` vulnerability kind, and `delay` (§3.2) | Absent |
| F5 | `geometry.cannotIntersect: enemyHomeBase`, clipping (R2) | No placement vocabulary at all; `openField` refuses only an empty panel set |
| F6 | `revivals` in `annotateFields`'s merge list; `deferred` on the `RevivalSource` executor; a predicate test in `isAvailable`; fix `meetsRequirement`'s `fieldOpen` returning a truthy object | An interior `RevivalSource` is **silently discarded** today — the same class of defect `bounded-fields.mjs:823` describes for `checkModifiers` |
| F7 | `sourceFieldId` on `EffectData`, swept on membership loss (§3.1) | Absent |
| F8 | Sphinx stat persistence across deactivation | `endField:465` deletes the actors; `summonAssignments` remembers a *type*, not a statline |
| F9 | `onOpen` summon list on a field | `SummonBound` is per-contacting-enemy, not "spawn these three when it opens" |

### 4.2 Home base, ZON, Sustainability

| # | Addition | Why |
|---|---|---|
| H1 | Third branch in `ownBaseOf` reading `board.fields`, **unit-scoped** | Knows Regions and platforms only, both faction-scoped; his is *"for Ozymandias and his Master only"* |
| Z1 | A ZON exemption that suppresses only the **outgoing-damage penalty** | `zonExempt` is the blunt instrument — it also lifts `requiresZon` gates his NPs should still honour |
| Z2 | Resolve the `annotateZon` (`snapshot.mjs:619`) / `annotateFields` (`:663`) ordering | A field-derived exemption is computed 44 lines after the ZON status it must change |
| S1 | `sustainabilityFrozen` consulted in `checkRemovals` (`scheduler.mjs:1355`) | Decrements unconditionally; `SustainabilityGain` is the wrong shape (it would show as churn and misbehave the Turn he leaves) |

### 4.3 Skills, effects, attacks

| # | Addition | Why |
|---|---|---|
| D1 | A day/night roll option, computed from `phaseAt(panel, board)` so it is **per-panel** | There is no day/night option at all; two of Pharaoh's three clauses need one, and per-panel means Pyramid Drop's own daylight satisfies it |
| C1 | Ally-targeted cooldown reduction: lift `cooldown` out of `CASTER_PHASES` and write to resolved targets | `cooldownChanges` is hardcoded to `I.cooldown(doc.id, …)`; the phase never fans out |
| B1 | `buffChUp` effect, and let a **buff's** chance be modified | No document; `effect-applier.mjs:636` refuses non-debuffs, and a friendly application zeroes every modifier |
| N1 | `element` on a normal attack | Every element is sourced from an ability; the pipeline bails without one, so Mesektet's *"Light damage"* passive has nowhere to live |
| N2 | `replacesNormalAttack` (§3.3) | Absent |

### 4.4 The two latent defects

Both are summon-budget, both surfaced by the Sphinxes, and both are fixed here.

- **`countsTowardBudget` is read by nobody.** Declared (`simple.mjs:26`), authored on Bašmu, stamped
  by `engine/summoning.mjs:201` — and `rules/budget.mjs` never consults it. Every summon in the game
  has been spending its controller's Unit budget since summons shipped, which is the opposite of
  what Bašmu's own sheet says.
- **`actsOncePerTurn` is never projected onto a snapshot.** `budget.mjs:203` tests it on the *board*
  unit, and `rules/snapshot.mjs` does not carry it — so the test reads `undefined` for every summon
  in every world, and the once-per-Turn limit has never applied.

---

## 5. Content

| File | Notes |
|---|---|
| `packs/_source/servants/ozymandias.yml` | `STR C / END C / AGI B / MAG A / LUC A+`, Base Health 1000, MOV 6, Range 3, BA 100/200, Sustainability 2◈, `region: [egypt]`, attributes `[male, servant, sky, king, humanoid]` |
| `ozymandias-pharaoh-of-the-hot-sands.yml` | `categorizedAs: [charisma]`; three clauses, two gated on `self:phase:day` |
| `ozymandias-imperial-privilege.yml` | `percentOfMax: 30` heal + two `chance: 60` buffs |
| `ozymandias-protection-from-ra.yml` | ally NP-cooldown −⅔◈ + `buffChUp` |
| `ozymandias-mesektet.yml` | passive: normal-attack source, `component: mag`, `element: light`, ×2 vs `Dark`. Active: 3×3, `4× + 100`, doubled vs `Dark` |
| `ozymandias-ramesseum-tentyris.yml` | the Complex — six clauses, four termination paths, `npGateRound` for Round 7, 50%-of-max Master Health cost |
| `ozymandias-dendera-electric-bulb.yml` | `replacesNormalAttack` while inside; two shapes via `choose`; 10 Master Health per use; `bypassModifiers` on his own Atk Up |
| `ozymandias-pyramid-drop.yml` | once per game; 5×5, 5×; NP Seal 3◈; Def Dwn 3◈ +50%; `zone` terrain `sunlight` 2◈; Skills −1◈ (R4) |
| `packs/_source/summons/sphinx*.yml` × 3 | Luck inherited from the summoner; guard scoped to Ozymandias and his Master (R3) |
| `packs/_source/effects/buff-ch-up.yml` | new |

**`egypt` is not in the region graph.** `REGION_ADJACENCY` (`rules/environment.mjs:385`) is a
curated, deliberately symmetric list of thirteen entries and his Region is not among them — so
`region: [egypt]` would match no war, and §19.3's parameter grant would silently never fire for him.
The entry is added with its neighbours (`middleEast`, `mesopotamia`, `greece`) and **those three gain
`egypt` in return**, because `test/unit/environment-rest.test.mjs:59` enforces symmetry — for the
reason that file gives: a one-way edge makes Semiramis's Construction counter depend on argument
order.

His `king` attribute needs nothing: attributes are an open tag set with an implication table
(`domain/attributes.mjs`), and Quetzalcoatl already authors `king`.

`class-riding` at `A+`, `class-magic-resistance` at `B` and `divinity` at `B` are referenced
unchanged (R1).

---

## 6. Testing

**Pure units** for each new rule: the round accumulator and both vulnerability kinds; `endPermanently`
and its enforcement; the delayed forced end; the clip; the field-conditioned revival; the effect
sweep on membership loss; unit-scoped home base; the ZON penalty exemption; frozen Sustainability;
the day option; ally cooldown reduction; buff-chance modification; and the two budget defects.

**Live in `fgt2026`**, which is the gate:

1. Activate the Complex adjacent to an enemy Home Base — it **clips**, and the Master pays 50%.
2. A Normal Human inside dies at the end of the Turn **after** entering, not on contact.
3. An enemy Servant inside cannot use its Noble Phantasm; a Divinity-B unit can; something merely
   `categorizedAsNP` is unaffected.
4. Ozymandias is defeated inside and revives at 20%; a Sphinx revives at 10%.
5. Two `[Anti-Fortress]` NPs in one Round end it **permanently** — and it cannot be recast.
6. Deactivate and reactivate: the Sphinxes return on the **same Health**.
7. His Master is defeated: it ends 2◈ later, at the end of the Turn.
8. Pyramid Drop turns its blast area Day for 2◈ — and **Xiuhcoatl's `[Fortress]` clause fires
   against the Complex**, which has never had a live referent.

---

## 7. What this does not do

- **`kind: schedule`** (Ch. 43 §43.9) stays unbuilt. §3.2 solves his clause with an absolute expiry;
  the general scheduled-detonation phase is still owed to Blood Fort Andromeda.
- **`minRank` stays literal.** God's Curse's *"Divinity equal to Ozymandias or higher"* is authored
  as `B` because that is his rank. A live comparison against his own current rank would need a new
  predicate form, and nothing in the corpus can change a Servant's Divinity rank.
- **NP Seal's `categorizedAsNP` behaviour is left alone.** His clause is right today *by accident*:
  `abilityKind` returns `"np"` only for a real Noble Phantasm, so a `categorizedAsNP` ability is
  never checked against the seal — while `data/item/ability.mjs:263` says that flag is *"the
  mechanical dividing line for NP Seal"*, meaning ordinary NP Seal is supposed to catch them and does
  not. Fixing that is a separate change to a shipped rule; when it happens, Ozymandias needs an
  explicit opt-out, and this spec records the dependency rather than pre-empting it.
