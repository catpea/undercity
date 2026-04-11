export class Concern extends Scope {

  #name;
  #parent;
  constructor(name, parent) {
    super();
    this.#name = name;
    this.#parent = parent;
  }

  #signals = new Map(); // name → Signal
  signal(name, signal) {
    if (signal) this.#signals.set(name, signal);
    return this.#signals.get(name);
  }

  #concerns = new Map(); // name → Concern
  concern(name) {
    if (!this.#concerns.has(name)) this.#concerns.set(name, new Concern(name, this));
    return this.#concerns.get(name);
  }

  // Descend into child concerns by path: 'inventory/display' or '/inventory/display' (from root)
  lookup(path) {
    const parts = path.replace(/^\//, '').split('/');
    let current = path.startsWith('/') ? this.root : this;
    for (const part of parts) current = current.concern(part);
    return current;
  }

  get root() {
    let current = this;
    while (current.#parent) current = current.#parent;
    return current;
  }
  get parent() { return this.#parent || this; }

  subscribe(name, fn) {
    this.collect(this.signal(name).subscribe(fn));
  }

  // Bind a signal to an <input> element: element changes update the signal,
  // and the listener is automatically removed when this concern is disposed.
  bind(signal, element) {
    const handler = () => { signal.value = element.value; };
    element.addEventListener('input', handler);
    this.collect(() => element.removeEventListener('input', handler));
  }

}

// const a = new Concern(); // root concern
// const b = a.concern(); // child concern
// this.#key = b.signal('key', new Signal());
// b.subscribe('key', v=>console.log(v));

/// Can be used alone, but is also base for signal
export class Scope {
  #destructibles = [];
  #children = new Map(); // name → Scope

  collect(...input) {
    input.flat(Infinity).forEach((destructible) => this.#destructibles.push(destructible));
    return this;
  }

  scope(name) {
    if (!this.#children.has(name)) this.#children.set(name, new Scope());
    return this.#children.get(name);
  }

  /**
   * Dispose all children (depth-first), then local resources (LIFO).
   * After disposal the scope is empty and can be reused.
   */
  dispose() {
    for (const child of this.#children.values()) child.dispose();
    // Don't clear children Map — named children remain accessible for reuse.
    // (Their resources are empty after dispose; adding to them works again.)

    for (let i = this.#destructibles.length - 1; i >= 0; i--) {
      const r = this.#destructibles[i];
      try {
        if (typeof r === 'function') r();
        else r?.dispose?.() ?? r?.[Symbol.dispose]?.();
      } catch (err) {
        console.error('[Scope] dispose error:', err);
      }
    }
    this.#destructibles.length = 0;
  }
}

export class Signal extends Scope {

  #value;
  #subscribers;


  constructor(value) {
    super();
    this.#value = value;
    this.#subscribers = new Set();
    this.collect({dispose:()=>this.#subscribers.clear()})
  }

  get value() {
    return this.#value;
  }

  set value(newValue) {

    /// IMPORTANT FEATURE: if value is the same, exit early, dont assign, don notify, don't disturb if you don't need to
    if(Object.is(newValue, this.#value)) return;

    // NULLARY NOT ALLOWED - these values caouse hard erors in UI applicaions
    if (newValue === null) return;
    if (newValue === undefined) return;

    this.#value = newValue;
    this.notify(); // notify all observers
  }

  subscribe(subscriber) {
    if (this.#value != null) subscriber(this.#value); // IMPORTANT FEATURE: instant notification (initialization on subscribe), but don't notify on null/undefined, predicate functions will look simpler, less error prone
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber); // IMPORTANT FEATURE: return unsubscribe function, execute this to stop getting notifications.
  }

  notify() {
    for (const subscriber of this.#subscribers) subscriber(this.#value);
  }


  filter(fn) { return filter(this, fn) }
  map(fn) { return map(this, fn) }

  bufferCount(count) { return bufferCount(this, count) }

  batch(){ return batch(this) }

  combineLatest(...others) {
    const participants = [this, ...others];
    const child = new Signal();
    const updateCombinedValue = () => {
      const values = [...participants.map((signal) => signal.value)];
      const nullish = values.some((value) => value == null);
      if (!nullish) child.value = values;
    };
    const subscriptions = participants.map((signal) => signal.subscribe(updateCombinedValue));
    child.collect(subscriptions);
    this.collect(child);
    return child;
  }

}


// Coalesces rapid assignments: if parent is set multiple times in the same
// synchronous turn, subscribers of the child signal fire only once — after
// the microtask queue drains — with the final value.
export function batch(parent) {
  const child = new Signal();
  let pending = false;
  const subscription = parent.subscribe(() => {
    if (!pending) {
      pending = true;
      queueMicrotask(() => {
        pending = false;
        child.value = parent.value;
      });
    }
  });
  child.collect(subscription);
  parent.collect(child);
  return child;
}


export function filter(parent, test) {
  const child = new Signal();
  const subscription = parent.subscribe((v) => { if (test(v)) { child.value = v; } });
  child.collect(subscription);
  parent.collect(child);
  return child;
}

export function map(parent, map) {
  const child = new Signal();
  const subscription = parent.subscribe((v) => (child.value = map(v)));
  child.collect(subscription);
  parent.collect(child);
  return child;
}






export function bufferCount(parent, count) {
  let counter = 0;
  let value = null;
  const child = new Signal();
  const subscription = parent.subscribe(v => {
    value = v;
    counter++;
    if(counter==count-1) child.value = v;
  });
  child.collect(subscription);
  parent.collect(child);
  return child;
}


/// UTILITY
export function combineLatest(...parents) { // free form
  const child = new Signal();
  const updateCombinedValue = () => {
    const values = [...parents.map((signal) => signal.value)];
    const nullish = values.some((value) => value == null);
    if (!nullish) child.value = values;
  };
  const subscriptions = parents.map((signal) => signal.subscribe(updateCombinedValue));
  child.collect(subscriptions);
  return child;
}
