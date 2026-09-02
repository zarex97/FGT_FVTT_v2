/**
 * @file The Token placeable — which level accepts a click.
 * @see docs/20-platforms-and-levels.md §20.2
 *
 * Layer 4 (presentation). One override, for one problem: a platform is a
 * **9×9 token**, and a 9×9 token's hit area covers eighty other panels.
 *
 * `PlaceablesLayer` sorts its children by `elevation → sort → zIndex →
 * insertion order` and PIXI picks the topmost, so the Hanging Gardens at
 * elevation 20 sat above the entire board. Clicking a Servant standing
 * underneath it selected the Gardens; clicking a Servant standing *on* it
 * selected the Gardens as well, because platform and passengers share an
 * elevation and the tie fell through to insertion order — where the platform,
 * created last, won.
 *
 * The second half is fixed by `sort` (`engine/platforms.mjs`), which is the
 * field Foundry provides for exactly that tie. The first half cannot be:
 * `sort` only breaks ties *within* one elevation, and the platform is
 * genuinely above the ground.
 *
 * So the rule is the one levels imply: **you interact with the floor you are
 * looking at.** Foundry already scopes vision and fog exploration that way
 * (`Token#_isVisionSource`, `#_isFogExplorationSource`, both `level !==
 * canvas.level.id → false`) and draws an off-level badge on anything else; it
 * simply never scoped *interaction*.
 */

const { Token } = foundry.canvas.placeables;

export class FGTToken extends Token {
  /**
   * Only the level being viewed accepts clicks.
   *
   * Overriding `isInteractable` rather than assigning `eventMode` from a hook
   * is what makes this survive: `PlaceableObject#_refreshState` re-reads this
   * getter and re-assigns `eventMode` on **every** refresh, so a hook-based fix
   * is undone by the next token update. Measured — a fix applied by hand was
   * reverted before the next click landed.
   *
   * A single-level scene is unaffected: every token's `level` is the level
   * being viewed, so this never fires. It costs nothing until a platform
   * exists, which is the only thing that creates a second level.
   *
   * @returns {boolean}
   * @override
   */
  get isInteractable() {
    if (!super.isInteractable) return false;
    // `canvas.level` is null mid-transition; refusing then would make every
    // token briefly unclickable for no reason.
    if (!canvas.level) return true;
    return this.document.level === canvas.level.id;
  }
}
