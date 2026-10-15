---
id: 2026-10-15-linked-death-one-door-only
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Castor runs out of Sustainability at the Turn's end and is defeated. Pollux is defeated with him, "regardless of remaining Health".
**Actual:** Castor defeated, cause `sustainabilityExhausted`. Pollux stood on at 1383 Health, not defeated.
**Cause:** `module/engine/scheduler.mjs#linkedDeathIntents @ 960496f` was emitted by the damage path's defeat chain alone. `checkRemovals`, Instakill and Erase (`effect-applier.mjs`), Command Spells, fields, the Nameless Forest and petrification each wrote `defeat` without it.
**Fix:** `module/engine/io.mjs#defeat @ uncommitted` — the binding sits at the one door every defeat passes, and the door counts a Unit towards the Grail once (the code review found the damage path's own binding counted the twin twice); `dioscuri-209-live.test.mjs` defeats Castor by Sustainability, Instakill and Erase, and Pollux falls each time.
