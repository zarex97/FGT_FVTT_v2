/**
 * @file The Wisdom of Dún Scáith setup dialog.
 * @see docs/36-case-remaining.md §36.4, docs/15-abilities.md §15.7
 *
 * Layer 4. Two stages, because §36.4 gives the two decisions to two different
 * people:
 *
 *   3. The GM chooses which to offer (they may curate).
 *   4. Scáthach's player picks two.
 *
 * Collapsing them into one dialog would be simpler and wrong — the curation is
 * a GM judgement about what is thematic, and the pick is the player's. The
 * second stage travels over `FGTSocket.ask`, so the player is asked on their
 * own client and the GM waits for the answer.
 *
 * The rank band is a **toggle**, not a filter: §15.7 says "preferably Rank B to
 * Rank A", and a war whose Servants sit outside that band must still offer
 * something.
 */

import { offerCopies, grantCopies } from "../engine/copy.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CopyDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-copy-dialog",
    classes: ["fgt", "copy-dialog"],
    tag: "form",
    position: { width: 620, height: "auto" },
    window: { title: "FGT.Copy.Title", resizable: true },
    form: { handler: CopyDialog.#onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleOffer: CopyDialog.#onToggleOffer,
      offerAll: CopyDialog.#onOfferAll,
      send: CopyDialog.#onSend,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/copy-dialog.hbs", scrollable: [".fgt-copy__list"] },
  };

  /** @type {string} */
  #copierId;

  /** @type {string} */
  #grantedBy;

  /** @type {number} */
  #slots;

  /** Ability ids the GM has ticked. @type {Set<string>} */
  #offered = new Set();

  /** Whether to show only the preferred rank band. @type {boolean} */
  #preferredOnly = false;

  /**
   * @param {object} options
   * @param {string} options.copierId
   * @param {string} [options.grantedBy] the ability doing the copying
   * @param {number} [options.slots]
   */
  constructor({ copierId, grantedBy = "wisdomOfDunScaith", slots = 2 }) {
    super();
    this.#copierId = copierId;
    this.#grantedBy = grantedBy;
    this.#slots = slots;
  }

  /**
   * Open for a Servant.
   * @param {object} options see the constructor
   * @returns {CopyDialog}
   */
  static open(options) {
    const app = new CopyDialog(options);
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const candidates = offerCopies({ copierId: this.#copierId });
    const shown = this.#preferredOnly ? candidates.filter((c) => c.preferred) : candidates;

    return {
      copier: game.actors.get(this.#copierId)?.name ?? this.#copierId,
      slots: this.#slots,
      preferredOnly: this.#preferredOnly,
      isEmpty: candidates.length === 0,
      // A band that hides everything is worse than no band: the GM sees an
      // empty list and no reason for it.
      bandEmpty: this.#preferredOnly && shown.length === 0 && candidates.length > 0,
      offeredCount: this.#offered.size,
      // Fewer offers than slots is a dead end -- the player would be asked to
      // pick two from one -- so the send button says so rather than failing
      // after the question has been asked.
      enough: this.#offered.size >= this.#slots,
      candidates: shown.map((c) => ({
        id: c.ability.id,
        unitId: c.unitId,
        name: c.ability.name,
        rank: c.ability.rank,
        from: c.unitName,
        preferred: c.preferred,
        offered: this.#offered.has(c.ability.id),
      })),
    };
  }

  /**
   * @this {CopyDialog}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {object} formData
   */
  static async #onChange(_event, _form, formData) {
    this.#preferredOnly = Boolean(formData.object.preferredOnly);
    this.render();
  }

  /**
   * @this {CopyDialog}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onToggleOffer(_event, target) {
    const id = target.closest("[data-ability-id]")?.dataset.abilityId;
    if (!id) return;
    if (this.#offered.has(id)) this.#offered.delete(id);
    else this.#offered.add(id);
    this.render();
  }

  /**
   * @this {CopyDialog}
   */
  static #onOfferAll() {
    const candidates = offerCopies({ copierId: this.#copierId });
    const shown = this.#preferredOnly ? candidates.filter((c) => c.preferred) : candidates;
    for (const c of shown) this.#offered.add(c.ability.id);
    this.render();
  }

  /**
   * Send the curated list to the player, and grant what they pick.
   *
   * @this {CopyDialog}
   */
  static async #onSend() {
    if (this.#offered.size < this.#slots) {
      ui.notifications.warn(game.i18n.format("FGT.Copy.NeedMore", { count: this.#slots }));
      return;
    }

    const candidates = offerCopies({ copierId: this.#copierId });
    const offered = candidates.filter((c) => this.#offered.has(c.ability.id));
    const picks = await askOwner(this.#copierId, offered, this.#slots);

    // A declined or timed-out question leaves the dialog open, because the GM's
    // curation is still valid and re-doing it would be the real cost.
    if (!picks) {
      ui.notifications.warn(game.i18n.localize("FGT.Copy.NoAnswer"));
      return;
    }

    const chosen = offered
      .filter((c) => picks.includes(c.ability.id))
      .map((c) => ({ unitId: c.unitId, abilityId: c.ability.id }));

    const result = await grantCopies({
      copierId: this.#copierId, picks: chosen, slots: this.#slots, grantedBy: this.#grantedBy,
    });
    if (!result.ok) {
      ui.notifications.error(game.i18n.format("FGT.Copy.Failed", { reason: result.reason }));
      return;
    }

    ui.notifications.info(game.i18n.format("FGT.Copy.Granted", { count: result.created }));
    await this.close();
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Ask the copier's owner which to take.
 *
 * Falls back to asking the GM when the Servant has no connected owner — an
 * unassigned Servant, or a player who has not logged in yet. Refusing outright
 * would make the whole ability unusable in solo prep, which is when a GM is
 * most likely to be setting a war up.
 *
 * @param {string} copierId
 * @param {Array<object>} offered
 * @param {number} slots
 * @returns {Promise<string[]|null>}
 */
async function askOwner(copierId, offered, slots) {
  const spec = {
    kind: "choose",
    title: game.i18n.localize("FGT.Copy.PickTitle"),
    hint: game.i18n.format("FGT.Copy.PickHint", { count: slots }),
    count: slots,
    options: offered.map((c) => ({
      id: c.ability.id,
      name: c.ability.name,
      subtitle: `${c.ability.rank ?? "—"} · ${c.unitName}`,
      detail: c.ability.description ?? "",
    })),
  };

  const owner = ownerOf(copierId);
  const { FGTSocket } = await import("../net/socket.mjs");

  try {
    return await FGTSocket.ask(owner?.id ?? game.user.id, spec);
  } catch (err) {
    console.warn("FGT | Copy prompt failed", err);
    return null;
  }
}

/**
 * The connected player who owns this actor, if there is one.
 * @param {string} actorId
 * @returns {object|null}
 */
function ownerOf(actorId) {
  const actor = game.actors.get(actorId);
  if (!actor) return null;
  return game.users.find((u) => !u.isGM && u.active && actor.testUserPermission(u, "OWNER")) ?? null;
}
