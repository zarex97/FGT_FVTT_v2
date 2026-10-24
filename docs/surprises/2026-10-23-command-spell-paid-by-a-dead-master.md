---
id: 2026-10-23-command-spell-paid-by-a-dead-master
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Legend of Dracula: *"his Master has to use a Command Spell ... Vlad will immediately kill his Master after
this NP is activated"*: the spell paid, then the kill.
**Actual:** R50 the cards ran "Master of Saber of Faction 1 is defeated by Lancer." before "Master of Saber of Faction 1
spends 1 Command Spell(s) to power Lancer's Noble Phantasm." A dead Master paid for it.
**Cause:** `module/engine/skill-use.mjs:204 @ 630495df` — `useSkill` runs every phase, then charges the costs; nothing
let a phase wait for the activation it follows.
**Fix:** `module/engine/skill-use.mjs:250 @ uncommitted` — a phase with `afterCosts: true` runs once the costs are paid;
Legend of Dracula's `defeat` carries it.
