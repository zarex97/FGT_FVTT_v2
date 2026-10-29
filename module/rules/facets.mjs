/**
 * @file The predicate facet vocabulary — the authority for what an option may say.
 * @see docs/11-predicates.md, docs/34-action-bar.md
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
const facet = ({ id, subjects = SIDES, segments, forms, english, prose, proseBySubject = null }) => ({
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
  // One subject reads differently: `war:region` is where the War is fought,
  // `self:region` where a Unit is from (#314).
  proseBySubject,
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
    id: "trueName",
    // OPEN on purpose: a Heroic Spirit the roster has no sheet for yet. Gilles
    // de Rais (Saber) names Jeanne d'Arc, and no Jeanne is built (#260 reading
    // 6). The True Name as `rules/named-units.mjs#trueNameSlug` spells it.
    segments: [{ name: "trueName", value: open() }],
    english: "Is a named Heroic Spirit, by True Name.",
    prose: "{subject} is {trueName}",
  }),
  facet({
    id: "allyNamed",
    // An allied Servant of that True Name stands on the board (#260 reading 6).
    segments: [{ name: "trueName", value: open() }],
    english: "Has an allied Servant of a given True Name on the field.",
    prose: "{subject} has an allied {trueName} on the field",
  }),
  facet({
    id: "allyNamedWithin",
    // ...within N panels, as a ladder: `:1` is directly next to it.
    segments: [{ name: "trueName", value: open() }, { name: "panels", value: number() }],
    english: "Has an allied Servant of a given True Name within a number of panels.",
    prose: "{subject} has an allied {trueName} within {panels} panels",
  }),
  facet({
    id: "allyServantAttacked",
    // Another allied Servant has Attacked this Turn: Unparalleled's effect 3
    // is not applied if so (#328 ruling 11).
    english: "Has an allied Servant that has already Attacked this Turn.",
    prose: "{subject} has an allied Servant that has already Attacked this Turn",
  }),
  facet({
    id: "allyAttributeWithin",
    // An allied Unit carrying an Attribute stands within N panels, as a ladder:
    // Triumphal Return's [Star] ally within 2 (#260).
    segments: [{ name: "attribute", value: open() }, { name: "panels", value: number() }],
    english: "Has an allied Unit with a given Attribute within a number of panels.",
    prose: "{subject} has an allied {attribute} Unit within {panels} panels",
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
    id: "order",
    // The first half of an Alignment: Lawful, Neutral, Chaotic. OPEN, as
    // `attribute` is: the morality half already holds "Summer" (Anastasia's
    // *"Chaotic Summer"*), so a closed list would be wrong on its first sheet.
    // Yan Qing Fist's *"Units with the 'Lawful' Alignment"* (#253 reading 1).
    segments: [{ name: "order", value: open() }],
    english: "Its Alignment's order is this: Lawful, Neutral or Chaotic.",
    prose: "{subject} is {order}",
  }),
  facet({
    id: "morality",
    segments: [{ name: "morality", value: open() }],
    english: "Its Alignment's morality is this: Good, Neutral or Evil.",
    prose: "{subject} is {morality}",
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
    id: "bond",
    // An Item bound to its holder by another Unit (Avalon, #230): the holder
    // is her Master, or she is defeated.
    segments: [
      { name: "item", value: open() },
      { name: "relation", value: { kind: "closed", list: ["own", "defeated"] } },
    ],
    english: "Holds an Item another Unit bound to it: its binder's own Master, or its binder is defeated.",
    prose: "{subject}'s {item} bond is {relation}",
  }),
  facet({
    id: "bondWithin",
    // ...and how far she stands, as a ladder: `within:3` holds at 0 to 3.
    segments: [{ name: "item", value: open() }, { name: "panels", value: number() }],
    english: "Holds an Item another Unit bound to it, and that Unit stands within a number of panels.",
    prose: "{subject}'s {item} binder is within {panels}",
  }),
  facet({
    id: "effectStacks",
    // HOW MANY of an effect, as a ladder: *"after Arturia performs 3 Attacks"*
    // (her Utopia count, #230) is a member at 3 and every count above.
    segments: [
      { name: "effect", value: registry("effects") },
      { name: "gte", value: literal("gte") },
      { name: "count", value: number() },
    ],
    english: "Is carrying at least a number of one named effect.",
    prose: "{subject} has at least {count} of {effect}",
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
    id: "paramsVsSelf",
    subjects: ["target"],
    segments: [
      { name: "compare", value: { kind: "closed", list: ["gte", "belowBy2"] } },
      { name: "n", value: number(1, 5) },
    ],
    english: "How many of the target's Parameters are at least the caster's, or two grades below them.",
    prose: "at least {n} of the target's Parameters are {compare} the caster's",
  }),
  facet({
    id: "healthVsSelf",
    subjects: ["target"],
    segments: [{ name: "verdict", value: { kind: "closed", list: ["gt", "eq", "lt"] } }],
    english: "The target's current Health compared against the caster's own.",
    prose: "the target's Health is {verdict} the caster's",
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
    // `self`/`target`: where a Unit is FROM (`unit.region`, Penthesilea's
    // *"Male Units from the Greece region"*). `war`: where the War is fought,
    // Anastasia's *"If the Grail War region is Russia"* (#301). The old text
    // described the War while the option read the Unit.
    subjects: ["self", "target", "war"],
    segments: [{ name: "region", value: open() }],
    english: "Comes from a named Region (a Unit), or is fought in one (the War).",
    prose: "{subject} is from {region}",
    proseBySubject: { war: "the War is fought in {region}" },
  }),
  facet({
    id: "phase",
    // `self`/`target`: the phase at the Unit's own panel (a Darkness area, Sol).
    // `war`: the Round's, `none` when the War plays without the cycle (#314).
    subjects: ["self", "target", "war"],
    segments: [{ name: "phase", value: closed("PHASES") }],
    english: "Day or Night where a Unit stands, or the Round's own (the War); none without the cycle.",
    prose: "{subject} stands in {phase}",
    proseBySubject: { war: "the Round is {phase}" },
  }),
  facet({
    id: "class",
    // A Servant's Class (#286): *"All damage dealt to Caster-class Servants"*.
    // `target:class:same`: Kazuradrop's *"the same Servant Class as herself"*.
    forms: [
      [{ name: "class", value: closed("SERVANT_CLASSES") }],
      [{ name: "same", value: literal("same") }],
    ],
    english: "Is a Servant of a named Class, or of the same Class as the bearer.",
    prose: "{subject} is a {class}-class Servant",
  }),
  facet({
    id: "classGroup",
    // *"Standard Class Servants"*, *"Extra-class Servants"*, *"Knight-class"* (#314).
    segments: [{ name: "group", value: closed("CLASS_GROUPS") }],
    english: "Is a Servant of a Standard, an Extra or a Knight Class.",
    prose: "{subject} is a {group}-class Servant",
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
    // A pool that is EMPTY, rather than a threshold.
    //
    // Drake's broadside: *"if she has no Galleon Tokens, Total damage dealt is
    // reduced by 15%."* The positive side of that clause is `perResource` on
    // the modifier itself -- it scales with what she holds and contributes
    // nothing at zero -- so the only thing a predicate has to answer is the
    // penalty's condition, which is exactly "none".
    //
    // Emitted for every pool the unit carries, so a clause about a pool the
    // unit does not have at all is false rather than accidentally true.
    id: "resourceEmpty",
    segments: [{ name: "resource", value: open() }],
    english: "Holds none of a named resource.",
    prose: "{subject} has no {resource}",
  }),
  facet({
    id: "onPlatform",
    segments: [{ name: "platform", value: registry("contentIds") }],
    english: "Is aboard a named Platform.",
    prose: "{subject} is aboard {platform}",
  }),
  facet({
    id: "ownsPlatform",
    segments: [{ name: "platform", value: registry("contentIds") }],
    english: "Owns a named Platform that stands on the board.",
    prose: "{subject}'s {platform} stands",
  }),
  facet({
    id: "reaction",
    // CLOSED: the ladder's rungs are a fixed three plus "none", and an enum in
    // `domain/enums.mjs` does not gain a member because somebody mistyped.
    //
    // `none` is a real answer rather than an absence, which is what Nemo's
    // Quickfire needs twice over: it pays him for the defender DECLINING to
    // Counter, and it emits `target:reaction:evade` for a rung that resolves
    // to no roll at all.
    segments: [{ name: "reaction", value: closed("REACTIONS") }],
    english: "Reacted to this attack in a named way, or declined to react.",
    prose: "{subject} reacted with {reaction}",
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
    id: "selfOrSummonsActed",
    english: "Acted this Turn, or one of its summons did.",
    prose: "{subject} or one of its summons acted this Turn",
  }),
  facet({
    // The Unit asked about IS the one asking: a phase that lands on its own
    // caster. Sieg's Heilen restores *"15% ... If used on himself, ... instead
    // 30%"* (#345), a phase each, asked of the Unit healed.
    id: "isSelf",
    subjects: ["target"],
    english: "The Unit is the one acting on it.",
    prose: "{subject} is the one acting",
  }),
  facet({
    id: "ownTurn",
    english: "The Turn ending or beginning is its own side's.",
    prose: "it is {subject}'s own Turn",
  }),
  facet({
    id: "npOnCooldown",
    english: "A Noble Phantasm of its own is on its Cooldown.",
    prose: "a Noble Phantasm of {subject}'s is on its Cooldown",
  }),
  facet({
    id: "lastOfSummonGroup",
    english: "Is the only summon of its summoner still on the board.",
    prose: "{subject} is the last of its summoner's summons",
  }),
  facet({
    id: "withinOfMaster",
    segments: [{ name: "panels", value: number(1, 6) }],
    english: "Is within a number of panels of its OWN contracted Master.",
    prose: "{subject} is within {panels} panels of its own Master",
  }),
  facet({
    id: "isCounter",
    subjects: ["attack"],
    english: "This attack is a Counter, answering one rather than starting it.",
    prose: "the attack is a Counter",
  }),
  facet({
    id: "plainDamage",
    subjects: ["attack"],
    english: "This damage is only measured as an attack's, as a Knockback's is: it is not an Attack.",
    prose: "the damage is measured as an attack's but is not an Attack",
  }),
  facet({
    id: "withinOfPartner",
    segments: [{ name: "panels", value: number(1, 6) }],
    // The other member of a linked group (Ch. 32). Adjacency is `:1`,
    // with no special case: the ladder runs from the actual distance up to 6,
    // exactly as `withinOfMaster` above does, and a unit with no partner on
    // the board emits nothing at all.
    english: "Is within a number of panels of the other member of its linked group.",
    prose: "{subject} is within {panels} panels of its linked partner",
  }),
  facet({
    id: "form",
    segments: [{ name: "form", value: open() }],
    // A form taken, one-way: Gilles (Caster)'s Gigantic Horror (#323).
    english: "Has taken a named form.",
    prose: "{subject} has taken the form {form}",
  }),
  facet({
    id: "withinOfSummoner",
    segments: [{ name: "panels", value: number(1, 6) }],
    // A summon's distance to whoever conjured it: Gilles's Gazing reaches his
    // Horrors within 2 of him (#323). A ladder to 6, as `withinOfPartner` is.
    english: "Is within a number of panels of the Unit that summoned it.",
    prose: "{subject} is within {panels} panels of its summoner",
  }),
  facet({
    id: "summonerEffect",
    segments: [{ name: "effect", value: registry("effects") }],
    // An effect the summon's summoner holds: Gilles's Gazing (#323).
    english: "The Unit that summoned it holds a named effect.",
    prose: "{subject}'s summoner has {effect}",
  }),
  facet({
    id: "withinOfOwnerMaster",
    segments: [{ name: "panels", value: number(1, 6) }],
    // NOT the unit's own Master -- that is `withinOfMaster` above. This is the
    // Master of whoever OWNS THE FIELD the unit is standing in, stamped by
    // `annotateFields` and absent on open ground. Pale Rider's Contagion:
    // *"if the enemy Unit is within a 3 panel area of Pale Rider's Master"*,
    // asked of a Unit standing inside Doomsday Come.
    english: "Is within a number of panels of the Master of whoever owns the field it is standing in.",
    prose: "{subject} is within {panels} panels of the field owner's Master",
  }),

  /* ── what a use did (`rules/use-record.mjs`, #320) ──────────────────────── */
  facet({
    id: "failed",
    subjects: ["use"],
    english: "The use failed when it was pressed, or missed outright to a miss source.",
    prose: "the use failed",
  }),
  facet({
    id: "missed",
    subjects: ["use"],
    english: "The use hit no Unit, for any reason.",
    prose: "the use hit nobody",
  }),
  facet({
    id: "evaded",
    subjects: ["use"],
    english: "A Unit the use was aimed at Evaded it.",
    prose: "a target Evaded the use",
  }),
  facet({
    id: "overCooldown",
    subjects: ["use"],
    english: "The ability was used on its Cooldown, at a price.",
    prose: "the use was made on its Cooldown",
  }),
  facet({
    id: "channelStarted",
    subjects: ["use"],
    english: "The use began a channel that has not gone off yet.",
    prose: "the use began a channel",
  }),
  facet({
    id: "concealmentBroken",
    subjects: ["use"],
    english: "Using it broke its user's Presence Concealment.",
    prose: "the use broke Presence Concealment",
  }),
  facet({
    id: "applied",
    subjects: ["use"],
    // OPEN: an Effect id, the set growing with content as `effect` does.
    segments: [{ name: "effect", value: open() }],
    english: "The use applied a named Effect to some Unit.",
    prose: "the use applied {effect}",
  }),
  facet({
    id: "die",
    subjects: ["use"],
    // Unbounded: a bounded number is one character class (`[1-6]`), and a
    // d100's face is up to three digits.
    segments: [{ name: "face", value: number() }],
    english: "The die the use rolled showed this face.",
    prose: "the use's die showed {face}",
  }),
  facet({
    id: "source",
    subjects: ["revival"],
    // OPEN: a revival source is a `RevivalSource` element's own `id`, authored
    // per ability (`guts`, `undying`, `godHand`, `battleContinuation`), so the
    // set grows with content the way `attribute` does.
    segments: [{ name: "source", value: open() }],
    english: "The revival that just fired came from a named source.",
    prose: "revived by {source}",
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
    id: "performed",
    subjects: ["attack"],
    english: "The Unit hearing the event made the attack.",
    prose: "the Unit performed the attack",
  }),
  facet({
    id: "component",
    subjects: ["attack"],
    segments: [{ name: "component", value: closed("COMPONENTS") }],
    english: "The attack uses Base Attack (STR) or Base Attack (MAG).",
    prose: "the attack uses Base Attack ({component})",
  }),
  facet({
    // The BASE the attack adds up, which `component` is not. `component` is
    // what the attack COUNTS AS -- Mana Burst declares `str` on purpose, so
    // that "not affected by Magic Resistance" is stated once and Magic
    // Resistance's own Instakill exemption reads the same word -- while the
    // base it sums is BA(STR) + BA(MAG). *"Halved for Attacks which use Base
    // Attack (MAG)"* is a clause about the second, and Mad Enhancement read the
    // first (#209 reading 3, ruled 2026-10-14). Derived by the damage pipeline
    // from the sources stage 1 actually adds (`damage/pipeline.mjs#stage1Base`),
    // never emitted by `rollOptionsFor`: the base is built beside it.
    id: "usesBase",
    subjects: ["attack"],
    segments: [{ name: "component", value: closed("COMPONENTS") }],
    english: "The attack's Base Attack includes Base Attack (STR) or Base Attack (MAG), whatever it counts as.",
    prose: "the attack's base includes Base Attack ({component})",
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
    // `{R}`, `{M}` or `{S}` as the sheet states it, else measured by Range
    // (`rules/delivery.mjs#deliveryOf`, #281). Special is neither of the others.
    id: "delivery",
    subjects: ["attack"],
    segments: [{ name: "delivery", value: closed("DELIVERIES") }],
    english: "The attack is Ranged, Melee or Special.",
    prose: "the attack is {delivery}",
  }),
  facet({
    // Which of the defender's four cones it came from, stamped at the
    // declaration (#184). Protection from Arrows reads it.
    id: "cone",
    subjects: ["attack"],
    segments: [{ name: "cone", value: closed("CONES") }],
    english: "The attack came from the defender's front, left, right or back.",
    prose: "the attack came from the {cone}",
  }),
  facet({
    // An effect its user held when the Attack was declared (#336): what a charge
    // spent by "the next" Noble Phantasm asks, so an NP declared before the
    // charge was gained does not spend it.
    id: "heldAtDeclaration",
    subjects: ["attack"],
    segments: [{ name: "effect", value: open() }],
    english: "Its user held a named effect when the attack was declared.",
    prose: "its user held {effect} when it was declared",
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
    // The attacker's damage-dealt modifier against it, or the attack's own
    // stage-3 row (`rules/options.mjs#antiAttributesOf`, #341 ruling 5).
    english: "The attack is one that hits a named Attribute especially hard.",
    prose: "the attack is effective against {attribute}",
  }),
  facet({
    id: "tag",
    subjects: ["attack"],
    // Every tag the attack carries, the qualifiers included: Arturia's Magic
    // Resistance is weaker against *"an Attack with the 'Anti-Dragon'
    // Attribute"* (#230), and `npScale` names the scale alone.
    segments: [{ name: "tag", value: open() }],
    english: "The attack carries a named tag, such as Anti-Dragon.",
    prose: "the attack is {tag}",
  }),
  facet({
    id: "madeWith",
    subjects: ["attack"],
    // WHICH ABILITY made the attack, by content id: *"Normal Attacks performed
    // with Mana Burst"* (Arturia's DRC, #230). A bare Normal Attack has none.
    segments: [{ name: "ability", value: open() }],
    english: "The attack was made with a named ability.",
    prose: "the attack is made with {ability}",
  }),
  facet({
    id: "inflicts",
    subjects: ["attack"],
    // WHAT the attack's own phases inflict on the Unit it hits, by effect id:
    // Soaked's Freeze chance adds to the Attack's own, or rolls alone when it
    // has none (#258 reading 4). From `rules/damage/riders.mjs#inflictedEffectIds`.
    segments: [{ name: "effect", value: open() }],
    english: "The attack's own effects include a named effect on the Unit it hits.",
    prose: "the attack inflicts {effect}",
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
  // Damage dealt, not only a hit: Nursery's Enigma (#247 reading 2).
  facet({
    id: "dealtDamage",
    subjects: ["attack"],
    english: "The attack dealt damage.",
    prose: "the attack dealt damage",
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
