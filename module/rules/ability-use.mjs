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

  // A PASSIVE Noble Phantasm is not a button. Penthesilea's Goddess of War is
  // *"(Passive) The effect of this Noble Phantasm is only active when Mad
  // Enhancement is deactivated"* -- four standing clauses and nothing to use.
  // Checked before the attack test, which would otherwise catch every NP:
  // clicking it opened a targeting session and offered to spend her Attack on
  // an ability that has no active form at all.
  if (isNP && sys.isPassive === true) {
    return { kind: "passive", isAttack: false, clickable: false, toggles: false, action: "" };
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

/**
 * Does using this ability require the player to choose anything?
 *
 * The failure this answers: Asterios's *Avyssos of Labrys* buffs **himself**,
 * and it opened a targeting session that showed one target -- Asterios -- a
 * damage range, and a button labelled "Attack". Every part of that was wrong,
 * and the session itself was the root: a confirmation dialog for a decision
 * with exactly one possible answer is a click that asks nothing.
 *
 * A choice exists when the anchor is somebody else, when the selection can
 * reach a unit that is not the caster, or when the shape has an orientation to
 * pick. Self-anchored is **not** sufficient on its own: a 5x5 block projected
 * from the caster still has four directions, and which one is the player's.
 *
 * @param {object} item
 * @returns {boolean}
 */
export function needsTargeting(item) {
  const sys = item?.system ?? {};
  const use = classifyAbility(item);

  // An attack always picks something, even a self-targeting one -- it opens a
  // Combat Process against a defender.
  if (use.isAttack) return true;
  if (use.kind === "mode" || use.kind === "passive" || use.kind === "dialog") return false;

  const spec = sys.targeting ?? null;
  if (!spec) {
    // No declaration: `targetSpecFor` gives a non-attack the self/self spec, so
    // there is nothing to choose.
    return false;
  }

  const anchor = spec.anchor?.kind ?? spec.anchor ?? "self";
  if (anchor !== "self") return true;

  // A shape with an ORIENTATION the player picks. A centred one has none:
  // a `chebyshevRadius` around the caster covers the same panels however the
  // question is asked, and Penthesilea's Howl of the War God -- "affects all
  // allied Units within a 2 panel area of Penthesilea" -- opened a targeting
  // session for a decision with exactly one possible answer.
  //
  // `rect` and `square` are listed because they take a direction from a
  // DIRECTIONAL anchor; anchored at `self` they centre, and this branch has
  // already established the anchor is `self`.
  const shape = spec.shape?.kind ?? spec.shape ?? "unit";
  if (["line", "orientedRect", "path"].includes(shape)) return true;

  const selection = spec.selection ?? {};
  const relations = selection.relations ?? ["self"];
  if (relations.every((r) => r === "self")) return false;

  // Reaching somebody else is not by itself a choice. `chooser: all` with no
  // subset means EVERYONE the shape caught; a `count` or an explicit `choose`
  // is what makes it a decision.
  return selection.choose === true || typeof selection.count === "number";
}

/**
 * Does using this count as the Unit's **Attack** for the turn?
 *
 * *"Attack Skills deal damage ... Attack Skills usually count as the Unit's
 * Attack for the Turn unless stated."* Two halves, and the code had neither.
 *
 * "Deal damage" means **directly**: a `damage` phase. A skill whose only effect
 * is a debuff that costs the target Health over time -- poison, burn -- is not
 * an Attack Skill, however much Health it eventually removes. That distinction
 * is the whole difference between a Servant that has attacked this turn and one
 * that has not.
 *
 * "Unless stated" is why content may override with `countsAsAttack`.
 *
 * @param {object} item
 * @returns {boolean}
 */
export function countsAsAttack(item) {
  const sys = item?.system ?? {};
  if (typeof sys.countsAsAttack === "boolean") return sys.countsAsAttack;

  // A PASSIVE Noble Phantasm is never used, so it never costs an Attack.
  // Appendix A makes the same distinction for `NP Seal`, which is "not passive
  // NPs unless stated".
  if (sys.isPassive === true) return false;
  if (item?.type === "noblePhantasm" || sys.isNP) return true;
  // Directly. An `applyEffects` phase carrying poison is not an attack.
  return (sys.phases ?? []).some((p) => p.kind === "damage")
    || sys.isAttackSkill === true
    || sys.isSpell === true;
}

/**
 * Does using this count as the Unit's **Act** for the turn?
 *
 * Broader than `countsAsAttack`: a self-buff is not an attack and is still the
 * thing the Servant did with its turn.
 *
 * @param {object} item
 * @returns {boolean}
 */
export function countsAsAct(item) {
  const sys = item?.system ?? {};
  if (typeof sys.countsAsAct === "boolean") return sys.countsAsAct;

  const use = classifyAbility(item);
  return use.kind === "attack" || use.kind === "active";
}

/**
 * Which mutually-exclusive partner already went, if any.
 *
 * Medea's Keraino and Trofa may not both be used in one Turn, and the exclusion
 * is declared on **both** sides. A one-sided declaration would be decided by
 * whichever happened to be used first, which is not a rule.
 *
 * Matched against both the document id and the content id, because turn state
 * records whatever the caller had and both are legitimate identifiers.
 *
 * @param {object} item
 * @param {string[]} usedThisTurn ability ids already used
 * @returns {string|null} the blocking ability, or null
 */
export function blockedThisTurn(item, usedThisTurn) {
  const exclusive = item?.system?.sameTurnExclusive ?? [];
  if (exclusive.length === 0) return null;

  const used = new Set(usedThisTurn ?? []);
  return exclusive.find((id) => used.has(id)) ?? null;
}

/**
 * The same question one scale up.
 *
 * *"Caladbolg II cannot be used on the same Round as Hrunting and vice versa."*
 * Not expressible as a same-Turn exclusion: EMIYA acts up to three times in a
 * Round, so the Turn-scoped version would forbid only the case where he tried
 * to fire both with one action — which he cannot do anyway.
 *
 * @param {object} item
 * @param {string[]} usedThisRound
 * @returns {string|null}
 */
export function blockedThisRound(item, usedThisRound) {
  const exclusive = item?.system?.sameRoundExclusive ?? [];
  if (exclusive.length === 0) return null;

  const used = new Set(usedThisRound ?? []);
  return exclusive.find((id) => used.has(id)) ?? null;
}

/**
 * Is this ability switched off by an effect the Unit is carrying?
 *
 * Distinct from a requirement, and both halves are needed. Medea's High-Speed
 * Divine Words "cannot be used **and its effects are negated** while inflicted
 * with Silence": the requirement covers the first, and this covers the second —
 * which matters because Silence can land between declaration and resolution.
 *
 * @param {object} item
 * @param {string[]} effects the bearer's active effect ids
 * @returns {boolean}
 */
export function isNegated(item, effects) {
  const negatedBy = item?.system?.negatedBy ?? [];
  if (negatedBy.length === 0) return false;
  return negatedBy.some((id) => (effects ?? []).includes(id));
}

/**
 * The ability as `canUseAbility` wants to see it.
 *
 * **One implementation for both use paths.** `resolveAttack` and `useSkill`
 * each built their own, and they disagreed: the attack one omitted the content
 * id and neither carried `oncePerTurn`, so a gate authored on an ability was
 * read by whichever path happened to run it and dropped by the other. That is
 * the same defect `engine/cooldown.mjs` was written to end.
 *
 * `requirements` is read from `targeting.limits` first because that is where
 * `requiresZon` and `requiresRound` already live — an ability may state them
 * beside the targeting declaration or at the top level, and both ship.
 *
 * @param {object|null} ability an ability Item
 * @returns {object|null}
 */
export function usageSpecFor(ability) {
  if (!ability) return null;
  const sys = ability.system ?? {};

  return {
    id: ability.id,
    // What `sameTurnExclusive`, `abilityOffCooldown` and the turn record all
    // name. An id-only spec cannot answer a gate written against content.
    contentId: sys.contentId ?? null,
    rank: sys.rank ?? null,
    isNP: ability.type === "noblePhantasm" || Boolean(sys.isNP),
    cooldown: sys.cooldown ?? { remaining: 0 },
    // "Can only be used once per Turn" — Scáthach's Ár, whose 3◈ cooldown a
    // PRS Token skips entirely, leaving this as the only limit on it.
    oncePerTurn: Boolean(sys.oncePerTurn),
    // Both exclusion scales, and the whole-match budget. A gate the attack path
    // could not see was a gate only half the abilities in the game obeyed.
    sameTurnExclusive: [...(sys.sameTurnExclusive ?? [])],
    sameRoundExclusive: [...(sys.sameRoundExclusive ?? [])],
    timesUsed: sys.timesUsed ?? 0,
    maxUses: sys.maxUses ?? null,
    // What `healthRestoredSince` compares "since" against.
    lastUsedTick: sys.lastUsedTick ?? null,
    // What an `abilityUsed` handler filters on.
    category: sys.category ?? null,
    requiresRound: sys.targeting?.limits?.requiresRound ?? null,
    requirements: sys.targeting?.limits?.requirements ?? sys.requirements ?? [],
    // Presence Concealment clause 7 needs all four: whether the ability is
    // aimed at an enemy, and the three escapes the clause itself names --
    // "unless stated", Attack Skills, and Spells that deal damage.
    targeting: sys.targeting ?? null,
    isAttackSkill: Boolean(sys.isAttackSkill),
    damage: sys.damage ?? null,
    usableWhileConcealed: Boolean(sys.usableWhileConcealed),
  };
}
