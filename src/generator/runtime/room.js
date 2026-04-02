// ── Room ──────────────────────────────────────────────────────────────────────
// Room.emit() broadcasts a named event to Things in the current room.
// Room.showNav() renders Bootstrap navigation buttons for connected rooms.
import { User }                    from './user.js';
import { Bus }                     from './bus.js';
import { Navigator }               from './navigator.js';
import { _pwContainer }            from './page-helpers.js';

// ── Target matching ───────────────────────────────────────────────────────────
// Glob-style wildcard matching for "Emit Event" at-targeting.
// Patterns: '*' = all, 'Form*' = any id starting with Form, 'Form1' = exact.
// matchTarget(pattern, ...ids)
//   pattern  — the "at" value from Emit Event ('*', 'Form5', 'Form*', null)
//   ...ids   — one or more identifiers to test (name, uuid, alias, …)
// Returns true when the pattern matches ANY of the provided ids, or when the
// pattern is null / '*' (broadcast).  A single call handles every case — no
// need for null-guards in the calling code.
//   matchTarget('*',      'Form5')           → true   (broadcast)
//   matchTarget(null,     'Form5')           → true   (broadcast)
//   matchTarget('Form5',  'Form5')           → true   (exact)
//   matchTarget('Form*',  'Form5')           → true   (wildcard prefix)
//   matchTarget('Form5',  'f29d0dca', 'Form5') → true (name wins)
//   matchTarget('xyz',    'f29d0dca', 'Form5') → false
export function matchTarget(pattern, ...ids) {
  if (pattern == null || pattern === '*') return true;
  const test = id => {
    if (!pattern.includes('*')) return pattern === id;
    const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return re.test(String(id));
  };
  return ids.some(test);
}

export const Room = {
  // target: glob pattern for which Things should respond ('*' = all, default).
  // Argument order matches the IDE action param order { event, at, data } so
  // runPayload's Object.values() passes them correctly without reordering.
  emit(eventName, target = '*', data) {
    const room = User.location;
    Bus.emit('room:' + room + ':' + eventName, { event: eventName, data: data, room: room, target: target });
  },
  on(eventName, handler) {
    const room = User.location;
    return Bus.on('room:' + room + ':' + eventName, handler);
  },

  /**
   * Render Bootstrap navigation items for every room connected from this one.
   * Reads window._PW_NAV (injected by the page generator) — an array of
   * { id, label, call } entries, one per outgoing edge.
   *
   * @param {string}  variant  Bootstrap button variant (default 'primary')
   * @param {boolean} full     Full-width buttons (default true — ignored in navbar mode)
   */
  showNav(variant = 'primary', full = true) {
    const nav = window._PW_NAV ?? [];
    if (!nav.length) return;

    // Prefer injecting into the navbar list
    const navList = document.getElementById('pw-nav-list');
    if (navList) {
      navList.innerHTML = '';
      for (const entry of nav) {
        const li  = document.createElement('li');
        li.className = 'nav-item';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `nav-link btn btn-link text-${variant === 'primary' ? 'info' : variant} fw-semibold px-3`;
        btn.textContent = entry.label;
        btn.addEventListener('click', () => {
          if (typeof entry.call === 'function') entry.call();
          else Navigator.goto(entry.id);
        });
        li.appendChild(btn);
        navList.appendChild(li);
      }
      return;
    }

    // Fallback: card below the content area
    const root = _pwContainer();
    let card = root.querySelector('#pw-nav-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'pw-nav-card';
      card.className = 'card mt-3';
      const body = document.createElement('div');
      body.className = 'card-body d-flex flex-column gap-2';
      card.appendChild(body);
      root.appendChild(card);
    }
    const body = card.querySelector('.card-body') ?? card;
    body.innerHTML = '';
    const btnClass = `btn btn-${variant} fw-semibold${full ? ' w-100' : ''}`;
    for (const entry of nav) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = btnClass;
      btn.textContent = entry.label;
      btn.addEventListener('click', () => {
        if (typeof entry.call === 'function') entry.call();
        else Navigator.goto(entry.id);
      });
      body.appendChild(btn);
    }
  },
};
