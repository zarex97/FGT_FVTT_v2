/**
 * @file Game settings registration.
 * @see docs/21-system-skeleton.md §21.5
 *
 * Settings that change rules are LOCKED once a match is in progress. Changing
 * the fixed-operator mid-game would invalidate every stored absolute expiry on
 * the board, so `onChange` refuses and explains rather than silently corrupting
 * durations.
 */

const RULE_SETTINGS = ["turnsPerRound", "difficulty", "activeSkillBudget", "boardSize"];

export function registerSettings() {
  const s = (key, data) => game.settings.register("fgt", key, { scope: "world", config: true, ...data });

  s("turnsPerRound", {
    name: "FGT.Settings.TurnsPerRound", hint: "FGT.Settings.TurnsPerRoundHint",
    type: new foundry.data.fields.NumberField({ required: true, integer: true, min: 2, initial: 3 }),
    default: 3, requiresReload: false, onChange: () => guardRuleChange("turnsPerRound"),
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

  s("diceFormulas", { config: false, type: Object, default: {} });
  s("schemaVersion", { config: false, type: String, default: "" });

  game.settings.register("fgt", "showDamagePreview", {
    scope: "client", config: true, name: "FGT.Settings.ShowDamagePreview", type: Boolean, default: true,
  });
  game.settings.register("fgt", "autoDeclineLuckBelow", {
    scope: "client", config: true, name: "FGT.Settings.AutoDeclineLuckBelow", type: Number, default: 0,
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
