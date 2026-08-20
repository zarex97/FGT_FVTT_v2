/**
 * @file The game log viewer.
 * @see docs/30-chat-and-audit.md §30.8, §30.9, §30.10
 *
 * Layer 4. Filters by turn, actor and kind, with a search box — and its
 * most-used function in practice will be *"show me everything that happened to
 * my Servant last round"*, which is why the actor filter matches **any**
 * participant rather than the entry's subject.
 *
 * Two things this shows that chat cannot. A GM override appears as its own
 * entry **beside** the one it changed, with the original struck through — §30.10
 * requires the record to show that the GM changed something, and a log that
 * silently carried the new value would satisfy P6 while defeating the reason
 * P6 is written down. And the export button produces §30.9's self-contained
 * JSON, which is the thing a bug report attaches.
 */

import { fullLog, query, exportLog, override } from "../engine/game-log.mjs";
import { LOG_KINDS, isOverride, summarizeLog } from "../rules/game-log.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class LogViewer extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-log-viewer",
    classes: ["fgt", "log-viewer"],
    tag: "form",
    position: { width: 720, height: 640 },
    window: { title: "FGT.Log.Title", resizable: true },
    form: { handler: LogViewer.#onFilter, submitOnChange: true, closeOnSubmit: false },
    actions: {
      exportLog: LogViewer.#onExport,
      overrideEntry: LogViewer.#onOverride,
      clearFilters: LogViewer.#onClear,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/log-viewer.hbs", scrollable: [".fgt-log__list"] },
  };

  /** @type {{round?: number, kind?: string, actorId?: string, search?: string}} */
  #filter = {};

  /** @returns {LogViewer} */
  static open() {
    const app = new LogViewer();
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const all = await fullLog();
    const shown = await query(this.#filter);
    const bySeq = new Map(all.map((e) => [e.seq, e]));

    return {
      filter: this.#filter,
      kinds: LOG_KINDS,
      rounds: [...new Set(all.map((e) => e.round))].sort((a, b) => a - b),
      actors: rosterOptions(all),
      summary: summarizeLog(all),
      isGM: game.user.isGM,
      isEmpty: all.length === 0,
      // A filter that hides everything says so, rather than showing an empty
      // list that reads as "nothing happened".
      filteredToNothing: all.length > 0 && shown.length === 0,
      entries: shown.map((e) => present(e, bySeq)),
    };
  }

  /**
   * @this {LogViewer}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {object} formData
   */
  static async #onFilter(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    this.#filter = {
      round: data.round === "" ? undefined : Number(data.round),
      kind: data.kind || undefined,
      actorId: data.actorId || undefined,
      search: data.search || undefined,
    };
    this.render();
  }

  /** @this {LogViewer} */
  static #onClear() {
    this.#filter = {};
    this.render();
  }

  /**
   * Export the log as §30.9's JSON.
   *
   * Written to the world's data directory rather than offered as a download:
   * a `<a download>` is inert inside some Foundry frames, and a file the GM can
   * point at is what a bug report needs anyway.
   *
   * @this {LogViewer}
   */
  static async #onExport() {
    const json = await exportLog();
    const name = `fgt-log-${game.combat?.id ?? "match"}-${Date.now()}.json`;

    // Foundry's own saver, namespaced: the bare global is deprecated in v13+
    // and removed in v14, and the artifact viewer blocks a page-driven download
    // anyway -- this is the one path that works in both browser and desktop.
    foundry.utils.saveDataToFile(json, "application/json", name);

    ui.notifications.info(game.i18n.format("FGT.Log.Exported", { name }));
  }

  /**
   * Record a GM override against an entry (§30.10).
   *
   * The reason is required and the dialog will not submit without one. That is
   * not ceremony: an unexplained override is indistinguishable from a bug in
   * the record, so a log that permits one is a log nobody can trust the rest of.
   *
   * @this {LogViewer}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onOverride(_event, target) {
    const seq = Number(target.closest("[data-seq]")?.dataset.seq);
    if (!Number.isFinite(seq)) return;

    const form = await DialogV2.prompt({
      window: { title: game.i18n.localize("FGT.Log.OverrideTitle") },
      content: `
        <p>${game.i18n.localize("FGT.Log.OverrideHint")}</p>
        <label>${game.i18n.localize("FGT.Log.OverrideOriginal")}
          <input type="text" name="original"></label>
        <label>${game.i18n.localize("FGT.Log.OverrideChanged")}
          <input type="text" name="changed"></label>
        <label>${game.i18n.localize("FGT.Log.OverrideReason")}
          <textarea name="reason" required></textarea></label>`,
      ok: { label: game.i18n.localize("FGT.Log.OverrideConfirm"),
        callback: (_e, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
      rejectClose: false,
    });
    if (!form) return;

    if (!String(form.reason ?? "").trim()) {
      ui.notifications.warn(game.i18n.localize("FGT.Log.OverrideNeedsReason"));
      return;
    }

    await override(seq, { original: form.original, changed: form.changed, reason: form.reason });
    this.render();
  }
}

/* -------------------------------------------------------------------------- */

/**
 * One entry, ready to render.
 * @param {object} e
 * @param {Map<number, object>} bySeq
 * @returns {object}
 */
function present(e, bySeq) {
  return {
    ...e,
    isOverride: isOverride(e),
    // An overridden entry is struck through and keeps its place. §30.10: the
    // original remains in the record.
    superseded: Boolean(e.overriddenBy),
    // An override names what it changed, so the two read as a pair rather than
    // as two unrelated lines.
    overridesSummary: e.overrides ? bySeq.get(e.overrides)?.summary ?? null : null,
    actorNames: (e.actorIds ?? []).map((id) => game.actors.get(id)?.name ?? id),
    rollCount: (e.rolls ?? []).length,
  };
}

/**
 * The actors that appear anywhere in the log, for the filter dropdown.
 *
 * Built from the log rather than from the world, so a defeated or deleted unit
 * is still selectable — which is exactly when someone goes looking for it.
 *
 * @param {object[]} log
 * @returns {Array<{id: string, name: string}>}
 */
function rosterOptions(log) {
  const ids = new Set(log.flatMap((e) => e.actorIds ?? []));
  return [...ids]
    .map((id) => ({ id, name: game.actors.get(id)?.name ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
