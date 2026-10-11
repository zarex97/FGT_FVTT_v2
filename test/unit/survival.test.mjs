/**
 * @file Every Authored Key on a Unit, an Ability or an Effect survives its Route.
 * @see docs/07-schemas.md (the map of Hops), docs/44-testing.md, CONTEXT.md
 *
 * A Silent Drop is a Hop discarding a key it does not name. The build's model
 * check holds the compile to the DataModel; this holds the DataModel to what the
 * rules read. The REAL corpus is compiled, each Unit is built through the real
 * DataModel in the test world, prepared, and projected by the real
 * `snapshotUnit`; each Effect is loaded into the real `EffectRegistry`.
 *
 * Every Authored Key must then have a ROUTE, named below, and the route is
 * checked:
 *
 * - `at` — the key is projected. Its prepared value must be what the projection
 *   holds there, through the named transform. This is the Hop that lost
 *   `requiresHistory`, `unremovable`, `actsOncePerTurn` and `npRegen`: declared,
 *   compiled, stored, and never projected.
 * - `reader` — the key is read from the document, not projected. The named file
 *   must still read it, so a reader that goes away takes the key's route with it.
 *
 * A key with no route fails, naming the file and the last Hop it was seen at.
 * A value that carries no Clause — `null`, `false`, `""`, `[]`, `{}` — is not
 * checked against a projection, because a default cannot be told from a drop.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { loadSource, loadAssets } from "../../tools/lib/load.mjs";
import { compileCorpus } from "../../tools/lib/content.mjs";
import { installSystem, mismatches } from "../../tools/lib/foundry.mjs";
import { withWorld } from "../helpers/world.mjs";

/* -------------------------------------------------------------------------- */
/*  Routes                                                                    */
/* -------------------------------------------------------------------------- */

const same = (at) => ({ at });
const doc = (reader, why) => ({ reader, why });
// A key found with no reader was listed as `{ unread: "#NNN", why }`, owned by
// its issue. The last one left with #101, and the ceiling below is zero.
const text = (v) => (v == null ? v : String(v));

/** Where each Authored Key on a Unit goes after the DataModel. */
export const UNIT_ROUTES = {
  actsOncePerTurn: same("actsOncePerTurn"),
  leavesWithSummoner: doc("module/engine/io.mjs", "read off the summon when its summoner is defeated"),
  alignment: same("alignment"),
  baseAttack: same("baseAttack"),
  baseHealth: same("baseHealth"),
  boarding: same("boarding"),
  boardingReliefAfter: same("boardingReliefAfter"),
  destroyedWithOwner: same("destroyedWithOwner"),
  cannotHoldItems: same("cannotHoldItems"),
  capacity: same("capacity"),
  classContainer: same("classContainer"),
  commandSpells: same("commandSpells"),
  contentId: same("contentId"),
  countsAsHomeBase: same("countsAsHomeBase"),
  countsTowardBudget: same("countsTowardBudget"),
  crossLevel: same("crossLevel"),
  deactivateOn: same("deactivateOn"),
  deactivation: same("deactivation"),
  destroyableBy: same("destroyableBy"),
  detect: same("detect"),
  footprint: same("footprint"),
  itemHandling: same("itemHandling"),
  knockOff: same("knockOff"),
  collapse: same("collapse"),
  linkedGroup: same("linkedGroup"),
  lockAboard: same("lockAboard"),
  mov: same("mov"),
  rank: same("rank"),
  region: same("region"),
  replacesRiderAction: same("replacesRiderAction"),
  resources: same("resources"),
  servantClasses: same("servantClasses"),
  sharesPanel: same("sharesPanel"),
  stance: same("stance"),
  stanceSpec: same("stanceSpec"),
  trueName: same("trueName"),
  upkeep: same("upkeep"),
  visibleWithin: same("visibleWithin"),
  zon: same("zon"),
  // Stated as a pool, projected as the number rolled under.
  agility: { at: "agility", from: (v) => v?.value },
  luck: { at: "luck", from: (v) => v?.value },
  // The schema object is split: Range is a distance, and the target cap is its own field.
  range: [{ at: "range", from: (v) => v?.panels }, { at: "maxTargets", from: (v) => v?.targets }],
  // Closed over the implication table, so the projection holds a superset.
  attributes: { at: "attributes", contains: true },
  parameters: { at: "parameters", from: (v) => v, project: (p) => Object.fromEntries(Object.entries(p ?? {}).map(([k, r]) => [k, text(r)])) },
  // Resolved to Turns by the projection itself (`sustainabilityTurns`). The
  // authored expression is also copied to `sustainabilityMax`, which nothing
  // reads, so that is not a route.
  sustainability: doc("module/rules/snapshot.mjs", "resolved to Turns by sustainabilityTurns"),
  movesOntoOccupiedPanels: same("ignoresOccupancy"),
  normalAttack: same("normalAttack"),
  contentVersion: doc("module/content/authored-fields.mjs", "a pack-owned key the content sync carries"),
  defaultImage: doc("module/apps/actor-sheet/context.mjs", "the sheet's portrait"),
  description: doc("module/apps/actor-sheet/context.mjs", "a Platform's sheet text"),
  dimension: [
    doc("module/engine/dimension.mjs", "a pocket dimension is entered from the document"),
    { at: "isDimension", from: (v) => Boolean(v) },
  ],
  // Two readers, because two kinds of Unit author it. A Summon's stats are resolved against its
  // summoner at placement; a Platform's `luck: { from: summoner }` is not a starting value but one
  // pool with its owner's (#162), projected as `luckFromSummoner` and read off her on the board.
  inherit: [
    doc("module/engine/summoning.mjs", "a Summon's stats, resolved against the summoner at placement"),
    { at: "luckFromSummoner", from: (v) => v?.luck?.from === "summoner" },
  ],
  // `system.level` is a Platform's own Scene Level number; the snapshot's
  // `level` is where a Unit stands. Two names, two facts.
  level: doc("module/apps/actor-sheet/context.mjs", "a Platform's Scene Level number"),
  notes: doc("templates/actor/details.hbs", "the sheet's notes"),
  npChoice: doc("module/engine/war-setup.mjs", "Normal's pick-one-NP rule, applied at setup"),
  rules: doc("module/documents/index.mjs", "collected into the Unit's rule elements"),
  passiveRules: doc("module/documents/index.mjs", "collected into the Unit's rule elements"),
  activeRules: doc("module/documents/index.mjs", "collected into the Unit's rule elements"),
  summonVariant: doc("module/rules/summon-variant.mjs", "resolved once, at summon"),
  undamageable: doc("module/domain/health.mjs", "decides whether a Health exists at all"),
};

/** Where each Authored Key on an Ability goes after the DataModel. */
export const ABILITY_ROUTES = {
  active: same("active"),
  categorizedAs: same("categorizedAs"),
  categorizedAsNP: same("categorizedAsNP"),
  categorizedWhile: same("categorizedWhile"),
  category: same("category"),
  contentId: same("contentId"),
  copyable: same("copyable"),
  damage: same("damage"),
  exclusionSet: same("exclusionSet"),
  isNP: same("isNP"),
  kind: same("kind"),
  maxUses: same("maxUses"),
  passive: same("passive"),
  replacesNormalAttack: same("replacesNormalAttack"),
  requiresHistory: same("requiresHistory"),
  slug: same("slug"),
  rank: { at: "rank", from: text, project: text },
  field: { at: "fieldGeometryKind", from: (v) => v?.geometry?.kind },
  activeRules: doc("module/rules/ability-use.mjs", "collected when the ability is used or held on"),
  additionalCosts: doc("module/rules/costs.mjs", "charged at use"),
  aftermath: doc("module/engine/attack.mjs", "a second resolution of the same use"),
  alsoCountsAsAttackFor: doc("module/engine/budget.mjs", "the joint attack budget"),
  alsoTriggers: doc("module/engine/cooldown.mjs", "cooldowns started alongside"),
  cancelsNP: doc("module/engine/attack.mjs", "resolved against an incoming NP"),
  cannotCounter: doc("module/rules/counter.mjs", "whether the ability may answer a Counter (#156)"),
  cannotDeactivate: doc("module/rules/modes.mjs", "the mode toggle"),
  concealmentBreakChance: doc("module/rules/concealment.mjs", "rolled when used while concealed"),
  cooldown: doc("module/engine/cooldown.mjs", "the clock is the item's own"),
  cooldownWaiver: doc("module/engine/cooldown.mjs", "spent at use"),
  countsAsAttack: doc("module/rules/ability-use.mjs", "the action budget"),
  countsAsAct: doc("module/rules/ability-use.mjs", "marks the Turn Record acted"),
  creates: doc("module/rules/costs.mjs", "matched by ForbidCreating"),
  deactivation: [
    doc("module/rules/modes.mjs", "Tenmōkaikai's switch-off window, read by canToggleMode (#101)"),
    doc("module/rules/platforms.mjs", "a Field's or Platform's block: byOwner, lockout and the window, read by deactivationVerdict (#150)"),
  ],
  description: doc("module/apps/actor-sheet/context.mjs", "the sheet's text"),
  element: doc("module/engine/attack.mjs", "the damage type of the use"),
  expendsPermanently: doc("module/engine/io.mjs", "spent at use"),
  freeAction: doc("module/engine/attack-preflight.mjs", "the action budget"),
  isAttackSkill: doc("module/rules/ability-use.mjs", "classifies the use"),
  isMode: doc("module/rules/modes.mjs", "classifies the use"),
  isPassive: doc("module/rules/ability-use.mjs", "classifies the use"),
  isSpell: doc("module/rules/ability-use.mjs", "classifies the use"),
  itemCost: doc("module/engine/skill-use.mjs", "charged at use"),
  negatedBy: doc("module/rules/ability-use.mjs", "gates the use"),
  negatedWhile: doc("module/rules/snapshot.mjs", "filters the ability's rules out of the collection"),
  npGateRound: doc("module/rules/ability-use.mjs", "gates the use"),
  npTags: doc("module/engine/attack.mjs", "classifies the NP"),
  offersSpellCategory: doc("module/engine/attack.mjs", "offered at use"),
  oncePerRound: doc("module/rules/ability-use.mjs", "gates the use"),
  reactionFree: doc("module/engine/attack.mjs", "keeps the reaction rung open after the ability"),
  oncePerTurn: doc("module/rules/ability-use.mjs", "gates the use"),
  opensDialog: doc("module/rules/ability-use.mjs", "the use opens a dialog"),
  parameterized: doc("tools/lib/content.mjs", "a template's slot list, consumed at compile"),
  passiveRules: doc("module/documents/index.mjs", "collected into the bearer's rule elements"),
  phases: doc("module/engine/attack.mjs", "what the use does"),
  reactionOverride: doc("module/engine/attack.mjs", "the reaction ladder against this attack"),
  recordsAttacks: doc("module/engine/attack.mjs", "God Hand's ledger"),
  refusesReactionsUnlessFaster: doc("module/engine/attack.mjs", "the reaction ladder"),
  requirements: doc("module/rules/ability-use.mjs", "gates the use"),
  ridingAttack: doc("module/engine/riding.mjs", "the Riding Attack"),
  rules: doc("module/documents/index.mjs", "collected into the bearer's rule elements"),
  sameRoundExclusive: doc("module/rules/ability-use.mjs", "gates the use"),
  sameTurnExclusive: doc("module/rules/ability-use.mjs", "gates the use"),
  shield: doc("module/engine/shield.mjs", "the barrier"),
  shieldHealth: doc("module/engine/shield.mjs", "the barrier's pool"),
  source: doc("module/apps/actor-sheet/context.mjs", "where the ability came from, on the sheet"),
  targeting: doc("module/rules/ability-use.mjs", "who the use may reach"),
  timing: doc("module/rules/ability-use.mjs", "when the use is legal"),
  toggleLock: doc("module/rules/modes.mjs", "the two-way toggle lockout"),
  usableWhileConcealed: doc("module/rules/concealment.mjs", "an escape from concealment's lock"),
  weakPoint: doc("module/rules/snapshot.mjs", "collected onto the bearer as a weak point"),
};

/**
 * Where an Ability's Authored Keys go on the SECOND Hop they cross: the record
 * `abilityRecordOf` hands the rule collector (`contributionsOf`, `windowAugmented`).
 *
 * `ABILITY_ROUTES` above holds a key to the board's `abilities` record. The rule
 * collector is a different record, written by a different Hop, and `contentId`
 * was projected by the first and dropped by the second: a flat bonus stamped
 * `sourceContentId: null` and Piedra Del Sol's `supersedes` never matched
 * Goddess's Divine Core (#126). A key the executors read goes here as well.
 */
export const CONTRIBUTION_ROUTES = {
  active: same("active"),
  activeRules: same("activeRules"),
  contentId: same("contentId"),
  passiveRules: same("passiveRules"),
  rules: same("rules"),
  slug: same("slug"),
  rank: { at: "rank", from: text, project: text },
};

/** Where each Authored Key on an Effect definition goes, through the registry. */
export const EFFECT_ROUTES = {
  ...Object.fromEntries([
    "polarity", "volatility", "valence", "stacking", "baseChance", "severity", "preventsAction",
    "families", "suppressesOtherEffects", "defaultMagnitude", "defaultDuration", "unremovable",
    "maxStacks", "blocks", "blockedBy", "replaces", "periodic",
    "terminal", "uses", "absorbs", "onRemove", "rules", "bypassesImmunity", "bypassesResistance",
    "onApply",
  ].map((k) => [k, same(k)])),
  contentId: same("id"),
  description: doc("module/apps/actor-sheet/context.mjs", "the effect's text on the sheet"),
  source: doc("module/apps/actor-sheet/context.mjs", "where the effect came from, on the sheet"),
  // An Effect definition is compiled as an Item of type `ability`, so it is
  // given an Ability's derived keys too. The registry has no use for them.
  slug: doc("tools/lib/content.mjs", "an Ability's derived key; an Effect definition does not use it"),
  cooldown: doc("tools/lib/content.mjs", "an Ability's derived key; an Effect definition does not use it"),
};

/* -------------------------------------------------------------------------- */
/*  The check                                                                 */
/* -------------------------------------------------------------------------- */

/** A value that states nothing a default would not. */
const carriesNothing = (v) => v == null || v === false || v === ""
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

/** `v` without the parts that carry nothing, at any depth: what the Clause actually states. */
function stated(v) {
  if (Array.isArray(v)) return v.map(stated);
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stated(x)]).filter(([, x]) => !carriesNothing(x)));
  }
  return v;
}

/** The document a model-built compiled entry holds, as Foundry would load it. */
function loaded(documentName, compiled) {
  const data = structuredClone(compiled);
  const strip = (v) => (Array.isArray(v) ? v.map(strip) : v && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "_key").map(([k, x]) => [k, strip(x)]))
    : v);
  return new foundry.documents[`Base${documentName}`](strip(data), { strict: false })._source;
}

/**
 * Hold one Authored Key to its route.
 *
 * @returns {string|null} a failure, or null
 */
function checkRoute(where, key, value, route, projected, hop) {
  if (!route) {
    return `${where}: "${key}" has no route. Last seen at ${hop}. Project it in module/rules/snapshot.mjs, `
      + "or name the file that reads it from the document, in test/unit/survival.test.mjs.";
  }
  for (const r of [route].flat()) {
    if (r.unread) continue;
    if (r.reader) {
      if (!existsSync(r.reader)) return `${where}: "${key}" is routed to ${r.reader}, which does not exist.`;
      if (!new RegExp(`\\b${key}\\b`).test(readFileSync(r.reader, "utf8"))) {
        return `${where}: "${key}" is routed to ${r.reader} (${r.why}), which no longer reads it.`;
      }
      continue;
    }
    const want = stated(r.from ? r.from(value) : value);
    if (carriesNothing(want)) continue;
    const got = r.project ? r.project(projected?.[r.at]) : projected?.[r.at];
    if (r.contains) {
      const missing = [want].flat().filter((x) => ![got].flat().includes(x));
      if (missing.length) return `${where}: "${key}" lost ${JSON.stringify(missing)} between ${hop} and the snapshot's \`${r.at}\`.`;
      continue;
    }
    const miss = mismatches(want, got, r.at);
    if (miss.length) {
      const m = miss[0];
      return `${where}: "${key}" reached ${hop} as ${JSON.stringify(m.want)}, and the snapshot's \`${m.path}\` `
        + `holds ${JSON.stringify(m.got)}.`;
    }
  }
  return null;
}

describe("every Authored Key survives its Route", () => {
  const failures = { unit: [], ability: [], contribution: [], effect: [] };

  beforeAll(async () => {
    await installSystem();
    const { files } = await loadSource("packs/_source");
    const { assets } = await loadAssets("assets");
    const { compiled } = compileCorpus(files, assets);
    const { snapshotUnit, abilityRecordOf } = await import("../../module/rules/snapshot.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");

    const effects = compiled.filter((c) => c.pack === "effects");
    const effectSources = effects.map((c) => loaded("Item", c.doc));
    EffectRegistry.load(effectSources.map((s) => ({ name: s.name, img: s.img, system: s.system })));
    effects.forEach((c, i) => {
      const source = effectSources[i].system;
      const def = EffectRegistry.get(source.contentId);
      for (const key of Object.keys(c.doc.system)) {
        if (!(key in source)) continue; // the model check's to report
        const f = checkRoute(c.path, key, source[key], EFFECT_ROUTES[key], def, "the Effect's document");
        if (f) failures.effect.push(f);
      }
    });

    for (const c of compiled.filter((x) => x.doc._key.startsWith("!actors!"))) {
      const source = loaded("Actor", c.doc);
      const spec = {
        id: source._id, name: source.name, type: source.type, system: source.system,
        items: source.items.map((i) => ({ id: i._id, name: i.name, type: i.type, system: i.system })),
      };
      await withWorld({ actors: [spec] }, async (w) => {
        const actor = w.actor(spec.id);
        const unit = snapshotUnit(actor);
        for (const key of Object.keys(c.doc.system)) {
          if (!(key in source.system)) continue;
          const f = checkRoute(c.path, key, actor.system[key], UNIT_ROUTES[key], unit, "the prepared Unit");
          if (f) failures.unit.push(f);
        }
        for (const item of c.doc.items ?? []) {
          const ability = unit.abilities.find((a) => a.id === item._id);
          if (!ability) continue;
          const sys = actor.items.get(item._id).system;
          for (const key of Object.keys(item.system)) {
            if (!(key in sys)) continue;
            const f = checkRoute(`${c.path} items["${item.name}"]`, key, sys[key], ABILITY_ROUTES[key], ability, "the Ability's document");
            if (f) failures.ability.push(f);
          }
          // The second Hop: what the rule collector is handed for this Ability.
          const record = abilityRecordOf(actor.items.get(item._id));
          for (const key of Object.keys(CONTRIBUTION_ROUTES)) {
            if (!(key in item.system)) continue;
            const f = checkRoute(`${c.path} items["${item.name}"]`, key, sys[key], CONTRIBUTION_ROUTES[key], record, "the contribution record");
            if (f) failures.contribution.push(f);
          }
        }
      });
    }
  }, 120_000);


  const report = (list) => list.join(String.fromCharCode(10));

  it("routes only to a projected field something reads", () => {
    // Reaching the snapshot or the registry is not the end of the Route: the
    // projected field needs a reader too. `periodic` reached the registry and
    // was read by nobody there, while the scheduler ticked from its own table,
    // and a survival test that stopped at the projection called that survival
    // (#105). The producer itself does not count as its own reader.
    const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
    const walk = (dir, out = []) => {
      for (const f of readdirSync(dir)) {
        const p = `${dir}/${f}`;
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(mjs|hbs)$/.test(f)) out.push(p);
      }
      return out;
    };
    const sources = [...walk("module"), ...walk("templates")].map((p) => [p, strip(readFileSync(p, "utf8"))]);
    const unreadTargets = [];
    for (const [table, producer] of [[UNIT_ROUTES, "module/rules/snapshot.mjs"],
      [ABILITY_ROUTES, "module/rules/snapshot.mjs"], [CONTRIBUTION_ROUTES, "module/rules/snapshot.mjs"],
      [EFFECT_ROUTES, "module/rules/registry.mjs"]]) {
      for (const [key, route] of Object.entries(table)) {
        for (const r of [route].flat().filter((x) => x.at)) {
          // A property read, or a destructuring `{ key }` / `{ key, ... }`.
          const read = new RegExp(String.raw`\.${r.at}\b(?!\s*=(?!=))|[{,]\s*${r.at}\b\s*[,}]`);
          if (!sources.some(([p, text]) => p !== producer && read.test(text))) {
            unreadTargets.push(`"${key}" is routed to \`${r.at}\`, which nothing outside ${producer} reads`);
          }
        }
      }
    }
    expect(report(unreadTargets)).toBe("");
  });

  it("leaves unread keys only where an issue owns them, and fewer over time", () => {
    const owned = [UNIT_ROUTES, ABILITY_ROUTES, EFFECT_ROUTES].flatMap((t) => Object.values(t)).filter((r) => r.unread);
    for (const r of owned) expect(r.unread).toMatch(/^#\d+$/);
    expect(owned.length).toBeLessThanOrEqual(0);
  });

  it("on every Unit", () => {
    expect(report(failures.unit)).toBe("");
  });

  it("on every Ability", () => {
    expect(report(failures.ability)).toBe("");
  });

  it("on every Ability's contribution record", () => {
    expect(report(failures.contribution)).toBe("");
  });

  it("on every Effect definition", () => {
    expect(report(failures.effect)).toBe("");
  });
});

/* -------------------------------------------------------------------------- */
/*  Keys nested in a block the DataModel stores whole                         */
/* -------------------------------------------------------------------------- */

/**
 * The tables above route a key of a Unit, an Ability or an Effect. A key that
 * rides INSIDE an untyped block -- a `zone` phase's `spec`, a field's interior
 * action, a painted area's behaviour -- is not on any of them, so each Hop it
 * passes is named here instead (CLAUDE.md, Silent Drops).
 *
 * A Hop is `{ file, why }` -- the file must still READ the key, comments
 * excluded -- or `{ model, why }` -- the DataModel must still DECLARE it, which
 * is the Hop Foundry drops a key at without a word. `authored` names the
 * content that carries the key, so the route cannot outlive its only user.
 */
export const NESTED_ROUTES = [
  // The Golden Hind's swing meets Magic Resistance at its Noble Phantasm's
  // Rank, not Drake's MAG (#187 reading 8).
  {
    key: "attackRank",
    authored: ["packs/_source/platforms/golden-hind.yml"],
    hops: [
      { file: "module/data/actor/_shared.mjs", why: "normalAttackField declares it; Foundry drops what a schema does not name" },
      { file: "module/rules/snapshot.mjs", why: "the projection rebuilds normalAttack field by field and carries it" },
      { file: "module/rules/normal-attack.mjs", why: "normalAttackAt hands it on with the mount's spec" },
      { file: "module/engine/attack.mjs", why: "attackFacts puts it on the attack the pipeline reads" },
      { file: "module/rules/damage/pipeline.mjs", why: "stage 11 compares Magic Resistance against it" },
    ],
  },
  // A Normal Attack's own stage-3 multiplier: Mesektet's ×2 against Dark
  // (#189 readings 3, 18).
  {
    key: "conditionalMultipliers",
    authored: ["packs/_source/servants/ozymandias.yml"],
    hops: [
      { file: "module/data/actor/_shared.mjs", why: "normalAttackField declares it; Foundry drops what a schema does not name" },
      { file: "module/rules/snapshot.mjs", why: "the projection rebuilds normalAttack field by field and carries it" },
      { file: "module/rules/normal-attack.mjs", why: "normalAttackAt hands it on" },
      { file: "module/engine/attack.mjs", why: "attackFacts carries it, and the resolution and preview hand it to stage 3" },
      { file: "module/rules/damage/pipeline.mjs", why: "stage 3 multiplies by it" },
    ],
  },
  {
    key: "labelOnly",
    authored: ["packs/_source/abilities/quetz-piedra-del-sol.yml"],
    hops: [
      { file: "module/engine/skill-use.mjs", why: "zonePaintArgs hands the zone spec's key to paintTerrain" },
      { file: "module/engine/terrain.mjs", why: "terrainDataOf writes it onto the behaviour, repaintFollowing carries it" },
      { model: "RegionBehavior/terrain", why: "TerrainBehavior declares it; Foundry drops what a schema does not name" },
      { file: "module/engine/board.mjs", why: "terrainAreasOf projects it onto the area" },
      { file: "module/rules/terrain.mjs", why: "terrainPeriodics skips an area that carries it" },
    ],
  },
  // A field's `ApplyEffect` action says the Burn is unremovable, and says "never"
  // by authoring `duration: null`; neither reached the instance (#147).
  {
    key: "unremovable",
    authored: ["packs/_source/abilities/quetz-piedra-del-sol.yml"],
    hops: [
      { file: "module/engine/fields.mjs", why: "the field's ApplyEffect action puts it on the intent" },
      { file: "module/engine/applier.mjs", why: "resolveEffects hands the intent's flag to the flow" },
      { file: "module/engine/effect-applier.mjs", why: "the flow ORs it into the instance, mergeEmitted keeps it" },
      { file: "module/engine/io.mjs", why: "createEffects writes it" },
      { model: "ActiveEffect/fgtEffect", why: "EffectData declares it" },
      { file: "module/rules/snapshot.mjs", why: "the instance projects it" },
    ],
  },
  {
    key: "permanent",
    authored: [],
    hops: [
      { file: "module/engine/fields.mjs", why: "an authored `duration: null` on the field action becomes it" },
      { file: "module/engine/scheduler.mjs", why: "the terrain's Burn descriptor becomes it" },
      { file: "module/engine/applier.mjs", why: "resolveEffects hands it to the flow" },
      { file: "module/engine/effect-applier.mjs", why: "the flow stamps no expiry; mergeEmitted does not overwrite it" },
    ],
  },
  {
    key: "tiedToField",
    authored: ["packs/_source/abilities/quetz-piedra-del-sol.yml"],
    hops: [
      { file: "module/engine/fields.mjs", why: "the field action's tie becomes the intent's sourceFieldId" },
      { model: "ActiveEffect/fgtEffect", why: "EffectData declares sourceFieldId", as: "sourceFieldId" },
      { file: "module/rules/bounded-fields.mjs", why: "sweepFieldEffects reads sourceFieldId", as: "sourceFieldId" },
      { file: "module/engine/movement-hooks.mjs", why: "dropLeftFieldEffects reads sourceFieldId", as: "sourceFieldId" },
    ],
  },
  {
    key: "sourceTerrain",
    authored: [],
    hops: [
      { file: "module/engine/scheduler.mjs", why: "a terrain descriptor that lasts while inside stamps it on its intent" },
      { file: "module/engine/applier.mjs", why: "resolveEffects hands it to the flow" },
      { file: "module/engine/effect-applier.mjs", why: "the flow writes it on the instance" },
      { file: "module/engine/io.mjs", why: "createEffects writes it" },
      { model: "ActiveEffect/fgtEffect", why: "EffectData declares it" },
      { file: "module/rules/snapshot.mjs", why: "the instance projects it" },
      { file: "module/rules/terrain.mjs", why: "annotateTerrain sweeps on it" },
      { file: "module/engine/terrain.mjs", why: "the document is deleted when its ground is gone" },
    ],
  },
  // A field's `Damage` action says what element it is and that it is Fixed; the
  // action read neither, and nothing read an element on a bare damage intent (#154).
  {
    key: "element",
    authored: ["packs/_source/abilities/quetz-piedra-del-sol.yml"],
    hops: [
      { file: "module/engine/fields.mjs", why: "the field's Damage action puts it on the intent" },
      { file: "module/engine/applier.mjs", why: "resolveElements reads it off a bare damage intent" },
      { file: "module/rules/damage/pipeline.mjs", why: "elementalEarlyExit is the one rule it asks, for stage 0 as well" },
    ],
  },
  {
    key: "fixed",
    authored: ["packs/_source/abilities/quetz-piedra-del-sol.yml"],
    hops: [
      { file: "tools/lib/content.mjs", why: "the build refuses fixed: false, the one value a field Damage cannot honour" },
    ],
  },
  // A standing threshold on the payer's Health, inside the `upkeep` block that
  // both the field's behaviour and a platform's actor store whole (#149).
  {
    key: "closeWhen",
    authored: ["packs/_source/abilities/quetz-piedra-del-sol.yml", "packs/_source/platforms/quetzalcoatlus.yml"],
    hops: [
      { file: "module/rules/platforms.mjs", why: "forcedEndDue reads it, and upkeepPlan puts it first" },
      { file: "module/engine/fields.mjs", why: "runUpkeep reads a field's or a platform's block for it, due toll or not" },
    ],
  },
  // `cooldown.countFrom: deactivation` on an ability that opens a field: the clock
  // starts at the close, so only the field's being open stops a second cast (#148).
  {
    key: "countFrom",
    authored: ["packs/_source/abilities/quetz-piedra-del-sol.yml", "packs/_source/abilities/jack-the-mist.yml"],
    hops: [
      { file: "module/engine/cooldown.mjs", why: "cooldownFor starts no clock at the cast" },
      { file: "module/engine/fields.mjs", why: "setCooldownOnDeactivation starts it when the field closes" },
      { file: "module/rules/costs.mjs", why: "canUseAbility refuses a second cast while the field stands" },
    ],
  },
  // Xiuhcoatl's Burning on a [Fortress] NP lasts as long as that Fortress: the
  // zone phase binds each area to its field, and `endField` erases what is bound (#152).
  {
    key: "boundToFieldId",
    authored: [],
    hops: [
      { file: "module/engine/skill-use.mjs", why: "zonePaints binds one area per Fortress to its field" },
      { file: "module/engine/terrain.mjs", why: "terrainDataOf writes it, repaintFollowing carries it, clearTerrainBoundTo reads it" },
      { model: "RegionBehavior/terrain", why: "TerrainBehavior declares it; Foundry drops what a schema does not name" },
      { file: "module/engine/fields.mjs", why: "endField erases the areas bound to the field it closes" },
    ],
  },
  // A field-tied effect that turns ordinary on leaving rather than ending:
  // Piedra Del Sol's Burn (ruled 2026-10-02, #65, ruling 17).
  {
    key: "onLeave",
    authored: ["packs/_source/abilities/quetz-piedra-del-sol.yml"],
    hops: [
      { file: "module/rules/bounded-fields.mjs", why: "revertingActionFor reads it off the field's ApplyEffect action" },
    ],
  },
  // Where a `fortressNearby` zone measures "used within or directly next to"
  // from: the target, for Xiuhcoatl since the user ruled it so (2026-10-02, #65).
  {
    key: "from",
    authored: ["packs/_source/abilities/quetz-xiuhcoatl.yml"],
    hops: [
      { file: "module/engine/skill-use.mjs", why: "fortressFrom reads the zone spec's key and hands the target's panels to fortressesNearby" },
    ],
  },
  // A MOV delta that moves the mount its bearer drives, not only her own feet:
  // Riding's Active +6 (ruled 2026-10-02, #65, ruling 27).
  {
    key: "carriesToMount",
    authored: ["packs/_source/class-skills/riding.yml"],
    hops: [
      { file: "module/rules/elements.mjs", why: "the MovDelta element puts it on the stat delta" },
      { file: "module/rules/movement.mjs", why: "moverFor adds every delta that carries to the mount's MOV" },
    ],
  },
  // The second half of an "or" between a field's turnEnd and actedTurnEnd
  // events: it does not fire on the Unit's own Turn (#180).
  {
    key: "notOnOwnTurn",
    authored: ["packs/_source/abilities/pale-rider-contagion.yml", "packs/_source/abilities/jack-the-mist.yml"],
    hops: [
      { file: "module/engine/fields.mjs", why: "runFieldEvents scopes an actedTurnEnd spec off the Units whose own Turn ended" },
    ],
  },
  // An [Anti-World] NP that breaks Doomsday Come hits every Unit within
  // (#180, reading 7). Rides a field's vulnerability entry, an untyped object.
  {
    key: "hitsAllWithin",
    authored: ["packs/_source/abilities/pale-rider-doomsday-come.yml"],
    // `fieldDataOf` and `boundedFieldsOf` copy the vulnerability entries whole,
    // and `NPFieldBehavior` holds them as untyped objects, so the reader is the
    // only file that names it.
    hops: [
      { file: "module/rules/bounded-fields.mjs", why: "breakingCatch reads it" },
    ],
  },
  // The duel closes around its two duellists alone: everyone else in the area
  // is pushed out as it opens (#184 reading 4). On a field's membership, an
  // untyped object, read where the field opens.
  {
    key: "enclosesOnly",
    authored: ["packs/_source/abilities/achilles-diatrekhon-aster-lonkhe.yml"],
    hops: [
      { file: "module/engine/fields.mjs", why: "openField pushes the others out and stamps the duellists" },
    ],
  },
  // Jack sees every Unit inside her own Mist (#185 reading 6). On a field's
  // isolation, an untyped object, read where "seeing" is decided.
  {
    key: "ownerSeesInside",
    authored: ["packs/_source/abilities/jack-the-mist.yml"],
    hops: [
      { file: "module/rules/identity.mjs", why: "seesThroughOwnField reads it for sees()" },
    ],
  },
  // A painted area is on one Level, as a field is: the zone phase stamps the
  // caster's (or the Fortress's), a repaint follows the source's, and
  // `terrainAt` asks for it (#151).
  {
    key: "level",
    authored: [],
    hops: [
      { file: "module/engine/skill-use.mjs", why: "zonePaintArgs stamps the caster's Level, zonePaints the Fortress's" },
      { file: "module/engine/terrain.mjs", why: "terrainDataOf writes it, repaintFollowing carries the source's" },
      { model: "RegionBehavior/terrain", why: "TerrainBehavior declares it; Foundry drops what a schema does not name" },
      { file: "module/engine/board.mjs", why: "terrainAreasOf projects it onto the area" },
      { file: "module/rules/terrain.mjs", why: "terrainAreasAt, and so terrainAt, asks for it" },
      { file: "module/engine/movement-hooks.mjs", why: "a move and a change of Level both hand the mover's Level to the repaint" },
    ],
  },
];

describe("every key nested in an untyped block survives its Route", () => {
  // Source without its comments, so prose that names a key is not a reader of it.
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  let models;

  beforeAll(async () => { models = await installSystem(); });

  for (const { key, authored, hops } of NESTED_ROUTES) {
    it(`"${key}" is authored, and every Hop after the compile still names it`, () => {
      const lost = [];
      for (const file of authored) {
        if (!new RegExp(String.raw`\b${key}\b`).test(readFileSync(file, "utf8"))) lost.push(`${file} no longer authors "${key}"`);
      }
      for (const hop of hops) {
        // `as` is the name the Hop knows the key by, where it is not the authored one.
        const name = hop.as ?? key;
        if (hop.model) {
          const [document, type] = hop.model.split("/");
          if (!models[document]?.[type]?.schema.fields[name]) lost.push(`${hop.model} does not declare "${name}" (${hop.why})`);
        } else if (!new RegExp(String.raw`\b${name}\b`).test(strip(readFileSync(hop.file, "utf8")))) {
          lost.push(`${hop.file} no longer reads "${name}" (${hop.why})`);
        }
      }
      expect(lost.join(String.fromCharCode(10))).toBe("");
    });
  }
});
