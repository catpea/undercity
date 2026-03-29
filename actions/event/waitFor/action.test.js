/**
 * action.test.js — Unit tests for event.waitFor
 * Wait For Event: Pause flow until a named event fires (returns a Promise).
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'event.waitFor — is exported from runtime',
    run(RT) {
      const ns = RT.Event ?? RT.event;
      if (!ns) throw new Error('Namespace Event/event not found in runtime');
      if (typeof ns.waitFor !== 'function') throw new Error('event.waitFor is not a function');
    },
  },

  {
    name: 'event.waitFor — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Event.waitFor?.("", 0);
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
