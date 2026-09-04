/**
 * @file One place that answers "what is the game waiting for me to do?"
 * @see docs/27-reaction-protocol.md §27.5, docs/29-user-interface.md
 *
 * Layer 4. Thin by construction: it scans the chat log, reads flags, and hands
 * plain entries to `pending-present.mjs`. It decides no rules and answers no
 * prompts — a row jumps to its card, where the buttons and their refusal
 * reasons already live. A second set of buttons here would be a second place to
 * keep in step with the first, and the first thing to fall out of step is
 * always the reason a button is disabled.
 *
 * It exists only while something is pending. A player with nothing to answer
 * has no window at all, rather than an empty panel taking up canvas.
 */

import { pendingRowsFor } from "./pending-present.mjs";
import { pendingPrompt, deserialize, windowFor } from "../../engine/combat-process.mjs";
import { countdownFor } from "../../engine/await-timeout.mjs";
import { publicIdentityOf } from "../../engine/public-identity.mjs";
import { currentBoard } from "../../engine/board.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PendingPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-pending-panel",
    classes: ["fgt", "pending-panel"],
    position: { width: "auto", height: "auto" },
    window: { frame: false, positioned: false },
    actions: { jump: PendingPanel.onJump },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/hud/pending-panel.hbs" },
  };

  /** The singleton: one viewer, one list. */
  static instance = null;

  /** The 1s tick that moves the clocks, or null. @type {number|null} */
  #tick = null;

  /**
   * Show the panel and keep it current. Idempotent.
   * @returns {PendingPanel}
   */
  static attach() {
    if (PendingPanel.instance) return PendingPanel.instance;
    const panel = new PendingPanel();
    PendingPanel.instance = panel;

    // Debounced for the same reason the action bar's refresh is: resolving one
    // rung can raise `updateChatMessage` several times in a breath, and each
    // was otherwise a full render.
    const refresh = foundry.utils.debounce(() => {
      panel.sync().catch((err) => console.error("FGT | Pending decisions:", err));
    }, 80);

    Hooks.on("createChatMessage", refresh);
    Hooks.on("updateChatMessage", refresh);
    Hooks.on("deleteChatMessage", refresh);

    refresh();
    console.log("FGT | Pending decisions attached");
    return panel;
  }

  /**
   * Render when there is something to answer, close when there is not.
   * @returns {Promise<void>}
   */
  async sync() {
    const rows = this.rows();
    if (rows.length === 0) {
      this.#stopTicking();
      if (this.rendered) await this.close();
      return;
    }
    await this.render({ force: true });
    // Only while a clock is actually shown. A timer running against a list of
    // untimed prompts is a wake-up every second for no change on screen.
    if (rows.some((r) => r.countdown)) this.#startTicking();
    else this.#stopTicking();
  }

  /**
   * Every decision waiting on this viewer, already sorted.
   * @returns {object[]}
   */
  rows() {
    const board = currentBoard();
    const viewer = { id: game.user.id, isGM: game.user.isGM };
    const entries = [];

    for (const message of game.messages) {
      if (message.getFlag?.("fgt", "kind") !== "attack") continue;
      const raw = message.getFlag("fgt", "process");
      if (!raw) continue;

      let state;
      try {
        state = deserialize(raw);
      } catch {
        continue;
      }

      const prompt = pendingPrompt(state);
      if (!prompt) continue;

      const actor = prompt.unitId ? game.actors.get(prompt.unitId) : null;
      if (!actor) continue;

      // PUBLIC, even in the viewer's own list. A concealed Servant's true name
      // must not leak in here from a card that is correctly hiding it.
      const identity = publicIdentityOf(actor, board);
      entries.push({
        messageId: message.id,
        unitId: actor.id,
        unitName: identity.name,
        unitImg: identity.img,
        kind: prompt.kind,
        owned: actor.isOwner,
        countdown: this.#countdown(message),
        commandSpells: windowFor(state) ? this.#spendableSpells() : 0,
      });
    }
    return pendingRowsFor(entries, viewer);
  }

  /**
   * The clock, with the milliseconds the ordering needs.
   *
   * `countdownFor` returns a label and an `expired` flag, which is everything a
   * CARD needs and not enough to sort by. The remaining time is recovered from
   * the label rather than by reaching into the timeout module's internals: the
   * label is the contract, and a mis-parse costs an ordering rather than a
   * decision — an unreadable label sorts last and still renders.
   *
   * @param {object} message
   * @returns {{ms: number, label: string}|null}
   */
  #countdown(message) {
    const c = countdownFor(message);
    if (!c) return null;
    const [minutes, seconds] = String(c.label).split(":").map(Number);
    const ms = Number.isFinite(minutes) && Number.isFinite(seconds)
      ? (minutes * 60 + seconds) * 1000
      : Infinity;
    return { ms: c.expired ? 0 : ms, label: c.label };
  }

  /**
   * How many Command Spells this viewer's Masters could spend right now.
   *
   * `system.commandSpells` is a plain NumberField on `data/actor/master.mjs`,
   * not a `{value, max}` pair — reaching for `.value` yields `undefined` and
   * silently hides every Command Spell row.
   *
   * @returns {number}
   */
  #spendableSpells() {
    return game.actors
      .filter((a) => a.type === "master" && a.isOwner)
      .reduce((sum, m) => sum + (m.system?.commandSpells ?? 0), 0);
  }

  #startTicking() {
    if (this.#tick !== null) return;
    this.#tick = window.setInterval(() => {
      if (this.rendered) this.render();
    }, 1000);
  }

  #stopTicking() {
    if (this.#tick === null) return;
    window.clearInterval(this.#tick);
    this.#tick = null;
  }

  /**
   * How many rows are drawn before the rest become a count.
   *
   * A GM sees every unresolved prompt at the table, and in a long match that is
   * not a handful -- a live world reached 178 and the panel covered the screen.
   * The list is a call to ACTION, so it shows the most urgent few and says how
   * many are behind them; the full set stays reachable by scrolling.
   */
  static MAX_ROWS = 8;

  /** @inheritdoc */
  async _prepareContext() {
    const rows = this.rows();
    const shown = rows.slice(0, PendingPanel.MAX_ROWS);
    return {
      rows: shown.map((r) => ({ ...r, labelText: game.i18n.localize(r.label) })),
      count: rows.length,
      hidden: rows.length - shown.length,
    };
  }

  /** @inheritdoc */
  async close(options) {
    this.#stopTicking();
    return super.close(options);
  }

  /**
   * Scroll the chat to this row's card and flash it.
   *
   * It does NOT answer the prompt. The card carries the buttons, their costs
   * and their refusal reasons; a second set here would be a second place to
   * keep in step.
   *
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async onJump(_event, target) {
    const id = target.closest("[data-message-id]")?.dataset?.messageId;
    if (!id) return;

    const el = document.querySelector(`.chat-message[data-message-id="${id}"]`);
    if (!el) {
      ui.notifications.warn(game.i18n.localize("FGT.Pending.CardNotFound"));
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("fgt-pending-flash");
    window.setTimeout(() => el.classList.remove("fgt-pending-flash"), 1200);
  }
}
