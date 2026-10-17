# Van Gogh — the Clause list

**Draft, 2026-10-17.** The audit issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Van Gogh.md`. The generated draft was not used.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"including NP"* or *"if NP"* needs a Noble Phantasm
reading.

**Built 2026-09-14, pressed 2026-10-17.** 84 Clauses `Pressed` or `Observed` (77 live, 7 in the engine); the evidence per Clause is on #239, the case chapter Ch. 46 §46.36. Design
`docs/superpowers/specs/2026-09-14-van-gogh-design.md`, rulings R1 to R10.

**Built to be reused.** Most of her is already other Servants' pieces, and the rest became pieces
others reuse. Item Construction is Medea's aura (`group: itemConstruction`, `highestOnly`); Divinity
B+ is the table's `divinity`; Insanity is a plain `DamageModifier`; Existence Outside the Domain is the
skill Alter Ego predicated on before it existed; Het Gele Huis and The Yellow House are Scáthach's
`requirements: abilityOffCooldown`; their Def Dwn (C) is Mannanán's and Yan Qing's; their Regen is
Appendix A's (5%, #234 reading 6); De Sterrennacht's Area CritUp is the one Arjuna's Awarded Hero
reuses; Terror is Appendix A's. Her own pieces are generic: `curseStageChanged`, the `transfer` phase,
`DamageFloor` by source, `countTargets`, `NegateOpponentSource`.

### Already ruled

**Her design (2026-09-14):** any Curse, from any source, feeds Channel Marker Soul, and Imaginary
Numbers Arts paying twice is the engine (R1, ruled by the user) · the removal half pays only for the
'Gogh' buff's removals, a Cure pays nothing (R2) · Shadow of Longing takes Curse from enemies too, the
sheet bolds **all** (R3) · her Normal Attacks use BA(MAG) (R4) · Divinity B+ is the table's 45 (R5) ·
the mirrored pair blocks and does not trigger (R6) · *"X0%"* is X × 10% (R7) · a chance over 100% is not
clamped until the end, so 500% lands through her own resistances (R8) · Sunflower's Curse floors her
at 1 against Curse only (R9) · Item Construction does not stack, the highest Rank wins (R10).

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6) · *"NP Cooldown"* naming no
NP reaches every NP (#197 reading 6) · *"all allied Units"* includes the user unless the sheet says
*"other"* · an effect with no NP figure applies its full value against an NP (#204 reading 5) · Crit
Up and Crit DmUp reach an NP only when an NP figure is stated (#131) · two different Atk Ups stack
(#230 reading 4) · Regen reads its own percent, 10 when none is stated (#234 reading 6) · an NP used
on its owner's own Turn consumes her Attack (§46.4-AZ) · *"Inflicts"* with no chance is the effect's
base 100%, resisted as usual (Ch. 15) · a sheet binds only its owner.

### Readings to settle

Asked by grilling, 2026-10-17.

1. **Class** (`SB`). **Ruled:** Foreigner, as built and as Appendix D says; the sheet names none.
2. **"A successful Attack" for the 'Gogh' buff** (`SL.g.1`, `SL.g.crit`). **Ruled:** Alpi's reading (#204
   reading 12): once per Attack, when it was not Evaded. A Block or a hit for 0 counts. The Attack was a
   Crit when any Unit it landed on was critted. It was built on each hit that dealt damage, per target.
3. **Def Dwn (C)'s Agility −1** (`HG.e2.agi`, `YH.e2.agi`). **Ruled:** her sheet's *"whenever successfully
   Attacked"*: any Attack on the Unit that was not Evaded, even one dealing 0. An option on the instance,
   so Yan Qing's *"damage received from an Attack"* and Mannanán's *"when damage is received"* keep theirs. **Asked again** (its premise said the build drained on damage alone; it was "hit, not hurt" already) **and ruled
   2026-10-17:** a. successfully Attacked is hit, not hurt, plus a hit whose damage an Instakill skipped; not an Evade,
   a complete negation or a concealment coin; Alpi reads the same. b. Once per Attack. c. Every Def Dwn (A) and (C),
   whatever its sheet's wording (§46.4-OZ).
4. **Shadow of Longing on herself** (`SL`). **Ruled:** she may choose herself, as Scáthach may with
   Primordial Rune's identical *"on an allied Unit within a 2 panel area of herself"*. It was built
   others-only.
5. **The 'Gogh' buff's Atk Ups** (`SL.g.atk`, `SL.g.crit`). **Ruled:** each +10% stacks with the others and
   lasts its own 1◈; a Crit grants +20%.
6. **What the pull moves** (`SL.pull`, `SL.pull.apply`). **Ruled in four parts:**
   - a. Her own Curse stays put: not removed, not re-applied, and it pays nothing.
   - b. The arriving stages land with no roll: *"apply"*, where her other Curse clauses state a chance.
     Her resistances do not touch them. It was built rolling once at 100% less her resistances (40%).
   - c. An immunity on her blocks the arrival, and the Curse removed from the others is lost.
   - d. Each arriving stage pays Channel Marker Soul 1 Turn (R1).
7. **Who the pull reaches** (`SL.pull`). **Ruled:** every Unit within 3, of any side: Civilians, Masters
   and summons included. It was built skipping Civilians.
8. **"Units with the Mad Enhancement Skill"** (`EO.2.*`). **Ruled:** holding the Skill is enough, the mode
   on or off. Passive 5 alone asks for it Active.
9. **Open issue #202** (an effect a handler lands has no card line). **Proved live 2026-10-17** on this
   board: her Normal Attack under the 'Gogh' buff ate a stage (Curse 2 → 1) and gained Atk Up 10, and
   Player1's card read only *"Foreigner ⚔ Lancer, Normal Attack, 28"*. **Ruled:** built in this audit,
   generically: what a handler lands reaches the card that raised it.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"(e.g. Gogh has Stage 7 Curse, so NP Cooldown is reduced by 2◈+⅓◈ Turns)"* — the worked sum of `IN.3`.
- *"(60% Terror)"* — the name of `DS.terror`'s chance.
- *"(see below)"*, *"(see above)"* — cross-references.
- *"(i.e. Item Construction does not stack)"* — the restatement of `IC.stack`.
- *"(Gogh cannot be defeated due to the effects of Curse)"* — the restatement of `SC.2`.
- `Items held:` — an empty slot.

## Statblock

- [ ] **SB** · True Name Vincent van Gogh, Clytie, Clytie van Gogh, Vulthoom; Region Netherlands, Europe, Greece; Chaotic Neutral; STR E, END B, AGI C, MAG A, LUC D; Base Health 1250; MOV 5; Range 3 panels / 1 target; BA(STR) 50, BA(MAG) 200; Sustainability 2◈ · *Untouched*
- [ ] **SB.attr** · Attributes Female, Servant, [Man], Humanoid, Threat to Humanity, Child · *Untouched*
- [ ] **SB.na** · Her Normal Attacks use her Base Attack (MAG) · *Untouched*

## Existence Outside The Domain — Class Skill, Rank A *(Passive)*

- [ ] **EO.1** · Chance of being inflicted by debuffs, Instakill included, is reduced by 25% · *Untouched*
- [ ] **EO.1.death** · …10% for Death · *Untouched*
- [ ] **EO.1.erase** · …5% for Erase · *Untouched*
- [ ] **EO.2.taken** · Damage received from Units with the Mad Enhancement Skill is reduced by 40% · *Untouched*
- [ ] **EO.2.taken.np** · …including NP · *Untouched*
- [ ] **EO.2.dealt** · Damage dealt to Units with the Mad Enhancement Skill is increased by 40% · *Untouched*
- [ ] **EO.2.dealt.np** · …including NP · *Untouched*
- [ ] **EO.3** · Damage received from Units with Existence Outside The Domain or the Outsider Attribute is increased by 40% · *Untouched*
- [ ] **EO.3.np** · …including NP · *Untouched*
- [ ] **EO.4** · Crit Chance is increased by 15% · *Untouched*
- [ ] **EO.5.def** · When a Unit with Active Mad Enhancement Attacks her, Mad Enhancement's damage boost is negated · *Untouched*
- [ ] **EO.5.atk** · When she Attacks a Unit with Active Mad Enhancement, Mad Enhancement's damage reduction is negated · *Untouched*

## Item Construction — Class Skill, Rank B− *(Passive 1 + 2)*

- [ ] **IC.reach** · Affects all allied Units within a 2-panel area of her · *Untouched*
- [ ] **IC.1** · Chance of inflicting debuffs is increased by 35% · *Untouched*
- [ ] **IC.1.ik** · …15% for Instakill · *Untouched*
- [ ] **IC.1.death** · …5% for Death · *Untouched*
- [ ] **IC.2** · Chance of being inflicted by debuffs is reduced by 35% · *Untouched*
- [ ] **IC.2.ik** · …15% for Instakill · *Untouched*
- [ ] **IC.2.death** · …5% for Death · *Untouched*
- [ ] **IC.stack** · Under several instances, only the highest-Rank Item Construction takes effect · *Untouched*

## Divinity — Rank B+ *(Passive)*

- [ ] **DV.1** · All damage dealt is increased by 45 · *Untouched*
- [ ] **DV.np** · …including NP · *Untouched*

## Insanity — Rank C *(Passive)*

- [ ] **IS.1** · All damage dealt is increased by 6% · *Untouched*
- [ ] **IS.np** · …including NP · *Untouched*

## Sunflower's Curse — Rank A *(Passive 1 + 2)*

- [ ] **SC.1** · She cannot be ordered to kill herself, even with a Command Spell · *Untouched*
- [ ] **SC.2** · Her Health cannot drop below 1 due to Curse · *Untouched*

## Imaginary Numbers Arts — Rank B+ *(Active)*

- [ ] **IN** · Used during her Turn · *Untouched*
- [ ] **IN.1** · Applies Guts to herself for 1◈+⅔◈ · *Untouched*
- [ ] **IN.1.revive** · …when defeated she is revived with 20% of her Max Health · *Untouched*
- [ ] **IN.2** · 500% chance of inflicting Curse on herself, 3 times · *Untouched*
- [ ] **IN.3** · Her NP Cooldown is reduced by ⅓◈ × the stage of Curse on her · *Untouched*
- [ ] **IN.cd** · Cooldown 4◈−⅓◈ · *Untouched*

## Het Gele Huis — Rank A+ *(Active)*

- [ ] **HG** · Used during her Turn · *Untouched*
- [ ] **HG.area** · Affects every enemy Unit in a 5x5 area in any non-diagonal direction next to her · *Untouched*
- [ ] **HG.e1** · 150% chance of inflicting Def Dwn for 1◈: damage taken +10% · *Untouched*
- [ ] **HG.e2** · Inflicts Def Dwn (C) for 1◈: damage taken +20% · *Untouched*
- [ ] **HG.e2.agi** · …and Agility −1 whenever that Unit is successfully Attacked · *Untouched*
- [ ] **HG.allies** · Then affects every allied Unit within a 2-panel area of her · *Untouched*
- [ ] **HG.a1** · Applies Evade for 1◈, 1 time · *Untouched*
- [ ] **HG.a2** · Applies Regen for 1◈+½◈: Health restored by 5% of its maximum · *Untouched*
- [ ] **HG.a2.when** · …at the end of the Unit's Turn, at the end of a Turn it Acts, and at the end of the Round · *Untouched*
- [ ] **HG.a3** · 500% chance of inflicting Curse on each affected ally · *Untouched*
- [ ] **HG.cd** · Cooldown 4◈−⅓◈ · *Untouched*
- [ ] **HG.block** · Cannot be used while The Yellow House is on Cooldown · *Untouched*

## Channel Marker Soul — Rank EX *(Passive 1 + 2)*

- [ ] **CM.1** · Curse damage taken is halved · *Untouched*
- [ ] **CM.2.inflict** · Whenever she is inflicted with Curse, her NP Cooldown is reduced by 1 Turn per stage inflicted · *Untouched*
- [ ] **CM.2.remove** · Whenever the 'Gogh' buff removes Curse from her, her NP Cooldown is reduced by 1 Turn per stage removed · *Untouched*

## Shadow of Longing Falls Upon the Water in the Urn — Rank EX *(Active)*

- [ ] **SL** · Used during her Turn, on an allied Unit within a 2-panel area of her · *Untouched*
- [ ] **SL.1** · Applies Atk Up for 1◈ to that ally: damage dealt +30% · *Untouched*
- [ ] **SL.1.np** · …if NP, 15% · *Untouched*
- [ ] **SL.2** · Applies Crit Up for 1◈ to that ally: Crit Chance +60% · *Untouched*
- [ ] **SL.g** · Applies the 'Gogh' buff to herself for 1◈ · *Untouched*
- [ ] **SL.g.1** · …whenever she performs a successful Attack, one stage of Curse is removed from her · *Untouched*
- [ ] **SL.g.atk** · …and if a stage was removed, Atk Up for 1◈: damage dealt +10% · *Untouched*
- [ ] **SL.g.atk.np** · …if NP, 5% · *Untouched*
- [ ] **SL.g.crit** · …if the Attack was a Crit, 2 stages are removed and the Atk Up is applied twice · *Untouched*
- [ ] **SL.g.stack** · …the buff does not stack: using it again resets its duration · *Untouched*
- [ ] **SL.pull** · Removes every Curse from every Unit within a 3-panel area of her · *Untouched*
- [ ] **SL.pull.apply** · …then applies them to herself, every stage · *Untouched*
- [ ] **SL.cd** · Cooldown 4◈ · *Untouched*

## De Sterrennacht: The Starry Night — Rank EX, NP, Anti-Unit

- [ ] **DS** · A Noble Phantasm, Rank EX, Anti-Unit, non-damaging, used during her Turn · *Untouched*
- [ ] **DS.terror** · Inflicts Terror for 1◈ on every enemy Unit in a 5x5 area in any non-diagonal direction next to her · *Untouched*
- [ ] **DS.terror.stun** · …Terror's chance of Stun is 60% · *Untouched*
- [ ] **DS.allies** · Then affects every allied Unit within a 3-panel area of her · *Untouched*
- [ ] **DS.1** · Applies Crit DmUp for 1◈: Crit Damage +100% · *Untouched*
- [ ] **DS.2** · Applies Crit DmUp for 1◈ again to each affected ally with Existence Outside the Domain: +100% · *Untouched*
- [ ] **DS.3** · Applies Atk Up for 1◈: damage dealt +X0%, X = 3 + the affected allies with Existence Outside the Domain, excluding her · *Untouched*
- [ ] **DS.3.np** · …if NP, the value is halved · *Untouched*
- [ ] **DS.4** · Applies Area CritUp for 1◈ to her: Crit Chance +10% for allied Units within a 2-panel area of her · *Untouched*
- [ ] **DS.cd** · Cooldown 8◈ · *Untouched*

## Het Gele Huis: The Yellow House — Rank A+, NP, Anti-Army

- [ ] **YH** · A Noble Phantasm, Rank A+, Anti-Army, non-damaging, used during her Turn · *Untouched*
- [ ] **YH.area** · Affects every enemy Unit in a 7x7 area in any non-diagonal direction next to her · *Untouched*
- [ ] **YH.e1** · 150% chance of inflicting Def Dwn for 2◈: damage taken +20% · *Untouched*
- [ ] **YH.e2** · Inflicts Def Dwn (C) for 2◈: damage taken +20% · *Untouched*
- [ ] **YH.e2.agi** · …and Agility −1 whenever that Unit is successfully Attacked · *Untouched*
- [ ] **YH.allies** · Then affects every allied Unit within a 2-panel area of her · *Untouched*
- [ ] **YH.a1** · Applies Evade for 2◈, 2 times · *Untouched*
- [ ] **YH.a2** · Applies Regen for 3◈: Health restored by 5% of its maximum, at the same three moments as `HG.a2.when` · *Untouched*
- [ ] **YH.a3** · 500% chance of inflicting Curse twice on each affected ally · *Untouched*
- [ ] **YH.cd** · Cooldown 7◈+⅓◈ · *Untouched*
- [ ] **YH.block** · Cannot be used while Het Gele Huis is on Cooldown · *Untouched*
