---
id: 2026-10-21-danzo-built-from-an-older-sheet
found: survey
kind: source-outside-the-repo
status: open
reviewed: false
---
**Expected:** Katō Danzō is built and audited (#249). Her Assassin survey Clauses should match what the packs run.

**Actual:** The Drive text of Synthetic Limbs (Doll) says *"Minimum damage required for Danzō to perform an Injury
Roll is 150."* `packs/_source/abilities/danzo-synthetic-limbs.yml` has no such line. It is built from the repo
sheet, which lacks it. Kashin Koji's sheet carries the same line.

**Cause:** the build read `char_orig_sheets/`, a snapshot. The Drive sheet changed after it, or the snapshot was
cut short. `2026-10-21-repo-sheets-differ-from-drive` found the same gap for unbuilt sheets. This is the first
built Servant it reaches.

**Fix:** none yet. The threshold has no engine field (#310). When #310 lands, Danzō's Synthetic Limbs gains it. A
diff of every built Servant's repo sheet against its Drive export would find the others.
