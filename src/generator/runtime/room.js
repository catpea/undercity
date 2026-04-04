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

// ── Room ──────────────────────────────────────────────────────────────────────
export const Room = {
  /**
   * Emit a named event to Things in this room.
   * `at` is a glob pattern: '*' broadcasts to all Things (default),
   * 'Form1' targets exactly one, 'Form*' targets by name prefix.
   */
  emit({ event: eventName, at: target = '*', data } = {}) {
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
   * Render Bootstrap 5.3 navigation buttons for every exit in this room.
   * Reads window._PW_NAV populated by Room.exits().
   *
   * Creates an <af-show-navigation-buttons> component inside a card so the
   * generated page source is readable and the component is self-documenting.
   *
   * @param {string}  variant  Bootstrap color variant (default 'primary')
   * @param {boolean} full     Full-width buttons (default true)
   * @param {string}  size     'sm' | 'lg' | '' default size (default '')
   * @param {boolean} outline  Use outline variant (default false)
   * @param {boolean} group    Wrap in .btn-group (default false)
   */
  showNav({ variant = 'primary', full = true, size = '', outline = false, group = false } = {}) {
    const nav = window._PW_NAV ?? [];
    if (!nav.length) return;

    const root = _pwContainer();
    let card   = root.querySelector('#pw-nav-card');
    if (!card) {
      card = document.createElement('div');
      card.id        = 'pw-nav-card';
      card.className = 'card mt-3';
      const body = document.createElement('div');
      body.className = 'card-body';
      card.appendChild(body);
      root.appendChild(card);
    }

    const body = card.querySelector('.card-body') ?? card;
    body.innerHTML = '';

    const el = document.createElement('af-show-navigation-buttons');
    el.setAttribute('variant', variant || 'primary');
    if (size)    el.setAttribute('size',    size);
    if (outline) el.setAttribute('outline', '');
    if (full)    el.setAttribute('full',    '');
    if (group)   el.setAttribute('group',   '');
    body.appendChild(el);
  },
};
