# Vlad III (Lancer) — the Clause list

*Vlad III* (Lancer), built from `char_orig_sheets/by-class/Lancer/Vlad III (Lancer).md`. Started by the user
2026-10-23.

**Audit opened 2026-10-23 (#330); every reading ruled; built and pressed 2026-10-23 (Rounds 45–54).** **Read by hand, line by line.** No generated draft was
used. The folder holds two other Vlads: `Lancer/Vlad III (Extra).md` (a different Servant: Rank C Magic
Resistance, END A, AGI E, MOV 3, [Man]) and `Berserker/Vlad III (Berserker).md`. Neither is built; the coin
flip on this sheet names the Berserker.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built.** The Servant is `vlad-lancer`, his abilities `vlad-*`.

**Built to be reused.** Most of him is other Servants' pieces:

- **Magic Resistance B** is `class-magic-resistance` at B (40%, 20%).
- **Battle Continuation A** is `class-battle-continuation` at A: 2d10+20, NP dice doubled, revive 5d20,
  Cooldown 3◈, the half-Health recovery gate (`requiresHealthRestoredSince: 0.5`). Heracles holds it.
- **Shapeshift C** is Nursery Rhyme's `Ward` (10, NP 5) plus an Active Def Up. Its window "at the start of a
  Combat Phase when Vlad is Attacked" is Karna's `defendingPhaseStart` (#206 reading 4).
- **Wallachia** is Ramesseum Tentyris's field: `fixedArea` 9x9, `cannotIntersect` clipped,
  `countsAsHomeBase: {units: [owner]}`, `Suppress sustainabilityDecay` and `zonPenalty` for `self`, the
  interior `DamageModifier`s. What is new is who places it and when (below).
- **Kazıklı stacks** are an effect of `stacking: magnitudeStacks` as Kingprotea's `proliferationStock`;
  Y = 50 × stacks is a `count: {of: stacks}` (`rules/count.mjs`). The −50% removal chance is
  `buff-removal-res-up`'s key on a debuff.
- **Curse** is `{ id: curse }` with no duration, as Gilles's Evil Gaze.
- **Ignore Def, Pierce, Invuln, Anti-Purge** are the existing effects; "ignores Block" is the declaration's
  `unblockable` (`engine/attack.mjs:1066`); "damages Masters even beside their Servant" is Gate of Skye's.
- **Kazıklı Bey Active 2 "cannot Counter"** is the follow-up's `forbidReactions` (#328).
- **Legend of Dracula's** price is Yuugao's `additionalCosts: [{kind: commandSpell, amount: 1}]`. Night is
  `war:phase:night`. "Always Attack the closest Unit" is the `Compulsion` element with the Gigantic
  Horror's nearest rule (`rules/compulsion.mjs#nearestUnits`). Range is `RangeDelta`; Evade −4 is a
  `CheckModifier` on `evade`; Fire +25% is a `DamageModifier` taken; Move through obstacles is Sikera Usum's
  `ignoresObstacles` (`rules/movement.mjs`).

What he needs that nobody has yet, each a generic piece:

- **A field placed at summon.** A passive that opens a field when its bearer is summoned, the panel chosen by
  his player, within a board-half rule.
- **A second Home Base without stacked healing.** Where the two overlap, the Round-end heal pays once.
- **A Combat Process end window.** Kazıklı Bey Active 2 at the end of a Process he attacked in.
- **Cancelling an Attack from its defender**, then a Counter.
- **A periodic NP**: an Activated span whose ticks fall at the end of every Turn he Acts and at Round end, a die
  per enemy, an Evade each.
- **Damage not modified by its user's effects** (both Kazıklı actives).
- **Targets +1** on a Normal Attack, and **Base Attack +75**.
- **Healing on damage dealt and on defeat**, with a Civilian exception.
- **A Skill's magnitude doubled** by another ability, and a Class Skill and an NP **disabled** for good.
- **Killing one's own Master** as the price of a choice.
- **A Lancer/Berserker coin flip at summon** (needs Vlad III (Berserker) built).

**93 Clauses** across 6 Abilities, the summon flip and the statblock.

## Rulings (2026-10-23, the user)

| # | Ruling |
|---|---|
| 1 | The coin flip waits on Vlad III (Berserker): he is summoned as the Lancer, `SM.*` set aside until the Berserker is built (SM.*). |
| 2 | His Normal Attack uses BA(STR), as the corpus does when a sheet lists both (ST.na). |
| 3 | Region `[romania, europe]`; `romania` joins the graph bordering `europe` only (ST.region). |
| 4 | His player places Wallachia once, at his deployment or summon, by its centre panel; the centre lies nearer his Home Base than any other Player's; it lasts the whole War, past his last defeat (WL.place, WL.half). |
| 5 | The ZON clause holds only while he is within Wallachia (WL.zon); what it waives is ruling 29. |
| 6 | "The NP area" is Wallachia; the ticks go on if he leaves it; only the use needs him inside (KA.who, KA.wall). |
| 7 | A tick is no Attack and no Combat Process: one Evade roll per enemy per tick, no Block, Counter or reaction ability. "A Turn he Acts" is any Turn he Moved, Attacked or used anything; on the Round's last Turn both ticks fire (KA.tick, KA.evade). |
| 8 | Active 2 once per Round, no Cooldown, not blocked by Active 1's; only Active 2 is free, Active 1 pays the B Master Health cost (KB.once, KB.nocost). |
| 9 | The cancel cancels the whole Attack, every Process, and it still counts as the AU's Attack; "counts as his Attack" only from his bar on his own Turn, never at a Process window (KB.cancel, KB.attack). |
| 10 | Active 2's damage is no Attack: no Evade, Block or Counter. Corrected after the grill (Surprise `2026-10-23-pierce-ruling-ignored-its-own-definition`): its Pierce wins, so an Invuln does not stop it; an Anti-Purge still does (KB.dmg, KB.pierce). |
| 11 | The stack passive works under NP Seal; a Counter he makes is a Normal Attack and stacks too (KZ.stack). |
| 12 | Legend of Dracula costs a Command Spell plus the A+ Master Health cost, during his Turn; a Master within Wallachia is defeated outright, Vlad the killer, with a card line; Vlad plays on Masterless under the War's rule (LD.cs, LD.kill). |
| 13 | The Night heal pays at most once per Turn end, plus once at Round end; Night is `war:phase:night` (LD.night). |
| 14 | His own Master is a Unit; a tie is broken at random by the system; a Move must end closer to the closest Unit, and he may still not act; in Grand Order allies are spared, as Penthesilea's (LD.closest). |
| 15 | He Moves within MOV, the path ignoring obstacles and Units, ending on an unoccupied panel, never into an enemy Master's guarded area (LD.move, LD.zoc). |
| 16 | Damage heals 100 Health and 1 Agility once per Unit damaged (dealt, not merely hit); a kill adds 25% of both maxima on top; a Civilian kill heals 100 and 1, which is Ch. 06's own bounty for any Servant, not a second heal; a defeated-then-revived Unit still counts (`unitFelled`) (LD.drain, LD.slay, LD.civ). |
| 17 | After Dracula, stacks already placed stay and do nothing; Wallachia and Shapeshift go on (LD.kz). |
| 18 | With Dracula's second target, the first is the closest Unit and the second the next closest, ties at random (LD.targets). |
| 19 | One reader breaks every "nearest" tie at random: `rules/compulsion.mjs#nearestUnits`, the Gigantic Horror's too (LD.closest). |
| 20 | Dracula doubles both halves of Shapeshift: the Passive 20% (NP 10%) and the Active's Def Up 20% (NP 10%) (LD.shape). |
| 21 | Wallachia's MAG +50% includes NPs, as the STR half (WL.mag). |
| 22 | Kazıklı stacks have no cap and no duration; a removal rolls once for the Unit's whole Kazıklı effect, at half its chance (KZ.stack, KZ.resist). |
| 23 | Every "in his Home Base" check counts Wallachia for him (the Round-end heal, `inHomeBase`), never for his Master or allies; where it overlaps his Home Base he heals once (WL.home, WL.heal). |
| 24 | Active 1's span starts at the use; the Turn of the use is a Turn he Acts, so it ticks at its end; a Round end inside the span ticks too (KA.dur, KA.tick). |
| 25 | Active 2 is also offered at the start of a Process he attacks in and at the end of one he was Attacked in, dealing its damage only (KB.when). |
| 26 | Active 2 rolls Curse on every Unit it affects, even one whose damage Invuln stopped, against its immunity and resistance; every affected Unit loses all its stacks (KB.curse, KB.clear). |
| 27 | Both Actives skip Vlad's side of the pipeline and keep the DU's: its Dmg Cut, Battle Continuation, Ward and Magic Resistance count, its Def Up does not (Ignore Def); Active 1's Invuln and Anti-Purge stop it whole, as the sheet says, where Appendix A would halve an NP (KZ.unmod, KA.ignoredef, KA.invuln). |
| 28 | Active 2's "Y damage" is STR, as Active 1's (KB.dmg). |
| 29 | "His Master's ZON is ignored" waives the whole ZON while he is inside Wallachia: no damage penalty and no NP refused for want of it; Ramesseum waives the penalty only because its sheet adds "when he Attacks" (found pressing, WL.zon). |

Read as precedent, no ruling needed: "Dark (Vampire)" is `[dark, vampire]`, as the Gigantic Horror's "Dark
(Outsider)" is `[dark, outsider]`; Curse with no duration is `{ id: curse }`, as Gilles's Evil Gaze.

## Statblock

- [x] **ST.name** · True Name: Vlad III, shown as Vlad III (Lancer)
- [x] **ST.class** · Class: Lancer
- [x] **ST.region** · Region: Wallachia, Romania, Europe
- [x] **ST.align** · Alignment: Lawful Neutral
- [x] **ST.param** · STR B, END B, AGI A, MAG A, LUC D
- [x] **ST.attr** · Attributes: Male, Servant, [Earth], King, Humanoid, Anti-Hero
- [x] **ST.hp** · Base Health 1250
- [x] **ST.mov** · MOV 7
- [x] **ST.range** · Range 2 panels, 1 target
- [x] **ST.ba** · Base Attack STR 125, MAG 200
- [x] **ST.na** · His Normal Attack uses one Base Attack (the sheet lists both)
- [x] **ST.sus** · Sustainability 2◈
- [x] **ST.items** · Items held: none

## Summoning

- [ ] **SM.flip** · When Vlad III is summoned, his summoner flips a Coin: Heads, Vlad III (Lancer); Tails, Vlad III (Berserker)
- [ ] **SM.hgw** · …in Normal or Ainsworth HGW, no flip if the Berserker has already been summoned
- [ ] **SM.go** · …not in some scenarios: in the Grand Order Campaign the Class is chosen before deploying

## Magic Resistance — Rank B *(Class Skill)*

- [x] **MR.negate** · MAG damage from a MAG Rank up to B is negated
- [x] **MR.cut** · …otherwise MAG damage taken −40%
- [x] **MR.np** · …NPs included
- [x] **MR.debuff** · Chance of being inflicted by debuffs −20%
- [x] **MR.death** · …Instakill and Death too, unless from a STR-damage or not-affected-by-MR source
- [x] **MR.erase** · …Erase is unaffected
- [x] **MR.note** · Other debuffs from STR or MR-exempt sources still have their chance reduced

## Battle Continuation — Rank A

- [x] **BC.cut** · All damage received −(2d10+20)
- [x] **BC.np** · …against an NP, the number of dice is doubled
- [x] **BC.revive** · When defeated, he is revived with 5d20 Health
- [x] **BC.cd** · …Cooldown 3◈
- [x] **BC.half** · …only if his Health has been restored above half its maximum since the last revival

## Shapeshift — Rank C

- [x] **SS.p** · Passive: all damage taken −10%; NP 5%
- [x] **SS.when** · Active: during his Turn, or at the start of a Combat Phase when he is Attacked
- [x] **SS.defup** · Def Up, 1◈: all damage taken further −10%; NP 5%
- [x] **SS.cd** · Cooldown 3◈

## Demonic Defender of the State — Rank EX

- [x] **WL.place** · When he is summoned, his player marks out a 9x9 area
- [x] **WL.half** · …on the half of the board nearer to or around his Home Base
- [x] **WL.clip** · …it cannot intersect another Player's Home Base; where it must, it is cut to exclude those panels
- [x] **WL.name** · The area is Wallachia, shown on the board
- [x] **WL.def** · While he is within Wallachia, all damage taken −50%; NP 25%
- [x] **WL.str** · …STR damage dealt +100%, NP included
- [x] **WL.mag** · …MAG damage dealt +50%
- [x] **WL.sus** · …his Sustainability does not decrease
- [x] **WL.zon** · …his Master's ZON is ignored
- [x] **WL.home** · Wallachia is a second Home Base, for him only
- [x] **WL.heal** · …where it overlaps his Home Base, the end-of-Round healing does not stack

## Kazıklı Bey: The Lord of Execution — Rank B *(NP, Anti-Army)*

- [x] **KZ.stack** · Passive: when his Normal Attack deals damage, one Kazıklı stack on the DU at the end of the Damage Step
- [x] **KZ.debuff** · …Kazıklı stacks are a debuff
- [x] **KZ.resist** · …the chance of a stack being removed −50%
- [x] **KZ.unmod** · Damage from both Actives is not affected by damage-modifying effects on him
- [x] **KA.when** · Active 1: during his Turn
- [x] **KA.wall** · …only while he is within Wallachia
- [x] **KA.dur** · …it is Activated for ⅔◈
- [x] **KA.tick** · While Activated: at the end of every Turn he Acts, and at the end of the Round
- [x] **KA.who** · …every enemy Unit within the NP area
- [x] **KA.die** · …rolls a d6 each and takes X STR damage, X = roll × 100
- [x] **KA.evade** · …unless it Evades the NP
- [x] **KA.curse** · …a damaged Unit is inflicted with Curse
- [x] **KA.master** · …it damages a Master even with its Servant within 2 panels
- [x] **KA.ignoredef** · …the damage has Ignore Def
- [x] **KA.block** · …and ignores Block
- [x] **KA.invuln** · …a Unit with Invuln or Anti-Purge takes no damage
- [x] **KA.cd** · Cooldown 6◈
- [x] **KB.when** · Active 2: during his Turn, or at the start or end of a Combat Process involving him
- [x] **KB.area** · …every Unit with Kazıklı stacks within 3 panels of him
- [x] **KB.dmg** · …takes Y damage, Y = 50 × its stacks
- [x] **KB.wall** · …used within Wallachia: Y = 100 × stacks for a Unit also within Wallachia
- [x] **KB.curse** · …then Curse on each Unit affected
- [x] **KB.clear** · …then all its Kazıklı stacks are removed
- [x] **KB.pierce** · …the damage has Pierce and Ignore Def
- [x] **KB.attack** · …counts as his Attack for the Turn when used during his Turn
- [x] **KB.cancel** · At the start of a Combat Process where he is Attacked: the AU's Attack is cancelled
- [x] **KB.counter** · …then he can Counter if the enemy is within Range
- [x] **KB.nocounter** · At the end of a Combat Process he Attacked in: the DU cannot Counter
- [x] **KB.once** · Once per Round (printed "(Turn?)")
- [x] **KB.nocost** · …no Master Health cost

## Legend of Dracula: The Succession of Blood — Rank A+ *(NP, Anti-Unit (Self))*

- [x] **LD.cs** · To use it, his Master spends a Command Spell
- [x] **LD.kill** · …if his Master is within Wallachia, he kills his Master at once
- [x] **LD.perm** · Cannot be deactivated; every effect below is permanent
- [x] **LD.dark** · He gains the Dark (Vampire) Attribute
- [x] **LD.night** · In a Night Round: heal 100 Health and 1 Agility at the end of his Turn, of any Turn he Acts, and of the Round
- [x] **LD.drain** · Each time he deals damage to a Unit: heal 100 Health and 1 Agility
- [x] **LD.slay** · Each time he defeats a Unit: Health and Agility restored by 25% of their maximum
- [x] **LD.civ** · …a Civilian: only 100 Health and 1 Agility
- [x] **LD.shape** · Shapeshift's magnitude is doubled
- [x] **LD.kz** · Kazıklı Bey is unusable and has no effects
- [x] **LD.mr** · Magic Resistance is disabled
- [x] **LD.closest** · He always Attacks, and Moves towards, the closest Unit, allies included
- [x] **LD.range** · Range +1 panel
- [x] **LD.targets** · …number of targets +1
- [x] **LD.move** · He may Move to any unoccupied panel, regardless of obstacles
- [x] **LD.zoc** · …still never into the area around an enemy Master
- [x] **LD.bastr** · Base Attack (STR) +75
- [x] **LD.evade** · Every Evade roll he makes −4
- [x] **LD.agl** · …other Agility Checks are unaffected
- [x] **LD.fire** · Total Fire damage taken +25%

## Live press (2026-10-23, 2026-10-24)

Pressed or Observed live on *Gilles Audit B*, Rounds 45–59, Player1 driving Vlad: 90 of 93 Clauses. The second
session (Rounds 55–59) staged the cases the board never produced:

- **LD.civ**: his two-target Attack killed Civilian A and felled an Elder Horror: Health 700 → 1212, Agility
  8 → 15, the Civilian paying only Ch. 06's 100 and 1. No card said the heals (fixed, Surprise
  `2026-10-24-handler-heals-printed-no-line`); after the fix: "Lancer regains 100 Health (Civilian)." and
  "Lancer regains 312 Health (Legend of Dracula (Activated))."
- **LD.zoc**: an enemy Master with its Servant beside it; his Move onto the panel next to the Master was refused
  from Player1's client, "Step 3 is beside an enemy Master, and its Servant guards that panel.", and the panel
  two away taken.
- **LD.agl**: his Agility Check plan carries no modifier; his Evade's carries −4.
- **KA.ignoredef**: Dracula lifted for the press; the enemy Master held Def Up 50/25 and took the full 600 of a
  6 at the Round's end.
- **KB.pierce**: Chiron held Invuln, Def Up 50/25 and 2 stacks: "Archer: 200 damage, 200 dealt; Health 450 →
  250"; his Invuln stayed.
- **WL.clip**: Faction 2's Home Base staged one row wider; Wallachia placed on a row-5 centre covered rows 1–8,
  72 panels, its ninth row cut.

A Free Vlad cannot pay a B Noble Phantasm: 4◈ is 12 Turns against his 2◈ clock. The presses staged his
Sustainability, then put it back.

Open: **SM.flip, SM.hgw, SM.go** wait on Vlad III (Berserker) (ruling 1).

Twelve defects surfaced live and were fixed with a test first; each is a Surprise dated 2026-10-23 or 2026-10-24.
The log is on #330.
