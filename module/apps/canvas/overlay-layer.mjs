/**
 * @file Persistent board overlays — ZON rings, threat ranges, Master protection.
 * @see docs/28-targeting-implementation.md §28.9
 *
 * Layer 4. Like the targeting layer, it draws and never decides: every panel it
 * fills came from the pure geometry in L1 and the ZON rules in L2.
 *
 * These are "the difference between a player planning correctly and a player
 * discovering a rule after they have committed" (§28.9). The ZON ring in
 * particular exists to prevent the most common mistake in the game — attacking
 * from outside your Master's zone and losing 5d10 for it — which is invisible
 * on an unannotated board because it depends on a radius that is a property of
 * a *pair* and differs per Servant.
 *
 * Unlike the targeting layer this one is always on, so it is driven by hover
 * and selection rather than by a session, and it never captures input.
 */

import * as geo from "../../domain/geometry.mjs";
import { zonStatus, masterOf } from "../../rules/zon.mjs";
import { unitSnapshot, currentBoard } from "../../engine/board.mjs";

/** In ZON. */
const OK = 0x44cc88;
/** Outside ZON — the state the ring exists to make visible. */
const BAD = 0xff4444;
/** An enemy's reach. */
const THREAT = 0xffaa33;
/** A Master's protection radius. */
const GUARD = 0x8899ff;

export class OverlayLayer extends foundry.canvas.layers.CanvasLayer {
  /** @inheritdoc */
  static get layerOptions() {
    return Object.assign(super.layerOptions, { name: "fgtOverlays", zIndex: 400 });
  }

  /** @type {PIXI.Graphics|null} */
  #graphics = null;

  /** The token currently hovered, if any. */
  #hovered = null;

  /** @inheritdoc */
  async _draw(options) {
    await super._draw(options);
    this.#graphics = this.addChild(new PIXI.Graphics());
    // Overlays are context, not controls: they must never eat a click meant for
    // a token underneath them.
    this.eventMode = "none";
    this.interactiveChildren = false;
    this.refresh();
  }

  /** @inheritdoc */
  async _tearDown(options) {
    this.#graphics = null;
    this.#hovered = null;
    return super._tearDown(options);
  }

  /**
   * Note which token the pointer is over, and redraw.
   * @param {object|null} token a `Token` placeable
   */
  hover(token) {
    if (this.#hovered === token) return;
    this.#hovered = token;
    this.refresh();
  }

  /**
   * Redraw every overlay that currently applies.
   *
   * Cheap enough to do wholesale: the board snapshot is one pass over the
   * placed tokens and the shapes are at most `(2r+1)²` panels with r ≤ 6.
   */
  refresh() {
    if (!this.#graphics || !canvas.ready) return;
    this.#graphics.clear();
    if (!game.settings.get("fgt", "showOverlays")) return;

    const board = currentBoard();

    for (const token of canvas.tokens?.controlled ?? []) {
      this.#drawZon(token, board);
      this.#drawProtection(token, board);
    }

    if (this.#hovered && !this.#hovered.controlled) {
      this.#drawThreat(this.#hovered, board);
      this.#drawProtection(this.#hovered, board);
    }
  }

  /* ── The ZON ring ───────────────────────────────────────────────────────── */

  /**
   * The selected Servant's own zone, drawn around its **Master**.
   *
   * Around the Master rather than the Servant because that is where the zone
   * is: the Servant is the thing that may be outside it. Red when it is, which
   * is the whole reason to draw it.
   *
   * Selecting the Master instead draws one ring per contracted Servant, since a
   * Master with three classes of Servant has three different radii (§16.3).
   *
   * @param {object} token
   * @param {object} board
   */
  #drawZon(token, board) {
    const actor = token.actor;
    if (!actor) return;

    const unit = board.units.find((u) => u.id === actor.id) ?? unitSnapshot(actor);

    if (unit.kind === "master") {
      for (const servant of board.units.filter((u) => masterOf(u, board)?.id === unit.id)) {
        const status = zonStatus(servant, board);
        if (status.zon === null) continue;
        this.#ring(status.master.panel, status.zon, status.outside ? BAD : OK, 0.06, board.bounds);
      }
      return;
    }

    const status = zonStatus(unit, board);
    if (status.zon === null) return;
    this.#ring(status.master.panel, status.zon, status.outside ? BAD : OK, 0.08, board.bounds);
  }

  /* ── Threat range ───────────────────────────────────────────────────────── */

  /**
   * How far a hovered enemy can reach, in the same octagonal shape their attack
   * will actually use — the clipped-corner Range shape, not a square.
   * @param {object} token
   * @param {object} board
   */
  #drawThreat(token, board) {
    const unit = board.units.find((u) => u.id === token.actor?.id);
    if (!unit?.panel) return;
    if (unit.kind !== "servant" && unit.kind !== "summon") return;
    this.#panels(geo.attackRangePanels(unit.panel, unit.range ?? 1, board.bounds), THREAT, 0.05);
  }

  /* ── Master protection ──────────────────────────────────────────────────── */

  /**
   * The ring inside which a Servant shields its Master.
   *
   * Drawn only when a Servant is actually standing in it, because the rule is
   * conditional and an unconditional ring would claim a protection that is not
   * there (§16.4).
   *
   * @param {object} token
   * @param {object} board
   */
  #drawProtection(token, board) {
    const unit = board.units.find((u) => u.id === token.actor?.id);
    if (unit?.kind !== "master" || !unit.panel) return;

    const guarded = board.units.some(
      (u) => u.kind === "servant" && u.faction === unit.faction && u.canAct !== false &&
        u.panel && geo.chebyshev(u.panel, unit.panel) <= 1,
    );
    if (!guarded) return;
    this.#ring(unit.panel, 1, GUARD, 0.1, board.bounds);
  }

  /* ── Drawing ────────────────────────────────────────────────────────────── */

  /**
   * A filled Chebyshev disc with an emphasised boundary.
   * @param {object} centre
   * @param {number} r
   * @param {number} colour
   * @param {number} alpha
   * @param {object|null} bounds the board's panel bounds, so a zone that runs
   *   off the map is drawn as far as the map goes
   */
  #ring(centre, r, colour, alpha, bounds = null) {
    this.#panels(geo.chebyshevDisc(centre, r, bounds), colour, alpha);
    // The outline is what makes the radius readable at a glance; the fill alone
    // reads as a smudge once two overlays overlap.
    const size = canvas.grid.size;
    const topLeft = canvas.grid.getTopLeftPoint({ i: centre.i - r, j: centre.j - r });
    this.#graphics.lineStyle(2, colour, 0.75);
    this.#graphics.beginFill(0, 0);
    this.#graphics.drawRect(topLeft.x, topLeft.y, size * (2 * r + 1), size * (2 * r + 1));
    this.#graphics.endFill();
  }

  /**
   * @param {object[]} panels
   * @param {number} colour
   * @param {number} alpha
   */
  #panels(panels, colour, alpha) {
    const size = canvas.grid.size;
    this.#graphics.beginFill(colour, alpha);
    this.#graphics.lineStyle(0);
    for (const panel of panels) {
      const { x, y } = canvas.grid.getTopLeftPoint({ i: panel.i, j: panel.j });
      this.#graphics.drawRect(x, y, size, size);
    }
    this.#graphics.endFill();
  }
}

/**
 * Register the layer. Called at `init`, before the canvas is built.
 */
export function registerOverlayLayer() {
  CONFIG.Canvas.layers.fgtOverlays = { layerClass: OverlayLayer, group: "interface" };
}

/**
 * Keep the overlays current.
 *
 * Every hook here is a thing that can change what an overlay should say: what
 * is selected, what is hovered, what has moved, and — because ZON depends on
 * the Master's position and the Servant's class — any actor update at all.
 */
export function attachOverlays() {
  const refresh = () => canvas.fgtOverlays?.refresh();

  Hooks.on("controlToken", refresh);
  Hooks.on("hoverToken", (token, hovered) => canvas.fgtOverlays?.hover(hovered ? token : null));
  Hooks.on("updateToken", refresh);
  Hooks.on("deleteToken", refresh);
  Hooks.on("createToken", refresh);
  Hooks.on("updateActor", refresh);
  Hooks.on("canvasReady", refresh);
  Hooks.on("fgtUnitMoved", refresh);
}
