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

**186 Clauses.** Slices of the build are on the map issue (#398, slices #399–#405).

## Readings

All 31 ruled by the user 2026-11-12, as recommended but 6, 7, 9, 13 and 26, whose rulings are the user's own.

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

### Readings found writing the Clauses (ruled 2026-11-12, as recommended)

| # | Question | Ruling | Clauses |
|---|---|---|---|
| 28 | Items: Q7 priced them at 4 each, before Q13 made abilities Sections. Locked slots per Item would show how many a Unit holds. | A sixth Section, **Items**, 4 a draw. | SE.items |
| 29 | A Move crosses panels. Who witnesses it: who sees its start, its end, or any panel it passes? | Who sees its start **or** its end panel. | EA.see.moment |
| 30 | Is earning said? A Faction does not otherwise know its Intel grew. | A card whispered to the Faction once per Turn, at the Turn's end, naming each Unit and its gain; nothing to any other Faction. | EA.card, EA.silent.other |
| 31 | The War Rule switched mid-War, and a player with no Faction at migration | The Notebooks stay through a switch; a Faction-less player's Notebook is skipped and named to the GM. | WR.switch, ST.mig.none |
| 32 | Found pressing: a Master has Health, Agility and Luck but no Parameters, so "the Stats it has" sold none of the three. | Each is sold at 4 by its own Entry, the pool shown with no Rank (ruled 2026-11-12, after the press). | PR.master |

## Built (2026-11-12)

Slices #399–#405 are built and guarded by `test/unit/intel-399-400.test.mjs` and `test/unit/intel-405.test.mjs`.
Where the build departs from a word above, the Clause says so:

- **ID.store** keeps identity in the Faction's own Notebook. Q12 named `identityKnownBy` on the actor; but every
  client reads actor data, so a list there would tell every player which Factions know a Unit. The per-viewer
  drawing is the same: each client reads its own Faction's Notebook (`engine/intel.mjs#viewerKnowsIdentity`).
- **The Notebook is read, not owned, by its players** (OBSERVER): its state is the GM's to write (ST.write), and a
  player who owned it could write it from the console. Pages are still readable as before.
- **CL.stored**: a figure is stored as a mark, `⟦c|unit|entry|figure⟧`, which every client shows as ■■■ and opens
  only for a viewer whose Faction holds the Entry (`openCloaks`, on `renderChatMessageHTML`).
- **The unbuilt Servants' Clauses** (Mordred, Lancelot, Hephaestion, Hassan (Fathomless), Metatron Jeanne, the FBI
  Director, Mozart, Rikyū) are pressed on staged bench Servants, `test-intel-*`, through the same elements their
  sheets will author: `HidesInformation`, `FalseInformation`, `ErasesInformation`, `TrueNameShroud`, and the
  phases `revealSkill` and `revealDossier`. Jack, Karl and Gilles (Caster) are built and pressed as themselves.

## The War Rule

- [x] **WR.rule** · `informationSystem` is a War Rule, read through `warRule`, on by default
- [x] **WR.off.open** · Off: every Faction reads every Unit's full Dossier, every Entry open, with no Intel shown
- [x] **WR.off.earn** · Off: no Intel is earned and no buy is offered
- [x] **WR.off.cloak** · Off: no roll line is cloaked and every Health bar shows as Foundry's setting says
- [x] **WR.off.id** · Off: identity is the public flag, as today
- [x] **WR.switch** · A War switched off mid-play keeps its Notebooks; switched back on, they read as before

## The store (Q1, Q19)

- [x] **ST.faction** · Each Faction has one Notebook, a Journal Entry owned by all its players and the GM, nobody else
- [x] **ST.page** · It holds one Dossier per Unit the Faction knows of: its Intel, its open Entries, its Sections' marks
- [x] **ST.shared** · Two players of one Faction read the same Dossier, and a buy by one is open to the other at once
- [ ] **ST.private** · A player of another Faction cannot open, read or receive any of it, by window, journal or socket
- [x] **ST.gm** · The GM reads every Faction's Notebook
- [x] **ST.write** · Every write to a Notebook runs on the active GM; a player's client never writes one
- [x] **ST.mig.fold** · On load, each existing per-player Notebook folds into its player's Faction Notebook, page by page
- [x] **ST.mig.delete** · …and the old journal is deleted once its pages have landed
- [x] **ST.mig.once** · The fold runs once: a second load finds nothing to fold and changes nothing
- [x] **ST.mig.none** · A player with no Faction keeps no Notebook; the fold names whose was skipped, for the GM

## Earning Intel (Q2–Q5)

### Who earns, on whom

- [x] **EA.kind.servant** · A Servant's acts earn Intel on it
- [x] **EA.kind.master** · A Master's acts earn Intel on it
- [x] **EA.kind.summon** · A Summon's acts earn nothing (a Golem's swing)
- [x] **EA.kind.platform** · A Platform's acts earn nothing on it; its driver earns on himself for his Move and Attack (Avicebron on GKM)
- [x] **EA.own** · A Faction earns nothing on its own Units
- [x] **EA.ally** · An allied Faction earns on its ally's Units as any Faction does (Q25: nothing shared)

### Seeing

- [x] **EA.see.detect** · A Faction witnesses an act when any of its Units `sees` the acting Unit at that moment
- [x] **EA.see.out** · A Faction with no Unit seeing it and none involved earns nothing
- [x] **EA.see.involved** · An involved Unit witnesses whatever the range (an Archer struck from beyond its Detect)
- [x] **EA.see.master** · A Master's Detect counts as any Unit's
- [x] **EA.see.summon** · A Summon of the Faction that sees the act makes its Faction a Witness
- [x] **EA.see.concealed** · An act made while concealed and undiscovered is witnessed by nobody
- [x] **EA.see.moment** · Sight is read at the act: a Move is witnessed by who sees its end panel or its start panel
- [x] **EA.see.mist** · Jack's Mist's *"she can see all Units within"* is a Witness by `sees`, as Discover reads it

### Values

- [x] **EA.move** · Moving: +1
- [x] **EA.attack** · Attacking: +2
- [x] **EA.evade** · Evading: +1
- [x] **EA.block** · Blocking: +1
- [x] **EA.counter** · Countering: +2
- [x] **EA.x2** · An involved Witness earns ×2 on that act (targeted, inside the area, or countering it)
- [x] **EA.max** · Each act pays its Faction the highest a single Witness earns, never the sum of Witnesses (three Witnesses of one Move: +1)
- [x] **EA.sum** · Different acts add (Move + Attack in one Turn: 1 + 2, or 1 + 4 to an involved Witness)
- [x] **EA.once.move** · A second Move by one Unit in one Turn adds nothing for any Faction
- [x] **EA.once.attack** · A second Attack by one Unit in one Turn adds nothing for any Faction
- [x] **EA.repeat.react** · Each Evade, Block and Counter pays every time, two in one Turn included
- [x] **EA.both** · An Evade and then a Counter on one Attack pay both (1 + 2)
- [x] **EA.fail** · A failed act pays: a missed Attack, a failed Evade the player chose
- [x] **EA.auto** · An Evade no player chose (Instinct, Trofa, a Dodge) pays when it succeeds; a failed automatic roll is no act (derived 2026-11-12)
- [x] **EA.example** · The user's example: A moves, attacks B, B counters, A evades the Counter → Faction 2 on A 7 (1 + 4 + 2); Faction 1 on B 4

### Abilities

- [x] **EA.ab.skill** · An active Skill or Spell: +2, each use
- [x] **EA.ab.np** · An NP: +8, each use
- [x] **EA.ab.attackskill** · An Attack Skill: Attack (+2, once a Turn) and Skill (+2)
- [x] **EA.ab.npattack** · A damaging NP: Attack (+2, once a Turn) and NP (+8)
- [x] **EA.ab.passive** · A passive that fires by itself pays nothing (Fig Tree, Guts, an aura)
- [x] **EA.ab.cs** · A Command Spell: +2, on the Master who spent it
- [x] **EA.ab.item** · Using an Item pays nothing
- [x] **EA.ab.x2** · Every Unit an ability targets or whose panel its area covers is involved, ×2

### Said

- [x] **EA.card** · A Faction's gains are said to that Faction only, once per Turn, on a whispered card naming each Unit by the name it knows and the Intel gained
- [x] **EA.silent.other** · No other Faction sees that card, or learns from any line that Intel was earned

## An NP reveals (Q6)

- [x] **NP.who** · Using an NP reveals its user to every Faction that witnessed the use, and to no other
- [x] **NP.name** · Those Factions read its True Name on tokens, nameplates and every later card
- [x] **NP.portrait** · …and its true portrait on its token
- [x] **NP.abilities** · …and its abilities' real names where the cards print Public Tags
- [x] **NP.stats** · Those Factions get all seven Stat Entries open, with values, for free
- [x] **NP.region** · …and Region and Attributes
- [x] **NP.notabilities** · Its abilities, the used NP included, stay to be bought
- [x] **NP.unseen** · An NP used unwitnessed (concealed and undiscovered, or seen by nobody) reveals nothing
- [x] **NP.card** · The reveal is said to each witnessing Faction, whispered

## Identity per Faction (Q12)

- [x] **ID.store** · Who knows a Unit's identity is the `identity` mark of each Faction's Dossier on it, in that Faction's Notebook (not a list on the actor, which every client reads: built 2026-11-12, see *Built* below)
- [x] **ID.card** · A card's True Name and real ability names open for a viewer whose Faction is on the list, through the #387 swap
- [x] **ID.token** · A token's nameplate and portrait read true for those viewers, public for the rest, from one token document
- [x] **ID.tooltip** · A hover nameplate reads the same as the token for each viewer
- [x] **ID.public** · A Unit known to every Faction reads as the old public flag did
- [x] **ID.owner** · Its owner and the GM always read the truth, as today
- [x] **ID.loss** · Losing identity (Jack's Erasure) takes the Faction off the list, and its viewers read the public face again

## The window (Q20) — every Clause here is (UI), pressed in nocturne and classic

- [x] **WI.open.controls** · An Intel window opens from the Token Controls (UI)
- [x] **WI.open.bar** · …and from the action bar (UI)
- [x] **WI.list** · It lists every non-owned Servant and Master its Faction holds a Dossier on, and no other Unit (UI)
- [x] **WI.list.none** · A Unit nobody of the Faction has ever witnessed has no Dossier and is not listed (UI)
- [x] **WI.head** · A Dossier shows its portrait and name as the Faction knows them, its Class, and the Intel banked on it (UI)
- [x] **WI.entry** · Each Stat, Region, Attributes, Alignment and Command Spells shows locked with its price, or open with its value (UI)
- [x] **WI.section** · Each Section shows "N known", its open Entries, and a buy button with its price (UI)
- [x] **WI.live** · An open Entry's current values follow the board while the window is open (Health falls, it falls) (UI)
- [x] **WI.afford** · A buy the Faction cannot afford is greyed with the reason *"Needs 4 Intel; 2 held"* (UI)
- [x] **WI.gm** · The GM opens the window for any Faction, chosen in it (UI)
- [x] **WI.skins** · Both skins draw it whole: no clipped text, no missing lock, no unstyled control (UI)
- [x] **DC.enemy** · Double-clicking a token you do not own opens its Dossier (UI)
- [x] **DC.own** · Double-clicking your own opens its full sheet, as today (UI)
- [x] **DC.none** · Double-clicking a Unit you hold no Dossier on says *"Nothing is known of this Unit"* (UI)
- [x] **DC.gm** · The GM toggles double-click between the full sheet and a Faction's Dossier (UI)

## Buying (Q7, Q20)

- [x] **BU.socket** · A player's buy runs on the active GM by socket
- [x] **BU.pay** · It spends the price from the Intel banked on that Unit, and never from another Unit's
- [x] **BU.short** · A buy short of Intel is refused out loud and spends nothing
- [x] **BU.race** · Two players of one Faction buying at once spend once each and never below 0
- [x] **BU.card** · A buy posts a card whispered to the Faction: who bought what, on whom, for how much
- [x] **BU.again** · An open Entry offers no buy

### Prices and what each shows

- [x] **PR.str** · STR, 4: its Rank and Base Attack (STR)
- [x] **PR.end** · END, 4: its Rank, and current and Max Health
- [x] **PR.agi** · AGI, 4: its Rank, and current and Max Agility
- [x] **PR.mag** · MAG, 4: its Rank and Base Attack (MAG)
- [x] **PR.luc** · LUC, 4: its Rank, and current and Max Luck
- [x] **PR.mov** · MOV, 4: its MOV
- [x] **PR.range** · Range, 4: its Range, panels and targets
- [x] **PR.region** · Region, 1
- [x] **PR.attr** · Attributes, 1: every Attribute at once
- [x] **PR.align** · Alignment, 1
- [x] **PR.cs** · A Master's Command Spells left, 4
- [x] **PR.free** · Class, Faction and Unit kind are free and shown from the first sighting
- [x] **PR.never** · The True Name, Sustainability and NP charges are never offered
- [x] **PR.master** · A Master's Dossier offers the Stats it has, and no Stat it lacks; his Health, Agility and Luck, which have no Rank, are each sold at 4 by their own Entry (ruled 2026-11-12)

## Sections (Q13, Q21–Q24)

- [x] **SE.five** · A Servant's abilities sit in five Sections: Spells, Active Skills, Passive Skills, Class Skills, NPs
- [x] **SE.items** · …and its Items in a sixth, Items (reading 28)
- [x] **SE.spell** · A Section of Spells is the `isSpell` family, active or passive
- [x] **SE.attackskill** · An Attack Skill is an Active Skill
- [x] **SE.price** · A draw costs 8 for Spells, Active Skills and Passive Skills, 6 for Class Skills, 32 for NPs, 4 for Items
- [x] **SE.draw** · A buy opens one ability of the Section the Faction does not know, drawn by the GM
- [x] **SE.uniform** · Uniformly among those left
- [x] **SE.known** · A Section shows "N known", never how many it holds
- [x] **SE.complete** · A buy that finds none left spends nothing and marks the Section Complete, *"No more Spells"*
- [x] **SE.empty** · A Unit with none in a Section: the first buy says so, free
- [x] **SE.taught** · An ability a sheet taught (Q18) is in its Section and out of the draw
- [x] **SE.show.tag** · An open ability shows its Public Tag, its Section and Active or Passive
- [x] **SE.show.shape** · …its range, targets or area, its cost and its Cooldown
- [x] **SE.show.effects** · …and one line per effect, in the authoring vocabulary's words
- [x] **SE.show.not** · …and never its name, its Rank or its sheet text
- [x] **SE.master** · A Master's abilities sit in the same five Sections
- [x] **SE.change.gain** · An ability the Unit gains (a form, an Obtained or Stolen Skill) joins its Section's draw
- [x] **SE.change.reopen** · …and a Complete mark on that Section drops, with no line said
- [x] **SE.change.lose** · An ability it loses keeps its open Entry, marked *"no longer held"*

## Cloaked lines (Q9, Q14)

- [x] **CL.roll** · A roll line reads *"Saber's ■■■, rolled ■■■ against ■■■"* to a viewer who holds nothing of it (UI)
- [x] **CL.name** · The ability's blank opens, as its Public Tag, on that ability's Entry (UI)
- [x] **CL.target** · The target opens on that ability's Entry, or on the Stat the roll reads (UI)
- [x] **CL.luck** · A Luck Check's target opens on LUC (UI)
- [x] **CL.evade** · An Evade's target opens on AGI (UI)
- [x] **CL.face** · The die face opens with its target, never alone (UI)
- [x] **CL.owner** · The Unit's owner reads every roll line in full (UI)
- [x] **CL.gm** · The GM reads every line in full (UI)
- [x] **CL.pool** · A Health line's before → after shows to a Faction that bought END, else *"Saber loses Health"* (UI)
- [x] **CL.pool.agi** · An Agility line's to one that bought AGI; a Luck line's to one that bought LUC (UI)
- [x] **CL.damage** · Damage stays visible to the Factions in the exchange, as now (UI)
- [x] **CL.stored** · The message stores the cloaked view; each client opens what its Faction holds when it draws it (UI)
- [x] **TB.hide** · An enemy's Health bar is hidden from a Faction that has not bought its END (UI)
- [x] **TB.show** · …and shows once it has (UI)
- [x] **TB.icons** · Status icons on tokens stay as they are

## Changing Faction, Alliances, the fallen (Q25, Q26)

- [x] **FC.join** · A Unit that joins a Faction (Conquest, a Charm's end, a summoning mid-War) is that Faction's own: everything open to it
- [x] **FC.left** · The Faction it left keeps every Entry open on it, and its identity
- [x] **FC.ally** · An Alliance shares no Entry, no Intel and no identity
- [x] **FA.list** · A Unit whose body has left the board moves to a **Fallen** list in the window (UI)
- [x] **FA.read** · Its Dossier stays readable (UI)
- [x] **FA.frozen** · No Intel is earned on it, and no buy is offered (UI)
- [x] **FA.lost** · Its banked Intel is gone, and the window shows none

## Servants

### Mordred, Secret of Pedigree — and Lancelot (Berserker), For Someone's Glory (Q15, Q23)

- [x] **MO.values** · While it holds, buying END, AGI or LUC opens the Rank only, never the pools' values
- [x] **MO.only** · Only her Parameters and Class Skills are buyable
- [x] **MO.refuse** · Every other Section is greyed *"Hidden by this Unit's information"*, and pressing it costs nothing (UI)
- [x] **MO.cloak** · No cloak opens on her Health, Agility or Luck, whatever was bought (UI)
- [x] **MO.bar** · Her Health bar stays hidden even after END is bought (UI)
- [x] **MO.gm** · The GM reads her values, as today
- [x] **MO.end** · Clarent Blood Arthur ends it; Lancelot's Arondight ends his
- [x] **MO.end.np** · …and its Witnesses get Q6's reveal, values included
- [x] **MO.back** · It returns 3◈ after it ended; what any Faction bought meanwhile stays open
- [x] **MO.off** · Her own switch-off ends it, with the same 3◈ before it returns
- [ ] **MO.lancelot** · Lancelot's is not restored by Mad Enhancement's return (his sheet)

### Hephaestion Mnēmosynē, Camouflage (Q16)

- [x] **HE.setup** · At War setup her player picks a false Class and false Ranks for her seven Stats
- [x] **HE.class** · Every other Faction reads the false Class on her token and cards
- [x] **HE.stat** · A bought Stat opens the false Rank and a value derived from it
- [x] **HE.np** · Witnessing her NP shows those Witnesses her true Class and Stats, over the false
- [x] **HE.gm** · The GM and her owner read the truth throughout

### Jack the Ripper, Information Erasure (Q17)

- [x] **JA.leave** · When Jack leaves the Detect of an enemy Unit, that Unit's Faction loses every Entry open on him
- [x] **JA.intel** · …and its Intel banked on him
- [x] **JA.id** · …and its knowledge of his identity
- [x] **JA.line** · …said to that Faction alone
- [x] **JA.other** · Another Faction, whose Units have not lost sight of him, keeps everything (reading 17: *"Other enemies still watching him keep theirs"*)
- [x] **JA.any** · Leaving any one enemy Unit's Detect is enough, for that Unit's Faction

### True Name Discernment (Rulers), Hassan (Fathomless), Metatron Jeanne (Q18)

- [x] **TN.first** · On first sight of an enemy Servant, the Ruler's Faction gets its whole Dossier, free, past every Section
- [x] **TN.truename** · …and its True Name
- [x] **TN.full** · …and every ability in full text, name included
- [x] **TN.hide** · A Servant that hides its information first passes a Luck Check (as today)
- [x] **TN.once** · Once a pair, a failed Check final (as today)
- [x] **HA.passive** · Against Hassan (Fathomless), TND's first sight does nothing
- [x] **HA.coin** · TND's active on him flips a coin; Heads opens his seven Stats to the user's Faction
- [x] **HA.luck** · …and Hassan's successful Luck Check closes them again
- [x] **MJ.none** · Against Metatron Jeanne, TND does nothing, first sight or active

### Appreciation of the Arts — Gilles (Caster), Mozart, Sen no Rikyū (Q18)

- [x] **AA.entry** · A learned NP opens its Entry for the learner's Faction, with its name and full text
- [x] **AA.faction** · …written to the Faction's Notebook, no longer the player's
- [x] **AA.section** · …and leaves the NP Section's draw

### First Director of FBI — Coercion and Classified (Q18)

- [x] **FB.coerce** · Coercion's DU's player picks one of its Skills other than Class Skills
- [x] **FB.coerce.open** · …which opens for the FBI's Faction in full text, name included
- [ ] **FB.mib** · A Man in Black's successful Coercion opens it for his Faction the same way
- [x] **FB.classified** · Classified, landed, opens the DU's whole Dossier and True Name to every Faction with a Unit within 2 of it
- [x] **FB.classified.self** · …not to the DU's own Faction, which owns it

## Live evidence

Pressed 2026-11-12 on the cloud world `fgt2026` (War `Gilgamesh Audit`, rounds 48–50), as Player1 (Faction 1) unless it says the GM, in Nocturne and in Classic. *Pressed* is a button or an engine call on the live board; *Observed* is read off a client; *Test* or *Read* names a Clause the board could not stage, with the test that pins it. Three stay open, unticked: MO.lancelot and FB.mib (no content in the repo) and ST.private (a platform limit). PR.master was a reading, ruled after the press and pressed again.

### Defects the press found, all fixed but the platform limit

- The Intel tool missing from Token Controls until a reset; a double-click on an enemy stopped by Foundry's `_canView`; the window brought forward before it existed.
- A learned ability's full text printing raw links and its unknown bearer's True Name; the Class line still false after the identity was known; a fallen Dossier showing its Intel.
- The War Rule off still printing Intel (WR.off.open).
- An ability's chance die never naming its Item (`rollLog.record` dropped `abilityRef`), so a learned ability's dice stayed cloaked (CL.name).
- A Section's Complete mark read as final, so a gained ability could never be drawn (SE.change.reopen); a lost ability's row printing its content id (SE.change.lose).
- The Turn report's and the heal line's Health amounts printed to every viewer (CL.pool).
- **Open, platform**: Foundry delivers every document and every whisper to every client, so another Faction's Notebook is readable from a console (ST.private), as every enemy actor already is.
- **Reading, ruled 2026-11-12**: a Master has no Parameters, so his Health, Agility and Luck were never sold and his bars stayed closed all War (PR.master). Ruled (b): each is sold at 4 by its own Entry, the pool shown with no Rank.

### By Clause

- **WR.rule**: Observed: the War Rules window lists "Information System", ticked on this War; `warRule("informationSystem")` reads it
- **WR.off.open**: Pressed (GM unticked it in the War Rules window; Player1 double-clicked the Faker Bench): the list holds every enemy Servant and Master with no Intel figure, the Dossier opens every Entry and Section, the Faker's true Class and figures, 0 locks, 0 buy buttons. **Defect found and fixed**: off, the list and the page still printed each Unit's Intel; the figure is now dropped
- **WR.off.earn**: Pressed: off, `noteAct` of an NP pays nothing (`{}`, Drake 0 → 0) and `buy` refuses `off`
- **WR.off.cloak**: Observed on Player1: off, no chat card carries ■■■ (0 of the last 30); Karl's END reads open; his bars follow Foundry's display mode (NONE)
- **WR.off.id**: Observed on Player1: off, Karl's nameplate reads his public "Ruler"
- **WR.switch**: Pressed: switched back on, Faction 1's Notebook still holds its 6 Dossiers (Achilles 22, Karl's LUC open); Player1's list reads "Achilles 22 Faker Bench 24 Hider Bench 56 Rider 0 Ruler 16" again, with locks
- **ST.faction**: Observed: 'Notebook: Faction 1' ownership {default: 0, Player1: 2, GM: 3}; 'Notebook: Faction 2' {default: 0, Player2: 2, GM: 3}
- **ST.page**: Observed (GM, Faction 1's Notebook flag): `dossiers` keyed by Unit, each `{intel, open, sections: {key: {known, complete}}, abilities, identity, fallen}`, and the Turn's `ledger`
- **ST.shared**: Observed: Player1's buys landed in Faction 1's Notebook, the one every Faction 1 player reads (Player1 is its one player in this War)
- **ST.private**: Pressed as Player1: the window lists only Faction 1's Dossiers; Faction 2's Notebook journal has permission NONE on his client (not in his sidebar); `intelBuy` for faction-2 refused ("Player1 does not play that Faction."), `intelAct` for Drake refused. **Not held, platform**: Foundry delivers every document to every client, so Faction 2's journal and its `intelState` flag are on Player1's client (`game.journal`), as is every whispered card (190 not for him) and every enemy actor; a console reads them
- **ST.gm**: Pressed as the GM: the window reads Faction 1's Notebook and, picked, Faction 2's
- **ST.write**: Observed: Player1's Move and Attack wrote Faction 2's Notebook through the War's GM (Player1 holds it at OBSERVER, Faction 2's not at all)
- **ST.mig.fold**: Observed live 2026-11-12 (cloud, fgt2026): on load, Faction 1's Notebook holds 8 pages and Faction 2's 5, folded from the per-player Notebooks Gilles's and Karl's learning had written
- **ST.mig.delete**: Observed: no Journal Entry flagged `notebook` (a player's) remains after the fold
- **ST.mig.once**: Observed: across nine reloads of both clients this session the fold found nothing more: two Notebook journals (Faction 1, Faction 2), no per-player Notebook, Faction 1's Dossier count unchanged; test intel-399-400 ST.mig.*
- **ST.mig.none**: Test only (intel-399-400 "a player in no Faction keeps theirs, named"): this world has no player outside a Faction
- **EA.kind.servant**: Pressed (engine, `witnessesOf` on the live board, round 50): Drake's Attack pays Faction 1 2
- **EA.kind.master**: Pressed (engine, `witnessesOf` on the live board, round 50): Faction 2's Master's Move, seen by Proto Gil and the Golem, pays Faction 1 1; Player1's Command Spell paid Faction 2 on his Master (EA.ab.cs)
- **EA.kind.summon**: Pressed (engine, `witnessesOf` on the live board, round 50): the Golem read as a Summon, Proto Gil involved: pays nobody; test intel-399-400 EA.kind.summon
- **EA.kind.platform**: Pressed (engine, `witnessesOf` on the live board, round 50): the Golem (Platform) attacking Karl pays nobody; Avicebron, its driver, on the same Attack pays Faction 2 4. A driven mount's Move is noted on its payer, the rider (`movement-hooks.mjs`, `noteActSafely` with `payer.id`)
- **EA.own**: Pressed: the same Move paid Faction 1 nothing (its Notebook's Dossiers stayed {})
- **EA.ally**: Pressed (FC.ally: Factions 1 and 2 allied on the live roster): Player1's figures and list unchanged; test intel-399-400 EA.ally: allied Factions are each still paid
- **EA.see.detect**: Pressed: the same Move, seen by Faction 2's Units in Detect, paid Faction 2
- **EA.see.out**: Pressed (engine, `witnessesOf` on the live board, round 50): U-Olga Marie at 4,4, seen by no Faction 1 Unit: her Move pays nobody
- **EA.see.involved**: Pressed (engine, `witnessesOf` on the live board, round 50): the same Olga attacking Proto Gil from across the board: Faction 1 4 (x2)
- **EA.see.master**: Pressed (engine, `witnessesOf` on the live board, round 50), staged: Olga one panel from Faction 1's Master, every other Faction 1 Unit left out: her Move pays Faction 1 1
- **EA.see.summon**: Pressed (engine, `witnessesOf` on the live board, round 50), Proto Gil left out: Faction 2's Master's Move, seen by the Golem alone, pays Faction 1 1
- **EA.see.concealed**: Pressed (engine, `witnessesOf` on the live board, round 50): Karl under Presence Concealment attacking the Coercer pays nobody, though the Coercer is involved; test intel-399-400
- **EA.see.moment**: Pressed (engine, `witnessesOf` on the live board, round 50): Olga's Move from 15,10 (in Proto Gil's sight) to 4,4 pays Faction 1 1; from 4,5 to 4,4 nothing. Live Move: EA.move
- **EA.see.mist**: Read and tested: `witnessesOf` asks `sees`, which answers the Mist through `seesThroughOwnField` (`ownerSeesInside`); test intel-399-400 EA.see.mist (a Unit in her field 29 panels off: 1; out of it: nothing). No Mist on the board to press
- **EA.move**: Pressed as Player1: Arturia moved (13,10) → (13,11) in sight of Achilles and Drake: Faction 2's Notebook {Arturia: intel 1}, ledger `Arturia|move: 1`, Turn 130
- **EA.attack**: Pressed as Player1: Arturia's Normal Attack on Achilles, Faction 2's Intel on Arturia 1 → 5
- **EA.evade**: Pressed (Player1's Shrouded attacked Kingprotea, the GM pressed Evade on its card): Faction 1 on Kingprotea 0 → 2 (Evade 1, ×2 for the Shrouded involved)
- **EA.block**: Pressed both ways: the GM pressed Block for Karl on the Coercer's Attack, Faction 1 on Karl 16 → 18; Player1 pressed Block for Proto Gil on Drake's Counter, Faction 2 on Proto Gil 12 → 14
- **EA.counter**: Pressed (GM, Drake's "Counter with a Normal Attack" on Proto Gil's Attack): Faction 1 on Drake 2 → 6, +4 (Counter 2, ×2 for Proto Gil involved); the Counter's own swing paid no Attack
- **EA.x2**: Pressed: the Attack paid 4, Achilles involved (2 × 2)
- **EA.max**: Pressed (engine, `witnessesOf` on the live board, round 50): Karl's Move, seen by the Coercer, the Shrouded and the Immune: Faction 1 1, never 3
- **EA.sum**: Pressed: Move + Attack in one Turn added, 1 + 4 = 5
- **EA.once.move**: Pressed (engine `noteAct`, live Notebooks): the Immune's second Move in Round 50 pays nothing
- **EA.once.attack**: Pressed (engine `noteAct`): the Immune's second Attack on Karl that Turn pays nothing
- **EA.repeat.react**: Pressed: Proto Gil's Block on the Counter paid in a Turn where Faction 2 already earned on him for that Turn's Attack (8 → 12 → 14); a second react by one Unit in one Turn pinned by test (intel-399-400 EA.*)
- **EA.both**: Pressed: on one Attack Drake's failed Evade and then his Counter paid both, Faction 1 on Drake 0 → 6 (2 + 4)
- **EA.fail**: Pressed: that Evade failed (`evadeRoll>fail`) and paid; Player1's Shrouded's Normal Attack paid Faction 2 1 → 5 on it
- **EA.auto**: Pressed (engine): Arturia's Instinct failed (79 against 70%) on Achilles's Attack: Faction 2's Intel on her stayed 5, no Evade paid
- **EA.example**: Pressed (engine `noteAct`, live Notebooks): Immune (A) moves, attacks Karl (B), Karl counters, Immune evades the Counter: Faction 2 on the Immune +7 (1 + 4 + 2), Faction 1 on Karl +4 (18 -> 22); a second Evade then pays +2 (1 -> 10 in all)
- **EA.ab.skill**: Pressed as Player1: Proto Gil's Golden Rule (on himself) paid Faction 2 14 -> 16, +2
- **EA.ab.np**: Pressed earlier (EA.ab.npattack, NP.who): an NP pays 8; live board `witnessesOf` of Karl's NP: Faction 1 8, 16 with the Immune involved
- **EA.ab.attackskill**: Read: an Attack Skill's declaration calls `fireAbilityUsed(attacker, ability, {involvedIds})` (attack.mjs) beside `fireAttackDeclared`'s Attack, the path the NP Attack pressed live (EA.ab.npattack) paid both on
- **EA.ab.npattack**: Pressed: Clarent (a damaging NP) paid Faction 1 Attack 2 × 2 + NP 8 × 2 = 20 (36 → 56)
- **EA.ab.passive**: Observed: the Round's start fired the Golem's passives (regains 200 Health, Growths) and Faction 2 holds no Dossier on it or Avicebron; `fireAbilityUsed` skips `system.passive`
- **EA.ab.cs**: Pressed as Player1: his Master's Command Spell (Kill Humans on the Immune) paid Faction 2 0 -> 2 on the Master, seen by Achilles
- **EA.ab.item**: Proved absent: `useItem` (`engine/items.mjs`) calls neither `fireAbilityUsed` nor `noteAct`
- **EA.ab.x2**: Pressed: FB.coerce (Coercion on an enemy) and the NP Attack paid x2 to the targeted Faction; live board: Karl's NP with the Immune involved 16
- **EA.card**: Observed: at Faction 1's Turn end, one card flagged `intelGains: faction-2`, whispered to Player2 and the GMs: *"Intel gathered this Turn — Saber: +5 Intel"*
- **EA.silent.other**: Observed: on Player1's client that card is `visible: false` and is not drawn in the chat log; Faction 1 gained nothing and got no card
- **NP.who**: Pressed as Player1: the Coercer's NP, witnessed by Faction 2, revealed it to Faction 2 alone: whispered to Player2 and the GMs *"Assassin used a Noble Phantasm before your Faction: it is Coercer Bench."*
- **NP.name**: Pressed: the Hider's nameplate and Dossier head read "Hider Bench" for Player1 after its NP
- **NP.portrait**: Observed on Player1: Achilles (identity known) draws his actor's own image (`mystery-man.svg`, this world's art) in place of his token's public `rider.webp`; Drake (unknown) keeps `rider.webp`
- **NP.abilities**: Observed on Player1: the cards hold Achilles's tag "SK-WRP6K" and his client swaps it for "Riding (A+)" (`truthOfTag`); Drake's "SK-YRTYC" stays a tag
- **NP.stats**: Pressed: Faction 2's Dossier on the Coercer opened str, end, agi, mag, luc, mov, range free
- **NP.region**: Pressed: …and region and attributes
- **NP.notabilities**: Pressed: …and no Section (`sections: {}`)
- **NP.unseen**: Pressed (EA.see.concealed, live board): an act under Presence Concealment pays nobody, so no reveal; test intel-399-400 NP.unseen
- **NP.card**: Pressed: the reveal's card, flagged `intelReveal: faction-2`, whispered to Faction 2 and the GMs
- **ID.store**: Observed: Faction 1's identity of Achilles is `identity: true` in its own Notebook's Dossier; the actor carries no list
- **ID.card**: Observed on Player1's client: `readsTruthOf(Achilles)` true, `readsTruthOf(Drake)` false: the #387 swap opens Achilles's names on cards for Player1
- **ID.token**: Observed on Player1's client: Achilles's token texture switched from the Rider class icon (the document's `rider.webp`) to his actor's own portrait, the document unchanged
- **ID.tooltip**: Observed on Player1's client: Achilles's nameplate reads "Achilles"; Drake's, whom Faction 1 does not know, "Rider"
- **ID.public**: Observed: with two Factions, Achilles known to the other reads to it as the public flag would (true nameplate, names on cards); no other Faction reads it differently
- **ID.owner**: Observed on Player1: his own Arturia's nameplate "Arturia" and her abilities by name; the GM reads every Unit's truth (CL.gm, HE.gm)
- **ID.loss**: Pressed (JA.leave, JA.id): Jack's Erasure deleted Faction 1's Dossier with its identity mark; his entry left Player1's list and his face is the public one again
- **WI.open.controls**: Pressed as Player1 (nocturne): the Token Controls' Intel tool (`data-tool=fgtIntel`) opens the window
- **WI.open.bar**: Pressed as Player1 (nocturne): the action bar's book button opened the Intel window ("Intel · Rider 22 · Choose a Unit.")
- **WI.list**: Pressed as Player1 (nocturne): the window lists only "Rider", the one Unit Faction 1 has witnessed
- **WI.list.none**: Pressed (nocturne): Drake, Karl, EMIYA and the other unwitnessed enemies are not listed
- **WI.head**: Pressed (nocturne): Rider's Dossier heads with his public portrait and name, "Servant · Rider", and "4 Intel"
- **WI.entry**: Pressed (nocturne): ten Entries, each "Locked" with "Buy (4)" or "Buy (1)"; END once bought reads "A · Health 880/1600"
- **WI.section**: Pressed (nocturne): six Sections, each "0 known" with "Learn one (8)", "(6)", "(32)" or "(4)"
- **WI.live**: Pressed (nocturne): the GM set Achilles's Health to 850 with the window open; its END row read "A · Health 850/1600" at once
- **WI.afford**: Pressed (nocturne): with 0 Intel the STR button is disabled, tooltip "Needs 4 Intel; 0 held"
- **WI.gm**: Pressed as the GM: the window offers Faction 1 and Faction 2; picking Faction 2 lists "Saber", Arturia as Faction 2 knows her
- **WI.skins**: Pressed in both skins as Player1: Classic (uiStyle classic, `fgt-classic.css` loaded): a double-click on Achilles opens his Dossier, the bar's book button opens the list, Drake's page draws its locks and `Buy (4)`/`Learn one (8)` rows, the chat card's Rolls reads "Rider's ■■■, rolled ■■■ against ■■■" (scratchpad classic-*.png); Nocturne pressed throughout before
- **DC.enemy**: Pressed as Player1 (nocturne): a real double-click on Achilles's token opened the Intel window on "Rider" (live fix: Foundry's `_canView` asked LIMITED and stopped the click first)
- **DC.own**: Pressed as Player1: a double-click on his own Arturia opened her sheet
- **DC.none**: Pressed as Player1: a double-click on Drake, whom Faction 1 never witnessed, said *"Nothing is known of this Unit."* and opened nothing
- **DC.gm**: Pressed as the GM: with "GM: double-click opens the Dossier" on, a double-click on Achilles opened the Intel window on "Rider"; off, his sheet
- **BU.socket**: Pressed as Player1: Buy END in the window went to the GM, which wrote Faction 1's Notebook (Player1 holds it at OBSERVER)
- **BU.pay**: Pressed as Player1: END cost 4, Faction 1's Intel on Achilles 4 → 0
- **BU.short**: Pressed as Player1: `buy` of Drake's END with 0 Intel returns `{ok:false, reason:"short", need:4, held:0}`, Intel 0 → 0; the window says it as "Not enough Intel: 4 needed, 0 held." and its button is disabled
- **BU.race**: Pressed (engine, four buys on the Faker at once for Faction 1, Intel 24): Active and Spells Complete free, Passive drew Camouflage for 8, the NP draw refused short (`need 32, held 16`): 24 -> 16, spent once, never below 0
- **BU.card**: Pressed as Player1: *"Player1 learned END of Rider for 4 Intel."*, whispered to Player1 and the GMs
- **BU.again**: Pressed as Player1: Drake's AGI, open, refuses `open` ("Already known."); the window offers no buy on an open Entry (Achilles page: 0 buy buttons)
- **PR.str**: Observed (Achilles' page, both skins): "STR B+ · Base Attack 135"; price `Buy (4)` on Drake's page
- **PR.end**: Pressed as Player1: END showed its Rank and current and Max Health, "A · Health 880/1600"
- **PR.agi**: Observed: "AGI A+ · Agility 21/21"; price 4
- **PR.mag**: Observed: "MAG C · Base Attack 150"; price 4
- **PR.luc**: Observed: "LUC D · Luck 9/9"; price 4
- **PR.mov**: Observed: "MOV 7"; price 4
- **PR.range**: Observed: "Range 2 panels, 1 target(s)"; price 4
- **PR.region**: Observed: "Region greece"; price `Buy (1)`
- **PR.attr**: Observed: "Attributes male, servant, earth, humanoid" (every Attribute at once); price 1
- **PR.align**: Observed: "Alignment lawful neutral"; price 1
- **PR.cs**: Pressed as Player1 (Faction 2's Master's Dossier, from the list: his token is outside Player1's Foundry vision): "Command Spells left · Buy (4)", bought: "Command Spells left 2", Intel 5 -> 1
- **PR.free**: Pressed (nocturne): Achilles's Class ("Rider") and kind ("Servant") show with nothing bought
- **PR.never**: Pressed (nocturne): no Entry offers his True Name, Sustainability or NP charges
- **PR.master**: Pressed as Player1 after the ruling: Faction 2's Master's page offers END, AGI, LUC, MOV, Range (4), Attributes (1) and Command Spells left (4), no STR, MAG, Region or Alignment; END bought for 4 (5 -> 1) reads "Health 357/442" and his END opens for the bars and lines; test intel-399-400 PR.master. Before the ruling it offered no END/AGI/LUC
- **SE.five**: Pressed (nocturne): the Dossier offers Spells, Active Skills, Passive Skills, Class Skills and Noble Phantasms
- **SE.items**: Pressed (nocturne): and Items, "Learn one (4)" (reading 28)
- **SE.spell**: Observed (live Items): Cú Chulainn's Rune Magic (active, `isSpell`) sits in Spells; `sectionOf` asks `isSpell` before `passive`, so a passive Spell does too (no passive Spell in this world)
- **SE.attackskill**: Observed (live Items): Anastasia's Ice Bucket Challenge for You (`isAttackSkill`, not a Spell) sits in Active Skills
- **SE.price**: Pressed: Class Skills cost 6 (60 → 54), Noble Phantasms 32 (54 → 22)
- **SE.draw**: Pressed as Player1 (nocturne): "Learn one (32)" in Noble Phantasms drew NP-V8MLZ, one of Achilles's five NPs, by the GM's die; Intel 54 → 22
- **SE.uniform**: Read: `buy` casts `1d(left)` over the abilities left before the queue and takes that one (`drawFrom`); test intel-399-400 SE.draw
- **SE.known**: Pressed (nocturne): Noble Phantasms read "1 known", never "1 of 5"
- **SE.complete**: Pressed as Player1: a second Class Skills draw found none left: free (Intel stayed 54), the Section reads "Complete", card *"Nothing more to learn in Class Skills of Rider."*
- **SE.empty**: Pressed as Player1: Achilles holds no Spell; the first Spells draw said *"Nothing more to learn in Spells of Rider."*, free (Intel stayed 22)
- **SE.taught**: Pressed (FB.coerce.open): Coercion taught Achilles's Runner Comet; it sits in his Active Skills as known ("SK-5D3MA Runner Comet"), and `drawFrom` skips every known one
- **SE.show.tag**: Pressed (nocturne): the drawn Class Skill shows "SK-JUBPB" and "Passive"; the NP "NP-V8MLZ" and "Passive"
- **SE.show.shape**: Observed: "SK-ZB4ZH Active · Cooldown 4◈-⅓◈ Applies Atk Up (Charisma) 25% 1◈ Aura", the Faker's NP "Active · Cooldown 2◈ · Targets enemy/neutral · square · Deals damage"
- **SE.show.effects**: Pressed (nocturne): SK-JUBPB's lines "Resistance · Application Chance · Application Chance · Aura", in the authoring vocabulary's words
- **SE.show.not**: Pressed (nocturne): neither drawn ability shows its name (Magic Resistance, its NP's), its Rank or its sheet text
- **SE.master**: Observed: the Master's page holds the same six Sections (Spells, Active, Passive, Class Skills, NPs, Items) at 8/8/8/6/32/4
- **SE.change.gain**: Pressed (GM gave Achilles Golden Rule, then Charisma): Player1's Active Skills, Complete, read "6 known · Learn one (8)"; his draw found the new one ("SK-AV9YB Active · Cooldown 4◈ Applies NP Regen 2%"), the next found Charisma ("SK-ZB4ZH")
- **SE.change.reopen**: Pressed: the Complete mark dropped with no card (the last two messages are his own buy cards). **Defect found and fixed**: the stored mark was final, so a gained ability could never be drawn; one reader `isSectionComplete` now asks the mark and every ability held (window and buy), test intel-399-400
- **SE.change.lose**: Pressed (GM removed Charisma and Golden Rule): both stay in the Section, "No longer held". **Defect found and fixed**: the row printed the content id (`achilles-heel`); a Faction now keeps each learned ability's Public Tag (and name once full), so Charisma reads "SK-ZB4ZH · No longer held"; one learned before the fix reads "An ability · No longer held"
- **CL.roll**: Pressed (GM for Faction 2): Drake's Normal Attack on Proto Gil; Player1's card reads *"Rider's ■■■, rolled ■■■ against ■■■"* with no breakdown lines
- **CL.name**: Observed: a roll on an ability Faction 1 learned (Achilles's) reads open; one on the Hider's undrawn ability, "Hider Bench's ■■■, rolled ■■■ against ■■■"
- **CL.target**: Observed: the same two: the target opens on the Stat the roll reads
- **CL.luck**: Observed: Karl's Luck Check "Ruler's Luck Check, rolled ■■■ against ■■■"; after Faction 1 bought his LUC, open
- **CL.evade**: Observed on Player1's client (Faction 1's live Notebook): an Evade by Drake, AGI bought, reads open; one by Karl, AGI not bought, "Ruler's Evade, rolled ■■■ against ■■■"
- **CL.face**: Pressed: the same line holds no die face while its target is closed
- **CL.owner**: Observed on Player1's client: his own Arturia's Instinct line in full ("Saber's Instinct: 79 against 70%…"), and `cloakRoll` on Proto Gil's Evade open
- **CL.gm**: Pressed: the GM's card reads the same roll in full, "Rider: Francis Drake on Archer"
- **CL.pool**: Pressed (a Turn report posted by the GM: Drake loses 30, Karl regains 40): Player1 reads "Rider loses ■■■ Health … Ruler regains ■■■ Health", the GM both figures; Player1 bought Karl's END and his line redrew "Ruler regains 40 Health", Drake's still ■■■. **Defect found and fixed**: the Turn report's and the applier's loses/regains lines printed their Health figure to every viewer (a heal said against the maximum showed how far below it a Unit stood); both are cloak marks now
- **CL.pool.agi**: Pressed (engine: a statDelta on Drake posted as a Turn report): Player1's chat log draws "Rider: Agility ■■■"; after Faction 1 bought his AGI, a fresh draw reads "1 → 0"
- **CL.damage**: Observed: the Attack cards keep their damage for the exchange, as before ("Damage is not shown to units outside this exchange")
- **CL.stored**: Observed: the stored card holds `Agility ⟦c|Drake|agi|1 → 0⟧`; the GM's client draws "1 → 0", Player1's "■■■" until his Faction holds AGI
- **TB.hide**: Pressed as Player1: Achilles's token set to show bars always (`displayBars: 50`); the GM's client draws his bar, Player1's does not (`bars.visible: false`)
- **TB.show**: Pressed as Player1: after buying his END, Player1's client draws Achilles's bar (`bars.visible: true`)
- **TB.icons**: Observed: status icons on tokens unchanged
- **FC.join**: Pressed (GM: the Hider Bench contracted to Faction 1's Master, its side faction-1): on Player1 the Hider leaves the Dossier list, its END and LUC open, its identity known, its cloaked figure `5 → 4` opens; restored to Faction 2 after
- **FC.left**: Observed: an old Jack stamped Faction 1 moved to Faction 2; Faction 1's Notebook gained his whole Dossier at once (identity, ten Entries, every Section Complete, eight abilities in full)
- **FC.ally**: Pressed (GM allied Faction 1 and 2 on the War's roster): Player1's list and figures unchanged (Drake END closed, AGI open as bought; identity unknown); Faction 2's Dossier on Arturia holds no open Entry; roster restored after
- **FA.list**: Pressed as Player1: an earlier War's Jack, defeated and his body cleared, sits under a "Fallen" heading in the window
- **FA.read**: Pressed: his Dossier reads ("STR C · Base Attack 100")
- **FA.frozen**: Pressed: no buy is offered, and a buy pressed is refused `fallen`
- **FA.lost**: Pressed: no Intel is shown on him (live fix: the page printed his banked 7)
- **MO.values**: Pressed as Player1: END bought (40 → 36) reads "B", the Rank alone
- **MO.only**: Pressed as Player1 (bench Hider, Faction 2, Secret active): MOV's buy greyed "Hidden by this Unit's information"; the NP Section the same
- **MO.refuse**: Pressed as Player1: the hidden NP Section pressed spent nothing (Intel stayed 36), its tooltip "Hidden by this Unit's information"
- **MO.cloak**: Observed on Player1's client: with END bought, `viewerOpens(Hider, end)` stays false while the Secret holds
- **MO.bar**: Pressed as Player1: the Hider's bars set to always show; with END bought Player1's client still draws none
- **MO.gm**: Observed: the GM's client opens every mark and reads the Hider's sheet with the Secret on (CL.gm, HE.gm)
- **MO.end**: Pressed (engine, GM for Faction 2): the Hider's Test Intel: Clarent switched Test Intel: Secret off (`active: false`)
- **MO.end.np**: Pressed: Clarent witnessed by Faction 1 revealed the Hider: Player1 reads END "B · Health 1250/1350", MOV 5, its bar, nameplate "Hider Bench"; the NP Section buyable
- **MO.back**: Pressed: the Secret's Cooldown read 9 ticks (3◈ at ◈ 3), counted from its deactivation
- **MO.off**: Pressed (engine, the Hider's own switch): on, it hides (buyable only Parameters and Class Skills, END/AGI/LUC ranks only); switched off by her, it hides nothing and its Cooldown reads 9 ticks (3◈)
- **MO.lancelot**: Not pressed: Lancelot's sheet (Mad Enhancement's return not restoring it) has no Secret of Pedigree content built in this repo; deferred
- **HE.setup**: Pressed (engine: `askCamouflage`, the War-start handler): six prompts to the Faker's owner (on the GM, Player2 offline): Class "Saber", Ranks E; stored `falseInformation` and `concealedIdentity: "Saber"`
- **HE.class**: Pressed as Player1: the Faker (truly a Pretender) reads "Saber" on its nameplate and Dossier ("Servant · Saber")
- **HE.stat**: Pressed as Player1: STR bought reads "E · Base Attack 50", END "E · Health 500/500"; its true Ranks are B
- **HE.np**: Pressed: its NP witnessed by Faction 1: Player1 reads "Faker Bench", "Servant · Pretender", STR "B · Base Attack 125" (live fix: the Class line read the public false Class)
- **HE.gm**: Observed: the GM reads its true Parameters (B) and its sheet throughout
- **JA.leave**: Pressed as Player1: Jack (built, Faction 2) stood 4 panels from the Coercer (Detect 4); the Coercer stepped one panel away and Jack left its Detect: Faction 1's Dossier on Jack was deleted
- **JA.intel**: Pressed: its 7 banked Intel went with it
- **JA.id**: Pressed: and its `identity` mark with the Dossier
- **JA.line**: Pressed: *"Your Faction's record of Assassin is erased."*, flagged `intelErased: faction-1`, whispered to Player1 and the GMs and drawn on Player1's client
- **JA.other**: Test only (intel-405 "Jack leaving Arturia's Detect erases Faction A's record of him; a Faction still seeing him keeps it"): the live War has two Factions, no third to keep watching
- **JA.any**: Pressed: Proto Gil (Faction 1, Detect 4) still saw Jack at 3 panels; leaving the Coercer's Detect was enough for Faction 1
- **TN.first**: Pressed (engine: a forced move into Karl's sight): Karl's first sight of the Coercer (built content, Faction 1): Faction 2's Dossier on it gained identity, all six Sections Complete and both abilities in full
- **TN.truename**: Pressed: whispered to Player2 and the GMs *"Ruler's True Name Discernment: Assassin is Coercer Bench. Its page is copied to your Notebook."*
- **TN.full**: Pressed: `abilities: {test-intel-coercion: {full: true}, test-intel-classified: {full: true}}`
- **TN.hide**: Unchanged path (#351, pressed then): `learnServantPage` asks `hidesInformation` and a Luck Check first; test intel-405 TN.*
- **TN.once**: Unchanged path (#351): `unitFirstSeen` fires once a pair, so a failed Check is final
- **HA.passive**: Pressed as Player1: the bench Shrouded walked into Karl's sight (`seenUnitIds` holds it): no die, no line, no Dossier opened
- **HA.coin**: Pressed (engine, GM for Faction 2): Karl's True Name Discernment (Active) on the Shrouded bench, three uses on live dice: Tails, nothing; Heads, its Luck Check held, nothing; Heads, failed, its seven Stats opened to Faction 2
- **HA.luck**: Pressed: *"Heads, but its Luck Check holds, and nothing is learned."* and, the Check failed, *"Heads, and its Stats are known."*
- **MJ.none**: Pressed as Player1: the bench Immune walked into Karl's sight: the same, nothing; and Karl's Active on it: its own effect landed, no coin, no line, no Entry opened
- **AA.entry**: Test only (intel-405 AA): a learned NP opens in full for the learner's Faction; Gilles is not on this board
- **AA.faction**: Read and tested: `tellWitness` writes `teachAbility(witness.faction…)` and `recordInNotebook` resolves to the Faction's Notebook (notebook.mjs; gilles-323 asserts no per-player pages)
- **AA.section**: Test only (intel-405 AA.section): the learned NP is known in the NP Section and out of its draw
- **FB.coerce**: Pressed as Player1 (bench Coercer, Faction 1): Coercion from the bar on Achilles; the DU's prompt (Player2 offline, on the GM) offered his Skills but Magic Resistance, his one Class Skill
- **FB.coerce.open**: Pressed: Runner Comet picked; Faction 1's Dossier on Achilles `abilities: {achilles-runner-comet: {full: true}}`; Player1's window lists "SK-5D3MA Runner Comet" and its text (live fix: links read as labels, and "Cannot be used if Achilles…" reads "this Unit")
- **FB.mib**: Not built: 1st FBI Director (Men in Black) has no content in the repo; the phase reads the caster's `factionId`, which a summoned Man in Black carries
- **FB.classified**: Pressed as Player1: Classified on Achilles, Faction 1 (Arturia and the Coercer within 2) learned his whole page: identity, 10 Entries, 6 Sections Complete, 13 abilities in full; whispered *"Classified: Rider's whole page is shared with your Faction."*
- **FB.classified.self**: Pressed: Faction 2's Notebook gained no Dossier on its own Achilles
- **CL.name.rider**: **Defect found and fixed**: an ability's chance die (`chanceRecords`) never named its Item, as `rollLog.record` dropped `abilityRef`; it now carries `handler.abilityId` (test: intel-399-400 CL.name). Drake's 15% Galleon die stays closed: its handler is his sheet's own passive, no Item a Section sells
