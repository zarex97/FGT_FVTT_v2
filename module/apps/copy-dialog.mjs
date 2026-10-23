/**
 * @file The Wisdom of Dún Scáith setup dialog.
 * @see docs/45-case-studies.md, docs/17-abilities.md
 *
 * Layer 4. Two stages, because Ch. 45 gives the two decisions to two different
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
 * The rank band is a **toggle**, not a filter: Ch. 17 says "preferably Rank B to
 * Rank A", and a war whose Servants sit outside that band must still offer
 * something.
 */

import { offerCopies, grantCopies, copyGrantOf, copyGrantSpec } from "../engine/copy.mjs";
import { unitActor } from "../engine/board.mjs";

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

  /** The grant's own name: Wisdom of Dún Scáith, Wisdom of Divine Gift (#326). @type {string} */
  #grantName;

  /** Ability ids the GM has ticked. @type {Set<string>} */
  #offered = new Set();

  /** Whether to show only the preferred rank band. @type {boolean} */
  #preferredOnly = false;

  /**
   * @param {object} options
   * @param {string} options.copierId
   * @param {string} [options.grantedBy] the ability doing the copying
   */
  constructor({ copierId, grantedBy = null }) {
    super();
    this.#copierId = copierId;
    // The grant's own terms (#326): Scáthach copies two, Chiron three.
    const grant = copyGrantOf(unitActor(copierId));
    const terms = copyGrantSpec(grant);
    this.#grantedBy = grantedBy ?? terms?.grantedBy ?? null;
    this.#slots = terms?.slots ?? 0;
    // Its name, never Scáthach's: Chiron's pick opened titled hers (#326, live).
    this.#grantName = grant?.name ?? game.i18n.localize("FGT.Copy.Title");
  }

  /** @override */
  get title() {
    return this.#grantName;
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
    const offer = offerCopies({ copierId: this.#copierId });
    const candidates = offer ?? [];
    const shown = this.#preferredOnly ? candidates.filter((c) => c.preferred) : candidates;

    return {
      // The copier is not on the board the GM is looking at: no list yet.
      offBoard: offer === null,
      // fgt-name-ok: the copy picker, the GM's (#204 reading 8)
      copier: game.actors.get(this.#copierId)?.name ?? this.#copierId,
      slots: this.#slots,
      preferredOnly: this.#preferredOnly,
      isEmpty: offer !== null && candidates.length === 0,
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
    const candidates = offerCopies({ copierId: this.#copierId }) ?? [];
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

    const candidates = offerCopies({ copierId: this.#copierId }) ?? [];
    const offered = candidates.filter((c) => this.#offered.has(c.ability.id));
    const picks = await askOwner(this.#copierId, offered, this.#slots, this.#grantName);

    // A declined or timed-out question leaves the dialog open, because the GM's
    // curation is still valid and re-doing it would be the real cost.
    if (!picks) {
      ui.notifications.warn(game.i18n.localize("FGT.Copy.NoAnswer"));
      return;
    }

    const chosen = offered
      .filter((c) => picks.includes(c.ability.id))
      .map((c) => ({ unitId: c.unitId, abilityId: c.ability.id }));

    const result = await grantCopies({ copierId: this.#copierId, picks: chosen, grantedBy: this.#grantedBy });
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
 * @param {string} title the grant's name
 * @returns {Promise<string[]|null>}
 */
async function askOwner(copierId, offered, slots, title) {
  const spec = {
    kind: "choose",
    title,
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
