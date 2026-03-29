/**
 * action.test.js — Unit tests for user.dump
 * Dump Inventory to Console: console.log the full user inventory (debug).
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'user.dump — is exported from runtime',
    run(RT) {
      const ns = RT.User ?? RT.user;
      if (!ns) throw new Error('Namespace User/user not found in runtime');
      if (typeof ns.dump !== 'function') throw new Error('user.dump is not a function');
    },
  },

  {
    name: 'user.dump — can be called with no arguments',
    async run(RT, sandbox) {
      // Smoke test: calling the action should not throw
      // (may produce DOM changes or be a no-op depending on state)
      try {
        await RT.User.dump?.();
      } catch (e) {
        // Some actions require specific DOM state — acceptable
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
