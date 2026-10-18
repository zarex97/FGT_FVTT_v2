/**
 * @file The Tile placeable: a ghost's stand-in body, drawn per viewer.
 * @see engine/feigned-defeat.mjs, rules/concealment.mjs#hiddenFromViewer
 *
 * A Feigned Defeat leaves a skulled body where the Unit fell, for every player
 * but its owners (#249 reading 33). A Tile's `hidden` is one value for every
 * client, so the body is answered here, per viewer, as the token's own
 * visibility is (`apps/canvas/token.mjs`). Every other Tile is untouched.
 */

import { decoyOf } from "../../engine/feigned-defeat.mjs";

export class FGTTile extends foundry.canvas.placeables.Tile {
  /**
   * A stand-in body: seen by the GM and by everyone deceived, never by the
   * ghost's own owners, who see the ghost itself.
   *
   * @returns {boolean}
   * @override
   */
  get isVisible() {
    const of = decoyOf(this.document);
    if (!of || game.user?.isGM) return super.isVisible;
    const actor = game.actors?.get(of) ?? null;
    if (actor?.testUserPermission(game.user, "OWNER")) return false;
    return super.isVisible;
  }
}
