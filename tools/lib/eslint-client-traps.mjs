/**
 * @file An ESLint rule for the two Silent Drops Foundry's client layer hides.
 * @see docs/08-documents-and-derived.md, docs/adr/0006-tests-and-build-run-real-foundry.md
 *
 * The test world runs Foundry's real `common/` classes, but `client/` does not
 * import in Node, so two traps that live there cannot be tested by running
 * them. Both are silent. Paths are relative to `foundryVTT_copy/app/`.
 *
 * 1. **The empty-diff skip.** `update` defaults to `diff: true`
 *    (`common/abstract/backend.mjs:148`); the client diffs the change against its
 *    LOCAL `_source`, and an empty diff is never sent
 *    (`client/data/client-backend.mjs:262`). So `doc.updateSource(x)` — or a
 *    write to `doc._source` — followed by `doc.update(x)` persists nothing. In a
 *    `_preUpdate`/`preUpdate*` hook the same call changes the local copy and
 *    leaves `changes` without it, so the server never hears of it either: mutate
 *    `changes` there instead.
 * 2. **`_preCreate` edits to `data` are ignored.** The server receives
 *    `operation.data`, not the argument (`client-backend.mjs:103,122`); a change
 *    made in `_preCreate`/`preCreate*` must go through `this.updateSource(...)`.
 *
 * 3. **A CONFIG registry replaced wholesale.** `CONFIG.ActiveEffect.dataModels`
 *    ships as `{base: ActiveEffectTypeDataModel}` (`client/config.mjs:2031`) and
 *    `CONFIG.RegionBehavior.dataModels` with twelve built-in behaviours. A system
 *    that assigns its own object drops them, and a core status effect then fails
 *    to create with no error -- the defeat skull never appeared (#96). Spread the
 *    existing object.
 *
 * `tools/check-world.mjs` proves the first two against a live world, so a Foundry
 * upgrade that changes either shows up there. Issue #94.
 */

const WHY = {
  preUpdateSource: "updateSource() in a preUpdate changes the local copy only; `changes` goes to the server without it "
    + "(client/data/client-backend.mjs:262). Mutate `changes` instead. See tools/lib/eslint-client-traps.mjs, #94.",
  preUpdateSourceWrite: "Writing _source in a preUpdate changes the local copy only; `changes` goes to the server without it. "
    + "Mutate `changes` instead. See tools/lib/eslint-client-traps.mjs, #94.",
  preCreateData: "The server receives operation.data, not this argument (client/data/client-backend.mjs:103,122); "
    + "a change here is silently lost. Use this.updateSource(...) / document.updateSource(...). See #94.",
  updateAfterSource: "update() after updateSource() on the same document diffs against the already-changed local copy, "
    + "finds nothing, and sends nothing (client/data/client-backend.mjs:262). See tools/lib/eslint-client-traps.mjs, #94.",
  configReplaced: "Assigning a CONFIG.*.dataModels object drops core's own entries (ActiveEffect's `base`, the built-in "
    + "Region behaviours), and what needed them fails silently. Spread the existing object first. See #96.",
};

/** The kind of Foundry lifecycle function a node is, and which parameter is its `data`. */
function lifecycleOf(fn, parent) {
  if (parent?.type === "MethodDefinition" || parent?.type === "Property") {
    const name = parent.key?.name;
    if (name === "_preUpdate") return { kind: "preUpdate" };
    if (name === "_preCreate") return { kind: "preCreate", data: fn.params[0]?.name };
  }
  if (parent?.type === "CallExpression" && parent.arguments[1] === fn) {
    const callee = parent.callee;
    const isHooksOn = callee?.type === "MemberExpression" && callee.object?.name === "Hooks"
      && ["on", "once"].includes(callee.property?.name);
    const hook = parent.arguments[0]?.value;
    if (isHooksOn && typeof hook === "string") {
      if (hook.startsWith("preUpdate")) return { kind: "preUpdate" };
      if (hook.startsWith("preCreate")) return { kind: "preCreate", data: fn.params[1]?.name };
    }
  }
  return null;
}

/** The identifier a member chain starts at: `a` for `a.b.c`. */
function rootOf(node) {
  let n = node;
  while (n?.type === "MemberExpression") n = n.object;
  return n?.type === "Identifier" ? n.name : null;
}

/** Whether a member chain passes through `_source`. */
const touchesSource = (node) => {
  for (let n = node; n?.type === "MemberExpression"; n = n.object) {
    if (n.property?.name === "_source" || n.object?.property?.name === "_source") return true;
  }
  return false;
};

export default {
  rules: {
    "client-traps": {
      meta: {
        type: "problem",
        docs: { description: "Foundry client-layer writes that are silently lost" },
        schema: [],
      },
      create(context) {
        const source = context.sourceCode ?? context.getSourceCode();
        /** @type {Array<{fn: object, life: object|null, sourced: Set<string>}>} */
        const stack = [];
        const enter = (fn) => stack.push({ fn, life: lifecycleOf(fn, fn.parent), sourced: new Set() });
        const leave = () => stack.pop();
        const top = () => stack.at(-1);
        /** The nearest enclosing lifecycle function, looking through nested arrows. */
        const life = () => [...stack].reverse().find((f) => f.life)?.life ?? null;

        return {
          FunctionDeclaration: enter, "FunctionDeclaration:exit": leave,
          FunctionExpression: enter, "FunctionExpression:exit": leave,
          ArrowFunctionExpression: enter, "ArrowFunctionExpression:exit": leave,

          CallExpression(node) {
            const callee = node.callee;
            if (callee?.type !== "MemberExpression") {
              // setProperty(data, ...) / mergeObject(data, ...) in a preCreate.
              const l = life();
              const name = callee?.name;
              if (l?.kind === "preCreate" && l.data && ["setProperty", "mergeObject"].includes(name)
                && node.arguments[0]?.type === "Identifier" && node.arguments[0].name === l.data) {
                context.report({ node, message: WHY.preCreateData });
              }
              return;
            }
            const method = callee.property?.name;
            const target = source.getText(callee.object);
            const l = life();
            if (method === "updateSource") {
              if (l?.kind === "preUpdate") context.report({ node, message: WHY.preUpdateSource });
              top()?.sourced.add(target);
            }
            if (method === "update" && top()?.sourced.has(target)) {
              context.report({ node, message: WHY.updateAfterSource });
            }
            if (["setProperty", "mergeObject"].includes(method) && l?.kind === "preCreate" && l.data
              && node.arguments[0]?.type === "Identifier" && node.arguments[0].name === l.data) {
              context.report({ node, message: WHY.preCreateData });
            }
          },

          AssignmentExpression(node) {
            // CONFIG.<Doc>.dataModels = { ... } with no spread of what was there.
            const left = node.left;
            if (left.type === "MemberExpression" && left.property?.name === "dataModels"
              && rootOf(left) === "CONFIG" && node.right?.type === "ObjectExpression"
              && !node.right.properties.some((p) => p.type === "SpreadElement")) {
              context.report({ node, message: WHY.configReplaced });
            }
            const l = life();
            if (!l || node.left.type !== "MemberExpression") return;
            if (l.kind === "preUpdate" && touchesSource(node.left)) {
              context.report({ node, message: WHY.preUpdateSourceWrite });
            }
            if (l.kind === "preCreate" && l.data && rootOf(node.left) === l.data) {
              context.report({ node, message: WHY.preCreateData });
            }
          },
        };
      },
    },
  },
};
