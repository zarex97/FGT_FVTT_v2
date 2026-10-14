/**
 * @file One door for every Effect: Landing is the only caller of `applyEffect`.
 * @see module/engine/landing.mjs, module/rules/effect-flow.mjs#ENTRY_KEYS, docs/15-effect-application.md
 *
 * Eight paths each assembled `applyEffect`'s arguments themselves, and each
 * read a different subset of what content authors: about thirteen Surprises
 * were the same entry meaning two things on two paths. These guards keep it to
 * one door, keep the door reading the one list of keys, and keep content
 * writing only keys on that list.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { ENTRY_KEYS, entryOf } from "../../module/rules/effect-flow.mjs";

/** Every file under `dir` ending in `ext`, with `/` separators on any checkout. */
function files(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, ext);
    return path.endsWith(ext) ? [path.replace(/\\/g, "/")] : [];
  });
}

/** Code only: comments stripped, CRLF or not. */
function code(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
}

/** The body of one top-level function, from its declaration to the next. */
function body(source, name) {
  const start = source.indexOf(`function ${name}(`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("Landing is the one door", () => {
  it("is the only caller of applyEffect", () => {
    const callers = files("module", ".mjs")
      .filter((f) => f !== "module/engine/effect-applier.mjs")
      .filter((f) => /(?<![.\w])applyEffect\(/.test(code(f)));
    expect(callers).toEqual(["module/engine/landing.mjs"]);
  });

  it("reads every key ENTRY_KEYS lists, and no other", () => {
    // What the door reads off an entry, itself or through the three pure
    // helpers it hands the entry to.
    const flow = code("module/rules/effect-flow.mjs");
    const sources = [
      code("module/engine/landing.mjs"),
      body(flow, "chanceOf"),
      body(flow, "applicationsOf"),
      body(flow, "effectGatePasses"),
    ];
    const read = new Set(sources.flatMap((s) => [...s.matchAll(/\b(?:entry|spec)\??\.(\w+)/g)].map((m) => m[1])));
    expect([...read].sort()).toEqual(Object.keys(ENTRY_KEYS).sort());
  });
});

/**
 * Every Effect Entry content writes: an `applyEffects` phase's, a check's
 * outcomes', an aftermath's, and the inner effect of a handler's
 * `ApplyEffect` action.
 */
function entriesIn(node, out = { entries: [], actions: [] }) {
  if (Array.isArray(node)) {
    node.forEach((n) => entriesIn(n, out));
    return out;
  }
  if (!node || typeof node !== "object") return out;
  if ((node.kind === "applyEffects" || node.kind === "applyEffect") && (node.rules || node.effects)) {
    out.entries.push(...(node.rules ?? node.effects));
  }
  for (const branch of [node.onSuccess, node.onFail]) out.entries.push(...(branch?.effects ?? []));
  if (node.aftermath?.effects) out.entries.push(...node.aftermath.effects);
  if (node.key === "ApplyEffect" && node.effect && typeof node.effect === "object") out.actions.push(node.effect);
  for (const value of Object.values(node)) entriesIn(value, out);
  return out;
}

describe("content writes only keys an entry has", () => {
  const corpus = files("packs/_source", ".yml").map((f) => ({ f, doc: parse(readFileSync(f, "utf8")) }));
  const known = new Set(Object.keys(ENTRY_KEYS));

  it("in every entry of every phase, check and aftermath", () => {
    const strays = [];
    for (const { f, doc } of corpus) {
      for (const raw of entriesIn(doc).entries) {
        if (!entryOf(raw)) continue;
        const inner = raw.effect && typeof raw.effect === "object" ? raw.effect : raw;
        // The older wrapper, `{key: OnEvent, event, effect: {...}}`: its two
        // keys name the shape and no rider path reads them.
        const beside = inner === raw ? [] : Object.keys(raw).filter((k) => !["effect", "key", "event"].includes(k));
        for (const k of [...Object.keys(inner), ...beside]) {
          if (!known.has(k)) strays.push(`${f}: ${k}`);
        }
      }
    }
    expect(strays).toEqual([]);
  });

  it("in the effect of every handler's ApplyEffect action", () => {
    // `defId` is the id's other spelling, and `stage` a handler's word for
    // `stages` (`entryOf`).
    const strays = [];
    for (const { f, doc } of corpus) {
      for (const effect of entriesIn(doc).actions) {
        for (const k of Object.keys(effect)) {
          if (!known.has(k) && k !== "defId" && k !== "stage") strays.push(`${f}: ${k}`);
        }
      }
    }
    expect(strays).toEqual([]);
  });
});

describe("the editor offers what the door reads", () => {
  it("draws an applyEffects entry's fields from ENTRY_KEYS", async () => {
    const { PHASE_DESCRIPTORS } = await import("../../module/rules/authoring/phases.mjs");
    const effects = PHASE_DESCRIPTORS.applyEffects.fields.find((f) => f.key === "effects");
    expect(effects.of.map((f) => f.key)).toEqual(Object.keys(ENTRY_KEYS));
    // Every control is one the editor can draw.
    const { FIELD_TYPES } = await import("../../module/rules/authoring/fields.mjs");
    expect(effects.of.filter((f) => !FIELD_TYPES.includes(f.type))).toEqual([]);
  });

  it("stores what each control gives as the entry's own value", async () => {
    // `editor.mjs` imports Foundry's application classes, so the pure
    // conversion is read out of its source and run here.
    const source = readFileSync("module/apps/ability-editor/editor.mjs", "utf8").replace(/\r\n/g, "\n");
    const start = source.indexOf("export function entryValue(");
    const end = source.indexOf("\n}\n", source.indexOf("function numberOrRaw(")) + 2;
    const { coerceFieldValue } = await import("../../module/rules/authoring/fields.mjs");
    const entryValue = new Function("coerceFieldValue",
      `${source.slice(start, end).replace("export function", "function")}; return entryValue;`)(coerceFieldValue);
    expect(entryValue("number", "50")).toBe(50);
    expect(entryValue("text", "@self.tokens")).toBe("@self.tokens");
    expect(entryValue("text", "30")).toBe(30);
    expect(entryValue("checkbox", true)).toBe(true);
    expect(entryValue("checkbox", false)).toBeUndefined();
    expect(entryValue("tokenList", "magicResistance, itemConstruction")).toEqual(["magicResistance", "itemConstruction"]);
    expect(entryValue("raw", "[{\"chance\": 100}]")).toEqual([{ chance: 100 }]);
    expect(entryValue("tickExpr", "")).toBeUndefined();
  });
});
