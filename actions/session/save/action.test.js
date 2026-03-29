/**
 * action.test.js — Unit tests for session.save
 * Save to Session: Persist a value to sessionStorage.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'session.save — is exported from runtime',
    run(RT) {
      const ns = RT.Session ?? RT.session;
      if (!ns) throw new Error('Namespace Session/session not found in runtime');
      if (typeof ns.save !== 'function') throw new Error('session.save is not a function');
    },
  },

  {
    name: 'session.save — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.Session.save?.("", "");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
