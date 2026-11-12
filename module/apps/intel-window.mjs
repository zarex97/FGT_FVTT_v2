/**
 * @file The Intel window: a Faction's Dossiers on the Units it does not own.
 * @see docs/superpowers/specs/2026-11-12-information-system.md (WI.*, DC.*, FA.*, BU.*, SE.*)
 *
 * Layer 4 (apps). Lists every non-owned Servant and Master its Faction holds a
 * Dossier on, and shows the chosen one: its portrait and name as the Faction
 * knows them, its Class, the Intel banked, every Entry locked with its price or
 * open with its value, and the Sections with what was drawn from each. A buy
 * goes to the GM (`engine/intel.mjs#buy`). Drawn in both looks, nocturne and
 * classic, from one template.
 */

import { currentBoard, unitActor, factions } from "../engine/board.mjs";
import { currentWar } from "../engine/war.mjs";
import { intelOn, factionOfUser, notebookOf, stateOf } from "../engine/intel-store.mjs";
import { buy, falseViewOf, hasFallen, hiddenFrom, knownNameOf } from "../engine/intel.mjs";
import { ENTRY_PRICES, SECTIONS, entriesOf, entryValue, falseEntryValue, sectionOf, abilitySummary, DOSSIER_KINDS, isSectionComplete } from "../rules/intel.mjs";
import { baseAttackFor } from "../domain/base-attack.mjs";
import { maxHealthFor } from "../domain/health.mjs";
import { lookup } from "../domain/tables.mjs";
import { Rank } from "../domain/rank.mjs";
import { isSpellAbility } from "../rules/costs.mjs";
import { abilityTag } from "../engine/public-ability.mjs";
import { scrubbedText } from "../rules/public-ability.mjs";
import { publicIdentityOf } from "../engine/public-identity.mjs";
import { EffectRegistry } from "../rules/registry.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class IntelWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-intel",
    classes: ["fgt", "fgt-intel-window"],
    position: { width: 760, height: 620 },
    window: { title: "FGT.Intel.Title", resizable: true, icon: "fa-solid fa-book-open" },
    actions: {
      pick: IntelWindow.#onPick,
      buyEntry: IntelWindow.#onBuyEntry,
      buySection: IntelWindow.#onBuySection,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/intel.hbs", scrollable: [".fgt-intel__list", ".fgt-intel__page"] },
  };

  /** The Unit shown. */
  unitId = null;
  /** The Faction read: the player's own; the GM picks. */
  factionId = null;
  /** Hook ids, to take back on close. */
  #hooks = [];

  /**
   * Open the window, on a Unit when one is named.
   *
   * @param {string|null} [unitId]
   * @returns {IntelWindow}
   */
  static open(unitId = null) {
    const app = foundry.applications.instances.get("fgt-intel") ?? new IntelWindow();
    if (unitId) app.unitId = unitId;
    // Brought forward once drawn: before its first render it has no element.
    void app.render({ force: true }).then(() => { if (app.element) app.bringToFront?.(); });
    return app;
  }

  /** @inheritdoc */
  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    const again = () => { if (this.rendered) this.render(); };
    // Open values follow the board (WI.live); a buy or a gain shows at once.
    this.#hooks.push(["updateActor", Hooks.on("updateActor", (actor) => { if (actor.id === this.unitId) again(); })]);
    this.#hooks.push(["updateJournalEntry", Hooks.on("updateJournalEntry", (j) => { if (j.getFlag?.("fgt", "intelNotebook")) again(); })]);
    this.#hooks.push(["createJournalEntry", Hooks.on("createJournalEntry", (j) => { if (j.getFlag?.("fgt", "intelNotebook")) again(); })]);
  }

  /** @inheritdoc */
  _onClose(options) {
    for (const [hook, id] of this.#hooks) Hooks.off(hook, id);
    this.#hooks = [];
    super._onClose?.(options);
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const war = currentWar();
    const gm = Boolean(game.user?.isGM);
    const roster = factions(war);
    this.factionId ??= gm ? (roster[0]?.id ?? null) : factionOfUser(game.user, war);
    const factionId = this.factionId;
    const off = !intelOn(war);
    const board = currentBoard();
    const state = stateOf(notebookOf(factionId, war));

    // Who is listed: every Unit this Faction holds a Dossier on (WI.list); with
    // the system off, every Servant and Master it does not own (WR.off.open).
    const ids = new Set(Object.keys(state.dossiers));
    if (off) for (const u of board.units ?? []) if (DOSSIER_KINDS.includes(u.kind)) ids.add(u.id);
    const rows = [];
    for (const id of ids) {
      const actor = unitActor(id);
      if (!actor || !DOSSIER_KINDS.includes(actor.type)) continue;
      if ((actor.system?.factionId ?? null) === factionId) continue;
      const known = await this.#identity(actor, factionId, state, off, board);
      rows.push({
        id, name: known.name, img: known.img,
        // Off, no Intel is shown (WR.off.open).
        intel: off ? null : (state.dossiers[id]?.intel ?? 0),
        fallen: hasFallen(actor),
        selected: id === this.unitId,
      });
    }
    // fgt-name-ok: each row's name is already the one its Faction knows (`#identity`)
    rows.sort((a, b) => a.name.localeCompare(b.name));
    if (this.unitId && !rows.some((r) => r.id === this.unitId)) this.unitId = null;

    return {
      ...context,
      gm,
      off,
      factionId,
      factions: roster.map((f) => ({ id: f.id, name: f.name ?? f.id, selected: f.id === factionId })),
      living: rows.filter((r) => !r.fallen),
      fallen: rows.filter((r) => r.fallen),
      none: rows.length === 0,
      page: this.unitId ? await this.#page(this.unitId, factionId, state, off, board) : null,
    };
  }

  /**
   * The name and portrait as a Faction knows them.
   *
   * @returns {Promise<{name: string, img: string}>}
   */
  async #identity(actor, factionId, state, off, board) {
    const knows = off || Boolean(state.dossiers[actor.id]?.identity) || Boolean(actor.system?.identityRevealed);
    if (knows) return { name: actor.system?.trueName || actor.name, img: actor.img, knowsIdentity: true }; // fgt-name-ok: a Faction that knows the identity
    const pub = publicIdentityOf(actor, board);
    return { name: await knownNameOf(actor, factionId, board) || pub.name, img: pub.img, knowsIdentity: false };
  }

  /**
   * One Dossier, as its Faction reads it.
   *
   * @returns {Promise<object>}
   */
  async #page(unitId, factionId, state, off, board) {
    const actor = unitActor(unitId);
    const dossier = state.dossiers[unitId] ?? { intel: 0, open: {}, sections: {}, abilities: {} };
    const known = await this.#identity(actor, factionId, state, off, board);
    const fallen = hasFallen(actor);
    const hidden = hiddenFrom(actor);
    // Camouflage: the false Class and Ranks, to a Faction that does not know her (HE.*).
    const falseView = falseViewOf(actor, factionId);
    // A fallen Unit's banked Intel is lost (FA.lost).
    const intel = fallen ? 0 : (dossier.intel ?? 0);
    const t = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
    const canSpend = (price) => !off && !fallen && intel >= price;
    const reasonFor = (price) => (fallen ? t("FGT.Intel.FallenNote") : (intel < price ? t("FGT.Intel.Short", { need: price, held: intel }) : null));

    const entries = entriesOf(actor).map((key) => {
      const price = ENTRY_PRICES[key];
      const open = off || Boolean(dossier.open?.[key]);
      const isHidden = !off && hidden.entries.includes(key);
      return {
        key, price, open,
        label: t(`FGT.Intel.Entry.${key}`),
        text: open ? this.#entryText(key, actor, { ranksOnly: !off && hidden.ranksOnly.includes(key), falseView: off ? null : falseView }) : t("FGT.Intel.Locked"),
        hiddenReason: isHidden ? t("FGT.Intel.Hidden") : null,
        canBuy: !open && !isHidden && canSpend(price),
        reason: open || isHidden ? null : reasonFor(price),
        buyLabel: t("FGT.Intel.Buy", { price }),
      };
    });

    const items = [...(actor.items ?? [])];
    const effectName = (id) => (EffectRegistry.get(id) ? EffectRegistry.nameOf(id) : id);
    const sections = SECTIONS.map(({ key, price }) => {
      const mark = dossier.sections?.[key] ?? { known: [], complete: false };
      const inSection = items.filter((i) => sectionOf(i, isSpellAbility) === key);
      const shown = off ? inSection.map((i) => i.system?.contentId ?? i.id) : [...(mark.known ?? [])];
      const abilities = shown.map((cid) => {
        const item = items.find((i) => (i.system?.contentId ?? i.id) === cid) ?? null;
        // Gone from its bearer: named as its Faction kept it, never by its id (SE.change.lose).
        if (!item) {
          const kept = dossier.abilities?.[cid] ?? {};
          return { tag: kept.tag ?? t("FGT.Intel.GoneAbility"), name: kept.full ? (kept.name ?? null) : null, noLongerHeld: true, lines: [] };
        }
        const full = off || Boolean(dossier.abilities?.[cid]?.full);
        const sum = abilitySummary(item, { effectName, isSpell: isSpellAbility });
        return {
          tag: abilityTag(item),
          // fgt-name-ok: the name only where its Faction learned the full text
          name: full ? item.name : null,
          text: full ? this.#fullText(item, actor, known.knowsIdentity) : null,
          activity: t(sum.passive ? "FGT.Intel.Summary.Passive" : "FGT.Intel.Summary.Active"),
          cooldown: sum.cooldown ? t("FGT.Intel.Summary.Cooldown", { cooldown: sum.cooldown }) : null,
          target: sum.target ? t("FGT.Intel.Summary.Target", { target: sum.target }) : null,
          lines: sum.lines.map((l) => t(l.key, l.data)),
          noLongerHeld: false,
        };
      });
      const isHidden = !off && hidden.sections.includes(key);
      // Complete only while nothing it holds is left to draw (SE.change.reopen).
      const complete = off || isSectionComplete(mark, inSection.map((i) => i.system?.contentId ?? i.id));
      return {
        key, price, abilities, complete,
        label: t(`FGT.Intel.Section.${key}`),
        knownLabel: complete ? t("FGT.Intel.Complete") : t("FGT.Intel.Known", { n: shown.length }),
        hiddenReason: isHidden ? t("FGT.Intel.Hidden") : null,
        // A Section that may be empty is still offered: its last draw says so, free.
        canBuy: !complete && !isHidden && !off && !fallen,
        affordable: canSpend(price),
        reason: complete || isHidden ? null : reasonFor(price),
        buyLabel: t("FGT.Intel.Draw", { price }),
      };
    });

    return {
      id: unitId,
      name: known.name,
      img: known.img,
      kind: t(`FGT.Intel.Kind.${actor.type}`),
      // Its Class as the Faction knows it: the true one once it knows who the
      // Unit is (HE.np), the false one Camouflage shows, else the public name.
      publicName: known.knowsIdentity && actor.type === "servant"
        ? [...(actor.system?.servantClasses ?? [])].map((c) => game.i18n.localize(`FGT.Class.${c}`)).join(" / ") || publicIdentityOf(actor, board).name
        : (falseView?.className ?? publicIdentityOf(actor, board).name),
      intel,
      // Off, no Intel is held to show (WR.off.open); fallen, none is held (FA.frozen).
      intelLabel: off || fallen ? null : t("FGT.Intel.Held", { intel }),
      fallen,
      entries,
      sections,
    };
  }

  /**
   * An ability's full text as a Faction learned it (TN.full, AA.entry,
   * FB.coerce.open): its links read as their labels, and its bearer's own names
   * scrubbed out unless the Faction knows who it is, since *"Cannot be used if
   * Achilles is affected…"* would tell it (found pressing, #405).
   *
   * @returns {string}
   */
  #fullText(item, actor, knowsIdentity) {
    const raw = String(item.system?.description ?? "").replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1");
    if (knowsIdentity) return raw;
    // fgt-name-ok: the bearer's names, read to be scrubbed out
    return scrubbedText(raw, { names: [actor.system?.trueName, actor.name].filter(Boolean), rank: item.system?.rank ?? null });
  }

  /**
   * An open Entry as text.
   *
   * @returns {string}
   */
  #entryText(key, actor, opts) {
    const v = opts.falseView && ["str", "end", "agi", "mag", "luc"].includes(key)
      ? falseEntryValue(key, opts.falseView.parameters, {
        baseAttackFor,
        maxHealthOf: (sheet) => maxHealthFor(sheet, lookup, Rank),
      })
      : entryValue(key, actor, opts);
    const t = (k, d) => game.i18n.format(k, d);
    const parts = [];
    if (v.rank) parts.push(v.rank);
    if (key === "end" && v.value != null) parts.push(t("FGT.Intel.Pool.health", v));
    if (key === "agi" && v.value != null) parts.push(t("FGT.Intel.Pool.agility", v));
    if (key === "luc" && v.value != null) parts.push(t("FGT.Intel.Pool.luck", v));
    if ((key === "str" || key === "mag") && v.base != null) parts.push(t("FGT.Intel.Base", v));
    if (key === "range") parts.push(t("FGT.Intel.RangeValue", { panels: v.value ?? "—", targets: v.max ?? "—" }));
    else if ((key === "mov" || key === "commandSpells") && v.value != null) parts.push(String(v.value));
    if (v.text) parts.push(v.text);
    return parts.join(" · ");
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    // The GM reads any Faction's Notebook (WI.gm).
    this.element.querySelector("[data-faction-pick]")?.addEventListener("change", (event) => {
      this.factionId = event.target.value;
      this.unitId = null;
      this.render();
    });
  }

  /** @this {IntelWindow} */
  static #onPick(_event, target) {
    this.unitId = target.dataset.unit;
    this.render();
  }

  /** @this {IntelWindow} */
  static async #onBuyEntry(_event, target) {
    await this.#press({ entry: target.dataset.entry });
  }

  /** @this {IntelWindow} */
  static async #onBuySection(_event, target) {
    await this.#press({ section: target.dataset.section });
  }

  /**
   * A buy, pressed: sent to the GM, its refusal said out loud.
   *
   * @param {{entry?: string, section?: string}} what
   * @returns {Promise<void>}
   */
  async #press(what) {
    const result = await buy({ factionId: this.factionId, unitId: this.unitId, ...what, userId: game.user.id })
      .catch((err) => ({ ok: false, reason: "error", message: err?.message }));
    if (!result?.ok) {
      const key = `FGT.Intel.Refused.${result?.reason ?? "unknown"}`;
      ui.notifications?.warn(result?.message ?? game.i18n.format(key, { need: result?.need ?? 0, held: result?.held ?? 0 }));
    }
    this.render();
  }
}

/**
 * Double-click on a token: a Unit the viewer does not own opens its Dossier
 * (DC.enemy); the GM may have double-click open Dossiers too (DC.gm).
 *
 * @param {object} token a Token placeable
 * @returns {boolean} whether the Dossier opened in place of the sheet
 */
export function openDossierOnDoubleClick(token) {
  const actor = token?.actor ?? null;
  if (!actor || !DOSSIER_KINDS.includes(actor.type) || !currentWar()) return false;
  const gmWants = game.user?.isGM && game.settings.get("fgt", "intelDoubleClickGM");
  if (actor.isOwner && !gmWants) return false;
  if (!game.user?.isGM) {
    const factionId = factionOfUser(game.user);
    const off = !intelOn();
    const held = off || Boolean(stateOf(notebookOf(factionId)).dossiers[actor.id]);
    if (!held) {
      ui.notifications?.info(game.i18n.localize("FGT.Intel.Nothing"));
      return true;
    }
  }
  IntelWindow.open(actor.id);
  return true;
}

/**
 * The Token Controls' Intel tool (WI.open.controls).
 *
 * @returns {void}
 */
export function attachIntelControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokens = controls.tokens ?? controls.token;
    if (!tokens?.tools) return;
    tokens.tools.fgtIntel = {
      name: "fgtIntel",
      title: "FGT.Intel.OpenHint",
      icon: "fa-solid fa-book-open",
      button: true,
      order: 90,
      onChange: () => IntelWindow.open(),
    };
  });
}
