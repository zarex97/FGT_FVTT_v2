/**
 * @file Foundry's window classes, as the test world stands them in.
 * @see test/helpers/world.mjs, test/helpers/client-namespace.mjs, docs/44-testing.md
 *
 * The engine asks people things through windows: `askOwner` → `FGTSocket.ask` →
 * `apps/prompt.mjs#renderPrompt` → `ChoiceDialog.pick`, a real
 * `ApplicationV2`. Foundry's application classes are DOM and do not import in
 * Node, so this file stands in the base classes — and nothing above them. The
 * `ChoiceDialog` a test meets is the real one, with its own count and minimum
 * rule; only `render()` differs: instead of drawing, it hands the window to the
 * world that is running, as shown to the user it was shown to.
 *
 * Which user saw a window is the point. Before `askOwner` existed a Servant's
 * player was asked on the GM's screen, and Serenity's weak-point question was
 * the latest (#199): no test could tell, because every question went nowhere.
 * Here each one is answered from the test's script, and a question the script
 * did not expect, or one shown to the wrong user, fails the test.
 *
 * `apps/*` modules are cached for the whole test file, and they capture these
 * classes when first imported. So the classes are installed once and look up
 * the CURRENT world when they render, rather than closing over one.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/** The world windows are shown in; `null` between worlds. */
let current = null;

/** Which user a window is being shown to, across the awaits of an answer. */
const viewer = new AsyncLocalStorage();

/**
 * Show windows in this world from now on, or in none.
 * @param {object|null} world
 */
export function bindWorld(world) { current = world; }

/**
 * Run `fn` as user `userId`: every window it opens is shown to them.
 * @template T
 * @param {string} userId
 * @param {() => T} fn
 * @returns {T}
 */
export function asUser(userId, fn) { return viewer.run(userId, fn); }

/** The user a window opened now is shown to: the one being asked, else this client's. */
const shownTo = () => viewer.getStore() ?? current?.selfUserId ?? null;

class ApplicationV2 {
  static DEFAULT_OPTIONS = {};

  constructor(options = {}) {
    this.options = options;
    this.id = options.id ?? null;
    this.rendered = false;
  }

  get title() {
    return this.options?.window?.title ?? this.constructor.DEFAULT_OPTIONS?.window?.title ?? "";
  }

  async render() {
    const first = !this.rendered;
    this.rendered = true;
    // A window re-renders itself as it is used (a toggle in a ChoiceDialog);
    // it was shown once.
    if (first) current?.show?.(this, shownTo());
    return this;
  }

  async close() {
    this.rendered = false;
    return this;
  }
}

/** What a scripted answer of `{hold: true}` gives back: the player has not answered yet. */
export const HOLD = Symbol("hold");

/**
 * A dialog shown and answered from the script; a held one stays open as
 * Foundry's `DialogV2.wait` does, drawn (its `render` callback told) until it
 * is closed, and closing it resolves `null`, a dismissal.
 */
const shown = (cls, kind, config) => {
  if (!current) return null;
  const by = shownTo();
  const answer = current.dialog(kind, config, by);
  if (answer !== HOLD) return answer;
  return new Promise((resolve) => {
    const app = new cls(config);
    app.rendered = true;
    const close = app.close.bind(app);
    app.close = async (options) => {
      await close(options);
      resolve(null);
      return app;
    };
    current.held?.push({ app, title: app.title, by });
    config.render?.({}, app);
  });
};

class DialogV2 extends ApplicationV2 {
  static async confirm(config = {}) {
    return shown(this, "confirm", config);
  }

  static async prompt(config = {}) {
    return shown(this, "prompt", config);
  }

  static async wait(config = {}) {
    return shown(this, "wait", config);
  }
}

/** A class `extends` of anything else the client offers: it exists, and draws nothing. */
const inert = () => class {};

const api = new Proxy({ ApplicationV2, DialogV2, HandlebarsApplicationMixin: (Base) => Base }, {
  get: (known, key) => (key in known ? known[key] : (typeof key === "string" ? inert() : undefined)),
});

const handlebars = {
  /**
   * What a card was built from, recorded rather than drawn. No engine code reads
   * a card's `content` back, so the data handed to the template is what a test
   * holds a card to.
   */
  renderTemplate: async (path, data) => {
    current?.cards?.push({ path, data });
    return `<!-- ${path} -->`;
  },
  loadTemplates: async () => {},
};

/**
 * What `Roll#evaluate` constructs on every roll to ask for any die a person
 * rolls by hand. No method here is interactive, so it waits for nothing.
 */
class RollResolver {
  static instances() { return []; }
  constructor(roll) { this.roll = roll; }
  async awaitFulfillment() {}
  async addTerm() {}
  close() {}
}

/**
 * Give `foundry.applications` the stand-ins, on the real `foundry` object.
 *
 * Idempotent, and it wins over an earlier, emptier stub: a window class that
 * captured an empty base before this ran could never be shown.
 *
 * @returns {void}
 */
export function installClientApi() {
  const applications = (globalThis.foundry.applications ??= {});
  applications.api = api;
  applications.handlebars = handlebars;
  applications.dice = { RollResolver };
  for (const k of ["ux", "sheets", "apps", "sidebar"]) {
    applications[k] ??= new Proxy({}, { get: (t, key) => (key in t ? t[key] : inert()) });
  }
  applications.instances ??= new Map();
}
