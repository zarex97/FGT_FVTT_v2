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

import { handledKeys } from "../rules/elements.mjs";
import { TARGET_ANCHORS, TARGET_SHAPES, SHAPE_IDS, ANCHOR_IDS } from "../rules/targeting/vocabulary.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * What an ability IS. Content uses exactly these three.
 */
const ABILITY_KINDS = Object.freeze(["classSkill", "skill", "noblePhantasm"]);

/**
 * The phase kinds the content packs actually use, each with the fields that
 * are safe to type.
 *
 * A phase is an `ObjectField` and a module may add a kind (§21.4), so this is
 * a list of what is **known**, never a list of what is allowed. A kind absent
 * from here falls through to the JSON editor rather than being lost — see
 * `#applyPhasePatch`, where the same rule is enforced on the way back in.
 *
 * @type {Readonly<Record<string, Array<{key: string, type: string}>>>}
 */
const PHASE_FIELDS = Object.freeze({
  damage: [
    { key: "target", type: "text" },
    { key: "multiplier", type: "number" },
    { key: "flatBonus", type: "number" },
    { key: "component", type: "text" },
  ],
  heal: [
    { key: "target", type: "text" },
    { key: "amount", type: "number" },
    // Of MAXIMUM, not of current, which is why it is its own field.
    { key: "percentOfMax", type: "number" },
  ],
  modifyDamage: [
    { key: "factor", type: "number" },
    { key: "normalAttackFactor", type: "number" },
    { key: "otherFactor", type: "number" },
    { key: "side", type: "text" },
  ],
  cooldownDelta: [
    { key: "target", type: "text" },
    { key: "scope", type: "text" },
    { key: "delta", type: "text" },
  ],
  teleport: [{ key: "target", type: "text" }, { key: "anchor", type: "text" }],
  overrideValidation: [{ key: "reason", type: "text" }],

  // These four carry their payload in a nested `changes` array, a `selector`
  // or a `choose` object -- structure, not scalars. Typing `target` alone and
  // leaving the rest to the JSON editor is honest; inventing flat fields for
  // them would offer a form that cannot express what the phase does.
  resource: [{ key: "target", type: "text" }],
  statChange: [{ key: "target", type: "text" }],
  removeEffect: [{ key: "target", type: "text" }],
  cooldown: [{ key: "target", type: "text" }],

  // Its payload lives on `rules`, which gets its own editor below.
  applyEffects: [],
});

export class AbilityEditor extends HandlebarsApplicationMixin(ApplicationV2) {
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
      save: AbilityEditor.#onSave,
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

  /** @param {object} item */
  constructor(item) {
    super();
    this.#item = item;
    this.#draft = foundry.utils.deepClone(item.system ?? {});
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
        img: this.#item.img,
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

      elementKeys: handledKeys().sort(),
      effects: EffectRegistry.all().map((d) => ({ id: d.id, name: d.name })),

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
    const known = Object.hasOwn(PHASE_FIELDS, phase.kind);

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
      kindChoices: {
        ...Object.fromEntries(Object.keys(PHASE_FIELDS).sort().map((k) => [k, k])),
        ...(known || !phase.kind ? {} : { [phase.kind]: `${phase.kind} (unrecognised)` }),
      },

      fields: (PHASE_FIELDS[phase.kind] ?? []).map((field) => ({
        ...field,
        label: `FGT.Editor.Field.${field.key}`,
        value: phase[field.key] ?? "",
      })),

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
  static async #onChange(_event, _form, formData) {
    const raw = { ...formData.object };

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
