/**
 * @file Test subjects built the way a live board builds them.
 * @see docs/44-testing.md, test/unit/survival.test.mjs, test/helpers/world.mjs
 *
 * A fixture written in the shape a reader expects can only confirm that reader.
 * At least eight Silent Drops hid behind one: an Aura's post-executor shape
 * hand-written WITH the `check` the executor dropped (8037d25), a document shape
 * where the reader was handed a flattened snapshot (7c76746), `grantedSteps` and
 * `unremovable` injected by hand (610c3b6, #80), a fixture that was "my
 * assumption, which can only confirm my assumption" (#19). Every fix that stuck
 * made the test go through real content and the real projection.
 *
 * So a subject is AUTHORED, never projected by hand. It starts as a Unit from
 * the real corpus, or as a small description in the same YAML shape as
 * `packs/_source`, and goes through the real compile, the real DataModel (the
 * test world's loud prune), the real prepare chain and the real `snapshotUnit`
 * and `snapshotBoard`. A test may change what was authored (`with`), the state
 * the world holds (`state`, `effects`), and where the Unit stands (`panel`). It
 * may not change what the projection produced — that is the thing under test.
 */

import { loadSource } from "../../tools/lib/load.mjs";
import { compileDocument } from "../../tools/lib/content.mjs";
import { installSystem } from "../../tools/lib/foundry.mjs";
import { withWorld, keptByModel } from "./world.mjs";

/** The source directory each actor type is authored in. */
const DIR_OF_TYPE = Object.freeze({
  servant: "servants", master: "masters", summon: "summons",
  platform: "platforms", structure: "structures", civilian: "summons",
});

/** @type {Promise<{library: Map<string, {doc: object, dir: string}>, effects: object[]}>|null} */
let CORPUS = null;

/** The real corpus, loaded once per test file. */
function corpus() {
  CORPUS ??= (async () => {
    const { files } = await loadSource("packs/_source");
    const library = new Map(files.filter((f) => f.doc?.id).map((f) => [f.doc.id, { doc: f.doc, dir: f.dir }]));
    const docs = new Map([...library].map(([id, { doc }]) => [id, doc]));
    const effects = files.filter((f) => f.dir === "effects").map((f) => compileDocument(f.doc, "effects", docs));
    return { library, docs, effects };
  })();
  return CORPUS;
}

/** A compiled document as Foundry would hand it over: without the pack's `_key`s. */
function withoutKeys(value) {
  if (Array.isArray(value)) return value.map(withoutKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "_key").map(([k, v]) => [k, withoutKeys(v)]));
  }
  return value;
}

/**
 * @typedef {object} SubjectSpec
 * @property {string|object} from a corpus content id (`"kiritsugu"`), or an
 *   authored Unit in the YAML shape — `{type, id, name, ...keys, abilities}`,
 *   where `abilities` holds `{ref, ...params}` entries or inline Abilities
 * @property {string} [id] the actor's id in the world; defaults to the content id
 * @property {object} [with] authored keys layered over `from`, before the compile
 * @property {object} [state] runtime state the world holds — `factionId`, a
 *   `homeBase` count, a stamped `roundState` — seeded through the DataModel
 * @property {object[]} [effects] effect instances the Unit carries, as their
 *   `system` data (`{defId, ...}`), created as real ActiveEffects
 * @property {{i: number, j: number}} [panel] where it stands
 */

/**
 * Build Units from authored content, put them in a world, and project them.
 *
 * `tokens: true` stands a token on the panel of every Subject that has one, as a
 * live board does, so an engine function that reads `currentBoard()` finds them;
 * `combat` and `worldSettings` are the world's own (`test/helpers/world.mjs`),
 * where `settings` is what the board snapshot is built from.
 *
 * @param {SubjectSpec[]} specs
 * @param {(ctx: {units: object[], unit: (id: string) => object, board: object, world: object}) => unknown} fn
 * @param {{round?: number|null, tick?: number|null, settings?: object, tokens?: boolean,
 *   combat?: object, worldSettings?: object}} [opts]
 * @returns {Promise<unknown>}
 */
export async function withSubjects(specs, fn, {
  round = null, tick = null, settings = {}, tokens = false, combat = undefined, worldSettings = undefined,
} = {}) {
  await installSystem();
  const { library, docs, effects } = await corpus();
  const { EffectRegistry } = await import("../../module/rules/registry.mjs");
  const { snapshotUnit, snapshotBoard } = await import("../../module/rules/snapshot.mjs");
  EffectRegistry.load(effects.map((e) => ({ name: e.name, img: e.img, system: e.system })));

  const actors = await Promise.all(specs.map(async (spec) => {
    const base = typeof spec.from === "string" ? library.get(spec.from) : null;
    if (typeof spec.from === "string" && !base) throw new Error(`No Unit "${spec.from}" in packs/_source.`);
    const authored = { ...(base?.doc ?? spec.from), ...(spec.with ?? {}) };
    const dir = base?.dir ?? DIR_OF_TYPE[authored.type ?? "servant"];
    const compiled = withoutKeys(compileDocument(authored, dir, docs));
    // What the DataModel keeps of it: a world never holds anything else.
    const source = await keptByModel("Actor", compiled);
    return {
      id: spec.id ?? authored.id,
      name: source.name,
      type: source.type,
      system: { ...source.system, ...(spec.state ?? {}) },
      items: source.items.map((i) => ({ id: i._id, name: i.name, type: i.type, system: i.system })),
    };
  }));

  // One panel is 100 pixels in the test world (`world.mjs`).
  const placed = tokens
    ? specs.flatMap((spec, n) => (spec.panel
      ? [{ id: `token-${actors[n].id}`, actorId: actors[n].id, x: spec.panel.j * 100, y: spec.panel.i * 100 }]
      : []))
    : [];

  return withWorld({ actors, tokens: placed, combat, settings: worldSettings }, async (world) => {
    for (const [n, spec] of specs.entries()) {
      if (!spec.effects?.length) continue;
      await world.actor(actors[n].id).createEmbeddedDocuments("ActiveEffect", spec.effects.map((system) => ({
        name: system.defId, type: "fgtEffect", system,
      })));
    }
    const units = specs.map((spec, n) => snapshotUnit(world.actor(actors[n].id), {
      panel: spec.panel ?? null, round, tick,
    }));
    const board = snapshotBoard({
      scene: null,
      actors: units.map((snapshot) => ({ snapshot })),
      settings: { round, tickForTurnState: tick, ...settings },
    });
    const unit = (id) => board.units.find((u) => u.id === id) ?? null;
    return fn({ units, unit, board, world });
  });
}

/**
 * Load Foundry and the corpus ahead of the first subject.
 *
 * Both are loaded once per test file and take seconds, which a first test would
 * otherwise spend inside its own timeout. Call it from `beforeAll` with room.
 *
 * @returns {Promise<void>}
 */
export async function prepareSubjects() {
  await installSystem();
  await corpus();
}

/**
 * One Unit, projected alone.
 *
 * @param {SubjectSpec} spec
 * @param {object} [opts]
 * @returns {Promise<object>} its `UnitSnapshot`
 */
export function subject(spec, opts) {
  return withSubjects([spec], ({ units }) => units[0], opts);
}
