# Content Cross-References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every rules term in a description clickable, so a player reading "inflicts Burn" can open Burn.

**Architecture:** Content authors typed markers like `@effect[burn]` in YAML. A pure module parses them and rewrites them to real Foundry `@UUID[...]` links at build time, against an index the compiler builds from content ids. The validator fails the build on an unresolvable or mistyped marker, and warns on a name mentioned without one. At runtime the sheets call `enrichHTML`, which nothing in this system has ever done.

**Tech Stack:** Node 20+, vitest, YAML, `@foundryvtt/foundryvtt-cli`, Foundry VTT v14 `TextEditor.enrichHTML`.

**Spec:** `docs/superpowers/specs/2026-09-04-content-cross-references-design.md`

## Global Constraints

- Layer boundary `domain → rules → engine → apps`, enforced by `npm run lint`. `tools/` may import from `module/`, never the reverse.
- `tools/lib/references.mjs` must import **nothing** from `tools/lib/content.mjs`. `content.mjs` builds the index and passes it in. A cycle between them breaks the build.
- Every user-facing string is an i18n key in `lang/en.json`.
- Tests are vitest under `test/unit/` and must pass with `npm test`.
- Full gate before any commit is done: `npm run lint && npm test && npm run validate:content && npm run check:templates`.
- Every task that changes behaviour also updates the `docs/` chapter describing it, not only Chapter 45.
- Marker syntax is exactly `@kind[id]` or `@kind[id]{label}`. Ids match `[a-zA-Z0-9-]+`. Labels may contain anything but `}`.

---

### Task 1: Parsing and rewriting markers

**Files:**
- Create: `tools/lib/references.mjs`
- Test: `test/unit/references.test.mjs`

**Interfaces:**
- Consumes: nothing. Pure, and deliberately ignorant of `content.mjs`.
- Produces:
  - `REFERENCE_KINDS: ReadonlyArray<string>` — `["effect", "ability", "np", "spell", "essence", "action"]`
  - `parseMarkers(text): Array<{raw, kind, id, label, index}>`
  - `rewriteReferences(text, index): {text: string, problems: string[]}` where `index` is a `Map<"kind:id", {uuid, name}>`
  - `mentionsWithoutMarkers(text, names): string[]` where `names` is a `Map<displayName, "kind:id">`

- [ ] **Step 1: Write the failing test**

Create `test/unit/references.test.mjs`:

```js
/**
 * @file Cross-reference markers in content prose.
 * @see tools/lib/references.mjs, docs/37-content-pipeline.md §37.8
 *
 * Nothing in this system has ever called `enrichHTML`, so a description
 * mentioning Burn was plain text and a player had no way to learn what Burn
 * does. Markers are authored, resolved at build time, and rendered by
 * Foundry's own content-link enricher.
 */
import { describe, it, expect } from "vitest";
import {
  REFERENCE_KINDS, parseMarkers, rewriteReferences, mentionsWithoutMarkers,
} from "../../tools/lib/references.mjs";

const index = new Map([
  ["effect:burn", { uuid: "Compendium.fgt.effects.Item.j7sgkl30v2z7d6vs", name: "Burn" }],
  ["ability:class-riding", { uuid: "Compendium.fgt.class-skills.Item.aaaaaaaaaaaaaaaa", name: "Riding" }],
  ["np:medusa-bellerophon", { uuid: "Compendium.fgt.servants.Actor.mmmm.Item.bbbb", name: "Bellerophon" }],
  ["action:mark", { uuid: "Compendium.fgt.rules.JournalEntry.cccc", name: "Mark" }],
]);

describe("parseMarkers", () => {
  it("finds a marker with no label", () => {
    expect(parseMarkers("inflicts @effect[burn] for 3◈")).toEqual([
      { raw: "@effect[burn]", kind: "effect", id: "burn", label: null, index: 9 },
    ]);
  });

  it("finds a marker with a label", () => {
    const [m] = parseMarkers("cannot use @ability[class-riding]{Riding} now");
    expect(m).toMatchObject({ kind: "ability", id: "class-riding", label: "Riding" });
  });

  it("finds several in one description", () => {
    const found = parseMarkers("@effect[burn] then @action[mark] then @np[medusa-bellerophon]");
    expect(found.map((m) => m.kind)).toEqual(["effect", "action", "np"]);
  });

  it("ignores an at-sign that is not a marker", () => {
    // `@intentional` is an existing authoring convention in comments, and an
    // email address must not become a link either.
    expect(parseMarkers("see @intentional and a@b.com")).toEqual([]);
  });

  it("ignores an unknown kind rather than guessing", () => {
    expect(parseMarkers("@servant[medusa]")).toEqual([]);
  });

  it("names every kind the vocabulary supports", () => {
    expect([...REFERENCE_KINDS].sort()).toEqual(
      ["ability", "action", "effect", "essence", "np", "spell"],
    );
  });
});

describe("rewriteReferences", () => {
  it("rewrites a bare marker to a UUID link labelled with the document's name", () => {
    const out = rewriteReferences("inflicts @effect[burn] for 3◈", index);
    expect(out.text).toBe("inflicts @UUID[Compendium.fgt.effects.Item.j7sgkl30v2z7d6vs]{Burn} for 3◈");
    expect(out.problems).toEqual([]);
  });

  it("keeps an authored label, for inflection and case", () => {
    const out = rewriteReferences("@effect[burn]{Burning}", index);
    expect(out.text).toBe("@UUID[Compendium.fgt.effects.Item.j7sgkl30v2z7d6vs]{Burning}");
  });

  it("rewrites several markers in one pass without disturbing the prose", () => {
    const out = rewriteReferences("A @effect[burn] B @action[mark] C", index);
    expect(out.text).toBe(
      "A @UUID[Compendium.fgt.effects.Item.j7sgkl30v2z7d6vs]{Burn} B "
      + "@UUID[Compendium.fgt.rules.JournalEntry.cccc]{Mark} C",
    );
  });

  it("reports an id that resolves to nothing, and leaves the text alone", () => {
    const out = rewriteReferences("@effect[nosuchthing}", index);
    expect(out.problems).toEqual([]); // malformed: no closing bracket, so not a marker
    const bad = rewriteReferences("@effect[nosuchthing]", index);
    expect(bad.problems[0]).toMatch(/@effect\[nosuchthing\] resolves to no document/);
    expect(bad.text).toBe("@effect[nosuchthing]");
  });

  it("reports a marker whose kind disagrees with the target", () => {
    // `burn` is an effect. Calling it an ability is a link that would not work.
    const out = rewriteReferences("@ability[burn]", index);
    expect(out.problems[0]).toMatch(/@ability\[burn\] resolves to no document/);
  });

  it("leaves text with no markers untouched", () => {
    expect(rewriteReferences("plain prose", index)).toEqual({ text: "plain prose", problems: [] });
  });

  it("survives an empty or missing description", () => {
    expect(rewriteReferences("", index).text).toBe("");
    expect(rewriteReferences(undefined, index).text).toBe("");
  });
});

describe("mentionsWithoutMarkers", () => {
  const names = new Map([["Burn", "effect:burn"], ["Riding", "ability:class-riding"]]);

  it("reports a known name in plain prose", () => {
    expect(mentionsWithoutMarkers("inflicts Burn for 3◈", names)).toEqual(["Burn"]);
  });

  it("says nothing about a name that is already inside a marker", () => {
    expect(mentionsWithoutMarkers("inflicts @effect[burn]{Burn} for 3◈", names)).toEqual([]);
  });

  it("does not match a name inside a longer word", () => {
    // "Burn" must not fire on "Mana Burst" or "sunburnt".
    expect(mentionsWithoutMarkers("Mana Burst and sunburnt", names)).toEqual([]);
  });

  it("reports each name once however often it appears", () => {
    expect(mentionsWithoutMarkers("Burn, then Burn again", names)).toEqual(["Burn"]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/references.test.mjs`
Expected: FAIL, cannot resolve `tools/lib/references.mjs`.

- [ ] **Step 3: Write the module**

Create `tools/lib/references.mjs`:

```js
/**
 * @file Cross-reference markers in content prose.
 * @see docs/37-content-pipeline.md §37.8
 *
 * Pure, and deliberately ignorant of `content.mjs`: the caller builds the
 * index, because building it needs `documentId` and the pack map and importing
 * those here would make the two modules circular.
 *
 * The markers are rewritten to Foundry's own `@UUID[...]` links AT BUILD TIME
 * rather than resolved at render time. The compendium then holds ordinary
 * content links, so they work in a chat card, a journal and an exported
 * adventure with no system code involved.
 */

/** The kinds a marker may declare. An unknown kind is not a marker at all. */
export const REFERENCE_KINDS = Object.freeze(["effect", "ability", "np", "spell", "essence", "action"]);

/**
 * `@kind[id]` or `@kind[id]{label}`.
 *
 * The kind alternation is spelled out rather than `\w+` so that `@intentional`
 * — an authoring convention already in use in content comments — and an email
 * address are not mistaken for markers.
 */
const MARKER = new RegExp(
  String.raw`@(${REFERENCE_KINDS.join("|")})\[([a-zA-Z0-9-]+)\](?:\{([^}]*)\})?`,
  "g",
);

/**
 * Every marker in a piece of prose, in the order they appear.
 *
 * @param {string} text
 * @returns {Array<{raw: string, kind: string, id: string, label: string|null, index: number}>}
 */
export function parseMarkers(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(MARKER)) {
    out.push({ raw: m[0], kind: m[1], id: m[2], label: m[3] ?? null, index: m.index });
  }
  return out;
}

/**
 * Rewrite every marker to a `@UUID[...]` link.
 *
 * An unresolvable marker is REPORTED and left in place rather than dropped: a
 * link that silently disappears is the failure this whole design exists to
 * stop, and the caller turns the problem into a build error.
 *
 * @param {string} text
 * @param {Map<string, {uuid: string, name: string}>} index keyed `kind:id`
 * @returns {{text: string, problems: string[]}}
 */
export function rewriteReferences(text, index) {
  const source = String(text ?? "");
  /** @type {string[]} */ const problems = [];

  const rewritten = source.replace(MARKER, (raw, kind, id, label) => {
    const target = index.get(`${kind}:${id}`);
    if (!target) {
      problems.push(`@${kind}[${id}] resolves to no document of that kind`);
      return raw;
    }
    return `@UUID[${target.uuid}]{${label ?? target.name}}`;
  });

  return { text: rewritten, problems };
}

/**
 * Known display names this prose mentions without linking.
 *
 * The retrofit worklist. Word-bounded on both sides so "Burn" does not fire on
 * "Mana Burst" or "sunburnt", and markers are stripped first so a name that IS
 * linked is not also reported as missing.
 *
 * @param {string} text
 * @param {Map<string, string>} names display name → `kind:id`
 * @returns {string[]} each name once, in the order the map lists them
 */
export function mentionsWithoutMarkers(text, names) {
  const stripped = String(text ?? "").replace(MARKER, " ");
  const out = [];
  for (const name of names.keys()) {
    const pattern = new RegExp(
      `(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`,
    );
    if (pattern.test(stripped)) out.push(name);
  }
  return out;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/unit/references.test.mjs`
Expected: PASS, 17 tests.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run lint && npm test
git add tools/lib/references.mjs test/unit/references.test.mjs
git commit -m "Parse and rewrite cross-reference markers in content prose"
```

---

### Task 2: The index, and rewriting at build time

**Files:**
- Modify: `tools/lib/content.mjs`
- Test: `test/unit/content.test.mjs`

**Interfaces:**
- Consumes: `rewriteReferences` and `REFERENCE_KINDS` from Task 1; `documentId` and `PACKS`, both already in `content.mjs`.
- Produces: `referenceIndex(files): Map<"kind:id", {uuid, name}>` and `referenceNames(files): Map<displayName, "kind:id">`, both exported from `content.mjs`. `compileDocument(doc, dir, library, assets, index)` gains a fifth parameter and rewrites `system.description`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/content.test.mjs`:

```js
describe("cross-reference index (§37.3)", () => {
  const files = [
    { path: "burn.yml", dir: "effects", doc: { schema: 1, id: "burn", name: "Burn" } },
    { path: "riding.yml", dir: "class-skills", doc: { schema: 1, id: "class-riding", name: "Riding" } },
    { path: "bell.yml", dir: "abilities", doc: { schema: 1, id: "medusa-bellerophon", name: "Bellerophon", isNP: true } },
    { path: "medusa.yml", dir: "servants", doc: { schema: 1, id: "medusa", name: "Medusa", abilities: [{ ref: "medusa-bellerophon" }] } },
  ];

  it("addresses a standalone document through its own pack", () => {
    const index = referenceIndex(files);
    expect(index.get("effect:burn").uuid)
      .toBe(`Compendium.fgt.effects.Item.${documentId("burn")}`);
    expect(index.get("effect:burn").name).toBe("Burn");
  });

  it("addresses a Servant's own ability THROUGH the Servant", () => {
    // An embedded document has a resolvable UUID, so nothing has to be shipped
    // standalone for a Servant's own skills to be linkable (DX.5).
    const index = referenceIndex(files);
    expect(index.get("np:medusa-bellerophon").uuid).toBe(
      `Compendium.fgt.servants.Actor.${documentId("medusa")}`
      + `.Item.${documentId("medusa/medusa-bellerophon")}`,
    );
  });

  it("separates an NP from an ability, so a mistyped marker fails", () => {
    const index = referenceIndex(files);
    expect(index.has("np:medusa-bellerophon")).toBe(true);
    expect(index.has("ability:medusa-bellerophon")).toBe(false);
    expect(index.has("ability:class-riding")).toBe(true);
    expect(index.has("np:class-riding")).toBe(false);
  });

  it("indexes display names for the retrofit warning", () => {
    expect(referenceNames(files).get("Burn")).toBe("effect:burn");
  });
});

describe("compileDocument rewrites markers", () => {
  const library = new Map();
  const index = new Map([
    ["effect:burn", { uuid: "Compendium.fgt.effects.Item.zzzz", name: "Burn" }],
  ]);

  it("turns a marker into a real content link", () => {
    const doc = { schema: 1, id: "x", name: "X", description: "inflicts @effect[burn] now" };
    const out = compileDocument(doc, "abilities", library, new Map(), index);
    expect(out.system.description).toBe("inflicts @UUID[Compendium.fgt.effects.Item.zzzz]{Burn} now");
  });

  it("leaves a description with no markers exactly as authored", () => {
    const doc = { schema: 1, id: "x", name: "X", description: "plain prose" };
    expect(compileDocument(doc, "abilities", library, new Map(), index).system.description)
      .toBe("plain prose");
  });

  it("compiles without an index at all, for callers that do not have one", () => {
    const doc = { schema: 1, id: "x", name: "X", description: "@effect[burn]" };
    expect(compileDocument(doc, "abilities", library).system.description).toBe("@effect[burn]");
  });
});
```

Extend the import at the top of the file:

```js
import {
  validateAll, resolveRef, substitute, documentId, ruleElements, compileDocument,
  indexAssets, unitImages, ASSET_ROOT, referenceIndex, referenceNames,
} from "../../tools/lib/content.mjs";
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/content.test.mjs -t "cross-reference index"`
Expected: FAIL, `referenceIndex is not a function`.

- [ ] **Step 3: Build the index**

In `tools/lib/content.mjs`, add the import at the top beside the others:

```js
import { rewriteReferences } from "./references.mjs";
```

and add these two functions after `documentId`:

```js
/* -------------------------------------------------------------------------- */
/*  Cross-references                                                           */
/* -------------------------------------------------------------------------- */

/** Which source directory answers which marker kind. */
const KIND_OF_DIR = Object.freeze({
  effects: "effect",
  "class-skills": "ability",
  abilities: "ability",
  "command-spells": "spell",
  "master-essences": "essence",
  rules: "action",
});

/**
 * Every linkable document, keyed `kind:id`, with the UUID a link needs.
 *
 * A Servant's own ability is addressed THROUGH the Servant, at the embedded id
 * `compileEmbeddedAbility` already derives. That is why nothing has to be
 * shipped standalone for a Servant's skills to be linkable (DX.5): an embedded
 * document has a perfectly good UUID.
 *
 * @param {Array<{path: string, dir: string, doc: object}>} files
 * @returns {Map<string, {uuid: string, name: string}>}
 */
export function referenceIndex(files) {
  /** @type {Map<string, string>} abilityId → owning Servant contentId */
  const owners = new Map();
  for (const { dir, doc } of files) {
    if (PACKS[dir]?.documentType !== "Actor" || !doc?.id) continue;
    for (const entry of doc.abilities ?? []) {
      const id = entry?.ref ?? entry?.id;
      if (id) owners.set(id, doc.id);
    }
  }

  /** @type {Map<string, {uuid: string, name: string}>} */
  const index = new Map();
  for (const { dir, doc } of files) {
    const kind = KIND_OF_DIR[dir];
    if (!kind || !doc?.id || !doc?.name) continue;
    const resolved = kind === "ability" && doc.isNP ? "np" : kind;

    const owner = owners.get(doc.id);
    const spec = PACKS[dir];
    const uuid = owner
      ? `Compendium.fgt.servants.Actor.${documentId(owner)}.Item.${documentId(`${owner}/${doc.id}`)}`
      : `Compendium.fgt.${spec.pack}.${spec.documentType}.${documentId(doc.id)}`;

    index.set(`${resolved}:${doc.id}`, { uuid, name: doc.name });
  }
  return index;
}

/**
 * Display name → `kind:id`, for the warning that lists unmarked mentions.
 *
 * A name shared by two documents is dropped: six are (Monstrous Strength,
 * Indomitable, Item Construction, Territory Creation, Presence Concealment,
 * Riding), and warning about a name that could mean either would send an
 * author to guess, which is exactly what explicit markers exist to avoid.
 *
 * @param {Array<{path: string, dir: string, doc: object}>} files
 * @returns {Map<string, string>}
 */
export function referenceNames(files) {
  /** @type {Map<string, string|null>} */ const seen = new Map();
  for (const [key, entry] of referenceIndex(files)) {
    if (entry.name.length < 4) continue;
    seen.set(entry.name, seen.has(entry.name) ? null : key);
  }
  return new Map([...seen].filter(([, key]) => key !== null));
}
```

- [ ] **Step 4: Rewrite descriptions in `compileDocument`**

Change the signature and the two `system:` sites. Find:

```js
export function compileDocument(doc, dir, library, assets = new Map()) {
```

and replace with:

```js
export function compileDocument(doc, dir, library, assets = new Map(), references = null) {
```

Then, immediately after the `const spec = PACKS[dir];` guard, add:

```js
  // Markers become real content links here rather than at render time, so the
  // compendium holds ordinary Foundry links that work in chat, journals and
  // exported adventures with no system code involved (§37.3).
  const linked = references
    ? { ...doc, description: rewriteReferences(doc.description, references).text }
    : doc;
```

and replace every remaining use of `doc` inside the function body **after that point** with `linked`, except `doc.id` in `documentId(doc.id)` and `documentId(`${doc.id}`)` calls, which are unaffected either way. The two that matter are `system: actorSystem(doc)` → `actorSystem(linked)` and `system: itemSystem(doc)` → `itemSystem(linked)`.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run test/unit/content.test.mjs`
Expected: PASS, all cases including the seven new ones.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run lint && npm test
git add tools/lib/content.mjs test/unit/content.test.mjs
git commit -m "Address every linkable document, and rewrite markers at build time"
```

---

### Task 3: Errors and the retrofit warning

**Files:**
- Modify: `tools/lib/content.mjs` (`validateAll`, and a new `validateReferences`)
- Modify: `tools/validate-content.mjs`, `tools/build-packs.mjs`
- Test: `test/unit/content.test.mjs`

**Interfaces:**
- Consumes: `referenceIndex`, `referenceNames` from Task 2; `parseMarkers`, `mentionsWithoutMarkers` from Task 1.
- Produces: `validateAll(files, assets)` gains reference errors and mention warnings. No signature change.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/content.test.mjs`:

```js
describe("cross-reference validation (§37.4)", () => {
  const corpus = (extra) => [
    { path: "burn.yml", dir: "effects", doc: { schema: 1, id: "burn", name: "Burn" } },
    { path: "riding.yml", dir: "class-skills", doc: { schema: 1, id: "class-riding", name: "Riding" } },
    extra,
  ];
  const problemsFor = (extra) => validateAll(corpus(extra)).problems;
  const warningsOf = (extra) => validateAll(corpus(extra)).warnings;

  it("refuses a marker that resolves to nothing", () => {
    const p = problemsFor({ path: "x.yml", dir: "abilities", doc: { schema: 1, id: "x", name: "X", description: "@effect[nope]" } });
    expect(p.some((m) => /@effect\[nope\] resolves to no document/.test(m))).toBe(true);
  });

  it("refuses a marker whose kind disagrees with its target", () => {
    // `burn` is an effect, not an ability. The link would 404 in play.
    const p = problemsFor({ path: "x.yml", dir: "abilities", doc: { schema: 1, id: "x", name: "X", description: "@ability[burn]" } });
    expect(p.some((m) => /@ability\[burn\]/.test(m))).toBe(true);
  });

  it("accepts a marker that resolves", () => {
    const p = problemsFor({ path: "x.yml", dir: "abilities", doc: { schema: 1, id: "x", name: "X", description: "@effect[burn]" } });
    expect(p).toEqual([]);
  });

  it("warns about a known name mentioned without a marker", () => {
    const w = warningsOf({ path: "x.yml", dir: "abilities", doc: { schema: 1, id: "x", name: "X", description: "inflicts Burn now" } });
    expect(w.some((m) => /mentions "Burn" without linking it/.test(m))).toBe(true);
  });

  it("says nothing when the name IS linked", () => {
    const w = warningsOf({ path: "x.yml", dir: "abilities", doc: { schema: 1, id: "x", name: "X", description: "inflicts @effect[burn]{Burn} now" } });
    expect(w.some((m) => /without linking it/.test(m))).toBe(false);
  });

  it("does not warn about a document mentioning its own name", () => {
    // Every description is free to say what it is called.
    const w = warningsOf({ path: "r.yml", dir: "class-skills", doc: { schema: 1, id: "class-riding", name: "Riding", description: "Riding lets it move twice." } });
    expect(w.some((m) => /without linking it/.test(m))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/content.test.mjs -t "cross-reference validation"`
Expected: FAIL, no problem is reported for an unresolvable marker.

- [ ] **Step 3: Implement the checks**

In `tools/lib/content.mjs`, extend the import:

```js
import { rewriteReferences, parseMarkers, mentionsWithoutMarkers } from "./references.mjs";
```

Inside `validateAll`, after the `if (assets) validateImages(...)` line, add:

```js
  // -- Cross-references -----------------------------------------------------
  validateReferences(files, problems, warnings);
```

and add the function beside `validateImages`:

```js
/**
 * Every marker resolves, and every unmarked mention is listed.
 *
 * The error half is the point of explicit markers: a typo is a link that would
 * 404 in play, and the build is the only place that can still catch it. The
 * warning half is the retrofit worklist — 106 of the 226 files mention a
 * linkable name in prose — and it also stops a NEW description quietly
 * shipping without its links.
 *
 * @param {Array<{path: string, dir: string, doc: object}>} files
 * @param {string[]} problems
 * @param {string[]} warnings
 */
function validateReferences(files, problems, warnings) {
  const index = referenceIndex(files);
  const names = referenceNames(files);

  for (const { path, doc } of files) {
    const text = doc?.description;
    if (!text) continue;

    for (const marker of parseMarkers(text)) {
      if (index.has(`${marker.kind}:${marker.id}`)) continue;
      problems.push(
        `${path}: ${marker.raw} resolves to no document of that kind — `
        + `check the id, or the marker's kind`,
      );
    }

    for (const name of mentionsWithoutMarkers(text, names)) {
      // A document naming itself is not a missing link.
      if (name === doc.name) continue;
      warnings.push(
        `${path}: description mentions "${name}" without linking it — `
        + `write @${names.get(name).replace(":", "[")}], or leave it if the mention is incidental`,
      );
    }
  }
}
```

- [ ] **Step 4: Pass the index to the compiler**

In `tools/build-packs.mjs`, after the validation block, build the index once and hand it to every document:

```js
const references = referenceIndex(files);
```

and change the compile call:

```js
  byPack.get(spec.pack).push(compileDocument(doc, dir, library, assets, references));
```

Extend that file's import to include `referenceIndex`.

- [ ] **Step 5: Run the tests and the validator**

Run: `npx vitest run test/unit/content.test.mjs -t "cross-reference validation"`
Expected: PASS, 6 tests.

Run: `npm run validate:content`
Expected: 0 errors, and a new batch of warnings naming files that mention a linkable name. Record the count; Task 6 works through it.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run lint && npm test
git add tools/lib/content.mjs tools/build-packs.mjs test/unit/content.test.mjs
git commit -m "Fail the build on a broken reference, and list every unmarked mention"
```

---

### Task 4: The rules journal

**Files:**
- Create: `packs/_source/rules/` with eight files
- Modify: `tools/lib/content.mjs` (`PACKS`, `compileDocument`)
- Test: `test/unit/content.test.mjs`

**Interfaces:**
- Consumes: `KIND_OF_DIR` from Task 2, which already maps `rules` to `action`.
- Produces: `PACKS.rules = { pack: "rules", documentType: "JournalEntry" }`, and `compileDocument` returns a JournalEntry with one page for that directory.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/content.test.mjs`:

```js
describe("the rules journal", () => {
  const doc = {
    schema: 1, id: "mark", name: "Mark", kind: "action",
    description: "Places a Bloodmark on this Unit's panel.",
  };

  it("compiles a JournalEntry with one page", () => {
    const out = compileDocument(doc, "rules", new Map());
    expect(out.type).toBeUndefined();
    expect(out._key).toBe(`!journal!${documentId("mark")}`);
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0].text.content).toBe("Places a Bloodmark on this Unit's panel.");
  });

  it("keys the page so the pack compiler accepts it", () => {
    // An embedded document with no `_key` is dropped by `compilePack` without
    // a word, which is how a journal ships with no pages in it.
    const out = compileDocument(doc, "rules", new Map());
    expect(out.pages[0]._key).toBe(`!journal.pages!${out._id}.${out.pages[0]._id}`);
  });

  it("is addressable as an action", () => {
    const index = referenceIndex([{ path: "mark.yml", dir: "rules", doc }]);
    expect(index.get("action:mark").uuid)
      .toBe(`Compendium.fgt.rules.JournalEntry.${documentId("mark")}`);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/content.test.mjs -t "rules journal"`
Expected: FAIL, `No pack mapping for source directory "rules"`.

- [ ] **Step 3: Map the directory and compile the entry**

In `PACKS`, add:

```js
  // The `fgt.rules` pack has been declared in `system.json` since 0.1.0 and
  // nothing has ever populated it. Actions are rules rather than documents, so
  // `@action[mark]` needs somewhere real to land.
  rules: { pack: "rules", documentType: "JournalEntry" },
```

In `compileDocument`, before the `if (spec.documentType === "Actor")` branch, add:

```js
  if (spec.documentType === "JournalEntry") {
    const pageId = documentId(`${linked.id}/page`);
    return {
      _id: base._id,
      name: linked.name,
      pages: [{
        _id: pageId,
        name: linked.name,
        type: "text",
        title: { show: false, level: 1 },
        text: { content: linked.description ?? "", format: 1 },
        // An embedded document with no `_key` is dropped by `compilePack`
        // silently, which ships a journal with no pages in it.
        _key: `!journal.pages!${base._id}.${pageId}`,
      }],
      _key: `!journal!${base._id}`,
    };
  }
```

- [ ] **Step 4: Write the eight action pages**

Create one file per action kind in `packs/_source/rules/`. `mark.yml`:

```yaml
# The Mark Action (Ch. 43 §43.4). Linked from Blood Fort Andromeda, and from
# anything else built by marking.
schema: 1
id: mark
name: "Mark"
kind: action
description: |
  Places a Bloodmark on the panel this Unit is standing on, and counts as its Attack for the
  Turn. Bloodmarks may be placed on any panel, even within an enemy Home Base.
```

`gather.yml`:

```yaml
# The Gather Action (Ch. 32). Any allied Unit may perform it, which is why it
# appears on a bar because of who ELSE is on the board.
schema: 1
id: gather
name: "Gather"
kind: action
description: |
  Increases the Hanging Gardens' Construction by 3. Semiramis herself increases it by 5, and her
  Master by 4. Using Gather counts as the Unit's Move for that Turn, and a Unit cannot Attack on
  the same Turn it uses Gather.
```

`riding-attack.yml`:

```yaml
# Riding Attack (Ch. 03). Granted by Riding, permanently for some Servants and
# by the Active for others.
schema: 1
id: riding-attack
name: "Riding Attack"
kind: action
description: |
  Attack every Unit in the path while Moving in a straight line, as a Normal Attack, during this
  Unit's Turn. It cannot Attack or Move after it has stopped. If the Unit has already Moved this
  Turn, the panels it may Move for its Riding Attack equal its MOV minus the panels already Moved.
```

`move.yml`:

```yaml
schema: 1
id: move
name: "Move"
kind: action
description: |
  Move up to this Unit's MOV in panels. A faction's Servant and Master Moves are drawn from
  separate pools, and both are spent from the faction's budget for the Turn.
```

`attack.yml`:

```yaml
schema: 1
id: attack
name: "Attack"
kind: action
description: |
  Perform a Normal Attack against a target in range. A faction may make a limited number of
  Servant Attacks each Turn, and several other Actions — Mark among them — count as a Unit's
  Attack for the Turn.
```

`skill.yml`:

```yaml
schema: 1
id: skill
name: "Skill"
kind: action
description: |
  Use an active Skill. A Skill is not an Attack unless the Skill says so, and using one does not
  by itself spend the Unit's Attack for the Turn.
```

`np.yml`:

```yaml
schema: 1
id: np
name: "Noble Phantasm"
kind: action
description: |
  Use a Noble Phantasm. Every Noble Phantasm costs the Servant's Attack for the Turn, including
  the ones that deal no damage, and most require the Servant to be within its Master's ZON.
```

`spell.yml`:

```yaml
schema: 1
id: spell
name: "Spell"
kind: action
description: |
  Cast a Spell. A Spell is an Attack-shaped Action unless the Spell declares otherwise, and it is
  billed to the same pool a Servant's Attack is.
```

- [ ] **Step 5: Verify the pack builds**

Run: `npx vitest run test/unit/content.test.mjs -t "rules journal"`
Expected: PASS, 3 tests.

Run: `npm run validate:content && npm run build:packs`
Expected: 0 errors, and a line reading `packed   rules   8 document(s)`.

- [ ] **Step 6: Commit**

```bash
git add packs/_source/rules tools/lib/content.mjs test/unit/content.test.mjs
git commit -m "Fill the rules pack that has been declared and empty since 0.1.0"
```

---

### Task 5: Enrich descriptions at render time

**Files:**
- Create: `module/apps/enrich.mjs`
- Modify: `module/apps/actor-sheet/sheet.mjs`, `module/apps/index.mjs`
- Test: `test/unit/enrich.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks; the compendium now holds `@UUID` links.
- Produces: `enrichText(text): Promise<string>` and `enrichAbilityCards(cards): Promise<void>`, both from `module/apps/enrich.mjs`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/enrich.test.mjs`:

```js
/**
 * @file Enriching description prose.
 * @see module/apps/enrich.mjs, docs/29-user-interface.md §29.2
 *
 * Nothing in this system called `enrichHTML` before this, so a `@UUID` link in
 * a description rendered as literal text. The functions here are the one place
 * that calls it, and they are separated from the sheets so the "which fields"
 * decision is testable without Foundry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichText, enrichAbilityCards } from "../../module/apps/enrich.mjs";

beforeEach(() => {
  globalThis.foundry = {
    applications: { ux: { TextEditor: { implementation: {
      enrichHTML: vi.fn(async (text) => `<enriched>${text}</enriched>`),
    } } } },
  };
});

describe("enrichText", () => {
  it("passes the text through Foundry's enricher", async () => {
    expect(await enrichText("inflicts @UUID[x]{Burn}")).toBe("<enriched>inflicts @UUID[x]{Burn}</enriched>");
  });

  it("returns an empty string for nothing, rather than calling out", async () => {
    expect(await enrichText("")).toBe("");
    expect(await enrichText(null)).toBe("");
    expect(foundry.applications.ux.TextEditor.implementation.enrichHTML).not.toHaveBeenCalled();
  });

  it("leaves rolls alone", async () => {
    // This system resolves its dice through the engine. An inline [[/r]] in a
    // description would open a second path to a roll.
    await enrichText("text");
    const [, options] = foundry.applications.ux.TextEditor.implementation.enrichHTML.mock.calls[0];
    expect(options).toMatchObject({ rolls: false, documents: true, links: true });
  });
});

describe("enrichAbilityCards", () => {
  it("enriches every card in every group, in place", async () => {
    const cards = {
      classSkills: [{ description: "a" }],
      skills: [{ description: "b" }, { description: "c" }],
      noblePhantasms: [{ description: "d" }],
      anyAbilities: true,
    };
    await enrichAbilityCards(cards);
    expect(cards.skills.map((c) => c.description)).toEqual(["<enriched>b</enriched>", "<enriched>c</enriched>"]);
    expect(cards.noblePhantasms[0].description).toBe("<enriched>d</enriched>");
  });

  it("ignores the non-array members of the group object", async () => {
    // `anyAbilities` is a boolean and iterating it would throw.
    const cards = { classSkills: [], skills: [], noblePhantasms: [], anyAbilities: false };
    await expect(enrichAbilityCards(cards)).resolves.toBeUndefined();
  });

  it("survives being handed nothing", async () => {
    await expect(enrichAbilityCards(null)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/enrich.test.mjs`
Expected: FAIL, cannot resolve `module/apps/enrich.mjs`.

- [ ] **Step 3: Write the module**

Create `module/apps/enrich.mjs`:

```js
/**
 * @file Turning authored prose into rendered prose.
 * @see docs/29-user-interface.md §29.2, docs/37-content-pipeline.md §37.8
 *
 * Layer 4. The ONE place this system calls `enrichHTML`, which until now it
 * never did anywhere — so a `@UUID` link written into a description rendered
 * as literal text, and no rules term in the game was clickable.
 *
 * Separated from the sheets because "which fields get enriched" is a decision
 * worth testing, and because `enrichHTML` is async while Handlebars is not:
 * enrichment has to happen in `_prepareContext`, never in a helper.
 */

/**
 * Enrich one piece of prose.
 *
 * `rolls: false` is deliberate. This system resolves every die through the
 * engine, and an inline `[[/r]]` in a description would open a second path to
 * a roll that no rule agrees with.
 *
 * @param {string|null|undefined} text
 * @returns {Promise<string>}
 */
export async function enrichText(text) {
  if (!text) return "";
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(String(text), {
    documents: true,
    links: true,
    rolls: false,
  });
}

/**
 * Enrich every ability card's description, in place.
 *
 * Takes the whole group object `abilitiesContext` returns rather than one
 * array, so a new group added there is covered without a second edit here.
 * Non-array members are skipped: `anyAbilities` is a boolean.
 *
 * @param {object|null} groups
 * @returns {Promise<void>}
 */
export async function enrichAbilityCards(groups) {
  if (!groups) return;
  for (const group of Object.values(groups)) {
    if (!Array.isArray(group)) continue;
    for (const card of group) card.description = await enrichText(card.description);
  }
}
```

- [ ] **Step 4: Call it from the two sheets**

In `module/apps/actor-sheet/sheet.mjs`, change `_prepareContext`:

```js
  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const built = { ...context, ...buildContext(this.document, this) };
    // `enrichHTML` is async and Handlebars is not, so this is the only place
    // it can happen. Without it a `@UUID` link renders as literal text.
    await enrichAbilityCards(built.abilityCards);
    return built;
  }
```

with the import beside the others in that file:

```js
import { enrichAbilityCards } from "../enrich.mjs";
```

In `module/apps/index.mjs`, in the item sheet's `_prepareContext`, after the context is built:

```js
    context.enrichedDescription = await enrichText(this.document.system?.description);
```

with `import { enrichText } from "./enrich.mjs";` at the top.

- [ ] **Step 5: Render the enriched text**

In `templates/item/ability.hbs`, change:

```handlebars
  <section class="fgt-sheet__description">{{{system.description}}}</section>
```

to:

```handlebars
  {{!-- Enriched in `_prepareContext`, so `@UUID` links are real anchors. The
        raw field would print them as literal text. --}}
  <section class="fgt-sheet__description">{{{enrichedDescription}}}</section>
```

`templates/actor/ability-card.hbs` needs no change: `enrichAbilityCards` rewrites `description` in place, and the template already prints it with a triple-stache.

- [ ] **Step 6: Run the gate**

Run: `npx vitest run test/unit/enrich.test.mjs`
Expected: PASS, 6 tests.

Run: `npm run lint && npm test && npm run check:templates`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add module/apps/enrich.mjs module/apps/actor-sheet/sheet.mjs module/apps/index.mjs templates/item/ability.hbs test/unit/enrich.test.mjs
git commit -m "Call enrichHTML, which this system has never done"
```

---

### Task 6: The retrofit

**Files:**
- Modify: every file the warning names, one commit per source directory
- Create: `tools/propose-references.mjs` (a one-off, deleted at the end of the task)

**Interfaces:**
- Consumes: `referenceNames` from Task 2.

- [ ] **Step 1: Write the proposal script**

Create `tools/propose-references.mjs`:

```js
#!/usr/bin/env node
/**
 * @file One-off: propose a marker for every unmarked mention.
 *
 * Writes nothing. It prints a unified list of the substitutions it would make,
 * so the retrofit is reviewed as a proposal before it is a diff. Deleted once
 * the retrofit lands; `validateReferences`'s warning is the permanent tool.
 */
import { loadSource } from "./lib/load.mjs";
import { referenceNames } from "./lib/content.mjs";
import { mentionsWithoutMarkers } from "./lib/references.mjs";

const { files } = await loadSource("packs/_source");
const names = referenceNames(files);

let total = 0;
for (const { path, doc } of files) {
  const found = mentionsWithoutMarkers(doc?.description, names).filter((n) => n !== doc.name);
  if (found.length === 0) continue;
  console.log(`\n${path}`);
  for (const name of found) {
    const [kind, id] = names.get(name).split(":");
    console.log(`  "${name}"  →  @${kind}[${id}]{${name}}`);
    total += 1;
  }
}
console.log(`\n${total} proposed substitution(s).`);
```

- [ ] **Step 2: Read the proposal**

Run: `node tools/propose-references.mjs | tee /tmp/fgt-references.txt`
Expected: a per-file list. The spec measured 321 mentions across 106 files; expect the same order of magnitude.

- [ ] **Step 3: Apply, one source directory at a time**

For each directory in `effects`, `class-skills`, `abilities`, `command-spells`, apply the proposed substitutions to the `description` fields only, never to comments and never to any other field. Replace the **first** occurrence of each name per description; later repetitions read better as plain text.

After each directory:

```bash
npm run validate:content
git add packs/_source/<dir>
git commit -m "Link the rules terms <dir> descriptions already name"
```

- [ ] **Step 4: Decide the ambiguous ones**

Six display names belong to more than one document: Monstrous Strength, Indomitable, Item Construction, Territory Creation, Presence Concealment, Riding. `referenceNames` drops them, so the script proposes nothing for them and the warning stays silent. Mark each by hand with the id its own Servant uses, then confirm:

```bash
npm run validate:content
```

- [ ] **Step 5: Delete the one-off and commit**

```bash
git rm tools/propose-references.mjs
npm run lint && npm test && npm run validate:content && npm run build:packs
git commit -m "Retire the one-off proposal script; the validator warning is the permanent tool"
```

---

### Task 7: Documentation

**Files:**
- Modify: `docs/37-content-pipeline.md`, `docs/29-user-interface.md`, `docs/45-implementation-status.md`, `CHANGELOG.md`

- [ ] **Step 1: §37.8 gains the syntax**

Add the marker table to the content conventions, with the rule that a label is for inflection and never for pointing somewhere else.

- [ ] **Step 2: §37.4 gains the checks**

Two errors (an unresolvable marker, a marker whose kind disagrees with its target) and one warning (a known name mentioned without a marker), with the note that the warning is what stops a new description shipping without its links.

- [ ] **Step 3: §37.3 gains the step, §37.11 gains the decisions**

Reference resolution sits between `ref:` resolution and id assignment. Add DX.1 through DX.8.

- [ ] **Step 4: Ch. 29 and Ch. 45**

Ch. 29: descriptions are enriched in `_prepareContext`, and why it cannot be a helper. Ch. 45: this system had never called `enrichHTML`; the `rules` pack was declared and empty since `0.1.0`; `master-essences` still is, with `docs/Master Essences.md` as the source it will be built from.

- [ ] **Step 5: CHANGELOG under `Added`, then commit**

```bash
git add docs CHANGELOG.md
git commit -m "Document cross-references and the rules pack they fill"
```

---

## Self-Review

**Spec coverage.** DX.1 Task 1. DX.2 Tasks 1 and 3. DX.3 Task 2. DX.4 Task 1. DX.5 Task 2's embedded-address test. DX.6 Task 4. DX.7 Task 3. DX.8 Task 5. Spec §4's vocabulary is Task 1's `REFERENCE_KINDS`; §5's addresses are Task 2's `referenceIndex`; §6 is Task 4; §7 is Task 2 step 4 plus Task 3 step 4; §8 is Task 3; §9 is Task 5; §10 is Task 6; §11's tests are spread through; §12 is Task 7.

**One spec item corrected while planning.** §9 lists a chat card as a call site for enrichment. No chat template renders a description — `grep description templates/chat/*.hbs` returns nothing — so Task 5 has two call sites, not three. The spec's table overstated by one.

**One item deliberately not planned.** `@essence` has no targets until the 35 essences in `docs/Master Essences.md` are authored. The marker is defined in Task 1 and the validator will reject a stray one, which is the whole of what this plan owes it.

**Type consistency.** `parseMarkers` returns `{raw, kind, id, label, index}` in Task 1 and is destructured with those names in Task 3. `rewriteReferences(text, index)` returns `{text, problems}` in Task 1 and is consumed that way in Tasks 2 and 3. `referenceIndex(files)` returns `Map<"kind:id", {uuid, name}>` in Task 2 and is read with `.get(...).uuid` and `.name` in Tasks 1, 3 and 4. `referenceNames(files)` returns `Map<name, "kind:id">` in Task 2 and is split on `":"` in Tasks 3 and 6. `enrichText`/`enrichAbilityCards` are produced in Task 5 and used only there.

**Known risk.** Task 2 step 4 asks the implementer to switch `doc` for `linked` inside `compileDocument`. That function is long and the substitution is mechanical but not blind: `documentId(doc.id)` must keep reading `doc`. The test in Task 2 step 1 that compiles with no index at all is the guard against getting it wrong in the harmless direction; `npm test` catches the harmful one, because every existing `compileDocument` case would break.
