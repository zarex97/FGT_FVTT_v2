/**
 * @file A world faithful enough to run `module/engine/io.mjs` against.
 * @see docs/44-testing.md, docs/02-architecture.md
 *
 * `io.mjs` is 1429 lines and, until this file, was executed by **none** of the
 * suite's test files. The reason is structural rather than lazy: `applyIntents`
 * takes its write adapter by injection, and the fake the applier's tests inject
 * stands in for `io.mjs` itself — so the seam sits *above* the code that holds
 * the bugs. `test/unit/actor-fields.test.mjs` reaches io the only way left, by
 * reading it as **text** and regexing out `"system.x"` literals, which cannot
 * see a path built by template string.
 *
 * The alternative considered was moving that seam below io — injecting "the
 * world" and making io the implementation. It was rejected on measurement:
 * `tools/check-writes.mjs` counts 192 write sites across 41 files and io is
 * about a quarter of them, so a seam beneath io would fence off three quarters
 * of the writes and none of the engine's heaviest world-users. Faking the
 * globals costs no production code and makes all of them reachable.
 *
 * ## What this is not
 *
 * It is a model, and this is the file to read before trusting it. Known
 * divergences from Foundry, each deliberate:
 *
 * - **An undeclared write throws.** Foundry *silently discards* it. Throwing is
 *   less faithful and far more useful: `io.defeat` wrote `system.defeated` from
 *   the day it was written to a schema that never declared it, and every defeat
 *   in the game left the Unit a legal target still taking its turn. Under this
 *   model that is a failing test the first time any test defeats anything.
 * - **No diffing.** Every `update()` is recorded, including one that writes a
 *   value back to itself. The codebase guards its own no-ops by hand
 *   (`engine/shield.mjs:167`, `io.mjs:432`), so recording them matches what the
 *   code already assumes rather than what the wire does.
 * - **`update()` is synchronously visible.** Which matches the engine's
 *   assumptions everywhere except token movement, where Foundry holds the
 *   document at the origin until an animation finishes — see `move()` below.
 * - **No socket.** `isGM` defaults true, so `planApplication` keeps everything
 *   local and `io.proxy` is never reached. Pass `isGM: false` to exercise
 *   routing; the proxy is recorded, not delivered.
 * - **Validation is coercion only.** `SetField`, `NumberField`'s `min`,
 *   `ArrayField` and `BooleanField` behave; `RankField` and `TickField` store
 *   what they are given rather than throwing on a bad rank. A fifth type that
 *   starts mattering should fail a test, not be guessed at here.
 *
 * Anything not modelled **throws** rather than returning `undefined`, so the
 * gap names itself instead of letting a test assert on nothing.
 */

import { readdirSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  The field layer                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Enough of `foundry.data.fields` for `module/data/**` to import and for the
 * four types that carry real semantics to carry them.
 */
class DataField {
  constructor(options = {}) { this.options = options; }

  static get _defaults() { return {}; }

  /** The value a fresh document starts with. */
  initial() {
    const { initial } = this.options;
    return typeof initial === "function" ? initial() : initial;
  }

  /** What a written value becomes in storage. */
  clean(value) { return value; }
}

class StringField extends DataField {
  initial() { return "initial" in this.options ? super.initial() : ""; }
}
class HTMLField extends StringField {}
class FilePathField extends StringField {}
class DocumentIdField extends DataField {
  initial() { return "initial" in this.options ? super.initial() : null; }
}

class NumberField extends DataField {
  initial() { return "initial" in this.options ? super.initial() : 0; }

  clean(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== "number") return value;
    const { min, max, integer } = this.options;
    let out = integer ? Math.trunc(value) : value;
    if (typeof min === "number") out = Math.max(min, out);
    if (typeof max === "number") out = Math.min(max, out);
    return out;
  }
}

class BooleanField extends DataField {
  initial() { return "initial" in this.options ? super.initial() : false; }
  clean(value) { return Boolean(value); }
}

class ObjectField extends DataField {
  initial() { return "initial" in this.options ? super.initial() : {}; }
}

class ArrayField extends DataField {
  constructor(element, options = {}) { super(options); this.element = element; }
  initial() { return "initial" in this.options ? super.initial() : []; }
  clean(value) { return Array.isArray(value) ? [...value] : value; }
}

/**
 * The one that matters most.
 *
 * `io.mjs:535` calls handing a `Set` where an array belongs *"the shape defect
 * that has cost this project more than any other"*: Foundry writes an empty
 * collection and says nothing. A fake storing the array verbatim would make
 * every such test pass by accident, so this coerces on the way in exactly as
 * Foundry does — array in, `Set` out.
 */
class SetField extends ArrayField {
  initial() { return new Set("initial" in this.options ? super.initial() ?? [] : []); }
  clean(value) {
    if (value instanceof Set) return new Set(value);
    return new Set(Array.isArray(value) ? value : []);
  }
}

class SchemaField extends DataField {
  constructor(schema, options = {}) { super(options); this.fields = schema; }
  initial() {
    const out = {};
    for (const [key, field] of Object.entries(this.fields)) out[key] = field.initial();
    return out;
  }
}

const FIELDS = {
  DataField,
  StringField,
  HTMLField,
  FilePathField,
  DocumentIdField,
  NumberField,
  BooleanField,
  ObjectField,
  ArrayField,
  SetField,
  SchemaField,
};

/**
 * The bases the `*Data` classes extend.
 *
 * Three of them, because `module/data/index.mjs` is the real registry and
 * importing it pulls in the effect model and the region behaviours too. Faking
 * them is two empty classes; dodging the registry would mean this helper
 * keeping its own list of actor types, which is the duplication ADR 0003 is
 * about at one remove.
 */
class TypeDataModel {
  static defineSchema() { return {}; }
}
class ActiveEffectTypeDataModel extends TypeDataModel {}
class RegionBehaviorType extends TypeDataModel {}

/* -------------------------------------------------------------------------- */
/*  Globals                                                                   */
/* -------------------------------------------------------------------------- */

const GLOBALS = ["game", "canvas", "foundry", "Hooks", "ui", "CONFIG", "CONST"];

/** @param {string} path @param {object} root */
function getProperty(root, path) {
  return String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), root);
}

/** Install the globals `module/data/**` and `module/engine/io.mjs` need. */
function installFoundry() {
  globalThis.foundry = {
    data: {
      fields: FIELDS,
      ActiveEffectTypeDataModel,
      regionBehaviors: { RegionBehaviorType },
    },
    abstract: { TypeDataModel },
    utils: { getProperty, randomID: () => `id${Math.random().toString(36).slice(2, 10)}` },
  };
  // Foundry extends the builtin. Node does not have it, and `io.mjs` calls it
  // three times, so without this the module throws on its first clamp.
  if (typeof Math.clamp !== "function") {
    Math.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    Math.clamp.__fgtFake = true;
  }
}

/* -------------------------------------------------------------------------- */
/*  Schemas                                                                   */
/* -------------------------------------------------------------------------- */

/** @type {Map<string, {schema: object, model: Function}>} */
let MODELS = new Map();

/**
 * Load the REAL DataModels, so the declared field list has one source.
 *
 * A hand-maintained list here would be a second spelling of the schema, which
 * is the duplication ADR 0003 exists to avoid at one remove.
 */
async function loadModels() {
  const data = await import("../../module/data/index.mjs");
  const byType = {
    servant: data.ServantData,
    master: data.MasterData,
    civilian: data.CivilianData,
    summon: data.SummonData,
    platform: data.PlatformData,
    structure: data.StructureData,
  };
  MODELS = new Map(Object.entries(byType).map(([type, model]) => [
    type, { model, schema: model.defineSchema() },
  ]));
}

/**
 * The field declared at a dotted path, or `null` when nothing declares it.
 *
 * Walks through `SchemaField`s and stops at an `ObjectField`, which is an
 * untyped bag by design — `system.resources.mana` is legal because `resources`
 * is declared, not because `mana` is.
 *
 * @param {object} schema
 * @param {string[]} parts
 * @returns {{field: DataField, rest: string[]}|null}
 */
function declaredAt(schema, parts) {
  let fields = schema;
  for (let i = 0; i < parts.length; i += 1) {
    const field = fields?.[parts[i]];
    if (!field) return null;
    const rest = parts.slice(i + 1);
    if (rest.length === 0) return { field, rest };
    if (field instanceof SchemaField) { fields = field.fields; continue; }
    // An ObjectField's interior is untyped; anything under it is declared.
    if (field instanceof ObjectField) return { field, rest };
    return { field, rest };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Documents                                                                 */
/* -------------------------------------------------------------------------- */

/** A `Map` that also answers the `Collection` methods io uses. */
class DocumentCollection extends Map {
  find(fn) { return [...this.values()].find(fn); }
  filter(fn) { return [...this.values()].filter(fn); }
  map(fn) { return [...this.values()].map(fn); }
  some(fn) { return [...this.values()].some(fn); }
  get contents() { return [...this.values()]; }
  [Symbol.iterator]() { return this.values(); }
}

let SEQ = 0;
const nextId = (prefix) => `${prefix}${(SEQ += 1).toString().padStart(4, "0")}`;

/** Apply a flat `{"a.b.c": v}` patch to an object, coercing per the schema. */
function applyPatch(target, patch, { schema, label, writes }) {
  for (const [path, raw] of Object.entries(patch)) {
    writes.push([label, path, raw]);
    const parts = path.split(".");
    if (schema && parts[0] === "system") {
      const found = declaredAt(schema, parts.slice(1));
      if (!found) {
        throw new Error(
          `${label}: write to "${path}", which no schema declares. Foundry discards this `
          + "silently — see module/data/ and test/unit/actor-fields.test.mjs.",
        );
      }
      // Coerce only when the patch names the field itself; a path reaching
      // INTO an ObjectField or a SchemaField leaf is stored as given.
      const value = found.rest.length === 0 ? found.field.clean(raw) : raw;
      assign(target, parts, value);
      continue;
    }
    assign(target, parts, raw);
  }
}

/** @param {object} root @param {string[]} parts @param {unknown} value */
function assign(root, parts, value) {
  let node = root;
  for (const key of parts.slice(0, -1)) {
    if (node[key] === null || typeof node[key] !== "object") node[key] = {};
    node = node[key];
  }
  node[parts.at(-1)] = value;
}

class FakeItem {
  constructor(data, actor, world) {
    this.id = data.id ?? data._id ?? nextId("item");
    this.name = data.name ?? this.id;
    this.type = data.type ?? "ability";
    this.system = structuredClone(data.system ?? {});
    this.actor = actor;
    this.world = world;
  }

  async update(patch) {
    applyPatch(this, patch, { schema: null, label: `Item(${this.name})`, writes: this.world.writes });
    this.actor?.prepare();
  }

  async delete() { this.actor?.items.delete(this.id); this.actor?.prepare(); }

  toObject() { return { name: this.name, type: this.type, system: structuredClone(this.system) }; }
}

class FakeActor {
  constructor(data, world) {
    this.id = data.id ?? nextId("actor");
    this.name = data.name ?? this.id;
    this.type = data.type ?? "servant";
    this.world = world;
    this.isOwner = data.isOwner ?? true;
    this.ownership = data.ownership ?? {};

    const entry = MODELS.get(this.type);
    if (!entry) throw new Error(`No schema modelled for actor type "${this.type}".`);
    this.schema = entry.schema;
    this.model = entry.model;

    // Declared defaults, then what the test asked for. `_source` is what a
    // write lands on; `system` is what the prepare chain leaves behind.
    const base = {};
    for (const [key, field] of Object.entries(this.schema)) base[key] = field.initial();
    this._source = { system: { ...base, ...structuredClone(data.system ?? {}) } };

    this.items = new DocumentCollection();
    for (const i of data.items ?? []) {
      const item = new FakeItem(i, this, world);
      this.items.set(item.id, item);
    }
    this.effects = new DocumentCollection();
    this.prepare();
  }

  /** Rule elements collected from every owned item — `FGTActor#ruleElements`. */
  get ruleElements() {
    const out = [];
    for (const item of this.items) {
      const sys = item.system ?? {};
      for (const el of [...(sys.rules ?? []), ...(sys.passiveRules ?? [])]) {
        out.push({ ...el, source: el.source ?? item.name });
      }
    }
    return out;
  }

  /**
   * The real prepare chain: restore, the type's own base pass, then derived.
   *
   * `module/documents/index.mjs` runs these three in this order, and skipping
   * the middle one is what would make `health.max` read 0 for any Servant
   * declared without explicit Health — the END-rank table backfills it there.
   */
  prepare() {
    this.system = structuredClone(this._source.system);
    const { restoreModifiable, applyStatDeltas, writeDerived } = this.world.derived;
    restoreModifiable(this.system, this._source.system);
    this.model.prototype.prepareBaseData?.call(this.system);
    this.system.ruleElements = this.ruleElements;
    const contributions = this.world.contributionsOf(this);
    writeDerived(this.system, applyStatDeltas(this.system, contributions.statDeltas));
  }

  async update(patch) {
    applyPatch(this._source, patch, {
      schema: this.schema, label: `Actor(${this.name})`, writes: this.world.writes,
    });
    this.prepare();
  }

  async createEmbeddedDocuments(type, dataArray) {
    if (type === "Item") {
      const made = dataArray.map((d) => {
        const item = new FakeItem(d, this, this.world);
        this.items.set(item.id, item);
        return item;
      });
      this.prepare();
      return made;
    }
    if (type === "ActiveEffect") {
      const made = dataArray.map((d) => {
        const e = { id: d.id ?? d._id ?? nextId("eff"), name: d.name, system: structuredClone(d.system ?? {}), origin: d.origin };
        e.update = async (patch) => applyPatch(e, patch, { schema: null, label: `Effect(${e.name})`, writes: this.world.writes });
        e.delete = async () => { this.effects.delete(e.id); };
        this.effects.set(e.id, e);
        return e;
      });
      return made;
    }
    throw new Error(`Embedded document type "${type}" is not modelled.`);
  }

  async deleteEmbeddedDocuments(type, ids) {
    const from = type === "Item" ? this.items : type === "ActiveEffect" ? this.effects : null;
    if (!from) throw new Error(`Embedded document type "${type}" is not modelled.`);
    for (const id of ids) from.delete(id);
    this.prepare();
    return [];
  }

  async delete() { this.world.actors.delete(this.id); }

  getActiveTokens() { return this.world.tokensFor(this.id).map((t) => ({ document: t })); }
}

class FakeToken {
  constructor(data, world) {
    this.id = data.id ?? nextId("token");
    this.actorId = data.actorId;
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.elevation = data.elevation ?? 0;
    this.hidden = Boolean(data.hidden);
    this.world = world;
  }

  get actor() { return this.world.actors.get(this.actorId) ?? null; }

  async update(patch) {
    applyPatch(this, patch, { schema: null, label: `Token(${this.id})`, writes: this.world.writes });
  }

  /**
   * A displacement, returning whether it happened.
   *
   * Foundry's `move()` can report success while leaving the document at its
   * origin — an animation nobody is watching never finishes, so the engine
   * passes `animate: false` and `io.mjs:180-190` records what it cost to learn
   * that. Modelled as: the move lands, and a caller that omits `animate: false`
   * is told it did not, because that is the failure the comment describes.
   */
  async move(waypoint, options = {}) {
    if (options.animate !== false) return false;
    if (waypoint?.x !== undefined) this.x = waypoint.x;
    if (waypoint?.y !== undefined) this.y = waypoint.y;
    if (waypoint?.elevation !== undefined) this.elevation = waypoint.elevation;
    this.world.writes.push(["Token", "move", { id: this.id, ...waypoint }]);
    return true;
  }

  async delete() { this.world.tokens.delete(this.id); }
}

class FakeCombat {
  constructor(data, world) {
    this.id = data.id ?? nextId("combat");
    this.started = data.started ?? true;
    this.round = data.round ?? 1;
    this.system = { globalTurn: 0, grailCounter: 0, grailThreshold: 9, grailMaterialized: false, ...(data.system ?? {}) };
    this.flags = {};
    this.world = world;
  }

  async update(patch) {
    applyPatch(this, patch, { schema: null, label: "Combat", writes: this.world.writes });
  }

  getFlag(scope, key) { return this.flags[`${scope}.${key}`]; }
  async setFlag(scope, key, value) {
    this.flags[`${scope}.${key}`] = value;
    this.world.writes.push(["Combat", `flag:${scope}.${key}`, value]);
  }
}

/* -------------------------------------------------------------------------- */
/*  The world                                                                 */
/* -------------------------------------------------------------------------- */

/** Anything not modelled says so, rather than answering `undefined`. */
function notModelled(what) {
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive || prop === "then" || typeof prop === "symbol") return undefined;
      throw new Error(`${what}.${String(prop)} is not modelled by test/helpers/world.mjs. Add it there.`);
    },
  });
}

/**
 * Stand up a world, run `fn` against it, and put the globals back.
 *
 * Restoring happens in a `finally`, which is the whole point: eight test files
 * stub `globalThis.game` today and only one of them restores, so the suite has
 * a live cross-file order dependency (`test/unit/kiritsugu.test.mjs:798` reads
 * `??=` and defers to whatever leaked in first). This cannot become a ninth.
 *
 * @param {object} spec
 * @param {object[]} [spec.actors] `{id, name, type, system, items}`
 * @param {object[]} [spec.tokens] `{id, actorId, x, y}`
 * @param {object} [spec.combat] `{round, started, system: {globalTurn}}`
 * @param {object} [spec.settings] `fgt` settings by key
 * @param {boolean} [spec.isGM]
 * @param {(world: object) => Promise<unknown>} fn
 * @returns {Promise<unknown>}
 */
export async function withWorld(spec, fn) {
  const saved = Object.fromEntries(GLOBALS.map((k) => [k, globalThis[k]]));
  const savedClamp = Math.clamp;

  installFoundry();
  if (MODELS.size === 0) await loadModels();
  const snapshot = await import("../../module/rules/snapshot.mjs");
  const derived = await import("../../module/rules/derived.mjs");

  const world = {
    writes: [],
    hooks: [],
    prompts: [],
    proxied: [],
    derived,
    contributionsOf: snapshot.contributionsOf,
    actors: new DocumentCollection(),
    tokens: new DocumentCollection(),
    settings: { turnsPerRound: 3, npGateRound: 3, npGateRoundAssassin: 2, conquestSparesServants: true, ...(spec.settings ?? {}) },
    tokensFor(actorId) { return [...this.tokens.values()].filter((t) => t.actorId === actorId); },
    actor(name) { return [...this.actors.values()].find((a) => a.name === name || a.id === name) ?? null; },
    wrote(path) { return this.writes.filter(([, p]) => p === path); },
  };

  for (const a of spec.actors ?? []) {
    const actor = new FakeActor(a, world);
    world.actors.set(actor.id, actor);
  }
  for (const t of spec.tokens ?? []) {
    const token = new FakeToken(t, world);
    world.tokens.set(token.id, token);
  }
  world.combat = new FakeCombat(spec.combat ?? {}, world);

  globalThis.game = {
    actors: world.actors,
    combat: world.combat,
    combats: { active: world.combat },
    user: { id: "u1", isGM: spec.isGM ?? true },
    users: { activeGM: { isSelf: spec.isGM ?? true }, get: () => ({ isGM: spec.isGM ?? true }) },
    settings: {
      get(_scope, key) {
        if (!(key in world.settings)) throw new Error(`Setting "${key}" is not modelled by test/helpers/world.mjs.`);
        return world.settings[key];
      },
    },
    packs: [],
    messages: notModelled("game.messages"),
    journal: notModelled("game.journal"),
    i18n: { format: (k) => k, localize: (k) => k },
  };
  globalThis.canvas = {
    tokens: {
      get: (id) => world.tokensFor(id)[0] ?? null,
      placeables: [...world.tokens.values()].map((t) => ({ actor: t.actor, document: t })),
    },
    grid: { getTopLeftPoint: ({ i, j }) => ({ x: j * 100, y: i * 100 }) },
  };
  globalThis.Hooks = { callAll: (...args) => world.hooks.push(args), on: () => {}, once: () => {} };
  globalThis.ui = { notifications: { warn: () => {}, error: () => {}, info: () => {} } };

  try {
    return await fn(world);
  } finally {
    for (const k of GLOBALS) {
      if (saved[k] === undefined) delete globalThis[k];
      else globalThis[k] = saved[k];
    }
    if (Math.clamp?.__fgtFake) {
      if (savedClamp === undefined) delete Math.clamp;
      else Math.clamp = savedClamp;
    }
  }
}

/** The declared field names for one actor type, for a test that wants to assert on drift. */
export function declaredFields(type) {
  const entry = MODELS.get(type);
  if (!entry) throw new Error(`No schema modelled for actor type "${type}".`);
  return Object.keys(entry.schema);
}

/** Whether `module/data/` has a type this helper does not model. */
export function unmodelledActorTypes() {
  const files = readdirSync("module/data/actor").filter((f) => f.endsWith(".mjs") && !f.startsWith("_"));
  return files.length === 0 ? ["module/data/actor is empty"] : [];
}
