# Arturia — the Clause list

**Draft, 2026-10-16.** The audit issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Arturia.md`. The generated draft (`node tools/extract-clauses.mjs Arturia`)
was read beside it and not used: it bundled her into 70 lines and left `IA.pre` and `AV.pre` unnamed.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**Nothing is built.** No `packs/_source/servants/` file exists for her, and no Appendix D section.

**Built to be reused.** Each piece is authored on the generic path other sheets already use, or
extends it so the next Servant with the same wording reuses it: Riding B is `class-riding-unlocks`
(Karna, Raikou), Magic Resistance is `class-magic-resistance`, Charisma follows Penthesilea's,
Mana Burst follows Karna's, Excalibur follows Ozymandias' Mesektet, Strike Air follows Nemo's Barrel
Bombing, Instinct follows Medea's Trofa (`autoEvade`).

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6) · *"NP Cooldown"* naming no
NP reaches every NP (#197 reading 6) · an area that names no relation hits every Unit in it (#191
reading 11) · *"all allied Units"* includes the user unless the sheet says *"other"* · an effect
with no NP figure applies its full value against an NP (#204 reading 5) · Crit Up and Crit DmUp reach
an NP only when an NP figure is stated (#131) · a Mana Burst counts as its user's Normal Attack and
never rides a Riding Attack (#206, §46.4-MC) · *"Evade rolls are reduced"* helps the roller, as
Achilles' Dromeus Kometes (a higher Evade roll is worse) · the Dark doubling sits inside the
multiplier bracket (#189 readings 2, 18) · *"not affected by damage modifying effects on"* the user
bypasses the attacker's side only (Nemo) · S.Crit Up is an aura held by its caster (#132).

### Readings to settle

Asked by grilling, 2026-10-16. Rulings are written here as they land. None is built.

**Round 1, ruled 2026-10-16.**

1. **Base Attack (STR)** (`SB`, `MB.ba`). **Ruled:** the table: 125 at STR B, not the printed 175.
   Mana Burst's combined Base Attack is 325, not the printed 375.
2. **"Her Master's Servant Range"** (`MB.oncd`). **Ruled:** her Master's ZON, the Effective Servant
   Zone.
3. *(Knight of Utopia's Atk Ups as Atk Up (Charisma): ruled in round 2, reading 23.)*
4. **Two Atk Ups** (`KU.1`, `KU.2`). **Ruled:** they stack. She and a Round Table ally take +50%,
   NP +25%.
5. **"3 Attacks"** (`KU.3`). **Ruled:** any Attack she performs, hit or miss, NPs included.
6. **"200% extra damage"** (`KU.3.fire`). **Ruled:** +200%, added like an Atk Up.
7. **A Unit hit** (`KU.4`, `EX.cut`). **Ruled:** a Unit that took the hit, Blocked included; one
   that Evaded or had it negated does not count. Excalibur counts the allies it hit too.
8. **Radiant's Instinct** (`RR.3`). **Ruled:** both parts, the 70%/35% auto-Evade and Crit +10%.
   Only her Skill Seal stops it. An ally with an Instinct of its own rolls once, not twice.
9. **DRC's start** (`DRC.3`). **Ruled:** at the end of the Turn she used it; her later attacks that
   Turn do not get it.
10. **Switching Invisible Air** (`IA.lock`). **Ruled:** at any time, an enemy's Turn included, once
    per Turn. It cannot be switched on while Strike Air's or Excalibur's lockout runs.
11. **Strike Air** (`SA.dmg`). **Ruled:** not MAG damage, so Magic Resistance never cuts it. It works
    with Invisible Air on or off.
12. **Excalibur's passive** (`EX.p`). **Ruled:** plain Normal Attacks only: not a Mana Burst, not a
    Riding Attack.
13. **Excalibur's area** (`EX.area`). **Ruled:** both shapes, touching her side, the player's pick.
    The 6-deep one is centred on her row or column; the 6-wide one takes one of its two placements,
    the player's pick.
14. **No 8, no Avalon** (`AV.gate`). **Ruled:** without the Item she has neither method.
15. **Avalon against an AoE** (`AV.1.aoe`). **Ruled:** every Unit within 1 panel of her, enemies
    included (#191 reading 11).
16. **Placing Avalon** (`AV.2.*`, `AV.pass`). **Ruled:** on her own Turn, before either of them
    Attacks; after it neither Attacks nor Moves. Not held back by the NP Round gate. Passing it to
    another allied Master works the same way.
17. **The heal's timing** (`AV.b.when`). **Ruled:** one heal at the end of a Turn that was her
    Master's or in which her Master acted, never two; and one after each Damage Step that damaged
    her Master.
18. **Surviving at 1** (`AV.c`). **Ruled:** Health read before the hit; every time.
19. **The Master's Avalon** (`AVM.*`). **Ruled:** no Round gate, no Health cost; the Master picks
    which debuffs to negate, up to Y. **It is the use of an NP, so it counts as his Attack for the
    Turn** (reading 24).
20. **Vivian's Blessing** (`VB.1`). **Ruled:** she drops Waterside's penalties (MOV −1, Evade +1,
    Lightning and Ice DEF down) and keeps its benefits.
21. **Anti-Dragon** (`MR.3`). **Ruled:** built now as a tag an Attack can carry, pressed with a staged
    attack.
22. **Avalon on her when she falls** (`AV.keep`). **Ruled:** it is gone with her.

**Round 2, ruled 2026-10-16.**

23. **Knight of Utopia is Charisma** (`KU.cat`, `CH.neg.atk`). **Ruled:** its Atk Ups are Atk Up
    (Charisma). While she holds one, her +20 aura is off, as Penthesilea's and Proto Gil's are while
    their Charisma Active runs. Another Servant's Atk Up (Charisma) on her switches it off too.
24. **An NP on another's Turn** (`AVM.when`, `AV.1.when`). **Ruled:** the author's rule for every NP
    (§46.4-AZ): it consumes the Attack on its owner's own Turn and nothing otherwise. The Master's
    Avalon and her Method 1 alike.
25. **"Normal Attack" elsewhere** (`IA.1`, `KU.3.fire`, `DRC.3`). **Ruled:** a Mana Burst and a Riding
    Attack are Normal Attacks for these three; DRC still leaves out Mana Burst by name. On a Riding
    Attack the Dmg Boost reaches every Unit she strikes, then ends. Excalibur's passive alone is plain
    Normal Attacks (reading 12).

**Round 3, ruled 2026-10-16 (after the press).**

26. **Whose is the Master's 6◈** (`AVM.cd`, `AV.pass`). **Ruled:** the Item's. Passed on, the clock goes with
    [Avalon]; the Master it reaches finds it where the giver's stood.
27. **One clock or two** (`AV.1.cd`, `AVM.cd`). **Ruled:** two. Her Method 1 keeps its 8◈, the Master's Avalon
    its 6◈.
28. **While she holds it** (`AVM.cd`). **Ruled:** the 6◈ counts down every Turn wherever the Item is.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"Has the following effects-"*, *"Has the following effects while Active-"*, *"While [Avalon] is
  inside a Master, it can use it in the following manner-"* — headings.
- `Items held:` — an empty slot.
- *"(BA=375)"*, *"(i.e. from the 9th Round onwards)"*, *"(i.e. debuffs)"* — glosses of the rule beside them.

## Statblock

- [ ] **SB** · True Name Arturia Pendragon, Region Britain, England, Lawful Good, STR B, END B, AGI B, MAG A, LUC A+, Base Health 1250, MOV 5, Range 1 panel / 1 target, BA(STR) 175 (table: 125), BA(MAG) 200, Sustainability 2◈ · *Untouched*
- [ ] **SB.attr** · Attributes Female, Servant, [Earth], Saberface, Dragon, King, Humanoid, Round Table · *Untouched*

## Magic Resistance — Class Skill, Rank A *(Passive 1 + 2 + 3)*

- [ ] **MR.1** · MAG damage from a MAG Rank of up to A is negated · *Untouched*
- [ ] **MR.1.over** · …otherwise MAG damage taken is reduced by 50% · *Untouched*
- [ ] **MR.1.np** · …also affects NP · *Untouched*
- [ ] **MR.2** · Chance of being inflicted by debuffs is reduced by 25% · *Untouched*
- [ ] **MR.2.death** · …also affects Instakill and Death · *Untouched*
- [ ] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance · *Untouched*
- [ ] **MR.2.erase** · Erase is completely unaffected · *Untouched*
- [ ] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced · *Untouched*
- [ ] **MR.3** · Against MAG damage from an Attack with the 'Anti-Dragon' Attribute, it negates only up to MAG Rank C · *Untouched*
- [ ] **MR.3.over** · …otherwise that MAG damage is reduced by 25% · *Untouched*
- [ ] **MR.3.np** · …also affects NP · *Untouched*

## Riding — Class Skill, Rank B *(Active + Passive 1 + 2 + 3)*

- [ ] **RI.when** · Used during her Turn · *Untouched*
- [ ] **RI.mov** · MOV +4 for this Turn · *Untouched*
- [ ] **RI.unlock** · Double Move, Riding Attack and Passenger Seat can be used this Turn · *Untouched*
- [ ] **RI.cd** · Cooldown 2◈ · *Untouched*
- [ ] **RI.p1** · Double Move: Move twice, once before and once after Attacking; total distance within MOV · *Untouched*
- [ ] **RI.p2** · Riding Attack: Attack every Unit in her path while Moving in a straight line, as her Normal Attack · *Untouched*
- [ ] **RI.p2.stop** · …cannot Attack or Move after she has stopped · *Untouched*
- [ ] **RI.p2.left** · …having Moved already, the ride is MOV minus the panels already Moved · *Untouched*
- [ ] **RI.p3** · Passenger Seat: her Master Moves with her, ending in the same relative position; counts as one Unit Moving · *Untouched*
- [ ] **RI.p3.ride** · Passenger Seat and Riding Attack combine · *Untouched*
- [ ] **RI.notbuff** · The MOV Up is not a buff: no buff removal, no buff prevention · *Untouched*

## Vivian's Blessing *(Passive)*

- [ ] **VB.1** · She receives no negative effects from being within a Waterside area · *Untouched*

## Charisma — Rank B *(Passive)*

- [ ] **CH.1** · All damage dealt by other allied Units within 2 panels of her +20, NP included · *Untouched*
- [ ] **CH.1.self** · …not her own damage (*"other"*) · *Untouched*
- [ ] **CH.neg.atk** · Negated while she has Atk Up (Charisma) · *Untouched*
- [ ] **CH.neg.seal** · Negated while she is Skill Sealed · *Untouched*

## Knight of Utopia — Rank EX *(Active)*

- [ ] **KU.when** · Used during her Turn · *Untouched*
- [ ] **KU.1** · Atk Up 1◈ to all allied Units within 2 of her: all damage +30% · *Untouched*
- [ ] **KU.1.np** · …if NP, 15% · *Untouched*
- [ ] **KU.2** · Atk Up 1◈ to allied Units within 2 with the 'Round Table' Attribute: all damage +20% · *Untouched*
- [ ] **KU.2.np** · …if NP, 10% · *Untouched*
- [ ] **KU.3** · Dmg Boost (Utopia) 1◈ on herself: after she performs 3 Attacks… · *Untouched*
- [ ] **KU.3.fire** · …her next Normal Attack deals 200% extra damage, then the buff is removed · *Untouched*
- [ ] **KU.4** · 'Utopia' 1◈ on herself: each successful Attack cuts NP Cooldown ⅓◈ per Unit it hit · *Untouched*
- [ ] **KU.cd** · Cooldown 4◈ · *Untouched*
- [ ] **KU.cat** · Categorized as 'Charisma' · *Untouched*

## Instinct — Rank A *(Passive 1 + 2)*

- [ ] **IN.1** · When she is Attacked, 70% chance of automatically Evading · *Untouched*
- [ ] **IN.1.np** · …35% against a Noble Phantasm · *Untouched*
- [ ] **IN.1.fail** · A failed Instinct lets the Combat Process go on as normal · *Untouched*
- [ ] **IN.2** · Crit Chance +10% · *Untouched*
- [ ] **IN.seal** · Negated while she is Skill Sealed · *Untouched*

## Radiant Road — Rank EX *(Active)*

- [ ] **RR.when** · Used during her Turn · *Untouched*
- [ ] **RR.1** · Her NP Cooldown −1◈ · *Untouched*
- [ ] **RR.2** · S.Crit Up ⅓◈ to all allied Units within 2: Crit Chance +15% · *Untouched*
- [ ] **RR.3** · 'Radiant' 1◈ on herself: other allied Units within 2 gain her Instinct · *Untouched*
- [ ] **RR.3.seal** · While she is Skill Sealed, Instinct works for nobody · *Untouched*
- [ ] **RR.cd** · Cooldown 4◈ · *Untouched*

## Mana Burst — Rank A *(Active)*

- [ ] **MB.when** · Used when she performs a Normal Attack · *Untouched*
- [ ] **MB.ba** · For that Combat Process her Base Attack is BA(STR) and BA(MAG) combined · *Untouched*
- [ ] **MB.evade** · For that Combat Phase her Evade rolls −2 · *Untouched*
- [ ] **MB.mr** · Not affected by Magic Resistance · *Untouched*
- [ ] **MB.oncd** · Usable while on Cooldown, if she is within her Master's Servant Range… · *Untouched*
- [ ] **MB.oncd.cost** · …her Master loses 20 Health · *Untouched*
- [ ] **MB.oncd.noreset** · …and the Cooldown is not reset · *Untouched*
- [ ] **MB.cd** · Cooldown 3◈ · *Untouched*
- [ ] **MB.excl** · Not on the same Turn as Dragon's Reactor Core · *Untouched*

## Dragon's Reactor Core — Rank B *(Active)*

- [ ] **DRC.when** · Used during her Turn · *Untouched*
- [ ] **DRC.1** · Atk Up ⅓◈: all damage +60% · *Untouched*
- [ ] **DRC.1.np** · …if NP, 40% · *Untouched*
- [ ] **DRC.2** · NP DmUp ⅓◈: NP damage +30% · *Untouched*
- [ ] **DRC.3** · 'DRC' from the end of this Turn for the rest of the Round: Normal Attack damage +25% · *Untouched*
- [ ] **DRC.3.mb** · …not on a Normal Attack performed with Mana Burst · *Untouched*
- [ ] **DRC.cd** · Cooldown 4◈ · *Untouched*
- [ ] **DRC.excl** · Not on the same Turn as Mana Burst · *Untouched*

## Invisible Air: Bounded Field of the Wind King — Rank C, NP, Anti-Unit *(Passive/Activation)*

- [ ] **IA.lock** · Activated or deactivated at any time, once per Turn · *Untouched*
- [ ] **IA.start** · She starts the game with it active · *Untouched*
- [ ] **IA.1** · On her Normal Attack, a DU that Evades has its Evade roll +1 if its AGI Rank is higher than hers… · *Untouched*
- [ ] **IA.1.low** · …+2 if equal or lower · *Untouched*
- [ ] **IA.2** · Crit Dwn magnitude halved on her · *Untouched*
- [ ] **IA.2.off** · Deactivating it un-halves the Crit Dwn she already holds · *Untouched*

## Strike Air: Hammer of the Wind King — Rank C, NP, Anti-Unit

- [ ] **SA.target** · Range 3, 1 target · *Untouched*
- [ ] **SA.dmg** · 300 damage · *Untouched*
- [ ] **SA.flat** · Not affected by any damage modifying effects on her · *Untouched*
- [ ] **SA.wind** · Wind damage · *Untouched*
- [ ] **SA.ia** · Invisible Air deactivated for 1◈ after its use · *Untouched*
- [ ] **SA.cd** · Cooldown 5◈ · *Untouched*

## Excalibur: Sword of Promised Victory — Rank A++, NP, Anti-Fortress *(Passive + Active)*

- [ ] **EX.p** · While Invisible Air is deactivated, her Normal Attacks have a 50% chance of 25 extra Light damage · *Untouched*
- [ ] **EX.p.dark** · …50 if the DU has the 'Dark' Attribute · *Untouched*
- [ ] **EX.gate** · The Active only while Invisible Air is deactivated · *Untouched*
- [ ] **EX.area** · A 3x6 or 6x3 area in any non-diagonal direction next to her · *Untouched*
- [ ] **EX.dmg** · BA(MAG), 4x damage plus 200 · *Untouched*
- [ ] **EX.light** · Light damage · *Untouched*
- [ ] **EX.dark** · Against the 'Dark' Attribute damage further +100% · *Untouched*
- [ ] **EX.blind** · 40% chance of Blind for 1◈ · *Untouched*
- [ ] **EX.cut** · Then Excalibur's NP Cooldown −X◈, X = Units affected × ⅓ · *Untouched*
- [ ] **EX.cd** · Cooldown 7◈+⅔◈ · *Untouched*
- [ ] **EX.ia** · Invisible Air deactivated for 2◈ after its use · *Untouched*

## Avalon: The Everdistant Utopia — Rank EX, NP, Barrier *(Non-damaging)*

- [ ] **AV.gate** · At her summon, a d8: on an 8 she is summoned with the [Avalon] Item · *Untouched*
- [ ] **AV.1.gate** · Method 1 only from Round 9 (8 full Rounds after the start) · *Untouched*
- [ ] **AV.1.when** · Used when she or an allied Unit directly next to her is Attacked · *Untouched*
- [ ] **AV.1** · Negates all damage and effects of that Attack, NP included, on the Unit Attacked · *Untouched*
- [ ] **AV.1.aoe** · Against an AoE it covers every Unit within 1 panel of her · *Untouched*
- [ ] **AV.1.free** · No Master Health cost · *Untouched*
- [ ] **AV.1.cd** · Cooldown 8◈ · *Untouched*
- [ ] **AV.2.when** · Method 2, used on her Master when adjacent and both in their Home Base · *Untouched*
- [ ] **AV.2.give** · She places [Avalon] inside her Master; it counts as giving the Item · *Untouched*
- [ ] **AV.2.lock** · Neither she nor her Master can Attack that Turn or Move after · *Untouched*
- [ ] **AV.2.back** · She takes it back by the same process · *Untouched*
- [ ] **AV.a** · Inside her Master: Max Health +100, Max Luck +2, BA(STR) and BA(MAG) +50 · *Untouched*
- [ ] **AV.b.near** · She within 3 of her Master: Health +20% of max and Agility +2… · *Untouched*
- [ ] **AV.b.far** · …more than 3 away: Health +10% and Agility +1 · *Untouched*
- [ ] **AV.b.when** · …at the end of her Master's Turn, the end of any Turn her Master Acts, and the end of a Damage Step that damaged her Master · *Untouched*
- [ ] **AV.c** · Her Master, defeated at 10% of max Health or more, survives at 1 Health · *Untouched*
- [ ] **AV.d** · Her Master is immune to Death and Erase · *Untouched*
- [ ] **AV.e** · Her Master cannot be Overpowered · *Untouched*
- [ ] **AV.keep** · [Avalon] cannot be Stolen or dropped · *Untouched*
- [ ] **AV.dead** · She defeated while it is inside her Master: the Master keeps it, at the far values, and (c) at 5% · *Untouched*
- [ ] **AV.pass** · Her Master can give it to another allied Master by the same process · *Untouched*
- [ ] **AV.other** · Inside another Master: regen 5% and (c) at 5% · *Untouched*
- [ ] **AVM.when** · A Master holding it uses it when Attacked · *Untouched*
- [ ] **AVM.cut** · Damage taken −X%, NP included · *Untouched*
- [ ] **AVM.neg** · Negates up to Y debuffs of that Attack · *Untouched*
- [ ] **AVM.near** · Her Master, she within 3: X 80, Y 3 · *Untouched*
- [ ] **AVM.far** · Her Master, she farther or defeated: X 60, Y 2 · *Untouched*
- [ ] **AVM.other** · Any other Master: X 40, Y 1 · *Untouched*
- [ ] **AVM.cd** · Cooldown 6◈ · *Untouched*
