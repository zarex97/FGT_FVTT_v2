# Sieg (Caster) — the Clause list

*Sieg*, the Caster, built from `char_orig_sheets/by-class/Caster/Sieg.md`. Started by the user 2026-10-27.

**Audit opened 2026-10-27 (#345).**
**Read by hand, line by line.** No generated draft was used. The older copy `char_orig_sheets/Copia de Sieg.md`
was compared with it. The two differ in one line, Akafiloga Argrise 2.i: the by-class copy adds *"(increased by
50%?)"* after *"the amount of Health lost is doubled"*. The by-class copy is the one read; the query goes to the
grill (Q12).

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Caster/Sieg"`, each confirmed by reading:

- **Siegfried himself** is built (#341, `servants/siegfried.yml`). Dead Count Shapeshifter's usage 2 turns Sieg into
  that sheet, *"with all Skills and NP available"*. `dmgUpDragon` is his Dragon Slayer's effect.
- **Independent Action EX** is `class-independent-action-viy`'s three passives word for word, without her fourth
  (Anastasia (Summer)). The ZON is the table's, 3 at EX; the contract refusal is `rules/contract.mjs`'s EX branch.
- **Magecraft**'s one Spell a Turn is Kiritsugu's `CategoryUseLimit` on a category, `strasseGehen`.
- **Range-banded Normal Attack** is EMIYA's and Mannanán's `normalAttack.mode: rangeBanded`: STR at 1, MAG from 2.
- **Max HpUp** is Appendix A's: *"Max Health +X and current Health restored by the same amount"*. No document yet.
- **NP Regen**, **Atk Up** (with its NP figure), **Def Dwn**, **Shock**, **NP Seal** are built effects.
- **Heilen's *"within a 3 panel area of himself"*** is `chebyshevRadius: 3`, as Katō Danzō's Tobikato reads a 2
  panel area of herself.
- **The DRCS** are a Resource pool, as EMIYA's Aria and Scáthach's PRS Tokens are (`resources:`).
- **Akafiloga Argrise usage 1** is Balmung's frame: `selfEdgeAdjacent`, an `orientedRect` 5×5 turnable, BA(MAG).
- **Fafnir's Master upkeep** is Raikou's Tenmōkaikai: `anyTurnEnd`, the test before the drain, `selfOrSummonsActed`.
  Its end by hand at any Turn or Round is Tenmōkaikai's `deactivation.window: any`; its 8◈ after it ends is
  `countFrom: deactivation`.
- **Fafnir cannot Block; his Agility Checks double** is Bunyan's, Darius III's and Tamamo Cat's clause (none built).
- **Fafnir's knockback into an occupied panel** is Semiramis's `Knockback`.
- **Galvanism** is a granted skill (`GrantedAbility`).

What he needs that nobody has yet, each built as a generic piece:

- **A timed form that comes back** (DC.2.*). `engine/transform.mjs` takes a form *"for good"*: Gilles's Gigantic
  Horror never returns. Sieg takes Siegfried's whole sheet for X Turns and returns with his own Stats and cooldowns as
  they were. Fafnir is a second form, an Activation NP's, ended by hand or by its Master's Health.
- **A form that is another Servant's sheet** (DC.2.kit): every Skill and the NP of `siegfried`, not overrides on Sieg.
- **A duration rolled on a die** (DC.2.die): 1◈ + ½◈ × d4.
- **A cooldown that adds the Turns a form lasted** (DC.2.cd).
- **A magnitude that falls at the end of the Turn it was given** (KN.decay): Def Dwn (Knacken), 50% then 25%.
- **A growth every 3 full Rounds** (BC.p2): Fran's clause, not built.
- **A cooldown cut on one random member of a category** (BC.p3.spell).
- **A Range that falls to 1 under NP Seal** (BC.p1.seal).
- **A use that ends its own form at the Turn's end and costs a doubled NP price** (AA.2.i).
- **Two usages that lock each other's cooldown** (AA.lock).

**119 Clauses** across 11 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields. `DRCS: 3/3` is not one of them: it is
  the pool's size, read as ST.drcs.
- *"Has the following effects-"*, *"Can be used in 2 different ways, as follows-"*, *"Can be used in 2 different
  methods, as follows-"*, *"As Fafnir, the following effects are applied to him-"*: headings.
- *"(quadrupled)"*: the gloss of AA.2.a's +300%, read there.
- *"~~value is 16~~"*: struck, so superseded by *"increase = 4"* (Nursery Rhyme R1, Arjuna). Read as BC.p2.agi.
- *"A Maiden's Chastity"*, *"The Lightning Tree of Crucifixion"*, *"Incandescent Dragon's Breath・Earth
  Liquefaction"*: the NPs' titles.
- `Items held:`: an empty slot.

## Readings to settle

Asked by grilling, 2026-10-27. Rulings are written here as they land.

**Built 2026-10-27** on `claude/sieg` (`test/unit/sieg-345.test.mjs`) and pressed as Player1 in a War of its own,
`kbZIMvErSVVVV4eQ` on the scene *Sieg Audit*, apart from the match being played. **119 of 119** Clauses end Pressed or
Observed live.

Found live and fixed, each with a test that fails without it:

- The bar showed Siegfried's seven greyed, *"Gone with the form he has taken"*, before he took it (`rules/form.mjs#heldNow`).
- Max HpUp at full Health read *"Health 500 (no change)"*: the restore was clamped before the buff raised the
  maximum (`intents.mjs#rankOf`, `afterEffects`).
- X summed ½◈ per term (two Turns each): `engine/transform.mjs#lastingTurns` sums in ◈ first (5, 6, 8, 9).
- Knacken at the start of his attacking Phase refused *"Choose a target."*: the Phase's window opens before any
  Process, so it had no DU (`attack.mjs`, `phaseDefenders`).
- Fafnir's lock read *"undefined cannot be used while …"* (`costs.mjs`, the refusal's `name`).
- Usage 1 as Fafnir switched Fafnir off at once: the attack path wrote the `setMode` phase beside the caster
  pass's queue, so that Turn's upkeep never charged (`attack.mjs`, `atTurnEnd`).
- Ended by his own switch, Fafnir's token stayed 3×3 over a 1×1 footprint (`token-footprint.mjs`, `updateItem`).
- The pool read "Drcs" on the bar: `FGT.Pool.drcs`, and the card's resource line reads the same words.
- A Prevention Luck Check that timed out stayed open on Player1's screen, more stacking behind it: a timed-out ask
  is withdrawn and its windows close (`net/socket.mjs`, `apps/prompt.mjs#withdrawPrompt`).
- As Siegfried his sheet read Sieg's *"Caster · Neutral Good · Europe"*, Details *"caster"*, and kept the contract
  button: the header, the Details tab and `canContract` read `rules/form.mjs#formSheet`.

**Round 1, ruled 2026-10-27 (the user).** Q7 and Q16 are asked again in round 2 (Q16's answer arrived labelled Q6), Q8
with the quotations.

| # | Ruling |
|---|---|
| 1 | Transformed, he is Siegfried's whole sheet: Saber, Parameters, BA, MOV 5, Range 1, Attributes, Region, Sustainability 2◈ and his seven abilities. Of Sieg's own, Galvanism alone stays (*"in effect even while Sieg is transformed"*) (DC.2.form, DC.2.kit). |
| 2 | He enters at Siegfried's full Health, 1500; Agility and Luck rolled as at summon, by AGI B and LUC E. A Parameter shift Sieg holds carries onto Siegfried's Ranks (DC.2.stats, DC.2.param). |
| 3 | Sieg's own cooldowns are frozen while he is Siegfried. Siegfried's start fresh, all available, every transformation. Effects gained as Siegfried come back with him: one Unit (DC.2.back). |
| 4 | Siegfried brought to 0 is the Unit defeated. The sheet prints no rescue (DC.2.fall). |
| 5 | Usage 1 and usage 2 keep two clocks; the sheet prints a lock where it means one (Akafiloga's note). At 0 DRCS the 25% die is still on the card and consumes nothing (DC.lock, DC.1.empty.die). |
| 6 | Fafnir is Sieg with effects applied, not another sheet: Independent Action, Homunculus, Magecraft's cap and Bridal Chest P1 to P3 all hold (AA.2.passives). |
| 9 | Growth counts full Rounds since his summon, at the end of Rounds 3, 6, 9...: Agility +1 max and current, +4 at most; BA both +10, no cap (BC.p2.*). |
| 10 | NP Seal does only what is printed: Range 1, Galvanism negated. P2 still grows, and NP Seal does not end Fafnir (`engine/seal-ends.mjs` ends two Revised Skills under Skill Seal) (BC.seal). |
| 11 | Blasted Tree: the DU takes 2.5× only. Every other Unit in the 3×3 around it, Sieg excepted and allies included, takes 1.5×, may Evade or Block, not Counter; the DU reacts as usual. The 25% Shock is a die on every Unit hit (BT.area, BT.shock). |
| 12 | Usage 1 as Fafnir costs the NP's Master Health doubled (the older copy's plain word), charged at use. The 40/20 upkeep also charges at that Turn's end: the NP is Active through it (AA.2.i.cost). |
| 13 | Akafiloga usage 1 hits every Unit in the 5×5, allies included, as Balmung (#191 reading 11). The Def Dwn has no printed chance, so it lands, cut only by debuff resistance, and before the damage: its +30% counts on this hit (AA.1.*). |
| 14 | When Fafnir ends, Max Health returns to his own and current Health clamps to it: the system's one rule for a Max Health raise ending (AA.2.a.end). |
| 15 | *"Can Move to any panel"* is within his MOV, occupied panels included; the occupants are pushed (AA.2.e.*). |
| 17 | As Fafnir the three Spells and both Dead Count usages are refused. Normal Attacks, Evade and his Master's Command Spells stay; passives hold (AA.2.h). |
| F | **Added by the user:** Fafnir has a size of 3×3 (AA.2.size). |

**Round 2, ruled 2026-10-27 (the user).** Q22 was asked again in round 3; Q23 revises Q18.

| # | Ruling |
|---|---|
| 7 | Galvanism fires once per MAG hit that deals more than 0. Its Spell is drawn from the Spells on cooldown; with none, that half says "nothing to cut" on the card (BC.p3.*). |
| 8 | Schwert and Dead Count usage 2: any Combat Phase he is in, attacking or attacked, as Karna's identical words (#206 reading 4) and EMIYA's Reinforcement (#208 reading 8): `[ownTurn, combatPhaseStart, defendingPhaseStart]`. Knacken: his own attack's DU only, `[ownTurn, combatPhaseStart]` (KN.combat, SW.when, DC.2.when). |
| 16 | Fafnir's upkeep: "Acted" is Fafnir himself that Turn, the switch included (#194 ruling 2). No NP cost on activation. Health below what is due, or equal to it, ends the NP at that Turn's end and the Master pays nothing (#189 reading 4) (AA.2.g.*). |
| 18 | Growing to 3×3 is Kingprotea's cascade, occupants pushed (`knockBackOccupants`); where it grows from is Q23. Usage 1's 5×5 sits against a whole side of the 3×3, with a shift (AA.2.size, AA.1.area). |
| 19 | When Fafnir ends he shrinks to the centre panel of his 3×3 (the user) (AA.2.size). |
| 20 | Moving as Fafnir pushes with `direction: arrival`, on along his last step, as Kingprotea (AA.2.e.push). |
| 21 | Galvanism while he is Siegfried cuts Balmung's clock and one of Sieg's frozen Spell clocks; the Spell cut survives the return, the one exception to *"the same as they were"* (BC.p3.form). |

**Round 3, ruled 2026-10-27 (the user).** The frontier is empty: every reading is ruled.

| # | Ruling |
|---|---|
| 22 | A 3-Round growth that falls while he is Siegfried goes on Sieg's own figures and shows when he returns; Siegfried's stay his. As Fafnir, +150 and +125 stack on Sieg's grown BA (BC.p2.*). |
| 23 | He grows to 3×3 centred on his own panel, the cascade pushing occupants, so with Q19 he ends where he began. At a board edge with no room, his owner picks a corner, as Kingprotea (AA.2.size). |

## Statblock

- [x] **ST.name** · True Name: Sieg · *Observed live* — Player1's sheet "Servant: Sieg" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.class** · Class: Caster (the sheet's folder; no Class line is printed) · *Observed live* — his sheet "CASTER · NEUTRAL GOOD · EUROPE"; the bar "Sieg CASTER" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.region** · Region: Europe · *Observed live* — his sheet "… EUROPE" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.align** · Alignment: Neutral Good · *Observed live* — his sheet "NEUTRAL GOOD" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.param** · STR E, END E, AGI E, MAG D, LUC B · *Observed live* — his sheet STR E, END E, AGI E, MAG D, LUC B (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.attr** · Attributes: Male, Servant, [Man], Dragon, Humanoid · *Observed live* — his sheet's Details: male, servant, man, dragon, humanoid; Dragon read by Dmg Up (Dragon)'s predicate on the board (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.hp** · Base Health 500 · *Observed live* — Health 500 / 500 on Player1's bar (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.mov** · MOV 3 · *Observed live* — his sheet MOV 3 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.range** · Range 3 panels, 1 target · *Observed live* — his sheet Range 3, Targets 1; Heracles at 3 legal from (7,7) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.ba** · Base Attack STR 50, MAG 125 (the tables' both: STR E 50, MAG D 125) · *Observed live* — his sheet BA (STR) 50, BA (MAG) 125; the swings' base 60/135 after one growth (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.sus** · Sustainability: N/A (IA.p1) · *Observed live* — no Sustainability on his sheet; board `sustainability: null` (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.drcs** · DRCS 3/3: he is summoned holding three Dragon Revelation Command Spells · *Observed live* — bar and sheet "DRCS 3 / 3" at the War's start (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **ST.items** · Items held: none · *Observed live* — none on his sheet (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Independent Action — Class Skill, Rank EX *(3 Passives)*

- [x] **IA.p1** · *"Sustainability does not apply."*: no Sustainability clock runs on him · *Observed live* — board `sustainability: null`; none on his sheet (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **IA.p2** · *"Master's ZON is increased by 3 panels."* · *Observed live* — board ZON 6 (his Master's 3 + 3); EMIYA's 5; Blasted Tree "Outside the Master's ZON" at 7, usable at 3 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **IA.p3** · *"Cannot be contracted by enemy Casters and Masters."* · *Pressed* — a Free Sieg (staged) beside Medea's Master: `attemptContract` refused "immune" (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Homunculus — Rank C+ *(Passive)*

- [x] **HM.str** · All STR damage dealt +5% · *Pressed* — Normal Attack at Range 1 on Cú: "atkUp:5" in its breakdown (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **HM.mag** · All MAG damage dealt +10% · *Pressed* — Normal Attack at Range 3 on Heracles, and Akafiloga: "atkUp:10" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **HM.debuff** · Chance of being inflicted with debuffs −5% · *Observed live* — board `applicationChances` incoming 5 (Homunculus) (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Man-made Hero (False) — Rank B+ *(Active)*

- [x] **MH.when** · Used during your Turn · *Pressed* — pressed from Player1's bar on his own Turn (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **MH.regen** · NP Regen for 1◈ Turns: NP Cooldown −1 Turn at the end of every Turn · *Pressed* — NP Regen held; at that Turn's end Blasted Tree 9 → 7 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **MH.hp** · Max HpUp for 1◈ Turns: Max Health +20% of its original value (current Health restored by the same, Appendix A) · *Pressed* — "NP Regen ; Max HpUp; Health 500 → 600", Max 600 (after the fix below) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **MH.cd** · Cooldown 4◈−⅓◈ Turns · *Observed live* — its clock 11 after the press (4◈−⅓◈) (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Magecraft — Rank C

- [x] **MC.allow** · Allows the use of Straße/gehen Spells · *Pressed* — Knacken, Schwert and Heilen pressed as Spells (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **MC.once** · Only one Straße/gehen Spell can be used per Turn · *Pressed* — Heilen after Schwert the same Turn: "Already used a Spell of this kind this Turn" (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Straße/gehen: Knacken *(Spell)*

- [x] **KN.range** · Range 3 · *Pressed* — on Cú at 2 and Heracles at 3; the clipped corner (8,10) from (6,7) refused out of Range (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **KN.turn** · Used during your Turn, on an enemy Unit · *Pressed* — on Cú during his Turn: "Lancer: Def Dwn (Knacken)" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **KN.combat** · Or at the start of a Combat Phase, on the DU, within Range (Q8) · *Pressed* — offered at "Start of the Combat Phase" of his Normal Attack; picked: "Berserker: Def Dwn (Knacken)" on the DU (after the fix below) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **KN.def** · Def Dwn (Knacken) for 1◈ Turns: all damage taken +50%, NP included, on the Turn the Spell is used · *Pressed* — magnitude 50 for 1◈; "defDwn:50" in that Turn's Normal Attack on Heracles (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **KN.decay** · At the end of the Turn the Spell was used, its magnitude falls to 25% for the rest of its 1◈ · *Pressed* — at that Turn's end: "Lancer: Def Dwn (Knacken) falls to 25"; Cú's next hit read "defDwn:25" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **KN.cd** · Cooldown 3◈ Turns · *Observed live* — its clock 9 after the press (3◈) (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Straße/gehen: Schwert *(Spell)*

- [x] **SW.when** · Used during your Turn or at the start of a Combat Phase (Q8) · *Pressed* — pressed on his Turn; offered at the start of his attacking Phase with Knacken (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **SW.atk** · Atk Up on himself for ⅓◈ Turns: all damage dealt +35%; if NP, 25% · *Pressed* — "Atk Up" 35/25, expiry ⅓◈ on him (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **SW.cd** · Cooldown 2◈ Turns · *Observed live* — its clock 6 (2◈) (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Straße/gehen: Heilen *(Spell)*

- [x] **HE.when** · Used during your Turn · *Pressed* — pressed on his Turn (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **HE.target** · On an allied Unit within a 3 panel area of himself (`chebyshevRadius: 3`), himself included · *Pressed* — on EMIYA at 2 panels, and on himself (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **HE.ally** · On another Unit: Health +15% of its maximum, Agility +1 · *Pressed* — "Archer: Health 100 → 250 (+150)" (15% of 1000) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **HE.self** · On himself: Health +30% of his maximum, Agility +2, instead · *Pressed* — "Health 270 → 420 (+150) ; Agility 9 → 11" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **HE.cap** · Neither restore passes its maximum · *Pressed* — "Archer: Agility 15 (no change)" at his maximum (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **HE.cd** · Cooldown 2◈ Turns · *Observed live* — its clock 6 (2◈) (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Dead Count Shapeshifter: Dragon Revelation Command Spells — Rank EX *(Active, 2 usages)*

Usage 1:

- [x] **DC.1.when** · Used during your Turn · *Pressed* — pressed on his Turn (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.1.np** · NP Cooldown −1◈ Turns · *Pressed* — "Blasted Tree: Cooldown 9 → 6 ; Akafiloga Argrise: Cooldown 9 → 6" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.1.dmg** · Dmg Up (Dragon) for ⅓◈ Turns: damage dealt to Dragon Units +100%; if NP, 50% · *Pressed* — "Dmg Up (Dragon)" 100 / NP 50, ⅓◈ (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.1.die** · Then a 25% chance of consuming one DRCS · *Pressed* — "Dragon Revelation consumes a DRCS: 1d100 → 40 against 25% — missed"; staged low, "… → 1 against 25% ; DRCS 3 → 2" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.1.cd** · Cooldown 3◈ Turns · *Observed live* — its clock 9 (3◈) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.1.empty** · Usable with no DRCS left · *Pressed* — pressed at DRCS 0 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.1.empty.np** · With none left: NP Cooldown −½◈ Turns instead · *Pressed* — "Blasted Tree: Cooldown 9 → 7" (½◈) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.1.empty.dmg** · With none left: Dmg Up (Dragon) +50%; if NP, 25%, instead · *Pressed* — Dmg Up (Dragon) 50 / NP 25 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.1.empty.die** · With none left: the 25% die consumes nothing (Q5) · *Pressed* — "… 1d100 → 1 against 25% ; DRCS 0 (no change)" (War kbZIMvErSVVVV4eQ, 2026-10-27)

Usage 2:

- [x] **DC.2.when** · Used during your Turn or at the start of a Combat Phase (Q8) · *Pressed* — his Turn; and at "Start of the Combat Phase you are attacked in" (Heracles's attack): picked, he took the hit as Siegfried (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.req** · Requires 1 DRCS; refused with none · *Pressed* — at DRCS 0 the slot reads "Not enough of the pool it spends." (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.pay** · DRCS −1 when used · *Pressed* — "DRCS 2 → 1"; "DRCS 1 → 0" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.form** · Then Sieg is transformed into Siegfried (Q1) · *Pressed* — "Caster transforms: Dead Count Shapeshifter: Siegfried."; board Saber, Range 1, BA 135/150 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.kit** · With all of Siegfried's Skills and NP available and usable · *Pressed* — bar as Siegfried: Riding, Avaricious Gold, Disengage, Dragon Slayer, Balmung; Avaricious Gold pressed: "Rheingold ; NP Regen ; Atk Up" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.npgate** · Balmung still only when the Rounds passed meet the game's conditions · *Pressed* — as Siegfried, Round 14, the War's NP gate staged at 20: "Balmung … — Ready from Round 20 (6 away)" on the press; at the War's 1 (and his Master within ZON) the slot lit (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.die** · Roll a d4: the transformation lasts 1◈ + ½◈ × the roll Turns, the die on the card · *Pressed* — "d4: 1. The transformation lasts 5 Turns."; a 4 lasted 9 (after the fix below) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.keep** · He keeps every buff, debuff and other effect he held · *Pressed* — NP Regen, Max HpUp and Schwert's Atk Up held after the change (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.stats** · New Stats are rolled for the transformed Sieg (Q2) · *Pressed* — "Agility rolled anew: 1, Max 17. Luck rolled anew: 1, Max 1."; Health 1500 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.param** · Any + or − to Sieg's Parameters carries over to Siegfried · *Observed live* — steps staged on Sieg (STR +1, LUC −1): board STR B+ → B++, LUC E → E−; Player1's sheet "STR E → B++ + granted", "LUC B → E-" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.end** · When it ends, he becomes Sieg again · *Pressed* — "Caster returns from Dead Count Shapeshifter: Siegfried after 5 Turns." (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.back** · His Stats and his Skill, Spell and NP cooldowns are as they were before he transformed (Q3) · *Pressed* — Agility 11/11 and Luck 16/16 as before; Knacken 4, Schwert 6 did not tick across his Turns as Siegfried (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.toll** · Then his Health −100, never below 1 · *Pressed* — "Health 420 → 320." (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.cd** · Cooldown 3◈ Turns plus the Turns he was transformed, counted from the end · *Observed live* — its clock 14 at the return (3◈ + 5) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.2.fall** · Siegfried brought to 0 while transformed (Q4) · *Pressed* — Health staged 50, Heracles's Normal Attack, Player1 declined Disengage and did nothing: "Caster is defeated by Berserker."; past his form's end (tick 45) no return, Health 0, still defeated (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **DC.lock** · Usage 1 and usage 2: one clock or two (Q5) · *Observed live* — Dragon Revelation's clock 9 and usage 2's 14 ran apart (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Bridal Chest: A Maiden's Chastity — Rank C *(NP, Anti-Unit, 3 Passives)*

- [x] **BC.p1.str** · At Range 1, his Normal Attacks use BA(STR) · *Pressed* — Normal Attack at Range 1 on Cú: STR, "base:str:60" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p1.mag** · At Range 2 or more, his Normal Attacks use BA(MAG) · *Pressed* — Normal Attack at Range 3 on Heracles: "base:mag:135" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p1.elem** · At Range 2 or more, Lightning damage · *Pressed* — that swing's Shock rider, gated on `attack:element:lightning`, rolled (the card names no element) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p1.shock** · At Range 2 or more, a 10% chance of Shock for 1◈ Turns · *Pressed* — "Shock: resisted, rolled 81 vs 10%" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p1.seal** · Under NP Seal, his Range is 1 for its duration · *Pressed* — NP Seal staged: board Range 1; Player1's sheet "RANGE 1" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p2.when** · After every 3 full Rounds, at the end of the Round (Q9) · *Pressed* — Rounds counted 1, 2 across his Siegfried form and the third as Sieg; the growth at Round 3's end, again at Round 6's (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p2.agi** · Max and current Agility +1, at most +4 in all · *Pressed* — "End of the Round Caster: Agility 11 → 12 (Bridal Chest: A Maiden's Chastity)", Max 12, then 13 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p2.ba** · Base Attack, STR and MAG, +10, no limit · *Pressed* — BA 50/125 → 60/135 → 70/145 on the board (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p3.grant** · He gains the Skill 'Galvanism' · *Observed live* — Galvanism on his sheet's Skills (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p3.when** · Whenever he takes MAG damage (Q7) · *Pressed* — Medea's Aero (MAG) on him: "Straße/gehen: Schwert: Cooldown 6 → 5 (drawn at random, d2: 1)" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p3.np** · His NP Cooldown −⅓◈ Turns · *Pressed* — as Siegfried, Balmung at 0: nothing to cut, no line (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p3.spell** · One random Straße/gehen Spell's Cooldown −⅓◈ Turns (Q7) · *Pressed* — "drawn at random, d2: 1" over Knacken and Schwert, both on their Cooldown (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p3.form** · In effect while he is Siegfried (Q3) · *Pressed* — that hit was on him as Siegfried; the Schwert cut held on his return (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.p3.seal** · Negated while he holds NP Seal · *Pressed* — NP Seal staged: no Galvanism handler; Aero for 490 cut no clock, card only "Bleed" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BC.seal** · What else NP Seal does to Bridal Chest (Q10) · *Pressed* — NP Seal staged: Range 1 and Galvanism gone; the growth counts on (ruling 10) (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Blasted Tree: The Lightning Tree of Crucifixion — Rank D *(NP, Anti-Army)*

- [x] **BT.ba** · Base Attack (MAG) · *Pressed* — the splash's 1.5x on Medea, BA(MAG), 214 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BT.range** · Range 1 · *Pressed* — declared on Cú beside him (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BT.du** · 2.5× damage to the DU · *Pressed* — Cú's Process "2.5x, Lightning" (0 after his Magic Resistance) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BT.area** · Then every Unit within the 3×3 around the DU, Sieg excepted, takes 1.5× (Q11) · *Pressed* — a second Process on Medea in the 3x3; Sieg, inside it, not hit (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BT.react** · Those Units may Evade or Block, not Counter · *Pressed* — Medea offered nothing / Block / Evade / her Spells; `forbiddenReactions: [counter]`, the rung skipped; Cú offered his Counter (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BT.shock** · A 25% chance of Shock for 2◈ Turns (Q11) · *Pressed* — a die on each: "Shock rolled 1 vs -40%: resisted" (Cú), "rolled 1 vs -25%" (Medea) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BT.elem** · Lightning damage · *Pressed* — both Processes `element: lightning` (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **BT.cd** · Cooldown 4◈ Turns · *Observed live* — its clock 12 (4◈); his Master paid the D price (War kbZIMvErSVVVV4eQ, 2026-10-27)

## Akafiloga Argrise: Incandescent Dragon's Breath・Earth Liquefaction — Rank EX *(NP, Anti-Unit (Self), 2 usages)*

Usage 1:

- [x] **AA.1.ba** · Base Attack (MAG) · *Pressed* — "base:mag:145" on Medea (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.1.area** · A 5×5 in any non-diagonal direction next to Sieg, every Unit in it (Q13) · *Pressed* — a 5x5 north: Lancer, Caster and his ally EMIYA (Archer) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.1.def** · First Def Dwn for 1◈ Turns on every Unit hit: damage taken +30% · *Pressed* — before the damage: Medea "rolled 21 vs 50%", "defDwn:30" in her 777; Cú resisted (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.1.dmg** · Then 5× damage · *Pressed* — "multiplier:5" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.1.elem** · Fire damage · *Observed live* — the Fire element from its damage block (the card names none) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.1.cd** · Cooldown 8◈ Turns · *Observed live* — its clock 24 (8◈) (War kbZIMvErSVVVV4eQ, 2026-10-27)

Usage 2 (Activation, non-damaging): Sieg transforms into Fafnir.

- [x] **AA.2.form** · Used, he becomes Fafnir until it ends · *Pressed* — pressed from Player1's Modes row (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.passives** · His own passives as Fafnir: Independent Action, Homunculus, Magecraft, Bridal Chest (Q6) · *Observed live* — Homunculus's "atkUp:10" and Galvanism's handler on the board as Fafnir (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.a** · Max and current Health +300% · *Pressed* — "Health 420 → 1680", Max 2000 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.a.end** · What his Health is when Fafnir ends (Q14) · *Pressed* — Health 1543/2000 → 500/500 at the end; 1200/2000 → 500/500 ended by hand (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.b.ba** · BA(STR) +150, BA(MAG) +125 · *Pressed* — board BA 210/260; usage 1 as Fafnir "base:mag:270" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.b.na** · Normal Attacks at Range 1 use BA(STR), at Range 2 or more BA(MAG) · *Observed live* — his own banded Normal Attack held (Bridal Chest) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.c.cut** · All damage taken −75%; if NP, 50% · *Pressed* — Heracles's hit: "defUp:-75", 137 dealt (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.c.injury** · No Injury Roll when damaged by an Attack, unless by an NP · *Observed live* — board attribute `injuryOnlyFromNP` (no hit past the threshold live) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.d.block** · Cannot Block · *Pressed* — Heracles's ladder on Fafnir: "Do nothing / Evade" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.d.agi** · An Agility Check's roll is doubled · *Pressed* — "evade- 1d20 → 13 … Akafiloga Argrise: Fafnir +13 … total 31" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.e.move** · Can Move to any panel (Q15) · *Pressed* — moved north into EMIYA's panel (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.e.push** · Moving into an occupied panel knocks its Units back 1 panel until the space is free · *Pressed* — EMIYA pushed (8,5) → (8,4), along his step (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.f** · Gains the Large Attribute · *Observed live* — board attribute `large` (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.size** · Fafnir is 3×3 (the user, 2026-10-27; not on the sheet) (Q18) · *Pressed* — 3x3 around (7,7), EMIYA and his Master pushed straight out; back to 1x1 on the middle panel (after the fix below) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.g.acted** · At the end of every Turn it is Active, his Master loses 40 Health if Fafnir Acted · *Pressed* — "Master of Caster of Faction 1 loses 40 Health (Akafiloga Argrise: Fafnir)" (100 → 60; an Evade counted) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.g.idle** · And 20 if he did not · *Pressed* — 20 a Turn he did not Act: 260 → 240 → 220 → 200 (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.g.nonp** · Instead of the Master's usual NP Health loss (Q16) · *Pressed* — his Master unchanged by the switch (100) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.g.end** · A Master with less Health than is due: the NP is forcibly ended at that Turn's end, and the Master loses nothing (Q16) · *Pressed* — Master at 20 with 20 due: "Akafiloga Argrise: Fafnir ends on Caster", nothing paid (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.h** · Cannot use any Skill or NP but usage 1 while Active (Q17) · *Pressed* — every Skill greyed: "Straße/gehen: Schwert cannot be used while Akafiloga Argrise: Fafnir is Active" (after the fix below) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.i.use** · Can use usage 1, its Def Dwn 50% · *Pressed* — usage 1 as Fafnir: "defDwn:50" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.i.end** · The transformation ends at the end of the Turn usage 1 was used · *Pressed* — "Akafiloga Argrise: Fafnir ends at the end of this Turn."; Active through the hit, ended at the Turn's end (after the fix below) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.i.cost** · His Master loses the NP's Health cost, doubled (Q12) · *Pressed* — Master 400 → 200, and 440 → 240 (two EX prices) (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.j** · Sieg can end it during his Turn, or at the start or end of any Turn or Round · *Pressed* — on his Turn by his own switch: "Caster deactivates Akafiloga Argrise: Fafnir."; off-Turn "can only be switched during its owner's Turn" (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.2.cd** · Cooldown 8◈ Turns after it ends · *Observed live* — its clock 24 (8◈) from each end (War kbZIMvErSVVVV4eQ, 2026-10-27)
- [x] **AA.lock** · Usage 1 cannot be used while usage 2 is on Cooldown, and usage 2 not while usage 1 is · *Pressed* — usage 1 "Not while Akafiloga Argrise: Fafnir is on Cooldown."; the other way round "Not while Akafiloga Argrise: Incandescent … is on Cooldown." (War kbZIMvErSVVVV4eQ, 2026-10-27)
