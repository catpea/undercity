/**
 * action.test.js — Unit tests for event.on
 * Listen for Event: Register a handler for an event. Auto-unsubscribed on room exit.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'event.on — is exported from runtime',
    run(RT) {
      const ns = RT.Event ?? RT.event;
      if (!ns) throw new Error('Namespace Event/event not found in runtime');
      if (typeof ns.on !== 'function') throw new Error('event.on is not a function');
    },
  },

  {
    name: 'event.on — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Event.on?.("", "(data) => { /* ... */ }");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
