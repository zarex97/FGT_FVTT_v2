---
id: 2026-10-19-copy-offer-read-another-board
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** a War committed with Scáthach in it opens the GM's Wisdom of Dún Scáith offer listing the other Servants' Skills, as `copyPick.poolIds` already did (Heracles, Arturia, Karna).
**Actual:** the GM read *"Nothing on the field can be copied: every Skill is a Class Skill, Rank EX, passive, or marked uncopyable."* Reopened later with the War's scene on the canvas, it listed Indomitable, Bravery, Eye of the Mind (False), Discernment of the Poor and End of Charity.
**Cause:** `module/engine/copy.mjs:37 @ d64553fc` — the pool is stored at the War's build, but `offerCopies` lists `copyCandidates(currentBoard(), …)`, the board of whatever scene the GM's canvas holds. The GM was on another scene when the War was committed, the copier was snapshotted from its document, and an empty field read as "nothing to copy". Nothing redrew the dialog once the War's scene was drawn.
**Fix:** `module/engine/copy.mjs:44 @ uncommitted` — a copier not on the canvas's board gets no list (`null`), and the dialog says to open the War's scene (`FGT.Copy.OffBoard`); `canvasReady` redraws an open offer. Pressed: on *Achilles Audit — Neutral* the offer read the new line; back on *Heracles Audit* it listed Indomitable, Bravery and Eye of the Mind (False). `test/unit/heracles-256-rulings.test.mjs`.
