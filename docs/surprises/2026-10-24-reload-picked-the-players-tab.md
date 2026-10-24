---
id: 2026-10-24-reload-picked-the-players-tab
found: tooling
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** `node tools/fgt-reload.mjs` reloads the GM's tab, so the heal-line fix reaches the client that writes.
**Actual:** "World ready after 33s.", yet the GM page had no `EffectRegistry.nameOf` and the next press printed no
heal lines. Player1's tab had reloaded instead.
**Cause:** `tools/fgt-reload.mjs:16 @ 2f18de06` — its own pick of "the Foundry page", the first `/game` tab. With
two tabs, Player1's `127.0.0.1` tab was listed first. `tools/lib/cdp.mjs#foundryTarget` already preferred the GM's
`localhost` tab, for `fgt-eval`, after the same miss.
**Fix:** `tools/fgt-reload.mjs:14 @ 2f18de06` — uses `foundryTarget`. Checked live: a mark set on the GM page
was gone after the reload.
