// ── Runtime index ─────────────────────────────────────────────────────────────
// Single entry point for the generated app.
// Generated pages import everything from './js/runtime/index.js'.
//
// Static modules are copied as-is to js/runtime/ at build time.
// Only config.js (project constants) and extensions.js (plugin code) are
// generated per project — everything else is a plain file copy.
export { Bus }                      from './bus.js';
export { Inventory }                from './inventory.js';
export { History }                  from './history.js';
export { Navigator }                from './navigator.js';
export { User }                     from './user.js';
export { Actions }                  from './actions.js';
export { Display }                  from './display.js';
export { Render }                   from './render.js';
export { Media }                    from './media.js';
export { matchTarget, Room }        from './room.js';
export { Things, FormThing, WorkflowThing, PersonaLiveThing, AuthServerThing, TestAuthServerThing } from './things.js';
export { Input }                    from './input.js';
export { registerNamespace, route, runPayload } from './runner.js';

// Load plugin extensions (generated per project — may be empty)
import './extensions.js';
