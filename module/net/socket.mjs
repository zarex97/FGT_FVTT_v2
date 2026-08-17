/**
 * @file The GM proxy socket.
 * @see docs/26-authority-and-sockets.md §26.2
 *
 * Three properties the prototype's version lacked, all of which matter:
 *
 *   1. **Request/response, not fire-and-forget.** A failed effect application
 *      surfaces as a rejected promise instead of a silent no-op.
 *   2. **Timeouts.** A GM whose tab is throttled would otherwise hang the
 *      caller forever.
 *   3. **Typed operations with authorization**, rather than a switch over
 *      free-form payloads.
 *
 * `"socket": true` in system.json is mandatory and requires a world restart to
 * take effect; without it the server never registers the namespace and every
 * emit silently does nothing.
 */

import { OPERATIONS } from "./operations.mjs";

export class FGTError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "FGTError";
    this.code = code;
  }
}

export class FGTSocket {
  static NS = "system.fgt";

  /** @type {Map<string, {resolve: Function, reject: Function, timer: number}>} */
  static #pending = new Map();

  static initialize() {
    game.socket.on(this.NS, this.#onReceive.bind(this));
  }

  /**
   * Ask the GM client to perform an operation.
   *
   * @param {string} op a key of {@link OPERATIONS}
   * @param {object} payload
   * @param {{timeout?: number}} [options]
   * @returns {Promise<unknown>}
   */
  static async request(op, payload, { timeout = 15_000 } = {}) {
    if (!OPERATIONS[op]) throw new FGTError("UNKNOWN_OP", `Unknown operation "${op}".`);
    if (!game.users.activeGM) {
      throw new FGTError("NO_ACTIVE_GM", "No Game Master is connected. This action requires a GM.");
    }

    // We are the GM: execute locally. A client never receives its own broadcast,
    // so routing through the socket here would hang.
    if (game.users.activeGM.isSelf) return this.#execute(op, payload, game.user.id);

    const id = foundry.utils.randomID();
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new FGTError("TIMEOUT", `Operation "${op}" timed out after ${timeout}ms.`));
      }, timeout);
      this.#pending.set(id, { resolve, reject, timer });
    });

    game.socket.emit(this.NS, { kind: "request", id, op, payload, userId: game.user.id });
    return promise;
  }

  /**
   * Ask **one named user** a question, and wait for their answer.
   *
   * `request` routes everything to the active GM, which is right for anything
   * that writes -- but a prompt is the opposite case: the whole point is that a
   * *particular* player answers it. `io.prompt` has emitted
   * `request("prompt", ...)` since intents were written, and `OPERATIONS` has
   * never had a `prompt` key, so every prevention Luck Check threw `UNKNOWN_OP`
   * where a player should have been asked a question.
   *
   * The timeout is long by default: a human is reading it, and the failure mode
   * of a short one is a decision made for a player who was still deciding.
   *
   * @param {string} userId
   * @param {object} spec what to ask; the receiving client renders it
   * @param {{timeout?: number}} [options]
   * @returns {Promise<unknown>} the answer, or null if the user declined
   */
  static async ask(userId, spec, { timeout = 120_000 } = {}) {
    const user = game.users.get(userId);
    if (!user?.active) {
      throw new FGTError("USER_OFFLINE", `${user?.name ?? userId} is not connected.`);
    }

    // Asking ourselves goes straight to the dialog: a client never receives its
    // own broadcast, so a round trip here would hang forever.
    if (user.isSelf) return this.#answer(spec);

    const id = foundry.utils.randomID();
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new FGTError("TIMEOUT", `${user.name} did not answer within ${timeout}ms.`));
      }, timeout);
      this.#pending.set(id, { resolve, reject, timer });
    });

    game.socket.emit(this.NS, { kind: "ask", id, targetUserId: userId, spec, userId: game.user.id });
    return promise;
  }

  /**
   * Broadcast a fire-and-forget event. Used for presentation only — never for
   * anything that changes state.
   * @param {string} event
   * @param {object} payload
   */
  static broadcast(event, payload) {
    game.socket.emit(this.NS, { kind: "event", event, payload, userId: game.user.id });
  }

  /**
   * @param {object} msg
   * @param {string} senderId
   */
  static async #onReceive(msg, senderId) {
    switch (msg?.kind) {
      case "request":
        // Exactly one client handles each request.
        if (!game.users.activeGM?.isSelf) return;
        return this.#handleRequest(msg, senderId);
      case "ask":
        // Exactly one client answers, and it is not the sender.
        if (msg.targetUserId !== game.user.id) return undefined;
        return this.#handleAsk(msg);
      case "response":
        return this.#handleResponse(msg);
      case "event":
        return Hooks.callAll(`fgt.${msg.event}`, msg.payload, msg.userId);
      default:
        return undefined;
    }
  }

  /**
   * @param {object} msg
   */
  static async #handleRequest(msg) {
    let response;
    try {
      const result = await this.#execute(msg.op, msg.payload, msg.userId);
      response = { kind: "response", id: msg.id, ok: true, result };
    } catch (err) {
      console.error(`FGT | Socket operation "${msg.op}" failed`, err);
      response = {
        kind: "response", id: msg.id, ok: false,
        error: { code: err.code ?? "ERROR", message: err.message },
      };
    }
    game.socket.emit(this.NS, response);
  }

  /**
   * @param {string} op
   * @param {object} payload
   * @param {string} userId
   * @returns {Promise<unknown>}
   */
  static async #execute(op, payload, userId) {
    const operation = OPERATIONS[op];
    if (!operation) throw new FGTError("UNKNOWN_OP", `Unknown operation "${op}".`);

    const auth = operation.authorize(payload, userId);
    if (!auth.allowed) throw new FGTError("FORBIDDEN", auth.reason ?? "Not permitted.");

    return operation.execute(payload, userId);
  }

  /**
   * Render a question for this user and send the answer back.
   *
   * A thrown error is reported as a failed answer rather than swallowed: the
   * asker is blocked on this, and a silent failure would hold them until the
   * timeout with nothing on screen to explain it.
   *
   * @param {object} msg
   */
  static async #handleAsk(msg) {
    let response;
    try {
      response = { kind: "response", id: msg.id, ok: true, result: await this.#answer(msg.spec) };
    } catch (err) {
      console.error("FGT | Prompt failed", err);
      response = {
        kind: "response", id: msg.id, ok: false,
        error: { code: err.code ?? "ERROR", message: err.message },
      };
    }
    game.socket.emit(this.NS, response);
  }

  /**
   * Show a prompt and resolve to its answer.
   * @param {object} spec
   * @returns {Promise<unknown>}
   */
  static async #answer(spec) {
    const { renderPrompt } = await import("../apps/prompt.mjs");
    return renderPrompt(spec);
  }

  /**
   * @param {object} msg
   */
  static #handleResponse(msg) {
    const pending = this.#pending.get(msg.id);
    if (!pending) return; // not ours, or already timed out
    clearTimeout(pending.timer);
    this.#pending.delete(msg.id);
    if (msg.ok) pending.resolve(msg.result);
    else pending.reject(new FGTError(msg.error?.code ?? "ERROR", msg.error?.message ?? "Failed."));
  }
}
