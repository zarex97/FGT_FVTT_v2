/**
 * @file Building the board a war is fought on.
 * @see docs/08-board-and-geometry.md §8.9, docs/19-environment.md §19.1, §19.7
 *
 * Layer 3. `rules/home-base.mjs` says where the bases go; this puts them there.
 *
 * Ch. 08 §8.9's grid table has been advisory since it was written — there is no
 * `Scene.create` anywhere in `module/` and nothing checks a scene's grid — so a
 * war fought on a hex scene, or one with `distance: 5`, would misreport every
 * range in the game with no warning at all.
 */

import { homeBaseRects } from "../rules/home-base.mjs";
import { gridShape } from "../domain/geometry.mjs";

/**
 * Ch. 08 §8.9, as data.
 *
 * `diagonals: ILLEGAL` is right for MOVEMENT and wrong for DISTANCE — ZON and
 * every "N panel area" are Chebyshev — which is why this system carries its own
 * `chebyshev()` and `domain/geometry.mjs` deliberately exports no function
 * named `distance`. The setting governs Foundry's ruler, not this system's
 * rules, so it is set for the ruler's sake.
 */
export const GRID_REQUIREMENTS = Object.freeze({
  "grid.type": 1,          // CONST.GRID_TYPES.SQUARE
  "grid.distance": 1,
  "grid.units": "panels",
  "grid.diagonals": 6,     // CONST.GRID_DIAGONALS.ILLEGAL
});

/** Pixels per panel. Arbitrary, and the value every existing scene uses. */
const GRID_SIZE = 100;

/**
 * Every way this scene's grid disagrees with §8.9.
 *
 * Reported rather than corrected on sight: a GM who set `distance: 5`
 * deliberately is owed the question, and a silent rewrite of someone's map
 * configuration is the kind of help nobody asked for.
 *
 * @param {object} scene
 * @returns {Array<{key: string, want: unknown, got: unknown}>}
 */
export function gridMismatches(scene) {
  /** @type {Array<{key: string, want: unknown, got: unknown}>} */
  const out = [];
  for (const [key, want] of Object.entries(GRID_REQUIREMENTS)) {
    const got = foundry.utils.getProperty(scene ?? {}, key);
    if (got !== want) out.push({ key, want, got });
  }
  return out;
}

/**
 * The scene a war is fought on, created or corrected.
 *
 * @param {{size: number, name: string, sceneId?: string|null}} options
 * @returns {Promise<object>} the Scene
 */
export async function ensureScene({ size, name, sceneId = null }) {
  if (sceneId) {
    const existing = game.scenes.get(sceneId);
    if (!existing) throw new Error(`No such scene: ${sceneId}`);
    const wrong = gridMismatches(existing);
    if (wrong.length > 0) {
      await existing.update(Object.fromEntries(wrong.map(({ key, want }) => [key, want])));
    }
    if (!existing.active) await existing.activate();
    return existing;
  }

  const [scene] = await Scene.implementation.create([{
    name,
    width: size * GRID_SIZE,
    height: size * GRID_SIZE,
    padding: 0,
    // `background` is left unset on purpose. A blank grid is a playable board;
    // a map is the GM's, and inventing one would be a decision nobody asked for.
    grid: {
      type: GRID_REQUIREMENTS["grid.type"],
      size: GRID_SIZE,
      distance: GRID_REQUIREMENTS["grid.distance"],
      units: GRID_REQUIREMENTS["grid.units"],
      diagonals: GRID_REQUIREMENTS["grid.diagonals"],
    },
  }]);
  await scene.activate();
  return scene;
}

/**
 * Draw one Region per faction and tag it as that faction's Home Base.
 *
 * **The behaviour is created separately**, and that is not a style choice:
 * passing it inline in the Region's creation data is accepted without complaint
 * and silently produces a Region with an empty `behaviors` collection
 * (`engine/fields.mjs` records the same discovery about bounded fields). A home
 * base carrying no `factionId` is invisible to `homeBaseZonesOf`, which is
 * exactly the failure this whole flow exists to end.
 *
 * The shape is a **grid shape**, never a bounding rectangle. `shapeOf` once
 * stored a field's Region as the bounding box of its panels while
 * `boundedFieldsOf` read the panels back OFF the Region, so any non-rectangular
 * area silently filled in its own notches. A Great Holy Grail War base is a
 * rectangle and would have survived that; a Holy Grail War perimeter block is
 * an L or a U and would not.
 *
 * Existing home-base Regions are deleted first: setting a war up twice on one
 * scene must not leave the first war's bases under the second's, because
 * `ownBaseOf` tests membership of ANY tagged region owned by the faction.
 *
 * @param {object} scene
 * @param {Array<{factionId: string, offsets: Array<{i: number, j: number}>}>} rects
 * @param {Array<{id: string, name: string, color: string}>} [roster] for names and colours
 * @returns {Promise<object[]>} the created RegionDocuments
 */
export async function paintHomeBases(scene, rects, roster = []) {
  const stale = scene.regions
    .filter((r) => r.behaviors.some((b) => b.type === "homeBase"))
    .map((r) => r.id);
  if (stale.length > 0) await scene.deleteEmbeddedDocuments("Region", stale);

  /** @type {object[]} */
  const created = [];
  for (const { factionId, offsets } of rects) {
    const faction = roster.find((f) => f.id === factionId) ?? null;
    const [region] = await scene.createEmbeddedDocuments("Region", [{
      name: `Home Base — ${faction?.name ?? factionId}`,
      shapes: gridShape(offsets),
      color: faction?.color ?? null,
      // Drawn for everyone: a home base is public information, and a player who
      // cannot see where theirs ends cannot use the five rules inside it.
      visibility: 2,   // CONST.REGION_VISIBILITY.ALWAYS
    }]);
    if (!region) continue;

    await region.createEmbeddedDocuments("RegionBehavior", [{
      name: "Home Base",
      type: "homeBase",
      // `isSecondary` is false: the only secondary base in the game is
      // Semiramis's Hanging Gardens, and that one is not a Region at all --
      // it moves, and `ownBaseOf` reads `unit.platformId` for it.
      system: { factionId, isSecondary: false },
    }]);
    created.push(region);
  }
  return created;
}

/**
 * The rectangles for a draft, so the wizard can preview them before committing.
 *
 * A thin pass-through, but it is the one place the board's bounds are read off
 * the *draft* rather than off a scene that may not exist yet.
 *
 * @param {{warType: string, boardSize: number, homeBaseDepth: number}} draft
 * @param {Array<{id: string}>} factions
 * @returns {Array<{factionId: string, offsets: Array<{i: number, j: number}>}>}
 */
export function plannedBases(draft, factions) {
  return homeBaseRects(draft.warType, factions, {
    rows: draft.boardSize,
    columns: draft.boardSize,
    depth: draft.homeBaseDepth,
  });
}
