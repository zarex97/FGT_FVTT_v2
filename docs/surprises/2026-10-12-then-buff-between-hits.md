---
id: 2026-10-12-then-buff-between-hits
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** *Then, apply Atk Up* after the NP: none of its own hits carries it.
**Actual:** Medea's card, the second hit of a 4x4 Airavata, read "Atk Up atkUp +20%".
**Cause:** `module/engine/attack.mjs:4936 @ 08ea4b1` — the first Process paid the after-damage self rider while its siblings were still computing.
**Fix:** `module/engine/attack.mjs:1947 @ 98f05ca` — the payer waits until every sibling is past its damage.
