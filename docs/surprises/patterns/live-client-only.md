---
kind: live-client-only
lesson: Press as Player1, not only as the GM; every write a press makes runs on the active GM, and prompts or Level changes are pressed live.
landed: CLAUDE.md#Lessons
---
**Mechanism:** Some defects exist only in a running Foundry client. With no player connected every prompt lands on the GM's client, where two windows with one id are one window. Deleting a Level left the canvas not ready, and nothing redrew it. A player's press is the other half (#206): code that runs on every client, or on the presser's, wrote the Combat from a player who may not, and the unit test drove it as the GM.
**Lesson:** Press anything that asks several people at once, or that creates or deletes a Level, on a live board with only the GM connected. Press every player-facing button as Player1 too, and route each write it causes to the active GM (`OPERATIONS`), with the owner as the fallback only when no GM is connected.
**Surprises:** [2026-10-10-two-choice-dialogs-one-id](../2026-10-10-two-choice-dialogs-one-id.md) · [2026-10-10-canvas-dead-after-level-delete](../2026-10-10-canvas-dead-after-level-delete.md) · [2026-10-14-owner-and-gm-both-ran-the-move](../2026-10-14-owner-and-gm-both-ran-the-move.md) · [2026-10-14-player-press-wrote-the-combat](../2026-10-14-player-press-wrote-the-combat.md)
