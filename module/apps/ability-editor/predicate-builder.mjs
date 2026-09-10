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
export function builderRows(predicate, scope = "ownerOnly") {
  return (predicate ?? []).map((s) => rowFor(s, scope));
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
function rowFor(s, scope) {
  if (typeof s === "string") return termRow(s, scope);

  if (s && typeof s === "object") {
    for (const op of GROUPS) {
      if (op in s) {
        return {
          kind: "group",
          op,
          rows: (s[op] ?? []).map((x) => rowFor(x, scope)),
          scope,
        };
      }
    }
    if ("not" in s) {
      // `{not: …}` around a whole statement, distinct from the `not:` prefix
      // on one option. Both exist in the grammar and both are preserved.
      return { kind: "group", op: "not", rows: [rowFor(s.not, scope)], scope };
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
          opChoices: Object.keys(COMPARISONS),
          scope,
        };
      }
    }
  }
  return { kind: "raw", raw: JSON.stringify(s, null, 2), scope };
}

/**
 * @param {string} option
 * @param {string} scope
 * @returns {object}
 */
function termRow(option, scope) {
  const negated = option.startsWith(NEGATION);
  const bare = negated ? option.slice(NEGATION.length) : option;
  const parsed = parseOption(bare);
  // An option no facet admits stays raw rather than being reshaped into
  // something the engine would read differently.
  if (!parsed) return { kind: "raw", raw: JSON.stringify(option), scope };

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
    subjectChoices: [...f.subjects],
    facet: parsed.facet,
    facetChoices: FACETS.filter((x) => x.subjects.includes(parsed.subject)).map((x) => x.id),
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
  };
}

/**
 * @param {object} seg
 * @returns {string[]|null}
 */
function choicesFor(seg) {
  if (seg.value.kind !== "closed") return null;
  return [...(seg.value.list ?? ENUMS[seg.value.from])];
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
