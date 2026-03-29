/**
 * action.test.js — Unit tests for session.local
 * Save to localStorage: Persist a value across browser sessions.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'session.local — is exported from runtime',
    run(RT) {
      const ns = RT.Session ?? RT.session;
      if (!ns) throw new Error('Namespace Session/session not found in runtime');
      if (typeof ns.local !== 'function') throw new Error('session.local is not a function');
    },
  },

  {
    name: 'session.local — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Session.local?.("", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
