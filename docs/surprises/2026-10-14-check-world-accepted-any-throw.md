---
id: 2026-10-14-check-world-accepted-any-throw
found: tooling
kind: failure-dismissed-unread
status: fixed
reviewed: false
---
**Expected:** once the test world rolled Foundry's real dice, `npm run check:world` would still pass or fail on what it probes.
**Actual:** in plain Node the world could not load the dice: `Cannot find package '@common/utils'`. Two probes failed, and three "divergence" probes still printed `ok`, because each accepted any throw from the model as the documented one.
**Cause:** `tools/check-world.mjs:66 @ 26d95f4` — `expectFake: (v) => v.threw === true` never read why the model threw; and the `@common` alias and the Peggy grammar were only supplied to vitest (`tools/lib/foundry-client-plugin.mjs`).
**Fix:** `tools/check-world.mjs @ uncommitted` — the same two jobs as Node module hooks (`tools/lib/foundry-client-hooks.mjs`), and a divergence probe passes only when the model threw for its documented reason (a Silent Drop or a refusal). A new probe found the model's change lacked `_stats.modifiedTime`, which Foundry's carries; the model now stamps it.
