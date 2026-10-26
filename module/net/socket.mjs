/**
 * @file The GM proxy socket.
 * @see docs/38-authority.md
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

  /**
   * Which War this client is in, and which GM runs a War. Handed in by
   * `fgt.mjs` from `engine/war.mjs`, because `net/` sits below the engine
   * (`tools/check-layers.mjs`). The defaults are a world of one War: no War,
   * and the active GM for it.
   */
  static #router = { warFor: () => null, gmFor: () => game.users.activeGM, ruleFor: () => null };

  /**
   * @param {{warFor: () => object|null, gmFor: (war: object|null) => object|null,
   *   ruleFor?: (key: string, war: object|null) => unknown}} router
   */
  static setRouter(router) {
    this.#router = { ruleFor: () => null, ...router };
  }

  /**
   * How long a request waits for the GM's reply in this War.
   *
   * Sixty seconds of work, plus room for the people the GM is waiting on. A
   * request can hold the GM on a person: an advance after a reaction runs on to
   * the next rung, and `engine/attack.mjs#awaitInterrupt` holds that rung open
   * for `commandSpellTimeout` while a Master may interrupt, as the declaration
   * window does. At fifteen-second windows that fit in the old flat minute. A
   * War set to three minutes did not: a player pressed Do nothing and got
   * "No reply from the Gamemaster" while the GM was still holding the next rung
   * (found live, 2026-10-25). Four of the War's longest window covers a rung's
   * reaction, interrupt and Command Spell holds and a declaration window.
   *
   * @param {object|null} war
   * @returns {number} milliseconds
   */
  static replyBudgetMs(war) {
    const windows = ["reactionTimeout", "interruptTimeout", "commandSpellTimeout"]
      .map((key) => Number(this.#router.ruleFor(key, war)))
      .filter((s) => Number.isFinite(s) && s > 0);
    return 60_000 + 4 * Math.max(0, ...windows) * 1000;
  }

  static initialize() {
    game.socket.on(this.NS, this.#onReceive.bind(this));
  }

  /**
   * Ask the GM client to perform an operation.
   *
   * **This timeout is a TRANSPORT wait, not a player's clock.** It measures how
   * long this client waits for the GM's client to run the operation and reply.
   * A human's thinking time is Ch. 23's `AwaitPolicy` — `reactionTimeout` (60s)
   * and `interruptTimeout` (45s), both GM settings — and `ask` below, which
   * waits two minutes because a person is reading it.
   *
   * Sixty seconds, raised from fifteen. The old value was chosen for a
   * request-reply round trip and the work at the other end has since grown
   * teeth: declaring an area attack fans out to one Process per defender, each
   * with a card, a reaction offer, events and several document writes. Fifteen
   * seconds was not enough for a seven-target Noble Phantasm, observed in a
   * live game. The minute is now the floor of {@link FGTSocket.replyBudgetMs},
   * which adds the War's own windows.
   *
   * @param {string} op a key of {@link OPERATIONS}
   * @param {object} payload
   * @param {{timeout?: number|null}} [options] `null` reads the War's reply budget
   * @returns {Promise<unknown>}
   */
  static async request(op, payload, { timeout = null } = {}) {
    if (!OPERATIONS[op]) throw new FGTError("UNKNOWN_OP", `Unknown operation "${op}".`);
    if (!game.users.activeGM) {
      throw new FGTError("NO_ACTIVE_GM", "No Game Master is connected. This action requires a GM.");
    }

    // To the GM running THIS client's War: the one looking at its scene
    // (`engine/war.mjs#gmForWar`, via `setRouter`). Each War of several played at once is run
    // by its own GM client (ruled 2026-10-18, Q14 (B)), because the engine
    // reads the board off that client's canvas. A War no GM is looking at is
    // refused out loud: run on another GM it would resolve on another board.
    const war = this.#router.warFor();
    timeout ??= this.replyBudgetMs(war);
    const gm = this.#router.gmFor(war);
    if (!gm) throw new FGTError("NO_WAR_GM", game.i18n.localize("FGT.WarRules.NoGM"));

    // We are that GM: execute locally. A client never receives its own
    // broadcast, so routing through the socket here would hang.
    if (gm.isSelf) return this.#execute(op, payload, game.user.id);

    const id = foundry.utils.randomID();
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        // Deliberately NOT phrased as a failure. Giving up on the reply does
        // not cancel the GM's work -- there is no cancellation in this
        // protocol -- so a timed-out operation has very often SUCCEEDED, and
        // one was observed doing exactly that: the caller reported a timeout
        // while the GM finished the whole ladder. Telling a player their
        // action failed invites a retry, and a retry on a completed operation
        // applies it twice.
        reject(new FGTError(
          "TIMEOUT",
          `No reply from the Gamemaster for "${op}" within ${Math.round(timeout / 1000)}s. `
          + "It may still have gone through -- check the chat log before trying again.",
        ));
      }, timeout);
      this.#pending.set(id, { resolve, reject, timer });
    });

    game.socket.emit(this.NS, {
      kind: "request", id, op, payload, userId: game.user.id, targetUserId: gm.id, warId: war?.id ?? null,
    });
    return promise;
  }

  /**
   * Ask **one named user** a question, and wait for their answer.
   *
   * `request` routes everything to the active GM, which is right for anything
   * that writes -- but a prompt is the opposite case: the whole point is that a
   * *particular* player answers it.
   *
   * `io.prompt` emitted `request("prompt", ...)` before `OPERATIONS` had a
   * `prompt` key, and every prevention Luck Check threw `UNKNOWN_OP` where a
   * player should have been asked a question. **That was fixed**: `OPERATIONS
   * .prompt` (`net/operations.mjs`) runs on the GM and forwards here, so the
   * route is request-to-GM, then GM-asks-the-player. This paragraph said
   * otherwise in the present tense for long enough to mislead a review into
   * re-fixing it -- a stale comment about a defect is itself a defect, and a
   * more expensive one than the silence it replaced.
   *
   * One live constraint the fix carries: `OPERATIONS.prompt.authorize` refuses
   * a non-GM requester, so a prompt intent applied on a PLAYER's client is
   * refused rather than forwarded. That path is currently unreachable -- a
   * player's attack is proxied whole to the GM (`OPERATIONS.resolveAttack`),
   * and prevention only fires on a debuff to a Unit the player does not own,
   * which `planApplication` routes remote. It stops being unreachable the day
   * something emits a prompt for a Unit its own client may write.
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
        // Exactly one client handles each request: the GM it was sent to, or
        // the active GM for a request from before requests named one.
        if (msg.targetUserId ? msg.targetUserId !== game.user.id : !game.users.activeGM?.isSelf) return;
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
      // The War it was sent for must still be the War this GM is looking at:
      // a GM who switched scenes since would resolve it on the other board.
      if (msg.warId && this.#router.warFor()?.id !== msg.warId) {
        throw new FGTError("NO_WAR_GM", game.i18n.localize("FGT.WarRules.NoGM"));
      }
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
