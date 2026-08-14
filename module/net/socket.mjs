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
