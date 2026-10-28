/**
 * @file A Unit taking another form, for good.
 * @see docs/24-modes-and-control.md, module/rules/form.mjs
 *
 * Layer 3. Gilles (Caster)'s Gigantic Horror (#323): *"Transforms himself into
 * a Gigantic Horror. Replace Gilles with the Gigantic Horror ... When Gilles
 * turns into the Gigantic Horror, its Stats are fully restored to its new
 * values."* Three doors reach it -- his own use under 25% Health, the 10% die
 * when Prelati's Spellbook is destroyed, the 10% die when he falls -- and all
 * three come here.
 *
 * Ruled: the same Unit and contract (11a); his effects and cooldowns stay (11d);
 * Health and Agility the form's own, his own Luck maximum refilled (11e). A
 * Command Spell effect he holds ends (12f). Inside a Storm Border he cannot
 * become it at all (11h).
 *
 * **A form that comes back** (`form.lasts`): Sieg's Dead Count Shapeshifter
 * turns him into Siegfried for X = 1◈ + ½◈ x d4 Turns (#345). His pools are
 * stored as he goes (`formReturn`) and rolled anew for the form (`pools: roll`,
 * by the form's own Parameters, as at summon); the form's own abilities start
 * fresh. At the end of the Xth Turn he returns (`returnForms`): his pools as
 * they were, the damage they had under whatever maximum he holds now, the toll
 * the sheet prints, and the defining ability's clock started (`countFrom:
 * formEnd`: its `max` plus the Turns he was gone).
 */

import { currentBoard, unitActor } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { publicSpeakerFor, shownName } from "./public-identity.mjs";
import { formOf } from "../rules/form.mjs";
import { fractionTicks, parseTick, resolveTicks } from "../domain/tick.mjs";
import { servantSetupPlan } from "../rules/setup-rolls.mjs";
import { warRule } from "./war.mjs";

/**
 * May this Unit take the form this ability defines, here and now? Not twice,
 * and not where its surroundings refuse what it would create.
 *
 * @param {object} actor
 * @param {object} item the ability defining the form
 * @param {object} [board]
 * @returns {boolean}
 */
export function canTransform(actor, item, board = currentBoard()) {
  if (!item?.system?.form?.id || formOf(actor)) return false;
  const unit = (board?.units ?? []).find((u) => u.id === actor.id);
  const creates = [...(item.system?.creates ?? [])];
  return !(unit?.suppressions ?? []).some((s) => {
    if (s.scope !== "creating") return false;
    const banned = new Set(s.attributes ?? []);
    return creates.some((a) => banned.has(a));
  });
}

/**
 * Take the form.
 *
 * @param {string} unitId
 * @param {string} abilityContentId the ability whose `form` it takes
 * @param {{cause?: string|null}} [ctx] `used`, `objectDestroyed`, `defeat`
 * @returns {Promise<boolean>} whether it took it
 */
export async function transformUnit(unitId, abilityContentId, { cause = null } = {}) {
  const doc = unitActor(unitId);
  const item = doc?.items?.find((i) => i.system?.contentId === abilityContentId || i.id === abilityContentId) ?? null;
  const board = currentBoard();
  if (!doc || !item || !canTransform(doc, item, board)) return false;
  const form = item.system.form;
  const sys = doc.system;
  // A form that comes back: its length on a die, its pools rolled, and what it
  // returns to (#345).
  const lasting = form.lasts ? await lastingForm(doc, item, form, board) : null;
  await applyWorldIntents([
    I.takeForm(unitId, {
      formId: form.id, pools: lasting?.pools ?? form.pools ?? {}, handOver: form.controller === "gm",
      stands: cause === "defeat", returns: lasting?.returns ?? null,
    }),
    // *"With all Skills and NP available"*: the form's own clocks start at 0.
    ...(lasting?.fresh ?? []).map((id) => I.cooldown(unitId, id, 0, "set")),
  ], "transform");

  // *"Command Spells have no effect"*: one he holds ends with the change (12f).
  // A Command Spell's effect is his Master's: `engine/command-spells.mjs`
  // applies it with the Master as its source.
  const masterId = sys.masterId ?? null;
  const held = masterId ? [...(doc.effects ?? [])].filter((e) => e.system?.sourceUnitId === masterId) : [];
  if (held.length > 0) await applyWorldIntents(held.map((e) => I.removeEffect(unitId, e.id, "transform")), "transform");

  const escape = foundry.utils.escapeHTML;
  // The dice that decided it, on the card: how long, and the new Stats (#345).
  const rolled = (lasting?.lines ?? []).map((l) => `<p>${escape(l)}</p>`).join("");
  await ChatMessage.create({
    content: `<div class="fgt-card"><p>${game.i18n.format("FGT.Transform.Took", {
      name: escape(shownName(doc, board)), form: escape(item.name),
    })}</p>${rolled}</div>`,
    speaker: publicSpeakerFor(doc),
  });
  return true;
}

/**
 * What a form that comes back needs as it is taken: its length on its die, the
 * pools rolled for it, the record of what it returns to, and the form's own
 * abilities to start fresh. Sieg's Siegfried (#345 rulings 2, 3).
 *
 * @param {object} doc the actor
 * @param {object} item the ability defining the form
 * @param {object} form its `form` block
 * @param {object} board
 * @returns {Promise<{pools: object, returns: object, fresh: string[], lines: string[]}>}
 */
async function lastingForm(doc, item, form, board) {
  const sys = doc.system ?? {};
  const turnsPerRound = warRule("turnsPerRound") || 3;
  const die = await new Roll(form.lasts.die ?? "1d4").evaluate();
  const turns = lastingTurns(form.lasts, die.total, turnsPerRound);
  const tick = board?.tick ?? 0;

  // *"New Stats have to be rolled"*: by the form's own Parameters, the lines a
  // summon rolls (`rules/setup-rolls.mjs#servantSetupPlan`).
  const plan = servantSetupPlan({ parameters: form.overrides?.parameters ?? sys.parameters ?? {} });
  const lineOf = (id) => plan.lines.find((l) => l.id === id) ?? null;
  const pools = {};
  const lines = [game.i18n.format("FGT.Transform.Lasts", { roll: die.total, turns })];
  if (form.pools?.health === "full") pools.health = Number(form.overrides?.baseHealth ?? sys.health?.max ?? 0);
  for (const [stat, id] of [["agility", "maxAgility"], ["luck", "maxLuck"]]) {
    if (form.pools?.[stat] !== "roll") continue;
    const line = lineOf(id);
    if (!line?.roll) continue;
    const r = await new Roll(line.roll.formula).evaluate();
    const mapped = line.roll.map ? (line.roll.map[r.total - 1] ?? r.total) : r.total;
    pools[stat] = Number(line.base ?? 0) + Number(mapped);
    lines.push(game.i18n.format("FGT.Transform.RolledStat", {
      stat: game.i18n.localize(`FGT.Resource.${stat}`), roll: r.total, value: pools[stat],
    }));
  }

  // What he returns to: each pool's stored value and maximum, and the maximum
  // he SHOWED, so a maximum that rose while he was away raises his current by
  // as much (his Bridal Chest growth, #345 ruling 22).
  const stored = (stat) => ({
    value: Number(doc._source?.system?.[stat]?.value ?? sys[stat]?.value ?? 0),
    max: Number(doc._source?.system?.[stat]?.max ?? sys[stat]?.max ?? 0),
    shown: Number(sys[stat]?.max ?? 0),
  });
  const returns = {
    abilityId: item.id, tookTick: tick, endsAfterTick: tick + Math.max(1, turns) - 1, turns,
    pools: { health: stored("health"), agility: stored("agility"), luck: stored("luck") },
  };
  const fresh = [...(doc.items ?? [])].filter((i) => i.system?.formOnly === form.id).map((i) => i.id);
  return { pools, returns, fresh, lines };
}

/**
 * X Turns of a form that lasts `base + per x roll`, the sum taken in ◈ and only
 * then turned into Turns: *"X=(1◈+[½◈*Number rolled])"* is 1◈ + 1◈ on a 2,
 * three Turns, where ½◈ turned first (two Turns each) made it four (#345,
 * found live). A fraction left over goes by the War's table (`fractionTicks`).
 *
 * @param {{base?: string, per?: string}} lasts
 * @param {number} roll
 * @param {number} turnsPerRound
 * @returns {number}
 */
export function lastingTurns(lasts, roll, turnsPerRound) {
  /** A ◈ expression as a fraction of Rounds, or a bare Turn count. */
  const rational = (expr) => {
    const t = expr ? parseTick(expr) : null;
    if (t?.kind === "ticks") return { num: 0, den: 1, ticks: t.n };
    if (t?.kind !== "rounds") return { num: 0, den: 1, ticks: 0 };
    const den = t.frac?.den ?? 1;
    return { num: t.whole * den + (t.sign ?? 1) * (t.frac?.num ?? 0), den, ticks: 0 };
  };
  const b = rational(lasts.base);
  const p = rational(lasts.per);
  const den = b.den * p.den;
  const num = b.num * p.den + roll * p.num * b.den;
  const whole = Math.floor(num / den);
  const rest = num - whole * den;
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const g = rest ? gcd(rest, den) : 1;
  return whole * turnsPerRound + (rest ? fractionTicks(rest / g, den / g, turnsPerRound) : 0) + b.ticks + roll * p.ticks;
}

/**
 * Bring back every Unit whose form's Turns are spent, at this Turn's end.
 *
 * @param {object[]} units the board's
 * @param {number} tick the Turn that is ending
 * @returns {Promise<string[]>} who returned
 */
export async function returnForms(units, tick) {
  const back = [];
  for (const u of units ?? []) {
    const doc = unitActor(u.id);
    const ret = doc?.system?.formReturn ?? null;
    if (!ret || doc.system?.defeated || tick < (ret.endsAfterTick ?? Infinity)) continue;
    if (await leaveForm(u.id, { tick })) back.push(u.id);
  }
  return back;
}

/**
 * Leave a form that comes back (#345): his pools as they were, the toll, and
 * the defining ability's clock.
 *
 * *"Transforms back into Sieg with his Stats and Skill/Spell/NP Cooldowns the
 * same as they were before he transformed, then his Health is reduced by 100
 * (Sieg's Health cannot drop below 1 in this way)."* His own clocks waited:
 * an ability the form dropped is not ticked (`scheduler.mjs` reads the kept),
 * so they are as he left them, save what Galvanism cut (ruling 21).
 *
 * @param {string} unitId
 * @param {{tick?: number|null}} [at]
 * @returns {Promise<boolean>}
 */
export async function leaveForm(unitId, { tick = null } = {}) {
  const doc = unitActor(unitId);
  const ret = doc?.system?.formReturn ?? null;
  if (!doc || !ret) return false;
  const item = doc.items.get(ret.abilityId) ?? null;
  const spec = item?.system?.form ?? {};
  const pools = Object.fromEntries(Object.entries(ret.pools ?? {}).map(([stat, p]) => [stat, { value: p.value, max: p.max }]));
  await applyWorldIntents([I.leaveForm(unitId, { pools })], "transform:return");

  /** @type {object[]} */
  const after = [];
  // A maximum that rose while he was away raises his current by as much.
  for (const [stat, p] of Object.entries(ret.pools ?? {})) {
    const shown = Number(unitActor(unitId)?.system?.[stat]?.max ?? p.shown);
    const rose = shown - Number(p.shown ?? shown);
    if (rose > 0) after.push(I.statDelta(unitId, `${stat}.value`, rose, true));
  }
  // The toll, never below its floor (*"cannot drop below 1 in this way"*).
  const toll = spec.returns?.toll ?? null;
  const before = Number(unitActor(unitId)?.system?.health?.value ?? 0);
  if (toll?.amount) {
    const stat = toll.stat ?? "health";
    const current = Number(unitActor(unitId)?.system?.[stat]?.value ?? 0);
    const take = Math.max(0, Math.min(Number(toll.amount), current - Number(toll.floor ?? 0)));
    if (take > 0) after.push(I.statDelta(unitId, `${stat}.value`, -take, true));
  }
  // The clock that counts from the return: its own length plus the Turns the
  // form lasted (*"3◈ Turns plus the number of Turns Sieg was transformed for"*).
  const cd = item?.system?.cooldown ?? null;
  const gone = tick !== null ? Math.max(1, tick - Number(ret.tookTick ?? tick) + 1) : Number(ret.turns ?? 0);
  if (item && cd?.countFrom === "formEnd" && cd.max) {
    const base = resolveTicks(parseTick(cd.max), { turnsPerRound: warRule("turnsPerRound") || 3 });
    after.push(I.cooldown(unitId, item.id, base + gone, "set"));
  }
  if (after.length > 0) await applyWorldIntents(after, "transform:return");
  const health = Number(unitActor(unitId)?.system?.health?.value ?? 0);

  const board = currentBoard();
  const escape = foundry.utils.escapeHTML;
  await ChatMessage.create({
    content: `<div class="fgt-card"><p>${game.i18n.format("FGT.Transform.Returned", {
      name: escape(shownName(doc, board)), form: escape(item?.name ?? spec.id ?? ""), turns: gone,
    })}</p><p>${game.i18n.format("FGT.Transform.Toll", { before, after: health })}</p></div>`,
    speaker: publicSpeakerFor(doc),
  });
  return true;
}
