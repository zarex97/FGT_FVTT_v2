---
id: 2026-10-16-preview-missed-the-instance-block
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Strike Air under Knight of Utopia previews at 300, "not affected by any damage modifying effects on her" (#230 SA.flat), as it lands.
**Actual:** the targeting tooltip read "Scáthach 375"; the card dealt 300, stage 4 "atkUpCharismaUnit (bypassed by this attack) 0".
**Cause:** `module/engine/attack.mjs:6348 @ b4464ed` — `previewContext` described the declaration alone; each Process's attack is the declaration with its damage instance spread over it (`declareProcesses`), and `bypassModifiers` (with `modifierSources`, `totalModifiers`) lives on the instance. The sweep that holds preview to resolution (`attack-description.test.mjs`) modelled the resolution without the instance too, so it agreed with the preview for the wrong reason.
**Fix:** `module/engine/attack.mjs#instancesAgainst @ 9d0ab57` — one reader of a defender's instances, used by `declareProcesses` and `previewContext`; the sweep's resolution path spreads the first instance as a Process does (Dohatsu Tenshou's first instance now reads lightning 0.5 on both sides). Arena test previews Strike Air at 300.
