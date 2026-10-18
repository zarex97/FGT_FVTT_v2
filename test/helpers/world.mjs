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
 * - **Two people, one client.** This client is the GM (`u1`) and Player1 (`p1`)
 *   is the other person at the table, owning what a spec gives them
 *   (`owner: "p1"`). `isGM: false` turns it round: this client is the player,
 *   and a request to the GM crosses the socket and is recorded in `proxied`,
 *   not run.
 * - **Questions are answered from the test's script.** A question routed to
 *   Player1 crosses `game.socket`; the model plays Player1's client, opening the
 *   real dialog there and sending the answer back. Every window is shown to a
 *   user (`client-api.mjs`) and logged in `asked`. A question the script did not
 *   expect, or one shown to the wrong user, is a failure — Foundry would wait for
 *   a person instead.
 * - **Chat cards are drawn as data.** `renderTemplate` records the template and
 *   the data it was given in `cards` and returns no HTML. No engine code reads a
 *   card's content back, so the data is what a test holds a card to.
 * - **The dice are Foundry's, the faces the test's.** `Roll` is the real class;
 *   each face comes from `w.dice` — set by the test, or a seeded twister — and
 *   every roll is logged in `rolls`.
 * - **Hooks fire, and the engine listens.** `Hooks` is Foundry's own, a fresh
 *   copy per world. A write fires what Foundry's client backend fires, and only
 *   when it changed something; a token write that moves it fires the movement
 *   hooks around it. The engine's listener list is bound in every world. Unlike
 *   Foundry, a listener's promise is kept (`settle()`), and a listener that
 *   throws or rejects is a failure.
 * - **Failures are thrown when the world closes.** A failure above is pushed to
 *   `failures` and thrown after `fn` returns, because the engine swallows what a
 *   window throws (`engine/ask.mjs:41`). Foundry would have said nothing.
 * - **Ids are the test's own.** A Foundry `_id` is sixteen alphanumerics, and
 *   tests name their actors `"heracles"`. The id lives on the wrapper and is
 *   never handed to the document, so a Token's `actorId` is likewise held beside
 *   its document rather than in it.
 * - **The client layer is absent, but for two corners.** Foundry's dice and
 *   `Hooks` run for real (`foundry-client.mjs`); its windows are stood in
 *   (`client-api.mjs`). `prepareData` is this file's own order
 *   (restore, the type's base pass, rule elements, derived), mirroring
 *   `module/documents/index.mjs`; Combat's `started` and the acting faction are
 *   facts a test states.
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
import { loadDice, diceConfig, freshHooks } from "./foundry-client.mjs";
import { installClientApi, bindWorld, asUser } from "./client-api.mjs";

/* -------------------------------------------------------------------------- */
/*  The data layer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Foundry's globals, captured once they are real, so every world can put them
 * back after the last one restored whatever the test file had before.
 * @type {{foundry: object, CONST: object, CONFIG: object, game: object, models: object}|null}
 */
let REAL = null;

/**
 * Load Foundry's data layer once, ahead of the first `withWorld`.
 *
 * The first load, and the first import of the engine, take longer than a
 * test's 5 s default, so a file that let its first test pay for them timed out
 * there and failed every test after it (#197). `beforeAll(prepareWorld, 60_000)` pays it outside any test.
 *
 * @returns {Promise<void>}
 */
export async function prepareWorld() {
  await loadReal();
  // The engine's module graph, which the first test's own import paid for too.
  await import("../../module/engine/io.mjs");
}

/** @type {Promise<object>|null} */
let loading = null;

/**
 * Load it once. Memoised as a promise: `withSubjects` builds its subjects in
 * parallel, and two loads interleaving swap `game` under each other.
 *
 * @returns {Promise<object>}
 */
function loadReal() {
  loading ??= load();
  return loading;
}

async function load() {
  const saved = Object.fromEntries(GLOBALS.map((k) => [k, globalThis[k]]));
  await loadFoundry();
  const models = await installSystem();
  const dice = await loadDice();
  globalThis.foundry.dice = dice;
  installClientApi();
  REAL = {
    foundry: globalThis.foundry,
    CONST: globalThis.CONST,
    CONFIG: globalThis.CONFIG,
    game: { ...globalThis.game },
    models,
    dice,
    settingDefaults: await registeredSettingDefaults(),
  };
  for (const k of GLOBALS) {
    if (saved[k] === undefined) delete globalThis[k];
    else globalThis[k] = saved[k];
  }
  return REAL;
}

const GLOBALS = ["game", "canvas", "foundry", "Hooks", "ui", "CONFIG", "CONST", "Roll", "ChatMessage"];

/**
 * Every `fgt` setting's default, as `module/settings.mjs` registers it.
 *
 * The real `registerSettings()` runs once against a `register` that keeps
 * only the defaults, so a world holds what a fresh live world holds and a
 * setting added to the system is in the model the day it is registered. A key
 * nothing registers still throws when read.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
async function registeredSettingDefaults() {
  const defaults = {};
  const before = globalThis.game;
  globalThis.game = {
    ...before,
    settings: {
      register: (scope, key, data) => { if (scope === "fgt") defaults[key] = structuredClone(data.default); },
      registerMenu: () => {},
    },
    i18n: { localize: (k) => k, format: (k) => k },
  };
  try {
    const { registerSettings } = await import("../../module/settings.mjs");
    registerSettings();
  } finally {
    globalThis.game = before;
  }
  return defaults;
}

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
export const KNOWN_DROPS = Object.freeze([]);

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
  let diff;
  try {
    diff = doc.updateSource(structuredClone(sourceForm(patch)));
  } catch (err) {
    throw new Error(`${label}: Foundry refused ${JSON.stringify(Object.keys(patch))} — ${err.message}`, { cause: err });
  }
  for (const [path, requested] of Object.entries(patch)) {
    if (path.includes("-=") || path.includes("==")) continue;
    const miss = firstMismatch(requested, getProperty(doc._source, path), path);
    if (miss && !isKnownDrop(doc.documentName, path)) throw silentDrop(label, "write to", miss);
  }
  return diff;
}

/**
 * Tell the listeners, as Foundry's client backend does once a write has landed
 * (`client/data/client-backend.mjs`): only for a write that changed something,
 * with the diff and the document's id as `changes`, and the operation's options.
 *
 * @param {string} hook "updateActor", "deleteActiveEffect", ...
 * @param {object} doc the wrapper the engine holds
 * @param {object|null} diff `updateSource`'s return, for an update; `null` for a create or delete
 * @param {object} [options] the caller's own options
 */
function fire(hook, doc, diff, options = {}) {
  const operation = { diff: true, recursive: true, render: true, ...options };
  if (diff === null) return globalThis.Hooks?.callAll?.(hook, doc, operation, game.user?.id ?? null);
  if (foundry.utils.isEmpty(diff)) return undefined;
  // The server stamps every update it accepts, and the client hears the stamp
  // in the change (`_stats.modifiedTime`), as `check:world` measured.
  const changes = { ...diff, _stats: { modifiedTime: Date.now() }, _id: doc.id };
  return globalThis.Hooks?.callAll?.(hook, doc, changes, operation, game.user?.id ?? null);
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

  get parent() { return this.actor; }
  get documentName() { return "Item"; }

  async update(patch, options = {}) {
    const diff = loudUpdate(this.doc, patch, { label: `Item(${this.name})`, writes: this.world.writes });
    this.doc.reset();
    this.actor?.prepare();
    fire("updateItem", this, diff, options);
    return this;
  }

  async delete(options = {}) {
    this.actor?.items.delete(this.id);
    this.actor?.prepare();
    fire("deleteItem", this, null, options);
    return this;
  }

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
      ...documentData(data, ["name", "type", "img", "system", "disabled", "statuses", "flags", "showIcon"]),
    }, `Effect(${data.name ?? this.id})`);
  }

  get name() { return this.doc.name; }
  get type() { return this.doc.type; }
  get img() { return this.doc.img; }
  get system() { return this.doc.system; }
  // A core status's shape: what it IS (`statuses`) and how the token draws it
  // (`flags.core.overlay`) -- the defeat skull (#96).
  get statuses() { return this.doc.statuses; }
  get flags() { return this.doc.flags; }
  get showIcon() { return this.doc.showIcon; }
  get _source() { return this.doc._source; }

  get parent() { return this.actor; }
  get documentName() { return "ActiveEffect"; }

  async update(patch, options = {}) {
    const diff = loudUpdate(this.doc, patch, { label: `Effect(${this.name})`, writes: this.world.writes });
    this.doc.reset();
    this.actor.prepare();
    fire("updateActiveEffect", this, diff, options);
    return this;
  }

  async delete(options = {}) {
    this.actor.effects.delete(this.id);
    this.actor.prepare();
    fire("deleteActiveEffect", this, null, options);
    return this;
  }

  toObject() { return this.doc.toObject(); }
}

class FakeActor {
  constructor(data, world) {
    this.id = data.id ?? nextId("actor");
    this.world = world;
    this.isOwner = data.isOwner ?? true;
    // Who owns it, by user id, as Foundry's ownership record holds it.
    // `owner: "p1"` is shorthand for Player1 owning it outright.
    this.ownership = { ...(data.ownership ?? {}), ...(data.owner ? { [data.owner]: 3 } : {}) };

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
    // ...and the type's own derived pass, which Foundry runs before the
    // document's (`client-document.mjs#prepareData`, step 7). Skipped here, a
    // Master's Base Attack ignored the forest's penalty in every test (#247).
    this.system.prepareDerivedData?.();
    this.system.ruleElements = this.ruleElements;
    const contributions = this.world.contributionsOf(this);
    writeDerived(this.system, applyStatDeltas(this.system, contributions.statDeltas));
  }

  get documentName() { return "Actor"; }
  get prototypeToken() { return this.doc.prototypeToken; }
  get isToken() { return false; }
  getDependentTokens() { return this.world.tokensFor(this.id); }

  async update(patch, options = {}) {
    const diff = loudUpdate(this.doc, patch, { label: `Actor(${this.name})`, writes: this.world.writes });
    this.prepare();
    fire("updateActor", this, diff, options);
    return this;
  }

  /** The collection and wrapper for an embedded type. */
  #embedded(type) {
    if (type === "Item") return { from: this.items, Wrapper: FakeItem };
    if (type === "ActiveEffect") return { from: this.effects, Wrapper: FakeEffect };
    throw new Error(`Embedded document type "${type}" is not modelled.`);
  }

  async createEmbeddedDocuments(type, dataArray, options = {}) {
    const { from, Wrapper } = this.#embedded(type);
    const made = dataArray.map((d) => new Wrapper(d, this, this.world));
    for (const doc of made) from.set(doc.id, doc);
    // Foundry re-prepares the parent before any listener hears of it, and an
    // effect's rules are contributions the prepare chain folds in.
    this.prepare();
    for (const doc of made) fire(`create${type}`, doc, null, options);
    return made;
  }

  async updateEmbeddedDocuments(type, updates, options = {}) {
    const { from } = this.#embedded(type);
    const done = [];
    for (const { _id, ...patch } of updates) {
      const doc = from.get(_id);
      if (doc) done.push(await doc.update(patch, options));
    }
    return done;
  }

  async deleteEmbeddedDocuments(type, ids, options = {}) {
    const { from } = this.#embedded(type);
    const gone = ids.map((id) => from.get(id)).filter(Boolean);
    for (const doc of gone) from.delete(doc.id);
    this.prepare();
    for (const doc of gone) fire(`delete${type}`, doc, null, options);
    return gone;
  }

  async delete(options = {}) {
    this.world.actors.delete(this.id);
    fire("deleteActor", this, null, options);
    return this;
  }

  getActiveTokens() { return this.world.tokensFor(this.id).map((t) => ({ document: t })); }

  /**
   * Foundry's `testUserPermission`: a GM holds every level; anyone else holds
   * what the ownership record gives them, or its `default`.
   *
   * @param {{id: string, isGM?: boolean}} user
   * @param {string|number} level "OWNER", "OBSERVER", ... or the number
   * @returns {boolean}
   */
  testUserPermission(user, level) {
    if (user?.isGM) return true;
    const LEVELS = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const want = typeof level === "number" ? level : LEVELS[level];
    return (this.ownership[user?.id] ?? this.ownership.default ?? LEVELS.NONE) >= want;
  }
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

  get documentName() { return "Token"; }
  get width() { return this.doc.width; }
  get height() { return this.doc.height; }
  get sight() { return this.doc.sight; }
  get texture() { return this.doc.texture; }
  get lockRotation() { return this.doc.lockRotation; }
  reset() { this.doc.reset(); }

  /**
   * An update; one that changes `x`, `y` or `elevation` is a movement, as it is
   * to Foundry, and fires its movement hooks around the write.
   */
  async update(patch, options = {}) {
    return this.#write(patch, options, this.world.writes);
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
    const moved = await this.#write(patch, options, []);
    this.world.writes.push(["Token", "move", { id: this.id, ...waypoint }]);
    return moved !== false;
  }

  /**
   * Foundry's order for a write that moves a token (`client/documents/token.mjs`):
   * `preMoveToken` through `Hooks.call`, where a `false` strips the movement;
   * then the write and `updateToken`; then `moveToken`, from the operation's end.
   * The movement is the shape the system's listeners read
   * (`engine/movement-hooks.mjs#pathOf`, `#panelsMoved`): one waypoint passed.
   *
   * @returns {Promise<FakeToken|false>} `false` when a listener refused the move
   */
  async #write(patch, options, writes) {
    const origin = { x: this.x, y: this.y, elevation: this.elevation };
    const destination = {
      x: patch.x ?? origin.x, y: patch.y ?? origin.y, elevation: patch.elevation ?? origin.elevation,
    };
    const moving = ["x", "y", "elevation"].some((k) => k in patch && patch[k] !== origin[k]);
    let movement = null;
    if (moving) {
      const grid = canvas.grid;
      const a = grid.getOffset(origin);
      const b = grid.getOffset(destination);
      const spaces = Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
      movement = {
        id: nextId("move"),
        method: options.method ?? "api",
        forced: Boolean(options.fgtForced),
        origin,
        destination,
        pending: { waypoints: [] },
        passed: { waypoints: [destination], spaces, cost: spaces },
      };
      if (globalThis.Hooks?.call?.("preMoveToken", this, movement, options) === false) {
        for (const k of ["x", "y", "elevation"]) delete patch[k];
        movement = null;
        if (Object.keys(patch).length === 0) return false;
      }
    }
    const diff = loudUpdate(this.doc, patch, { label: `Token(${this.id})`, writes });
    this.doc.reset();
    fire("updateToken", this, diff, options);
    if (movement) globalThis.Hooks?.callAll?.("moveToken", this, movement, { ...options }, game.user ?? null);
    return this;
  }

  async delete(options = {}) {
    this.world.tokens.delete(this.id);
    fire("deleteToken", this, null, options);
    return this;
  }
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
    // Seeded flags, in the flat `scope.key` shape `getFlag` reads, held on the
    // real document. Without this a spec could set a budget the code would
    // never find: `budgetFor` would answer a fresh, EMPTY budget and a test
    // asserting a refusal would pass because nothing was ever exhausted.
    for (const [path, value] of Object.entries(data.flags ?? {})) {
      const [scope, ...key] = path.split(".");
      this.doc.updateSource({ flags: { [scope]: { [key.join(".")]: value } } });
    }
    // One combatant per faction, as `rules/turn-order` keys them: a Turn is a
    // faction's, and `factionOfCombatant` reads `system.factionId`.
    this.combatants = new DocumentCollection((data.factions ?? []).map((f) => [`c-${f}`, { id: `c-${f}`, system: { factionId: f } }]));
    this.currentCombatantId = data.actingFactionId ? `c-${data.actingFactionId}` : null;
    // Who read the Round while a boundary was running, for a test that asks
    // whether the end of a Round read the Round that ended.
    this.roundReads = null;
  }

  get round() {
    this.roundReads?.push(new Error().stack.split("\n").slice(2, 6).map((l) => l.trim()).join(" < "));
    return this.doc.round;
  }
  get combatant() { return this.combatants.get(this.currentCombatantId) ?? null; }
  get system() { return this.doc.system; }
  get flags() { return this.doc.flags; }
  get _source() { return this.doc._source; }
  get documentName() { return "Combat"; }

  async update(patch, options = {}) {
    const diff = loudUpdate(this.doc, patch, { label: "Combat", writes: this.world.writes });
    this.doc.reset();
    fire("updateCombat", this, diff, options);
    return this;
  }

  /**
   * End this faction's Turn and hand it to the next, as Foundry's `nextTurn`
   * and `nextRound` do (`client/documents/combat.mjs`): a Round boundary fires
   * `combatRound` BEFORE the Round is written; then the write, `updateCombat`,
   * and `combatTurnChange` with the Turn that ended and the one that began. The
   * system's scheduler runs every boundary from those two hooks.
   *
   * @param {{to: string, newRound?: boolean}} next the faction whose Turn begins
   * @returns {Promise<void>} once the boundary has run and the world is quiet
   */
  async passTurn({ to, newRound = false }) {
    const prior = { round: this.round, turn: 0, combatantId: this.currentCombatantId, tokenId: null };
    if (newRound) {
      const round = this.doc.round + 1;
      globalThis.Hooks.callAll("combatRound", this, { round, turn: 0 }, { direction: 1 });
      await this.update({ round, turn: 0 }, { direction: 1 });
    } else {
      await this.update({ turn: (this.doc.turn ?? 0) + 1 }, { direction: 1 });
    }
    this.currentCombatantId = `c-${to}`;
    this.actingFactionId = to;
    const current = { round: this.doc.round, turn: this.doc.turn, combatantId: this.currentCombatantId, tokenId: null };
    globalThis.Hooks.callAll("combatTurnChange", this, prior, current);
    await this.world.settle();
  }

  getFlag(scope, key) { return this.doc.flags?.[scope]?.[key]; }
  // A real `setFlag` is an `update` of `flags.<scope>.<key>`, and fires `updateCombat`.
  setFlag(scope, key, value) { return this.update({ [`flags.${scope}.${key}`]: value }); }
  unsetFlag(scope, key) { return this.update({ [`flags.${scope}.-=${key}`]: null }); }
}

/**
 * A chat message: the card a player sees, and where a Combat Process keeps its
 * state between rungs (`flags.fgt.process`, Ch. 21).
 *
 * Backed by a real `BaseChatMessage`, so a flag write goes through Foundry's
 * own `updateSource` and the loud prune like every other write here. The
 * speaker and whisper list are held beside the document, for the reason a
 * Token's `actorId` is: they name the test's own ids, which are not Foundry's
 * sixteen-character ones.
 */
class FakeChatMessage {
  constructor(data, world) {
    this.id = data.id ?? nextId("msg");
    this.world = world;
    this.speaker = { scene: null, actor: null, token: null, alias: "", ...(data.speaker ?? {}) };
    this.whisper = [...(data.whisper ?? [])];
    this.doc = realDocument("ChatMessage", {
      ...documentData(data, ["content", "flavor", "title", "flags", "blind", "emote"]),
      // The author is a user by Foundry id, and this world's users carry the
      // test's own ids, so the document holds one well-formed stand-in.
      author: "worldUserAuthor1",
      timestamp: data.timestamp ?? world.clock(),
    }, `ChatMessage(${this.id})`);
  }

  get content() { return this.doc.content; }
  get flags() { return this.doc.flags; }
  get timestamp() { return this.doc.timestamp; }
  get _source() { return this.doc._source; }
  get documentName() { return "ChatMessage"; }

  async update(patch, options = {}) {
    const diff = loudUpdate(this.doc, patch, { label: `ChatMessage(${this.id})`, writes: this.world.writes });
    this.doc.reset();
    fire("updateChatMessage", this, diff, options);
    return this;
  }

  getFlag(scope, key) { return this.doc.flags?.[scope]?.[key]; }
  setFlag(scope, key, value) { return this.update({ [`flags.${scope}.${key}`]: value }); }
  unsetFlag(scope, key) { return this.update({ [`flags.${scope}.-=${key}`]: null }); }

  async delete(options = {}) {
    this.world.messages.delete(this.id);
    fire("deleteChatMessage", this, null, options);
    return this;
  }
}

/* -------------------------------------------------------------------------- */
/*  The world                                                                 */
/* -------------------------------------------------------------------------- */

/** The `core` settings Foundry's `common/` documents read, as a fresh world holds them. */
const CORE_SETTINGS = { prototypeTokenOverrides: { base: {} }, diceConfiguration: {} };

/** The world's own defaults, older than the registered ones and kept so no test's world changed under it. */
const WORLD_SETTINGS = {
  turnsPerRound: 3, npGateRound: 3, npGateRoundAssassin: 2, conquestSparesServants: true,
  // Zero seconds: the Command Spell interrupt window is not waited on.
  // `awaitInterrupt` polls every half second for this long when any Master
  // could spend one, and a test answers the questions it means to.
  commandSpellTimeout: 0,
};

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
 * Foundry's real `Hooks`, a fresh copy for this world, with what Foundry does
 * not do: every listener's returned promise is kept, so a test can wait for the
 * work a hook started (`w.settle()`), and a listener that throws or rejects is
 * a failure rather than a line in a console nobody reads.
 *
 * Foundry calls listeners in registration order, stops `call` at a `false`,
 * removes a `once` before it runs, and never awaits anything; all of that is
 * its own code here. `callAll` is also recorded in `w.hooks`.
 *
 * @param {object} world
 * @returns {Promise<Function>} the class to install as `Hooks`
 */
async function worldHooks(world) {
  const Hooks = await freshHooks();
  const pending = new Set();
  const track = (value) => {
    if (typeof value?.then !== "function") return value;
    const done = Promise.resolve(value)
      .catch((err) => { world.failures.push(`A listener rejected: ${err?.stack ?? err}`); })
      .finally(() => pending.delete(done));
    pending.add(done);
    return value;
  };
  const wrapped = new WeakMap();
  const { on, off, callAll } = Hooks;
  Hooks.on = function (hook, fn, options) {
    const listener = (...args) => track(fn(...args));
    wrapped.set(fn, listener);
    return on.call(this, hook, listener, options);
  };
  Hooks.off = function (hook, fn) {
    return off.call(this, hook, typeof fn === "function" ? (wrapped.get(fn) ?? fn) : fn);
  };
  Hooks.callAll = function (hook, ...args) {
    world.hooks.push([hook, ...args]);
    return callAll.call(this, hook, ...args);
  };
  // A listener that throws is caught by Foundry and reported through `error`.
  Hooks.on("error", (location, error) => {
    world.failures.push(`A listener threw (${location}): ${error?.message ?? error}`);
  });
  // Until the world goes quiet. A listener's returned promise is awaited; work a
  // listener starts and does not return (`syncVision(...).catch(...)`, Foundry's
  // own habit) is waited out instead: two turns of the event loop with no new
  // write, hook or tracked promise.
  world.settle = async () => {
    let last = -1;
    for (let quiet = 0, turns = 0; quiet < 2 && turns < 500; turns += 1) {
      if (pending.size) await Promise.allSettled([...pending]);
      await new Promise((resolve) => { setTimeout(resolve, 0); });
      const now = world.writes.length + world.hooks.length + pending.size;
      quiet = now === last ? quiet + 1 : 0;
      last = now;
    }
  };
  return Hooks;
}

/**
 * Where every die's face comes from.
 *
 * A test sets the faces it cares about, per die size and in order
 * (`w.dice.set("d100", 95, 12)`; a `5d10` takes five `d10`s). Every other face
 * comes from Foundry's own Mersenne Twister seeded with the world's seed, so an
 * unset die is the same on every run and a test never flickers. A face set and
 * never rolled is a failure: the test was about a roll that did not happen.
 *
 * @param {number} seed
 * @param {object} world
 */
function worldDice(seed, world) {
  const twister = new REAL.dice.MersenneTwister(seed);
  const queued = new Map();
  const log = [];
  let fixed = null;
  return {
    log,
    /**
     * @param {string|number} die "d100", "d20", or the face count
     * @param {...number} faces
     */
    set(die, ...faces) {
      const size = Number(String(die).replace(/^d/, ""));
      for (const f of faces) {
        if (!Number.isInteger(f) || f < 1 || f > size) throw new Error(`A d${size} has no face ${f}.`);
      }
      queued.set(size, [...(queued.get(size) ?? []), ...faces]);
      return world;
    },
    face(term) {
      const set = queued.get(term.faces);
      // Chosen by the test, face by face or all at once, or else the seed's.
      const scripted = Boolean(set?.length) || fixed !== null;
      const result = set?.length ? set.shift()
        : fixed !== null ? Math.min(fixed, term.faces)
          : term.mapRandomFace(twister.random());
      log.push({ faces: term.faces, result, scripted });
      return result;
    },
    /**
     * Every die not set otherwise lands on `face` (or its highest face, if smaller).
     * @param {number} face
     */
    every(face) {
      fixed = face;
      return world;
    },
    leftovers() {
      return [...queued].flatMap(([size, faces]) => faces.map((f) => `d${size} = ${f}`));
    },
  };
}

/**
 * The people at the table, as far as the engine can ask them anything.
 *
 * A question reaches a window one of two ways, and both are Foundry's own:
 * `FGTSocket.ask` to this client opens the dialog here; to Player1 it crosses
 * `game.socket`, and the model plays Player1's client, opening the same real
 * dialog there (`apps/prompt.mjs#renderPrompt`) and sending the answer back.
 * Either way the window is shown to a user (`client-api.mjs`), and answered from
 * the test's script: `w.answer({title, by, pick})`, `{title, by, decline: true}`,
 * or for a yes/no dialog `{title, by, value}`.
 *
 * @param {object} world
 * @returns {{socket: object, answer: Function, show: Function, dialog: Function, close: Function}}
 */
function questions(world) {
  const script = [];
  const listeners = [];

  const take = (title, kind, by) => {
    const at = script.findIndex((a) => a.title === title && (a.kind ?? kind) === kind);
    if (at < 0) {
      world.failures.push(`A question nobody scripted was shown to ${by}: "${title}" (${kind}).`);
      return null;
    }
    const [answer] = script.splice(at, 1);
    if (answer.by && answer.by !== by) {
      world.failures.push(`"${title}" was shown to ${by}; the script expected ${answer.by}.`);
    }
    return answer;
  };

  /** Answer a real `ChoiceDialog` the way its player would: tick, then confirm. */
  const answerChoice = async (app, by) => {
    const context = await app._prepareContext();
    const entry = { title: app.title, kind: "choose", by, options: context.options.map((o) => o.id) };
    world.asked.push(entry);
    const answer = take(entry.title, "choose", by);
    if (!answer || answer.decline) return app.close();
    const { actions } = app.constructor.DEFAULT_OPTIONS;
    for (const id of answer.pick ?? []) {
      if (!entry.options.includes(id)) {
        world.failures.push(`"${entry.title}" offered ${JSON.stringify(entry.options)}; the script picked "${id}".`);
        continue;
      }
      await actions.toggle.call(app, {}, { closest: () => ({ dataset: { optionId: id } }) });
    }
    await actions.confirm.call(app, {}, {});
    if (app.rendered) {
      world.failures.push(`"${entry.title}" refused the scripted answer ${JSON.stringify(answer.pick)}.`);
      return app.close();
    }
    return undefined;
  };

  return {
    socket: {
      on: (_ns, fn) => { listeners.push(fn); },
      off: () => {},
      emit: (_ns, msg) => {
        if (msg?.kind === "ask") {
          // Player1's client: open the dialog there, and answer the asker.
          Promise.resolve().then(() => asUser(msg.targetUserId, async () => {
            let response;
            try {
              const { renderPrompt } = await import("../../module/apps/prompt.mjs");
              response = { kind: "response", id: msg.id, ok: true, result: await renderPrompt(msg.spec) };
            } catch (err) {
              response = { kind: "response", id: msg.id, ok: false, error: { code: err.code ?? "ERROR", message: err.message } };
            }
            for (const fn of listeners) fn(response, msg.targetUserId);
          }));
        } else if (msg?.kind === "request") {
          world.proxied.push(msg);
        } else {
          world.events.push(msg);
        }
      },
    },
    answer(answer) {
      script.push(answer);
      return world;
    },
    show(app, by) {
      if (!app.constructor.DEFAULT_OPTIONS?.actions?.confirm) {
        world.rendered.push(app.constructor.name);
        return;
      }
      // After `render()` returns, as a person would: the asker is awaiting it.
      Promise.resolve().then(() => answerChoice(app, by)).catch((err) => world.failures.push(String(err?.stack ?? err)));
    },
    dialog(kind, config, by) {
      const title = config?.window?.title ?? "";
      world.asked.push({ title, kind, by });
      const answer = take(title, kind, by);
      if (!answer || answer.decline) return null;
      return answer.value ?? null;
    },
    close() {
      for (const a of script) world.failures.push(`A scripted answer was never asked for: "${a.title}".`);
      for (const f of world.dice.leftovers()) world.failures.push(`A scripted die was never rolled: ${f}.`);
    },
  };
}

/** What every world in a test file starts from, on top of its own spec; see {@link worldDefaults}. */
let defaults = {};

/**
 * Give every world from here on a default spec — for a file whose premise is,
 * say, "every chance lands on 1": `beforeEach(() => worldDefaults({dice: {every: 1}}))`.
 * Pass nothing to clear it.
 *
 * @param {object|null} [spec]
 */
export function worldDefaults(spec = null) {
  defaults = spec ?? {};
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
export async function withWorld(own, fn) {
  const spec = { ...defaults, ...own };
  await loadReal();
  const saved = Object.fromEntries(GLOBALS.map((k) => [k, globalThis[k]]));

  installFoundry();
  const snapshot = await import("../../module/rules/snapshot.mjs");
  const derived = await import("../../module/rules/derived.mjs");

  const world = {
    writes: [],
    hooks: [],
    proxied: [],
    events: [],
    // What the table saw: the data each card was built from, every roll, every
    // question and who it was shown to. Read by tests; written by the model.
    cards: [],
    rolls: [],
    asked: [],
    rendered: [],
    // What went wrong where Foundry would have said nothing: an unscripted
    // question, a question shown to the wrong user, a scripted die never rolled.
    // Thrown when the world closes, because the engine swallows a throw from a
    // window (`engine/ask.mjs:41`) and the test would pass on a `null`.
    failures: [],
    derived,
    contributionsOf: snapshot.contributionsOf,
    actors: new DocumentCollection(),
    tokens: new DocumentCollection(),
    // The scene's Tiles, which only a Feigned Defeat's body makes (#249).
    tiles: [],
    messages: new DocumentCollection(),
    settings: { ...REAL.settingDefaults, ...WORLD_SETTINGS, ...(spec.settings ?? {}) },
    selfUserId: "u1",
    clock: ((t) => () => (t += 1000))(1_700_000_000_000),
    tokensFor(actorId) { return [...this.tokens.values()].filter((t) => t.actorId === actorId); },
    actor(name) { return [...this.actors.values()].find((a) => a.name === name || a.id === name) ?? null; },
    wrote(path) { return this.writes.filter(([, p]) => p === path); },
  };
  world.dice = worldDice(spec.seed ?? 1, world);
  if (spec.dice?.every !== undefined) world.dice.every(spec.dice.every);
  Object.assign(world, questions(world));

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

  // Two people at the table: this client, and one other. By default this client
  // is the GM and the other is Player1, who owns whatever a spec gives them
  // (`owner: "p1"`). `isGM: false` turns it round: this client is the player
  // and the GM is elsewhere, so a request crosses the socket (recorded, not run).
  const user = (id, name, isGM, isSelf) => ({
    id, name, isGM, isSelf, active: true, hasPermission: () => false, getFlag: () => undefined,
  });
  const gmHere = spec.isGM ?? true;
  const people = gmHere
    ? [user("u1", "Gamemaster", true, true), user("p1", "Player1", false, false)]
    : [user("u1", "Player1", false, true), user("g1", "Gamemaster", true, false)];
  const users = Object.assign(new DocumentCollection(people.map((u) => [u.id, u])), {
    activeGM: people.find((u) => u.isGM),
  });

  globalThis.game = {
    // What a real Document reads while it constructs: release, system, model.
    ...REAL.game,
    actors: world.actors,
    combat: world.viewedCombat,
    combats: { active: world.combat, get: (id) => [world.combat, world.viewedCombat].find((c) => c.id === id) ?? null },
    user: people[0],
    // A collection like Foundry's, iterable: `engine/board.mjs#ownerUserOf`
    // walks every user to find a Unit's non-GM owner, and `askOwner` asks them.
    users,
    settings: {
      get(scope, key) {
        // Foundry's own documents read core settings while they update and roll:
        // the prototype-token overrides and the dice configuration, empty in a
        // fresh world.
        if (scope === "core" && key in CORE_SETTINGS) return CORE_SETTINGS[key];
        if (!(key in world.settings)) throw new Error(`Setting "${key}" is not modelled by test/helpers/world.mjs.`);
        return world.settings[key];
      },
    },
    socket: world.socket,
    // An Item compendium, when the world was given one (`withSubjects`'s
    // `pack`): the content an Item grant reads (`engine/io.mjs#fromContent`).
    packs: spec.packs ?? [],
    messages: world.messages,
    journal: notModelled("game.journal"),
    i18n: { format: (k) => k, localize: (k) => k, has: () => false },
  };
  globalThis.canvas = {
    tokens: {
      get: (id) => world.tokensFor(id)[0] ?? null,
      placeables: [...world.tokens.values()].map((t) => ({ actor: t.actor, document: t })),
    },
    // One panel is 100 pixels. `getOffset` is the inverse of `getTopLeftPoint`,
    // which `engine/board.mjs#panelOf` asks of every token, and `size` is what
    // an engine placing a token by panel multiplies by (`riding.mjs` reads it
    // off `canvas.scene.grid`).
    grid: {
      size: 100,
      getTopLeftPoint: ({ i, j }) => ({ x: j * 100, y: i * 100 }),
      getOffset: ({ x, y }) => ({ i: Math.floor(y / 100), j: Math.floor(x / 100) }),
    },
    // No Regions on it: a scene a test builds has no terrain, home bases or fields
    // until it says so -- `regions: [{id, panels, behaviors: [{type, system}]}]`.
    // A stand-in for a RegionDocument, answering only what the board asks of one.
    scene: {
      grid: { size: 100 },
      regions: (spec.regions ?? []).map((r) => ({
        id: r.id, behaviors: r.behaviors ?? [], getOccupiedGridSpaceOffsets: () => r.panels ?? [],
      })),
      // Tiles: a Feigned Defeat's stand-in body is two (#249). Only what the
      // engine asks of a TileDocument: its data, its flags, create and delete.
      tiles: world.tiles,
      async createEmbeddedDocuments(type, data) {
        if (type !== "Tile") throw new Error(`The test world's scene creates Tiles only, not ${type}.`);
        return data.map((d) => {
          const tile = { ...d, id: `tile${String(world.tiles.length + 1).padStart(4, "0")}`,
            getFlag: (scope, key) => d.flags?.[scope]?.[key] };
          world.tiles.push(tile);
          return tile;
        });
      },
      async deleteEmbeddedDocuments(type, ids) {
        if (type !== "Tile") throw new Error(`The test world's scene deletes Tiles only, not ${type}.`);
        for (const id of ids) {
          const at = world.tiles.findIndex((t) => t.id === id);
          if (at >= 0) world.tiles.splice(at, 1);
        }
      },
    },
  };
  globalThis.Hooks = await worldHooks(world);
  globalThis.ui = { notifications: { warn: () => {}, error: () => {}, info: () => {} } };

  // Foundry's real dice, every face from this world (`worldDice`).
  CONFIG.debug ??= {};
  CONFIG.Dice = diceConfig(REAL.dice, (term) => world.dice.face(term));
  globalThis.Roll = class Roll extends REAL.dice.Roll {
    async evaluate(options) {
      await super.evaluate(options);
      world.rolls.push({
        formula: this.formula,
        total: this.total,
        faces: this.dice.flatMap((d) => d.results.map((r) => ({ faces: d.faces, result: r.result }))),
      });
      return this;
    }
  };
  globalThis.ChatMessage = class ChatMessage {
    static async create(data, options = {}) {
      const message = new FakeChatMessage(data, world);
      world.messages.set(message.id, message);
      fire("createChatMessage", message, null, options);
      return message;
    }

    static getSpeaker({ actor = null, token = null, alias = undefined } = {}) {
      return { scene: null, actor: actor?.id ?? null, token: token?.id ?? null, alias: alias ?? actor?.name ?? "" };
    }
  };

  bindWorld(world);
  // The system's socket listener, as `fgt.mjs` registers it at init: how an
  // answer from Player1's client comes back to the one that asked.
  const { FGTSocket } = await import("../../module/net/socket.mjs");
  FGTSocket.initialize();
  // The engine's document listeners, the list `fgt.mjs` binds at ready. After
  // the seeds, as a world's documents exist before its listeners do: loading a
  // world fires no create hooks.
  const { attachEngineListeners } = await import("../../module/engine/listeners.mjs");
  world.listeners = attachEngineListeners({ skip: spec.skipListeners ?? [] });

  try {
    const result = await fn(world);
    await world.settle();
    world.close();
    // A test that stubbed `Roll` before entering expected its stub to roll; in
    // here the world's real dice roll instead, and a test written for "every
    // chance lands on 1" would be passing on the seed's luck.
    if (saved.Roll && world.dice.log.some((d) => !d.scripted)) {
      world.failures.push("This test stubs globalThis.Roll, but the world rolls Foundry's real dice: set faces with w.dice.set(), or w.dice.every().");
    }
    if (world.failures.length) {
      throw new Error(`The world saw what Foundry would not have said:\n- ${world.failures.join("\n- ")}`);
    }
    return result;
  } finally {
    bindWorld(null);
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
