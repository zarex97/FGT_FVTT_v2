/**
 * @file Board geometry: the three distance metrics, shape generation, reachability.
 * @see docs/08-board-and-geometry.md
 *
 * Layer 1 (domain). Pure — no Foundry, no canvas.
 *
 * F/GT uses **three** distance metrics and picking the wrong one is the single
 * most common geometry bug:
 *
 *   - {@link chebyshev} — "within an N panel area". ZON, auras, adjacency.
 *   - {@link manhattan} — movement. Orthogonal only; no diagonal steps.
 *   - {@link inAttackRange} — attack Range, Chebyshev with the outer ring's
 *     corners clipped from R ≥ 3.
 *
 * Panels are addressed as `{i, j}` grid offsets (row, column), matching
 * Foundry's `GridOffset`.
 */

/**
 * @typedef {object} GridOffset
 * @property {number} i row
 * @property {number} j column
 */

/**
 * @typedef {object} Bounds
 * @property {number} iMin
 * @property {number} jMin
 * @property {number} iMax inclusive
 * @property {number} jMax inclusive
 */

/* -------------------------------------------------------------------------- */
/*  Metrics                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Chebyshev distance — diagonals cost 1.
 *
 * This is the rulebook's default. *"Within a 2 panel area"* is the 5×5 block
 * centred on the unit. *"Directly next to"* is Chebyshev 1, which the source
 * states explicitly includes diagonals.
 *
 * @param {GridOffset} a
 * @param {GridOffset} b
 * @returns {number}
 */
export function chebyshev(a, b) {
  return Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
}

/**
 * Manhattan distance — orthogonal steps only.
 *
 * Movement uses this: *"Units are not allowed to Move diagonally."* Note this
 * is the *metric*; actual reachability must also respect obstacles, so use
 * {@link reachablePanels} for anything that matters.
 *
 * @param {GridOffset} a
 * @param {GridOffset} b
 * @returns {number}
 */
export function manhattan(a, b) {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j);
}

/**
 * Is `to` within attack Range `R` of `from`?
 *
 * > *"When Attacking, panels are counted diagonally also. However, when the
 * > Range is 3 panels or higher, the diagonal range is reduced by 1."*
 *
 * Formally: in range iff `d ≤ R`, **excluding** panels where `d = R` and
 * `s ≥ 2`, where `d` is the Chebyshev distance and `s` is how far off-axis the
 * panel sits. Only the outermost ring loses its corners; everything inside is
 * untouched.
 *
 * Panel counts: R1 → 9, R2 → 25, R3 → 37, R4 → 61, R5 → 93, R6 → 133.
 * Excluded = `8R − 12` for R ≥ 3.
 *
 * @param {GridOffset} from
 * @param {GridOffset} to
 * @param {number} R
 * @returns {boolean}
 * @see docs/08-board-and-geometry.md §8.2, Ch. 41 Q7
 */
export function inAttackRange(from, to, R) {
  const di = Math.abs(from.i - to.i);
  const dj = Math.abs(from.j - to.j);
  const d = Math.max(di, dj);
  const s = Math.min(di, dj);
  if (d > R) return false;
  if (R < 3) return true; // pure Chebyshev at R = 1, 2
  return !(d === R && s >= 2); // clip the outer ring's corners only
}

/**
 * How many panels an attack Range covers on an unbounded board.
 * Closed form, for tests and tooltips.
 * @param {number} R
 * @returns {number}
 */
export function attackRangeArea(R) {
  if (R < 0) return 0;
  const square = (2 * R + 1) ** 2;
  return R < 3 ? square : square - (8 * R - 12);
}

/* -------------------------------------------------------------------------- */
/*  Bounds                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Build bounds for a square board of side `n`, origin at (0, 0).
 * @param {number} n 13 or 25 in practice
 * @returns {Bounds}
 */
export function squareBounds(n) {
  return { iMin: 0, jMin: 0, iMax: n - 1, jMax: n - 1 };
}

/**
 * @param {GridOffset} p
 * @param {Bounds|null} bounds
 * @returns {boolean}
 */
export function inBounds(p, bounds) {
  if (!bounds) return true;
  return p.i >= bounds.iMin && p.i <= bounds.iMax && p.j >= bounds.jMin && p.j <= bounds.jMax;
}

/**
 * Stable string key for a panel, for `Set`/`Map` membership.
 * @param {GridOffset} p
 * @returns {string}
 */
export function key(p) {
  return `${p.i},${p.j}`;
}

/**
 * Inverse of {@link key}.
 * @param {string} k
 * @returns {GridOffset}
 */
export function unkey(k) {
  const [i, j] = k.split(",");
  return { i: Number(i), j: Number(j) };
}

/**
 * Deduplicate and clip a panel list to the board.
 * @param {GridOffset[]} panels
 * @param {Bounds|null} [bounds=null]
 * @returns {GridOffset[]}
 */
export function normalize(panels, bounds = null) {
  const seen = new Set();
  const out = [];
  for (const p of panels) {
    if (!inBounds(p, bounds)) continue;
    const k = key(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every panel within Chebyshev distance `r` — the `(2r+1)²` block.
 * This is "within an N panel area".
 * @param {GridOffset} centre
 * @param {number} r
 * @param {Bounds|null} [bounds=null]
 * @returns {GridOffset[]}
 */
export function chebyshevDisc(centre, r, bounds = null) {
  const out = [];
  for (let i = centre.i - r; i <= centre.i + r; i++) {
    for (let j = centre.j - r; j <= centre.j + r; j++) {
      const p = { i, j };
      if (inBounds(p, bounds)) out.push(p);
    }
  }
  return out;
}

/**
 * The attack-Range shape: every panel satisfying {@link inAttackRange}.
 *
 * Memoized on `(R, bounds, origin)` is not worth it — the loop is `(2R+1)²` with
 * R ≤ 8 in all content — but the *predicate* is the single source of truth, so a
 * future correction to the Range rule changes one function.
 *
 * @param {GridOffset} origin
 * @param {number} R
 * @param {Bounds|null} [bounds=null]
 * @returns {GridOffset[]}
 */
export function attackRangePanels(origin, R, bounds = null) {
  const out = [];
  for (let i = origin.i - R; i <= origin.i + R; i++) {
    for (let j = origin.j - R; j <= origin.j + R; j++) {
      const p = { i, j };
      if (!inBounds(p, bounds)) continue;
      if (!inAttackRange(origin, p, R)) continue;
      out.push(p);
    }
  }
  return out;
}

/**
 * A `w × h` rectangle with an explicit top-left corner.
 * @param {GridOffset} topLeft
 * @param {number} w columns
 * @param {number} h rows
 * @param {Bounds|null} [bounds=null]
 * @returns {GridOffset[]}
 */
export function rect(topLeft, w, h, bounds = null) {
  const out = [];
  for (let i = topLeft.i; i < topLeft.i + h; i++) {
    for (let j = topLeft.j; j < topLeft.j + w; j++) {
      const p = { i, j };
      if (inBounds(p, bounds)) out.push(p);
    }
  }
  return out;
}

/**
 * A `w × h` rectangle centred on a panel.
 *
 * Only defined for odd `w` and `h`. Even-dimensioned *self-centred* shapes are
 * genuinely ambiguous in the source and no content uses one (Ch. 41 Q27), so
 * this throws rather than silently picking a corner.
 *
 * @param {GridOffset} centre
 * @param {number} w
 * @param {number} h
 * @param {Bounds|null} [bounds=null]
 * @returns {GridOffset[]}
 */
export function centredRect(centre, w, h, bounds = null) {
  if (w % 2 === 0 || h % 2 === 0) {
    throw new RangeError(
      `FGT | centredRect requires odd dimensions, got ${w}×${h}. ` +
        `Even self-centred shapes are unspecified in the source (Ch. 41 Q27); ` +
        `use rect() with an explicit corner, or an "adjacent" anchor.`,
    );
  }
  return rect({ i: centre.i - (h - 1) / 2, j: centre.j - (w - 1) / 2 }, w, h, bounds);
}

/**
 * The four cardinal unit vectors, in `n, e, s, w` order.
 * @type {ReadonlyArray<GridOffset>}
 */
export const CARDINALS = Object.freeze([
  { i: -1, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 0, j: -1 },
]);

/**
 * The eight neighbour vectors, cardinals first.
 * @type {ReadonlyArray<GridOffset>}
 */
export const NEIGHBOURS = Object.freeze([
  { i: -1, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 0, j: -1 },
  { i: -1, j: -1 }, { i: -1, j: 1 }, { i: 1, j: 1 }, { i: 1, j: -1 },
]);

/**
 * A `w × h` block placed flush against the caster in a given direction.
 *
 * This is the *"a 3×3 panel area in any non-diagonal direction next to X"*
 * shape, which appears throughout the corpus. The block's near edge touches the
 * caster's panel; the caster is not inside it.
 *
 * @param {GridOffset} origin the caster's panel
 * @param {GridOffset} dir a unit vector from {@link CARDINALS}
 * @param {number} w extent perpendicular to `dir`
 * @param {number} h extent along `dir`
 * @param {Bounds|null} [bounds=null]
 * @returns {GridOffset[]}
 * @see docs/09-targeting.md
 */
export function adjacentBlock(origin, dir, w, h, bounds = null) {
  const out = [];
  // Perpendicular axis: swap and negate.
  const perp = { i: dir.j, j: -dir.i };
  const half = Math.floor((w - 1) / 2);
  for (let step = 1; step <= h; step++) {
    for (let off = -half; off <= w - 1 - half; off++) {
      const p = {
        i: origin.i + dir.i * step + perp.i * off,
        j: origin.j + dir.j * step + perp.j * off,
      };
      if (inBounds(p, bounds)) out.push(p);
    }
  }
  return normalize(out, bounds);
}

/**
 * A straight line of `length` panels from `origin` in `dir`, excluding `origin`.
 *
 * @param {GridOffset} origin
 * @param {GridOffset} dir any of {@link NEIGHBOURS}; diagonals are legal
 * @param {number} length
 * @param {object} [opts]
 * @param {boolean} [opts.bidirectional=false] also project the opposite way
 * @param {number|null} [opts.diagonalLength=null] override length on a diagonal
 *   — Danzō's Dongyū is 1×5 cardinal but 1×4 diagonal
 * @param {Bounds|null} [opts.bounds=null]
 * @returns {GridOffset[]}
 * @see docs/44-case-expanded-roster.md §44.3
 */
export function line(origin, dir, length, opts = {}) {
  const { bidirectional = false, diagonalLength = null, bounds = null } = opts;
  const isDiagonal = dir.i !== 0 && dir.j !== 0;
  const len = isDiagonal && diagonalLength !== null ? diagonalLength : length;

  const out = [];
  const project = (d) => {
    for (let step = 1; step <= len; step++) {
      const p = { i: origin.i + d.i * step, j: origin.j + d.j * step };
      if (!inBounds(p, bounds)) break; // a line stops at the board edge
      out.push(p);
    }
  };
  project(dir);
  if (bidirectional) project({ i: -dir.i, j: -dir.j });
  return normalize(out, bounds);
}

/**
 * The panels strictly between two panels, exclusive of both ends.
 *
 * Only meaningful on a shared row, column or exact diagonal -- which is what
 * "between" means on a grid the game gives no line of sight. Anything off
 * those three axes returns `[]`: it has no panels between it and the origin,
 * so nothing can obstruct it. The conservative reading, and the only one
 * Medusa's single worked example supports (Ch. 44 §44.3).
 *
 * {@link line} projects a DIRECTION for a length; this walks to a GIVEN panel,
 * which nothing did before.
 *
 * @param {GridOffset} a
 * @param {GridOffset} b
 * @returns {GridOffset[]} in order from `a` toward `b`
 */
export function panelsBetween(a, b) {
  const di = b.i - a.i;
  const dj = b.j - a.j;
  if (di !== 0 && dj !== 0 && Math.abs(di) !== Math.abs(dj)) return [];

  const steps = Math.max(Math.abs(di), Math.abs(dj));
  const step = { i: Math.sign(di), j: Math.sign(dj) };
  /** @type {GridOffset[]} */
  const out = [];
  for (let n = 1; n < steps; n++) out.push({ i: a.i + step.i * n, j: a.j + step.j * n });
  return out;
}

/**
 * The ring at exactly Chebyshev distance `r`.
 * No content uses it yet; implemented because the rules text describes it.
 * @param {GridOffset} centre
 * @param {number} r
 * @param {Bounds|null} [bounds=null]
 * @returns {GridOffset[]}
 */
export function ring(centre, r, bounds = null) {
  if (r === 0) return inBounds(centre, bounds) ? [centre] : [];
  const out = [];
  for (let i = centre.i - r; i <= centre.i + r; i++) {
    for (let j = centre.j - r; j <= centre.j + r; j++) {
      if (Math.max(Math.abs(i - centre.i), Math.abs(j - centre.j)) !== r) continue;
      const p = { i, j };
      if (inBounds(p, bounds)) out.push(p);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Movement                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every panel reachable within `mov` orthogonal steps, respecting obstacles.
 *
 * A breadth-first flood, because the reachable set is *not* simply the Manhattan
 * diamond once anything blocks a path. `blocked` is consulted for panels the
 * unit would pass through **and** stop on; callers that allow moving through
 * allies but not stopping on them should post-filter the result.
 *
 * @param {GridOffset} origin
 * @param {number} mov
 * @param {(p: GridOffset) => boolean} blocked
 * @param {Bounds|null} [bounds=null]
 * @returns {Map<string, number>} panel key → step cost, excluding the origin
 * @see docs/08-board-and-geometry.md §8.3
 */
export function reachablePanels(origin, mov, blocked, bounds = null) {
  /** @type {Map<string, number>} */
  const dist = new Map([[key(origin), 0]]);
  let frontier = [origin];

  for (let step = 1; step <= mov; step++) {
    /** @type {GridOffset[]} */
    const next = [];
    for (const p of frontier) {
      for (const d of CARDINALS) {
        const q = { i: p.i + d.i, j: p.j + d.j };
        const k = key(q);
        if (dist.has(k)) continue;
        if (!inBounds(q, bounds)) continue;
        if (blocked(q)) continue;
        dist.set(k, step);
        next.push(q);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }

  dist.delete(key(origin));
  return dist;
}

/* -------------------------------------------------------------------------- */
/*  Direction and facing                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Which of the attacker's four cones the attack came from.
 *
 * Facing is stored as one of eight compass directions but only ever *read* as
 * one of four cones, because every rule that cares (the evade modifier table,
 * Achilles' Heel) is expressed as front/side/back.
 *
 * @param {string} facing one of {@link import("./enums.mjs").FACINGS}
 * @param {GridOffset} self
 * @param {GridOffset} other the attacker's panel
 * @returns {"front"|"right"|"back"|"left"}
 * @see docs/08-board-and-geometry.md §8.8
 */
export function coneOf(facing, self, other) {
  const facingDeg = FACING_DEGREES[facing];
  if (facingDeg === undefined) throw new RangeError(`FGT | Unknown facing "${facing}".`);
  // Screen coordinates: +i is south, +j is east. Bearing 0 = north.
  const bearing = (Math.atan2(other.j - self.j, -(other.i - self.i)) * 180) / Math.PI;
  const rel = ((bearing - facingDeg) % 360 + 360 + 45) % 360;
  if (rel < 90) return "front";
  if (rel < 180) return "right";
  if (rel < 270) return "back";
  return "left";
}

/** @type {Readonly<Record<string, number>>} */
const FACING_DEGREES = Object.freeze({
  n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315,
});

/**
 * The cardinal direction from `from` toward `to`, for knockback and forced
 * movement. Ties (perfect diagonals) resolve to the row axis, matching the
 * "no diagonal movement" rule.
 * @param {GridOffset} from
 * @param {GridOffset} to
 * @returns {GridOffset} one of {@link CARDINALS}
 */
export function cardinalToward(from, to) {
  const di = to.i - from.i;
  const dj = to.j - from.j;
  if (Math.abs(di) >= Math.abs(dj)) return { i: Math.sign(di) || 0, j: 0 };
  return { i: 0, j: Math.sign(dj) };
}
