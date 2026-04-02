// ── Things ────────────────────────────────────────────────────────────────────
// Things are objects that inhabit rooms — the MUD/MOO equivalent of objects
// in a location. Each Thing has a name, an internal UUID, and responds to
// room events via its own .on() method with target-matching baked in.
//
// Generated page usage:
//   const Form1 = new FormThing("Form1", "dd006f52");
//   Form1.on("Take", async ({ event, data, room }) => { ... });
//
// matchTarget is imported here so Thing.on() can apply it without the
// generated page needing to spell out the guard manually.
import { Inventory }        from './inventory.js';
import { Actions }          from './actions.js';
import { Bus }              from './bus.js';
import { matchTarget, Room } from './room.js';
import { registerNamespace } from './registry.js';

// ── Things registry ───────────────────────────────────────────────────────────
export const Things = (() => {
  const _reg = new Map();
  return {
    /** Called automatically by the Thing constructor — not needed in page scripts. */
    _register(thing) {
      _reg.set(thing.id, thing);
      // Register under both UUID and human name for runPayload namespace lookup
      registerNamespace(thing.id, thing);
      if (thing.name !== thing.id) registerNamespace(thing.name, thing);
    },
    get(id)  { return _reg.get(id); },
    all()    { return [..._reg.values()]; },
    ids()    { return [..._reg.keys()]; },
    clear()  { _reg.clear(); },
  };
})();

// ── Thing base class ──────────────────────────────────────────────────────────
// All built-in Thing types extend this. Handles registration and the .on()
// DSL so subclasses only need to define their domain behaviour.
class Thing {
  /**
   * @param {string} name  Human-readable name — used for event targeting ("Form1", "Auth").
   * @param {string} [id]  Internal UUID — defaults to name when omitted.
   */
  constructor(name, id = name) {
    this.name = name;
    this.id   = id;
    Things._register(this);
  }

  /**
   * Listen for a room event, automatically applying target-matching so only
   * events directed at this Thing (or broadcast with '*') will fire the handler.
   *
   * DSL:
   *   Form1.on("Take", async ({ event, data, room }) => { ... });
   *
   * @param {string}   eventName
   * @param {Function} handler   async ({ event, data, room }) => void
   * @returns {{ dispose() }}  cleanup handle
   */
  on(eventName, handler) {
    return Room.on(eventName, (payload) => {
      if (!matchTarget(payload.target, this)) return;
      handler(payload);
    });
  }
}

// ── Built-in Thing classes ────────────────────────────────────────────────────

/** FormThing — a form container. Wire Input/Display actions to the Take event;
 *  they render only when an Emit Event is directed at this form. */
export class FormThing extends Thing {
  constructor(name, id = name) {
    super(name, id);
  }
}

/** WorkflowThing — a scriptable service. All behaviour lives in event payloads. */
export class WorkflowThing extends Thing {
  constructor(name, id = name) {
    super(name, id);
  }
}

/** PersonaLiveThing — an AI persona that inhabits the room.
 *  Hears "message" events and replies via any OpenAI-compatible endpoint. */
export class PersonaLiveThing extends Thing {
  constructor(name, id = name, config = {}) {
    super(name, id);
    this.personality = config.personality ?? '';
    this.endpoint    = config.endpoint    ?? 'http://localhost:8191/v1/chat/completions';
    this.model       = config.model       ?? 'local';
    this.replyInto   = config.replyInto   ?? (id + '_reply');
    this._history    = [];
  }

  async reply(userMessage) {
    this._history.push({ role: 'user', content: String(userMessage ?? '') });
    const systemPrompt = this.personality.trim()
      ? this.personality.trim()
      : ('You are ' + this.name + ', a helpful assistant.');
    try {
      const res = await fetch(this.endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:    this.model,
          messages: [{ role: 'system', content: systemPrompt }, ...this._history],
        }),
      });
      const d     = await res.json();
      const reply = d.choices?.[0]?.message?.content ?? '(no response)';
      this._history.push({ role: 'assistant', content: reply });
      if (this.replyInto) Inventory.set(this.replyInto, reply);
      Bus.emit('thing:reply', { id: this.id, name: this.name, text: reply });
      return reply;
    } catch (e) {
      const msg = '[' + this.name + '] ' + e.message;
      Actions.toast(msg, 'danger');
      return msg;
    }
  }

  clearHistory() { this._history = []; }
}

/** AuthServerThing — wraps a real auth API. */
export class AuthServerThing extends Thing {
  constructor(name, id = name, config = {}) {
    super(name, id);
    this.apiUrl    = config.apiUrl    ?? '';
    this.tokenInto = config.tokenInto ?? 'authToken';
  }

  async login(email, password) {
    const res  = await fetch(this.apiUrl + '/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) Inventory.set(this.tokenInto, data.token);
    return data;
  }

  async signup(email, password) {
    const res  = await fetch(this.apiUrl + '/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  }

  async validate() {
    const token = Inventory.get(this.tokenInto);
    if (!token) return false;
    try {
      const res = await fetch(this.apiUrl + '/validate', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.ok;
    } catch { return false; }
  }
}

/** TestAuthServerThing — simulates auth for development. No server needed. */
export class TestAuthServerThing extends Thing {
  constructor(name, id = name, config = {}) {
    super(name, id);
    this.tokenInto     = config.tokenInto     ?? 'authToken';
    this.alwaysSucceed = config.alwaysSucceed !== false;
  }

  async login(email, password) {
    await new Promise(r => setTimeout(r, 300));
    if (this.alwaysSucceed || (email && password)) {
      const token = 'test-token-' + btoa(email).slice(0, 8);
      Inventory.set(this.tokenInto, token);
      return { ok: true, token };
    }
    return { ok: false, error: 'Invalid credentials' };
  }

  async signup(email, password) {
    await new Promise(r => setTimeout(r, 200));
    return this.alwaysSucceed ? { ok: true } : { ok: false, error: 'Signup disabled in test mode' };
  }

  async validate() {
    const token = Inventory.get(this.tokenInto);
    return !!(token && this.alwaysSucceed);
  }
}
