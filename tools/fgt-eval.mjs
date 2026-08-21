#!/usr/bin/env node
/**
 * @file Evaluate an expression inside the running Foundry tab.
 *
 * A thin CDP shell: attach to the page already showing `/game`, run what is
 * piped in or passed as an argument, print the result as JSON.
 *
 * Exists because the document-touching layers have no unit tests — they need a
 * live world — and every bug reported from the table so far has been in one of
 * them. This is how they get exercised without clicking through the interface.
 *
 * Usage:
 *   node tools/fgt-eval.mjs "game.actors.size"
 *   echo "await something()" | node tools/fgt-eval.mjs
 *   echo "const a = game.actors.getName('X'); return a.name" | node tools/fgt-eval.mjs
 */

const PORT = process.env.FGT_CDP_PORT ?? 9222;

/** @returns {Promise<string>} the debugger URL of the Foundry page */
async function foundryTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await res.json();
  // The GAME page by preference. A `/setup` tab is also Foundry and is what
  // answers between a shutdown and a relaunch, so it is accepted as a
  // fallback rather than reported as "no Foundry page".
  const foundry = targets.filter((t) => t.type === "page" && String(t.url).includes(":30000"));
  const page = foundry.find((t) => String(t.url).includes("/game")) ?? foundry[0];
  if (!page) throw new Error("No Foundry page found. Is the world open in the debug Chrome?");
  return page.webSocketDebuggerUrl;
}

/**
 * @param {string} expression
 * @returns {Promise<unknown>}
 */
async function evaluate(expression) {
  const ws = new WebSocket(await foundryTarget());
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const result = await new Promise((resolve, reject) => {
    const id = 1;
    const timer = setTimeout(() => reject(new Error("Timed out after 120s.")), 120_000);

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      clearTimeout(timer);
      if (msg.error) return reject(new Error(msg.error.message));
      const r = msg.result?.result;
      if (msg.result?.exceptionDetails) {
        return reject(new Error(r?.description ?? msg.result.exceptionDetails.text));
      }
      resolve(r?.value ?? r?.description ?? null);
    });

    ws.send(JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: {
        // Wrapped so `await` works and the result comes back as data rather
        // than as a RemoteObject handle we would have to walk.
        //
        // Input containing `return` is treated as a BODY rather than as an
        // expression, so a multi-statement script can be piped in. Without it
        // anything with a `;` in it became `JSON.stringify(a; b)`, which is a
        // syntax error rather than a script.
        expression: /(^|[\s{;])return[\s(]/.test(expression)
          ? `(async () => { ${expression} })().then((v) => JSON.stringify(v ?? null))`
          : `(async () => { return JSON.stringify(${expression}); })()`,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
    }));
  });

  ws.close();
  return result;
}

const expression = process.argv[2] ?? await new Promise((resolve) => {
  let buffer = "";
  process.stdin.on("data", (c) => { buffer += c; });
  process.stdin.on("end", () => resolve(buffer.trim()));
});

try {
  const out = await evaluate(expression);
  console.log(typeof out === "string" ? out : JSON.stringify(out));
} catch (err) {
  console.error(`FGT | ${err.message}`);
  process.exit(1);
}
