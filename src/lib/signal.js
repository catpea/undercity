/**
 * signal.js — Reactive primitives
 *
 * Signal     — reactive value cell. subscribe(fn, autorun=true) fires fn immediately
 *              by default, then on every change. autorun=false defers first fire.
 *              Static helpers: combineLatest(), derive(), from(). Instance: map().
 * Emitter    — typed event emitter.
 * Disposable — single cleanup handle.
 * CompositeDisposable — group of disposables, disposed in reverse order.
 * Repeater   — keyed list renderer (reconciles add/remove/reorder without clearing).
 * on()       — DOM addEventListener returning a Disposable.
 */

export class Signal {
  #value;
  #subs = new Set();
  #collected = [];

  constructor(init) { this.#value = init; }

  get value() { return this.#value; }
  set value(v) {
    if (v === this.#value) return;
    this.#value = v;
    for (const fn of [...this.#subs]) fn(v);
  }

  /** Subscribe to changes. autorun=true fires fn immediately with current value. */
  subscribe(fn, autorun = true) {
    this.#subs.add(fn);
    if (autorun) fn(this.#value);
    return new Disposable(() => this.#subs.delete(fn));
  }

  /** Re-fire all subscribers with the current value (used after in-place mutations). */
  notify() {
    for (const fn of [...this.#subs]) fn(this.#value);
  }

  peek() { return this.#value; }

  /** Attach a cleanup function that runs when this signal is disposed. */
  collect(fn) { this.#collected.push(fn); }

  /** Run all collected cleanup functions and clear the list. */
  dispose() {
    const fns = this.#collected.splice(0);
    for (const fn of fns) fn();
  }

  /**
   * Combine multiple signals into one Signal whose value is an array of
   * the current values of all inputs. Fires whenever any input changes.
   * The returned signal has a dispose() that cleans up all subscriptions.
   */
  static combineLatest(signals) {
    const out = new Signal(signals.map(s => s.value));
    const subs = signals.map((s, i) => s.subscribe(v => {
      const next = out.value.slice();
      next[i] = v;
      out.value = next;
    }, false));
    out.collect(() => subs.forEach(sub => sub.dispose()));
    return out;
  }

  /** Create a derived Signal that updates when source changes. Disposable via .dispose(). */
  static derive(source, transform) {
    const derived = new Signal(transform(source.value));
    const sub = source.subscribe(v => { derived.value = transform(v); }, false);
    derived.collect(() => sub.dispose());
    return derived;
  }

  /** Wrap a Promise as a Signal. Starts at `initial`, resolves to the value when ready. */
  static from(promise, initial = null) {
    const sig = new Signal(initial);
    Promise.resolve(promise).then(v => { sig.value = v; }).catch(() => {});
    return sig;
  }

  /** Shorthand for Signal.derive(this, fn). */
  map(fn) { return Signal.derive(this, fn); }
}

export class Emitter {
  #map = new Map();

  on(event, fn) {
    let set = this.#map.get(event);
    if (!set) { set = new Set(); this.#map.set(event, set); }
    set.add(fn);
    return new Disposable(() => set.delete(fn));
  }

  emit(event, data) {
    for (const fn of this.#map.get(event) ?? []) fn(data);
  }
}

export class Disposable {
  #fn; #done = false;
  constructor(fn) { this.#fn = fn; }
  dispose() { if (this.#done) return; this.#done = true; this.#fn(); }
}

export class CompositeDisposable {
  #items = []; #done = false;
  add(...items) { this.#items.push(...items); return this; }
  dispose() {
    if (this.#done) return; this.#done = true;
    for (const d of [...this.#items].reverse()) d.dispose();
  }
}

/**
 * Keyed list renderer — reconciles add/remove/reorder without clearing the container.
 * Implements dispose() so it can be passed directly to a Scope:
 *   scope.add(new Repeater(container, signal, render))
 */
export class Repeater {
  #container; #render; #key; #nodes = new Map();
  #sub;

  constructor(container, signal, render, { key = 'id' } = {}) {
    this.#container = container;
    this.#render    = render;
    this.#key       = typeof key === 'function' ? key : item => item[key];
    this.#sub       = signal.subscribe(items => this.#update(items));
  }

  dispose() {
    this.#sub.dispose();
    this.#nodes.clear();
  }

  #update(items) {
    const incoming = new Map(items.map(item => [this.#key(item), item]));
    for (const [k, node] of this.#nodes) {
      if (!incoming.has(k)) { node.remove(); this.#nodes.delete(k); }
    }
    for (const item of items) {
      const k = this.#key(item);
      let node = this.#nodes.get(k);
      if (!node) { node = this.#render(item); this.#nodes.set(k, node); }
      this.#container.appendChild(node);
    }
  }
}

export class DisposableEventBinder {
  #domListener;
  /**
   * @param {HTMLElement} element - the element to bind to
   * @param {String} event - the event to minitor
   * @param {Function} domListener - the listener to execute
   * @param {Object} [options]
   *   options.html = true → bind to innerHTML
   *   options.autorun = true (default) → initialize with current value
   */
  constructor(element, event, domListener, options = {}) {
    this.element = element;
    this.event = event;
    this.#domListener = domListener;
    this.options = Object.assign({ html: false, autorun: true }, options);
    this.isDisposed = false;

    this.element.addEventListener(this.event, this.#domListener);
  }

  dispose() {
    if (this.isDisposed) {
      console.warn("Binder already disposed.");
      return;
    }
    this.element.removeEventListener(this.event, this.#domListener);

    this.isDisposed = true;
  }
}


/** DOM addEventListener returning a Disposable. */
export function on(target, type, handler, opts) {
  target.addEventListener(type, handler, opts);
  return new Disposable(() => target.removeEventListener(type, handler, opts));
}
