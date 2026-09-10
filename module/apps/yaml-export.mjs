/**
 * @file Writing a document back to its pack source.
 * @see docs/29-user-interface.md §29.6, docs/39-migration-and-versioning.md
 *
 * Layer 4.
 *
 * The inverse of `tools/lib/content.mjs`'s loader, and the reason the
 * compendium can be the whole source of truth without that costing a GM their
 * authoring: work done in the ability editor goes back to
 * `packs/_source/**.yml`, becomes a pack change, and returns through the
 * ordinary sync.
 *
 * What it must NOT export is as important as what it must: a cooldown with four
 * Turns left on it is not content, and authoring it would ship a Servant that
 * starts the game part-way into its own clock.
 */

import {
  AUTHORED_ITEM_KEYS, SEEDED_THEN_OWNED, COOLDOWN_OWNED_BY_WORLD,
} from "../content/authored-fields.mjs";

/**
 * Runtime fields the allowlist happens to name (Ch. 39, spec R2).
 *
 * `SEEDED_THEN_OWNED.item` is the same judgement the content sync makes in the
 * other direction -- what the pack must not overwrite is exactly what the
 * export must not write -- plus `expended`, which is not authored at all and so
 * never appears in that list.
 */
const RUNTIME = new Set([...SEEDED_THEN_OWNED.item, "expended"]);

/**
 * Is this value worth writing to a source file?
 *
 * An empty array or a null reads as a statement in YAML -- "this ability has no
 * tags" rather than "this ability says nothing about tags" -- and the loader
 * treats absence and emptiness identically. So absence is the honest form.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function worthWriting(value) {
  if (value === null || value === undefined) return false;
  if (value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/**
 * A document as its pack source would state it.
 *
 * @param {object} item an ability Item, or anything with `{name, system}`
 * @returns {object}
 */
export function toAuthoredSource(item) {
  const system = item?.system ?? {};
  /** @type {Record<string, unknown>} */
  const out = { schema: 1 };

  // `contentId` is `id` in the source vocabulary -- the loader's own naming,
  // and `documentId()` derives the Foundry id from it.
  if (system.contentId) out.id = system.contentId;
  if (item?.name) out.name = item.name;

  for (const key of AUTHORED_ITEM_KEYS) {
    if (key === "contentId" || RUNTIME.has(key)) continue;

    let value = system[key];

    if (key === "cooldown" && value && typeof value === "object") {
      value = Object.fromEntries(
        Object.entries(value)
          .filter(([k, v]) => !COOLDOWN_OWNED_BY_WORLD.includes(k) && worthWriting(v)),
      );
    }

    if (worthWriting(value)) out[key] = value;
  }

  return out;
}

/**
 * Stage it for the pack source, or hand it to the GM as a download.
 *
 * **JSON, not YAML.** Nothing under `module/` imports an npm package -- there
 * are zero bare-specifier imports and no bundler -- so the browser cannot reach
 * the `yaml` library, and hand-rolling an emitter for a format this full of
 * edge cases would be a bug generator. The browser writes the authored shape;
 * `tools/stage-to-yaml.mjs` turns it into the `.yml` the loader reads, on the
 * side where `yaml` already lives.
 *
 * The upload is attempted first because a staged file is one command from being
 * content -- but an install that refuses uploads must not lose the work, so the
 * download is a fallback rather than the plan.
 *
 * @param {object} item
 * @returns {Promise<{path: string}|null>}
 */
export async function exportItem(item) {
  const json = JSON.stringify(toAuthoredSource(item), null, 2);
  const name = `${item.system?.contentId ?? "ability"}.export.json`;
  const dir = "systems/fgt/packs/_staged";

  try {
    // Idempotent: creating a directory that exists throws, and that throw is
    // not a failure of the export.
    try {
      await foundry.applications.apps.FilePicker.implementation.createDirectory("data", dir);
    } catch (err) {
      if (!/EEXIST|already exists/i.test(String(err?.message ?? err))) throw err;
    }

    const file = new File([json], name, { type: "application/json" });
    const result = await foundry.applications.apps.FilePicker.implementation
      .upload("data", dir, file, {}, { notify: false });
    if (result?.path) {
      ui.notifications.info(game.i18n.format("FGT.Export.Written", { path: result.path }));
      return { path: result.path };
    }
  } catch (err) {
    console.warn("FGT | Staging upload refused, falling back to download:", err);
  }

  foundry.utils.saveDataToFile(json, "application/json", name);
  ui.notifications.info(game.i18n.format("FGT.Export.Downloaded", { name }));
  return null;
}
