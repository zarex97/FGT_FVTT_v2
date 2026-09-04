/**
 * @file Summoning a Servant, and rolling a Master's setup lines.
 * @see docs/37-content-pipeline.md §37.6, docs/14-checks-and-randomness.md §14.9
 *
 * Layer 3. `rules/setup-rolls.mjs` says what to roll and how to fold the
 * results; this rolls it and writes it.
 *
 * The operation is split into **prepare → re-roll → commit** rather than done
 * in one call, because §37.6 requires every line to be shown before anything is
 * written, with a per-line GM re-roll. A one-shot summon cannot offer that: by
 * the time the numbers exist, the actor already does too.
 *
 * Nothing is written until `commitSummon`. A half-applied summon — Health
 * rolled, Region grant not — would leave a Servant on the board that no rule
 * could put right, because the plan is not recoverable from the sheet once the
 * rolls are gone.
 */

import {
  servantSetupPlan, masterSetupPlan, resolveSetupPlan, summonPlan, needsSetupRolls,
} from "../rules/setup-rolls.mjs";
import { regionsAdjacent } from "../rules/environment.mjs";

/**
 * Roll one line of a plan.
 *
 * The sign coin is a separate d2 rather than a negative die: the plan describes
 * it that way, and `2d100` that can come out negative is not a formula Foundry
 * evaluates.
 *
 * @param {object} line
 * @returns {Promise<{total: number, sign: boolean, rolls: object[]}>}
 */
export async function rollLine(line) {
  if (!line.roll) return { total: 0, sign: false, rolls: [] };

  const roll = await new Roll(line.roll.formula).evaluate();
  const out = { total: roll.total, sign: false, rolls: [{ id: line.id, label: line.label, roll }] };

  if (line.roll.signCoin) {
    const coin = await new Roll("1d2").evaluate();
    out.sign = coin.total === 1;
    out.rolls.push({ id: `${line.id}:sign`, label: `${line.label} (sign)`, roll: coin });
  }
  return out;
}

/**
 * Roll a whole setup plan.
 *
 * @param {object} plan from `servantSetupPlan` or `masterSetupPlan`
 * @returns {Promise<{lines: object[], rolls: object[], totals: object, signs: object}>}
 */
export async function rollSetupPlan(plan) {
  /** @type {Record<string, number>} */ const totals = {};
  /** @type {Record<string, boolean>} */ const signs = {};
  /** @type {object[]} */ const rolls = [];

  for (const line of plan.lines) {
    if (!line.roll) continue;
    const result = await rollLine(line);
    totals[line.id] = result.total;
    signs[line.id] = result.sign;
    rolls.push(...result.rolls);
  }

  return { lines: resolveSetupPlan(plan, totals, signs), rolls, totals, signs };
}

/* -------------------------------------------------------------------------- */
/*  Summoning a Servant                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Everything a summon needs, rolled, with nothing written.
 *
 * The returned object is the dialog's whole state: it holds the source
 * document, the ordered plan steps, the rolled totals so one line can be
 * re-rolled without disturbing the others, and the resolved lines to display.
 *
 * @param {object} args
 * @param {string} args.contentId
 * @param {string} [args.masterId]
 * @param {string|null} [args.region] defaults to the world setting
 * @param {Record<string, number>} [args.masterGrants]
 * @returns {Promise<object|null>} null when the Servant is not in any pack
 */
export async function prepareSummon({ contentId, masterId = null, region = null, masterGrants = {} }) {
  const source = await servantFromPacks(contentId);
  if (!source) return null;

  // Normalized, not handed over raw. The pure layer's contract is that it
  // takes a **snapshot**, and a live document's system is not one: its
  // `SetField`s are `Set`s, and `region.includes(...)` threw the moment a
  // Servant was summoned. Every rules function downstream is entitled to an
  // array, so the conversion belongs here rather than in each of them.
  const sheet = sheetSnapshot(source);
  const warRegion = region ?? (game.settings.get("fgt", "region") || null);
  const master = masterId ? game.actors.get(masterId) : null;

  const plan = servantSetupPlan(sheet);
  const { totals, signs, rolls } = await rollSetupPlan(plan);

  return refresh({
    source, sheet, master, warRegion, masterGrants, plan, totals, signs, rolls,
    steps: summonPlan({ sheet, master, warRegion, masterGrants }),
  });
}

/**
 * Re-roll one line of a prepared summon.
 *
 * A GM re-roll replaces the line and leaves the rest alone — re-rolling the
 * whole plan to change one number would quietly move the two the GM had already
 * accepted, which is the opposite of what the button says it does.
 *
 * @param {object} prepared
 * @param {string} lineId
 * @returns {Promise<object>}
 */
export async function rerollSummonLine(prepared, lineId) {
  const line = prepared.plan.lines.find((l) => l.id === lineId);
  if (!line?.roll) return prepared;

  const result = await rollLine(line);
  return refresh({
    ...prepared,
    totals: { ...prepared.totals, [lineId]: result.total },
    signs: { ...prepared.signs, [lineId]: result.sign },
    rolls: [...prepared.rolls, ...result.rolls],
  });
}

/**
 * Change who the Servant is being summoned for, or what the Master grants,
 * without re-rolling anything.
 *
 * The rolls survive: §37.6 applies grants **after** the rolls, so changing a
 * grant cannot change a die that was already thrown, and re-rolling here would
 * hand the GM a new set of numbers every time they touched the dropdown.
 *
 * @param {object} prepared
 * @param {object} changes
 * @returns {object}
 */
export function reviseSummon(prepared, { masterId, warRegion, masterGrants }) {
  const master = masterId === undefined
    ? prepared.master
    : (masterId ? game.actors.get(masterId) : null);

  const next = {
    ...prepared,
    master,
    warRegion: warRegion === undefined ? prepared.warRegion : warRegion,
    masterGrants: masterGrants ?? prepared.masterGrants,
  };
  next.steps = summonPlan({
    sheet: next.sheet, master: next.master,
    warRegion: next.warRegion, masterGrants: next.masterGrants,
  });
  return refresh(next);
}

/**
 * Create the actor.
 *
 * @param {object} prepared
 * @returns {Promise<object>} the created actor
 */
export async function commitSummon(prepared) {
  const data = prepared.source.toObject();
  data.system = {
    ...data.system,
    // `masterGranted`, not `granted`: see `sheetPatch`. The Region's step is
    // already in the rolled maxima and is recomputed live for the Ranks.
    ...sheetPatch(prepared.lines, prepared.sheet, prepared.masterGranted ?? {}, prepared.warRegion),
  };

  // The war's Region, recorded where the rest of the system reads it.
  //
  // The dialog has always asked for it, and the answer went into this ONE
  // summon and nowhere else. That was survivable only while the Region's grant
  // was baked into `grantedSteps`; now that the grant is recomputed live from
  // `board.warRegion`, a Region chosen here and stored nowhere means the bonus
  // is computed against `null` and the Servant gets nothing. Found immediately
  // on the first re-summon after the grant was un-baked.
  //
  // A war has ONE Region, so this is not a per-summon field that happens to be
  // asked at summon time -- it is the war's, and `settings.mjs` already
  // declares `fgt.region` for it. Writing it here also switches on everything
  // else keyed to the war Region that has been inert for want of a writer:
  // `regionScale` (the Hanging Gardens' Construction multiplier) and Asterios's
  // *"if the Region is Greece"* clause.
  if (prepared.warRegion) await setWarRegion(prepared.warRegion);

  // §16.2's derivation, written down at the one moment it is unambiguous. The
  // schema initialises `contract` to `"contracted"`, which is the right default
  // for nothing: a Servant summoned with no Master is FREE, and left to the
  // default its sheet reported a contract, a Master slot with no name in it,
  // and a Sustainability clock that should have been running.
  data.system.contract = prepared.master ? "contracted" : "free";

  if (prepared.master) {
    data.system.masterId = prepared.master.id;
    data.system.factionId = prepared.master.system?.factionId ?? null;
  } else {
    data.system.masterId = null;
  }
  // The rolls lock at match start (§37.6); recording when they were made is
  // what lets anyone check that afterwards.
  data.system.summonedAt = game.combat?.system?.globalTurn ?? 0;

  const [actor] = await Actor.createDocuments([data]);
  return actor;
}

/**
 * Record the war's Region, unless it is already what it should be.
 *
 * A world setting rather than the Combat document because `engine/board.mjs`
 * reads the match first and this second, and a match may not exist yet at
 * summon time. GM-only: a player summoning cannot write world settings, and
 * failing loudly here would abort an otherwise valid summon.
 *
 * @param {string} region
 * @returns {Promise<void>}
 */
async function setWarRegion(region) {
  try {
    if (!game.user?.isGM) return;
    if (game.settings.get("fgt", "region") === region) return;
    await game.settings.set("fgt", "region", region);
  } catch (err) {
    console.warn("FGT | Could not record the war Region:", err);
  }
}

/**
 * Prepare, commit, and skip the dialog. The macro path.
 *
 * @param {object} args see {@link prepareSummon}
 * @returns {Promise<{ok: boolean, reason?: string, actor?: object, lines?: object[]}>}
 */
export async function summonServant(args) {
  const prepared = await prepareSummon(args);
  if (!prepared) return { ok: false, reason: "unknownServant" };

  const actor = await commitSummon(prepared);
  return { ok: true, actor, lines: prepared.lines };
}

/**
 * Give every Servant that never had its setup rolls made them, once.
 *
 * Agility and Luck are rolled, not derived, so a Servant that reached the world
 * without passing through `commitSummon` keeps the compendium template's zeroes
 * — and a maximum of 0 is a number no d20 can roll under, so that Servant
 * auto-fails every Evade and every Luck Check in silence. The ordinary paths are
 * covered (the summon dialog, and `apps/summon-entry.mjs` intercepting a bare
 * compendium drop); this catches an actor that was duplicated, built by a macro
 * or imported.
 *
 * Idempotent: `needsSetupRolls` is false the moment the maxima are written, so a
 * second pass rolls nothing. Health is deliberately left alone —
 * `ServantData#prepareBaseData` derives it from the END table with no die, and
 * Base Attack likewise from STR and MAG.
 *
 * Announced rather than silent. A Servant's Agility changing under the GM
 * without explanation is worse than the bug it fixes.
 *
 * @returns {Promise<object[]>} what was rolled, per Servant
 */
export async function ensureSetupRolls() {
  if (!game.user.isGM) return [];

  /** @type {object[]} */
  const done = [];
  for (const actor of game.actors) {
    if (actor.type !== "servant") continue;
    if (!needsSetupRolls(actor.system)) continue;

    const { lines } = await rollSetupPlan(servantSetupPlan(sheetSnapshot(actor)));
    const value = (id) => lines.find((l) => l.id === id)?.value ?? 0;
    const agility = value("maxAgility");
    const luck = value("maxLuck");

    await actor.update({
      "system.agility": { max: agility, value: agility },
      "system.luck": { max: luck, value: luck },
    });
    done.push({ id: actor.id, name: actor.name, agility, luck });
  }

  if (done.length > 0) {
    console.warn("FGT | Setup rolls made for Servants that had none:", done);
    ui.notifications?.info(game.i18n.format("FGT.Summon.BackfilledRolls", { count: done.length }));
  }
  return done;
}

/**
 * Roll a Master's setup lines onto an existing Master actor.
 *
 * @param {object} args
 * @param {string} args.masterId
 * @param {boolean} [args.confirm]
 * @returns {Promise<{ok: boolean, reason?: string, lines?: object[]}>}
 */
export async function rollMasterSetup({ masterId, confirm = true }) {
  const actor = game.actors.get(masterId);
  if (!actor) return { ok: false, reason: "notFound" };

  // §14.9's three modes. The setting existed from the day settings were
  // written and nothing read it, so every Master was ranked by essence
  // whatever the world was configured for.
  const mode = game.settings.get("fgt", "masterMode") ?? "essences";
  const { lines } = await rollSetupPlan(masterSetupPlan(actor.system, { mode }));
  if (!confirm) return { ok: true, lines };

  const patch = {};
  for (const line of lines) {
    const path = SETUP_PATHS[line.id];
    if (path) patch[path] = line.value;
  }
  // Current values start at their maxima; a Master that begins a war already
  // wounded is not a rule anywhere.
  patch["system.health.value"] = patch["system.health.max"] ?? actor.system.health.max;
  patch["system.agility.value"] = patch["system.agility.max"] ?? actor.system.agility.max;
  patch["system.luck.value"] = patch["system.luck.max"] ?? actor.system.luck.max;
  await actor.update(patch);

  return { ok: true, lines };
}

/**
 * Every Servant in the content packs, for a picker.
 * @returns {Promise<Array<{contentId: string, name: string, img: string, pack: string}>>}
 */
export async function servantCatalogue() {
  /** @type {Array<{contentId: string, name: string, img: string, pack: string}>} */
  const out = [];
  for (const pack of game.packs.filter((p) => p.metadata.type === "Actor")) {
    const index = await pack.getIndex({ fields: ["system.contentId", "type", "system.servantClasses"] });
    for (const entry of index) {
      if (entry.type !== "servant") continue;
      out.push({
        contentId: entry.system?.contentId ?? entry._id,
        name: entry.name,
        img: entry.img,
        pack: pack.metadata.label,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/** §14.9: Max Health moves by this much per END step, in either direction. */
const HEALTH_PER_END_STEP = 100;

/** Where each setup line is stored. */
const SETUP_PATHS = Object.freeze({
  maxHealth: "system.health.max",
  maxAgility: "system.agility.max",
  maxLuck: "system.luck.max",
  baseAttackMag: "system.baseAttack.mag",
  // The rank the coin decided, KEPT. `setup-rolls.mjs` used to fold it into
  // Base Attack (MAG) and throw it away, leaving a Master who flipped Heads
  // Rankless for ZON, Sustainability, the parameter grant and Kill Yourself.
  rank: "system.rank",
  commandSpells: "system.commandSpells.value",
});

/**
 * Recompute everything derived from the rolls and the grants.
 *
 * Called after every change, so the displayed lines and the committed sheet
 * come from **one** computation. Two paths that both derive the final numbers
 * is how a dialog ends up showing one thing and writing another.
 *
 * @param {object} prepared
 * @returns {object}
 */
function refresh(prepared) {
  const granted = mergeGrants(prepared.steps);
  const resolved = resolveSetupPlan(prepared.plan, prepared.totals, prepared.signs);
  return {
    ...prepared,
    granted,
    // The Master's steps ALONE, which is what gets written to the sheet. The
    // merged map above still drives the rolled maxima, because those are rolled
    // once and locked and the Region's step is part of that roll; the Region's
    // effect on RANKS is recomputed live instead. See `commitSummon`.
    masterGranted: mergeGrants(prepared.steps, "master"),
    lines: applyGrants(resolved, prepared.sheet, granted),
  };
}

/**
 * The Servant's parameter grants, merged across every source in the plan.
 *
 * Master and Region grants are separate **steps** and stack; they are merged
 * here only to compute the final sheet, and the plan keeps them apart so the
 * dialog can show where each step came from.
 *
 * `source` narrows the merge to one of them. `commitSummon` needs the Master's
 * alone: the Region's grant is not a property of the Servant and must not be
 * written onto it.
 *
 * @param {object[]} steps
 * @param {string|null} [source] `"master"`, `"region:<id>"`, or null for all
 * @returns {Record<string, number>}
 */
export function mergeGrants(steps, source = null) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const step of (steps ?? []).filter((s) => s.kind === "grant" && (!source || s.source === source))) {
    for (const [parameter, n] of Object.entries(step.steps)) {
      out[parameter] = (out[parameter] ?? 0) + n;
    }
  }
  return out;
}

/**
 * Add the granted steps to the resolved lines.
 *
 * END, AGI and LUC steps raise their own maxima; STR and MAG move Base Attack
 * instead, in `sheetPatch`.
 *
 * @param {object[]} lines
 * @param {object} sheet
 * @param {Record<string, number>} bakedGrants the grants to WRITE onto the
 *   sheet — the Master's, never the Region's. The maxima have already taken
 *   both, in `applyGrants`.
 * @returns {object[]}
 */
export function applyGrants(lines, sheet, granted) {
  const bump = { maxHealth: granted.end ?? 0, maxAgility: granted.agi ?? 0, maxLuck: granted.luc ?? 0 };
  return lines.map((line) => {
    const steps = bump[line.id] ?? 0;
    if (steps === 0) return line;
    // A granted END step moves the Servant **up the Health table** rather than
    // adding one, because the table is not linear.
    const value = line.id === "maxHealth" ? healthAt(sheet, steps) : line.value + steps;
    return { ...line, value, granted: steps };
  });
}

/**
 * Max Health after `steps` granted END steps, read off the table.
 * @param {object} sheet
 * @param {number} steps
 * @returns {number}
 */
function healthAt(sheet, steps) {
  // §14.9 states it literally: `baseHealthByEnd[grade] ± 100 per END step`.
  //
  // Re-reading the table at the shifted rank looks equivalent and is not, for a
  // Servant whose sheet states its own `baseHealth`: `servantSetupPlan` prefers
  // the stated figure, so the shifted lookup returned the SAME number and the
  // granted step vanished. Medea is the first Servant to state one (750), and
  // her Greece Region grant silently did nothing to her Health.
  const base = Number(servantSetupPlan(sheet).lines.find((l) => l.id === "maxHealth").base);
  return base + HEALTH_PER_END_STEP * steps;
}

/**
 * The system patch a resolved plan produces.
 * @param {object[]} lines
 * @param {object} sheet
 * @param {Record<string, number>} granted
 * @param {string|null} [warRegion] HGoB Construction source 1's own input,
 *   unrelated to the parameter-grant Region bonus `summonPlan` already
 *   handles as a `steps` entry
 * @returns {object}
 */
export function sheetPatch(lines, sheet, bakedGrants, warRegion = null) {
  /** @type {Record<string, unknown>} */
  const patch = {};
  const value = (id) => lines.find((l) => l.id === id)?.value ?? 0;

  patch.health = { max: value("maxHealth"), value: value("maxHealth") };
  patch.agility = { max: value("maxAgility"), value: value("maxAgility") };
  patch.luck = { max: value("maxLuck"), value: value("maxLuck") };

  // Base Attack is NOT patched here. It is derived from STR and
  // MAG by `ServantData#prepareBaseData`, which reads the `grantedSteps` written
  // just below — so a granted step reaches Base Attack by moving the rank,
  // exactly as an innate one does. Adding an adjustment here as well paid for
  // the same step twice. The pre-table reading is quoted in
  // `rules/setup-rolls.mjs`'s header; Ch. 41 Q50 has the author's answer.

  // The granted steps themselves, so the sheet can show "B (granted +1)" rather
  // than silently displaying a rank the Servant was not written with.
  // ONLY the Master's steps belong here. `commitSummon` passes them alone, and
  // the field is read by `baseAttackFor` and by the snapshot's
  // `applyGrantedSteps`/`grantedStepDeltas` -- all three of which say "Master".
  // Baking the war Region's step in as well made every one of them wrong: the
  // Rank moved twice on a board (once here, once in the live Region pass), the
  // Base Attack carried the Region's +10 twice, and the sheet's own explainer
  // told the player a High Rank Master had granted it when there was no Master
  // at all.
  patch.grantedSteps = { str: 0, end: 0, agi: 0, mag: 0, luc: 0, ...bakedGrants };

  // A resolved summon variant (`rules/summon-variant.mjs`): the branch id, for
  // downstream `self:variant:<id>` predicates, and its `overrides` merged in
  // directly — Semiramis's Range and normal-attack mode differ by branch, so
  // these are real field replacements, not a delta on a fixed shape.
  const variantId = value("summonVariant") || null;
  if (variantId) {
    patch.variant = variantId;
    const branch = sheet?.summonVariant?.heads?.id === variantId
      ? sheet.summonVariant.heads
      : sheet?.summonVariant?.tails;
    Object.assign(patch, branch?.overrides ?? {});
  }

  // HGoB Construction (Ch. 32 §32.2). Source 1 -- the Region-based starting
  // value -- is not a roll, so it is added here rather than through the
  // setup plan: 25 if the war's own Region IS Middle East, 10 if merely
  // adjacent to it, 0 otherwise. Source 2 (the summon-time "2d6 multiplied")
  // is `value("hgobConstructionRoll")`, already resolved by the setup plan.
  if (sheet?.resources?.hgobConstruction) {
    const starting = warRegion === "middleEast" ? 25 : regionsAdjacent(warRegion, "middleEast") ? 10 : 0;
    patch.resources = {
      ...(sheet.resources ?? {}),
      hgobConstruction: {
        ...sheet.resources.hgobConstruction,
        value: starting + value("hgobConstructionRoll"),
      },
    };
  }

  return patch;
}

/**
 * A Servant document from the content packs, by content id.
 * @param {string} contentId
 * @returns {Promise<object|null>}
 */
async function servantFromPacks(contentId) {
  for (const pack of game.packs.filter((p) => p.metadata.type === "Actor")) {
    const index = await pack.getIndex({ fields: ["system.contentId"] });
    const entry = index.find((e) => e.system?.contentId === contentId) ?? index.get(contentId);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
}

/**
 * A compendium Servant's system data as a plain snapshot.
 *
 * `toObject()` is what does the work: it converts every `SetField` to an array
 * and every nested model to plain data, which is exactly the shape the rules
 * layer documents itself as taking.
 *
 * @param {object} source the compendium Actor
 * @returns {object}
 */
function sheetSnapshot(source) {
  return source.toObject().system;
}
