// ── Runner ────────────────────────────────────────────────────────────────────
// Populates _NS with all built-in namespaces and exports the two core
// runtime functions: route() (diamond routing) and runPayload() (action runner).
import { Inventory } from './inventory.js';
import { History }   from './history.js';
import { Navigator } from './navigator.js';
import { Bus }       from './bus.js';
import { Actions }   from './actions.js';
import { Display }   from './display.js';
import { Render }    from './render.js';
import { Media }     from './media.js';
import { Room }      from './room.js';
import { Things }    from './things.js';
import { Input }     from './input.js';
import { User }      from './user.js';
import { Debug }     from './debug.js';
import { Submit }    from './submit.js';
import { _NS, registerNamespace } from './registry.js';

// ── Populate namespace map ─────────────────────────────────────────────────────
// MUD metaphor: the User (player) moves through rooms, carrying an inventory.
// All aliases resolve to runtime objects — use whichever vocabulary felt natural.
Object.assign(_NS, {
  // Core
  Actions, actions: Actions,
  Inventory, inventory: Inventory,
  Navigator, navigator: Navigator,
  // User (Player) — the person navigating the dungeon
  User, user: User,
  Player: User, player: User,
  // DOM / form / UI shorthands
  dom:  Actions,
  form: Actions,
  ui:   Actions,
  // Display — write content into existing elements
  Display, display: Display,
  // Render — build page components at runtime (use with template: "blank")
  Render, render: Render,
  // Media — file/camera upload UI
  Media, media: Media,
  // Room — emit events, show navigation
  Room, room: Room,
  // Things — registry of Thing instances inhabiting the current room
  Things, things: Things,
  // Input — 18 smart reactive form inputs (two-way bound to Inventory)
  Input, input: Input,
  // Debug — developer tools (inventory dump, diagnostics)
  Debug, debug: Debug,
  // Submit — send Inventory to external services (task queue, APIs)
  Submit, submit: Submit,
  // "http" maps to Actions (which contains .get, .post, .fetch)
  http: Actions,
});

export { registerNamespace };

// ── Diamond Router ────────────────────────────────────────────────────────────
export function route(routes) {
  const inv = Inventory.dump();
  for (const { condition, target } of routes) {
    try {
      if (!condition || condition === 'true' ||
          (new Function('inventory', 'return !!(' + condition + ')')(inv))) {
        History.push(target);
        Navigator.goto(target);
        return;
      }
    } catch (e) { console.warn('[route] condition error:', condition, e); }
  }
  // No route matched — surface the error so it doesn't silently hang
  console.warn('[route] no condition matched — inventory:', inv);
  Bus.emit('route:noMatch', { routes, inventory: inv });
  Actions.toast('Navigation error: no path matched. Please go back.', 'warning');
}

// ── Payload Runner ────────────────────────────────────────────────────────────
// Supports:
//   action: "Namespace.method"  OR  "namespace.method"  OR  "method"
//   params: { arg1, arg2, ..., into: "inventoryKey" }
//
// If the action returns a value and "into" is specified, the value is stored
// in Inventory under that key.
export async function runPayload(steps) {
  for (const step of (steps ?? [])) {
    try {
      const { action, params = {} } = step;
      const dot  = action.indexOf('.');
      const ns   = dot >= 0 ? action.slice(0, dot) : 'Actions';
      const fn   = dot >= 0 ? action.slice(dot + 1) : action;

      const target = _NS[ns];

      // Extract "into" before building fn args (it's a meta-param, not passed to the fn)
      const { into, ...rest } = params;
      const fnArgs = Object.values(rest);

      let result;
      if (target?.[fn]) {
        result = await target[fn](...fnArgs);
      } else {
        console.warn('[runPayload] unknown action:', action, '— known namespaces:', Object.keys(_NS).filter(k => k[0] === k[0].toUpperCase()));
      }

      // Store return value in inventory if "into" was specified
      if (into !== undefined && result !== undefined) {
        Inventory.set(into, result);
      }
    } catch (e) { console.error('[payload]', step, e); }
  }
}
