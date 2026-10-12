---
id: 2026-10-12-weak-point-asked-on-gm
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Player1's Serenity attacks; when the Attack lands on Achilles, Player1 is asked whether to aim for his Heel.
**Actual:** her Attack on Medea's Master was redirected onto Achilles by the guard ("Achilles stands next to Master of Caster of Faction 2: the Attack is changed to Achilles."), and "Aim for Achilles's weak point?" opened on the GM's page. Player1 saw nothing.
**Cause:** `module/engine/weak-point.mjs:96 @ 50a76fe` — `offerWeakPoint` called `ChoiceDialog.pick` on the client resolving the Process instead of routing through `askOwner`, which every other attacker-side question uses.
**Fix:** `module/engine/weak-point.mjs:102 @ uncommitted` — `chooseFor(attackerDoc, …)`, the attacker's owner.
