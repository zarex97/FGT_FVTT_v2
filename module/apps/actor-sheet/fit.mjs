/**
 * @file The actor sheet opens large enough to show what it holds.
 * @see docs/35-sheets-and-editor.md
 *
 * Pure: it reads the numbers it is handed and returns a position.
 *
 * The sheet's default size is a guess made once for every Unit, and a Servant
 * with a Resource pool, a Master block or a long Turn record ran past it: the
 * Actions panel and the Luck bar opened cut off, behind a scrollbar (#364).
 * The window grows by what its panes overflow, never shrinks below its
 * default, and never past the screen.
 */

/**
 * The position a window takes to show content that overflows it by
 * `overflow`, or `null` when it already shows it all.
 *
 * @param {object} args
 * @param {{width: number, height: number, top: number, left: number}} args.position the window now
 * @param {{width: number, height: number}} args.overflow pixels each axis is short by
 * @param {{width: number, height: number}} args.viewport the screen
 * @param {number} [args.margin] kept clear on every side of the screen
 * @returns {{width: number, height: number, top: number, left: number}|null}
 */
export function fittedPosition({ position, overflow, viewport, margin = 16 }) {
  const grow = (now, short, room) => Math.max(now, Math.min(now + Math.max(0, Math.ceil(short)), room));
  const width = grow(position.width, overflow.width, viewport.width - 2 * margin);
  const height = grow(position.height, overflow.height, viewport.height - 2 * margin);
  if (width === position.width && height === position.height) return null;
  // Moved back on screen when it grew past an edge, never off the far one.
  const place = (at, size, room) => Math.max(margin, Math.min(at, room - size - margin));
  return {
    width,
    height,
    top: place(position.top, height, viewport.height),
    left: place(position.left, width, viewport.width),
  };
}

/**
 * How far a sheet's panes overflow: the portrait column and the open tab,
 * each its own scroll container.
 *
 * @param {HTMLElement} element the sheet's window
 * @returns {{width: number, height: number}}
 */
export function overflowOf(element) {
  const panes = [...element.querySelectorAll(".window-content > .fgt-header, .window-content > .tab.active")];
  const short = (pane, axis) => (axis === "y"
    ? pane.scrollHeight - pane.clientHeight
    : pane.scrollWidth - pane.clientWidth);
  return {
    width: Math.max(0, ...panes.map((p) => short(p, "x"))),
    height: Math.max(0, ...panes.map((p) => short(p, "y"))),
  };
}
