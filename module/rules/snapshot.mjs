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
 * @returns {UnitSnapshot}
 */
export function snapshotUnit(actor, { token = null, panel = null } = {}) {
  const sys = actor.system ?? {};
  const doc = token ?? actor.token ?? null;
  const contributions = contributionsOf(actor);
  const footprint = gridFootprint(doc, panel);

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
    alignment: sys.alignment ?? null,

    effects: activeEffectIds(actor),
    effectInstances: effectInstances(actor),
    modifiers: contributions.modifiers,
    abilities: collectAbilities(actor),
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
    concealed: Boolean(sys.concealed),
    canAct: sys.canAct !== false,
    acted: Boolean(sys.turnState?.acted),
    turnState: {
      acted: Boolean(sys.turnState?.acted),
      moved: Boolean(sys.turnState?.moved),
      attacked: Boolean(sys.turnState?.attacked),
      movedPanels: sys.turnState?.movedPanels ?? 0,
      moveSegments: sys.turnState?.moveSegments ?? 0,
      usedActiveSkill: Boolean(sys.turnState?.usedActiveSkill),
      mayMoveAgain: Boolean(sys.turnState?.mayMoveAgain),
      usedRidingAttack: Boolean(sys.turnState?.usedRidingAttack),
    },
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
  const units = actors.map((a) => a.snapshot ?? snapshotUnit(a.actor ?? a, { token: a.token }));
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
    crossLevel: settings.crossLevel ?? null,
    terrain: scene?.terrain ?? {},
    // Seeded so a replayed combat picks the same random targets.
    seed: settings.seed ?? 0,
  };

  // ZON is a pairwise property, so it can only be settled once every unit is
  // projected. Done here, once per board, because the damage pipeline, the
  // targeting resolver and the canvas overlay all ask the same question.
  annotateZon(units, board, settings.zon ?? {});

  return board;
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
 * @param {object} actor
 * @returns {object}
 */
export function contributionsOf(actor) {
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
    const def = effect.system?.def ?? null;
    if (!def?.rules?.length) continue;
    abilities.push({
      id: effect.id, name: effect.name, rank: null, active: true,
      rules: def.rules.map((r) => ({
        ...r,
        // "@magnitude" on an effect definition resolves against the instance.
        value: r.value === "@magnitude" ? (effect.system?.magnitude ?? 0) : r.value,
        npValue: r.npValue === "@npMagnitude" ? (effect.system?.npMagnitude ?? undefined) : r.npValue,
      })),
    });
  }

  return collectContributions(abilities, { options: new Set(), refs: { self: actor } });
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
    }));
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
