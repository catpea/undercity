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
//
// Cache server (optional — inventory-cache on localhost:5000)
// ─────────────────────────────────────────────────────────────
// When the cache server is running, any set() call whose value is a file entry
// object with a blob:// url is automatically uploaded.  The blob URL is
// replaced with a stable http://localhost:5000/... URL in a second, silent
// write once the upload completes.  No changes are needed in calling code.
//
// This makes file values survive page navigation and cross-process access
// (e.g. the task-queue processor can fetch them directly from the cache).
//
// Subscribers see two notifications per file upload:
//   1. Immediately — the original blob URL (for instant in-page preview).
//   2. After upload — the stable http:// URL (for persistence + server use).
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

// ── Inventory-cache integration ───────────────────────────────────────────────
// Probe once at module load.  By the time the user picks a file the probe is
// almost certainly already settled, so uploads start with no extra latency.

const _CACHE_BASE = 'http://localhost:5000';

// Promise<boolean> — true if the cache server is reachable and healthy.
const _cacheReady = fetch(`${_CACHE_BASE}/health`, {
  signal: AbortSignal.timeout(1500),
}).then(r => r.json()).then(j => j?.ok === true).catch(() => false);

// Stable session ID — same for all keys in this browser session.
// Stored in sessionStorage so it survives soft refreshes but not tab close.
function _sessionId() {
  const SK = `undercity2_cache_sid_${PROJ_ID}`;
  let id = sessionStorage.getItem(SK);
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(SK, id); }
  return id;
}

// Return true when a value looks like a file-picker entry with a live blob URL.
function _isBlobEntry(v) {
  return v !== null && typeof v === 'object' &&
         typeof v.url === 'string' && v.url.startsWith('blob:');
}

// Upload blob URL to the cache server, then silently update the inventory key
// with the returned stable http:// URL.
// `_setRaw` is the private writer (injected to avoid a circular reference).
async function _uploadToCache(key, entry, _setRaw) {
  const ready = await _cacheReady;
  if (!ready) return;
  try {
    // fetch() can read blob URLs created in the same browsing context.
    const blobRes = await fetch(entry.url);
    const blob    = await blobRes.blob();
    const sid     = _sessionId();
    const res     = await fetch(`${_CACHE_BASE}/v1/${sid}/${key}`, {
      method:  'PUT',
      headers: {
        'Content-Type': entry.type || blob.type || 'application/octet-stream',
        'X-File-Name':  encodeURIComponent(entry.name || key),
      },
      body: blob,
    });
    if (!res.ok) return;
    const { url: cacheUrl } = await res.json();
    // Replace the blob URL with the stable cache URL.
    // Use _setRaw to skip the upload check so we don't loop.
    _setRaw(key, { ...entry, url: cacheUrl });
  } catch {
    // Cache server unavailable, blob expired, or upload failed — leave as-is.
  }
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

  // Private synchronous writer — used by the public API and by _uploadToCache.
  // Does NOT trigger another cache upload so there is no loop.
  function _setRaw(key, value) {
    _data[key] = value;
    _save();
    _sig(key).value = value;
    _bump();
  }

  return {
    // ── Core read/write ────────────────────────────────────────────────────────
    get(key)        { return key ? _data[key] : { ..._data }; },
    set(key, value) {
      _setRaw(key, value);
      // If this is a file entry with a blob URL, upload to the cache server in
      // the background.  When done, _setRaw() replaces the blob URL silently.
      if (_isBlobEntry(value)) _uploadToCache(key, value, _setRaw);
    },
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

    // ── Cache server ───────────────────────────────────────────────────────────
    /** Promise<boolean> — resolves true if the cache server is reachable. */
    get cacheReady() { return _cacheReady; },

    /** The session ID used to namespace all uploads for this browser session. */
    get sessionId() { return _sessionId(); },
  };
})();

// Expose to the browser debug console so you can type Inventory.dump() in DevTools.
globalThis.Inventory = Inventory;
