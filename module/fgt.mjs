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
import { collectContributions } from "./rules/elements.mjs";
import { explainDamage } from "./rules/explain.mjs";
import * as intents from "./engine/intents.mjs";
import * as combatProcess from "./engine/combat-process.mjs";
import * as scheduler from "./engine/scheduler.mjs";
import { Scheduler } from "./engine/scheduler-hooks.mjs";
import * as budget from "./engine/budget.mjs";
import { TurnHUD } from "./apps/hud/turn-hud.mjs";

Hooks.once("init", () => {
  console.log("FGT | Initialising Fate/Grail Tactics");

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
  // Everyone sees the budget; only the acting faction can spend it.
  TurnHUD.attach();
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
    effects: EffectRegistry,
    collectContributions,
    socket: FGTSocket,
  };
}
