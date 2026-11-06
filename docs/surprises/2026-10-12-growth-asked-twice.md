---
id: 2026-10-12-growth-asked-twice
found: live press
kind: unserialized-async-resize
status: fixed
reviewed: true
pattern: check-then-act-race
---
**Expected:** one "Kingprotea grows" dialog per growth.
**Actual:** two dialogs at her sixth stock; both answers would resize and shove.
**Cause:** `module/engine/token-footprint.mjs:89 @ 31aae3c` — a stock is an ActiveEffect and a Health write, two triggers in two microtasks; the second saw the same small token while the first waited on the owner.
**Fix:** `module/engine/token-footprint.mjs:155 @ 81c5732` — a resize in progress makes the next wait for it.
