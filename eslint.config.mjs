import js from "@eslint/js";

/**
 * The layer boundary is the rule that matters here.
 *
 * docs/01-vision-and-goals.md §1.7 defines four layers with a strict dependency
 * direction: domain → rules → engine → apps. A violation is a build failure
 * rather than a code review comment, because the whole value of the boundary is
 * that L1 and L2 stay testable without Foundry.
 *
 * `ALLOWED` is exported and enforced by `tools/check-layers.mjs`, which runs as
 * part of `npm run lint`. It is not enforced by ESLint itself: that needs
 * `eslint-plugin-import`, and for one rule a twenty-line script beats a
 * dependency. The `zones` table below is kept in the shape that plugin wants,
 * so adopting it later is a one-line change.
 */
export const LAYERS = ["domain", "rules", "engine", "data", "documents", "apps", "canvas", "net", "regions"];

/** Which layers each layer may import from. `util` is universal. */
export const ALLOWED = {
  domain: [],
  rules: ["domain"],
  engine: ["domain", "rules", "data", "documents", "net"],
  data: ["domain"],
  documents: ["domain", "rules", "data"],
  regions: ["domain", "rules", "data"],
  net: ["domain"],
  canvas: ["domain", "rules"],
  apps: LAYERS,
};

const zones = Object.entries(ALLOWED).map(([from, allowed]) => ({
  target: `./module/${from}`,
  from: LAYERS.filter((l) => l !== from && !allowed.includes(l)).map((l) => `./module/${l}`),
  message: `module/${from} may only import from: ${allowed.join(", ") || "(nothing)"}. See docs/01-vision-and-goals.md §1.7.`,
}));

export default [
  js.configs.recommended,
  {
    files: ["module/**/*.mjs", "tools/**/*.mjs", "test/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        // Foundry globals, available only above the L1/L2 line.
        game: "readonly", ui: "readonly", canvas: "readonly", CONFIG: "readonly",
        CONST: "readonly", Hooks: "readonly", foundry: "readonly", fgt: "writable",
        Actor: "readonly", Item: "readonly", ActiveEffect: "readonly",
        Combat: "readonly", Combatant: "readonly", ChatMessage: "readonly",
        TokenDocument: "readonly", Scene: "readonly", JournalEntry: "readonly",
        Roll: "readonly", Dialog: "readonly", console: "readonly",
        globalThis: "readonly", structuredClone: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly",
        // Browser and PIXI, for the canvas layer and the floating preview. Only
        // L4 may touch these; the L1/L2 block below takes them away again.
        window: "readonly", document: "readonly", PIXI: "readonly",
        PointerEvent: "readonly",
        // Node, for tools/ and test/
        process: "readonly", Buffer: "readonly", URL: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
    },
  },
  {
    // L1 and L2 are pure. No Foundry globals at all — that is what makes them
    // unit-testable in Node and is the load-bearing half of the layer rule.
    files: ["module/domain/**/*.mjs", "module/rules/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", structuredClone: "readonly" },
    },
    rules: {
      "no-restricted-globals": [
        "error",
        ...["game", "ui", "canvas", "CONFIG", "CONST", "Hooks", "foundry", "fgt",
          "window", "document", "PIXI"].map((name) => ({
          name,
          message: `module/domain and module/rules must stay pure — no Foundry globals. Pass "${name}" data in through a snapshot instead. See docs/03-domain-overview.md §3.6.`,
        })),
      ],
    },
  },
  {
    // Build tools and the bootstrap log progress; that is their job.
    files: [
      "tools/**/*.mjs", "module/fgt.mjs",
      "module/engine/scheduler-hooks.mjs", "module/engine/movement-hooks.mjs",
      "module/apps/canvas/target-region.mjs",
    ],
    rules: { "no-console": "off" },
  },
  {
    // `tools/smoke-world.mjs` talks to Chrome over the DevTools Protocol, which
    // means HTTP and a WebSocket. Both are Node globals now (WebSocket since 22,
    // which is what CI runs), so they need no import — but they are granted here
    // rather than in the shared list, because nothing under module/ should be
    // reaching for a raw socket.
    files: ["tools/**/*.mjs"],
    languageOptions: { globals: { fetch: "readonly", WebSocket: "readonly" } },
  },
  { ignores: ["node_modules/**", "packs/**", "styles/fgt.css", "coverage/**", ".build/**"] },
];

export { zones };
