/**
 * @file Game settings registration.
 * @see docs/21-system-skeleton.md §21.5
 *
 * Settings that change rules are LOCKED once a match is in progress. Changing
 * the fixed-operator mid-game would invalidate every stored absolute expiry on
 * the board, so `onChange` refuses and explains rather than silently corrupting
 * durations.
 */

import { registerFactionMenu } from "./apps/faction-config.mjs";

const RULE_SETTINGS = ["turnsPerRound", "difficulty", "activeSkillBudget", "boardSize"];

export function registerSettings() {
  const s = (key, data) => game.settings.register("fgt", key, { scope: "world", config: true, ...data });

  s("turnsPerRound", {
    name: "FGT.Settings.TurnsPerRound", hint: "FGT.Settings.TurnsPerRoundHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 2, initial: 3 }),
    default: 3, requiresReload: false, onChange: () => guardRuleChange("turnsPerRound"),
  });
  // §17.4: "An offer that blocks resolution indefinitely is unacceptable in a
  // game with seven players." After this many seconds the ladder continues as
  // if the offer were declined, with a chat note -- a disconnected player sees
  // that they missed an opportunity rather than silently losing it.
  s("commandSpellTimeout", {
    name: "FGT.Settings.CommandSpellTimeout", hint: "FGT.Settings.CommandSpellTimeoutHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 0, initial: 45 }),
    default: 45, requiresReload: false,
  });
  // A Grand Order war switches off two rules that assume rival Masters: the
  // multi-Servant tax (§16.7) and Hatred of Achilles against allies (Ch. 44).
  s("grandOrder", {
    name: "FGT.Settings.GrandOrder", hint: "FGT.Settings.GrandOrderHint",
    type: Boolean, default: false, requiresReload: false,
  });
  s("boardSize", {
    name: "FGT.Settings.BoardSize", type: Number, default: 13,
    choices: { 13: "13 × 13", 25: "25 × 25" },
    onChange: () => guardRuleChange("boardSize"),
  });
  s("difficulty", {
    name: "FGT.Settings.Difficulty", type: String, default: "expert",
    choices: { beginner: "FGT.Difficulty.Beginner", standard: "FGT.Difficulty.Standard", expert: "FGT.Difficulty.Expert" },
    onChange: () => guardRuleChange("difficulty"),
  });
  s("region", { name: "FGT.Settings.Region", type: String, default: "" });
  s("grailThreshold", { name: "FGT.Settings.GrailThreshold", type: Number, default: 9 });
  s("closedInfo", { name: "FGT.Settings.ClosedInfo", type: Boolean, default: false });
  s("masterMode", {
    name: "FGT.Settings.MasterMode", type: String, default: "essences",
    choices: { essences: "FGT.MasterMode.Essences", coinFlip: "FGT.MasterMode.CoinFlip", rankless: "FGT.MasterMode.Rankless" },
  });
  s("activeSkillBudget", { name: "FGT.Settings.ActiveSkillBudget", type: String, default: "move" });
  s("interruptTimeout", { name: "FGT.Settings.InterruptTimeout", type: Number, default: 45 });
  s("devMode", { name: "FGT.Settings.DevMode", type: Boolean, default: false });

  // The faction roster. Edited through the menu below rather than a text box,
  // because the ids in it are what every actor stores.
  game.settings.register("fgt", "factions", {
    scope: "world", config: false, type: Array, default: [],
    // Re-render anything showing a faction: the sheets' selects and the
    // roster editor itself. ApplicationV2 instances are not in `ui.windows`.
    onChange: () => {
      for (const app of foundry.applications.instances.values()) app.render?.({ force: false });
    },
  });
  registerFactionMenu();

  s("diceFormulas", { config: false, type: Object, default: {} });
  s("schemaVersion", { config: false, type: String, default: "" });

  game.settings.register("fgt", "showDamagePreview", {
    scope: "client", config: true, name: "FGT.Settings.ShowDamagePreview", type: Boolean, default: true,
  });
  game.settings.register("fgt", "autoDeclineLuckBelow", {
    scope: "client", config: true, name: "FGT.Settings.AutoDeclineLuckBelow", type: Number, default: 0,
  });
  // Per-client for the same reason the review dialog is: a table that wants to
  // confirm every attack and one that does not can both be right.
  game.settings.register("fgt", "targetingReview", {
    scope: "client", config: true, name: "FGT.Settings.TargetingReview",
    hint: "FGT.Settings.TargetingReviewHint", type: Boolean, default: true,
  });
  // Per-client: one player wanting a clean board should not take the ZON ring
  // away from everybody else.
  game.settings.register("fgt", "showOverlays", {
    scope: "client", config: true, name: "FGT.Settings.ShowOverlays",
    hint: "FGT.Settings.ShowOverlaysHint", type: Boolean, default: true,
    onChange: () => canvas?.fgtOverlays?.refresh(),
  });
}

/**
 * Refuse a rules change while a match is running.
 * @param {string} key
 */
function guardRuleChange(key) {
  if (!RULE_SETTINGS.includes(key)) return;
  if (!game.combat?.started) return;
  ui.notifications.error(game.i18n.format("FGT.Settings.LockedDuringMatch", { key }));
}
