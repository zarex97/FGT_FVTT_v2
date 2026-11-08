---
id: 2026-11-08-survey-comment-said-sheet-lacked-line
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** Triaging #310, I told the user that the repo's copy of Katō Danzō's sheet lacks Synthetic Limbs' 150 Injury threshold. The survey comment on #310 (2026-10-21) said so. I proposed a `needs-info` ticket waiting on the user to update the sheet, and the user agreed.
**Actual:** The repo sheet prints it: `char_orig_sheets/by-class/Assassin/Katō Danzō.md:39` *"(Passive) Minimum damage required for Danzō to perform an Injury Roll is 150\."* Her built file misses it, so this is a build defect with nothing to wait on.
**Cause:** `char_orig_sheets/by-class/Assassin/Katō Danzō.md:39 @ 7058ae2`: I carried an issue comment's claim into a grill pick without opening the sheet it named. I opened it only when writing the ticket.
**Fix:** `docs/surprises/2026-11-08-survey-comment-said-sheet-lacked-line.md:9 @ 7058ae2`: the claim was taken back to the user before the ticket went out. #397 is filed as `bug` and `ready-for-agent`, and #310's triage comment corrects the survey comment.
