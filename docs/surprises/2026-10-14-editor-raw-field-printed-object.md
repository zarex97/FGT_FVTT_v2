---
id: 2026-10-14-editor-raw-field-printed-object
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** The effect form shows an entry's `chanceModifiers` as editable data.
**Actual:** The field read "[object Object],[object Object]", and that text is what the next change would have saved; the old `effects` list was drawn the same way.
**Cause:** `module/rules/authoring/fields.mjs:126 @ 5770aca` — `displayFieldValue` turned only token and predicate lists into text; the partial has no `objectList` branch at all.
**Fix:** `module/rules/authoring/fields.mjs:129 @ 2023766` — a `raw` value shows as JSON and saves back parsed; `effects` is drawn as rows.
