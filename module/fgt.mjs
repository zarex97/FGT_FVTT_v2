/**
 * @file System entry point — the init/setup/ready sequence.
 * @see docs/21-system-skeleton.md §21.3
 */

import { FGT } from "./config.mjs";
import { registerSettings } from "./settings.mjs";
import * as data from "./data/index.mjs";
import * as documents from "./documents/index.mjs";
import { registerSheets } from "./apps/index.mjs";
import { activateChatListeners } from "./apps/chat/cards.mjs";
import { FGTSocket } from "./net/socket.mjs";

import { Rank } from "./domain/rank.mjs";
import { parseTick, resolveTicks } from "./domain/tick.mjs";
import * as geometry from "./domain/geometry.mjs";
import { computeDamage } from "./rules/damage/pipeline.mjs";
import { resolveTargets } from "./rules/targeting/resolve.mjs";
import { test as evaluatePredicate } from "./rules/predicate.mjs";
import { snapshotUnit, snapshotBoard } from "./rules/snapshot.mjs";
import { EffectRegistry } from "./rules/registry.mjs";
import { CommandSpellRegistry } from "./rules/cs-registry.mjs";
import { collectContributions } from "./rules/elements.mjs";
import { explainDamage } from "./rules/explain.mjs";
import * as intents from "./engine/intents.mjs";
import * as combatProcess from "./engine/combat-process.mjs";
import * as scheduler from "./engine/scheduler.mjs";
import { Scheduler } from "./engine/scheduler-hooks.mjs";
import * as budget from "./engine/budget.mjs";
import { Movement } from "./engine/movement-hooks.mjs";
import { TurnHUD } from "./apps/hud/turn-hud.mjs";
import { registerTargetingLayer, pickTarget } from "./apps/canvas/targeting-layer.mjs";
import { registerOverlayLayer, attachOverlays } from "./apps/canvas/overlay-layer.mjs";
import { registerCombatTracker } from "./apps/combat/tracker.mjs";
import { sweepTransientRegions } from "./apps/canvas/target-region.mjs";

Hooks.once("init", () => {
  console.log("FGT | Initialising Fate/Grail Tactics");

  // Every hook call, logged. F/GT is driven almost entirely by hooks — the
  // scheduler, movement, budget and turn order all hang off them — so when a
  // rule does not fire, the first question is always whether its hook was
  // reached at all, and this is what answers it.
  CONFIG.debug.hooks = true;

  globalThis.fgt = { FGT, api: {} };
  CONFIG.FGT = FGT;

  // ── Data models ──────────────────────────────────────────────────────────
  CONFIG.Actor.dataModels = {
    servant: data.ServantData, master: data.MasterData, civilian: data.CivilianData,
    summon: data.SummonData, platform: data.PlatformData, structure: data.StructureData,
  };
  CONFIG.Item.dataModels = {
    ability: data.AbilityData, noblePhantasm: data.NoblePhantasmData,
    commandSpell: data.CommandSpellData, masterEssence: data.MasterEssenceData,
    equipment: data.EquipmentData,
  };
  CONFIG.ActiveEffect.dataModels = { fgtEffect: data.EffectData };
  CONFIG.Combat.dataModels = { match: data.MatchData };
  CONFIG.Combatant.dataModels = { player: data.PlayerCombatantData };

  // ── Document classes ─────────────────────────────────────────────────────
  CONFIG.Actor.documentClass = documents.FGTActor;
  CONFIG.Item.documentClass = documents.FGTItem;
  CONFIG.ActiveEffect.documentClass = documents.FGTEffect;
  CONFIG.Combat.documentClass = documents.FGTCombat;
  CONFIG.Combatant.documentClass = documents.FGTCombatant;
  CONFIG.Token.documentClass = documents.FGTToken;

  // There is no initiative. Turn order is a 1d100 per faction, re-rolled every
  // Round, plus Delay (Ch. 25 §25.3).
  CONFIG.Combat.initiative = { formula: "0", decimals: 0 };

  registerSheets();
  registerSettings();

  // Must happen at init: the canvas reads CONFIG.Canvas.layers when it is built.
  registerTargetingLayer();
  registerOverlayLayer();
  // Turns belong to factions, and only this tracker can create one.
  registerCombatTracker();

  // Mandatory, and it requires "socket": true in the manifest plus a world
  // restart. Without it the server never registers the namespace and every
  // emit silently does nothing.
  FGTSocket.initialize();
  activateChatListeners();

  // Let compendium browsers filter without loading every document.
  CONFIG.Actor.compendiumIndexFields.push("system.servantClasses", "system.region");
  CONFIG.Item.compendiumIndexFields.push("system.rank", "system.isNP");
});

Hooks.once("setup", async () => {
  // Packs are not readable during `init`; `setup` runs after they are indexed
  // and before the canvas draws, which is exactly the window we need.
  const pack = game.packs.get("fgt.effects");
  const documents = pack ? await pack.getDocuments() : [];
  const count = EffectRegistry.load(documents);
  console.log(`FGT | Loaded ${count} effect definitions`);

  // The Command Spell catalogue. Its own pack, because it is content a GM may
  // extend -- the rulebook says so explicitly.
  const csPack = game.packs.get("fgt.command-spells");
  const csDocs = csPack ? await csPack.getDocuments() : [];
  console.log(`FGT | Loaded ${CommandSpellRegistry.load(csDocs)} Command Spells`);

  if (game.settings.get("fgt", "devMode")) {
    const report = EffectRegistry.validate();
    for (const w of report.warnings) console.warn(`FGT | ${w}`);
    if (report.errors.length) {
      for (const e of report.errors) console.error(`FGT | ${e}`);
      ui.notifications.error(`FGT: ${report.errors.length} content errors — see console.`);
    }
  }
});

Hooks.once("ready", () => {
  // GM client only; a no-op everywhere else.
  Scheduler.attach();
  // Every client validates its own movement; the write is proxied as usual.
  Movement.attach();
  // Everyone sees the budget; only the acting faction can spend it.
  TurnHUD.attach();
  // ZON rings, threat ranges and Master protection, drawn from selection and
  // hover. Context, never a control.
  attachOverlays();
  // A targeting area is discarded in a `finally`, so the only way one survives
  // is a client that stopped existing mid-decision. Sweep them once, here.
  sweepTransientRegions();
  fgt.api = buildPublicAPI();
  console.log(`FGT | Ready — ${game.system.version}`);
});

/**
 * The documented surface for macros and modules.
 *
 * Everything a macro needs, and nothing that bypasses a permission check: the
 * pure functions are safe by construction, and anything that writes goes
 * through the intent applier (Ch. 21 §21.6).
 * @returns {object}
 */
function buildPublicAPI() {
  return {
    // Domain (L1)
    Rank, parseTick, resolveTicks, geometry,
    // Rules (L2) — pure, no writes
    computeDamage, resolveTargets, evaluatePredicate, snapshotUnit, snapshotBoard,
    explainDamage,
    // Engine (L3)
    intents, combatProcess, scheduler, budget,
    pickTarget,
    effects: EffectRegistry,
    commandSpells: CommandSpellRegistry,
    collectContributions,
    socket: FGTSocket,
  };
}
