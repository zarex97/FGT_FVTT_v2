/**
 * @file The ability editor.
 * @see docs/29-user-interface.md §29.6, docs/22-data-models.md §22.6
 *
 * Layer 4. The tool §29.6 says determines whether **SC-6** is met — a GM
 * authors a Karna-complexity Servant in under an hour.
 *
 * The piece §29.6 says matters most is the **targeting picker**: a GM should
 * never have to know that `selfEdgeAdjacent` is the internal name for "a 5×5
 * area in any non-diagonal direction next to the caster" — they should see the
 * shapes and click one. So anchors and shapes are presented as labelled options
 * with a schematic preview, and the internal name is what gets written, never
 * what gets read.
 *
 * **Live validation asks the engine itself.** Not the content build's
 * validator: `tools/lib/content.mjs` already imports from `module/`, so
 * importing it back would invert the layer graph. Instead every check here
 * consults the authority the engine actually uses at runtime -- `handledKeys()`
 * for rule elements, `EffectRegistry` for effect ids, `parseTick` for
 * durations, `SHAPE_IDS` for targeting. Those are the checks that decide
 * whether an ability *does anything*, which is the failure this editor exists
 * to prevent. CI remains authoritative for the rest, and a drift test holds the
 * two vocabularies together in both directions.
 */

import { handledKeys } from "../../rules/elements.mjs";
import { TARGET_ANCHORS, TARGET_SHAPES, SHAPE_IDS, ANCHOR_IDS } from "../../rules/targeting/vocabulary.mjs";
import { EffectRegistry } from "../../rules/registry.mjs";
import { parseTick, resolveTicks } from "../../domain/tick.mjs";
import {
  railRows, elementRows, requirementRows, timingRow, selectionRow, formRows,
} from "./present.mjs";
import { PHASE_DESCRIPTORS, phasesByUsage } from "../../rules/authoring/phases.mjs";
import { sheetFor } from "../sheet-choice.mjs";
import { coerceFieldValue } from "../../rules/authoring/fields.mjs";
import { builderRows, patchRows } from "./predicate-builder.mjs";
import { ELEMENT_DESCRIPTORS } from "../../rules/authoring/elements.mjs";
import {
  REQUIREMENT_DESCRIPTORS, CS_REQUIREMENT_DESCRIPTORS,
} from "../../rules/authoring/requirements.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * What an ability IS. Content uses exactly these three.
 */
const ABILITY_KINDS = Object.freeze(["classSkill", "skill", "noblePhantasm"]);

/**
 * The Rank ladder, for every `rank`-typed descriptor field.
 *
 * Written out rather than derived from `domain/rank.mjs`, which parses ranks
 * rather than enumerating them — and a picker needs the list in ladder order,
 * which parsing cannot give.
 */
const RANK_CHOICES = Object.freeze([
  "EX", "A++", "A+", "A", "A-", "B++", "B+", "B", "B-",
  "C++", "C+", "C", "C-", "D++", "D+", "D", "D-", "E++", "E+", "E", "E-",
]);


/**
 * **An `ItemSheetV2`, not a bare `ApplicationV2`.**
 *
 * It was the latter, and that is precisely why it could never be reached from
 * the Items directory: `DocumentSheetConfig.registerSheet` refuses anything
 * that is not a `DocumentSheetV2`, so the editor was registered as no sheet at
 * all and Create Item → Ability opened the read-only one.
 *
 * The base class brings `document`, `isEditable` and the close-on-delete
 * behaviour a sheet needs. It does **not** bring its form handling: this
 * editor keeps its own `form.handler`, because nothing here is written to the
 * Item until Save — a rule-element form that wrote on every keystroke would
 * put half-typed content in front of the whole table.
 */
export class AbilityEditor extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-ability-editor",
    classes: ["fgt", "ability-editor"],
    tag: "form",
    position: { width: 780, height: 720 },
    window: { title: "FGT.Editor.Title", resizable: true },
    form: { handler: AbilityEditor.#onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      addPhase: AbilityEditor.#onAddPhase,
      removePhase: AbilityEditor.#onRemovePhase,
      movePhase: AbilityEditor.#onMovePhase,
      pickAnchor: AbilityEditor.#onPickAnchor,
      pickShape: AbilityEditor.#onPickShape,
      editImage: AbilityEditor.#onEditImage,
      exportSource: AbilityEditor.#onExportSource,
      save: AbilityEditor.#onSave,
      // The section that has never existed: rule elements were VALIDATED and
      // unauthorable.
      addElement: AbilityEditor.#onAddElement,
      removeElement: AbilityEditor.#onRemoveElement,
      moveElement: AbilityEditor.#onMoveElement,
      addRequirement: AbilityEditor.#onAddRequirement,
      removeRequirement: AbilityEditor.#onRemoveRequirement,
      jumpTo: AbilityEditor.#onJumpTo,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/ability-editor.hbs", scrollable: [".fgt-editor__body"] },
  };

  /** @type {object} the Item being edited */
  #item;

  /** @type {object} the working copy — nothing is written until Save */
  #draft;

  /** @type {string|null} a new name, held until Save with the rest of the draft */
  #pendingName = null;

  /** @type {string|null} a new image, held until Save. */
  #pendingImg = null;

  /** @type {Record<number, boolean>} phases whose raw JSON did not parse */
  #rawErrors = {};

  /** @type {string|null} the rail row the GM last jumped to */
  #current = null;

  /**
   * @param {object} item an Item, or Foundry's `{document}` sheet options
   *
   * Two shapes, because there are two callers. `AbilityEditor.open(item)`
   * passes the Item directly, and Foundry's sheet registration constructs
   * `new cls({document, ...options})` — so accepting only the first is what
   * kept this class from ever being registerable as a sheet, which is why
   * Items → Create Item → Ability opened the plain one.
   */
  constructor(options = {}) {
    // Two shapes, because there are two callers. `AbilityEditor.open(item)`
    // passes the Item directly; Foundry's sheet registration constructs
    // `new cls({document, ...options})`.
    const item = options?.documentName ? options : options?.document;
    super(options?.documentName ? { document: options } : options);
    this.#item = item;
    this.#draft = foundry.utils.deepClone(item?.system ?? {});
  }

  /**
   * @param {object} item an ability or Noble Phantasm Item
   * @returns {AbilityEditor}
   */
  static open(item) {
    const app = new AbilityEditor(item);
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const report = this.#validate();

    return {
      name: this.#item.name,
      draft: this.#draft,

      // The three NP-scoping flags sit behind a disclosure that defaults to the
      // derived values (§29.6): they are the flags most often set wrongly, and
      // the derived answer is right almost always.
      advanced: {
        isNP: Boolean(this.#draft.isNP),
        categorizedAsNP: this.#draft.categorizedAsNP ?? Boolean(this.#draft.isNP),
        countsForNPSeal: this.#draft.countsForNPSeal ?? Boolean(this.#draft.isNP),
      },

      // What the ability IS, and the per-use limits. None of these could be set
      // in this editor before -- not even the name.
      identity: {
        name: this.#item.name,
        // `#pendingImg` first, or a pick would visibly revert to the old icon
        // on every re-render between clicking it and hitting Save.
        img: this.#pendingImg ?? this.#item.img,
        kind: this.#draft.kind ?? (this.#item.type === "noblePhantasm" ? "noblePhantasm" : "skill"),
        kindChoices: Object.fromEntries(ABILITY_KINDS.map((k) => [k, `FGT.Editor.AbilityKind.${k}`])),
        description: this.#draft.description ?? "",
      },
      limits: {
        cost: this.#draft.cost ?? 1,
        cooldown: this.#draft.cooldown?.max ?? "",
        cooldownHint: this.#tickHint(this.#draft.cooldown?.max),
        maxUses: this.#draft.maxUses ?? "",
        requiresRound: this.#draft.targeting?.limits?.requiresRound ?? this.#draft.requiresRound ?? "",
        oncePerTurn: Boolean(this.#draft.oncePerTurn),
        isPassive: Boolean(this.#draft.isPassive),
        isMode: Boolean(this.#draft.isMode),
        isAttackSkill: Boolean(this.#draft.isAttackSkill),
        category: this.#draft.category ?? "",
      },

      phases: (this.#draft.phases ?? []).map((phase, index) => this.#phaseContext(phase, index)),

      // Illustrated, not named. See the file comment.
      anchors: TARGET_ANCHORS.map((a) => ({
        ...a, svg: schematicSvg(a.schematic), selected: this.#draft.targeting?.anchor === a.id,
      })),
      shapes: TARGET_SHAPES.map((sh) => ({
        ...sh, svg: schematicSvg(sh.schematic), selected: this.#draft.targeting?.shape === sh.id,
      })),

      // The rail: every section, whether it is done, and how much it holds.
      // Ordered for a first author; jumpable for someone fixing one cooldown
      // on a shipped Servant.
      rail: railRows(this.#draft, this.#itemType(), { current: this.#current }),

      // The section this whole rebuild exists for. Three buckets, because an
      // element applies at a different TIME in each -- `activeRules` only
      // while a mode is switched on.
      buckets: ["passiveRules", "activeRules", "rules"].map((bucket) => {
        const rows = elementRows(this.#draft, bucket);
        return {
          id: bucket,
          label: `FGT.Authoring.Bucket.${bucket}`,
          hint: `FGT.Authoring.Bucket.${bucket}Hint`,
          rows: [...rows],
          choices: rows.choices,
        };
      }),

      requirements: (() => {
        const rows = requirementRows(this.#draft, this.#itemType());
        return { rows: [...rows], choices: rows.choices };
      })(),

      timing: timingRow(this.#draft),
      selection: selectionRow(this.#draft),

      elementKeys: handledKeys().sort(),
      effects: EffectRegistry.all().map((d) => ({ id: d.id, name: d.name })),

      // Read through `@root` by the field partial, which may be invoked from
      // three loops deep -- `../` would depend on how far.
      // The group operators a predicate may nest. `and` is the implicit top
      // level and is offered only for an explicitly nested block.
      groupOps: Object.fromEntries(
        ["and", "or", "anyOf", "nand", "nor", "not"].map((o) => [o, o]),
      ),
      ranks: Object.fromEntries(RANK_CHOICES.map((r) => [r, r])),
      effectChoices: Object.fromEntries(
        EffectRegistry.all().map((d) => [d.id, d.name ?? d.id]),
      ),

      // "1◈+⅔◈ shows = 5 turns at 3 turns/round" — the duration field explains
      // itself as you type, because tick arithmetic is the thing authors get
      // wrong and the notation gives no hint.
      durationHint: this.#durationHint(),

      problems: report.problems,
      warnings: report.warnings,
      valid: report.problems.length === 0,
    };
  }

  /**
   * Check the draft against what the engine can actually execute.
   *
   * Every rule here answers the same question in a different place: **will this
   * do anything at play time?** An unknown element key, a missing effect id and
   * an unimplemented shape all produce the same failure -- an ability that
   * authors cleanly, compiles, loads, and silently does nothing -- which is the
   * defect this project produces more than any other.
   *
   * @returns {{problems: string[], warnings: string[]}}
   */
  #validate() {
    /** @type {string[]} */ const problems = [];
    /** @type {string[]} */ const warnings = [];
    const known = new Set(handledKeys());

    for (const [where, el] of this.#elements()) {
      if (!el.key) {
        problems.push(game.i18n.format("FGT.Editor.NoKey", { where }));
        continue;
      }
      if (!known.has(el.key)) {
        problems.push(game.i18n.format("FGT.Editor.UnknownKey", { where, key: el.key }));
      }
      // §24.6: an explicit priority reorders the element against its whole
      // band, so it must say why.
      if (el.priority !== undefined && !String(el["@intentional"] ?? "").trim()) {
        problems.push(game.i18n.format("FGT.Editor.NeedsIntentional", { where }));
      }
    }

    for (const [where, id] of this.#effectIds()) {
      if (!EffectRegistry.get(id)) {
        problems.push(game.i18n.format("FGT.Editor.UnknownEffect", { where, id }));
      }
    }

    const targeting = this.#draft.targeting ?? null;
    if (targeting?.shape && !SHAPE_IDS.includes(targeting.shape?.kind ?? targeting.shape)) {
      problems.push(game.i18n.format("FGT.Editor.UnknownShape", { shape: targeting.shape?.kind ?? targeting.shape }));
    }
    if (targeting?.anchor && !ANCHOR_IDS.includes(targeting.anchor?.kind ?? targeting.anchor)) {
      problems.push(game.i18n.format("FGT.Editor.UnknownAnchor", { anchor: targeting.anchor?.kind ?? targeting.anchor }));
    }

    for (const [where, value] of [["duration", this.#draft.duration], ["cooldown", this.#draft.cooldown?.max]]) {
      if (!value) continue;
      try {
        parseTick(String(value));
      } catch (err) {
        problems.push(game.i18n.format("FGT.Editor.BadTick", { where, message: err.message }));
      }
    }

    // A phase whose JSON did not parse. Reported rather than swallowed: the
    // edit was silently discarded, and an author who is not told that will
    // save believing it took.
    for (const index of Object.keys(this.#rawErrors)) {
      problems.push(game.i18n.format("FGT.Editor.BadPhaseJSON", { index }));
    }

    // A phaseless, ruleless ability is legal -- a pure flavour entry -- but it
    // is far more often a half-finished one, so it warns rather than refuses.
    if ((this.#draft.phases ?? []).length === 0 && this.#elements().length === 0) {
      warnings.push(game.i18n.localize("FGT.Editor.DoesNothing"));
    }

    return { problems, warnings };
  }

  /**
   * One phase, as the editor shows it.
   *
   * A kind this editor has never heard of gets the JSON editor rather than an
   * empty form. Phases are an `ObjectField` and a module may add a kind
   * (§21.4); an editor that rendered nothing for it would look like the phase
   * was empty, and saving would then make it so.
   *
   * @param {object} phase
   * @param {number} index
   * @returns {object}
   */
  #phaseContext(phase, index) {
    const descriptor = PHASE_DESCRIPTORS[phase.kind] ?? null;
    const known = Boolean(descriptor);

    return {
      index,
      kind: phase.kind ?? "",
      known,
      isFirst: index === 0,
      isLast: index === (this.#draft.phases ?? []).length - 1,

      // Built here rather than compared in the template. A hand-rolled
      // `<option {{#if (eq k ../p.kind)}}selected{{/if}}>` inside two nested
      // `{{#each}}`es silently marked NOTHING selected, so every phase's
      // dropdown showed the first kind alphabetically -- `applyEffects` -- next
      // to the fields of whatever kind it actually was.
      //
      // An unrecognised kind is included so it stays selectable: dropping it
      // from the list would rewrite the phase on the next render.
      // Commonest first, from the corpus measurement -- `applyEffects` is 95
      // of the phases in `packs/_source`, and a picker that buries it under
      // `channel` makes the common case the slowest one.
      kindChoices: {
        ...Object.fromEntries(phasesByUsage().map((d) => [d.id, game.i18n.localize(d.label)])),
        ...(known || !phase.kind ? {} : { [phase.kind]: `${phase.kind} (unrecognised)` }),
      },

      // From the descriptor table, not from a hand-written list beside it.
      // The old `PHASE_FIELDS` typed four kinds that appear in ZERO authored
      // abilities and left nine that content does use -- `createField` (8),
      // `zone` (4) -- to the raw pane.
      fields: descriptor ? formRows(descriptor, phase, `phase.${index}`) : [],

      // `applyEffects` carries rule elements, and the effect id is the field
      // that decides whether the phase does anything at all.
      rules: phase.kind === "applyEffects"
        ? (phase.rules ?? []).map((rule, r) => ({
          index: r,
          key: rule.key ?? "",
          effectId: rule.effect?.id ?? "",
          magnitude: rule.effect?.magnitude ?? "",
          duration: rule.duration ?? "",
          // Every registered effect, by name. Carried per rule rather than
          // looked up from the root, because `selectOptions` inside two nested
          // `{{#each}}`es resolves a bare name against the ITEM.
          effectChoices: registeredEffects(),
        }))
        : [],

      // The escape hatch, and for an unknown kind the only editor. Pretty
      // printed so a GM can actually read what they are editing.
      raw: JSON.stringify(phase, null, 2),
    };
  }

  /** @returns {Array<[string, object]>} */
  #elements() {
    return ["rules", "passiveRules", "activeRules"].flatMap(
      (bucket) => (this.#draft[bucket] ?? []).map((el, k) => [`${bucket}[${k}]`, el]),
    );
  }

  /** @returns {Array<[string, string]>} */
  #effectIds() {
    return (this.#draft.phases ?? []).flatMap((phase, p) =>
      (phase.rules ?? [])
        .map((rule, r) => [`phases[${p}].rules[${r}]`, rule.effect?.id])
        .filter(([, id]) => Boolean(id)));
  }

  /** @returns {string|null} */
  #durationHint() {
    return this.#tickHint(this.#draft.duration ?? this.#draft.cooldown?.max ?? null);
  }

  /**
   * What a tick expression resolves to, in turns.
   *
   * §29.6 asks for `"1◈+⅔◈"` to show *"= 5 turns at 3 turns/round"*, because
   * tick arithmetic is the thing authors get wrong and the notation gives no
   * hint at all.
   *
   * It has never shown that. The old implementation read `tick.rounds` and
   * `tick.turns` off the parse result, and a `TickExpr` has neither — it is
   * `{kind, n}` or `{kind, whole, frac, sign}` — so the hint has rendered
   * `NaN turns` for every expression since it was written. `resolveTicks` is
   * the function that answers this, and it is the same one the scheduler uses.
   *
   * @param {string|number|null} raw
   * @returns {string|null}
   */
  #tickHint(raw) {
    if (!raw) return null;
    const perRound = game.settings.get("fgt", "turnsPerRound") ?? 3;
    try {
      const turns = resolveTicks(parseTick(String(raw)), { turnsPerRound: perRound });
      return game.i18n.format("FGT.Editor.DurationHint", { turns, perRound });
    } catch (err) {
      return game.i18n.format("FGT.Editor.DurationBad", { message: err.message });
    }
  }

  /* ── Handlers ───────────────────────────────────────────────────────────── */

  /**
   * @this {AbilityEditor}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {object} formData
   */
  /**
   * Hand a non-GM back to the read sheet.
   *
   * `makeDefault` is world-wide — Foundry has no per-permission default — so
   * registering the editor as the default ability sheet points **everyone** at
   * it. The split has to happen somewhere, and here is the one place that sees
   * both the document and the user.
   *
   * The reason is `actor-sheet/sheet.mjs`'s: the editor writes rule elements,
   * and a player who reorders a phase has changed the ability for the whole
   * table.
   *
   * @inheritdoc
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    if (sheetFor(this.#item?.type, game.user) === "editor") return;

    await this.close();
    // Found by class rather than imported: `apps/index.mjs` imports this
    // module, so importing it back would close the graph.
    const entry = Object.values(CONFIG.Item.sheetClasses?.[this.#item.type] ?? {})
      .find((e) => e.cls?.name === "FGTItemSheet");
    if (entry) new entry.cls({ document: this.#item }).render(true);
  }

  /**
   * Which vocabulary this Item authors from.
   *
   * The branch is a **vocabulary selection**, not a second editor: a command
   * spell's requirement list and an ability's must never merge, because
   * `servantInZon` asks about somebody else's Servant.
   *
   * @returns {string}
   */
  #itemType() {
    return this.#item?.type ?? "ability";
  }

  /**
   * Add a rule element to a bucket.
   *
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAddElement(_event, target) {
    const bucket = target.dataset.bucket;
    // `.fgt-editor__bucket`, NOT `[data-bucket]`: the button carries
    // `data-bucket` itself, so `closest` returns the button and the picker is
    // never found. The add silently did nothing.
    const key = target.closest(".fgt-editor__bucket")?.querySelector("select[data-picker]")?.value;
    if (!bucket || !key || !ELEMENT_DESCRIPTORS[key]) return;

    this.#draft[bucket] = [...(this.#draft[bucket] ?? []), { key }];
    this.#current = "ruleElements";
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveElement(_event, target) {
    const bucket = target.dataset.bucket;
    const index = Number(target.dataset.index);
    if (!bucket || !Number.isInteger(index)) return;

    const held = [...(this.#draft[bucket] ?? [])];
    held.splice(index, 1);
    this.#draft[bucket] = held;
    this.#current = "ruleElements";
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onMoveElement(_event, target) {
    const bucket = target.dataset.bucket;
    const index = Number(target.dataset.index);
    const to = index + (target.dataset.direction === "up" ? -1 : 1);
    const held = [...(this.#draft[bucket] ?? [])];
    if (!bucket || to < 0 || to >= held.length) return;

    [held[index], held[to]] = [held[to], held[index]];
    this.#draft[bucket] = held;
    this.#current = "ruleElements";
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAddRequirement(_event, target) {
    const kind = target.closest("[data-requirements]")?.querySelector("select[data-picker]")?.value;
    const table = this.#itemType() === "commandSpell"
      ? CS_REQUIREMENT_DESCRIPTORS : REQUIREMENT_DESCRIPTORS;
    if (!kind || !table[kind]) return;

    this.#draft.requirements = [...(this.#draft.requirements ?? []), { kind }];
    this.#current = "requirements";
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveRequirement(_event, target) {
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index)) return;

    const held = [...(this.#draft.requirements ?? [])];
    held.splice(index, 1);
    this.#draft.requirements = held;
    this.#current = "requirements";
    this.render();
  }

  /**
   * Scroll to a section and mark it current on the rail.
   *
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onJumpTo(_event, target) {
    const id = target.dataset.section;
    if (!id) return;
    this.#current = id;
    this.element?.querySelector(`[data-section-body="${id}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
    this.render();
  }

  static async #onChange(_event, _form, formData) {
    const raw = { ...formData.object };

    // FIRST, before any other extraction. A builder control is named
    // `passiveRules.0.predicate::0.negated` -- which starts with
    // `passiveRules.`, so `#applyListPatch` claimed it and wrote the raw form
    // object onto the element as a field called `predicate::0`. Found live:
    // the saved rule element grew a `predicate::0` key beside its predicate,
    // and the edit did nothing.
    // Predicate builder controls, named `<fieldName>::<rowPath>.<field>`.
    // The `::` separates the field from the path INSIDE it, because a field
    // name is itself dotted (`passiveRules.0.predicate`) and one separator
    // could not tell the two apart.
    /** @type {Record<string, Record<string, string>>} */
    const predicateInputs = {};
    for (const [key, value] of Object.entries(raw)) {
      const at = key.indexOf("::");
      if (at === -1) continue;
      (predicateInputs[key.slice(0, at)] ??= {})[key.slice(at + 2)] = value;
      delete raw[key];
    }
    for (const [field, inputs] of Object.entries(predicateInputs)) {
      // Rebuilt from the DRAFT, so a raw row the builder cannot model is
      // carried through rather than dropped on the next keystroke.
      const held = foundry.utils.getProperty(this.#draft, field) ?? [];
      const next = patchRows(builderRows(held, "ownerOnly", ""), inputs);
      foundry.utils.setProperty(this.#draft, field, next);
    }


    // Phase inputs are named `phase.<i>.<field>` and handled separately,
    // because `expandObject` turns an indexed path into an OBJECT with numeric
    // keys and `mergeObject` then replaces the phases array wholesale. Every
    // property this editor has no field for would be dropped on the next
    // keystroke -- a predicate, an event filter, a target selector -- and the
    // ability would keep authoring cleanly while doing less than it says.
    /** @type {Record<string, string>} */
    const phaseInputs = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!key.startsWith("phase.")) continue;
      phaseInputs[key] = value;
      delete raw[key];
    }

    // The same trap, for every other indexed list. `expandObject` turns
    // `passiveRules.0.direction` into an OBJECT with a numeric key, and
    // `mergeObject` then replaces the whole array -- so an element's
    // `predicate`, or any property this editor has no field for, would be
    // dropped on the next keystroke. Exactly the failure the phase patcher
    // above was written to avoid, and there are now four more lists that
    // could suffer it.
    /** @type {Record<string, Record<string, string>>} */
    const listInputs = {};
    for (const list of ["passiveRules", "activeRules", "rules", "requirements"]) {
      for (const [key, value] of Object.entries(raw)) {
        if (!key.startsWith(`${list}.`)) continue;
        (listInputs[list] ??= {})[key] = value;
        delete raw[key];
      }
    }

    // The timing windows come in as one checkbox each, because an ability may
    // name two -- Karna's Uncrowned Arms Mastership is "during your Turn OR at
    // the start of a Combat Phase". Collected into the list `windowsOf` reads,
    // and written as a bare STRING when there is exactly one, which is the
    // shape 116 of the 117 authored abilities use.
    const picked = [];
    let sawWindowInput = false;
    for (const [key, value] of Object.entries(raw)) {
      if (!key.startsWith("window.")) continue;
      sawWindowInput = true;
      if (value) picked.push(key.slice("window.".length));
      delete raw[key];
    }
    if (sawWindowInput) {
      const timing = { ...(this.#draft.timing ?? {}) };
      if (picked.length === 0) delete timing.window;
      else timing.window = picked.length === 1 ? picked[0] : picked;
      this.#draft.timing = Object.keys(timing).length > 0 ? timing : null;
    }

    // `name` and `img` belong to the Item, not to `system`.
    if ("name" in raw) { this.#pendingName = raw.name; delete raw.name; }
    if ("img" in raw) { this.#pendingImg = raw.img; delete raw.img; }

    // A blank input does not overwrite a value that was never set. Every field
    // is submitted on every change, so an author who edited one thing would
    // otherwise rewrite `rank: null` -- deliberately null on the three Noble
    // Phantasms whose sheets print a RANGE rather than a Rank -- to `""` on
    // their way past. Blanking a field that HAS a value is a real edit and
    // still applies.
    for (const [key, value] of Object.entries(raw)) {
      if (String(value).trim() !== "") continue;
      const existing = foundry.utils.getProperty(this.#draft, key);
      if (existing === null || existing === undefined) delete raw[key];
    }

    foundry.utils.mergeObject(this.#draft, foundry.utils.expandObject(raw));
    this.#applyPhasePatch(phaseInputs);
    for (const [list, inputs] of Object.entries(listInputs)) {
      this.#applyListPatch(list, inputs);
    }
    this.render();
  }

  /**
   * Write the phase inputs back onto the phases they came from.
   *
   * **Merges, never replaces.** The typed editor knows a handful of fields per
   * kind; the phase may carry any number of others. Assigning a fresh object
   * built from the form would lose them, and lose them silently — which is the
   * precise failure this editor exists to catch in other people's content.
   *
   * @param {Record<string, string>} inputs keyed `phase.<i>.<field>`
   * @returns {void}
   */
  /**
   * Write indexed list inputs back onto the entries they came from.
   *
   * **Merges, never replaces**, for the reason `#applyPhasePatch` does: the
   * descriptor knows the fields it named, and the authored entry may carry
   * others — a `predicate`, a `defer`, anything a module added. Building a
   * fresh object from the form would lose them silently, which is the precise
   * failure this editor exists to catch in other people's content.
   *
   * @param {string} list `passiveRules`, `requirements`, …
   * @param {Record<string, string>} inputs keyed `<list>.<i>.<field>`
   * @returns {void}
   */
  #applyListPatch(list, inputs) {
    const held = [...(this.#draft[list] ?? [])];

    for (const [key, value] of Object.entries(inputs)) {
      const [, rawIndex, ...rest] = key.split(".");
      const index = Number(rawIndex);
      const field = rest.join(".");
      if (!Number.isInteger(index) || !held[index] || !field) continue;

      // A blank does not erase a value that was never set, for the same
      // reason it does not at the top level: every input is submitted on
      // every change.
      const existing = foundry.utils.getProperty(held[index], field);
      if (String(value).trim() === "" && (existing === null || existing === undefined)) continue;

      held[index] = { ...held[index] };
      // A `tokenList` or `predicateList` is an ARRAY in every authored
      // document. Storing the raw string authors an element that reads a
      // character at a time: it validates, and does nothing.
      const type = this.#fieldType(list, held[index], field);
      foundry.utils.setProperty(held[index], field, coerceFieldValue(type, value));
    }
    this.#draft[list] = held;
  }

  /**
   * The declared type of one field on one authored entry.
   *
   * @param {string} list
   * @param {object} entry
   * @param {string} field
   * @returns {string} a `FIELD_TYPES` member, or `"text"` when undescribed
   */
  #fieldType(list, entry, field) {
    const table = list === "requirements"
      ? (this.#itemType() === "commandSpell" ? CS_REQUIREMENT_DESCRIPTORS : REQUIREMENT_DESCRIPTORS)
      : ELEMENT_DESCRIPTORS;
    const descriptor = table[entry?.kind ?? entry?.key];
    return descriptor?.fields?.find((f) => f.key === field)?.type ?? "text";
  }

  #applyPhasePatch(inputs) {
    const phases = [...(this.#draft.phases ?? [])];
    const entries = Object.entries(inputs);

    // The raw JSON pass runs FIRST, and only where the text has actually been
    // edited.
    //
    // `submitOnChange` submits every input on any change, and the textarea is
    // one of them. Applied in DOM order it ran *after* the typed fields and
    // replaced the whole phase with its own stale contents -- so typing into a
    // typed field appeared to do nothing at all, every time. Comparing against
    // the phase's current serialization is what tells an edit from an echo.
    for (const [path, value] of entries) {
      const [, indexPart, field] = path.split(".");
      if (field !== "raw") continue;

      const index = Number(indexPart);
      const phase = phases[index];
      if (!phase) continue;
      if (String(value) === JSON.stringify(phase, null, 2)) continue;

      try {
        phases[index] = JSON.parse(String(value));
        delete this.#rawErrors[index];
      } catch {
        this.#rawErrors[index] = true;
      }
    }

    for (const [path, value] of entries) {
      const [, indexPart, ...rest] = path.split(".");
      const index = Number(indexPart);
      const phase = phases[index];
      if (!phase || rest.length === 0 || rest[0] === "raw") continue;

      if (rest[0] === "rule") {
        const [, ruleIndex, field] = rest;
        const rules = [...(phase.rules ?? [])];
        const rule = rules[Number(ruleIndex)];
        if (!rule) continue;

        if (field === "effectId") rule.effect = { ...(rule.effect ?? {}), id: value };
        else if (field === "magnitude") rule.effect = { ...(rule.effect ?? {}), magnitude: numberOrRaw(value) };
        else rule[field] = value;

        rules[Number(ruleIndex)] = rule;
        phases[index] = { ...phase, rules };
        continue;
      }

      // A blank field never invents a key. `submitOnChange` submits EVERY
      // input on any edit, so a typed field this editor offers for a kind that
      // does not actually use it would otherwise stamp `""` onto the phase the
      // first time anything else was touched -- adding junk beside the real
      // payload rather than replacing it, which is the quiet kind of wrong.
      const blank = String(value).trim() === "";
      if (blank && !Object.hasOwn(phase, rest[0])) continue;

      phases[index] = { ...phase, [rest[0]]: numberOrRaw(value) };
    }

    this.#draft.phases = phases;
  }

  /** @this {AbilityEditor} */
  static #onAddPhase() {
    this.#draft.phases = [...(this.#draft.phases ?? []), { kind: "damage" }];
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onRemovePhase(_event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    this.#draft.phases = (this.#draft.phases ?? []).filter((_, k) => k !== index);
    this.render();
  }

  /**
   * Reorder a phase.
   *
   * Phases are **ordered**, and the order is the ability: an `applyEffects`
   * before its `damage` applies to a unit that has not been hit yet.
   *
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onMovePhase(_event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    const delta = target.dataset.direction === "up" ? -1 : 1;
    const phases = [...(this.#draft.phases ?? [])];
    const to = index + delta;
    if (to < 0 || to >= phases.length) return;

    [phases[index], phases[to]] = [phases[to], phases[index]];
    this.#draft.phases = phases;
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onPickAnchor(_event, target) {
    this.#draft.targeting = { ...(this.#draft.targeting ?? {}), anchor: target.dataset.anchorId };
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onPickShape(_event, target) {
    this.#draft.targeting = { ...(this.#draft.targeting ?? {}), shape: target.dataset.shapeId };
    this.render();
  }

  /**
   * Change the ability's icon.
   *
   * `#pendingImg` already existed and `#onSave` already wrote it -- the FIELD
   * this editor could not set had a control for `name` and never grew one for
   * `img`, so the plumbing for it sat unused since the editor could set a name.
   * Held in `#pendingImg` rather than written immediately, for the same reason
   * every other field here is: nothing is written until Save.
   *
   * @this {AbilityEditor}
   */
  static async #onEditImage() {
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: this.#pendingImg ?? this.#item.img,
      callback: (path) => {
        this.#pendingImg = path;
        this.render();
      },
    });
    return picker.browse();
  }

  /**
   * Write the ability back to `packs/_source/`, where it becomes content.
   *
   * Ch. 39: the compendium is the whole source of truth, so a world copy is
   * reconciled to the pack on every load. That is only safe because an edit
   * worth keeping has this way home -- without it an hour's authoring lives in
   * one world until the next rebuild silently discards it.
   *
   * Two steps rather than one: nothing under `module/` imports an npm package,
   * so the browser writes the authored shape as JSON and `npm run stage:yaml`
   * turns it into the `.yml` the loader reads.
   *
   * @this {AbilityEditor}
   */
  static async #onExportSource() {
    const { exportItem } = await import("../yaml-export.mjs");
    // The DRAFT, not the stored item: exporting what is on screen is the whole
    // point, and a GM who has to save first in order to export would be saving
    // into a world copy the next sync overwrites.
    await exportItem({ name: this.#pendingName ?? this.#item.name, system: this.#draft });
  }

  /**
   * Write the draft back.
   *
   * Refused while the validator has problems. An ability that cannot compile is
   * one that will load into a compendium and do nothing — the failure this
   * project produces most often — and catching it here is the entire point of
   * running the build's checks live.
   *
   * @this {AbilityEditor}
   */
  static async #onSave() {
    const report = this.#validate();
    if (report.problems.length > 0) {
      ui.notifications.error(game.i18n.format("FGT.Editor.CannotSave", { count: report.problems.length }));
      return;
    }

    await this.#item.update({
      // The name and the image live on the Item, not in `system`. This editor
      // could not set either of them before, which meant authoring an ability
      // still required opening a second sheet to give it a name.
      ...(this.#pendingName !== null ? { name: this.#pendingName } : {}),
      ...(this.#pendingImg !== null ? { img: this.#pendingImg } : {}),
      system: this.#draft,
    });
    ui.notifications.info(game.i18n.format("FGT.Editor.Saved", { name: this.#item.name }));
    await this.close();
  }
}

/**
 * A form value as a number where it reads as one, and as itself otherwise.
 *
 * Every input arrives as a string. Writing `"3"` into a phase's `multiplier`
 * makes the damage pipeline multiply by a string, and writing `3` into a
 * `component` makes it look up a parameter that does not exist — so the test
 * is the value, not the field.
 *
 * @param {string} value
 * @returns {string|number}
 */
function numberOrRaw(value) {
  const text = String(value).trim();
  if (text === "" || Number.isNaN(Number(text))) return value;
  return Number(text);
}

/* -------------------------------------------------------------------------- */

/** Pixel size of one schematic cell. Five of them fit the picker's tile. */
const CELL = 9;

/**
 * One targeting schematic, as an inline SVG grid.
 *
 * §29.6: *"a GM should never have to know that `selfEdgeAdjacent` is the
 * internal name ... they should see four little diagrams and click one."*
 *
 * The diagrams were `<pre>` blocks of the raw characters with no width
 * constraint, so a wide one overflowed its button and landed on the labels of
 * the row beneath — which is what the reported screenshot shows. A fixed-size
 * SVG cannot do that: it scales to its box.
 *
 * Built from the vocabulary's **own** rows, so there is still exactly one
 * description of each shape and the drift test that holds the picker against
 * `expand()` still covers what is drawn.
 *
 * @param {string[]} rows `.` empty, `#` covered, `@` the caster
 * @returns {string} an SVG fragment, to be emitted with a triple-stash
 */
export function schematicSvg(rows) {
  const grid = (rows ?? []).map((row) => [...String(row)]);
  // Rows are authored by hand and some carry a trailing space. Pad to the
  // widest rather than trusting them to agree, or one ragged row silently
  // shifts every cell to its right.
  const width = Math.max(1, ...grid.map((row) => row.length));
  const height = Math.max(1, grid.length);

  const cells = grid.flatMap((row, y) =>
    Array.from({ length: width }, (_, x) => {
      const ch = row[x] ?? ".";
      const fill = ch === "@" ? "var(--fgt-gold)"
        : ch === "#" ? "var(--fgt-crimson)"
          : "var(--fgt-bg-sunken)";
      return `<rect x="${x * CELL + 0.5}" y="${y * CELL + 0.5}" width="${CELL - 1}" `
        + `height="${CELL - 1}" rx="1" fill="${fill}" stroke="var(--fgt-line)" stroke-width="0.5"/>`;
    }));

  return `<svg class="fgt-editor__svg" viewBox="0 0 ${width * CELL} ${height * CELL}" `
    + `role="img" aria-hidden="true">${cells.join("")}</svg>`;
}

/**
 * Every registered effect as an id → name map, for a `<select>`.
 *
 * The effect id is the field that decides whether an `applyEffects` phase does
 * anything at all — a typo'd one authors cleanly, loads, and applies nothing —
 * so it is a list of what exists rather than free text.
 *
 * @returns {Record<string, string>}
 */
function registeredEffects() {
  return Object.fromEntries(
    EffectRegistry.all()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((def) => [def.id, def.name]),
  );
}
