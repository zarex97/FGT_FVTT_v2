/**
 * @file A world faithful enough to run `module/engine/io.mjs` against.
 * @see docs/44-testing.md, docs/02-architecture.md, docs/adr/0006-tests-and-build-run-real-foundry.md
 *
 * `io.mjs` is 1429 lines and, until this file, was executed by **none** of the
 * suite's test files. The reason is structural rather than lazy: `applyIntents`
 * takes its write adapter by injection, and the fake the applier's tests inject
 * stands in for `io.mjs` itself — so the seam sits *above* the code that holds
 * the bugs. A text guard reached io the only way left, by reading it as
 * **text** and regexing out `"system.x"` literals, which cannot see a path built
 * by template string; it has since been replaced by checks on the real schemas
 * (`test/unit/schema-validity.test.mjs`, `field-ledger.test.mjs`).
 *
 * The alternative considered was moving that seam below io — injecting "the
 * world" and making io the implementation. It was rejected on measurement:
 * `tools/check-writes.mjs` counts 192 write sites across 41 files and io is
 * about a quarter of them, so a seam beneath io would fence off three quarters
 * of the writes and none of the engine's heaviest world-users. Faking the
 * globals costs no production code and makes all of them reachable.
 *
 * ## The data layer is Foundry's own
 *
 * Every Actor, Item, ActiveEffect, Token and Combat here is backed by a REAL
 * Foundry document — `foundry.documents.BaseActor` and the rest, over this
 * system's real DataModels — loaded by `tools/lib/foundry.mjs` (ADR-0006). This
 * file used to imitate the field classes instead, and the imitation let four
 * Silent Drops through that Foundry does not: a write beneath a scalar field,
 * undeclared keys inside an object written to a `SchemaField`, a seeded key
 * nothing declares, and any path at all on an Item, Effect, Token or Combat.
 *
 * ## What this is not
 *
 * It is a model, and this is the file to read before trusting it. Known
 * divergences from Foundry, each deliberate:
 *
 * - **The loud prune.** Every write goes through the real `updateSource`, and
 *   then each path written is read back out of `_source`. Anything that did not
 *   land exactly as asked — pruned for want of a declaration, clamped or rounded
 *   by a `NumberField`, reset to its initial value, an `ArrayField`/`SetField`
 *   write voided by one bad element — **throws**, naming the path, what was
 *   asked and what landed. Foundry does every one of those silently. Throwing is
 *   less faithful and far more useful: `io.defeat` wrote `system.defeated` from
 *   the day it was written to a schema that never declared it, and every defeat
 *   in the game left the Unit a legal target still taking its turn. Seeds are
 *   checked the same way, so a test cannot build its world out of keys the
 *   schema would have dropped.
 * - **No diffing.** Every `update()` is recorded, including one that writes a
 *   value back to itself. The codebase guards its own no-ops by hand
 *   (`engine/shield.mjs:167`, `io.mjs:432`), so recording them matches what the
 *   code already assumes rather than what the wire does. (Foundry's client
 *   skips sending an update whose diff is empty; that trap is the client layer's
 *   and is not modelled — Ch. 08.)
 * - **`update()` is synchronously visible.** Which matches the engine's
 *   assumptions everywhere except token movement, where Foundry holds the
 *   document at the origin until an animation finishes — see `move()` below.
 * - **No socket.** `isGM` defaults true, so `planApplication` keeps everything
 *   local and `io.proxy` is never reached. Pass `isGM: false` to exercise
 *   routing; the proxy is recorded, not delivered.
 * - **Ids are the test's own.** A Foundry `_id` is sixteen alphanumerics, and
 *   tests name their actors `"heracles"`. The id lives on the wrapper and is
 *   never handed to the document, so a Token's `actorId` is likewise held beside
 *   its document rather than in it.
 * - **The client layer is absent.** `prepareData` is this file's own order
 *   (restore, the type's base pass, rule elements, derived), mirroring
 *   `module/documents/index.mjs`; Combat's `started` and the acting faction are
 *   facts a test states. Only `common/` imports in Node.
 *
 * Anything not modelled **throws** rather than returning `undefined`, so the
 * gap names itself instead of letting a test assert on nothing.
 *
 * `npm run check:world` runs the same probes here and against a live world and
 * reports where they disagree — including checking that the loud prune is
 * still throwing exactly where Foundry is still silent. Run it before trusting
 * this model with something new.
 */

import { readdirSync } from "node:fs";
import { loadFoundry, installSystem, sourceForm, firstMismatch } from "../../tools/lib/foundry.mjs";

/* -------------------------------------------------------------------------- */
/*  The data layer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Foundry's globals, captured once they are real, so every world can put them
 * back after the last one restored whatever the test file had before.
 * @type {{foundry: object, CONST: object, CONFIG: object, game: object, models: object}|null}
 */
let REAL = null;

async function loadReal() {
  if (REAL) return REAL;
  const saved = Object.fromEntries(GLOBALS.map((k) => [k, globalThis[k]]));
  await loadFoundry();
  const models = await installSystem();
  REAL = {
    foundry: globalThis.foundry,
    CONST: globalThis.CONST,
    CONFIG: globalThis.CONFIG,
    game: { ...globalThis.game },
    models,
  };
  for (const k of GLOBALS) {
    if (saved[k] === undefined) delete globalThis[k];
    else globalThis[k] = saved[k];
  }
  return REAL;
}

const GLOBALS = ["game", "canvas", "foundry", "Hooks", "ui", "CONFIG", "CONST"];

/**
 * Install the real `foundry`, `CONST` and `CONFIG`, and the part of `game` a
 * Document reads while it constructs. The world replaces `game` with its own
 * once its documents exist.
 */
function installFoundry() {
  globalThis.foundry = REAL.foundry;
  globalThis.CONST = REAL.CONST;
  globalThis.CONFIG = REAL.CONFIG;
  globalThis.game = { ...REAL.game };
}

/** @param {object} root @param {string} path */
function getProperty(root, path) {
  return String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), root);
}

/**
 * Silent Drops this harness has found in production code and that are not yet
 * fixed, each with the issue that owns it.
 *
 * A write listed here is recorded and then allowed to drop, exactly as Foundry
 * drops it, so a test about something else can still run past it. The list may
 * only shrink — `test/unit/world-loud-prune.test.mjs` holds its length — and an
 * entry leaves it when its issue is fixed, not when a test is inconvenient.
 */
export const KNOWN_DROPS = Object.freeze([
  // `io.defeat`'s skull. v14's Token has no `overlayEffect`; the overlay is an
  // ActiveEffect flagged `core.overlay` now.
  Object.freeze({ document: "Token", path: "overlayEffect", issue: "#96" }),
]);

const isKnownDrop = (document, path) => KNOWN_DROPS.some((d) => d.document === document && d.path === path);

/**
 * The loud prune: apply `patch` through Foundry's real `updateSource`, and throw
 * if any path written did not land exactly as asked.
 *
 * @param {object} doc a real Foundry document
 * @param {object} patch `{"a.b.c": v}` or nested, as `Document#update` takes it
 * @param {{label: string, writes: Array}} ctx
 */
function loudUpdate(doc, patch, { label, writes }) {
  for (const [path, raw] of Object.entries(patch)) writes.push([label, path, raw]);
  try {
    doc.updateSource(structuredClone(sourceForm(patch)));
  } catch (err) {
    throw new Error(`${label}: Foundry refused ${JSON.stringify(Object.keys(patch))} — ${err.message}`, { cause: err });
  }
  for (const [path, requested] of Object.entries(patch)) {
    if (path.includes("-=") || path.includes("==")) continue;
    const miss = firstMismatch(requested, getProperty(doc._source, path), path);
    if (miss && !isKnownDrop(doc.documentName, path)) throw silentDrop(label, "write to", miss);
  }
}

/**
 * The same check for the data a document was seeded with.
 *
 * @param {object} doc
 * @param {object} data what the test asked the document to hold
 * @param {string} label
 */
function loudSeed(doc, data, label) {
  const miss = firstMismatch(data, doc._source, "");
  if (miss) throw silentDrop(label, "seed of", { ...miss, path: miss.path.replace(/^\./, "") });
}

function silentDrop(label, what, { path, want, got }) {
  return new Error(
    `${label}: ${what} "${path}" would be a Silent Drop — asked for ${JSON.stringify(want)}, `
    + `Foundry kept ${JSON.stringify(got)}. Foundry does this silently; see module/data/ and `
    + "docs/adr/0006-tests-and-build-run-real-foundry.md.",
  );
}

/**
 * Build a real document of `documentName`, strictly, and hold it to its seed.
 *
 * @param {string} documentName "Actor", "Item", "ActiveEffect", "Token", "Combat"
 * @param {object} data
 * @param {string} label
 */
function realDocument(documentName, data, label) {
  const Base = foundry.documents[`Base${documentName}`];
  let doc;
  try {
    doc = new Base(structuredClone(sourceForm(data)), { strict: true });
  } catch (err) {
    throw new Error(`${label}: Foundry would not construct this ${documentName} — ${err.message}`, { cause: err });
  }
  loudSeed(doc, data, label);
  return doc;
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

/** What a test may seed a document with, minus the wrapper's own fields. */
function documentData(data, keys) {
  return Object.fromEntries(keys.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]));
}

class FakeItem {
  constructor(data, actor, world) {
    this.id = data.id ?? data._id ?? nextId("item");
    this.actor = actor;
    this.world = world;
    this.doc = realDocument("Item", {
      name: data.name ?? this.id,
      type: data.type ?? "ability",
      system: data.system ?? {},
    }, `Item(${data.name ?? this.id})`);
  }

  get name() { return this.doc.name; }
  get type() { return this.doc.type; }
  get system() { return this.doc.system; }
  get _source() { return this.doc._source; }

  async update(patch) {
    loudUpdate(this.doc, patch, { label: `Item(${this.name})`, writes: this.world.writes });
    this.doc.reset();
    this.actor?.prepare();
  }

  async delete() { this.actor?.items.delete(this.id); this.actor?.prepare(); }

  toObject() { return this.doc.toObject(); }
}

class FakeEffect {
  constructor(data, actor, world) {
    this.id = data.id ?? data._id ?? nextId("eff");
    this.actor = actor;
    this.world = world;
    this.origin = data.origin;
    this.doc = realDocument("ActiveEffect", {
      type: "fgtEffect",
      ...documentData(data, ["name", "type", "img", "system", "disabled", "statuses"]),
    }, `Effect(${data.name ?? this.id})`);
  }

  get name() { return this.doc.name; }
  get type() { return this.doc.type; }
  get system() { return this.doc.system; }
  get _source() { return this.doc._source; }

  async update(patch) {
    loudUpdate(this.doc, patch, { label: `Effect(${this.name})`, writes: this.world.writes });
    this.doc.reset();
  }

  async delete() { this.actor.effects.delete(this.id); }

  toObject() { return this.doc.toObject(); }
}

class FakeActor {
  constructor(data, world) {
    this.id = data.id ?? nextId("actor");
    this.world = world;
    this.isOwner = data.isOwner ?? true;
    this.ownership = data.ownership ?? {};

    const type = data.type ?? "servant";
    this.model = REAL.models.Actor[type];
    if (!this.model) throw new Error(`No schema modelled for actor type "${type}".`);
    this.doc = realDocument("Actor", {
      name: data.name ?? this.id, type, system: data.system ?? {},
    }, `Actor(${data.name ?? this.id})`);

    this.items = new DocumentCollection();
    for (const i of data.items ?? []) {
      const item = new FakeItem(i, this, world);
      this.items.set(item.id, item);
    }
    this.effects = new DocumentCollection();
    this.prepare();
  }

  get name() { return this.doc.name; }
  get type() { return this.doc.type; }
  /** What a write lands on. `system` is what the prepare chain leaves behind. */
  get _source() { return this.doc._source; }

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
   * `reset()` is Foundry's own re-initialisation from `_source`, so whatever the
   * last preparation wrote onto the model is gone before the next one starts.
   */
  prepare() {
    this.doc.reset();
    this.system = this.doc.system;
    const { restoreModifiable, applyStatDeltas, writeDerived } = this.world.derived;
    restoreModifiable(this.system, this._source.system);
    this.system.prepareBaseData?.();
    this.system.ruleElements = this.ruleElements;
    const contributions = this.world.contributionsOf(this);
    writeDerived(this.system, applyStatDeltas(this.system, contributions.statDeltas));
  }

  async update(patch) {
    loudUpdate(this.doc, patch, { label: `Actor(${this.name})`, writes: this.world.writes });
    this.prepare();
  }

  async createEmbeddedDocuments(type, dataArray) {
    if (type === "Item") {
      const made = dataArray.map((d) => new FakeItem(d, this, this.world));
      for (const item of made) this.items.set(item.id, item);
      this.prepare();
      return made;
    }
    if (type === "ActiveEffect") {
      const made = dataArray.map((d) => new FakeEffect(d, this, this.world));
      for (const e of made) this.effects.set(e.id, e);
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
    this.world = world;
    this.doc = realDocument("Token", {
      x: data.x ?? 0, y: data.y ?? 0, elevation: data.elevation ?? 0, hidden: Boolean(data.hidden),
    }, `Token(${this.id})`);
  }

  get x() { return this.doc.x; }
  get y() { return this.doc.y; }
  get elevation() { return this.doc.elevation; }
  get hidden() { return this.doc.hidden; }
  get _source() { return this.doc._source; }

  get actor() { return this.world.actors.get(this.actorId) ?? null; }

  async update(patch) {
    loudUpdate(this.doc, patch, { label: `Token(${this.id})`, writes: this.world.writes });
    this.doc.reset();
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
    const patch = {};
    for (const k of ["x", "y", "elevation"]) if (waypoint?.[k] !== undefined) patch[k] = waypoint[k];
    loudUpdate(this.doc, patch, { label: `Token(${this.id})`, writes: [] });
    this.doc.reset();
    this.world.writes.push(["Token", "move", { id: this.id, ...waypoint }]);
    return true;
  }

  async delete() { this.world.tokens.delete(this.id); }
}

class FakeCombat {
  constructor(data, world) {
    this.id = data.id ?? nextId("combat");
    this.started = data.started ?? true;
    this.world = world;
    this.doc = realDocument("Combat", {
      type: "match", round: data.round ?? 1, system: data.system ?? {},
    }, "Combat");
    // Whose Turn it is. A real `Combat` derives this from its combatant; the
    // model takes it as a fact, because a test about acting-faction behaviour
    // should not have to build a turn order to state one. `null` is the honest
    // default -- a match before it has an acting faction -- and is what
    // `engine/budget.mjs#attackOutsideOwnTurn` treats as "no other Turn to be
    // on", so an unset value cannot silently grant an exemption.
    this.actingFactionId = data.actingFactionId ?? null;
    // Seeded flags, in the flat `scope.key` shape `getFlag` reads. Without this
    // a spec could set a budget the code would never find: `budgetFor` would
    // answer a fresh, EMPTY budget and a test asserting a refusal would pass
    // because nothing was ever exhausted.
    this.flags = { ...(data.flags ?? {}) };
  }

  get round() { return this.doc.round; }
  get system() { return this.doc.system; }
  get _source() { return this.doc._source; }

  async update(patch) {
    loudUpdate(this.doc, patch, { label: "Combat", writes: this.world.writes });
    this.doc.reset();
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

/** The `core` settings Foundry's `common/` documents read, as a fresh world holds them. */
const CORE_SETTINGS = { prototypeTokenOverrides: { base: {} } };

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
  await loadReal();
  const saved = Object.fromEntries(GLOBALS.map((k) => [k, globalThis[k]]));

  installFoundry();
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
    // What a real Document reads while it constructs: release, system, model.
    ...REAL.game,
    actors: world.actors,
    combat: world.viewedCombat,
    combats: { active: world.combat },
    user: { id: "u1", isGM: spec.isGM ?? true },
    // A collection like Foundry's, iterable, with the one user this world is
    // seen by: `engine/board.mjs#ownerUserOf` walks every user to find a
    // Unit's non-GM owner.
    users: Object.assign(new DocumentCollection([["u1", { id: "u1", isGM: spec.isGM ?? true, isSelf: true }]]), {
      activeGM: { isSelf: spec.isGM ?? true },
    }),
    settings: {
      get(scope, key) {
        // Foundry's own documents read one core setting while they update: the
        // prototype-token overrides, empty in a fresh world.
        if (scope === "core" && key in CORE_SETTINGS) return CORE_SETTINGS[key];
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
  }
}

/**
 * What the DataModel keeps of `data`, constructed under this world's real
 * globals and none of the test file's own.
 *
 * For a caller that must seed a world with content as a live world would hold
 * it -- after load has pruned whatever the schema does not declare -- rather
 * than as authored, which the loud seed check would (rightly) refuse.
 *
 * @param {string} documentName "Actor", "Item", ...
 * @param {object} data
 * @returns {Promise<object>} the document's `_source`
 */
export async function keptByModel(documentName, data) {
  await loadReal();
  const saved = Object.fromEntries(GLOBALS.map((k) => [k, globalThis[k]]));
  installFoundry();
  globalThis.game.settings = { get: (scope, key) => (scope === "core" ? CORE_SETTINGS[key] : undefined) };
  try {
    return new foundry.documents[`Base${documentName}`](structuredClone(data), { strict: true })._source;
  } finally {
    for (const k of GLOBALS) {
      if (saved[k] === undefined) delete globalThis[k];
      else globalThis[k] = saved[k];
    }
  }
}

/** Whether `module/data/` has a type this helper does not model. */
export function unmodelledActorTypes() {
  const files = readdirSync("module/data/actor").filter((f) => f.endsWith(".mjs") && !f.startsWith("_"));
  return files.length === 0 ? ["module/data/actor is empty"] : [];
}
