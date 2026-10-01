/**
 * @file A bounded field and a painted area as a live board holds them.
 * @see docs/44-testing.md, test/helpers/subject.mjs, module/engine/fields.mjs#fieldDataOf
 *
 * A field is a Region carrying an `npField` behaviour, and a painted area is a
 * Region carrying a `terrain` one. The board never sees the Region: it reads the
 * behaviour back with `boundedFieldsOf` / `terrainAreasOf`. A fixture that wrote
 * the projected shape by hand could only confirm that projection, which is how a
 * key a Hop forgot to name reaches no reader and nothing fails (CONTEXT.md,
 * Silent Drop).
 *
 * So both are built the way a cast builds them. The field starts as the
 * COMPILED ability from `packs/_source`, its behaviour is written by the same
 * `fieldDataOf` `openField` calls, the REAL `NPFieldBehavior` / `TerrainBehavior`
 * DataModel keeps what it declares, and the REAL projection reads the rest back.
 *
 * Call these from inside a `withSubjects` callback, or after
 * `prepareSubjects()`: they need Foundry's data layer.
 */

import { loadSource } from "../../tools/lib/load.mjs";
import { compileDocument } from "../../tools/lib/content.mjs";
import { installSystem } from "../../tools/lib/foundry.mjs";

/** @type {Promise<{library: Map<string, {doc: object, dir: string}>, docs: Map<string, object>}>|null} */
let CORPUS = null;

function corpus() {
  CORPUS ??= (async () => {
    const { files } = await loadSource("packs/_source");
    const library = new Map(files.filter((f) => f.doc?.id).map((f) => [f.doc.id, { doc: f.doc, dir: f.dir }]));
    return { library, docs: new Map([...library].map(([id, { doc }]) => [id, doc])) };
  })();
  return CORPUS;
}

/**
 * A corpus document through the real compile, as the pack holds it.
 *
 * @param {string} id a content id
 * @returns {Promise<object>} the compiled document (`{name, type, system}`)
 */
export async function compiled(id) {
  const { library, docs } = await corpus();
  const entry = library.get(id);
  if (!entry) throw new Error(`No document "${id}" in packs/_source.`);
  return compileDocument(entry.doc, entry.dir, docs);
}

/** Run `fn` with a `canvas` that has a grid, which is all `boundedFieldsOf` asks of one. */
function withGrid(fn) {
  const saved = globalThis.canvas;
  globalThis.canvas = { ...(saved ?? {}), grid: saved?.grid ?? {} };
  try {
    return fn();
  } finally {
    if (saved === undefined) delete globalThis.canvas;
    else globalThis.canvas = saved;
  }
}

/** A Region as the board reads one: an id, behaviours, and the panels it covers. */
const regionOf = (id, behavior, panels) => ({
  id, behaviors: [behavior], getOccupiedGridSpaceOffsets: () => panels.map(({ i, j }) => ({ i, j })),
});

/** The square of panels `size` wide around `(i, j)`. */
export function squareAround({ i, j }, size) {
  const r = Math.floor(size / 2);
  const out = [];
  for (let a = i - r; a <= i + r; a++) for (let b = j - r; b <= j + r; b++) out.push({ i: a, j: b });
  return out;
}

/**
 * @typedef {object} FieldCast
 * @property {string} ability the content id of the ability that opens it
 * @property {string} [as] open it under another field id, for a board that needs two of one kind
 * @property {string} owner the owner's actor id
 * @property {string|null} [ownerMaster] the owner's Master's actor id
 * @property {string|null} [faction] the owner's faction
 * @property {{i: number, j: number}[]} panels the panels the Region covers
 * @property {{i: number, j: number, k?: number}} [anchor] where it was cast; the middle of its panels by default
 * @property {number} [createdAt]
 * @property {object} [state] what the field's own state holds (`enteredAt`, ...)
 */

/**
 * The fields a live board would project for these casts.
 *
 * @param {FieldCast[]} casts
 * @returns {Promise<object[]>} `board.fields`
 */
export async function fieldsOf(casts) {
  const models = await installSystem();
  const { fieldDataOf } = await import("../../module/engine/fields.mjs");
  const regions = [];
  for (const [n, cast] of casts.entries()) {
    const authored = await compiled(cast.ability);
    const ability = cast.as ? { ...authored, system: { ...authored.system, contentId: cast.as } } : authored;
    const spec = ability.system.field;
    if (!spec) throw new Error(`"${cast.ability}" authors no field.`);
    // The anchor `openField` stamps: where it was cast, and on which Level.
    const middle = cast.panels[Math.floor(cast.panels.length / 2)];
    const anchor = { i: middle.i, j: middle.j, k: 0, ...(cast.anchor ?? {}) };
    const data = fieldDataOf({
      ability, actor: { id: cast.owner, system: { masterId: cast.ownerMaster ?? null } },
      faction: cast.faction ?? null, spec, geometry: { ...(spec.geometry ?? {}), anchor },
      membership: spec.membership, duration: spec.duration,
    });
    data.createdAt = cast.createdAt ?? 0;
    data.state = { escapeHistory: {}, ...(cast.state ?? {}) };
    const system = new models.RegionBehavior.npField(structuredClone(data), { strict: true }).toObject();
    regions.push(regionOf(`field${n}`, { type: "npField", system }, cast.panels));
  }
  const { boundedFieldsOf } = await import("../../module/engine/board.mjs");
  return withGrid(() => boundedFieldsOf({ regions }));
}

/**
 * What `paintTerrain` is handed: the argument itself, as a `zone` phase builds it
 * (`zonePaintArgs`) or as a test states it.
 *
 * @typedef {object} AreaCast
 * @property {object} paint `paintTerrain`'s argument -- `types`, `panels`, `tag`, and whatever else a painting carries
 * @property {number|null} [expiry] the absolute tick it disappears on
 */

/**
 * The terrain areas a live board would project for these paintings.
 *
 * Written by the same `terrainDataOf` `paintTerrain` calls, kept by the real
 * `TerrainBehavior`, and read back by the real `terrainAreasOf`.
 *
 * @param {AreaCast[]} casts
 * @returns {Promise<object[]>} `board.terrain.areas`
 */
export async function areasOf(casts) {
  const models = await installSystem();
  const { terrainDataOf } = await import("../../module/engine/terrain.mjs");
  const regions = casts.map(({ paint, expiry = null }, n) => {
    const system = new models.RegionBehavior.terrain(
      structuredClone(terrainDataOf(paint, expiry)), { strict: true },
    ).toObject();
    return regionOf(`area${n}`, { type: "terrain", system }, paint.panels);
  });
  const { terrainAreasOf } = await import("../../module/engine/board.mjs");
  return withGrid(() => terrainAreasOf({ regions }));
}

/** Load the corpus ahead of the first test, which would otherwise spend it inside its own timeout. */
export async function prepareFields() {
  await installSystem();
  await corpus();
}

/**
 * Every ability the corpus authors, through the real compile.
 *
 * For a test that must hold over every ability that states something, so a
 * new one is covered without a new test.
 *
 * @returns {Promise<Array<{id: string, doc: object}>>} `doc` is the compiled document
 */
export async function corpusAbilities() {
  const { library, docs } = await corpus();
  return [...library]
    .filter(([, { dir }]) => dir === "abilities")
    .map(([id, { doc, dir }]) => ({ id, doc: compileDocument(doc, dir, docs) }));
}
