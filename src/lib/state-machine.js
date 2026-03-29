/**
 * state-machine — JSON-declared hybrid state machine.
 *
 * Each context key in `config.state` becomes a named Signal on the machine,
 * so consumers subscribe directly: `machine.dirty.subscribe(v => ...)`.
 *
 * The event bus (framework Emitter) drives transitions automatically.
 * Calling `machine.emit('save')` fires the bus; the machine reads the current
 * state, finds the next state in `states[current].on.save`, and enters it.
 *
 * `enter` patches can be plain values or functions:
 *   enter: { filename: ({ payload }) => payload ?? '' }
 *
 * Usage:
 *   import { createMachine } from 'state-machine';
 *
 *   const machine = createMachine({
 *     state:   { dirty: false, saving: false },
 *     initial: 'idle',
 *     states: {
 *       idle:   { enter: { dirty: false, saving: false }, on: { edit: 'dirty' } },
 *       dirty:  { enter: { dirty: true },                 on: { save: 'saving' } },
 *       saving: { enter: { saving: true },                on: { 'save-ok': 'idle', 'save-fail': 'dirty' } },
 *     },
 *   });
 *
 *   machine.dirty.subscribe(v => console.log('dirty:', v));
 *   machine.emit('edit');   // dirty → true
 *   machine.emit('save');   // saving → true
 *   machine.emit('save-ok');// dirty → false, saving → false
 */

import { Signal, Emitter } from 'framework';

// ── MapSet ─────────────────────────────────────────────────────────────────────
// Map<key, Set<value>> — useful for multi-listener registries.

export class MapSet {
  #map = new Map();

  add(key, value) {
    let set = this.#map.get(key);
    if (!set) { set = new Set(); this.#map.set(key, set); }
    set.add(value);
    return this;
  }

  delete(key, value) {
    const set = this.#map.get(key);
    if (!set) return false;
    const deleted = set.delete(value);
    if (set.size === 0) this.#map.delete(key);
    return deleted;
  }

  get(key)     { return this.#map.get(key); }
  keys()       { return this.#map.keys(); }
  values()     { return this.#map.values(); }
  entries()    { return this.#map.entries(); }
  has(key)     { return this.#map.has(key); }
  get size()   { return this.#map.size; }
}

// ── createMachine ──────────────────────────────────────────────────────────────

export function createMachine(config) {
  const bus = new Emitter();

  const machine = {
    bus,
    current: new Signal(config.initial),
    signals: {},
    /** Dispatch an event into the machine. payload is optional. */
    emit(event, payload) { bus.emit(event, payload); },
  };

  // Create a named Signal for each context key.
  for (const [key, initialValue] of Object.entries(config.state)) {
    const sig = new Signal(initialValue);
    machine.signals[key] = sig;
    machine[key] = sig;
  }

  function applyPatch(patch = {}, payload) {
    for (const [key, value] of Object.entries(patch)) {
      if (!machine.signals[key]) throw new Error(`state-machine: unknown signal "${key}" in enter patch`);
      machine.signals[key].value = typeof value === 'function'
        ? value({ payload, machine, current: machine.current.value })
        : value;
    }
  }

  function enterState(name, payload) {
    const stateDef = config.states[name];
    if (!stateDef) throw new Error(`state-machine: unknown state "${name}"`);
    machine.current.value = name;
    applyPatch(stateDef.enter ?? {}, payload);
  }

  // Auto-discover all event names and wire them to transitions.
  const events = new Set(
    Object.values(config.states).flatMap(s => Object.keys(s.on ?? {}))
  );
  for (const event of events) {
    bus.on(event, payload => {
      const next = config.states[machine.current.value]?.on?.[event];
      if (next) enterState(next, payload);
    });
  }

  enterState(config.initial);
  return machine;
}
