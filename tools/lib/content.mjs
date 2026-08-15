/**
 * @file Content loading, `ref:` resolution, id assignment and validation.
 * @see docs/37-content-pipeline.md
 *
 * Pure functions over parsed objects, so the whole pipeline is unit-testable
 * without touching the filesystem. `tools/build-packs.mjs` and
 * `tools/validate-content.mjs` are thin shells around this.
 *
 * Validation is the single most valuable tool in the project: content bugs are
 * the dominant failure mode in a data-driven system, and a typo'd effect id
 * that silently does nothing is far worse than a build failure.
 */

import { createHash } from "node:crypto";
import { Rank } from "../../module/domain/rank.mjs";
import { parseTick } from "../../module/domain/tick.mjs";
import { referencedOptions } from "../../module/rules/predicate.mjs";
import { TABLES } from "../../module/domain/tables.mjs";

/** The schema version every source file must declare. */
export const SCHEMA_VERSION = 1;

/**
 * Rule-element keys the engine knows. A `key` outside this set is a typo that
 * would otherwise sit in a compendium doing nothing.
 * @see docs/24-rules-engine.md §24.3
 */
// NOTE: this list and `EXECUTORS` in `module/rules/elements.mjs` are two hand-
// maintained copies of the same vocabulary, and nothing kept them in step.
// Either direction is a defect: a key here with no executor makes content
// validate and then do nothing, and a key with an executor but not here makes
// legitimate content fail the build. `test/unit/elements.test.mjs` now holds
// the two against each other in both directions.
export const RULE_ELEMENT_KEYS = new Set([
  // Group 1 — stat and derived-value modifiers
  "StatDelta", "RankShift", "MaxDelta", "MovDelta", "RangeDelta", "SizeStep",
  "ZonBonus",
  // Group 2 — damage contributors
  "DamageModifier", "FlatDamage", "DamageNegation", "Resistance", "Ward",
  "CritModifier", "BlockModifier", "AttackerPropertyTier",
  // Group 3 — check contributors
  "CheckModifier", "AutoSucceed", "TableOverride", "RollAdjustment",
  // Group 4 — targeting contributors
  "TargetingModifier", "ForceTarget", "Decoy", "WeakPoint",
  // Group 5 — event handlers
  "OnEvent", "Aura", "GrantedAbility", "OfferAbilityUse",
  // Group 6 — suppression and meta
  "Suppress", "Immunity", "ImmunityDowngrade", "ApplicationChance", "ReplaceAbility", "Disguise",
  "EffectVisibility", "SustainabilityGain", "RelationshipProxy",
  // Group 7 — the escape hatch
  "Script",
]);

/** Effect classification vocabularies, from Appendix A. */
const POLARITIES = new Set(["buff", "debuff", "status"]);

/** The two check tables, from docs/15-checks.md. Not rank tables. */
const CHECK_TABLES = new Set(["favourable", "unfavourable"]);
const VOLATILITIES = new Set(["nonVolatile", "volatile", "mental", "terminal", "none"]);
const STACKING = new Set([
  "magnitudeStacks", "noneNoRefresh", "noneRefresh", "noneExtend", "stage", "count", "highestOnly",
]);

/** Which pack each source directory compiles into, and its document type. */
export const PACKS = Object.freeze({
  effects: { pack: "effects", documentType: "Item", itemType: "ability" },
  "class-skills": { pack: "class-skills", documentType: "Item", itemType: "ability" },
  "master-essences": { pack: "master-essences", documentType: "Item", itemType: "masterEssence" },
  "command-spells": { pack: "command-spells", documentType: "Item", itemType: "commandSpell" },
  abilities: { pack: "class-skills", documentType: "Item", itemType: "ability" },
  servants: { pack: "servants", documentType: "Actor", actorType: "servant" },
  masters: { pack: "masters", documentType: "Actor", actorType: "master" },
});

/* -------------------------------------------------------------------------- */
/*  Ids                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Derive a stable Foundry `_id` from a content id.
 *
 * Deterministic, so rebuilding does not churn ids and a world that already
 * imported a Servant keeps its links when the content is edited. Foundry
 * requires exactly 16 alphanumeric characters.
 *
 * @param {string} contentId
 * @returns {string}
 */
export function documentId(contentId) {
  const hex = createHash("sha1").update(`fgt:${contentId}`).digest("hex");
  // Map hex to an alphanumeric alphabet so ids never start with a digit-only
  // run that Foundry's validator dislikes.
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let k = 0; k < 16; k++) {
    out += alphabet[parseInt(hex.slice(k * 2, k * 2 + 2), 16) % alphabet.length];
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Reference resolution                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Resolve `{ ref: id, ...params }` entries against the template library.
 *
 * The indirection is the point: Magic Resistance is authored once and
 * instantiated eleven times at seven ranks, so fixing it fixes every Servant
 * that has it. `@param` placeholders inside the template are substituted with
 * the supplied values.
 *
 * @param {object} entry either a `{ref}` object or an inline ability
 * @param {Map<string, object>} library id → template
 * @param {string[]} problems appended to on failure
 * @param {string} where for error messages
 * @returns {object|null}
 */
export function resolveRef(entry, library, problems, where) {
  if (!entry || typeof entry !== "object") {
    problems.push(`${where}: ability entry is not an object`);
    return null;
  }
  if (!entry.ref) return entry; // authored inline

  const template = library.get(entry.ref);
  if (!template) {
    problems.push(`${where}: ref "${entry.ref}" does not resolve to any known document`);
    return null;
  }

  const params = { ...entry };
  delete params.ref;

  for (const required of template.parameterized ?? []) {
    if (!(required in params)) {
      problems.push(`${where}: ref "${entry.ref}" requires the parameter "${required}"`);
    }
  }

  return { ...substitute(template, params), _ref: entry.ref, ...params };
}

/**
 * Replace `"@name"` placeholders throughout a template with supplied values.
 * Only whole-string placeholders are substituted; embedded ones are left alone
 * for the runtime expression evaluator.
 * @param {unknown} node
 * @param {Record<string, unknown>} params
 * @returns {unknown}
 */
export function substitute(node, params) {
  if (typeof node === "string") {
    const m = /^@(\w+)$/.exec(node);
    return m && m[1] in params ? params[m[1]] : node;
  }
  if (Array.isArray(node)) return node.map((n) => substitute(n, params));
  if (node && typeof node === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = substitute(v, params);
    return out;
  }
  return node;
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Validate the whole content set.
 *
 * @param {Array<{path: string, dir: string, doc: object}>} files
 * @returns {{problems: string[], warnings: string[]}}
 */
export function validateAll(files) {
  /** @type {string[]} */ const problems = [];
  /** @type {string[]} */ const warnings = [];

  // ── Structural ──────────────────────────────────────────────────────────
  /** @type {Map<string, string>} */
  const byId = new Map();
  for (const { path, doc } of files) {
    if (!doc || typeof doc !== "object") {
      problems.push(`${path}: file does not contain a mapping`);
      continue;
    }
    if (doc.schema !== SCHEMA_VERSION) {
      problems.push(`${path}: schema is ${JSON.stringify(doc.schema)}, expected ${SCHEMA_VERSION}`);
    }
    for (const field of ["id", "name"]) {
      if (!doc[field]) problems.push(`${path}: missing required field "${field}"`);
    }
    if (doc.id) {
      if (byId.has(doc.id)) problems.push(`${path}: duplicate id "${doc.id}" (also in ${byId.get(doc.id)})`);
      else byId.set(doc.id, path);
    }
  }

  const library = new Map(files.filter((f) => f.doc?.id).map((f) => [f.doc.id, f.doc]));

  // ── Domain ──────────────────────────────────────────────────────────────
  for (const { path, doc } of files) {
    if (!doc?.id) continue;
    validateDocument(doc, path, library, problems, warnings);
  }

  return { problems, warnings };
}

/**
 * @param {object} doc
 * @param {string} path
 * @param {Map<string, object>} library
 * @param {string[]} problems
 * @param {string[]} warnings
 */
function validateDocument(doc, path, library, problems, warnings) {
  // Ranks
  for (const [field, value] of rankFields(doc)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.startsWith("@")) continue; // unresolved template param
    try {
      Rank.parseOrNull(value);
    } catch {
      problems.push(`${path}: ${field} is not a valid rank ("${value}")`);
    }
  }

  // Durations and cooldowns
  for (const [field, value] of durationFields(doc)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.startsWith("@")) continue;
    try {
      parseTick(value);
    } catch (err) {
      problems.push(`${path}: ${field} is not a valid duration ("${value}") — ${err.message}`);
    }
  }

  // Rule elements
  for (const [where, el] of ruleElements(doc)) {
    if (!el.key) {
      problems.push(`${path}: ${where} has no "key"`);
      continue;
    }
    if (!RULE_ELEMENT_KEYS.has(el.key)) {
      problems.push(`${path}: ${where} uses unknown rule element key "${el.key}"`);
    }
    if (el.key === "Script" && !el.script) {
      problems.push(`${path}: ${where} is a Script element with no "script" id`);
    }
    // `table:` always names a rank table from Appendix B. The one element that
    // needs a *check* table says `forceTable:` instead -- the field names are
    // kept distinct so a typo in either is caught rather than silently read as
    // the other kind.
    if (el.table && !(el.table in TABLES)) {
      const hint = CHECK_TABLES.has(el.table) ? ` — did you mean forceTable: ${el.table}?` : "";
      problems.push(`${path}: ${where} references unknown table "${el.table}"${hint}`);
    }
    if (el.forceTable !== undefined) {
      if (el.key !== "TableOverride") {
        problems.push(`${path}: ${where} sets "forceTable" but only TableOverride uses it`);
      } else if (!CHECK_TABLES.has(el.forceTable)) {
        problems.push(`${path}: ${where} forces unknown check table "${el.forceTable}"`);
      }
    } else if (el.key === "TableOverride") {
      problems.push(`${path}: ${where} is a TableOverride with no "forceTable"`);
    }
    for (const option of referencedOptions(el.predicate)) {
      if (!looksLikeRollOption(option)) {
        warnings.push(`${path}: ${where} predicate option "${option}" does not match the expected shape`);
      }
    }
  }

  // Effect definitions
  if (doc.polarity !== undefined) {
    if (!POLARITIES.has(doc.polarity)) problems.push(`${path}: unknown polarity "${doc.polarity}"`);
    if (doc.volatility && !VOLATILITIES.has(doc.volatility)) {
      problems.push(`${path}: unknown volatility "${doc.volatility}"`);
    }
    if (doc.stacking && !STACKING.has(doc.stacking)) {
      problems.push(`${path}: unknown stacking rule "${doc.stacking}"`);
    }
  }

  // Cross-references
  for (const field of ["blocks", "blockedBy"]) {
    for (const id of doc[field] ?? []) {
      if (!library.has(id)) problems.push(`${path}: ${field} references unknown id "${id}"`);
    }
  }
  // Mutual exclusion should be declared on both sides, or one of them silently
  // wins depending on application order.
  for (const id of doc.blockedBy ?? []) {
    const other = library.get(id);
    if (other && !(other.blocks ?? []).includes(doc.id) && !(other.blockedBy ?? []).includes(doc.id)) {
      warnings.push(`${path}: blockedBy "${id}" is not reciprocated — declare it on both sides`);
    }
  }

  // Ability refs on Servants
  for (const [index, entry] of (doc.abilities ?? []).entries()) {
    resolveRef(entry, library, problems, `${path}: abilities[${index}]`);
  }

  // Effect ids referenced by rule elements must exist
  for (const [where, el] of ruleElements(doc)) {
    const id = el.effect?.id ?? el.effectId;
    if (id && !library.has(id)) {
      problems.push(`${path}: ${where} applies unknown effect "${id}"`);
    }
  }
}

/**
 * A roll option is `subject:facet[:value…]`, all lowercase-ish.
 * @param {string} option
 * @returns {boolean}
 */
function looksLikeRollOption(option) {
  return /^[a-z]+:[a-zA-Z]+(:[\w+-]+)*$/.test(option);
}

/** @param {object} doc @returns {Array<[string, unknown]>} */
function rankFields(doc) {
  /** @type {Array<[string, unknown]>} */
  const out = [];
  if (doc.rank !== undefined) out.push(["rank", doc.rank]);
  for (const [k, v] of Object.entries(doc.parameters ?? {})) out.push([`parameters.${k}`, v]);
  for (const [index, a] of (doc.abilities ?? []).entries()) {
    if (a?.rank !== undefined) out.push([`abilities[${index}].rank`, a.rank]);
  }
  return out;
}

/** @param {object} doc @returns {Array<[string, unknown]>} */
function durationFields(doc) {
  /** @type {Array<[string, unknown]>} */
  const out = [];
  for (const field of ["duration", "cooldown", "sustainability", "defaultDuration"]) {
    if (doc[field] !== undefined) out.push([field, doc[field]]);
  }
  for (const [index, a] of (doc.abilities ?? []).entries()) {
    for (const field of ["duration", "cooldown"]) {
      if (a?.[field] !== undefined) out.push([`abilities[${index}].${field}`, a[field]]);
    }
  }
  for (const [where, el] of ruleElements(doc)) {
    if (el.duration !== undefined) out.push([`${where}.duration`, el.duration]);
  }
  return out;
}

/**
 * Every rule element in a document, with a path for error messages.
 * @param {object} doc
 * @returns {Array<[string, object]>}
 */
export function ruleElements(doc) {
  /** @type {Array<[string, object]>} */
  const out = [];
  const collect = (list, prefix) => {
    for (const [index, el] of (list ?? []).entries()) {
      if (el && typeof el === "object") out.push([`${prefix}[${index}]`, el]);
    }
  };
  collect(doc.rules, "rules");
  collect(doc.passiveRules, "passiveRules");
  collect(doc.activeRules, "activeRules");
  for (const [index, phase] of (doc.phases ?? []).entries()) {
    collect(phase?.rules, `phases[${index}].rules`);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Compilation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Turn one source document into a Foundry document ready for `compilePack`.
 *
 * Rank tables stay **symbolic** rather than being resolved here, because a rank
 * can change at runtime — Semiramis aboard the Hanging Gardens, Kiritsugu under
 * Skill Seal. A Magic Resistance baked to 30% at build time would not respond
 * to a rank shift (Ch. 37 §37.3, step 4).
 *
 * @param {object} doc
 * @param {string} dir the source directory, which selects the pack
 * @param {Map<string, object>} library
 * @returns {object}
 */
export function compileDocument(doc, dir, library) {
  const spec = PACKS[dir];
  if (!spec) throw new Error(`FGT | No pack mapping for source directory "${dir}"`);

  const base = {
    _id: documentId(doc.id),
    name: doc.name,
    img: doc.img ?? undefined,
    _key: null, // filled in below
  };

  if (spec.documentType === "Actor") {
    const abilities = (doc.abilities ?? [])
      .map((entry, index) => resolveRef(entry, library, [], `abilities[${index}]`))
      .filter(Boolean);
    return {
      ...base,
      type: doc.type ?? spec.actorType,
      system: actorSystem(doc),
      items: abilities.map((a) => compileEmbeddedAbility(a, doc.id, base._id)),
      _key: `!actors!${base._id}`,
    };
  }

  return {
    ...base,
    type: doc.type ?? spec.itemType,
    system: itemSystem(doc),
    _key: `!items!${base._id}`,
  };
}

/**
 * @param {object} doc
 * @returns {object}
 */
function actorSystem(doc) {
  return {
    contentId: doc.id,
    trueName: doc.trueName ?? doc.name,
    servantClasses: doc.servantClasses ?? [],
    alignment: doc.alignment ?? null,
    region: doc.region ?? [],
    attributes: doc.attributes ?? [],
    parameters: doc.parameters ?? {},
    baseHealth: doc.baseHealth ?? null,
    mov: doc.mov ?? 0,
    range: doc.range ?? { panels: 1, targets: 1 },
    baseAttack: doc.baseAttack ?? { str: 0, mag: 0 },
    normalAttack: doc.normalAttack ?? { mode: "fixed", component: "str" },
    sustainability: doc.sustainability ?? null,
    notes: doc.notes ?? "",
  };
}

/**
 * @param {object} doc
 * @returns {object}
 */
function itemSystem(doc) {
  return {
    contentId: doc.id,
    description: doc.description ?? "",
    source: doc.source ?? null,
    rank: doc.rank ?? null,
    // The slug defaults to the content id, so `hasSkill(actor, "riding")`
    // matches `class-riding` without every file having to repeat itself.
    slug: doc.slug ?? String(doc.id ?? "").replace(/^class-/, ""),
    isNP: Boolean(doc.isNP),
    isMode: Boolean(doc.isMode),
    isAttackSkill: Boolean(doc.isAttackSkill),
    isSpell: Boolean(doc.isSpell),
    // A Servant's roster entry may switch a mode on at import -- Heracles's Mad
    // Enhancement is on and cannot be turned off.
    active: Boolean(doc.active),
    cannotDeactivate: Boolean(doc.cannotDeactivate),
    categorizedAsNP: Boolean(doc.categorizedAsNP),
    npTags: doc.npTags ?? [],
    cooldown: { max: doc.cooldown ?? null, remaining: 0, regen: 0 },
    targeting: doc.targeting ?? null,
    phases: doc.phases ?? [],
    rules: doc.rules ?? [],
    passiveRules: doc.passiveRules ?? [],
    activeRules: doc.activeRules ?? [],
    // Command Spell fields. Absent from every other document type, and cheap
    // to carry: without them the catalogue compiles into items that know their
    // name and cost and nothing about when they may be used or what they do.
    cost: doc.cost ?? undefined,
    costByMasterRank: doc.costByMasterRank ?? null,
    requirements: doc.requirements ?? [],
    timing: doc.timing ?? null,
    blockedWhen: doc.blockedWhen ?? [],
    effect: doc.effect ?? [],
    permanentConsequence: doc.permanentConsequence ?? [],
    overridesValidation: doc.overridesValidation ?? [],
    parameterized: doc.parameterized ?? [],
    // Effect-definition fields, present only on effect documents.
    polarity: doc.polarity ?? null,
    volatility: doc.volatility ?? null,
    valence: doc.valence ?? null,
    stacking: doc.stacking ?? null,
    baseChance: doc.baseChance ?? null,
    defaultMagnitude: doc.defaultMagnitude ?? null,
    defaultDuration: doc.defaultDuration ?? null,
    unremovable: Boolean(doc.unremovable),
    blocks: doc.blocks ?? [],
    blockedBy: doc.blockedBy ?? [],
  };
}

/**
 * Compile an ability into an item embedded in its owning Actor.
 *
 * Embedded documents need their own `_key` in the pack — the compiler walks the
 * hierarchy and writes each one separately, keyed
 * `!actors.items!<actorId>.<itemId>`.
 *
 * @param {object} ability
 * @param {string} ownerContentId
 * @param {string} ownerDocumentId
 * @returns {object}
 */
function compileEmbeddedAbility(ability, ownerContentId, ownerDocumentId) {
  const id = documentId(`${ownerContentId}/${ability.id ?? ability._ref}`);
  return {
    _id: id,
    name: ability.name ?? ability._ref ?? ability.id,
    type: ability.isNP ? "noblePhantasm" : "ability",
    system: itemSystem(ability),
    _key: `!actors.items!${ownerDocumentId}.${id}`,
  };
}
