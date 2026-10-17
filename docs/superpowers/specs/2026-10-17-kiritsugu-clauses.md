# Kiritsugu — the Clause list

**Draft, 2026-10-17.** The audit issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Kiritsugu.md`. The generated draft was not used.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**Built 2026-09-12** (design `docs/superpowers/specs/2026-09-12-kiritsugu-design.md`, rulings R1 to
R9). Audited and pressed 2026-10-17 on the PC world (scenes *Kiritsugu Audit*, *Kiritsugu Audit II*), Ch. 46 §46.38. **99 Clauses** across 11 sheet entries and the statblock, all `Pressed` or `Observed` (74 by interface, 5 in the engine, 20 observed with a differential).

**Built to be reused.** His two class skills are the shared refs: Presence Concealment A+ is Jack's,
Serenity's and Hundred-Faced Hassan's block, Independent Action A is Serenity's. Reinforcement is
EMIYA's Spell at 40%; Familiars is EMIYA's Hawkeye shape; Scapegoat's S.Crit Up is the #132 aura;
Chronos Rose's cooldown push is Shapeshift's `scope: np` on a target. His own pieces became generic:
`CategoryUseLimit`, `AttackProperty` (Pierce, Ignore Def, `invulnFactor`), a check-carrying `Aura`,
`BaseAttackModifier`, `StripBuff` with `requiresRemoval`, and the `whenAllyAttacked` shot measured to
the attacker (`radiusTo: attacker`, `requiresDefenderEffect`).

### Already ruled

**His design (2026-09-12):** the Suppression shot is entirely free: no Attack spent, no per-Turn cap
(R1, ruled by the user) · under Skill Seal his Skills stay sealed and he takes +20 on his own Luck
Checks (R2, ruled by the user; see reading 2 for its Max Luck half) · the +4 aura hinders every Unit
near him, allies included; a higher roll is a worse check (R3) · the mark halves both Base Attacks,
of their value before the mark (R4, ruled by the user) · *"5 times"* is five uses, spent by a
successful strip only (R5) · the strip lands before the damage is computed (R6) · his Normal Attacks
use BA(STR), as every silent sheet's do (R7, Semiramis) · his class is Assassin (R8).

**Elsewhere:** Base Attack derives from the tables (§46.6): BA(STR) 75 at STR D, not the printed 65,
as for Serenity (#199 reading 1) · Presence Concealment A+ as pressed on Jack (#185), Serenity (#199)
and Hundred-Faced Hassan (#226): Evade +4, discovery 5%, cooldown 2◈ from deactivation ·
Independent Action as pressed on Serenity (#199): its ZON +3 replaces the Assassin's class +2, an
enemy Master or Caster needs 4 rolls (§46.4-KL) · *"NP Cooldown"* naming no NP reaches every NP, and a
ready NP goes onto the cooldown (#197 reading 6, #199 reading 4) · riders land on a hit, not a hurt
(§46.4-LI) · *"successful"* is not Evaded, a Block or a 0 counts (#204 reading 12, #239 reading 2) ·
*"Inflicts"* with no chance is the effect's base 100%, resisted as usual (Ch. 15) · an area naming
*"all Units"* reaches both sides · *"all allied Units"* includes the user unless the sheet says
*"other"* · Crit Up and Crit DmUp reach an NP only when an NP figure is stated (#131) · S.Crit Up is
an aura its casters hold (#132) · Decoy applied by its own side meets Debuff Resist and Immune (#132) ·
two different Atk Ups stack (#230 reading 4) · a Spell is refused by Silence and Skill Seal (Ch. 17) ·
an NP used on its owner's own Turn consumes his Attack (§46.4-AZ) · a sheet binds only its owner.

### Readings to settle

Asked by grilling, 2026-10-17. All 19 ruled the same day, in two rounds.

1. **Reinforcement's moment and length** (`RE.when`, `RE.dmg`). EMIYA's sheet says the same two
   sentences, ruled (#208 readings 8, 9): the start of any Combat Phase he is in, attacking or
   attacked, lasting that Combat Phase only. *Differs:* his is offered on his own Turn and at his own
   Combat Phase's start, and lasts ⅓◈. **Ruled:** EMIYA's, carried: the start of any Combat Phase he is in, attacking or attacked, lasting that Combat Phase only.
2. **Skill Seal and his Max Luck** (`AH.seal.luck`). R2 says his LUC falls to E *"and Max Luck drops
   with it"*; the sheet says *"instead of reducing his Max Luck"*. Built: the rank falls to E, Max
   Luck is stored and never moves. **Ruled:** his Max Luck stays; only his rank reads E. R2's *"Max Luck drops with it"* is overruled.
3. **"The original effect is negated"** (`AH.seal.neg`). (a) the passive's own effect, the EX and the
   aura (R2, built); or (b) Skill Seal's effect, so he keeps his Skills and pays the +20 instead. **Ruled:** (a), the passive's own effect: the EX and the aura stop (R2).
4. **Scapegoat on himself** (`SG.who`). Van Gogh's and Scáthach's *"an allied Unit within a 2 panel
   area of herself"* includes the user (#239 reading 4). *Differs:* built `relations: [ally]`, which
   leaves `self` out. **Ruled:** he may choose himself.
5. **Scapegoat in the ally window** (`SG.ally`, `SG.who`). Used *"when an allied Unit within 2 is
   Attacked"*: may the Decoy go on any ally within 2, or only on the one being Attacked? **Ruled:** (a), any ally within 2, himself included; the sheet's target is its own phrase. *Differs:* the rung aims it at the Unit in peril only.
6. **That same Attack and the shot** (`LG.trigger`). Scapegoat answers an Attack on an ally with the
   Decoy. Does that Attack, already under way, now count as the decoy *"is Attacked"*, so the shot is
   offered at once? **Ruled:** (a), yes: the ally is still being Attacked, so the shot is offered on that same Attack. *Differs:* the rung's offers are fixed at the declaration.
7. **When the shot lands** (`LG.shot`). *"Instantly"*: before the AU's Attack resolves (at the
   ally-attacked rung, as built) or after it. If the shot defeats the AU, does its Attack still land? **Ruled:** (a), before the AU's Attack resolves; an AU the shot defeats loses its Attack.
8. **Which Attacks trigger the shot** (`LG.trigger`). Any Attack on the decoy, an AoE that catches it
   and Skill or NP attacks included, one shot per Attack. **Ruled:** any Attack on the decoy, an AoE and Skill or NP attacks included; one shot per Attack, not per Process.
9. **The free Spell's window** (`LG.spell`). Penetration and Familiars say *"Used during your
   Turn"*. Inside the trigger, on an enemy's Turn, may he use any of his three Spells? **Ruled:** (a), the trigger overrides each Spell's own moment: any of the three, off cooldown. *Differs:* all three are listed and then refused (`notOwnTurn`, `windowOnly`).
10. **Which buff Suppression takes** (`SU.strip`). The sheet says *"remove 1 buff"*. Built: the newest
    removable buff. Or Kiritsugu's player picks, or a random one. **Ruled:** the newest removable buff, as built.
11. **Penetration against an NP's Invuln** (`PE.invuln`). Invuln against an NP is already a 50% cut.
    *"Halves the effect"*: 25% then? Built: Penetration halves Invuln against non-NP damage only. **Ruled:** against an NP, Invuln's 50% cut becomes 25%.
12. **Penetration on his NPs and the shot** (`PE.idef`). *"When Kiritsugu deals damage with an
    Attack"*: Normal Attacks, the shot and both NPs. Built: every attack he makes. **Ruled:** every Attack: Normal Attacks, the shot and both NPs.
13. **Chronos Rose's Ignore Def** (`CR.idef`). *"3.5x damage plus 100 that has the Ignore Def
    effect"*: the whole NP (built) or only the 100. **Ruled:** (a), the whole NP ignores Def Up, as built.
14. **Familiars' Range Up and his NPs** (`FA.range`). +2 Range moves his statblock Range: Normal
    Attacks and the shot's reach. Does it move Chronos Rose's *"Range=3"* and Mystery Bisection's
    *"Range=1"*? Built: no. **Ruled:** no; an NP's own *"Range=N"* is its own.
15. **Mystery Bisection's Instakill** (`MB.ik.gate`). *"If damage was dealt"* is stated, against the
    hit-not-hurt rule. *Differs:* built on any hit, a hit for 0 included. **Ruled:** only when damage was dealt; his sheet states it.
16. **Mystery Bisection's mark** (`MB.mark`). *"Then, apply"*: on any hit, or only when damage was
    dealt like the Instakill? Built: on any hit. **Ruled:** (a), on any hit, as built.
17. **What the mark ignores** (`MB.mark.res`). *"Debuff Resist"*: every resistance (Magic Resistance,
    Item Construction, Existence Outside the Domain) or only effects named Debuff Res Up? Built: every
    resistance; it always lands. Its length is permanent, stated by nothing. **Ruled:** every resistance, and permanent, as built.
18. **Magecraft's one Spell per Turn** (`MC.once`). *"Per Turn"*: every Turn, an enemy's included,
    once Reinforcement can be used when attacked. Built: the current Turn, whoever's. **Ruled:** yes, every Turn, his own or not; the free Spell stays exempt. As built.
19. **Scapegoat at the rung and the ally's own reaction** (`SG.ally`). A non-free reaction ability takes the rung as
    *"Do nothing"*. **Ruled:** (a), free, as Medea's Argos (#193 reading 8): the Decoy lands and the attacked ally
    still chooses Block, Evade or nothing. *Differs:* built not free.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"Has the following effects-"* (Presence Concealment, Affection, Lethal Gunfire Suppression) — headings.
- *"(8◈ Turns if Summoned)"* — the value of `IA.sus`.
- *"Note: Does not include Attack Skills and Spells that deal damage"* — `PC.7.x`.
- *"Time Alter"* (Chronos Rose) — a descriptor no rule, sheet or effect in the repository reads.
- *"(Note: This does not count towards …)"* — `LG.spell.cap` and `LG.spell.cd`.
- `Items held:` — an empty slot.

## Statblock

- [x] **SB** · True Name Emiya Kiritsugu; Region Japan, Far East; Chaotic Evil; STR D, END C, AGI A+, MAG B, LUC EX (E); Base Health 1000; MOV 7; Range 3 panels / 1 target; BA(STR) 75 and BA(MAG) 175 by the tables (printed 65 / 175); Sustainability 8◈ · *Observed* — built actor + board: trueName "Emiya Kiritsugu", assassin, Chaotic Evil, params D/C/A+/B/EX (written luc E), baseHealth 1000, health 1000/1000, MOV 7, Range 3/1, BA {str 75, mag 175} (written 65/175), sustainability "8◈" (24 ticks). Region read [japan] only: Far East dropped -> fixed [japan, farEast] ; rebuilt pack: region ["japan","farEast"]
- [x] **SB.attr** · Attributes Male, Servant, [Man], Humanoid, Anti-Hero · *Observed* — attributes male, servant, man, humanoid, antiHero (+ derived hominidae, spirit)
- [x] **SB.na** · His Normal Attacks use his Base Attack (STR) (R7) · *Pressed (interface)* — that card stage 1 "Base BA(STR) self BA(STR) × 1 +75"

## Presence Concealment — Class Skill, Rank A+ *(Active)*

- [x] **PC.when** · Used during his Turn · *Pressed (interface)* — Round 4 tick 11 (his Turn), Player1 pressed Presence Concealment: card "Presence Concealment A+ — Presence Concealment"
- [x] **PC.dur** · Its effects last 2◈ · *Pressed (interface)* — presenceConcealment expiry 17 = 2◈ from tick 11
- [x] **PC.1** · He cannot be targeted for an Attack or an enemy Unit's Skill · *Pressed (engine)* — concealed, Heracles' Normal Attack resolved on him: "No legal targets: Assassin is concealed — it cannot be targeted directly."
- [x] **PC.1.aoe** · Caught in an AoE Attack and failing to Evade, a coin is flipped · *Pressed (engine)* — concealed, caught alone by Medea's Rain of Light 3x3, Did nothing: "Presence Concealment: Heads — nothing is received −685 → 0"; Health 1000, PC kept (twice more Heads)
- [x] **PC.1.heads** · …Heads: no damage and no effects · *Pressed (engine)* — concealed, caught alone by Medea's Rain of Light 3x3, Did nothing: "Presence Concealment: Heads — nothing is received −685 → 0"; Health 1000, PC kept (twice more Heads)
- [x] **PC.1.tails** · …Tails: Total Damage −50% and PC is deactivated · *Pressed (engine)* — fourth cast: "Presence Concealment: Tails — Total Damage halved −346", Health 1000 → 653, presenceConcealment removed, cooldown 6
- [x] **PC.2** · His Attacks cannot be Blocked or Countered unless the DU's current AGI Rank is equal or higher · *Pressed (interface)* — concealed Normal Attack on Heracles (AGI A < A+): forbiddenReactions [block, counter]; engine reactionsRefused(K, Heracles) and (K, Arturia B) [block, counter]
- [x] **PC.2.evade** · If the DU Evades, its Evade Roll +4 · *Pressed (interface)* — Heracles Evaded: "evade- 1d20 → 11 … Presence Concealment A+ +4 … total 20"
- [x] **PC.3.masters** · He may Attack Masters · *Pressed (interface)* — unconcealed: "Master of Berserker of Faction 2 cannot be targeted: … guarded by a Servant within your Range"; concealed: preview "Master of Berserker of Faction 2 28 – 80, Legal" (the attack then changed to Heracles beside him, the guard rule); moved clear, concealed attack on the Master landed
- [x] **PC.3.move** · …and Move to any panel regardless of enemy Master-Servant positions · *Pressed (interface)* — concealed, Player1 dragged him to (14,13) between Karna and its Master: landed; canStopOn (14,13) false without PC, true with
- [x] **PC.4** · All damage dealt +100% · *Pressed (interface)* — that hit: stage 4 "Atk Up presenceConcealment +100%", 244
- [x] **PC.4.np** · …if NP, 50% · *Pressed (interface)* — concealed Chronos Rose on Heracles: stage 4 "Atk Up presenceConcealment +50%", 653
- [x] **PC.4.master** · …not against Masters · *Pressed (interface)* — that card: 46, stage 4 "Atk Up atkUp +15%" only, no Presence Concealment row
- [x] **PC.5** · After an Attack while PC is Active, PC is deactivated at the end of the Combat Process · *Pressed (interface)* — presenceConcealment gone at that Combat Process's end
- [x] **PC.6** · Moving into an enemy Servant's Range (or Detect), a 5% chance of being discovered · *Pressed (interface)* — concealed, Player1 dragged him (10,8) → (11,10) into Heracles' Range: Heracles' Discover spent (discoverBudget spent faction-2 [Heracles]), the 5% roll failed and stayed silent (GM-only by rule); concealment kept
- [x] **PC.7** · Active Skills targeting or affecting enemy Units cannot be used unless stated · *Pressed (interface)* — concealed, Affection of the Holy Grail resolved (DEFECT: clause 7 read only the ability's own targeting); fixed (phaseTargeting): bar "Affection of the Holy Grail — Presence Concealment forbids this while concealed"
- [x] **PC.7.x** · …Attack Skills and Spells that deal damage are not included · *Pressed (interface)* — concealed, Chronos Rose usable from the bar and pressed (653 on Heracles)
- [x] **PC.8.nb** · PC's effects are neither buff nor debuff · *Observed* — the presenceConcealment definition polarity "status": neither buff nor debuff
- [x] **PC.8.unrem** · …and are Unremovable · *Observed* — the instance unremovable true
- [x] **PC.cd** · Cooldown 2◈ after PC is deactivated · *Pressed (interface)* — Presence Concealment cooldown 6 = 2◈ from deactivation (tick 11)

## Independent Action — Class Skill, Rank A *(Passive 1 + 2 + 3)*

- [x] **IA.sus** · *(Passive 1)* High Sustainability, 8◈ · *Observed* — board sustainability 24 = 8◈, sustainabilityMax "8◈"
- [x] **IA.zon** · *(Passive 2)* His Master's ZON +3 panels · *Observed* — Kiritsugu's zon 5, zonBonuses [+3 Independent Action]
- [x] **IA.contract** · *(Passive 3)* An enemy Master or Caster needs 4 successful *Contract Servant* rolls to contract him · *Pressed (engine)* — rules/contract rollsRequired(Kiritsugu, byEnemy) 4

## Magecraft — Rank B *(Passive 1 + 2)*

- [x] **MC.thaum** · *(Passive 1)* Allows the use of Thaumaturgy · *Observed* — his three Thaumaturgy Spells usable as Spells (Familiars, Penetration pressed; Reinforcement cast at windows)
- [x] **MC.once** · …only one Thaumaturgy Spell can be used per Turn · *Pressed (interface)* — after Familiars, Player1 pressed Penetration: "Thaumaturgy: Penetration — Already used a Spell of this kind this Turn" ; then his Normal Attack on Achilles: no "Start of the Combat Phase" offer (Reinforcement capped by Familiars)
- [x] **MC.ext** · *(Passive 2)* Whenever a Thaumaturgy Spell is used, the 'Suppression' buff's duration is extended by 1◈ · *Pressed (interface)* — Familiars after LGS: Suppression expiry stayed 4 -- `DurationExtension` is no handler action ("unhandledAction"); fixed to ExtendEffect, needs the rebuilt pack ; LGS then Familiars: suppression expiry 5 → 8; then (enemy Turn) free Penetration: 8 → 11, card "suppression: 4 → 7 Turns left" (name fixed to the effect's) ; Round 2 tick 5, Player1 pressed Familiars: card "Range Up, Crit Up (Familiar), Suppression: 6 → 9…

## Thaumaturgy: Reinforcement *(Spell)*

- [x] **RE.spell** · A Spell: Silence and Skill Seal refuse it · *Observed* — Silence staged: Penetration and Familiars "Prevented" (now "Prevented by Silence", fixed); Reinforcement is window-only
- [x] **RE.when** · Used at the start of a Combat Phase · *Pressed (interface)* — the bar's Reinforcement: "Only at its own moment: it is offered when that comes." (no sheet press) ; Reinforcement offered and cast at the start of the shot's Combat Phase, on Faction 2's Turn
- [x] **RE.dmg** · During this Combat Phase, Normal Attack damage dealt +40% (Normal Attacks only) · *Pressed (interface)* — the shot's stage 4 "Atk Up nAtkUp +40%"; nAtkUp gone once that Combat Phase ended
- [x] **RE.cd** · Cooldown 2◈ · *Observed* — Reinforcement cooldown set after the cast (2◈)

## Thaumaturgy: Penetration *(Spell)*

- [x] **PE.spell** · A Spell: Silence and Skill Seal refuse it · *Observed* — Silence staged: Penetration and Familiars "Prevented" (now "Prevented by Silence", fixed); Reinforcement is window-only
- [x] **PE.when** · Used during his Turn · *Pressed (interface)* — Round 4 tick 11 (his Turn), Player1 pressed Penetration: card "Penetration, Suppression: 9 → 12 Turns left"
- [x] **PE.dur** · Applies the 'Penetration' buff to himself for ⅓◈ · *Pressed (interface)* — penetration expiry 12 (⅓◈ from tick 11)
- [x] **PE.idef** · …when he deals damage with an Attack, it has the Ignore Def effect · *Pressed (interface)* — the shot's stage 4: "Def Up Kavacha and Kundala ... (ignored by Ignore Def) 0%" ; same card: "Def Up Kavacha ... (ignored by Ignore Def) 0%"
- [x] **PE.invuln** · …and halves the effect of Invuln · *Pressed (interface)* — Suppression removed, Invuln staged again, Normal Attack on Karna: preview "Lancer 24 – 50"; card stage 16 "Invuln (halved) −38.17 × 0.50", 38
- [x] **PE.cd** · Cooldown 3◈ · *Pressed (interface)* — Penetration cooldown 9 = 3◈

## Thaumaturgy: Familiars *(Spell)*

- [x] **FA.spell** · A Spell: Silence and Skill Seal refuse it · *Observed* — Silence staged: Penetration and Familiars "Prevented" (now "Prevented by Silence", fixed); Reinforcement is window-only
- [x] **FA.when** · Used during his Turn · *Pressed (interface)* — Player1 pressed Familiars on his Turn, card "Range Up, Crit Up (Familiar)"
- [x] **FA.range** · Range Up for 1◈: Range +2 panels · *Pressed (interface)* — rangeUp 2 expiry 4; board range 3 → 5
- [x] **FA.crit** · Crit Up (Familiar) for 1◈: Crit Chance +30% for Attacks at a Range of 3 or higher · *Pressed (interface)* — that attack at Range 3: stage 2 "Crit Attack+"; engine critChance range 2 = 65 (no Familiar), range 3 = +30 per Crit Up (Familiar); the Range-2 shot read "Crit Attack−"
- [x] **FA.cd** · Cooldown 4◈ · *Pressed (interface)* — cooldown 12 = 4◈

## Affection of the Holy Grail — Rank A+ *(Passive)*

- [x] **AH.luc** · His Luck is raised from Rank E to Rank EX · *Observed* — params.luc EX, written E (the RankShift)
- [x] **AH.aura** · The Luck Check rolls of all Units within a 2-panel area of him are increased by 4 · *Observed* — checkPlan luck: Medea (ally, 2) +4, Achilles (enemy, 2) +4, Arturia (ally, 2) +4 "Affection of the Holy Grail"; Karna (8 away) none
- [x] **AH.aura.self** · …except himself · *Observed* — Kiritsugu's own luck checkPlan: no modifier
- [x] **AH.seal.luck** · Inflicted with Skill Seal, his Max Luck is not reduced · *Observed* — Skill Seal staged on him: LUC EX → E, Luck 24/24 unchanged (reading 2)
- [x] **AH.seal.20** · …instead all of his Luck Check rolls are increased by 20 · *Observed* — his luck checkPlan "+20 Affection of the Holy Grail"; without the seal none
- [x] **AH.seal.neg** · …and the original effect is negated · *Observed* — under the seal Medea's and Achilles' +4 gone, his LUC E (reading 3a); Player1 pressed Affection: "Affection of the Holy Grail — prevented by Skill Seal", every Skill "prevented by Skill Seal"
- [x] **AH.seal.dur** · …these effects last only for the duration of Skill Seal · *Observed* — seal removed: LUC EX, Medea +4 again, his +20 gone

## Affection of the Holy Grail — Rank A+ *(Active)*

- [x] **AH.when** · Used during his Turn · *Pressed (interface)* — Player1 pressed Affection of the Holy Grail, card "5 effect(s) applied"
- [x] **AH.pierce** · Applies Pierce to himself for 1◈ · *Pressed (interface)* — pierce on him, expiry 4 (1◈)
- [x] **AH.cdmg** · Applies Crit DmUp to himself for 1◈: Crit Damage +50% · *Pressed (interface)* — critDmUp 50 on him, expiry 4 ; same card stage 2 "×1.50 crit damage" with Crit DmUp 50
- [x] **AH.resdwn** · All Units within a 2-panel area of him are inflicted with Debuff ResDwn for 1◈: chance of being inflicted with debuffs +20% · *Pressed (interface)* — debuffResDwn 20, expiry 4, on Medea (ally, 2), Arturia (ally, 2), Achilles (enemy, 2); Karna (6 away) none
- [x] **AH.resdwn.self** · …except himself · *Pressed (interface)* — none on Kiritsugu
- [x] **AH.cd** · Cooldown 4◈−⅓◈ · *Pressed (interface)* — cooldown 11 = 4◈−⅓◈

## Scapegoat — Rank C *(Active)*

- [x] **SG.when** · Used during his Turn · *Pressed (interface)* — his Turn, Player1 pressed Scapegoat on the bar and targeted himself: "Assassin … Legal"; decoyScapegoat on him (expiry 14 = 1◈), sCritUp 15 (expiry 12 = ⅓◈) (reading 4)
- [x] **SG.ally** · …or when an allied Unit within a 2-panel area of him is Attacked · *Pressed (interface)* — Round 2 tick 4 (Faction 2): GM declared Karna's Normal Attack on Medea; Medea's card offered "Scapegoat (Assassin)" beside Argos and Trofa; Player1 pressed it (an earlier try on Achilles' attack timed out to "nothing" after misclicks)
- [x] **SG.who** · Used on an allied Unit within a 2-panel area of him · *Pressed (interface)* — prompt "Scapegoat — Choose whom Scapegoat lands on": Caster, Assassin, Saber (Unit in peril first; himself and Arturia within 2); picked Caster
- [x] **SG.decoy** · Applies Decoy (Scapegoat) to that Unit for 1◈ · *Pressed (interface)* — card "on Caster: Caster: Decoy (Scapegoat), S.Crit Up, Caster: S.Crit Up"
- [x] **SG.scrit** · …then S.Crit Up for ⅓◈ to all allied Units within a 2-panel area of him or the target: Crit Chance +15% · *Pressed (interface)* — sCritUp 15 on Kiritsugu and Medea (two holders)
- [x] **SG.cd** · Cooldown 3◈ · *Pressed (interface)* — Scapegoat cooldown 9 = 3◈

## Lethal Gunfire Suppression — Rank B+ *(Passive)*

- [x] **LG.trigger** · Whenever a Unit inflicted with Decoy (Scapegoat) is Attacked · *Pressed (interface)* — the same rung now offered "Lethal Gunfire Suppression: Return Fire (Assassin)" ; Round 3 tick 8, Decoy staged on Medea: Karna's declaration offered "Lethal Gunfire Suppression: Return Fire (Assassin)" at once
- [x] **LG.range** · …if that AU is within his Range · *Pressed (interface)* — Karna at (12,10), 2 from Kiritsugu (Range 5 under Familiars) -- offered ; Decoy on Medea, Master of Lancer 6 from him (his Range 5): Medea's offers Argos and Trofa only, no Return Fire
- [x] **LG.shot** · …he can instantly perform a Normal Attack on that AU · *Pressed (interface)* — card "Assassin ⚔ Lancer, Lethal Gunfire Suppression: Return Fire, 44": BA(STR) 75 ×1, Atk Up 40 (LGS), Kavacha "(ignored by Ignore Def)", ZON −19
- [x] **LG.free** · …which costs him nothing: no Attack spent, no per-Turn cap (R1) · *Observed* — Kiritsugu's turn record after the shot: attacked false
- [x] **LG.react** · …and cannot be Reacted to unless the AU's AGI Rank is higher than his · *Pressed (interface)* — shot Process forbiddenReactions [block, counter, evade] against Karna; no reaction rung ; the shot then asked Karna "Counter-attack?"; fixed (counterAvailable reads the Process's refusals)
- [x] **LG.spell** · He can use a Thaumaturgy Spell once before that Normal Attack · *Pressed (interface)* — Player1 pressed Return Fire: "Use a Thaumaturgy Spell before the shot?" Reinforcement, Penetration (on Faction 2's Turn); picked Penetration: card "Thaumaturgy: Penetration — Penetration" ; free Spell Familiars on Faction 2's Turn: card "Range Up, Crit Up (Familiar), Suppression: 6 → 9 Turns left"
- [x] **LG.spell.cap** · …it does not count towards the one Thaumaturgy Spell per Turn · *Pressed (interface)* — "Start of the Combat Phase" offered Reinforcement; refused "categoryUseLimit"; chat said "Assassin uses Thaumaturgy: Reinforcement." -- fixed (categoryExempt; window gate; honest line), re-press due ; then "Start of the Combat Phase: Kiritsugu may use Thaumaturgy: Reinforcement" (the free Familiars uncounted); picked: card "N.Atk Up, Suppression: 9 → 12 Turns left"; turn record categoryExempt [kiritsugu-familiars]
- [x] **LG.spell.cd** · …but it still enters Cooldown · *Pressed (interface)* — Penetration cooldown set (3◈)

## Lethal Gunfire Suppression — Rank B+ *(Active)*

- [x] **LA.when** · Used during his Turn · *Pressed (interface)* — Round 1 tick 1, Player1 pressed Lethal Gunfire Suppression on the bar; card "Lethal Gunfire Suppression B+"
- [x] **LA.luck** · Restores 4 Luck · *Pressed (interface)* — first press, Luck 19/22: card "Luck 19 (no change)" -- DEFECT, `luck` named the pool; fixed (resourcePathFor + luck.value); re-pressed after reload: card "Luck 19 → 22" (clamped, +4 would be 23) ; Round 1 tick 2, Luck 21/24: card "Luck 21 → 24"
- [x] **LA.atk** · Atk Up for 1◈: all damage dealt +40% · *Pressed (interface)* — atkUp 40 on him, expiry 4 (1◈ from tick 1)
- [x] **LA.atk.np** · …if NP, 30% · *Pressed (interface)* — stage 4 "Atk Up atkUp +30%" (the NP figure of LGS's 40)
- [x] **LA.sup** · Applies the 'Suppression' buff for 1◈, 5 times · *Pressed (interface)* — suppression uses 5, expiry 4 (1◈)
- [x] **LA.cd** · Cooldown 4◈ · *Pressed (interface)* — cooldown 12 = 4◈

## The 'Suppression' buff

- [x] **SU.strip** · Successful Normal Attacks remove 1 buff from the DU at the start of the Damage Step · *Pressed (interface)* — Achilles held defUp 20; chat "Def Up is removed from Achilles"; card stage 4 has no Def Up row (stripped before the damage) ; his Normal Attack on Karna under staged Invuln: Suppression took the Invuln first (uses 4 → 3, Atk Up 15), 143 dealt
- [x] **SU.atk** · …if a buff was removed, Atk Up for 1◈ to him: all damage dealt +15% · *Pressed (interface)* — atkUp 15 on Kiritsugu (expiry 8); card stage 4 "Atk Up atkUp +40% Atk Up atkUp +15%"
- [x] **SU.atk.np** · …if NP, 5% · *Pressed (interface)* — stage 4 "Atk Up atkUp +5%" (the NP figure of Suppression's 15)
- [x] **SU.uses** · Five uses, each spent by a successful strip (R5) · *Pressed (interface)* — suppression uses 5 → 4

## Chronos Rose: Pick Ye Rosebuds While Ye May — Rank B+ *(NP, Anti-Unit)*

- [x] **CR.range** · Range 3, one target · *Pressed (interface)* — Player1 targeted Karna at 2 panels: preview "Lancer 273 – 485, Legal"
- [x] **CR.ba** · Base Attack (STR) is used · *Pressed (interface)* — card stage 1 BA(STR) +75; stage 3 "3.5× damage +3.5, Flat bonus plus 100", 386 dealt
- [x] **CR.dmg** · Deals 3.5x damage plus 100 · *Pressed (interface)* — card stage 1 BA(STR) +75; stage 3 "3.5× damage +3.5, Flat bonus plus 100", 386 dealt
- [x] **CR.idef** · …that has the Ignore Def effect · *Pressed (interface)* — stage 4 "Def Up Kavacha and Kundala ... (ignored by Ignore Def) 0%"
- [x] **CR.critdwn** · Then inflicts Crit Dwn for 1◈: Crit Chance −30% · *Pressed (interface)* — critDwn 30 on Karna, expiry 8 (1◈); card "Crit Dwn"
- [x] **CR.npcd** · …and the DU's NP Cooldown +1◈ · *Pressed (interface)* — card "Brahmastra … Cooldown 0 → 3", Kavacha 0 → 3, Vasavi Shakti 0 → 3, Brahmastra Kundala 0 → 3 (every NP; a ready one goes to 1◈)
- [x] **CR.cd** · Cooldown 6◈+⅓◈ · *Pressed (interface)* — Chronos Rose cooldown 19 = 6◈+⅓◈

## Phantasm Punishment: Mystery Bisection — Rank C+ *(NP, Anti-Unit)*

- [x] **MB.range** · Range 1, one target · *Pressed (interface)* — from 2 panels: "Refused: Lancer is out of Range (1)"; adjacent: legal
- [x] **MB.ba** · Base Attack (STR) is used · *Pressed (interface)* — stage 1 BA(STR) +75; stage 3 "3× damage +3, Flat bonus plus 100", 326
- [x] **MB.dmg** · Deals 3x damage plus 100 · *Pressed (interface)* — stage 1 BA(STR) +75; stage 3 "3× damage +3, Flat bonus plus 100", 326
- [x] **MB.ik** · …with a 35% chance of inflicting Instakill · *Pressed (interface)* — "Instakill (rolled 16 vs 60%)" (35 + Item Construction's 25 from Medea at 1) -- Karna defeated
- [x] **MB.ik.gate** · …only if damage was dealt · *Pressed (interface)* — Heracles under dmgCut 2000: card 0 dealt, no Instakill line
- [x] **MB.mark** · Then the 'Kiritsugu' debuff: the DU's Base Attack, STR and MAG, reduced by half of their original value · *Pressed (interface)* — kiritsuguMark on Karna: BA 125/175 → 62/87
- [x] **MB.mark.res** · …ignores Debuff Resist · *Pressed (interface)* — Karna held debuffImmune and debuffResUp 50: the mark landed, card "Kiritsugu"
- [x] **MB.mark.imm** · …ignores Debuff Immune · *Pressed (interface)* — Karna held debuffImmune and debuffResUp 50: the mark landed, card "Kiritsugu"
- [x] **MB.mark.unrem** · …is Unremovable · *Observed* — the instance unremovable true, no expiry; removalPlan on it removes nothing
- [x] **MB.mark.stack** · …does not stack · *Pressed (interface)* — second Mystery Bisection on Heracles (381 dealt): BA stays 80/87, one kiritsuguMark
- [x] **MB.cd** · Cooldown 5◈+⅓◈ · *Pressed (interface)* — cooldown 16 = 5◈+⅓◈
