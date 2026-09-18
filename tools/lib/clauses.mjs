/**
 * @file Read a Character Sheet into the Clause list an audit issue needs.
 * @see docs/46-roster-re-audit.md
 *
 * The audit programme's mechanical bulk is transcription: roughly six to nine
 * hundred Clauses across twenty-six Servants, each needing one task-list line
 * grouped under its Ability. This does that part.
 *
 * It is deliberately **not** a general Markdown parser. The corpus in
 * `char_orig_sheets/` is one author's house format, regular in the middle and
 * ragged at the edges, and the edges are where a rule hides. So the grammar
 * below covers what is regular and everything else is reported — never dropped.
 * A Clause the extractor lost and nobody noticed is the same defect as a Clause
 * an auditor skipped, which is the defect shape the whole programme exists to
 * find.
 *
 * **What is mechanical and what is not.** Refs derived from a numbered item
 * (`ME.1`), a timing marker (`NM.p`, `NM.a`) or a cooldown (`MS.cd`) are
 * mechanical and stable. The ref for a rule stated on an Ability's *opening*
 * line — Asterios' Mad Enhancement lockout, his Labyrinth's geometry — is not:
 * those were named `ME.lock` and `CL.geom` by a human reading them. They are
 * emitted as `.pre` and listed under `unnamed` so the auditor renames them
 * while filling the issue. Mapping `ME.pre → ME.lock` and `CL.pre → CL.geom`
 * turns this tool's Asterios output into the list issue #41 was audited
 * against, Clause for Clause.
 *
 * **A ref is assembled once, from three parts**: the group tag on a sheet that
 * describes more than one Unit, the Ability's abbreviation, and the suffix. It
 * is assembled at the moment the Clause is made rather than patched afterwards,
 * because every warning quotes a ref and a warning that names a ref which does
 * not appear in the output sends the auditor looking for nothing.
 */

/** Timing markers, as the corpus spells them. Anything else in leading parens is an owner. */
const MARKERS = Object.freeze({
  Active: "a",
  Passive: "p",
  "Non-damaging": "nd",
  Activation: "act",
  Trigger: "trig",
});

/** `(Passive 2\)` and `(Passive/Activation)` both occur; the escape before `)` is the corpus'. */
const MARKER_LINE = /^\(([A-Za-z][A-Za-z/-]*(?:\s+\d+)?(?:\/[A-Za-z][A-Za-z-]*)*)\\?\)\s*(.*)$/;

/** `(Owner) Name — Rank: X`, the Ability header. The owner is who the Ability belongs to. */
const ABILITY_LINE = /^\(([^)]+?)\\?\)\s+(.+)$/;

/** An owner-less header. One sheet states `Class Skill: Magic Resistance — Rank: C` bare. */
const BARE_ABILITY_LINE = /^(Class Skill:\s+.+—\s*Rank:.+)$/;

/**
 * `(Territory Creation — Rank: EX)` — a rank variant *within* an Ability.
 *
 * The capture forbids a `)` so that it cannot swallow a whole Ability header
 * that happens to end in a parenthesised token. Proto Gil states
 * `(ProtoGil) Class Skill: Magic Resistance — Rank: C (E)`, and a greedy
 * version of this pattern matched it from the first paren to the last —
 * filing five Clauses of a Class Skill under the Ability above it, under that
 * Ability's name, with no warning. That is the silent omission this file
 * claims never to commit.
 */
const VARIANT_LINE = /^\(([^)]*—\s*Rank:[^)]*?)\\?\)$/;

/** `**Castor**` — a section, which is a Unit on a sheet that carries more than one. */
const SECTION_LINE = /^\*\*(.+?)\*\*$/;

/** `7\. ` — the corpus escapes the period so Markdown does not renumber. */
const NUMBERED_LINE = /^(\d+)\\?\.\s*(.*)$/;

/**
 * The footer every sheet ends on. It closes the last Ability — without it, the
 * line lands inside that Ability as an unnamed rule and the sheet reports a
 * warning it did not earn. Both word orders occur: twenty-seven sheets say
 * *Items held*, Karna and Hundred-Faced Hassan say *Held Items*. Pale Rider's
 * carries a real rule after the colon (his Master picks up what he cannot
 * hold), so the text is kept when there is any.
 */
const FOOTER_LINE = /^(?:items?\s*held|held\s*items?)[^:]*:\s*(.*)$/i;

/** Boilerplate that states timing and no rule. Stripped before asking whether a line says anything. */
const BOILERPLATE = [
  /^Used during (?:your|its|his|her|their) Turn\.\s*/i,
  /\bHas the following effects(?:[^-]*)-\s*$/i,
];

/** Lowercase connectives are not initials: "Avyssos of Labrys" abbreviates to AL, not AoL. */
const STOPWORDS = new Set(["of", "the", "a", "an", "and", "in", "on", "to", "for", "de"]);

/**
 * The letters an Ability, or a Unit, is referred to by. Everything before a
 * colon, initialled.
 *
 * "Chaos Labyrinthos: Eternally Unchanging Labyrinth" is `CL` because an audit
 * refers to it fifty times and the subtitle earns none of them.
 *
 * @param {string} name
 * @returns {string}
 */
export function abbreviate(name) {
  const head = String(name).split(":")[0];
  const words = head.split(/[\s・·]+/).filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  const letters = words
    .map((w) => w.replace(/[^\p{L}]/gu, "").charAt(0).toUpperCase())
    .filter(Boolean)
    .join("");
  // A one-word Ability would abbreviate to one letter, and a single letter
  // collides with everything: Pale Rider alone has Contagion and Cannibalism.
  // Two letters of the one word is what a person writing notes would use.
  if (letters.length < 2) {
    const word = (words[0] ?? "").replace(/[^\p{L}]/gu, "");
    return word ? word.slice(0, 2).toUpperCase() : "X";
  }
  return letters;
}

/**
 * The suffix a timing marker contributes to a ref: `Passive 2` → `p2`.
 *
 * @param {string} marker
 * @returns {string}
 */
function markerSuffix(marker) {
  return marker
    .split("/")
    .map((part) => {
      const m = /^(.+?)(?:\s+(\d+))?$/.exec(part.trim());
      const base = MARKERS[m?.[1] ?? ""] ?? (m?.[1] ?? "").toLowerCase().slice(0, 3);
      return `${base}${m?.[2] ?? ""}`;
    })
    .join("-");
}

/** @param {string} marker @returns {boolean} */
function isMarker(marker) {
  return marker
    .split("/")
    .every((part) => Object.hasOwn(MARKERS, /^(.+?)(?:\s+\d+)?$/.exec(part.trim())?.[1] ?? part));
}

/**
 * Whether an Ability's opening line states a rule of its own, beyond naming when it is used.
 *
 * Asterios' Avyssos of Labrys opens *"Used during your Turn. Has the following
 * effects-"* and states nothing; his Mad Enhancement opens with the lockout, which
 * is a Clause. The difference is exactly this test, and it is why his issue has a
 * `ME.lock` and no `AL.pre`.
 *
 * @param {string} text
 * @returns {string} the rule, or `""` when the line is timing only
 */
function ruleBeyondTiming(text) {
  let rest = text.trim();
  for (const pattern of BOILERPLATE) rest = rest.replace(pattern, "").trim();
  return rest.replace(/^[.,;\s]+/, "").trim();
}

/**
 * Split a `Cooldown: …` off a Clause. The corpus states it three ways — on its
 * own line for Avyssos of Labrys, welded to the end of the Clause for Monstrous
 * Strength, and parenthesised mid-sentence for Quetzalcoatl's shared-cooldown
 * rule — and an audit records it as its own Clause in all three, because a
 * cooldown that reads wrong is its own finding.
 *
 * The end of the cooldown is the part that matters. Taking it to the end of the
 * line swallows whatever the sentence went on to say: Quetzalcoatl's *"(Cooldown:
 * 2◈ Turns), when one is used the other 2 cannot be used…"* lost two exclusivity
 * rules behind a ref an auditor reads as *check the number*. So a parenthesised
 * cooldown ends at its own closing paren and the remainder stays in the Clause,
 * and a trailing one ends at a following `Note:`.
 *
 * @param {string} text
 * @returns {{claim: string, cooldown: string|null}}
 */
function splitCooldown(text) {
  const found = /(?:^|[\s(])Cooldown:/.exec(text);
  if (!found) return { claim: text.trim(), cooldown: null };

  const start = text.indexOf("Cooldown:", found.index);
  const parenthesised = text[start - 1] === "(";
  let end = text.length;
  if (parenthesised) {
    const close = text.indexOf(")", start);
    if (close !== -1) end = close;
  } else {
    const note = /\s(?=Note:)/.exec(text.slice(start));
    if (note) end = start + note.index;
  }

  const cooldown = text.slice(start, end).trim().replace(/[\s,;]+$/, "");
  const before = text.slice(0, parenthesised ? start - 1 : start).replace(/\s+$/, "");
  const after = text.slice(parenthesised && end < text.length ? end + 1 : end).trim();
  const claim = (after ? `${before}${after.startsWith(",") || after.startsWith(";") ? "" : " "}${after}` : before)
    .replace(/[\s.,;]+$/, "")
    .replace(/^[\s.,;]+/, "")
    .trim();
  return { claim, cooldown };
}

/** Statblock fields worth carrying, in the order a sheet prints them. */
const STAT_FIELDS = ["True Name", "Region", "Alignment", "STR", "END", "AGI", "MAG", "LUC", "Attributes", "Base Health", "MOV", "Range", "Base Attack (STR)", "Base Attack (MAG)", "Sustainability"];

/** `Health: XXX/XXX` and friends are blanks for a player to fill, not statblock. */
const STAT_PLACEHOLDER = /^[X\s/\\-]*$/;

/**
 * The statblock of a section's preamble, as `field → value`.
 *
 * @param {string[]} lines
 * @returns {Map<string, string>}
 */
function readStatblock(lines) {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const line of lines) {
    const m = /^([^:]+):\s*(.+)$/.exec(line);
    if (!m) continue;
    const field = m[1].trim();
    const value = m[2].trim();
    if (!STAT_FIELDS.includes(field) || STAT_PLACEHOLDER.test(value)) continue;
    out.set(field, value);
  }
  return out;
}

/**
 * The statblock rendered as the one Clause an audit checks it as.
 *
 * @param {Map<string, string>} stats
 * @returns {string}
 */
function statblockClaim(stats) {
  /** @type {string[]} */
  const parts = [];
  if (stats.has("True Name")) parts.push("True Name");
  if (stats.has("Region")) parts.push(`Region (${stats.get("Region")})`);
  if (stats.has("Alignment")) parts.push("Alignment");
  for (const p of ["STR", "END", "AGI", "MAG", "LUC"]) if (stats.has(p)) parts.push(`${p} ${stats.get(p)}`);
  if (stats.has("Attributes")) parts.push(`Attributes (${stats.get("Attributes").split(",").length})`);
  if (stats.has("Base Health")) parts.push(`Base Health ${stats.get("Base Health")}`);
  if (stats.has("MOV")) parts.push(`MOV ${stats.get("MOV")}`);
  const range = /(\d+)\s*panels?,\s*(\d+)\s*targets?/.exec(stats.get("Range") ?? "");
  if (range) parts.push(`Range ${range[1]}/${range[2]}`);
  if (stats.has("Base Attack (STR)")) parts.push(`BA(STR) ${stats.get("Base Attack (STR)")}`);
  if (stats.has("Base Attack (MAG)")) parts.push(`BA(MAG) ${stats.get("Base Attack (MAG)")}`);
  const sus = /^(\S+)/.exec(stats.get("Sustainability") ?? "");
  if (sus) parts.push(`Sustainability ${sus[1]}`);
  return parts.join(", ");
}

/**
 * Parse an Ability header's remainder into name, Rank and kind.
 *
 * @param {string} rest
 * @returns {{name: string, rank: string|null, isClassSkill: boolean, isNP: boolean, tag: string|null}}
 */
function parseAbilityHead(rest) {
  let text = rest.trim();
  let tag = null;
  const tagMatch = /\\\[(.+?)\\\]\s*$/.exec(text);
  if (tagMatch) {
    tag = tagMatch[1];
    text = text.slice(0, tagMatch.index).trim();
  }
  const isNP = /\(NP\)\s*$/.test(text);
  if (isNP) text = text.replace(/\(NP\)\s*$/, "").trim();
  let rank = null;
  const rankMatch = /\s*—\s*Rank:\s*(.+?)\s*$/.exec(text);
  if (rankMatch) {
    rank = rankMatch[1];
    text = text.slice(0, rankMatch.index).trim();
  }
  const isClassSkill = /^Class Skill:\s*/i.test(text);
  return { name: text.replace(/^Class Skill:\s*/i, "").trim(), rank, isClassSkill, isNP, tag };
}

/**
 * @typedef {object} Clause
 * @property {string} ref         `ME.1`, `NM.p`, `CA.TGDC.p1` — what the audit record calls it
 * @property {string} suffix      the ref's last part, before the Unit and Ability that scope it
 * @property {string} claim       what the Character Sheet says, trimmed of timing boilerplate
 * @property {string|null} marker the timing marker it was stated under, if any
 * @property {string|null} variant the rank variant it belongs to, if the Ability has any
 * @property {boolean} unnamed    true when a human should give the ref a better name
 * @property {number} line        1-based line in the Character Sheet
 */

/**
 * @typedef {object} Ability
 * @property {string} owner
 * @property {string} name
 * @property {string|null} rank
 * @property {boolean} isClassSkill
 * @property {boolean} isNP
 * @property {string|null} tag
 * @property {string} abbr
 * @property {string[]} markers
 * @property {Clause[]} clauses
 * @property {number} line
 */

/**
 * Every Clause a Character Sheet states, grouped by Ability and by the Unit
 * that owns it.
 *
 * A sheet describing more than one Unit — the linked pair, a Servant with
 * summons — yields one group per `**Name**` section, and every ref on such a
 * sheet is prefixed with its group, because otherwise Ozymandias emits four
 * Clauses called `SB` and a finding citing one of them names four Units.
 *
 * A section with no statblock is not a Unit. On the linked pair's sheet it is
 * the pair itself, and its Clauses belong to the relationship rather than to
 * either Servant: the maximum separation, either's defeat killing both, the
 * shared cooldown. So is an Ability whose owner is the sheet itself, like the
 * Dioscuri's joint Noble Phantasm, which is stated inside one twin's section
 * and belongs to neither.
 *
 * @param {string} markdown
 * @returns {{title: string, groups: Array<{name: string, tag: string|null, shared: boolean, statblock: Map<string,string>|null, statClaim: string|null, statClause: Clause|null, abilities: Ability[], notes: Clause[]}>, warnings: Array<{line: number, text: string, why: string}>}}
 */
export function parseCharacterSheet(markdown) {
  const lines = String(markdown).split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  /** @type {Array<{line: number, text: string, why: string}>} */
  const warnings = [];
  /** @type {any[]} */
  const groups = [];
  let title = "";

  // Whether refs need a Unit prefix is decided before parsing, so that every
  // ref and every warning quoting one agree from the first line onward.
  const multi = lines.filter((l) => SECTION_LINE.test(l.trim())).length > 1;

  /** @type {any} */
  let group = null;
  /** @type {Ability|null} */
  let ability = null;
  /** @type {Array<{kind: string, marker?: string, n?: number, text: string, line: number}>} */
  let tokens = [];

  const closeAbility = () => {
    if (ability) resolveClauses(ability, tokens, warnings);
    ability = null;
    tokens = [];
  };

  const startGroup = (name) => {
    closeAbility();
    group = {
      name,
      tag: multi ? abbreviate(name) : null,
      shared: false,
      statblock: null,
      statClaim: null,
      statClause: null,
      abilities: [],
      notes: [],
      preamble: [],
      taken: new Map(),
    };
    groups.push(group);
  };

  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    const text = raw.trim();
    if (!text) continue;

    const section = SECTION_LINE.exec(text);
    if (section) {
      if (!title) title = section[1].trim();
      startGroup(section[1].trim());
      continue;
    }
    if (!group) startGroup(title || "Sheet");

    const footer = FOOTER_LINE.exec(text);
    if (footer) {
      closeAbility();
      if (footer[1].trim()) {
        group.notes.push(note(group, "items", footer[1].trim(), line));
      }
      continue;
    }

    // The Ability header is tested first: a variant line carries nothing after
    // its closing paren, so it cannot be mistaken for one, while the reverse
    // mistake loses a whole Ability.
    const bare = BARE_ABILITY_LINE.exec(text);
    const head = bare ? [null, group.name, bare[1]] : ABILITY_LINE.exec(text);
    if (head && !isMarker(head[1])) {
      const owner = head[1].trim();
      const parsed = parseAbilityHead(head[2]);
      if (!parsed.name) {
        warnings.push({ line, text, why: "looks like an Ability header but states no name" });
        continue;
      }
      closeAbility();
      const target = groupFor(groups, owner, group, title, multi);
      ability = { owner, ...parsed, abbr: uniqueAbbr(target, parsed.name), markers: [], clauses: [], line };
      ability.prefix = [target.tag, ability.abbr].filter(Boolean).join(".");
      target.abilities.push(ability);
      continue;
    }

    const variantHead = VARIANT_LINE.exec(text);
    if (variantHead && ability) {
      tokens.push({ kind: "variant", text: variantHead[1].trim(), line });
      continue;
    }

    const marker = MARKER_LINE.exec(text);
    if (marker && isMarker(marker[1])) {
      if (!ability) {
        warnings.push({ line, text, why: "timing marker outside any Ability" });
        continue;
      }
      tokens.push({ kind: "marker", marker: marker[1].trim(), text: marker[2], line });
      continue;
    }

    const numbered = NUMBERED_LINE.exec(text);
    if (numbered && ability) {
      tokens.push({ kind: "numbered", n: Number(numbered[1]), text: numbered[2], line });
      continue;
    }

    if (!ability) {
      group.preamble.push(text);
      continue;
    }
    tokens.push({ kind: "prose", text, line });
  }
  closeAbility();

  for (const g of groups) {
    const stats = readStatblock(g.preamble);
    if (stats.size >= 3) {
      g.statblock = stats;
      g.statClaim = statblockClaim(stats);
      g.statClause = {
        ref: [g.tag, "SB"].filter(Boolean).join("."),
        suffix: "SB",
        claim: g.statClaim,
        marker: null,
        variant: null,
        unnamed: false,
        line: 0,
      };
      continue;
    }
    g.shared = true;
    g.notes.push(...g.preamble.map((text, i) => note(g, `s${i + 1}`, text, 0)));
    if (g.preamble.length) {
      warnings.push({
        line: 0,
        text: `${g.preamble.length} shared Clause(s)`,
        why: `${g.name} states Clauses belonging to no single Servant — they need their own audit issue, blocking each twin's`,
      });
    }
  }

  const kept = groups
    .filter((g) => g.abilities.length > 0 || g.notes.length > 0 || g.statClause)
    .map(({ preamble: _preamble, taken: _taken, ...g }) => g);

  // Whatever collides after the Ability abbreviations have been made unique is
  // a genuine clash inside one Ability — two cooldowns, two passives with the
  // same number — and there is no mechanical answer to it. Say so: a ref is how
  // a finding cites a Clause, and an auditor would tick one box and believe both.
  for (const group of kept) {
    /** @type {Map<string, string>} */
    const seen = new Map();
    /** @type {Array<[Clause, string]>} */
    const owned = [
      ...(group.statClause ? [[group.statClause, "the statblock"]] : []),
      ...group.notes.map((n) => [n, group.name]),
      ...group.abilities.flatMap((a) => a.clauses.map((c) => [c, a.name])),
    ];
    for (const [clause, owner] of owned) {
      const first = seen.get(clause.ref);
      if (first) {
        warnings.push({
          line: clause.line,
          text: clause.claim,
          why: `ref ${clause.ref} is already used by ${first} — ${owner} states two, and one needs renaming`,
        });
      } else {
        seen.set(clause.ref, owner);
      }
    }
  }

  return { title, groups: kept, warnings };
}

/**
 * A Clause that belongs to a group rather than to an Ability.
 *
 * @param {any} group
 * @param {string} suffix
 * @param {string} claim
 * @param {number} line
 * @returns {Clause}
 */
function note(group, suffix, claim, line) {
  return {
    ref: `${group.tag ?? abbreviate(group.name)}.${suffix}`,
    suffix,
    claim,
    marker: null,
    variant: null,
    unnamed: true,
    line,
  };
}

/**
 * An Ability abbreviation that no earlier Ability in the same group holds.
 *
 * Two Abilities on one Servant can legitimately abbreviate the same way —
 * Semiramis carries a Double Summon and a Double Summon: Caster — so the second
 * is numbered. This happens when the Ability is created rather than afterwards,
 * so that the refs quoted in warnings are the refs that get emitted.
 *
 * @param {any} group
 * @param {string} name
 * @returns {string}
 */
function uniqueAbbr(group, name) {
  const base = abbreviate(name);
  const n = (group.taken.get(base) ?? 0) + 1;
  group.taken.set(base, n);
  return n > 1 ? `${base}${n}` : base;
}

/**
 * Which group an Ability belongs to. Normally its own section; but an Ability
 * whose owner is the *sheet* rather than a section belongs to neither Servant
 * and gets a shared group of its own.
 *
 * @param {any[]} groups
 * @param {string} owner
 * @param {any} current
 * @param {string} title
 * @param {boolean} multi
 * @returns {any}
 */
function groupFor(groups, owner, current, title, multi) {
  const named = groups.find((g) => g.name === owner);
  if (named) return named;
  if (owner === title && groups.length > 1) {
    const made = {
      name: title,
      tag: multi ? abbreviate(title) : null,
      shared: true,
      statblock: null,
      statClaim: null,
      statClause: null,
      abilities: [],
      notes: [],
      preamble: [],
      taken: new Map(),
    };
    groups.push(made);
    return made;
  }
  return current;
}

/**
 * Turn an Ability's raw lines into Clauses.
 *
 * The one judgement here is what to do with a prose line carrying no marker and
 * no number. Between two numbered Clauses it continues the first — Asterios'
 * escape ladder is stated in two paragraphs and audited as one Clause, `CL.5`.
 * Anywhere else it is a rule of its own that the format gave no handle to, so it
 * becomes a Clause and is flagged: the corpus states several that way, and
 * dropping them would be the failure this tool exists to avoid.
 *
 * @param {Ability} ability
 * @param {Array<{kind: string, marker?: string, n?: number, text: string, line: number}>} tokens
 * @param {Array<{line: number, text: string, why: string}>} warnings
 */
function resolveClauses(ability, tokens, warnings) {
  const markers = tokens.filter((t) => t.kind === "marker");
  const numbers = tokens.filter((t) => t.kind === "numbered");
  ability.markers = markers.map((m) => m.marker ?? "");

  /** The rank variant currently in force; `null` until the Ability states one. */
  let variant = null;
  /** How many variants have been seen, so two variants' `p1` do not collide. */
  let variantIndex = 0;
  let notes = 0;
  /**
   * An Ability may state two numbered lists, and the second restarts at 1.
   * Pale Rider's Contagion numbers what triggers it 1–2 and what it then does
   * 1–3, so a naive ref gives two Clauses called `CO.1`. The second run is
   * lettered — `CO.b1` — because which list a Clause came from is the
   * difference between a trigger and an effect. A restart at a *variant*
   * boundary is already scoped by the variant, so it does not count.
   */
  let run = 0;
  let lastNumber = 0;

  /**
   * @param {string} suffix
   * @param {string} claim
   * @param {number} line
   * @param {{marker?: string, unnamed?: boolean}} [extra]
   */
  const push = (suffix, claim, line, extra = {}) => {
    const { cooldown, claim: body } = splitCooldown(claim);
    const scope = variant ? `v${variantIndex}.` : "";
    if (body) {
      ability.clauses.push({
        ref: `${ability.prefix}.${scope}${suffix}`,
        suffix: `${scope}${suffix}`,
        claim: body,
        marker: extra.marker ?? null,
        variant,
        unnamed: extra.unnamed ?? false,
        line,
      });
    }
    if (cooldown) {
      ability.clauses.push({
        ref: `${ability.prefix}.${scope}cd`,
        suffix: `${scope}cd`,
        claim: cooldown,
        marker: null,
        variant,
        unnamed: false,
        line,
      });
    }
  };

  for (const [idx, token] of tokens.entries()) {
    if (token.kind === "variant") {
      variant = token.text;
      variantIndex += 1;
      run = 0;
      lastNumber = 0;
      continue;
    }

    if (token.kind === "marker") {
      const marker = token.marker ?? "";
      const rule = ruleBeyondTiming(token.text);
      if (!rule) continue;
      // A sole marker with no numbered Clauses under it *is* the Ability's Clause.
      // A marker that introduces a numbered list states a preamble rule instead,
      // and a preamble rule is the one kind of ref a human has to name.
      const sole = markers.length === 1 && numbers.length === 0;
      const preamble = markers.length === 1 && numbers.length > 0;
      const suffix = sole ? "1" : preamble ? "pre" : markerSuffix(marker);
      push(suffix, rule, token.line, { marker, unnamed: preamble });
      if (preamble) {
        warnings.push({
          line: token.line,
          text: rule,
          why: `${ability.name} opens with a rule of its own — emitted as ${ability.prefix}.pre, give it a name`,
        });
      }
      continue;
    }

    if (token.kind === "numbered") {
      const n = token.n ?? 0;
      if (n <= lastNumber) {
        run += 1;
        warnings.push({
          line: token.line,
          text: token.text,
          why: `${ability.name} restarts its numbering at ${n} — this list is lettered ${ability.prefix}.${String.fromCharCode(97 + run)}N`,
        });
      }
      lastNumber = n;
      push(`${run ? String.fromCharCode(97 + run) : ""}${n}`, token.text, token.line);
      continue;
    }

    // Prose with no number and no marker. Between two numbered Clauses it
    // continues the first — Asterios' escape ladder is stated in two paragraphs
    // and audited as one Clause. Anywhere else it is a rule the format gave no
    // handle to, so it becomes a Clause and says so.
    // A line that *is* a Cooldown is never a continuation, whatever sits around
    // it. Yan Qing states his Espionage cooldown on its own line and then opens
    // a rank variant that restarts the numbering, so the continuation test saw
    // numbered Clauses on both sides and welded the Cooldown onto clause 2 —
    // which left the Ability with no Cooldown Clause at all.
    if (/^\(?Cooldown:/i.test(token.text)) {
      push("cd", token.text.replace(/^\(|\)$/g, ""), token.line);
      continue;
    }
    const continues = tokens[idx - 1]?.kind === "numbered" && tokens.slice(idx + 1).some((t) => t.kind === "numbered");
    const last = ability.clauses.at(-1);
    if (continues && last) {
      last.claim = `${last.claim} ${token.text}`.trim();
      continue;
    }
    notes += 1;
    const { claim, cooldown } = splitCooldown(token.text);
    const scope = variant ? `v${variantIndex}.` : "";
    ability.clauses.push({
      ref: `${ability.prefix}.${scope}n${notes}`,
      suffix: `${scope}n${notes}`,
      claim,
      marker: null,
      variant,
      unnamed: true,
      line: token.line,
    });
    // An Ability stated entirely as prose — Heracles' Nine Lives — still owes
    // its Cooldown a Clause of its own, the same as one stated in numbered form.
    if (cooldown) {
      ability.clauses.push({
        ref: `${ability.prefix}.${scope}cd`,
        suffix: `${scope}cd`,
        claim: cooldown,
        marker: null,
        variant,
        unnamed: false,
        line: token.line,
      });
    }
    warnings.push({
      line: token.line,
      text: token.text,
      why: `a rule under ${ability.name} carrying neither a number nor a marker — emitted as ${ability.prefix}.${scope}n${notes}, give it a name`,
    });
  }
}

/**
 * The Clause list as the tracker issue wants it: a task list, one line per
 * Clause, grouped under its Ability, every Clause starting at `Untouched`.
 *
 * Not a table. Task-list items are the only construct the tracker's progress
 * counter reads, and that counter has to count the same thing the closing bar
 * measures.
 *
 * @param {ReturnType<typeof parseCharacterSheet>} sheet
 * @returns {string}
 */
export function renderClauseList(sheet) {
  /** @type {string[]} */
  const out = [];
  for (const group of sheet.groups) {
    if (sheet.groups.length > 1) out.push(`# ${group.name}${group.shared ? " — shared Clauses" : ""}`, "");
    if (group.statClause) {
      out.push("## Statblock", "", line(group.statClause), "");
    }
    for (const n of group.notes) out.push(line(n));
    if (group.notes.length) out.push("");
    for (const ability of group.abilities) {
      const bits = [ability.isClassSkill ? "Class Skill" : null, ability.rank ? `Rank ${ability.rank}` : null, ability.isNP ? "NP" : null].filter(Boolean);
      const timing = ability.markers.length ? ` *(${ability.markers.join(" + ")}${ability.markers.length > 1 ? " — two records" : ""})*` : "";
      out.push(`## ${ability.name}${bits.length ? ` — ${bits.join(", ")}` : ""}${timing}`, "");
      for (const clause of ability.clauses) out.push(line(clause));
      out.push("");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** @param {Clause} clause @returns {string} */
function line(clause) {
  return `- [ ] **${clause.ref}** · ${clause.claim} · *Untouched*`;
}

/**
 * Every Clause in a parsed sheet, flattened. The count an audit is measured against.
 *
 * @param {ReturnType<typeof parseCharacterSheet>} sheet
 * @returns {Clause[]}
 */
export function allClauses(sheet) {
  return sheet.groups.flatMap((g) => [
    ...(g.statClause ? [g.statClause] : []),
    ...g.notes,
    ...g.abilities.flatMap((a) => a.clauses),
  ]);
}
