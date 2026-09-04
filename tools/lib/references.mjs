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
 * -- an authoring convention already in use in content comments -- and an
 * email address are not mistaken for markers.
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
