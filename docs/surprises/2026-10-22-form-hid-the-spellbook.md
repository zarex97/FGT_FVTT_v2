---
id: 2026-10-22-form-hid-the-spellbook
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** transformed with Prelati's Spellbook whole and its clock at 0, the Gigantic Horror's Spells are open:
they keep reading the Spellbook itself (#323 reading 11i).
**Actual:** the GM's Summoning: Horrors refused `abilityAllows`, the detail naming the content ids, not the book.
**Cause:** `module/rules/items.mjs:664 @ d97795b9` — `gatedAbilities` reads `unit.abilities`, which the form's
generic `keptByForm` filter had emptied of the Spellbook; the special case 11i rules out had no door back, and no
test asked a Spell in form.
**Fix:** `module/rules/items.mjs:666 @ uncommitted` — the snapshot keeps `formDropped`, and a requirement that names an
ability reads it too; test "the Spells keep reading the Spellbook: open while it stands and rests, shut while it
cools (11i)".
