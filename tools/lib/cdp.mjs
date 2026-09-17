/**
 * @file Run a script inside the running Foundry tab, over the DevTools Protocol.
 *
 * Extracted from `tools/fgt-eval.mjs` when `tools/check-world.mjs` needed the
 * same shell. Two copies of a WebSocket handshake is two places to get the
 * `return`-detection wrong.
 */

const PORT = process.env.FGT_CDP_PORT ?? 9222;

/**
 * The debugger URL of the Foundry page.
 *
 * The `/game` page by preference. A `/setup` tab is also Foundry and is what
 * answers between a shutdown and a relaunch, so it is a fallback rather than
 * "no Foundry page".
 *
 * @returns {Promise<string>}
 */
export async function foundryTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await res.json();
  const foundry = targets.filter((t) => t.type === "page" && String(t.url).includes(":30000"));
  const page = foundry.find((t) => String(t.url).includes("/game")) ?? foundry[0];
  if (!page) throw new Error("No Foundry page found. Is the world open in the debug Chrome?");
  return page.webSocketDebuggerUrl;
}

/**
 * Evaluate an expression or a statement body in the page.
 *
 * Input containing `return` is treated as a BODY rather than an expression, so
 * a multi-statement script can be sent. Without it anything with a `;` became
 * `JSON.stringify(a; b)`, which is a syntax error rather than a script.
 *
 * @param {string} expression
 * @param {{timeout?: number}} [options]
 * @returns {Promise<unknown>} the result, JSON round-tripped
 */
export async function evaluate(expression, { timeout = 120_000 } = {}) {
  const ws = new WebSocket(await foundryTarget());
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const result = await new Promise((resolve, reject) => {
    const id = 1;
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeout / 1000}s.`)), timeout);

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
