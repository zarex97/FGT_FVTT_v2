---
id: 2026-10-25-use-skill-switches-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A Riding Active sent to the GM as a `useSkill` request switches Riding on, or is refused, as the sheet's
switch (`FGTActorSheet.toggleMode`) does.
**Actual:** `FGTSocket.request("useSkill")` for Arturia (Lancer)'s `class-riding` returned `ok`, posted *"Riding A
Lancer Switched on."*, started its 3◈ Cooldown, and left `system.active` false and her MOV at 8. Through the sheet's
switch the same Riding went on, MOV 13.
**Cause:** `module/engine/skill-use.mjs#useSkill @ 82b7d864` takes an ability that toggles (`classifyAbility` `toggles`)
as a use: it bills and announces it and writes no `setMode`. The bar and the sheet route toggles to `toggleMode`
(`apps/hud/action-bar.mjs`), so no button reaches it; the socket operation does.
**Fix:** `module/engine/skill-use.mjs#useSkill @ uncommitted` writes the switch with the price (`I.setMode`) for an ability
that toggles and is off; `apps/actor-sheet/sheet.mjs#toggleMode` no longer writes a second patch after a priced entry.
`test/unit/lanceturia-336.test.mjs` uses Riding through `useSkill`: on, MOV 13; it fails without the write.
