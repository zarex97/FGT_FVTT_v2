/**
 * @file The pre-migration backup.
 * @see docs/39-migration-and-versioning.md §39.2, D39.3
 *
 * Layer 4.
 *
 * > *"Before any migration, export the world's F/GT documents to a timestamped
 * > JSON file in the world directory. Non-negotiable. Migrations are the
 * > highest-risk operation the system performs and the cost of a backup is a
 * > few hundred kilobytes."*
 *
 * A real file rather than a browser download: a download is a prompt the GM can
 * dismiss, and a backup nobody kept is not a backup.
 */

/**
 * Every F/GT document in the world, as source data.
 *
 * Source, not prepared data: a migration reads what is stored, and prepared
 * data contains derived values that would restore as though they had been
 * authored.
 *
 * @returns {object}
 */
export function collectWorldDocuments() {
  return {
    takenAt: new Date().toISOString(),
    world: game.world.id,
    systemVersion: game.system.version,
    schemaVersion: game.settings.get("fgt", "schemaVersion") ?? null,
    actors: game.actors.map((a) => a.toObject()),
    items: game.items.map((i) => i.toObject()),
    scenes: game.scenes.map((s) => s.toObject()),
    combats: game.combats.map((c) => c.toObject()),
  };
}

/**
 * Write a backup into the world's own directory.
 *
 * `FilePicker.upload` puts the file where the world lives, so a GM restoring it
 * does not have to find a download. A failure here is fatal to the caller by
 * contract: `runner.mjs` aborts rather than migrating unbacked data.
 *
 * @param {object} payload
 * @param {string} label a short tag for the filename, e.g. "schema" or "sync"
 * @returns {Promise<{path: string, bytes: number}>}
 * @throws {Error} when the write fails
 */
export async function writeBackup(payload, label) {
  const json = JSON.stringify(payload, null, 2);
  const stamp = payload.takenAt.replace(/[:.]/g, "-");
  const dir = `worlds/${game.world.id}/fgt-backups`;
  const name = `${stamp}-${label}.json`;

  // Idempotent: creating a directory that exists throws, and that throw is not
  // a failure of the backup.
  try {
    await foundry.applications.apps.FilePicker.implementation.createDirectory("data", dir);
  } catch (err) {
    if (!/EEXIST|already exists/i.test(String(err?.message ?? err))) throw err;
  }

  const file = new File([json], name, { type: "application/json" });
  const result = await foundry.applications.apps.FilePicker.implementation
    .upload("data", dir, file, {}, { notify: false });
  if (!result?.path) throw new Error(`FGT | Backup upload returned no path for ${dir}/${name}`);

  return { path: result.path, bytes: json.length };
}
