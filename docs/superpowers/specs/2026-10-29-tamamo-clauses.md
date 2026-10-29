# Tamamo (Caster) — the Clause list

*Tamamo no Mae*, the Caster, built from `char_orig_sheets/by-class/Caster/Tamamo.md`. Started by the user 2026-10-29.

**Audit opened 2026-10-29 (#353).**
**Read by hand, line by line.** No generated draft was used. No older `Copia de` sheet exists to compare with. The
sheet prints no `N.Atk Type` and no `{R}`/`{M}`/`{S}` tags. *Tamamo Cat*, *Tamamo (Summer)*, *Tamamo Goth* and *Tamamo
Aria* are other Servants with their own sheets and are not read here.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Caster/Tamamo"`, each confirmed by reading:

- **Territory Creation C** is the `class-territory-creation` template at C (Medea's, Nursery Rhyme's): 5d8 dealt in
  her Home Base, an ally's damage taken in its own Home Base cut by 3d10+10, `highestOnly` among allies.
- **Divinity A** is the `divinity` template, Revised as Arjuna's (`printedRevision: revised`): +50 as Fixed Divine.
- **Witchcraft**'s Passive 1 is the Mana Bursts' `ignoresMagicResistance`, granted as an `AttackProperty` on her MAG
  Attacks and negated as EMIYA's Projections are (`negatedBy: [skillSeal, silence]`). Passive 2 is Scáthach's PRS
  Tokens word for word: a resource, a `cooldownWaiver` on each Spell it covers, automatic.
- **Jusō・Kōnisshō**'s push is Chronos Rose's `cooldown` phase (`unit: target`, `scope: np`, `direction: up`); NP DmUp
  is the built `npDmUp`.
- **Enten, Hyōten, Mitten, Raitei, Kūretsu Daimitten** are Medea's Damage Spells (`isSpell`, MAG, an `element`);
  *"25% extra damage"* is the Spell's own ×1.25 (#193 reading 12, Danzo's Funshindan); Raitei's 3×3 within Range is
  Funshindan's frame. Their lock on each other is Scáthach's `abilityOffCooldown`.
- **Shapeshift** is Nursery Rhyme's `Ward` 30, NP 15.
- **Jusō・Kokutendō**'s window is Vlad's Shapeshift (`[ownTurn, defendingPhaseStart]`); its gate is `notHasEffect`;
  Decoy is `decoy.yml`; *"cannot Evade"* is Sieg's `ForbidReaction`; its cut is a `Ward`.
- **Fox's Wedding** is Shvibzik's heal, clamped Luck and Atk Up; Fox Spouse is Avalon's `Suppress overpower` and the
  Vorpal Blade's `Suppress underpower` on one effect.
- **Yata Strike** is a Mana Burst's `countsAsNormalAttack` with a `fixedValue` base (Barrel Bombing's).
- **Polygamist Castration Fist**'s ×9 against Male is a stage-3 conditional multiplier on `target:attribute:male`
  (Balmung's); its Stun passes chance modifiers as Queen's Poison's stage does and immunities as Enkidu's
  `bypassesImmunity`.
- **Higanbana Sesshoseki**'s stages add as Zabaniya's *"Stage 3 Poison"* does (one application, N stages).
- **Yata no Kagami** is Ramesseum Tentyris's field (`fixedArea`, an `interior` of `DamageModifier`s, `Suppress
  zonPenalty`, `Suppress sustainabilityDecay`, `ownerDefeat`), sized by the War's Region as Chaos Labyrinthos is
  (`regionSizeOverride`), cooling from its end (`countFrom: deactivation`); its Range is a `RangeDelta`.
- **Dainisshō** is Excalibur's `selfEdgeAdjacent` turnable square, sized by `war:region` through targeting
  `branches` (Evil Gaze of the Abyss's); categorized as NP as Karl Cannons, refused by either Seal as the Magic Crest
  (#241); gated by `fieldOpen`; its nine hits are Dohatsu Tenshou's `instances`, each its own Process.

What she needs that nobody has yet, each to be built as a generic piece:

- **A passive negated while a named NP is not Active** (DV.gate): `negatedWhile` beyond `abilityOnCooldown`.
- **A cooldown push capped at the ability's own maximum** (KN.cap).
- **Break (+X%dm)** (MI.break): stage 14 reads `breakSucceeded` and nothing writes it.
- **A Block the defender takes without being asked** (KK.3), and **Dodge and Substitution that do nothing for their
  holder** (KK.2.dodge, KK.2.sub).
- **A cut on being Attacked that falls through Spells, then NPs, then a stacking buff** (KK.5).
- **A Dmg Up spent by the next Attack that deals MAG damage, stacking** (KK.5.buff): Utopia's next-Attack charge, keyed
  on a component.
- **An Attack's Total multiplied by a die** (YS.x), **a Fixed figure that changes on a Crit** (YS.2), and **a Crit Chance
  that grows with each use that did not Crit** (YS.1).
- **An effect's stage read off the DU's Parameter Rank** (HG.curse, HG.poison).
- **An NP with no Rank whose Master cost reads a stated Rank** (HG.np, HG.cost).
- **A field its owner cannot leave** (YK.leave).
- **A Range bonus and a duration set by the War's Region** (YK.range.japan, YK.dur.japan).
- **Master Health costs halved for the Servants inside a field** (YK.6).
- **A resource maximum raised for an NP's duration and filled** (YK.7.max, YK.7.fill).
- **Hits on a random enemy in the area, in order** (DN.random).
- **An ability that ends another at the end of the Turn and lengthens its Cooldown** (DN.end, DN.cd).
- **Earth and Dark damage** (DN.6, DN.8): `ELEMENTS` holds seven, without either.

**186 Clauses** across 14 Abilities, 2 NPs, a Spell categorized as NP, and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Mantra: Boundless Sunlight"*, *"Fiery Heaven"*, *"Frigid Heaven"*, *"Chaos Heaven"*, *"Thunderclap"*, *"Aphotic
  Cave"*, *"Void Cleft Great Chaos Heaven"*, *"Red Spider Lily Killing Stone"*, *"Eightfold Blessings of Amaterasu on
  the Weight Stone under the Sunlit Watery Heavens"*: titles. *"Mantra"* itself is read by Witchcraft (WC.p2.which).
- *"the effects of the 'Aphotic' state are as follows-"*, *"Has the following effects-"*, *"Has 2 extra effects
  depending on…"*, *"This NP has the following effects-"*, *"The effects are as follows, in order"*: headings.
- The struck-through *"Damage dealt which uses BA(MAG)"* and *"BA(STR)"* in Yata no Kagami 3: replaced by the text
  beside them.
- `Held Items:`: an empty slot.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6); here they agree with the sheet: Health 500 at
END E, BA(STR) 50 at STR E, BA(MAG) 200 at MAG A · a Normal Attack whose Base Attack changes with distance is EMIYA's
range band (`rules/normal-attack.mjs`) · a Caster's Spells use BA(MAG) unless stated, and a Damage Spell is an Attack
(Medea, Ch. 17) · *"N% extra damage"* is the ability's own ×(1 + N%) (#193 reading 12) · a Spell is refused by Silence
and Skill Seal (Ch. 17), and one categorized as NP by NP Seal too (#241) · *"NP Cooldown"* naming no NP reaches every
NP, and a ready NP goes onto the clock (#197 reading 6, #199 reading 4) · durations count from the Turn after the Turn
of use (#187 reading 5) · *"all allied Units"* includes the user unless the sheet says *"other"* · *"within a N panel
area of herself"* includes her unless the sheet says *"other"* (#132) · two different effects of one family stack
(#230 reading 4): Shapeshift's and Aphotic's cuts are 60%, NP 30% · *"Inflicts"* with no chance is the effect's base
100%, resisted as usual (Ch. 15) · *"Stage X"* adds X stages in one application (Zabaniya, Ch. 15) · a Curse with no
duration is one stage (Appendix A) · riders land on a hit, not a hurt (§46.4-LI), unless the sheet says *"if damage was
dealt"* · *"restores"* stops at the maximum · a Region named for an area is the War's, not the Servant's (Chaos
Labyrinthos, `engine/fields.mjs`) · a Cooldown waiver by token is automatic (Scáthach) · *"Combat Phase"* is the
declaration's whole Phase (`CONTEXT.md`) · Fixed damage skips stages 2–15 (Ch. 22) · a platform's or field's NP that
ends *"at the end of the Turn"* after its owner falls ends at that Turn's end (Karl, CP.ext.floor) · a sheet binds only
its owner.

## Readings to settle

Asked by grilling, 2026-10-29.

**Round 1, ruled 2026-10-29 (the user): all 33 as recommended.** The frontier is empty: every reading is ruled.
**33 readings ruled.**

| # | Ruling |
|---|---|
| 1 | While Yata no Kagami is not Active she has no Divinity at all: no +50, no Divine Attribute, and no reader of Divinity finds it (DV.gate, DV.attr). |
| 2 | Witchcraft P1 skips Magic Resistance's damage cut on her MAG Attacks; MR still cuts the chance of their debuffs, except where its own text spares Instakill and Death (Karl MR.2.other) (WC.p1). |
| 3 | A Mantra Spell is one printed *"Mantra:"*; less the three excluded, the tokens waive Enten, Hyōten, Mitten and Raitei only; Dainisshō is none (WC.p2.which). |
| 4 | *"Max Cooldown"* is the NP's own printed Cooldown, every NP of the DU: a ready NP goes to 3◈ or its maximum if lower, a cooling one rises to at most its maximum; an Active NP that cools from its end is not pushed (KN.np, KN.cap). |
| 5 | Kōnisshō may target any enemy, a Master or summon included: nothing is pushed, the 2 tokens and NP DmUp still land (KN.nonp). |
| 6 | A Damage Spell with no printed Range reaches one enemy within her live Range: 3, 4 under Yata, 5 under Yata in Japan; Raitei's *"within Range"* is the same (EN.dmg, HY.dmg, MI.dmg, KD.dmg, RA.area). |
| 7 | Break (+50%dm) acts when the DU Blocks: the Block is ignored and the damage ×1.5 at stage 3 with ×1.25 (×1.875); chance 100%; no Block, no bonus; with Pierce the +50% still lands on a DU that Blocked (MI.break). |
| 8 | Raitei hits every Unit in its 3×3, allies too (Funshindan); she may not place it over her own panel (RA.dmg, RA.self). |
| 9 | Kokutendō's second window is Vlad's Shapeshift's: offered when an Attack names her a DU, before her reaction, covering that Attack; ⅓◈ lasts the Turn of use and the next (#187 reading 5) (KK.when, KK.dur). |
| 10 | Aphotic's Decoy is part of the state: no roll, past Debuff Resist and Immune, Unremovable, ending with the state (KK.1). |
| 11 | While Aphotic she is never asked to react: her reaction is Block (25%); Strengthen Block's Luck Check is offered; Pierce and Break pass it; a Counter is still offered after (KK.3). |
| 12 | *"Attacked"* is each Process in which she is the DU that reaches its Damage Step, 0 damage included; an area Attack catching her is one (KK.5.when). |
| 13 | Asked before the cut: any Spell cooling, every cooling Spell −⅓◈; else every cooling NP −⅓◈; else +1 Dmg Up (Aphotic). One branch per Attack (KK.5.spell, KK.5.np, KK.5.buff). |
| 14 | Dmg Up (Aphotic) stacks add, +15% each; her next MAG Attack (a Normal Attack at Range 2+, a Damage Spell, Dainisshō) spends them all (KK.5.buff.stack). |
| 15 | Fox's Wedding reaches any ally within 3, herself included (FW.range). |
| 16 | Fox Spouse: no Servant's Attack on her Master flips the Overpower coin; her Master's Attacks on Servants flip no Underpower coin (FW.3.op, FW.3.up). |
| 17 | Yata Strike is a Normal Attack for every reader (spends her Normal Attack, Counters, Normal Attack buffs), at its own Range 2 (YS.na, YS.range). |
| 18 | Yata Strike deals 10 × 1d8, 15 × 1d8 on a Crit, the d8 on the card; Fixed: no Attack±, Atk Up, Divinity, Def Up or Block (YS.dmg, YS.x, YS.2). |
| 19 | Its Crit coin is flipped as any Attack's: 50% + Crit Up + 10 per counted non-Crit; a non-Crit raises the count; an Evaded or Missed use flips no coin and leaves it (YS.1, YS.1.reset). |
| 20 | Stun (Balls)'s 90% is flat: no Debuff Resist, MR cut, Stun Resist, Debuff Immune or Stun Immune touches it; it is a Stun for every other reader (PF.flat, PF.immune). |
| 21 | Rank ? is no Rank: a reader of the NP's Rank finds none; its Master cost is the Rank E row, 10 / 20 (HG.np, HG.cost). |
| 22 | A Rank with + or − reads its letter's row; a DU with no Parameters (a Master) reads the D/E row: stage 3 (HG.norank). |
| 23 | The Amaterasu Area is fixed where it opens, centred on her; it does not move (YK.area). |
| 24 | Every exit is closed while the NP lasts: her own Move out is refused, a knockback or pull stops at the edge (Bašmu's sealed exit), the Escape Command Spell is refused (YK.leave). |
| 25 | In Japan her Range is +2 in place of +1 (YK.range.japan). |
| 26 | Effects 1 and 2 reach every ally inside when it opens, herself and Masters included, once: 30% of each pool's maximum, stopping at it; every cooling Skill, Spell and NP −1◈ except Yata itself (YK.1.*, YK.2). |
| 27 | Effect 3 holds for an ally standing inside as it deals the damage, its target anywhere: MAG part +100%, STR part +50%, an Atk Up at stage 4; Fixed damage untouched; Masters and summons too (YK.3.*). |
| 28 | Effect 6 halves, rounded down, every Master Health cost an allied Servant inside the Area charges (an NP's use, a Skill's, an upkeep); Yata's own cost is paid before the Area exists, in full (YK.6, YK.6.np). |
| 29 | When Yata ends her maximum is 3 again and tokens above 3 are lost (YK.7.end). |
| 30 | Dainisshō's 7×7 (9×9 in Japan) lies against one of her four sides, its near edge touching her, centred on her row or column, the side her player picks (Excalibur's `selfEdgeAdjacent`) (DN.area). |
| 31 | Each of hits 1 to 8 picks an enemy at random among those in the area as it strikes, repeats allowed, each its own Process with its own reaction; with none left a hit does nothing; hit 9 strikes every enemy; allies are never struck (DN.random, DN.9). |
| 32 | Dainisshō has no Cooldown of its own: once per Yata, as its use ends Yata at that Turn's end; no Master Health cost (Karl Cannons); it is her Attack for the Turn (DN.uses). |
| 33 | Yata no Kagami's Cooldown after it ends is 5◈ when Dainisshō was used (DN.cd). |

## Statblock

- [x] **ST.name** · True Name: Tamamo no Mae — Observed live 2026-10-29: Player1's sheet: Tamamo no Mae
- [x] **ST.class** · Class: Caster (the sheet's folder; no Class line is printed) — Observed live 2026-10-29: Player1's sheet: CASTER
- [x] **ST.region** · Region: Japan — Observed live 2026-10-29: Player1's sheet: JAPAN
- [x] **ST.align** · Alignment: Neutral Evil — Observed live 2026-10-29: Player1's sheet: NEUTRAL EVIL
- [x] **ST.param** · STR E, END E, AGI B, MAG A, LUC D — Observed live 2026-10-29: projection: E E B A D
- [x] **ST.attr** · Attributes: Female, Servant, [Sky], Humanoid, Demonic Beast, Animalistic, Anti-Hero — Observed live 2026-10-29: projection: female, servant, sky, humanoid, demonicBeast, animalistic, antiHero (+ implied)
- [x] **ST.hp** · Base Health 500 — Observed live 2026-10-29: baseHealth 500; sheet 500 / 600 with Karl's Ceremonial Reformation +100
- [x] **ST.mov** · MOV 5 — Observed live 2026-10-29: sheet: MOV 5
- [x] **ST.range** · Range 3 panels, 1 target — Observed live 2026-10-29: sheet: RANGE 3, TARGETS 1
- [x] **ST.ba** · Base Attack STR 50, MAG 200 — Observed live 2026-10-29: sheet: BA (STR) 50, BA (MAG) 200
- [x] **ST.sus** · Sustainability 4◈ — Observed live 2026-10-29: sheet: SUSTAINABILITY 4◈
- [x] **ST.mantra** · Mantra Tokens 0/3: a pool, starting at 0, maximum 3 — Observed live 2026-10-29: sheet: Mantra ○○○ 0 / 3
- [x] **ST.na.str** · At a Range of 1, Normal Attacks use BA(STR) — Pressed live 2026-10-29: Player1's Normal Attack on Asterios at 1 (tick 5): breakdown 'base:str 50'
- [x] **ST.na.mag** · At a Range of 2 or higher, Normal Attacks use BA(MAG) — Pressed live 2026-10-29: Player1's Normal Attack on Arturia at 3: breakdown 'Base BA(MAG) +200' (Witchcraft defect found here, fixed)
- [x] **ST.items** · Held Items: none — Observed live 2026-10-29: sheet: no held Items

## Territory Creation — Class Skill, Rank C *(Passive 1 + 2)*

- [x] **TC.p1** · *(P1)* In her Home Base, all damage she deals +5d8 — Pressed live 2026-10-29: Tamamo's Normal Attack from her Home Base (tick 8): 'flatDamage 27 (Territory Creation)', 5d8
- [x] **TC.p1.np** · …including NP — Pressed live 2026-10-29: Player1's Higanbana from her Home Base: 'flatDamage 19 (Territory Creation)'
- [x] **TC.p2** · *(P2)* Damage taken by allied Units in their Home Base further reduced by 3d10+10 — Pressed live 2026-10-29: Asterios's Attack on Karl in his Home Base (tick 11): 'damageNegation −34 (Territory Creation)'
- [x] **TC.p2.np** · …including NP — Pressed live 2026-10-29: Arjuna's Agni Gandiva (NP) on Karl in his Home Base (tick 11): 'damageNegation −27 (Territory Creation)'
- [x] **TC.p2.field** · …only while she is on the field — Pressed live 2026-10-29: the cut is Tamamo's aura: Karl holds no Territory Creation of his own, the source is hers while she stands on the board
- [x] **TC.stack** · With several allied Territory Creations, only the highest Rank takes effect — Observed live 2026-10-29 (cloud, War A): Asterios's Normal Attack on Tamamo in her Home Base, Medea (Territory Creation A) on the field: one row 'damageNegation Territory Creation −42', projection one entry 3d10+20 from Medea (42 is over C's 40); Medea's token taken off the field, same attacker and defender (tick 5): one row −21, projection 3d10+10 from Tamamo

## Divinity — Rank A *(Passive)*

- [x] **DV.dmg** · All damage dealt +50 — Pressed live 2026-10-29: same: 'Divinity (Fixed Divine, added after every modifier)' +50
- [x] **DV.np** · …including NP — Pressed live 2026-10-29: same NP: 'Divinity (Fixed Divine…)' +50
- [x] **DV.fixed** · …dealt as Fixed Divine Damage — Pressed live 2026-10-29: same: flags fixedExtra 50, stage 16 '+50 added after every modifier'
- [x] **DV.injury** · …not counted toward the amount required for an Injury Roll — Pressed live 2026-10-29: same: '+50 … outside the Injury Roll'
- [x] **DV.gate** · Only in effect while Yata no Kagami is Active; negated and without effect while it is not (Q) — Pressed live 2026-10-29: before Yata: no Divine, no Divinity flat (tick 1-4 projection); after: both
- [x] **DV.attr** · …the Divine Attribute Divinity grants follows the gate (Q) — Pressed live 2026-10-29: Divine Attribute only with amaterasu held

## Witchcraft — Rank EX *(Passive 1 + 2)*

- [x] **WC.p1** · *(P1)* Her Attacks that use BA(MAG) ignore Magic Resistance (Q) — Pressed live 2026-10-29: Enten (MAG) on Arjuna, who has Magic Resistance: no resistance stage contributor; his MR still cut the Burn's chance (reading 2)
- [x] **WC.p1.seal** · …negated while she is under Skill Seal — Pressed live 2026-10-29: Skill Seal staged; Player1's MAG Normal Attack on Cú at 2 (tick 8): breakdown 'magicResistance −78.27'
- [x] **WC.p1.silence** · …negated while she is under Silence — Pressed live 2026-10-29: Silence staged; Player1's MAG Normal Attack on Cú at 2 (tick 8): breakdown 'magicResistance −80.25'
- [x] **WC.p2** · *(P2)* Using a Mantra Spell while she holds any Mantra Token removes one token — Pressed live 2026-10-29: Enten with 2 Mantra Tokens: Mantra 2 → 1
- [x] **WC.p2.cd** · …and that Spell does not enter Cooldown — Pressed live 2026-10-29: same use: Enten cooldown 0
- [x] **WC.p2.which** · …a Mantra Spell is one printed *"Mantra:"*; Kōnisshō, Kokutendō and Kūretsu Daimitten are — Pressed live 2026-10-29: Enten carries the waiver; Kōnisshō used with 0 tokens spent none (tick 1)
  excluded, leaving Enten, Hyōten, Mitten and Raitei (Q) · *Untouched*
- [x] **WC.p2.excl** · …an excluded Spell spends no token and enters its Cooldown with tokens held — Pressed live 2026-10-29: same use with 5 tokens held: none spent ('Mantra 5 → 6'), Kōnisshō cooldown 12 entered
- [x] **WC.p2.max** · She holds at most 3 Mantra Tokens — Pressed live 2026-10-29: Kōnisshō with 3 of 3 (tick 8): card 'Mantra 3 (no change)'

## Jusō・Kōnisshō — Rank A *(Spell)*

- [x] **KN.spell** · A Spell — Pressed live 2026-10-29: Silence staged on Tamamo (tick 8): Player1's Kōnisshō refused, reason prevented by silence (notice wording fixed live to 'Prevented by Silence')
- [x] **KN.when** · Used during her Turn — Pressed live 2026-10-29: Player1 cast it on her Turn (Round 1, tick 1)
- [x] **KN.range** · Range 3, on an enemy Unit within Range — Pressed live 2026-10-29: Player1's Kōnisshō on Cú's Master at 4 (inside her grown Range 4): refused 'out of Range (3)'; at 3 it was used
- [x] **KN.np** · Its NP Cooldown +3◈ — Pressed live 2026-10-29: Kōnisshō on Cú as Player1: card 'Barbed Spear: Cooldown 0 → 9', 'Soaring Spear: Cooldown 0 → 9'
- [x] **KN.cap** · …not past that NP's maximum Cooldown (Q) — Pressed live 2026-10-29: Player1's Kōnisshō on Cú, his NPs staged at 15 (tick 5): card 'Barbed Spear: Cooldown 15 → 18' (6◈ max), 'Soaring Spear: 15 → 19' (6◈+⅓◈ max)
- [x] **KN.nonp** · …on an enemy with no NP, nothing is pushed and the rest still runs (Q) — Pressed live 2026-10-29: Player1's Kōnisshō on Cú's Master (tick 5): legal; card 'Mantra 6 (no change)', NP DmUp on both allies within 2; his Magic Crest (categorized as NP) pushed 0 → 6 (Q to the user)
- [x] **KN.tokens** · Then she gains 2 Mantra Tokens — Pressed live 2026-10-29: same use: card 'Mantra 0 → 2'
- [x] **KN.dmup** · After that, NP DmUp for 1◈ to all other allied Units within a 2 panel area around her — Pressed live 2026-10-29: same use: NP DmUp on her Master (15,14) and Karl (14,12), expiry 4 (1◈)
- [x] **KN.dmup.30** · …NP damage dealt +30% — Pressed live 2026-10-29: same use: NP DmUp magnitude 30
- [x] **KN.other** · …not herself — Pressed live 2026-10-29: same use: no NP DmUp on Tamamo
- [x] **KN.cd** · Cooldown 4◈ — Pressed live 2026-10-29: Kōnisshō cooldown 12 = 4◈

## Jusō・Enten *(Damage Spell)*

- [x] **EN.dmg** · Damage Spell: ×1.25 (BA(MAG)) on one enemy within her Range (Q) — Pressed live 2026-10-29: Player1's Enten on Arjuna at 3 (tick 5): breakdown 'base:mag 200', 'multiplier 1.25', 260
- [x] **EN.burn** · 50% chance of Burn for 2◈ — Pressed live 2026-10-29: same: card 'Burn [rolled 1 vs 35%]': 50 less Arjuna's MR cut 15; Burn landed
- [x] **EN.fire** · Fire damage — Pressed live 2026-10-29: same Process: attack.element fire
- [x] **EN.cd** · Cooldown 1◈ — Pressed live 2026-10-29: Enten with 0 tokens on Cú (tick 8): Enten cooldown 3 = 1◈
- [x] **EN.lock** · Cannot be used while Hyōten, Mitten or Raitei is on Cooldown — Pressed live 2026-10-29: Player1's Enten while Mitten cools: refused 'Not while Jusō・Mitten is on Cooldown.'

## Jusō・Hyōten *(Damage Spell)*

- [x] **HY.dmg** · Damage Spell: ×1.25 (BA(MAG)) on one enemy within her Range (Q) — Pressed live 2026-10-29: Player1's Hyōten on Arjuna (tick 5): 'base:mag 200', 'multiplier 1.25', 332
- [x] **HY.disable** · 50% chance of Disable for 1◈ — Pressed live 2026-10-29: same: card 'Disable (rolled 49 vs 35%)', 50 less his MR 15
- [x] **HY.ice** · Ice damage — Pressed live 2026-10-29: same Process: attack.element ice
- [x] **HY.cd** · Cooldown 1◈ — Pressed live 2026-10-29: Hyōten with 0 tokens on Cú (tick 8): cooldown 3 = 1◈; its Disable landed (rolled 14 vs 35%)
- [x] **HY.lock** · Cannot be used while Enten, Mitten or Raitei is on Cooldown — Pressed live 2026-10-29: Player1's Hyōten while Mitten cools: refused 'Not while Jusō・Mitten is on Cooldown.'

## Jusō・Mitten *(Damage Spell)*

- [x] **MI.dmg** · Damage Spell: ×1.25 (BA(MAG)) on one enemy within her Range (Q) — Pressed live 2026-10-29: Player1's Mitten on Arjuna (tick 5): 'base:mag 200', 'multiplier 1.25'
- [x] **MI.pierce** · The extra damage has the Pierce effect — Pressed live 2026-10-29: same: Block ignored, Pierce on the damage block
- [x] **MI.break** · …and the Break (+50%dm) effect (Q) — Pressed live 2026-10-29: same, Arjuna Blocked: 'conditionalMultiplier 1.5' beside ×1.25, no Block row; 354
- [x] **MI.wind** · Wind damage — Pressed live 2026-10-29: same Process: attack.element wind
- [x] **MI.cd** · Cooldown 1◈ — Pressed live 2026-10-29: no token: Mitten cooldown 3 = 1◈
- [x] **MI.lock** · Cannot be used while Enten, Hyōten or Raitei is on Cooldown — Pressed live 2026-10-29: Mitten while Enten cools: refused 'Not while Jusō・Enten is on Cooldown.'

## Jusō・Raitei *(Damage Spell)*

- [x] **RA.area** · Hits a 3×3 panel area within her Range — Pressed live 2026-10-29: Player1's Raitei centred (13,16) at 2 within her Range (tick 5): a 3×3, two Processes
- [x] **RA.dmg** · ×1.25 (BA(MAG)) to each Unit in it (Q) — Pressed live 2026-10-29: same: Asterios 710 and ally Karl 437, each ×1.25 MAG
- [x] **RA.shock** · 50% chance of Shock for 2◈ — Pressed live 2026-10-29: same: 'Shock [rolled 1 vs 50%]' on Asterios; Karl 20% past his MR
- [x] **RA.lightning** · Lightning damage — Pressed live 2026-10-29: same Processes: attack.element lightning
- [x] **RA.self** · Tamamo cannot be within the Spell area — Pressed live 2026-10-29: Raitei centred (13,15), over her panel: refused 'The caster cannot be within this ability's area.'
- [x] **RA.cd** · Cooldown 2◈ — Pressed live 2026-10-29: Raitei with 0 tokens (tick 8): cooldown 6 = 2◈
- [x] **RA.lock** · Cannot be used while Enten, Hyōten or Mitten is on Cooldown — Pressed live 2026-10-29: Player1's Raitei while Mitten cools: refused 'Not while Jusō・Mitten is on Cooldown.'

## Shapeshift — Rank A *(Passive)*

- [x] **SS.cut** · All damage taken −30% — Pressed live 2026-10-29: same Attack: breakdown 'ward −30 (Shapeshift)'
- [x] **SS.np** · …if NP, 15% — Pressed live 2026-10-29: Arjuna's Agni Gandiva (NP) on Aphotic Tamamo (tick 7): 'ward −15' (Shapeshift)

## Jusō・Kokutendō *(Spell)*

- [x] **KK.spell** · A Spell — Pressed live 2026-10-29: same Silence: Kokutendō refused, prevented by silence
- [x] **KK.when** · Used during her Turn, or at the start of a Combat Phase when she is Attacked (Q) — Pressed live 2026-10-29: Arjuna's Attack on Tamamo (Faction 2's Turn, tick 4): Player1 offered 'Start of the Combat Phase you are attacked in', picked Kokutendō: Aphotic on her
- [x] **KK.dur** · She enters the 'Aphotic' state for ⅓◈ — Pressed live 2026-10-29: Aphotic cast at tick 4 for ⅓◈
- [x] **KK.status** · …neither a buff nor a debuff — Pressed live 2026-10-29: aphotic polarity status, neither buff nor debuff
- [x] **KK.unremovable** · …Unremovable — Observed live 2026-10-29: aphotic unremovable: true
- [x] **KK.1** · *(1)* She gains the 'Decoy' effect (Q) — Pressed live 2026-10-29: Arjuna, 3 from Aphotic Tamamo, aimed at Karl (tick 7): refused 'No legal targets: Ruler is …compelled…' (wording fixed live to name whom he must attack)
- [x] **KK.2.evade** · *(2)* She cannot Evade — Pressed live 2026-10-29: same Process: forbiddenReactions [evade]
- [x] **KK.2.dodge** · …Dodge has no effect — Pressed live 2026-10-29: Dodge (1 use) staged on Aphotic Tamamo; Asterios's Attack (tick 7): no Evade, Block forced, Dodge still 1 use
- [x] **KK.2.sub** · …Substitution has no effect — Pressed live 2026-10-29: Substitution staged on her: the same Attack was not halted, 8 dealt
- [x] **KK.3** · *(3)* She automatically Blocks every Attack she receives (Q) — Pressed live 2026-10-29: Asterios's Attack on Aphotic Tamamo (tick 4): ladder 'react → block', no prompt to Player1; breakdown 'block −25' (window defect found and fixed first)
- [x] **KK.4** · *(4)* All damage taken −30% — Pressed live 2026-10-29: same Attack: breakdown 'ward −30' twice, Shapeshift's and Aphotic's
- [x] **KK.4.np** · …if NP, 15% — Pressed live 2026-10-29: same NP: the second 'ward −15' (Aphotic)
- [x] **KK.5.when** · *(5)* Whenever she is Attacked while Aphotic, at the end of the Damage Step (Q) — Pressed live 2026-10-29: same Attack, at its Damage Step's end: card lines below
- [x] **KK.5.spell** · …her Spell Cooldown −⅓◈ (Q) — Pressed live 2026-10-29: card 'Jusō・Kōnisshō: Cooldown 9 → 8'; Fox's Wedding (a Skill) not cut
- [x] **KK.5.self** · …Kokutendō's own included — Pressed live 2026-10-29: card 'Jusō・Kokutendō: Cooldown 6 → 5'
- [x] **KK.5.np** · …if no Spell is on Cooldown, her NP Cooldown −⅓◈ instead (Q) — Pressed live 2026-10-29: Cú's Attack on Aphotic Tamamo, every Spell staged ready (tick 7): card 'Higanbana: Cooldown 6 → 5', 'Yata no Kagami: Cooldown 14 → 13'
- [x] **KK.5.buff** · …if no Spell and no NP is on Cooldown, Dmg Up (Aphotic) for 1 time instead — Pressed live 2026-10-29: Asterios's Attack on Aphotic Tamamo, nothing cooling (tick 7): card 'Dmg Up (Aphotic)'
- [x] **KK.5.buff.15** · …damage dealt by her next Attack that deals MAG damage +15% — Pressed live 2026-10-29 (cloud, War A): Player1's Normal Attack on Arjuna at 3 holding Dmg Up (Aphotic) 15 (tick 2): stage 4 'Atk Up Dmg Up (Aphotic) +15% ✕ +15% → ×1.15', 178 → 204.7, 223 dealt, card 'Dmg Up (Aphotic): removed'; the same attack from the same panel without it (tick 4): stage 4 '✕ +0% → ×1.00', 237 → 237. The Dmg Up came from a 0-damage Attack on Aphotic Tamamo, Kokutendō's own Cooldown staged 5 → 0 first
- [x] **KK.5.buff.np** · …including NP — Pressed live 2026-10-29 (cloud, War A): Player1's Dainisshō (categorized as NP) holding Dmg Up (Aphotic) 15 (tick 11): all eleven Processes stage 4 'Atk Up Dmg Up (Aphotic) +15% → ×1.15' (hit 9 on Asterios 489.9 at stage 4, 1054 dealt), removed once, on the last card; Yata no Kagami's use (tick 8), a non-damaging NP, left it held
- [x] **KK.5.buff.stack** · …Dmg Up (Aphotic) stacks (Q) — Pressed live 2026-10-29: Cú's next Attack: a second 'Dmg Up (Aphotic)', two of 15 held
- [x] **KK.5.buff.unremovable** · …and is Unremovable — Pressed live 2026-10-29: Dmg Up (Aphotic) unremovable: true
- [x] **KK.lock** · Cannot be used while she is Aphotic — Pressed live 2026-10-29: Player1 pressed Kokutendō on the sheet while Aphotic (tick 8): 'Jusō・Kokutendō cannot be used: Blocked by Aphotic, in force.' (double stop fixed live)
- [x] **KK.cd** · Cooldown 2◈ — Pressed live 2026-10-29: Kokutendō cast at tick 7: card 'Jusō・Kokutendō: Cooldown 6 → 5', 6 = 2◈

## Fox's Wedding — Rank EX *(Active)*

- [x] **FW.range** · Range 3, used on an allied Unit (Q) — Pressed live 2026-10-29: Player1's Fox's Wedding on Karl at 4 (tick 8): refused 'Ruler is out of Range (3).'
- [x] **FW.1.hp** · *(1)* Restores its Health by 20% of its maximum — Pressed live 2026-10-29: Player1's Fox's Wedding on Tamamo: card 'Health 300 → 420 (+120)', 20% of her 600
- [x] **FW.1.luck** · …and its Luck by 3 — Pressed live 2026-10-29: same use: card 'Luck 1 → 4'
- [x] **FW.1.master** · …5 Luck instead on her Master — Pressed live 2026-10-29: on her Master: card 'Luck 2 → 7' (+5), 'Health 226 → 327 (+101)'
- [x] **FW.2** · *(2)* Atk Up for 1◈: all damage dealt +50% — Pressed live 2026-10-29: same use: Atk Up 50, expiry 4 (1◈)
- [x] **FW.2.np** · …if NP, 30% — Pressed live 2026-10-29: same use: Atk Up npMagnitude 30
- [x] **FW.3.master** · *(3)* Used on her Master: 'Fox Spouse' on her Master — Pressed live 2026-10-29: on her Master: card 'Fox Spouse' on her Master
- [x] **FW.3.self** · …used on Tamamo while her Master is within a 2 panel area of her: 'Fox Spouse' on her Master — Pressed live 2026-10-29: same use on Tamamo, her Master 1 away: card 'Fox Spouse' on her Master
- [x] **FW.3.dur** · …for 1◈ — Pressed live 2026-10-29: Fox Spouse expiry 4 (1◈)
- [x] **FW.3.op** · …her Master cannot be Overpowered by Servants (Q) — Pressed live 2026-10-29: Arturia's Attack on Tamamo's Master, Fox Spouse held (tick 11): card 'Overpower: no coin (Fox Spouse)' (line added live)
- [x] **FW.3.up** · …nor Underpowered by Servants (Q) — Pressed live 2026-10-29: her Master's Normal Attack on Asterios (tick 8), Fox Spouse held: card 'Underpower: no coin (Fox Spouse)' (line added live)
- [x] **FW.3.unremovable** · …Fox Spouse is Unremovable — Pressed live 2026-10-29: Fox Spouse unremovable: true
- [x] **FW.cd** · Cooldown 4◈ — Pressed live 2026-10-29: Fox's Wedding cooldown 12 = 4◈

## Jusō・Kūretsu Daimitten *(Damage Spell)*

- [x] **KD.dmg** · Damage Spell: ×2 (BA(MAG)) on one enemy within her Range (Q) — Pressed live 2026-10-29: Player1's Kūretsu on Arjuna at 3 (tick 5): 'base:mag 200', 'multiplier 2', 512
- [x] **KD.stun** · 75% chance of Stun for 1◈ — Pressed live 2026-10-29: same: card 'Stun (rolled 86 vs 60%)', 75 less his MR 15
- [x] **KD.cd** · Cooldown 3◈ — Pressed live 2026-10-29: Kūretsu cooldown 9 = 3◈

## Yata Strike *(Attack Skill)*

- [x] **YS.na** · Used instead of a Normal Attack, and categorized as one (Q) — Pressed live 2026-10-29: Player1's Yata Strike on Asterios (tick 5): attack asNormalAttack, her Attack spent (turnState.attacked)
- [x] **YS.range** · Range 2 — Pressed live 2026-10-29: used at Range 1 of its Range=2
- [x] **YS.dmg** · Deals 10 Fixed STR damage — Pressed live 2026-10-29: same: breakdown 'fixed damage ×1d8 = 5' = 50
- [x] **YS.x** · Total Damage × X, X a d8 (Q) — Pressed live 2026-10-29: same: Total 10 × d8 5 = 50
- [x] **YS.1** · *(1)* Each use that does not Crit raises this Skill's Crit Chance by 10% (Q) — Pressed live 2026-10-29: Player1's Yata Strike after one that did not Crit (tick 8): breakdown 'no Crit at 60% (+10)' (chance put on the card live)
- [x] **YS.1.reset** · …the count resets after it Crits — Pressed live 2026-10-29: after that Crit: critMisses 1 → 0
- [x] **YS.2** · *(2)* On a Crit it deals 15 STR damage instead of 10 — Pressed live 2026-10-29: Player1's second Yata Strike, dice staged low: 'fixed damage (Crit) ×1d8 = 1' = 15

## Polygamist Castration Fist *(Attack Skill)*

- [x] **PF.range** · Attack Skill, Range 2 — Pressed live 2026-10-29: Player1's Fist on Asterios (tick 5): an Attack Skill
- [x] **PF.dmg** · BA(STR) ×3 — Pressed live 2026-10-29: same: 'base:str 50', 'multiplier 3'
- [x] **PF.male** · …against a Male Unit, ×9 instead — Pressed live 2026-10-29: same, Asterios Male: 'conditionalMultiplier 3' (×9), 782
- [x] **PF.stun** · …against a Male Unit, 90% chance of Stun (Balls) for 1◈ — Pressed live 2026-10-29: same: card 'Stun (Balls) [rolled 38 vs 90%]', Stun (Balls) on Asterios
- [x] **PF.dealt** · …only if damage was dealt — Pressed live 2026-10-29: Invuln staged on Asterios; Fist (tick 8): 'invuln −128.7', 0 dealt, no Stun (Balls) roll (card line for the held rider added live)
- [x] **PF.flat** · …no effect that changes a chance of inflicting or receiving debuffs touches it (Q) — Pressed live 2026-10-29: Fist on Arjuna, who has Magic Resistance (tick 8): card 'Stun (Balls) [rolled 41 vs 90%]', no cut
- [x] **PF.immune** · …nor Debuff Immune, nor any effect that resists Bind effects specifically (Q) — Pressed live 2026-10-29: Debuff Immune and Stun Immune staged on Arjuna: Stun (Balls) landed past both
- [x] **PF.cd** · Cooldown 3◈ — Pressed live 2026-10-29: Fist cooldown 9 = 3◈

## Tokoyo Sakisaku Daisakkai・Higanbana Sesshoseki — Rank ? *(NP)* [Anti-Unit]

- [x] **HG.np** · An NP, Anti-Unit, Rank ? (Q) — Pressed live 2026-10-29: Player1's Higanbana (tick 5): kind NP, Anti-Unit, no Rank
- [x] **HG.range** · Range 1 — Pressed live 2026-10-29: used at Range 1 on Asterios
- [x] **HG.dmg** · BA(STR) ×2 — Pressed live 2026-10-29: same: 'base:str 50', 'multiplier 2', 209
- [x] **HG.curse** · *(1)* Stage X Curse on the DU by its MAG Rank: EX, A: 1 · B, C: 2 · D, E: 3 — Pressed live 2026-10-29: Higanbana on Asterios (MAG D): Curse stage 3; on Cú (MAG C): card 'Curse (Stage 2)' (stage line fixed live)
- [x] **HG.poison** · *(2)* Stage X Poison on the DU by its END Rank: EX, A: 1 · B, C: 2 · D, E: 3 — Pressed live 2026-10-29: on Asterios (END A++): Poison stage 1; on Cú (END C): card 'Poison (Stage 2)'
- [x] **HG.norank** · …a DU with no such Rank (Q) — Pressed live 2026-10-29: Higanbana on Cú's Master, who has no Parameters (tick 8): card 'Curse (Stage 3)', 'Poison (Stage 3)', the D/E row
- [x] **HG.cd** · Cooldown 3◈ — Pressed live 2026-10-29: Higanbana cooldown 9 = 3◈
- [x] **HG.cost** · Her Master loses Health as for a Rank E NP (Q) — Pressed live 2026-10-29: same use: her Master 253 → 243, Rank E's 10

## Suiten Nikkou Amaterasu Yanoshisu Ishi・Yata no Kagami — Rank D *(NP, Non-damaging)* [Anti-Army]

- [x] **YK.np** · An NP, Anti-Army, Rank D, non-damaging — Pressed live 2026-10-29: Player1 used it on her Turn (tick 5): card 'Suiten Nikkou Amaterasu Yanoshisu Ishi・Yata no Kagami applied'
- [x] **YK.area** · A 5×5 panel area around her: the 'Amaterasu Area' (Q) — Pressed live 2026-10-29: field 25 panels, anchored at her panel (14,14)
- [x] **YK.area.japan** · …7×7 if the Region is Japan — Pressed live 2026-10-29: War Region staged to Japan; Player1's Yata no Kagami (tick 8): field 49 panels, rows 20-26, cols 1-7
- [x] **YK.leave** · She cannot leave the Amaterasu Area (Q) — Pressed live 2026-10-29: Player1 walked Tamamo toward (17,13): refused 'Step 4 leaves Amaterasu Area, which this Unit cannot leave.' (named live); Karl walked out to (13,11) freely
- [x] **YK.range** · Her Range +1 for the NP's duration — Pressed live 2026-10-29: Tamamo's Range 3 → 4 (amaterasu magnitude 1)
- [x] **YK.range.japan** · …+2 if the Region is Japan (Q) — Pressed live 2026-10-29: same: Range 3 → 5, amaterasu magnitude 2
- [x] **YK.1.hp** · *(1)* Allied Units within the Area on activation: Health restored by 30% of its maximum (Q) — Pressed live 2026-10-29: card: Tamamo 'Health 403 → 583 (+180)', her Master '100 → 251 (+151)', Karl '800 → 1280 (+480)', 30% of each maximum
- [x] **YK.1.agi** · …Agility by 30% of its maximum — Pressed live 2026-10-29: card: Karl 'Agility 5 → 9', Tamamo '18 → 19' (capped), Master '10 → 11'
- [x] **YK.1.luck** · …Luck by 30% of its maximum — Pressed live 2026-10-29: card: Karl 'Luck 3 → 8', Tamamo '4 → 5', Master '9 → 10'
- [x] **YK.2** · *(2)* Allied Units within the Area on activation: Skill, Spell and NP Cooldown −1◈ — Pressed live 2026-10-29: card: Kōnisshō 6 → 3, Kūretsu 9 → 6, Karl's Great Emperor Privilege 9 → 6, Carolus Patricius 9 → 6
- [x] **YK.2.self** · …not this NP's own Cooldown — Pressed live 2026-10-29: Yata no Kagami's own Cooldown untouched, 0 and waiting on its end
- [x] **YK.3.mag** · *(3)* Allied Units within the Area: MAG damage dealt +100% (Q) — Pressed live 2026-10-29: Player1's Enten on Asterios inside the Area (tick 5): stage 5 'Amaterasu Area (MAG only)' +100
- [x] **YK.3.str** · …STR damage dealt +50% — Pressed live 2026-10-29: Karl's Normal Attack on Cú from inside (tick 5): stage 5 phys 126.25 → 189.375 (STR +50%)
- [x] **YK.3.np** · …NP too — Pressed live 2026-10-29: Player1's Higanbana (NP) inside the Area (tick 5): 'Amaterasu Area (STR only)' +50
- [x] **YK.4** · *(4)* Allied Masters' ZON does not apply to their Servants within the Area — Pressed live 2026-10-29: same Attack: Karl far from his Master (25,24), no ZON penalty in the breakdown; suppression zonPenalty from the Area
- [x] **YK.5** · *(5)* Allied Free Servants' Sustainability does not decrease within the Area — Pressed live 2026-10-29: Karl staged Free, clock at 6: across the tick 9 and Round boundaries inside the Area it stayed 6; stepped outside for one Turn end (tick 10) it fell to 5
- [x] **YK.6** · *(6)* Every effect of a Servant that reduces its Master's Health when used or when it takes effect is halved (Q) — Pressed live 2026-10-29: same use: card 'its Master loses 5 Health, the cost ×0.5 (Amaterasu Area)', Master 231 → 226
- [x] **YK.6.np** · …NP use included — Pressed live 2026-10-29: same: the NP's Rank E cost of 10 halved to 5
- [x] **YK.7.max** · *(7)* Her Mantra Token maximum becomes 6 — Pressed live 2026-10-29: card 'MAX 3 → 6'
- [x] **YK.7.fill** · …then she gains Mantra Tokens up to the maximum — Pressed live 2026-10-29: card 'Mantra 0 → 6'
- [x] **YK.7.end** · …and when the NP ends (Q) — Pressed live 2026-10-29: Yata's end (tick 5 → 6): Mantra 5/6 → 3/3
- [x] **YK.8** · *(8)* Her Divinity is activated — Pressed live 2026-10-29: projection: Divine Attribute and 'divinity 50' while the Area stands
- [x] **YK.9** · *(9)* If she is defeated, the NP is forcefully ended at the end of the Turn — Pressed (engine) live 2026-10-29 (cloud, War A): Yata reopened by Player1 at tick 14 (its Cooldown staged 14 → 0), expiry 20; Tamamo (Health staged 500 → 1) defeated by Asterios at tick 17: the Area still open; at that Turn's end (17 → 18) card 'Amaterasu Area ends. Its owner was defeated.', Mantra 3/3, Cooldown 12
- [x] **YK.dur** · Lasts 2◈ — Pressed live 2026-10-29: field expiry 11 = tick 5 + 6 (2◈)
- [x] **YK.dur.japan** · …3◈ if the Region is Japan — Pressed live 2026-10-29: same: field duration 3◈, expiry 17 = tick 8 + 9
- [x] **YK.cd** · Cooldown 4◈ after it ends — Pressed live 2026-10-29: Yata's cooldown 15 after it ended = 4◈ + Dainisshō's 1◈

## Yata no Kagami: Hakkon Jourai・Dainisshō *(Damage Spell, categorized as NP)*

- [x] **DN.req** · Only usable while Yata no Kagami is Active — Pressed live 2026-10-29: used while the Area stood (requirement fieldOpen met)
- [x] **DN.cat** · A Damage Spell categorized as Noble Phantasm — Pressed live 2026-10-29: Player1's Dainisshō (tick 5): an Attack, categorizedAsNP; no Master cost (her Master 226 before and after)
- [x] **DN.area** · Hits a 7×7 panel area in any non-diagonal direction next to her (Q) — Pressed live 2026-10-29: placed east: a 7×7 against her side, rows 11-17, cols 15-21; Asterios, Cú, Arjuna inside, Karl (ally) inside and never struck (843 unchanged)
- [x] **DN.area.japan** · …9×9 if the Region is Japan — Pressed live 2026-10-29 (cloud, War B in Japan): Player1's Dainisshō (tick 4): the aim 81 panels east, south and west, 72 north where the board's edge clips it; south caught Arjuna at (17,14), 9 rows down and 4 across, outside any 7×7, and left out his Master at (18,10); hit 9 dealt Arjuna 690
- [x] **DN.order** · Its effects run in order, 1 to 9 — Pressed live 2026-10-29: eleven Processes in the sheet's order: nature, ice, wind, lightning, water, earth, light, dark, then fire on each
- [ ] **DN.random** · Hits 1 to 8 each strike a random enemy Unit within the area (Q) — Pressed live 2026-10-29: each pick a d3 over the three enemies: 3/3 Cú, 3/3 Cú, 2/3 Arjuna, 2/3 Arjuna, 3/3 Cú, 3/3 Cú, 1/3 Asterios, 3/3 Cú (die added to the card live). **Reopened 2026-10-29 (cloud, War B):** the draws are made at the declaration, not as each hit strikes: Asterios's Master, defeated by the fourth hit, was drawn by two later hits and struck by hit 9 (two defeat lines) · *Defect*
- [x] **DN.1** · *(1)* 50% damage, Nature — Pressed live 2026-10-29: Cú, nature, ×0.5, 208
- [x] **DN.1.poison** · …25% chance of Poison — Pressed live 2026-10-29: card 'Poison rolled 87 vs 10%' (25 less MR 15)
- [x] **DN.2** · *(2)* 50% damage, Ice — Pressed live 2026-10-29: Cú, ice, ×0.5, 287
- [x] **DN.2.disable** · …25% chance of Disable for 1◈ — Pressed live 2026-10-29: card 'Disable rolled 85 vs 10%'
- [x] **DN.3** · *(3)* 50% damage, Wind — Pressed live 2026-10-29: Arjuna, wind, ×0.5, 325
- [x] **DN.3.sap** · …25% chance of Sap for 1◈ — Pressed live 2026-10-29: card 'Sap rolled 87 vs 10%'
- [x] **DN.4** · *(4)* 50% damage, Lightning — Pressed live 2026-10-29: Arjuna, lightning, ×0.5, 313
- [x] **DN.4.shock** · …25% chance of Shock for 1◈ — Pressed live 2026-10-29: card 'Shock rolled 46 vs 10%'
- [x] **DN.5** · *(5)* 50% damage, Water — Pressed live 2026-10-29: Cú, water, ×0.5, 268
- [x] **DN.5.slow** · …25% chance of Slow for 1◈ — Pressed live 2026-10-29: card 'Slow rolled 49 vs 10%'
- [x] **DN.6** · *(6)* 50% damage, Earth — Pressed live 2026-10-29: Cú, earth, ×0.5, 220
- [x] **DN.6.immobilize** · …25% chance of Immobilize for 1◈ — Pressed live 2026-10-29: card 'Immobilize rolled 69 vs 10%'
- [x] **DN.7** · *(7)* 50% damage, Light — Pressed live 2026-10-29: Asterios, light, ×0.5, 260
- [x] **DN.7.blind** · …25% chance of Blind for 1◈ — Pressed live 2026-10-29: card 'Blind rolled 54 vs 25%'
- [x] **DN.8** · *(8)* 50% damage, Dark — Pressed live 2026-10-29: Cú, dark, ×0.5, 278
- [x] **DN.8.curse** · …25% chance of Curse — Pressed live 2026-10-29: card 'Curse (Stage 3) rolled 9 vs 10%', landed
- [x] **DN.9** · *(9)* Then 2x damage to every enemy Unit within the area, Fire — Pressed live 2026-10-29: fire ×2 on all three: 791, 844, 783
- [x] **DN.9.burn** · …and inflicts Burn for 2◈ — Pressed live 2026-10-29: Burn on all three (Cú's 85% past his MR)
- [x] **DN.end** · When used, Yata no Kagami is forcibly ended at the end of the Turn — Pressed live 2026-10-29: Yata closed at the end of tick 5, the Turn Dainisshō was used: card 'Amaterasu Area ends.'
- [x] **DN.cd** · …and its Cooldown is increased by an additional 1◈ — Pressed live 2026-10-29: Yata's cooldown 15, not 12, after Dainisshō
- [x] **DN.uses** · No Cooldown is printed for Dainisshō (Q) — Pressed live 2026-10-29: Dainisshō cooldown remaining 0 after use, no max printed
