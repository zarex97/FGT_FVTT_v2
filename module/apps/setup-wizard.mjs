/**
 * @file The GM's war setup wizard.
 * @see docs/29-environment.md, docs/34-action-bar.md
 *
 * Layer 4. Ch. 29 has listed twelve procedures that happen before a war
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
 * Two of Ch. 34's rules govern every control here: an unavailable control is
 * **disabled with its reason on screen, never hidden**, and **the arithmetic is
 * shown, not the answer**.
 */

import {
  defaultContainers, candidatesFor, validateRoster, CORE_CLASSES, EXTRA,
} from "../rules/war-setup.mjs";
import { plannedBases, gridMismatches, commitWar } from "../engine/war-setup.mjs";
import {
  servantCatalogue, prepareSummon, rerollSummonLine, adjustSummonLine, setupAdjustment, reviseSummon,
} from "../engine/summon.mjs";
import { essenceCatalogue, essenceDraftOptions, draftsEssences } from "../engine/master-essence.mjs";
import { grantsParameter, ESSENCE_LIMITS, ESSENCE_RANKS } from "../rules/master-essence.mjs";
import { describe, filterCatalogue } from "./summon-present.mjs";
import { createFaction, normalizeFactions } from "../rules/factions.mjs";
import { WAR_RULE_KEYS, coerceWarRule } from "../domain/war-rules.mjs";
import { worldDefaults as worldWarDefaults, allWars, sceneIdOfWar } from "../engine/war.mjs";
import { warRuleRows } from "./war-rules.mjs";

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
  // The new War's own roster (a War Rule). Seeded from the world's default
  // roster and written onto the War at commit, never onto the War the GM is
  // looking at while building this one.
  factions: [],
  containers: [],
  prepared: {},
  // A custom war's own Essence limits (#241 reading 1). The published ones
  // otherwise.
  essenceLimits: { ...ESSENCE_LIMITS },
});

/** Turns per round, defaulted from the war type (Ch. 04). */
const TURNS_BY_WAR = Object.freeze({ greatHolyGrailWar: 3, holyGrailWar: 8, custom: 3 });

/**
 * The rules the wizard puts on the War tab by hand, in its grid. Every other
 * War Rule is rendered from the table under them (`warRuleRows`).
 */
const GRID_RULES = Object.freeze(["warType", "ruleset", "boardSize", "turnsPerRound", "difficulty",
  "region", "grailThreshold", "drawPolicy"]);

/**
 * The world's defaults for a new War, as the draft's opening values: every
 * War Rule and the roster (`engine/war.mjs#worldDefaults`).
 *
 * The world settings ARE only that -- the defaults a new War starts from --
 * and the War built here keeps its own copy (`commitWar`). Without this the
 * wizard opened on Advanced in a world whose default said Normal.
 *
 * @returns {object}
 */
function worldDefaults() {
  const d = worldWarDefaults();
  const warType = d.warType ?? BLANK_DRAFT.warType;
  return {
    ...d,
    region: d.region ?? "",
    turnsPerRound: Number(d.turnsPerRound ?? TURNS_BY_WAR[warType] ?? 3),
    factions: normalizeFactions(d.factions ?? []),
  };
}

/**
 * The War already bound to a scene, if one is. Strict: a War from before the
 * move, bound to no scene, is not on this one.
 *
 * @param {string|null} sceneId
 * @returns {object|null}
 */
function warOnScene(sceneId) {
  if (!sceneId) return null;
  return allWars().find((w) => sceneIdOfWar(w) === sceneId) ?? null;
}

/**
 * The Parameter steps a container's Master grants its Servant: the High Rank
 * Master's one `+` (#241 reading 17), or none.
 *
 * @param {object} container
 * @returns {Record<string, number>}
 */
function grantsOf(container) {
  return container?.paramPlus ? { [container.paramPlus]: 1 } : {};
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

  /** Every Master Essence, for the container rows (#241). @type {Array<object>} */
  #essences = [];

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
    if (this.#essences.length === 0) this.#essences = await essenceCatalogue();
    const essencesOn = draftsEssences(this.draft);
    const context = await super._prepareContext(options);
    const roster = normalizeFactions(this.draft.factions ?? []);
    // Locked only when the CHOSEN scene already holds a started War: a world
    // holds several Wars at once, and a second one is built on its own scene
    // while the first is played (ruled 2026-10-18). A new scene is never locked.
    const locked = this.#locked();

    return {
      ...context,
      draft: this.draft,
      // A player is shown by name: the roster stores user ids, and a GM reading
      // "yVevT9Da3egFpXeO" cannot tell which friend that is.
      factions: roster.map((f) => ({
        ...f, playerNames: f.userIds.map((id) => game.users.get(id)?.name ?? id),
        // Ticked per faction: the new War's roster is edited here.
        players: game.users.filter((u) => !u.isGM).map((u) => ({ id: u.id, name: u.name, assigned: f.userIds.includes(u.id) })),
      })),
      locked,
      lockedReason: locked ? game.i18n.localize("FGT.Setup.SceneTaken") : null,
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
      masterMode: this.draft.masterMode,
      // Every War Rule the grid above does not show, from the one table the War
      // rules window renders too.
      moreRules: warRuleRows((key) => this.draft[key], {
        keys: WAR_RULE_KEYS.filter((k) => !GRID_RULES.includes(k) && k !== "factions"),
        prefix: "draft.", locked,
      }),
      // The Confirm tab names every War Rule the commit will write.
      confirmRules: warRuleRows((key) => this.draft[key], {
        keys: WAR_RULE_KEYS.filter((k) => k !== "factions"), prefix: "confirm.", locked: true,
      }).map((r) => ({
        label: r.label,
        value: r.isBoolean ? game.i18n.localize(r.checked ? "Yes" : "No")
          : r.isSelect ? (r.options.find((o) => o.selected)?.label ?? r.value) : (r.value === "" ? "—" : r.value),
      })),
      // The Confirm tab names each choice as the War tab does, not by its key.
      masterModes: {
        essences: "FGT.MasterMode.Essences", coinFlip: "FGT.MasterMode.CoinFlip", rankless: "FGT.MasterMode.Rankless",
      },
      // The Master Essence draft (#241): one per container, Rank first.
      essencesOn,
      essenceChoices: this.#essences.map((e) => ({ id: e.contentId, label: `${e.rank} · ${e.name}` })),
      paramChoices: Object.fromEntries(["str", "end", "agi", "mag", "luc"].map((p) => [p, `FGT.Param.${p}`])),
      // A custom war sets its own limits; the others show the published ones.
      essenceLimits: ESSENCE_RANKS.map((r) => ({
        rank: r, value: (this.draft.essenceLimits ?? ESSENCE_LIMITS)[r] ?? ESSENCE_LIMITS[r],
        editable: this.draft.warType === "custom",
        disabled: locked || this.draft.warType !== "custom",
      })),
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
        { policy: this.draft.drawPolicy, essences: essenceDraftOptions(this.draft, this.#essences) })
        .map((r) => ({
          ...r,
          text: game.i18n.format(r.message, { class: this.#classLabel(r.containerId), ...(r.detail ?? {}) }),
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
      const essenceRank = this.#essences.find((e) => e.contentId === c.essenceId)?.rank ?? null;
      return {
        ...c,
        factionName: roster.find((f) => f.id === c.factionId)?.name ?? c.factionId,
        // A High Rank Master's `+` to one Parameter, offered once its Essence
        // makes it one (#241 reading 17). The wizard never granted it.
        offersParam: grantsParameter(essenceRank),
        candidateCount: candidates.length,
        // Ch. 34: an unavailable control is DISABLED WITH ITS REASON, never
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
        // Ch. 34: the arithmetic is shown, not the answer. "1163" tells a GM
        // nothing about whether to re-roll; "1250 - 87 (10d20)" tells them
        // everything.
        lines: prepared ? prepared.lines.map((line) => {
          // A setup roll the Servant's own Skill lets it move (#226 reading 25).
          const max = ["maxAgility", "maxLuck"].includes(line.id) ? setupAdjustment(prepared) : 0;
          return {
            ...describe(line),
            ...(max > 0 ? { adjust: { max, min: -max, value: prepared.adjustments?.[line.id] ?? 0 } } : {}),
          };
        }) : [],
        // A Servant who is many Units: how many start in the Home Base, the
        // Master's pick (#226 reading 3).
        legion: (prepared?.sheet?.linkedGroup?.legion?.size ?? 0) > 0
          ? {
            max: prepared.sheet.linkedGroup.legion.openingMax ?? 1,
            value: c.legionOpening ?? 1,
            label: prepared.sheet.linkedGroup.legion.label || prepared.source?.name,
          }
          : null,
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
    // Every War Rule in its own type: a `<select>` hands back "3", and a ◈ of
    // "3" is a string no Tick arithmetic accepts.
    for (const key of WAR_RULE_KEYS) {
      if (key !== "factions" && key in this.draft) this.draft[key] = coerceWarRule(key, this.draft[key]);
    }
    if (this.draft.region === null) this.draft.region = "";
    if (data.draft?.essenceLimits) {
      this.draft.essenceLimits = Object.fromEntries(ESSENCE_RANKS.map((r) => [r,
        Math.max(0, Math.floor(Number(data.draft.essenceLimits[r])) || 0)]));
    }

    // The war type picks the ◈, and a GM who has not overridden it should not
    // have to notice.
    if (data.draft?.warType && data.draft.warType !== previousRuleset
      && !Number.isFinite(Number(data.draft.turnsPerRound))) {
      this.draft.turnsPerRound = TURNS_BY_WAR[this.draft.warType] ?? 3;
    }

    // The new War's roster: a name and a list of players per faction.
    if (data.faction) {
      this.draft.factions = normalizeFactions((this.draft.factions ?? []).map((f) => {
        const row = data.faction[f.id];
        if (!row) return f;
        return {
          ...f,
          name: row.name ?? f.name,
          userIds: row.userIds ? Object.entries(row.userIds).filter(([, on]) => on).map(([uid]) => uid) : f.userIds,
        };
      }));
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
      // The Master's Essence and, for a High Rank one, the `+` it grants (#241).
      // The grant reaches a Servant already rolled without re-rolling it: Ch. 40
      // applies grants after the rolls.
      if (row.essenceId !== undefined || row.paramPlus !== undefined) {
        if (row.essenceId !== undefined) container.essenceId = row.essenceId || null;
        if (row.paramPlus !== undefined) container.paramPlus = row.paramPlus || null;
        const rank = this.#essences.find((e) => e.contentId === container.essenceId)?.rank ?? null;
        if (!grantsParameter(rank)) container.paramPlus = null;
        if (this.draft.prepared[id]) {
          this.draft.prepared[id] = reviseSummon(this.draft.prepared[id], { masterGrants: grantsOf(container) });
        }
      }
      if (row.legionOpening !== undefined) container.legionOpening = Math.max(1, Math.floor(Number(row.legionOpening)) || 1);
      for (const [lineId, delta] of Object.entries(row.adjust ?? {})) {
        const prepared = this.draft.prepared[id];
        if (prepared) this.draft.prepared[id] = adjustSummonLine(prepared, lineId, Number(delta));
      }
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
    // Onto the draft's roster: the War being built is not the War on the scene
    // the GM is looking at, whose roster the roster editor edits.
    const existing = normalizeFactions(this.draft.factions ?? []);
    const name = game.i18n.format("FGT.Factions.NewName", { n: existing.length + 1 });
    this.draft.factions = [...existing, createFaction(name, existing)];
    await this.#persist();
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
   * *"Once the match starts, the rolls are locked"* (Ch. 40).
   * @returns {boolean} true if the action was refused
   */
  #refuseWhenLocked() {
    if (!this.#locked()) return false;
    ui.notifications.warn(game.i18n.localize("FGT.Setup.SceneTaken"));
    return true;
  }

  /**
   * Whether the chosen scene already holds a started War.
   * @returns {boolean}
   */
  #locked() {
    return Boolean(warOnScene(this.draft.sceneId || null)?.started);
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
    const prepared = await prepareSummon({
      contentId, region: this.draft.region || null, masterGrants: grantsOf(container),
    });
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

    const roster = normalizeFactions(this.draft.factions ?? []);
    const refusals = validateRoster(this.draft.containers, roster, this.#catalogue,
      { policy: this.draft.drawPolicy, essences: essenceDraftOptions(this.draft, this.#essences) });
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
        servants: result.servants.length + result.partners.length,
      }));
      await this.close();
    } catch (err) {
      console.error("FGT | War setup:", err);
      ui.notifications.error(game.i18n.format("FGT.Setup.CommitFailed", { error: err.message }));
    }
  }
}
