---
id: 2026-10-29-fallen-platform-blamed-owner
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A card says what ended a platform.

**Actual:** The CPA at 0 Health: "Carolus Patricius Auctoritas ends. Its owner was defeated."

**Cause:** `module/engine/io.mjs:343 @ uncommitted` — `destroyPlatformsOf` passed `ownerDefeat` for every platform it ends, the defeated one included.

**Fix:** `module/engine/io.mjs:345 @ uncommitted` — `destroyed` when the platform itself fell.
