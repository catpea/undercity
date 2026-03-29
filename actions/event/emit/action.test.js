/**
 * action.test.js — Unit tests for event.emit
 * Emit Event: Broadcast a named event on the flow event bus.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'event.emit — is exported from runtime',
    run(RT) {
      const ns = RT.Event ?? RT.event;
      if (!ns) throw new Error('Namespace Event/event not found in runtime');
      if (typeof ns.emit !== 'function') throw new Error('event.emit is not a function');
    },
  },

  {
    name: 'event.emit — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Event.emit?.("user-ready", "{ id: inventory.userId }");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
