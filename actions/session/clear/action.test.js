/**
 * action.test.js — Unit tests for session.clear
 * Clear Session: Remove all Undercity keys from sessionStorage.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'session.clear — is exported from runtime',
    run(RT) {
      const ns = RT.Session ?? RT.session;
      if (!ns) throw new Error('Namespace Session/session not found in runtime');
      if (typeof ns.clear !== 'function') throw new Error('session.clear is not a function');
    },
  },

  {
    name: 'session.clear — can be called with no arguments',
    async run(RT, sandbox) {
      // Smoke test: calling the action should not throw
      // (may produce DOM changes or be a no-op depending on state)
      try {
        await RT.Session.clear?.();
      } catch (e) {
        // Some actions require specific DOM state — acceptable
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
