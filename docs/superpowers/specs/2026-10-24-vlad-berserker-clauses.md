# Vlad III (Berserker) — the Clause list

*Vlad III* (Berserker), built from `char_orig_sheets/by-class/Berserker/Vlad III (Berserker).md`. Started by the
user 2026-10-24.

**Audit opened 2026-10-24 (#333).** **Read by hand, line by line.** No generated draft was used. The sheet opens on the same coin flip as
`Lancer/Vlad III (Lancer).md`, whose three `SM.*` Clauses waited on this Servant (#330 ruling 1). They are
listed here once and close on both lists.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Most of him is other Servants' pieces:

- **Mad Enhancement EX** is `class-mad-enhancement` at EX (75/30, +100%, drain 30) at the Revised text, as
  Gilles de Rais (Saber) holds it (#260 reading 3): no floor, the forced deactivation, clause 5's extra
  Sustainability loss, clause 7's Skill Seal end.
- **Battle Continuation A** is `class-battle-continuation` at A, as the Lancer and Heracles hold it.
- **Shapeshift C**'s Passive 1 is the Lancer's `Ward` (10, NP 5); the Active's window is `defendingPhaseStart`, as
  the Lancer's Shapeshift and Kazıklı Bey's cancel read "the start of a Combat Process where he is Attacked".
- **Bloodsucking**'s NP Cooldown increase is Serenity's and Kiritsugu's `cooldown` phase, `unit: target`,
  `direction: up`; its die is the phase `chance` (`rules/phase-chance.mjs`, Prelati's Encouragement).
- **Fearsome Immortal** is `guts` at 20 and `npRegen` at 1. Guts (Fearsome) is a second Guts, its own id, at a
  revival priority above Guts (Mannanán's 250): the sheet's order is the general one, "Special Guts > Guts >
  Passive revival effects" (`effects/guts.yml`).
- **Kazıklı Bey: Bloodstained King Demon** is Kiritsugu's Chronos Rose's frame (B+, Range 3, STR, 3.5x + 100,
  6◈+⅓◈), the Lancer's permanent `{ id: curse }`, `defDwnA` at 20 (#239: Luck once per successful Attack) and
  `sCritUp` at 10, the aura of #132 (allies within 2 and himself).
- **Legend of Dracula**'s Passive is the Lancer's `legendOfDraculaActivated` handlers: the Night heal, the drain
  per Unit damaged, the 25% per non-Civilian defeat (#330 ruling 16). Night is `war:phase:night`; Day is
  `phaseChanged` (`engine/round-phase.mjs`). The free NP is the Lancer's KB.nocost.

What he needs that nobody has yet, each a generic piece:

- **A summon that flips between two forms** (SM.*), for both Vlads.
- **A Skill's Range raised by a condition** (BS.merange): an anchor's absolute Range plus a predicated bonus.
- **Named Def Up and Atk Up variants** that a later clause finds by name: Def Up (Shapeshift), Atk Up
  (Shapeshift).
- **A duration reset and a duration extension by name** (SS.reset, LD.extend).
- **A magnitude doubled while another effect is held** (LD.double), read live as Dracula comes and goes.
- **An effect removed when the Round turns to Day** (LD.dawn).

**77 Clauses** across 7 Abilities, the summon flip, the revival note and the statblock.

## Rulings (2026-10-24, the user)

| # | Ruling |
|---|---|
| 1 | Seats are drawn by Class, so the seat decides the form and no coin is flipped. A Berserker seat draws Vlad III (Berserker), a Lancer seat Vlad III (Lancer); they are two Servants and a War may hold both. In Grand Order the GM picks the seat (SM.flip, SM.hgw, SM.go; closes the Lancer's SM.* too). |
| 2 | Bloodsucking is used during his Turn (BS.when). |
| 3 | Bloodsucking's increase is 100%, 80% under Mad Enhancement, its d100 on the card; no Magic Resistance or debuff resistance meets it, as Serenity's and Kiritsugu's; his own −1◈ always pays; the DU's clock grows from 0 (BS.np, BS.mechance, BS.self). |
| 4 | Under Mad Enhancement Bloodsucking reaches 2; Mad Enhancement's own Range +1 is his Attack Range and does not add again (BS.merange). |
| 5 | "Reset to 1◈" sets each held Def Up (Shapeshift) and Atk Up (Shapeshift) to exactly 1◈, even with more left (SS.reset). |
| 6 | Atk Up (Shapeshift) does not stack either; Legend of Dracula's step 4 never shortens the one its step 1 extended (LD.atkup). |
| 7 | Dracula doubles live: a held Def Up (Shapeshift) or Atk Up (Shapeshift) doubles when Dracula lands and falls back when it ends (LD.double). |
| 8 | Only a Day Round bars Dracula: in a War with no cycle he gains it, and the Night heal never pays (LD.day, LD.night). |
| 9 | Dracula is removed at any change from Night to Day, a new Round's start or another Unit's mid-Round change, through `phaseChanged` (LD.dawn). |
| 10 | Kazıklı Bey's S.Crit Up lands after a hit only, as Bellerophon's (KZ.crit). |
| 11 | Carried, each with its source: Normal Attack BA(STR) (#330 r2); Region `[romania, europe]` (#330 r3); "a Turn he Acts" (#330 r7); the Shapeshift window `defendingPhaseStart` (#330, #206 r4); Curse with no duration is permanent (Gilles, #330); Def Dwn (A)'s Luck once per successful Attack (#239); S.Crit Up reaches himself and allies within 2 (#132); the drain once per Unit damaged, a Civilian kill pays only Ch. 06's bounty, a revived kill counts (#330 r16); the Passive works under NP Seal (#330 r11); Mad Enhancement at the Revised text (#260 r3); NP Regen ticks at every Turn's end (Appendix A); one revival per defeat, highest first: Guts (Fearsome) 250, Guts 200, Battle Continuation 100 (`guts.yml`). |

## Statblock

- [x] **ST.name** · True Name: Vlad III, shown as Vlad III (Berserker)
- [x] **ST.class** · Class: Berserker
- [x] **ST.region** · Region: Wallachia, Romania, Europe
- [x] **ST.align** · Alignment: Chaotic Evil
- [x] **ST.param** · STR A, END A, AGI C, MAG B, LUC E
- [x] **ST.attr** · Attributes: Male, Servant, [Earth], King, Dark (Vampire), Humanoid, Anti-Hero
- [x] **ST.hp** · Base Health 1500
- [x] **ST.mov** · MOV 4
- [x] **ST.range** · Range 2 panels, 1 target
- [x] **ST.ba** · Base Attack STR 150, MAG 175
- [x] **ST.na** · His Normal Attack uses one Base Attack (the sheet lists both)
- [x] **ST.sus** · Sustainability 2◈
- [x] **ST.items** · Items held: none

## Summoning

- [x] **SM.flip** · When Vlad III is summoned, his summoner flips a Coin: Heads, Vlad III (Lancer); Tails, Vlad III (Berserker)
- [x] **SM.hgw** · …in Normal or Ainsworth HGW, no flip if the Lancer (on the Lancer's sheet: the Berserker) has already been summoned
- [x] **SM.go** · …not in some scenarios: in the Grand Order Campaign the Class is chosen before deploying

## Mad Enhancement — Rank EX *(Class Skill)*

- [x] **ME.when** · Active: used during his Turn
- [x] **ME.lock** · Once Activated, it can be deactivated only 2◈ Turns later, and vice versa
- [x] **ME.drain** · While Active: his Master loses 30 Health at the end of every Turn he Acts
- [x] **ME.forced** · …when his Master's Health is 30 or less, ME is forcibly deactivated
- [x] **ME.def** · All damage taken −75%; NP 30%
- [x] **ME.atk** · All damage dealt +100%, NP included
- [x] **ME.atkmag** · …halved for Attacks that use Base Attack (MAG)
- [x] **ME.mov** · MOV +2
- [x] **ME.range** · Range +1
- [x] **ME.zon** · His Master's ZON +2 panels
- [x] **ME.master** · If his Master is defeated while ME is Active, ME cannot be deactivated
- [x] **ME.stn** · …and his Sustainability falls by 1 more Turn at the end of every Turn
- [x] **ME.evade** · While Active he can Evade only with Evade−
- [x] **ME.status** · Its effects are neither a buff nor a debuff, and are Unremovable
- [x] **ME.seal** · Inflicted with Skill Seal while Active: ME is deactivated at once

## Bloodsucking — Rank A

- [x] **BS.range** · Range 1, used on an enemy Unit
- [x] **BS.np** · Increases its NP Cooldown by 1◈
- [x] **BS.self** · Reduces Vlad's NP Cooldown by 1◈
- [x] **BS.merange** · If Mad Enhancement is Active, the Skill's Range +1
- [x] **BS.mechance** · …but the chance of increasing the DU's NP Cooldown −20%
- [x] **BS.when** · No moment printed
- [x] **BS.cd** · Cooldown 3◈

## Battle Continuation — Rank A

- [x] **BC.cut** · All damage received −(2d10+20)
- [x] **BC.np** · …against an NP, the number of dice is doubled
- [x] **BC.revive** · When defeated, he is revived with 5d20 Health
- [x] **BC.cd** · …Cooldown 3◈
- [x] **BC.half** · …only if his Health has been restored above half its maximum since the last revival

## Fearsome Immortal — Rank A+

- [x] **FI.when** · Active: used during his Turn
- [x] **FI.fearsome** · Guts (Fearsome) for ⅓◈: when defeated, revived with 20% of his Max Health
- [x] **FI.stack** · …it stacks with other normal Guts buffs
- [x] **FI.guts** · Guts for 1◈+⅔◈: when defeated, revived with 20% of his Max Health
- [x] **FI.regen** · NP Regen for 1◈: NP Cooldown −1 Turn at the end of every Turn
- [x] **FI.cd** · Cooldown 4◈−⅓◈

## Revival order *(Note)*

- [x] **RV.order** · With several revivals held, the first consumed is Guts (Fearsome), then Guts, then Battle Continuation

## Shapeshift — Rank C

- [x] **SS.p** · Passive 1: all damage taken −10%; NP 5%
- [x] **SS.when** · Active: during his Turn, or at the start of a Combat Process when he is Attacked
- [x] **SS.defup** · Def Up (Shapeshift) for 1◈: all damage taken further −10%; NP 5%
- [x] **SS.nostack** · …Def Up (Shapeshift) does not stack
- [x] **SS.cd** · Cooldown 3◈
- [x] **SS.reset** · Passive 2: used while he holds Def Up (Shapeshift) and/or Atk Up (Shapeshift), their duration is reset to 1◈

## Kazıklı Bey: Bloodstained King Demon — Rank B+ *(NP, Anti-Unit)*

- [x] **KZ.range** · Range 3, Base Attack (STR)
- [x] **KZ.dmg** · 3.5x damage plus 100
- [x] **KZ.curse** · Inflicts Curse on the DU
- [x] **KZ.defdwn** · Then Def Dwn (A) for 1◈ on the DU: all damage taken +20%
- [x] **KZ.luck** · …Luck −1 whenever it receives damage from an Attack
- [x] **KZ.crit** · Then S.Crit Up for ⅓◈ to all allied Units within 2 panels of himself: Crit Chance +10%
- [x] **KZ.cd** · Cooldown 6◈+⅓◈

## Legend of Dracula: The Succession of Blood — Rank A+ *(NP, Anti-Unit)*

- [x] **LD.dark** · Passive 1: he has the Dark (Vampire) Attribute
- [x] **LD.night** · Passive 2: 100 Health and 1 Agility at the end of any Turn he Acts during a Night Round
- [x] **LD.drain** · Passive 3: each time he deals damage to a Unit, 100 Health and 1 Agility
- [x] **LD.slay** · …each time he kills a non-Civilian Unit, Health and Agility restored by 25% of their maxima
- [x] **LD.when** · Active, Non-damaging: used during his Turn
- [x] **LD.extend** · 1. Def Up (Shapeshift) and/or Atk Up (Shapeshift) held: each extended by 1◈
- [x] **LD.dracula** · 2. He gains Dracula for 1◈
- [x] **LD.double** · …Dracula doubles Shapeshift's Passive, Def Up (Shapeshift) and Atk Up (Shapeshift)
- [x] **LD.status** · …Dracula is neither a buff nor a debuff, and is Unremovable
- [x] **LD.day** · 3. Used during a Day Round: no Dracula
- [x] **LD.dawn** · …the Round turns from Night to Day while he holds Dracula: it is removed at the start of the Day Round
- [x] **LD.atkup** · 4. Atk Up (Shapeshift) for 1◈: all damage dealt +10%; NP 5%
- [x] **LD.cd** · Cooldown 3◈
- [x] **LD.nocost** · …no Master Health cost

## Pressed live (2026-10-24, Rounds 1–6 on *Vlad Berserker Audit*)

A new War built from the setup wizard: Faction 1 (Player1) a Lancer seat and a Berserker seat, Faction 2 a Lancer,
Caster and Berserker seat. Player1 drove Vlad's bar, sheet, window and End Turn; the GM drove the enemies.

- **SM.\***: the Berserker seat's candidates were Asterios, Heracles, Penthesilea, Raikou and Vlad III (Berserker);
  the Lancer seat's Karna, Scáthach and Vlad III (Lancer). No coin. Both Vlads stood in the War. The GM picked each
  seat, Grand Order's case.
- **ST.\***: Player1's sheet: Berserker · Chaotic Evil · Romania, Europe; STR A, END A, AGI C, MAG B, LUC E;
  Attributes with dark, vampire (LD.dark); BA 150/175; MOV 4 and Range 2 under ME's +2/+1; Sustainability 2◈;
  "Normal Attack: fixed component · STR"; no Items.
- **ME.\***: switched on from the bar; MOV 6, Range 3, Master ZON +2; Kazıklı Bey's breakdown "Mad Enhancement
  +100%"; a Normal Attack's "−75%"; "Berserker evade- 1d20 → 2 unfavourable table"; the lock "switched too recently
  — 6 more turn(s)"; "Master … loses 30 Health (Mad Enhancement)" at each acted Turn's end; at 50 Health
  "Mad Enhancement forcibly deactivated"; a staged Skill Seal "Mad Enhancement is deactivated by Skill Seal"; his
  Master killed while Active, the card's Revised line and the bar's refusal (found pressing, fixed); Sustainability
  9 → 7 → 5 over two Turns. ME.status: no Effect row, a mode the sheet keeps apart.
- **BS.\***: on Penthesilea at Range 1, "1d100 → 37 against 100%", her two NPs "Cooldown 0 → 3", his Legend of
  Dracula "Cooldown 9 → 6"; under ME on the Lancer at Range 2, "1d100 → 72 against 80%". Cooldown 3◈ (9 turns).
- **FI.\***, **RV.order**, **BC.\***: "Guts (Fearsome) Guts NP Regen", both Guts held at once, NP Regen taking an
  extra Turn off Legend of Dracula; three staged lethal blows: "revived by Guts (Fearsome), with 300 Health", "by
  Guts, with 300", "by Battle Continuation, with 53. Rolled: 53", then "defeated". After the ruling, each held revival said why: "its Cooldown has 6 Turn(s) left" (BC.cd) and "Health has not been restored above 50% since its last revival" (BC.half).
  BC.cut on a card: "Battle Continuation −37". BC.np on the live board's engine, not a card: an NP's cut 47, past
  2d10+20's 40.
- **SS.\***: Def Up (Shapeshift) on his Turn; offered as "Start of the Combat Phase you are attacked in" when
  Penthesilea attacked; "Atk Up (Shapeshift): 6 → 3 Turns left" and "Def Up (Shapeshift) — already present, does not
  refresh"; breakdown rows "ward Shapeshift −10%", "Def Up (Shapeshift) −10%". Cooldown 3◈.
- **KZ.\***: on Penthesilea, 1187 with "3.5× damage, plus 100" from BA(STR); Curse ticking 25; Def Dwn (A); S.Crit
  Up. With Def Dwn (A) held, his Normal Attack read "Luck 6 → 5". Range 3 legal at 3, "out of Range (3)" at 4.
  Cooldown 6◈+⅓◈.
- **LD.\***: at Night "Def Up (Shapeshift): 3 → 6 Turns left, Dracula, Atk Up (Shapeshift)"; the next attack's
  breakdown "ward −20%", two "Def Up (Shapeshift) −10%" rows; at Day's start "The Round turns to Day — Berserker:
  Dracula: removed" (found pressing, fixed); by Day "No Dracula: Legend of Dracula was used in a Day Round."; Night
  acted Turn "regains 100 Health … Agility 13 → 14" (Agility line found pressing, fixed); a hit "regains 100 Health
  … Agility 10 → 11"; a kill "regains 375 Health … Agility 8 → 12"; the sheet's STATUSES "Dracula"; his Master's
  Health untouched by the use.

Three defects surfaced live and were fixed with a test first: Dracula's dawn removal said nowhere, a boundary's
Agility said nowhere, and `modesLocked` read by no switch. Nursery Rhyme's Glass Game rewound the board at Round 4;
she was taken off and the losses her Nameless Forest left were restored by hand.
