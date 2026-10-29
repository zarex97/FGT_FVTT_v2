---
id: 2026-10-29-payment-fells-owner-carolus-stays
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Reading 20: at exactly 200 he may pay, falls to 0 and is defeated, and the Carolus ends at the end of the Turn.

**Actual:** Karl paid, fell, and the Carolus stood into the next Turn.

**Cause:** `module/engine/platforms.mjs:926 @ 8db88035` — `runLifespans` asked the owner's defeat before the extension, and the extension's payment was what felled him.

**Fix:** `module/engine/platforms.mjs:950 @ 8db88035` — asked again after a paid extension; the Carolus ends that Turn.
