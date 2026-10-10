---
id: 2026-10-10-zero-sail-never-switched-off
found: retraction
kind: event-with-no-listener
status: fixed
reviewed: false
---
**Expected:** surfacing ends Zero Sail and starts its *"5◈ Turns after Nemo resurfaces"* cooldown
(`countFrom: deactivation`).

**Actual:** `resurface` tore the platform down and raised `fgtDimensionSurfaced`, which nothing heard. The
mode stayed on and the cooldown never began.

**Cause:** `module/engine/dimension.mjs:364 @ 08ea4b1` — the end of the mode was left to a hook with no
listener, the same shape as the exit offer.

**Fix:** `module/engine/dimension.mjs:653 @ d162f50` — `endZeroSail` sets the mode off and the 5◈
cooldown in the resurface itself.
