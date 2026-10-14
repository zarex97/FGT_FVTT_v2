---
id: 2026-10-14-editor-draft-was-the-live-model
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** The ability editor holds a working copy until Save; a field cleared in the form is removed on Save.
**Actual:** Clearing Atlas's `chance` and saving left `chance: 80` on the document, and before Save the live Item already read the edited value.
**Cause:** `module/apps/ability-editor/editor.mjs:145 @ 5770aca` — `deepClone(item.system)` returns a DataModel as the same object, so the draft was the live model.
**Fix:** `module/apps/ability-editor/editor.mjs:150 @ uncommitted` — the draft copies `item._source.system`; pressed again live: nothing changes before Save, and the cleared key is gone after.
