/**
 * action.test.js — Unit tests for user.delete
 * Delete Inventory Item: Remove a key from the user's inventory.
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: 'user.delete — is exported from runtime',
    run(RT) {
      const ns = RT.User ?? RT.user;
      if (!ns) throw new Error('Namespace User/user not found in runtime');
      if (typeof ns.delete !== 'function') throw new Error('user.delete is not a function');
    },
  },

  {
    name: 'user.delete — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.User.delete?.("");
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },

];
