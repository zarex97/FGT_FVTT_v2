# Siegfried (Saber) — the Clause list

*Siegfried*, the Saber, built from `char_orig_sheets/by-class/Saber/Siegfried.md`. Started by the user 2026-10-26.

**Audit opened 2026-10-26 (#341).** **Read by hand, line by line.** No generated draft was used. The older copy `char_orig_sheets/Copia de Siegfried.md`
was compared with it. The by-class copy:

- adds `N.Atk Type: STR, Melee`, and the `{R}` delivery tag on Balmung;
- adds Armor of Fafnir's clause 5, *"Effects 1 and 2 are negated if Siegfried is affected by NP Seal?"*;
- adds Balmung's gloss of an Anti-Dragon effect, *"(any buffs/effects which increase damage dealt/reduce damage
  taken from 'Dragon' Attribute Units)"*.

The by-class copy is the one read.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Most of him is other Servants' pieces:

- **Riding B** is `class-riding-unlocks` at B, 2◈, MOV 4. Gilles de Rais (Saber) prints the same block word for word
  (#260); Karna and Raikou ride the same template.
- **Golden Rule C-** is `golden-rule` at C-, 55%. The template's own comment already names him (#260).
- **Disengage A** is the ranked `disengage` template at A: 5 panels, 25%, every debuff, 3◈. #339 ruling 3 names him.
- **Avaricious Gold**'s NP Regen is `npRegen` at 1, as Drake's, Gilles's and Hassan's are; its Atk Up is the common
  one with its NP figure.
- **Dragon Slayer**'s Dmg Up (Dragon) is Scáthach's Dmg Up (Gods) with another Attribute: Appendix A's Dmg Up, which
  takes no reduced magnitude against an NP. The sheet strikes both NP figures, so the struck text agrees. Ward
  (Dragon) is `ward` with a predicate on the attacker's Attribute.
- **Armor of Fafnir**'s cuts are *"Total damage"* cuts read off the attacker: Achilles's Andreias Amarantos,
  `AttackerPropertyTier` at stage 15. From behind is the cone stamped at declaration, `attack:cone:back` (#184).
  Its *"Def Up, Dmg Cut, Invuln, and any other damage reducing effects ... do not apply"* is Achilles's Heel's
  `ignoresDefensiveBuffs`. Its Max Health loss is Olga Marie's Gyakkou write on `health.max` (#328 ruling 10).
- **Anti-Dragon** is `attack:vsAttribute:dragon`, the Kagome Spirits' *"an Attack that deals extra damage to Dark
  Units"*, read off the attacker's active damage modifiers.
- **Balmung** is Excalibur's frame: `selfEdgeAdjacent`, `orientedRect` turnable (#230 reading 13), every Unit in it
  (#191 reading 11), BA(MAG), `{R}`, and the Attribute's extra damage as a `conditionalMultipliers` row.

What he needs that nobody has yet, each built as a generic piece:

- **A Total cut keyed on the attacker's Parameter Rank or the NP's Rank** (AF.1, AF.2): Andreias Amarantos's tier
  reads the attacker's Divinity. Armor of Fafnir reads STR or MAG for an Attack, Skill or Spell, and the NP's own
  Rank for an NP, with a full negation at or under the threshold.
- **Bypasses on that cut** (AF.3, AF.4, AF.5): Anti-Dragon, from behind, and NP Seal.
- **A Max Health loss equal to the damage taken from behind** (AF.4.max): Gyakkou's write takes a percent; this one
  takes the event's damage.
- **The Golden Rule cut lengthened by a buff** (AV.rg.cut): Rheingold makes it 1◈. Edmond Dantès's Monte prints the
  same sentence at ⅓◈, so the length is a parameter.
- **An NP Regen sized by a count of his effects** (BM.regen): one Turn per Anti-Dragon effect on him, passives left out.
- **The attack's own Anti-Dragon** (AF.3.attack): `attack:vsAttribute` reads only the attacker's modifiers today. An
  ability's own `conditionalMultipliers` row against an Attribute (Balmung's, Excalibur's against Dark) emits
  nothing, so Balmung would not count as Anti-Dragon against another Dragon.

**84 Clauses** across 8 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"Applies the following effects-"*, *"Has several effects-"*: headings.
- *"(i.e. deals extra damage to Units with the 'Dragon' Attribute)"*: the gloss of AF.3's Anti-Dragon, read there.
- *"~~; if NP, 10%~~"* and *"~~; if NP, 35%~~"*: struck, so superseded (Nursery Rhyme R1, Arjuna). Read as DS.p.np
  and DS.dmg.np.
- *"Blood Armor of the Evil Dragon"*, *"Phantasmal Greatsword, Felling of the Sky Demon"*: the NPs' titles.
- `Items held:`: an empty slot.

## Readings to settle

Asked by grilling, 2026-10-26. Rulings are written here as they land. **Built 2026-10-26** on `claude/siegfried`
(`test/unit/siegfried-341.test.mjs`, 23 tests) and pressed as Player1 in a War of its own, `NZCYYuJvGQAANjhR` on the
scene *Siegfried Audit*, apart from the match being played. 83 of the 84 Clauses end Pressed or Observed live
(second session, the same day); RD.ps.ra is the template's, pressed on Gilles: his Master had fallen before the ride. Case chapter §46.52.

**Round 1, ruled 2026-10-26 (the user).** Q2 and Q7 were asked again with the quotations and ruled the same day (round 1b).

| # | Ruling |
|---|---|
| 1 | He holds no Magic Resistance: debuff chances are not cut, and Armor of Fafnir is not his Magic Resistance, so an attack *"not affected by Magic Resistance"* still meets the Armor (MR.none, MR.see). |
| 2 | Effect 1 reads the attacker's own Parameter, never the Skill's Rank: *"from Units with a STR Rank or MAG Rank"*. Which one by the damage type, as Edmond Dantès reads the same words (*"the AU's STR or MAG Rank, depending on which type of damage the Attack used"*): STR damage reads STR, MAG damage reads MAG, a mixed attack its stated damage type. B+ is above B. Ruled in round 1b (AF.1.null). |
| 3 | An attacker with no STR or MAG Rank, and an NP with no Rank, is not *"B or lower"*: it takes the 75% cut, never the negation. Magic Resistance's own unranked fallback (AF.1.null, AF.2.null). |
| 4 | *"Nullified"* is every point of the hit, Divinity's Fixed damage included: a negation, never a stage-15 factor of 0 that stage 16's Fixed add would undo. The 75% is a stage-15 Total cut, and Fixed damage is added after it, uncut (AF.1.*, AF.2.*). |
| 5 | Anti-Dragon (AF.3) is an attack whose own damage rises against the Dragon Attribute (Balmung's +200%, George's NPs), or an AU holding an active damage-dealt modifier against Dragon, Passives included. A Ward against Dragon is not one. Arturia's `attack:tag:antiDragon` reads this same rule (AF.3.*). |
| 6 | From behind is the Heel's `ignoresDefensiveBuffs`, Invuln named with it. Block (a reaction), Substitution and Anti-Purge (negations, not cuts) still hold, and Evade stays (AF.4.def). |
| 7 | The hit from behind lowers his current Health as usual; then Max Health drops by the Health he actually lost, never cutting current twice: 1500/1500 hit for 400 is 1100/1100, and 300/1500 hit for 500 is 0/1200. Max never drops below 1. The loss lasts the War; a revival restores a share of the lowered Max, as Gyakkou's (#328 ruling 10). Ruled in round 1b (AF.4.max). |
| 8 | NP Seal turns off effects 1 and 2; effect 4's penalties stay. The same line on Achilles's Andreias Amarantos (*"This effect is negated if Achilles is affected by NP Seal?"*) is built with it (AF.5.*). |
| 9 | NP Regen (Balmung) is counted once, when Balmung lands, and holds that magnitude for 1◈. Each distinct Anti-Dragon effect on him counts once, from any source; Ward (Dragon) and Dmg Up (Dragon) make 2 (BM.regen.*). |
| 10 | Golden Rule rolls once per Crit Process: a Balmung that crits three Units rolls three dice, as the template does (GR). |

**Round 2, ruled 2026-10-26 (the user).** The frontier is empty.

| # | Ruling |
|---|---|
| 11 | A nullified hit loses its damage only, as the sheet names (*"Damage from ... are completely nullified"*; Ko-Gil's *"damage and effects negated"* is the contrast). Its riders still land; a rider that asks for damage dealt fails, 0 having been dealt. The 75% cut touches damage alone (AF.1.null, AF.2.null). |

## Statblock

- [x] **ST.name** · True Name: Siegfried · *Observed live* — Player1's bar and sheet (War NZCYYuJvGQAANjhR, 2026-10-26); projected in `siegfried-341.test.mjs`
- [x] **ST.class** · Class: Saber · *Observed live* — Player1's bar, "Siegfried SABER" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.region** · Region: Germany · *Observed live* — his sheet as Player1: "SABER · CHAOTIC GOOD · GERMANY" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.align** · Alignment: Chaotic Good · *Observed live* — his sheet: "CHAOTIC GOOD" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.param** · STR B+, END A, AGI B, MAG C, LUC E · *Observed live* — his sheet: STR B+, END A, AGI B, MAG C, LUC E (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.attr** · Attributes: Male, Servant, [Earth], Dragon, King, Humanoid · *Pressed* — Dragon: Balmung's +200% and Dmg Up (Dragon) met the second Siegfried (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.hp** · Base Health 1500 · *Observed live* — Health 1500 / 1500 on Player1's bar (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.mov** · MOV 5 · *Observed live* — MOV 5, 9 under Riding's +4 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.range** · Range 1 panel, 1 target · *Observed live* — his sheet: Range 1, Targets 1 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.ba** · Base Attack STR 185, MAG 150 · *Pressed* — Balmung: "BA(MAG) × 1: 150"; BA(STR) 135 by the table (§46.6), projected in `siegfried-341.test.mjs`
- [x] **ST.na** · Normal Attack: STR, Melee · *Observed live* — "Counter with a Normal Attack", Melee (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.sus** · Sustainability 2◈ · *Observed live* — his sheet: Sustainability 2◈; as a Free Servant it ran out and he fell, "sustainabilityExhausted" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **ST.items** · Items held: none · *Observed live* — none on his sheet (War NZCYYuJvGQAANjhR, 2026-10-26)

## Magic Resistance — Rank — *(Class Skill)*

- [x] **MR.none** · Rank —: he holds no Magic Resistance of his own · *Pressed* — Ansuz's Burn landed on him, its chance uncut; no Magic Resistance row (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **MR.see** · *"See 'Armor of Fafnir'"*: what stands in for it is the Armor · *Pressed* — Soaring Spear, *not affected by Magic Resistance*, still nullified by the Armor (War NZCYYuJvGQAANjhR, 2026-10-26)

## Riding — Class Skill, Rank B *(Active + 3 Passives)*

- [x] **RD.when** · *(Active)* Used during his Turn · *Pressed* — Riding from Player1's bar on his Turn; "Only during your Turn" on Faction 2's (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **RD.mov** · MOV +4 for this Turn · *Pressed* — MOV 5 → 9 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **RD.notbuff** · …not a buff: not removed by buff removal, not prevented by an effect that prevents buffs · *Pressed* — Riding under No Buff: MOV 9 / 9, where Dragon Slayer's buffs read "— No Buff"; Riding (Active) is a status, unremovable (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **RD.unlock** · Double Move, Riding Attack and Passenger Seat usable on this Turn only · *Pressed* — Riding Attack and Passenger Seat buttons on his bar after the Active (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **RD.dm** · *(P1)* Double Move: Move twice, once before and once after Attacking; total ≤ his MOV · *Pressed* — moved 1, Normal Attack on Cú (147), moved 2: "Moved 3 of 9 panels · 2 move segment(s)" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **RD.ra** · *(P2)* Riding Attack: Attack every Unit in his path moving in a straight line, as his Normal Attack · *Pressed* — Riding Attack east along his row through Cú: 74, then 141 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **RD.ra.stop** · …cannot Attack or Move after he has stopped · *Pressed* — a Move after the ride: "Riding Attack ends this Unit's Turn; it cannot Move again." (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **RD.ra.left** · …if he already Moved, its panels are his MOV minus the panels Moved · *Pressed* — after 2 panels moved, the ride's lines reached 7, his MOV 9 less 2 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **RD.ps** · *(P3)* Passenger Seat: his Master Moves with him, same orientation and position after; counts as Moving one Unit · *Pressed* — Carry Master: his Master moved with him on both moves, same offset (War NZCYYuJvGQAANjhR, 2026-10-26)
- [ ] **RD.ps.ra** · Passenger Seat and Riding Attack combine · *Observed (template)* — `class-riding-unlocks`, pressed on Gilles (#260); not pressed on him: his Master fell to Balmung before his ride
- [x] **RD.cd** · Cooldown 2◈ · *Pressed* — "Riding — Cooldown 2◈ (6 turns)" (War NZCYYuJvGQAANjhR, 2026-10-26)

## Golden Rule — Rank C- *(Passive)*

- [x] **GR** · Each Crit he performs: 55% chance his NP Cooldown −1 Turn · *Pressed* — each Balmung crit cut his NP Cooldown: "24 → 21", "21 → 18" under Rheingold; "24 → 23" without it (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **GR.roll** · …the die is on the card, a miss included · *Pressed* — "Rolls (1)" on each Balmung card (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **GR.np** · …the NP that is cooling: Balmung, his only Active NP · *Pressed* — Balmung's own clock cut (War NZCYYuJvGQAANjhR, 2026-10-26)

## Avaricious Gold — Rank A

- [x] **AV.when** · Used during his Turn · *Pressed* — from Player1's bar on his Turn (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AV.rg** · Applies Rheingold for 1◈ · *Pressed* — Rheingold on him, expiry 1◈ (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AV.rg.cut** · …while it holds, a successful Golden Rule cuts NP Cooldown by 1◈ instead of 1 Turn · *Pressed* — under Rheingold each Golden Rule cut 3 Turns, 1◈ (War NZCYYuJvGQAANjhR, 2026-10-26); `siegfried-341.test.mjs`
- [x] **AV.regen** · Applies NP Regen for 1◈: NP Cooldown −1 Turn at the end of every Turn · *Pressed* — Balmung 18 → 14 at his Turn's end: 1 natural, NP Regen 1, NP Regen (Balmung) 2 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AV.atk** · Applies Atk Up for 1◈: all damage dealt +30% · *Pressed* — Atk Up 30 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AV.atk.np** · …if NP, +15% · *Pressed* — Balmung's breakdown "atkUp: 15" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AV.self** · Every effect lands on him · *Pressed* — every effect on him (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AV.cd** · Cooldown 4◈ · *Pressed* — "Avaricious Gold — Cooldown 4◈ (12 turns)" (War NZCYYuJvGQAANjhR, 2026-10-26)

## Disengage — Rank A

- [x] **DE.when** · Used at the start of a Combat Phase in which he is Attacked · *Pressed* — offered to Player1 at each Attack on him (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DE.cancel** · The enemy Unit's Attack is cancelled · *Pressed* — "Caster's Attack is cancelled by Disengage." (Medea's Aero) (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DE.move** · He may Move 5 panels · *Pressed* — "Move up to 5 panels"; "Moved to (7, 9)" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DE.heal** · …then restores 25% of his maximum Health · *Pressed* — "Health 1011 → 1135 (+124)": 25% of 1135, capped at his lowered maximum (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DE.debuff** · …and removes all debuffs from himself · *Pressed* — "Burn removed", "Atk Dwn removed" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DE.order** · Move first, then the heal and the removal · *Pressed* — the move, then the heal and the removals, in the card's order (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DE.cd** · Cooldown 3◈ · *Observed* — Disengage not offered again while it cooled (War NZCYYuJvGQAANjhR, 2026-10-26)

## Dragon Slayer — Rank A++

- [x] **DS.p** · *(Passive)* All damage dealt to Units with the Dragon Attribute +20% · *Pressed* — Balmung on the second Siegfried: "Dragon Slayer: 20" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.p.np** · …an NP's too, at 20% · *Pressed* — the 20 on an NP (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.when** · *(Active)* Used during his Turn · *Pressed* — from Player1's bar (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.ward** · Applies Ward (Dragon) for 1◈: all damage received from Dragon Units −30% · *Pressed* — the second Siegfried's Normal Attack on him: "wardDragon: −30" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.ward.np** · …an NP's too, at 30% · *Pressed* — the second Siegfried's Balmung on him: "wardDragon: −30", the full 30 on an NP (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.dmg** · Applies Dmg Up (Dragon) for 1◈: all damage dealt to Dragon Units further +60% · *Pressed* — "dmgUpDragon: 60" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.dmg.np** · …an NP's too, at 60% · *Pressed* — at 60 on Balmung (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.dmg.stack** · *"Further"*: it adds to the Passive's 20 · *Pressed* — 20 and 60 side by side at stage 4 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.atk** · Applies Atk Up for ⅓◈: all damage dealt +60% · *Pressed* — Atk Up 60 for ⅓◈ (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.atk.np** · …if NP, +40% · *Pressed* — Balmung's breakdown "atkUp: 40" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.self** · Every effect lands on him · *Pressed* — every effect on him (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **DS.cd** · Cooldown 4◈−⅔◈ · *Pressed* — "Dragon Slayer — Cooldown 3⅓◈ (10 turns)" (War NZCYYuJvGQAANjhR, 2026-10-26)

## Armor of Fafnir: Blood Armor of the Evil Dragon — Rank B+ *(NP, Anti-Unit (Self), Passive)*

- [x] **AF.np** · A passive Noble Phantasm, Rank B+, Anti-Unit (Self) · *Observed live* — Player1's sheet (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.1.kinds** · Effect 1 reaches Normal Attacks, Attack Skills and Damage Spells · *Pressed* — Normal Attacks (Cú, Heracles), Damage Spells (Ansuz, Aero) (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.1.null** · …from a Unit with a STR or MAG Rank of B or lower: the damage is nullified · *Pressed* — Cú's Normal Attack: "0 · Negated by Armor of Fafnir", "nullified, STR B ≤ B", Divinity's 40 gone; Ansuz (MAG C) 0 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.1.cut** · …from any other Unit: their Total damage −75% · *Pressed* — Heracles 124, "−75% Total, STR A+"; Aero 121, "−75% Total, MAG A+", Medea's STR E unread (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.2.null** · Effect 2: a damaging NP of Rank B+ or lower: the damage is nullified · *Pressed* — Soaring Spear: 0, "nullified, NP Rank B+ ≤ B+" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.2.cut** · …of a higher Rank: its Total damage −75% · *Pressed* — Heracles's Nine Lives: 302, "−75% Total, NP Rank A+" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.other** · Damage that is none of these (a periodic tick, a field's) meets neither effect · *Pressed* — "Saber takes 50 from Burn", whole (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.3.attack** · Effects 1 and 2 are bypassed by an Attack, Skill, Spell or NP with an Anti-Dragon effect · *Pressed* — Balmung on the second Siegfried: 6486, no Armor row (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.3.au** · …or when the AU has an Anti-Dragon effect · *Pressed* — Heracles holding Dmg Up (Dragon): 340, no Armor row; the second Siegfried, Dragon Slayer's Passive alone: no Armor row (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.3.def** · …Anti-Dragon: it deals extra damage to Units with the Dragon Attribute · *Pressed* — both bypasses above; a Ward is not one (`siegfried-341.test.mjs`)
- [x] **AF.4.back** · Effects 1 and 2 are bypassed when he is Attacked from behind · *Pressed* — Heracles from his back cone: "Armor of Fafnir (bypassed)", 365 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.4.max** · …damage he takes from behind reduces his Max Health as well as his current Health · *Pressed* — "Health max 1500 → 1135"; bar 1011 / 1135 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.4.def** · …and Def Up, Dmg Cut, Invuln and every other damage-reducing effect on him do not apply · *Pressed* — "Def Up (bypassed)", "Invuln (bypassed)" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.5.seal** · Effects 1 and 2 are negated while he is affected by NP Seal *(the sheet's "?")* · *Pressed* — Cú's Normal Attack under NP Seal: 122, no Armor row (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **AF.5.only** · …effects 3 and 4 are not: from behind, the Max Health loss and the bypass still hold · *Pressed* — Aero at his back under NP Seal: 613, no Armor row, "Health max 1135 → 522" (War NZCYYuJvGQAANjhR, 2026-10-26)

## Balmung: Phantasmal Greatsword, Felling of the Sky Demon — Rank EX *(NP, Anti-Army)*

- [x] **BM.np** · A Noble Phantasm, Rank EX, Anti-Army · *Observed live* — Player1's bar, Rank EX (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.when** · Used during his Turn · *Pressed* — from Player1's bar on his Turn; refused outside the Master's ZON (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.ranged** · `{R}`: a Ranged Attack · *Pressed* — card "RANGED" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.ba** · Base Attack (MAG) is used · *Pressed* — "BA(MAG) × 1: 150" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.area** · Hits a 5x3 or 3x5 panel area, in any non-diagonal direction, next to him · *Pressed* — four ghost blocks beside him; east placed, 5 by 3 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.hit** · …every Unit in it · *Pressed* — Balmung south hit his own Master for 915 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.dmg** · 5x damage · *Pressed* — "5× damage" (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.dragon** · …further +200% against Units with the Dragon Attribute · *Pressed* — "Dragon (+200%): 3" on the second Siegfried only (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.regen.if** · Then, if he has any Anti-Dragon effect: NP Regen (Balmung) on him for 1◈ · *Pressed* — NP Regen (Balmung) landed; with none on him the card read "NP Regen (Balmung): noop, counted none" (`siegfried-341.test.mjs`)
- [x] **BM.regen** · …his NP Cooldown −1 Turn at the end of every Turn for every Anti-Dragon effect on him · *Pressed* — magnitude 2, and 2 more off the clock at his Turn's end (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.regen.def** · …Anti-Dragon: any buff or effect that raises damage dealt to, or cuts damage taken from, Dragon Units · *Pressed* — Ward (Dragon) and Dmg Up (Dragon) counted (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.regen.passive** · …a Passive's Anti-Dragon effect does not count · *Pressed* — Dragon Slayer's Passive held, count 2 not 3 (War NZCYYuJvGQAANjhR, 2026-10-26)
- [x] **BM.cd** · Cooldown 8◈ · *Pressed* — "Cooldown 24 → 21": 8◈ (War NZCYYuJvGQAANjhR, 2026-10-26)
