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
 * - **The fields are Foundry's own; the write path only CLEANS with them.**
 *   `test/helpers/foundry-common.mjs` loads the real `DataField` classes, so
 *   `NumberField`'s `min`, `integer`, `ArrayField`, `BooleanField` and the
 *   storage-versus-runtime split are Foundry's behaviour rather than a guess at
 *   it. But Foundry splits a write in two — `clean()` casts, `validate()`
 *   rejects — and `applyPatch` runs only the first. So a `SetField` of
 *   `DocumentIdField` still keeps a non-id where a live world drops it, and
 *   `RankField`/`TickField` still store a bad rank rather than throwing: the
 *   real fields are present and are being asked the wrong question. Found by
 *   `npm run check:world` on its first run, still true, and pinned by
 *   `test/unit/world-model-fidelity.test.mjs` so it stays measured.
 *
 * Anything not modelled **throws** rather than returning `undefined`, so the
 * gap names itself instead of letting a test assert on nothing.
 *
 * `npm run check:world` runs the same probes here and against a live world and
 * reports where they disagree — including checking that the two divergences
 * above are still the deliberate ones. Run it before trusting this model with
 * something new.
 */

import { readdirSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  The field layer                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Foundry's own, not a second spelling of it.
 *
 * This used to be ~90 lines of hand-written `DataField` subclasses carrying a
 * documented admission that *"validation is coercion only"*. Every one of those
 * lines was a guess at a system we do not own, and a guess that drifts silently:
 * the fake `BooleanField` cast `"yes"` to `true` where the real one rejects it
 * and falls back to the declared initial. `module/data/fields.mjs` had already
 * outgrown the fake — `RankField` and `TickField` are written against
 * `super._defaults` and `_validateType`, neither of which the fake ever called,
 * so a bad rank could not be rejected by any test in this suite.
 *
 * The one class Foundry keeps on the CLIENT side stays faked below, which is the
 * boundary ADR 0006 draws rather than a gap in it.
 */
const { fields: FIELDS, abstract: ABSTRACT, data: FOUNDRY_DATA, utils: UTILS, CONST } =
  await import("./foundry-common.mjs");

const { SchemaField, ObjectField } = FIELDS;

/**
 * `RegionBehaviorType` lives in `client/`, not `common/`, so it is the one base
 * still faked — `module/data/regions.mjs` extends it at import time and the
 * registry pulls that file in. It extends the REAL `TypeDataModel`, so a region
 * behaviour's schema is validated like every other.
 */
class RegionBehaviorType extends ABSTRACT.TypeDataModel {}

/* -------------------------------------------------------------------------- */
/*  Globals                                                                   */
/* -------------------------------------------------------------------------- */

const GLOBALS = ["game", "canvas", "foundry", "Hooks", "ui", "CONFIG", "CONST"];

/** Install the globals `module/data/**` and `module/engine/io.mjs` need. */
function installFoundry() {
  globalThis.foundry = {
    data: {
      ...FOUNDRY_DATA,
      fields: FIELDS,
      regionBehaviors: { RegionBehaviorType },
    },
    abstract: ABSTRACT,
    utils: UTILS,
    CONST,
  };
  // Foundry exposes the enum both ways, and `module/` reads it both ways.
  globalThis.CONST = CONST;
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

/**
 * Storage shape to runtime shape — the step `DataModel#initialize` performs.
 *
 * Foundry keeps the two apart and the difference is load-bearing. `_source` is
 * JSON: a `SetField` stores an **array** there, and `clean()` is what puts it in
 * that shape. The `Set` only exists after `initialize`, which is what
 * `actor.system` reads. Cloning `_source` straight into `system` — what this
 * model did while its fields were hand-written, by coercing to `Set` inside
 * `clean` — collapses the two, and gets the storage side wrong to get the
 * runtime side right.
 *
 * It is not academic. `apps/actor-sheet/context.mjs:292` asks
 * `system.servantClasses?.size`, which an Array does not answer, so whether a
 * Servant's class appears on their own sheet turns on this exact conversion.
 *
 * @param {object} source @param {object} schema
 * @returns {object}
 */
function initializeSource(source, schema) {
  const out = structuredClone(source);
  for (const [key, field] of Object.entries(schema)) {
    if (key in out) out[key] = field.initialize(out[key], null, {});
  }
  return out;
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
    // `initial` is an OPTION on a real DataField, not a method; `getInitialValue`
    // is what resolves it (and a SchemaField's children with it).
    for (const [key, field] of Object.entries(this.schema)) base[key] = field.getInitialValue();
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
    this.system = initializeSource(this._source.system, this.schema);
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
 * @param {object} [spec.combat] `{round, started, system: {globalTurn}}` — the ACTIVE match
 * @param {object} [spec.viewedCombat] a DIFFERENT Combat at `game.combat`, for the
 *   viewed-versus-active split. Foundry keeps the two apart — `game.combat` is
 *   whatever tracker is on screen — and this model used to point both names at
 *   one object, so a reader of the wrong one was indistinguishable from a reader
 *   of the right one and no test could tell them apart. Three readers in
 *   `engine/board.mjs` had the wrong one (Ch. 46 §46.4 / #42). Omit it and the
 *   two stay identical, which is the ordinary case.
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
  // The tracker on screen, which is only the active one when nobody has opened
  // another. Defaults to it, so every existing spec is unchanged.
  world.viewedCombat = spec.viewedCombat
    ? new FakeCombat(spec.viewedCombat, world)
    : world.combat;

  globalThis.game = {
    actors: world.actors,
    combat: world.viewedCombat,
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
