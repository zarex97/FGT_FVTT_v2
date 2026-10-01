/**
 * @file Hold every compiled document to Foundry's real DataModel, at build time.
 * @see docs/40-content-pipeline.md, docs/07-schemas.md, docs/adr/0006-tests-and-build-run-real-foundry.md
 *
 * `compilePack` writes whatever JSON it is handed. The DataModel prunes a key it
 * does not declare only later, when the document loads in a world — silently,
 * so the Clause that key carried simply does not happen. `field` on a Skill,
 * `inherit` on a Platform and `timing.window` were all lost that way, and a live
 * board was the only thing that ever noticed.
 *
 * So the build constructs each compiled document through Foundry's own classes,
 * strictly, and compares what it compiled with what the model kept. Anything
 * pruned, reset or coerced is a problem naming the source file and the dotted
 * path. The DataModel is the one list of what may exist; this is what makes a
 * missing declaration a build error instead of a lost Clause.
 */

import { installSystem, mismatches } from "./foundry.mjs";
import { KNOWN_BUILD_DROPS } from "./known-drops.mjs";

const DOCUMENT_OF_KEY = Object.freeze({ actors: "Actor", items: "Item", journal: "JournalEntry" });

/** The document name a compiled `_key` belongs to: `!actors!…` is an Actor. */
function documentNameOf(compiled) {
  const collection = /^!([a-z]+)!/.exec(compiled._key ?? "")?.[1];
  return DOCUMENT_OF_KEY[collection] ?? null;
}

/** A compiled document as Foundry would receive it: without the pack's `_key`s. */
function withoutKeys(value) {
  if (Array.isArray(value)) return value.map(withoutKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "_key").map(([k, v]) => [k, withoutKeys(v)]));
  }
  return value;
}

/**
 * A STANDALONE template's unfilled slots, removed.
 *
 * A Class Skill is shipped once as a template — `rank: "@rank"`, `cooldown:
 * "@cooldown"` — and filled per Servant when a sheet references it, where the
 * embedded copy is checked with real values. The slot itself is not an
 * Authored Key and cannot be held to a rank field.
 *
 * Only for the template as a document of its own. An Item embedded in an Actor
 * has had its slots filled by the `ref` that built it, so a slot still standing
 * there is one the bearer forgot, and stripping it hid exactly that: Drake's
 * Riding carried `cooldown: "@cooldown"` and the build said "0 Silent Drop(s)"
 * (#120). Left in, Foundry refuses it in its own words.
 */
function withoutTemplateSlots(value) {
  if (Array.isArray(value)) return value.map(withoutTemplateSlots);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, v]) => !(typeof v === "string" && /^@[A-Za-z]\w*$/.test(v)))
      .map(([k, v]) => [k, withoutTemplateSlots(v)]));
  }
  return value;
}

/**
 * @typedef {object} ModelProblem
 * @property {string} file the source YAML
 * @property {string} path the dotted path that did not survive, prefixed `items["name"] ` when embedded
 * @property {string} message
 */

/**
 * Construct every compiled document through the real DataModel and report what
 * it did not keep.
 *
 * @param {Array<{path: string, doc: object}>} entries `path` is the source file
 * @returns {Promise<ModelProblem[]>}
 */
export async function checkCompiled(entries) {
  await installSystem();
  /** @type {ModelProblem[]} */
  const problems = [];
  const report = (file, where, { path, want, got }, model) => {
    const at = `${where}${path}`;
    problems.push({
      file,
      path: at,
      message: `${file}: ${at} — authored ${JSON.stringify(want)}, the ${model} model kept ${JSON.stringify(got)}. `
        + "Declare it in module/data/, or stop authoring it.",
    });
  };

  for (const { path: file, doc: compiled } of entries) {
    const documentName = documentNameOf(compiled);
    if (!documentName) continue;
    const data = documentName === "Actor" ? withoutKeys(compiled) : withoutTemplateSlots(withoutKeys(compiled));
    const { items = [], ...own } = data;
    const model = `${documentName}${own.type ? `/${own.type}` : ""}`;

    let doc;
    try {
      doc = new foundry.documents[`Base${documentName}`](structuredClone(data), { strict: true });
    } catch (err) {
      problems.push({ file, path: "", message: `${file}: Foundry would not construct this ${model} — ${err.message}` });
      continue;
    }

    for (const miss of mismatches(own, doc._source, "").map((m) => ({ ...m, path: m.path.replace(/^\./, "") }))) {
      report(file, "", miss, model);
    }
    for (const item of documentName === "Actor" ? items : []) {
      const kept = doc._source.items?.find((i) => i._id === item._id);
      const where = `items[${JSON.stringify(item.name)}] `;
      if (!kept) {
        problems.push({ file, path: where.trim(), message: `${file}: ${where}was dropped from the Actor entirely` });
        continue;
      }
      // An embedded Item Foundry could not initialize is logged and set aside,
      // NOT thrown, and its raw data stays in `_source` -- so the comparison
      // below sees an exact copy and finds nothing. Asked of the collection
      // itself, and re-run alone for the message (#120).
      if (doc.items?.invalidDocumentIds?.has(item._id)) {
        let why = "it failed Foundry's own validation";
        try {
          new foundry.documents.BaseItem(structuredClone(item), { strict: true });
        } catch (err) {
          why = err.message;
        }
        problems.push({
          file, path: where.trim(),
          message: `${file}: ${where}Foundry would not construct this Item — ${why}`,
        });
        continue;
      }
      for (const miss of mismatches(item, kept, "").map((m) => ({ ...m, path: m.path.replace(/^\./, "") }))) {
        report(file, where, miss, `Item/${item.type}`);
      }
    }
  }
  return problems;
}

/**
 * Split model problems into the ones that fail the build and the known drops
 * that are owned by an issue.
 *
 * @param {ModelProblem[]} problems
 * @returns {{failing: ModelProblem[], known: Array<ModelProblem & {issue: string}>, stale: object[]}}
 *   `stale` lists known drops that no longer happen, so the list is kept honest.
 */
export function partitionKnown(problems) {
  const known = [];
  const failing = [];
  const seen = new Set();
  for (const p of problems) {
    const entry = KNOWN_BUILD_DROPS.find((d) => p.file.replaceAll("\\", "/").endsWith(d.file) && p.path === d.path);
    if (entry) {
      known.push({ ...p, issue: entry.issue });
      seen.add(entry);
    } else {
      failing.push(p);
    }
  }
  return { failing, known, stale: KNOWN_BUILD_DROPS.filter((d) => !seen.has(d)) };
}

/**
 * Print a partitioned model check the way both build scripts do.
 *
 * @param {{failing: ModelProblem[], known: Array<ModelProblem & {issue: string}>, stale: object[]}} result
 */
export function reportModelCheck({ failing, known, stale }) {
  for (const k of known) console.warn(`  known    ${k.message} (${k.issue})`);
  for (const d of stale) {
    console.error(`  stale    ${d.file}: ${d.path} is listed in tools/lib/known-drops.mjs (${d.issue}) but no longer drops -- remove it`);
  }
  for (const p of failing) console.error(`  dropped  ${p.message}`);
}
