# Chiron — the Clause list

*Chiron* (Archer), built from `char_orig_sheets/Copia de Chiron.md`. Started by the user 2026-10-23, first of
the leverage ranking's picks the user chose.

**Audit opened 2026-10-23 (#326); every reading ruled.** **Read by hand, line by line.** No generated draft was used. The `by-class/Archer/Chiron.md` copy differs in two
places: Clairvoyance Passive 2 adds *"(1 Turn?)"* after ⅓◈, which is what ⅓◈ is at three Turns a Round; and the
Vital Spot note adds *Roland*, who is not built.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Unbuilt, ids proposed.** The Servant is `chiron`, his abilities `chiron-*`.

**Built to be reused.** Most of him is already other Servants' pieces:

- **Independent Action A** is `class-independent-action` at A, with Arjuna's text word for word.
- **Magic Resistance B** is `class-magic-resistance` at B.
- **Divinity C** is `divinity` at C (30), `printedRevision: revised`: his text is the Fixed Divine one, as Arjuna's.
- **Clairvoyance B+** is Arjuna's `arjuna-clairvoyance-bowman` at 90%, with Crit Up 35% and no Debuff Immune.
  Range Up (Clairvoyance) is the existing non-stacking effect.
- **Eye of the Mind (True)** is EMIYA's shape: `whenAttacked`, Dodge and Def Up, `evadeSucceeded` cutting its
  own clock, the `instinct` category Jack's Mist reads.
- **Great Sage of Centaurs** is a Mode switched once per Round, as Karna's Uncrowned Arms Mastership.
  **Passenger Seat** is the Riding grant `passengerSeat`, which already offers the Carry Master button.
- **Consecration's** allied area is Military Tactics' (`relations: [ally, self]`, ruled: "all allied Units"
  includes the user). Its Health price is Trace On's `statChange` with `floor: 1`.
- **Wisdom of Divine Gift** is Scáthach's Wisdom of Dún Scáith with three slots (`engine/copy.mjs`,
  `grantCopies({slots})`). Its exclusion list is per-ability `copyable` data, already authored on 73 abilities.
  The slots' *"cannot be used if … is on Cooldown"* is Gilles's Spells' requirement on the Spellbook.
- **Antares Snipe**: Night is `war:phase:night` (the Round's, not Darkness terrain). Defensive Buffs are
  effects of `valence: defensive`. The weak point is Achilles' Heel's (`engine/weak-point.mjs`). The
  killer is the defeat record's `killerId`. The Master's price at Rank E is Rho Aias's
  `masterHealthByNPRank`, beside `noMasterCost`.

What he needs that nobody has yet, each a generic piece (to confirm with `tools/capability.mjs`):

- **An attribute a form takes away.** `StatDelta` on `attributes` only adds. Either it learns `remove`, or the
  base sheet drops Humanoid and the Human Form adds it back.
- **An attacker's bonus to a weak point's chance.** Achilles' Heel's chance has defender-side terms only.
- **A Clairvoyance trigger.** A handler on "Passive 1 triggered" needs an event that fires when it does.
- **Teaching a copy.** A second Servant gains one of Chiron's copies, after a 1◈ wait both must sit out.
- **A posthumous strike.** A defeated Unit's NP fires ⅓◈ later, at its killer, held to the next Night Round.

**87 Clauses** across 10 Abilities and the statblock. The three Wisdom slots share one section.

## Rulings (2026-10-23, the user)

| # | Ruling |
|---|---|
| 1 | His Normal Attack uses BA(STR), as the corpus does when a sheet lists both (ST.na). |
| 2 | The form switch is a Mode and marks him Acted, as every Mode (#194) (GS.switch). |
| 3 | Centaur Form takes Humanoid away through a generic `remove` on an attributes `StatDelta` (GS.humanoid). |
| 4 | Clairvoyance Passive 1 is Arjuna's: `TableOverride` at 90 on a 1d100, no d10 (CV.p1). |
| 5 | Passive 1 "triggers" on every Normal Attack he makes at Range 3 or more; Passive 2 cuts ⅓◈ each time (CV.p2). |
| 6 | Wisdom copies no Class Skill and no Spell, as Scáthach's (WD.list). |
| 7 | Each slot keeps its own clock; none is usable while another is on Cooldown (WS.lock). |
| 8 | He may teach any other Servant, allied or enemy (WD.teach). |
| 9 | He keeps the Skill; the learner gets a copy by reference at A+ and 4◈-⅓◈ (WD.teach). |
| 10a | Teaching is an Active of Wisdom, on his own Turn. |
| 10b/f | As many teachings a War as he likes, one at a time; a cancelled one may be tried again. |
| 10c | Both controllers agree: his by the press, the learner's by a prompt; one press when one player holds both. A Servant with no Master agrees through the player controlling it. |
| 10d | "Directly next to": `targetUnit` at range 1, diagonals counted, as Avalon's hand-over; still next to each other when it ends. |
| 10e | The learner holds the Skill at the boundary 1◈ after the press; a card names the Skill and the learner. |
| 10g | A learner holds at most one Skill learned from Chiron. |
| 10h | The offer leaves out a Skill the learner already holds, its own original included. |
| 11a | Both carry `cannotAct` until it ends: no Move, Attack, Skill, NP, Evade, Block or Counter (#232 reading 10). |
| 11b/d | Cancelled when either is hit by an enemy Unit's Attack (a Blocked hit counts; an Evade, a Dodge or a miss does not), is defeated, or is Moved apart. `cannotAct` ends on both and a card names the cause. |
| 11c | Damage that is not an Attack (a tick, a Burn) does not cancel it. |
| 12 | Any Unit with a weak point is a Vital Spot; Antares adds 75 to that weak point's chance (AS.weak). |
| 13 | The posthumous Antares fires at the start of the first Turn beginning ⅓◈ or more after his defeat, from the panel he fell on, ignoring Range, Cooldown and once-per-Night; the target reacts as ever; no killer, or a killer gone, is a line and nothing more (AS.trig). |
| 14 | In a War with no Day/Night cycle Antares is never usable and the strike never fires; the slot says why (AS.night). |
| 15 | "Defensive Buffs" are the DU's buffs of `valence: defensive`; an unremovable one stays (AS.strip). |

## Statblock

- [x] **ST.name** · True Name: Chiron
- [x] **ST.region** · Region: Greece
- [x] **ST.align** · Alignment: Lawful Good
- [x] **ST.param** · STR B, END B, AGI A+, MAG B, LUC C
- [x] **ST.attr** · Attributes: Male, Servant, Sky, Non-Hominidae
- [x] **ST.humanoid** · …and Humanoid, in Human Form only
- [x] **ST.hp** · Base Health 1250
- [x] **ST.mov** · MOV 6, in Human Form
- [x] **ST.range** · Range 4 panels, 1 target
- [x] **ST.ba** · Base Attack STR 125, MAG 175: the table's figures for B and B
- [x] **ST.na** · The Normal Attack's Base Attack is not stated
- [x] **ST.sus** · Sustainability 8◈

## Great Sage of Centaurs — *(Active, Passive)*

- [x] **GS.switch** · Used during his Turn: switches between Human Form and Centaur Form
- [x] **GS.once** · …only once per Round
- [x] **GS.start** · He starts in Human Form (the statblock's MOV is the Human Form's)
- [x] **GS.mov** · In Centaur Form, MOV +2
- [x] **GS.evade** · …and his Evade Rolls are increased by 2, a penalty
- [x] **GS.seat** · …and he gains Passenger Seat
- [x] **GS.seat.move** · Passenger Seat: his Master Moves together with him, ending in the same position relative to him as before
- [x] **GS.seat.one** · …and it counts as Moving only one Unit
- [x] **GS.seat.riding** · …and it combines with a Riding Attack (he has no Riding: inert)
- [x] **GS.humanoid** · …and he loses the Humanoid Attribute

## Independent Action — Rank A *(Class Skill)*

- [x] **IA.sus** · High Sustainability, 8◈
- [x] **IA.zon** · His Master's ZON +3 panels
- [x] **IA.contract** · 4 successful Contract Servant rolls to be contracted by enemy Masters and Casters

## Magic Resistance — Rank B *(Class Skill)*

- [x] **MR.negate** · MAG damage from a MAG Rank up to B is negated
- [x] **MR.cut** · …otherwise MAG damage taken −40%
- [x] **MR.np** · …NPs included
- [x] **MR.debuff** · Chance of being inflicted by debuffs −20%
- [x] **MR.death** · …Instakill and Death too, unless from a STR-damage or not-affected-by-MR source
- [x] **MR.erase** · …Erase is unaffected
- [x] **MR.note** · Other debuffs from STR or MR-exempt sources still have their chance reduced

## Divinity — Rank C

- [x] **DV.dmg** · All damage he deals +30
- [x] **DV.fixed** · …as Fixed Divine Damage, not counted toward an Injury Roll

## Clairvoyance — Rank B+

- [x] **CV.p1** · His Normal Attack at Range 3 or more: the DU rolls a d10, 90% chance it uses Evade- when Evading
- [x] **CV.p1.else** · …otherwise the Combat Process proceeds as normal
- [x] **CV.p1.kind** · …a Normal Attack only: not a Skill or an NP
- [x] **CV.crit** · Active, during his Turn: Crit Up, Crit Chance +35%, 1◈
- [x] **CV.range** · …and Range Up (Clairvoyance), Range +1, 1◈, does not stack
- [x] **CV.cd** · Cooldown 4◈-⅓◈
- [x] **CV.p2** · Whenever Passive 1 triggers, this Skill's Cooldown −⅓◈

## Eye of the Mind (True) — Rank A

- [x] **EM.evade** · His Evade rolls −3
- [x] **EM.evade.only** · …not other Agility Checks
- [x] **EM.cut** · On a successful Evade, this Skill's Cooldown −⅓◈
- [x] **EM.window** · Active, at the start of a Combat Process when Attacked
- [x] **EM.dodge** · Dodge for ⅓◈
- [x] **EM.def** · Def Up for ⅔◈: damage taken −25%, NP −15%
- [x] **EM.cd** · Cooldown 3◈

## Consecration of Eternal Life — Rank EX

- [x] **CE.when** · Active, during his Turn
- [x] **CE.area** · Every allied Unit within a 2 panel area of him, himself included
- [x] **CE.cdmg** · Crit DmUp, Crit Damage +50%, 1◈
- [x] **CE.scrit** · S.Crit Up, Crit Chance +15%, ⅓◈
- [x] **CE.hp** · Then his Health −5% of its maximum
- [x] **CE.hp.floor** · …never below 1 this way
- [x] **CE.cd** · Cooldown 4◈

## Wisdom of Divine Gift — Rank A+

- [x] **WD.list** · When summoned: a list of the Active Skills of every other Servant on the field
- [x] **WD.pref** · …preferably Rank B to A
- [x] **WD.pick** · He selects three, and uses their effects as this Skill's
- [x] **WD.ex.rank** · Rank EX Skills cannot be copied
- [x] **WD.ex.list** · Nor Natural Body, Mystic Eye Skills, Mana Burst Skills, Kishu no Ma
- [x] **WD.ex.kind** · …nor Skills born with, part of the body, or unique to the Hero (Affections of the Holy Grail)
- [x] **WD.gm** · The GM may give names only, summaries, or full effects
- [x] **WD.teach** · He may teach one copied Skill to another Servant
- [x] **WD.teach.agree** · …both Masters must agree
- [x] **WD.teach.adj** · …both stand directly next to each other
- [x] **WD.teach.time** · …the teaching lasts 1◈
- [x] **WD.teach.noact** · …neither can Act until it is complete
- [x] **WD.teach.cancel** · …and it is cancelled if interrupted, as by an enemy Attack

## Wisdom of Divine Gift: Skills 1, 2 and 3 — Rank A+

- [x] **WS.effect** · Each holds one copied Skill's effect
- [x] **WS.cd** · Each has Cooldown 4◈-⅓◈
- [x] **WS.lock** · None can be used while either of the other two is on Cooldown

## Antares Snipe: Heavenly Scorpion Single-Shot — Rank A+ *(NP, Anti-Unit)*

- [x] **AS.night** · Only at Night, as the War's Round says, not Darkness terrain
- [x] **AS.once** · …once per Night Round
- [x] **AS.ba** · Base Attack (MAG)
- [x] **AS.range** · Range 5
- [x] **AS.strip** · First, removes every Defensive Buff from the DU
- [x] **AS.dmg** · …then 2x damage plus 100
- [x] **AS.critdwn** · …then Crit Dwn, Crit Chance −40%, 1◈
- [x] **AS.earth** · Damage to an Earth Unit +150% more
- [x] **AS.cost** · His Master loses Health as for a Rank E Noble Phantasm
- [x] **AS.weak** · It may aim at a weak point (a Vital Spot), at +75% chance to hit it
- [x] **AS.cd** · Cooldown 3◈
- [x] **AS.trig** · When Chiron is defeated, it activates automatically
- [x] **AS.trig.when** · …⅓◈ after his defeat, at the start of the Turn
- [x] **AS.trig.target** · …on the Unit that defeated him
- [x] **AS.trig.cost** · …his ex-Master loses no Health
- [x] **AS.trig.day** · …and if that moment is in a Day Round, at the start of the next Night Round
