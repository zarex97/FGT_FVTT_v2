/**
 * @file Tiers: a Skill's bracketed figures, bought by spending tokens.
 * @see docs/17-abilities.md, docs/superpowers/specs/2026-11-02-kiara-summer-clauses.md
 *
 * Layer 2 (rules). Pure: it reads what it is handed.
 *
 * Sessyoin Kiara (Summer)'s Mermaid Tokens (#372): *"When Sessyoin uses a Skill
 * other than Mermaid's Flesh while she has any Mermaid Tokens, they are removed
 * from her and the effects of the Skill are boosted; only a maximum of two
 * Mermaid Tokens can be consumed per Skill usage."* Her Skills print the boosted
 * figures in brackets, *"Rank: B (B+) (A)"*, *"20% (25%) (30%)"*, *"Cooldown: 4◈
 * Turns (4◈-⅓◈ Turns) (4◈-⅔◈ Turns)"*: the first bracket for one token, the
 * second for two.
 *
 * Two halves, each on the document that owns it:
 *
 *   - **The token** says it is spent: an Effect definition's `spentForTier`,
 *     `{max, except, kinds}`. Each instance is one token (`magnitudeStacks`).
 *   - **The Skill** says what each tier is: `tiers`, an array whose index is the
 *     tokens spent, `[base, one, two]`. Each tier may set `rank` and `cooldown`
 *     and gives `refs`, the values every `"@tier.<key>"` string in the Skill's
 *     phases stands for.
 *
 * Readings ruled 2026-11-02: the spend is automatic (7); with more than `max`
 * held, `max` are spent and the rest stay (7); any Active Skill spends, one
 * with no tiers boosting nothing (8); spent before the effects, nothing spent
 * by a use refused before (9); the boosted Rank and Cooldown are the use's (10,
 * 11).
 */

/** The prefix a phase value names a tier's ref by. */
export const TIER_REF = "@tier.";

/**
 * The tokens a use of this ability spends, and the tier they buy.
 *
 * @param {object} args
 * @param {object} args.ability the ability Item: `system.kind`, `system.passive`, `system.contentId`
 * @param {Array<{id: string, defId: string, expiry?: number|null, appliedTick?: number|null}>} args.instances
 *   the user's effect instances
 * @param {(defId: string) => object|null} args.defOf the registry's lookup
 * @returns {{defId: string, spentIds: string[], tier: number}|null} null when no token is spent
 */
export function tierSpend({ ability, instances, defOf }) {
  const sys = ability?.system ?? {};
  if (sys.passive) return null;
  for (const [defId, held] of groupByDef(instances)) {
    const spec = defOf(defId)?.spentForTier;
    if (!spec) continue;
    if (!(spec.kinds ?? ["skill"]).includes(sys.kind)) continue;
    if ((spec.except ?? []).includes(sys.contentId)) continue;
    const n = Math.min(held.length, spec.max ?? held.length);
    if (n <= 0) continue;
    // The tokens nearest their end are spent first: a token about to expire
    // buys the same tier as one that has just landed.
    const spentIds = [...held]
      .sort((a, b) => clock(a.expiry) - clock(b.expiry) || clock(a.appliedTick) - clock(b.appliedTick))
      .slice(0, n)
      .map((e) => e.id);
    return { defId, spentIds, tier: n };
  }
  return null;
}

/**
 * The tier a use reads: the index the tokens bought, at most the last tier the
 * ability states.
 *
 * @param {object} ability
 * @param {number} spent
 * @returns {number}
 */
export function tierIndex(ability, spent) {
  const tiers = ability?.system?.tiers ?? [];
  if (tiers.length === 0) return 0;
  return Math.max(0, Math.min(spent, tiers.length - 1));
}

/**
 * The ability as one tier of it reads: its `rank`, `cooldown` and every
 * `"@tier.<key>"` in its phases resolved. Everything else is the ability's own,
 * read through to the document, so a write made through the view lands on it.
 *
 * An ability with no `tiers` is returned as it is.
 *
 * @param {object} ability the ability Item
 * @param {number} index the tier, from {@link tierIndex}
 * @returns {object}
 */
export function tierView(ability, index) {
  const tiers = ability?.system?.tiers ?? [];
  if (tiers.length === 0) return ability;
  const tier = tiers[index] ?? tiers[0] ?? {};
  const refs = { ...(tiers[0]?.refs ?? {}), ...(tier.refs ?? {}) };
  const base = ability.system;
  // Defined, not assigned: a DataModel's fields may be read-only, and an
  // assignment through the prototype would throw in a module.
  const own = (key, value) => Object.defineProperty(system, key, { value, enumerable: true, writable: true });
  const system = Object.create(base);
  own("phases", resolveTierRefs(base.phases ?? [], refs));
  if (tier.rank) own("rank", tier.rank);
  if (tier.cooldown) own("cooldown", { ...(base.cooldown ?? {}), max: tier.cooldown });
  return new Proxy(ability, {
    get(target, prop) {
      if (prop === "system") return system;
      if (prop === "tierIndex") return index;
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * Every `"@tier.<key>"` string under a node replaced by its ref; a ref the tier
 * does not give refuses out loud, so a bracket the content forgot is never 0.
 *
 * @param {unknown} node
 * @param {Record<string, unknown>} refs
 * @returns {unknown} a copy
 */
export function resolveTierRefs(node, refs) {
  if (typeof node === "string" && node.startsWith(TIER_REF)) {
    const key = node.slice(TIER_REF.length);
    if (!(key in refs)) throw new RangeError(`FGT | No tier gives "${key}" (${node}).`);
    return refs[key];
  }
  if (Array.isArray(node)) return node.map((n) => resolveTierRefs(n, refs));
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveTierRefs(v, refs)]));
  }
  return node;
}

/**
 * The `"@tier.<key>"` names a node uses, for the build's check that every tier gives them.
 *
 * @param {unknown} node
 * @returns {string[]}
 */
export function tierRefsIn(node) {
  const out = new Set();
  const walk = (n) => {
    if (typeof n === "string" && n.startsWith(TIER_REF)) out.add(n.slice(TIER_REF.length));
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === "object") Object.values(n).forEach(walk);
  };
  walk(node);
  return [...out];
}

/**
 * @param {Array<{defId: string}>} instances
 * @returns {Map<string, object[]>}
 */
function groupByDef(instances) {
  const out = new Map();
  for (const e of instances ?? []) {
    if (!e?.defId) continue;
    if (!out.has(e.defId)) out.set(e.defId, []);
    out.get(e.defId).push(e);
  }
  return out;
}

/** @param {number|null|undefined} n @returns {number} */
function clock(n) {
  return typeof n === "number" ? n : Number.MAX_SAFE_INTEGER;
}
