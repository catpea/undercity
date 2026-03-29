/**
 * action.test.js — Unit tests for user.merge
 * Merge into Inventory: Merge an object (e.g., API response) into the user inventory.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'user.merge — is exported from runtime',
    run(RT) {
      const ns = RT.User ?? RT.user;
      if (!ns) throw new Error('Namespace User/user not found in runtime');
      if (typeof ns.merge !== 'function') throw new Error('user.merge is not a function');
    },
  },

  {
    name: 'user.merge — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.User.merge?.("responseVar");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
