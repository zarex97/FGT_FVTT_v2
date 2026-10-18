/**
 * @file Where two Units trading places each land.
 * @see docs/21-combat-process.md, docs/05-board-geometry.md, engine/attack.mjs#swapIntoAttack
 *
 * Katō Danzō's Kawarimi (#249): *"she can swap herself with any other Unit
 * within a 2 panel area of herself except the AU. The Combat Process continues
 * as normal."* Any Unit, a large footprint included (reading 38). Pure: the
 * caller writes the moves.
 *
 * One panel for one panel is a plain trade. A larger partner cannot fit the
 * mover's one panel, so it is placed to COVER that panel, keeping as much of
 * its old footprint as it can and staying on the board; the mover takes the
 * free panel of the partner's old footprint nearest where she stood. Anybody
 * else under the new footprint is knocked back, as by any Unit that moves in
 * (`CONTEXT.md`, Knockback).
 */

import * as geo from "../domain/geometry.mjs";
import { knockbackPlan } from "./movement.mjs";

/**
 * @param {{id: string, panel: {i: number, j: number}}} mover the Unit who swaps (one panel)
 * @param {{id: string, panel: {i: number, j: number}, panels?: object[]}} partner
 * @param {object} board
 * @returns {{mover: {i: number, j: number}, partner: {i: number, j: number}, partnerPanels: object[], knockback: object[]}|null}
 */
export function swapPlan(mover, partner, board) {
  if (!mover?.panel || !partner?.panel) return null;
  const from = mover.panel;
  const footprint = (partner.panels ?? []).length > 0 ? partner.panels : [partner.panel];
  if (footprint.length === 1) {
    return { mover: { ...partner.panel }, partner: { ...from }, partnerPanels: [{ ...from }], knockback: [] };
  }

  const anchor = partner.panel;
  const di = Math.max(...footprint.map((p) => p.i)) - Math.min(...footprint.map((p) => p.i)) + 1;
  const dj = Math.max(...footprint.map((p) => p.j)) - Math.min(...footprint.map((p) => p.j)) + 1;
  const cellsAt = (c) => {
    const out = [];
    for (let i = 0; i < di; i += 1) for (let j = 0; j < dj; j += 1) out.push({ i: c.i + i, j: c.j + j });
    return out;
  };
  // Every anchor whose footprint covers the mover's panel, on the board, the
  // nearest to where the partner stood first.
  const candidates = [];
  for (let i = from.i - di + 1; i <= from.i; i += 1) {
    for (let j = from.j - dj + 1; j <= from.j; j += 1) {
      const c = { i, j };
      if (cellsAt(c).every((p) => geo.inBounds(p, board?.bounds ?? null))) candidates.push(c);
    }
  }
  if (candidates.length === 0) return null;
  const old = new Set(footprint.map((p) => `${p.i},${p.j}`));
  const overlap = (c) => cellsAt(c).filter((p) => old.has(`${p.i},${p.j}`)).length;
  candidates.sort((a, b) => overlap(b) - overlap(a) || geo.chebyshev(a, anchor) - geo.chebyshev(b, anchor) || a.i - b.i || a.j - b.j);
  const placed = candidates[0];
  const partnerPanels = cellsAt(placed);
  const covered = new Set(partnerPanels.map((p) => `${p.i},${p.j}`));
  const freed = footprint.filter((p) => !covered.has(`${p.i},${p.j}`))
    .sort((a, b) => geo.chebyshev(a, from) - geo.chebyshev(b, from) || a.i - b.i || a.j - b.j);
  const landing = freed[0] ?? { ...anchor };

  // Everybody else standing under the new footprint, with the mover already gone.
  const moved = {
    ...board,
    units: (board?.units ?? []).map((u) => (u.id === mover.id ? { ...u, panel: landing, panels: [landing] } : u)),
  };
  const knockback = knockbackPlan({ ...partner, panels: partnerPanels }, partnerPanels, moved);
  return { mover: landing, partner: placed, partnerPanels, knockback };
}
