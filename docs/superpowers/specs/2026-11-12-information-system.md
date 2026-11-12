# The Information System — the Clause list

A system of the user's design, asked for 2026-11-12, grilled the same day (three rounds, 27 readings, all ruled).
Not a Character Sheet: the Clauses below are the user's own rules, and the Servant Clauses at the end are the
sheets that meet them.

**Why it exists.** On the tabletop every Unit's page was open: *"If necessary, before beginning, thoroughly read the
Notebook pages of all Units"* (`char_orig_sheets/extra docs/Normal Great Holy Grail War.md:99`), and Health, Agility
and Luck sat on each figurine's *"description/figurine drop down menu"* (Mordred's sheet). "The Notebook" was each
player's private text, readable and editable only by its owner and the GM. This system turns the default round:
**every page starts hidden from every other Faction**, and a Faction pays to learn it with **Intel** it earns by
watching a Unit act. ADR-0008 records the decision.

**What exists already** (read 2026-11-12):

- A per-player Notebook, one Journal Entry per player (`module/engine/notebook.mjs`, #297, #323).
- Appreciation of the Arts' NP True Name learning (`module/engine/true-name.mjs#witnessNP`).
- True Name Discernment's first-sight page copy (`true-name.mjs#learnServantPage`, `vision.mjs`, #351).
- One public `identityRevealed` flag per Unit, which nothing in the engine writes (`rules/identity.mjs`).
- Public Tags for abilities, swapped to the real name per viewer (`engine/public-ability.mjs`, #387).
- "Seen" as one reader, `rules/identity.mjs#sees` (Detect range, or Jack's Mist).
- Two UI skins, `nocturne` and `classic` (`module/apps/ui-style.mjs`).

**How it is pressed.** One Clause per rule that can fail on its own. Every Clause ends Pressed or Observed live
(Ch. 46): a player-facing one is pressed as **Player1**, an engine one with an engine press, and every Clause marked
**(UI)** is pressed in **both skins**, nocturne and classic, its evidence naming both. A Clause is ticked only on
live evidence; a unit test is a guard, not evidence.

**185 Clauses.** Slices of the build are on the map issue (#398, slices #399–#405).

## Readings

1–27 ruled by the user 2026-11-12, as recommended but 6, 7, 9, 13 and 26, whose rulings are the user's own. 28–31 are open.

| # | Question | Ruling | Clauses |
|---|---|---|---|
| 1 | Who holds knowledge: a Faction or a player? | The Faction. Intel, Entries and everything a sheet teaches belong to the Faction, shared by its players; the GM sees every Faction's. A sheet's *"Player"* is read as that player's Faction. | ST.* |
| 2 | Which Units have a Dossier, earn Intel and appear in the window? | Servants and Masters. A Summon's or Platform's acts earn nothing; its statblock is part of the ability that raises it. A rider driving a Platform earns for his own Move and Attack. | EA.kind.* |
| 3 | What does "saw them" mean? | A Faction is a Witness of an act when any of its Units `sees` the acting Unit at the moment of the act, or is involved in it (targeted, inside its area, countering) whatever the range. An act made while concealed and undiscovered is witnessed by nobody. Masters witness. | EA.see.* |
| 4 | What stacks? | Per acting Unit, per witnessing Faction: each act is worth the highest any one Witness earns (×2 if involved), never the sum over Witnesses; different acts add. Move and Attack count once per Unit per Turn; Evade, Block, Counter and each ability use count every time. Evading and then Countering one Attack earns both. A failed act counts. | EA.* |
| 5 | Which uses count as an ability? | An Attack Skill is Attack (2) + Skill (2); a damaging NP is Attack + NP (8); a non-damaging NP 8; an active Skill or Spell 2; a passive that fires by itself 0; a Master's Command Spell 2, on the Master; an Item 0. The ×2 goes to every Unit the ability targets or whose panel its area covers. | EA.ab.* |
| 6 | What does an NP use reveal, and to whom? | To the **witnessing Factions only**: the True Name, the true portrait and real ability names on their cards; free Entries for all seven Stats (with values), Region and Attributes. Abilities stay purchasable. | NP.* |
| 7 | What is free, and what has no price? | Free: Class, Faction and Unit kind. **Not** free: how many abilities a Unit has, or of which kind. Added prices: Alignment 1, Class Skills 6, Items held 4, a Master's Command Spells left 4. Never sold: the True Name, Sustainability and NP charges. | PR.* |
| 8 | What does a bought ability show? | A generated summary: its Public Tag, its section, Active or Passive, range, targets or area, cost and Cooldown, and one line per effect in the authoring vocabulary's words. Never its name, Rank or sheet text. Pick lists keep their scrubbed text. | SE.show.* |
| 9 | What leaks outside the window? | Cards and status icons stay. **Roll lines are cloaked**: *"Saber's ■■■, rolled ■■■ against ■■■"*. Enemy Health bars hide until END is bought. | CL.*, TB.* |
| 10 | Its words | Intel, Witness, Dossier, Entry, Section and Notebook (`CONTEXT.md`). | — |
| 11 | A War Rule? | `informationSystem`, on by default, prices fixed in code. Off is today's game: every page open to every player. | WR.* |
| 12 | Identity per Faction | Stored as the Factions that know a Unit (`identityKnownBy`), drawn per viewer: cards through the #387 swap, tokens through `apps/canvas/token.mjs`. The old public flag means "known to every Faction". | ID.* |
| 13 | How does a Faction learn what abilities exist? | **By Sections.** A Faction buys "unlock one" in a Section and gets a random ability of it it does not know; it never learns how many are left until a Section is exhausted. | SE.* |
| 14 | Who sees through a cloaked roll? | A viewer whose Faction owns the Unit or bought the Entry behind each blank: the ability's name blank opens on its Entry (as the Public Tag); the target opens on that Entry or the Stat it reads (LUC for a Luck Check, AGI for an Evade); the die face opens with the target. The GM sees all. Damage stays visible to the exchange; a Health or pool line's before → after shows only to a Faction that bought that Stat, else *"Saber loses Health"*. | CL.* |
| 15 | Mordred's and Lancelot's hidden page | While it holds: END, AGI and LUC sell the Rank only, never the values; only Parameters and Class Skills are buyable; the cloak never opens on her pools. It ends on Clarent Blood Arthur (Lancelot: Arondight); returns 3◈ later; what was bought stays bought. Her own switch-off has the same lockout. | MO.* |
| 16 | Hephaestion's false information | At War setup her player picks a false Class (shown through `concealedIdentity`) and false Ranks for her seven Stats. A bought Stat shows the false Rank and a value derived from it. Witnessing her NP shows those Witnesses the truth. The GM sees the truth. | HE.* |
| 17 | Jack's Information Erasure | Leaving the Detect of any one enemy Unit erases that Unit's Faction's Entries on him, its Intel on him and its knowledge of his identity, with a line to that Faction. Factions still watching keep theirs. | JA.* |
| 18 | The sheets that teach | All write to the learner's Faction and pass price and Section. True Name Discernment: the whole Dossier and the True Name, abilities in full text. Appreciation of the Arts: that NP's Entry with its name and text. Coercion (and a Man in Black's): one non-Class Skill the target's player picks, in full. Classified: the whole Dossier and the True Name, to every Faction with a Unit within 2. Hassan (Fathomless): TND's passive does nothing; its active on Heads unlocks his seven Stats, which his Luck Check can undo. Metatron Jeanne: TND does nothing. | TN.*, AA.*, FB.*, HA.*, MJ.* |
| 19 | The existing per-player Notebooks | One Notebook per Faction, owned by its players and the GM; a one-time pass on load folds each player's into its Faction's and deletes the old. | ST.mig.* |
| 20 | The window and double-click | An Intel window (Token Controls and the action bar) lists every non-owned Servant and Master the Faction holds a Dossier on. Selecting one shows a cut-down sheet: portrait, the name the Faction knows, Class, Intel held, every Entry locked or open with its price and a buy button. Double-click on an enemy token opens its Dossier; on one's own, the full sheet; the GM toggles. A buy runs on the GM by socket and posts a card whispered to the Faction. | WI.*, DC.*, BU.* |
| 21 | Sections and prices | Spells (`isSpell`) 8, Active Skills (not Spells; Attack Skills included) 8, Passive Skills 8, Class Skills 6, NPs 32. A Master's abilities fall into the same five. | SE.* |
| 22 | The draw and an empty Section | Drawn by the GM, uniformly among the Section's abilities the Faction does not know. A buy that finds none left costs nothing and marks the Section **Complete**; only then is its count known. A Section shows "2 known", never "2 of 3". Abilities a sheet teaches leave the pool and appear in their Section. | SE.* |
| 23 | A refused buy on a hidden Section | Greyed, with the reason *"Hidden by this Unit's information"*; pressing it costs nothing. | MO.refuse |
| 24 | A Unit's abilities change | Entries keyed by content id. A gained ability joins its Section's pool, and a Complete mark drops silently; a lost one keeps its bought Entry, marked *"no longer held"*. | SE.change.* |
| 25 | A Unit changing Faction, Alliances | A Unit's new Faction owns it and sees everything. The Faction it left keeps full knowledge. Allied Factions share nothing automatically. | FC.* |
| 26 | A fallen Unit's Dossier | A final defeat clears the body a tick later (`io.clearBody`). The Dossier stays read-only in a **Fallen** list; no earning, no buying; its banked Intel is lost. | FA.* |
| 27 | Delivery | This spec, ADR-0008, `CONTEXT.md`'s terms, then a map issue with one ticket per slice, built test-first and pressed as Player1 in both skins. | — |

### Open readings (found writing the Clauses, put to the user 2026-11-12)

| # | Question | Recommended | Clauses |
|---|---|---|---|
| 28 | Items: Q7 priced them at 4 each, before Q13 made abilities Sections. Locked slots per Item would show how many a Unit holds. | A sixth Section, **Items**, 4 a draw. | SE.items |
| 29 | A Move crosses panels. Who witnesses it: who sees its start, its end, or any panel it passes? | Who sees its start **or** its end panel. | EA.see.moment |
| 30 | Is earning said? A Faction does not otherwise know its Intel grew. | A card whispered to the Faction once per Turn, at the Turn's end, naming each Unit and its gain; nothing to any other Faction. | EA.card, EA.silent.other |
| 31 | The War Rule switched mid-War, and a player with no Faction at migration | The Notebooks stay through a switch; a Faction-less player's Notebook is skipped and named to the GM. | WR.switch, ST.mig.none |

## The War Rule

- [ ] **WR.rule** · `informationSystem` is a War Rule, read through `warRule`, on by default
- [ ] **WR.off.open** · Off: every Faction reads every Unit's full Dossier, every Entry open, with no Intel shown
- [ ] **WR.off.earn** · Off: no Intel is earned and no buy is offered
- [ ] **WR.off.cloak** · Off: no roll line is cloaked and every Health bar shows as Foundry's setting says
- [ ] **WR.off.id** · Off: identity is the public flag, as today
- [ ] **WR.switch** · A War switched off mid-play keeps its Notebooks; switched back on, they read as before

## The store (Q1, Q19)

- [ ] **ST.faction** · Each Faction has one Notebook, a Journal Entry owned by all its players and the GM, nobody else
- [ ] **ST.page** · It holds one Dossier per Unit the Faction knows of: its Intel, its open Entries, its Sections' marks
- [ ] **ST.shared** · Two players of one Faction read the same Dossier, and a buy by one is open to the other at once
- [ ] **ST.private** · A player of another Faction cannot open, read or receive any of it, by window, journal or socket
- [ ] **ST.gm** · The GM reads every Faction's Notebook
- [ ] **ST.write** · Every write to a Notebook runs on the active GM; a player's client never writes one
- [ ] **ST.mig.fold** · On load, each existing per-player Notebook folds into its player's Faction Notebook, page by page
- [ ] **ST.mig.delete** · …and the old journal is deleted once its pages have landed
- [ ] **ST.mig.once** · The fold runs once: a second load finds nothing to fold and changes nothing
- [ ] **ST.mig.none** · A player with no Faction keeps no Notebook; the fold names whose was skipped, for the GM

## Earning Intel (Q2–Q5)

### Who earns, on whom

- [ ] **EA.kind.servant** · A Servant's acts earn Intel on it
- [ ] **EA.kind.master** · A Master's acts earn Intel on it
- [ ] **EA.kind.summon** · A Summon's acts earn nothing (a Golem's swing)
- [ ] **EA.kind.platform** · A Platform's acts earn nothing on it; its driver earns on himself for his Move and Attack (Avicebron on GKM)
- [ ] **EA.own** · A Faction earns nothing on its own Units
- [ ] **EA.ally** · An allied Faction earns on its ally's Units as any Faction does (Q25: nothing shared)

### Seeing

- [ ] **EA.see.detect** · A Faction witnesses an act when any of its Units `sees` the acting Unit at that moment
- [ ] **EA.see.out** · A Faction with no Unit seeing it and none involved earns nothing
- [ ] **EA.see.involved** · An involved Unit witnesses whatever the range (an Archer struck from beyond its Detect)
- [ ] **EA.see.master** · A Master's Detect counts as any Unit's
- [ ] **EA.see.summon** · A Summon of the Faction that sees the act makes its Faction a Witness
- [ ] **EA.see.concealed** · An act made while concealed and undiscovered is witnessed by nobody
- [ ] **EA.see.moment** · Sight is read at the act: a Move is witnessed by who sees its end panel or its start panel
- [ ] **EA.see.mist** · Jack's Mist's *"she can see all Units within"* is a Witness by `sees`, as Discover reads it

### Values

- [ ] **EA.move** · Moving: +1
- [ ] **EA.attack** · Attacking: +2
- [ ] **EA.evade** · Evading: +1
- [ ] **EA.block** · Blocking: +1
- [ ] **EA.counter** · Countering: +2
- [ ] **EA.x2** · An involved Witness earns ×2 on that act (targeted, inside the area, or countering it)
- [ ] **EA.max** · Each act pays its Faction the highest a single Witness earns, never the sum of Witnesses (three Witnesses of one Move: +1)
- [ ] **EA.sum** · Different acts add (Move + Attack in one Turn: 1 + 2, or 1 + 4 to an involved Witness)
- [ ] **EA.once.move** · A second Move by one Unit in one Turn adds nothing for any Faction
- [ ] **EA.once.attack** · A second Attack by one Unit in one Turn adds nothing for any Faction
- [ ] **EA.repeat.react** · Each Evade, Block and Counter pays every time, two in one Turn included
- [ ] **EA.both** · An Evade and then a Counter on one Attack pay both (1 + 2)
- [ ] **EA.fail** · A failed act pays: a missed Attack, a failed Evade
- [ ] **EA.example** · The user's example: A moves, attacks B, B counters, A evades the Counter → Faction 2 on A 7 (1 + 4 + 2); Faction 1 on B 4

### Abilities

- [ ] **EA.ab.skill** · An active Skill or Spell: +2, each use
- [ ] **EA.ab.np** · An NP: +8, each use
- [ ] **EA.ab.attackskill** · An Attack Skill: Attack (+2, once a Turn) and Skill (+2)
- [ ] **EA.ab.npattack** · A damaging NP: Attack (+2, once a Turn) and NP (+8)
- [ ] **EA.ab.passive** · A passive that fires by itself pays nothing (Fig Tree, Guts, an aura)
- [ ] **EA.ab.cs** · A Command Spell: +2, on the Master who spent it
- [ ] **EA.ab.item** · Using an Item pays nothing
- [ ] **EA.ab.x2** · Every Unit an ability targets or whose panel its area covers is involved, ×2

### Said

- [ ] **EA.card** · A Faction's gains are said to that Faction only, once per Turn, on a whispered card naming each Unit by the name it knows and the Intel gained
- [ ] **EA.silent.other** · No other Faction sees that card, or learns from any line that Intel was earned

## An NP reveals (Q6)

- [ ] **NP.who** · Using an NP reveals its user to every Faction that witnessed the use, and to no other
- [ ] **NP.name** · Those Factions read its True Name on tokens, nameplates and every later card
- [ ] **NP.portrait** · …and its true portrait on its token
- [ ] **NP.abilities** · …and its abilities' real names where the cards print Public Tags
- [ ] **NP.stats** · Those Factions get all seven Stat Entries open, with values, for free
- [ ] **NP.region** · …and Region and Attributes
- [ ] **NP.notabilities** · Its abilities, the used NP included, stay to be bought
- [ ] **NP.unseen** · An NP used unwitnessed (concealed and undiscovered, or seen by nobody) reveals nothing
- [ ] **NP.card** · The reveal is said to each witnessing Faction, whispered

## Identity per Faction (Q12)

- [ ] **ID.store** · Who knows a Unit's identity is a list of Faction ids on it (`identityKnownBy`)
- [ ] **ID.card** · A card's True Name and real ability names open for a viewer whose Faction is on the list, through the #387 swap
- [ ] **ID.token** · A token's nameplate and portrait read true for those viewers, public for the rest, from one token document
- [ ] **ID.tooltip** · A hover nameplate reads the same as the token for each viewer
- [ ] **ID.public** · A Unit known to every Faction reads as the old public flag did
- [ ] **ID.owner** · Its owner and the GM always read the truth, as today
- [ ] **ID.loss** · Losing identity (Jack's Erasure) takes the Faction off the list, and its viewers read the public face again

## The window (Q20) — every Clause here is (UI), pressed in nocturne and classic

- [ ] **WI.open.controls** · An Intel window opens from the Token Controls (UI)
- [ ] **WI.open.bar** · …and from the action bar (UI)
- [ ] **WI.list** · It lists every non-owned Servant and Master its Faction holds a Dossier on, and no other Unit (UI)
- [ ] **WI.list.none** · A Unit nobody of the Faction has ever witnessed has no Dossier and is not listed (UI)
- [ ] **WI.head** · A Dossier shows its portrait and name as the Faction knows them, its Class, and the Intel banked on it (UI)
- [ ] **WI.entry** · Each Stat, Region, Attributes, Alignment and Command Spells shows locked with its price, or open with its value (UI)
- [ ] **WI.section** · Each Section shows "N known", its open Entries, and a buy button with its price (UI)
- [ ] **WI.live** · An open Entry's current values follow the board while the window is open (Health falls, it falls) (UI)
- [ ] **WI.afford** · A buy the Faction cannot afford is greyed with the reason *"Needs 4 Intel; 2 held"* (UI)
- [ ] **WI.gm** · The GM opens the window for any Faction, chosen in it (UI)
- [ ] **WI.skins** · Both skins draw it whole: no clipped text, no missing lock, no unstyled control (UI)
- [ ] **DC.enemy** · Double-clicking a token you do not own opens its Dossier (UI)
- [ ] **DC.own** · Double-clicking your own opens its full sheet, as today (UI)
- [ ] **DC.none** · Double-clicking a Unit you hold no Dossier on says *"Nothing is known of this Unit"* (UI)
- [ ] **DC.gm** · The GM toggles double-click between the full sheet and a Faction's Dossier (UI)

## Buying (Q7, Q20)

- [ ] **BU.socket** · A player's buy runs on the active GM by socket
- [ ] **BU.pay** · It spends the price from the Intel banked on that Unit, and never from another Unit's
- [ ] **BU.short** · A buy short of Intel is refused out loud and spends nothing
- [ ] **BU.race** · Two players of one Faction buying at once spend once each and never below 0
- [ ] **BU.card** · A buy posts a card whispered to the Faction: who bought what, on whom, for how much
- [ ] **BU.again** · An open Entry offers no buy

### Prices and what each shows

- [ ] **PR.str** · STR, 4: its Rank and Base Attack (STR)
- [ ] **PR.end** · END, 4: its Rank, and current and Max Health
- [ ] **PR.agi** · AGI, 4: its Rank, and current and Max Agility
- [ ] **PR.mag** · MAG, 4: its Rank and Base Attack (MAG)
- [ ] **PR.luc** · LUC, 4: its Rank, and current and Max Luck
- [ ] **PR.mov** · MOV, 4: its MOV
- [ ] **PR.range** · Range, 4: its Range, panels and targets
- [ ] **PR.region** · Region, 1
- [ ] **PR.attr** · Attributes, 1: every Attribute at once
- [ ] **PR.align** · Alignment, 1
- [ ] **PR.cs** · A Master's Command Spells left, 4
- [ ] **PR.free** · Class, Faction and Unit kind are free and shown from the first sighting
- [ ] **PR.never** · The True Name, Sustainability and NP charges are never offered
- [ ] **PR.master** · A Master's Dossier offers the Stats it has, and no Stat it lacks

## Sections (Q13, Q21–Q24)

- [ ] **SE.five** · A Servant's abilities sit in five Sections: Spells, Active Skills, Passive Skills, Class Skills, NPs
- [ ] **SE.items** · …and its Items in a sixth, Items (reading 28, open)
- [ ] **SE.spell** · A Section of Spells is the `isSpell` family, active or passive
- [ ] **SE.attackskill** · An Attack Skill is an Active Skill
- [ ] **SE.price** · A draw costs 8 for Spells, Active Skills and Passive Skills, 6 for Class Skills, 32 for NPs, 4 for Items
- [ ] **SE.draw** · A buy opens one ability of the Section the Faction does not know, drawn by the GM
- [ ] **SE.uniform** · Uniformly among those left
- [ ] **SE.known** · A Section shows "N known", never how many it holds
- [ ] **SE.complete** · A buy that finds none left spends nothing and marks the Section Complete, *"No more Spells"*
- [ ] **SE.empty** · A Unit with none in a Section: the first buy says so, free
- [ ] **SE.taught** · An ability a sheet taught (Q18) is in its Section and out of the draw
- [ ] **SE.show.tag** · An open ability shows its Public Tag, its Section and Active or Passive
- [ ] **SE.show.shape** · …its range, targets or area, its cost and its Cooldown
- [ ] **SE.show.effects** · …and one line per effect, in the authoring vocabulary's words
- [ ] **SE.show.not** · …and never its name, its Rank or its sheet text
- [ ] **SE.master** · A Master's abilities sit in the same five Sections
- [ ] **SE.change.gain** · An ability the Unit gains (a form, an Obtained or Stolen Skill) joins its Section's draw
- [ ] **SE.change.reopen** · …and a Complete mark on that Section drops, with no line said
- [ ] **SE.change.lose** · An ability it loses keeps its open Entry, marked *"no longer held"*

## Cloaked lines (Q9, Q14)

- [ ] **CL.roll** · A roll line reads *"Saber's ■■■, rolled ■■■ against ■■■"* to a viewer who holds nothing of it (UI)
- [ ] **CL.name** · The ability's blank opens, as its Public Tag, on that ability's Entry (UI)
- [ ] **CL.target** · The target opens on that ability's Entry, or on the Stat the roll reads (UI)
- [ ] **CL.luck** · A Luck Check's target opens on LUC (UI)
- [ ] **CL.evade** · An Evade's target opens on AGI (UI)
- [ ] **CL.face** · The die face opens with its target, never alone (UI)
- [ ] **CL.owner** · The Unit's owner reads every roll line in full (UI)
- [ ] **CL.gm** · The GM reads every line in full (UI)
- [ ] **CL.pool** · A Health line's before → after shows to a Faction that bought END, else *"Saber loses Health"* (UI)
- [ ] **CL.pool.agi** · An Agility line's to one that bought AGI; a Luck line's to one that bought LUC (UI)
- [ ] **CL.damage** · Damage stays visible to the Factions in the exchange, as now (UI)
- [ ] **CL.stored** · The message stores the cloaked view; each client opens what its Faction holds when it draws it (UI)
- [ ] **TB.hide** · An enemy's Health bar is hidden from a Faction that has not bought its END (UI)
- [ ] **TB.show** · …and shows once it has (UI)
- [ ] **TB.icons** · Status icons on tokens stay as they are

## Changing Faction, Alliances, the fallen (Q25, Q26)

- [ ] **FC.join** · A Unit that joins a Faction (Conquest, a Charm's end, a summoning mid-War) is that Faction's own: everything open to it
- [ ] **FC.left** · The Faction it left keeps every Entry open on it, and its identity
- [ ] **FC.ally** · An Alliance shares no Entry, no Intel and no identity
- [ ] **FA.list** · A Unit whose body has left the board moves to a **Fallen** list in the window (UI)
- [ ] **FA.read** · Its Dossier stays readable (UI)
- [ ] **FA.frozen** · No Intel is earned on it, and no buy is offered (UI)
- [ ] **FA.lost** · Its banked Intel is gone, and the window shows none

## Servants

### Mordred, Secret of Pedigree — and Lancelot (Berserker), For Someone's Glory (Q15, Q23)

- [ ] **MO.values** · While it holds, buying END, AGI or LUC opens the Rank only, never the pools' values
- [ ] **MO.only** · Only her Parameters and Class Skills are buyable
- [ ] **MO.refuse** · Every other Section is greyed *"Hidden by this Unit's information"*, and pressing it costs nothing (UI)
- [ ] **MO.cloak** · No cloak opens on her Health, Agility or Luck, whatever was bought (UI)
- [ ] **MO.bar** · Her Health bar stays hidden even after END is bought (UI)
- [ ] **MO.gm** · The GM reads her values, as today
- [ ] **MO.end** · Clarent Blood Arthur ends it; Lancelot's Arondight ends his
- [ ] **MO.end.np** · …and its Witnesses get Q6's reveal, values included
- [ ] **MO.back** · It returns 3◈ after it ended; what any Faction bought meanwhile stays open
- [ ] **MO.off** · Her own switch-off ends it, with the same 3◈ before it returns
- [ ] **MO.lancelot** · Lancelot's is not restored by Mad Enhancement's return (his sheet)

### Hephaestion Mnēmosynē, Camouflage (Q16)

- [ ] **HE.setup** · At War setup her player picks a false Class and false Ranks for her seven Stats
- [ ] **HE.class** · Every other Faction reads the false Class on her token and cards
- [ ] **HE.stat** · A bought Stat opens the false Rank and a value derived from it
- [ ] **HE.np** · Witnessing her NP shows those Witnesses her true Class and Stats, over the false
- [ ] **HE.gm** · The GM and her owner read the truth throughout

### Jack the Ripper, Information Erasure (Q17)

- [ ] **JA.leave** · When Jack leaves the Detect of an enemy Unit, that Unit's Faction loses every Entry open on him
- [ ] **JA.intel** · …and its Intel banked on him
- [ ] **JA.id** · …and its knowledge of his identity
- [ ] **JA.line** · …said to that Faction alone
- [ ] **JA.other** · A Faction with another Unit still seeing him keeps everything
- [ ] **JA.any** · Leaving any one enemy Unit's Detect is enough, for that Unit's Faction

### True Name Discernment (Rulers), Hassan (Fathomless), Metatron Jeanne (Q18)

- [ ] **TN.first** · On first sight of an enemy Servant, the Ruler's Faction gets its whole Dossier, free, past every Section
- [ ] **TN.truename** · …and its True Name
- [ ] **TN.full** · …and every ability in full text, name included
- [ ] **TN.hide** · A Servant that hides its information first passes a Luck Check (as today)
- [ ] **TN.once** · Once a pair, a failed Check final (as today)
- [ ] **HA.passive** · Against Hassan (Fathomless), TND's first sight does nothing
- [ ] **HA.coin** · TND's active on him flips a coin; Heads opens his seven Stats to the user's Faction
- [ ] **HA.luck** · …and Hassan's successful Luck Check closes them again
- [ ] **MJ.none** · Against Metatron Jeanne, TND does nothing, first sight or active

### Appreciation of the Arts — Gilles (Caster), Mozart, Sen no Rikyū (Q18)

- [ ] **AA.entry** · A learned NP opens its Entry for the learner's Faction, with its name and full text
- [ ] **AA.faction** · …written to the Faction's Notebook, no longer the player's
- [ ] **AA.section** · …and leaves the NP Section's draw

### First Director of FBI — Coercion and Classified (Q18)

- [ ] **FB.coerce** · Coercion's DU's player picks one of its Skills other than Class Skills
- [ ] **FB.coerce.open** · …which opens for the FBI's Faction in full text, name included
- [ ] **FB.mib** · A Man in Black's successful Coercion opens it for his Faction the same way
- [ ] **FB.classified** · Classified, landed, opens the DU's whole Dossier and True Name to every Faction with a Unit within 2 of it
- [ ] **FB.classified.self** · …not to the DU's own Faction, which owns it

## Live evidence

None yet: nothing is built.
