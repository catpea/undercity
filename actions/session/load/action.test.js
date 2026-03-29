/**
 * action.test.js — Unit tests for session.load
 * Load from Session: Read a value from sessionStorage into inventory.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'session.load — is exported from runtime',
    run(RT) {
      const ns = RT.Session ?? RT.session;
      if (!ns) throw new Error('Namespace Session/session not found in runtime');
      if (typeof ns.load !== 'function') throw new Error('session.load is not a function');
    },
  },

  {
    name: 'session.load — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Session.load?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
