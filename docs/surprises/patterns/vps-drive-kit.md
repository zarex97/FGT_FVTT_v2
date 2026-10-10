---
kind: vps-drive-kit
lesson: Driving the board headless on the VPS has known traps; read docs/agents/vps.md "Driving the board headless" first.
landed: none
---
**Mechanism:** Three unrelated traps met while driving the live world over CDP on the VPS. Drags reach the canvas but move no token. The full suite outruns a tool call. `pkill -f` matches its own shell.
**Lesson:** Read `docs/agents/vps.md` *Driving the board headless* before driving, and use its recipes. The CDP drag stays open there as a known limit.
**Surprises:** [2026-10-10-cdp-drag-moves-nothing](../2026-10-10-cdp-drag-moves-nothing.md) · [2026-10-10-full-suite-outruns-timeout](../2026-10-10-full-suite-outruns-timeout.md) · [2026-10-10-pkill-pattern-kills-its-own-shell](../2026-10-10-pkill-pattern-kills-its-own-shell.md)
