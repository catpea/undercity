/**
 * emitter.js — Standalone typed event emitter.
 *
 * Used as the base class for App and other server-side event sources.
 * Mirrors the Emitter in src/lib/signal.js but is self-contained so
 * server-side code does not depend on the full signal module.
 *
 * Usage:
 *   class MyService extends Emitter {}
 *   const svc = new MyService();
 *   const handle = svc.on('data', d => console.log(d));
 *   svc.emit('data', { value: 42 });
 *   handle.dispose();
 */

export class Emitter {
  #map = new Map();

  /** Subscribe to an event. Returns a disposable handle. */
  on(event, fn) {
    let set = this.#map.get(event);
    if (!set) { set = new Set(); this.#map.set(event, set); }
    set.add(fn);
    return { dispose: () => set.delete(fn) };
  }

  /** Subscribe once — the handler is removed after it fires. */
  once(event, fn) {
    const handle = this.on(event, (...args) => { fn(...args); handle.dispose(); });
    return handle;
  }

  /** Unsubscribe a specific handler. */
  off(event, fn) {
    this.#map.get(event)?.delete(fn);
  }

  /** Fire all handlers for an event. */
  emit(event, data) {
    for (const fn of [...(this.#map.get(event) ?? [])]) fn(data);
  }

  /** Remove all handlers for a given event (or all events if omitted). */
  removeAllListeners(event) {
    if (event) this.#map.delete(event);
    else this.#map.clear();
  }
}
