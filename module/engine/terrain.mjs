/**
 * @file Creating, finding, moving and removing terrain areas.
 * @see docs/42-terrain.md §42.7
 *
 * Layer 3.
 *
 * `rules/terrain.mjs` is the READ half — the catalogue, the standing effects,
 * the periodics, the on-entry clauses and `phaseAt` — and has been complete and
 * tested since C1. This is the write half, which did not exist at all: every
 * terrain area in the game had to be drawn by hand as a Region, and
 * `terrainConversions` (the function that answers *"what ground does this
 * attack change"*) had no caller anywhere in the codebase.
 *
 * Areas are `RegionDocument`s carrying an `fgt.terrain` behaviour, which is
 * precisely what `engine/board.mjs#terrainAreasOf` already reads. So nothing on
 * the read side changes, and a painted area is indistinguishable from a
 * hand-drawn one the moment it exists.
 *
 * **Everything here is keyed on `tag`.** A painted area has to be findable when
 * its cause ends — Quetzalcoatl's `Sol` erases its daylight when the buff
 * expires, her Piedra Del Sol erases its Burning when the field closes — and a
 * Region carries no other handle back to what made it. A GM's own terrain has
 * no tag, which is what keeps it out of every sweep in this file.
 */

import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { chebyshevDisc } from "../domain/geometry.mjs";

/**
 * The terrain behaviours on this scene, with their Regions.
 *
 * @returns {Array<{region: object, behavior: object}>}
 */
function terrainBehaviors() {
  /** @type {Array<{region: object, behavior: object}>} */
  const out = [];
  for (const region of canvas?.scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "terrain" || behavior.disabled) continue;
      out.push({ region, behavior });
    }
  }
  return out;
}

/**
 * The Regions a tag created.
 *
 * @param {string} tag
 * @returns {object[]}
 */
export function terrainRegionsFor(tag) {
  if (!tag) return [];
  return terrainBehaviors()
    .filter(({ behavior }) => behavior.system?.tag === tag)
    .map(({ region }) => region);
}

/**
 * The current tick, or 0 outside combat.
 * @returns {number}
 */
function nowTick() {
  return game.combat?.system?.globalTurn ?? 0;
}

/**
 * Paint an area of terrain.
 *
 * Re-painting an existing tag MOVES it rather than adding a second area: a
 * following area moves every time its source does, and accumulating one Region
 * per step would leave a comet trail of daylight behind Quetzalcoatl.
 *
 * @param {object} args
 * @param {string[]} args.types one or more keys of `rules/terrain.mjs`'s TERRAIN
 * @param {Array<{i: number, j: number}>} args.panels
 * @param {string} args.tag how this area is found again
 * @param {string|null} [args.duration] a ◈ expression; `null` is permanent
 * @param {string|null} [args.sourceUnitId]
 * @param {boolean} [args.followsSource]
 * @param {number|null} [args.radius] the radius to redraw a following area at
 * @returns {Promise<{ok: boolean, regionId?: string, reason?: string}>}
 */
export async function paintTerrain({
  types, panels, tag,
  duration = null, sourceUnitId = null, followsSource = false, radius = null,
}) {
  const scene = canvas?.scene;
  if (!scene) return { ok: false, reason: "noScene" };
  if (!Array.isArray(types) || types.length === 0) return { ok: false, reason: "noTypes" };
  if (!Array.isArray(panels) || panels.length === 0) return { ok: false, reason: "noPanels" };

  await clearTerrain(tag);

  const size = scene.grid.size;
  const shapes = panels.map((p) => ({
    type: "rectangle",
    x: p.j * size, y: p.i * size, width: size, height: size,
    rotation: 0, hole: false,
  }));

  const tick = nowTick();
  const created = await scene.createEmbeddedDocuments("Region", [{
    name: `${types.join("/")} (${tag})`,
    shapes,
    behaviors: [{
      type: "terrain",
      system: {
        types, duration, sourceUnitId, followsSource, radius, tag,
        createdOnTurn: tick,
        // An expiry rather than a countdown, for the reason §7.5 gives.
        expiry: duration
          ? tick + resolveTicks(parseTick(duration), {
            turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
          })
          : null,
      },
    }],
  }]);

  return { ok: true, regionId: created[0]?.id };
}

/**
 * Erase every area a tag created.
 *
 * @param {string} tag
 * @returns {Promise<{ok: boolean, removed: number}>}
 */
export async function clearTerrain(tag) {
  const scene = canvas?.scene;
  if (!scene || !tag) return { ok: false, removed: 0 };
  const ids = terrainRegionsFor(tag).map((r) => r.id);
  if (ids.length === 0) return { ok: true, removed: 0 };
  await scene.deleteEmbeddedDocuments("Region", ids);
  return { ok: true, removed: ids.length };
}

/**
 * Move every following area whose source is this unit.
 *
 * > *"The created Terrain Effect area will not follow its user unless stated."*
 *
 * `followsSource` is that exception, and `data/regions.mjs` declared it naming
 * Quetzalcoatl's `Sol` as the case it was declared for. This is the reader it
 * has been waiting for. Called after a move COMMITS, so the daylight arrives
 * with her rather than a step behind.
 *
 * @param {string} unitId
 * @param {{i: number, j: number}|null} panel where the unit now is
 * @returns {Promise<number>} how many areas moved
 */
export async function repaintFollowing(unitId, panel) {
  if (!unitId || !panel) return 0;
  let moved = 0;

  for (const { behavior } of terrainBehaviors()) {
    const sys = behavior.system ?? {};
    if (!sys.followsSource || sys.sourceUnitId !== unitId || !sys.tag) continue;
    const result = await paintTerrain({
      types: sys.types ?? [],
      // Unbounded: a Region drawn partly off the map is clipped by the canvas,
      // and clamping here would silently shrink the area near an edge.
      panels: chebyshevDisc(panel, sys.radius ?? 2, null),
      tag: sys.tag,
      // The duration is NOT re-resolved: a repaint moves the area, it does not
      // renew it. Passing `duration` again would restart the clock every time
      // she takes a step and make a 1◈ buff permanent for as long as she walks.
      duration: null,
      sourceUnitId: unitId,
      followsSource: true,
      radius: sys.radius ?? 2,
    });
    if (result.ok) {
      // Carry the ORIGINAL expiry across, since `paintTerrain` computed none.
      const region = terrainRegionsFor(sys.tag)[0];
      const fresh = region?.behaviors?.find((b) => b.type === "terrain");
      if (fresh && sys.expiry !== null) await fresh.update({ "system.expiry": sys.expiry });
      moved += 1;
    }
  }
  return moved;
}

/**
 * Remove every painted area whose expiry tick has passed.
 *
 * A hand-drawn Region carries no `expiry`, so a GM's own terrain is never
 * swept — which is what the tag/expiry pair is for.
 *
 * @param {number} tick
 * @returns {Promise<number>} how many areas were removed
 */
export async function expireTerrain(tick) {
  const scene = canvas?.scene;
  if (!scene) return 0;

  const doomed = new Set();
  for (const { region, behavior } of terrainBehaviors()) {
    const expiry = behavior.system?.expiry;
    if (typeof expiry === "number" && expiry <= tick) doomed.add(region.id);
  }
  if (doomed.size === 0) return 0;

  await scene.deleteEmbeddedDocuments("Region", [...doomed]);
  return doomed.size;
}

/**
 * Strip one terrain type from a set of panels, whoever drew them.
 *
 * The Meadow clause — *"the panel reverts to normal at the end of the Damage
 * Step"* — acts on map terrain a GM placed, which carries no tag. So this is
 * addressed by type and panel rather than by tag, and it is the only function
 * here that touches a Region it did not create.
 *
 * A Region carrying several types loses one and keeps the rest; a Region whose
 * last type is stripped is deleted, because an area of nothing is not an area.
 *
 * @param {string} type
 * @param {Array<{i: number, j: number}>} panels
 * @returns {Promise<number>} how many behaviours were touched
 */
export async function removeTerrainType(type, panels) {
  const scene = canvas?.scene;
  if (!scene) return 0;
  const size = scene.grid.size;
  const wanted = new Set((panels ?? []).map((p) => `${p.i},${p.j}`));
  let touched = 0;

  for (const { region, behavior } of terrainBehaviors()) {
    const types = behavior.system?.types ?? [];
    if (!types.includes(type)) continue;
    const covers = (region.shapes ?? []).some(
      (s) => wanted.has(`${Math.floor(s.y / size)},${Math.floor(s.x / size)}`),
    );
    if (!covers) continue;

    const rest = types.filter((t) => t !== type);
    if (rest.length === 0) await region.delete();
    else await behavior.update({ "system.types": rest });
    touched += 1;
  }
  return touched;
}
