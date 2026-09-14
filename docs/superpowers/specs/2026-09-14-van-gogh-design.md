# Van Gogh — design

**Date:** 2026-09-14
**Source:** `char_orig_sheets/Copia de Van Gogh.md`
**Chapters affected:** [11 — Effect Engine](../../11-effect-engine.md), [13 — Damage Pipeline](../../13-damage-pipeline.md),
[15 — Abilities](../../15-abilities.md), [17 — Command Spells](../../17-command-spells.md),
[35 — Case Study: Van Gogh](../../35-case-van-gogh.md), [45 — Implementation Status](../../45-implementation-status.md),
[A — Effect Catalogue](../../A-effect-catalogue.md), [D — Servant Data Sheets](../../D-servant-data-sheets.md),
[E — Event Reference](../../E-event-reference.md)

---

## 1. The problem

Ch. 35 is a whole chapter about her, and it ends by calling her *"the most mechanically inventive
Servant in the set — she uses the effect system in a direction it was not obviously designed
for."* That is accurate, and it is the reason she is worth building carefully: **her own debuff is
her fuel.**

The loop is the Servant:

```
Imaginary Numbers Arts   self-Curse x3        -> Curse stages up
Channel Marker Soul      -1 Turn per stage    -> NP cooldown falls
Imaginary Numbers Arts   -(1/3<> x stage)     -> NP cooldown falls again
De Sterrennacht / Yellow House                -> fires early
Het Gele Huis            Curse the ALLIES     -> more stages on the board
Shadow of Longing        pull every Curse     -> onto herself, cooldown falls again
Sunflower's Curse        Health floors at 1   -> the loop cannot kill her
```

§35.11 tallies eleven mechanisms as needing new support. Checked against the code, **five of them
already have readers waiting for a writer**, one was deliberately rejected in favour of an
existing mechanism, and four are genuinely new. That ratio is the story of this Servant: the
chapter designed her before the engine existed, and the engine grew past the chapter.

### 1.1 What already exists

| §35.11 says | Reality |
|---|---|
| `applications: N` | built |
| `blockedBy` symmetry | built |
| `normalAttack.component` override | built |
| Stage-stacking | built — `stacking: stage`, `resolveStacking`, `mergeStages` |
| `Immunity` with `scope: commandSpell` | **a reader already refuses on it.** `cs-kill-yourself.yml` carries `{kind: targetNotImmune, attribute: immuneToKillYourself}` and its comment names *Van Gogh's Sunflower's Curse* as the only stated immunity. `rules/command-spells.mjs:276` defaults the attribute name. Checked at **offer** time, so the option never appears. |
| Mad Enhancement negation | `excludeModifierSources: [Mad Enhancement]`, Raikou's *Dōhatsu Tenshō* precedent |
| Non-stacking aura resolved by rank | `rules/auras.mjs` resolves `highestOnly`, makes it the default, and quotes Item Construction's clause in its own comment |
| `@count(targets where …)` | **deliberately rejected.** `semiramis-familiar-doves.yml` says so in as many words: *"the ordinary predicate grammar rather than a new `@count(...)` expression"*. `countMatching` is the mechanism, and De Sterrennacht's ally count is its shape. |

**And she closes an outstanding warning.** `class-skills/alter-ego.yml` carries
`forwardReferences: [existenceOutsideTheDomain]` and predicates on
`target:skill:existenceOutsideTheDomain`; `validate:content` has reported *"declared, inert"*
since Alter Ego shipped. Van Gogh is the document that was missing.

### 1.2 What is genuinely new

Four mechanisms, each paired below with the clause that consumes it and the reader that makes it
observable.

---

## 2. Rulings

**R1 — Any Curse, from any source, feeds Channel Marker Soul.** *"Whenever Gogh is inflicted with
Curse… reduce her NP Cooldown by 1 Turn for every Stage."* The sentence names no source, and her
own kit is the largest source there is: Imaginary Numbers Arts self-curses three times and Shadow
of Longing drags every Curse within 3 panels onto her. So Imaginary Numbers Arts pays **twice** —
once through Channel Marker Soul's per-stage clause and once through its own `⅓◈ × stage` clause —
and that double payment is the engine rather than a bug in it. *(User ruling, 2026-09-14.)*

**R2 — The removal half is gated to the `gogh` buff, the infliction half is not.** The sheet is
asymmetric on purpose: *"inflicted with Curse **or has Curse removed from herself to the effects
of the 'Gogh' buff**"*. A Cure that strips her Curse pays nothing.

**R3 — Shadow of Longing's transfer takes from enemies too.** *"Remove all Curse debuffs from
**all** Units within a 3 panel area"* — the sheet bolds **all**. It is a real trade: she cleanses
her opponents to fuel herself.

**R4 — Her Normal Attacks use BA(MAG).** Her sheet states it outright in a Note, which is unusual
enough that the note exists at all. `normalAttack: {mode: fixed, component: mag}` — 200, against
a STR of 50.

**R5 — Divinity B+ is one `ref:` line.** `lookup("divinity", B+)` is **45**, which is the number
her sheet prints. Nothing is authored.

**R6 — The mirrored pair blocks but does not trigger.** Each of *Het Gele Huis* and *The Yellow
House* says only *"Cannot be used if [the other] is on Cooldown"*. Scáthach's *Gate of Skye* is
the contrasting shape — it is blocked by three abilities **and** puts two of them on cooldown —
so the absence here is meaningful. Mutual `blockedBy`, no `alsoTriggers`.

**R7 — `X0%` means `X × 10%`.** De Sterrennacht effect 3: *"damage dealt is increased by X0%…
X=(3+the number of affected allied Units with the EOTD Skill excluding herself)"*. With no other
EOTD ally, X=3 and the buff is 30%, halved to 15% for NP damage.

**R8 — Chances above 100% are not clamped during accumulation.** *"150% chance"* and *"500%
chance"* are the sheet's way of saying "lands through resistance". §35.3 designs this: the excess
survives a `Debuff ResUp`, and only the final figure is clamped. Her own Item Construction reduces
incoming debuff chance by 35%, so a 500% self-Curse still lands at 100%.

**R9 — Sunflower's Curse floors her at 1 against Curse only.** *"Gogh's Health cannot drop below
1 due to the effects of Curse"* — not against damage generally. A source-scoped floor, not
`Guts` and not invulnerability.

**R10 — Item Construction does not stack, and rank decides — and this is free.** *"If a Unit is
affected by multiple instances of this Skill, only the Item Construction with the highest Rank
takes effect."* `rules/auras.mjs` already resolves `highestOnly`, already makes it the **default**,
and its own comment at line 254 quotes this very clause: *"Only the Item Construction with the
highest…"*. A fifth reader waiting for a writer — authoring the aura is the whole of it.

---

## 3. The four new mechanisms

Each lands with its reader and a test in the same task. The standing risk this project names as
its dominant defect is a rule that is right and inert.

### 3.1 `curseStageChanged` — the event the loop runs on

`engine/effect-applier.mjs#resolveStacking`'s `stage` branch is the **one place** a stage is
decided: `stage = (current?.stage ?? 0) + Math.max(1, stages)`. The event is raised from its
caller, where both the old and the new stage are in hand:

```js
curseStageChanged { unitId, defId, stageDelta, newStage, cause }
```

and the removal path raises the mirror with a negative `stageDelta`.

**One place, not four.** `engine/applier.mjs#noteDebuffs` makes this argument two lines from where
the code will go: *"a hook fired from each of the four application paths would have been four
chances to miss one."* Stage changes converge here; so does the event.

Channel Marker Soul is then an ordinary handler, with no Servant-specific code anywhere in the
write path:

```yaml
- key: OnEvent
  event: curseStageChanged
  automatic: true
  then:
    - { key: CooldownDelta, scope: np, delta: "-@stageDelta" }
```

`@stageDelta` is the event payload reaching an action's magnitude — the same shape `@magnitude`
already has. Appendix E gains the event.

### 3.2 `transferEffects` — Shadow of Longing's pull

> *"Remove all Curse debuffs from **all** Units within a 3 panel area of Gogh, then apply them to
> herself (apply all stages of Curse accordingly, if any affected Unit has more than one stage)."*

A new phase kind, composed of intents that already exist:

```yaml
- kind: transferEffects
  defId: curse
  from: { anchor: self, shape: { kind: chebyshevRadius, r: 3 }, relations: [ally, enemy, self] }
  to: self
  stageMode: sum
```

It emits one `removeEffect` per source instance and **one** `applyEffect` carrying the summed
stages, so §3.1's event fires once per victim on the way out and once on her on the way in — which
is exactly what R1 asks to be paid for.

`stageMode: sum` is stated rather than assumed, because the alternative reading ("the highest
stage moves") is a real one and the sheet's parenthesis settles it the other way.

### 3.3 `floorAtSource` — a Health floor scoped to one damage source

> *"Gogh's Health cannot drop below 1 due to the effects of Curse."*

Stage 16 already clamps. This is a second clamp with a predicate on the damage packet's source:

```yaml
- key: DamageFloor
  floor: 1
  when: [{ source: curse }]
```

Curse damage already carries what the predicate needs: `scheduler.mjs`'s periodic pass emits
`I.damage(..., { periodic: true, defId: e.defId, bypassModifiers: true })`, so the packet names
`curse` itself. **Not `Guts`** — Guts revives after defeat; this refuses the defeat. And not
invulnerability: every other source still kills her normally, which is the whole point of a
Servant who cheerfully runs herself to Stage 9.

### 3.4 The `gogh` buff's conditional rider

> *"Whenever Gogh performs a successful Attack, remove one stage of Curse from Gogh and apply Atk
> Up to herself for 1◈ Turns **if a stage of Curse was removed**. If the Attack was a Crit, remove
> 2 stages and apply the Atk Up buff twice."*

The `if` is load-bearing: at Stage 0 the attack removes nothing and grants nothing, so the buff
must read the *result* of its own removal rather than assume it. An `OnEvent: damageDealt` handler
whose second action is gated on the first having fired — the same information §3.1's event already
carries, so the rider listens to `curseStageChanged` on herself rather than guessing.

Doubling on a Crit is `attack:crit` in the option set, which `damageDealt` already emits.

---

## 4. The eleven entries

| Sheet entry | File | Notes |
|---|---|---|
| Existence Outside The Domain A | `class-skills/existence-outside-the-domain.yml` | Five passives. Closes `alter-ego.yml`'s forward reference. Passive 5 is `excludeModifierSources: [Mad Enhancement]`, both directions. |
| Item Construction B− | `class-skills/item-construction-gogh.yml` | An aura at radius 2, both debuff-chance directions, **non-stacking by rank** (R10). A third ability of this name. |
| Divinity B+ | — | `{ref: divinity, rank: "B+"}`. Table gives 45 (R5). |
| Insanity C | `abilities/gogh-insanity.yml` | One `DamageModifier`, +6% including NP. |
| Sunflower's Curse A | `abilities/gogh-sunflowers-curse.yml` | Passive 1 grants `immuneToKillYourself` (§1.1). Passive 2 is §3.3. |
| Imaginary Numbers Arts B+ | `abilities/gogh-imaginary-numbers-arts.yml` | Guts; self-Curse ×3 at 500%; `CooldownDelta` of `⅓◈ × stage` measured **after** the self-curses, per sheet order. |
| Het Gele Huis A+ | `abilities/gogh-het-gele-huis.yml` | 5×5 `selfEdgeAdjacent`; enemy Def Dwn ×2; ally Evade/Regen/Curse. `blockedBy` the NP (R6). |
| Channel Marker Soul EX | `abilities/gogh-channel-marker-soul.yml` | Curse damage halved; §3.1's handler (R1, R2). |
| Shadow of Longing EX | `abilities/gogh-shadow-of-longing.yml` | Ally Atk Up + Crit Up; the `gogh` buff; §3.2's transfer (R3). |
| De Sterrennacht EX (NP) | `abilities/gogh-de-sterrennacht.yml` | Non-damaging. Terror 60%; ally Crit DmUp ×2 (the second EOTD-only); `countMatching` ally scaling (R7); Area CritUp on herself. |
| Het Gele Huis: The Yellow House A+ (NP) | `abilities/gogh-the-yellow-house.yml` | Non-damaging. The 7×7 twin at 2◈ (R6). |

**New effects:** `terror` (Appendix A **§A.11** defines it and no file exists: X% chance of `Stun 1◈`
at end of turn, then removed, and **the chance is not modified by debuff chance or resist**),
`areaCritUp` (an `Aura` carried as a buff), and `gogh` (§3.4).

**Statline.** `STR E / END B / AGI C / MAG A / LUC D`, Health 1250, MOV 5, Range 3/1, BA 50 STR
and 200 MAG, Sustainability 2◈, Chaotic Neutral, `[female, servant, man, humanoid,
threatToHumanity, child]`. `attributes` is an open tag set by design (§4.5), so the last two need
no schema change.

---

## 5. Testing

`test/unit/van-gogh.test.mjs`, one `describe` per clause. The ones that earn their own case:

- Divinity B+ reads 45 from the table with nothing authored (R5).
- A 500% Curse still lands at 100% through her own −35% Item Construction (R8).
- Imaginary Numbers Arts from Stage 0 reduces the NP cooldown by **1◈ and 3 Turns** — both
  clauses, which is R1's whole content.
- A Cure stripping her Curse pays **nothing** (R2's negative half).
- The transfer takes stages off an **enemy** as well as an ally (R3), and sums them.
- Curse damage takes her to exactly 1 and stops; a Normal Attack at 1 Health kills her (R9).
- The `gogh` buff grants no Atk Up at Stage 0, one at Stage 1, and **two** on a Crit (§3.4).
- Each of the mirrored pair refuses while the other is on cooldown, and neither puts the other
  there (R6).
- Two Item Constructions on one ally apply the higher rank **once** (R10).

**Then the live pass**, which is what she is judged on: the loop end to end on a real board, read
off the interface rather than the console.

---

## 6. Sequencing

Each task pairs one engine addition with the clause that consumes it.

1. The Servant, the statline, and Divinity B+ for free
2. Existence Outside The Domain — five passives, and Alter Ego's forward reference closed
3. Item Construction — the non-stacking aura, which `highestOnly` already resolves (R10)
4. Insanity and Sunflower's Curse passive 1 — the Command Spell reader that already exists
5. `curseStageChanged` + Channel Marker Soul (§3.1, R1, R2)
6. Imaginary Numbers Arts — and the double payment measured
7. `floorAtSource` + Sunflower's Curse passive 2 (§3.3, R9)
8. `terror` + De Sterrennacht (R7)
9. Het Gele Huis and The Yellow House — the mirrored pair (R6)
10. `transferEffects` + Shadow of Longing (§3.2, R3)
11. The `gogh` buff's conditional rider (§3.4)
12. The live pass
13. Documentation

---

## 7. Risks

**The double payment is intended, and looks like a bug.** R1 makes Imaginary Numbers Arts pay
twice from one use. Anyone reading the cooldown drop without the ruling in hand will read it as
double-counting; the test names it and §35 will say so.

**Chance above 100% is the opposite of clamping, and clamping is the instinct.** R8's whole point
is that a 500% chance is not "100%" — it is a number that survives subtraction. Clamping during
accumulation silently deletes the clause.

**A floor is not Guts and not Invuln.** Three mechanisms that all mean "does not die", with
different scopes and different orders. §3.3's is the narrowest: one source, no revival, everything
else still lethal.

**Van Gogh has two abilities named `Het Gele Huis`.** One is a Skill, one is a Noble Phantasm, they
differ in area and duration, and they block each other. Cross-referencing the wrong one in either
`blockedBy` makes an ability that can never be used, or one that can always be used, and both look
plausible from the sheet.

**Curse is a debuff she wants.** Every instinct the rest of the corpus has built — resist it,
cleanse it, floor it — is wrong for her. Her Item Construction reducing her own incoming debuff
chance by 35% is a real tension the sheet creates and R8 resolves.
