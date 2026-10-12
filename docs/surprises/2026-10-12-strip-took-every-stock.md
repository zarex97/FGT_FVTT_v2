---
id: 2026-10-12-strip-took-every-stock
found: live press
kind: definition-id-for-instance
status: fixed
reviewed: false
---
**Expected:** Suppression strips one buff: one Proliferation stock of two.
**Actual:** both stocks went, and no card said anything.
**Cause:** `module/engine/attack.mjs:2233 @ 08ea4b1` removed by definition id, which takes every `magnitudeStacks` instance.
**Fix:** same function @ 98f05ca — removes the rolled document and posts the strip or the resist with its roll.
