# War Rules — the Clause list

**Draft, 2026-10-18.** Every setting that shapes a War moves off the world and onto the War, so two Wars on
two scenes, played at the same time, never share a rule. Grilled with the user on 2026-10-18 (rulings below).
One Clause per behaviour that can fail on its own; each ends `Pressed` live as Player1 or the GM, or
`Observed` with a differential.

## Rulings

1. **Wars run at the same time.** Two tables, two scenes, the same session. A press finds its War from the
   card or the Unit it acts on, never from what the GM's own screen is showing.
2. **Twenty-three settings move** (below). `devMode`, `schemaVersion`, `setupDraft` and the four per-player
   settings stay. `activeSkillBudget` stays too: it is inert today (`settings-are-read.test.mjs` lists it),
   and moving a switch nothing reads gives the War a field nothing reads.
3. **Each War has its own Faction roster.** Today's roster is copied onto every War that exists.
4. **The world settings become defaults for a new War.** Only the wizard, and a press with no War at all,
   read them; a test fails any other reader.
5. **A "War rules" window**, opened from the turn panel, edits one War mid-war. A rule that invalidates
   stored state (the ◈, the Round gates, the ruleset…) is locked once that War has started.
6. **A migration** copies every War Rule a War lacks from the world's current value, onto every War,
   after the mandatory backup. It never overwrites a value a War already holds.
7. **Glossary:** **War** and **War Rules** (`CONTEXT.md`). ◈ is a War Rule.
8. **A press finds its War** from the card's War id, or the Unit's (written when the War is built), or the
   scene its token stands on.
9. **A War is bound to its board scene.** A player sees the War of the scene they are looking at.
10. **A Unit fights in one War.**
11. **A second War may be built while another runs,** on a scene that has no started War.
12. **The GM's turn panel shows the War of the scene the GM is viewing.**

## The War Rules

`turnsPerRound` · `npGateRound` · `npGateRoundAssassin` · `noAttackRound` · `commandSpellTimeout` ·
`interruptTimeout` · `reactionTimeout` · `conquestSparesServants` · `grandOrder` · `boardSize` ·
`difficulty` · `warType` · `ruleset` · `drawPolicy` · `masterProtection` · `ridingAttackLines` ·
`rangedMinimumRange` · `discoverAttemptsPerFaction` · `region` · `grailThreshold` · `closedInfo` ·
`counterChain` · `masterMode` — and the Faction roster.

## Clauses

Each `WR.<key>` Clause reads: *War A's value of this rule governs War A's presses, and War B, set the other
way, is untouched*. Pressed with two Wars on two scenes.

| Id | Clause |
|---|---|
| WR.turnsPerRound | A duration in ◈ resolves against its own War's Turns per Round. |
| WR.npGateRound | A Noble Phantasm unlocks at its own War's Round gate. |
| WR.npGateRoundAssassin | An Assassin's NP unlocks at its own War's Assassin gate. |
| WR.noAttackRound | The no-Attack Round is its own War's. |
| WR.commandSpellTimeout | A Command Spell window waits its own War's seconds. |
| WR.interruptTimeout | An interrupt waits its own War's seconds. |
| WR.reactionTimeout | A reaction prompt waits its own War's seconds. |
| WR.conquestSparesServants | A Conquest spares, or not, by its own War's rule. |
| WR.grandOrder | The multi-Servant tax and ally Hatred follow their own War's Grand Order switch. |
| WR.boardSize | The wizard builds the board at the War's size. |
| WR.difficulty | The board reads its own War's difficulty. |
| WR.warType | The War's type is its own. |
| WR.ruleset | Summons and plans follow their own War's ruleset. |
| WR.drawPolicy | The wizard draws by the War's policy. |
| WR.masterProtection | Master Protection applies, or not, by its own War's switch. |
| WR.ridingAttackLines | A Riding Attack runs along its own War's lines. |
| WR.rangedMinimumRange | A platform's "ranged Attack" reads its own War's minimum. |
| WR.discoverAttemptsPerFaction | Discover attempts count against its own War's limit. |
| WR.region | A Servant's Region grant reads its own War's Region. |
| WR.grailThreshold | The Grail materialises at its own War's threshold. |
| WR.closedInfo | A card is redacted, or not, by its own War's switch. |
| WR.counterChain | An area Counter chains by its own War's rule. |
| WR.masterMode | Master Essences, coin flip or rankless, per War. |
| WR.factions | A War's Faction roster is its own; the other War's players are not on it. |
| WR.world | Changing a world default changes no running War. |
| WR.seed | The wizard opens on the world defaults, and its Confirm tab names every War Rule it will write. |
| WR.commit | Building a War writes every War Rule and its roster onto it, `turnsPerRound` included. |
| WR.scene | A built War is bound to its board scene; each scene's viewers see its own War in the tracker and turn panel. |
| WR.second | A second War can be built while the first runs, on another scene; a scene with a started War refuses. |
| WR.unit | A Unit built into a War carries that War's id. |
| WR.press | A Player1 press in War A, executed by a GM viewing War B, resolves under War A's rules. |
| WR.window | The "War rules" window edits the viewed War only; the other War is untouched. |
| WR.lock | A locked rule refuses in the window once its War has started, with a message. |
| WR.migrate | A world from before this change loads with every War holding today's world values, after a backup; a value a War held is kept. |
| WZ.scroll.<tab> | Each wizard tab (War, Factions, Containers, Servants, Board, Confirm) scrolls when its content outgrows the window. |

## Status

**Wave 1 (scroll) done, 2026-10-18.** `WZ.scroll.*` Pressed live as the GM: at a 380px window Containers, Servants and Confirm overflow and scroll to their last row; War, Factions and Board fit and show no scrollbar. Every `WR.*` Clause is `Untouched`: wave 2, with ruling 13 (Q14 (B)): each War is run by its own GM client viewing its scene; a press for a War no GM is viewing is refused with a message.

**Wave 2 built and pressed, 2026-10-18.** Live on `fgt2026` with two Wars at once: War A, "Great Holy Grail
War" (`2SYtb3A7ObpJ92mI`, Normal, 3 Turns a Round), and War B, built by the wizard on its own scene
(`Hx56fhkhIr8yvrh3`, Holy Grail War, 8 Turns a Round), run by two GM clients (Gamemaster on A, a password-less
test user "Gamemaster 2" on B) with Player2 pressing in B.

| Clause | Status | Evidence |
|---|---|---|
| WR.migrate | Pressed | Schema 2 → 3 on load after the backup; War A bound to its scene; its world-only rules copied (timeouts 15, Master mode coin flip, Riding lines orthogonal); `ruleset: normal` kept. Failed once first (Surprise `migration-scene-link-refused-in-replace`). |
| WR.seed | Pressed | Wizard opened on the world's defaults; Confirm tab listed all 23 War Rules by label. |
| WR.commit | Pressed | War B holds `turnsPerRound 8`, `commandSpellTimeout 30`, `closedInfo false`, `warType holyGrailWar`, its own roster. |
| WR.unit | Pressed | All six War B Units, partners included, carry `warId`. |
| WR.scene | Pressed | Each GM's tracker and turn panel show its scene's War (after Surprise `tracker-inferred-the-wrong-war`). |
| WR.second | Pressed | War B built while A exists; the activated scene did not change, so A's players stayed put. |
| WR.factions | Pressed | B's faction-1 owned by Player2 only; A's faction-1 Units still owned by Player1. |
| WR.window | Pressed | Scale button → window "The War on The Field"; `commandSpellTimeout` 20 on B, A still 15, world 15. |
| WR.lock | Pressed | B started: ◈ row disabled with its reason; `setWarRules` refused `turnsPerRound`, applied `closedInfo`. |
| WR.world | Pressed | Defaults window `reactionTimeout` 90: A and B kept 15. Restored. |
| WR.press | Pressed | Player2's Move in B booked by Gamemaster 2 only; Player2's Skill in B executed by Gamemaster 2 (card author); with no GM on B's scene, refused: "No Game Master is looking at this War's scene…". |
| WR.turnsPerRound | Pressed | The Skill's 4◈ cooldown read 32 Turns on B (8 a Round); A's board reads 3. |
| WR.commandSpellTimeout | Observed | `warRule` 15 on Gamemaster's client (A), 20 on Gamemaster 2's (B). |
| Other `WR.<key>` | Unit + guard | Every reader asks `warRule(key)` (`war-rules-readers.test.mjs` proves no other reader); `war-rules.test.mjs` presses the two-War differential for the ◈, the Command Spell wait and closed information. Not pressed one by one live. |


