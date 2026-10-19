---
id: 2026-10-18-war-rules-door-only-after-start
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** the GM opens a War's rules from the turn panel at any time, above all before the War starts, when the locked rules can still change.
**Actual:** on the new War before it started, no scale button was on screen: `document.querySelector('[data-action="warRules"]')` was null.
**Cause:** `templates/hud/action-bar.hbs:56 @ b6239686` — the turn panel renders only `{{#if turn.active}}`, so a button placed in it exists only once the War has started.
**Fix:** `templates/hud/action-bar.hbs:66 @ uncommitted` — the same button sits in the "No match running" slot for the GM. Pressed live: it opened the War rules window on the unstarted War.
