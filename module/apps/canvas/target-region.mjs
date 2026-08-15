/**
 * @file The targeted area, as a real Region on the scene.
 * @see docs/28-targeting-implementation.md §28.5, docs/09-targeting.md
 *
 * Layer 4.
 *
 * Chapter 28 ruled Regions out for transient targeting (D28.9), for three
 * reasons: the geometry did not fit, the documents are heavyweight, and
 * querying them is racy. v14's **`GridShapeData`** answers the first outright —
 * a shape is now *"any arbitrary set of grid squares, as defined by their grid
 * offset"*, which is exactly what `resolveTargets` already returns — so the
 * region is a faithful drawing of the resolution rather than a polygon
 * approximation of it.
 *
 * The other two objections are answered by *when* the region exists rather than
 * by the shape type:
 *
 * - **Not racy**, because nothing is ever read back from it. The prototype's
 *   bug was spawning a region and then asking it who was inside; here the units
 *   are already known — the resolver decided them, in L2, synchronously — and
 *   the region is only ever written. `RegionDocument#tokens` is never touched.
 * - **Not leaked**, because every region is tagged transient and swept. It is
 *   created when a placement is committed, not on every pointer move, and
 *   discarded in a `finally`; anything that survives a disconnect is cleaned up
 *   by the GM at `ready`.
 *
 * Players cannot create scene documents, so creation and deletion are proxied
 * through the GM like every other write they are not entitled to make.
 */

const TRANSIENT_FLAG = "transientTarget";

/**
 * The `shapes` payload for a set of panels.
 *
 * Offsets are `{i, j}` **objects**, which is what `GridShapeData` validates
 * against — a `[i, j]` pair is rejected with *"i: may not be undefined"*. Handy,
 * because that is already the shape a `GridOffset` has everywhere else here, so
 * the panels go through unchanged.
 *
 * @param {Array<{i: number, j: number}>} panels
 * @returns {object[]}
 */
export function gridShape(panels) {
  return [{
    type: "grid",
    offsets: panels.map((p) => ({ i: p.i, j: p.j })),
    // Null anchors the shape at the first offset, which is already an absolute
    // board position — the resolver works in absolute panels, not in deltas.
    origin: null,
  }];
}

/**
 * Put the resolved area on the scene.
 *
 * @param {Array<{i: number, j: number}>} panels the resolver's panel set
 * @param {object} [opts]
 * @param {string} [opts.name] the ability's name, so the region is identifiable
 * @param {string} [opts.color] the faction colour
 * @returns {Promise<string|null>} the region's id, or `null` if it could not be placed
 */
export async function showArea(panels, { name = "Targeting", color = "#4488ff" } = {}) {
  if (!panels?.length || !canvas?.scene) return null;

  const data = {
    name: `${name} (targeting)`,
    color,
    shapes: gridShape(panels),
    // Visible while it exists, and it exists only while the player is deciding.
    visibility: CONST.REGION_VISIBILITY?.ALWAYS ?? 2,
    flags: { fgt: { [TRANSIENT_FLAG]: true } },
  };

  try {
    if (game.user.isGM) {
      const [region] = await canvas.scene.createEmbeddedDocuments("Region", [data]);
      return region?.id ?? null;
    }
    const { FGTSocket } = await import("../../net/socket.mjs");
    const result = await FGTSocket.request("createTargetRegion", { sceneId: canvas.scene.id, data });
    return result?.regionId ?? null;
  } catch (err) {
    // The area is an illustration, not the resolution. Losing it must not lose
    // the attack, so this reports and returns rather than throwing.
    console.warn("FGT | Could not place the targeting region", err);
    return null;
  }
}

/**
 * Remove a placed area.
 *
 * @param {string|null} regionId
 * @returns {Promise<void>}
 */
export async function discardArea(regionId) {
  if (!regionId || !canvas?.scene) return;
  try {
    if (game.user.isGM) {
      await canvas.scene.deleteEmbeddedDocuments("Region", [regionId]);
      return;
    }
    const { FGTSocket } = await import("../../net/socket.mjs");
    await FGTSocket.request("deleteTargetRegion", { sceneId: canvas.scene.id, regionId });
  } catch (err) {
    console.warn("FGT | Could not discard the targeting region", err);
  }
}

/**
 * Delete every transient targeting region left on a scene.
 *
 * A region is discarded in a `finally`, so the only way one survives is a
 * client that stopped existing mid-decision — a refresh, a crash, a closed
 * laptop. Sweeping at `ready` is what keeps "documents leak" from being true of
 * this design rather than merely unlikely.
 *
 * @returns {Promise<number>} how many were removed
 */
export async function sweepTransientRegions() {
  if (!game.user.isGM) return 0;
  let removed = 0;
  for (const scene of game.scenes ?? []) {
    const stale = scene.regions.filter((r) => r.getFlag("fgt", TRANSIENT_FLAG)).map((r) => r.id);
    if (stale.length === 0) continue;
    await scene.deleteEmbeddedDocuments("Region", stale);
    removed += stale.length;
  }
  if (removed > 0) console.log(`FGT | Swept ${removed} leftover targeting region(s)`);
  return removed;
}
