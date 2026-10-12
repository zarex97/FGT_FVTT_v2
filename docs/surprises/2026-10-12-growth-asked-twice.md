---
id: 2026-10-12-growth-asked-twice
found: live press
kind: unserialized-async-resize
status: fixed
reviewed: false
---
**Expected:** one "Kingprotea grows" dialog per growth.
**Actual:** two dialogs at her sixth stock; both answers would resize and shove.
**Cause:** `module/engine/token-footprint.mjs:89 @ 23b5621` — a stock is an ActiveEffect and a Health write, two triggers in two microtasks; the second saw the same small token while the first waited on the owner.
**Fix:** `module/engine/token-footprint.mjs:155 @ 98f05ca` — a resize in progress makes the next wait for it.
