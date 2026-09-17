/**
 * @file The Token placeable — which level accepts a click.
 * @see docs/27-platforms-and-levels.md
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

import { hiddenFromViewer } from "../../rules/concealment.mjs";
import { factions } from "../../engine/board.mjs";

const { Token } = foundry.canvas.placeables;

/**
 * The effect ids an actor is carrying right now.
 *
 * Off the documents rather than off a snapshot: this runs once per token per
 * visibility pass, and `snapshotUnit` assembles a unit's whole contribution set.
 *
 * @param {object} actor
 * @returns {string[]}
 */
function heldEffects(actor) {
  return [...(actor.effects ?? [])]
    .filter((e) => !e.disabled)
    .map((e) => e.system?.defId)
    .filter(Boolean);
}

/** The eight compass points clockwise from north, and their screen angles. */
const HEADINGS = Object.freeze({
  n: -90, ne: -45, e: 0, se: 45, s: 90, sw: 135, w: 180, nw: -135,
});

/**
 * Chevron size as a fraction of the token's smaller edge.
 *
 * Small on purpose. At 0.22 the marker read as a second token rather than as
 * an annotation of the first, and — seated on the edge — its tip escaped the
 * token's own square and collided with the neighbouring panel's art.
 */
const MARKER_SCALE = 0.15;

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

  /**
   * A concealed Unit is not on the canvas as far as its enemies are concerned.
   *
   * Presence Concealment's clause 1 -- *"this Unit cannot be targeted for an
   * Attack or an enemy Unit's Skill"* -- was enforced in the rules and nowhere
   * on the screen: the token sat in plain sight, with its panel, its facing and
   * its Health bar readable by everyone, so a player simply routed around a
   * Skill they could see was there. Concealment the table can see through is a
   * footnote rather than a Skill (Ch. 46 §46.4-AK).
   *
   * `rules/concealment.mjs#hiddenFromViewer` is the whole decision; this reads
   * the three facts it needs off the world and asks. Not gated on
   * `canvas.level` like the interaction override above: a concealed Unit on
   * another level is hidden for two independent reasons and Foundry's own
   * visibility test already answers the second.
   *
   * A GETTER, not `_isVisible()`. Foundry 14 has no such method -- `isVisible`
   * is a getter on `Token.prototype` and the ray-casting lives in
   * `CanvasVisibility#testVisibility` behind it. Overriding the method that
   * older versions had installs something nothing ever calls, which is a fix
   * that tests green and does nothing on the board.
   *
   * @returns {boolean}
   * @override
   */
  get isVisible() {
    if (!super.isVisible) return false;

    const actor = this.actor;
    if (!actor) return true;

    return !hiddenFromViewer(
      { factionId: actor.system?.factionId ?? null, effects: heldEffects(actor) },
      {
        userId: game.user?.id ?? null,
        isGM: Boolean(game.user?.isGM),
        isOwner: actor.testUserPermission(game.user, "OBSERVER"),
      },
      factions(),
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  The facing marker                                                       */
  /* ------------------------------------------------------------------------ */

  /**
   * The chevron that says which way this unit is facing.
   *
   * `system.facing` decides whether an Attack lands from behind
   * (`engine/attack.mjs`'s `facing` state) and it was **invisible**: the only
   * place it appeared was a dropdown inside the token HUD, which had to be
   * opened one unit at a time. A player could not see the thing the rules were
   * reading, which is the same defect as a stat with no display.
   *
   * Drawn here rather than in the overlay layer because it must follow the
   * token: `OverlayLayer` redraws on selection, hover and invalidation, none of
   * which fire on the tween of a token being dragged.
   *
   * @type {PIXI.Graphics|null}
   */
  #facing = null;

  /** @inheritdoc */
  async _draw(options) {
    await super._draw(options);
    // After `super`, so the marker is added on top of the mesh rather than
    // being wiped by the redraw that creates it.
    this.#facing = this.addChild(new PIXI.Graphics());
    this.#facing.eventMode = "none";
    this.refreshFacing();
  }

  /** @inheritdoc */
  _applyRenderFlags(flags) {
    super._applyRenderFlags(flags);
    // Position and size both move the marker; visibility and state both decide
    // whether it should be seen at all.
    if (flags.refreshPosition || flags.refreshSize || flags.refreshShape
      || flags.refreshVisibility || flags.refreshState) this.refreshFacing();
  }

  /**
   * Redraw the marker from the actor's current `system.facing`.
   *
   * Public because the actor, not the token, owns the field: nothing in
   * Foundry's own render-flag vocabulary fires when `system.facing` changes, so
   * `fgt.mjs` calls this from an `updateActor` hook.
   *
   * @returns {void}
   */
  refreshFacing() {
    const g = this.#facing;
    if (!g || g.destroyed) return;
    g.clear();

    const angle = HEADINGS[this.actor?.system?.facing];
    // `undefined` covers both "no actor" and an actor type with no facing —
    // an unfacing token draws nothing rather than defaulting to north, which
    // would assert a heading the rules are not using.
    if (angle === undefined || !this.visible) return;

    const w = this.w ?? 0;
    const h = this.h ?? 0;
    if (!(w > 0) || !(h > 0)) return;

    const size = Math.min(w, h) * MARKER_SCALE;
    const rad = (angle * Math.PI) / 180;
    // A full chevron of inset, so the TIP lands on the token's own boundary
    // and nothing crosses into the next panel. Insetting by half instead put
    // the point a whole half-chevron outside the square — measured on a 9x9
    // platform and a 1x1 Servant alike.
    const radius = Math.min(w, h) / 2 - size;
    const cx = w / 2 + Math.cos(rad) * radius;
    const cy = h / 2 + Math.sin(rad) * radius;

    const point = (offset, scale) => [
      cx + Math.cos(rad + offset) * size * scale,
      cy + Math.sin(rad + offset) * size * scale,
    ];

    // Dark outline first, so the chevron stays legible over pale artwork.
    g.lineStyle({ width: Math.max(1, size * 0.16), color: 0x0b0a13, alpha: 0.9, alignment: 0.5 });
    g.beginFill(0xc9a227, 0.95);
    g.drawPolygon([
      ...point(0, 1),
      ...point(Math.PI * 0.72, 0.85),
      ...point(Math.PI, 0.28),
      ...point(-Math.PI * 0.72, 0.85),
    ]);
    g.endFill();
  }
}
