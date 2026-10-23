---
id: 2026-10-23-extra-slot-erased-the-class
found: test
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a Beast seated in a War shows the Beast icon and name on her sheet, token and cards, as she does
off the War (#328, BC.icon; the user: "we are missing some details on the Beast Class ... like her icon").
**Actual:** read in the code before any press: war setup writes the slot into `classContainer`, and every Extra
slot is `extra`, so a seated Beast, Foreigner or Ruler is publicly "Extra", and `assets/classes/extra.webp` does
not exist. The icon and the name read the slot as if it were the Class.
**Cause:** `module/engine/war-setup.mjs:397 @ d24c003e`: `"system.classContainer": container.classContainer`, for a
core slot and an Extra one alike.
**Fix:** `module/rules/war-setup.mjs#seatedContainer @ 7f02a2c2`: an Extra slot takes the Servant's own Extra
Class; a core slot stays the slot. Both writes in `engine/war-setup.mjs` call it. `olga-328.test.mjs` "a Beast
seated in an Extra slot keeps her Class".
