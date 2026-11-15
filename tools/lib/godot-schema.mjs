/**
 * @file The field schema the Godot port's content loader checks every document against (grail-tact-godot, Ch. 12):
 * every `system` field path per document type, read off this system's real DataModels after `installSystem()`.
 *
 * A path is dotted; an array or set element is `[]`, so `rules[].key`. Each entry is
 * `{kind, nullable, choices?, initial?, open?}` where `kind` is int, float, string, bool, array, set, object or any.
 * An object whose keys are free (an ObjectField, a TypedObjectField) is `open`: the loader checks it no deeper.
 */

/**
 * @param {Record<string, Record<string, Function>>} models from `installSystem()`, by document name then type
 * @returns {Record<string, Record<string, object>>} `"Actor.servant"` → path → entry
 */
export function godotSchema(models) {
  const F = globalThis.foundry.data.fields;
  const out = {};
  for (const [documentName, byType] of Object.entries(models)) {
    for (const [type, model] of Object.entries(byType)) {
      if (typeof model?.defineSchema !== "function") continue;
      const paths = {};
      walkFields(model.defineSchema(), "", paths, F);
      out[`${documentName}.${type}`] = paths;
    }
  }
  return out;
}

function walkFields(fields, prefix, paths, F) {
  for (const [key, field] of Object.entries(fields)) walk(field, prefix ? `${prefix}.${key}` : key, paths, F);
}

function jsonSafe(v) {
  if (v === undefined || typeof v === "function") return undefined;
  try {
    const s = JSON.stringify(v instanceof Set ? [...v] : v);
    return s === undefined ? undefined : JSON.parse(s);
  } catch {
    return undefined;
  }
}

function walk(field, path, paths, F) {
  const entry = { nullable: Boolean(field.nullable) };
  const initial = jsonSafe(field.initial);
  if (initial !== undefined) entry.initial = initial;
  if (field.choices && typeof field.choices === "object") {
    entry.choices = (Array.isArray(field.choices) ? field.choices : Object.keys(field.choices)).map(String).sort();
  }
  if (F.EmbeddedDataField && field instanceof F.EmbeddedDataField) {
    paths[path] = { ...entry, kind: "object" };
    walkFields(field.fields ?? field.model?.defineSchema?.() ?? {}, path, paths, F);
  } else if (field instanceof F.SchemaField) {
    paths[path] = { ...entry, kind: "object" };
    walkFields(field.fields, path, paths, F);
  } else if (F.SetField && field instanceof F.SetField) {
    paths[path] = { ...entry, kind: "set" };
    walk(field.element, `${path}[]`, paths, F);
  } else if (field instanceof F.ArrayField) {
    paths[path] = { ...entry, kind: "array" };
    walk(field.element, `${path}[]`, paths, F);
  } else if (F.TypedObjectField && field instanceof F.TypedObjectField) {
    paths[path] = { ...entry, kind: "object", open: true };
  } else if (field instanceof F.ObjectField) {
    paths[path] = { ...entry, kind: "object", open: true };
  } else if (field instanceof F.NumberField) {
    paths[path] = { ...entry, kind: field.integer ? "int" : "float" };
  } else if (field instanceof F.BooleanField) {
    paths[path] = { ...entry, kind: "bool" };
  } else if (field instanceof F.StringField) {
    paths[path] = { ...entry, kind: "string" };
  } else {
    paths[path] = { ...entry, kind: "any", field: field.constructor?.name ?? "?" };
  }
}
