/**
 * @file Building a predicate from dropdowns instead of typing it.
 * @see docs/29-user-interface.md §29.6, docs/24-rules-engine.md §24.4
 *
 * Layer 4, but **pure**: no `game`, no `canvas`, no `ui`. D29.12.
 *
 * {@link builderRows} and {@link toPredicate} are **inverses**, and the
 * round-trip is the property that matters: anything the builder renders it
 * must give back unchanged, or opening an ability and pressing Save would
 * quietly rewrite rules that were correct. A test holds that against every
 * predicate in `packs/_source`.
 *
 * **Nothing is dropped.** A statement the builder cannot model — a module's
 * operator, an option no facet admits — becomes a `raw` row carrying its JSON,
 * for the same reason an unknown rule element does: an editor that silently
 * discards what it does not understand is worse than one that refuses to open.
 */

import { FACETS, parseOption, REF_SCOPES } from "../../rules/facets.mjs";
import * as ENUMS from "../../domain/enums.mjs";

/** The prefix that negates a bare option. */
const NEGATION = "not:";

/** Group operators the builder renders as a nested block. */
const GROUPS = Object.freeze(["or", "anyOf", "nor", "and", "nand"]);

/** Comparison operators, and whether they take ranks. */
const COMPARISONS = Object.freeze({
  gte: "number", gt: "number", lte: "number", lt: "number", eq: "number",
  rankGte: "rank", rankEq: "rank",
});

/**
 * The `@`-paths one scope can resolve, with the type each yields.
 *
 * Scoped because `ctx.refs` is built four different ways and the two `self`
 * shapes disagree: `@self.health` is `{value, max}` under `expressionRefs` and
 * a **number** under a unit snapshot. Offering one flat list would emit paths
 * that cannot resolve where they sit, and `predicate.mjs#num` throws on that.
 *
 * @param {string} scope a key of `REF_SCOPES`
 * @returns {Array<{path: string, type: string}>}
 */
export function refChoicesFor(scope) {
  const spec = REF_SCOPES[scope] ?? REF_SCOPES.ownerOnly;
  const out = [];

  for (const root of spec.roots) {
    if (root === "attack" || root === "board") continue;

    if (spec.shape === "document") {
      // `expressionRefs`: pools are objects, so the number is one level down.
      out.push(
        { path: `@${root}.health.value`, type: "number" },
        { path: `@${root}.health.max`, type: "number" },
        { path: `@${root}.baseHealth`, type: "number" },
        { path: `@${root}.agility.value`, type: "number" },
        { path: `@${root}.luck.value`, type: "number" },
        { path: `@${root}.remainingMov`, type: "number" },
      );
    } else {
      // A unit snapshot: the pools are already flattened to numbers.
      out.push(
        { path: `@${root}.health`, type: "number" },
        { path: `@${root}.maxHealth`, type: "number" },
        { path: `@${root}.agility`, type: "number" },
        { path: `@${root}.luck`, type: "number" },
        { path: `@${root}.mov`, type: "number" },
        { path: `@${root}.range`, type: "number" },
      );
    }

    for (const p of ENUMS.PARAMETERS) {
      out.push({ path: `@${root}.parameters.${p}`, type: "rank" });
    }
    out.push({ path: `@${root}.rank`, type: "rank" });
  }
  return out;
}

/**
 * Render a predicate as builder rows.
 *
 * @param {unknown[]|null|undefined} predicate
 * @param {string} scope
 * @returns {object[]}
 */
export function builderRows(predicate, scope = "ownerOnly", base = "") {
  return (predicate ?? []).map((s, i) => rowFor(s, scope, base ? `${base}.rows.${i}` : String(i)));
}

/**
 * Turn builder rows back into a predicate.
 *
 * @param {object[]} rows
 * @returns {unknown[]}
 */
export function toPredicate(rows) {
  return (rows ?? []).map(statementFor);
}

/* -------------------------------------------------------------------------- */

/**
 * @param {unknown} s
 * @param {string} scope
 * @returns {object}
 */
function rowFor(s, scope, path) {
  if (typeof s === "string") return termRow(s, scope, path);

  if (s && typeof s === "object") {
    for (const op of GROUPS) {
      if (op in s) {
        return {
          kind: "group",
          op,
          rows: (s[op] ?? []).map((x, i) => rowFor(x, scope, `${path}.rows.${i}`)),
          scope,
          path,
        };
      }
    }
    if ("not" in s) {
      // `{not: …}` around a whole statement, distinct from the `not:` prefix
      // on one option. Both exist in the grammar and both are preserved.
      return { kind: "group", op: "not", rows: [rowFor(s.not, scope, `${path}.rows.0`)], scope, path };
    }
    for (const op of Object.keys(COMPARISONS)) {
      if (op in s) {
        return {
          kind: "comparison",
          op,
          refType: COMPARISONS[op],
          left: s[op][0],
          right: s[op][1],
          refChoices: refChoicesFor(scope).filter((r) => r.type === COMPARISONS[op]),
          opChoices: asChoices(Object.keys(COMPARISONS)),
          scope,
          path,
        };
      }
    }
  }
  return { kind: "raw", raw: JSON.stringify(s, null, 2), scope, path };
}

/**
 * @param {string} option
 * @param {string} scope
 * @returns {object}
 */
function termRow(option, scope, path) {
  const negated = option.startsWith(NEGATION);
  const bare = negated ? option.slice(NEGATION.length) : option;
  const parsed = parseOption(bare);
  // An option no facet admits stays raw rather than being reshaped into
  // something the engine would read differently.
  if (!parsed) return { kind: "raw", raw: JSON.stringify(option), scope, path };

  const f = FACETS.find((x) => x.id === parsed.facet);
  // The form whose segments EXACTLY match what was parsed, not merely one
  // whose segments are all present. `attack:range` has two forms and the
  // shorter one's `panels` is defined in both, so "every segment present"
  // picked `attack:range:3` for `attack:range:gte:3` and the round-trip lost
  // the comparison.
  const keys = Object.keys(parsed.segments).sort().join(",");
  const form = f.forms.find((candidate) =>
    candidate.filter((seg) => seg.value.kind !== "literal")
      .map((seg) => seg.name).sort().join(",") === keys) ?? f.segments;

  return {
    kind: "term",
    negated,
    subject: parsed.subject,
    subjectChoices: asChoices(f.subjects),
    facet: parsed.facet,
    facetChoices: asChoices(
      FACETS.filter((x) => x.subjects.includes(parsed.subject)).map((x) => x.id),
    ),
    label: f.label,
    hint: f.hint,
    segments: form.filter((seg) => seg.value.kind !== "literal").map((seg) => ({
      name: seg.name,
      value: parsed.segments[seg.name],
      choices: choicesFor(seg),
      // 21 of 37 facets end in a free identifier. Saying so is the point.
      unchecked: seg.value.kind === "open",
      registry: seg.value.kind === "registry" ? seg.value.from : null,
    })),
    scope,
    path,
  };
}

/**
 * @param {object} seg
 * @returns {Record<string, string>|null}
 */
function choicesFor(seg) {
  if (seg.value.kind !== "closed") return null;
  return asChoices(seg.value.list ?? ENUMS[seg.value.from]);
}

/**
 * A list as Foundry's `selectOptions` needs it.
 *
 * An ARRAY is treated as index-keyed and emits `value="0"`, `value="1"` — so a
 * subject picker offered `0` and `1` instead of `self` and `target`. The same
 * trap `formRows` was fixed for; found live both times, because no unit test
 * renders a Handlebars helper.
 *
 * @param {readonly string[]} list
 * @returns {Record<string, string>}
 */
function asChoices(list) {
  return Object.fromEntries([...list].map((v) => [v, v]));
}

/**
 * @param {object} row
 * @returns {unknown}
 */
function statementFor(row) {
  switch (row.kind) {
    case "term": {
      const f = FACETS.find((x) => x.id === row.facet);
      const form = f.forms.find((candidate) =>
        candidate.filter((seg) => seg.value.kind !== "literal").length === row.segments.length,
      ) ?? f.segments;
      // Literals are rebuilt from the form, not carried on the row: `gte` in
      // `self:rank:str:gte:B` is punctuation, and offering it in a picker
      // would let a GM author a string the parser cannot read.
      const tail = form.map((seg) => (
        seg.value.kind === "literal"
          ? seg.value.is
          : row.segments.find((x) => x.name === seg.name)?.value
      ));
      const option = [row.subject, row.facet, ...tail].join(":");
      return row.negated ? `${NEGATION}${option}` : option;
    }
    case "group":
      return row.op === "not"
        ? { not: statementFor(row.rows[0]) }
        : { [row.op]: row.rows.map(statementFor) };
    case "comparison":
      return { [row.op]: [row.left, row.right] };
    default:
      return JSON.parse(row.raw);
  }
}

/**
 * Write form values back into a row tree, then rebuild the predicate.
 *
 * Controls name themselves by their row's `path` — `0.subject`,
 * `1.rows.0.segments.0` — so a nested group patches without the form needing
 * to know the tree's shape.
 *
 * The rows are rebuilt from the **draft** first, so anything the builder does
 * not render is still carried: a raw row's JSON survives untouched.
 *
 * @param {object[]} rows
 * @param {Record<string, string>} inputs keyed by `<path>.<field>`
 * @returns {unknown[]} the new predicate
 */
export function patchRows(rows, inputs) {
  const at = (path) => path.split(".").reduce((node, part) => (
    Array.isArray(node) ? node[Number(part)] : node?.[part]
  ), { rows });

  for (const [key, value] of Object.entries(inputs)) {
    const dot = key.lastIndexOf(".");
    const row = at(`rows.${key.slice(0, dot)}`);
    const field = key.slice(dot + 1);
    if (!row) continue;

    if (field === "negated") { row.negated = Boolean(value); continue; }
    if (field.startsWith("seg")) {
      const i = Number(field.slice(3));
      if (row.segments?.[i]) row.segments[i].value = value;
      continue;
    }
    if (field === "subject" || field === "facet" || field === "op") { row[field] = value; continue; }
    if (field === "left" || field === "right") {
      // A number stays a number: `{gte: ["@x", "100"]}` and
      // `{gte: ["@x", 100]}` are not the same document.
      row[field] = value !== "" && Number.isFinite(Number(value)) && !String(value).startsWith("@")
        ? Number(value) : value;
      continue;
    }
    if (field === "raw") row.raw = value;
  }
  return toPredicate(rows);
}
