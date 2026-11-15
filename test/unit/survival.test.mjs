/**
 * @file Every Authored Key on a Unit, an Ability or an Effect survives its Route.
 * @see docs/07-schemas.md (the map of Hops), docs/44-testing.md, CONTEXT.md
 *
 * A Silent Drop is a Hop discarding a key it does not name. The build's model
 * check holds the compile to the DataModel; this holds the DataModel to what the
 * rules read. The REAL corpus is compiled, each Unit is built through the real
 * DataModel in the test world, prepared, and projected by the real
 * `snapshotUnit`; each Effect is loaded into the real `EffectRegistry`.
 *
 * Every Authored Key must then have a ROUTE, named below, and the route is
 * checked:
 *
 * - `at` — the key is projected. Its prepared value must be what the projection
 *   holds there, through the named transform. This is the Hop that lost
 *   `requiresHistory`, `unremovable`, `actsOncePerTurn` and `npRegen`: declared,
 *   compiled, stored, and never projected.
 * - `reader` — the key is read from the document, not projected. The named file
 *   must still read it, so a reader that goes away takes the key's route with it.
 *
 * A key with no route fails, naming the file and the last Hop it was seen at.
 * A value that carries no Clause — `null`, `false`, `""`, `[]`, `{}` — is not
 * checked against a projection, because a default cannot be told from a drop.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { loadSource, loadAssets } from "../../tools/lib/load.mjs";
import { compileCorpus } from "../../tools/lib/content.mjs";
import { installSystem, mismatches } from "../../tools/lib/foundry.mjs";
import { withWorld } from "../helpers/world.mjs";

import { UNIT_ROUTES, ABILITY_ROUTES, CONTRIBUTION_ROUTES, EFFECT_ROUTES, NESTED_ROUTES } from "../../tools/lib/survival-routes.mjs";

/* -------------------------------------------------------------------------- */
/*  The check                                                                 */
/* -------------------------------------------------------------------------- */

/** A value that states nothing a default would not. */
const carriesNothing = (v) => v == null || v === false || v === ""
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

/** `v` without the parts that carry nothing, at any depth: what the Clause actually states. */
function stated(v) {
  if (Array.isArray(v)) return v.map(stated);
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stated(x)]).filter(([, x]) => !carriesNothing(x)));
  }
  return v;
}

/** The document a model-built compiled entry holds, as Foundry would load it. */
function loaded(documentName, compiled) {
  const data = structuredClone(compiled);
  const strip = (v) => (Array.isArray(v) ? v.map(strip) : v && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "_key").map(([k, x]) => [k, strip(x)]))
    : v);
  return new foundry.documents[`Base${documentName}`](strip(data), { strict: false })._source;
}

/**
 * Hold one Authored Key to its route.
 *
 * @returns {string|null} a failure, or null
 */
function checkRoute(where, key, value, route, projected, hop) {
  if (!route) {
    return `${where}: "${key}" has no route. Last seen at ${hop}. Project it in module/rules/snapshot.mjs, `
      + "or name the file that reads it from the document, in test/unit/survival.test.mjs.";
  }
  for (const r of [route].flat()) {
    if (r.unread) continue;
    if (r.reader) {
      if (!existsSync(r.reader)) return `${where}: "${key}" is routed to ${r.reader}, which does not exist.`;
      if (!new RegExp(`\\b${key}\\b`).test(readFileSync(r.reader, "utf8"))) {
        return `${where}: "${key}" is routed to ${r.reader} (${r.why}), which no longer reads it.`;
      }
      continue;
    }
    const want = stated(r.from ? r.from(value) : value);
    if (carriesNothing(want)) continue;
    const got = r.project ? r.project(projected?.[r.at]) : projected?.[r.at];
    if (r.contains) {
      const missing = [want].flat().filter((x) => ![got].flat().includes(x));
      if (missing.length) return `${where}: "${key}" lost ${JSON.stringify(missing)} between ${hop} and the snapshot's \`${r.at}\`.`;
      continue;
    }
    const miss = mismatches(want, got, r.at);
    if (miss.length) {
      const m = miss[0];
      return `${where}: "${key}" reached ${hop} as ${JSON.stringify(m.want)}, and the snapshot's \`${m.path}\` `
        + `holds ${JSON.stringify(m.got)}.`;
    }
  }
  return null;
}

describe("every Authored Key survives its Route", () => {
  const failures = { unit: [], ability: [], contribution: [], effect: [] };

  beforeAll(async () => {
    await installSystem();
    const { files } = await loadSource("packs/_source");
    const { assets } = await loadAssets("assets");
    const { compiled } = compileCorpus(files, assets);
    const { snapshotUnit, abilityRecordOf } = await import("../../module/rules/snapshot.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");

    const effects = compiled.filter((c) => c.pack === "effects");
    const effectSources = effects.map((c) => loaded("Item", c.doc));
    EffectRegistry.load(effectSources.map((s) => ({ name: s.name, img: s.img, system: s.system })));
    effects.forEach((c, i) => {
      const source = effectSources[i].system;
      const def = EffectRegistry.get(source.contentId);
      for (const key of Object.keys(c.doc.system)) {
        if (!(key in source)) continue; // the model check's to report
        const f = checkRoute(c.path, key, source[key], EFFECT_ROUTES[key], def, "the Effect's document");
        if (f) failures.effect.push(f);
      }
    });

    for (const c of compiled.filter((x) => x.doc._key.startsWith("!actors!"))) {
      const source = loaded("Actor", c.doc);
      const spec = {
        id: source._id, name: source.name, type: source.type, system: source.system,
        items: source.items.map((i) => ({ id: i._id, name: i.name, type: i.type, system: i.system })),
      };
      await withWorld({ actors: [spec] }, async (w) => {
        const actor = w.actor(spec.id);
        const unit = snapshotUnit(actor);
        for (const key of Object.keys(c.doc.system)) {
          if (!(key in source.system)) continue;
          const f = checkRoute(c.path, key, actor.system[key], UNIT_ROUTES[key], unit, "the prepared Unit");
          if (f) failures.unit.push(f);
        }
        for (const item of c.doc.items ?? []) {
          const ability = unit.abilities.find((a) => a.id === item._id);
          if (!ability) continue;
          const sys = actor.items.get(item._id).system;
          for (const key of Object.keys(item.system)) {
            if (!(key in sys)) continue;
            const f = checkRoute(`${c.path} items["${item.name}"]`, key, sys[key], ABILITY_ROUTES[key], ability, "the Ability's document");
            if (f) failures.ability.push(f);
          }
          // The second Hop: what the rule collector is handed for this Ability.
          const record = abilityRecordOf(actor.items.get(item._id));
          for (const key of Object.keys(CONTRIBUTION_ROUTES)) {
            if (!(key in item.system)) continue;
            const f = checkRoute(`${c.path} items["${item.name}"]`, key, sys[key], CONTRIBUTION_ROUTES[key], record, "the contribution record");
            if (f) failures.contribution.push(f);
          }
        }
      });
    }
  }, 120_000);


  const report = (list) => list.join(String.fromCharCode(10));

  it("routes only to a projected field something reads", () => {
    // Reaching the snapshot or the registry is not the end of the Route: the
    // projected field needs a reader too. `periodic` reached the registry and
    // was read by nobody there, while the scheduler ticked from its own table,
    // and a survival test that stopped at the projection called that survival
    // (#105). The producer itself does not count as its own reader.
    const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
    const walk = (dir, out = []) => {
      for (const f of readdirSync(dir)) {
        const p = `${dir}/${f}`;
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(mjs|hbs)$/.test(f)) out.push(p);
      }
      return out;
    };
    const sources = [...walk("module"), ...walk("templates")].map((p) => [p, strip(readFileSync(p, "utf8"))]);
    const unreadTargets = [];
    for (const [table, producer] of [[UNIT_ROUTES, "module/rules/snapshot.mjs"],
      [ABILITY_ROUTES, "module/rules/snapshot.mjs"], [CONTRIBUTION_ROUTES, "module/rules/snapshot.mjs"],
      [EFFECT_ROUTES, "module/rules/registry.mjs"]]) {
      for (const [key, route] of Object.entries(table)) {
        for (const r of [route].flat().filter((x) => x.at)) {
          // A property read, or a destructuring `{ key }` / `{ key, ... }`.
          const read = new RegExp(String.raw`\.${r.at}\b(?!\s*=(?!=))|[{,]\s*${r.at}\b\s*[,}]`);
          if (!sources.some(([p, text]) => p !== producer && read.test(text))) {
            unreadTargets.push(`"${key}" is routed to \`${r.at}\`, which nothing outside ${producer} reads`);
          }
        }
      }
    }
    expect(report(unreadTargets)).toBe("");
  });

  it("leaves unread keys only where an issue owns them, and fewer over time", () => {
    const owned = [UNIT_ROUTES, ABILITY_ROUTES, EFFECT_ROUTES].flatMap((t) => Object.values(t)).filter((r) => r.unread);
    for (const r of owned) expect(r.unread).toMatch(/^#\d+$/);
    expect(owned.length).toBeLessThanOrEqual(0);
  });

  it("on every Unit", () => {
    expect(report(failures.unit)).toBe("");
  });

  it("on every Ability", () => {
    expect(report(failures.ability)).toBe("");
  });

  it("on every Ability's contribution record", () => {
    expect(report(failures.contribution)).toBe("");
  });

  it("on every Effect definition", () => {
    expect(report(failures.effect)).toBe("");
  });
});

describe("every key nested in an untyped block survives its Route", () => {
  // Source without its comments, so prose that names a key is not a reader of it.
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  let models;

  beforeAll(async () => { models = await installSystem(); });

  for (const { key, authored, hops } of NESTED_ROUTES) {
    it(`"${key}" is authored, and every Hop after the compile still names it`, () => {
      const lost = [];
      for (const file of authored) {
        if (!new RegExp(String.raw`\b${key}\b`).test(readFileSync(file, "utf8"))) lost.push(`${file} no longer authors "${key}"`);
      }
      for (const hop of hops) {
        // `as` is the name the Hop knows the key by, where it is not the authored one.
        const name = hop.as ?? key;
        if (hop.model) {
          const [document, type] = hop.model.split("/");
          if (!models[document]?.[type]?.schema.fields[name]) lost.push(`${hop.model} does not declare "${name}" (${hop.why})`);
        } else if (!new RegExp(String.raw`\b${name}\b`).test(strip(readFileSync(hop.file, "utf8")))) {
          lost.push(`${hop.file} no longer reads "${name}" (${hop.why})`);
        }
      }
      expect(lost.join(String.fromCharCode(10))).toBe("");
    });
  }
});
