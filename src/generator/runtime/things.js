// ── Things ────────────────────────────────────────────────────────────────────
// Registry of Things inhabiting the current room.
// Things are instantiated by the page script from node.things[] definitions.
// Each registered Thing also becomes a named namespace: things.get('auth').login(...)
import { Inventory } from './inventory.js';
import { Actions }   from './actions.js';
import { Bus }       from './bus.js';
import { registerNamespace } from './registry.js';

export const Things = (() => {
  const _reg = new Map();
  return {
    register(id, obj) {
      _reg.set(id, obj);
      registerNamespace(id, obj);
    },
    get(id)  { return _reg.get(id); },
    all()    { return [..._reg.values()]; },
    ids()    { return [..._reg.keys()]; },
    clear()  { _reg.clear(); },
  };
})();

// ── Built-in Thing classes ─────────────────────────────────────────────────────

/** FormThing — a form container. Its 'take' event workflow runs when an Emit Event targets it.
 *  Input and Display actions placed in the Take event render only on demand. */
class FormThing {
  constructor(id, config) {
    this.id     = id;
    this.config = config ?? {};
    this.name   = this.config.name ?? id;
  }
}

/** WorkflowThing — a scriptable service. All behaviour is defined in event workflows.
 *  The class itself is a thin wrapper; the real logic lives in the event payload arrays. */
class WorkflowThing {
  constructor(id, config) {
    this.id     = id;
    this.config = config ?? {};
    this.name   = this.config.name ?? id;
  }
}

/** PersonaLiveThing — an AI persona that inhabits the room.
 *  Hears "message" room events and replies via any OpenAI-compatible endpoint.
 *  Works with localhost:8191 (no external server needed). */
class PersonaLiveThing {
  constructor(id, config) {
    this.id          = id;
    this.config      = config ?? {};
    this.name        = this.config.name        ?? 'Persona';
    this.personality = this.config.personality ?? '';
    this.endpoint    = this.config.endpoint    ?? 'http://localhost:8191/v1/chat/completions';
    this.model       = this.config.model       ?? 'local';
    this.replyInto   = this.config.replyInto   ?? (id + '_reply');
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
class AuthServerThing {
  constructor(id, config) {
    this.id        = id;
    this.config    = config ?? {};
    this.apiUrl    = this.config.apiUrl    ?? '';
    this.tokenInto = this.config.tokenInto ?? 'authToken';
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
class TestAuthServerThing {
  constructor(id, config) {
    this.id            = id;
    this.config        = config ?? {};
    this.tokenInto     = this.config.tokenInto     ?? 'authToken';
    this.alwaysSucceed = this.config.alwaysSucceed !== false;
  }

  async login(email, password) {
    await new Promise(r => setTimeout(r, 300)); // simulate latency
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

// ── Thing registry (maps type name → class) ────────────────────────────────────
const _THING_REGISTRY = {
  FormThing,
  WorkflowThing,
  PersonaLiveThing,
  AuthServerThing,
  TestAuthServerThing,
};

/** Factory: instantiate a Thing by type name. */
export function createThing(type, id, config) {
  const Cls = _THING_REGISTRY[type];
  if (!Cls) { console.warn('[Things] Unknown type:', type); return null; }
  return new Cls(id, config ?? {});
}
