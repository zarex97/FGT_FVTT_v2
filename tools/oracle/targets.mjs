/**
 * @file The functions the Godot port's oracle records (grail-tact-godot, Ch. 15 of its plan), by module.
 *
 * Each target names a module, the exported functions to wrap with the Godot name each case keys on, and the test
 * files whose calls are recorded. Every call those tests make to a wrapped function becomes a case, the engine's
 * own internal calls included, since a mock replaces the module for every importer. `cap` bounds the cases kept per
 * function; calls with the same arguments are one case.
 *
 * Grow it a module at a time, as the port of that module lands (M2 onwards).
 */

export const TARGETS = [
  {
    module: "module/domain/geometry.mjs",
    layer: "domain/geometry",
    cap: 120,
    fns: {
      chebyshev: "domain.geometry.chebyshev",
      chebyshevBetween: "domain.geometry.chebyshev_between",
      manhattan: "domain.geometry.manhattan",
      inAttackRange: "domain.geometry.in_attack_range",
      inAttackRangeBetween: "domain.geometry.in_attack_range_between",
      attackRangeArea: "domain.geometry.attack_range_area",
      squareBounds: "domain.geometry.square_bounds",
      inBounds: "domain.geometry.in_bounds",
      normalize: "domain.geometry.normalize",
      chebyshevDisc: "domain.geometry.chebyshev_disc",
      attackRangePanels: "domain.geometry.attack_range_panels",
      rect: "domain.geometry.rect",
      centredRect: "domain.geometry.centred_rect",
      adjacentBlock: "domain.geometry.adjacent_block",
      line: "domain.geometry.line",
      panelsBetween: "domain.geometry.panels_between",
      ring: "domain.geometry.ring",
      coneOf: "domain.geometry.cone_of",
      rotateFacing: "domain.geometry.rotate_facing",
      facingToward: "domain.geometry.facing_toward",
      cardinalToward: "domain.geometry.cardinal_toward",
      gridShape: "domain.geometry.grid_shape",
      occupiedPanels: "domain.geometry.occupied_panels",
    },
    tests: [
      "test/unit/geometry.test.mjs", "test/unit/aoe.test.mjs", "test/unit/cast-level.test.mjs",
      "test/unit/bellerophon-shape.test.mjs", "test/unit/duel-enclosure.test.mjs", "test/unit/compulsion.test.mjs",
      "test/unit/field-interior-movement.test.mjs", "test/unit/linked-group.test.mjs",
    ],
  },
  {
    module: "module/domain/tick.mjs", layer: "domain/tick", cap: 80, tests: "importers",
    fns: {
      fractionTicks: "domain.tick.fraction_ticks", roundsToTicks: "domain.tick.rounds_to_ticks",
      parseTick: "domain.tick.parse_tick", resolveTicks: "domain.tick.resolve_ticks", ticks: "domain.tick.ticks",
      expiryReached: "domain.tick.expiry_reached", formatTick: "domain.tick.format_tick",
    },
  },
  {
    module: "module/domain/tables.mjs", layer: "domain/tables", cap: 120, tests: "importers",
    fns: { lookup: "domain.tables.lookup", lookupNumber: "domain.tables.lookup_number" },
  },
  {
    module: "module/domain/health.mjs", layer: "domain/health", cap: 60, tests: "importers",
    fns: {
      currentHealth: "domain.health.current_health", maxHealth: "domain.health.max_health",
      isUndamageable: "domain.health.is_undamageable", clampToMax: "domain.health.clamp_to_max",
      watermarkKey: "domain.health.watermark_key",
    },
  },
  {
    module: "module/domain/base-attack.mjs", layer: "domain/base-attack", cap: 80, tests: "importers",
    fns: { penalizedBaseAttack: "domain.base_attack.penalized", baseAttackFor: "domain.base_attack.base_attack_for" },
  },
  {
    module: "module/domain/resources.mjs", layer: "domain/resources", cap: 60, tests: "importers",
    fns: {
      resourceValue: "domain.resources.resource_value", resourceMax: "domain.resources.resource_max",
      canSpend: "domain.resources.can_spend", afterChange: "domain.resources.after_change",
      resourcePath: "domain.resources.resource_path", resourcePathFor: "domain.resources.resource_path_for",
      resourceLabel: "domain.resources.resource_label",
    },
  },
  {
    module: "module/domain/attributes.mjs", layer: "domain/attributes", cap: 80, tests: "importers",
    fns: { isMagus: "domain.attributes.is_magus", closeAttributes: "domain.attributes.close_attributes" },
  },
  {
    module: "module/domain/revisions.mjs", layer: "domain/revisions", cap: 60, tests: "importers",
    fns: {
      isRevisable: "domain.revisions.is_revisable", effectiveRevision: "domain.revisions.effective_revision",
      revisionOf: "domain.revisions.revision_of",
    },
  },
  {
    module: "module/domain/war-rules.mjs", layer: "domain/war-rules", cap: 80, tests: "importers",
    fns: {
      publishedValue: "domain.war_rules.published_value", coerceWarRule: "domain.war_rules.coerce",
      missingWarRules: "domain.war_rules.missing", warRuleEditable: "domain.war_rules.editable",
    },
  },
  // M2a: predicates, facets, options, count.
  {
    module: "module/rules/predicate.mjs", layer: "rules/predicate", cap: 60, tests: "importers", maxFiles: 60,
    fns: {
      test: "rules.predicate.test", testStatement: "rules.predicate.test_statement",
      explain: "rules.predicate.explain", referencedOptions: "rules.predicate.referenced_options",
    },
  },
  {
    module: "module/rules/facets.mjs", layer: "rules/facets", cap: 60, tests: "importers",
    fns: { parseOption: "rules.facets.parse_option" },
  },
  {
    module: "module/rules/options.mjs", layer: "rules/options", cap: 60, tests: "importers", maxFiles: 60,
    fns: {
      ownerOptionsOf: "rules.options.owner_options_of", attributesNamed: "rules.options.attributes_named",
      antiAttributesOf: "rules.options.anti_attributes_of", rollOptionsFor: "rules.options.roll_options_for",
      isEmittableOption: "rules.options.is_emittable_option",
    },
  },
  {
    module: "module/rules/count.mjs", layer: "rules/count", cap: 30, tests: "importers", maxFiles: 60,
    fns: {
      countOf: "rules.count.count_of", unitDistance: "rules.count.unit_distance", countedValue: "rules.count.counted_value",
      stacksHeld: "rules.count.stacks_held", countScaleOf: "rules.count.count_scale_of", criteriaMet: "rules.count.criteria_met",
      declarationCriteria: "rules.count.declaration_criteria", multiplierOf: "rules.count.multiplier_of",
      countSpecsIn: "rules.count.count_specs_in", countProblems: "rules.count.count_problems",
      unknownCountKindsIn: "rules.count.unknown_count_kinds_in", fromPerStack: "rules.count.from_per_stack",
      fromCountTargets: "rules.count.from_count_targets", fromCountMatching: "rules.count.from_count_matching",
      parametersCounted: "rules.count.parameters_counted",
    },
  },
  {
    module: "module/rules/relations.mjs", layer: "rules/relations", cap: 30, tests: "importers",
    fns: { sideOf: "rules.relations.side_of", relationOf: "rules.relations.relation_of", isFriendly: "rules.relations.is_friendly", guardsOf: "rules.relations.guards_of" },
  },
  // M2b: rule elements and ordering.
  {
    module: "module/rules/elements.mjs", layer: "rules/elements", cap: 60, tests: "importers", maxFiles: 60,
    fns: {
      empty: "rules.elements.empty", collectContributions: "rules.elements.collect_contributions",
      deferredPredicate: "rules.elements.deferred_predicate", abilityRankShifts: "rules.elements.ability_rank_shifts",
      rankWithShifts: "rules.elements.rank_with_shifts", resolveValue: "rules.elements.resolve_value",
      normalizeHandler: "rules.elements.normalize_handler", handledKeys: "rules.elements.handled_keys",
    },
  },
  {
    module: "module/rules/ordering.mjs", layer: "rules/ordering", cap: 80, tests: "importers",
    fns: { bandOf: "rules.ordering.band_of", orderElements: "rules.ordering.order_elements" },
  },
  // M2c: the projection.
  {
    module: "module/rules/snapshot.mjs", layer: "rules/snapshot", cap: 40, tests: "importers", maxFiles: 60,
    fns: {
      snapshotUnit: "rules.snapshot.snapshot_unit", snapshotBoard: "rules.snapshot.snapshot_board",
      turnStateAt: "rules.snapshot.turn_state_at", roundStateAt: "rules.snapshot.round_state_at",
      applyBaseAttackModifiers: "rules.snapshot.apply_base_attack_modifiers", resolveRuleValues: "rules.snapshot.resolve_rule_values",
      attributesOf: "rules.snapshot.attributes_of", expressionRefs: "rules.snapshot.expression_refs",
    },
  },
  // M2d: targeting.
  {
    module: "module/rules/targeting/resolve.mjs", layer: "rules/targeting", cap: 40, tests: "importers", maxFiles: 60,
    fns: {
      resolveTargets: "rules.targeting.resolve_targets", validate: "rules.targeting.validate",
      unitsShown: "rules.targeting.units_shown", pendingChoiceErrors: "rules.targeting.pending_choice_errors",
      legalPlacements: "rules.targeting.legal_placements", measuredReach: "rules.targeting.measured_reach",
    },
  },
  {
    module: "module/rules/targeting/shapes.mjs", layer: "rules/shapes", cap: 60, tests: "importers",
    fns: { expand: "rules.shapes.expand", orthogonalAdjacentRect: "rules.shapes.orthogonal_adjacent_rect", footprintAdjacentRect: "rules.shapes.footprint_adjacent_rect" },
  },
  // M2e: checks and the damage pipeline.
  {
    module: "module/rules/checks.mjs", layer: "rules/checks", cap: 60, tests: "importers", maxFiles: 60,
    fns: {
      tableFor: "rules.checks.table_for", agilityTableAgainst: "rules.checks.agility_table_against",
      checkPlan: "rules.checks.check_plan", mergePlans: "rules.checks.merge_plans",
      pendingCheckRolls: "rules.checks.pending_check_rolls", resolveCheck: "rules.checks.resolve_check",
      evade: "rules.checks.evade", luckCheck: "rules.checks.luck_check", chance: "rules.checks.chance",
      applicationChance: "rules.checks.application_chance", critChance: "rules.checks.crit_chance",
    },
  },
  {
    module: "module/rules/damage/pipeline.mjs", layer: "rules/damage-pipeline", cap: 80, tests: "importers", maxFiles: 80,
    fns: {
      injuryThresholdOf: "rules.damage.injury_threshold_of", computeDamage: "rules.damage.compute_damage",
      computeDamageHits: "rules.damage.compute_damage_hits", elementalEarlyExit: "rules.damage.elemental_early_exit",
      usesBaseOptions: "rules.damage.uses_base_options", isNPAttack: "rules.damage.is_np_attack",
    },
  },
  // M4: the effect pipeline.
  {
    module: "module/engine/effect-applier.mjs", layer: "engine/effect-applier", cap: 120, tests: "importers", maxFiles: 80,
    fns: {
      applyEffect: "engine.effect_applier.apply_effect", mergeEmitted: "engine.effect_applier.merge_emitted",
      inflictBonusOf: "engine.effect_applier.inflict_bonus_of",
    },
  },
  {
    module: "module/rules/effect-flow.mjs", layer: "rules/effect-flow", cap: 60, tests: "importers", maxFiles: 80,
    fns: {
      attackOptionsOf: "rules.effect_flow.attack_options_of", transferEffect: "rules.effect_flow.transfer_effect",
      transferableFrom: "rules.effect_flow.transferable_from", visibilityOf: "rules.effect_flow.visibility_of",
      canSeeEffect: "rules.effect_flow.can_see_effect", confusedAction: "rules.effect_flow.confused_action",
      canUndo: "rules.effect_flow.can_undo", removeStages: "rules.effect_flow.remove_stages",
      applicationsOf: "rules.effect_flow.applications_of", effectGatePasses: "rules.effect_flow.effect_gate_passes",
      stagesFor: "rules.effect_flow.stages_for", entryOf: "rules.effect_flow.entry_of",
      chanceOf: "rules.effect_flow.chance_of", timesOf: "rules.effect_flow.times_of",
    },
  },
  {
    module: "module/rules/removal.mjs", layer: "rules/removal", cap: 60, tests: "importers",
    fns: {
      isUnremovable: "rules.removal.is_unremovable", selectorMatches: "rules.removal.selector_matches",
      removalResistOf: "rules.removal.removal_resist_of", ownRemovalResist: "rules.removal.own_removal_resist",
      removalPlan: "rules.removal.removal_plan", pendingRemovalRolls: "rules.removal.pending_removal_rolls",
    },
  },
  {
    module: "module/rules/periodic.mjs", layer: "rules/periodic", cap: 60, tests: "importers",
    fns: { periodicDue: "rules.periodic.periodic_due" },
  },
  {
    module: "module/rules/revival.mjs", layer: "rules/revival", cap: 60, tests: "importers", maxFiles: 80,
    fns: {
      availableRevivals: "rules.revival.available_revivals", missedRevivalChances: "rules.revival.missed_revival_chances",
      heldRevivals: "rules.revival.held_revivals", resolveRevival: "rules.revival.resolve_revival",
      pendingRevivalRolls: "rules.revival.pending_revival_rolls", attackIdentity: "rules.revival.attack_identity",
      identityOfProcess: "rules.revival.identity_of_process", recordedAttack: "rules.revival.recorded_attack",
      poolRestores: "rules.revival.pool_restores",
    },
  },
  {
    module: "module/rules/relationships.mjs", layer: "rules/relationships", cap: 60, tests: "importers", maxFiles: 80,
    fns: {
      multiServantRule: "rules.relationships.multi_servant_rule", overpowerCheck: "rules.relationships.overpower_check",
      resolveOverpower: "rules.relationships.resolve_overpower", underpowerCheck: "rules.relationships.underpower_check",
      resolveUnderpower: "rules.relationships.resolve_underpower", onMasterDefeated: "rules.relationships.on_master_defeated",
      sustainabilityCostOf: "rules.relationships.sustainability_cost_of", actedWeight: "rules.relationships.acted_weight",
      multiServantTax: "rules.relationships.multi_servant_tax", mayOrderAnotherServant: "rules.relationships.may_order_another_servant",
    },
  },
  {
    module: "module/rules/summons.mjs", layer: "rules/summons", cap: 40, tests: "importers",
    fns: { expiredSummonIds: "rules.summons.expired_summon_ids" },
  },
  {
    module: "module/rules/nameless-forest.mjs", layer: "rules/nameless-forest", cap: 40, tests: "importers",
    fns: { deathRollOutcome: "rules.nameless_forest.death_roll_outcome", mayAttemptEscape: "rules.nameless_forest.may_attempt_escape" },
  },
  {
    module: "module/rules/use-record.mjs", layer: "rules/use-record", cap: 60, tests: "importers",
    fns: {
      emptyUseRecord: "rules.use_record.empty_use_record", mergeRecords: "rules.use_record.merge_records",
      useFacts: "rules.use_record.use_facts", useOptions: "rules.use_record.use_options",
      declarationRecord: "rules.use_record.declaration_record",
    },
  },
  {
    module: "module/engine/cooldown.mjs", layer: "engine/cooldown", cap: 80, tests: "importers", maxFiles: 80,
    fns: {
      cooldownFor: "engine.cooldown.cooldown_for", settleDelta: "engine.cooldown.settle_delta",
      sharedAcrossGroup: "engine.cooldown.shared_across_group", sharedCooldownIntents: "engine.cooldown.shared_cooldown_intents",
      twinsOf: "engine.cooldown.twins_of",
    },
  },
];
