/**
 * @file What each tab of the actor sheet renders.
 * @see docs/29-user-interface.md §29.2
 *
 * The impure half of the sheet: this reaches for documents, the board, the
 * combat and the settings, and hands the results to `present.mjs`, which does
 * the arithmetic and can be tested without any of them.
 *
 * One snapshot per render, shared by every tab. `unitSnapshot` walks the
 * canvas and the effect list, and four tabs each taking their own would do
 * that work four times for one answer.
 */

import * as board from "../../engine/board.mjs";
import { currentBoard, unitSnapshot, currentTick, currentRound } from "../../engine/board.mjs";
import { poolsOf, isUnbound } from "../../rules/cs-namespacing.mjs";
import { chebyshev } from "../../domain/geometry.mjs";
import { classifyAbility } from "../../rules/ability-use.mjs";
import { detectRangeOf } from "../../rules/identity.mjs";
import { resourceBar, parameterTiles } from "./present.mjs";

/**
 * Present one ability to the sheet.
 * @param {object} item
 * @returns {object}
 */
function describe(item) {
  const use = classifyAbility(item);
  return {
    id: item.id,
    name: item.name,
    rank: item.system.rank,
    use,
    // A mode that is on reads as on; `cannotDeactivate` explains a disabled
    // toggle rather than leaving the player clicking a dead control.
    active: Boolean(item.system.active),
    locked: Boolean(item.system.active && item.system.cannotDeactivate),
  };
}


/**
 * The Master-only half of the sheet (§29.3).
 *
 * Every figure here is derived. The Command Spell tracker shows `own` and the
 * per-Servant grants apart because §16.9 makes them different resources, and
 * the **Unbound** warning falls out of the total being zero rather than being
 * stored -- a stored flag would need updating from spending, granting,
 * inheriting and the Master dying, and the one that got missed would leave a
 * Servant permanently Unbound with a full pool.
 *
 * @param {object} master an `FGTActor`
 * @returns {object}
 */
function masterContext(master) {
  const board = currentBoard();
  const self = board.units.find((u) => u.id === master.id) ?? null;

  return {
    csPools: poolsOf(master.system).map((pool) => ({
      ...pool,
      name: game.actors.get(pool.servantId)?.name ?? pool.servantId,
      // Pips, so "2 of 3" is legible at a glance rather than read as a number.
      // Built here rather than in the template: Foundry registers no `range`
      // helper, and a template that invents one throws at render time.
      pips: "●".repeat(Math.min(pool.total, 9)) + "○".repeat(Math.max(0, 3 - pool.total)),
    })),
    contracted: [...(master.system.servantIds ?? [])].map((id) => describeServant(id, master, board, self)),
    // "a warning that it is lost on death" -- the Essence is the one thing on
    // this sheet whose loss is permanent.
    essences: [...(master.system.essences ?? [])],
    // §16.7: at 25 Health or less a Master cannot order more than one Servant
    // to Act, and the tax has already been charged by the time anyone looks.
    taxWarning: (master.system.health?.value ?? 0) <= 25,
    multiServantTax: master.system.turnState?.servantsActed ?? 0,
  };
}

/**
 * One contracted Servant, as §29.3 shows it: distance, ZON, and what being
 * outside costs.
 *
 * @param {string} id
 * @param {object} master
 * @param {object} board
 * @param {object|null} self
 * @returns {object}
 */
function describeServant(id, master, board, self) {
  const actor = game.actors.get(id);
  const unit = board.units.find((u) => u.id === id) ?? null;
  const distance = unit?.panel && self?.panel ? chebyshev(unit.panel, self.panel) : null;

  return {
    id,
    name: actor?.name ?? id,
    distance,
    inZon: unit ? !unit.outsideZon : null,
    // Named rather than implied: a player who sees "outside ZON" and not what it
    // costs has to remember the rule, and remembering it is the mistake.
    penalty: unit?.outsideZon ? game.i18n.localize("FGT.Master.ZonPenalty") : null,
    unbound: isUnbound(master.system, id),
    health: actor?.system?.health ?? null,
  };
}

/**
 * Everything the four tabs and the header render.
 *
 * ONE snapshot per render, threaded through every builder below.
 * `unitSnapshot` walks the canvas for the token, the combat for the tick and
 * every rule element the actor owns; four tabs each taking their own would do
 * that work four times over to reach the same answer.
 *
 * @param {object} actor an `FGTActor`
 * @param {object} sheet the `FGTActorSheet`, for `isEditable`
 * @returns {object}
 */
export function buildContext(actor, sheet) {
  const system = actor.system;
  const snapshot = unitSnapshot(actor);
  const tick = currentTick();
  const round = currentRound();
  const isMaster = actor.type === "master";

  return {
    system,
    fields: system.schema.fields,
    actorType: actor.type,
    isEditable: sheet.isEditable,
    isGM: game.user.isGM,
    snapshot,
    tick,
    round,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),

    // Classified, so the template renders a toggle for a mode, a button for an
    // attack, and plain text for a passive -- rather than one button that opens
    // an enemy targeting session for all three.
    abilities: actor.items.filter((i) => i.type === "ability").map(describe),
    noblePhantasms: actor.items.filter((i) => i.type === "noblePhantasm").map(describe),

    // The roster is a GM-managed list, not free text: a typo'd faction makes
    // two units enemies with nothing on screen to explain why.
    factionChoices: board.choices(),
    hasFactions: Object.keys(board.choices()).length > 0,
    hasFaction: Boolean(system.factionId),

    // §14.9's setup rolls, offered on a Master that has not had them yet. A GM
    // may re-roll before the match starts; afterwards the rolls lock. Only a
    // Master or a Caster may contract (§16.2), so only they get the button -- a
    // control that always refuses is worse than none.
    //
    // Spread first: `servantClasses` is a SetField, so it arrives as a `Set`,
    // which has `.has` and not `.includes`.
    canContract: isMaster || [...(system.servantClasses ?? [])].includes("caster"),
    canRollSetup: isMaster && game.user.isGM,
    setupLocked: Boolean(game.combat?.started),

    parameters: parameterTiles(system.parameters, system.grantedSteps),
    overview: overviewContext(actor, snapshot),
    header: headerContext(actor, snapshot),
    isMaster,
    ...(isMaster ? masterContext(actor) : {}),
  };
}

/**
 * The always-visible header (§29.2).
 *
 * D29.3: *"the header carries every value that gates an action"*. So the three
 * depleting resources, the public identity line, and the three stored states
 * that change what every other rule does — defeated, concealed, modes locked —
 * are here rather than a tab away.
 *
 * @param {object} actor
 * @param {object} snapshot
 * @returns {object}
 */
function headerContext(actor, snapshot) {
  const system = actor.system;
  // The faction's own colour, which the board and the HUD already read from
  // `rules/factions.mjs` -- so the rail down the sheet's edge is the same
  // colour as the token on the canvas rather than a second palette.
  const faction = system.factionId ? board.faction(system.factionId) : null;

  return {
    factionColor: faction?.color ?? "var(--fgt-gold)",
    line: identityLine(actor),
    // A GM sees the true name regardless of `identityRevealed` — they are the
    // one who has to run the concealment (§26.6).
    showTrueName: Boolean(system.trueName) && (system.identityRevealed || game.user.isGM),
    trueName: system.trueName ?? "",
    badges: badgesFor(system, snapshot),
    // `name` rather than `label`: `resourceBar` returns a `label` of its own
    // ("1000 / 1000"), and spreading it over a key of the same name replaced
    // the localization key with the reading -- so every bar was captioned with
    // its own value and none of them said which resource it was.
    bars: ["health", "agility", "luck"].map((key) => ({
      key,
      name: `FGT.Resource.${key}`,
      ...resourceBar(system[key]),
    })),
  };
}

/**
 * The public identity line: what this unit is, not who.
 *
 * A Servant is not "Heracles" to its opponents, it is "Berserker" (§4.2), so
 * the container leads. Alignment and Region follow because both are things
 * content predicates match on and neither appeared anywhere on the old sheet.
 *
 * @param {object} actor
 * @returns {string}
 */
function identityLine(actor) {
  const system = actor.system;
  const parts = [];

  if (system.classContainer) parts.push(titleCase(system.classContainer));
  else if (system.servantClasses?.size) parts.push([...system.servantClasses].map(titleCase).join(" / "));

  // "Neutral Neutral" is not how anyone writes it. Collapse the pair when both
  // halves agree, which is the one case where repeating the word says nothing.
  const order = system.alignment?.order ?? "";
  const morality = system.alignment?.morality ?? "";
  const alignment = (order && order === morality ? [order] : [order, morality])
    .filter(Boolean).map(titleCase).join(" ");
  if (alignment) parts.push(alignment);

  const region = [...(system.region ?? [])].map(titleCase).join(", ");
  if (region) parts.push(region);

  return parts.join(" · ");
}

/**
 * States worth interrupting the reader for.
 *
 * Each carries an icon and a word, never a colour alone (D29.7). `defeated`
 * leads: a defeated Unit is still a legal-looking row in every list until
 * something says otherwise.
 *
 * @param {object} system
 * @param {object} snapshot
 * @returns {Array<{label: string, icon: string, tone: string, hint: string}>}
 */
function badgesFor(system, snapshot) {
  const badges = [];

  if (system.defeated) {
    badges.push({
      label: "FGT.Sheet.Defeated", icon: "fa-solid fa-skull", tone: "danger",
      hint: system.defeatCause ? "FGT.Sheet.DefeatedByHint" : "FGT.Sheet.DefeatedHint",
    });
  }
  if (system.concealed || snapshot?.concealed) {
    badges.push({
      label: "FGT.Sheet.Concealed", icon: "fa-solid fa-eye-slash", tone: "info",
      hint: "FGT.Sheet.ConcealedHint",
    });
  }
  // §16.6: a Servant whose Master has died "remains in whatever state it was
  // in", so a Berserker with Mad Enhancement on cannot switch it off.
  if (system.modesLocked) {
    badges.push({
      label: "FGT.Sheet.ModesLocked", icon: "fa-solid fa-lock", tone: "warn",
      hint: "FGT.Sheet.ModesLockedHint",
    });
  }
  if (snapshot?.outsideZon) {
    badges.push({
      label: "FGT.Sheet.OutsideZon", icon: "fa-solid fa-circle-dashed", tone: "warn",
      hint: "FGT.Sheet.OutsideZonHint",
    });
  }

  return badges;
}

/**
 * @param {string} text
 * @returns {string}
 */
function titleCase(text) {
  const spaced = String(text).replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The Overview tab: everything that decides what this Unit may do now.
 *
 * Reads the **snapshot** rather than the raw system wherever the two differ,
 * because the snapshot is what every rule reads. A sheet showing the authored
 * MOV beside an engine using the modified one is a sheet that lies quietly.
 *
 * @param {object} actor
 * @param {object} snapshot
 * @returns {object}
 */
function overviewContext(actor, snapshot) {
  const system = actor.system;

  return {
    combat: {
      baseAttack: system.baseAttack ?? null,
      normalAttack: normalAttackLine(system.normalAttack),
      mov: snapshot.mov,
      rangePanels: snapshot.range,
      maxTargets: snapshot.maxTargets,
      // Ch. 08 §8.7. `snapshot.detect` is the AUTHORED override and is `null`
      // on almost every unit -- the derivation lives in `detectRangeOf`, which
      // needs the board for a Caster's Home Base check. Reading the raw field
      // printed an empty Detect on every sheet that had not overridden it,
      // which is every sheet but the Golden Hind's.
      detect: {
        value: detectRangeOf(snapshot, currentBoard()),
        derived: system.detect === null,
      },
      // The authored expression AND what is left of it. Every consumer used to
      // treat `sustainability` itself as a number and compare "2◈" > 5.
      sustainability: system.sustainability
        ? { max: system.sustainability, remaining: system.sustainabilityRemaining ?? snapshot.sustainability }
        : null,
      facing: system.facing,
    },

    // Documented in `rules/snapshot.mjs` as being "here so a sheet can explain
    // the number", and unread by any sheet until now.
    deltas: (snapshot.statDeltas ?? [])
      .filter((d) => !d.target || d.target === "self")
      .map((d) => ({
        stat: d.stat,
        source: d.source ?? game.i18n.localize("FGT.Sheet.UnknownSource"),
        amount: d.rankShift ? `${d.rankShift > 0 ? "+" : ""}${d.rankShift} rank` : signed(d.value),
      })),

    status: {
      contract: system.contract ?? null,
      masterName: system.masterId ? (game.actors.get(system.masterId)?.name ?? null) : null,
      zon: snapshot.zon ?? null,
      zonDistance: snapshot.zonDistance ?? null,
      outsideZon: Boolean(snapshot.outsideZon),
      // Named rather than implied: a player who sees "outside ZON" and not what
      // it costs has to remember the rule, and remembering it is the mistake.
      penalty: snapshot.outsideZon ? game.i18n.localize("FGT.Master.ZonPenalty") : null,
      zonExempt: Boolean(system.zonExempt),
      zonPartners: [...(system.zonPartnerIds ?? [])]
        .map((id) => game.actors.get(id)?.name ?? id),
      platform: system.boundToPlatformId
        ? (game.actors.get(system.boundToPlatformId)?.name ?? system.boundToPlatformId)
        : null,
    },

    // A warning that does not block (§29.9's amber badge). Shown because the
    // alternative is discovering it after committing an attack.
    compulsions: (snapshot.compulsionRules ?? []).map((rule) => ({
      text: rule.text ?? rule.reason ?? JSON.stringify(rule),
    })),

    budget: budgetRow(snapshot),

    // §6.10's per-unit pools -- PRS Tokens, Fragarach Tokens, Construction --
    // which gate abilities and appeared nowhere on the old sheet.
    pools: Object.entries(snapshot.resources ?? {}).map(([key, pool]) => ({
      key,
      value: pool.value ?? 0,
      max: pool.max ?? null,
      // Pips built here: Foundry registers no `range` helper and a template
      // that invents one throws at render time.
      pips: pool.max
        ? "●".repeat(Math.min(pool.value ?? 0, 12)) + "○".repeat(Math.max(0, pool.max - (pool.value ?? 0)))
        : null,
    })),

    platform: actor.type === "platform" ? platformBlock(system) : null,
    summon: actor.type === "summon" ? summonBlock(system) : null,
  };
}

/**
 * What a Normal Attack is made of.
 *
 * EMIYA's changes component at Range 3, and nothing on the old sheet said so —
 * a player reading "BA(STR) 75" had no way to know that at range his attack
 * draws on MAG instead.
 *
 * @param {object|null} normalAttack
 * @returns {object}
 */
function normalAttackLine(normalAttack) {
  const mode = normalAttack?.mode ?? "fixed";
  const bands = mode === "rangeBanded" ? [...(normalAttack?.bands ?? [])] : [];

  return {
    mode,
    component: normalAttack?.component ?? "str",
    // A band declares only where it STARTS. EMIYA's single band is `{from: 3}`
    // with no upper bound, so a template printing `{{to}}` rendered "Range
    // 3–undefined" -- the range is read off the NEXT band's start, or is open.
    //
    // `sources` is the other half nobody was showing: his band is not "STR"
    // but STR at full weight plus a fifth of MAG, which is a different number.
    bands: bands.map((band, index) => ({
      from: band.from ?? 0,
      to: bands[index + 1]?.from ? bands[index + 1].from - 1 : null,
      component: band.component ?? "str",
      mix: (band.sources ?? []).map((s) => ({
        component: s.component,
        percent: Math.round((s.factor ?? 0) * 100),
      })),
      ignoresMagicResistance: Boolean(band.ignoresMagicResistance),
    })),
  };
}

/**
 * What this Unit has already spent this Turn.
 *
 * Read from the snapshot, which has already applied the stale-by-tick rule —
 * a state stamped with an earlier tick is spent whatever it says, so a reset
 * hook that failed to fire cannot leave a Servant looking exhausted forever.
 *
 * @param {object} snapshot
 * @returns {object}
 */
function budgetRow(snapshot) {
  const turn = snapshot.turnState ?? {};
  return {
    acted: Boolean(turn.acted),
    moved: Boolean(turn.moved),
    attacked: Boolean(turn.attacked),
    usedActiveSkill: Boolean(turn.usedActiveSkill),
    movedPanels: turn.movedPanels ?? 0,
    mov: snapshot.mov ?? 0,
    moveSegments: turn.moveSegments ?? 0,
    itemTransfers: turn.itemTransfers ?? 0,
  };
}

/**
 * Platform-only Overview blocks (Ch. 20).
 * @param {object} system
 * @returns {object}
 */
function platformBlock(system) {
  return {
    footprint: system.footprint ?? null,
    capacity: system.capacity ?? null,
    level: system.level ?? 0,
    owner: system.ownerId ? (game.actors.get(system.ownerId)?.name ?? system.ownerId) : null,
    upkeep: system.upkeep ?? null,
    // §20.7: cross-level protection is decided per platform, not globally, so
    // the four axes are shown rather than summarised into a single word.
    crossLevel: Object.entries(system.crossLevel ?? {}).map(([key, value]) => ({ key, value: String(value) })),
  };
}

/**
 * Summon-only Overview blocks.
 * @param {object} system
 * @returns {object}
 */
function summonBlock(system) {
  return {
    summoner: system.summonerId ? (game.actors.get(system.summonerId)?.name ?? system.summonerId) : null,
    expiresAt: system.expiresAt ?? null,
    countsTowardBudget: Boolean(system.countsTowardBudget),
    // Medea's second clause: "The same Dragon Tooth Warrior can only Move/Attack
    // once per Turn", which is distinct from the budget exemption above.
    actsOncePerTurn: Boolean(system.actsOncePerTurn),
  };
}

/**
 * @param {number|null|undefined} value
 * @returns {string}
 */
function signed(value) {
  const n = value ?? 0;
  return n > 0 ? `+${n}` : String(n);
}
