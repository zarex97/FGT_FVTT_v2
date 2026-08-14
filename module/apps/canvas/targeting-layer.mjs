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
import { showArea, discardArea } from "./target-region.mjs";
import { reviewTargets, REAIM } from "./target-review.mjs";
import { faction as factionById } from "../../engine/board.mjs";

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
    const label = preview.label ?? game.i18n.localize("FGT.Chat.NormalAttack");
    // Say what the controls are before taking over the canvas. A player who is
    // not told that Tab cycles and Escape cancels reasonably concludes the
    // system has hung.
    announce(label, mode);

    // Every area ever put on the board this session, not only the one that
    // survived: a player who re-aims three times has drawn three, and all three
    // are discarded together.
    const placed = [];

    try {
      // Aim, look at who it caught, and go back to aiming if that was not what
      // was meant. Re-placing is how the area is moved, so there is no second
      // set of controls and nothing is left on the board while the dialog is up.
      for (;;) {
        const placement = await this.#run(mode, { spec, caster, board, options, hud });
        if (!placement) return null;

        const resolved = validate(spec, caster, board, placement).resolved;

        // The area goes on the scene as a real grid-shape Region once a
        // placement is committed -- not on every pointer move, which is what
        // made documents the wrong tool for the aiming itself.
        const regionId = await showArea(resolved.panels, {
          name: label,
          color: factionColor(caster),
        });
        if (regionId) placed.push(regionId);

        const chosen = await this.#confirm({ resolved, label, preview, mode });
        if (chosen === REAIM) continue;
        if (chosen === null) return null;

        // The resolution is the truth about who is being attacked; Foundry's own
        // target set is told about it so the rest of the world agrees (D28.8).
        mirrorTargets(resolved.units.filter((u) => chosen.includes(u.unitId)));
        return { ...placement, chosenIds: chosen };
      }
    } finally {
      // Runs before the attack resolves, so the area is gone by the time the
      // chat card exists.
      await Promise.all(placed.map(discardArea));
      this.#cancel();
      hud.close();
    }
  }

  /**
   * The confirmation step, or a straight pass when it is switched off.
   *
   * A per-client setting: one player wanting to confirm every attack should not
   * impose a dialog on a table that does not.
   *
   * @param {object} args
   * @returns {Promise<string[]|symbol|null>}
   */
  async #confirm({ resolved, label, preview, mode }) {
    if (!game.settings.get("fgt", "targetingReview")) {
      return resolved.units.map((u) => u.unitId);
    }
    return reviewTargets({
      resolved,
      label,
      damageFor: preview.damageFor ?? null,
      // An anchor that resolves without a choice has nowhere else to be put, so
      // offering a button that visibly does nothing is worse than not offering
      // one.
      canReaim: mode === "selfEdgeAdjacent" || mode === "withinRange" || mode === "targetUnit",
    });
  }

  /**
   * Dispatch to the interaction this anchor calls for.
   * @param {string} mode
   * @param {object} args
   * @returns {Promise<object|null>}
   */
  async #run(mode, { spec, caster, board, options, hud }) {
    switch (mode) {
      case "selfEdgeAdjacent": return this.#directionPicker(options, hud);
      case "withinRange": return this.#freePlacement(spec, caster, board, options, hud);
      case "targetUnit": return this.#unitPicker(options, hud, board);
      default:
        if (options[0]?.legal) return options[0].placement;
        reportNothingLegal(options, board);
        return null;
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
      reportNothingLegal(options, board);
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

/* -------------------------------------------------------------------------- */
/*  Telling the player what happened                                           */
/* -------------------------------------------------------------------------- */

/** @type {Readonly<Record<string, string>>} */
const MODE_HINTS = Object.freeze({
  selfEdgeAdjacent: "FGT.Targeting.ModeDirection",
  withinRange: "FGT.Targeting.ModePanel",
  targetUnit: "FGT.Targeting.ModeUnit",
});

/**
 * Announce the session and its controls.
 * @param {string} label
 * @param {string} mode
 */
function announce(label, mode) {
  const key = MODE_HINTS[mode];
  if (!key) return; // Mode D asks nothing; there is nothing to explain.
  ui.notifications.info(
    game.i18n.format("FGT.Targeting.AimHint", {
      name: label ?? "",
      mode: game.i18n.localize(key),
    }),
  );
}

/**
 * Explain a targeting session that had nothing to offer.
 *
 * Three answers, most specific first.
 *
 * The faction check comes first because it is the one cause that is not about
 * this ability at all: relations resolve from `factionId`, a Unit with none is
 * neutral to everyone, and a freshly imported world has none — so the honest
 * answer is "go make a faction", not anything about range or geometry.
 *
 * Otherwise the resolver has already produced a human-readable reason for every
 * placement it refused, and the failure worth avoiding is throwing all of them
 * away and saying "no legal targets", which is what sends a player to the
 * console. The distinct reasons are shown, capped: five placements usually fail
 * for one reason, and repeating it five times is not more informative.
 *
 * @param {object[]} options the resolved placements, legal and not
 * @param {object} board
 */
function reportNothingLegal(options, board) {
  const others = (board?.units ?? []).filter((u) => u.kind !== "platform" && u.kind !== "structure");
  if (others.length > 0 && others.every((u) => !u.factionId)) {
    ui.notifications.warn(game.i18n.localize("FGT.Targeting.NoFactions"), { permanent: true });
    return;
  }

  const reasons = [...new Set(options.flatMap((o) => o.reasons ?? []))];
  if (reasons.length === 0) {
    ui.notifications.warn(game.i18n.localize("FGT.Targeting.NoTargets"));
    return;
  }
  const shown = reasons.slice(0, 3);
  const more = reasons.length - shown.length;
  ui.notifications.warn(
    `${game.i18n.localize("FGT.Targeting.NoTargets")} ${shown.join(" ")}` +
      (more > 0 ? ` (+${more} more)` : ""),
    { permanent: reasons.length > 1 },
  );
}

/**
 * The caster's faction colour, so the area on the board says whose it is.
 * @param {object} caster
 * @returns {string}
 */
function factionColor(caster) {
  return factionById(caster?.factionId)?.color ?? "#4488ff";
}

/**
 * Mirror a resolution into Foundry's own target set (D28.8).
 *
 * Written, never read: `game.user.targets` is a flat set with no shape, band or
 * relation information, so no F/GT rule may consult it — but modules, macros and
 * other players' target indicators all do, and leaving it stale after an attack
 * makes the board lie about who was hit.
 *
 * @param {object[]} units the resolved `TargetedUnit`s
 */
export function mirrorTargets(units) {
  const ids = [];
  for (const target of units ?? []) {
    const token = canvas.tokens?.placeables?.find((t) => t.actor?.id === target.unitId);
    if (token) ids.push(token.id);
  }
  canvas.tokens?.setTargets?.(ids);
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
