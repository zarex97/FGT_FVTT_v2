/**
 * @file Foundry's real data layer, loaded from a private copy outside this repository.
 * @see docs/adr/0006-tests-and-build-run-real-foundry.md, docs/44-testing.md
 *
 * A Silent Drop is a key discarded with no error, and a dozen of this project's
 * were Foundry's own `SchemaField` pruning a key the schema did not declare.
 * Nothing could see those while every test ran against an imitation of the
 * field classes, so the tests and the build import the real ones instead —
 * `common/` only, which is pure ESM and needs three globals to run. The
 * `client/` layer does not import in Node (DOM, PIXI, `@common` aliases) and is
 * not attempted here.
 *
 * Foundry is proprietary and this repository is public, so the source is read
 * from `FOUNDRY_PATH`, defaulting to a sibling checkout of the private
 * `zarex97/foundryVTT_copy`. When it is missing the run FAILS: a guard that
 * skips itself when it cannot run is a Silent Drop of its own.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_REPO = "zarex97/foundryVTT_copy";

/**
 * Find the Foundry copy and prove it is the build this system is verified on.
 *
 * Checked before anything is imported, so a stale copy cannot leave half its
 * globals installed. The build is compared against `system.json`'s
 * `compatibility.verified` because a copy of another build would test that
 * build's cleaning rules, and they are not constant between releases.
 *
 * @param {{path?: string}} [options] Defaults to `FOUNDRY_PATH`, then `../foundryVTT_copy`.
 * @returns {{path: string, version: string}} `version` is the `major.build` form `system.json` uses.
 */
export function locateFoundry({ path } = {}) {
  const root = resolve(path ?? process.env.FOUNDRY_PATH ?? join(REPO, "..", "foundryVTT_copy"));
  const manifest = join(root, "app", "package.json");
  if (!existsSync(join(root, "app", "common")) || !existsSync(manifest)) {
    throw new Error(
      `Foundry's source was not found at ${root}. The tests and the build run Foundry's real data layer `
      + `(docs/adr/0006-tests-and-build-run-real-foundry.md) and do not skip without it. Clone the private `
      + `${SOURCE_REPO} beside this repository, or set FOUNDRY_PATH to a checkout of it.`,
    );
  }

  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  const version = `${String(pkg.version).split(".")[0]}.${pkg.release?.build}`;
  const verified = String(JSON.parse(readFileSync(join(REPO, "system.json"), "utf8")).compatibility.verified);
  if (version !== verified) {
    throw new Error(
      `The Foundry copy at ${root} is build ${version}, but system.json is verified on ${verified}. `
      + `Update ${SOURCE_REPO} to ${verified}, or update system.json's compatibility.verified with the system.`,
    );
  }
  return { path: root, version };
}

/** @type {Promise<{path: string, version: string}>|null} */
let loaded = null;

/**
 * Import Foundry's `common/` layer and install the globals it defines.
 *
 * After this, `globalThis.foundry` is the real namespace — `foundry.data.fields`,
 * `foundry.abstract.DataModel`, `foundry.documents.BaseActor` — and `CONST` is
 * installed. Idempotent: a second call returns the first call's copy.
 *
 * @param {{path?: string}} [options]
 * @returns {Promise<{path: string, version: string}>}
 */
export function loadFoundry(options) {
  loaded ??= (async () => {
    const copy = locateFoundry(options);
    // `common/abstract/data.mjs` reports validation failures through a bare
    // `logger`, which the client installs in `client/_module.mjs`.
    globalThis.logger ??= console;
    await import(pathToFileURL(join(copy.path, "app", "common", "server.mjs")).href);
    installClientStandIns();
    return copy;
  })();
  return loaded;
}

/**
 * The one client-side class `module/data/**` extends.
 *
 * `RegionBehaviorType` lives in `client/data/region-behaviors/base.mjs`, which
 * does not import here. `module/data/regions.mjs` uses nothing of it beyond
 * being a `TypeDataModel`, so the stand-in is exactly that and no more — its
 * schema, which is the part a Silent Drop lives in, is still the real one.
 */
function installClientStandIns() {
  if (foundry.data.regionBehaviors) return;
  const { TypeDataModel } = foundry.abstract;
  // `foundry.data` is a module namespace, which Node seals; the global's own
  // object is not, so the namespace is re-spread with the one addition.
  foundry.data = {
    ...foundry.data,
    regionBehaviors: { RegionBehaviorType: class RegionBehaviorType extends TypeDataModel {} },
  };
}

/**
 * Register this system's DataModels the way `module/fgt.mjs` does at `init`,
 * with the `game` and `CONFIG` a Document needs to construct.
 *
 * The type lists come from `system.json`, which is the list Foundry itself
 * reads; the model classes come from `module/data/index.mjs`, keyed exactly as
 * `fgt.mjs` keys them.
 *
 * @returns {Promise<Record<string, Record<string, Function>>>} The models, by document name then type.
 */
export async function installSystem() {
  await loadFoundry();
  const data = await import(pathToFileURL(join(REPO, "module", "data", "index.mjs")).href);
  const models = {
    Actor: {
      servant: data.ServantData, master: data.MasterData, civilian: data.CivilianData,
      summon: data.SummonData, platform: data.PlatformData, structure: data.StructureData,
    },
    Item: {
      ability: data.AbilityData, noblePhantasm: data.NoblePhantasmData,
      commandSpell: data.CommandSpellData, masterEssence: data.MasterEssenceData,
      equipment: data.EquipmentData,
    },
    ActiveEffect: { fgtEffect: data.EffectData },
    Combat: { match: data.MatchData },
    Combatant: { player: data.PlayerCombatantData },
    RegionBehavior: {
      terrain: data.TerrainBehavior, homeBase: data.HomeBaseBehavior,
      npField: data.NPFieldBehavior, platform: data.PlatformBehavior,
    },
  };

  const manifest = JSON.parse(readFileSync(join(REPO, "system.json"), "utf8"));
  const documentTypes = Object.fromEntries(
    Object.entries(manifest.documentTypes).map(([name, types]) => [name, Object.keys(types)]),
  );
  // Foundry's own page types, which a world has whatever the system declares;
  // the `rules` pack ships journal pages of the `text` type.
  documentTypes.JournalEntryPage ??= ["text", "image", "pdf", "video"];

  globalThis.CONFIG ??= {};
  for (const [name, byType] of Object.entries(models)) {
    CONFIG[name] = { ...(CONFIG[name] ?? {}), dataModels: byType };
  }
  // `common/documents/token.mjs:131` reads this when a Token schema is built.
  CONFIG.Token ??= {};
  CONFIG.Token.movement ??= { actions: {} };

  globalThis.game ??= {};
  Object.assign(game, {
    release: { generation: 14, build: Number(manifest.compatibility.verified.split(".")[1]) },
    // `grid` is read when a Token's schema is built (`common/documents/token.mjs`).
    system: { id: manifest.id, version: manifest.version, documentTypes: manifest.documentTypes, grid: manifest.grid },
    modules: new Map(),
    documentTypes: Object.fromEntries(
      Object.entries(documentTypes).map(([name, types]) => [name, ["base", ...types]]),
    ),
    // Foundry's own `game.model` always carries the "base" type beside the
    // system's; a Document's `TYPES` is read from it.
    model: Object.fromEntries(
      Object.entries(documentTypes).map(([name, types]) => [name, Object.fromEntries(["base", ...types].map((t) => [t, {}]))]),
    ),
  });
  game.release.version = `${game.release.generation}.${game.release.build}`;
  return models;
}

/* -------------------------------------------------------------------------- */
/*  Holding a write to what Foundry kept                                      */
/* -------------------------------------------------------------------------- */

/** Sets become arrays, which is the form `_source` stores them in. */
export function sourceForm(value) {
  if (value instanceof Set) return [...value].map(sourceForm);
  if (Array.isArray(value)) return value.map(sourceForm);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sourceForm(v)]));
  }
  return value;
}

/**
 * The first path at which `applied` is not what `requested` asked for, or null.
 *
 * This is the comparison every Silent Drop guard makes between what was asked
 * of Foundry and what it kept. An object asks only for the keys it names:
 * Foundry MERGES an object written to a `SchemaField` or `ObjectField`, so keys
 * already stored beside them are not a mismatch. An array asks for itself
 * exactly, because Foundry replaces arrays whole. `undefined` asks for nothing,
 * which is how Foundry's cleaning treats it too. A string that lands trimmed is
 * not a mismatch: `StringField` trims, and whitespace carries no Clause.
 *
 * @param {unknown} requested
 * @param {unknown} applied
 * @param {string} path where `requested` sits, for the report
 * @returns {{path: string, want: unknown, got: unknown}|null}
 */
export function firstMismatch(requested, applied, path) {
  return mismatches(requested, applied, path)[0] ?? null;
}

/**
 * Every path at which `applied` is not what `requested` asked for.
 *
 * `firstMismatch`, exhaustively: a build reporting on a whole document wants
 * every lost key at once, not one per run.
 *
 * @param {unknown} requested
 * @param {unknown} applied
 * @param {string} path
 * @returns {Array<{path: string, want: unknown, got: unknown}>}
 */
export function mismatches(requested, applied, path) {
  const want = sourceForm(requested);
  const got = sourceForm(applied);
  if (want && typeof want === "object" && !Array.isArray(want)) {
    if (!got || typeof got !== "object" || Array.isArray(got)) return [{ path, want, got }];
    return Object.entries(want).flatMap(([k, v]) => mismatches(v, got[k], `${path}.${k}`));
  }
  if (Array.isArray(want)) {
    if (!Array.isArray(got) || got.length !== want.length) return [{ path, want, got }];
    return want.flatMap((v, i) => mismatches(v, got[i], `${path}.${i}`));
  }
  if (want === undefined || Object.is(want, got)) return [];
  // A `StringField` trims. Surrounding whitespace carries no Clause, and a YAML
  // block scalar always ends in a newline, so this one coercion is not a drop.
  if (typeof want === "string" && typeof got === "string" && want.trim() === got) return [];
  return [{ path, want, got }];
}
