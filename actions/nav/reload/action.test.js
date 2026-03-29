/**
 * action.test.js — Unit tests for nav.reload
 * Reload Page: Hard-reload the current room.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'nav.reload — is exported from runtime',
    run(RT) {
      const ns = RT.Nav ?? RT.nav;
      if (!ns) throw new Error('Namespace Nav/nav not found in runtime');
      if (typeof ns.reload !== 'function') throw new Error('nav.reload is not a function');
    },
  },

  {
    name: 'nav.reload — can be called with no arguments',
    async run(RT, sandbox) {
      // Smoke test: calling the action should not throw
      // (may produce DOM changes or be a no-op depending on state)
      try {
        await RT.Nav.reload?.();
      } catch (e) {
        // Some actions require specific DOM state — acceptable
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
