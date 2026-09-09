/**
 * @file Where each faction's Home Base sits, for a war of a given shape.
 * @see docs/19-environment.md §19.1, docs/08-board-and-geometry.md §8.2
 *
 * Layer 2 (rules). Pure, and it takes the board's bounds as an argument rather
 * than reading a scene — the contract every other module in this layer keeps.
 *
 * Home bases have been fully implemented since Ch. 19 was written — five
 * effects, `CS: Escape`'s anchor, Caster's Detect, Territory Creation and the
 * Grail's exclusion zone all read them — and **nothing has ever created one**.
 * `docs/08` records why: *"| Static | Home bases | `Scene.regions`, authored
 * per-scene |"*. Authored, by a person, with a drawing tool, every time.
 *
 * Panels are `{i: row, j: column}`, zero-based, `i` increasing southward (§8.1).
 */

/**
 * Every panel in a band of `depth` rows starting at `top`.
 *
 * @param {number} top
 * @param {number} depth
 * @param {number} columns
 * @returns {Array<{i: number, j: number}>}
 */
function rowBand(top, depth, columns) {
  /** @type {Array<{i: number, j: number}>} */
  const out = [];
  for (let i = top; i < top + depth; i++) {
    for (let j = 0; j < columns; j++) out.push({ i, j });
  }
  return out;
}

/**
 * The perimeter band, `depth` panels deep, walked ring by ring inward.
 *
 * Walked rather than computed as four rectangles, because the corners belong to
 * two of them and a faction must never be handed the same panel twice. Ring
 * order — rather than four full sides at a time — is what keeps each faction's
 * share of the walk contiguous instead of four disconnected slivers.
 *
 * @param {number} rows
 * @param {number} columns
 * @param {number} depth
 * @returns {Array<{i: number, j: number}>}
 */
function perimeterBand(rows, columns, depth) {
  /** @type {Array<{i: number, j: number}>} */
  const out = [];
  const seen = new Set();
  const push = (i, j) => {
    if (i < 0 || j < 0 || i >= rows || j >= columns) return;
    const k = `${i},${j}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ i, j });
  };

  for (let d = 0; d < depth; d++) {
    const top = d;
    const bottom = rows - 1 - d;
    const left = d;
    const right = columns - 1 - d;
    // A band deeper than half the board has consumed it; the rings meet in the
    // middle and there is nothing further in.
    if (top > bottom || left > right) break;

    for (let j = left; j <= right; j++) push(top, j);
    for (let i = top + 1; i <= bottom; i++) push(i, right);
    if (bottom > top) for (let j = right - 1; j >= left; j--) push(bottom, j);
    if (right > left) for (let i = bottom - 1; i > top; i--) push(i, left);
  }

  return out;
}

/**
 * Each faction's Home Base panels.
 *
 * - **`greatHolyGrailWar`** — *"the home bases are the top 3 rows for a faction,
 *   and the bottom 3 rows for the other."* Exactly two sides; anything else is a
 *   refusal rather than a guess, because there is no third edge the rulebook
 *   names.
 * - **`holyGrailWar`** — the rulebook specifies home bases for the two-sided war
 *   and says nothing about an all-versus-all, so this is a **house rule**: the
 *   perimeter band divided into N contiguous blocks. It is offered because five
 *   implemented rules (E1–E5), `CS: Escape` and the Grail's exclusion zone all
 *   go dark without a base, and silently disabling seven rules is worse than a
 *   stated convention.
 * - **`custom`** — nothing. The GM draws them.
 *
 * @param {string} warType
 * @param {Array<{id: string}>} factions
 * @param {{rows: number, columns: number, depth?: number}} bounds
 * @returns {Array<{factionId: string, offsets: Array<{i: number, j: number}>}>}
 * @throws {RangeError} when a Great Holy Grail War is not two-sided
 */
export function homeBaseRects(warType, factions, { rows, columns, depth = 3 }) {
  const list = factions ?? [];

  if (warType === "custom") return [];

  if (warType === "greatHolyGrailWar") {
    if (list.length !== 2) {
      throw new RangeError(
        `A Great Holy Grail War has two sides; this one declares ${list.length}.`,
      );
    }
    return [
      { factionId: list[0].id, offsets: rowBand(0, depth, columns) },
      { factionId: list[1].id, offsets: rowBand(rows - depth, depth, columns) },
    ];
  }

  const band = perimeterBand(rows, columns, depth);
  const n = list.length;
  if (n === 0) return [];

  // The remainder goes to the EARLIEST blocks, one panel each, so no two differ
  // by more than one. Giving it all to the last block would hand one faction a
  // base a seventh larger than everybody else's.
  const size = Math.floor(band.length / n);
  const extra = band.length % n;

  /** @type {Array<{factionId: string, offsets: Array<{i: number, j: number}>}>} */
  const out = [];
  let cursor = 0;
  for (let k = 0; k < n; k++) {
    const take = size + (k < extra ? 1 : 0);
    out.push({ factionId: list[k].id, offsets: band.slice(cursor, cursor + take) });
    cursor += take;
  }
  return out;
}
