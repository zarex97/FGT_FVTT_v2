---
id: 2026-10-29-fallen-platform-blamed-owner
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** A card says what ended a platform.

**Actual:** The CPA at 0 Health: "Carolus Patricius Auctoritas ends. Its owner was defeated."

**Cause:** `module/engine/io.mjs:343 @ 8db88035` — `destroyPlatformsOf` passed `ownerDefeat` for every platform it ends, the defeated one included.

**Fix:** `module/engine/io.mjs:345 @ 8db88035` — `destroyed` when the platform itself fell.
