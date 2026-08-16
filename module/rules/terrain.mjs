/**
 * @file Terrain — a property of panels, evaluated for whoever stands on them.
 * @see docs/42-terrain.md
 *
 * Layer 2 (rules). Pure.
 *
 * The snapshot has carried a `terrain` field since it was written and nothing
 * ever populated or read it.
 *
 * **Terrain is not an effect.** A unit does not carry a `Forest` status; it is
 * *in* a Forest, and the terrain applies while it stays there. That is what
 * makes terrain undispellable, uncurable and unresistable, and it is why moving
 * out ends the effects instantly with no removal step — there is nothing to
 * remove. Mechanically it is *"a positional aura whose source is a region
 * rather than a unit"* (§42.1), so this is the aura pass with a different
 * source, and `annotateTerrain` sits beside `annotateAuras` for that reason.
 *
 * Effects are **data**, with an optional attribute gate, because a third of the
 * catalogue reads "MOV −1 … does not affect units with the `Santa` attribute"
 * or "units *with* `Levitating`: MOV +1". Expressing that as a condition on the
 * entry keeps the table readable against the chapter it was transcribed from.
 */

import { chebyshev } from "../domain/geometry.mjs";

/**
 * @typedef {object} TerrainEntry
 * @property {string} name
 * @property {Array<object>} effects each with an optional `requires`/`unless` attribute gate
 */

/**
 * The catalogue (§42.2), restricted to the clauses that are a **standing
 * modifier** on whoever occupies the panel.
 *
 * The periodic and event-driven clauses — Burning's inescapable `Burn`, the
 * Forest→Burning coin flip, Lava's on-entry damage, Eldritch's Horrors, Meadow
 * reverting after a Damage Step — are deliberately **absent** rather than
 * half-present: they need the scheduler and the movement hooks, not this table,
 * and a half-entry here would look implemented. Ch. 45 C1 lists them.
 *
 * @type {Readonly<Record<string, TerrainEntry>>}
 */
export const TERRAIN = Object.freeze({
  burning: {
    name: "Burning",
    effects: [
      { kind: "elementDefUp", element: "water", value: 50 },
    ],
  },

  waterside: {
    name: "Waterside",
    effects: [
      { kind: "mov", value: +1, requires: "swimsuit" },
      { kind: "evade", value: -1, requires: "swimsuit" },
      { kind: "mov", value: -1, unless: "swimsuit" },
      { kind: "evade", value: +1, unless: "swimsuit" },
      { kind: "elementAtkUp", element: "water", value: 25 },
      { kind: "elementDefDwn", element: "lightning", value: 25 },
      { kind: "elementDefDwn", element: "ice", value: 25 },
      { kind: "elementDefUp", element: "fire", value: 50 },
    ],
  },

  forest: {
    name: "Forest",
    effects: [
      { kind: "mov", value: -1 },
      // "Evade rolls −2 (easier — a rare terrain that helps evasion)."
      { kind: "evade", value: -2 },
      { kind: "defUp", value: 10 },
      { kind: "elementAtkUp", element: "nature", value: 25 },
    ],
  },

  snowfield: {
    name: "Snowfield",
    effects: [
      { kind: "mov", value: -1, unless: "santa" },
      { kind: "evade", value: +1, unless: "santa" },
      { kind: "elementDefDwn", element: "ice", value: 50 },
      { kind: "elementDefUp", element: "fire", value: 25 },
    ],
  },

  poisonSwamp: {
    name: "Poison Swamp",
    // Entirely periodic (§42.2): Poison at end of turn, then a 50% chance of an
    // extra stage. Nothing standing here, so nothing in this table.
    effects: [],
  },

  thunderstorm: { name: "Thunderstorm", effects: [] },

  eldritch: {
    name: "Eldritch",
    effects: [
      { kind: "defDwn", value: 20 },
      { kind: "atkUp", value: 50, requires: "darkOutsider" },
    ],
  },

  deadZone: { name: "Dead Zone", effects: [] },

  city: {
    name: "City",
    effects: [
      { kind: "evade", value: -1 },
      // "Range of all attacks −1 if it is greater than 3" — the threshold is
      // part of the entry so the reader is not left to infer it.
      { kind: "range", value: -1, whenRangeAbove: 3 },
    ],
  },

  lava: {
    name: "Lava",
    effects: [{ kind: "mov", value: -1 }],
  },

  frozen: {
    name: "Frozen",
    effects: [{ kind: "evade", value: +3 }],
  },

  magnetic: { name: "Magnetic", effects: [] },

  meadow: {
    name: "Meadow",
    effects: [
      { kind: "healingUp", value: 100 },
      { kind: "elementDefDwn", element: "fire", value: 100 },
    ],
  },

  underworld: { name: "Underworld", effects: [] },

  airspace: {
    name: "Airspace",
    effects: [
      { kind: "mov", value: +1, requires: "levitating" },
      { kind: "agilityCheck", value: -2, requires: "levitating" },
      { kind: "mov", value: -1, unless: "levitating" },
      { kind: "agilityCheck", value: +2, unless: "levitating" },
    ],
  },

  universe: { name: "Universe", effects: [] },
  halloween: { name: "Halloween", effects: [] },
  labyrinth: { name: "Labyrinth", effects: [] },
});

/**
 * The terrain types covering a panel, in area order.
 *
 * @param {{i: number, j: number}} panel
 * @param {object} board
 * @returns {string[]}
 */
export function terrainAt(panel, board) {
  /** @type {string[]} */
  const out = [];
  for (const area of board?.terrain?.areas ?? []) {
    if (!(area.panels ?? []).some((p) => chebyshev(p, panel) === 0)) continue;
    if (!out.includes(area.type)) out.push(area.type);
  }
  return out;
}

/**
 * Everything the terrain under a unit does to it.
 *
 * Deltas **sum** across overlapping areas — two MOV −1 areas cost two panels,
 * because they are two separate pieces of difficult ground rather than one
 * status applied twice.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {{movDelta: number, evadeDelta: number, agilityCheckDelta: number,
 *            rangeDelta: number, healingUp: number, modifiers: object[], types: string[]}}
 */
export function terrainEffects(unit, board) {
  const types = terrainAt(unit?.panel ?? { i: -1, j: -1 }, board);
  const held = unit?.attributes ?? [];

  const out = {
    movDelta: 0, evadeDelta: 0, agilityCheckDelta: 0, rangeDelta: 0, healingUp: 0,
    modifiers: /** @type {object[]} */ ([]), types,
  };

  for (const type of types) {
    const entry = TERRAIN[type];
    if (!entry) continue;

    for (const effect of entry.effects) {
      if (effect.requires && !held.includes(effect.requires)) continue;
      if (effect.unless && held.includes(effect.unless)) continue;

      switch (effect.kind) {
        case "mov": out.movDelta += effect.value; break;
        case "evade": out.evadeDelta += effect.value; break;
        case "agilityCheck": out.agilityCheckDelta += effect.value; break;
        case "range": out.rangeDelta += effect.value; break;
        case "healingUp": out.healingUp += effect.value; break;
        default:
          out.modifiers.push({
            key: effect.kind,
            value: effect.value,
            ...(effect.element ? { element: effect.element } : {}),
            source: entry.name,
            // Marked, so the damage explainer can say "because you are standing
            // in a Forest" rather than showing an unattributed 10%.
            terrain: type,
          });
          break;
      }
    }
  }

  return out;
}

/**
 * Give every unit the terrain it is standing on.
 *
 * Beside `annotateAuras` and for the same reason: it is positional, so it can
 * only be settled once every unit has a panel.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void} mutates `unit.terrain` and `unit.modifiers`
 */
export function annotateTerrain(units, board) {
  for (const u of units ?? []) {
    const effects = terrainEffects(u, board);
    u.terrain = effects.types;
    u.terrainEffects = effects;
    if (effects.modifiers.length > 0) {
      u.modifiers = [...(u.modifiers ?? []), ...effects.modifiers];
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Periodic and event-driven clauses                                         */
/* -------------------------------------------------------------------------- */

/**
 * The boundary clauses of each terrain type.
 *
 * Separate from `TERRAIN.effects` because these are **events**, not standing
 * modifiers: they happen at a moment and are gone. Keeping them apart is what
 * lets `terrainEffects` stay a pure lookup.
 *
 * @type {Readonly<Record<string, object[]>>}
 */
const PERIODICS = Object.freeze({
  burning: [
    // "All units are inflicted with Burn at the end of every Turn. While
    // inside, this Burn does not expire and cannot be removed."
    {
      when: "turnEnd", kind: "applyEffect", effectId: "burn",
      duration: null, unremovable: true,
      // "Units with ANY resistance to Burn or Fire damage are not inflicted."
      unlessAnyEffect: ["flamHeal", "fireResist", "burnImmune"],
    },
    // "25 Fixed Fire damage at the end of the unit's turn and at the end of any
    // turn it Acts."
    {
      when: "turnEnd", kind: "damage", amount: 25, element: "fire", fixed: true,
      unlessAnyEffect: ["flamHeal", "fireResist", "burnImmune"],
    },
  ],

  poisonSwamp: [
    { when: "turnEnd", kind: "applyEffect", effectId: "poison", unlessEffect: "poison" },
    // "then has a 50% chance of an additional Poison stage" — only for a unit
    // that was already Poisoned when the turn ended.
    { when: "turnEnd", kind: "chance", percent: 50, then: "poisonStage", requiresEffect: "poison" },
  ],

  eldritch: [
    // "At the start of every turn, every unit inside flips a coin; on Tails,
    // Stun for that turn. (Explicitly equivalent to Terror 50%.)"
    { when: "turnStart", kind: "chance", percent: 50, then: "stun" },
  ],
});

/** On-entry clauses, fired when a unit steps onto a panel. */
const ON_ENTRY = Object.freeze({
  lava: [
    { kind: "damage", amount: 20, element: "fire", fixed: true },
    { kind: "chance", percent: 50, then: "burn", duration: "2◈" },
  ],
  frozen: [
    { kind: "check", check: "agility", onFail: "cannotAct" },
  ],
  magnetic: [
    // "25% chance of Immobilize for 1◈ — 100% for units with the Mechanical
    // attribute. NOT affected by Debuff Immune or any debuff-resist modifier,
    // except Style Change." The bypass is the interesting half: without it the
    // clause would be quietly cancelled by the very units it is aimed at.
    { kind: "chance", percent: 25, percentIfAttribute: { mechanical: 100 },
      then: "immobilize", duration: "1◈", bypassesResistance: true },
  ],
});

/**
 * Everything the terrain does to these units at this boundary.
 *
 * Returns **descriptors**, not intents: this is layer 2. `scheduler` maps them,
 * the same division the `OnEvent` action table and the Home Base use.
 *
 * @param {object[]} units
 * @param {object} board
 * @param {"turnStart"|"turnEnd"|"roundEnd"} when
 * @returns {object[]}
 */
export function terrainPeriodics(units, board, when) {
  /** @type {object[]} */
  const out = [];

  for (const unit of units ?? []) {
    const held = unit.effects ?? [];
    for (const type of terrainAt(unit.panel ?? { i: -1, j: -1 }, board)) {
      for (const clause of PERIODICS[type] ?? []) {
        if (clause.when !== when) continue;
        if (clause.unlessEffect && held.includes(clause.unlessEffect)) continue;
        if (clause.requiresEffect && !held.includes(clause.requiresEffect)) continue;
        if ((clause.unlessAnyEffect ?? []).some((e) => held.includes(e))) continue;

        const { when: _when, unlessEffect, requiresEffect, unlessAnyEffect, ...rest } = clause;
        void _when; void unlessEffect; void requiresEffect; void unlessAnyEffect;
        out.push({ ...rest, unitId: unit.id, terrain: type });
      }
    }
  }

  return out;
}

/**
 * What happens the moment a unit steps onto a panel.
 *
 * @param {object} unit
 * @param {{i: number, j: number}} panel the panel being entered
 * @param {object} board
 * @returns {object[]}
 */
export function terrainOnEntry(unit, panel, board) {
  /** @type {object[]} */
  const out = [];
  const held = unit?.attributes ?? [];

  for (const type of terrainAt(panel, board)) {
    for (const clause of ON_ENTRY[type] ?? []) {
      const { percentIfAttribute, ...rest } = clause;
      // An attribute can raise the chance to certainty — Magnetic against a
      // Mechanical unit is not a roll at all.
      const override = Object.entries(percentIfAttribute ?? {})
        .find(([attribute]) => held.includes(attribute));
      out.push({
        ...rest,
        ...(override ? { percent: override[1] } : {}),
        unitId: unit.id,
        terrain: type,
      });
    }
  }

  return out;
}

/**
 * Terrain that changes because of an attack that just landed.
 *
 * Two clauses, and they are opposites: Fire **creates** Burning out of a
 * Forest permanently, and **consumes** a Meadow at the end of the Damage Step.
 *
 * @param {object} args
 * @param {object} args.defender
 * @param {object} args.board
 * @param {string|null} args.element
 * @param {"heads"|"tails"} [args.coin] the caller flips
 * @param {Array<{i: number, j: number}>} [args.areaPanels] the attack's area
 * @returns {object[]}
 */
export function terrainConversions({ defender, board, element, coin, areaPanels = null }) {
  if (element !== "fire") return [];

  /** @type {object[]} */
  const out = [];
  const here = terrainAt(defender?.panel ?? { i: -1, j: -1 }, board);

  // "When an attack dealing Fire damage hits a unit in a Forest, flip a coin.
  // On Tails the 3x3 around the DU becomes Burning for 2 turns -- and does not
  // revert to Forest afterwards. If the attack's area is larger than 3x3, the
  // whole attack area converts."
  if (here.includes("forest") && coin === "tails") {
    const three = squareAround(defender.panel, 1);
    out.push({
      kind: "convertTerrain", from: "forest", to: "burning",
      panels: areaPanels && areaPanels.length > three.length ? areaPanels : three,
      duration: "2◈", reverts: false,
    });
  }

  // "Fire damage taken by a unit standing on a Meadow panel +100% -- and then
  // the panel reverts to normal at the end of the Damage Step."
  if (here.includes("meadow")) {
    out.push({ kind: "removeTerrain", type: "meadow", panels: [defender.panel] });
  }

  return out;
}

/**
 * The (2r+1)² block centred on a panel.
 * @param {{i: number, j: number}} centre
 * @param {number} r
 * @returns {Array<{i: number, j: number}>}
 */
function squareAround(centre, r) {
  /** @type {Array<{i: number, j: number}>} */
  const out = [];
  for (let di = -r; di <= r; di++) {
    for (let dj = -r; dj <= r; dj++) out.push({ i: centre.i + di, j: centre.j + dj });
  }
  return out;
}
