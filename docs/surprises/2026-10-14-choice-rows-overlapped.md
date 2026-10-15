---
id: 2026-10-14-choice-rows-overlapped
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** the Command Spell window lists each command with its line under it, and a click on "Suspend Skill" picks Suspend Skill.
**Actual:** the rows overlapped: "Reduce Cooldown"'s line ran under "Suspend Skill", and the click opened "Reduce Cooldown — Which of Karna's Skills?". The Start-of-Combat-Phase window showed its one option as a sliver with a scrollbar.
**Cause:** `styles/fgt.css:2140 @ 7333e08` — `.fgt-choice__toggle` is a `<button>`, and Foundry gives every button one line's height; an option with a detail is several lines, so it spilled over the next.
**Fix:** `styles/fgt.css:2140 @ 95b91ea` — the choice and copy toggles take `height: auto` and wrap; seen live after a reload, rows apart.
