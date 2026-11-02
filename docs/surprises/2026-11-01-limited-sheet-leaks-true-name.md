---
id: 2026-11-01-limited-sheet-leaks-true-name
found: live press
kind: two-readers-one-rule
status: open
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** A player who may open a concealed Servant's actor sheet but does not own it would see its public identity everywhere on that sheet. The new portrait card reads "Caster" for Medea and shows the class image.
**Actual:** On 2026-11-01, Player1 was given Limited on Medea for the press and then had it removed. The card read "Caster", but the window title read *"Servant: Medea"*. Four ability descriptions also printed the name, for example *"Restores Medea's Health by 30%"*, and so did the biography.
**Cause:** `module/apps/actor-sheet/sheet.mjs:32 @ 368de3ac`. The title is core's `DocumentSheetV2` title, built from `document.name`. Descriptions and biography are authored prose, enriched as written. Neither goes through `publicNameOf`. The leak predates #364: before it, the name input showed `document.name` too.
**Fix:** Open. No player in `fgt2026` holds Limited on an opponent's Servant, so nothing leaks in play today. The fix would have to override the sheet's `title` and decide what a Limited viewer may read of the prose, and that is a question for the user.
