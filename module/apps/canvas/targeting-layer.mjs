/**
 * @file The targeting canvas layer — it draws, and never decides.
 * @see docs/28-targeting-implementation.md §28.5
 *
 * Layer 4. Every panel it fills and every token it outlines came from
 * `legalPlacements`, which is pure and lives in L2. Nothing here knows what a
 * Range is, what an anchor is, or why a placement is illegal — it asks, and
 * paints the answer.
 *
 * Four interactions, one function behind all of them (D28.2, D28.4):
 *
 * | Anchor | Mode | Interaction |
 * |---|---|---|
 * | `selfEdgeAdjacent` | A | four ghosts at once, one click |
 * | `withinRange`      | B | free placement inside a dimmed range overlay |
 * | `targetUnit`       | C | unit picker |
 * | anything else      | D | resolves with nothing to ask |
 *
 * Mode A is the important one. Showing all four legal directions
 * simultaneously, tinted by legality, replaces the prototype's
 * spawn-preview-confirm-redo loop with a single click and requires the player
 * to know no rules at all.
 */

import { legalPlacements, validate } from "../../rules/targeting/resolve.mjs";
import { TargetingHUD } from "./targeting-hud.mjs";

const LEGAL = 0x4488ff;
const ILLEGAL = 0xff4444;

export class TargetingLayer extends foundry.canvas.layers.InteractionLayer {
  /** @inheritdoc */
  static get layerOptions() {
    return Object.assign(super.layerOptions, { name: "fgtTargeting", zIndex: 500 });
  }

  /** The graphics the current session has drawn. */
  #graphics = null;

  /** The in-flight session, or `null` when nothing is being targeted. */
  #session = null;

  /** @inheritdoc */
  async _draw(options) {
    await super._draw(options);
    this.#graphics = this.addChild(new PIXI.Graphics());
  }

  /** @inheritdoc */
  async _tearDown(options) {
    this.#cancel();
    return super._tearDown(options);
  }

  /**
   * Run a targeting session and resolve with the player's placement.
   *
   * Resolves with `null` when the player cancels, which callers must treat as
   * "do nothing" rather than as an error — a cancelled targeting is the most
   * common outcome of opening one.
   *
   * @param {object} args
   * @param {object} args.spec a `TargetSpec`
   * @param {object} args.caster the caster's unit snapshot
   * @param {object} args.board the board snapshot
   * @param {object} [args.preview] `{label, damageFor}` for the HUD
   * @returns {Promise<object|null>} the chosen placement
   */
  async pick({ spec, caster, board, preview = {} }) {
    this.#cancel();
    this.activate();

    const options = legalPlacements(spec, caster, board);
    const hud = new TargetingHUD({ label: preview.label, damageFor: preview.damageFor });

    const mode = spec.anchor?.kind ?? "self";
    try {
      switch (mode) {
        case "selfEdgeAdjacent": return await this.#directionPicker(options, hud);
        case "withinRange": return await this.#freePlacement(spec, caster, board, options, hud);
        case "targetUnit": return await this.#unitPicker(options, hud, board);
        default: return options[0]?.legal ? options[0].placement : null;
      }
    } finally {
      this.#cancel();
      hud.close();
    }
  }

  /* ── Mode A — the direction picker ──────────────────────────────────────── */

  /**
   * All four directions, drawn at once. Hover brings one forward, arrow keys
   * cycle, click or Enter confirms, Escape cancels.
   *
   * @param {object[]} options
   * @param {TargetingHUD} hud
   * @returns {Promise<object|null>}
   */
  async #directionPicker(options, hud) {
    let focused = options.findIndex((o) => o.legal);
    if (focused === -1) focused = 0;

    const render = () => {
      this.#graphics.clear();
      options.forEach((option, index) => {
        // The focused ghost is drawn last and opaque, so it reads as the one
        // being chosen without hiding the alternatives.
        const alpha = index === focused ? 0.3 : (option.legal ? 0.12 : 0.06);
        this.#drawPanels(option.resolved.panels, option.legal ? LEGAL : ILLEGAL, alpha);
      });
      const current = options[focused];
      this.#outlineUnits(current.resolved.units, current.legal ? LEGAL : ILLEGAL);
      hud.update(current);
    };

    render();

    return this.#await({
      onKey: (key) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[key];
        if (step === undefined) return null;
        focused = (focused + step + options.length) % options.length;
        render();
        return null;
      },
      onPointerMove: (panel) => {
        const hit = options.findIndex((o) => o.resolved.panels.some((p) => p.i === panel.i && p.j === panel.j));
        if (hit === -1 || hit === focused) return;
        focused = hit;
        render();
      },
      onConfirm: () => (options[focused].legal ? options[focused].placement : null),
    });
  }

  /* ── Mode B — free placement ────────────────────────────────────────────── */

  /**
   * @param {object} spec
   * @param {object} caster
   * @param {object} board
   * @param {object[]} options
   * @param {TargetingHUD} hud
   * @returns {Promise<object|null>}
   */
  async #freePlacement(spec, caster, board, options, hud) {
    const reachable = options.filter((o) => o.legal);
    let current = null;

    const render = () => {
      this.#graphics.clear();
      // The dimmed range overlay is persistent context: it answers "where could
      // I put this?" without the player having to sweep the pointer to find out.
      this.#drawPanels(reachable.map((o) => o.placement.panel), LEGAL, 0.08);
      if (!current) return hud.update(null);
      this.#drawPanels(current.resolved.panels, current.legal ? LEGAL : ILLEGAL, 0.28);
      this.#outlineUnits(current.resolved.units, current.legal ? LEGAL : ILLEGAL);
      hud.update(current);
    };

    render();

    return this.#await({
      onPointerMove: (panel) => {
        if (current?.placement.panel.i === panel.i && current?.placement.panel.j === panel.j) return;
        const v = validate(spec, caster, board, { panel });
        current = { placement: { panel }, legal: v.ok, reasons: v.reasons, resolved: v.resolved };
        render();
      },
      onConfirm: () => (current?.legal ? current.placement : null),
    });
  }

  /* ── Mode C — the unit picker ───────────────────────────────────────────── */

  /**
   * @param {object[]} options
   * @param {TargetingHUD} hud
   * @param {object} board
   * @returns {Promise<object|null>}
   */
  async #unitPicker(options, hud, board) {
    const selectable = options.filter((o) => o.legal);
    if (selectable.length === 0) {
      ui.notifications.warn(game.i18n.localize("FGT.Targeting.NoTargets"));
      return null;
    }
    let focused = 0;

    const render = () => {
      this.#graphics.clear();
      for (const option of options) {
        const unit = board.units.find((u) => u.id === option.placement.unitId);
        if (!unit) continue;
        this.#drawPanels(unit.panels ?? [unit.panel], option.legal ? LEGAL : ILLEGAL, 0.1);
      }
      const current = selectable[focused];
      this.#outlineUnits(current.resolved.units, LEGAL);
      hud.update(current);
    };

    render();

    return this.#await({
      onKey: (key) => {
        if (key !== "Tab") return null;
        focused = (focused + 1) % selectable.length;
        render();
        return null;
      },
      onPointerMove: (panel) => {
        const hit = selectable.findIndex((o) => {
          const unit = board.units.find((u) => u.id === o.placement.unitId);
          return (unit?.panels ?? [unit?.panel]).some((p) => p && p.i === panel.i && p.j === panel.j);
        });
        if (hit === -1 || hit === focused) return;
        focused = hit;
        render();
      },
      onConfirm: () => selectable[focused].placement,
    });
  }

  /* ── Drawing ────────────────────────────────────────────────────────────── */

  /**
   * @param {object[]} panels
   * @param {number} colour
   * @param {number} alpha
   */
  #drawPanels(panels, colour, alpha) {
    const size = canvas.grid.size;
    this.#graphics.beginFill(colour, alpha);
    // A solid border on a legal panel and a dashed feel on an illegal one:
    // colour is never the only signal (§28.10).
    this.#graphics.lineStyle(2, colour, Math.min(1, alpha + 0.4));
    for (const panel of panels) {
      const { x, y } = canvas.grid.getTopLeftPoint({ i: panel.i, j: panel.j });
      this.#graphics.drawRect(x, y, size, size);
    }
    this.#graphics.endFill();
  }

  /**
   * @param {object[]} units
   * @param {number} colour
   */
  #outlineUnits(units, colour) {
    this.#graphics.lineStyle(3, colour, 0.9);
    this.#graphics.beginFill(0, 0);
    for (const target of units) {
      const token = canvas.tokens.placeables.find((t) => t.actor?.id === target.unitId);
      if (!token) continue;
      this.#graphics.drawRect(token.x, token.y, token.w, token.h);
    }
    this.#graphics.endFill();
  }

  /* ── Interaction plumbing ───────────────────────────────────────────────── */

  /**
   * Wire the pointer and keyboard, and resolve when the player commits.
   *
   * One listener set for all three modes, removed in exactly one place, so a
   * cancelled session cannot leave the canvas listening.
   *
   * @param {object} handlers
   * @returns {Promise<object|null>}
   */
  #await({ onPointerMove = null, onKey = null, onConfirm }) {
    return new Promise((resolve) => {
      const stage = canvas.stage;

      const move = (event) => {
        if (!onPointerMove) return;
        const point = event.data.getLocalPosition(canvas.stage);
        onPointerMove(canvas.grid.getOffset(point));
      };
      const click = () => finish(onConfirm());
      const right = () => finish(null);
      const key = (event) => {
        if (event.key === "Escape") return finish(null);
        if (event.key === "Enter" || event.key === " ") return finish(onConfirm());
        if (onKey) onKey(event.key);
        // Tab and the arrows would otherwise move focus out of the canvas.
        if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
        }
        return undefined;
      };

      const finish = (value) => {
        stage.off("pointermove", move);
        stage.off("pointerdown", click);
        stage.off("rightdown", right);
        window.removeEventListener("keydown", key, true);
        this.#session = null;
        resolve(value ?? null);
      };

      stage.on("pointermove", move);
      stage.on("pointerdown", click);
      stage.on("rightdown", right);
      window.addEventListener("keydown", key, true);
      this.#session = { finish };
    });
  }

  /** Abandon any session in flight and clear the drawing. */
  #cancel() {
    this.#session?.finish(null);
    this.#session = null;
    this.#graphics?.clear();
  }
}

/**
 * Register the layer. Called at `init`, before the canvas is built.
 */
export function registerTargetingLayer() {
  CONFIG.Canvas.layers.fgtTargeting = { layerClass: TargetingLayer, group: "interface" };
}

/**
 * Run a targeting session on the active canvas.
 *
 * @param {object} args see `TargetingLayer#pick`
 * @returns {Promise<object|null>}
 */
export function pickTarget(args) {
  const layer = canvas.fgtTargeting;
  if (!layer) throw new Error("FGT | The targeting layer is not on the canvas.");
  return layer.pick(args);
}
