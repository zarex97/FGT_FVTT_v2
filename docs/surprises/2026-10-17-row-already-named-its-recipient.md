---
id: 2026-10-17-row-already-named-its-recipient
found: test
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** a stat change's row on a skill card names the twin it moved by its public name, as every card should
(#235).
**Actual:** `dioscuri-209-live` failed: the row read *"Pollux: Saber: Agility 10 → 11"*, two prefixes.
**Cause:** `module/engine/skill-use.mjs:684 @ f1b6e36e` — the sweep changed the row's own prefix without reading
`postCard`, which prefixes every recipient's row with the real name and shows that row only to the recipient's
controllers: a per-viewer row, not a public card.
**Fix:** `module/engine/skill-use.mjs:684 @ f1b6e36e` — the row's prefix reads the real name again, marked
`fgt-name-ok` with that reason.
