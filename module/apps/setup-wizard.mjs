/**
 * @file The GM's war setup wizard.
 * @see docs/19-environment.md §19.7, docs/29-user-interface.md
 *
 * Layer 4. Ch. 19 §19.7 has listed twelve procedures that happen before a war
 * begins since it was written, and **three** of them existed: the Region's
 * parameter grant, the day/night opening flip, and Round 1's attack ban. The
 * other nine were a GM with a rulebook and a mouse — create the scene, set its
 * grid, draw two Regions and tag them, make twenty-eight actors, roll three
 * lines on each, pair them, colour them, assign their owners, drop their
 * tokens, build the Combat, add the combatants.
 *
 * The pieces were never missing, only unassembled: `prepareSummon` already
 * produces one rolled Servant with every line re-rollable, `syncFactions`
 * already builds the combatants, and `HomeBaseBehavior` already turns a Region
 * into a base that five rules read. This is the thing that calls them in order.
 *
 * Two of Ch. 29's rules govern every control here: an unavailable control is
 * **disabled with its reason on screen, never hidden**, and **the arithmetic is
 * shown, not the answer**.
 */

import {
  defaultContainers, candidatesFor, validateRoster, CORE_CLASSES, EXTRA,
} from "../rules/war-setup.mjs";
import { plannedBases, gridMismatches, commitWar } from "../engine/war-setup.mjs";
import { servantCatalogue, prepareSummon, rerollSummonLine } from "../engine/summon.mjs";
import { describe, filterCatalogue } from "./summon-present.mjs";
import { createFaction } from "../rules/factions.mjs";
import * as board from "../engine/board.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** A war nobody has configured yet. */
const BLANK_DRAFT = Object.freeze({
  warType: "greatHolyGrailWar",
  ruleset: "advanced",
  boardSize: 13,
  homeBaseDepth: 3,
  turnsPerRound: 3,
  difficulty: "intermediate",
  region: "",
  grailThreshold: 9,
  drawPolicy: "duplicates",
  sceneId: "",
  sceneName: "",
  containers: [],
  prepared: {},
});

/** Turns per round, defaulted from the war type (Ch. 07 §7.2). */
const TURNS_BY_WAR = Object.freeze({ greatHolyGrailWar: 3, holyGrailWar: 8, custom: 3 });

/**
 * The world settings, as the draft's opening values.
 *
 * The settings ARE the world's defaults -- that is the whole shape `region` and
 * `difficulty` already use, where the setting is the default and the match
 * holds this match's copy. Without this the wizard opened on Advanced in a
 * world whose ruleset setting said Normal, and the GM had to notice and change
 * a control that already had the right answer somewhere else.
 *
 * @returns {object}
 */
function worldDefaults() {
  const get = (key, fallback) => {
    try {
      const v = game.settings.get("fgt", key);
      return v === undefined || v === null || v === "" ? fallback : v;
    } catch {
      return fallback;
    }
  };
  const warType = get("warType", BLANK_DRAFT.warType);
  return {
    warType,
    ruleset: get("ruleset", BLANK_DRAFT.ruleset),
    boardSize: Number(get("boardSize", BLANK_DRAFT.boardSize)),
    difficulty: get("difficulty", BLANK_DRAFT.difficulty),
    region: get("region", ""),
    grailThreshold: Number(get("grailThreshold", BLANK_DRAFT.grailThreshold)),
    drawPolicy: get("drawPolicy", BLANK_DRAFT.drawPolicy),
    turnsPerRound: Number(get("turnsPerRound", TURNS_BY_WAR[warType] ?? 3)),
  };
}


export class SetupWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-setup-wizard",
    classes: ["fgt", "setup-wizard"],
    tag: "form",
    position: { width: 820, height: 720 },
    window: { title: "FGT.Setup.Title", resizable: true },
    form: { handler: SetupWizard.#onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      addFaction: SetupWizard.#onAddFaction,
      addContainer: SetupWizard.#onAddContainer,
      deleteContainer: SetupWizard.#onDeleteContainer,
      rollAll: SetupWizard.#onRollAll,
      redraw: SetupWizard.#onRedraw,
      reroll: SetupWizard.#onReroll,
      commit: SetupWizard.#onCommit,
    },
  };

  static PARTS = {
    nav: { template: "systems/fgt/templates/apps/setup-wizard-nav.hbs" },
    war: { template: "systems/fgt/templates/apps/setup-wizard-war.hbs", scrollable: [""] },
    factions: { template: "systems/fgt/templates/apps/setup-wizard-factions.hbs", scrollable: [""] },
    containers: {
      template: "systems/fgt/templates/apps/setup-wizard-containers.hbs", scrollable: [""],
    },
    servants: { template: "systems/fgt/templates/apps/setup-wizard-servants.hbs", scrollable: [""] },
    boardTab: { template: "systems/fgt/templates/apps/setup-wizard-board.hbs", scrollable: [""] },
    confirm: { template: "systems/fgt/templates/apps/setup-wizard-confirm.hbs", scrollable: [""] },
  };

  static TABS = {
    primary: {
      initial: "war",
      labelPrefix: "FGT.Setup.Tab",
      tabs: [
        { id: "war", icon: "fa-solid fa-scroll" },
        { id: "factions", icon: "fa-solid fa-flag" },
        { id: "containers", icon: "fa-solid fa-layer-group" },
        { id: "servants", icon: "fa-solid fa-hand-sparkles" },
        { id: "boardTab", icon: "fa-solid fa-border-all" },
        { id: "confirm", icon: "fa-solid fa-check" },
      ],
    },
  };

  /** @type {object} */
  draft = foundry.utils.deepClone(BLANK_DRAFT);

  /** @type {Array<object>} */
  #catalogue = [];

  /** Per-container search text. Not part of the draft — it is not a decision. */
  #queries = {};

  /**
   * Open the wizard. GM only — the settings menu is `restricted` and the
   * sidebar button is the second door, so it carries the same lock.
   *
   * @returns {SetupWizard|null}
   */
  static open() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FGT.Setup.GMOnly"));
      return null;
    }
    const app = new SetupWizard();
    // Resumed rather than restarted. A GM closes this to go and read a
    // rulebook, and losing fourteen rolled Servants for it would be a reason
    // never to close it. `prepared` is dropped: a summon plan holds live
    // document references that do not survive a round trip through a setting.
    const saved = game.settings.get("fgt", "setupDraft") ?? {};
    app.draft = { ...foundry.utils.deepClone(BLANK_DRAFT), ...worldDefaults(), ...saved, prepared: {} };
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    if (this.#catalogue.length === 0) {
      this.#catalogue = await servantCatalogue({ ruleset: this.draft.ruleset });
    }
    const context = await super._prepareContext(options);
    const roster = board.factions();
    const locked = Boolean(game.combat?.started);

    return {
      ...context,
      draft: this.draft,
      factions: roster,
      locked,
      lockedReason: locked ? game.i18n.localize("FGT.Setup.LockedReason") : null,
      warTypes: {
        greatHolyGrailWar: "FGT.WarType.Great",
        holyGrailWar: "FGT.WarType.Regular",
        custom: "FGT.WarType.Custom",
      },
      rulesets: { advanced: "FGT.Ruleset.Advanced", normal: "FGT.Ruleset.Normal" },
      difficulties: {
        beginner: "FGT.Difficulty.Beginner", intermediate: "FGT.Difficulty.Intermediate",
        expert: "FGT.Difficulty.Expert", lunatic: "FGT.Difficulty.Lunatic",
      },
      boardSizes: { 13: "13 × 13", 25: "25 × 25" },
      drawPolicies: { duplicates: "FGT.DrawPolicy.Duplicates", unique: "FGT.DrawPolicy.Unique" },
      classChoices: Object.fromEntries([...CORE_CLASSES, EXTRA].map((c) => [c, `FGT.Class.${c}`])),
      fillChoices: { random: "FGT.Setup.FillRandom", fixed: "FGT.Setup.FillFixed" },
      scenes: Object.fromEntries(game.scenes.map((s) => [s.id, s.name])),
      masterMode: game.settings.get("fgt", "masterMode"),
      players: game.users.filter((u) => !u.isGM).map((u) => ({ id: u.id, name: u.name })),
      hasFactions: roster.length > 0,

      containers: this.#containerRows(roster),
      cards: this.#cards(roster),
      allRolled: this.draft.containers.length > 0
        && this.draft.containers.every((c) => this.draft.prepared[c.id]),

      bases: this.#basePreview(roster),
      baseError: this.#baseError(roster),
      gridProblems: this.draft.sceneId
        ? gridMismatches(game.scenes.get(this.draft.sceneId) ?? {})
        : [],

      refusals: validateRoster(this.draft.containers, roster, this.#catalogue,
        { policy: this.draft.drawPolicy })
        .map((r) => ({
          ...r,
          text: game.i18n.format(r.message, { class: this.#classLabel(r.containerId) }),
        })),
    };
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context, options) {
    const part = await super._preparePartContext(partId, context, options);
    if (context.tabs && partId in context.tabs) part.tab = context.tabs[partId];
    return part;
  }

  /* ---------------------------------------------------------------------- */
  /*  Context helpers                                                       */
  /* ---------------------------------------------------------------------- */

  /** The localized class of a container, for a refusal's message. */
  #classLabel(containerId) {
    const c = this.draft.containers.find((x) => x.id === containerId);
    return c ? game.i18n.localize(`FGT.Class.${c.classContainer}`) : "";
  }

  /**
   * The container rows to render, seeding the draft the first time.
   *
   * @param {Array<object>} roster
   * @returns {Array<object>}
   */
  #containerRows(roster) {
    if (this.draft.containers.length === 0 && roster.length > 0) {
      this.draft.containers = defaultContainers(roster);
    }
    const policy = this.draft.drawPolicy;
    const taken = this.draft.containers.map((c) => c.contentId).filter(Boolean);

    return this.draft.containers.map((c) => {
      const candidates = candidatesFor(c, this.#catalogue, { policy, taken });
      const query = this.#queries[c.id] ?? "";
      const empty = candidates.length === 0;
      return {
        ...c,
        factionName: roster.find((f) => f.id === c.factionId)?.name ?? c.factionId,
        candidateCount: candidates.length,
        // Ch. 29: an unavailable control is DISABLED WITH ITS REASON, never
        // hidden. The reference roster holds no Saber, so this is not a corner
        // case -- it is every Advanced war built today.
        empty,
        emptyReason: empty
          ? game.i18n.format("FGT.Setup.Refusal.noCandidates", {
            class: game.i18n.localize(`FGT.Class.${c.classContainer}`),
          })
          : null,
        query,
        options: filterCatalogue(
          this.#catalogue.filter((e) => candidates.includes(e.contentId)), query,
        ).slice(0, 20).map((e) => ({ ...e, chosen: e.contentId === c.contentId })),
      };
    });
  }

  /**
   * One card per container, for the Servants tab.
   *
   * @param {Array<object>} roster
   * @returns {Array<object>}
   */
  #cards(roster) {
    return this.draft.containers.map((c) => {
      const prepared = this.draft.prepared[c.id] ?? null;
      return {
        containerId: c.id,
        classLabel: game.i18n.localize(`FGT.Class.${c.classContainer}`),
        factionName: roster.find((f) => f.id === c.factionId)?.name ?? c.factionId,
        rolled: Boolean(prepared),
        name: prepared?.source?.name ?? null,
        img: prepared?.source?.img ?? null,
        // Ch. 29: the arithmetic is shown, not the answer. "1163" tells a GM
        // nothing about whether to re-roll; "1250 - 87 (10d20)" tells them
        // everything.
        lines: prepared ? prepared.lines.map(describe) : [],
        // "Before play, select only one Noble Phantasm, either (a) or (b)."
        // Archer, Caster and Berserker only; every other Servant's list is
        // empty and the control does not render at all.
        npOptions: (c.npOptions ?? []).map((id) => ({
          id,
          name: prepared?.source?.items?.find?.((i) => i.system?.contentId === id)?.name ?? id,
          chosen: c.npChoice === id,
        })),
        npUnchosen: (c.npOptions ?? []).length > 0 && !c.npChoice,
      };
    });
  }

  /**
   * Each faction's base, as a count and a row range.
   *
   * A count rather than a drawing: the GM is deciding a *depth*, and
   * "39 panels, rows 0–2" answers that better than a thumbnail of a blank grid.
   *
   * @param {Array<object>} roster
   * @returns {Array<object>}
   */
  #basePreview(roster) {
    try {
      return plannedBases(this.draft, roster).map((rect) => {
        const rows = [...new Set(rect.offsets.map((o) => o.i))].sort((a, b) => a - b);
        return {
          factionId: rect.factionId,
          factionName: roster.find((f) => f.id === rect.factionId)?.name ?? rect.factionId,
          panels: rect.offsets.length,
          rows: rows.length > 0 ? `${rows[0]}–${rows[rows.length - 1]}` : "—",
        };
      });
    } catch {
      // `homeBaseRects` throws on a Great Holy Grail War that is not two-sided.
      // `#baseError` reports it, so an empty preview here is correct.
      return [];
    }
  }

  /**
   * Why no bases could be planned, if none could.
   * @param {Array<object>} roster
   * @returns {string|null}
   */
  #baseError(roster) {
    try {
      plannedBases(this.draft, roster);
      return null;
    } catch (err) {
      return err.message;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Handlers                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Read the controls back and persist the draft.
   *
   * @this {SetupWizard}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {object} formData
   */
  static async #onChange(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const previousRuleset = this.draft.ruleset;

    this.draft = { ...this.draft, ...data.draft };
    this.draft.boardSize = Number(this.draft.boardSize);
    this.draft.homeBaseDepth = Number(this.draft.homeBaseDepth);
    this.draft.grailThreshold = Number(this.draft.grailThreshold);
    this.draft.turnsPerRound = Number(this.draft.turnsPerRound);

    // The war type picks the ◈, and a GM who has not overridden it should not
    // have to notice.
    if (data.draft?.warType && data.draft.warType !== previousRuleset
      && !Number.isFinite(Number(data.draft.turnsPerRound))) {
      this.draft.turnsPerRound = TURNS_BY_WAR[this.draft.warType] ?? 3;
    }

    for (const [id, row] of Object.entries(data.container ?? {})) {
      const container = this.draft.containers.find((c) => c.id === id);
      if (!container) continue;
      if (row.classContainer !== undefined && row.classContainer !== container.classContainer) {
        // The class decides what may fill the slot, so a class change discards
        // what was in it -- keeping a Caster in a Saber container would be a
        // roster that passes validation and is wrong.
        container.classContainer = row.classContainer;
        container.contentId = null;
        delete this.draft.prepared[id];
      }
      if (row.fill !== undefined) container.fill = row.fill;
      if (row.contentId !== undefined) container.contentId = row.contentId || null;
      if (row.query !== undefined) this.#queries[id] = row.query;
      if (row.npChoice !== undefined) container.npChoice = row.npChoice || null;
    }

    // A ruleset change invalidates every draw: the two catalogues are disjoint,
    // and a Normal war holding an Advanced Servant is two stat scales in one
    // fight.
    if (this.draft.ruleset !== previousRuleset) {
      this.#catalogue = [];
      this.draft.prepared = {};
      for (const c of this.draft.containers) { c.contentId = null; c.fill = "random"; }
    }

    await this.#persist();
    this.render();
  }

  /** Save the draft, so closing the window is not losing the work. */
  async #persist() {
    // `prepared` is dropped rather than stored: a summon plan holds live
    // document references, which do not survive a round trip through a setting.
    const { prepared: _prepared, ...storable } = this.draft;
    await game.settings.set("fgt", "setupDraft", storable);
  }

  /**
   * @this {SetupWizard}
   */
  static async #onAddFaction() {
    const existing = board.factions();
    const name = game.i18n.format("FGT.Factions.NewName", { n: existing.length + 1 });
    await board.setFactions([...existing, createFaction(name, existing)]);
    this.render();
  }

  /**
   * @this {SetupWizard}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAddContainer(_event, target) {
    const factionId = target.closest("[data-faction-id]")?.dataset.factionId;
    if (!factionId) return;
    this.draft.containers.push({
      id: `${factionId}-extra-${foundry.utils.randomID(6)}`,
      factionId, classContainer: EXTRA, fill: "random",
      contentId: null, servantId: null, masterId: null, npChoice: null,
    });
    await this.#persist();
    this.render();
  }

  /**
   * @this {SetupWizard}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onDeleteContainer(_event, target) {
    const id = target.closest("[data-container-id]")?.dataset.containerId;
    if (!id) return;
    this.draft.containers = this.draft.containers.filter((c) => c.id !== id);
    delete this.draft.prepared[id];
    await this.#persist();
    this.render();
  }

  /**
   * Draw and roll every container that has not been rolled yet.
   *
   * Skips one that already has a plan: a GM who re-rolled an Agility and then
   * pressed this again did not ask for thirteen new Servants.
   *
   * @this {SetupWizard}
   */
  static async #onRollAll() {
    if (this.#refuseWhenLocked()) return;
    for (const container of this.draft.containers) {
      if (this.draft.prepared[container.id]) continue;
      await this.#drawInto(container);
    }
    await this.#persist();
    this.render();
  }

  /**
   * A different Servant for this container, and fresh dice with it.
   *
   * @this {SetupWizard}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRedraw(_event, target) {
    if (this.#refuseWhenLocked()) return;
    const id = target.closest("[data-container-id]")?.dataset.containerId;
    const container = this.draft.containers.find((c) => c.id === id);
    if (!container) return;
    await this.#drawInto(container, { force: true });
    await this.#persist();
    this.render();
  }

  /**
   * One line of one container's plan, re-rolled.
   *
   * @this {SetupWizard}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onReroll(_event, target) {
    if (this.#refuseWhenLocked()) return;
    const id = target.closest("[data-container-id]")?.dataset.containerId;
    const lineId = target.closest("[data-line-id]")?.dataset.lineId;
    const prepared = this.draft.prepared[id];
    if (!prepared || !lineId) return;
    this.draft.prepared[id] = await rerollSummonLine(prepared, lineId);
    this.render();
  }

  /**
   * *"Once the match starts, the rolls are locked"* (§37.6).
   * @returns {boolean} true if the action was refused
   */
  #refuseWhenLocked() {
    if (!game.combat?.started) return false;
    ui.notifications.warn(game.i18n.localize("FGT.Summon.Locked"));
    return true;
  }

  /**
   * Pick a Servant for this container and roll its plan.
   *
   * A fixed container keeps the GM's pick and is never drawn away from it;
   * `force` only re-rolls its dice.
   *
   * @param {object} container
   * @param {{force?: boolean}} [options]
   * @returns {Promise<void>}
   */
  async #drawInto(container, { force = false } = {}) {
    let contentId = container.contentId;

    if (container.fill !== "fixed" && (force || !contentId)) {
      const taken = this.draft.drawPolicy === "unique"
        ? this.draft.containers.filter((c) => c.id !== container.id)
          .map((c) => c.contentId).filter(Boolean)
        : [];
      const candidates = candidatesFor(container, this.#catalogue,
        { policy: this.draft.drawPolicy, taken });
      // Skipped silently would be indistinguishable from filled. The row
      // already carries its reason, from the Containers tab.
      if (candidates.length === 0) return;
      const roll = await new Roll(`1d${candidates.length}`).evaluate();
      contentId = candidates[roll.total - 1];
      container.contentId = contentId;
    }

    if (!contentId) return;
    // No `masterId` here: the Master does not exist until commit, and its rank
    // grant applies AFTER the rolls, so nothing about it can change a die
    // already thrown. That is the summon dialog's rule, for its reason.
    const prepared = await prepareSummon({ contentId, region: this.draft.region || null });
    if (!prepared) return;
    this.draft.prepared[container.id] = prepared;

    // Recorded on the CONTAINER so `validateRoster` -- which is pure and takes
    // no documents -- can refuse a war whose choice was never made.
    const offered = [...(prepared.sheet?.npChoice ?? [])];
    container.npOptions = offered;
    if (!offered.includes(container.npChoice)) container.npChoice = null;
  }

  /**
   * @this {SetupWizard}
   */
  static async #onCommit() {
    if (this.#refuseWhenLocked()) return;

    const roster = board.factions();
    const refusals = validateRoster(this.draft.containers, roster, this.#catalogue,
      { policy: this.draft.drawPolicy });
    if (refusals.length > 0) {
      ui.notifications.warn(game.i18n.format("FGT.Setup.CannotCommit", { n: refusals.length }));
      return;
    }

    // Named in the confirmation, because this creates documents in bulk and
    // deleting them again is a great deal more work than making them.
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("FGT.Setup.CommitTitle") },
      content: `<p>${game.i18n.format("FGT.Setup.CommitWarn", {
        units: this.draft.containers.length * 2,
        factions: roster.length,
      })}</p>`,
    });
    if (!ok) return;

    try {
      const result = await commitWar(this.draft);
      await game.settings.set("fgt", "setupDraft", {});
      ui.notifications.info(game.i18n.format("FGT.Setup.Committed", {
        servants: result.servants.length,
      }));
      await this.close();
    } catch (err) {
      console.error("FGT | War setup:", err);
      ui.notifications.error(game.i18n.format("FGT.Setup.CommitFailed", { error: err.message }));
    }
  }
}
