# The Dioscuri — design

**Date:** 2026-09-16
**Source:** `char_orig_sheets/Copia de Dioscuri.md`
**Chapters affected:** [08 — Board and Geometry](../../08-board-and-geometry.md),
[12 — Combat Process](../../12-combat-process.md), [13 — Damage Pipeline](../../13-damage-pipeline.md),
[15 — Abilities](../../15-abilities.md), [16 — Relationships](../../16-relationships.md),
[18 — Action Economy](../../18-action-economy.md), [34 — Case Study: the Dioscuri](../../34-case-dioscuri.md),
[45 — Implementation Status](../../45-implementation-status.md), [A — Effect Catalogue](../../A-effect-catalogue.md),
[B — Rank Tables](../../B-rank-tables.md), [D — Servant Data Sheets](../../D-servant-data-sheets.md),
[E — Event Reference](../../E-event-reference.md)

---

## 1. The problem

Castor and Pollux are one Servant occupying two tokens, and Ch. 34 opens by naming the cost:
*"They break the assumption that a unit is a unit — every subsystem that counts units, checks
distance, applies cooldowns, or resolves death has to handle a pair."*

That assumption is load-bearing in nine places. The budget counts units. The movement search asks
where one unit may stop. The cooldown writer names one actor. The damage pipeline reads one unit's
modifier bag. Defeat resolves one revival chain. The multi-Servant tax counts how many Servants
Acted. Targeting selects by distance from one caster. ZON measures one Servant against one Master.
Summoning creates one actor.

The Dioscuri are the acceptance test for `LinkedUnitGroup`, which
[Ch. 16 §16.8](../../16-relationships.md) specifies as decision **D16.7** — *"a general mechanism,
not a Dioscuri special case"* — and which is implemented **nowhere**. `grep -ri linkedgroup
module/` returns nothing.

---

## 2. What already exists

Ch. 34 §34.11 tallies ten mechanisms as needing new support. Checked against the code, **two of its
ten are built outright and a third is half built** — and a fourth mechanism the chapter never
tallied at all is built too. Three of the four carry comments that name the Dioscuri while doing it.
The chapter was written before the engine existed; the engine grew toward it.

| Mechanism | Reality |
|---|---|
| §34.11: `zonSatisfaction: any` | **Built.** `rules/zon.mjs:147` reads `zonPartnerIds`, and its comment quotes *"as long as the other counterpart is within their Master's ZON"* verbatim. `data/actor/servant.mjs:112` names the Dioscuri in the field's own docstring. |
| §34.11: cooldown deltas in literal turns vs ◈ | **Built, differently.** The chapter proposed `unit: turns` on the delta. `engine/scheduler.mjs:786` already splits the two by *field*: `ticks` is a ◈ expression resolved against the world's turns per Round, `delta` is a raw turn count. `unit:` would be a third spelling of a settled distinction. |
| §34.11: `modifierSources` on a damage phase | **Half built.** `rules/damage/pipeline.mjs:260` has resolved `ctx.units[src.unit]` since the pipeline was written. `mountUnits` is its only supplier and it only ever returns `{mount}`. |
| *(not tallied)* adjacency gate on the joint NP | **Built.** `rules/items.mjs:342`'s `counterpartAdjacent` requirement kind exists, is registered in `rules/authoring/requirements.mjs:102`, and its comment reads *"The Dioscuri's Noble Phantasm needs the other twin beside it."* |

Three more clauses are free for reasons the chapter could not have known:

- **Mad Enhancement B− is exact.** `domain/tables.mjs` gives `madEnhancementDefence` B− = `[35, 15]`,
  `madEnhancementOffence` B− = 55 and `madEnhancementDrain` B = 20 — the three numbers Castor's
  sheet prints. The defence table's own comment cites **"B− 35→15 (Castor)"** as one of the seven
  sheets it was verified against.
- **Twin God's Divine Core B is one `table:` line.** `divineCore` B = 80, and the table's docstring
  names *"`Goddess's Divine Core` / `Twin God's Divine Core`"* as its two customers.
- **"Light damage (half)" is modelled.** `pipeline.mjs:459`'s stage 4b comment lists *"Karna,
  Dioscuri, Raikou and Quetzalcoatl"* as the abilities whose element carries half the total.

So the shape of this work is not "build ten mechanisms". It is: build **eight** of Ch. 34's ten, plus
**six** the chapter never anticipated — Blind and its Miss step, the partner predicate, the partner
aura, `alsoCountsAsAttackFor`, `summonTogether`, and the predicated table scale R5 needs — and author
a Servant whose hardest clauses were half-prepared for by whoever wrote the comments above.

---

## 3. Rulings

Twelve readings the sheet leaves open, resolved. **R1, R2 and R5 are user rulings taken on
2026-09-16**; the rest are derived from the sources named.

**R1 — Pollux's Base Attack (STR) is 150, not the 200 her sheet prints.** Her STR is Rank A, and the
game's author makes the rank table authoritative: *"If you find a value of Base attack that differs
from this calculation choose the value of this table instead of what is on the character sheet"*
(Ch. 41 Q50, quoted in `domain/base-attack.mjs`). Three authored Servants already take this
correction — Kiritsugu 65→75, Semiramis 45→50, Serenity 65/100→75/150 — and `baseAttackFor` derives
unconditionally whenever a parameter exists, so honouring 200 would need a new override mechanism
and would reopen all three.

The cascade is recorded rather than hidden: her **Mana Burst is BA=300**, not the 350 her sheet
computes, and the **joint NP is BA=150**, not 175. Both parentheses are stale arithmetic from the
same source error, and `validate:content` warns on the deviation the way it warns on the other
three. *(User ruling.)*

**R2 — "each one counts as 0.5 Units" scopes to every rule that counts Units.** The sentence
qualifies nothing, so neither do we. Three consequences beyond the turn budget:

- the **multi-Servant tax** (§16.7). `rules/relationships.mjs:226` reads `acted <= 1` over a count of
  actors; it becomes a sum of weights. Both twins Acting is 1.0, so a Master whose only Servant is
  the Dioscuri pays nothing — and a Master with the Dioscuri *and* another Servant pays the flat 25.
- `mayOrderAnotherServant`, the prohibition half of the same rule, on the same sum.
- the **roster count** in war setup. The pair is one Servant against a faction's allowance.

*(User ruling.)*

**R3 — Shared cooldown matches by ability name, within the group.** *"When either Castor or Pollux
uses a Skill, the Skill enters Cooldown for both of them."* Castor's Mana Burst puts Pollux's on
cooldown; his Mad Enhancement, which she does not carry, puts nothing on hers. Ch. 34 §34.6's
`matchBy: name`.

**R4 — Self-Replenishment fires once on a turn that is both Castor's own and one he Acted in.** *"At
the end of Castor's Turn and at the end of any Turn he Acts"* is two triggers, and
`docs/E-event-reference.md` §E.2 already guarantees the deduplication: *"when both `unitTurnEnd` and
`actedTurnEnd` would fire for the same unit on the same turn, each effect fires once, keyed by
`(effectId, globalTurn)`."* Ch. 34's two-event handler is correct as written, and needs no gate.

**R5 — Mad Enhancement's adjacency clause halves `madEnhancementDrain` wholesale.** *"If Castor is
directly next to Pollux while Mad Enhancement is Active, his Master's Health lost from the effects
of active Mad Enhancement are halved."*

The drain figure is **one number read three times** — the amount drained, the *"cannot drop below
this in this way"* floor, and the forcible-deactivation threshold — and `mad-enhancement.yml`
records that unification as the repair for a real defect, where the floor was hardcoded to EX's 30
and clamped against a number no Servant's sheet mentioned. Halving only the drain would split the
three apart again.

So adjacency halves the lookup itself: Castor's Mad Enhancement reads **10** everywhere it read 20.
A Master on 25 drains to 20 and keeps running; a Master on 12 drains to 10 and Mad Enhancement
forcibly deactivates. One number, still said three times. *(User ruling.)*

**R6 — The joint NP's combined modifiers double-count.** *"The effects of all Skills, buffs and
debuffs on both Castor and Pollux are combined."* A `Guardians of Navigation` cast that buffed both
twins gives the NP +30%, not +15%. Ch. 41 **Q12**, answered by the game's author: *"yes, they
double-count."* Deduplicating would need identity tracking across instances, and it is what makes a
6◈ cooldown worth paying.

**R7 — "(and Pollux if she is out of the Skill's Range)" always includes the partner.** Never
excluded for standing too far, never counted twice for standing near. It appears four times across
the two twins — in both copies of *Stars of the Chief God* and both of *Guardians of Navigation* —
which is what earns it a name rather than four hand-written target lists.

**R8 — A Blind Miss ends the Combat Process at step 1.5.** No reaction, no Luck ladder, no damage,
no Injury Roll, no Counter: the attack did not happen. The attack budget is still spent, because the
swing was declared.

**R9 — Pollux's Riding gates all three passives on the Active.** Her Active reads *"Additionally,
'Double Move', 'Riding Attack', and 'Passenger Seat' can be used on this Turn"* — three.
`riding-medusa.yml` exists as a separate document precisely because Medusa's names only two and
leaves Double Move permanent, and its comment says so. Pollux is a **fourth** variant, alongside
`class-riding`, `riding-medusa` and `riding-achilles`.

**R10 — The two Twin God's Divine Cores are different abilities.** Same name, same rank, same +80.
Castor's Passive 2 is *"a 5% chance of reducing his NP Cooldown by 1 Turn"* on a successful Normal
Attack; Pollux's is *"Crit Chance is increased by 5%"*. Two files — and the shared **name** is what
would put them on a shared cooldown, which is inert here since neither has one.

**R11 — Either twin may fire the joint NP.** It is one ability on one shared clock. *"Counts as both
Castor and Pollux's Attack for the Turn"* marks both as having attacked and spends 0.5 + 0.5 = one
full Servant attack from the faction's two.

**R12 — Forced movement may break the leash.** Ch. 34 §34.3's own DECISION, recorded in Ch. 41:
dragging the partner along on a knockback produces a knockback that pulls a unit *toward* its
attacker. While broken, neither twin may take a voluntary action other than movement that reduces
the distance; the ZON "either counts" clause still applies; and the joint NP is unusable, which its
adjacency requirement enforces anyway.

---

## 4. The clause inventory

Every phrase on the sheet, as a numbered goal. **85 clauses.**

- **FREE** — the engine already does it; authoring is the whole of it. *(39)*
- **CONTENT** — new YAML, no code. *(28)*
- **ENGINE** — new code, named in §5. *(18)*

A clause marked CONTENT may still *depend* on an engine change shared with another clause — C26
needs E8, which C29 is what pays for. It is counted where its own work lands.

### 4.1 The binding — 8

| # | Clause | Verdict |
|---|---|---|
| D1 | *"summoned as two separate Servants as one"* | ENGINE — E14 `summonTogether` |
| D2 | *"have their individual stats"* | FREE — two actors |
| D3 | *"the maximum distance between the two is 2 panels"* | ENGINE — E2 leash |
| D4 | *"If either one is defeated, the other one is also defeated regardless of remaining Health"* | ENGINE — E3 linked death |
| D5 | *"both are respectively allowed to Move and Attack once during their Turn"* | FREE — per-unit limits |
| D6 | *"each one counts as 0.5 Units"* | ENGINE — E4 fractional budget (R2) |
| D7 | *"as long as the other counterpart is within their Master's ZON, damage dealt is not reduced"* | **FREE** — `zon.mjs:147` |
| D8 | *"When either uses a Skill, the Skill enters Cooldown for both"* | ENGINE — E5 shared cooldown (R3) |

### 4.2 Castor — 41

| # | Clause | Verdict |
|---|---|---|
| C1 | True Name Castor; Region Greece; Chaotic Neutral | FREE |
| C2 | STR A, END A++, AGI B, MAG C, LUC C | FREE |
| C3 | Attributes: Male, Servant, `[Sky]`, Humanoid | FREE |
| C4 | Health 1500, MOV 6, Range 3/1 target, BA 150/150, Sustainability 2◈ | FREE — END A++ → 1500 stated, as `asterios.yml` states his |
| C5 | *"Castor is an Avenger-class Servant"* | FREE — `classContainer: avenger`, already in `domain/enums.mjs` |
| C6 | Avenger B: *"All damage taken by Castor is increased by 80 including NP"* | CONTENT + new `avenger` table |
| C7 | *"If Castor Counters after receiving an Attack, increase the damage dealt when Countering by 80"* | CONTENT — `avengerCounter` is already in `pipeline.mjs`'s `FLAT_ATTACK_KEYS` |
| C8 | Oblivion Correction C: *"Crit Chance is increased by 15%"* | CONTENT + new table |
| C9 | Self-Replenishment D: *"his Health is restored by 40"* | CONTENT + new table (R4) |
| C10 | *"and NP Cooldown is reduced by 2 Turns"* | CONTENT — `delta: -2` is literal turns already |
| C11 | Mad Enhancement B−: *"(Active) Used during your Turn"* | FREE |
| C12 | *"can only be deactivated 2◈ after it was activated and vice versa"* | FREE — `toggleLock` |
| C13 | Clause 1 — Master loses 20 at acted-turn end; ≤20 forcibly deactivates | FREE — `madEnhancementDrain` B = 20 |
| C14 | Clause 2 — damage taken −35%, NP −15% | FREE — `madEnhancementDefence` B− = `[35, 15]` |
| C15 | Clause 3 — damage dealt +55%, halved for BA(MAG) | FREE — `madEnhancementOffence` B− = 55 |
| C16 | Clause 4 — MOV +2, Range +1, Master's ZON +2 | FREE |
| C17 | Clause 5 — Sustainability −2◈ if the Master is defeated while Active | FREE — `onMasterDefeated` |
| C18 | Clause 6 — *"can only Evade with Evade−"* | FREE — `TableOverride` |
| C19 | Clause 7 — neither buff nor debuff, unremovable | FREE |
| C20 | Cooldown 2◈ | FREE |
| C21 | *"If Castor is directly next to Pollux… his Master's Health lost… are halved"* | ENGINE — E12 predicate + E15 drain scale (R5) |
| C22 | Twin God's Divine Core B: *"All damage dealt is increased by 80 including NP"* | CONTENT — `table: divineCore` |
| C23 | *"5% chance of reducing his NP Cooldown by 1 Turn at the end of the Damage Step"* | CONTENT (R10) |
| C24 | *"This Skill counts as 'Divinity'"* | CONTENT — `kingprotea-divine-core.yml` is the precedent |
| C25 | Stars of the Chief God A: applies both buffs to himself and Pollux for 1◈ | CONTENT |
| C26 | 'Pollux' buff — non-crit Normal Attack ⇒ S.Crit Up ⅓◈ (+10% crit) to allies within 2 (and the partner) | CONTENT + ENGINE E8 (R7) |
| C27 | 'Castor' buff — crit Normal Attack ⇒ the Unit's NP Cooldown −1 Turn | CONTENT |
| C28 | Cooldown 4◈ | FREE |
| C29 | Guardians of Navigation B: allied Units within 2 panels (and the partner) | ENGINE E8 (R7) |
| C30 | NP DmUp ⅓◈, NP damage +15% | CONTENT |
| C31 | Atk Up ⅓◈, damage +15%; if NP, 5% | CONTENT |
| C32 | Debuff Immune 1◈, 1 time; does not affect Instakill, Death, Erase | CONTENT — `applications` exists |
| C33 | Cooldown 3◈ | FREE |
| C34 | Mana Burst A+: *"used when performing a Normal Attack"* | CONTENT — `isAttackSkill` |
| C35 | *"either restore 2 Agility and 2 Luck to Castor; or 1 and 1 to both"* | ENGINE — E9 `kind: choice` |
| C36 | *"the Base Attack used is Castor's BA(STR) and BA(MAG) combined (BA=300)"* | CONTENT — two `sources` |
| C37 | *"Not affected by Magic Resistance"* | FREE — `ignoresMagicResistance` |
| C38 | *"Light damage (half)"* | FREE — `element` + `elementFraction` |
| C39 | *"50% chance of inflicting Blind on the DU for 1◈"* | ENGINE — E10/E11, §4.5 |
| C40 | *"reduce Castor's NP Cooldown by 1◈"* | CONTENT — `ticks: "1◈"` |
| C41 | Cooldown 3◈−⅓◈ | FREE — parses; `achilles-runner-comet.yml` precedent |

### 4.3 Pollux — 21

| # | Clause | Verdict |
|---|---|---|
| P1–P3 | Identity, parameters, attributes (Female, Servant, `[Sky]`, Humanoid) | FREE |
| P4 | Health 1500, MOV 5, Range 1/1 target, BA 150/150, Sustainability 2◈ | FREE — BA(STR) per R1 |
| P5 | Magic Resistance A Passive 1 — MAG up to A negated, else −50%, incl. NP | FREE — template |
| P6 | Passive 2 — debuff chance −25% | FREE — template |
| P7 | *"When Castor is directly next to Pollux, Castor also receives the effect of this Skill"* | ENGINE — E13 partner aura |
| P8 | Instakill/Death covered unless STR or MR-exempt; Erase unaffected | FREE — template |
| P9 | Note — other debuffs still have their chance reduced | FREE — template |
| P10 | Riding B Active — MOV +4 this Turn | CONTENT — `ridingMov` B = 4 |
| P11 | *"'Double Move', 'Riding Attack', and 'Passenger Seat' can be used on this Turn"* | CONTENT — fourth Riding variant (R9) |
| P12 | Cooldown 2◈ | FREE — `ridingCooldown` B = 2◈ |
| P13 | Riding Attack distance = MOV minus panels already Moved | FREE |
| P14 | The Active's MOV Up is not a buff | FREE — `isBuff: false` |
| P15 | Twin God's Divine Core B — +80 dealt incl. NP | CONTENT |
| P16 | *"Pollux's Crit Chance is increased by 5%"* | CONTENT (R10) |
| P17 | Counts as Divinity | CONTENT |
| P18 | Mana Burst — BA(STR)+BA(MAG) combined | CONTENT — 300 per R1 |
| P19 | *"apply Evade to Pollux for ⅓◈"* | CONTENT |
| P20 | Stars of the Chief God A — mirror of C25–C28 | CONTENT |
| P21 | Guardians of Navigation B — mirror of C29–C33 | CONTENT |

### 4.4 The Noble Phantasm — 10

| # | Clause | Verdict |
|---|---|---|
| N1 | *Dioscures Tyndaridae* — Rank B, NP, `[Anti-Unit]` | FREE |
| N2 | Range = 2 | FREE |
| N3 | *"only when Castor and Pollux are directly next to each other"* | **FREE** — `counterpartAdjacent` |
| N4 | *"half of Castor's BA(STR) and half of Pollux's BA(STR) combined"* | ENGINE — E6 `partner` in `ctx.units`; **BA = 150** per R1 |
| N5 | *"3.5x damage that has the Pierce and Ignore Def effects"* | CONTENT |
| N6 | Def Dwn (A) 1◈ — damage taken +15%, Luck −1 on being damaged | CONTENT — new effect, mirrors `def-dwn-c.yml` |
| N7 | Def Dwn (C) 1◈ — damage taken +15%, Agility −1 on being damaged | **FREE** |
| N8 | *"Counts as both Castor and Pollux's Attack for the Turn"* | ENGINE — E11 (R11) |
| N9 | *"The effects of all Skills, buffs and debuffs on both are combined"* | ENGINE — E7 (R6) |
| N10 | Cooldown 6◈ | FREE |

### 4.5 Blind — 5

Catalogued in Appendix A since it was written, authored nowhere, and inflicted by both twins'
Mana Burst.

| # | Clause | Verdict |
|---|---|---|
| B1 | 80% chance of Missing on attacks and enemy-affecting abilities | ENGINE — E10, step 1.5 (R8) |
| B2 | Evade rolls +3 | ENGINE — content, but on the new effect |
| B3 | `Mystic Eye` and `Glam Sight` cannot be used | ENGINE — same |
| B4 | With `Clairvoyance`: 40% miss, +2 Evade | ENGINE — reader is EMIYA, authored |
| B5 | Clauses 1, 2 and 4 do not apply with `Eye of the Mind` active | ENGINE — readers are EMIYA and Heracles, both authored |

B4 and B5 are the reason to build B1 rather than stub it: their consumers are already on the
board, so both exemptions are testable rather than speculative.

---

## 5. The engine work

Fifteen changes. **Each lands with its reader in the same task** — a rule that is right and inert is
this project's named dominant defect, and Ch. 45 classifies exactly that as **Collected**.

### E1 — `LinkedUnitGroup`, the spine

`system.linkedGroup` on `ServantData`:

```js
linkedGroup: new fields.SchemaField({
  id: new fields.StringField({ required: false, blank: true }),
  memberIds: new fields.SetField(new fields.DocumentIdField()),
  leash: new fields.NumberField({ required: false, nullable: true, initial: null }),
  linkedDeath: new fields.StringField({ initial: "", choices: ["", "ignoresRevival", "ownChain"] }),
  sharedCooldowns: new fields.StringField({ initial: "", choices: ["", "byName"] }),
  unitWeight: new fields.NumberField({ initial: 1, min: 0 }),
  zonSatisfaction: new fields.StringField({ initial: "all", choices: ["all", "any"] }),
  modifierCombination: new fields.StringField({ initial: "separate", choices: ["separate", "union"] }),
  summonTogether: new fields.BooleanField({ initial: false }),
})
```

Settings authored in YAML; `memberIds` resolved at summon (E14). `snapshotBoard` annotates
`unit.linkedGroup` with the resolved members, the pairwise distances and `leashBroken`, in the same
pass that already runs `annotateZon`, `annotateMasterRank`, `annotateControl` and the aura
expansion — the one place that runs after every unit is projected.

**The group contributes to `zonPartnerIds` rather than replacing it.** That field has two live
readers (`zon.mjs:147`, `items.mjs:342`) and was designed as a standalone escape hatch a GM can set
without a full group. Deriving it from the group means neither reader changes and D7 and N3 stay
free.

### E2 — The leash

An eighth clause in `rules/movement.mjs#canStopOn`: a panel more than `leash` (Chebyshev) from any
other live member is not a legal stop. `canStopOn` already feeds the reachable-set search, so the
highlight shrinks as the partner constrains it and the rule teaches itself. Pass-through is
unaffected — the leash is about where a twin *stands*.

Forced displacement bypasses it per R12; `knockbackPanel` is left alone deliberately.

### E3 — Linked death

A `Defeat` action with `mode: ignoresRevival`, dispatched from `OnEvent` on **`unitDefeated`**. The
event choice is the whole of Ch. 41 Q11: `unitDefeated` fires *after* the revival chain, so a twin
with Guts absorbs the hit for both, while `healthReachedZero` would kill the partner before the
survivor's own Guts had spoken.

### E4 — Fractional budget

`rules/budget.mjs` pools store **`usedHalves` as integers** with maxima doubled. No float touches
the budget. `consume` adds `weightOf(unit)` in halves; `summarize` renders half-pips. The boundary
case is correct and surprising, so the HUD tooltip explains it: at 3.5 of 4 a twin may still move
(3.5 + 0.5 = 4.0) and a normal Servant may not (4.5 > 4).

`rules/relationships.mjs#multiServantTax` and `#mayOrderAnotherServant` move from `acted <= 1` to a
weight sum on the same units (R2).

### E5 — Shared cooldowns

`engine/cooldown.mjs#cooldownFor` already returns a **list** of `{actorId, abilityId, ticks}`, which
is the seam. It gains the group's same-named abilities when `sharedCooldowns: "byName"`. Both twins'
sheets then show one clock, and using either sets both.

### E6 / E7 — The partner in the damage context

`mountUnits` generalizes to `namedUnits`, supplying `partner` alongside `mount`. That alone makes N4
an authoring line, because `pipeline.mjs:260` has resolved `ctx.units[src.unit]` since it was
written.

`modifierSources: [self, partner]` on the NP's damage block unions the two modifier bags, double-
counting per R6. It is the mirror of the existing `excludeModifierSources`, which the pipeline
already honours and narrates at stage 1.

### E8 — Partner-inclusive targeting

`selection: { alsoIncludes: "partner" }` in `rules/targeting/resolve.mjs`, deduplicated when the
partner is already inside the shape. Four clauses want it (R7).

### E9 — `kind: choice`

A player prompt mid-ability, branching into sub-phases. Scáthach's *Primordial Rune* (*"your choice
of any of the above effect(s)"*) is the second customer, so it is registered in
`rules/authoring/phases.mjs` as a first-class kind rather than bolted onto Mana Burst.

### E10 — The Miss check, Combat Process step 1.5

A new step between Declaration and Reaction, with its own roll-log entry and chat-card line. On a
miss the Process **ends**: no reaction, no Luck ladder, no damage, no Injury Roll, no Counter (R8).
The attack budget is still spent.

Chance resolution order: `eyeOfTheMind` active ⇒ exempt; else `clairvoyance` ⇒ 40%; else 80%.

### E11 — `alsoCountsAsAttackFor`

An ability-level flag. On use, the named relation's units are marked as having attacked and their
weight is charged (R11, N8).

### E12 — `self:withinOfPartner:N`

A roll option emitted by `rules/options.mjs`, following `options.mjs:314`'s existing
`self:withinOfMaster:N` idiom exactly — the ladder from the actual distance up to 6, so a predicate
asking `:1` means adjacency with no special case. Serves C21 and P7.

Distinct from `counterpartAdjacent`, which is a **requirement kind** gating whether an ability may
be used at all. This is a **predicate** modifying a rule already in force.

### E13 — Partner-conditional aura

P7 as `Aura` with `radius: 1, recipientRoles: [linkedPartner]`.

**Not a new `relations` value.** `rules/relations.mjs#relationOf` returns exactly one of
`self | ally | enemy | neutral`, and a linked partner is already an `ally`; returning `partner`
instead would drop Castor out of every ordinary ally-aura on the board, including Pollux's own
*Guardians of Navigation*. `recipientRoles` is the mechanism that already exists for this — *"a named
ROLE on the recipient, relative to the aura's source… the Sphinxes shield two units, not every ally
within a panel of one"* — and `inRecipientRoles` is a three-case list that takes `linkedPartner` as a
fourth line.

### E14 — `summonTogether`

`engine/summon.mjs#commitSummon` summons the declared partner and cross-links `memberIds` on both.
Pairs with the roster-count change in E4.

### E15 — A predicated scale on a table lookup

R5 needs `madEnhancementDrain` to read 10 instead of 20 while `self:withinOfPartner:1` holds.
The table is read from three places in `mad-enhancement.yml` — `StatDelta`'s `table:` and
`floorTable:`, and `SetMode`'s `whenValue.lteTable:` — so this adds a predicated `tableFactor`
honoured by all three lookups, keeping the number one number rather than splitting the three readers
apart.

### New rank tables

`avenger` (B = 80), `oblivionCorrection` (C = 15), `selfReplenishmentHealth` (D = 40),
`selfReplenishmentCooldown` (D = 2 turns). Each derived from its observed value with the corpus's
usual `perStep`, and documented in Appendix B as single-sheet derivations — Castor is the only
Avenger in either roster, so unlike `madEnhancementDefence`'s seven sheets these tables have one
witness each and Appendix B must say so.

---

## 6. The content

Seventeen files.

**Effects (4)** — `blind.yml` (§4.5), `def-dwn-a.yml` (N6), `castor-buff.yml`, `pollux-buff.yml`
(C26–C27).

**Class skills (4)** — `avenger.yml`, `oblivion-correction.yml`, `self-replenishment-mana.yml`,
`riding-pollux.yml` (R9). The first three are parameterized templates in the corpus's usual shape,
even though Castor is their only instantiation today: Ch. 15 §15.6 lists all three as canonical
class skills of the Avenger class.

**Abilities (7)** — `dioscuri-twin-gods-divine-core-castor.yml` and `-pollux.yml` (R10),
`dioscuri-stars-of-the-chief-god.yml` and `dioscuri-guardians-of-navigation.yml` (one file each,
`ref:`d by both twins — identical content, and the shared name is what shares the cooldown),
`dioscuri-mana-burst-castor.yml` and `-pollux.yml`, `dioscuri-tyndaridae.yml`.

**Servants (2)** — `castor.yml`, `pollux.yml`, each carrying the `linkedGroup` block.

---

## 7. Verification

Two layers, and the second is not optional. Green tests are not evidence that a Servant works:
Ch. 45 §45.1 records that *"Asterios and Karna were both on this list while six of Asterios's
clauses had no reader and nine of Karna's thirteen abilities did not exist."*

**Layer 1 — unit and golden tests.** `test/unit/dioscuri.test.mjs`, pinned to the *documentation*
the way the existing suite is. At minimum: Mad Enhancement B− against the rank table in all three
figures; the halved drain and threshold at adjacency (R5) including the Master-on-12 boundary; the
budget half-pip boundary at 3.5/4 for both a twin and a normal Servant; the multi-Servant tax
returning nothing when only the twins Acted (R2); the NP's 150 base through both twins' modifier
bags with a double-counted `Guardians` buff (R6); linked death firing on `unitDefeated` and *not* on
a Guts revival (Q11); Blind's chance ladder across the three cases.

**Layer 2 — the live world**, through claude-in-chrome, clause by clause against §4's inventory.
The pack build needs the LevelDB released, so the cycle is `fgt-world.mjs shutdown` →
`npm run build:packs` → `launch` → rejoin.

The clauses that can only be settled on a board: two tokens summoned by one action; the reachable
highlight shrinking as the partner moves; a twin killed and its partner falling with it; the shared
cooldown showing on both sheets; the Mana Burst choice prompt and both its branches; an attack that
Misses and produces no damage card; the NP refusing at distance 2 and firing at distance 1; and the
damage explainer listing **both** twins' modifiers in one breakdown.

---

## 8. Risks

**The Combat Process is the riskiest edit here.** Step 1.5 sits in the system's most load-bearing
state machine, which serializes and resumes (§12.12) and carries interrupts (§12.11). A miss must
serialize as a terminal state, not as a Process waiting for a reaction that will never come.

**Fractional budgets touch every action in the game.** The mitigation is integer halves — the
failure mode Ch. 34 §34.5 names is floating-point accumulation, and storing halves removes it
rather than managing it.

**`modifierSources: union` is new damage arithmetic.** The double-count is intended (R6) and looks
like a bug in the explainer unless the breakdown names which twin each modifier came from. The
audit line is part of the work, not a follow-up.

**Four new rank tables have one witness each.** Castor is the only Avenger in either roster, so the
`perStep` values are inferred rather than verified. Appendix B must label them as such, the way it
labels the A+ override on `madEnhancementDefence`.
