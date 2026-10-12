---
kind: drive-kit
lesson: Driving the board has known traps in both workplaces; read docs/agents/vps.md "Driving the board headless" first.
landed: none
---
**Mechanism:** Unrelated traps met while driving the live world. On the VPS, CDP drags reach the canvas but move no token, the full suite outruns a tool call and `pkill -f` matches its own shell. On the PC, a claude-in-chrome drag moves a token only part of the way. On both, the first boundary after a reload is not a typical one to time or trust.
**Lesson:** Read `docs/agents/vps.md` *Driving the board headless* before driving, and use its recipes. Wait 60 s after a page reload, and confirm each `nextTurn` landed before the next. Drags stay open as a known limit: walk the rest with `TokenDocument#move` from the owner's client. Time several boundaries, never the first after a reload.
**Surprises:** [2026-10-10-cdp-drag-moves-nothing](../2026-10-10-cdp-drag-moves-nothing.md) · [2026-10-10-full-suite-outruns-timeout](../2026-10-10-full-suite-outruns-timeout.md) · [2026-10-10-pkill-pattern-kills-its-own-shell](../2026-10-10-pkill-pattern-kills-its-own-shell.md) · [2026-10-11-boundaries-skipped-after-reload](../2026-10-11-boundaries-skipped-after-reload.md) · [2026-10-11-round-boundary-turnstart-mislabelled](../2026-10-11-round-boundary-turnstart-mislabelled.md) · [2026-10-11-first-boundary-timed-as-typical](../2026-10-11-first-boundary-timed-as-typical.md) · [2026-10-12-drag-moves-part-way](../2026-10-12-drag-moves-part-way.md)
