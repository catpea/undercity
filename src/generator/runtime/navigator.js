// ── Navigator ─────────────────────────────────────────────────────────────────
// The entry node is served as index.html for static-hosting friendliness.
// _pageName() maps the entry node id → 'index', everywhere else uses node id.
import { Inventory } from './inventory.js';
import { History }   from './history.js';
import { ENTRY_ID }  from './config.js';

// Resolve the project root URL from this module's location (js/runtime/navigator.js → root)
const _BASE = new URL('../..', import.meta.url).href.replace(/\/$/, '');
function _pageName(room) { return room === ENTRY_ID ? 'index' : room; }

export const Navigator = {
  goto(room)               { window.location.href = _BASE + '/' + _pageName(room) + '.html'; },
  back()                   { window.history.back(); },
  reset(keepData = false)  { if (!keepData) Inventory.clear(); Navigator.goto(ENTRY_ID); },
  reload()                 { window.location.reload(); },
};
