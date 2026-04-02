// ── Breadcrumb / Room History ─────────────────────────────────────────────────
// Tracks which rooms the user has visited, in order.
// Stored in sessionStorage so it persists across same-tab navigation.
import { PROJ_ID } from './config.js';

export const History = (() => {
  const KEY = `undercity_hist_${PROJ_ID}`;
  function _load() { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); } catch { return []; } }
  function _save(h) { sessionStorage.setItem(KEY, JSON.stringify(h)); }
  return {
    push(roomId) { const h = _load(); if (h[h.length-1] !== roomId) { h.push(roomId); _save(h); } },
    pop()        { const h = _load(); const s = h.pop(); _save(h); return s; },
    peek()       { const h = _load(); return h[h.length-1]; },
    all()        { return _load(); },
    clear()      { _save([]); },
  };
})();
