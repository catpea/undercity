// ── Inventory ─────────────────────────────────────────────────────────────────
// Each key has its own Signal. set() writes synchronously AND pushes to all
// subscribers of that key. No bus events needed — subscribe directly.
//
// Key APIs:
//   Inventory.set(key, value)       — write + push to all subscribers
//   Inventory.get(key)              — synchronous snapshot read
//   Inventory.signal(key)           — get/create a live Signal for a key
//   Inventory.subscribe(key, fn)    — fn(value) fires now + on every change
//   Inventory.signals               — Map<key, Signal> of all active signals
import { INVENTORY_DEFAULTS, PROJ_ID } from './config.js';

// ── Signal ─────────────────────────────────────────────────────────────────────
// Minimal reactive value cell. subscribe(fn) fires fn immediately with the
// current value, then on every change. Returns { dispose() } for cleanup.
class _Signal {
  #v; #subs = new Set();
  constructor(init) { this.#v = init; }
  get value()  { return this.#v; }
  set value(v) {
    if (Object.is(v, this.#v)) return;
    this.#v = v;
    for (const fn of [...this.#subs]) fn(v);
  }
  subscribe(fn, autorun = true) {
    this.#subs.add(fn);
    if (autorun) fn(this.#v);
    return { dispose: () => this.#subs.delete(fn) };
  }
  peek() { return this.#v; }
}

export const Inventory = (() => {
  const DEFAULTS = INVENTORY_DEFAULTS;
  const KEY = `undercity2_inv_${PROJ_ID}`;
  let _data = { ...DEFAULTS };
  const _sigs = new Map();           // Map<key, _Signal>
  let   _rev  = 0;                   // monotonic write counter
  const _revSig = new _Signal(0);    // fires on every write to any key
  const _bump = () => { _revSig.value = ++_rev; };

  function _sig(key) {
    if (!_sigs.has(key)) _sigs.set(key, new _Signal(_data[key] ?? null));
    return _sigs.get(key);
  }
  function _load() {
    try { _data = { ...DEFAULTS, ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') }; } catch {}
  }
  function _save() { sessionStorage.setItem(KEY, JSON.stringify(_data)); }
  _load();

  return {
    // ── Core read/write ────────────────────────────────────────────────────────
    get(key)        { return key ? _data[key] : { ..._data }; },
    set(key, value) { _data[key] = value; _save(); _sig(key).value = value; _bump(); },
    merge(obj)      { Object.assign(_data, obj); _save(); for (const [k, v] of Object.entries(obj)) _sig(k).value = v; _bump(); },
    delete(key)     { delete _data[key]; _save(); _sig(key).value = undefined; _bump(); },
    clear()         { _data = { ...DEFAULTS }; _save(); for (const [, s] of _sigs) s.value = null; _bump(); },

    // ── Push API (signals) ─────────────────────────────────────────────────────
    /** Get (or create) the live Signal for a key. */
    signal(key) { return _sig(key); },

    /**
     * Subscribe to a specific inventory key.
     * fn(value) fires immediately with the current value, then on every change.
     * Returns { dispose() } — call dispose() to stop receiving updates.
     */
    subscribe(key, fn) { return _sig(key).subscribe(fn); },

    /** Map of all currently active Signals. */
    get signals() { return new Map(_sigs); },

    /**
     * Subscribe to ALL inventory changes (any key).
     * fn({ ...data }) fires immediately with the full snapshot, then on every write.
     * Returns { dispose() } — call dispose() to stop receiving updates.
     */
    subscribeAll(fn) {
      return _revSig.subscribe(() => fn({ ..._data }));
    },

    // ── Utilities ──────────────────────────────────────────────────────────────
    check(expr)  { try { const inventory = _data; return !!eval(expr); } catch { return false; } },
    dump()       { return JSON.parse(JSON.stringify(_data)); },
  };
})();

// Expose to the browser debug console so you can type Inventory.dump() in DevTools.
globalThis.Inventory = Inventory;
