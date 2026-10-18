---
id: 2026-10-17-forest-escape-and-death-said-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A Unit's escape from the Nameless Forest, and its death die, each show the table the roll and the outcome; the code's own comment says the death roll is logged so that *"a player who watches a 1 come up and survives it has been told something true"*.
**Actual:** Heracles escaped: Tokens 1 → 0, the Resistance landed, and no card at all. The death roll's `namelessForestDeathRoll` entry and the escape's `namelessForestEscape` entry had no reader anywhere in `module/`.
**Cause:** `module/engine/nameless-forest.mjs#attemptForestEscape @ eebbb988` and `module/engine/scheduler.mjs` `NamelessForestDeathRoll @ eebbb988` wrote log entries only; `io.log` posts a card for `revive` alone.
**Fix:** `module/engine/nameless-forest.mjs#postEscape`, `#postDeathRoll @ uncommitted`, posted from `io.log`. Re-pressed: *"escapes the Nameless Forest: rolled 16 (Home Base −3) = 13 vs Luck 14"*, *"rolls the Nameless Forest's death die: 1 against 3 Tokens, but cannot disappear within its Home Base."*
