# Proto Gil — the Clause list

**Draft, 2026-10-16.** The audit issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Proto Gil.md` as it stands in the working copy (the sheet's 2026-10-16 edit:
Magic Resistance C now negates up to MAG C and cuts 30%, Divinity's +40 is Fixed Divine Damage,
Charisma's Active is 25%/10% at 4◈−⅓◈, Levitation reads *"Agility Check rolls"* and grants
*'Levitating'*, Enki costs half the Master's maximum Health *instead of* the normal cost and spares
Noah). The generated draft (`node tools/extract-clauses.mjs "Proto Gil"`) was read beside it and not
used: it bundled Enki into one line and Enkidu's rank ladder into unnamed notes.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**Built and pressed 2026-10-16.** 68 Clauses `Pressed` or `Observed` live, 35 pressed in the engine; the evidence per Clause is on #232,
the case chapter Ch. 46 §46.34. Appendix D §D.30 is rewritten for the sheet as edited 2026-10-16.

**Built to be reused.** Each piece is authored on the generic path other sheets already use, or
extends it so the next Servant with the same wording reuses it. His statblock is Ozymandias's (the
printed Base Attack and Health match the tables). Magic Resistance C is `class-magic-resistance`, Divinity B
is `divinity`, Independent Action A+ is Viy's wording without its Crit passive. Charisma is Penthesilea's
(`atkUpCharisma`). Golden Rule's Crit cut is Drake's, its NP Regen Penthesilea's and Drake's. Treasury of
Babylon is Arturia's Radiant Road. Bab-ilu's rank range and E cost are EMIYA's Unlimited Blade Works, its
3x3 Nursery Rhyme's, its die table Scáthach's Primordial Rune, its forced Block Toole Fragarach's sibling
reader. Enkidu is Karna's Vasavi Shakti ladder with Medea's Atlas chance modifiers. Enki's cost, gate and
single use are Ozymandias's Ramesseum Tentyris and Pyramid Drop; its Waterside is Pyramid Drop's `zone`.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6) · *"NP Cooldown"* naming no
NP reaches every NP (#197 reading 6) · an area that names no relation hits every Unit in it (#191
reading 11) · *"all allied Units"* includes the user unless the sheet says *"other"* · an effect
with no NP figure applies its full value against an NP (#204 reading 5) · Crit Up and Crit DmUp reach
an NP only when an NP figure is stated (#131) · an NP used on its owner's own Turn consumes his Attack,
on another's Turn nothing (§46.4-AZ) · a Charisma passive is off while its holder has Atk Up
(Charisma), from any source (#230 reading 23) · two different Atk Ups stack (#230 reading 4) · NP Seal
*"does not affect passive NPs unless stated"* (its own text; Karna's Kavacha and Kundala), so Bab-ilu's
passive survives it · a Charisma Active's Atk Up (Charisma) is an aura its holder carries, reaching him
too (Penthesilea's `atkUpCharisma`).

### Readings to settle

Asked by grilling, 2026-10-16. All built and pressed on 2026-10-16 (Ch. 46 §46.34).

**Round 1, ruled 2026-10-16.**

1. **What sets off Bab-ilu's passive** (`BI.p`). **Ruled:** any single-target Attack he performs at
   Range 2 or more: a Normal Attack, Enkidu, an attack Skill. Not an area Attack.
2. **The Move** (`BI.p`). **Ruled:** optional. The additional Normal Attack happens whether he Moves or not.
3. **What it costs** (`BI.p.atk`). **Ruled:** nothing: no Attack, no Move, no MOV. The additional Normal
   Attack never sets off the passive again.
4. *(What "has to Block" forbids: asked again in round 2.)*
5. **The same number twice** (`BI.same`, `BI.same.ext`, `BI.9`). **Ruled:** a stacking debuff lands that
   many times (two 2s, Def Dwn −60%); a non-stacking one has its Duration extended (two 10s, NP Seal 2◈);
   three 9s give one No Buff that blocks three buffs.
6. **Enkidu is an NP** (`EC.*`). **Ruled:** an NP that costs no Master Health. The NP Round gate, NP Seal
   and *"if NP"* figures apply to it, NP Cooldown cuts reach it, and it consumes his Attack on his own Turn.
7. **Enkidu's Divinity bonuses** (`EC.EX`…`EC.E`). **Ruled:** the damage bonus is added like an Atk Up;
   the Stun chance adds in points (50 + 100 = 150%).
8. **Golden Rule per Crit** (`GR.p`). **Ruled:** each Crit counts: three DUs critted, three cuts.
9. **Levitation's passage** (`LE.2`). **Ruled:** through any Unit, either side, and blocking terrain; he
   still cannot stop on an occupied or impassable panel.
10. **"Cannot Act"** (`EK.stop`). **Ruled:** nothing at all for 1◈, his Evade and Block included: Evading
    and Blocking are Acting.
11. **How Enki lands** (`EK.delay`, `EK.dmg`). **Ruled:** it counts down 7◈ like an effect's Duration and
    hits when that would run out, as his NP Attack, with his modifiers at that moment; each Unit hit may
    Evade or Block as normal. Only Golden Rule's fallback shortens it (reading 14).
12. **"Defeated"** (`EK.cancel`). **Ruled:** he leaves the board. A Guts revival does not cancel Enki.

**Round 2, ruled 2026-10-16.**

13. *(What "has to Block" forbids: asked again in round 3, with the ability's text.)*
14. **Golden Rule and Enki** (`GR.p.enki`). **Ruled:** only the passive's fallback shortens Enki's count, by
    1 Turn a Crit. NP Regen, Treasury of Babylon and every other NP Cooldown cut never touch it.
15. **"Agility Check rolls −3"** (`LE.3`). **Ruled:** every roll against his Agility, Evade included; a
    lower roll is better, so it helps him.
16. **Fixed Divine Damage** (`DI.fixed`, `DI.injury`). **Ruled:** the 40 is added after everything; no
    modifier on either side changes it. Invuln and a successful Evade still stop it, since nothing lands.
    *"Divine"* is a label on the card that nothing reads yet.
17. **NP Regen's size** (`GR.a`). **Ruled:** 2 on top of the natural 1: his NP Cooldowns fall 3 a Turn.
18. **Heal Dwn** (`BI.17`). **Ruled:** all healing he receives −30%, except Home Base and Command Spell
    healing, as Heal Up's catalogue row.
19. **Drowning** (`EK.drown`). **Ruled:** as Appendix A's row: Health cannot be restored; −50 Health at the
    end of each Turn that is its own or in which it acted; 80% chance that its Attacks and enemy-affecting
    abilities fail, no Cooldown spent on a failure; MOV −1; Swimsuit cuts the inflict chance by 20%. Its
    80% is its own, not Blind's: Blind's exceptions do not reach it.
20. **The new debuffs** (`BI.8`, `BI.12`…`BI.16`). **Ruled:** as Appendix A: AGL Dwn and LUC Dwn +3 on that
    Unit's rolls; MOV Dwn −3, never below 1; TEC Dwn −3 on enemies Evading its Attacks; Bal Dwn +30% Crit
    Chance to Attacks against it, not NP; Buff ChDwn −30% on its chance of buffing others.
21. **Noah** (`EK.spare.noah`). **Ruled:** built now: a Unit made from Noah's content, and its allies within
    2 of it, are spared. Pressed with a stand-in; it works the day Noah exists.
22. **A cancelled Enki** (`EK.cancel`, `EK.once`). **Ruled:** its one use is spent and his Master's Health
    stays lost.
23. **Enki hits his own side** (`EK.area`). **Ruled:** yes. Only he, his Master, Levitating Units and Noah's
    group are spared.

**Round 3, ruled 2026-10-16.**

24. **"Has to Block"** (`BI.p.block`, `BI.p.evade`). **Ruled:** a DU that Blocked the first Attack must Block
    the second: it can neither Evade nor take the hit. A reaction NP and a Counter still work. A DU that
    Evaded chooses Block or Evade; one that took the hit or failed its Evade chooses freely.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"Gilgamesh's Magic Resistance is elevated from Rank E to Rank C due to his golden armor."* — the
  gloss of the `C (E)` header; the rank it names is what `MR.1` reads.
- *"Surge of Utnapishtim."* — Enki's epithet.
- *"(5 panels to 6)"* — the gloss of `LE.1`.
- `Items held:` — an empty slot.

## Statblock

- [ ] **SB** · True Name Gilgamesh, Region Ancient Mesopotamia, Middle East, Chaotic Good, STR C, END C, AGI B, MAG A, LUC A, Base Health 1000, MOV 6 (5), Range 5 panels / 1 target, BA(STR) 100, BA(MAG) 200, Sustainability N/A · *Untouched*
- [ ] **SB.attr** · Attributes Male, Servant, [Sky], King, Humanoid · *Untouched*

## Independent Action — Class Skill, Rank A+ *(Passive 1 + 2 + 3)*

- [ ] **IA.1** · Sustainability does not apply · *Untouched*
- [ ] **IA.2** · His Master's ZON is increased by 3 panels · *Untouched*
- [ ] **IA.3** · He cannot be contracted by enemy Casters and Masters · *Untouched*

## Magic Resistance — Class Skill, Rank C (E) *(Passive 1 + 2)*

- [ ] **MR.1** · MAG damage from a MAG Rank of up to C is negated · *Untouched*
- [ ] **MR.1.over** · …otherwise MAG damage taken is reduced by 30% · *Untouched*
- [ ] **MR.1.np** · …also affects NP · *Untouched*
- [ ] **MR.2** · Chance of being inflicted by debuffs is reduced by 15% · *Untouched*
- [ ] **MR.2.death** · …also affects Instakill and Death · *Untouched*
- [ ] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance · *Untouched*
- [ ] **MR.2.erase** · Erase is completely unaffected · *Untouched*
- [ ] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced · *Untouched*

## Divinity — Rank B *(Passive)*

- [ ] **DI.1** · All damage he deals +40 · *Untouched*
- [ ] **DI.1.np** · …including NP · *Untouched*
- [ ] **DI.fixed** · The extra damage is dealt as Fixed Divine Damage · *Untouched*
- [ ] **DI.injury** · …and does not count towards the amount required for an Injury Roll · *Untouched*

## Charisma — Rank A+ *(Passive + Active)*

- [ ] **CH.1** · All damage dealt by other allied Units within 2 panels of him +27, NP included · *Untouched*
- [ ] **CH.1.self** · …not his own damage (*"other"*) · *Untouched*
- [ ] **CH.neg.atk** · Negated while he has Atk Up (Charisma) · *Untouched*
- [ ] **CH.neg.seal** · Negated while he is Skill Sealed · *Untouched*
- [ ] **CH.when** · The Active is used during his Turn · *Untouched*
- [ ] **CH.a.self** · Atk Up (Charisma) 1◈ on himself · *Untouched*
- [ ] **CH.a** · All damage dealt by allied Units within 2 panels of him +25% · *Untouched*
- [ ] **CH.a.np** · …if NP, 10% · *Untouched*
- [ ] **CH.cd** · Cooldown 4◈−⅓◈ · *Untouched*

## Golden Rule — Rank A *(Passive + Active)*

- [ ] **GR.p** · Whenever he performs a Crit, his NP Cooldown −1 Turn · *Untouched*
- [ ] **GR.p.enki** · …if none of his NPs is on Cooldown, Enki's Turn count −1 Turn instead, if Enki has been activated · *Untouched*
- [ ] **GR.when** · The Active is used during his Turn · *Untouched*
- [ ] **GR.a** · NP Regen 1◈ on himself: his NP Cooldown −2 Turns at the end of every Turn · *Untouched*
- [ ] **GR.cd** · Cooldown 4◈ · *Untouched*

## Treasury of Babylon — Rank EX *(Active)*

- [ ] **TB.when** · Used during his Turn · *Untouched*
- [ ] **TB.1** · His NP Cooldown −1◈ · *Untouched*
- [ ] **TB.2** · …then Crit Up 1◈ on himself: Crit Chance +60% · *Untouched*
- [ ] **TB.cd** · Cooldown 4◈ · *Untouched*

## Levitation *(Passive 1 + 2 + 3 + 4)*

- [ ] **LE.1** · His MOV +1 · *Untouched*
- [ ] **LE.2** · When he Moves he can Move through obstacles (e.g. enemy Units) · *Untouched*
- [ ] **LE.2.master** · …but still cannot enter the area around an enemy Master (Master-Servant Relationships) · *Untouched*
- [ ] **LE.3** · His Agility Check rolls −3 · *Untouched*
- [ ] **LE.4** · He gains the 'Levitating' Attribute · *Untouched*
- [ ] **LE.seal** · All four are negated while he is NP Sealed · *Untouched*

## Bab-ilu: Key of the King's Law To Enshrine — Rank E~A++, NP, Anti-Unit *(Passive + Active)*

- [ ] **BI.p** · When he Attacks an enemy Unit at a Range of 2 or higher, he can Move to any panel directly next to the DU… · *Untouched*
- [ ] **BI.p.atk** · …and perform an additional Normal Attack on that DU · *Untouched*
- [ ] **BI.p.block** · If the DU Blocked the first Attack, it must Block the second · *Untouched*
- [ ] **BI.p.evade** · If the DU successfully Evaded the first Attack, it chooses Block or Evade for the second · *Untouched*
- [ ] **BI.ba** · The Active uses Base Attack (STR) · *Untouched*
- [ ] **BI.area** · Hits a 3x3 panel area within Range · *Untouched*
- [ ] **BI.dmg** · 3x damage · *Untouched*
- [ ] **BI.roll** · Then every affected DU rolls 3 twenty-sided dice and is inflicted with the matching debuffs for 1◈ · *Untouched*
- [ ] **BI.1** · 1: Atk Dwn 30% · *Untouched*
- [ ] **BI.1.np** · …if NP, 15% · *Untouched*
- [ ] **BI.2** · 2: Def Dwn 30% · *Untouched*
- [ ] **BI.3** · 3: Crit Dwn 30% · *Untouched*
- [ ] **BI.4** · 4: Crit DmDwn 30% · *Untouched*
- [ ] **BI.5** · 5: NP DmDwn 30% · *Untouched*
- [ ] **BI.6** · 6: Debuff ResDwn 30% · *Untouched*
- [ ] **BI.7** · 7: Debuff ChDwn 30% · *Untouched*
- [ ] **BI.8** · 8: Buff ChDwn 30% · *Untouched*
- [ ] **BI.9** · 9: No Buff, 1 time per die that rolled a 9 · *Untouched*
- [ ] **BI.10** · 10: NP Seal · *Untouched*
- [ ] **BI.11** · 11: Skill Seal · *Untouched*
- [ ] **BI.12** · 12: AGL Dwn (+3) · *Untouched*
- [ ] **BI.13** · 13: LUC Dwn (+3) · *Untouched*
- [ ] **BI.14** · 14: MOV Dwn (−3) · *Untouched*
- [ ] **BI.15** · 15: TEC Dwn (−3) · *Untouched*
- [ ] **BI.16** · 16: Bal Dwn 30% · *Untouched*
- [ ] **BI.17** · 17: Heal Dwn 30% · *Untouched*
- [ ] **BI.18** · 18: NP Degen: NP Cooldown +1 Turn at the end of every Turn · *Untouched*
- [ ] **BI.19** · 19: Terror 30% · *Untouched*
- [ ] **BI.20** · 20: Decoy · *Untouched*
- [ ] **BI.same** · A number rolled more than once applies its debuff that many times · *Untouched*
- [ ] **BI.same.ext** · …a debuff that does not stack has its duration extended instead · *Untouched*
- [ ] **BI.cost** · His Master loses Health as if an E Rank NP were used · *Untouched*
- [ ] **BI.cd** · Cooldown 3◈ · *Untouched*

## Enkidu: Chains of Heaven — Rank ???, Anti-Unit/Anti-Divine

- [ ] **EC.target** · Range 3 · *Untouched*
- [ ] **EC.dmg** · Base Attack (STR), normal damage · *Untouched*
- [ ] **EC.stun** · 50% chance of Stun for 1◈ · *Untouched*
- [ ] **EC.EX** · Against a DU with Divinity EX: damage +150%, Stun chance +100% · *Untouched*
- [ ] **EC.A** · …Divinity A: damage +100%, Stun chance +50% · *Untouched*
- [ ] **EC.B** · …Divinity B: damage +80%, Stun chance +40% · *Untouched*
- [ ] **EC.C** · …Divinity C: damage +60%, Stun chance +30% · *Untouched*
- [ ] **EC.D** · …Divinity D: damage +40%, Stun chance +20% · *Untouched*
- [ ] **EC.E** · …Divinity E: damage +20%, Stun chance +10% · *Untouched*
- [ ] **EC.divine** · A DU with the 'Divine' Attribute but no Divinity Skill counts as Rank A · *Untouched*
- [ ] **EC.immune** · Against a 'Divine' DU, Debuff Immune effects cannot prevent the Stun, even Stun-specific ones · *Untouched*
- [ ] **EC.resist** · …Debuff Resist still reduces its chance · *Untouched*
- [ ] **EC.free** · Does not decrease his Master's Health · *Untouched*
- [ ] **EC.cd** · Cooldown 5◈ · *Untouched*

## Enki: Sword of the End — Rank EX, NP

- [ ] **EK.cost** · On Activation his Master's Health is reduced by half its maximum, instead of the normal cost · *Untouched*
- [ ] **EK.gate** · Cannot be used while his Master's Health is at or below half its maximum · *Untouched*
- [ ] **EK.stop** · He cannot Act for 1◈ after Activation · *Untouched*
- [ ] **EK.mark** · The panel he stood on gains the 'Utnapishtim' mark · *Untouched*
- [ ] **EK.delay** · 7◈ after Activation it hits… · *Untouched*
- [ ] **EK.area** · …a 13x13 panel area centred on the 'Utnapishtim' panel · *Untouched*
- [ ] **EK.dmg** · …for 5x damage plus 700, Base Attack (MAG) · *Untouched*
- [ ] **EK.drown** · …500% chance of Drowning for 3◈ · *Untouched*
- [ ] **EK.water** · Water damage · *Untouched*
- [ ] **EK.waterside** · Then the area becomes a Waterside area for 7◈ · *Untouched*
- [ ] **EK.spare** · Proto Gil and his Master are not affected · *Untouched*
- [ ] **EK.spare.lev** · Units with the 'Levitating' Attribute are not affected · *Untouched*
- [ ] **EK.spare.noah** · Noah and Noah's allied Units within 2 panels of Noah are not affected · *Untouched*
- [ ] **EK.once** · Usable once in the entire game · *Untouched*
- [ ] **EK.cancel** · If he is defeated in those 7◈, before it hits, it is cancelled · *Untouched*
