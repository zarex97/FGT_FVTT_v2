/**
 * @file Reconciling a world document against its pack document.
 * @see docs/39-migration-and-versioning.md §39.6
 *
 * Layer 2-equivalent: pure, no `game`, no `canvas`. The runner that walks the
 * world lives beside this and is Layer 4; this file only decides what to write.
 *
 * The compendium is the whole source of truth (spec R1). A world copy is an
 * instance of pack content plus everything the match has written to it, and the
 * whole difficulty is telling those apart -- `module/content/authored-fields.mjs`
 * is that judgement, and this file applies it.
 */

import {
  ownedByWorld, COOLDOWN_OWNED_BY_WORLD, SUMMON_VARIANT_OWNED_BY_WORLD,
} from "../content/authored-fields.mjs";

/**
 * Fields that mark an item as granted during play rather than authored.
 *
 * An ability copied by Wisdom of Dún Scáith carries both. It is not in any pack
 * template, so a naive sync would delete it every time the world loaded.
 */
export const PROVENANCE_KEYS = Object.freeze(["copiedFrom", "grantedBy"]);

/**
 * The system data to write onto a world document.
 *
 * Starts from the world's own data and overlays the pack's, key by key, taking
 * the pack's value only where the pack owns the key. Neither input is mutated:
 * callers pass documents they still hold.
 *
 * @param {"actor"|"item"} kind
 * @param {object} worldSystem the world document's system source
 * @param {object} packSystem the pack document's system source
 * @param {{type?: string|null}} [options] the document's type, for `SEEDED_BY_TYPE`
 * @returns {object} the merged system data
 */
export function reconcileSystem(kind, worldSystem, packSystem, { type = null } = {}) {
  const out = { ...(worldSystem ?? {}) };

  for (const [key, value] of Object.entries(packSystem ?? {})) {
    if (ownedByWorld(kind, key, type)) continue;

    // Two keys are half the pack's and half the world's: the pack states the
    // SHAPE and the match states what it has done with it (Ch. 39, spec R2).
    // `cooldown`'s clock is what the match has spent, and `summonVariant`'s
    // `variant` is how the coin actually came up.
    const split = key === "cooldown" ? COOLDOWN_OWNED_BY_WORLD
      : key === "summonVariant" ? SUMMON_VARIANT_OWNED_BY_WORLD
        : null;
    if (split) {
      const world = worldSystem?.[key] ?? {};
      const merged = { ...(value ?? {}) };
      for (const owned of split) {
        if (world[owned] !== undefined) merged[owned] = world[owned];
      }
      out[key] = merged;
      continue;
    }

    out[key] = value;
  }

  return out;
}

/**
 * What to do with a document's embedded items.
 *
 * Matched by `contentId`, which is the stable name a pack document carries and
 * a Foundry id is not: a world copy has its own ids, and they must survive so
 * that anything referencing an item by id keeps working.
 *
 * An item on the world copy that the template does not list is removed only if
 * its `contentId` is in NO pack at all. If the ability still exists as content,
 * its presence here is something play did -- crafted, granted, transferred --
 * and deleting it destroys a match. The first live dry run caught exactly this:
 * `semiramis-poison` is an ability Semiramis MAKES with Item Construction, it is
 * on no actor template, and it carries neither `copiedFrom` nor `grantedBy`, so
 * the provenance check alone would have swept every Poison she had crafted.
 *
 * @param {object[]} worldItems the world document's items, as source objects
 * @param {object[]} packItems the pack template's items, as source objects
 * @param {{knownContentIds?: Set<string>|null}} [options] every contentId any
 *   pack defines; without it, nothing outside the template is protected
 * @returns {{update: object[], create: object[], remove: string[], kept: string[]}}
 */
export function reconcileItems(worldItems, packItems, { knownContentIds = null } = {}) {
  const byContent = new Map();
  for (const item of packItems ?? []) {
    const id = item?.system?.contentId;
    if (id) byContent.set(id, item);
  }

  /** @type {object[]} */ const update = [];
  /** @type {string[]} */ const remove = [];
  /** @type {string[]} */ const kept = [];
  const seen = new Set();

  for (const held of worldItems ?? []) {
    const contentId = held?.system?.contentId ?? null;

    // Not pack content at all -- a GM's own item. Left alone.
    if (!contentId) { kept.push(held._id); continue; }

    // Granted during play. Not in any template, and not the pack's to remove.
    if (PROVENANCE_KEYS.some((k) => held.system?.[k])) { kept.push(held._id); continue; }

    const template = byContent.get(contentId);
    if (!template) {
      // Still real content, just not on this template: play put it here.
      if (knownContentIds?.has(contentId)) kept.push(held._id);
      else remove.push(held._id);
      continue;
    }

    seen.add(contentId);
    update.push({
      ...held,
      // The WORLD's id: a pack id here would delete and recreate the item,
      // breaking anything holding a reference to it.
      _id: held._id,
      name: template.name ?? held.name,
      img: template.img ?? held.img,
      system: reconcileSystem("item", held.system, template.system),
    });
  }

  const create = (packItems ?? []).filter((i) => {
    const id = i?.system?.contentId;
    return id && !seen.has(id);
  });

  return { update, create, remove, kept };
}
