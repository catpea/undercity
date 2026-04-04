// inventory-cache/client.js
//
// Browser ES module — talk to the inventory-cache server from the browser.
//
// Import directly from the server (no copying required):
//   import { InventoryCache } from 'http://localhost:5000/client.js';
//
// Quick start
// ───────────
//   const cache = new InventoryCache('http://localhost:5000');
//
//   // Upload a File picked by an <input type="file">
//   const entry = await cache.set('my-session', 'cover', file);
//   // entry → { url, key, mime, name, size, expiresAt }
//   // entry.url is a stable http:// URL — works across page navigation,
//   // in other tabs, and from Node.js (e.g. the task-queue processor).
//
//   // Subscribe to push updates for a session
//   const sub = cache.subscribe('my-session', event => {
//     // event.type: 'set' | 'delete' | 'expire' | 'snapshot' | 'error'
//     if (event.type === 'set') console.log('new entry:', event.key, event.url);
//   });
//   sub.close(); // stop listening
//
// All methods throw on network errors. 404 responses return null (not thrown).

export class InventoryCache {
  #base;

  constructor(baseUrl = 'http://localhost:5000') {
    this.#base = baseUrl.replace(/\/$/, '');
  }

  /**
   * Upload a File or Blob, store it under sessionId/key.
   * Returns { url, key, mime, name, size, expiresAt }.
   *
   * @param {string}      sessionId
   * @param {string}      key
   * @param {File|Blob}   file
   */
  async set(sessionId, key, file) {
    const name = (file instanceof File) ? file.name : key;
    const res  = await fetch(`${this.#base}/v1/${sessionId}/${key}`, {
      method:  'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name':  encodeURIComponent(name),
      },
      body: file,
    });
    if (!res.ok) throw new Error(`InventoryCache.set(${key}) → ${res.status}`);
    return res.json();  // { url, key, mime, name, size, expiresAt }
  }

  /**
   * Fetch a stored file as a Blob.  Returns null if the entry does not exist.
   *
   * @param {string} sessionId
   * @param {string} key
   */
  async get(sessionId, key) {
    const res = await fetch(`${this.#base}/v1/${sessionId}/${key}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`InventoryCache.get(${key}) → ${res.status}`);
    return res.blob();
  }

  /**
   * Return the stable http:// URL for a stored entry without fetching it.
   * Useful when you just need the URL (e.g. to set as img.src or video.src).
   *
   * @param {string} sessionId
   * @param {string} key
   */
  url(sessionId, key) {
    return `${this.#base}/v1/${sessionId}/${key}`;
  }

  /**
   * Remove an entry.  Returns true if deleted, false if it did not exist.
   *
   * @param {string} sessionId
   * @param {string} key
   */
  async delete(sessionId, key) {
    const res = await fetch(`${this.#base}/v1/${sessionId}/${key}`, { method: 'DELETE' });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`InventoryCache.delete(${key}) → ${res.status}`);
    return true;
  }

  /**
   * List all keys stored for a session.
   * Returns { sessionId, count, keys: [{ key, url, mime, name, size, expiresAt }] }.
   *
   * @param {string} sessionId
   */
  async list(sessionId) {
    const res = await fetch(`${this.#base}/v1/${sessionId}`);
    if (!res.ok) throw new Error(`InventoryCache.list(${sessionId}) → ${res.status}`);
    return res.json();
  }

  /**
   * Subscribe to SSE push events for a session.
   *
   * The callback receives one of:
   *   { type: 'snapshot', keys: [{ key, url, mime, name, size }] }
   *   { type: 'set',      key, url, mime, name, size, expiresAt }
   *   { type: 'delete',   key }
   *   { type: 'expire',   key }
   *   { type: 'error' }
   *
   * The 'snapshot' event fires immediately after connection with the current
   * state of the session — ideal for hydrating UI on page load.
   *
   * Returns { close() } — call close() to stop listening.
   *
   * @param {string}   sessionId
   * @param {function} callback
   */
  subscribe(sessionId, callback) {
    const src = new EventSource(`${this.#base}/v1/${sessionId}/events`);

    for (const type of ['set', 'delete', 'expire', 'snapshot']) {
      src.addEventListener(type, ev => {
        try { callback({ type, ...JSON.parse(ev.data) }); }
        catch { /* malformed event — ignore */ }
      });
    }

    src.onerror = () => callback({ type: 'error' });

    return { close: () => src.close() };
  }

  /**
   * Check if the server is reachable.
   * Returns the health object, or null on failure.
   */
  async health() {
    try {
      const res = await fetch(`${this.#base}/health`);
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  }
}
