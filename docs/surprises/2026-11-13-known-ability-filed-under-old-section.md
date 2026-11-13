---
id: 2026-11-13-known-ability-filed-under-old-section
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Riding, Divinity and the rest becoming Class Skills changes only where they are sold.
**Actual:** Faction 1's Dossier on Achilles held them under Active Skills, so Class Skills would reopen and redraw abilities the Faction already knew.
**Cause:** `module/engine/intel.mjs:320 @ 6315e1e`: "known" was the asking Section's own mark, a stored word, while a Section reads its members from the Unit live.
**Fix:** `module/rules/intel.mjs:296 @ 0d3920a`: `knownAbilities` is one set over every mark; the window, the buy and the draw read it. Pressed live: Class Skills read Complete with all five.
