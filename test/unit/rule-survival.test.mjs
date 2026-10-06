/**
 * @file No normalizer or executor drops the keys beside the ones it names.
 * @see module/rules/elements.mjs, module/rules/ability-use.mjs#effectSpecsOf, docs/10-rule-elements.md
 *
 * Seven Silent Drops had one shape: code that copied a FIXED list of fields out
 * of an authored rule and never looked at the rest. `r.effect ?? r` dropped the
 * `duration` and `magnitude` beside a nested effect (f0bfedf, ed4a77b); an Aura
 * copied a list without `check` (8037d25); CheckModifier dropped `roll`
 * (75713bb); a CritModifier had no `component` (46a26a8).
 *
 * So every rule element in the REAL corpus is run through the REAL collection —
 * `collectContributions`, which orders it, tests it, normalizes it and hands it
 * to its executor — with every object in it wrapped in a Proxy that records
 * which authored paths anything READ. A leaf nobody read, and that did not
 * travel into the output inside an object carried whole, is a key no code on
 * the Route ever consulted: a Silent Drop, however carefully it was authored.
 * Phase effect specs go through `effectSpecsOf` the same way.
 *
 * A key that is consumed somewhere other than the collection pass is exempt
 * per element type, with the reason. An element type whose executor cannot run
 * without a world is listed in the output rather than skipped silently.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadSource } from "../../tools/lib/load.mjs";
import { compileCorpus, RULE_ELEMENT_KEYS } from "../../tools/lib/content.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { effectSpecsOf } from "../../module/rules/ability-use.mjs";

/**
 * Keys consumed somewhere other than the collection pass, by element type.
 * `*` applies to every type. Each names what reads the key instead.
 */
export const EXEMPT = {
  "*": {
    // Authoring commentary, never shipped anywhere a rule reads.
    note: () => "an author's note",
    // Every executor that reads `includesNP` defaults it to true, and one that
    // does not applies to Noble Phantasms anyway. Only `false` says anything.
    includesNP: (el) => (el.includesNP === true ? "restates the default" : null),
    // `stackScaled` reads it once the magnitude resolves to a number, which an
    // `@` expression cannot without a Unit's refs -- anywhere in the value, not
    // only at its start: Huge Scale's `0.2 * @self.baseHealth` (#103).
    perStack: (el) => (typeof el.value === "string" && el.value.includes("@")
      ? "read by stackScaled once the magnitude resolves against a Unit" : null),
  },
  // The bucket is `modifierKey` when one is named; `direction` and `aspect`
  // are the author restating which way it points.
  DamageModifier: { direction: (el) => (el.modifierKey ? "modifierKey decides the bucket" : null) },
  CritModifier: { aspect: (el) => (el.modifierKey ? "modifierKey decides the bucket" : null) },
  // The contribution's source is the effect or ability it sits on; an authored
  // `source` names the same thing (`Evade` on the Evade effect).
  AutoSucceed: { source: () => "the source is the owning effect's own name" },
  // Resolved against the bearer's Parameter, which a Unit-less pass does not
  // have, so the executor stops before it reaches the rest of the clause.
  CheckModifier: { check: (el) => (el.rankFrom ? "read once rankFrom resolves against the bearer" : null) },
};

/**
 * Keys a bounded field's interior rule carries for `rules/bounded-fields.mjs#interiorModifiers`,
 * which decides who inside the field the rule reaches before any executor runs.
 */
export const INTERIOR_EXEMPT = {
  relations: () => "rules/bounded-fields.mjs#interiorModifiers filters on the unit's relation to the field",
  kinds: () => "rules/bounded-fields.mjs#interiorModifiers filters on the unit's kind",
  contentIds: () => "rules/bounded-fields.mjs#interiorModifiers filters on the unit's content id (#189 reading 5)",
  sparesCategorizedNP: () => "rules/budget.mjs#preventedBy spares an ability only categorized as an NP (#189)",
  exemptIf: () => "rules/bounded-fields.mjs#isExempt",
  // A MOV or Range rule inside a field is applied to the unit standing in it by
  // `applyInteriorStat`, which honours its floor, ceiling and factor.
  minimum: () => "rules/bounded-fields.mjs#applyInteriorStat",
  maximum: () => "rules/bounded-fields.mjs#applyInteriorStat",
  factor: () => "rules/bounded-fields.mjs#applyInteriorStat",
};

/**
 * Keys this test found unread in shipped content and that are not yet fixed,
 * each owned by an issue. `at` is matched as a substring of the site, so one
 * entry covers a shared template on every Servant that takes it. The list may
 * only shrink; an entry that stops dropping fails as stale.
 */
export const KNOWN_RULE_DROPS = Object.freeze([
]);

/** A stack count of one for any effect a per-stock clause asks about. */
const ONE_OF_EACH = new Proxy({}, { get: (_t, prop) => (typeof prop === "string" ? 1 : undefined) });

/** Where rule elements live in a compiled document. */
const SITES = ["rules", "passiveRules", "activeRules"];

/* -------------------------------------------------------------------------- */
/*  Read tracking                                                             */
/* -------------------------------------------------------------------------- */

const isContainer = (v) => v !== null && typeof v === "object"
  && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);

/**
 * Wrap `value` so every property read through it is recorded by authored path.
 *
 * @param {unknown} value
 * @param {string} path
 * @param {{reads: Set<string>, paths: WeakMap<object, string>}} log
 */
function tracked(value, path, log) {
  if (!isContainer(value)) return value;
  const cache = new Map();
  const proxy = new Proxy(value, {
    get(target, prop, receiver) {
      const got = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || !Object.prototype.hasOwnProperty.call(target, prop)) return got;
      const at = Array.isArray(target) ? `${path}[]` : `${path}.${prop}`;
      log.reads.add(at);
      if (!isContainer(got)) return got;
      if (!cache.has(prop)) cache.set(prop, tracked(got, at, log));
      return cache.get(prop);
    },
  });
  log.paths.set(proxy, path);
  return proxy;
}

/** Every authored leaf path in `value`, arrays merged as `[]`. */
function leaves(value, path, out = new Set()) {
  if (Array.isArray(value)) {
    if (value.length === 0) out.add(path);
    for (const v of value) leaves(v, `${path}[]`, out);
  } else if (isContainer(value)) {
    if (Object.keys(value).length === 0) out.add(path);
    for (const [k, v] of Object.entries(value)) leaves(v, `${path}.${k}`, out);
  } else {
    out.add(path);
  }
  return out;
}

/** The authored paths of every tracked object that travelled into `output` whole. */
function carried(output, log, out = new Set(), seen = new WeakSet()) {
  if (output === null || typeof output !== "object" || seen.has(output)) return out;
  seen.add(output);
  if (log.paths.has(output)) out.add(log.paths.get(output));
  for (const v of Object.values(output)) carried(v, log, out, seen);
  return out;
}

/** The leaves of `element` that nothing read and nothing carried. */
function unconsulted(element, run) {
  const log = { reads: new Set(), paths: new WeakMap() };
  const proxy = tracked(element, "", log);
  const output = run(proxy);
  const whole = carried(output, log);
  const ok = (leaf) => log.reads.has(leaf)
    || [...whole].some((p) => leaf === p || leaf.startsWith(`${p}.`) || leaf.startsWith(`${p}[]`));
  return [...leaves(element, "")].filter((leaf) => leaf !== "" && !ok(leaf)).map((l) => l.replace(/^\./, ""));
}

/* -------------------------------------------------------------------------- */
/*  The corpus                                                                */
/* -------------------------------------------------------------------------- */

/** Every top-level rule element and phase in a compiled `system`, with where it sits. */
function* sitesOf(system, where, rank) {
  // A Class Skill template's slots are filled per Servant; the embedded copy
  // is the one with real values, and it is checked there.
  if (typeof rank === "string" && rank.startsWith("@")) return;
  for (const site of SITES) {
    for (const [i, el] of (system?.[site] ?? []).entries()) {
      if (el && RULE_ELEMENT_KEYS.has(el.key)) yield { kind: "element", el, where: `${where} ${site}[${i}]`, rank };
    }
  }
  for (const [i, el] of (system?.field?.interior ?? []).entries()) {
    if (el && RULE_ELEMENT_KEYS.has(el.key)) yield { kind: "element", el, where: `${where} field.interior[${i}]`, rank, interior: true };
  }
  for (const [i, phase] of (system?.phases ?? []).entries()) {
    if ((phase?.rules ?? phase?.effects ?? []).length) yield { kind: "phase", el: phase, where: `${where} phases[${i}]`, rank };
  }
}

describe("every key inside a rule element reaches something that reads it", () => {
  const failures = [];
  const unreachable = new Map();
  const seen = new Set();
  let counted = 0;

  beforeAll(async () => {
    const { files } = await loadSource("packs/_source");
    const { compiled } = compileCorpus(files, new Map());
    const all = [];
    for (const { path, doc } of compiled) {
      if (!doc.system) continue;
      all.push(...sitesOf(doc.system, path, doc.system.rank));
      for (const item of doc.items ?? []) all.push(...sitesOf(item.system, `${path} items["${item.name}"]`, item.system.rank));
    }

    for (const site of all) {
      counted += 1;
      const exempt = {
        ...EXEMPT["*"], ...(EXEMPT[site.el.key] ?? {}), ...(site.interior ? INTERIOR_EXEMPT : {}),
      };
      let lost;
      try {
        lost = site.kind === "phase"
          ? unconsulted(structuredClone(site.el), (phase) => effectSpecsOf(phase))
          : unconsulted(structuredClone({ ...site.el, predicate: undefined }), (el) => collectContributions(
            [{ id: "survival", name: "survival", rank: site.rank ?? null, active: true, rules: [el] }],
            // One of everything stacked, so a per-stock clause scales and
            // reads its whole `perStack` rather than stopping at "none held".
            { options: new Set(), refs: {}, stacks: ONE_OF_EACH },
          ));
      } catch (err) {
        const key = site.kind === "phase" ? "phase" : site.el.key;
        if (!unreachable.has(key)) unreachable.set(key, `${site.where}: ${err.message}`);
        continue;
      }
      for (const leaf of lost) {
        // A phase is the attack's or the skill's; only its effect specs pass
        // through `effectSpecsOf`, which is the Hop under test here.
        if (site.kind === "phase" && !/^(rules|effects)\[\]/.test(leaf)) continue;
        const root = leaf.split(/[.[]/)[0];
        if (root === "predicate" || exempt[root]?.(site.el)) continue;
        const where = site.where.replaceAll("\\", "/");
        const known = KNOWN_RULE_DROPS.find((d) => d.leaf === leaf && where.includes(d.at));
        if (known) {
          seen.add(known);
          continue;
        }
        failures.push(`${site.where} (${site.kind === "phase" ? "phase" : site.el.key}): "${leaf}" was authored and nothing on the Route read it`);
      }
    }
  }, 120_000);

  it("reaches every element in the corpus", () => {
    expect(counted).toBeGreaterThan(600);
  });

  it("drops no authored key", () => {
    expect(failures.join(String.fromCharCode(10))).toBe("");
  });

  it("keeps its known drops honest: each owned by an issue, none stale, fewer over time", () => {
    for (const d of KNOWN_RULE_DROPS) expect(d.issue).toMatch(/^#\d+$/);
    expect(KNOWN_RULE_DROPS.filter((d) => !seen.has(d))).toEqual([]);
    expect(KNOWN_RULE_DROPS.length).toBeLessThanOrEqual(0);
  });

  it("names the element types it cannot run, rather than skipping them", () => {
    // An executor that needs a world is a gap in this test, not a pass. Each
    // one is printed so it stays visible; the list may only shrink.
    for (const [key, why] of unreachable) console.warn(`  unreachable  ${key}: ${why}`);
    expect(unreachable.size).toBeLessThanOrEqual(0);
  });
});
