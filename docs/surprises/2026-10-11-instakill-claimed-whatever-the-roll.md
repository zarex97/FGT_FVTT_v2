---
id: 2026-10-11-instakill-claimed-whatever-the-roll
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Fragarach's card tells the players whether the Instakill on the cancelled Noble Phantasm's user landed. Reading 14 rules it is rolled against the user's resistances.
**Actual:** the card read "Medusa's Noble Phantasm was their strongest — Instakill is inflicted on them." The roll was not shown, and the same words would have printed for a resisted Instakill.
**Cause:** `module/engine/attack.mjs:6981 @ 75ae578` — `resolveNPCancellation` set the outcome line before reading `applied.outcome`. The resisted branch had no words at all.
**Fix:** `module/engine/attack.mjs @ 57c23ae` reads the chance step's detail and picks `FGT.CancelNP.Instakill` or `FGT.CancelNP.InstakillResisted`, each with the roll.
