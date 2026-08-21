/**
 * @file Projection from Foundry documents to plain data.
 * @see docs/03-domain-overview.md §3.4
 *
 * Layer 2 (rules). Pure in the sense that matters: it takes documents as
 * **arguments** and reads their fields. It never touches a global, never
 * writes, and never awaits — so the whole rules layer downstream of it can be
 * tested with hand-built objects, which is exactly what the 253 tests do.
 *
 * A snapshot is built once per *operation* — one attack, one skill use — not
 * per predicate evaluation. Rebuilding 28 units × 30 effects for every
 * predicate would be pathological, and the memoization key is the actor's
 * `_stats.modifiedTime` plus a system-maintained `derivedVersion` counter that
 * the effect engine bumps.
 */

import { Rank } from "../domain/rank.mjs";
import { collectContributions } from "./elements.mjs";
import { annotateZon } from "./zon.mjs";
import { annotateAuras } from "./auras.mjs";
import { EffectRegistry } from "./registry.mjs";
import { buildAuraIndex } from "./aura-index.mjs";
import { annotateTerrain } from "./terrain.mjs";
import {
  phase, darkModifiers, homeBaseModifiers, regionBonusFor, inOwnHomeBase,
} from "./environment.mjs";
import { annotateCompulsions } from "./compulsion.mjs";
import { rollOptionsFor } from "./options.mjs";
import { platformsOn, crossLevelRulesFor } from "./platforms.mjs";
import { annotateFields } from "./bounded-fields.mjs";

/**
 * @typedef {object} UnitSnapshot
 * @property {string} id
 * @property {string} kind
 * @property {import("../domain/geometry.mjs").GridOffset} panel
 * @property {number|null} health `null` means intrinsically undamageable
 */

/**
 * Project one actor into a `UnitSnapshot`.
 *
 * @param {object} actor an `FGTActor`
 * @param {object} [opts]
 * @param {object} [opts.token] the placed token, for position and facing
 * @param {number|null} [opts.tick] the current ◈ tick. Turn state stamped with
 *   an earlier one is stale and projects blank — see {@link turnStateAt}.
 * @returns {UnitSnapshot}
 */
export function snapshotUnit(actor, { token = null, panel = null, tick = null } = {}) {
  const sys = actor.system ?? {};
  const doc = token ?? actor.token ?? null;
  const contributions = contributionsOf(actor);
  const footprint = gridFootprint(doc, panel);
  const turnState = turnStateAt(sys.turnState, tick);

  return {
    id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    kind: actor.type,
    factionId: sys.factionId ?? null,
    faction: sys.factionId ?? null,

    // GRID OFFSETS, never pixels. `doc.x`/`doc.y` are pixel coordinates, and
    // reading them as offsets made two adjacent tokens a hundred panels apart.
    panel: footprint[0],
    panels: footprint.length > 1 ? footprint : (sys.panels ?? null),
    level: footprint[0].k ?? doc?.elevation ?? 0,
    platformId: sys.platformId ?? null,
    facing: sys.facing ?? "n",

    // `null` is a legal health value meaning "cannot be damaged and cannot be
    // healed" — Pale Rider and the Kagome Spirits. Distinct from Invuln, which
    // is a removable buff halved against NPs.
    health: sys.health?.value ?? null,
    maxHealth: sys.health?.max ?? null,
    agility: sys.agility?.value ?? 0,
    luck: sys.luck?.value ?? 0,
    mov: sys.mov ?? 0,
    // The NUMBER of panels, not the `{panels, targets}` schema object. Every
    // consumer compares it against a distance, and comparing a distance to an
    // object is silently false rather than an error.
    range: sys.range?.panels ?? (typeof sys.range === "number" ? sys.range : 1),
    maxTargets: sys.range?.targets ?? 1,
    shield: sys.shield ?? 0,

    // `null` means the Sustainability clock does not exist for this unit
    // (Independent Action A+/EX), not that it is very large.
    sustainability: sys.sustainability ?? null,
    contract: sys.contract ?? "contracted",
    commandSpells: sys.commandSpells ?? 0,

    parameters: parseParameters(sys.parameters),
    baseAttack: { str: sys.baseAttack?.str ?? 0, mag: sys.baseAttack?.mag ?? 0 },
    // Abilities can grant attributes -- Divinity grants `divine`, which is what
    // Karna's Vasavi Shakti and Scathach's God Slayer key on.
    attributes: [...new Set([...(sys.attributes ?? []), ...contributions.attributes])],
    // Where the unit is from. Predicates name it -- "damage dealt to Male Units
    // from the Greece region" -- and nothing carried it before.
    region: [...(sys.region ?? [])],
    // The unit's OWN auras, unexpanded. `snapshotBoard` runs `annotateAuras`
    // once every unit exists and appends what each unit actually stands in to
    // its `modifiers`. A unit snapshotted alone receives only its own auras --
    // correct, because an ally aura includes its bearer.
    auras: contributions.auras ?? [],
    // Read by `effect-applier` when it computes an incoming effect's chance.
    applicationChances: contributions.applicationChances ?? [],
    // Expanded by `annotateCompulsions` once the board exists.
    compulsionRules: contributions.compulsions ?? [],
    alignment: sys.alignment ?? null,

    effects: activeEffectIds(actor),
    effectInstances: effectInstances(actor),
    modifiers: contributions.modifiers,
    abilities: collectAbilities(actor),
    // §6.10's pools, so a gate or a cooldown waiver can ask what the Unit
    // holds without reaching for the document. Copied one level deep, because
    // this layer is pure and must not hand a live document's object to a rule.
    resources: Object.fromEntries(
      Object.entries(sys.resources ?? {}).map(([k, v]) => [k, { value: v?.value ?? 0, max: v?.max ?? null }]),
    ),
    // Riding decides whether this unit may move again after attacking, and
    // three separate places were each deciding it for themselves — two of them
    // by reaching for `game.actors` from a layer that may not. One projection.
    hasRiding: hasSkill(actor, "riding"),
    eventHandlers: contributions.eventHandlers,
    immunities: contributions.immunities,
    grantedAbilities: contributions.grantedAbilities,
    autoSucceeds: contributions.autoSucceeds,
    checkModifiers: contributions.checkModifiers,
    damageNegation: contributions.damageNegation,
    // Informational. `FGTActor#prepareDerivedData` has ALREADY folded these
    // into `mov`, `range`, `agility` and friends above -- this list is here so
    // a sheet can explain the number, not so a consumer can apply it again.
    statDeltas: contributions.statDeltas,

    magicResistance: contributions.magicResistance ?? magicResistanceOf(actor),

    // Which component a normal attack draws on. The preview reads this to build
    // the same base spec the real attack will; without it a MAG attacker was
    // previewed as a STR one.
    normalAttack: {
      mode: sys.normalAttack?.mode ?? "fixed",
      component: sys.normalAttack?.component ?? "str",
    },

    // ZON belongs to the Master-Servant pair, so a per-unit projection cannot
    // finish it: `snapshotBoard` runs `annotateZon` once the other units exist
    // and overwrites the three fields below. A unit snapshotted alone reports
    // "inside", which is the safe answer -- the penalty applies to a Servant
    // provably outside its Master's zone, not to one we could not measure.
    servantClasses: [...(sys.servantClasses ?? [])],
    masterId: sys.masterId ?? null,
    zonBonuses: contributions.zonBonuses ?? [],
    zonExempt: Boolean(sys.zonExempt),
    zonPartnerIds: [...(sys.zonPartnerIds ?? [])],
    zon: sys.zon ?? null,
    zonDistance: sys.zonDistance ?? null,
    outsideZon: Boolean(sys.outsideZon),
    zones: [...(sys.zones ?? [])],
    // Platform fields; harmless on anything that is not one.
    footprint: sys.footprint ?? null,
    capacity: sys.capacity ?? null,
    ownerId: sys.ownerId ?? null,
    crossLevel: sys.crossLevel ?? null,
    concealed: Boolean(sys.concealed),
    // Identity and Detect (Ch. 04 §4.2, Ch. 08 §8.7).
    trueName: sys.trueName ?? null,
    classContainer: sys.classContainer ?? [...(sys.servantClasses ?? [])][0] ?? null,
    concealedIdentity: sys.concealedIdentity || null,
    identityRevealed: Boolean(sys.identityRevealed),
    detect: sys.detect ?? null,
    canAct: sys.canAct !== false,
    acted: turnState.acted,
    turnState,
  };
}

/**
 * A unit's turn state, or a blank one when it belongs to an earlier tick.
 *
 * The turn state is per-turn by definition, so state written during tick 4 says
 * nothing about tick 5. Deciding that on **read** is what makes the reset
 * reliable: the previous design cleared it by writing a blank state at each
 * turn boundary, and a boundary hook that did not fire left a Unit permanently
 * out of movement with nothing to explain it. A stale stamp cannot fail in that
 * direction — the worst it does is forget something a Unit had already done.
 *
 * `tick: null` on the caller's side means "do not apply the rule" — used when
 * no combat is running and there are no ticks to be stale against.
 *
 * @param {object} raw `system.turnState`
 * @param {number|null} tick the current ◈ tick
 * @returns {object} the projected turn state
 */
export function turnStateAt(raw, tick) {
  const blank = {
    tick, acted: false, moved: false, attacked: false, movedPanels: 0,
    moveSegments: 0, usedActiveSkill: false, mayMoveAgain: false, usedRidingAttack: false,
    // WHICH abilities went. Absent from both branches until now, so every
    // snapshot reader of the turn record saw `undefined`: `oncePerTurn` never
    // refused anything, and `reactionAbilities` offered a Skill whose
    // same-Turn partner had already been used.
    itemTransfers: 0, abilitiesUsed: [],
  };
  if (tick !== null && (raw?.tick ?? null) !== tick) return blank;

  return {
    tick: raw?.tick ?? null,
    acted: Boolean(raw?.acted),
    moved: Boolean(raw?.moved),
    attacked: Boolean(raw?.attacked),
    movedPanels: raw?.movedPanels ?? 0,
    moveSegments: raw?.moveSegments ?? 0,
    usedActiveSkill: Boolean(raw?.usedActiveSkill),
    mayMoveAgain: Boolean(raw?.mayMoveAgain),
    usedRidingAttack: Boolean(raw?.usedRidingAttack),
    itemTransfers: raw?.itemTransfers ?? 0,
    abilitiesUsed: [...(raw?.abilitiesUsed ?? [])],
  };
}

/**
 * Project the board.
 *
 * @param {object} args
 * @param {object} args.scene
 * @param {object[]} args.actors
 * @param {object} [args.settings]
 * @returns {object}
 */
export function snapshotBoard({ scene, actors, settings = {} }) {
  // A caller that has a canvas resolves each unit's panel first and passes the
  // finished snapshot; anything else is projected here.
  const units = actors.map((a) => a.snapshot
    ?? snapshotUnit(a.actor ?? a, { token: a.token, tick: settings.tickForTurnState ?? null }));
  const board = {
    bounds: boundsFor(scene, settings),
    units,
    zones: scene?.zones ?? {},
    alliances: settings.alliances ?? {},
    roundPhase: settings.phase ?? "day",
    round: settings.round ?? 1,
    turnsPerRound: settings.turnsPerRound ?? 3,
    tick: settings.tick ?? 0,
    region: settings.region ?? null,
    warRegion: settings.warRegion ?? null,
    difficulty: settings.difficulty ?? "intermediate",
    grail: settings.grail ?? null,
    // Overwritten by `annotatePlatforms` below when the board has any. The
    // targeting resolver has read this map since it was written and nothing
    // ever supplied one, so the whole cross-level rule was inert.
    fields: settings.fields ?? [],
    crossLevel: settings.crossLevel ?? null,
    terrain: scene?.terrain ?? {},
    // Seeded so a replayed combat picks the same random targets.
    seed: settings.seed ?? 0,
  };

  // ZON is a pairwise property, so it can only be settled once every unit is
  // projected. Done here, once per board, because the damage pipeline, the
  // targeting resolver and the canvas overlay all ask the same question.
  annotateZon(units, board, settings.zon ?? {});

  // Auras are the same shape of problem as ZON and get the same answer: a
  // property of the board, settled once every unit is projected. Doing it here
  // rather than per-unit is what stops the cycle in Ch. 23 §23.3 -- every unit
  // is expanded against the same untouched board, so an aura cannot feed an
  // aura and the result does not depend on visit order.
  // Terrain, for the same reason and in the same place: it is positional, so
  // it can only be settled once every unit has a panel. Before auras, because
  // an aura's own modifiers should sit after the ground the unit stands on in
  // the explainer's reading order.
  annotateTerrain(units, board);
  // Day/Night and Home Base are facts about the FIELD, so they settle here for
  // the same reason terrain and auras do: a unit projected alone cannot know
  // which Round it is or whose ground it is standing on.
  annotateEnvironment(units, board);
  // The war's Region grants every Servant from it "+ to all Parameters"
  // (§19.3). Applied here rather than at setup so that changing the region
  // mid-configuration does not need every sheet rewritten.
  annotateRegionBonus(units, board);
  // Which platform each unit is aboard, and the protection model the targeting
  // resolver enforces. Positional, so it settles here with the other passes.
  annotatePlatforms(units, board);
  // Bounded fields, last of the positional passes: their interior rules sit
  // after the ground and the auras in the explainer's reading order.
  annotateFields(units, board);
  // Positional, like auras: it holds while somebody is standing nearby.
  annotateCompulsions(units, board);
  // Built here rather than cached across calls: `snapshotBoard` is where the
  // board's positions are already in hand, and an index built anywhere else
  // would need the invalidation table (§23.9) to keep it honest. The engine
  // holds a longer-lived one for the canvas; this is the resolution path, and
  // §23.3 requires that one to be synchronous and current.
  board.auraIndex = buildAuraIndex(board);
  annotateAuras(units, board, board.auraIndex);

  return board;
}

/**
 * Tell each unit which platform it is aboard, and give the board the
 * cross-level map its targeting resolver has always read.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void}
 */
function annotatePlatforms(units, board) {
  const platforms = platformsOn(board);
  if (platforms.length === 0) return;

  for (const u of units) {
    if (u.kind === "platform") continue;
    const aboard = platforms.find((p) => (p.level ?? 0) === (u.level ?? 0));
    if (aboard) u.platformId = aboard.id;
  }
  board.crossLevel = crossLevelRulesFor(board);
}

/**
 * Apply the war Region's parameter step.
 *
 * A **rank shift**, not a numeric delta, so it flows through the same derived
 * path Enkidu's reduction and Mad Enhancement's boost use — and so it moves
 * Base Attack by 10 per step with it (Ch. 05 §5.6).
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void}
 */
function annotateRegionBonus(units, board) {
  const warRegion = board.warRegion ?? null;
  if (!warRegion) return;

  for (const u of units) {
    const steps = regionBonusFor(u, warRegion);
    if (steps === 0) continue;
    u.statDeltas = [
      ...(u.statDeltas ?? []),
      ...["str", "end", "agi", "mag", "luc"].map((p) => ({
        stat: `parameters.${p}`, rankShift: steps, target: "self",
        source: `Region: ${warRegion}`,
      })),
    ];
  }
}

/**
 * Give every unit what the Round and the ground it stands on do to it.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void}
 */
function annotateEnvironment(units, board) {
  board.phase = phase(board.round ?? 1, board.startedAtDay !== false);
  for (const u of units) {
    // Recorded on the unit as well as folded into modifiers: Medea's Territory
    // Creation predicates on it, and a predicate cannot read a modifier list.
    u.inHomeBase = inOwnHomeBase(u, board);
    const mods = [...darkModifiers(u, board.phase), ...homeBaseModifiers(u, board)];
    if (mods.length > 0) u.modifiers = [...(u.modifiers ?? []), ...mods];
  }
}

/**
 * The board's panel bounds.
 *
 * The rules say 13x13 or 25x25 and the setting says which, but the *scene* is
 * what the tokens are standing on: a 20x20 scene with `boardSize` left at 13
 * clips every panel past row 12 out of every shape, so a unit placed in the
 * lower half of the map becomes untargetable with no error anywhere. The scene
 * wins when it can answer, and the setting is the fallback.
 *
 * @param {object|null} scene
 * @param {object} settings
 * @returns {import("../domain/geometry.mjs").Bounds}
 */
function boundsFor(scene, settings) {
  const rows = scene?.dimensions?.rows ?? null;
  const columns = scene?.dimensions?.columns ?? null;
  if (Number.isFinite(rows) && Number.isFinite(columns) && rows > 0 && columns > 0) {
    return { iMin: 0, jMin: 0, iMax: Math.round(rows) - 1, jMax: Math.round(columns) - 1 };
  }
  const size = settings.boardSize ?? 13;
  return { iMin: 0, jMin: 0, iMax: size - 1, jMax: size - 1 };
}

/* -------------------------------------------------------------------------- */

/**
 * The grid spaces a token occupies, as `{i, j}` offsets.
 *
 * A token's `x`/`y` are **pixels**. Converting them needs the scene's grid,
 * which this layer may not touch — so the caller passes `panel`, or the token
 * document converts for itself through `getOccupiedGridSpaceOffsets`, which
 * also handles a multi-panel unit's whole footprint.
 *
 * @param {object|null} doc a `TokenDocument`
 * @param {object|null} explicit a panel the caller already resolved
 * @returns {Array<{i: number, j: number, k?: number}>} never empty
 */
function gridFootprint(doc, explicit) {
  if (explicit) return [explicit];

  if (typeof doc?.getOccupiedGridSpaceOffsets === "function") {
    const offsets = doc.getOccupiedGridSpaceOffsets();
    if (offsets?.length) return offsets.map((o) => ({ i: o.i, j: o.j, k: o.k }));
  }

  // No token, or a gridless scene. `{0, 0}` is wrong for anything on a board,
  // which is why every caller that has a canvas resolves the panel first.
  return [{ i: 0, j: 0 }];
}

/**
 * @param {object} raw
 * @returns {Record<string, Rank|null>}
 */
function parseParameters(raw) {
  /** @type {Record<string, Rank|null>} */
  const out = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    out[key] = Rank.parseOrNull(value);
  }
  return out;
}

/**
 * Active, unsuppressed effect ids. Suppressed effects are deliberately absent
 * rather than flagged: every consumer wants "what is in force", and a consumer
 * that wants the full list can read `effectInstances`.
 * @param {object} actor
 * @returns {string[]}
 */
function activeEffectIds(actor) {
  return [...(actor.effects ?? [])]
    .filter((e) => !e.disabled && !e.isSuppressed)
    .map((e) => e.system?.defId ?? e.name);
}

/**
 * @param {object} actor
 * @returns {object[]}
 */
function effectInstances(actor) {
  return [...(actor.effects ?? [])]
    .filter((e) => !e.disabled)
    .map((e) => ({
      id: e.id,
      defId: e.system?.defId ?? e.name,
      magnitude: e.system?.magnitude ?? 0,
      stage: e.system?.stage ?? 0,
      uses: e.system?.uses ?? 0,
      expiry: e.system?.expiry ?? null,
      sourceUnitId: e.system?.sourceUnitId ?? null,
      suppressed: Boolean(e.isSuppressed),
    }));
}

/**
 * Run every rule element the actor owns and collect what it contributes.
 *
 * This is where a `{key: "FlatDamage", table: "divinity"}` on a compendium
 * document becomes `+50` in the damage pipeline. Before this existed the
 * content loaded and did nothing.
 *
 * Predicates that depend on the *attack* cannot be evaluated here — the attack
 * is not known yet — so they are carried through on the modifier and evaluated
 * inside the pipeline. Predicates that depend only on the unit's own state are
 * evaluated now.
 *
/**
 * Substitute an instance reference, with an optional leading minus.
 *
 * `"-@magnitude"` is what an effect needs when its magnitude is authored
 * positive -- as every magnitude on a sheet is -- and its reader sums rather
 * than subtracts. `Crit Dwn` is the case: it shares the `check: crit` channel
 * with `Crit Up`, so "reduced by 25%" has to arrive as `-25`.
 *
 * An exact-match substitution could not express that, and the alternative --
 * authoring the magnitude negative on the effect -- would show "-25" wherever
 * the sheet says 25.
 *
 * @param {unknown} raw
 * @param {string} ref
 * @param {number|undefined} value
 * @returns {unknown}
 */
function instanceValue(raw, ref, value) {
  if (raw === ref) return value ?? 0;
  if (raw === `-${ref}`) return -(value ?? 0);
  return raw;
}

/**
 * @param {object} actor
 * @returns {object}
 */
export function contributionsOf(actor) {
  const sys = actor.system ?? {};
  const abilities = [...(actor.items ?? [])].map((item) => ({
    id: item.id,
    name: item.name,
    rank: item.system?.rank ?? null,
    // A mode's activeRules apply only while it is switched on. This defaulted
    // to `true` while `active` was a field the DataModel silently dropped,
    // which quietly applied every mode's active clauses at all times.
    active: Boolean(item.system?.active),
    rules: item.system?.rules ?? [],
    passiveRules: item.system?.passiveRules ?? [],
    activeRules: item.system?.activeRules ?? [],
  }));

  // Effects on the actor carry rule elements too, and they are active by
  // definition -- an effect that is present is in force.
  for (const effect of actor.effects ?? []) {
    if (effect.disabled || effect.isSuppressed) continue;
    // Resolved from the REGISTRY. This read `effect.system.def` -- a field
    // nothing has ever populated and which is not on the schema -- so the
    // collection below never ran, and every effect whose behaviour is expressed
    // as `rules:` did nothing at all. Medea's MOV Up granted no MOV and her
    // automatic evasion granted no evasion; both looked applied on the sheet.
    const def = EffectRegistry.get(effect.system?.defId) ?? null;
    if (!def?.rules?.length) continue;
    abilities.push({
      id: effect.id, name: effect.name, rank: null, active: true,
      // The INSTANCE's remaining charges. A count-limited effect's rule
      // elements have to know how many uses are left, or the consumer cannot
      // tell a spent Trofa from a fresh one.
      uses: effect.system?.uses ?? 0,
      rules: def.rules.map((r) => ({
        ...r,
        // "@magnitude" on an effect definition resolves against the instance,
        // and "-@magnitude" against its negation.
        value: instanceValue(r.value, "@magnitude", effect.system?.magnitude ?? 0),
        npValue: instanceValue(r.npValue, "@npMagnitude", effect.system?.npMagnitude),
      })),
    });
  }

  // Self-options, so an element can be gated on its own owner's state. It used
  // to be an EMPTY set, which made every `self:` predicate unsatisfiable --
  // Penthesilea's Charisma is "negated when Mad Enhancement is activated", and
  // that clause could never have fired.
  const options = rollOptionsFor({
    attacker: {
      kind: actor.type,
      // Spread for the same reason the unit snapshot spreads them: these are
      // SetFields, and every consumer downstream is entitled to an array.
      // `rollOptionsFor` only iterates today, so this is consistency rather
      // than a fix -- but the next reader who reaches for `.includes` should
      // not have to check.
      attributes: [...(sys.attributes ?? [])],
      effects: [...(actor.effects ?? [])].map((e) => e.system?.defId).filter(Boolean),
      region: [...(sys.region ?? [])],
      abilities: [...(actor.items ?? [])].map((i) => ({
        id: i.id, slug: i.system?.slug ?? i.id, active: Boolean(i.system?.active),
      })),
    },
    defender: null,
  });

  return collectContributions(abilities, { options, refs: { self: actor } });
}

/**
 * @param {object} actor
 * @returns {object[]}
 */
function collectAbilities(actor) {
  return [...(actor.items ?? [])]
    .filter((i) => i.type === "ability" || i.type === "noblePhantasm")
    .map((i) => ({
      id: i.id,
      name: i.name,
      isNP: i.type === "noblePhantasm",
      rank: Rank.parseOrNull(i.system?.rank),
      cooldownRemaining: i.system?.cooldown?.remaining ?? 0,
      regen: i.system?.cooldown?.regen ?? 0,
      categorizedAsNP: Boolean(i.system?.categorizedAsNP),
      // What a cross-ability gate matches on. Scathach's Gate of Skye "cannot
      // be used if Primordial Rune, Wisdom of Dun Scaith and/or Gae Bolg
      // Alternative are on Cooldown", and a gate that can only see `id` cannot
      // name a content id, a whole category, or a copy's exclusion set --
      // which is all three of the ways her sheet groups abilities.
      contentId: i.system?.contentId ?? null,
      category: i.system?.category ?? null,
      exclusionSet: i.system?.exclusionSet ?? null,
      // Both needed by `rules/options.mjs`: `slug` is what a predicate names,
      // and `active` is what separates "has Mad Enhancement" from "has Mad
      // Enhancement switched on" -- two different questions, and content asks
      // both.
      slug: i.system?.slug ?? i.id,
      active: Boolean(i.system?.active),

      // What `canCopy` asks about (§15.7). None of it was projected, so
      // `copyCandidates` -- which reads the BOARD -- saw abilities with no
      // phases and refused every one of them as `notActive`. Wisdom of Dún
      // Scáith could not copy a single Skill in the game.
      //
      // `hasPhases` rather than the phases themselves: the question is "does it
      // have an Active effect", and copying a Servant's whole phase list into
      // every board snapshot to answer a boolean is a great deal of data for
      // one bit.
      kind: i.system?.kind ?? null,
      passive: Boolean(i.system?.passive),
      hasPhases: (i.system?.phases ?? []).length > 0,
      copyable: i.system?.copyable ?? null,
    }));
}

/**
 * Does this actor own a named class skill?
 *
 * Matched on the slug first and the name second, because content authored
 * before slugs existed identifies its skills only by name.
 *
 * @param {object} actor
 * @param {string} slug
 * @returns {boolean}
 */
function hasSkill(actor, slug) {
  return [...(actor.items ?? [])].some(
    (i) => i.system?.slug === slug || i.name?.toLowerCase?.() === slug,
  );
}

/**
 * @param {object} actor
 * @returns {object|null}
 */
function magicResistanceOf(actor) {
  const mr = actor.system?.classSkills?.magicResistance;
  if (!mr) return null;
  if (mr.mode === "dice") return { mode: "dice", formula: mr.formula, npDiceDoubled: mr.npDiceDoubled ?? true };
  return { mode: "rank", rank: Rank.parseOrNull(mr.rank), percent: mr.percent };
}
