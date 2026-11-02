/**
 * @file The interface's look: Grail War Nocturne, or Classic (#364).
 * @see module/apps/ui-style.mjs, styles/src/classic/, DESIGN.md, docs/35-sheets-and-editor.md
 *
 * Classic is a frozen copy of the look #367 drew, so the danger is drift: a
 * feature added to Nocturne's templates or stylesheet that Classic never
 * hears of, and a Classic world that silently loses it. The guards below fail
 * on that drift and name what to copy across.
 *
 * The suite runs without a DOM, so the stylesheet swap is pressed against a
 * stand-in for the two `CSSStyleSheet` members it touches. Foundry's head
 * (`@import "…" layer(system);` in one `<style>`) was read in
 * `app/templates/views/layouts/main.hbs` and live.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import {
  UI_STYLES, CLASSIC_TEMPLATES, CLASSIC_CSS,
  uiStyle, isClassicUI, uiTemplate, uiParts, swapStylesheet, applyUiStyle,
} from "../../module/apps/ui-style.mjs";
import { markSystemCard } from "../../module/apps/chat/surface.mjs";
import { prepareWorld, withWorld } from "../helpers/world.mjs";

const before = globalThis.game;
afterEach(() => { globalThis.game = before; vi.restoreAllMocks(); });

/** A world whose `uiStyle` setting reads `value`. */
const world = (value) => {
  globalThis.game = { settings: { get: (scope, key) => {
    if (scope === "fgt" && key === "uiStyle") return value;
    throw new Error(`unexpected setting ${scope}.${key}`);
  } } };
};

/** A `<style>` sheet holding these imports, recording what is done to it. */
const head = (hrefs, layerName = "system") => {
  const rules = hrefs.map((href) => ({ href, layerName }));
  return {
    cssRules: rules,
    inserted: [],
    deleteRule(i) { rules.splice(i, 1); },
    insertRule(text, i) { this.inserted.push({ text, i }); rules.splice(i, 0, { href: CLASSIC_CSS, layerName, text }); },
  };
};

describe("uiStyle", () => {
  it("is Nocturne by default and Classic when the world says so", () => {
    world("nocturne");
    expect(uiStyle()).toBe("nocturne");
    expect(isClassicUI()).toBe(false);
    world("classic");
    expect(uiStyle()).toBe("classic");
    expect(isClassicUI()).toBe(true);
  });

  it("draws the default before the setting exists", () => {
    globalThis.game = { settings: { get: () => { throw new Error("not registered"); } } };
    expect(uiStyle()).toBe("nocturne");
  });

  it("says an unknown stored look out loud and draws the default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    world("vaporwave");
    expect(uiStyle()).toBe("nocturne");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"vaporwave"'));
  });
});

describe("uiTemplate and uiParts", () => {
  it("swaps the two rebuilt templates under Classic, and only those", () => {
    for (const [live, classic] of Object.entries(CLASSIC_TEMPLATES)) {
      expect(uiTemplate(live, "classic")).toBe(classic);
      expect(uiTemplate(live, "nocturne")).toBe(live);
    }
    const shared = "systems/fgt/templates/actor/header.hbs";
    expect(uiTemplate(shared, "classic")).toBe(shared);
  });

  it("swaps an application's parts in place", () => {
    const parts = { body: { template: "systems/fgt/templates/hud/action-bar.hbs", templates: [] } };
    expect(uiParts(parts, "classic").body.template).toBe("systems/fgt/templates/classic/hud/action-bar.hbs");
  });

  it("points at templates that exist, both sides", () => {
    for (const [live, classic] of Object.entries(CLASSIC_TEMPLATES)) {
      expect(existsSync(live.replace("systems/fgt/", ""))).toBe(true);
      expect(existsSync(classic.replace("systems/fgt/", ""))).toBe(true);
    }
  });
});

describe("swapStylesheet", () => {
  it("replaces fgt.css's import in place, keeping its layer", () => {
    const sheet = head(["ui/foo.css", "systems/fgt/styles/fgt.css", "modules/x/x.css"]);
    expect(swapStylesheet({ styleSheets: [sheet] })).toBe(true);
    expect(sheet.inserted).toEqual([{ text: `@import url("${CLASSIC_CSS}") layer(system);`, i: 1 }]);
    expect(sheet.cssRules.map((r) => r.href)).toEqual(["ui/foo.css", CLASSIC_CSS, "modules/x/x.css"]);
  });

  it("skips a sheet it may not read and a module's look-alike path", () => {
    const foreign = { get cssRules() { throw new Error("cross-origin"); } };
    const sheet = head(["modules/fgt-styles/styles/fgt.css"]);
    expect(swapStylesheet({ styleSheets: [foreign, sheet] })).toBe(false);
    expect(sheet.inserted).toEqual([]);
  });
});

describe("applyUiStyle", () => {
  it("leaves Nocturne's page alone", () => {
    world("nocturne");
    const sheet = head(["systems/fgt/styles/fgt.css"]);
    expect(applyUiStyle({ styleSheets: [sheet] })).toBe("nocturne");
    expect(sheet.inserted).toEqual([]);
  });

  it("swaps the stylesheet under Classic", () => {
    world("classic");
    const sheet = head(["systems/fgt/styles/fgt.css"]);
    expect(applyUiStyle({ styleSheets: [sheet] })).toBe("classic");
    expect(isClassicUI()).toBe(true);
    expect(sheet.cssRules[0].href).toBe(CLASSIC_CSS);
  });

  it("refuses out loud when fgt.css is not there, and is Nocturne everywhere", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    world("classic");
    expect(applyUiStyle({ styleSheets: [] })).toBe("nocturne");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("could not find fgt.css"));
    // The templates follow the stylesheet that loaded, not the setting.
    expect(isClassicUI()).toBe(false);
    expect(uiTemplate("systems/fgt/templates/hud/action-bar.hbs")).toBe("systems/fgt/templates/hud/action-bar.hbs");
    // Reset for any later file sharing the module.
    world("nocturne");
    applyUiStyle({ styleSheets: [] });
  });
});

describe("the uiStyle setting", () => {
  beforeAll(prepareWorld, 60_000);

  it("is a world choice of the looks, Nocturne first, applied on reload", async () => {
    // The real `registerSettings`, in the test world, against a `register`
    // that keeps what it is handed.
    const registered = {};
    await withWorld({}, async () => {
      const real = game.settings;
      game.settings = { register: (scope, key, data) => { registered[key] = data; }, registerMenu: () => {} };
      try {
        const { registerSettings } = await import("../../module/settings.mjs");
        registerSettings();
      } finally {
        game.settings = real;
      }
    });
    const spec = registered.uiStyle;
    expect(spec).toMatchObject({ scope: "world", config: true, default: "nocturne", requiresReload: true });
    expect(Object.keys(spec.choices)).toEqual([...UI_STYLES]);
    const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
    for (const key of [spec.name, spec.hint, ...Object.values(spec.choices)]) expect(lang[key], key).toBeTruthy();
  });
});

describe("markSystemCard under Classic", () => {
  it("marks the card without Nocturne's forced night", () => {
    const classes = new Set();
    const html = { classList: { add: (...n) => n.forEach((c) => classes.add(c)) }, querySelector: () => ({}) };
    expect(markSystemCard(html, { night: false })).toBe(true);
    expect([...classes].sort()).toEqual(["fgt", "fgt-message"]);
  });
});

// ── Drift guards ────────────────────────────────────────────────────────────

/** The hooks a template's code finds it by: data attributes and partials. */
const hooks = (path) => new Set([
  ...[...readFileSync(path, "utf8").matchAll(/\b(data-[a-z-]+)(?:="([a-zA-Z]+)")?/g)].map((m) => (m[2] ? `${m[1]}=${m[2]}` : m[1])),
  ...[...readFileSync(path, "utf8").matchAll(/\{\{>\s*([a-z-]+)/g)].map((m) => `partial:${m[1]}`),
]);

/** Hooks Nocturne's templates added for Nocturne's own styling and motion. */
const NOCTURNE_HOOKS = new Set(["data-role", "data-fgt-circle", "data-gauge", "data-pct"]);

describe("Classic's templates keep up with the live ones", () => {
  it("carry every hook the code reads, so a new button reaches Classic too", () => {
    for (const [live, classic] of Object.entries(CLASSIC_TEMPLATES)) {
      const want = [...hooks(live.replace("systems/fgt/", ""))].filter((h) => !NOCTURNE_HOOKS.has(h)).sort();
      const have = [...hooks(classic.replace("systems/fgt/", ""))].sort();
      expect(have, `${classic}: copy the new hooks across from ${live}`).toEqual(want);
    }
  });

  it("finds hooks at all, so a broken match cannot pass vacuously", () => {
    expect(hooks("templates/hud/action-bar.hbs").has("data-action=useSlot")).toBe(true);
  });
});

/** Every top-level `.class {` in a directory's partials. */
const classes = (dir) => {
  const out = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".scss") && f !== "fgt.scss")) {
    for (const m of readFileSync(`${dir}/${file}`, "utf8").matchAll(/^\.([a-zA-Z0-9_-]+)\s*\{/gm)) out.add(m[1]);
  }
  return out;
};

/** Blocks Nocturne alone styles: its medal, gauges, duel, effect art, banner. */
const NOCTURNE_ONLY = new Set(["fgt-role", "fgt-duel", "fgt-medal", "fgt-gauge", "fgt-fx"]);

describe("Classic's stylesheet keeps up with Nocturne's", () => {
  const live = classes("styles/src");
  const classic = classes("styles/src/classic");
  // The ability editor's partial is shared (`@use "../editor"`).
  const shared = new Set(
    [...readFileSync("styles/src/_editor.scss", "utf8").matchAll(/^\.([a-zA-Z0-9_-]+)\s*\{/gm)].map((m) => m[1]),
  );

  it("styles every block Nocturne styles, or names it Nocturne's alone", () => {
    // A new window styled only in `styles/src/` is unstyled under Classic.
    // Style it in `styles/src/classic/` too, or list it above.
    const missing = [...live].filter((c) => !classic.has(c) && !shared.has(c) && !NOCTURNE_ONLY.has(c));
    expect(missing).toEqual([]);
  });

  it("lists nothing as Nocturne's alone that Classic styles, or that is gone", () => {
    const stale = [...NOCTURNE_ONLY].filter((c) => classic.has(c) || !live.has(c));
    expect(stale).toEqual([]);
  });

  it("finds classes at all, so a broken parse cannot pass vacuously", () => {
    expect(classic.size).toBeGreaterThan(50);
  });

  it("hides what the shared templates draw for Nocturne alone", () => {
    const bridge = readFileSync("styles/src/classic/_bridge.scss", "utf8");
    for (const cls of [".fgt-portrait__circle", ".fgt-fx", ".fgt-role", ".fgt-cutin"]) expect(bridge).toContain(cls);
    expect(readFileSync("styles/src/classic/fgt.scss", "utf8")).toMatch(/@use "bridge";/);
  });
});
