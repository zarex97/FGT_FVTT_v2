/**
 * @file What happens when a player clicks an ability.
 * @see docs/15-abilities.md §15.3, docs/18-action-economy.md §18.2
 *
 * Layer 2 (rules). Pure — takes an ability's `system` data and returns how it is
 * used. The sheet renders from this and the orchestrator routes from it, so the
 * button a player sees and the code that runs when they press it cannot
 * disagree about what an ability *is*.
 *
 * Four kinds, and conflating them is what made every click on Heracles ask for
 * an enemy:
 *
 * | Kind | Example | Clicking it |
 * |---|---|---|
 * | `attack`  | Nine Lives, a normal attack | opens a targeting session |
 * | `mode`    | Mad Enhancement, Riding's Active | toggles on or off |
 * | `active`  | a non-damaging skill | resolves against its own spec |
 * | `passive` | Divinity, Battle Continuation | nothing; it is always on |
 *
 * A class skill with only `passiveRules` is not a button. A mode is not an
 * attack. Neither needs a target, and asking for one is a bug, not a rule.
 */

/**
 * @typedef {object} AbilityUse
 * @property {"attack"|"mode"|"active"|"passive"} kind
 * @property {boolean} isAttack consumes an attack slot and opens targeting
 * @property {boolean} clickable is there anything to do when pressed?
 * @property {boolean} toggles a mode, switched rather than used
 * @property {string} action the sheet action to bind
 */

/**
 * Classify one ability.
 *
 * @param {object} item an `FGTItem`, or any `{type, system}` shape
 * @returns {AbilityUse}
 */
export function classifyAbility(item) {
  const sys = item?.system ?? {};
  const isNP = item?.type === "noblePhantasm" || sys.isNP === true;

  // An ability whose whole use is a setup decision: Wisdom of Dún Scáith picks
  // two abilities to copy (§15.7), and there is nothing to target and nothing
  // to roll. Checked FIRST, because such an ability may also carry phases --
  // the copies it grants -- and would otherwise classify as active and open a
  // targeting session for a question.
  if (sys.opensDialog) {
    return {
      kind: "dialog", isAttack: false, clickable: true, toggles: false,
      action: "openDialog", dialog: sys.opensDialog,
    };
  }

  // A mode is authored as one, and says so. It is neither an attack nor a
  // one-shot use: Mad Enhancement is switched on and stays on.
  if (sys.isMode === true) {
    return { kind: "mode", isAttack: false, clickable: true, toggles: true, action: "toggleMode" };
  }

  // An attack is anything that resolves damage, plus every Noble Phantasm --
  // including the non-damaging ones, which still cost the Servant's attack.
  const hasDamagePhase = (sys.phases ?? []).some((p) => p.kind === "damage");
  if (isNP || hasDamagePhase || sys.isAttackSkill === true || sys.isSpell === true) {
    return { kind: "attack", isAttack: true, clickable: true, toggles: false, action: "useAbility" };
  }

  // A skill that does something when used: it has phases to run, or a targeting
  // declaration of its own to run them against.
  if ((sys.phases ?? []).length > 0 || sys.targeting) {
    return { kind: "active", isAttack: false, clickable: true, toggles: false, action: "useAbility" };
  }

  // Everything else is passive. `activeRules` without phases is a mode that
  // forgot to declare itself -- Riding's Active MOV Up -- so it toggles too.
  if ((sys.activeRules ?? []).length > 0) {
    return { kind: "mode", isAttack: false, clickable: true, toggles: true, action: "toggleMode" };
  }

  return { kind: "passive", isAttack: false, clickable: false, toggles: false, action: "" };
}

/**
 * The targeting spec to resolve an ability against.
 *
 * The old default handed **every** ability a single-enemy spec, so a class
 * skill with no declaration of its own opened an enemy targeting session and
 * then reported that it had no legal targets. Only an attack gets that default
 * now; anything else that failed to declare a target targets its user.
 *
 * @param {object|null} item the ability, or `null` for a normal attack
 * @param {number} range the caster's Range in panels
 * @returns {object} a `TargetSpec`
 */
export function targetSpecFor(item, range) {
  if (item?.system?.targeting) return item.system.targeting;

  const use = item ? classifyAbility(item) : { isAttack: true };
  if (use.isAttack) {
    return {
      anchor: { kind: "targetUnit", range },
      shape: { kind: "unit" },
      selection: { relations: ["enemy"], chooser: "all", count: 1 },
    };
  }

  return {
    anchor: { kind: "self" },
    shape: { kind: "unit" },
    selection: { relations: ["self"], includeSelf: true, chooser: "all", count: 1 },
  };
}
