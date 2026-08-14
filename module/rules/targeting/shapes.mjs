/**
 * @file Axis 2 — shape expansion. Anchor panel(s) → panel set.
 * @see docs/09-targeting.md §9.4
 *
 * Layer 2 (rules). Pure geometry over L1 primitives; no board state, no units.
 *
 * `banded` is the one shape that does not return a flat set: it returns a
 * panel → band index map, because both the damage multiplier and the effect
 * application chance vary by band (Nemo's *Triton's Conch*).
 */

import * as geo from "../../domain/geometry.mjs";

/**
 * @typedef {import("../../domain/geometry.mjs").GridOffset} GridOffset
 * @typedef {import("../../domain/geometry.mjs").Bounds} Bounds
 */

/**
 * @typedef {object} ShapeResult
 * @property {GridOffset[]} panels
 * @property {Map<string, number>|null} bands panel key → band index, or `null`
 */

/** Cardinal deltas by name. */
export const DELTA = Object.freeze({
  n: { i: -1, j: 0 }, e: { i: 0, j: 1 }, s: { i: 1, j: 0 }, w: { i: 0, j: -1 },
  ne: { i: -1, j: 1 }, se: { i: 1, j: 1 }, sw: { i: 1, j: -1 }, nw: { i: -1, j: -1 },
});

/**
 * Expand a shape around an anchor.
 *
 * @param {object} shape a `ShapeSpec` (docs/09-targeting.md §9.4)
 * @param {object} anchor the resolved anchor from axis 1
 * @param {object} [opts]
 * @param {Bounds|null} [opts.bounds]
 * @param {GridOffset} [opts.caster] the caster's panel, for `banded` distances
 * @returns {ShapeResult}
 */
export function expand(shape, anchor, opts = {}) {
  const bounds = opts.bounds ?? null;
  const origin = anchor.panel ?? { i: 0, j: 0 };

  switch (shape.kind) {
    case "point":
      return flat(geo.normalize([origin], bounds));

    case "unit":
      // A unit-targeting shape covers exactly the target's panel(s); the
      // occupancy step then finds the unit standing there.
      return flat(geo.normalize(anchor.panels ?? [origin], bounds));

    case "square":
      return expand({ kind: "rect", w: shape.size, h: shape.size }, anchor, opts);

    case "rect": {
      // Placement semantics depend on the anchor: a directional anchor projects
      // the block outward from the caster, everything else centres it.
      if (anchor.direction) {
        return flat(orthogonalAdjacentRect(anchor.casterPanel ?? origin, shape.w, shape.h, anchor.direction, bounds));
      }
      if (shape.w % 2 === 1 && shape.h % 2 === 1) {
        return flat(geo.centredRect(origin, shape.w, shape.h, bounds));
      }
      // Even dimensions have no defined centre (Ch. 41 Q27). Anchor the block
      // at its top-left and let the preview show the player what they get.
      return flat(geo.rect(origin, shape.w, shape.h, bounds));
    }

    case "chebyshevRadius":
      return flat(geo.chebyshevDisc(origin, shape.r, bounds));

    case "attackRange":
      return flat(geo.attackRangePanels(origin, shape.r, bounds));

    case "ring":
      return flat(
        geo.normalize(
          Array.from({ length: shape.outer - shape.inner + 1 }, (_, k) =>
            geo.ring(origin, shape.inner + k, bounds)).flat(),
          bounds,
        ),
      );

    case "line": {
      const dir = anchor.direction ? DELTA[anchor.direction] : DELTA.n;
      const panels = geo.line(anchor.casterPanel ?? origin, dir, shape.length, {
        bidirectional: shape.bidirectional ?? false,
        diagonalLength: shape.diagonalLength ?? null,
        bounds,
      });
      if ((shape.width ?? 1) <= 1) return flat(panels);
      // A wide line is the union of parallel lines offset perpendicular to it.
      const perp = { i: dir.j, j: -dir.i };
      const half = Math.floor(((shape.width ?? 1) - 1) / 2);
      /** @type {GridOffset[]} */
      const all = [];
      for (let off = -half; off <= (shape.width ?? 1) - 1 - half; off++) {
        const start = {
          i: (anchor.casterPanel ?? origin).i + perp.i * off,
          j: (anchor.casterPanel ?? origin).j + perp.j * off,
        };
        all.push(...geo.line(start, dir, shape.length, {
          bidirectional: shape.bidirectional ?? false, bounds,
        }));
      }
      return flat(geo.normalize(all, bounds));
    }

    case "orientedRect": {
      // "7×3 or 3×7 in the direction the bow is facing" is one shape described
      // for both facings, projected forward from the front edge (Ch. 09 §9.4).
      const d = anchor.direction ?? "n";
      const alongAxis = d === "n" || d === "s";
      const w = alongAxis ? shape.short : shape.long;
      const h = alongAxis ? shape.long : shape.short;
      return flat(orthogonalAdjacentRect(anchor.casterPanel ?? origin, w, h, d, bounds));
    }

    case "path":
      return flat(geo.normalize(anchor.path ?? [], bounds));

    case "zone":
      return flat(geo.normalize(anchor.panels ?? [], bounds));

    case "banded": {
      const centre = opts.caster ?? origin;
      const maxD = Math.max(...shape.bands.map((b) => b.maxDistance));
      /** @type {Map<string, number>} */
      const bands = new Map();
      /** @type {GridOffset[]} */
      const panels = [];
      for (const p of geo.chebyshevDisc(centre, maxD, bounds)) {
        const d = geo.chebyshev(centre, p);
        const idx = shape.bands.findIndex((b) => d <= b.maxDistance);
        if (idx === -1) continue;
        bands.set(geo.key(p), idx);
        panels.push(p);
      }
      return { panels, bands };
    }

    default:
      throw new RangeError(`FGT | Unknown targeting shape "${shape.kind}".`);
  }
}

/**
 * The "M×N panel area in any non-diagonal direction next to X" block.
 *
 * A `w × h` block flush against the caster on one cardinal side, centred on the
 * caster's perpendicular axis. **The caster is not inside it.**
 *
 * Odd dimensions — every case in the reference set — centre exactly. Even
 * dimensions bias one panel toward negative offsets via the `floor`, which the
 * preview renders so the player can see what they are getting (Ch. 41 Q27).
 *
 * @param {GridOffset} c the caster's panel
 * @param {number} w
 * @param {number} h
 * @param {string} d a cardinal direction name
 * @param {Bounds|null} [bounds]
 * @returns {GridOffset[]}
 * @see docs/09-targeting.md §9.3
 */
export function orthogonalAdjacentRect(c, w, h, d, bounds = null) {
  const delta = DELTA[d];
  if (!delta) throw new RangeError(`FGT | Unknown direction "${d}".`);
  const { i: di, j: dj } = delta;
  const along = di !== 0 ? h : w;
  const across = di !== 0 ? w : h;
  const halfA = Math.floor(across / 2);

  /** @type {GridOffset[]} */
  const out = [];
  for (let step = 1; step <= along; step++) {
    for (let off = -halfA; off <= across - 1 - halfA; off++) {
      out.push(
        di !== 0
          ? { i: c.i + di * step, j: c.j + off }
          : { i: c.i + off, j: c.j + dj * step },
      );
    }
  }
  return geo.normalize(out, bounds);
}

/**
 * @param {GridOffset[]} panels
 * @returns {ShapeResult}
 */
function flat(panels) {
  return { panels, bands: null };
}
