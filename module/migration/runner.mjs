/**
 * @file Applying migrations and content sync to a live world.
 * @see docs/39-migration-and-versioning.md, docs/superpowers/specs/2026-09-09-migration-design.md
 *
 * Layer 4. The impure half: this walks the world and writes. Every judgement it
 * makes comes from `migrations.mjs` and `content-sync.mjs`, which are pure and
 * tested without a world.
 *
 * GM only. Two clients migrating one world at the same time is a corrupted
 * world, and Foundry gives no lock to prevent it -- so the guard is that only
 * one client is allowed to try.
 */

import { SCHEMA_VERSION, pendingFrom, applyMigration } from "./migrations.mjs";
import { collectWorldDocuments, writeBackup } from "./backup.mjs";
import { reconcileSystem, reconcileItems } from "./content-sync.mjs";

/**
 * Where the schema version lives.
 *
 * §39.1 said `world.flags.fgt.schemaVersion`. There is no such place: `game.world`
 * is a `World` **package**, not a Document -- it has no `flags` and no
 * `setFlag`, and Foundry ships no `systemMigrationVersion` of its own either.
 * A world-scoped setting is the only durable per-world store the API offers,
 * and it is what every other system uses for exactly this.
 */
const VERSION_SETTING = "schemaVersion";

/**
 * The world's recorded schema version, or `0` for a world that has never
 * recorded one.
 *
 * @returns {number}
 */
function recordedVersion() {
  const recorded = game.settings.get("fgt", VERSION_SETTING);
  return Number.isInteger(recorded) ? recorded : 0;
}

/**
 * The version to migrate FROM.
 *
 * A world with nothing recorded is treated as CURRENT rather than as zero. This
 * ships into worlds that predate it, and replaying every future migration
 * against data that never needed them would be a fabricated history.
 *
 * @returns {number}
 */
function worldVersion() {
  const recorded = recordedVersion();
  return recorded > 0 ? recorded : SCHEMA_VERSION;
}

/**
 * Apply every pending schema migration, backing the world up first.
 *
 * @returns {Promise<{ran: boolean, from?: number, to?: number, touched?: number, backup?: string}>}
 */
export async function migrateWorld() {
  const from = worldVersion();
  const pending = pendingFrom(from);
  if (pending.length === 0) {
    // Stamp a world that has never carried a version, so the next load is a
    // plain comparison rather than this same inference.
    if (recordedVersion() !== SCHEMA_VERSION) {
      await game.settings.set("fgt", VERSION_SETTING, SCHEMA_VERSION);
    }
    return { ran: false };
  }

  // D39.3: non-negotiable, and a failed backup ABORTS. There is no
  // "continue anyway" -- migrations are the highest-risk thing this system does.
  const backup = await writeBackup(collectWorldDocuments(), "schema");

  const ctx = { globalTurn: game.combats.active?.system?.globalTurn ?? 0 };
  let touched = 0;

  const walk = async (collection, kind) => {
    for (const doc of collection) {
      const source = doc.toObject();
      let next = source;
      for (const entry of pending) next = applyMigration(entry, kind, next, ctx);
      if (next === source) continue;
      await doc.update(next, { diff: false, recursive: false });
      touched += 1;
    }
  };

  await walk(game.actors, "actor");
  await walk(game.items, "item");
  await walk(game.scenes, "scene");
  await walk(game.combats, "combat");

  for (const entry of pending) {
    console.warn(`FGT | Migrated to schema ${entry.to}: ${entry.description}`);
  }

  await game.settings.set("fgt", VERSION_SETTING, SCHEMA_VERSION);
  return { ran: true, from, to: SCHEMA_VERSION, touched, backup: backup.path };
}

/**
 * Reconcile every world document against its pack document.
 *
 * The compendium is the whole source of truth (spec R1). A document with no
 * `contentId` is not pack content and is left entirely alone; one whose content
 * has been deleted from the packs is reported rather than mutated, because a
 * missing template is a GM's problem and not a thing to guess about.
 *
 * @param {{dryRun?: boolean}} [options]
 * @returns {Promise<{changed: object[], skipped: object[]}>}
 */
export async function syncContent({ dryRun = false } = {}) {
  const templates = await loadTemplates();
  const knownContentIds = await loadKnownItemIds();
  const changed = [];
  const skipped = [];

  for (const actor of game.actors) {
    const contentId = actor.system?.contentId ?? null;
    if (!contentId) continue;

    const template = templates.get(contentId);
    if (!template) {
      skipped.push({ name: actor.name, contentId, why: "no template in any pack" });
      continue;
    }

    const before = actor.toObject();
    const system = reconcileSystem("actor", before.system, template.system, { type: actor.type });
    const items = reconcileItems(before.items ?? [], template.items, { knownContentIds });

    const systemChanged = !same(system, before.system);

    // Only the items that actually MOVED. `reconcileItems` returns an entry for
    // every matched item, and writing all of them every load would touch a
    // hundred documents to change nothing -- and make the idempotence check
    // meaningless, since the report would never reach zero.
    const held = new Map((before.items ?? []).map((i) => [i._id, i]));
    const refreshed = items.update.filter((u) => {
      const was = held.get(u._id);
      if (!was) return true;
      return u.name !== was.name || u.img !== was.img || !same(u.system, was.system);
    });
    const itemsChanged = items.create.length > 0 || items.remove.length > 0 || refreshed.length > 0;
    if (!systemChanged && !itemsChanged) continue;

    changed.push({
      name: actor.name,
      contentId,
      system: systemChanged,
      created: items.create.map((i) => i.system?.contentId),
      removed: items.remove.length,
      refreshed: refreshed.map((u) => u.system?.contentId),
    });
    if (dryRun) continue;

    if (systemChanged) await actor.update({ system }, { diff: false, recursive: false });
    if (items.remove.length) await actor.deleteEmbeddedDocuments("Item", items.remove);
    if (refreshed.length) await actor.updateEmbeddedDocuments("Item", refreshed, { diff: false });
    if (items.create.length) await actor.createEmbeddedDocuments("Item", items.create);
  }

  return { changed, skipped };
}

/**
 * Every `contentId` any F/GT Item pack defines.
 *
 * An item on an actor that no template lists is only stale if content has
 * forgotten it entirely. If the ability still exists, play put it there --
 * Semiramis crafts `semiramis-poison` with Item Construction, and it is on no
 * actor template.
 *
 * @returns {Promise<Set<string>>}
 */
async function loadKnownItemIds() {
  const out = new Set();
  for (const pack of game.packs) {
    if (pack.metadata.packageName !== "fgt") continue;
    if (pack.documentName !== "Item") continue;
    const index = await pack.getIndex({ fields: ["system.contentId"] });
    for (const entry of index) {
      if (entry.system?.contentId) out.add(entry.system.contentId);
    }
  }
  return out;
}

/**
 * Text as it compares, once Foundry has had its way with it.
 *
 * An HTML field is escaped on save: the pack holds `Kanshou & Bakuya` and the
 * document stores `Kanshou &amp; Bakuya`. Write the pack's value and it comes
 * back escaped again, so a literal comparison NEVER converges -- the second
 * live run still reported 17 actors as changed, and would have rewritten them
 * on every world load for ever. Decoding both sides is the fix, and the price
 * is that a content edit which changes only an entity is not pushed.
 *
 * @param {string} text
 * @returns {string}
 */
function decoded(text) {
  let out = text;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = out
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Deep equality that ignores what neither side controls.
 *
 * Key ORDER: the first dry run reported 66 Servants as changed because the pack
 * writes `normalAttack` as `{mode, component, element, bands}` and the world
 * holds `{mode, component, bands, element}` -- identical data, and
 * `JSON.stringify` says they differ. Entity ESCAPING: see `decoded`. Between
 * them these two accounted for 83 of the first run's 100 reported changes, all
 * of which would have been rewritten on every load and none of which were real.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function same(a, b) {
  if (typeof a === "string" && typeof b === "string") return decoded(a) === decoded(b);
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, i) => same(value, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => key in b && same(a[key], b[key]));
  }
  return a === b;
}

/**
 * Every pack document that world content could be an instance of, by contentId.
 *
 * @returns {Promise<Map<string, {system: object, items: object[]}>>}
 */
async function loadTemplates() {
  const out = new Map();
  for (const pack of game.packs) {
    if (pack.metadata.packageName !== "fgt") continue;
    if (pack.documentName !== "Actor") continue;
    for (const doc of await pack.getDocuments()) {
      const contentId = doc.system?.contentId;
      if (!contentId) continue;
      const obj = doc.toObject();
      out.set(contentId, { system: obj.system, items: obj.items ?? [] });
    }
  }
  return out;
}

/**
 * The `ready` entry point: migrate, then sync, then say what happened.
 *
 * Order matters. A migration fixes the SHAPE of stored data and the sync then
 * reconciles its CONTENT; running the sync first would reconcile against a
 * shape the pack no longer uses.
 *
 * @returns {Promise<void>}
 */
export async function onReady() {
  if (!game.user.isGM) return;
  if (!game.users.activeGM?.isSelf) return;   // exactly one client, never two

  try {
    const migrated = await migrateWorld();
    if (migrated.ran) {
      ui.notifications.info(game.i18n.format("FGT.Migration.Ran", {
        from: migrated.from, to: migrated.to, n: migrated.touched,
      }));
      console.warn(`FGT | Backup written to ${migrated.backup}`);
    }

    const synced = await syncContent();
    if (synced.changed.length > 0) {
      ui.notifications.info(game.i18n.format("FGT.Migration.Synced", { n: synced.changed.length }));
      console.warn("FGT | Content sync:", synced.changed);
    }
    if (synced.skipped.length > 0) console.warn("FGT | Content sync skipped:", synced.skipped);
  } catch (err) {
    // Loud. A half-migrated world that boots quietly is worse than one that
    // refuses to, and the backup path is in the log above.
    console.error("FGT | Migration failed:", err);
    ui.notifications.error(game.i18n.localize("FGT.Migration.Failed"), { permanent: true });
  }
}
