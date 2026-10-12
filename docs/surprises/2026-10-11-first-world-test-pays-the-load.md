---
id: 2026-10-11-first-world-test-pays-the-load
found: test
kind: first-test-pays-setup
status: fixed
reviewed: false
---
**Expected:** `test/unit/io-defeat.test.mjs` and `battle-continuation-watermark.test.mjs` pass, as they did in the last full run.
**Actual:** each failed its first test with "Test timed out in 5000ms", then failed every later test with "Cannot read properties of undefined (reading 'documents')". The same happened on a clean `75ae578` worktree, alone or in the full suite. Six other files using `withWorld` without a `beforeAll` failed the same way when run alone.
**Cause:** `test/helpers/world.mjs:507 @ 75ae578` — `withWorld` loads Foundry's data layer and the first test imports the engine. Together they take longer than 5 s, and nothing loaded them beforehand. A file only passed when an earlier file in the same worker had paid for the load.
**Fix:** `test/helpers/world.mjs:91 @ uncommitted` exports `prepareWorld`, which loads Foundry and imports `engine/io.mjs`. The seven files run `beforeAll(prepareWorld, 60_000)`.
