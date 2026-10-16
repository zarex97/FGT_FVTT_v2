---
id: 2026-10-16-war-built-on-a-stale-scene
found: tooling
kind: drive-kit
status: wontfix
reviewed: true
pattern: drive-kit
---
**Expected:** the setup wizard builds Hassan's war on a fresh 13x13 scene.
**Actual:** it reused "Scene", an old 21x21 scene still holding Jack's Mist and Achilles' duel field; a Hassan move was refused with "passes through a panel this Unit may not enter", and the deploy half came out diagonal.
**Cause:** `module/apps/setup-wizard.mjs:60 @ 907b345` — the saved `setupDraft` carried an earlier war's `sceneId`, and `engine/war-setup.mjs#ensureScene` builds into a named scene as it stands, its regions included.
**Fix:** none in code: the wizard offers a chosen scene on purpose. The two stale field Regions were deleted by hand; the half now reads the bases, not the scene (§46.32). Before building a war, check the War tab's scene.
