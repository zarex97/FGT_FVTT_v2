---
id: 2026-10-17-choice-option-overlapped-the-next
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Player1 clicks "Suspend Skill" in the Command Spell list and Suspend Skill is picked.
**Actual:** live, Round 5 tick 13 (window 1568x698): the next dialog read *"Reduce Cooldown — Which of Arjuna's
Skills?"*. Each option's box was 18px tall (`y=352-371`, `373-391`) while its name and detail line drew over the
option below, so the label "Suspend Skill" sat inside Reduce Cooldown's button. Closed unspent.
**Cause:** `styles/src/_apps.scss:359 @ uncommitted` — `.fgt-choice__toggle` took Foundry's one-line button height;
the dialog was built for options with a name only, and the Command Spell list gives each a detail.
**Fix:** `styles/src/_apps.scss:359 @ uncommitted` — the toggle (and `.fgt-copy__toggle`) is as tall as what it says:
`height: auto`; re-pressed, each option 28-46px, Suspend Skill picked.
