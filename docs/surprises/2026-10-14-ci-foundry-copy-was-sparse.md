---
id: 2026-10-14-ci-foundry-copy-was-sparse
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** the Wave A branch, green on the PC (6716 tests), is green in CI.
**Actual:** CI failed 105 test files: `Failed to load url .foundry/app/client/dice/_module.mjs ... Does the file exist?`
**Cause:** `.github/workflows/ci.yml:23 @ 4f86903` — CI checks out the private Foundry copy sparsely, `app/common` and one perception folder only. The test world now imports `app/client/dice` and `app/client/helpers`, which the PC's full clone has and CI's never did. I tested against the PC's copy and did not read the workflow.
**Fix:** `.github/workflows/ci.yml @ c88e11a` and `release.yml` — both sparse checkouts add the two folders.
