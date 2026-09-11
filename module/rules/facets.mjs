/**
 * @file The predicate facet vocabulary — the authority for what an option may say.
 * @see docs/24-rules-engine.md §24.4, docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure data.
 *
 * **This table generates `options.mjs#EMITTABLE`.** The other four authoring
 * vocabularies are held against a dispatcher by a drift test, because a
 * dispatcher is code. This one is not: `EMITTABLE` was 37 regexes describing a
 * string shape, which is exactly what a descriptor with typed segments is — so
 * keeping both would be two spellings of one fact, tested to agree.
 *
 * Generating also buys what a test cannot. `rollOptionsFor` can emit through
 * {@link emitPattern}'s vocabulary and therefore **cannot produce an undeclared
 * option**. Before, it built strings with template literals, so a typo in the
 * *generator* produced an option no predicate could ever name — silent in the
 * opposite direction from a typo in content.
 *
 * **On value kinds, and why they are not treated alike.**
 *
 *   - `closed` **errors**. An enum in `domain/enums.mjs` does not gain a member
 *     because somebody mistyped, so strictness costs nothing.
 *   - `registry` **warns**. A content vocabulary still being written must be
 *     able to name what is coming: `outsider` and `undead` are named by six
 *     authored clauses and granted by no unit, because they are forward
 *     references to Servants not yet built. A registry that errored would fail
 *     the build on legitimate content.
 *   - `open` is checked for shape alone, **and says so**. Roughly twenty facets
 *     end in a free identifier with no authority anywhere; making that a
 *     declared property rather than an accident is the point.
 *
 * Five facets close over an enum they were not using. `self:highestParameter:strength`
 * passed validation for the whole life of the field and could never match,
 * because the parameter is `str`.
 */

import * as ENUMS from "../domain/enums.mjs";

/** Both unit-facing namespaces. */
const SIDES = Object.freeze(["self", "target"]);

/** A value drawn from a frozen list in `domain/enums.mjs`. */
const closed = (from) => ({ kind: "closed", from });

/** A value drawn from loaded content. Warns when nothing defines it; never errors. */
const registry = (from) => ({ kind: "registry", from });

/** A free identifier. Nothing checks it, and the descriptor says so. */
const open = () => ({ kind: "open", shape: "identifier" });

/** A fixed word between two values — the `gte` in `self:rank:str:gte:B`. */
const literal = (is) => ({ kind: "literal", is });

/** A number, optionally bounded. */
const number = (min, max) => ({ kind: "number", ...(min === undefined ? {} : { min, max }) });

/**
 * @param {object} spec
 * @returns {object}
 */
const facet = ({ id, subjects = SIDES, segments, forms, english, prose }) => ({
  id,
  subjects,
  // A facet normally has one shape. `attack:range` has two — a bare distance
  // and a comparison — so the general case is a list of forms and `segments`
  // is sugar for the single one.
  forms: Object.freeze((forms ?? [segments ?? []]).map(Object.freeze)),
  segments: Object.freeze(forms ? forms[0] : (segments ?? [])),
  label: `FGT.Predicate.Facet.${id}`,
  hint: `FGT.Predicate.Facet.${id}Hint`,
  english,
  prose,
  doc: "24-rules-engine.md",
});

export const FACETS = Object.freeze([
  /* ── what a Unit is ──────────────────────────────────────────────────── */
  facet({
    id: "type",
    segments: [{ name: "kind", value: closed("UNIT_KINDS") }],
    english: "Is a Servant, a Master, a Summon, a Platform, a Structure or a Civilian.",
    prose: "{subject} is a {kind}",
  }),
  facet({
    id: "contentId",
    segments: [{ name: "contentId", value: registry("contentIds") }],
    english: "Is one named Unit specifically, by its content id.",
    prose: "{subject} is {contentId}",
  }),
  facet({
    id: "attribute",
    // OPEN on purpose. See the header: `outsider` and `undead` are authored
    // against Servants that do not exist yet.
    segments: [{ name: "attribute", value: open() }],
    english: "Carries a named Attribute — Large, Divine, Undead, Outsider.",
    prose: "{subject} has the {attribute} attribute",
  }),
  facet({
    id: "variant",
    segments: [{ name: "variant", value: open() }],
    english: "Is in a named summon variant — Semiramis's Double Summon shapes.",
    prose: "{subject} is the {variant} variant",
  }),
  facet({
    id: "free",
    english: "Has no Master: the Servant is Free or Unbound.",
    prose: "{subject} is a Free Servant",
  }),
  facet({
    id: "masterTier",
    segments: [{ name: "tier", value: { kind: "closed", list: ["high", "low", "rankless"] } }],
    english: "The Master pays the High Rank column, the Low one, or is Rankless.",
    prose: "{subject}'s Master is {tier} rank",
  }),

  /* ── what a Unit carries ─────────────────────────────────────────────── */
  facet({
    id: "effect",
    segments: [{ name: "effect", value: registry("effects") }],
    english: "Is currently carrying a named effect.",
    prose: "{subject} has {effect}",
  }),
  facet({
    id: "effectFamily",
    segments: [{ name: "family", value: open() }],
    english: "Is carrying any effect from a named family.",
    prose: "{subject} has an effect of the {family} family",
  }),
  facet({
    id: "skill",
    segments: [{ name: "slug", value: registry("abilitySlugs") }],
    english: "Has a named Skill at all, active or not.",
    prose: "{subject} has {slug}",
  }),
  facet({
    id: "skillActive",
    segments: [{ name: "slug", value: registry("abilitySlugs") }],
    english: "Has a named mode switched ON — not merely possessing it.",
    prose: "{subject} has {slug} switched on",
  }),
  facet({
    id: "skillRank",
    segments: [
      { name: "slug", value: registry("abilitySlugs") },
      { name: "gte", value: literal("gte") },
      { name: "grade", value: closed("GRADES") },
    ],
    english: "Has a named Skill at a given Rank or better.",
    prose: "{subject} has {slug} at rank {grade} or better",
  }),

  /* ── numbers and ranks ───────────────────────────────────────────────── */
  facet({
    id: "rank",
    segments: [
      // CLOSED now. It was `[A-Za-z]+`, so a mistyped parameter authored
      // cleanly and never matched.
      { name: "parameter", value: closed("PARAMETERS") },
      { name: "gte", value: literal("gte") },
      { name: "grade", value: closed("GRADES") },
    ],
    english: "A Parameter stands at a given grade or better.",
    prose: "{subject}'s {parameter} is {grade} or better",
  }),
  facet({
    id: "highestParameter",
    segments: [{ name: "parameter", value: closed("PARAMETERS") }],
    english: "A named Parameter is this Unit's highest.",
    prose: "{parameter} is {subject}'s highest Parameter",
  }),
  facet({
    id: "npAboveAllParameters",
    english: "The Noble Phantasm's rank is above every one of this Unit's Parameters.",
    prose: "{subject}'s Noble Phantasm outranks all its Parameters",
  }),
  facet({
    id: "paramVsSelf",
    subjects: ["target"],
    segments: [
      { name: "parameter", value: closed("PARAMETERS") },
      { name: "verdict", value: { kind: "closed", list: ["gt", "eq", "lt"] } },
    ],
    english: "The target's Parameter compared against the caster's own.",
    prose: "the target's {parameter} is {verdict} the caster's",
  }),
  facet({
    id: "stableDie",
    segments: [
      { name: "die", value: literal("d6") },
      { name: "face", value: number(1, 6) },
    ],
    english: "A die face derived from the Unit's id — the same answer every time.",
    prose: "{subject}'s stable d6 reads {face}",
  }),

  /* ── where a Unit stands ─────────────────────────────────────────────── */
  facet({
    id: "stance",
    segments: [{ name: "stance", value: open() }],
    english: "Is mounted, or dismounted — Achilles's whole sheet turns on it.",
    prose: "{subject} is {stance}",
  }),
  facet({
    id: "region",
    segments: [{ name: "region", value: open() }],
    english: "The war is being fought in a named Region.",
    prose: "the war is in {region}",
  }),
  facet({
    id: "phase",
    segments: [{ name: "phase", value: closed("PHASES") }],
    english: "Only during the day, or only during the night.",
    prose: "it is {phase}",
  }),
  facet({
    id: "inHomeBase",
    english: "Is standing inside its own faction's Home Base.",
    prose: "{subject} is in its Home Base",
  }),
  facet({
    id: "inField",
    segments: [{ name: "field", value: open() }],
    english: "Is standing inside a named bounded field.",
    prose: "{subject} is inside {field}",
  }),
  facet({
    id: "fieldActive",
    segments: [{ name: "field", value: open() }],
    english: "A named bounded field is open somewhere on the board.",
    prose: "{field} is open",
  }),
  facet({
    id: "onPlatform",
    segments: [{ name: "platform", value: registry("contentIds") }],
    english: "Is aboard a named Platform.",
    prose: "{subject} is aboard {platform}",
  }),
  facet({
    id: "terrain",
    // `registry`, not `closed`: `rules/terrain.mjs`'s TERRAIN table is
    // content-adjacent and grows -- Imaginary Numbers Space was added for one
    // Servant -- and a build that errored on a type a later chapter introduces
    // would be refusing legitimate content. It warns instead, which is the
    // rule this file's header sets out for exactly this case.
    segments: [{ name: "type", value: registry("terrainTypes") }],
    english: "Is standing in a named type of Terrain.",
    prose: "{subject} is in {type} terrain",
  }),
  facet({
    id: "withinOfOwnerMaster",
    segments: [{ name: "panels", value: number(1, 6) }],
    english: "Is within a number of panels of its own Master.",
    prose: "{subject} is within {panels} panels of its Master",
  }),

  /* ── the attack being resolved ───────────────────────────────────────── */
  facet({
    id: "kind",
    subjects: ["attack"],
    segments: [{ name: "kind", value: open() }],
    english: "The attack is a Normal Attack, a Skill or a Noble Phantasm.",
    prose: "the attack is a {kind}",
  }),
  facet({
    id: "isAoE",
    subjects: ["attack"],
    english: "The attack covers an area rather than one target.",
    prose: "the attack covers an area",
  }),
  facet({
    id: "component",
    subjects: ["attack"],
    segments: [{ name: "component", value: closed("COMPONENTS") }],
    english: "The attack uses Base Attack (STR) or Base Attack (MAG).",
    prose: "the attack uses Base Attack ({component})",
  }),
  facet({
    id: "element",
    subjects: ["attack"],
    // CLOSED now. Karna's Mana Burst resists by element and a typo here
    // produced a resistance that never applied.
    segments: [{ name: "element", value: closed("ELEMENTS") }],
    english: "The attack deals damage of a named element.",
    prose: "the attack is {element}",
  }),
  facet({
    id: "npScale",
    subjects: ["attack"],
    segments: [
      { name: "gte", value: literal("gte") },
      { name: "scale", value: closed("NP_TAG_SCALE") },
    ],
    english: "The Noble Phantasm is of a given scale or larger — Anti-Army and above.",
    prose: "the Noble Phantasm is {scale} or larger",
  }),
  facet({
    id: "vsAttribute",
    subjects: ["attack"],
    segments: [{ name: "attribute", value: open() }],
    english: "The attack is one that hits a named Attribute especially hard.",
    prose: "the attack is effective against {attribute}",
  }),
  facet({
    id: "ignoresMagicResistance",
    subjects: ["attack"],
    english: "The attack is one Magic Resistance does not see.",
    prose: "the attack ignores Magic Resistance",
  }),
  facet({
    id: "aim",
    subjects: ["attack"],
    english: "The attacker took Aim.",
    prose: "the attacker aimed",
  }),
  facet({
    id: "pierce",
    subjects: ["attack"],
    english: "The attack pierces.",
    prose: "the attack pierces",
  }),
  facet({
    id: "thrownWeapon",
    subjects: ["attack"],
    english: "The attack is made with a thrown weapon.",
    prose: "the attack is thrown",
  }),
  facet({
    id: "crit",
    subjects: ["attack"],
    english: "The attack critically hit.",
    prose: "the attack is a critical hit",
  }),
  facet({
    id: "range",
    subjects: ["attack"],
    // TWO forms: the exact distance, and the comparison ladder.
    forms: [
      [{ name: "panels", value: number() }],
      [
        { name: "compare", value: { kind: "closed", list: ["gte", "lte"] } },
        { name: "panels", value: number() },
      ],
    ],
    english: "How far away the target is, exactly or as a threshold.",
    prose: "the target is at range {panels}",
  }),
]);

/**
 * @param {object} seg
 * @returns {string} the regex source for one segment
 */
function sourceFor(seg) {
  const v = seg.value;
  switch (v.kind) {
    case "literal":
      return v.is;
    case "closed":
      return `(?:${(v.list ?? ENUMS[v.from]).join("|")})`;
    case "number":
      return v.min === undefined ? "\\d+" : `[${v.min}-${v.max}]`;
    default:
      // `registry` and `open` are both identifiers at the shape level. What
      // separates them is whether anything is asked afterwards.
      return "[A-Za-z][\\w-]*";
  }
}

/**
 * Every pattern one facet admits — one per subject, per form.
 *
 * @param {object} f
 * @returns {RegExp[]}
 */
export function patternFor(f) {
  return f.forms.flatMap((form) => {
    const tail = form.map((s) => `:${sourceFor(s)}`).join("");
    return f.subjects.map((subject) => new RegExp(`^${subject}:${f.id}${tail}$`));
  });
}

/** @type {readonly RegExp[]} */
export const GENERATED_EMITTABLE = Object.freeze(FACETS.flatMap(patternFor));

/**
 * Split an option into its parts, or `null` if no facet admits it.
 *
 * `null` rather than a throw: a module's compendium may name anything, and both
 * callers — the builder and `explain()` — fall back rather than refusing to
 * render.
 *
 * @param {string} option a bare option, `not:` already stripped
 * @returns {{subject: string, facet: string, segments: Record<string, string>}|null}
 */
export function parseOption(option) {
  const parts = String(option).split(":");
  const [subject, id, ...rest] = parts;
  const f = FACETS.find((x) => x.id === id && x.subjects.includes(subject));
  if (!f) return null;

  for (const form of f.forms) {
    const tail = form.map((s) => `:${sourceFor(s)}`).join("");
    if (!new RegExp(`^${subject}:${id}${tail}$`).test(option)) continue;

    /** @type {Record<string, string>} */
    const segments = {};
    form.forEach((seg, i) => {
      // A literal is punctuation, not a value: `gte` in `rank:str:gte:B` is
      // there to be read, not to be offered in a picker.
      if (seg.value.kind !== "literal") segments[seg.name] = rest[i];
    });
    return { subject, facet: id, segments };
  }
  return null;
}

/**
 * Which `@`-roots a predicate may reference, and what shape they take.
 *
 * `ctx.refs` is built four different ways and the two `self` shapes disagree:
 * `@self.health` is `{value, max}` under `expressionRefs` and a **number**
 * under a unit snapshot (`rules/snapshot.mjs:159`). A picker offering one flat
 * list would happily emit a path that cannot resolve where it sits — and
 * `predicate.mjs#num` throws on that rather than failing quietly.
 *
 * Unifying the two shapes touches `expressionRefs`, four call sites and every
 * authored magnitude that reads a path; it is recorded in Ch. 41 rather than
 * done here. This is what stops the editor from making the problem worse.
 */
export const REF_SCOPES = Object.freeze({
  /** `expressionRefs(actor)` — most rule elements. It supplies no `target`. */
  ownerOnly: Object.freeze({ roots: Object.freeze(["self"]), shape: "document" }),
  /** The damage pipeline and targeting resolution. */
  exchange: Object.freeze({
    roots: Object.freeze(["self", "target", "attack", "board"]),
    shape: "snapshot",
  }),
});
