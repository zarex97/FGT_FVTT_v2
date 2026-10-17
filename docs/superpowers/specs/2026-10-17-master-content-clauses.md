# Master content — the Clause list

**Ruled and built 2026-10-17, pressed the same day** (§46.37, findings §46.4-PA to PQ). The audit issue's body, before it is opened. Built by hand, line by line, from the
sources in this repository. No generated draft was used.

| Source | What it rules |
|---|---|
| `docs/Master Essences.md` | The Essence draft, Ranks A to D, the forty Essences, High and Low Rank Masters |
| `char_orig_sheets/extra docs/Character Sheet - Blue Faction (Normal).md` | The seven Normal Master statblocks and their Magic Crest |
| `char_orig_sheets/extra docs/Normal Great Holy Grail War.md` | §Before Starting 2 (the Master rolls, the optional rank coin), §Contracts & Sustainability |
| Ch. 32, Ch. 33, Appendix B (§B.2, §B.4, §B.5) | The Advanced Contract and Sustainability rules as this repo records them |

Masters were out of #112's scope. This is their audit: the Master Essences, the Magic Crest, and the
Contract and Sustainability rules a Master's life governs. One Clause per rule that can fail on its own.
Each Clause carries the state the code is in today, read from the path, not from a doc line:
*built*, *differs* (built, but not as the source says) or *unbuilt*.

### Already ruled

Ch. 32 and Ch. 33 hold the Contract and Command Spell rulings (#27, #190, #193 readings 18 and 21, #198
IA.contract, #226 reading 17, §46.4-LH) · *"an NP"* counts what is only categorized as one (#208 reading
11) · *"NP Cooldown"* naming no NP reaches every NP (#197 reading 6) · a Rankless Master pays the left
column (Ch. 17) · an Essence-driven rank is Advanced only: a Normal table has the coin or no ranks
(`setup-rolls-normal.mjs`) · a sheet binds only its owner: Independent Action, Mad Enhancement and every
other Servant's own Contract clause stay in that Servant's audit.

### Readings to settle

Asked by grilling, ruled 2026-10-17.

1. **How many, and the limits** (`ME.sel`, `ME.A` to `ME.D`). **Ruled:** one Essence per container, per
   Faction. A Great Holy Grail War Faction holds one pair per container, so it drafts one per container
   under 1 A, 2 B, 2 C, 2 D, counted over that Faction's containers; a Holy Grail War player holds one
   pair. A custom war may set its own limits.
2. **Who picks** (`ME.sel`). **Ruled:** the GM, in the setup wizard, per container, before the draw. The
   Master's player sees it on the Master's sheet.
3. **Lost when its Master is defeated** (`ME.lost`). **Ruled:** the Essence is lost; the High Rank's +1◈
   Sustainability is not, since it only ever matters after that defeat.
4. **High Rank Sustainability** (`HR.sus`). **Ruled:** +1◈, added to the clock the Servant starts at its
   Master's death. It was +1 Turn, and only while the Master lived, so the Free clock never saw it.
5. **Whose Essence after a new Contract** (`ME.bind`). **Ruled:** it follows the Contract: an Essence
   enhances the Servants contracted to its Master now.
6. **Max Health, Agility, Luck** (stat Essences). **Ruled:** the Essence raises the maximum only. A summon
   starts the Servant full. When it is lost the maximum drops and the current value is cut to it, never
   lower; when one is gained mid-war only the maximum rises.
7. **The damage-taken and debuff Essences** (`E.steelTraining`, `E.primevalMagic`, kin). **Ruled:**
   passives, like a Class Skill's, never removed, stolen or shown as a buff; the debuff one shares Magic
   Resistance's channel.
8. **"Normal Attacks/Skills/Spells"** (`E.antumbra`, kin). **Ruled:** every Normal Attack, Attack Skill and
   Damage Spell; never an NP, nor what is categorized as one.
9. **Grimoire's figure** (`E.grimoire`). **Ruled:** +10%, as the line says.
10. **An early gate** (`E.kaleidoscope`, kin). **Ruled:** it may reach Round 0: the NP is open from the
    war's first Round, and Round 1's no-Attack rule still bars an NP that Attacks.
11. **The one-use NP damage Essences** (`E.heavensFeel`, kin). **Ruled:** offered in Noble Phantasm Max's
    window; +X% Total Damage, added to Noble Phantasm Max's, not multiplied. **Ruled again live (2026-10-17):**
    one spend boosts every target of the declaration, Noble Phantasm Max and Damage Up as well. The window is a
    card of its own after targeting and before any Combat Process (§46.4-PO).
12. **The one-use Cooldown Essences** (`E.divineBanquet`, kin). **Ruled:** the Master's bar, while an NP is
    cooling, cutting every NP's clock; refused before the NP gate opens.
13. **The Advanced Master's Magic Crest** (`MC.who`). **Ruled:** every Master carries the Normal sheet's
    Crest.
14. **The Magic Crest is a "Damage Spell"** (`MC.spell`). **Ruled:** a Spell.
15. **The Normal multi-Servant tax** (`NC.tax`, `NC.ban`). **Ruled:** by ruleset.
16. **Kill Humans' Contract half** (`CT.kh`). **Ruled:** the Servant becomes Free at once on becoming
    Unbound, its clock starting; a Contract with its old Master is refused for good.
17. **The High Rank Parameter in war setup** (`HR.param`). **Ruled:** the container's row offers the `+`
    once its Essence makes the Master High Rank.
18. **A multi-Servant tax that empties a Master** (`CT.tax`, `NC.tax`). **Ruled live (2026-10-17):** it defeats
    the Master, as any loss that empties a Health bar does; nobody's kill, so no Conquest; its Servants go Free
    (§46.4-PP).
19. **A Free clock after a new Contract** (`SU.clock`). **Ruled live (2026-10-17):** a new Contract restarts it,
    once per Master's death: the sheet's Sustainability again, Hanging Gardens' +2◈ kept while they stand
    (§46.4-PQ).
20. **`commandSpellTimeout: 0`.** **Ruled (2026-10-17):** it turns the waits off, the declaration window too; the
    hint says so, and `fgt2026` runs at the default 45.

### Not Clauses

- *"The Master Essences impart different enhancements on their respective Servants"* — the introduction.
- The parentheses *"(Round 2 onwards)"* and *"(Base Crit Chance=70%)"* — worked sums, except Grimoire's.
- *"For example, instead of one Rank A Master and two Rank B Masters…"* — the example of `ME.sub`.
- `Health: XXX/XXX` and kin on the Normal sheets — play-time tracking fields. `Items Held:` — an empty slot.
- The Relationships section (ZON, guarding, Cover) — pressed in earlier audits (#181, #204).

## The Essence draft

- [x] **ME.opt** · Essences, a coin per Master, or Rankless (`masterMode`) · *Pressed* · masterMode essences: the wizard offers an Essence per container; coinFlip and Normal: none
- [x] **ME.sel** · Before starting, Masters are given Master Essences (reading 1) · *Pressed* · wizard, every container row, before Roll all
- [x] **ME.A** · …at most 1 Rank A · *Pressed* · F1 with A + three B refused on Confirm
- [x] **ME.B** · …at most 2 Rank B · *Pressed* · "Faction 1 has more Master Essences of Rank B or higher than its limits allow."
- [x] **ME.C** · …at most 2 Rank C · *Pressed* · wizard Confirm: a third C in one Faction refused, limits counted cumulatively
- [x] **ME.D** · …at most 2 Rank D · *Pressed* · wizard Confirm: a third D refused; two accepted
- [x] **ME.sub** · A higher-Rank slot may take a lower-Rank Master · *Pressed* · F2 three B + 2 C + 2 D accepted
- [x] **ME.order** · Masters are assigned to their Servants before any Servant is chosen or drawn · *Pressed* · Essence chosen on the Containers tab, before the Servants tab
- [x] **ME.tier** · Ranks A and B are High Rank Masters, C and D Low · *Pressed* · committed Masters: A, B High; C, D Low
- [x] **ME.lost** · (reading 3) · *Pressed* · Master of Lancer F1 defeated: Gandr copy gone, Agility 22/22 → 19/19
- [x] **ME.bind** · An Essence enhances its Master's Servant (reading 5) · *Pressed* · Scáthach contracted to the Master of Rider: Pendant copy, "Lancer gains its Master's Essence: Pendant."
- [x] **ME.none** · Without Essences, all Masters are Rankless with the Low Rank BA(MAG) · *Pressed* · coinFlip: no Essence select; Normal war committed by the coin

## High and Low Rank Masters

- [x] **HR.mag** · High Rank: BA(MAG) 125 · *Pressed* · Essence Rank A/B Masters BA(MAG) 125, Crest 223 from 125
- [x] **HR.zon** · High Rank: ZON +1 panel · *Observed* · F2 Arturia (B Master) ZON 3 = 2 + 1
- [x] **HR.sus** · High Rank: its Servant's Sustainability +1◈ · *Pressed* · Scáthach 6 → 9 at her B Master's death; Normal Archer 15 → 18
- [x] **HR.param** · High Rank: a `+` to one of its Servant's Parameters · *Pressed* · +STR on the F1 Saber row: Pollux grantedSteps str+1; no + on C/D rows
- [x] **LR.mag** · Low Rank: BA(MAG) 100 · *Pressed* · Master of Rider F1 (C): Crest from BA(MAG) 100

## Rank A Essences

- [x] **E.formalcraft** · Formalcraft: Servant Max Luck +4 · *Observed* · swapped onto a Master: its Servant's Luck max +4, with the Gained line
- [x] **E.imaginaryAround** · Imaginary Around: Servant Max Agility +4 · *Observed* · swapped: Agility max +4, with the Gained line
- [x] **E.limitedZeroOver** · Limited/Zero Over: Servant Max Health +200 · *Observed* · live board: Health max +200 on its Servant
- [x] **E.kaleidoscope** · Kaleidoscope: Servant NP usable 4 Rounds earlier · *Observed* · live board: an Assassin's gate 1, from 4
- [x] **E.heavensFeel** · Heaven's Feel: Servant NP deals 200% extra damage · *Pressed* · Pollux's NP card: "Total Damage x3"
- [x] **E.heavensFeel.use** · …1 use only, the Player decides when · *Pressed* · timesUsed 1; not offered again

## Rank B Essences

- [x] **E.steelTraining** · Steel Training: all damage taken by the Servant reduced by 20% · *Observed* · defUp 20 on Arturia; named on the NP card
- [x] **E.steelTraining.np** · …15% if NP · *Observed* · npValue 15
- [x] **E.primevalMagic** · Primeval Magic: debuff chance reduced by 20% · *Observed* · ApplicationChance incoming 20, severity normal
- [x] **E.primevalMagic.not** · …not Instakill, Death or Erase · *Observed* · severity normal only
- [x] **E.projection** · Projection: Servant Max Luck +3 · *Observed* · swapped: Luck max +3, with the Gained line
- [x] **E.gandr** · Gandr: Servant Max Agility +3 · *Pressed* · Agility max 22 (trace Gandr)
- [x] **E.verdantDestruction** · Verdant Destruction: Servant Max Health +150 · *Observed* · live board: Health max +150 on its Servant
- [x] **E.antumbra** · Antumbra: Normal Attacks, Skills and Spells deal 20% extra damage · *Observed* · live board: dmgUp 20, np 0, source Antumbra
- [x] **E.elegance** · Elegance: Crit Chance +20% · *Observed* · crit modifier from Elegance on F2 Proto Gil
- [x] **E.elegance.np** · …not NP · *Observed* · crit chance 70 on a Normal Attack, 50 on an NP
- [x] **E.imaginaryNumber** · Imaginary Number: NP usable 3 Rounds earlier · *Observed* · live board: NpGateShift 3, its Servant's gate opened earlier
- [x] **E.divineBanquet** · Divine Banquet: NP Cooldown reduced by 3◈ · *Pressed* · Proto Gil's NPs 9 → 0
- [x] **E.divineBanquet.use** · …1 use only, the Player decides when · *Pressed* · timesUsed 1; the bar's button gone
- [x] **E.angelsSong** · Angel's Song: NP deals 150% extra damage · *Pressed* · NP card, with Noble Phantasm Max: "Total Damage x3.5"; again in the declaration window, Excalibur over two Masters: both cards "Total Damage x3.5"
- [x] **E.angelsSong.use** · …1 use only, the Player decides when · *Pressed* · spent once; not offered again

## Rank C Essences

- [x] **E.azothBlade** · Azoth Blade: all damage taken reduced by 15% · *Observed* · live board: defUp 15
- [x] **E.azothBlade.np** · …10% if NP · *Observed* · NP card: −10% from Azoth Blade
- [x] **E.falseAttendant** · False Attendant: debuff chance reduced by 15% · *Observed* · live board: ApplicationChance incoming 15, severity normal
- [x] **E.falseAttendant.not** · …not Instakill, Death or Erase · *Observed* · severity normal only
- [x] **E.blackKeysB** · Black Keys (B): Max Luck +2 · *Observed* · swapped: Luck max +2, with the Gained line
- [x] **E.blackKeysG** · Black Keys (G): Max Agility +2 · *Observed* · swapped: Agility max +2, with the Gained line
- [x] **E.blackKeysR** · Black Keys (R): Max Health +100 · *Pressed* · Health max 850 (trace Black Keys (R))
- [x] **E.pendant** · Pendant: Normal Attacks, Skills and Spells deal 15% extra damage · *Observed* · dmgUp 15, npValue 0 on Scáthach
- [x] **E.grimoire** · Grimoire: Crit Chance increased (reading 9) · *Observed* · CritModifier 10 on F2 Achilles' copy
- [x] **E.grimoire.np** · …not NP · *Observed* · crit chance 60 on a Normal Attack, 50 on an NP
- [x] **E.leyline** · Leyline: NP usable 2 Rounds earlier · *Observed* · Nursery Rhyme gate max(1, 2 − 2)
- [x] **E.crystal** · Crystal: NP Cooldown reduced by 2◈ · *Pressed* · Master's bar: five NPs' Cooldowns 9 → 3
- [x] **E.crystal.use** · …1 use only, the Player decides when · *Pressed* · spent once; the bar's button gone
- [x] **E.dragonkind** · Dragonkind: NP deals 100% extra damage · *Pressed* · NP card: "Total Damage x2"
- [x] **E.dragonkind.use** · …1 use only, the Player decides when · *Pressed* · spent once; not offered again

## Rank D Essences

- [x] **E.tenacity** · Tenacity: all damage taken reduced by 10% · *Observed* · live board: defUp 10
- [x] **E.tenacity.np** · …5% if NP · *Observed* · NP card: −5% from Tenacity
- [x] **E.meditation** · Meditation: debuff chance reduced by 10% · *Observed* · live board: ApplicationChance incoming 10, severity normal
- [x] **E.meditation.not** · …not Instakill, Death or Erase · *Observed* · severity normal only
- [x] **E.technique** · Technique: Max Luck +1 · *Pressed* · Luck max 4 (trace Technique)
- [x] **E.preemption** · Preemption: Max Agility +1 · *Observed* · swapped: Agility max +1, with the Gained line
- [x] **E.destruction** · Destruction: Max Health +50 · *Observed* · swapped: Health max +50, with the Gained line
- [x] **E.flash** · Flash: Normal Attacks, Skills and Spells deal 10% extra damage · *Observed* · dmgUp 10 on Jack's copy
- [x] **E.chance** · Chance: Crit Chance +10% · *Observed* · Penthesilea's copy at commit; lost with "Berserker loses its Master Essence: Chance."; its CritModifier 10 the mechanism read live on Grimoire
- [x] **E.chance.np** · …not NP · *Observed* · crit chance 60 on a Normal Attack, 50 on an NP
- [x] **E.harvest** · Harvest: NP usable 1 Round earlier · *Observed* · Heracles gate max(1, 2 − 1)
- [x] **E.concentration** · Concentration: NP Cooldown reduced by 1◈ · *Pressed* · Master's bar: NP Cooldown 9 → 6
- [x] **E.concentration.use** · …1 use only, the Player decides when · *Pressed* · spent once; the bar's button gone
- [x] **E.oracle** · Oracle: NP deals 50% extra damage · *Pressed* · NP card: "Total Damage x1.5"
- [x] **E.oracle.use** · …1 use only, the Player decides when · *Pressed* · spent once; not offered again

## Magic Crest

- [x] **MC.who** · A Master holds a Magic Crest (reading 13) · *Pressed* · every Advanced and Normal Master holds normal-magic-crest
- [x] **MC.dmg** · Damage Spell: deals 2× damage, from BA(MAG) · *Pressed* · Crest: BA(MAG) 100 ×2, 256 before Resistance
- [x] **MC.spell** · …a Spell (reading 14) · *Pressed* · Silence on the Master: Crest "prevented by silence"; lifted: usable
- [x] **MC.np** · Categorized as Noble Phantasm · *Pressed* · Crest card: Pendant 0% (an NP figure); Luck: Increased Damage —
- [x] **MC.cd** · Cooldown 2◈ · *Pressed* · Crest Cooldown 6 (2◈)
- [x] **MC.gate** · Usable from Round 3 (Ch. 04) · *Observed* · Crest used at Round 7; `npGateRound: 3` stated
- [x] **MC.range** · The Master's Range: 2 panels, 1 target · *Pressed* · Crest from 2 panels

## The Normal Master

- [x] **NM.sb** · Base Health 250, MOV 2, Range 2 panels / 1 target, BA(STR) 50, BA(MAG) 100, Command Spells 3/3 · *Pressed* · Normal war: Masters 250 base, Crest, 3 Command Spells
- [x] **NM.zon** · ZON: Caster 5, Archer and Assassin 4, the rest 2 · *Pressed* · Saber's Master ZON 2, Archer's 4
- [x] **NM.roll.hp** · Max Health: a coin, then 250 ± 5d20 · *Pressed* · 200, 305, 190, 197
- [x] **NM.roll.agi** · Max Agility: 1d12 · *Pressed* · 11, 3, 5, 3
- [x] **NM.roll.luck** · Max Luck: 1d20 · *Pressed* · 1, 19, 7, 11
- [x] **NM.mag** · All Masters use BA(MAG) to Attack · *Pressed* · Normal Masters BA(MAG) 125/100 by the coin
- [x] **NM.hr** · Optional coin: High Rank BA(MAG) 125, ZON +1, Sustainability +1◈; Low 100 · *Pressed* · coin ranks A, A, A, C; Free clocks +3

## Contracts (the Normal text; Ch. 32 records the same for Advanced)

- [x] **CT.unbound** · Unbound: a Servant whose Master has used up its Command Spells · *Pressed* · Master of Berserker F1 at 0 Command Spells: Penthesilea Unbound, then Free
- [x] **CT.free** · Free: a Servant whose Master has been killed · *Pressed* · Master deaths: Servants Free
- [x] **CT.ctrl** · An Unbound or Free Servant is still controlled by its player · *Pressed* · Player1 drove the Free Archer's NP
- [x] **CT.who** · Masters and Casters may form a new Contract · *Pressed* · Masters contracted from the dialog
- [x] **CT.ub.ally** · An Unbound Servant cannot be contracted by an allied Master or Caster · *Pressed* · Contract dialog: "An ally cannot contract an Unbound Servant."
- [x] **CT.ub.roll** · …an enemy one rolls Contract Servant; a 6 succeeds · *Pressed* · Player1 on a 6: F2's Unbound Arturia joins Faction 1, with 3 Command Spells (§46.4-PM)
- [x] **CT.fr.ally** · A Free Servant: an allied Master or Caster contracts it without a roll · *Pressed* · "Lancer FREE Automatic Attempt" → contracted; Normal Archer the same
- [x] **CT.fr.roll** · …an enemy one rolls; a 5 or 6 succeeds · *Pressed* · an enemy Master's attempt on a Free Servant: a 5 succeeds
- [x] **CT.adj** · The contractor stands on a panel next to the Servant · *Pressed* · contractor adjacent in both presses
- [x] **CT.clear** · No Contract Servant roll with another enemy Unit within 2 panels of the contractor · *Pressed* · an enemy at 2 panels moved before the Normal Contract; `contract.test.mjs`
- [x] **CT.cs** · Success: 3 Command Spells usable only on that Servant · *Pressed* · "Lancer is now contracted, and granted 3 Command Spells."
- [x] **CT.conq.m** · A Master that kills an enemy Master contracts its Servant · *Observed* · a Master's kill staged: it contracts the dead Master's Servant
- [x] **CT.conq.s** · …a Servant that kills one within 2 panels of its own Master: its Master contracts · *Observed* · a Servant's kill within 2 panels of its Master: its Master contracts
- [x] **CT.conq.c** · …a Caster that kills a Master contracts · *Observed* · Semiramis's kill: she conquers both Scáthachs
- [x] **CT.conq.cs** · …and gains the dead Master's remaining Command Spells, only for that Servant · *Observed* · the conquered Servant's pool: 3, its own
- [x] **CT.tax** · Advanced (Ch. 32): more than one Servant Acted, the Master loses 25 Health at the Turn's end · *Observed* · Turn's end: "loses 25 Health (Multi-Servant tax)"; at 20: "Caster loses 25 Health (Multi-Servant tax). Caster is defeated.", both Scáthachs Free (reading 18)
- [x] **CT.ban** · Advanced (Ch. 32): at 25 Health or less, no second Servant may Act · *Pressed* · Player1, Jack after Asterios: "This Master is at 25 Health or less and cannot order a second Servant to Act."
- [x] **CT.go** · Neither applies in a Grand Order war · *Pressed* · Grand Order: Jack and Serenity both attack; Health 200 → 200, no tax (§46.4-PN, fixed live)
- [x] **CT.kh** · Kill Humans: a Servant that becomes Unbound abandons its Master and refuses to re-contract (`cs-kill-humans.yml`) · *Pressed* · Kill Humans mark; Full Heal to 0: "Berserker is Unbound, and abandons its Master"; old Master refused

## Sustainability

- [x] **SU.free** · A Servant whose Master is defeated becomes Free · *Pressed* · Master deaths: Free
- [x] **SU.clock** · …and disappears after its Sustainability, in Turns · *Pressed* · clocks 9, 18, 15 written at the deaths; a Free Scáthach at 5 Turns, contracted again by Player1's Master of Archer: a full 6 (reading 19)
- [x] **SU.np** · Advanced (§B.2): a Free Servant's NP costs Sustainability by the NP's Rank · *Observed* · Free Penthesilea, A Rank NP: 15 Turns (5◈)
- [x] **SU.na** · Advanced (Ch. 32): one with no clock pays in its own Health, the left column doubled · *Observed* · Free Anastasia with no clock: paid 80 at 80, NP 809, gone with a line

## The Normal Contract

- [x] **NC.tax** · More than one Servant Acted: the Master loses 20 Health per additional Servant · *Pressed* · "Master of Saber of Faction 1 loses 20 Health (Multi-Servant tax)."
- [x] **NC.ban** · …a Master at 20 Health or less cannot order more than one · *Pressed* · "This Master is at 20 Health or less and cannot order a second Servant to Act."
- [x] **NC.np** · A Free Servant disappears at once after using its NP · *Pressed* · F2 Saber Free, NP 690, then defeated (sustainabilityExhausted), with a line
- [x] **NC.np.a** · …a Free Archer's or Caster's NP (a): Sustainability −2◈ instead · *Pressed* · Free Normal Archer NP (a): 18 → 12, stays
- [x] **NC.np.b** · …its NP (b): it disappears at once · *Observed* · Free Normal Archer's NP (b): gone as the Phase ends, with a line
