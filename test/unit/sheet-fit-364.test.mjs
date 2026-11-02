/**
 * @file The actor sheet opens large enough to show what it holds (#364).
 * @see module/apps/actor-sheet/fit.mjs, docs/35-sheets-and-editor.md
 *
 * Found live: Gray's Overview opened at 900x720 with its Actions panel cut
 * off behind a scrollbar. The suite runs without a DOM, so the panes are
 * stand-ins for the four numbers `overflowOf` reads; the measuring was
 * pressed live.
 */
import { describe, it, expect } from "vitest";
import { fittedPosition, overflowOf } from "../../module/apps/actor-sheet/fit.mjs";

const viewport = { width: 1920, height: 889 };
const position = { width: 900, height: 720, top: 85, left: 510 };

describe("fittedPosition", () => {
  it("grows by what the panes overflow", () => {
    expect(fittedPosition({ position, overflow: { width: 0, height: 60 }, viewport }))
      .toEqual({ width: 900, height: 780, top: 85, left: 510 });
  });

  it("leaves a window that shows it all as it is", () => {
    expect(fittedPosition({ position, overflow: { width: 0, height: 0 }, viewport })).toBeNull();
  });

  it("never shrinks below the default", () => {
    expect(fittedPosition({ position, overflow: { width: -40, height: -200 }, viewport })).toBeNull();
  });

  it("stops at the screen, and moves back onto it", () => {
    const next = fittedPosition({ position, overflow: { width: 0, height: 900 }, viewport });
    expect(next.height).toBe(889 - 32);
    expect(next.top).toBe(16);
  });

  it("widens for a pane that overflows sideways, and keeps the left edge on screen", () => {
    const next = fittedPosition({ position: { ...position, left: 1000 }, overflow: { width: 120, height: 0 }, viewport });
    expect(next.width).toBe(1020);
    expect(next.left).toBe(1920 - 1020 - 16);
  });
});

describe("overflowOf", () => {
  const pane = (scrollHeight, clientHeight, scrollWidth = 600, clientWidth = 600) => ({ scrollHeight, clientHeight, scrollWidth, clientWidth });

  it("reads the portrait column and the open tab, the taller overflow wins", () => {
    const element = { querySelectorAll: (sel) => {
      expect(sel).toContain(".fgt-header");
      expect(sel).toContain(".tab.active");
      return [pane(700, 684), pane(780, 632)];
    } };
    expect(overflowOf(element)).toEqual({ width: 0, height: 148 });
  });

  it("is nothing when nothing overflows", () => {
    expect(overflowOf({ querySelectorAll: () => [pane(600, 684)] })).toEqual({ width: 0, height: 0 });
  });
});
