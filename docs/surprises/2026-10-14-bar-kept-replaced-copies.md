---
id: 2026-10-14-bar-kept-replaced-copies
found: live press
kind: stale-render
status: fixed
reviewed: false
---
**Expected:** After the GM's redo replaced both copies (cooldown 0), Player1's bar shows them ready.
**Actual:** The bar still read "Eye of the Mind (False) (copied) — Cooldown 3◈ (9 turns)" and greyed the Gate; the board unit read cooldown 0. Reselecting the token fixed it.
**Cause:** `module/apps/hud/action-bar.mjs:106 @ 4983091` — the bar re-rendered on `updateItem` and not on `createItem` or `deleteItem`.
**Fix:** `module/apps/hud/action-bar.mjs:108 @ uncommitted` — it refreshes on both.
