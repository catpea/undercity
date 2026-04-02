// ── Room ──────────────────────────────────────────────────────────────────────
// The Room is the location the player (User) is currently standing in.
// All Things inhabiting a room communicate through room-scoped events.
import { User }       from './user.js';
import { Bus }        from './bus.js';
import { Navigator }  from './navigator.js';
import { _pwContainer } from './page-helpers.js';

// ── Target matching ───────────────────────────────────────────────────────────
// Glob-style wildcard matching for Emit Event "at" targeting.
//
//   matchTarget(pattern, candidate)
//   matchTarget(pattern, thingObject)   — tests .name and .id
//   matchTarget(pattern, a, b, ...)     — true if any candidate matches
//
//   '*' or null  → always true (broadcast)
//   'Form1'      → exact match
//   'Form*'      → wildcard prefix (any name starting with "Form")
//
export function matchTarget(pattern, ...candidates) {
  if (pattern == null || pattern === '*') return true;

  const testStr = (str) => {
    if (!pattern.includes('*')) return pattern === str;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(str);
  };

  return candidates.some((c) => {
    if (c !== null && typeof c === 'object') {
      return (c.name != null && testStr(String(c.name)))
          || (c.id   != null && testStr(String(c.id)));
    }
    return testStr(String(c));
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Create a Bootstrap nav button that invokes an exit entry's call(). */
function _makeExitButton(entry, className) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = entry.label;
  btn.addEventListener('click', () => entry.call());
  return btn;
}

// ── Room ──────────────────────────────────────────────────────────────────────
export const Room = {
  /**
   * Emit a named event to Things in this room.
   * `target` is a glob pattern: '*' broadcasts to all Things (default),
   * 'Form1' targets exactly one, 'Form*' targets by name prefix.
   *
   * Argument order mirrors the IDE action params { event, at, data } so
   * runPayload's Object.values() mapping is correct.
   */
  emit(eventName, target = '*', data) {
    const room = User.location;
    Bus.emit(`room:${room}:${eventName}`, { event: eventName, data, room, target });
  },

  /** Subscribe to a room-scoped event. Returns a { dispose() } handle. */
  on(eventName, handler) {
    const room = User.location;
    return Bus.on(`room:${room}:${eventName}`, handler);
  },

  /**
   * Declare the exits from this room.
   *
   * Registers each exit so Room.showNav() can render them and so
   * Render.button / Render.link can navigate by calling window.goTo_<id>().
   * The optional onExit callback fires before every navigation.
   *
   *   Room.exits([
   *     { id: "abc123", label: "The Tavern"  },
   *     { id: "def456", label: "The Dungeon" },
   *   ]);
   *
   *   Room.exits([...], async () => { await runPayload(exitSteps); });
   */
  exits(entries, onExit) {
    const navigate = async (id) => {
      if (onExit) await onExit();
      Navigator.goto(id);
    };

    window._PW_NAV = entries.map(({ id, label }) => ({
      id,
      label,
      call: () => navigate(id),
    }));

    for (const { id } of entries) {
      window[`goTo_${id.replace(/[^a-zA-Z0-9]/g, '_')}`] = () => navigate(id);
    }
  },

  /**
   * Render Bootstrap navigation buttons for every exit in this room.
   * Reads window._PW_NAV populated by Room.exits().
   *
   * Injects into #pw-nav-list (navbar) when present;
   * falls back to a card appended below the page content.
   *
   * @param {string}  variant  Bootstrap colour variant (default 'primary')
   * @param {boolean} full     Full-width buttons in the fallback card (default true)
   */
  showNav(variant = 'primary', full = true) {
    const nav = window._PW_NAV ?? [];
    if (!nav.length) return;

    // Always render in the content area — navigation is part of the form flow,
    // not a chrome-level concern. Nav buttons sit below the room's content cards.
    const root = _pwContainer();
    let card   = root.querySelector('#pw-nav-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'pw-nav-card';
      card.className = 'card mt-3';
      const body = document.createElement('div');
      body.className = 'card-body d-flex flex-column gap-2';
      card.appendChild(body);
      root.appendChild(card);
    }
    const body     = card.querySelector('.card-body') ?? card;
    body.innerHTML = '';
    const btnClass = `btn btn-${variant} fw-semibold${full ? ' w-100' : ''}`;
    for (const entry of nav) {
      body.appendChild(_makeExitButton(entry, btnClass));
    }
  },
};
