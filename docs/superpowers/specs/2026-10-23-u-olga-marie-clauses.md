# U-Olga Marie (President) — the Clause list

*U-Olga Marie*, the Beast, built from `char_orig_sheets/by-class/Beast/President.md`. Started by the user
2026-10-23, the leverage ranking's first pick, and the first Beast built.

**Audit opened 2026-10-23 (#328); every reading ruled.** **Read by hand, line by line.** No generated draft was used. There is no `Copia de` copy; the sheet lives only
in the `by-class/Beast/` folder, which is where her Class comes from (the sheet prints none). A second sheet,
`by-class/Pretender/U-Olga Marie.md`, is another Servant: U-Olga Marie in the Pretender pool, who flips a coin
into *Olga Marie Animusphere*. It differs in eleven places (Sustainability 2◈, Gravity Manipulation an Active,
2-panel areas, Earth-Shattering's 100 Health price, "no other Servants" for Unparalleled, the Animusphere
Skills). None of it is read here.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Unbuilt, ids proposed.** The Servant is `u-olga-marie`, her abilities `olga-*`.

**Built to be reused.** Much of her is already other Servants' pieces:

- **Her Normal Attack** is EMIYA's `normalAttack.mode: rangeBanded`: STR at Range 1, MAG from 2.
- **Territory Creation A** is `class-territory-creation` at A: 5d20 and 3d10+20 are its A row.
- **Item Construction B** is Van Gogh's `class-item-construction-gogh` aura (2 panels, `highestOnly`), with her
  figures: 40/20/10 out is the `itemConstruction` table's B row.
- **Magic Resistance A** is `class-magic-resistance` at A (25% is the debuff table's A).
- **Divinity EX** is `divinity` at EX (60), `printedRevision: revised`, the Fixed Divine text as Arjuna's.
- **Independent Manifestation's** first three Passives are `class-independent-action` at A, word for word.
  Passive 4 is an `ApplicationChance` on the `mental` volatility, Instakill, Death and Erase.
- **Defender of Humanity's** revival is a `RevivalSource` with one charge, as Battle Continuation's.
  Its Normal Attack method is Kagome's area `normalAttack.shape`.
- **Gravity Manipulation** is Proto Gil's Levitation: MOV +1 and Levitating, switched off by a debuff
  (`negatedBy: [skillSeal]`). Its enemy tiers are auras with a `MovDelta` floor.
- **Gyakkou** listens to `unitRevived`, the event Indomitable already hears.
- **Unparalleled's** Skill cut is Ozymandias's `cooldown` phase, `scope: skills`.
- **Earth-Shattering's** Overcharge is Gilles (Saber)'s effect.
- **Flawlessness's** Dmg Up (Standard) is `target:classGroup:standard`. Pierce, NP Regen, Crit DmUp and Atk Up
  exist.
- **Planet Olga Marie's** area is Excalibur's `selfEdgeAdjacent`. Luck Loss, Def Dwn (B) and the ally riders
  exist.

What she needs that nobody has yet, each a generic piece (to confirm with `tools/capability.mjs`):

- **The Beast Class's own gaps.** The enum, the lang strings and `assets/classes/beast.webp` exist. The Grand
  Order campaign's ban on the `Beast/` folder is not built.
- **An attribute closure a sheet opts out of.** `servant` implies Hominidae; she is neither Hominidae nor
  Non-Hominidae.
- **A revival gated on its killer.** A `RevivalSource` predicate reads the bearer's options only.
- **A revival that restores Agility and Luck.** Every source restores Health only.
- **Several Attacks in one Turn**, and a ban on the rest of her side's. The Turn Record holds one `attacked` flag.
- **An Attack that has no effect by distance and Base Attack**, the Gravity clause.
- **A permanent cut to Max Health.**
- **An Invuln consumed before another Invuln.**
- **E.Atk Up and Agility Loss.** Neither effect exists.
- **A d6 table on a Normal Attack**, each face once per Turn, with a chosen face and a follow-up hit that binds
  the DU's reaction.
- **A debuff with a price if it fails**: "if this debuff fails to be inflicted, the DU loses 2 Agility".

**117 Clauses** across 12 Abilities, the statblock and the Class.

## Rulings (2026-10-23, the user)

| # | Ruling |
|---|---|
| 1 | The Beast Class gains the Grand Order ban on the `Beast/` folder; `beast.webp` is her icon; a Beast placed in an Extra slot keeps `beast` as her container. The user supplies her portrait (BC.icon, BC.pool). |
| 2 | `u-olga-marie`, shown as "U-Olga Marie", True Name Olga Marie Animusphere. The Pretender sheet's U-Olga Marie is a separate Servant, not built now (ST.name). |
| 3 | `region: [earth]`; no War Region is Earth, so she never takes a Parameter bonus (ST.region). |
| 4 | A Servant may list attributes the closure never adds; hers is Hominidae, read after the closure as Chiron's `remove` (ST.hom). |
| 5 | Item Construction's incoming Instakill and Death are the printed −20% and −10% (IC.in.ik). |
| 6 | "Defeated by" is the killer on her defeat record; no killer, or none with Threat to Humanity, no revival. It restores Health, Agility and Luck to 50%, a passive source below Guts, one charge a War (DH.revive). |
| 7 | The Defender Normal Attack is always MAG; its 3x3 is centred within her Range and hits every Unit in it, allies too, never her; −10% per Unit hit; her own Crit Damage up and down effects are ignored, the DU's Crit resistance is not; once per Turn (DH.na). |
| 8 | Gravity's tiers are at exactly 3, 2 and 1 panels, diagonals counted; "Agility Check rolls" include Evade; every enemy Unit, Masters and summons too; the MOV floor binds her own cut only (GM.at*). |
| 9 | Any Attack with BA(STR) declared from 4 or more panels has no effect on her: no damage, no riders, a card line. Normal Attacks, Attack Skills and NPs alike (GM.str; Ranged delivery stays #281). |
| 10 | Gyakkou triggers on any revival through an effect. Max Health −10% of its current maximum, for the War, stacking. Invuln (Gyakkou) is spent before any other Invuln. While its 4◈ clock runs, a revival gives nothing (GY.*). |
| 11 | Three Attacks of any kind; the ban covers allied Servants only; when another already Attacked, only effect 3 is skipped; −2◈ cuts her other Skills, not Unparalleled or an NP; the 3-panel areas include her (UP.*). |
| 12 | Earth-Shattering sets her NP Cooldown to 0; her next NP spends the Overcharge (ES.*). |
| 13 | Flawlessness's "Reset" puts her NP on its full Cooldown, a price (FL.reset). |
| 14 | NP Regen cuts 1 Turn at each Turn's end (FL.regen). |
| 15 | E.Atk Up is a new effect: damage of area Attacks that are not NPs (FL.eatk). |
| 16 | Four Elements is an NP for the gate and NP Seal; offered and optional on each Normal Attack at Range 2+; no Cooldown, no Master price; the die is rolled at declaration and shown; the Attack stays a Normal Attack; a 6 picks any face unspent this Turn; Burn, Soaked and Shock roll their chance on a hit; it rides her 3x3 Normal Attack too, face 5 excepted (FE.*). |
| 18 | Her Max Health is END EX's 2000, not the sheet's 2500: the table beats the sheet, upward too (ST.hp, ruled after the build). |
| 17 | Planet Olga Marie hits every Unit in the 9x9, allies too; the "First" debuffs land on each DU it reaches, before the damage; a resisted or immune debuff costs that DU 2 Agility or Luck, down to 0; Agility Loss forces the unfavourable Agility table; the ally riders include her, so her own clock takes −½◈ twice as a [Star] (PO.*). |

## Statblock

- [x] **ST.name** · True Name: Olga Marie Animusphere, shown as U-Olga Marie
- [x] **ST.class** · Class: Beast, from the `by-class/Beast/` folder; the sheet prints none
- [x] **ST.region** · Region: Earth
- [x] **ST.region.bonus** · …no Parameter bonus from being on Earth
- [x] **ST.align** · Alignment: Lawful Evil
- [x] **ST.param** · STR EX, END EX, AGI E-, MAG EX, LUC D
- [x] **ST.attr** · Attributes: Female, Servant, [Star], Giant, Spaceflight, Humanoid
- [x] **ST.hom** · …neither Hominidae nor Non-Hominidae
- [x] **ST.hp** · Base Health 2500
- [x] **ST.mov** · MOV 3
- [x] **ST.range** · Range 3 panels, 1 target
- [x] **ST.ba** · Base Attack STR 200, MAG 250
- [x] **ST.sus** · Sustainability 8◈
- [x] **ST.na.near** · Normal Attacks at Range 1 use Base Attack (STR)
- [x] **ST.na.far** · …at Range 2 or more, Base Attack (MAG)
- [x] **ST.items** · Items held: none

## The Beast Class

- [x] **BC.icon** · Her Class shows the Beast icon and name on her sheet, token and cards
- [x] **BC.pool** · A `Beast/` Servant cannot be summoned in the Grand Order Full Campaign

## Territory Creation — Rank A *(Class Skill)*

- [x] **TC.p1** · In her Home Base, all damage she deals +5d20, NP included
- [x] **TC.p2** · While she is on the field, damage taken by allied Units in their Home Base −(3d10+20), NP included
- [x] **TC.stack** · Several allied holders: only the highest Rank takes effect

## Item Construction — Rank B *(Class Skill)*

- [x] **IC.area** · Affects all allied Units within 2 panels of her
- [x] **IC.out** · Chance of inflicting debuffs +40%
- [x] **IC.out.ik** · …Instakill +20%, Death +10%
- [x] **IC.in** · Chance of being inflicted by debuffs −30%
- [x] **IC.in.ik** · …Instakill −20%, Death −10%, as printed
- [x] **IC.stack** · A Unit under several: only the highest Rank takes effect

## Magic Resistance — Rank A *(Class Skill)*

- [x] **MR.negate** · MAG damage from a MAG Rank up to A is negated
- [x] **MR.cut** · …otherwise MAG damage taken −50%
- [x] **MR.np** · …NPs included
- [x] **MR.debuff** · Chance of being inflicted by debuffs −25%
- [x] **MR.death** · …Instakill and Death too, unless from a STR-damage or not-affected-by-MR source
- [x] **MR.erase** · …Erase is unaffected
- [x] **MR.note** · Other debuffs from STR or MR-exempt sources still have their chance reduced

## Divinity — Rank EX

- [x] **DV.dmg** · All damage she deals +60, NP included
- [x] **DV.fixed** · …as Fixed Divine Damage, not counted toward an Injury Roll

## Independent Manifestation — Rank A *(Class Skill)*

- [x] **IM.sus** · High Sustainability, 8◈
- [x] **IM.zon** · Her Master's ZON +3 panels
- [x] **IM.contract** · 4 successful Contract Servant rolls to be contracted by enemy Masters and Casters
- [x] **IM.immune** · Chance of being inflicted with Mental Debuffs, Instakill, Death and Erase −100%
- [x] **IM.counts** · This Skill counts as Independent Action A

## Defender of Humanity — Rank EX

- [x] **DH.revive** · When defeated by a Unit with the Threat to Humanity Attribute, she revives
- [x] **DH.restore** · …Health, Agility and Luck restored to 50% of their maximum
- [x] **DH.once** · …once per game
- [x] **DH.na** · A Normal Attack may be made this way: Base Attack (MAG)
- [x] **DH.area** · …hits a 3x3 area within Range
- [x] **DH.cut** · …Total damage −10% for every Unit within the Attack area
- [x] **DH.crit** · …not affected by effects that raise or lower Crit Damage dealt (printed with a "?")
- [x] **DH.turn** · …once per Turn

## Gravity Manipulation — Rank EX

- [x] **GM.mov** · Her MOV +1
- [x] **GM.lev** · …and she gains the Levitating Attribute
- [x] **GM.at3** · Enemy Units 3 panels from her: MOV −3, Agility Check rolls +3
- [x] **GM.at2** · …2 panels from her: MOV −4, Agility Check rolls +4
- [x] **GM.at1** · …directly next to her: MOV −5, Agility Check rolls +5
- [x] **GM.floor** · MOV is at least 1 when reduced this way
- [x] **GM.str** · Ranged Attacks dealing STR damage from 4 or more panels away have no effect on her
- [x] **GM.seal** · Every effect of this Skill is negated while she has Skill Seal

## Gyakkou — Rank EX

- [x] **GY.trig** · Whenever she is defeated and revived through an effect
- [x] **GY.atk** · …Atk Up, 1◈: damage +30%, NP +20%
- [x] **GY.inv** · …Invuln (Gyakkou), 1◈, 1 time, separate from Invuln
- [x] **GY.inv.first** · …consumed before any other Invuln when Attacked
- [x] **GY.np** · …her NP Cooldown −⅓◈
- [x] **GY.maxhp** · …her Max Health −10% of its maximum
- [x] **GY.cd** · Cooldown 4◈

## Unparalleled — Rank EX

- [x] **UP.when** · Active, during her Turn
- [x] **UP.skills** · Her Skill Cooldown −2◈
- [x] **UP.npdm** · NP DmUp, 1◈: NP damage +30%
- [x] **UP.eff** · The Unparalleled effect for this Turn: neither buff nor debuff, Unremovable
- [x] **UP.ban** · …this Turn no other allied Servant can Attack
- [x] **UP.three** · …and she can Attack up to three times this Turn
- [x] **UP.gate** · …not applied if another allied Servant has already Attacked this Turn
- [x] **UP.scrit** · S.Crit Up, ⅓◈, to every allied Unit within 3 panels of her: Crit Chance +50%
- [x] **UP.npseal** · NP Seal, ⅓◈, to every enemy Unit within 3 panels
- [x] **UP.healdwn** · Heal Dwn, 1◈, to every enemy Unit within 3 panels: Health restored −50%
- [x] **UP.cd** · Cooldown 4◈

## Earth-Shattering — Rank B

- [x] **ES.when** · Active, during her Turn
- [x] **ES.np** · Her NP Cooldown is fully reduced
- [x] **ES.oc** · Overcharge, 1◈, 1 time: the magnitude of every non-damage effect of her NP +20%
- [x] **ES.cd** · Cooldown 4◈

## Flawlessness — Rank EX

- [x] **FL.when** · Active, during her Turn
- [x] **FL.req** · …only when her NP is not on Cooldown
- [x] **FL.reset** · Her NP Cooldown is Reset
- [x] **FL.std** · Dmg Up (Standard), 1◈: damage to Standard-class Servants +50%
- [x] **FL.atk** · Atk Up, 1◈, on her: damage +30%, NP +20%
- [x] **FL.area** · Every allied Unit within 3 panels of her:
- [x] **FL.atk2** · …Atk Up, 1◈: damage +40%, NP +30%
- [x] **FL.eatk** · …E.Atk Up, 1◈: non-NP area damage +100%
- [x] **FL.cdm** · …Crit DmUp, 1◈: Crit Damage +30%
- [x] **FL.regen** · …NP Regen, 1◈: NP Cooldown −1 Turn at the end of every Turn (printed "(2 Turns?)")
- [x] **FL.pierce** · …Pierce, 1◈
- [x] **FL.cd** · Cooldown 4◈

## Four Elements・The Great Enemy: The Yet Existing Four Gods — Rank EX *(NP, Anti-Unit)*

- [x] **FE.when** · Passive: may be used on a Normal Attack at Range 2 or more
- [x] **FE.die** · …roll a d6 and apply its face
- [x] **FE.1** · 1: nothing happens; the Combat Process proceeds as normal
- [x] **FE.2** · 2: the Attack deals Fire damage and inflicts Burn, 2◈
- [x] **FE.3** · 3: Water damage and Soaked, 2◈
- [x] **FE.4** · 4: Lightning damage and Shock, 2◈
- [x] **FE.5** · 5: an Attack with Base Attack (STR), then at once a follow-up with Base Attack (MAG)
- [x] **FE.5.block** · …if the DU Blocked the first hit, it must Block the second
- [x] **FE.5.evade** · …if the DU failed to Evade the first hit, it cannot React to the second
- [x] **FE.6** · 6: her choice
- [x] **FE.once** · Faces 2 to 5 once per Turn each; a spent face rolled reads as 1
- [x] **FE.seal** · No effect while she has NP Seal

## Planet Olga Marie: The Already Passed End of the Human Order — Rank EX *(NP, Anti-World)*

- [x] **PO.ba** · Base Attack (MAG)
- [x] **PO.area** · Hits a 9x9 area in any non-diagonal direction next to her
- [x] **PO.agl** · First: Agility Loss, 1◈
- [x] **PO.agl.fail** · …if it fails to be inflicted, the DU loses 2 Agility
- [x] **PO.luk** · …Luck Loss, 1◈
- [x] **PO.luk.fail** · …if it fails to be inflicted, the DU loses 2 Luck
- [x] **PO.def** · …Def Dwn (B), 1◈: damage taken +20%, NP +30%
- [x] **PO.dmg** · Then 5x damage
- [x] **PO.bonus** · …+200% against Units with [Man], [Star] or Living Human
- [x] **PO.ally** · Then, every allied Unit within 3 panels of her:
- [x] **PO.atk** · …Atk Up, 1◈: damage +20%, NP +10%
- [x] **PO.npcd** · …NP Cooldown −½◈
- [x] **PO.npcd.man** · …another −½◈ for one with [Man], [Star] or Living Human
- [x] **PO.cd** · Cooldown 8◈
